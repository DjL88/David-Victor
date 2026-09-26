import { describe, expect, it } from 'vitest';
import { CircuitBreaker } from '../../server/circuitBreaker';

describe('CircuitBreaker HTTP status classification', () => {
  it('does not trip for plain Error HTTP 403 diagnostics', async () => {
    const breaker = new CircuitBreaker({
      name: 'tenant-a:commerce',
      failureThreshold: 1,
      cooldownMs: 60_000,
    });

    await expect(
      breaker.execute(async () => {
        throw new Error('Deliverect Store Menu request failed: HTTP 403');
      })
    ).rejects.toThrow(/HTTP 403/);

    expect(breaker.getStats()).toMatchObject({
      state: 'CLOSED',
      failures: 0,
      totalTrips: 0,
    });
  });

  it('still trips for retryable HTTP 500 diagnostics', async () => {
    const breaker = new CircuitBreaker({
      name: 'tenant-a:commerce',
      failureThreshold: 1,
      cooldownMs: 60_000,
    });

    await expect(
      breaker.execute(async () => {
        throw new Error('Deliverect Store Menu request failed: HTTP 500');
      })
    ).rejects.toThrow(/HTTP 500/);

    expect(breaker.getStats()).toMatchObject({
      state: 'OPEN',
      failures: 1,
      totalTrips: 1,
    });
  });
});
