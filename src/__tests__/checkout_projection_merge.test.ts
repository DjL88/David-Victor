import { describe, expect, it } from 'vitest';
import { mergeCheckoutProjection } from '../../server/deliverect/CheckoutProjectionMerge';
import type { CheckoutResult } from '../domain/models';

describe('mergeCheckoutProjection', () => {
  const base: CheckoutResult = {
    checkoutId: 'checkout-1',
    channelOrderReference: 'BWYDI-ORDER-1',
    orderId: 'provisional-order-1',
    tenantId: 'brand-alpha',
    storeId: 'store-1',
    channelLinkId: 'channel-1',
    status: 'CHECKOUT_PENDING_CONFIRMATION',
    basketId: 'basket-1',
    fulfillmentType: 'pickup',
    total: { amount: 500, currency: 'GBP' },
    paymentId: 'local-payment-ref',
    idempotencyKey: 'idem-1',
    dispatchValidationId: 'dispatch-local',
    createdAt: '2026-09-21T10:00:00.000Z',
    updatedAt: '2026-09-21T10:00:00.000Z',
  };

  it('preserves local correlation fields when a sparse upstream refresh omits them', () => {
    const merged = mergeCheckoutProjection(base, {
      checkoutId: 'checkout-1',
      channelOrderReference: '',
      tenantId: 'brand-alpha',
      storeId: 'store-1',
      status: 'ORDER_CONFIRMED',
      basketId: 'basket-1',
      fulfillmentType: 'pickup',
      total: { amount: 500, currency: 'GBP' },
      createdAt: '2026-09-21T10:00:05.000Z',
      updatedAt: '2026-09-21T10:00:06.000Z',
    });

    expect(merged.status).toBe('ORDER_CONFIRMED');
    expect(merged.channelOrderReference).toBe('BWYDI-ORDER-1');
    expect(merged.orderId).toBe('provisional-order-1');
    expect(merged.idempotencyKey).toBe('idem-1');
    expect(merged.paymentId).toBe('local-payment-ref');
    expect(merged.dispatchValidationId).toBe('dispatch-local');
    expect(merged.createdAt).toBe(base.createdAt);
  });

  it('accepts newly learned authoritative order and channel references', () => {
    const merged = mergeCheckoutProjection(base, {
      checkoutId: 'checkout-1',
      channelOrderReference: 'BWYDI-ORDER-1-UPSTREAM',
      orderId: 'deliverect-real-order-1',
      tenantId: 'brand-alpha',
      storeId: 'store-1',
      channelLinkId: 'channel-1',
      status: 'ORDER_CONFIRMED',
      basketId: 'basket-1',
      fulfillmentType: 'pickup',
      total: { amount: 500, currency: 'GBP' },
      createdAt: '2026-09-21T10:00:05.000Z',
      updatedAt: '2026-09-21T10:00:06.000Z',
    });

    expect(merged.orderId).toBe('deliverect-real-order-1');
    expect(merged.channelOrderReference).toBe('BWYDI-ORDER-1-UPSTREAM');
    expect(merged.idempotencyKey).toBe('idem-1');
  });
});
