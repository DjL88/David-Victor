import { describe, expect, it } from 'vitest';
import {
  assertCustomerIdentityRef,
  createOpaqueCustomerId,
  createTenantLookupToken,
  customerIdentityPath,
  customerPiiPath,
  operationalCustomerReference,
} from './customerPrivacy';

describe('customer privacy boundary', () => {
  it('creates opaque identifiers that contain no supplied PII', () => {
    const first = createOpaqueCustomerId();
    const second = createOpaqueCustomerId();
    expect(first).toMatch(/^cus_[A-Za-z0-9_-]{20,}$/);
    expect(second).not.toBe(first);
  });

  it('keeps identity and PII storage tenant scoped', () => {
    const ref = { tenantId: 'tenant-a', customerId: createOpaqueCustomerId() };
    expect(customerIdentityPath(ref)).toBe(`tenants/tenant-a/customerIdentities/${ref.customerId}`);
    expect(customerPiiPath(ref)).toBe(`tenants/tenant-a/customerPii/${ref.customerId}`);
    expect(operationalCustomerReference(ref)).toEqual(ref);
  });

  it('rejects provider IDs or raw PII masquerading as platform customer IDs', () => {
    expect(() => assertCustomerIdentityRef({ tenantId: 'tenant-a', customerId: 'person@example.com' })).toThrow(/opaque/);
    expect(() => assertCustomerIdentityRef({ tenantId: '', customerId: createOpaqueCustomerId() })).toThrow(/required/);
  });

  it('creates deterministic lookup tokens that cannot match across tenants', () => {
    const key = '0123456789abcdef0123456789abcdef';
    const a1 = createTenantLookupToken({ tenantId: 'tenant-a', normalizedValue: 'person@example.com', lookupKey: key });
    const a2 = createTenantLookupToken({ tenantId: 'tenant-a', normalizedValue: 'person@example.com', lookupKey: key });
    const b = createTenantLookupToken({ tenantId: 'tenant-b', normalizedValue: 'person@example.com', lookupKey: key });
    expect(a1).toBe(a2);
    expect(b).not.toBe(a1);
    expect(a1).not.toContain('person');
  });

  it('refuses weak lookup keys', () => {
    expect(() => createTenantLookupToken({
      tenantId: 'tenant-a',
      normalizedValue: 'person@example.com',
      lookupKey: 'too-short',
    })).toThrow(/32 bytes/);
  });
});
