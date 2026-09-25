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

  it('does not claim the courier is on the way before pickup', () => {
    expect(resolveCustomerLifecycleStage('READY_FOR_COURIER', 'delivery', 'PICKUP_EN_ROUTE')).toBe('COURIER_ASSIGNED');
    expect(resolveCustomerLifecycleStage('READY_FOR_COURIER', 'delivery', 'PICKED_UP')).toBe('ON_THE_WAY');
  });

  it('treats completed picking as ready rather than still preparing', () => {
    expect(resolveCustomerLifecycleStage('PICKED', 'pickup')).toBe('READY');
    expect(resolveCustomerLifecycleStage('PICKING_COMPLETE', 'delivery')).toBe('READY');
  });

  it('does not turn a cancelled dispatch attempt into a cancelled customer order', () => {
    expect(resolveCustomerLifecycleStage('READY_FOR_COURIER', 'delivery', 'CANCEL_PENDING')).toBe('READY');
    expect(resolveCustomerLifecycleStage('READY_FOR_COURIER', 'delivery', 'CANCELLED')).toBe('READY');
    expect(resolveCustomerLifecycleStage('ORDER_CANCELLED', 'delivery', 'CANCELLED')).toBe('CANCELLED');
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
