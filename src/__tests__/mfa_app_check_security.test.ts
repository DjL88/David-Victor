import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server/app';
import {
  setMockAdminAuthForTest,
  setMockAdminMembershipResolverForTest,
  setMockAppCheckVerifierForTest,
} from '../../server/firebase';
import { setServerRuntimeMode } from '../../server/runtimeMode';

const authToken = 'sec02b.test.token';

function installAdminAuth(decoded: Record<string, any>) {
  const verifyIdToken = vi.fn().mockResolvedValue(decoded);
  setMockAdminAuthForTest({
    verifyIdToken,
    setCustomUserClaims: vi.fn().mockResolvedValue(undefined),
  } as any);
  setMockAdminMembershipResolverForTest((docId) =>
    docId === 'admin-uid_brand-alpha'
      ? {
          uid: 'admin-uid',
          email: 'admin@example.test',
          role: 'tenantAdmin',
          tenantId: 'brand-alpha',
          status: 'active',
        }
      : null
  );
  return verifyIdToken;
}

async function appRequest() {
  return createApp({ serveFrontend: false, initializeDependencies: false });
}

describe('SEC-02b MFA and App Check', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.APP_MODE = 'staging';
    process.env.ADMIN_MFA_ENFORCEMENT = 'required';
    process.env.APP_CHECK_ENFORCEMENT = 'optional';
    setServerRuntimeMode('staging');
  });

  afterEach(() => {
    setMockAdminAuthForTest(null);
    setMockAdminMembershipResolverForTest(null);
    setMockAppCheckVerifierForTest(null);
    setServerRuntimeMode(null);
    delete process.env.APP_MODE;
    delete process.env.ADMIN_MFA_ENFORCEMENT;
    delete process.env.APP_CHECK_ENFORCEMENT;
    vi.restoreAllMocks();
  });

  it('rejects an otherwise-authorized admin token without a second factor', async () => {
    installAdminAuth({
      uid: 'admin-uid',
      email: 'admin@example.test',
      email_verified: true,
      role: 'tenantAdmin',
      tenantId: 'brand-alpha',
    });

    const app = await appRequest();
    const response = await request(app)
      .get('/api/v1/admin/memberships')
      .set('Authorization', `Bearer ${authToken}`)
      .set('X-Tenant-ID', 'brand-alpha')
      .set('Host', 'localhost')
      .expect(403);

    expect(response.body.code).toBe('MFA_REQUIRED');
  });

  it('accepts an active admin membership after Firebase records a TOTP second factor', async () => {
    const verifyIdToken = installAdminAuth({
      uid: 'admin-uid',
      email: 'admin@example.test',
      email_verified: true,
      role: 'tenantAdmin',
      tenantId: 'brand-alpha',
      firebase: { sign_in_second_factor: 'totp' },
    });

    const app = await appRequest();
    await request(app)
      .get('/api/v1/admin/memberships')
      .set('Authorization', `Bearer ${authToken}`)
      .set('X-Tenant-ID', 'brand-alpha')
      .set('Host', 'localhost')
      .expect(200);

    expect(verifyIdToken).toHaveBeenCalledWith(authToken, true);
  });

  it('rejects admin requests without App Check when enforcement is required', async () => {
    process.env.ADMIN_MFA_ENFORCEMENT = 'optional';
    process.env.APP_CHECK_ENFORCEMENT = 'required';
    installAdminAuth({
      uid: 'admin-uid',
      email: 'admin@example.test',
      email_verified: true,
      role: 'tenantAdmin',
      tenantId: 'brand-alpha',
    });

    const app = await appRequest();
    const response = await request(app)
      .get('/api/v1/admin/memberships')
      .set('Authorization', `Bearer ${authToken}`)
      .set('X-Tenant-ID', 'brand-alpha')
      .set('Host', 'localhost')
      .expect(401);

    expect(response.body.code).toBe('APP_CHECK_REQUIRED');
  });

  it('accepts an attested admin request when App Check verifies the token', async () => {
    process.env.ADMIN_MFA_ENFORCEMENT = 'optional';
    process.env.APP_CHECK_ENFORCEMENT = 'required';
    const verifyAppCheck = vi.fn().mockResolvedValue({ appId: 'test-web-app' });
    setMockAppCheckVerifierForTest({ verifyToken: verifyAppCheck });
    installAdminAuth({
      uid: 'admin-uid',
      email: 'admin@example.test',
      email_verified: true,
      role: 'tenantAdmin',
      tenantId: 'brand-alpha',
    });

    const app = await appRequest();
    await request(app)
      .get('/api/v1/admin/memberships')
      .set('Authorization', `Bearer ${authToken}`)
      .set('X-Firebase-AppCheck', 'valid-app-check')
      .set('X-Tenant-ID', 'brand-alpha')
      .set('Host', 'localhost')
      .expect(200);

    expect(verifyAppCheck).toHaveBeenCalledWith('valid-app-check');
  });

  it('protects POST /checkouts before request-body validation', async () => {
    process.env.ADMIN_MFA_ENFORCEMENT = 'optional';
    process.env.APP_CHECK_ENFORCEMENT = 'required';

    const app = await appRequest();
    const response = await request(app)
      .post('/api/v1/checkouts')
      .set('X-Tenant-ID', 'brand-alpha')
      .set('Host', 'localhost')
      .send({})
      .expect(401);

    expect(response.body.code).toBe('APP_CHECK_REQUIRED');
  });
});
