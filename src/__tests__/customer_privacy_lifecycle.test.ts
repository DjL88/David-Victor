import { describe, expect, it } from 'vitest';
import { createOpaqueCustomerId, type CustomerRelationshipRecord } from '../../server/customerPrivacy';
import {
  createCustomerPrivacyRequest,
  decideCustomerLifecycle,
  privacyRequestPath,
  validateRetentionPolicy,
} from '../../server/customerPrivacyLifecycle';

describe('customer privacy lifecycle', () => {
  const relationship = (): CustomerRelationshipRecord => ({
    tenantId: 'tenant-a',
    customerId: createOpaqueCustomerId(),
    lifecycleState: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  });

  it('creates tenant-scoped auditable export/erasure requests without PII', () => {
    const customer = relationship();
    const request = createCustomerPrivacyRequest({
      identity: customer,
      type: 'ACCESS_EXPORT',
      requestedAt: '2026-09-25T00:00:00Z',
      reasonCode: 'CUSTOMER_REQUEST',
    });
    expect(request.requestId).toMatch(/^cpr_/);
    expect(privacyRequestPath(request)).toContain(`tenants/tenant-a/customerPrivacyRequests/`);
    expect(JSON.stringify(request)).not.toMatch(/email|phone|address/i);
  });

  it('marks erasure requested before approval and preserves immutable history by opaque reference', () => {
    const customer = relationship();
    const request = createCustomerPrivacyRequest({
      identity: customer,
      type: 'ERASURE',
      requestedAt: '2026-09-25T00:00:00Z',
    });
    expect(decideCustomerLifecycle({ relationship: customer, erasureRequest: request })).toEqual({
      nextState: 'ERASURE_REQUESTED',
      piiAction: 'RETAIN',
      operationalHistoryAction: 'RETAIN_OPAQUE_REFERENCE',
      reasonCode: 'ERASURE_REQUESTED',
    });
  });

  it('deletes separable PII only after approved erasure while retaining opaque historical linkage', () => {
    const customer = relationship();
    const request = createCustomerPrivacyRequest({
      identity: customer,
      type: 'ERASURE',
      requestedAt: '2026-09-25T00:00:00Z',
    });
    expect(decideCustomerLifecycle({
      relationship: customer,
      erasureRequest: request,
      erasureApproved: true,
    })).toEqual({
      nextState: 'ANONYMISED',
      piiAction: 'DELETE',
      operationalHistoryAction: 'RETAIN_OPAQUE_REFERENCE',
      reasonCode: 'ERASURE_COMPLETED',
    });
  });

  it('rejects cross-tenant erasure and unsafe free-form reason text', () => {
    const customer = relationship();
    const other = { ...customer, tenantId: 'tenant-b' };
    const request = createCustomerPrivacyRequest({
      identity: other,
      type: 'ERASURE',
      requestedAt: '2026-09-25T00:00:00Z',
    });
    expect(() => decideCustomerLifecycle({ relationship: customer, erasureRequest: request, erasureApproved: true })).toThrow(/same tenant/);
    expect(() => createCustomerPrivacyRequest({
      identity: customer,
      type: 'ERASURE',
      requestedAt: '2026-09-25T00:00:00Z',
      reasonCode: 'email person@example.com',
    })).toThrow(/machine code/);
  });

  it('treats retention as configurable reviewed policy rather than hard-coded law', () => {
    expect(validateRetentionPolicy({ id: 'retailer-policy-v1', reviewAfterDays: 30, anonymiseAfterDays: 365 }))
      .toEqual({ id: 'retailer-policy-v1', reviewAfterDays: 30, anonymiseAfterDays: 365 });
    expect(() => validateRetentionPolicy({ id: 'bad', reviewAfterDays: 30, anonymiseAfterDays: 7 })).toThrow(/review window/);
  });
});
