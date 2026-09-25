import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server/app';
import { setMockAdminAuthForTest } from '../../server/firebase';
import { FirestorePlatformService } from '../../server/firestoreService';
import { SecretManager } from '../../server/secrets';
import { setServerRuntimeMode } from '../../server/runtimeMode';
import { installMockFirebaseAdminToken } from './helpers/firebaseAuthHarness';

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
});

