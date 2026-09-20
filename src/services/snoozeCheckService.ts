/**
 * Deliverect Snooze & Live Availability Service
 *
 * Implements regular frontend snooze checking per specification:
 * - On page load / reload
 * - On add to basket
 * - On calculate basket
 * - On calculate checkout
 *
 * Checks Deliverect snooze semantics:
 * - Explicit boolean flags: snoozed, isSnoozed
 * - Time-bounded snoozing: snoozedUntil, snoozeEndTime (un-snoozed once expiry passed)
 * - Inactive / un-ranged / out of stock status
 */

import { Basket, Product, StoreProductAvailability, isStoreProductSnoozed, isStoreProductAvailable, Money } from '../commerce/models';
import { catalogStore, normalizeStoreId } from '../commerce/catalogStore';
import { isDemoMode } from '../domain/runtime';

export interface SnoozeEvaluationResult {
  isSnoozed: boolean;
  isAvailable: boolean;
  reason?: 'snoozed' | 'snoozed_timed' | 'inactive' | 'out_of_stock' | 'not_carried';
  snoozedUntil?: string;
  snoozeEndTime?: string;
}

export interface SubstituteSwapSuggestion {
  originalPlu: string;
  originalName: string;
  substitutePlu: string;
  substituteName: string;
  substitutePrice?: Money;
  substituteAvailable: boolean;
  quantity: number;
}

export interface BasketSnoozeAuditResult {
  hasSnoozedOrUnavailableItems: boolean;
  affectedItems: Array<{
    plu: string;
    name: string;
    quantity: number;
    reason: 'snoozed' | 'out_of_stock' | 'inactive';
    snoozedUntil?: string;
    preferredSubstitutePlu?: string;
    preferredSubstituteName?: string;
    preferredSubstituteAvailable?: boolean;
  }>;
  availableSwaps: SubstituteSwapSuggestion[];
}

/**
 * Checks whether a specific product is currently snoozed or unavailable at a specific store.
 */
export function checkProductSnooze(storeId: string, plu: string): SnoozeEvaluationResult {
  if (!isDemoMode()) {
    // In staging/production, availability and snoozing are verified authoritatively
    // through the BFF Commerce API during basket reconcile / validate calls, not local mock store.
    return { isSnoozed: false, isAvailable: true };
  }

  const normStoreId = normalizeStoreId(storeId);
  const avail = catalogStore.getProductAvailability(normStoreId, plu);

  if (!avail) {
    return { isSnoozed: false, isAvailable: true };
  }

  const snoozed = isStoreProductSnoozed(avail);
  if (snoozed) {
    return {
      isSnoozed: true,
      isAvailable: false,
      reason: avail.snoozedUntil || avail.snoozeEndTime ? 'snoozed_timed' : 'snoozed',
      snoozedUntil: avail.snoozedUntil || avail.snoozeEndTime,
      snoozeEndTime: avail.snoozeEndTime || avail.snoozedUntil,
    };
  }

  if (avail.active === false) {
    return { isSnoozed: false, isAvailable: false, reason: 'inactive' };
  }

  if (avail.isCarried === false) {
    return { isSnoozed: false, isAvailable: false, reason: 'not_carried' };
  }

  if (
    avail.stockStatus === 'OUT_OF_STOCK' ||
    avail.inStock === false ||
    (avail.stockQuantity !== null && avail.stockQuantity !== undefined && avail.stockQuantity <= 0)
  ) {
    return { isSnoozed: false, isAvailable: false, reason: 'out_of_stock' };
  }

  return { isSnoozed: false, isAvailable: true };
}

/**
 * Evaluates all items in an active basket against the store's current operational state.
 * Sourced during:
 * - Basket calculation
 * - Checkout review calculation & delivery revalidation
 */
export function evaluateBasketSnoozeStatus(basket: Basket | null | undefined): BasketSnoozeAuditResult {
  if (!basket || !basket.items || basket.items.length === 0) {
    return { hasSnoozedOrUnavailableItems: false, affectedItems: [], availableSwaps: [] };
  }

  const affectedItems: BasketSnoozeAuditResult['affectedItems'] = [];
  const availableSwaps: SubstituteSwapSuggestion[] = [];

  for (const item of basket.items) {
    const status = checkProductSnooze(basket.storeId, item.plu);
    if (!status.isAvailable) {
      let subAvail = false;
      if (item.preferredSubstitutePlu) {
        const subStatus = checkProductSnooze(basket.storeId, item.preferredSubstitutePlu);
        subAvail = subStatus.isAvailable;

        if (subAvail) {
          const avail = catalogStore.getProductAvailability(basket.storeId, item.preferredSubstitutePlu);
          availableSwaps.push({
            originalPlu: item.plu,
            originalName: item.name,
            substitutePlu: item.preferredSubstitutePlu,
            substituteName: item.preferredSubstituteName || item.preferredSubstitutePlu,
            substitutePrice: item.preferredSubstitutePrice || avail?.price,
            substituteAvailable: true,
            quantity: item.quantity,
          });
        }
      }

      affectedItems.push({
        plu: item.plu,
        name: item.name,
        quantity: item.quantity,
        reason: status.isSnoozed ? 'snoozed' : status.reason === 'inactive' ? 'inactive' : 'out_of_stock',
        snoozedUntil: status.snoozedUntil,
        preferredSubstitutePlu: item.preferredSubstitutePlu,
        preferredSubstituteName: item.preferredSubstituteName,
        preferredSubstituteAvailable: subAvail,
      });
    }
  }

  return {
    hasSnoozedOrUnavailableItems: affectedItems.length > 0,
    affectedItems,
    availableSwaps,
  };
}
