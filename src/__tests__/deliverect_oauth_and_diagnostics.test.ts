import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { OAuthTokenManager } from '../../server/deliverect/OAuthTokenManager';
import { IntegrationUnavailableAdapter } from '../../server/deliverect/IntegrationUnavailableAdapter';
import { LinkedAccountsAdapter } from '../../server/deliverect/LinkedAccountsAdapter';
import { ConnectionDiagnostics } from '../../server/deliverect/ConnectionDiagnostics';
import { SecretManager } from '../../server/secrets';
import { FirestorePlatformService } from '../../server/firestoreService';

describe('Phase 6: Deliverect OAuth & Token Lifecycle', () => {
  beforeEach(() => {
    OAuthTokenManager.clearAll();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('obtains an OAuth token using client_credentials grant', async () => {
    let callCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      callCount++;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'dlv_token_staging_abc123',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      } as any;
    });

    const tokenManager = OAuthTokenManager.getInstance('tenant-alpha', {
      clientId: 'test-client-id-123',
      clientSecret: 'test-client-secret-456',
      environment: 'staging',
    });

    const token = await tokenManager.getValidToken();
    expect(token).toBe('dlv_token_staging_abc123');
    expect(callCount).toBe(1);
  });

  it('reuses cached token and prevents token stampede', async () => {
    let callCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callCount++;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'dlv_cached_token_xyz',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      } as any;
    });

    const tokenManager = OAuthTokenManager.getInstance('tenant-alpha', {
      clientId: 'test-client-id-123',
      clientSecret: 'test-client-secret-456',
      environment: 'staging',
    });

    // Fire 3 simultaneous token requests (stampede test)
    const [token1, token2, token3] = await Promise.all([
      tokenManager.getValidToken(),
      tokenManager.getValidToken(),
      tokenManager.getValidToken(),
    ]);

    // Must return identical cached token and fetch must only have been invoked ONCE
    expect(token1).toBe('dlv_cached_token_xyz');
    expect(token2).toBe('dlv_cached_token_xyz');
    expect(token3).toBe('dlv_cached_token_xyz');
    expect(callCount).toBe(1);
  });

  it('AUTH-02: rejects invalid credentials with genuine 401 error and NO mock fallback', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return {
        ok: false,
        status: 401,
        text: async () => '{"code":"invalid_auth","description":"Invalid authentication credentials provided."}',
      } as any;
    });

    const tokenManager = OAuthTokenManager.getInstance('tenant-alpha-invalid', {
      clientId: 'bad-client-id',
      clientSecret: 'bad-client-secret',
      environment: 'staging',
    });

    await expect(tokenManager.getValidToken()).rejects.toThrow(/401/);
  });

  it('maintains tenant isolation for OAuth instances', () => {
    const managerA = OAuthTokenManager.getInstance('tenant-a', {
      clientId: 'id-a',
      clientSecret: 'secret-a',
    });
    const managerB = OAuthTokenManager.getInstance('tenant-b', {
      clientId: 'id-b',
      clientSecret: 'secret-b',
    });

    expect(managerA).not.toBe(managerB);
  });

  it('WP-07: keys the shared cache by credential identity and audience, not tenant', () => {
    const sharedA = OAuthTokenManager.getInstance('tenant-shared-a', {
      clientId: 'shared-client',
      clientSecret: 'shared-secret',
      environment: 'staging',
    });
    const sharedB = OAuthTokenManager.getInstance('tenant-shared-b', {
      clientId: 'shared-client',
      clientSecret: 'shared-secret',
      environment: 'staging',
    });
    const rotated = OAuthTokenManager.getInstance('tenant-rotated', {
      clientId: 'shared-client',
      clientSecret: 'rotated-secret',
      environment: 'staging',
    });
    const production = OAuthTokenManager.getInstance('tenant-production', {
      clientId: 'shared-client',
      clientSecret: 'shared-secret',
      environment: 'production',
    });

    const key = (manager: OAuthTokenManager) => (manager as any).sharedCacheKey as string;
    expect(key(sharedA)).toBe(key(sharedB));
    expect(key(rotated)).not.toBe(key(sharedA));
    expect(key(production)).not.toBe(key(sharedA));
    expect(key(sharedA)).not.toContain('shared-client');
    expect(key(sharedA)).not.toContain('shared-secret');
  });
});

describe('Phase 6: 503 INTEGRATION_NOT_CONFIGURED Strict Enforcement', () => {
  const adapter = new IntegrationUnavailableAdapter('staging', 'brand-gamma');

  it('rejects getRootCatalog with 503 INTEGRATION_NOT_CONFIGURED', async () => {
    await expect(adapter.getRootCatalog()).rejects.toMatchObject({
      code: 'INTEGRATION_NOT_CONFIGURED',
      statusCode: 503,
    });
  });

  it('rejects getEligibleStores with 503 INTEGRATION_NOT_CONFIGURED (no mock fallback)', async () => {
    await expect(
      adapter.getEligibleStores(
        { latitude: 51.5074, longitude: -0.1278 },
        { formattedAddress: 'London UK' } as any,
        'delivery'
      )
    ).rejects.toMatchObject({
      code: 'INTEGRATION_NOT_CONFIGURED',
      statusCode: 503,
    });
  });

  it('rejects createBasket with 503 INTEGRATION_NOT_CONFIGURED', async () => {
    await expect(adapter.createBasket('store-123', 'delivery')).rejects.toMatchObject({
      code: 'INTEGRATION_NOT_CONFIGURED',
      statusCode: 503,
    });
  });

  it('rejects checkoutBasket with 503 INTEGRATION_NOT_CONFIGURED', async () => {
    await expect(
      adapter.checkoutBasket('basket-123', {
        customer: { name: 'Jane', email: 'jane@example.com' },
        fulfillmentType: 'DELIVERY',
      } as any)
    ).rejects.toMatchObject({
      code: 'INTEGRATION_NOT_CONFIGURED',
      statusCode: 503,
    });
  });
});

describe('Phase 6: Linked Accounts & Entity Normalization', () => {
  const adapter = new LinkedAccountsAdapter();

  it('normalizes raw Deliverect account payloads into domain models', () => {
    const rawDeliverectPayload = [
      {
        _id: 'acc_raw_88',
        name: 'Alpha Retail UK Ltd',
        status: 'ACTIVE',
        locations: [
          {
            _id: 'loc_raw_99',
            name: 'Soho Flagship Store',
            address: {
              street: '45 Wardour St',
              city: 'London',
              postalCode: 'W1D 6PB',
              country: 'GB',
            },
            coordinates: { lat: 51.513, lng: -0.133 },
            status: 'ACTIVE',
            channelLinks: [
              {
                _id: 'chl_raw_111',
                name: 'Deliverect Commerce Delivery',
                channel: 'COMMERCE',
                status: 'ONLINE',
                fulfillmentCapabilities: ['DELIVERY', 'COLLECTION'],
              },
            ],
          },
        ],
      },
    ];

    const normalized = adapter.normalizeDeliverectAccounts('brand-alpha', rawDeliverectPayload);

    // Verify 1-to-many separation of AccountLink -> PhysicalLocation -> CommerceStore
    expect(normalized.accountLinks).toHaveLength(1);
    expect(normalized.accountLinks[0].deliverectAccountId).toBe('acc_raw_88');
    expect(normalized.accountLinks[0].displayName).toBe('Alpha Retail UK Ltd');

    expect(normalized.physicalLocations).toHaveLength(1);
    expect(normalized.physicalLocations[0].deliverectLocationId).toBe('loc_raw_99');
    expect(normalized.physicalLocations[0].coordinates.latitude).toBe(51.513);

    expect(normalized.commerceStores).toHaveLength(1);
    expect(normalized.commerceStores[0].channelLinkId).toBe('chl_raw_111');
    expect(normalized.commerceStores[0].physicalLocationId).toBe(normalized.physicalLocations[0].physicalLocationId);
    expect(normalized.commerceStores[0].fulfillmentCapabilitiesProjection.delivery).toBe(true);
    expect(normalized.commerceStores[0].fulfillmentCapabilitiesProjection.pickup).toBe(true);
  });
});

describe('Phase 6: Connection Diagnostics Engine (5-Step Verification)', () => {
  const tenantId = 'brand-diagnostic-test';

  beforeEach(async () => {
    OAuthTokenManager.clearAll();
    vi.restoreAllMocks();
    // Seed initial tenant config
    await FirestorePlatformService.updateTenantConfig(tenantId, {
      name: 'Diagnostic Brand',
      slug: 'diagnostic-brand',
      country: 'GB',
      currency: 'GBP',
      branding: {
        primaryColor: '#0055ff',
        secondaryColor: '#ffffff',
        fontFamily: 'Inter',
      },
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns UNCONFIGURED status when no credentials exist in SecretManager or env', async () => {
    const savedCid = process.env.DELIVERECT_CLIENT_ID;
    const savedSec = process.env.DELIVERECT_CLIENT_SECRET;
    delete process.env.DELIVERECT_CLIENT_ID;
    delete process.env.DELIVERECT_CLIENT_SECRET;
    try {
      const result = await ConnectionDiagnostics.runDiagnostic(tenantId);
      expect(result.success).toBe(false);
      expect(result.status).toBe('UNCONFIGURED');
      expect(result.connectionState).toBe('DISCONNECTED');
      expect(result.message).toContain('not configured');
    } finally {
      if (savedCid) process.env.DELIVERECT_CLIENT_ID = savedCid;
      if (savedSec) process.env.DELIVERECT_CLIENT_SECRET = savedSec;
    }
  });

  it('executes full 5-step diagnostic when credentials are provided', async () => {
    SecretManager.setSecret(`DELIVERECT_CLIENT_ID_${tenantId}`, 'diag-client-id-xyz');
    SecretManager.setSecret(`DELIVERECT_CLIENT_SECRET_${tenantId}`, 'diag-client-secret-abc');

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/oauth/token')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            access_token: 'dlv_token_diag_verified',
            token_type: 'Bearer',
            expires_in: 3600,
          }),
        } as any;
      }
      return { ok: false, status: 404 } as any;
    });

    vi.spyOn(LinkedAccountsAdapter.prototype, 'fetchFromUpstream').mockResolvedValue({
      tenantId,
      syncedAt: new Date().toISOString(),
      accounts: [
        {
          accountLinkId: 'acclink_acc_staging_diag_1',
          integrationId: `int_${tenantId}`,
          deliverectAccountId: 'acc_staging_diag_1',
          displayName: 'Diagnostic Staging Hub',
          status: 'ACTIVE',
        },
      ],
      locations: [
        {
          physicalLocationId: 'loc_loc_diag_1',
          accountLinkId: 'acclink_acc_staging_diag_1',
          deliverectLocationId: 'loc_diag_1',
          name: 'Diagnostic Staging Hub',
          statusProjection: 'ACTIVE',
          addressProjection: { street: '100 Oxford St', city: 'London', postcode: 'W1D 1LL', country: 'GB' },
          coordinates: { latitude: 51.515, longitude: -0.138 },
        },
      ],
      stores: [
        {
          commerceStoreId: 'cstore_chl_diag_1',
          accountLinkId: 'acclink_acc_staging_diag_1',
          physicalLocationId: 'loc_loc_diag_1',
          channelLinkId: 'chl_diag_1',
          name: 'Oxford St Commerce Store',
          stateProjection: 'open',
          fulfillmentCapabilitiesProjection: { delivery: true, pickup: true, scheduling: true },
          lastSeenAt: new Date().toISOString(),
        },
      ],
    });

    const result = await ConnectionDiagnostics.runDiagnostic(tenantId, {
      environment: 'staging',
      deliverectAccountId: 'acc_staging_diag_1',
      actor: { uid: 'admin_diag', name: 'Lead Architect', role: 'platformSuperAdmin' },
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe('CONNECTED');
    expect(result.connectionState).toBe('HEALTHY');
    expect(result.accountsCount).toBeGreaterThan(0);
    expect(result.storesCount).toBeGreaterThan(0);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);

    // Verify status was persisted to tenant integration
    const integration = await FirestorePlatformService.getTenantIntegration(tenantId);
    expect(integration.status).toBe('connected');
  });

  it('Platform SuperAdmin: executes testPlatformOAuth directly without marking any tenant as connected', async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/oauth/token')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              access_token: 'platform_test_token_xyz',
              token_type: 'Bearer',
              expires_in: 3600,
            }),
          };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      }) as any;

      const result = await ConnectionDiagnostics.testPlatformOAuth({
        environment: 'staging',
        clientId: 'platform_partner_client_id',
        clientSecret: 'platform_partner_client_secret',
        actor: { uid: 'usr_super', name: 'Platform Admin', role: 'platformSuperAdmin' },
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('OAUTH_VERIFIED');
      expect(result.connectionState).toBe('HEALTHY');
      expect(result.tokenAcquired).toBe(true);
      expect(result.environment).toBe('staging');
      expect(result.message).toContain('Deliverect partner OAuth verified');

      // Verify NO tenant was mutated or marked connected by platform test
      const unconnTenantId = `tenant_platform_oauth_${Date.now()}`;
      await FirestorePlatformService.updateIntegrationConfig(unconnTenantId, {
        tenantId: unconnTenantId,
        deliverectAccountId: '',
        environment: 'staging',
        status: 'UNCONFIGURED',
        connectionState: 'DISCONNECTED',
      });

      // Call testPlatformOAuth again to verify it does not touch the unconn tenant
      await ConnectionDiagnostics.testPlatformOAuth({
        environment: 'staging',
        clientId: 'platform_partner_client_id',
        clientSecret: 'platform_partner_client_secret',
        actor: { uid: 'usr_super', name: 'Platform Admin', role: 'platformSuperAdmin' },
      });

      const intg = await FirestorePlatformService.getTenantIntegration(unconnTenantId);
      expect(intg?.status).toBe('UNCONFIGURED');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('Platform SuperAdmin: testPlatformOAuth returns UNCONFIGURED if credentials are empty', async () => {
    const savedId = process.env.DELIVERECT_CLIENT_ID;
    const savedSecret = process.env.DELIVERECT_CLIENT_SECRET;
    try {
      delete process.env.DELIVERECT_CLIENT_ID;
      delete process.env.DELIVERECT_CLIENT_SECRET;

      const result = await ConnectionDiagnostics.testPlatformOAuth({
        environment: 'staging',
        clientId: '',
        clientSecret: '',
        actor: { uid: 'usr_super', name: 'Platform Admin', role: 'platformSuperAdmin' },
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('UNCONFIGURED');
      expect(result.tokenAcquired).toBe(false);
      expect(result.message).toContain('Missing Deliverect partner credentials');
    } finally {
      if (savedId !== undefined) process.env.DELIVERECT_CLIENT_ID = savedId;
      if (savedSecret !== undefined) process.env.DELIVERECT_CLIENT_SECRET = savedSecret;
    }
  });
});
