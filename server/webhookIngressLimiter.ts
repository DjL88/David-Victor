import { BFFError } from './errors';
import { getFirestoreDb } from './firebase';
import { isDemoMode, isTestMode } from './runtimeMode';

interface BucketState {
  tokens: number;
  pendingEstimate: number;
  updatedAtMs: number;
}

const memory = new Map<string, BucketState>();

function numberEnv(name: string, fallback: number, min: number): number {
  const value = Number(process.env[name] || fallback);
  return Number.isFinite(value) && value >= min ? value : fallback;
}

function limits() {
  return {
    capacity: numberEnv('WEBHOOK_TENANT_BURST_LIMIT', 60, 1),
    refillPerSecond: numberEnv('WEBHOOK_TENANT_REFILL_PER_SECOND', 20, 0.1),
    pendingLimit: numberEnv('WEBHOOK_TENANT_PENDING_LIMIT', 200, 1),
    drainPerSecond: numberEnv('WEBHOOK_TENANT_DRAIN_PER_SECOND', 20, 0.1),
  };
}

function consume(previous: BucketState | null, now: number): BucketState {
  const config = limits();
  const state = previous || {
    tokens: config.capacity,
    pendingEstimate: 0,
    updatedAtMs: now,
  };
  const elapsedSeconds = Math.max(0, now - state.updatedAtMs) / 1000;
  const tokens = Math.min(
    config.capacity,
    state.tokens + elapsedSeconds * config.refillPerSecond
  );
  const pendingEstimate = Math.max(
    0,
    state.pendingEstimate - elapsedSeconds * config.drainPerSecond
  );

  if (tokens < 1 || pendingEstimate >= config.pendingLimit) {
    throw new BFFError(
      'RATE_LIMIT_EXCEEDED',
      'Webhook ingress queue is busy for this tenant. Retry shortly.',
      429,
      true,
      {
        pendingEstimate: Math.ceil(pendingEstimate),
        pendingLimit: config.pendingLimit,
      }
    );
  }

  return {
    tokens: tokens - 1,
    pendingEstimate: pendingEstimate + 1,
    updatedAtMs: now,
  };
}

/**
 * SEC-03 per-tenant ingress protection.
 *
 * Live environments persist the token bucket in Firestore so multiple Cloud Run
 * instances share one tenant budget. Demo/tests use an in-memory equivalent.
 * pendingEstimate decays at the configured worker drain rate and provides a
 * bounded back-pressure signal before Cloud Tasks is allowed to grow unchecked.
 */
export class WebhookIngressLimiter {
  static async assertCanEnqueue(tenantId: string): Promise<void> {
    const cleanTenantId = String(tenantId || '').trim();
    if (!cleanTenantId) {
      throw new BFFError('TENANT_SCOPE_REQUIRED', 'Webhook tenant is required.', 400);
    }

    const now = Date.now();
    const live =
      !isDemoMode() &&
      !isTestMode() &&
      process.env.NODE_ENV !== 'test';

    const db = live ? getFirestoreDb() : null;
    if (!db) {
      if (live) {
        throw new BFFError(
          'DATABASE_UNAVAILABLE',
          'Webhook ingress protection is unavailable.',
          503,
          true
        );
      }
      const key = cleanTenantId;
      const next = consume(memory.get(key) || null, now);
      memory.set(key, next);
      return;
    }

    const ref = db.collection('webhookIngressLimits').doc(cleanTenantId);
    await db.runTransaction(async (tx: any) => {
      const snap = await tx.get(ref);
      const data = snap.exists ? (snap.data() as any) : null;
      const previous: BucketState | null = data
        ? {
            tokens: Number(data.tokens || 0),
            pendingEstimate: Number(data.pendingEstimate || 0),
            updatedAtMs: Number(data.updatedAtMs || now),
          }
        : null;
      const next = consume(previous, now);
      tx.set(
        ref,
        {
          ...next,
          tenantId: cleanTenantId,
          updatedAt: new Date(now).toISOString(),
        },
        { merge: true }
      );
    });
  }

  static resetForTest(): void {
    memory.clear();
  }
}
