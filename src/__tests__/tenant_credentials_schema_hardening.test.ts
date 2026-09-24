import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server/app';
import { setMockAdminAuthForTest } from '../../server/firebase';
import { setServerRuntimeMode } from '../../server/runtimeMode';
import { installMockFirebaseAdminToken } from './helpers/firebaseAuthHarness';

describe('TEN-01 credentials, schema and tenant ID hardening', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setServerRuntimeMode('test');
  });

  afterEach(() => {
    setMockAdminAuthForTest(null);
    setServerRuntimeMode(null);
    vi.restoreAllMocks();
  });

  it('rejects reserved and malformed tenant IDs before provisioning', async () => {
    const { token } = installMockFirebaseAdminToken();
    const app = await createApp({ serveFrontend: false, initializeDependencies: false });

    await request(app)
      .post('/api/v1/admin/tenants')
      .set('Authorization', `Bearer ${token}`)
      .send({ brandName: 'Reserved', tenantId: 'admin' })
      .expect(400);

    await request(app)
      .post('/api/v1/admin/tenants')
      .set('Authorization', `Bearer ${token}`)
      .send({ brandName: 'Malformed', tenantId: 'Brand_Alpha' })
      .expect(400);
  });

  it('rejects protected tenant control-plane fields on branding PATCH', async () => {
    const { token } = installMockFirebaseAdminToken();
    const app = await createApp({ serveFrontend: false, initializeDependencies: false });

    for (const protectedField of ['tenantId', 'status', 'lifecycle', 'defaultDomain']) {
      const response = await request(app)
        .patch('/api/v1/admin/tenants/brand-alpha')
        .set('Authorization', `Bearer ${token}`)
        .send({ [protectedField]: 'malicious-change' })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
    }
  });

  it('prevents a tenant admin from repointing Deliverect account or channel assignment', async () => {
    const { token } = installMockFirebaseAdminToken({
      role: 'tenantAdmin',
      platformSuperAdmin: false,
      tenantId: 'brand-alpha',
    });
    const app = await createApp({ serveFrontend: false, initializeDependencies: false });

    const response = await request(app)
      .post('/api/v1/admin/tenants/brand-alpha/integration/credentials')
      .set('Authorization', `Bearer ${token}`)
      .send({
        credentialMode: 'platform',
        environment: 'staging',
        deliverectAccountId: 'another-account',
        channelLinkId: 'another-channel',
      })
      .expect(403);

    expect(response.body.code).toBe('DELIVERECT_ASSIGNMENT_FORBIDDEN');
  });
});
