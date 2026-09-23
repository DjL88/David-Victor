import { getFirestoreDb } from './firebase';
import { BFFError } from './errors';
import { isDemoMode, isTestMode } from './runtimeMode';

const COUNTER_WIDTH = 4;
const MAX_WEEKLY_SEQUENCE = Math.pow(36, COUNTER_WIDTH) - 1;

const memoryReservations = new Map<string, string>();
const memoryCounters = new Map<string, number>();

export function normalizeOrderCodePrefix(value: string): string {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4);
}

export function deriveOrderCodePrefix(brandName: string): string {
  const name = String(brandName || '').trim();
  if (!name) return 'OR';

  const words =
    name.match(/[A-Z]+(?=[A-Z][a-z]|\b)|[A-Z]?[a-z]+|\d+/g) ||
    name.split(/[^A-Za-z0-9]+/).filter(Boolean);

  if (words.length >= 2) {
    const initials = words
      .slice(0, 4)
      .map((word) => word.charAt(0))
      .join('');
    const normalized = normalizeOrderCodePrefix(initials);
    if (normalized.length >= 2) return normalized;
  }

  const compact = normalizeOrderCodePrefix(name);
  if (compact.length >= 2) return compact.slice(0, Math.min(4, compact.length));
  return (compact + 'R').slice(0, 2);
}

export function isoWeekKey(date: Date = new Date()): string {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const isoYear = utc.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil((((utc.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${String(isoYear).slice(-2)}${String(week).padStart(2, '0')}`;
}

function sequenceToken(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > MAX_WEEKLY_SEQUENCE) {
    throw new BFFError(
      'VALIDATION_ERROR',
      'Weekly order reference capacity has been exceeded for this brand.',
      409
    );
  }
  return sequence.toString(36).toUpperCase().padStart(COUNTER_WIDTH, '0');
}

/**
 * Allocates a compact human-facing order reference.
 *
 * Format: PREFIX + YYWW + 4-character base36 weekly sequence.
 * Example: LT2639000A.
 *
 * The sequence is tenant-wide, so a location fragment is not required for
 * uniqueness. Location remains stored separately on the order projection.
 * A basket reservation is idempotent: retries always get the same reference.
 */
export class OrderReferenceService {
  static async reserve(params: {
    tenantId: string;
    basketId: string;
    brandName: string;
    configuredPrefix?: string;
    now?: Date;
  }): Promise<string> {
    const tenantId = String(params.tenantId || '').trim();
    const basketId = String(params.basketId || '').trim();
    if (!tenantId || !basketId) {
      throw BFFError.invalidInput('tenantId and basketId are required to allocate an order reference.');
    }

    const configured = normalizeOrderCodePrefix(params.configuredPrefix || '');
    const prefix = configured.length >= 2
      ? configured
      : deriveOrderCodePrefix(params.brandName);
    const weekKey = isoWeekKey(params.now || new Date());
    const reservationKey = `${tenantId}:${basketId}`;

    const existingMemory = memoryReservations.get(reservationKey);
    if (existingMemory) return existingMemory;

    const db = getFirestoreDb();
    const localOnly = isDemoMode() || isTestMode() || process.env.NODE_ENV === 'test';

    if (!db) {
      if (!localOnly) {
        throw new BFFError(
          'DATABASE_UNAVAILABLE',
          'A durable order reference could not be allocated because Firestore is unavailable.',
          503,
          true
        );
      }
      const counterKey = `${tenantId}:${weekKey}`;
      const next = (memoryCounters.get(counterKey) || 0) + 1;
      memoryCounters.set(counterKey, next);
      const reference = `${prefix}${weekKey}${sequenceToken(next)}`;
      memoryReservations.set(reservationKey, reference);
      return reference;
    }

    const reservationId = Buffer.from(basketId, 'utf8').toString('base64url').slice(0, 180);
    const tenantRef = db.collection('tenants').doc(tenantId);
    const reservationRef = tenantRef.collection('orderReferenceReservations').doc(reservationId);
    const counterRef = tenantRef.collection('orderReferenceCounters').doc(weekKey);

    const reference = await db.runTransaction(async (transaction: any) => {
      const reservation = await transaction.get(reservationRef);
      if (reservation.exists) {
        const prior = String(reservation.data()?.reference || '').trim();
        if (prior) return prior;
      }

      const counter = await transaction.get(counterRef);
      const next = Number(counter.data()?.sequence || 0) + 1;
      const allocated = `${prefix}${weekKey}${sequenceToken(next)}`;
      const nowIso = new Date().toISOString();

      transaction.set(
        counterRef,
        {
          tenantId,
          weekKey,
          sequence: next,
          updatedAt: nowIso,
        },
        { merge: true }
      );
      transaction.set(
        reservationRef,
        {
          tenantId,
          basketId,
          reference: allocated,
          prefix,
          weekKey,
          sequence: next,
          createdAt: nowIso,
        },
        { merge: false }
      );

      return allocated;
    });

    memoryReservations.set(reservationKey, reference);
    return reference;
  }

  static resetForTest(): void {
    memoryReservations.clear();
    memoryCounters.clear();
  }
}
