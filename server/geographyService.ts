import { Address } from '../src/commerce/models';
import { getFirestoreDb } from './firebase';

export interface StoreGeography {
  country: string;
  nation?: string; // UK-specific: England / Scotland / Wales / Northern Ireland
  region?: string;
  county?: string;
  town?: string;
  resolvedAt: string;
  source: 'postcodes.io' | 'address';
}

interface CachedStoreGeography extends StoreGeography {
  storeId: string;
  postcode?: string;
}

const GB_COUNTRY_TOKENS = new Set(['GB', 'GBR', 'UK', 'UNITED KINGDOM', 'GREAT BRITAIN']);

function isGreatBritain(address: Address): boolean {
  return GB_COUNTRY_TOKENS.has(String(address.country || '').trim().toUpperCase());
}

/**
 * Resolves real geography (Country, and for GB specifically Nation/Region/
 * County/Town) for a store address. Never fabricates: a failed or
 * unavailable postcode lookup falls back to just the address's own country
 * field rather than guessing a nation.
 */
async function resolveGeographyFromAddress(address: Address): Promise<StoreGeography> {
  const postcode = String(address.postcode || address.postalCode || '').trim();

  if (isGreatBritain(address) && postcode) {
    try {
      const response = await fetch(
        `https://api.postcodes.io/postcodes/${encodeURIComponent(postcode.replace(/\s+/g, ''))}`
      );
      if (response.ok) {
        const body: any = await response.json();
        const result = body?.result;
        if (result) {
          return {
            country: result.country || address.country,
            nation: result.country,
            region: result.region || undefined,
            county: result.admin_county || result.admin_district || undefined,
            town: address.city || result.admin_district || undefined,
            resolvedAt: new Date().toISOString(),
            source: 'postcodes.io',
          };
        }
      }
    } catch (err) {
      console.warn(`[GeographyService] postcodes.io lookup failed for "${postcode}":`, err);
    }
  }

  // Non-GB stores, or a GB store whose postcode lookup failed/was
  // unavailable: honest fallback to whatever the address itself states,
  // never an invented nation/region.
  return {
    country: address.country,
    town: address.city,
    resolvedAt: new Date().toISOString(),
    source: 'address',
  };
}

/**
 * Resolves a store's geography once and caches it in Firestore, keyed by
 * storeId. Re-resolves only if the store's postcode has changed since the
 * cached lookup (address correction, relocation) — normal page loads never
 * hit postcodes.io.
 */
export async function resolveStoreGeography(
  storeId: string,
  address: Address
): Promise<StoreGeography> {
  const postcode = String(address.postcode || address.postalCode || '').trim();
  const db = getFirestoreDb();

  if (db) {
    try {
      const doc = await db.collection('storeGeographyCache').doc(storeId).get();
      if (doc.exists) {
        const cached = doc.data() as CachedStoreGeography;
        if (cached.postcode === postcode) {
          return cached;
        }
      }
    } catch (err) {
      console.warn(`[GeographyService] Could not read geography cache for store ${storeId}:`, err);
    }
  }

  const geography = await resolveGeographyFromAddress(address);

  if (db) {
    try {
      await db
        .collection('storeGeographyCache')
        .doc(storeId)
        .set({ ...geography, storeId, postcode });
    } catch (err) {
      console.warn(`[GeographyService] Could not cache geography for store ${storeId}:`, err);
    }
  }

  return geography;
}
