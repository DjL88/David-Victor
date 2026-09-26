/**
 * Substitution pricing and authorization calculation engine.
 * Applies configurable tenant substitution price policies:
 * - LOWER_OF_ORIGINAL_AND_SUBSTITUTE
 * - SUBSTITUTE_PRICE
 * - ORIGINAL_PRICE
 * - CUSTOM_RULE
 */

import {
  SubstitutionPricePolicy,
  SubstitutionPreferenceType,
  DeliverectSubstitutionMapping,
  TenantSubstitutionPolicy,
} from './postCheckoutModels';
import { Money, toMoney, moneyFromMajor, moneyToMajor, moneyToMinor, BasketItem } from './models';

export const DEFAULT_SUBSTITUTION_POLICY: TenantSubstitutionPolicy = {
  enabled: true,
  allowBestMatch: true,
  allowCustomerSelected: true,
  defaultPreference: 'BEST_MATCH',
  bestMatchPricePolicy: 'LOWER_OF_ORIGINAL_AND_SUBSTITUTE',
  // Base policy is line-total price protection for every substitution type.
  customerSelectedPricePolicy: 'LOWER_OF_ORIGINAL_AND_SUBSTITUTE',
  maxCustomerCandidates: 3,
  allowCancelOrderPreference: true,
};

export interface SubstitutionLineEconomicsInput {
  originalQuantity: number;
  originalUnitPrice: Money;
  replacementQuantity: number;
  replacementUnitPrice: Money;
  /**
   * Effective replacement unit price after an already-computed eligible
   * replacement promotion. Omit when no verified replacement promotion exists.
   */
  replacementEffectiveUnitPrice?: Money;
  /**
   * Frozen effective prices for original promotional/bundle units. These are
   * checkout-time allocations and must never be re-run during substitution.
   */
  protectedOriginalUnitPrices?: Money[];
}

export interface SubstitutionLineEconomics {
  originalQuantity: number;
  replacementQuantity: number;
  originalEffectiveLineTotal: Money;
  replacementRetailLineTotal: Money;
  replacementEffectiveLineTotal: Money;
  customerChargeLineTotal: Money;
  retailValueDelta: Money;
  customerPriceDelta: Money;
  priceProtectionAmount: Money;
}

function assertCompatibleMoney(currency: string, value: Money, label: string): number {
  if (!value || !Number.isInteger(value.amount) || value.amount < 0) {
    throw new Error(`${label} must be a non-negative integer minor-unit Money value.`);
  }
  if (value.currency !== currency) {
    throw new Error(`${label} currency ${value.currency} does not match ${currency}.`);
  }
  return value.amount;
}

/**
 * Authoritative default substitution pricing.
 *
 * Protection is applied to the ORIGINAL EFFECTIVE LINE TOTAL, never per
 * replacement unit. A quantity uplift therefore cannot multiply the protected
 * original amount. Signed deltas are intentionally retained for reporting.
 */
export function calculateSubstitutionLineEconomics(
  input: SubstitutionLineEconomicsInput
): SubstitutionLineEconomics {
  const originalQuantity = Math.max(0, Math.trunc(input.originalQuantity));
  const replacementQuantity = Math.max(0, Math.trunc(input.replacementQuantity));
  if (originalQuantity <= 0 || replacementQuantity <= 0) {
    throw new Error('Substitution quantities must be positive integers.');
  }

  const currency = input.originalUnitPrice.currency;
  const originalUnit = assertCompatibleMoney(currency, input.originalUnitPrice, 'originalUnitPrice');
  const replacementUnit = assertCompatibleMoney(currency, input.replacementUnitPrice, 'replacementUnitPrice');
  const replacementEffectiveUnit = input.replacementEffectiveUnitPrice
    ? assertCompatibleMoney(currency, input.replacementEffectiveUnitPrice, 'replacementEffectiveUnitPrice')
    : replacementUnit;

  const frozenOriginalUnits = (input.protectedOriginalUnitPrices || [])
    .slice(0, originalQuantity)
    .map((price) => assertCompatibleMoney(currency, price, 'protectedOriginalUnitPrice'));

  const originalEffectiveLineAmount =
    frozenOriginalUnits.reduce((sum, amount) => sum + amount, 0) +
    Math.max(0, originalQuantity - frozenOriginalUnits.length) * originalUnit;
  const replacementRetailAmount = replacementUnit * replacementQuantity;
  const replacementEffectiveAmount = replacementEffectiveUnit * replacementQuantity;
  const customerChargeAmount = Math.min(
    originalEffectiveLineAmount,
    replacementEffectiveAmount
  );

  return {
    originalQuantity,
    replacementQuantity,
    originalEffectiveLineTotal: toMoney(originalEffectiveLineAmount, currency),
    replacementRetailLineTotal: toMoney(replacementRetailAmount, currency),
    replacementEffectiveLineTotal: toMoney(replacementEffectiveAmount, currency),
    customerChargeLineTotal: toMoney(customerChargeAmount, currency),
    retailValueDelta: toMoney(replacementRetailAmount - originalEffectiveLineAmount, currency),
    customerPriceDelta: toMoney(customerChargeAmount - originalEffectiveLineAmount, currency),
    priceProtectionAmount: toMoney(
      Math.max(0, replacementEffectiveAmount - customerChargeAmount),
      currency
    ),
  };
}

/**
 * Calculates the charged price for a substitute item based on the active policy.
 * Operates in integer minor units (pence).
 */
export function calculateSubstitutionPrice(
  originalPrice: Money,
  substitutePrice: Money,
  policy: SubstitutionPricePolicy
): Money {
  const orig = originalPrice;
  const sub = substitutePrice;

  switch (policy) {
    case 'LOWER_OF_ORIGINAL_AND_SUBSTITUTE':
      return orig.amount <= sub.amount ? orig : sub;

    case 'SUBSTITUTE_PRICE':
      return sub;

    case 'ORIGINAL_PRICE':
      return orig;

    case 'CUSTOM_RULE':
      return orig.amount <= sub.amount ? orig : sub;

    default:
      return orig.amount <= sub.amount ? orig : sub;
  }
}

/**
 * Maps customer substitution preferences to future Deliverect Retail / Quest API metadata.
 */
export function mapToDeliverectSubstitutionType(
  preference: SubstitutionPreferenceType
): DeliverectSubstitutionMapping {
  switch (preference) {
    case 'BEST_MATCH':
      return 'ITEM_SUBSTITUTION';
    case 'CUSTOMER_SELECTED':
      return 'ITEM_SUBSTITUTION_CUSTOMER';
    case 'REMOVE_IF_UNAVAILABLE':
      return 'ITEM_REMOVE';
    case 'CANCEL_ORDER_IF_UNAVAILABLE':
      return 'CANCEL_ORDER';
    case 'DO_NOT_SUBSTITUTE':
      return 'ITEM_REMOVE';
    default:
      return 'ITEM_SUBSTITUTION';
  }
}

/**
 * Calculates the extra pre-authorization buffer required when a customer pre-chooses
 * a substitute that has a higher unit price than the original item.
 * (substitute_price - original_price) * quantity is calculated into the pre-authorisation buffer on the card payment.
 */
export function calculatePreChosenAlternativeExtraBuffer(
  items: BasketItem[] | undefined,
  currency: string = 'GBP'
): {
  extraBufferAmount: Money;
  extraBufferMajor: number;
  higherItemsCount: number;
  details: Array<{
    plu: string;
    name: string;
    diffMajor: number;
    substituteName?: string;
    substitutePrice?: number;
    originalPrice?: number;
    quantity: number;
  }>;
} {
  if (!items || items.length === 0) {
    return {
      extraBufferAmount: toMoney(0, currency),
      extraBufferMajor: 0,
      higherItemsCount: 0,
      details: [],
    };
  }

  let totalExtraPence = 0;
  let higherItemsCount = 0;
  const details: Array<{
    plu: string;
    name: string;
    diffMajor: number;
    substituteName?: string;
    substitutePrice?: number;
    originalPrice?: number;
    quantity: number;
  }> = [];

  for (const item of items) {
    if (
      item.substitutionPreference === 'CUSTOMER_SELECTED' &&
      item.preferredSubstitutePrice != null
    ) {
      const origPricePence = moneyToMinor(item.unitPrice || item.price);
      const subPricePence = moneyToMinor(item.preferredSubstitutePrice);
      const diffPerUnitPence = subPricePence - origPricePence;

      if (diffPerUnitPence > 0) {
        const itemExtraPence = diffPerUnitPence * (item.quantity || 1);
        totalExtraPence += itemExtraPence;
        higherItemsCount++;
        details.push({
          plu: item.plu,
          name: item.name,
          diffMajor: itemExtraPence / 100,
          substituteName: item.preferredSubstituteName,
          substitutePrice: subPricePence / 100,
          originalPrice: origPricePence / 100,
          quantity: item.quantity || 1,
        });
      }
    }
  }

  return {
    extraBufferAmount: toMoney(totalExtraPence, currency),
    extraBufferMajor: totalExtraPence / 100,
    higherItemsCount,
    details,
  };
}

/**
 * Calculates the authorization maximum explicitly approved by the customer.
 * In grocery commerce, a customer-approved buffer covers acceptable substitutions:
 * - Base buffer: 0% default (no blanket margin; only explicitly approved uplift like pre-chosen alternatives)
 * - Pre-chosen buffer: If the customer pre-chose an alternative with a higher value,
 *   that higher value is calculated into the pre-authorisation buffer on the card payment.
 */
export function calculateAuthorizationMaximum(
  basketEstimate: Money,
  hasSubstitutionsAllowed: boolean = true,
  explicitApprovedBufferPercent: number = 0, // 0% default (strictly customer-approved or policy-specified)
  currency: string = 'GBP',
  extraPreChosenBuffer?: Money
): {
  basketEstimate: Money;
  authorizationMaximum: Money;
  bufferAmount: Money;
  baseBufferAmount: Money;
  extraPreChosenBufferAmount: Money;
} {
  const estimatePence = moneyToMinor(basketEstimate);
  const estimateCurr = basketEstimate?.currency || currency;
  const estimate = toMoney(estimatePence, estimateCurr);

  const extraPence = extraPreChosenBuffer != null ? moneyToMinor(extraPreChosenBuffer) : 0;
  const extraMoney = toMoney(extraPence, estimateCurr);

  if (!hasSubstitutionsAllowed) {
    return {
      basketEstimate: estimate,
      authorizationMaximum: toMoney(estimate.amount + extraPence, estimate.currency),
      bufferAmount: extraMoney,
      baseBufferAmount: toMoney(0, estimate.currency),
      extraPreChosenBufferAmount: extraMoney,
    };
  }

  // Base 10% buffer
  const calculatedBaseBuffer = Math.round(estimate.amount * explicitApprovedBufferPercent);
  const baseBufferAmount = toMoney(calculatedBaseBuffer, estimate.currency);

  const totalBufferPence = calculatedBaseBuffer + extraPence;
  const bufferAmount = toMoney(totalBufferPence, estimate.currency);
  const authorizationMaximum = toMoney(estimate.amount + totalBufferPence, estimate.currency);

  return {
    basketEstimate: estimate,
    authorizationMaximum,
    bufferAmount,
    baseBufferAmount,
    extraPreChosenBufferAmount: extraMoney,
  };
}
