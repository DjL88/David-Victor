import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IntegrationContext, TenantSecretResolver } from '../../server/deliverect/IntegrationContext';
import { SecretManager } from '../../server/secrets';
import { FirestorePlatformService } from '../../server/firestoreService';

describe('tenant Deliverect credential isolation', () => {
  const keys = [
    'DELIVERECT_CLIENT_ID',
    'DELIVERECT_CLIENT_ID_BRAND_ALPHA',
    'DELIVERECT_CLIENT_SECRET',
    'DELIVERECT_CLIENT_SECRET_BRAND_ALPHA',
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    IntegrationContext.clearAll();
    SecretManager.clearCache();
    for (const key of keys) delete process.env[key];
  });

  afterEach(() => {
    delete process.env.INTEGRATION_PROFILE_REQUIRED;
    IntegrationContext.clearAll();
    SecretManager.clearCache();
    for (const key of keys) delete process.env[key];
  });

  it('dedicated mode never falls back to the platform credential', async () => {
    process.env.DELIVERECT_CLIENT_ID = 'platform-client';
    expect(
      await TenantSecretResolver.resolveTenantSecret('brand-alpha', 'DELIVERECT_CLIENT_ID', 'dedicated')
    ).toBeNull();
  });

  it('platform mode ignores historical tenant credentials', async () => {
    process.env.DELIVERECT_CLIENT_ID = 'platform-client';
    process.env.DELIVERECT_CLIENT_ID_BRAND_ALPHA = 'tenant-client';

    expect(
      await TenantSecretResolver.resolveTenantSecret('brand-alpha', 'DELIVERECT_CLIENT_ID', 'platform')
    ).toBe('platform-client');
  });

  it('dedicated mode resolves only the tenant credential', async () => {
    process.env.DELIVERECT_CLIENT_SECRET = 'platform-secret';
    process.env.DELIVERECT_CLIENT_SECRET_BRAND_ALPHA = 'tenant-secret';

    expect(
      await TenantSecretResolver.resolveTenantSecret('brand-alpha', 'DELIVERECT_CLIENT_SECRET', 'dedicated')
    ).toBe('tenant-secret');
  });

  it('legacy mode preserves tenant-first fallback for existing records', async () => {
    process.env.DELIVERECT_CLIENT_ID = 'platform-client';
    process.env.DELIVERECT_CLIENT_ID_BRAND_ALPHA = 'legacy-tenant-client';

    expect(
      await TenantSecretResolver.resolveTenantSecret('brand-alpha', 'DELIVERECT_CLIENT_ID', 'legacy')
    ).toBe('legacy-tenant-client');
  });

  it('allows Admin diagnostics to resolve a DRAFT profile without exposing it to runtime workers', async () => {
    process.env.INTEGRATION_PROFILE_REQUIRED = 'true';
    vi.spyOn(FirestorePlatformService, 'getIntegrationConfig').mockResolvedValue({
      tenantId: 'brand-alpha',
      environment: 'staging',
      credentialMode: 'dedicated',
    } as any);
    vi.spyOn(FirestorePlatformService, 'getIntegrationProfile').mockResolvedValue({
      id: 'brand-alpha__staging',
      tenantId: 'brand-alpha',
      environment: 'staging',
      status: 'DRAFT',
      version: 1,
      credentialMode: 'dedicated',
      allowedChannelLinkIds: [],
      deliverect: {},
      secretRefs: {
        deliverectClientId: 'lt--brand-alpha--staging--deliverect-client-id',
        deliverectClientSecret: 'lt--brand-alpha--staging--deliverect-client-secret',
      },
    });
    vi.spyOn(SecretManager, 'getSecret').mockImplementation(async (name) => {
      if (name.endsWith('client-id')) return 'draft-client';
      if (name.endsWith('client-secret')) return 'draft-secret';
      return null;
    });

    const adminContext = await IntegrationContext.getContext('brand-alpha', {
      allowDraftProfile: true,
    });
    expect(adminContext.clientId).toBe('draft-client');
    expect(adminContext.isConfigured).toBe(true);
    expect(IntegrationContext.getCachedContext('brand-alpha')).toBeNull();

    await expect(IntegrationContext.getContext('brand-alpha')).rejects.toMatchObject({
      code: 'INTEGRATION_NOT_CONFIGURED',
    });
  });
});
