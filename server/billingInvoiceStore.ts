import type { DraftInvoice } from '../src/commerce/billingModels';
import { getFirestoreDb } from './firebase';

function safeKey(value: string): string {
  return Buffer.from(String(value || ''), 'utf8').toString('base64url');
}

export interface StoredDraftInvoice extends DraftInvoice {
  updatedAt: string;
}

/**
 * Persists a tenant/period draft as a single deterministic document.
 * Drafts may be recalculated while a period is open; they cannot overwrite a
 * finalized invoice. Finalization will be a separate explicit accounting action.
 */
export async function saveBillingDraft(invoice: DraftInvoice): Promise<StoredDraftInvoice> {
  if (!invoice.tenantId || !invoice.periodId) throw new Error('Billing draft requires tenantId and periodId.');
  const db = getFirestoreDb();
  if (!db) throw new Error('Firestore is required for durable billing invoices.');

  const id = `${safeKey(invoice.tenantId)}.${safeKey(invoice.periodId)}`;
  const ref = db.collection('billingInvoices').doc(id);
  const existing = await ref.get();
  if (existing.exists && existing.data()?.status === 'FINALIZED') {
    throw new Error('Finalized billing invoices are immutable.');
  }

  const stored: StoredDraftInvoice = {
    ...invoice,
    updatedAt: new Date().toISOString(),
  };
  await ref.set({ ...stored, status: 'DRAFT' }, { merge: false });
  return stored;
}

export async function getBillingDraft(tenantId: string, periodId: string): Promise<StoredDraftInvoice | null> {
  const db = getFirestoreDb();
  if (!db) throw new Error('Firestore is required for durable billing invoices.');
  const id = `${safeKey(tenantId)}.${safeKey(periodId)}`;
  const snapshot = await db.collection('billingInvoices').doc(id).get();
  if (!snapshot.exists) return null;
  const data = snapshot.data();
  if (!data || data.tenantId !== tenantId || data.periodId !== periodId) return null;
  return data as StoredDraftInvoice;
}

export async function listBillingDrafts(tenantId: string, limit = 24): Promise<StoredDraftInvoice[]> {
  const db = getFirestoreDb();
  if (!db) throw new Error('Firestore is required for durable billing invoices.');
  const snapshot = await db.collection('billingInvoices')
    .where('tenantId', '==', tenantId)
    .orderBy('createdAt', 'desc')
    .limit(Math.max(1, Math.min(limit, 100)))
    .get();
  return snapshot.docs.map((doc) => doc.data() as StoredDraftInvoice);
}
