import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getCircuitBreaker,
  resetCircuitBreakersForTest,
} from '../../server/circuitBreaker';
import {
  PaymentService,
  resetDPayAdapter,
  setDPayAdapter,
} from '../../server/deliverect/PaymentService';
import { FirestorePlatformService } from '../../server/firestoreService';
import { setServerRuntimeMode } from '../../server/runtimeMode';

describe('SEC-04b payment state safety', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetCircuitBreakersForTest();
    resetDPayAdapter();
    process.env.DELIVERECT_ENV = 'staging';
    setServerRuntimeMode('staging');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetCircuitBreakersForTest();
    resetDPayAdapter();
    setServerRuntimeMode(null);
    delete process.env.DELIVERECT_ENV;
  });

  it('isolates circuit state by tenant and does not count non-retryable 4xx failures as upstream health failures', async () => {
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
          throw Object.assign(new Error('upstream unavailable'), { statusCode: 503 });
        })
      ).rejects.toThrow('upstream unavailable');
    }

    expect(tenantA.getState()).toBe('OPEN');
    expect(tenantB.getState()).toBe('CLOSED');
  });

  it('updates local payment state only after the provider confirms authorization release', async () => {
    vi.spyOn(FirestorePlatformService, 'getPaymentProjection').mockResolvedValue({
      paymentId: 'pay-1',
      tenantId: 'tenant-a',
    } as any);
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

    const result = await PaymentService.voidAuthorization(
      'pay-1',
      'order cancelled',
      'tenant-a'
    );

    expect(adapter.voidAuthorization).toHaveBeenCalledWith(
      'pay-1',
      'order cancelled'
    );
    expect(result.status).toBe('canceled');
    expect(updateSpy).toHaveBeenCalledOnce();
    expect(updateSpy.mock.calls[0][1]).toMatchObject({
      status: 'canceled',
      authorizedAmount: { amount: 1200, currency: 'EUR' },
      capturedAmount: { amount: 0, currency: 'EUR' },
      residualHoldAmount: { amount: 0, currency: 'EUR' },
    });
  });

  it('does not mutate local payment state when provider authorization release fails', async () => {
    vi.spyOn(FirestorePlatformService, 'getPaymentProjection').mockResolvedValue({
      paymentId: 'pay-2',
      tenantId: 'tenant-a',
    } as any);
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
      PaymentService.voidAuthorization('pay-2', 'order cancelled', 'tenant-a')
    ).rejects.toThrow('provider unavailable');

    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('fails closed before calling the provider when payment ownership cannot be proven', async () => {
    vi.spyOn(FirestorePlatformService, 'getPaymentProjection').mockResolvedValue(null as any);
    const adapter: any = {
      adapterName: 'test-dpay',
      voidAuthorization: vi.fn(),
    };
    setDPayAdapter(adapter, 'tenant-a');

    await expect(
      PaymentService.voidAuthorization('pay-unowned', 'cancelled', 'tenant-a')
    ).rejects.toMatchObject({
      code: expect.anything(),
      statusCode: 404,
    });

    expect(adapter.voidAuthorization).not.toHaveBeenCalled();
  });

  it('fails closed when an order projection has no tenant before settlement or cancellation', async () => {
    vi.spyOn(FirestorePlatformService, 'getOrderProjection').mockResolvedValue({
      orderId: 'ord-unowned',
      status: 'ORDER_CANCELLED',
      total: 1000,
      itemsCount: 1,
      fulfillmentType: 'delivery',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);

    await expect(
      PaymentService.settleOrderPayment('ord-unowned', 'tenant-a')
    ).rejects.toMatchObject({ statusCode: 404 });

    await expect(
      PaymentService.handleOrderCancellation('ord-unowned', 'tenant-a')
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
