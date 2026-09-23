import { describe, expect, it } from 'vitest';
import { buildCustomerLifecycle, resolveCustomerLifecycleStage } from './orderLifecycle';

describe('customer order lifecycle', () => {
  it('maps Quest picking into the collection journey', () => {
    expect(resolveCustomerLifecycleStage('PICKING_WITH_CHANGES', 'pickup')).toBe('PREPARING');
    const timeline = buildCustomerLifecycle('READY_FOR_PICKUP', 'pickup');
    expect(timeline.find((step) => step.stage === 'READY')).toMatchObject({ label: 'Ready to collect', current: true });
  });

  it('lets dispatch become authoritative for the delivery tail', () => {
    expect(resolveCustomerLifecycleStage('READY_FOR_COURIER', 'delivery', 'ASSIGNED')).toBe('COURIER_ASSIGNED');
    expect(resolveCustomerLifecycleStage('READY_FOR_COURIER', 'delivery', 'PICKED_UP')).toBe('ON_THE_WAY');
    expect(resolveCustomerLifecycleStage('READY_FOR_COURIER', 'delivery', 'DELIVERED')).toBe('DELIVERED');
  });

  it('normalizes legacy camelCase statuses', () => {
    expect(resolveCustomerLifecycleStage('readyForPickup', 'pickup')).toBe('READY');
    expect(resolveCustomerLifecycleStage('outForDelivery', 'delivery')).toBe('ON_THE_WAY');
  });

  it('surfaces cancellation and failure without pretending later stages completed', () => {
    expect(buildCustomerLifecycle('ORDER_CANCELLED', 'pickup')).toEqual([
      { stage: 'CANCELLED', label: 'Cancelled', complete: false, current: true },
    ]);
    expect(buildCustomerLifecycle('READY', 'delivery', 'FAILED')).toEqual([
      { stage: 'FAILED', label: 'Order issue', complete: false, current: true },
    ]);
  });
});
