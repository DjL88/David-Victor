import { describe, expect, it } from 'vitest';
import { routeProtectedData, ResidencyRoutingError } from '../rules/DataResidencyRouter';
import type { DataResidencyPolicy } from '../rules/types';

const policy = (overrides: Partial<DataResidencyPolicy> = {}): DataResidencyPolicy => ({
  tenantId: 'us-retailer',
  primaryRegion: 'us-east1',
  approvedRegions: ['us-east1', 'us-central1'],
  failoverRegions: ['us-central1'],
  protectedDataClasses: ['CUSTOMER_PII', 'ORDER_PII'],
  crossRegionFailoverEnabled: true,
  failoverResidencyTtlHours: 72,
  repatriationRequired: true,
  ...overrides,
});

describe('DataResidencyRouter', () => {
  it('uses the home region while it is healthy', () => {
    const result = routeProtectedData(policy(), 'CUSTOMER_PII', 'order', '1', [
      { region: 'us-east1', healthy: true }, { region: 'us-central1', healthy: true },
    ], '2026-09-22T10:00:00.000Z');
    expect(result.region).toBe('us-east1');
    expect(result.usedFailover).toBe(false);
    expect(result.placement.repatriateBy).toBeUndefined();
  });

  it('fails over only to an explicitly approved region and records repatriation deadline', () => {
    const result = routeProtectedData(policy(), 'ORDER_PII', 'order', '1', [
      { region: 'us-east1', healthy: false }, { region: 'us-central1', healthy: true },
    ], '2026-09-22T10:00:00.000Z');
    expect(result.region).toBe('us-central1');
    expect(result.placement.repatriateBy).toBe('2026-09-25T10:00:00.000Z');
  });

  it('never selects a healthy region outside the tenant allow-list', () => {
    expect(() => routeProtectedData(policy({ failoverRegions: ['asia-east1'] }), 'CUSTOMER_PII', 'customer', '1', [
      { region: 'us-east1', healthy: false }, { region: 'asia-east1', healthy: true },
    ])).toThrow(/No healthy approved failover region/);
  });

  it('fails closed when cross-region failover is disabled', () => {
    expect(() => routeProtectedData(policy({ crossRegionFailoverEnabled: false }), 'CUSTOMER_PII', 'customer', '1', [
      { region: 'us-east1', healthy: false }, { region: 'us-central1', healthy: true },
    ])).toThrow(ResidencyRoutingError);
  });

  it('rejects a misconfigured primary region outside the approved list', () => {
    expect(() => routeProtectedData(policy({ primaryRegion: 'europe-west1' }), 'CUSTOMER_PII', 'customer', '1', [
      { region: 'europe-west1', healthy: true },
    ])).toThrow(/Primary region/);
  });
});
