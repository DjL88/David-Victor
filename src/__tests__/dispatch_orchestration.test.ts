import { describe, it, expect } from 'vitest';
import { calculateDispatchTiming } from '../../server/deliverect/dispatchTiming';
import { DEFAULT_DISPATCH_RULES, TenantDispatchRules } from '../rules/types';
import { DemoDispatchAdapter } from '../../server/deliverect/DemoDispatchAdapter';

describe('Dispatch Orchestration & Timing', () => {
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
});
