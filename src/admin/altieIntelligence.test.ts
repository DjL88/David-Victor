import { describe, expect, it, vi } from 'vitest';
import {
  ALTIE_PRODUCT_KNOWLEDGE,
  buildAltieCapabilityReply,
  buildUnavailableLiveDataReply,
  isAltieCapabilityQuestion,
  isWorkspaceSnapshotQuestion,
  loadAltieWorkspaceSnapshot,
  summariseAltieWorkspaceSnapshot,
} from './altieIntelligence';

describe('Altie grounded intelligence', () => {
  it('uses Altie naming and carries the intended product coverage', () => {
    const reply = buildAltieCapabilityReply();
    expect(reply).toContain('catalogue/menu');
    expect(reply).toContain('Deliverect');
    expect(reply).toContain('Insights');
    expect(reply).toContain('domain');
    expect(reply).not.toContain('Admin Assistant');
    expect(reply).not.toContain('Artie');

    expect(ALTIE_PRODUCT_KNOWLEDGE.adminAreas).toEqual(
      expect.arrayContaining(['Products & Stock', 'Domains', 'Search & Recommendations', 'Audit History'])
    );
    expect(isAltieCapabilityQuestion('What can Altie do?')).toBe(true);
    expect(isAltieCapabilityQuestion('What can you verify live?')).toBe(true);
    expect(isAltieCapabilityQuestion('What do you know about this brand?')).toBe(false);
  });

  it('refuses to invent unavailable live metrics, orders or publication state', () => {
    expect(buildUnavailableLiveDataReply('What is our top selling item today?')).toContain(
      'don’t have a trusted live Insights read'
    );
    expect(buildUnavailableLiveDataReply('What live Insights data can you verify from chat?')).toContain(
      'don’t have a trusted live Insights read'
    );
    expect(buildUnavailableLiveDataReply('What is order LT123456 status?')).toContain(
      'don’t have a trusted general live-order lookup'
    );
    expect(buildUnavailableLiveDataReply('Is banner Summer Sale live now?')).toContain(
      'don’t have a trusted live publication-state read'
    );
    expect(buildUnavailableLiveDataReply('Explain what Insights covers.')).toBeNull();
  });

  it('recognises current tenant configuration questions without treating general capability questions as live state', () => {
    expect(isWorkspaceSnapshotQuestion('What do you know about this brand?')).toBe(true);
    expect(isWorkspaceSnapshotQuestion('What is the current domain and TLS status?')).toBe(true);
    expect(isWorkspaceSnapshotQuestion('What search tuning is configured?')).toBe(true);
    expect(isWorkspaceSnapshotQuestion('Explain product rules')).toBe(false);
  });

  it('stays explicit when a trusted source is unavailable', () => {
    expect(
      summariseAltieWorkspaceSnapshot(
        {
          tenantId: 'tenant-a',
          checkedAt: '2026-09-25T20:00:00.000Z',
          unavailable: ['domains'],
        },
        'What is our domain status?'
      )
    ).toContain('couldn’t verify');

    expect(
      summariseAltieWorkspaceSnapshot(
        {
          tenantId: 'tenant-a',
          checkedAt: '2026-09-25T20:00:00.000Z',
          unavailable: ['connection health', 'operational readiness'],
        },
        'Are we connected to Deliverect?'
      )
    ).toContain('won’t guess');
  });

  it('builds a sanitized tenant-bound snapshot from existing authenticated Admin reads', async () => {
    const client: any = {
      getBranding: vi.fn(async (tenantId: string) => ({
        tenantId,
        brandName: 'Tenant A',
        status: 'active',
        country: 'GB',
        currency: 'GBP',
        locale: 'en-GB',
        defaultDomain: 'shop.example',
        featureFlags: { enableStories: true, enableDeposits: false },
      })),
      getOperationalReadiness: vi.fn(async (tenantId: string) => ({
        tenantId,
        status: 'READY',
        issueCount: 0,
        checkedAt: '2026-09-25T20:00:00.000Z',
        counts: { commerceStores: 4, physicalLocations: 4, heldCatalogueReviews: 0 },
      })),
      getConnectionHealth: vi.fn(async (tenantId: string) => ({
        tenantId,
        resolvedTenant: { tenantId },
        deliverect: {
          environment: 'production',
          configured: true,
          status: 'CONNECTED',
          connectionState: 'HEALTHY',
          accountId: 'must-not-surface',
          apiUrl: 'must-not-surface',
        },
        products: { renderableProductCount: 120, parsedProductCount: 125 },
        sync: { lastSuccessfulSync: '2026-09-25T19:50:00.000Z', lastCheckedAt: '2026-09-25T20:00:00.000Z' },
      })),
      getSearchConfig: vi.fn(async (tenantId: string) => ({
        tenantId,
        locale: 'en-GB',
        typoAliases: [{ id: '1' }],
        synonyms: [{ id: '1' }, { id: '2' }],
        queryRewrites: [],
        pinnedProducts: [{ id: '1' }],
        boostRules: [{ id: '1' }],
        excludedProductPlus: ['PLU1'],
        updatedAt: '2026-09-25T19:00:00.000Z',
      })),
      listAllDomains: vi.fn(async () => [
        {
          tenantId: 'tenant-a',
          hostname: 'shop.example',
          isPrimary: true,
          status: 'verified',
          tlsStatus: 'ready',
          verificationToken: 'must-not-surface',
        },
        {
          tenantId: 'tenant-b',
          hostname: 'other.example',
          isPrimary: true,
          status: 'verified',
          tlsStatus: 'ready',
        },
      ]),
      getFeePolicy: vi.fn(async () => ({
        deliveryFeeMode: 'FIXED',
        serviceFeeMode: 'PERCENT',
        serviceFeeEnabled: true,
        smallOrderFeeEnabled: false,
      })),
      getSchedulingPolicy: vi.fn(async () => ({
        acceptAsapOrdersOnly: false,
        allowNextOpeningPreOrder: true,
        allowSameDayScheduledPreOrder: true,
      })),
    };

    const snapshot = await loadAltieWorkspaceSnapshot(client, 'tenant-a');

    expect(client.getBranding).toHaveBeenCalledWith('tenant-a');
    expect(client.getOperationalReadiness).toHaveBeenCalledWith('tenant-a');
    expect(snapshot.tenant?.brandName).toBe('Tenant A');
    expect(snapshot.tenant?.enabledFeatures).toEqual(['enableStories']);
    expect(snapshot.connection).toMatchObject({
      environment: 'production',
      configured: true,
      status: 'CONNECTED',
      renderableProductCount: 120,
    });
    expect(snapshot.connection).not.toHaveProperty('accountId');
    expect(snapshot.connection).not.toHaveProperty('apiUrl');
    expect(snapshot.domains).toEqual([
      expect.objectContaining({ hostname: 'shop.example', isPrimary: true, tlsStatus: 'ready' }),
    ]);
    expect(snapshot.domains?.[0]).not.toHaveProperty('verificationToken');
    expect(snapshot.search?.synonyms).toBe(2);
    expect(snapshot.unavailable).toEqual([]);
  });

  it('rejects mismatched tenant payloads instead of treating them as current state', async () => {
    const client: any = {
      getBranding: vi.fn(async () => ({ tenantId: 'tenant-b', brandName: 'Wrong Tenant', featureFlags: {} })),
      getOperationalReadiness: vi.fn(async () => ({ tenantId: 'tenant-b', status: 'READY', issueCount: 0, counts: {} })),
      getConnectionHealth: vi.fn(async () => ({ tenantId: 'tenant-b', resolvedTenant: { tenantId: 'tenant-b' } })),
      getSearchConfig: vi.fn(async () => ({ tenantId: 'tenant-b', synonyms: [] })),
      listAllDomains: vi.fn(async () => [{ tenantId: 'tenant-b', hostname: 'wrong.example' }]),
      getFeePolicy: vi.fn(async () => ({ deliveryFeeMode: 'FREE', serviceFeeMode: 'NONE' })),
      getSchedulingPolicy: vi.fn(async () => ({ acceptAsapOrdersOnly: false })),
    };

    const snapshot = await loadAltieWorkspaceSnapshot(client, 'tenant-a');

    expect(snapshot.tenant).toBeUndefined();
    expect(snapshot.readiness).toBeUndefined();
    expect(snapshot.connection).toBeUndefined();
    expect(snapshot.search).toBeUndefined();
    expect(snapshot.domains).toEqual([]);
    expect(snapshot.unavailable).toEqual(
      expect.arrayContaining(['tenant configuration', 'operational readiness', 'connection health', 'search configuration'])
    );
  });
});
