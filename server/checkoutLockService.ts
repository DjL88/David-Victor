import { getFirestoreDb } from './firebase';
import { isDemoMode, isTestMode } from './runtimeMode';

export interface CheckoutLockClaim {
  claimed: boolean;
  state: 'CLAIMED' | 'COMPLETED' | 'FAILED';
  checkoutId?: string;
}

const memoryLocks = new Map<string, {
  state: 'CLAIMED' | 'COMPLETED' | 'FAILED';
  checkoutId?: string;
  updatedAt: string;
}>();

function lockId(tenantId: string, basketId: string): string {
  // Firestore document IDs cannot contain '/'. Keep the audit-visible
  // tenant:basket shape while escaping only the path separator.
  return `${tenantId}:${basketId.replace(/\//g, '%2F')}`;
}

function liveFirestoreRequired(): boolean {
  return !isDemoMode() && !isTestMode() && process.env.NODE_ENV !== 'test';
}

/**
 * SEC-04b atomic checkout idempotency boundary.
 * A basket lock is claimed before any upstream Deliverect create/checkout call.
 */
export class CheckoutLockService {
  static async claim(
    tenantId: string,
    basketId: string,
    idempotencyKey?: string
  ): Promise<CheckoutLockClaim> {
    const id = lockId(tenantId, basketId);
    const now = new Date().toISOString();
    const db = getFirestoreDb();

    if (!db) {
      if (liveFirestoreRequired()) {
        throw Object.assign(
          new Error('Checkout lock store is unavailable.'),
          { statusCode: 503, code: 'CHECKOUT_LOCK_UNAVAILABLE' }
        );
      }
      const existing = memoryLocks.get(id);
      if (existing?.state === 'CLAIMED' || existing?.state === 'COMPLETED') {
        return { claimed: false, ...existing };
      }
      memoryLocks.set(id, { state: 'CLAIMED', updatedAt: now });
      return { claimed: true, state: 'CLAIMED' };
    }

    const ref = db.collection('checkoutLocks').doc(id);
    try {
      await ref.create({
        tenantId,
        basketId,
        idempotencyKey: idempotencyKey || null,
        state: 'CLAIMED',
        claimedAt: now,
        updatedAt: now,
      });
      return { claimed: true, state: 'CLAIMED' };
    } catch (err: any) {
      const alreadyExists =
        err?.code === 6 ||
        err?.code === 'ALREADY_EXISTS' ||
        /already exists/i.test(String(err?.message || ''));
      if (!alreadyExists) throw err;
    }

    return db.runTransaction(async (tx: any) => {
      const snap = await tx.get(ref);
      const data = snap.exists ? (snap.data() as any) : null;
      if (!data) {
        // Extremely defensive: object disappeared between create failure/read.
        tx.create(ref, {
          tenantId,
          basketId,
          idempotencyKey: idempotencyKey || null,
          state: 'CLAIMED',
          claimedAt: now,
          updatedAt: now,
        });
        return { claimed: true, state: 'CLAIMED' } as CheckoutLockClaim;
      }

      if (data.state === 'FAILED') {
        tx.set(ref, {
          state: 'CLAIMED',
          idempotencyKey: idempotencyKey || data.idempotencyKey || null,
          claimedAt: now,
          updatedAt: now,
          lastError: null,
        }, { merge: true });
        return { claimed: true, state: 'CLAIMED' } as CheckoutLockClaim;
      }

      return {
        claimed: false,
        state: data.state === 'COMPLETED' ? 'COMPLETED' : 'CLAIMED',
        checkoutId: data.checkoutId || undefined,
      } as CheckoutLockClaim;
    });
  }

  static async complete(
    tenantId: string,
    basketId: string,
    checkoutId: string
  ): Promise<void> {
    const id = lockId(tenantId, basketId);
    const now = new Date().toISOString();
    const db = getFirestoreDb();
    if (!db) {
      memoryLocks.set(id, { state: 'COMPLETED', checkoutId, updatedAt: now });
      return;
    }
    await db.collection('checkoutLocks').doc(id).set({
      state: 'COMPLETED',
      checkoutId,
      completedAt: now,
      updatedAt: now,
    }, { merge: true });
  }

  static async fail(
    tenantId: string,
    basketId: string,
    error?: unknown
  ): Promise<void> {
    const id = lockId(tenantId, basketId);
    const now = new Date().toISOString();
    const lastError =
      error instanceof Error ? error.message.slice(0, 500) : String(error || '').slice(0, 500);
    const db = getFirestoreDb();
    if (!db) {
      memoryLocks.set(id, { state: 'FAILED', updatedAt: now });
      return;
    }
    await db.collection('checkoutLocks').doc(id).set({
      state: 'FAILED',
      failedAt: now,
      updatedAt: now,
      lastError,
    }, { merge: true });
  }

  static resetForTest(): void {
    memoryLocks.clear();
  }
}
