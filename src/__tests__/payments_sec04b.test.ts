import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assertCheckoutPaymentPresent,
  isUnpaidCheckoutAllowed,
} from '../../server/paymentPolicy';
import { CheckoutLockService } from '../../server/checkoutLockService';
import {
  getCircuitBreaker,
  resetCircuitBreakersForTest,
} from '../../server/circuitBreaker';
import { assertAllowedHostedPaymentRedirect } from '../../server/paymentRedirectPolicy';
import {
  PaymentService,
  resetDPayAdapter,
  setDPayAdapter,
} from '../../server/deliverect/PaymentService';
import { FirestorePlatformService } from '../../server/firestoreService';
import { DPayTokenProxy } from '../../server/deliverect/DPayTokenProxy';
import { setServerRuntimeMode } from '../../server/runtimeMode';

describe('SEC-04b payment hardening', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetCircuitBreakersForTest();
    resetDPayAdapter();
    CheckoutLockService.resetForTest();
    process.env.DELIVERECT_ENV = 'staging';
    setServerRuntimeMode('staging');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetCircuitBreakersForTest();
    resetDPayAdapter();
    CheckoutLockService.resetForTest();
    setServerRuntimeMode(null);
    delete process.env.DELIVERECT_ENV;
    delete process.env.DPAY_TOKEN_PROXY_URL;
  });

  it('denies unpaid checkout by default and only allows explicit tenant opt-in', () => {
    expect(isUnpaidCheckoutAllowed(undefined)).toBe(false);
    expect(() => assertCheckoutPaymentPresent(undefined, {})).toThrow(
      /Payment authorization is required/
    );
    expect(() =>
      assertCheckoutPaymentPresent({ allowUnpaidOrders: false }, {})
    ).toThrow(/Payment authorization is required/);

    expect(() =>
      assertCheckoutPaymentPresent({ allowUnpaidOrders: true }, {})
    ).not.toThrow();
    expect(() =>
      assertCheckoutPaymentPresent(undefined, { paymentId: 'pay-1' })
    ).not.toThrow();
    expect(() =>
      assertCheckoutPaymentPresent(undefined, { paymentTokenRef: 'tok-1' })
    ).not.toThrow();
  });

  it('atomically prevents two checkout creations for the same tenant basket and permits retry after failure', async () => {
    const first = await CheckoutLockService.claim('tenant-a', 'basket-1', 'idem-1');
    const second = await CheckoutLockService.claim('tenant-a', 'basket-1', 'idem-1');

    expect(first.claimed).toBe(true);
    expect(second.claimed).toBe(false);

    await CheckoutLockService.fail('tenant-a', 'basket-1', new Error('upstream failed'));
    const retry = await CheckoutLockService.claim('tenant-a', 'basket-1', 'idem-1');
    expect(retry.claimed).toBe(true);

    await CheckoutLockService.complete('tenant-a', 'basket-1', 'checkout-1');
    const completed = await CheckoutLockService.claim('tenant-a', 'basket-1', 'idem-1');
    expect(completed).toMatchObject({
      claimed: false,
      state: 'COMPLETED',
      checkoutId: 'checkout-1',
    });
  });

  it('isolates circuit state by tenant and ignores all 4xx client failures', async () => {
    const tenantA = getCircuitBreaker('tenant-a', 'commerce');
    const tenantB = getCircuitBreaker('tenant-b', 'commerce');

    for (let i = 0; i < 8; i += 1) {
      await expect(
        tenantA.execute(async () => {
          throw Object.assign(new Error('bad request'), { statusCode: 422 });
        })
      ).rejects.toThrow('bad request');
    }
    expect(tenantA.getStats().failures).toBe(0);
    expect(tenantA.getState()).toBe('CLOSED');

    for (let i = 0; i < 5; i += 1) {
      await expect(
        tenantA.execute(async () => {
          throw Object.assign(new Error('upstream'), { statusCode: 503 });
        })
      ).rejects.toThrow();
    }

    expect(tenantA.getState()).toBe('OPEN');
    expect(tenantB.getState()).toBe('CLOSED');
  });

  it('allows only HTTPS hosted-payment origins on the tenant allowlist', () => {
    expect(
      assertAllowedHostedPaymentRedirect(
        'https://checkout.provider.test/pay/abc',
        ['https://checkout.provider.test']
      ).origin
    ).toBe('https://checkout.provider.test');

    expect(() =>
      assertAllowedHostedPaymentRedirect(
        'https://evil.example/pay/abc',
        ['https://checkout.provider.test']
      )
    ).toThrow(/not allowlisted/);

    expect(() =>
      assertAllowedHostedPaymentRedirect(
        'http://checkout.provider.test/pay/abc',
        ['http://checkout.provider.test']
      )
    ).toThrow(/HTTPS/);
  });

  it('updates the payment projection only after the provider confirms an authorization release', async () => {
    const updateSpy = vi
      .spyOn(FirestorePlatformService, 'updatePaymentProjection')
      .mockResolvedValue(undefined as any);

    const adapter: any = {
      adapterName: 'test-dpay',
      voidAuthorization: vi.fn().mockResolvedValue({
        paymentId: 'pay-1',
        channelLinkId: 'channel-1',
        status: 'canceled',
        amount: 1200,
        authorizedAmount: 1200,
        capturedAmount: 0,
        residualHoldAmount: 0,
        currency: 'EUR',
        captureMode: 'manual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    };
    setDPayAdapter(adapter, 'tenant-a');

    await PaymentService.voidAuthorization('pay-1', 'cancelled', 'tenant-a');

    expect(adapter.voidAuthorization).toHaveBeenCalledOnce();
    expect(updateSpy).toHaveBeenCalledOnce();
    expect(updateSpy.mock.calls[0][1]).toMatchObject({
      status: 'canceled',
      residualHoldAmount: { amount: 0, currency: 'EUR' },
    });
  });

  it('does not mutate local payment state when provider void fails', async () => {
    const updateSpy = vi
      .spyOn(FirestorePlatformService, 'updatePaymentProjection')
      .mockResolvedValue(undefined as any);

    const adapter: any = {
      adapterName: 'test-dpay',
      voidAuthorization: vi.fn().mockRejectedValue(
        Object.assign(new Error('provider unavailable'), { statusCode: 503 })
      ),
    };
    setDPayAdapter(adapter, 'tenant-a');

    await expect(
      PaymentService.voidAuthorization('pay-2', 'cancelled', 'tenant-a')
    ).rejects.toThrow('provider unavailable');

    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('requires an explicit production DPay token proxy URL rather than guessing a host', async () => {
    setServerRuntimeMode('production');
    delete process.env.DPAY_TOKEN_PROXY_URL;

    await expect(
      DPayTokenProxy.createToken('tenant-a', {
        gatewayProfileId: 'gw',
        channelLinkId: 'channel',
        customerId: 'customer',
        payment_method: {
          number: '4111111111111111',
          exp_month: 12,
          exp_year: new Date().getUTCFullYear() + 2,
          cvc: '123',
        },
      })
    ).rejects.toMatchObject({ statusCode: 503 });
  });
});
