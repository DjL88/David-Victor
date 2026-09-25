import crypto from 'crypto';
import {
  assertCustomerIdentityRef,
  type CustomerIdentityRef,
  type CustomerLifecycleState,
  type CustomerRelationshipRecord,
} from './customerPrivacy';

export type CustomerPrivacyRequestType = 'ACCESS_EXPORT' | 'ERASURE';
export type CustomerPrivacyRequestStatus =
  | 'REQUESTED'
  | 'IN_REVIEW'
  | 'COMPLETED'
  | 'REJECTED';

export interface CustomerPrivacyRequest {
  requestId: string;
  tenantId: string;
  customerId: string;
  type: CustomerPrivacyRequestType;
  status: CustomerPrivacyRequestStatus;
  requestedAt: string;
  updatedAt: string;
  completedAt?: string;
  /** Non-sensitive internal reason code; never free-form PII. */
  reasonCode?: string;
}

export interface CustomerRetentionPolicy {
  id: string;
  /** Review window, not an assertion of a legal retention requirement. */
  reviewAfterDays: number;
  anonymiseAfterDays?: number;
}

export interface CustomerLifecycleDecision {
  nextState: CustomerLifecycleState;
  piiAction: 'RETAIN' | 'DELETE';
  operationalHistoryAction: 'RETAIN_OPAQUE_REFERENCE';
  reasonCode: 'NO_CHANGE' | 'ERASURE_REQUESTED' | 'ERASURE_COMPLETED';
}

const iso = (value: string): string => {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new Error('A valid timestamp is required.');
  return new Date(ms).toISOString();
};

const safeReason = (value?: string): string | undefined => {
  if (value === undefined) return undefined;
  const clean = String(value).trim();
  if (!/^[A-Z0-9_:-]{1,80}$/.test(clean)) throw new Error('reasonCode must be a non-sensitive machine code.');
  return clean;
};

export function createCustomerPrivacyRequest(params: {
  identity: CustomerIdentityRef;
  type: CustomerPrivacyRequestType;
  requestedAt: string;
  reasonCode?: string;
}): CustomerPrivacyRequest {
  const identity = assertCustomerIdentityRef(params.identity);
  const now = iso(params.requestedAt);
  return {
    requestId: `cpr_${crypto.randomBytes(18).toString('base64url')}`,
    ...identity,
    type: params.type,
    status: 'REQUESTED',
    requestedAt: now,
    updatedAt: now,
    ...(safeReason(params.reasonCode) ? { reasonCode: safeReason(params.reasonCode) } : {}),
  };
}

export function privacyRequestPath(request: CustomerPrivacyRequest): string {
  const identity = assertCustomerIdentityRef(request);
  if (!/^cpr_[A-Za-z0-9_-]{20,}$/.test(request.requestId)) throw new Error('Invalid privacy request identifier.');
  return `tenants/${identity.tenantId}/customerPrivacyRequests/${request.requestId}`;
}

/**
 * Lifecycle state is explicit and auditable. Completing an erasure removes the
 * separable PII record while retaining only the opaque tenant-local reference
 * required by immutable order/financial/analytics history.
 *
 * The caller remains responsible for applying the retailer's configured,
 * reviewed retention policy; this module does not claim a legal requirement.
 */
export function decideCustomerLifecycle(params: {
  relationship: CustomerRelationshipRecord;
  erasureRequest?: CustomerPrivacyRequest;
  erasureApproved?: boolean;
}): CustomerLifecycleDecision {
  const identity = assertCustomerIdentityRef(params.relationship);
  if (identity.tenantId !== params.relationship.tenantId || identity.customerId !== params.relationship.customerId) {
    throw new Error('Customer relationship identity mismatch.');
  }

  const request = params.erasureRequest;
  if (!request) {
    return {
      nextState: params.relationship.lifecycleState,
      piiAction: 'RETAIN',
      operationalHistoryAction: 'RETAIN_OPAQUE_REFERENCE',
      reasonCode: 'NO_CHANGE',
    };
  }

  const requestIdentity = assertCustomerIdentityRef(request);
  if (
    request.type !== 'ERASURE' ||
    requestIdentity.tenantId !== identity.tenantId ||
    requestIdentity.customerId !== identity.customerId
  ) {
    throw new Error('Erasure request must belong to the same tenant-scoped customer identity.');
  }

  if (!params.erasureApproved) {
    return {
      nextState: 'ERASURE_REQUESTED',
      piiAction: 'RETAIN',
      operationalHistoryAction: 'RETAIN_OPAQUE_REFERENCE',
      reasonCode: 'ERASURE_REQUESTED',
    };
  }

  return {
    nextState: 'ANONYMISED',
    piiAction: 'DELETE',
    operationalHistoryAction: 'RETAIN_OPAQUE_REFERENCE',
    reasonCode: 'ERASURE_COMPLETED',
  };
}

export function validateRetentionPolicy(policy: CustomerRetentionPolicy): CustomerRetentionPolicy {
  const reviewAfterDays = Number(policy.reviewAfterDays);
  const anonymiseAfterDays = policy.anonymiseAfterDays === undefined
    ? undefined
    : Number(policy.anonymiseAfterDays);
  if (!policy.id.trim()) throw new Error('Retention policy id is required.');
  if (!Number.isInteger(reviewAfterDays) || reviewAfterDays < 1) throw new Error('reviewAfterDays must be a positive integer.');
  if (anonymiseAfterDays !== undefined && (!Number.isInteger(anonymiseAfterDays) || anonymiseAfterDays < reviewAfterDays)) {
    throw new Error('anonymiseAfterDays must be an integer on or after the review window.');
  }
  return { id: policy.id.trim(), reviewAfterDays, ...(anonymiseAfterDays !== undefined ? { anonymiseAfterDays } : {}) };
}
