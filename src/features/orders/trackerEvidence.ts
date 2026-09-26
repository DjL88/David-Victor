import type { Money, Order, PickingItem } from '../../commerce/models';

export type CustomerTrackerStage = 'PLACED' | 'PREPARING' | 'READY' | 'ON_THE_WAY' | 'COMPLETE' | 'CANCELLED' | 'FAILED' | 'UNKNOWN';
const token = (value: unknown): string => typeof value === 'string' ? value.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase() : '';

/** Presentation only: never treats transport acknowledgement, courier assignment or POS finalisation as handover. */
export function customerTrackerStage(order: Order): CustomerTrackerStage {
  const status = token(order.status);
  if (['CANCELLED', 'CANCELED', 'ORDER_CANCELLED', 'ORDER_CANCELLED_UNAVAILABLE_ITEM'].includes(status)) return 'CANCELLED';
  if (['FAILED', 'ORDER_FAILED', 'DENIED'].includes(status)) return 'FAILED';
  if (['DELIVERED', 'COLLECTED'].includes(status)) return 'COMPLETE';
  const pickup = order.fulfillment?.type === 'pickup';
  if (!pickup && order.dispatch?.state === 'DELIVERED') return 'COMPLETE';
  if (!pickup && (order.dispatch?.state === 'PICKED_UP' || ['OUT_FOR_DELIVERY', 'OUTFORDELIVERY'].includes(status))) return 'ON_THE_WAY';
  if (order.picking?.status === 'COMPLETED' || ['PICKED', 'PICKING_COMPLETE', 'READY', 'READY_FOR_PICKUP', 'READY_FOR_COURIER', 'READYFORPICKUP'].includes(status)) return 'READY';
  if (order.picking?.status === 'IN_PROGRESS' || ['PICKING', 'PICKING_STARTED', 'PICKING_WITH_CHANGES', 'PREPARING'].includes(status)) return 'PREPARING';
  if (['SUBMITTED', 'CHECKOUT_SUBMITTING', 'CHECKOUT_PENDING_CONFIRMATION', 'ORDER_CONFIRMED', 'CONFIRMED', 'STORE_ACCEPTED', 'ACCEPTED', 'ORDER_ACCEPTED'].includes(status)) return 'PLACED';
  // A dispatch job may be assigned while the shop has not yet started picking.
  // Neither this nor a payment event proves preparation or customer handover.
  return 'UNKNOWN';
}

export function trackerSteps(order: Order): CustomerTrackerStage[] {
  return order.fulfillment?.type === 'pickup'
    ? ['PLACED', 'PREPARING', 'READY', 'COMPLETE']
    : ['PLACED', 'PREPARING', 'READY', 'ON_THE_WAY', 'COMPLETE'];
}

/** Present only recognised LTx customer references. Never expose arbitrary provider/session/order IDs. */
export function customerOrderReference(order: Pick<Order, 'displayId' | 'orderReference'>): string {
  const candidates = [order.displayId, order.orderReference]
    .map((value) => String(value || '').trim().toUpperCase())
    .filter(Boolean);

  for (const reference of candidates) {
    const full = reference.match(/^([A-Z][A-Z0-9]{1,3})(\d{2})(0[1-9]|[1-4]\d|5[0-3])([A-Z0-9]{4})$/);
    if (full) return `${full[1]}${full[3]}${full[4]}`;

    const short = reference.match(/^([A-Z][A-Z0-9]{1,3})(0[1-9]|[1-4]\d|5[0-3])([A-Z0-9]{4})$/);
    if (short) return reference;
  }

  return '';
}

export function observedMoney(value: unknown): Money | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<Money>;
  return typeof candidate.amount === 'number' && Number.isSafeInteger(candidate.amount) && candidate.amount >= 0 &&
    typeof candidate.currency === 'string' && /^[A-Z]{3}$/.test(candidate.currency)
    ? { amount: candidate.amount, currency: candidate.currency } : null;
}

export function changedLinePrice(item: PickingItem): boolean {
  const original = observedMoney(item.originalPrice);
  const final = observedMoney(item.finalPrice);
  // A currency conflict isn't a discount, and two separately decoded Money objects may have identical values.
  return item.state !== 'PENDING' && item.state !== 'REMOVED' && Boolean(original && final && original.currency === final.currency && original.amount !== final.amount);
}

export function capturedPayment(order: Order): Money | null {
  return order.payment?.state === 'CAPTURED' ? observedMoney(order.payment.capturedAmount) : null;
}

export function currentOrderTotal(order: Order): Money | null {
  return capturedPayment(order) || observedMoney(order.finalOrder?.total) || observedMoney(order.currentOrder?.total);
}

export function safeProductImage(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const clean = value.trim();
  if (clean.startsWith('/') && !clean.startsWith('//') && !clean.includes('\\')) return clean;
  try {
    const url = new URL(clean);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}

/** Images may be enriched; quantities/prices/identities must remain from the saved order. */
export function snapshotProductImage(order: Order, plu: string, explicit?: unknown): string | undefined {
  const direct = safeProductImage(explicit);
  if (direct) return direct;
  const candidates: Array<{ plu?: string; imageUrl?: string }> = [
    ...(order.originalBasket?.items || []), ...(order.items || []), ...(order.receipt?.items || []), ...(order.basket?.items || []),
  ];
  for (const item of candidates) {
    if (item.plu !== plu) continue;
    const image = safeProductImage(item.imageUrl);
    if (image) return image;
  }
  return undefined;
}
