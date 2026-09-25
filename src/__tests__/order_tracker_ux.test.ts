import { describe, expect, it } from 'vitest';
import type { Order } from '../commerce/models';
import {
  getOrderEtaText,
  getOrderTrackerStage,
  getTrackerStageIndex,
  isTerminalOrderStatus,
} from '../features/orders/orderTrackingPresentation';

const makeOrder = (overrides: Partial<Order> = {}): Order => ({
  id: 'order-1',
  displayId: '#ORD-1',
  tenantId: 'tenant-a',
  storeId: 'store-a',
  storeName: 'Store A',
  status: 'ACCEPTED',
  fulfillment: { type: 'delivery' },
  scheduledTime: {
    type: 'ASAP',
    asapEtaMinutes: 28,
    requestedAt: '2026-09-25T07:00:00.000Z',
  },
  originalBasket: {} as Order['originalBasket'],
  currentOrder: {
    subtotal: { amount: 1000, currency: 'GBP' },
    charges: [],
    discounts: [],
    total: { amount: 1000, currency: 'GBP' },
    itemCount: 1,
  },
  payment: {
    paymentId: 'pay-1',
    state: 'AUTHORIZED',
    currency: 'GBP',
    authorizedAmount: { amount: 1000, currency: 'GBP' },
    authorizationMaximum: { amount: 1000, currency: 'GBP' },
    finalAmount: { amount: 0, currency: 'GBP' },
    capturedAmount: { amount: 0, currency: 'GBP' },
    history: [],
  },
  picking: {
    status: 'NOT_STARTED',
    totalItems: 1,
    itemsPicked: 0,
    hasChanges: false,
    items: [],
  },
  events: [],
  createdAt: '2026-09-25T07:00:00.000Z',
  updatedAt: '2026-09-25T07:00:00.000Z',
  ...overrides,
});

describe('order tracking presentation', () => {
  it('maps the commerce lifecycle onto a stable customer progress model', () => {
    expect(getOrderTrackerStage('ACCEPTED')).toBe('CONFIRMED');
    expect(getOrderTrackerStage('PICKING_WITH_CHANGES')).toBe('PICKING');
    expect(getOrderTrackerStage('READY_FOR_COURIER')).toBe('READY');
    expect(getOrderTrackerStage('OUT_FOR_DELIVERY')).toBe('FULFILLING');
    expect(getOrderTrackerStage('DELIVERED')).toBe('COMPLETE');
    expect(getOrderTrackerStage('ORDER_CANCELLED')).toBe('CANCELLED');
  });

  it('uses real ETA sources in priority order without inventing a value', () => {
    expect(getOrderEtaText(makeOrder())).toBe('28 min');
    expect(
      getOrderEtaText(
        makeOrder({
          delivery: {
            deliveryOption: {
              id: 'delivery',
              displayName: 'Courier',
              price: { amount: 0, currency: 'GBP' },
              deliveryEta: '35-45 min',
            },
            dispatchSchedulingMode: 'ASSIGN_NEAR_FULFILMENT',
            courier: { eta: '12 min' },
            isConfirmed: true,
          },
        })
      )
    ).toBe('12 min');

    expect(
      getOrderEtaText(
        makeOrder({
          scheduledTime: {
            type: 'SCHEDULED',
            requestedAt: '2026-09-25T07:00:00.000Z',
            slot: {
              id: 'slot',
              dayLabel: 'Today',
              dateString: '2026-09-25',
              startTime: '12:00',
              endTime: '12:30',
              formatted: '12:00 – 12:30',
              isAvailable: true,
            },
          },
        })
      )
    ).toBe('12:00 – 12:30');

    expect(
      getOrderEtaText(
        makeOrder({
          scheduledTime: {
            type: 'ASAP',
            requestedAt: '2026-09-25T07:00:00.000Z',
          },
        })
      )
    ).toBeNull();
  });

  it('keeps active-order persistence only for non-terminal orders', () => {
    expect(isTerminalOrderStatus('DELIVERED')).toBe(true);
    expect(isTerminalOrderStatus('FAILED')).toBe(true);
    expect(isTerminalOrderStatus('PICKING')).toBe(false);
  });

  it('advances the progress bar without relying on provider-specific UI states', () => {
    expect(getTrackerStageIndex(makeOrder({ status: 'ACCEPTED' }))).toBe(0);
    expect(getTrackerStageIndex(makeOrder({ status: 'PICKING' }))).toBe(1);
    expect(getTrackerStageIndex(makeOrder({ status: 'READY_FOR_COURIER' }))).toBe(2);
    expect(getTrackerStageIndex(makeOrder({ status: 'DELIVERED' }))).toBe(3);
  });
});
