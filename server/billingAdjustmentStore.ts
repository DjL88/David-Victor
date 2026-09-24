import type { BillingAdjustment } from '../src/commerce/billingModels';
import { getFirestoreDb } from './firebase';

function safeKey(value: string): string {
  return Buffer.from(String(value || ''), 'utf8').toString('base64url');
}

/**
 * Commercial credits/adjustments are immutable audit events. Corrections are
 * represented by a new compensating adjustment rather than editing history.
 */
export async function recordBillingAdjustment(
  adjustment: BillingAdjustment
): Promise<BillingAdjustment> {
  if (
    !adjustment.id ||
    !adjustment.tenantId ||
    !adjustment.periodId ||
    !adjustment.description ||
    !adjustment.createdBy ||
    !adjustment.createdAt
  ) {
    throw new Error(
      'Billing adjustment requires id, tenantId, periodId, description, createdBy and createdAt.'
    );
  }
  if (!Number.isFinite(adjustment.amount?.amount) || !adjustment.amount?.currency) {
    throw new Error('Billing adjustment requires a finite amount and currency.');
  }

  const db = getFirestoreDb();
  if (!db) throw new Error('Firestore is required for durable billing adjustments.');

  const id = [
    safeKey(adjustment.tenantId),
    safeKey(adjustment.periodId),
    safeKey(adjustment.id),
  ].join('.');
  const ref = db.collection('billingAdjustments').doc(id);
  try {
    await ref.create(adjustment);
    return adjustment;
  } catch (error: any) {
    if (
      error?.code === 6 ||
      error?.code === '6' ||
      error?.code === 'already-exists' ||
      error?.code === 'ALREADY_EXISTS'
    ) {
      throw new Error(
        'Billing adjustment IDs are immutable. Create a new compensating adjustment instead.'
      );
    }
    throw error;
  }
}

export async function listBillingAdjustments(params: {
  tenantId: string;
  periodId: string;
}): Promise<BillingAdjustment[]> {
  const db = getFirestoreDb();
  if (!db) throw new Error('Firestore is required for durable billing adjustments.');

  const snapshot = await db
    .collection('billingAdjustments')
    .where('tenantId', '==', params.tenantId)
    .where('periodId', '==', params.periodId)
    .get();

  return snapshot.docs
    .map((doc) => doc.data() as BillingAdjustment)
    .filter(
      (adjustment) =>
        adjustment.tenantId === params.tenantId &&
        adjustment.periodId === params.periodId
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
