import { afterEach, describe, it, expect, vi } from 'vitest';
import { calculateDispatchTiming } from '../../server/deliverect/dispatchTiming';
import { DEFAULT_DISPATCH_RULES, TenantDispatchRules } from '../rules/types';
import { DemoDispatchAdapter } from '../../server/deliverect/DemoDispatchAdapter';
import { DispatchOrchestrationService } from '../../server/deliverect/DispatchOrchestrationService';
import { FirestorePlatformService } from '../../server/firestoreService';

describe('Dispatch Orchestration & Timing', () => {
  afterEach(() => vi.restoreAllMocks());
  it('calculates dynamic dispatch timing according to pick rate, item count, buffer and transit', () => {
    const rules: TenantDispatchRules = {
      ...DEFAULT_DISPATCH_RULES,
      dynamicTiming: true,
      itemsPickedPerMinute: 2, // 10 items = 5 minutes
      readyBufferMinutes: 5,
      courierTransitMinutes: 12,
      minimumPickupLeadMinutes: 15,
    };

    const baseTime = new Date('2026-09-20T12:00:00Z');
    const timing = calculateDispatchTiming({
      rules,
      itemsCount: 10,
      baseTime,
    });

    expect(timing.calculatedPickMinutes).toBe(5);
    // 5 + 5 = 10, but capped by minimumPickupLeadMinutes (15)
    expect(timing.targetPickupMinutesFromNow).toBe(15);
    expect(timing.estimatedDeliveryMinutesFromNow).toBe(27); // 15 + 12

    const pickupTime = new Date(timing.targetPickupTime);
    const deliveryTime = new Date(timing.estimatedDeliveryTime);
    expect(pickupTime.getTime()).toBe(baseTime.getTime() + 15 * 60 * 1000);
    expect(deliveryTime.getTime()).toBe(baseTime.getTime() + 27 * 60 * 1000);
  });

  it('uses defaultLeadTimeMinutes when dynamicTiming is disabled', () => {
    const rules: TenantDispatchRules = {
      ...DEFAULT_DISPATCH_RULES,
      dynamicTiming: false,
      defaultLeadTimeMinutes: 25,
      courierTransitMinutes: 15,
      minimumPickupLeadMinutes: 10,
    };

    const baseTime = new Date('2026-09-20T12:00:00Z');
    const timing = calculateDispatchTiming({
      rules,
      itemsCount: 50,
      baseTime,
    });

    expect(timing.targetPickupMinutesFromNow).toBe(25);
    expect(timing.estimatedDeliveryMinutesFromNow).toBe(40);
  });

  it('DemoDispatchAdapter provides realistic courier quotes with expiration and carrier details', async () => {
    const adapter = new DemoDispatchAdapter();
    const quotesResult = await adapter.getQuotes({
      tenantId: 'test_tenant',
      deliveryAddress: {
        formattedAddress: '10 Downing Street, London',
        postalCode: 'SW1A 2AA',
      },
      itemsCount: 4,
      orderValueMinorUnits: 2500,
    });

    expect(quotesResult.available).toBe(true);
    expect(quotesResult.quotes.length).toBeGreaterThan(0);
    expect(quotesResult.selectedQuote).toBeDefined();
    expect(quotesResult.selectedQuote?.providerDisplayName).toBeDefined();
    expect(quotesResult.selectedQuote?.fee.fractionalDigits).toBe(2);
    expect(quotesResult.validationId).toBeDefined();
    expect(new Date(quotesResult.expiresAt!).getTime()).toBeGreaterThan(Date.now());
  });

  it('DemoDispatchAdapter validates delivery availability separately from quotes and assignments', async () => {
    const adapter = new DemoDispatchAdapter();
    const validation = await adapter.validateAvailability({
      deliveryAddress: {
        formattedAddress: '1 Oxford Street, London',
        postalCode: 'W1D 1BS',
      },
      itemsCount: 2,
    });

    expect(validation.available).toBe(true);
    expect(validation.validationId).toBeDefined();
    expect(validation.deliveryPrice).toBeGreaterThan(0);
  });

  it('does not create a QUOTED lifecycle from validation-only evidence', async () => {
    const update = vi.spyOn(FirestorePlatformService, 'updateOrderDispatchState').mockResolvedValue(undefined as any);
    const result = await DispatchOrchestrationService.handleCheckoutCreated(
      'order-validation-only',
      'tenant-a',
      { adapterName: 'validation-only', isConnected: true } as any,
      {
        fulfillmentType: 'delivery',
        itemsCount: 2,
        orderCreatedAt: '2026-09-26T12:00:00.000Z',
        idempotencyKey: 'checkout-1',
      }
    );

    expect(result).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  it('creates a quoted lifecycle only from explicit quote and provider evidence', async () => {
    vi.spyOn(FirestorePlatformService, 'getTenantDispatchRules').mockResolvedValue({
      ...DEFAULT_DISPATCH_RULES,
      dynamicTiming: false,
      assignmentEvent: 'PICKING_COMPLETE',
    } as any);
    const update = vi.spyOn(FirestorePlatformService, 'updateOrderDispatchState').mockResolvedValue(undefined as any);
    const result = await DispatchOrchestrationService.handleCheckoutCreated(
      'order-quoted',
      'tenant-a',
      { adapterName: 'test', isConnected: true } as any,
      {
        fulfillmentType: 'delivery',
        selectedQuote: {
          quoteId: 'quote-real',
          providerId: 'provider-real',
          providerDisplayName: 'Provider Real',
          fee: { amount: 299, currency: 'GBP' },
          expiresAt: '2026-09-26T14:30:00.000Z',
        },
        itemsCount: 2,
        orderCreatedAt: '2026-09-26T12:00:00.000Z',
        requiresAgeCheck: true,
        minimumAge: 21,
        requiresPin: true,
        idempotencyKey: 'checkout-2',
      }
    );

    expect(result).toMatchObject({
      state: 'QUOTED',
      quoteId: 'quote-real',
      providerId: 'provider-real',
      providerDisplayName: 'Provider Real',
    });
    expect(result).not.toHaveProperty('pinRequirement');
    expect(result).not.toHaveProperty('ageVerificationRequirement');
    expect(update).toHaveBeenCalledWith('order-quoted', expect.objectContaining({
      providerId: 'provider-real',
      quoteId: 'quote-real',
    }));
  });

  it('preserves the last verified dispatch state when provider cancellation fails', async () => {
    const dispatch = {
      state: 'ASSIGNED',
      providerId: 'provider-real',
      providerDisplayName: 'Provider Real',
      quoteId: 'quote-real',
      deliveryJobId: 'job-real',
      attemptCount: 1,
      idempotencyKeys: [],
      timestamps: { assignedAt: '2026-09-26T12:00:00.000Z', updatedAt: '2026-09-26T12:00:00.000Z' },
      createdAt: '2026-09-26T11:59:00.000Z',
    };
    vi.spyOn(FirestorePlatformService, 'getOrderProjection').mockResolvedValue({
      orderId: 'order-cancel',
      tenantId: 'tenant-a',
      status: 'ACCEPTED',
      fulfillmentType: 'delivery',
      createdAt: '2026-09-26T11:50:00.000Z',
      updatedAt: '2026-09-26T12:00:00.000Z',
      dispatch,
    } as any);
    const update = vi.spyOn(FirestorePlatformService, 'updateOrderDispatchState').mockResolvedValue(undefined as any);
    const adapter = {
      adapterName: 'unverified-cancel',
      isConnected: true,
      cancelDispatch: vi.fn().mockRejectedValue(
        Object.assign(new Error('private provider detail'), { code: 'UPSTREAM_DISPATCH_OPERATION_UNSUPPORTED' })
      ),
    } as any;

    const result = await DispatchOrchestrationService.handleOrderCancelled(
      'order-cancel',
      'tenant-a',
      adapter,
      'customer cancellation'
    );

    expect(result).toMatchObject({
      success: false,
      deliveryJobId: 'job-real',
      status: 'FAILED',
      reason: 'UPSTREAM_DISPATCH_OPERATION_UNSUPPORTED',
    });
    expect(update).toHaveBeenCalledWith('order-cancel', expect.objectContaining({
      state: 'ASSIGNED',
      lastError: 'UPSTREAM_DISPATCH_OPERATION_UNSUPPORTED',
    }));
    expect(JSON.stringify(update.mock.calls)).not.toContain('private provider detail');
    expect((update.mock.calls[0][1] as any).timestamps.cancelledAt).toBeUndefined();
  });

  it('does not report an already delivered dispatch as successfully cancelled', async () => {
    vi.spyOn(FirestorePlatformService, 'getOrderProjection').mockResolvedValue({
      orderId: 'order-delivered',
      tenantId: 'tenant-a',
      status: 'DELIVERED',
      fulfillmentType: 'delivery',
      createdAt: '2026-09-26T11:00:00.000Z',
      updatedAt: '2026-09-26T12:00:00.000Z',
      dispatch: {
        state: 'DELIVERED',
        providerId: 'provider-real',
        providerDisplayName: 'Provider Real',
        deliveryJobId: 'job-real',
        attemptCount: 1,
        idempotencyKeys: [],
        timestamps: { deliveredAt: '2026-09-26T12:00:00.000Z', updatedAt: '2026-09-26T12:00:00.000Z' },
        createdAt: '2026-09-26T11:05:00.000Z',
      },
    } as any);
    const result = await DispatchOrchestrationService.handleOrderCancelled(
      'order-delivered',
      'tenant-a',
      { adapterName: 'test', isConnected: true } as any
    );
    expect(result).toMatchObject({ success: false, status: 'FAILED' });
  });

});
