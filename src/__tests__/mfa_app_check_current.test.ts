import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server/app';
import {
  setMockAdminAuthForTest,
  setMockAdminMembershipResolverForTest,
} from '../../server/firebase';
import { setAdminAppCheckVerifierForTest } from '../../server/adminSecurity';
import { setServerRuntimeMode } from '../../server/runtimeMode';

const authToken = 'sec02b.current.test.token';

function installAdminAuth(decoded: Record<string, any>) {
  const auth = {
    verifyIdToken: vi.fn().mockResolvedValue(decoded),
    setCustomUserClaims: vi.fn().mockResolvedValue(undefined),
    revokeRefreshTokens: vi.fn().mockResolvedValue(undefined),
  };
  setMockAdminAuthForTest(auth as any);
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
  return auth;
}

async function adminRequest(appCheckToken?: string) {
  const app = await createApp({ serveFrontend: false, initializeDependencies: false });
  const req = request(app)
    .get('/api/v1/admin/memberships')
    .set('Authorization', `Bearer ${authToken}`)
    .set('X-Tenant-ID', 'brand-alpha')
    .set('Host', 'localhost');
  if (appCheckToken) req.set('X-Firebase-AppCheck', appCheckToken);
  return req;
}

describe('SEC-02b current-main MFA and App Check boundary', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.APP_MODE = 'staging';
    process.env.ADMIN_REQUIRE_MFA = 'false';
    process.env.ADMIN_REQUIRE_APP_CHECK = 'false';
    process.env.CHECKOUT_REQUIRE_APP_CHECK = 'false';
    setServerRuntimeMode('staging');
    setAdminAppCheckVerifierForTest(null);
  });

  afterEach(() => {
    setMockAdminAuthForTest(null);
    setMockAdminMembershipResolverForTest(null);
    setAdminAppCheckVerifierForTest(null);
    setServerRuntimeMode(null);
    delete process.env.APP_MODE;
    delete process.env.ADMIN_REQUIRE_MFA;
    delete process.env.ADMIN_REQUIRE_APP_CHECK;
    delete process.env.CHECKOUT_REQUIRE_APP_CHECK;
    vi.restoreAllMocks();
  });

  it('fails closed when Admin MFA is enabled and the Firebase session lacks a second factor', async () => {
    process.env.ADMIN_REQUIRE_MFA = 'true';
    installAdminAuth({
      uid: 'admin-uid',
      email: 'admin@example.test',
      email_verified: true,
      role: 'tenantAdmin',
      tenantId: 'brand-alpha',
    });

    const response = await adminRequest();
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('MFA_REQUIRED');
  });

  it('accepts an active administrator session with a Firebase TOTP second factor', async () => {
    process.env.ADMIN_REQUIRE_MFA = 'required';
    const auth = installAdminAuth({
      uid: 'admin-uid',
      email: 'admin@example.test',
      email_verified: true,
      role: 'tenantAdmin',
      tenantId: 'brand-alpha',
      firebase: { sign_in_second_factor: 'totp' },
    });

    const response = await adminRequest();
    expect(response.status).toBe(200);
    expect(auth.verifyIdToken).toHaveBeenCalledWith(authToken, true);
  });

  it('requires App Check on Admin routes only after the explicit rollout flag is enabled', async () => {
    process.env.ADMIN_REQUIRE_APP_CHECK = 'true';
    installAdminAuth({
      uid: 'admin-uid',
      email: 'admin@example.test',
      email_verified: true,
      role: 'tenantAdmin',
      tenantId: 'brand-alpha',
    });

    const response = await adminRequest();
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('APP_CHECK_REQUIRED');
  });

  it('accepts a verified App Check token on an Admin route', async () => {
    process.env.ADMIN_REQUIRE_APP_CHECK = 'true';
    const verifyAppCheck = vi.fn().mockResolvedValue({ appId: 'web-app' });
    setAdminAppCheckVerifierForTest(verifyAppCheck);
    installAdminAuth({
      uid: 'admin-uid',
      email: 'admin@example.test',
      email_verified: true,
      role: 'tenantAdmin',
      tenantId: 'brand-alpha',
    });

    const response = await adminRequest('valid-app-check');
    expect(response.status).toBe(200);
    expect(verifyAppCheck).toHaveBeenCalledWith('valid-app-check');
  });

  it('rejects an invalid App Check token rather than collapsing it into a generic Admin auth error', async () => {
    process.env.ADMIN_REQUIRE_APP_CHECK = 'true';
    setAdminAppCheckVerifierForTest(vi.fn().mockRejectedValue(new Error('invalid')));
    installAdminAuth({
      uid: 'admin-uid',
      email: 'admin@example.test',
      email_verified: true,
      role: 'tenantAdmin',
      tenantId: 'brand-alpha',
    });

    const response = await adminRequest('invalid-app-check');
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('APP_CHECK_INVALID');
  });

  it('protects checkout independently when checkout App Check rollout is enabled', async () => {
    process.env.CHECKOUT_REQUIRE_APP_CHECK = 'true';

    const app = await createApp({ serveFrontend: false, initializeDependencies: false });
    const response = await request(app)
      .post('/api/v1/checkouts')
      .set('Host', 'localhost')
      .send({});

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('APP_CHECK_REQUIRED');
  });

  it('keeps rollout disabled by default so current staging traffic is not locked out', async () => {
    installAdminAuth({
      uid: 'admin-uid',
      email: 'admin@example.test',
      email_verified: true,
      role: 'tenantAdmin',
      tenantId: 'brand-alpha',
    });

    const response = await adminRequest();
    expect(response.status).toBe(200);
  });
});

describe('SEC-02b client wiring', () => {
  it('ships App Check tokens on both Admin and Commerce clients and exposes TOTP helpers', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');

    const adminClient = read('src/commerce/HttpAdminClient.ts');
    const commerceClient = read('src/commerce/HttpCommerceClient.ts');
    const firebaseClient = read('src/firebase.ts');
    const adminGuard = read('src/admin/AdminGuard.tsx');

    expect(adminClient).toContain("headers['X-Firebase-AppCheck'] = appCheckToken");
    expect(commerceClient).toContain("'X-Firebase-AppCheck': appCheckToken");
    expect(firebaseClient).toContain('TotpMultiFactorGenerator');
    expect(firebaseClient).toContain('ReCaptchaEnterpriseProvider');
    expect(adminGuard).toContain("auth/multi-factor-auth-required");
    expect(adminGuard).toContain('completeAdminTotpEnrollment');
  });
});
