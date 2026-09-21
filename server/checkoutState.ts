export type PublicCheckoutStatus =
  | 'PENDING_CONFIRMATION'
  | 'CONFIRMED'
  | 'FAILED';

const PENDING_CHECKOUT_STATES = new Set([
  'CHECKOUT_SUBMITTING',
  'CHECKOUT_PENDING_CONFIRMATION',
  'SUBMITTED',
  'OPEN',
  'PENDING',
]);

const FAILED_ORDER_STATES = new Set([
  'FAILED',
  'ORDER_FAILED',
  'CANCELLED',
  'ORDER_CANCELLED',
  'ORDER_CANCELLED_UNAVAILABLE_ITEM',
  'CANCELED',
]);

const CONFIRMED_ORDER_STATES = new Set([
  'ORDER_CONFIRMED',
  'CONFIRMED',
  'STORE_ACCEPTED',
  'ACCEPTED',
  'PICKING',
  'PICKING_STARTED',
  'PICKING_WITH_CHANGES',
  'PICKED',
  'PICKING_COMPLETE',
  'PICKING_COMPLETED',
  'READY',
  'READY_FOR_PICKUP',
  'PICKUP_READY',
  'PAYMENT_FINALISING',
  'READY_FOR_COURIER',
  'COURIER_ASSIGNED',
  'DISPATCHING',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'FINALIZED',
  // legacy/customer-facing aliases
  'ORDERACCEPTED',
  'PREPARING',
  'READYFORPICKUP',
  'COURIERASSIGNED',
  'COURIERATSTORE',
  'OUTFORDELIVERY',
]);

function normalize(status: unknown): string {
  return String(status || '').trim().toUpperCase();
}

export function isPendingCheckoutStatus(status: unknown): boolean {
  return PENDING_CHECKOUT_STATES.has(normalize(status));
}

export function isFailedOrderLifecycleStatus(status: unknown): boolean {
  return FAILED_ORDER_STATES.has(normalize(status));
}

export function isConfirmedOrderLifecycleStatus(status: unknown): boolean {
  const normalized = normalize(status);
  return CONFIRMED_ORDER_STATES.has(normalized);
}

export function mapCheckoutPublicStatus(status: unknown): PublicCheckoutStatus {
  if (isFailedOrderLifecycleStatus(status)) return 'FAILED';
  if (isConfirmedOrderLifecycleStatus(status)) return 'CONFIRMED';
  return 'PENDING_CONFIRMATION';
}
