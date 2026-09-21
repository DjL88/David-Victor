import { describe, expect, it } from 'vitest';
import {
  isConfirmedOrderLifecycleStatus,
  isPendingCheckoutStatus,
  mapCheckoutPublicStatus,
} from '../../server/checkoutState';

describe('checkout lifecycle mapping', () => {
  it.each([
    'COMPLETED',
    'ORDER_CONFIRMED',
    'STORE_ACCEPTED',
    'ACCEPTED',
    'PICKING',
    'PICKING_STARTED',
    'PICKING_WITH_CHANGES',
    'PICKED',
    'PICKING_COMPLETE',
    'READY_FOR_PICKUP',
    'PICKUP_READY',
    'FINALIZED',
  ])('treats %s as proof that checkout succeeded', (status) => {
    expect(isConfirmedOrderLifecycleStatus(status)).toBe(true);
    expect(mapCheckoutPublicStatus(status)).toBe('CONFIRMED');
  });

  it.each([
    'CHECKOUT_SUBMITTING',
    'CHECKOUT_PENDING_CONFIRMATION',
    'SUBMITTED',
    'OPEN',
  ])('keeps %s pending', (status) => {
    expect(isPendingCheckoutStatus(status)).toBe(true);
    expect(mapCheckoutPublicStatus(status)).toBe('PENDING_CONFIRMATION');
  });

  it.each([
    'FAILED',
    'ORDER_FAILED',
    'CANCELLED',
    'ORDER_CANCELLED',
    'ORDER_CANCELLED_UNAVAILABLE_ITEM',
  ])('maps %s to failed', (status) => {
    expect(mapCheckoutPublicStatus(status)).toBe('FAILED');
  });
});
