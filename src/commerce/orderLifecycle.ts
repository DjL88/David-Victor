import type { CustomerOrderStatus, DispatchState } from './postCheckoutModels';

export type CustomerLifecycleStage =
  | 'PLACED'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'COURIER_ASSIGNED'
  | 'COLLECTED'
  | 'ON_THE_WAY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'FAILED';

export interface CustomerLifecycleStep {
  stage: CustomerLifecycleStage;
  label: string;
  complete: boolean;
  current: boolean;
}

function normalize(value: unknown): string {
  return String(value || '').trim().replace(/([a-z])([A-Z])/g, '$1_$2').replace(/[\s-]+/g, '_').toUpperCase();
}

export function resolveCustomerLifecycleStage(
  status: CustomerOrderStatus | string | undefined,
  fulfillmentType: 'delivery' | 'pickup',
  dispatchState?: DispatchState | string
): CustomerLifecycleStage {
  const order = normalize(status);
  const dispatch = normalize(dispatchState);

  if (order.includes('CANCEL')) return 'CANCELLED';
  if (order === 'FAILED' || dispatch === 'FAILED') return 'FAILED';
  if (dispatch === 'CANCELLED' || dispatch === 'CANCEL_PENDING') return order.includes('CANCEL') ? 'CANCELLED' : 'READY';
  if (order === 'DELIVERED' || dispatch === 'DELIVERED') return 'DELIVERED';

  if (fulfillmentType === 'delivery') {
    if (['OUT_FOR_DELIVERY', 'DISPATCHING'].includes(order) || dispatch === 'PICKED_UP') return 'ON_THE_WAY';
    if (dispatch === 'PICKUP_EN_ROUTE') return 'COURIER_ASSIGNED';
    if (order === 'COURIER_ASSIGNED' || dispatch === 'ASSIGNED' || dispatch === 'ASSIGNING') return 'COURIER_ASSIGNED';
  } else if (['PICKED_UP', 'COLLECTED'].includes(order) || dispatch === 'PICKED_UP') {
    return 'COLLECTED';
  }

  if (['READY', 'READY_FOR_PICKUP', 'READY_FOR_COURIER', 'PICKUP_READY', 'PICKED', 'PICKING_COMPLETE', 'PICKING_COMPLETED'].includes(order)) return 'READY';
  if (['PICKING', 'PICKING_STARTED', 'PICKING_WITH_CHANGES', 'PREPARING'].includes(order)) return 'PREPARING';
  if (['ORDER_CONFIRMED', 'CONFIRMED', 'STORE_ACCEPTED', 'ACCEPTED', 'ORDERACCEPTED'].includes(order)) return 'CONFIRMED';
  return 'PLACED';
}

export function buildCustomerLifecycle(
  status: CustomerOrderStatus | string | undefined,
  fulfillmentType: 'delivery' | 'pickup',
  dispatchState?: DispatchState | string
): CustomerLifecycleStep[] {
  const currentStage = resolveCustomerLifecycleStage(status, fulfillmentType, dispatchState);
  if (currentStage === 'CANCELLED' || currentStage === 'FAILED') {
    return [{ stage: currentStage, label: currentStage === 'CANCELLED' ? 'Cancelled' : 'Order issue', complete: false, current: true }];
  }

  const stages: Array<[CustomerLifecycleStage, string]> = fulfillmentType === 'delivery'
    ? [['PLACED', 'Order placed'], ['CONFIRMED', 'Confirmed'], ['PREPARING', 'Preparing'], ['READY', 'Ready'], ['COURIER_ASSIGNED', 'Courier assigned'], ['ON_THE_WAY', 'On the way'], ['DELIVERED', 'Delivered']]
    : [['PLACED', 'Order placed'], ['CONFIRMED', 'Confirmed'], ['PREPARING', 'Preparing'], ['READY', 'Ready to collect'], ['COLLECTED', 'Collected']];

  const currentIndex = Math.max(0, stages.findIndex(([stage]) => stage === currentStage));
  return stages.map(([stage, label], index) => ({
    stage,
    label,
    complete: index < currentIndex,
    current: index === currentIndex,
  }));
}
