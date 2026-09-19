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
  customerSelectedPricePolicy: 'SUBSTITUTE_PRICE',
  maxCustomerCandidates: 3,
  allowCancelOrderPreference: true,
};

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
