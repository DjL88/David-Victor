/**
 * DeliverectBasketMapper
 *
 * The single boundary between raw Deliverect Commerce JSON and Bwydi's domain
 * `Basket`. Nothing downstream of this file should ever touch a raw Deliverect
 * field, and nothing upstream should ever see a Bwydi model.
 *
 * Rules enforced here:
 *  - Every monetary value is integer minor units (see deliverectMoney.ts).
 *  - `item.price` is the UNIT price; the line total is unit * quantity.
 *  - Deliverect's `payment.total` is the ONLY payable total. We never sum our
 *    own lines and present the result as authoritative.
 *  - `menuId` is preserved on every line, because PATCH /items requires the
 *    menuId+plu pair and the channel order does not carry menuId back.
 *  - `channelItemId` is preserved when present, because Quest amendment and
 *    substitution callbacks key on it (proven on the Asda retail order, where
 *    every line carried a channelItemId and `unavailableActions`).
 */

import type {
  Basket,
  BasketItem,
  BasketCharge,
  BasketDiscount,
  BasketValidationError,
  BasketItemSubItem,
  Restriction,
} from '../../src/commerce/models';
import type { SubstitutionPreferenceType } from '../../src/commerce/postCheckoutModels';
import {
  Money,
  DeliverectMoneyError,
  toMinorMoney,
  toOptionalMinorMoney,
  normaliseCurrency,
  readFractionalDigits,
  lineTotal,
  zeroMoney,
  sumMoney,
} from './deliverectMoney';

export type JsonObject = Record<string, any>;

/**
 * Extra Deliverect-native fields Bwydi must retain per line but which are not
 * on the shared `BasketItem` shape. Carried as a non-enumerable-ish extension
 * so existing consumers of BasketItem are unaffected.
 */
export interface DeliverectLineMetadata {
  /** REQUIRED for PATCH /items. Never drop this. */
  menuId: string;
  /** Deliverect's own line identifier, when the basket response supplies one. */
  deliverectLineId?: string;
  /** Present on channel orders; the key Quest callbacks use. */
  channelItemId?: string;
  /** Unit price exactly as Deliverect sent it, before any Bwydi arithmetic. */
  rawUnitPriceMinor: number;
}

export type MappedBasketItem = BasketItem & { deliverect: DeliverectLineMetadata };
export type MappedBasket = Omit<Basket, 'items'> & {
  items: MappedBasketItem[];
  deliverect: {
    basketId: string;
    storeId: string;
    /** True when Deliverect returned an authoritative payment.total. */
    hasAuthoritativeTotal: boolean;
  };
};

export type DeliverectItemUnavailableAction =
  | 'ITEM_AMENDMENT'
  | 'ITEM_REMOVE'
  | 'ITEM_SUBSTITUTION'
  | 'ITEM_SUBSTITUTION_CATALOG'
  | 'ITEM_SUBSTITUTION_CUSTOMER'
  | 'CANCEL_ORDER';

/**
 * Translate Bwydi's customer preference into Deliverect Retail/Quest's item-level
 * unavailable-action contract. Quest only exposes amend/remove/replace controls
 * when these permissions are present on the order item.
 */
export function buildQuestItemUnavailableActions(
  preference?: SubstitutionPreferenceType | string
): DeliverectItemUnavailableAction[] {
  switch (String(preference || 'BEST_MATCH').toUpperCase()) {
    case 'CUSTOMER_SELECTED':
      // Retail channels such as Snappy expose catalogue substitution rather
      // than ITEM_SUBSTITUTION_CUSTOMER. Keep the customer's saved choice in
      // our order projection and return it first from the substitutions
      // callback; Quest still receives the proven catalogue action contract.
      return ['ITEM_AMENDMENT', 'ITEM_REMOVE', 'ITEM_SUBSTITUTION_CATALOG'];
    case 'CANCEL_ORDER_IF_UNAVAILABLE':
      return ['ITEM_AMENDMENT', 'CANCEL_ORDER'];
    case 'REMOVE_IF_UNAVAILABLE':
    case 'DO_NOT_SUBSTITUTE':
      return ['ITEM_AMENDMENT', 'ITEM_REMOVE'];
    case 'BEST_MATCH':
    default:
      return ['ITEM_AMENDMENT', 'ITEM_REMOVE', 'ITEM_SUBSTITUTION_CATALOG'];
  }
}

export class DeliverectBasketMappingError extends Error {
  readonly code: string;
  readonly field?: string;

  constructor(message: string, code = 'DELIVERECT_BASKET_MAPPING_FAILED', field?: string) {
    super(message);
    this.name = 'DeliverectBasketMappingError';
    this.code = code;
    this.field = field;
  }
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
}

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Deliverect's basket fulfillment type -> Bwydi's. Deliverect uses `pickup`;
 * the Bwydi UI calls the same thing Collection.
 */
function mapFulfillmentType(raw: unknown): 'delivery' | 'pickup' {
  const value = firstString((raw as any)?.type, raw).toLowerCase();
  if (value === 'delivery' || value === 'deliver') return 'delivery';
  return 'pickup';
}

function mapSubItems(raw: unknown, currency: string, fractionalDigits: number, path: string): BasketItemSubItem[] {
  return asArray(raw).map((sub, index) => {
    const plu = firstString(sub?.plu, sub?.customizationPlu);
    if (!plu) {
      throw new DeliverectBasketMappingError(
        `Basket sub-item at ${path}.subItems[${index}] has no PLU.`,
        'DELIVERECT_SUBITEM_MISSING_PLU',
        `${path}.subItems[${index}]`
      );
    }
    const price =
      toOptionalMinorMoney(sub?.price, `${path}.subItems[${index}].price`, { currency, fractionalDigits }) ??
      zeroMoney(currency, fractionalDigits);

    return {
      id: firstString(sub?.id, sub?._id) || undefined,
      modifierId: firstString(sub?.modifierId) || undefined,
      plu,
      name: firstString(sub?.name, plu),
      price,
      priceMinor: price.amount,
      quantity: Number.isInteger(sub?.quantity) && sub.quantity > 0 ? sub.quantity : 1,
      sectionId: firstString(sub?.sectionId) || undefined,
      sectionName: firstString(sub?.sectionName) || undefined,
    };
  });
}

/**
 * Maps one raw Deliverect basket line.
 *
 * `fallbackMenuId` is the basket-level menu, used when Deliverect echoes items
 * without repeating menuId. If neither is available we throw: a line without a
 * menuId cannot be sent back through PATCH /items, so silently accepting it
 * would produce a basket that can never be updated again.
 */
function mapItem(
  raw: JsonObject,
  index: number,
  currency: string,
  fractionalDigits: number,
  fallbackMenuId: string
): MappedBasketItem {
  const path = `items[${index}]`;
  const plu = firstString(raw?.plu, raw?.productPlu);
  if (!plu) {
    throw new DeliverectBasketMappingError(
      `Deliverect basket line ${path} has no PLU.`,
      'DELIVERECT_ITEM_MISSING_PLU',
      path
    );
  }

  const menuId = firstString(raw?.menuId, raw?.menu, fallbackMenuId);
  if (!menuId) {
    throw new DeliverectBasketMappingError(
      `Deliverect basket line ${path} (plu ${plu}) has no menuId, and the basket supplied no fallback. ` +
        `PATCH /items requires a menuId+plu pair, so this line could never be updated. ` +
        `Refusing to build a basket that cannot be modified.`,
      'DELIVERECT_ITEM_MISSING_MENU_ID',
      path
    );
  }

  const quantity = raw?.quantity;
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new DeliverectBasketMappingError(
      `Deliverect basket line ${path} (plu ${plu}) has a non-positive or non-integer quantity: ${JSON.stringify(quantity)}.`,
      'DELIVERECT_ITEM_INVALID_QUANTITY',
      `${path}.quantity`
    );
  }

  // PROVEN: price is the unit price. DLV1016 price 1615 x qty 3 = payment.amount 4845.
  const unitPrice = toMinorMoney(raw?.price, `${path}.price`, { currency, fractionalDigits });
  const totalPrice = lineTotal(unitPrice, quantity, path);

  const item: MappedBasketItem = {
    id: firstString(raw?.id, raw?._id, raw?.lineId, `${menuId}:${plu}:${index}`),
    plu,
    name: firstString(raw?.name, raw?.productName, plu),
    unitPrice,
    totalPrice,
    // `price` on BasketItem is the per-unit price; UI multiplies by quantity itself.
    price: unitPrice,
    quantity,
    imageUrl: firstString(raw?.imageUrl, raw?.image) || undefined,
    subItems: mapSubItems(raw?.subItems, currency, fractionalDigits, path),
    deliverect: {
      menuId,
      deliverectLineId: firstString(raw?.id, raw?._id, raw?.lineId) || undefined,
      channelItemId: firstString(raw?.channelItemId) || undefined,
      rawUnitPriceMinor: unitPrice.amount,
    },
  };

  const originalPrice = toOptionalMinorMoney(raw?.originalPrice, `${path}.originalPrice`, {
    currency,
    fractionalDigits,
  });
  if (originalPrice) item.originalPrice = originalPrice;

  if (typeof raw?.note === 'string' && raw.note.trim()) {
    (item as any).note = raw.note.trim();
  }

  const rawActions = asArray(raw?.itemUnavailableActions ?? raw?.unavailableActions).map((a) => String(a));
  if (rawActions.length > 0) {
    (item as any).itemUnavailableActions = rawActions;
    (item as any).deliverectUnavailableActions = rawActions;
    item.allowQuantityAmendment = rawActions.includes('ITEM_AMENDMENT');
  }
  const preference = firstString(raw?.substitutionPreference);
  if (preference) {
    item.substitutionPreference = preference as SubstitutionPreferenceType;
  }

  return item;
}

function mapDiscounts(raw: unknown, currency: string, fractionalDigits: number): BasketDiscount[] {
  return asArray(raw).map((discount, index) => ({
    id: firstString(discount?.id, discount?._id, discount?.referenceId) || undefined,
    code: firstString(discount?.code, discount?.channelDiscountCode, discount?.referenceId, `discount_${index}`),
    title: firstString(discount?.title, discount?.name, 'Discount'),
    amount:
      toOptionalMinorMoney(
        typeof discount?.amount === 'number' ? Math.abs(discount.amount) : discount?.value,
        `discounts[${index}].amount`,
        { currency, fractionalDigits }
      ) ?? zeroMoney(currency, fractionalDigits),
    description: firstString(discount?.description) || undefined,
  }));
}

function mapCharges(rawBasket: JsonObject, currency: string, fractionalDigits: number): BasketCharge[] {
  const charges: BasketCharge[] = [];
  const candidates: Array<{ key: string; type: BasketCharge['type']; title: string }> = [
    { key: 'deliveryCost', type: 'deliveryFee', title: 'Delivery' },
    { key: 'serviceCharge', type: 'serviceCharge', title: 'Service charge' },
    { key: 'bagFee', type: 'bagFee', title: 'Bag fee' },
    { key: 'smallOrderFee', type: 'smallOrderFee', title: 'Small order fee' },
  ];

  for (const candidate of candidates) {
    const source = rawBasket?.[candidate.key] ?? rawBasket?.payment?.[candidate.key];
    const amount = toOptionalMinorMoney(source, candidate.key, { currency, fractionalDigits });
    if (amount && amount.amount > 0) {
      charges.push({ id: candidate.key, type: candidate.type, title: candidate.title, amount });
    }
  }

  for (const [index, charge] of asArray(rawBasket?.charges).entries()) {
    const amount = toOptionalMinorMoney(charge?.amount, `charges[${index}].amount`, { currency, fractionalDigits });
    if (!amount) continue;
    charges.push({
      id: firstString(charge?.id, charge?._id, `charge_${index}`),
      type: (firstString(charge?.type) as BasketCharge['type']) || 'serviceCharge',
      title: firstString(charge?.title, charge?.name, 'Charge'),
      amount,
      taxable: typeof charge?.taxable === 'boolean' ? charge.taxable : undefined,
    });
  }

  return charges;
}

function mapValidationErrors(raw: unknown): BasketValidationError[] {
  return asArray(raw).map((error, index) => ({
    code: firstString(error?.code, `VALIDATION_${index}`),
    message: firstString(error?.message, error?.description, 'Basket validation issue'),
    severity: firstString(error?.severity).toLowerCase() === 'warning' ? 'warning' : 'blocking',
    plu: firstString(error?.plu) || undefined,
  }));
}

function mapRestrictions(raw: unknown): Restriction[] {
  return asArray(raw).map((restriction, index) => ({
    code: firstString(restriction?.code, `RESTRICTION_${index}`),
    message: firstString(restriction?.message, 'Restriction applies'),
    severity: firstString(restriction?.severity).toLowerCase() === 'warning' ? 'warning' : 'blocking',
  }));
}

export function getAuthoritativeTotalMinor(rawBasket: JsonObject): number {
  const candidates = [rawBasket?.payment?.total, rawBasket?.payment?.amount, rawBasket?.total];
  for (const candidate of candidates) {
    if (Number.isInteger(candidate) && candidate >= 0) return candidate;
  }
  throw new DeliverectBasketMappingError(
    'Deliverect basket response contained no integer payment.total. Refusing to guess a payable amount.',
    'DELIVERECT_BASKET_NO_AUTHORITATIVE_TOTAL',
    'payment.total'
  );
}

export interface MapBasketOptions {
  storeName?: string;
  fallbackMenuId?: string;
  strictTotals?: boolean;
}

export function mapDeliverectBasket(rawBasket: JsonObject, options: MapBasketOptions = {}): MappedBasket {
  if (!rawBasket || typeof rawBasket !== 'object') {
    throw new DeliverectBasketMappingError(
      'Deliverect basket response was empty or not an object.',
      'DELIVERECT_BASKET_EMPTY'
    );
  }

  const basketId = firstString(rawBasket.id, rawBasket._id, rawBasket.basketId);
  if (!basketId) {
    throw new DeliverectBasketMappingError(
      'Deliverect basket response contained no basket id.',
      'DELIVERECT_BASKET_NO_ID',
      'id'
    );
  }
  if (/^bsk_/i.test(basketId)) {
    throw new DeliverectBasketMappingError(
      `Basket id "${basketId}" is a local BasketService identifier, not a Deliverect one. ` +
        `The local basket path must never reach the Deliverect mapper.`,
      'DELIVERECT_BASKET_LOCAL_ID_LEAK',
      'id'
    );
  }

  const currency = normaliseCurrency(rawBasket.currency ?? rawBasket.payment?.currency);
  const fractionalDigits = readFractionalDigits(rawBasket);
  const fallbackMenuId = firstString(options.fallbackMenuId, rawBasket.menuId, asArray(rawBasket.menus)[0]);

  const items = asArray(rawBasket.items).map((raw, index) =>
    mapItem(raw, index, currency, fractionalDigits, fallbackMenuId)
  );

  const totalMinor = getAuthoritativeTotalMinor(rawBasket);
  const total: Money = { amount: totalMinor, currency, fractionalDigits };

  const computedSubtotal = sumMoney(
    items.map((item) => item.totalPrice as Money),
    currency,
    'subtotal'
  );
  const subtotal =
    toOptionalMinorMoney(rawBasket.payment?.subTotal ?? rawBasket.subtotal, 'payment.subTotal', {
      currency,
      fractionalDigits,
    }) ?? computedSubtotal;

  const discounts = mapDiscounts(rawBasket.discounts, currency, fractionalDigits);
  const charges = mapCharges(rawBasket, currency, fractionalDigits);

  const discountTotal =
    toOptionalMinorMoney(
      typeof rawBasket.discountTotal === 'number' ? Math.abs(rawBasket.discountTotal) : undefined,
      'discountTotal',
      { currency, fractionalDigits }
    ) ?? sumMoney(discounts.map((d) => d.amount), currency, 'discountTotal');

  const chargeTotal = sumMoney(charges.map((c) => c.amount), currency, 'charges');
  const reconstructed = subtotal.amount + chargeTotal.amount - discountTotal.amount;
  if (options.strictTotals !== false && items.length > 0 && reconstructed !== total.amount) {
    throw new DeliverectBasketMappingError(
      `Basket total reconciliation failed for ${basketId}. ` +
        `Deliverect payment.total=${total.amount}, but subtotal(${subtotal.amount}) ` +
        `+ charges(${chargeTotal.amount}) - discounts(${discountTotal.amount}) = ${reconstructed}. ` +
        `This means the line-price contract has changed. Refusing to render a total Bwydi cannot explain.`,
      'DELIVERECT_BASKET_TOTAL_MISMATCH',
      'payment.total'
    );
  }

  const customerRaw = rawBasket.customer || {};

  return {
    id: basketId,
    storeId: firstString(rawBasket.storeId, rawBasket.channelLinkId, rawBasket.store?.id),
    storeName: firstString(options.storeName, rawBasket.store?.name),
    fulfillmentType: mapFulfillmentType(rawBasket.fulfillment),
    items,
    subtotal,
    discounts,
    charges,
    tax: toOptionalMinorMoney(rawBasket.payment?.tax ?? rawBasket.tax, 'payment.tax', {
      currency,
      fractionalDigits,
    }),
    total,
    discountTotal,
    tip: toOptionalMinorMoney(rawBasket.tip, 'tip', { currency, fractionalDigits }),
    depositTotal: toOptionalMinorMoney(rawBasket.depositTotal, 'depositTotal', { currency, fractionalDigits }),
    currency,
    validationErrors: mapValidationErrors(rawBasket.validationErrors ?? rawBasket.validation?.errors),
    restrictions: mapRestrictions(rawBasket.restrictions),
    customer: {
      name: firstString(customerRaw.name) || undefined,
      email: firstString(customerRaw.email) || undefined,
      phone: firstString(customerRaw.phoneNumber, customerRaw.phone) || undefined,
      companyName: firstString(customerRaw.companyName) || undefined,
    },
    updatedAt: firstString(rawBasket._updated, rawBasket.updatedAt) || new Date().toISOString(),
    deliverect: {
      basketId,
      storeId: firstString(rawBasket.storeId, rawBasket.channelLinkId),
      hasAuthoritativeTotal: true,
    },
  };
}

export function toCommerceItemInputs(
  basket: MappedBasket
): Array<{
  menuId: string;
  plu: string;
  quantity: number;
  note?: string;
  subItems?: any[];
  itemUnavailableActions: DeliverectItemUnavailableAction[];
  substituteCandidate?: Array<{ plu: string; name: string; quantity?: number; price?: number }>;
}> {
  return basket.items.map((item) => {
    const preference = item.substitutionPreference || 'BEST_MATCH';
    const actions =
      Array.isArray((item as any).itemUnavailableActions) &&
      (item as any).itemUnavailableActions.length > 0
        ? (item as any).itemUnavailableActions
        : buildQuestItemUnavailableActions(preference);

    const preferredPrice = (item as any).preferredSubstitutePrice;
    const preferredPlu = String((item as any).preferredSubstitutePlu || '').trim();
    const preferredName = String((item as any).preferredSubstituteName || preferredPlu).trim();

    const substituteCandidate =
      String(preference).toUpperCase() === 'CUSTOMER_SELECTED' && preferredPlu
        ? [
            {
              plu: preferredPlu,
              name: preferredName || preferredPlu,
              quantity: item.quantity,
              ...(preferredPrice && typeof preferredPrice.amount === 'number'
                ? { price: Math.round(preferredPrice.amount) }
                : {}),
            },
          ]
        : undefined;

    return {
      menuId: item.deliverect.menuId,
      plu: item.plu,
      quantity: item.quantity,
      ...((item as any).note ? { note: (item as any).note } : {}),
      ...(item.subItems && item.subItems.length > 0
        ? { subItems: item.subItems.map((sub) => ({ plu: sub.plu, quantity: sub.quantity })) }
        : {}),
      itemUnavailableActions: actions,
      ...(substituteCandidate ? { substituteCandidate } : {}),
    };
  });
}

export { DeliverectMoneyError };
