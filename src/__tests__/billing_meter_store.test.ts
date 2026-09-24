import { describe, expect, it } from 'vitest';
import { settledRevenueMeterEvent, successfulOrderMeterEvent } from '../../server/billingMeterStore';

describe('billing meter event factories', () => {
  it('gives successful order retries the same deterministic idempotency key', () => {
    const input = {
      tenantId: 'brand-alpha',
      orderId: 'order-123',
      occurredAt: '2026-09-24T00:00:00.000Z',
      settledOrderTotal: { amount: 2599, currency: 'GBP' },
    };
    expect(successfulOrderMeterEvent(input).idempotencyKey).toBe('successful-order:order-123');
    expect(successfulOrderMeterEvent(input)).toEqual(successfulOrderMeterEvent(input));
  });

  it('keeps revenue-share basis explicit and stable', () => {
    const event = settledRevenueMeterEvent({
      tenantId: 'brand-alpha',
      orderId: 'order-123',
      occurredAt: '2026-09-24T00:00:00.000Z',
      amount: { amount: 2000, currency: 'GBP' },
      basis: 'SETTLED_MERCHANDISE_EX_VAT',
    });
    expect(event.idempotencyKey).toBe('settled-revenue:SETTLED_MERCHANDISE_EX_VAT:order-123');
    expect(event.metadata?.revenueBasis).toBe('SETTLED_MERCHANDISE_EX_VAT');
    expect(event.amount?.amount).toBe(2000);
  });
});
