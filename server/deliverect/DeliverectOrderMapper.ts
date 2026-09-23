import { Order, Money, PickingState } from '../../src/commerce/models';

export interface RawDeliverectOrderItem {
  id?: string;
  plu?: string;
  name?: string;
  quantity?: number;
  count?: number;
  price?: number | Money;
  unitPrice?: number | Money;
  subtotal?: number | Money;
  imageUrl?: string;
  image?: string;
  images?: Array<string | { url?: string }>;
  substitutionPreference?: string;
  substituteCandidates?: Array<{ plu: string; name?: string; price?: number | Money }>;
  preferredSubstitutePlu?: string;
  preferredSubstituteName?: string;
  preferredSubstitutePrice?: Money;
  [key: string]: any;
}

export interface RawDeliverectOrder {
  _id?: string;
  id?: string;
  orderId?: string;
  externalOrderId?: string;
  channelOrderId?: string;
  channelOrderDisplayId?: string;
  channelOrderRawId?: string;
  displayId?: string;
  orderReference?: string;
  basketId?: string;
  deliverectAccountId?: string;
  deliverectLocationId?: string;
  accountId?: string;
  locationId?: string;
  channelLinkId?: string;
  status?: string | number;
  fulfillmentType?: string;
  orderType?: number;
  items?: RawDeliverectOrderItem[];
  originalBasket?: {
    id?: string;
    fulfillmentType?: string;
    items?: RawDeliverectOrderItem[];
    total?: Money;
    currency?: string;
  };
  currentOrder?: {
    itemCount?: number;
    total?: Money;
  };
  pricing?: {
    total?: Money;
  };
  total?: number | Money;
  currency?: string;
  fulfillment?: {
    type?: string;
    address?: {
      formattedAddress?: string;
      postcode?: string;
    };
  };
  delivery?: {
    deliveryOption?: {
      deliveryEta?: string;
    };
  };
  payment?: {
    state?: string;
    paymentId?: string;
    authorizationMaximum?: Money;
  };
  paymentState?: string;
  paymentId?: string;
  picking?: PickingState;
  createdAt?: string;
  [key: string]: any;
}

function firstItemImage(item: RawDeliverectOrderItem): string | undefined {
  const direct = [item.imageUrl, item.image].find((value) => typeof value === 'string' && value.trim());
  if (direct) return direct.trim();
  for (const candidate of item.images || []) {
    const value = typeof candidate === 'string' ? candidate : candidate?.url;
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

/**
 * Convert Deliverect's fulfilment representation into Bwydi's canonical domain values.
 *
 * Deliverect orderType values used by the Ordering Experience order model:
 *   1 = pickup, 2 = delivery.
 *
 * Bwydi uses `pickup` internally and renders the customer-facing label "Collection"
 * in the UI. Unknown/unsupported fulfilment modes must never silently become delivery.
 */
export function normalizeDeliverectFulfillmentType(
  raw: Pick<RawDeliverectOrder, 'fulfillment' | 'fulfillmentType' | 'orderType' | 'originalBasket'>
): 'delivery' | 'pickup' {
  const explicitType = String(
    raw.fulfillment?.type ||
    raw.fulfillmentType ||
    raw.originalBasket?.fulfillmentType ||
    ''
  )
    .trim()
    .toLowerCase();

  if (['pickup', 'collection', 'takeaway'].includes(explicitType)) return 'pickup';
  if (['delivery', 'online_delivery'].includes(explicitType)) return 'delivery';

  const orderType = Number(raw.orderType);
  if (orderType === 1) return 'pickup';
  if (orderType === 2) return 'delivery';

  const detail = explicitType || `orderType:${String(raw.orderType ?? 'missing')}`;
  const error: any = new Error(`Unsupported Deliverect fulfilment type: ${detail}`);
  error.code = 'UNSUPPORTED_FULFILLMENT_TYPE';
  throw error;
}

/**
 * Normalizes a raw Deliverect order or Bwydi Order into a clean, consistent structure for OrderProjections.
 */
export class DeliverectOrderMapper {
  static normalizeOrder(raw: RawDeliverectOrder): Order {
    const id =
      raw.id || raw._id || raw.orderId || raw.externalOrderId || raw.channelOrderRawId || raw.channelOrderId || `ord_${Date.now()}`;
    const channelOrderId = raw.channelOrderId || raw.channelOrderDisplayId || raw.displayId || raw.orderReference;
    const basketId = raw.basketId || raw.originalBasket?.id;
    const rawItems: RawDeliverectOrderItem[] = raw.items || raw.originalBasket?.items || [];
    const currency = typeof raw.currency === 'string' ? raw.currency : raw.pricing?.total?.currency || raw.originalBasket?.currency || 'GBP';

    const normalizedItems = rawItems.map((item, idx) => {
      const rawPrice = item.price ?? item.unitPrice ?? item.subtotal ?? 0;
      let priceObj: Money;
      if (typeof rawPrice === 'object' && rawPrice !== null && 'amount' in rawPrice) priceObj = rawPrice as Money;
      else if (typeof rawPrice === 'number') priceObj = { amount: Math.round(rawPrice), currency };
      else priceObj = { amount: 0, currency };
      const qty = item.quantity ?? item.count ?? 1;
      return {
        id: item.id || `item_${item.plu || idx}`,
        plu: String(item.plu || `PLU_${idx}`),
        name: String(item.name || item.plu || `Item ${idx + 1}`),
        quantity: qty,
        price: priceObj,
        imageUrl: firstItemImage(item),
        substitutionPreference: (item.substitutionPreference as any) || 'BEST_MATCH',
        substituteCandidates: item.substituteCandidates as any,
        preferredSubstitutePlu: item.preferredSubstitutePlu,
        preferredSubstituteName: item.preferredSubstituteName,
        preferredSubstitutePrice: item.preferredSubstitutePrice,
      };
    });

    let totalAmount = 0;
    if (typeof raw.total === 'number') totalAmount = Math.round(raw.total);
    else if (typeof raw.total === 'object' && raw.total !== null && 'amount' in raw.total) totalAmount = raw.total.amount;
    else if (raw.currentOrder?.total?.amount) totalAmount = raw.currentOrder.total.amount;
    else if (raw.pricing?.total?.amount) totalAmount = raw.pricing.total.amount;
    else if (raw.originalBasket?.total?.amount) totalAmount = raw.originalBasket.total.amount;
    else totalAmount = normalizedItems.reduce((acc, item) => acc + item.price.amount * item.quantity, 0);

    let status = String(raw.status || 'ORDER_CONFIRMED');
    if (status === '10' || status === '1') status = 'STORE_ACCEPTED';
    if (status === '20' || status === '2') status = 'PREPARING';
    if (status === '50' || status === '5') status = 'DELIVERED';
    if (status === '110' || status === '11') status = 'CANCELLED';
    const fulfillmentType = normalizeDeliverectFulfillmentType(raw);

    return {
      ...(raw as any),
      id,
      storeId: raw.channelLinkId || raw.deliverectLocationId || raw.locationId || 'store-alpha',
      status: status as any,
      fulfillment: { type: fulfillmentType, address: raw.fulfillment?.address },
      originalBasket: {
        id: basketId || `basket_${id}`,
        storeId: raw.channelLinkId || 'store-alpha',
        fulfillmentType,
        items: normalizedItems,
        total: { amount: totalAmount, currency },
        currency,
      },
      currentOrder: {
        itemCount: normalizedItems.reduce((sum, i) => sum + i.quantity, 0),
        total: { amount: totalAmount, currency },
      },
      payment: {
        state: raw.payment?.state || raw.paymentState || 'NO_CAPTURE_REQUIRED',
        paymentId: raw.payment?.paymentId || raw.paymentId,
        authorizationMaximum: raw.payment?.authorizationMaximum || { amount: totalAmount, currency },
      },
      orderReference: channelOrderId || id,
      createdAt: raw.createdAt || new Date().toISOString(),
    };
  }
}
