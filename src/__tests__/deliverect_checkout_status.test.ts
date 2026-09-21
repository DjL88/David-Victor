import { describe, expect, it } from 'vitest';
import { DeliverectApiClient } from '../../server/deliverect/DeliverectApiClient';

describe('Deliverect checkout status mapping', () => {
  const mapStatus = (raw: any) =>
    (new DeliverectApiClient() as any).mapCommerceCheckoutStatus(raw);

  it('maps the documented Commerce checkout lifecycle without inventing success', () => {
    expect(mapStatus({ status: 'open' })).toBe('CHECKOUT_PENDING_CONFIRMATION');
    expect(mapStatus({ status: 'completed' })).toBe('ORDER_CONFIRMED');
    expect(mapStatus({ status: 'failed' })).toBe('ORDER_FAILED');
  });

  it('treats an explicit upstream order identifier as confirmed even before status wording settles', () => {
    expect(mapStatus({ status: 'open', orderId: 'ord_123' })).toBe('ORDER_CONFIRMED');
  });

  it('does not map an unknown checkout status to success', () => {
    expect(mapStatus({ status: 'mystery_state' })).toBe('CHECKOUT_PENDING_CONFIRMATION');
  });
});
