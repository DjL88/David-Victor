import type { CustomerOrderStatus, Order } from '../../commerce/postCheckoutModels';

export type OrderTrackerStage =
  | 'CONFIRMED'
  | 'PICKING'
  | 'READY'
  | 'FULFILLING'
  | 'COMPLETE'
  | 'CANCELLED';

const CONFIRMED = new Set<CustomerOrderStatus>([
  'CHECKOUT_SUBMITTING',
  'CHECKOUT_PENDING_CONFIRMATION',
  'SUBMITTED',
  'ORDER_CONFIRMED',
  'CONFIRMED',
  'STORE_ACCEPTED',
  'ACCEPTED',
  'orderAccepted',
]);

const PICKING = new Set<CustomerOrderStatus>([
  'PICKING',
  'PICKING_STARTED',
  'PICKING_WITH_CHANGES',
  'preparing',
]);

const READY = new Set<CustomerOrderStatus>([
  'PICKED',
  'PICKING_COMPLETE',
  'READY',
  'READY_FOR_PICKUP',
  'READY_FOR_COURIER',
  'readyForPickup',
  'PAYMENT_FINALISING',
  'AWAITING_PAYMENT_ACTION',
]);

const FULFILLING = new Set<CustomerOrderStatus>([
  'COURIER_ASSIGNED',
  'DISPATCHING',
  'OUT_FOR_DELIVERY',
  'courierAssigned',
  'courierAtStore',
  'outForDelivery',
]);

const CANCELLED = new Set<CustomerOrderStatus>([
  'CANCELLED',
  'ORDER_CANCELLED',
  'ORDER_CANCELLED_UNAVAILABLE_ITEM',
  'FAILED',
  'cancelled',
]);

const COMPLETE = new Set<CustomerOrderStatus>(['DELIVERED', 'delivered']);

export function getOrderTrackerStage(status: CustomerOrderStatus): OrderTrackerStage {
  if (CANCELLED.has(status)) return 'CANCELLED';
  if (COMPLETE.has(status)) return 'COMPLETE';
  if (FULFILLING.has(status)) return 'FULFILLING';
  if (READY.has(status)) return 'READY';
  if (PICKING.has(status)) return 'PICKING';
  if (CONFIRMED.has(status)) return 'CONFIRMED';
  return 'CONFIRMED';
}

export function isTerminalOrderStatus(status: CustomerOrderStatus | string): boolean {
  return (
    status === 'DELIVERED' ||
    status === 'delivered' ||
    status === 'CANCELLED' ||
    status === 'ORDER_CANCELLED' ||
    status === 'ORDER_CANCELLED_UNAVAILABLE_ITEM' ||
    status === 'FAILED' ||
    status === 'cancelled'
  );
}

export function getTrackerStageIndex(order: Pick<Order, 'status' | 'fulfillment'>): number {
  const stage = getOrderTrackerStage(order.status);
  if (stage === 'CANCELLED') return 0;
  if (stage === 'COMPLETE') return 3;
  if (stage === 'FULFILLING') return 2;
  if (stage === 'READY') return order.fulfillment.type === 'pickup' ? 2 : 2;
  if (stage === 'PICKING') return 1;
  return 0;
}

export function getOrderEtaText(order: Order): string | null {
  const liveEta = order.delivery?.courier?.eta || order.dispatch?.eta;
  if (liveEta) return liveEta;

  const deliveryEta = order.fulfillment.deliveryOption?.deliveryEta;
  if (deliveryEta) return deliveryEta;

  if (order.scheduledTime.type === 'SCHEDULED' && order.scheduledTime.slot) {
    return order.scheduledTime.slot.formatted || order.scheduledTime.slot.startTime;
  }

  if (typeof order.scheduledTime.asapEtaMinutes === 'number' && order.scheduledTime.asapEtaMinutes > 0) {
    return `${order.scheduledTime.asapEtaMinutes} min`;
  }

  return null;
}

export function getTrackerStepLabels(order: Pick<Order, 'fulfillment'>): [string, string, string, string] {
  return order.fulfillment.type === 'pickup'
    ? ['Confirmed', 'Picking', 'Ready', 'Collected']
    : ['Confirmed', 'Picking', 'On the way', 'Delivered'];
}
