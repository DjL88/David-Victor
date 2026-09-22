import { describe, expect, it } from 'vitest';
import { evaluateCustomerCareAction, evaluateSelfServiceClaim } from '../rules/CustomerCarePolicyEngine';
import type { CustomerCase, TenantCustomerCarePolicy } from '../rules/types';

const customerCase: CustomerCase = {
  caseId: 'case-1', tenantId: 'retailer-a', orderId: 'order-1', storeId: 'store-1',
  issueType: 'ITEM_MISSING', status: 'REVIEW_REQUIRED', source: 'ADMIN', currency: 'GBP',
  openedAt: '2026-09-22T12:00:00.000Z',
};

const policy: TenantCustomerCarePolicy = {
  automaticRefundsEnabled: false,
  selfServiceClaimsEnabled: true,
  claimWindowMinutes: 240,
  reviewSlaMinutes: 60,
  onReviewSlaExpired: 'ESCALATE',
  rolePolicies: {
    operationsEditor: {
      refundAuthority: 'STORE',
      customerDataVisibility: 'MASKED',
      canViewRiskSignals: false,
      canIssuePartialRefund: true,
      canIssueFullRefund: false,
      canIssueVoucher: true,
      canResendOrder: true,
      canOverrideAutomatedDecision: false,
      storeIds: ['store-1'],
      maximumRefundAmountMinor: 2500,
    },
  },
};

describe('CustomerCarePolicyEngine', () => {
  it('allows an in-scope store agent to issue a permitted partial refund', () => {
    const result = evaluateCustomerCareAction(policy, 'operationsEditor', 'STORE', 'PARTIAL_REFUND', customerCase, 1200);
    expect(result).toEqual({ allowed: true, reasonCodes: [], customerDataVisibility: 'MASKED' });
  });

  it('blocks central use of store-only refund authority', () => {
    expect(evaluateCustomerCareAction(policy, 'operationsEditor', 'CENTRAL', 'PARTIAL_REFUND', customerCase, 1200).reasonCodes)
      .toContain('REFUND_AUTHORITY_DENIED');
  });

  it('blocks full refunds and refund values above the role limit', () => {
    const result = evaluateCustomerCareAction(policy, 'operationsEditor', 'STORE', 'FULL_REFUND', customerCase, 3000);
    expect(result.allowed).toBe(false);
    expect(result.reasonCodes).toEqual(expect.arrayContaining(['FULL_REFUND_DENIED', 'REFUND_LIMIT_EXCEEDED']));
  });

  it('blocks an agent outside their store scope', () => {
    const otherStore = { ...customerCase, storeId: 'store-2' };
    expect(evaluateCustomerCareAction(policy, 'operationsEditor', 'STORE', 'PARTIAL_REFUND', otherStore, 500).reasonCodes)
      .toContain('STORE_SCOPE_DENIED');
  });

  it('does not allow unprivileged agents to override a risk hold', () => {
    const risk = {
      assessmentId: 'risk-1', tenantId: 'retailer-a', subjectReference: 'customer-hash',
      signals: [], decision: 'TEMPORARY_HOLD' as const, reasonCodes: ['VELOCITY'], createdAt: 'now', requiresHumanReview: true,
    };
    expect(evaluateCustomerCareAction(policy, 'operationsEditor', 'STORE', 'PARTIAL_REFUND', customerCase, 500, risk).reasonCodes)
      .toContain('RISK_HOLD_REQUIRES_REVIEW');
  });

  it('enforces the retailer self-service claim window and calculates review SLA', () => {
    const inside = evaluateSelfServiceClaim(policy, '2026-09-22T10:00:00.000Z', '2026-09-22T13:00:00.000Z');
    expect(inside.allowed).toBe(true);
    expect(inside.reviewDueAt).toBe('2026-09-22T14:00:00.000Z');
    expect(evaluateSelfServiceClaim(policy, '2026-09-22T10:00:00.000Z', '2026-09-22T15:00:01.000Z').reasonCodes)
      .toContain('CLAIM_WINDOW_EXPIRED');
  });
});
