import type { TenantBillingProfile } from '../src/commerce/billingModels';
import { getFirestoreDb } from './firebase';

export interface StoredTenantBillingProfile extends TenantBillingProfile {
  contractVersion: number;
  agreedAt?: string;
  agreedBy?: string;
}

export function validateBillingProfile(profile: StoredTenantBillingProfile): void {
  if (!profile.tenantId || !profile.identity?.legalName || !profile.currency || !profile.anchorDate) {
    throw new Error('Billing profile requires tenant, legal identity, currency and anchor date.');
  }
  if (!['WEEKLY', 'FOUR_WEEKLY', 'MONTHLY'].includes(profile.cadence)) throw new Error('Unsupported billing cadence.');
  if (!Number.isInteger(profile.contractVersion) || profile.contractVersion < 1) throw new Error('Billing contract version must be a positive integer.');
  const seenRuleIds = new Set<string>();
  for (const rule of profile.rules) {
    if (!rule.id || !rule.label || !rule.effectiveFrom) throw new Error('Billing rules require id, label and effective date.');
    if (seenRuleIds.has(rule.id)) throw new Error(`Duplicate billing rule id: ${rule.id}`);
    seenRuleIds.add(rule.id);
    if (!Number.isFinite(Date.parse(rule.effectiveFrom))) throw new Error(`Billing rule ${rule.id} has an invalid effectiveFrom date.`);
    if (rule.effectiveUntil && !Number.isFinite(Date.parse(rule.effectiveUntil))) throw new Error(`Billing rule ${rule.id} has an invalid effectiveUntil date.`);
    if (rule.effectiveUntil && rule.effectiveUntil <= rule.effectiveFrom) throw new Error(`Billing rule ${rule.id} effectiveUntil must be after effectiveFrom.`);
    if (rule.unitAmount && rule.unitAmount.currency !== profile.currency) throw new Error('Billing rule currency must match the tenant billing currency.');
    if (rule.type === 'REVENUE_SHARE') {
      if (!rule.revenueBasis || !Number.isInteger(rule.basisPoints) || (rule.basisPoints || 0) < 0 || (rule.basisPoints || 0) > 10_000) {
        throw new Error('Revenue-share rules require an explicit revenue basis and basis points between 0 and 10000.');
      }
      if (rule.unitAmount) throw new Error('Revenue-share rules must not also define a unit amount.');
    } else if (!rule.unitAmount) {
      throw new Error(`Billing rule ${rule.id} requires a unit amount.`);
    }
  }
}

function versionId(tenantId: string, contractVersion: number): string {
  return `${Buffer.from(tenantId, 'utf8').toString('base64url')}.v${contractVersion}`;
}

/**
 * Stores the current commercial profile separately from checkout state and, once
 * agreed, records that exact contract version in an immutable audit collection.
 * A later commercial change must use a higher contractVersion rather than
 * silently rewriting terms that were already agreed.
 */
export async function saveTenantBillingProfile(profile: StoredTenantBillingProfile): Promise<StoredTenantBillingProfile> {
  validateBillingProfile(profile);
  const db = getFirestoreDb();
  if (!db) throw new Error('Firestore is required for durable billing profiles.');
  const ref = db.collection('billingProfiles').doc(profile.tenantId);
  const existing = await ref.get();
  const previous = existing.data() as StoredTenantBillingProfile | undefined;
  if (previous && profile.contractVersion < previous.contractVersion) throw new Error('Billing contract version cannot move backwards.');
  if (previous?.agreedAt && profile.contractVersion === previous.contractVersion) {
    throw new Error('An agreed billing contract version is immutable; create a new contract version.');
  }
  if (profile.status === 'ACTIVE' && (!profile.agreedAt || !profile.agreedBy)) {
    throw new Error('Active billing profiles require agreement timestamp and actor.');
  }

  if (profile.agreedAt && profile.agreedBy) {
    const historyRef = db.collection('billingContractVersions').doc(versionId(profile.tenantId, profile.contractVersion));
    try {
      await historyRef.create({ ...profile, recordedAt: new Date().toISOString() });
    } catch (error: any) {
      if (error?.code === 6 || error?.code === '6' || error?.code === 'already-exists' || error?.code === 'ALREADY_EXISTS') {
        throw new Error('This billing contract version has already been agreed and cannot be replaced.');
      }
      throw error;
    }
  }

  await ref.set(profile, { merge: false });
  return profile;
}

export async function getTenantBillingProfile(tenantId: string): Promise<StoredTenantBillingProfile | null> {
  const db = getFirestoreDb();
  if (!db) throw new Error('Firestore is required for durable billing profiles.');
  const snapshot = await db.collection('billingProfiles').doc(tenantId).get();
  if (!snapshot.exists) return null;
  const profile = snapshot.data() as StoredTenantBillingProfile;
  return profile.tenantId === tenantId ? profile : null;
}

export async function getBillingContractVersion(tenantId: string, contractVersion: number): Promise<StoredTenantBillingProfile | null> {
  const db = getFirestoreDb();
  if (!db) throw new Error('Firestore is required for durable billing profiles.');
  const snapshot = await db.collection('billingContractVersions').doc(versionId(tenantId, contractVersion)).get();
  if (!snapshot.exists) return null;
  const profile = snapshot.data() as StoredTenantBillingProfile;
  return profile.tenantId === tenantId && profile.contractVersion === contractVersion ? profile : null;
}
