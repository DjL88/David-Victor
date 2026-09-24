import crypto from 'crypto';

export type CustomerLifecycleState = 'ACTIVE' | 'ERASURE_REQUESTED' | 'ANONYMISED';

export interface CustomerIdentityRef {
  tenantId: string;
  customerId: string;
}

export interface CustomerRelationshipRecord extends CustomerIdentityRef {
  lifecycleState: CustomerLifecycleState;
  createdAt: string;
  updatedAt: string;
  retentionPolicyId?: string;
}

/**
 * Customer IDs are deliberately opaque random identifiers. They are not
 * reversible encodings of email, phone, Firebase UID or any other PII.
 */
export function createOpaqueCustomerId(): string {
  return `cus_${crypto.randomBytes(18).toString('base64url')}`;
}

export function assertCustomerIdentityRef(ref: CustomerIdentityRef): CustomerIdentityRef {
  const tenantId = String(ref.tenantId || '').trim();
  const customerId = String(ref.customerId || '').trim();
  if (!tenantId || !customerId) throw new Error('Tenant and opaque customer identity are required.');
  if (!/^cus_[A-Za-z0-9_-]{20,}$/.test(customerId)) {
    throw new Error('Customer identity must be an opaque platform-generated identifier.');
  }
  return { tenantId, customerId };
}

/**
 * Creates a deterministic tenant-local lookup token for a normalized lookup
 * value. This is a keyed HMAC, not encryption: callers must keep the key in a
 * managed secret/KMS boundary and must never use the token as displayable PII.
 */
export function createTenantLookupToken(params: {
  tenantId: string;
  normalizedValue: string;
  lookupKey: string | Buffer;
}): string {
  const tenantId = String(params.tenantId || '').trim();
  const normalizedValue = String(params.normalizedValue || '').trim();
  if (!tenantId || !normalizedValue) throw new Error('Tenant and normalized lookup value are required.');
  const keyLength = typeof params.lookupKey === 'string'
    ? Buffer.byteLength(params.lookupKey)
    : params.lookupKey.length;
  if (keyLength < 32) throw new Error('Customer lookup key must contain at least 32 bytes.');

  return crypto
    .createHmac('sha256', params.lookupKey)
    .update(`${tenantId}\0${normalizedValue}`, 'utf8')
    .digest('base64url');
}

export function customerIdentityPath(ref: CustomerIdentityRef): string {
  const clean = assertCustomerIdentityRef(ref);
  return `tenants/${clean.tenantId}/customerIdentities/${clean.customerId}`;
}

export function customerPiiPath(ref: CustomerIdentityRef): string {
  const clean = assertCustomerIdentityRef(ref);
  return `tenants/${clean.tenantId}/customerPii/${clean.customerId}`;
}

/**
 * Operational/analytics records should carry this minimal reference rather
 * than copying names, email addresses, phone numbers or delivery addresses.
 */
export function operationalCustomerReference(ref: CustomerIdentityRef): Readonly<CustomerIdentityRef> {
  return Object.freeze(assertCustomerIdentityRef(ref));
}
