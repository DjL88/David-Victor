import type { BillingMeterEvent } from '../src/commerce/billingModels';
import { getFirestoreDb } from './firebase';

export interface BillingMeterWriteResult {
  created: boolean;
  event: BillingMeterEvent;
}

function safeKey(value: string): string {
  return Buffer.from(String(value || ''), 'utf8').toString('base64url');
}

/**
 * Durable create-only storage for commercial usage events.
 *
 * The document id is derived from tenant + idempotency key. Firestore create()
 * is deliberately used rather than set(): a webhook/order retry can observe the
 * existing event, but can never overwrite it or create a second billable event.
 */
export async function recordBillingMeterEvent(event: BillingMeterEvent): Promise<BillingMeterWriteResult> {
  if (!event.tenantId || !event.idempotencyKey || !event.sourceId || !event.occurredAt) {
    throw new Error('Billing meter event requires tenantId, idempotencyKey, sourceId and occurredAt.');
  }
  if (!Number.isFinite(event.quantity) || event.quantity < 0) {
    throw new Error('Billing meter event quantity must be a non-negative finite number.');
  }

  const db = getFirestoreDb();
  if (!db) throw new Error('Firestore is required for durable billing metering.');

  const ref = db.collection('billingMeterEvents').doc(`${safeKey(event.tenantId)}.${safeKey(event.idempotencyKey)}`);
  try {
    await ref.create({ ...event, recordedAt: new Date().toISOString() });
    return { created: true, event };
  } catch (error: any) {
    // Firestore ALREADY_EXISTS is gRPC code 6. Some adapters expose a string code.
    if (error?.code === 6 || error?.code === '6' || error?.code === 'already-exists' || error?.code === 'ALREADY_EXISTS') {
      const existing = await ref.get();
      const stored = existing.data() as BillingMeterEvent | undefined;
      if (!stored) throw error;
      return { created: false, event: stored };
    }
    throw error;
  }
}

export async function listBillingMeterEvents(params: {
  tenantId: string;
  startsAt: string;
  endsAt: string;
}): Promise<BillingMeterEvent[]> {
  const db = getFirestoreDb();
  if (!db) throw new Error('Firestore is required for durable billing metering.');

  const snapshot = await db.collection('billingMeterEvents')
    .where('tenantId', '==', params.tenantId)
    .where('occurredAt', '>=', params.startsAt)
    .where('occurredAt', '<', params.endsAt)
    .get();

  return snapshot.docs.map((doc) => doc.data() as BillingMeterEvent);
}

/** Only a final successful/settled order should be metered. */
export function successfulOrderMeterEvent(params: {
  tenantId: string;
  orderId: string;
  occurredAt: string;
  settledOrderTotal?: { amount: number; currency: string };
}): BillingMeterEvent {
  return {
    idempotencyKey: `successful-order:${params.orderId}`,
    tenantId: params.tenantId,
    type: 'SUCCESSFUL_ORDER',
    occurredAt: params.occurredAt,
    sourceType: 'ORDER',
    sourceId: params.orderId,
    quantity: 1,
    metadata: params.settledOrderTotal ? {
      settledOrderTotalMinor: params.settledOrderTotal.amount,
      currency: params.settledOrderTotal.currency,
    } : undefined,
  };
}

/** Revenue share is separately metered so its contractual basis stays explicit. */
export function settledRevenueMeterEvent(params: {
  tenantId: string;
  orderId: string;
  occurredAt: string;
  amount: { amount: number; currency: string };
  basis: 'SETTLED_MERCHANDISE_EX_VAT' | 'SETTLED_ORDER_TOTAL';
}): BillingMeterEvent {
  return {
    idempotencyKey: `settled-revenue:${params.basis}:${params.orderId}`,
    tenantId: params.tenantId,
    type: 'REVENUE_SETTLED',
    occurredAt: params.occurredAt,
    sourceType: 'ORDER',
    sourceId: params.orderId,
    quantity: 1,
    amount: params.amount,
    metadata: { revenueBasis: params.basis },
  };
}
