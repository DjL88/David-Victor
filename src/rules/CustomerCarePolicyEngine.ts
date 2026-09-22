import type {
  CustomerCareAccessPolicy,
  CustomerCase,
  CustomerDataVisibility,
  ResolutionType,
  RiskAssessment,
  TenantCustomerCarePolicy,
} from './types';

export type CustomerCareRole = keyof TenantCustomerCarePolicy['rolePolicies'];
export type CustomerCareActorScope = 'STORE' | 'CENTRAL';

export interface CustomerCareDecision {
  allowed: boolean;
  reasonCodes: string[];
  customerDataVisibility: CustomerDataVisibility;
}

function authorityAllows(policy: CustomerCareAccessPolicy, scope: CustomerCareActorScope): boolean {
  return policy.refundAuthority === 'BOTH' || policy.refundAuthority === scope;
}

export function evaluateCustomerCareAction(
  tenantPolicy: TenantCustomerCarePolicy,
  role: CustomerCareRole,
  scope: CustomerCareActorScope,
  action: ResolutionType,
  customerCase: CustomerCase,
  amountMinor?: number,
  risk?: RiskAssessment
): CustomerCareDecision {
  const access = tenantPolicy.rolePolicies[role];
  if (!access) return { allowed: false, reasonCodes: ['ROLE_NOT_CONFIGURED'], customerDataVisibility: 'NONE' };

  const reasons: string[] = [];
  if ((action === 'PARTIAL_REFUND' || action === 'FULL_REFUND') && !authorityAllows(access, scope)) reasons.push('REFUND_AUTHORITY_DENIED');
  if (action === 'PARTIAL_REFUND' && !access.canIssuePartialRefund) reasons.push('PARTIAL_REFUND_DENIED');
  if (action === 'FULL_REFUND' && !access.canIssueFullRefund) reasons.push('FULL_REFUND_DENIED');
  if (action === 'VOUCHER' && !access.canIssueVoucher) reasons.push('VOUCHER_DENIED');
  if (action === 'ORDER_RESEND' && !access.canResendOrder) reasons.push('RESEND_DENIED');

  if (access.storeIds?.length && !access.storeIds.includes(customerCase.storeId)) reasons.push('STORE_SCOPE_DENIED');

  if (amountMinor !== undefined) {
    if (!Number.isInteger(amountMinor) || amountMinor <= 0) reasons.push('INVALID_AMOUNT');
    if (access.maximumRefundAmountMinor !== undefined && amountMinor > access.maximumRefundAmountMinor) reasons.push('REFUND_LIMIT_EXCEEDED');
  }

  if (risk && risk.decision === 'TEMPORARY_HOLD' && !access.canOverrideAutomatedDecision) reasons.push('RISK_HOLD_REQUIRES_REVIEW');

  return { allowed: reasons.length === 0, reasonCodes: reasons, customerDataVisibility: access.customerDataVisibility };
}

export interface SelfServiceClaimDecision {
  allowed: boolean;
  reasonCodes: string[];
  reviewDueAt?: string;
}

export function evaluateSelfServiceClaim(
  policy: TenantCustomerCarePolicy,
  deliveredAt: string,
  claimedAt: string
): SelfServiceClaimDecision {
  if (!policy.selfServiceClaimsEnabled) return { allowed: false, reasonCodes: ['SELF_SERVICE_DISABLED'] };
  const delivered = new Date(deliveredAt).getTime();
  const claimed = new Date(claimedAt).getTime();
  if (!Number.isFinite(delivered) || !Number.isFinite(claimed) || claimed < delivered) {
    return { allowed: false, reasonCodes: ['INVALID_CLAIM_TIME'] };
  }
  if (claimed - delivered > policy.claimWindowMinutes * 60_000) {
    return { allowed: false, reasonCodes: ['CLAIM_WINDOW_EXPIRED'] };
  }
  return {
    allowed: true,
    reasonCodes: [],
    reviewDueAt: policy.reviewSlaMinutes === undefined
      ? undefined
      : new Date(claimed + policy.reviewSlaMinutes * 60_000).toISOString(),
  };
}
