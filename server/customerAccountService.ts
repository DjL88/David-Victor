import {
  getFirestoreDb,
  isFirestorePermissionDeniedError,
  markFirestorePermissionDenied,
} from './firebase';
import { BFFError } from './errors';
import { isDemoMode, isTestMode } from './runtimeMode';

export interface CustomerAccountProfile {
  tenantId: string;
  customerUid: string;
  favouritePlus: string[];
  createdAt: string;
  updatedAt: string;
}

const inMemoryProfiles = new Map<string, CustomerAccountProfile>();

function fallbackAllowed(): boolean {
  return isDemoMode() || isTestMode() || process.env.NODE_ENV === 'test';
}

function keyFor(tenantId: string, customerUid: string): string {
  return `${tenantId}::${customerUid}`;
}

export function normalizeFavouritePlus(values: unknown): string[] {
  if (!Array.isArray(values)) return [];

  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 500)
    )
  );
}

function emptyProfile(tenantId: string, customerUid: string): CustomerAccountProfile {
  const now = new Date().toISOString();
  return {
    tenantId,
    customerUid,
    favouritePlus: [],
    createdAt: now,
    updatedAt: now,
  };
}

function durableStorageError(message: string): BFFError {
  return new BFFError('DATABASE_UNAVAILABLE', message, 503, true);
}

function permissionError(message: string): BFFError {
  return new BFFError('DATABASE_PERMISSION_DENIED', message, 503, true);
}

/**
 * Durable, tenant-scoped customer account state.
 *
 * Browser clients never write this collection directly. Authenticated BFF
 * routes resolve both the active tenant and Firebase UID before reading or
 * mutating a profile.
 */
export class CustomerAccountService {
  static async getProfile(tenantId: string, customerUid: string): Promise<CustomerAccountProfile> {
    const cleanTenantId = String(tenantId || '').trim();
    const cleanCustomerUid = String(customerUid || '').trim();
    if (!cleanTenantId || !cleanCustomerUid) {
      throw new BFFError('VALIDATION_ERROR', 'Tenant and customer identity are required.', 400);
    }

    const db = getFirestoreDb();
    const memoryKey = keyFor(cleanTenantId, cleanCustomerUid);

    if (!db) {
      if (!fallbackAllowed()) {
        throw durableStorageError('Customer account data is unavailable because durable storage is not connected.');
      }
      return inMemoryProfiles.get(memoryKey) || emptyProfile(cleanTenantId, cleanCustomerUid);
    }

    try {
      const ref = db
        .collection('tenants')
        .doc(cleanTenantId)
        .collection('customerProfiles')
        .doc(cleanCustomerUid);
      const snap = await ref.get();
      if (!snap.exists) return emptyProfile(cleanTenantId, cleanCustomerUid);

      const raw = snap.data() || {};
      return {
        tenantId: cleanTenantId,
        customerUid: cleanCustomerUid,
        favouritePlus: normalizeFavouritePlus(raw.favouritePlus),
        createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
        updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
      };
    } catch (err: any) {
      if (isFirestorePermissionDeniedError(err)) {
        markFirestorePermissionDenied(err);
        throw permissionError('Customer account data is temporarily unavailable because database access was denied.');
      }
      if (!fallbackAllowed()) {
        throw durableStorageError('Customer account data could not be read from durable storage.');
      }
      return inMemoryProfiles.get(memoryKey) || emptyProfile(cleanTenantId, cleanCustomerUid);
    }
  }

  static async saveFavourites(
    tenantId: string,
    customerUid: string,
    favouritePlus: unknown
  ): Promise<CustomerAccountProfile> {
    const cleanTenantId = String(tenantId || '').trim();
    const cleanCustomerUid = String(customerUid || '').trim();
    if (!cleanTenantId || !cleanCustomerUid) {
      throw new BFFError('VALIDATION_ERROR', 'Tenant and customer identity are required.', 400);
    }

    const normalized = normalizeFavouritePlus(favouritePlus);
    const existing = await this.getProfile(cleanTenantId, cleanCustomerUid);
    const now = new Date().toISOString();
    const next: CustomerAccountProfile = {
      ...existing,
      tenantId: cleanTenantId,
      customerUid: cleanCustomerUid,
      favouritePlus: normalized,
      updatedAt: now,
      createdAt: existing.createdAt || now,
    };

    const db = getFirestoreDb();
    const memoryKey = keyFor(cleanTenantId, cleanCustomerUid);

    if (!db) {
      if (!fallbackAllowed()) {
        throw durableStorageError('Favourites were not saved because durable storage is unavailable.');
      }
      inMemoryProfiles.set(memoryKey, next);
      return next;
    }

    try {
      await db
        .collection('tenants')
        .doc(cleanTenantId)
        .collection('customerProfiles')
        .doc(cleanCustomerUid)
        .set(next, { merge: true });
      return next;
    } catch (err: any) {
      if (isFirestorePermissionDeniedError(err)) {
        markFirestorePermissionDenied(err);
        throw permissionError('Favourites were not saved because database access was denied.');
      }
      if (!fallbackAllowed()) {
        throw durableStorageError('Favourites could not be saved to durable storage.');
      }
      inMemoryProfiles.set(memoryKey, next);
      return next;
    }
  }

  static resetForTest(): void {
    inMemoryProfiles.clear();
  }
}
