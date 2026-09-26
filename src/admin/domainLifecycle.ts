export interface DomainLifecycleEvidence {
  hostname?: string;
  domainId?: string;
  status?: 'active' | 'verified' | 'pending';
  verificationToken?: string;
  verificationRecordValue?: string;
  ownershipVerifiedAt?: string;
  tlsStatus?: 'pending' | 'ready' | 'failed';
}

export interface DomainLifecycleState {
  requested: boolean;
  claimed: boolean;
  verified: boolean;
  httpsReady: boolean;
  live: boolean;
}

export function resolveDomainLifecycle(domain: DomainLifecycleEvidence): DomainLifecycleState {
  const requested = Boolean(domain.hostname?.trim());
  const claimed = Boolean(
    domain.domainId ||
      domain.verificationToken ||
      domain.verificationRecordValue ||
      domain.status === 'pending' ||
      domain.status === 'verified' ||
      domain.status === 'active'
  );
  const verified = Boolean(domain.ownershipVerifiedAt) || domain.status === 'verified' || domain.status === 'active';
  const httpsReady = domain.tlsStatus === 'ready' || domain.status === 'active';
  const live = domain.status === 'active';

  return { requested, claimed, verified, httpsReady, live };
}

export function isCurrentTenantRequest(activeTenantId: string, requestTenantId: string): boolean {
  return activeTenantId === requestTenantId;
}
