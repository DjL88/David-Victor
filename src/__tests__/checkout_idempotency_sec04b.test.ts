import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CheckoutLockService } from '../../server/checkoutLockService';
import { setServerRuntimeMode } from '../../server/runtimeMode';

describe('SEC-04b checkout idempotency', () => {
  beforeEach(() => {
    setServerRuntimeMode('staging');
    CheckoutLockService.resetForTest();
  });

  afterEach(() => {
    CheckoutLockService.resetForTest();
    setServerRuntimeMode(null);
  });

  it('permits only one active checkout claim for the same tenant basket', async () => {
    const first = await CheckoutLockService.claim('tenant-a', 'basket-1', 'idem-1');
    const concurrent = await CheckoutLockService.claim('tenant-a', 'basket-1', 'idem-1');

    expect(first).toMatchObject({ claimed: true, state: 'CLAIMED' });
    expect(concurrent).toMatchObject({ claimed: false, state: 'CLAIMED' });
  });

  it('keeps checkout locks tenant-scoped', async () => {
    const tenantA = await CheckoutLockService.claim('tenant-a', 'basket-1');
    const tenantB = await CheckoutLockService.claim('tenant-b', 'basket-1');

    expect(tenantA.claimed).toBe(true);
    expect(tenantB.claimed).toBe(true);
  });

  it('allows a failed upstream attempt to retry but never recreates a completed checkout', async () => {
    await CheckoutLockService.claim('tenant-a', 'basket-1', 'idem-1');
    await CheckoutLockService.fail('tenant-a', 'basket-1', new Error('upstream unavailable'));

    const retry = await CheckoutLockService.claim('tenant-a', 'basket-1', 'idem-1');
    expect(retry).toMatchObject({ claimed: true, state: 'CLAIMED' });

    await CheckoutLockService.complete('tenant-a', 'basket-1', 'checkout-1');
    const completed = await CheckoutLockService.claim('tenant-a', 'basket-1', 'idem-1');

    expect(completed).toMatchObject({
      claimed: false,
      state: 'COMPLETED',
      checkoutId: 'checkout-1',
    });
  });

  it('escapes basket path separators while preserving idempotency', async () => {
    const first = await CheckoutLockService.claim('tenant-a', 'basket/with/slashes');
    const second = await CheckoutLockService.claim('tenant-a', 'basket/with/slashes');

    expect(first.claimed).toBe(true);
    expect(second.claimed).toBe(false);
  });
});
