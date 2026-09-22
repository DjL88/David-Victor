import { describe, expect, it } from 'vitest';
import { observeOrderException, recoverOrderException } from '../rules/OrderExceptionEngine';
import type { OrderExceptionPolicy } from '../rules/types';

const policy: OrderExceptionPolicy = {
  tenantId: 'retailer-a',
  acceptanceTimeoutMinutes: 15,
  maximumRetryAttempts: 3,
  retryDelaySeconds: 60,
  onRetriesExhausted: 'MANUAL_REVIEW',
};

const observation = (at: string) => ({
  exceptionId: 'ex-1', tenantId: 'retailer-a', orderId: 'order-1',
  type: 'ACCEPTANCE_TIMEOUT' as const, reasonCode: 'ORDER_UNACCEPTED_TIMEOUT', observedAt: at,
});

describe('OrderExceptionEngine', () => {
  it('schedules bounded retries without provider-specific behaviour', () => {
    const result = observeOrderException(policy, observation('2026-09-22T12:00:00.000Z'));
    expect(result.status).toBe('RETRY_SCHEDULED');
    expect(result.nextRetryAt).toBe('2026-09-22T12:01:00.000Z');
    expect(result.attemptCount).toBe(1);
  });

  it('escalates after the configured retry budget', () => {
    const first = observeOrderException(policy, observation('2026-09-22T12:00:00.000Z'));
    const second = observeOrderException(policy, observation('2026-09-22T12:01:00.000Z'), first);
    const third = observeOrderException(policy, observation('2026-09-22T12:02:00.000Z'), second);
    expect(third.status).toBe('MANUAL_REVIEW');
    expect(third.nextRetryAt).toBeUndefined();
  });

  it('recovers idempotently', () => {
    const open = observeOrderException(policy, observation('2026-09-22T12:00:00.000Z'));
    const recovered = recoverOrderException(open, '2026-09-22T12:00:30.000Z');
    expect(recovered.status).toBe('RECOVERED');
    expect(recovered.resolvedAt).toBe('2026-09-22T12:00:30.000Z');
    expect(recoverOrderException(recovered, 'later')).toEqual(recovered);
  });

  it('rejects cross-tenant exception mutation', () => {
    expect(() => observeOrderException({ ...policy, tenantId: 'retailer-b' }, observation('2026-09-22T12:00:00.000Z')))
      .toThrow(/another tenant/);
  });
});
