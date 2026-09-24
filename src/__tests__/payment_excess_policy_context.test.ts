import { afterEach, describe, expect, it, vi } from 'vitest';
import { AsyncWorkerService, type SettlementJob } from '../../server/asyncWorkerService';
import { IntegrationContext } from '../../server/deliverect/IntegrationContext';
import { PaymentService } from '../../server/deliverect/PaymentService';
import { FirestorePlatformService } from '../../server/firestoreService';

function job(orderId: string): SettlementJob {
  return {
    jobId: `job-${orderId}`,
    orderId,
    tenantId: 'tenant-a',
    webhookEventId: `wh-${orderId}`,
    enqueuedAt: new Date().toISOString(),
    attempts: 0,
  };
}

const settled = {
  status: 'PAYMENT_ACTION_REQUIRED' as const,
  orderId: 'unused',
  paymentId: 'payment-1',
  finalAmount: 1200,
  authorizedAmount: 1000,
  capturedAmount: 0,
  residualHoldReleased: 0,
  settledAt: new Date().toISOString(),
};

describe('WP-01 payment excess policy resolution', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('passes AUTO_REAUTHORIZE only from the canonical active tenant integration context', async () => {
    vi.spyOn(IntegrationContext, 'getContext').mockResolvedValue({
      tenantId: 'tenant-a',
      environment: 'production',
      credentialMode: 'dedicated',
      clientId: 'client',
      clientSecret: 'secret',
      webhookSecret: 'webhook',
      allowedChannelLinkIds: [],
      orderRoute: 'retail_quest',
      dpay: {
        enabled: true,
        environment: 'production',
        excessAmountPolicy: 'AUTO_REAUTHORIZE',
      },
      tokenManager: {} as any,
      isConfigured: true,
    });

    const settle = vi
      .spyOn(PaymentService, 'settleOrderPayment')
      .mockResolvedValue({ ...settled, orderId: 'order-auto' } as any);
    vi.spyOn(FirestorePlatformService, 'getOrderProjection').mockResolvedValue(null);

    await AsyncWorkerService.processSettlementJob(job('order-auto'), 1);

    expect(IntegrationContext.getContext).toHaveBeenCalledWith('tenant-a');
    expect(settle).toHaveBeenCalledWith(
      'order-auto',
      'tenant-a',
      { reauthorizeIfNeeded: true }
    );
  });

  it('fails closed to manual action when policy is manual, absent, or context resolution fails', async () => {
    const settle = vi
      .spyOn(PaymentService, 'settleOrderPayment')
      .mockResolvedValue({ ...settled, orderId: 'order-manual' } as any);
    vi.spyOn(FirestorePlatformService, 'getOrderProjection').mockResolvedValue(null);

    vi.spyOn(IntegrationContext, 'getContext').mockResolvedValueOnce({
      tenantId: 'tenant-a',
      environment: 'staging',
      credentialMode: 'platform',
      clientId: 'client',
      clientSecret: 'secret',
      webhookSecret: 'webhook',
      allowedChannelLinkIds: [],
      orderRoute: 'retail_quest',
      dpay: {
        enabled: true,
        environment: 'staging',
        excessAmountPolicy: 'MANUAL_ACTION_REQUIRED',
      },
      tokenManager: {} as any,
      isConfigured: true,
    });

    await AsyncWorkerService.processSettlementJob(job('order-manual'), 1);
    expect(settle).toHaveBeenLastCalledWith(
      'order-manual',
      'tenant-a',
      { reauthorizeIfNeeded: false }
    );

    vi.mocked(IntegrationContext.getContext).mockRejectedValueOnce(
      new Error('profile unavailable')
    );
    await AsyncWorkerService.processSettlementJob(job('order-fallback'), 1);
    expect(settle).toHaveBeenLastCalledWith(
      'order-fallback',
      'tenant-a',
      { reauthorizeIfNeeded: false }
    );
  });
});
