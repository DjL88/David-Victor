import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server/app';
import { setMockAdminAuthForTest } from '../../server/firebase';
import { FirestorePlatformService } from '../../server/firestoreService';
import { SecretManager } from '../../server/secrets';
import { setServerRuntimeMode } from '../../server/runtimeMode';
import { installMockFirebaseAdminToken } from './helpers/firebaseAuthHarness';
import { ConnectionDiagnostics } from '../../server/deliverect/ConnectionDiagnostics';

describe('tenant-scoped write-only secret management', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setServerRuntimeMode('demo');
  });

  afterEach(() => {
    setMockAdminAuthForTest(null);
    setServerRuntimeMode(null);
    vi.restoreAllMocks();
  });

  it('persists dedicated credentials under environment-scoped secret names without echoing values', async () => {
    const { token } = installMockFirebaseAdminToken({
      role: 'tenantAdmin',
      platformSuperAdmin: false,
      tenantId: 'brand-alpha',
    });
    const getSecret = vi.spyOn(SecretManager, 'getSecret').mockResolvedValue(null);
    const setSecret = vi.spyOn(SecretManager, 'setSecret').mockResolvedValue(true);
    vi.spyOn(FirestorePlatformService, 'getIntegrationConfig').mockResolvedValue({
      tenantId: 'brand-alpha',
      environment: 'staging',
      status: 'standalone',
      connectionState: 'DISCONNECTED',
      bffProxyUrl: '/api/v1',
      lastSyncAt: null,
    });
    vi.spyOn(FirestorePlatformService, 'updateIntegrationConfig').mockImplementation(
      async (tenantId, updates) => ({
        tenantId,
        environment: 'staging',
        status: 'standalone',
        connectionState: 'DISCONNECTED',
        bffProxyUrl: '/api/v1',
        lastSyncAt: null,
        ...updates,
      } as any)
    );
    vi.spyOn(FirestorePlatformService, 'getIntegrationProfile').mockResolvedValue(null);
    const updateProfile = vi
      .spyOn(FirestorePlatformService, 'updateIntegrationProfile')
      .mockImplementation(async (profile) => profile);
    const app = await createApp({ serveFrontend: false, initializeDependencies: false });

    const response = await request(app)
      .post('/api/v1/admin/tenants/brand-alpha/integration/credentials')
      .set('Authorization', `Bearer ${token}`)
      .send({
        credentialMode: 'dedicated',
        environment: 'staging',
        clientId: 'client-value',
        clientSecret: 'secret-value',
        webhookSecret: 'webhook-value',
      })
      .expect(200);

    expect(getSecret).toHaveBeenCalledWith(
      'lt--brand-alpha--staging--deliverect-client-id'
    );
    expect(setSecret).toHaveBeenCalledWith(
      'lt--brand-alpha--staging--deliverect-client-id',
      'client-value',
      true
    );
    expect(setSecret).toHaveBeenCalledWith(
      'lt--brand-alpha--staging--deliverect-client-secret',
      'secret-value',
      true
    );
    expect(setSecret).toHaveBeenCalledWith(
      'lt--brand-alpha--staging--deliverect-webhook-secret',
      'webhook-value',
      true
    );
    expect(updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'brand-alpha__staging',
        credentialMode: 'dedicated',
        secretRefs: expect.objectContaining({
          deliverectClientId: 'lt--brand-alpha--staging--deliverect-client-id',
          deliverectClientSecret: 'lt--brand-alpha--staging--deliverect-client-secret',
          deliverectWebhookSecret: 'lt--brand-alpha--staging--deliverect-webhook-secret',
        }),
      })
    );
    expect(JSON.stringify(response.body)).not.toContain('client-value');
    expect(JSON.stringify(response.body)).not.toContain('secret-value');
    expect(JSON.stringify(response.body)).not.toContain('webhook-value');
  });

  it('allows rotating only one already-configured credential', async () => {
    const { token } = installMockFirebaseAdminToken({
      role: 'tenantAdmin',
      platformSuperAdmin: false,
      tenantId: 'brand-alpha',
    });
    vi.spyOn(SecretManager, 'getSecret').mockResolvedValue('configured');
    const setSecret = vi.spyOn(SecretManager, 'setSecret').mockResolvedValue(true);
    vi.spyOn(FirestorePlatformService, 'getIntegrationConfig').mockResolvedValue({
      tenantId: 'brand-alpha',
      environment: 'staging',
      status: 'standalone',
      connectionState: 'DISCONNECTED',
      bffProxyUrl: '/api/v1',
      lastSyncAt: null,
    });
    vi.spyOn(FirestorePlatformService, 'updateIntegrationConfig').mockImplementation(
      async (tenantId, updates) => ({
        tenantId,
        environment: 'staging',
        status: 'standalone',
        connectionState: 'DISCONNECTED',
        bffProxyUrl: '/api/v1',
        lastSyncAt: null,
        ...updates,
      } as any)
    );
    vi.spyOn(FirestorePlatformService, 'getIntegrationProfile').mockResolvedValue(null);
    vi.spyOn(FirestorePlatformService, 'updateIntegrationProfile').mockImplementation(
      async (profile) => profile
    );
    const app = await createApp({ serveFrontend: false, initializeDependencies: false });

    await request(app)
      .post('/api/v1/admin/tenants/brand-alpha/integration/credentials')
      .set('Authorization', `Bearer ${token}`)
      .send({
        credentialMode: 'dedicated',
        environment: 'staging',
        clientSecret: 'rotated-secret',
      })
      .expect(200);

    expect(setSecret).toHaveBeenCalledTimes(1);
    expect(setSecret).toHaveBeenCalledWith(
      'lt--brand-alpha--staging--deliverect-client-secret',
      'rotated-secret',
      true
    );
  });

  it('stores shared partner credentials once at platform scope without tenant secret refs', async () => {
    const { token } = installMockFirebaseAdminToken({
      role: 'platformSuperAdmin',
      platformSuperAdmin: true,
      tenantId: 'platform',
    });
    vi.spyOn(SecretManager, 'getSecret').mockResolvedValue(null);
    const setSecret = vi.spyOn(SecretManager, 'setSecret').mockResolvedValue(true);
    vi.spyOn(FirestorePlatformService, 'getIntegrationConfig').mockResolvedValue({
      tenantId: 'brand-alpha',
      environment: 'staging',
      status: 'standalone',
      connectionState: 'DISCONNECTED',
      bffProxyUrl: '/api/v1',
      lastSyncAt: null,
    });
    vi.spyOn(FirestorePlatformService, 'updateIntegrationConfig').mockImplementation(
      async (tenantId, updates) => ({ tenantId, ...updates } as any)
    );
    vi.spyOn(FirestorePlatformService, 'getIntegrationProfile').mockResolvedValue(null);
    const updateProfile = vi
      .spyOn(FirestorePlatformService, 'updateIntegrationProfile')
      .mockImplementation(async (profile) => profile);
    const app = await createApp({ serveFrontend: false, initializeDependencies: false });

    const response = await request(app)
      .post('/api/v1/admin/tenants/brand-alpha/integration/credentials')
      .set('Authorization', `Bearer ${token}`)
      .send({
        credentialMode: 'platform',
        environment: 'staging',
        clientId: 'partner-client',
        clientSecret: 'partner-secret',
      })
      .expect(200);

    expect(setSecret).toHaveBeenCalledWith('DELIVERECT_CLIENT_ID_STAGING', 'partner-client', true);
    expect(setSecret).toHaveBeenCalledWith('DELIVERECT_CLIENT_SECRET_STAGING', 'partner-secret', true);
    expect(updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'DRAFT',
        credentialMode: 'platform',
        secretRefs: {},
      })
    );
    expect(JSON.stringify(response.body)).not.toContain('partner-client');
    expect(JSON.stringify(response.body)).not.toContain('partner-secret');
  });

  it('does not let a tenant administrator replace shared partner credentials', async () => {
    const { token } = installMockFirebaseAdminToken({
      role: 'tenantAdmin',
      platformSuperAdmin: false,
      tenantId: 'brand-alpha',
    });
    const setSecret = vi.spyOn(SecretManager, 'setSecret').mockResolvedValue(true);
    const app = await createApp({ serveFrontend: false, initializeDependencies: false });

    await request(app)
      .post('/api/v1/admin/tenants/brand-alpha/integration/credentials')
      .set('Authorization', `Bearer ${token}`)
      .send({
        credentialMode: 'platform',
        environment: 'staging',
        clientId: 'attempted-client',
        clientSecret: 'attempted-secret',
      })
      .expect(403);

    expect(setSecret).not.toHaveBeenCalled();
  });

  it('activates a draft tenant profile only after a successful OAuth test', async () => {
    const { token } = installMockFirebaseAdminToken({
      role: 'tenantAdmin',
      platformSuperAdmin: false,
      tenantId: 'brand-alpha',
    });
    const draftProfile = {
      id: 'brand-alpha__staging',
      tenantId: 'brand-alpha',
      environment: 'staging' as const,
      status: 'DRAFT' as const,
      version: 3,
      credentialMode: 'platform' as const,
      allowedChannelLinkIds: [],
      deliverect: {},
      secretRefs: {},
    };
    vi.spyOn(ConnectionDiagnostics, 'testOAuthOnly').mockResolvedValue({
      success: true,
      status: 'OAUTH_VERIFIED',
      connectionState: 'HEALTHY',
      message: 'Verified',
      latencyMs: 10,
      environment: 'staging',
      tokenAcquired: true,
      tokenAudience: 'https://api.staging.deliverect.com',
      tokenExpiresIn: 3600,
      timestamp: new Date().toISOString(),
    });
    vi.spyOn(FirestorePlatformService, 'getIntegrationProfile').mockResolvedValue(draftProfile);
    const updateProfile = vi
      .spyOn(FirestorePlatformService, 'updateIntegrationProfile')
      .mockImplementation(async (profile) => profile);
    const app = await createApp({ serveFrontend: false, initializeDependencies: false });

    await request(app)
      .post('/api/v1/admin/tenants/brand-alpha/integration/test-oauth')
      .set('Authorization', `Bearer ${token}`)
      .send({ environment: 'staging' })
      .expect(200);

    expect(updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ACTIVE', version: 4 })
    );
  });
});
