import type { DataResidencyPolicy, RegionalDataPlacement } from './types';

export type ProtectedDataClass = DataResidencyPolicy['protectedDataClasses'][number];

export interface RegionalHealth {
  region: string;
  healthy: boolean;
}

export interface ResidencyRoutingDecision {
  region: string;
  placement: RegionalDataPlacement;
  usedFailover: boolean;
}

export class ResidencyRoutingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResidencyRoutingError';
  }
}

/**
 * Chooses only tenant-approved geography for protected data. This is a policy decision,
 * not infrastructure failover: callers still need a healthy regional deployment/datastore.
 */
export function routeProtectedData(
  policy: DataResidencyPolicy,
  dataClass: ProtectedDataClass,
  resourceType: string,
  resourceId: string,
  health: RegionalHealth[],
  now: string = new Date().toISOString()
): ResidencyRoutingDecision {
  const healthByRegion = new Map(health.map(item => [item.region, item.healthy]));
  const isProtected = policy.protectedDataClasses.includes(dataClass);
  if (!isProtected) {
    throw new ResidencyRoutingError('Data class is not governed by this protected-data routing policy.');
  }
  if (!policy.approvedRegions.includes(policy.primaryRegion)) {
    throw new ResidencyRoutingError('Primary region is not present in the tenant approved-region allow-list.');
  }

  if (healthByRegion.get(policy.primaryRegion) === true) {
    return {
      region: policy.primaryRegion,
      usedFailover: false,
      placement: {
        tenantId: policy.tenantId,
        resourceType,
        resourceId,
        homeRegion: policy.primaryRegion,
        currentRegion: policy.primaryRegion,
        placementReason: 'PRIMARY',
        lastVerifiedAt: now,
      },
    };
  }

  if (!policy.crossRegionFailoverEnabled) {
    throw new ResidencyRoutingError('Primary region is unavailable and cross-region failover is disabled.');
  }

  const failover = policy.failoverRegions.find(region =>
    region !== policy.primaryRegion &&
    policy.approvedRegions.includes(region) &&
    healthByRegion.get(region) === true
  );
  if (!failover) throw new ResidencyRoutingError('No healthy approved failover region is available.');

  const failedAt = new Date(now);
  const repatriateBy = new Date(failedAt.getTime() + policy.failoverResidencyTtlHours * 3_600_000).toISOString();
  return {
    region: failover,
    usedFailover: true,
    placement: {
      tenantId: policy.tenantId,
      resourceType,
      resourceId,
      homeRegion: policy.primaryRegion,
      currentRegion: failover,
      placementReason: 'FAILOVER',
      failedOverAt: now,
      repatriateBy: policy.repatriationRequired ? repatriateBy : undefined,
      lastVerifiedAt: now,
    },
  };
}
