import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server/app';
import {
  setMockAdminAuthForTest,
  setMockAdminMembershipResolverForTest,
} from '../../server/firebase';
import { setServerRuntimeMode } from '../../server/runtimeMode';
import { SecretManager } from '../../server/secrets';

const token = 'sec02a.test.token';

function installAuth(decoded: Record<string, any>) {
  const auth = {
    verifyIdToken: vi.fn().mockResolvedValue(decoded),
    setCustomUserClaims: vi.fn().mockResolvedValue(undefined),
    revokeRefreshTokens: vi.fn().mockResolvedValue(undefined),
  };
  setMockAdminAuthForTest(auth as any);
  return auth;
}

async function callAdmin() {
  const app = await createApp({ serveFrontend: false, initializeDependencies: false });
  return request(app)
    .get('/api/v1/admin/memberships')
    .set('Authorization', `Bearer ${token}`)
    .set('X-Tenant-ID', 'brand-alpha')
    .set('Host', 'localhost');
}

describe('SEC-02a admin authentication hardening', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.APP_MODE = 'staging';
    setServerRuntimeMode('staging');
  });

  afterEach(() => {
    setMockAdminAuthForTest(null);
    setMockAdminMembershipResolverForTest(null);
    setServerRuntimeMode(null);
    delete process.env.APP_MODE;
    vi.restoreAllMocks();
  });

  it('denies an unverified email even when a matching email-keyed invitation exists', async () => {
    installAuth({
      uid: 'invitee-uid',
      email: 'invitee@example.test',
      email_verified: false,
    });
    setMockAdminMembershipResolverForTest((docId) =>
      docId === 'invitee@example.test_brand-alpha'
        ? {
            email: 'invitee@example.test',
            role: 'tenantAdmin',
            tenantId: 'brand-alpha',
            status: 'active',
          }
        : null
    );

    const response = await callAdmin().expect(403);

    expect(response.body.code).toBe('EMAIL_NOT_VERIFIED');
    expect(response.body).not.toHaveProperty('email');
  });

  it.each(['INVITED', 'REVOKED'])('denies a %s UID membership', async (status) => {
    installAuth({
      uid: 'member-uid',
      email: 'member@example.test',
      email_verified: true,
      role: 'tenantAdmin',
      tenantId: 'brand-alpha',
    });
    setMockAdminMembershipResolverForTest((docId) =>
      docId === 'member-uid_brand-alpha'
        ? {
            uid: 'member-uid',
            email: 'member@example.test',
            role: 'tenantAdmin',
            tenantId: 'brand-alpha',
            status,
          }
        : null
    );

    const response = await callAdmin().expect(403);
    expect(response.body.code).toBe('MEMBERSHIP_INACTIVE');
  });

  it('denies a stale cached claim when the active UID membership has changed', async () => {
    installAuth({
      uid: 'stale-uid',
      email: 'stale@example.test',
      email_verified: true,
      role: 'tenantAdmin',
      tenantId: 'brand-alpha',
    });
    setMockAdminMembershipResolverForTest((docId) =>
      docId === 'stale-uid_brand-alpha'
        ? {
            uid: 'stale-uid',
            email: 'stale@example.test',
            role: 'viewer',
            tenantId: 'brand-alpha',
            status: 'active',
          }
        : null
    );

    const response = await callAdmin().expect(403);
    expect(response.body.code).toBe('STALE_ADMIN_CLAIM');
  });

  it('rejects a platform role stored in a tenant-scoped membership', async () => {
    installAuth({
      uid: 'bad-role-uid',
      email: 'bad-role@example.test',
      email_verified: true,
    });
    setMockAdminMembershipResolverForTest((docId) =>
      docId === 'bad-role-uid_brand-alpha'
        ? {
            uid: 'bad-role-uid',
            email: 'bad-role@example.test',
            role: 'platformSuperAdmin',
            tenantId: 'brand-alpha',
            status: 'active',
          }
        : null
    );

    const response = await callAdmin().expect(403);
    expect(response.body.code).toBe('INVALID_MEMBERSHIP_ROLE');
  });

  it('checks Firebase token revocation and returns 401 for a revoked admin token', async () => {
    const auth = {
      verifyIdToken: vi.fn().mockRejectedValue({ code: 'auth/id-token-revoked' }),
      setCustomUserClaims: vi.fn(),
      revokeRefreshTokens: vi.fn(),
    };
    setMockAdminAuthForTest(auth as any);
    setMockAdminMembershipResolverForTest(() => null);

    const response = await callAdmin().expect(401);

    expect(response.body.code).toBe('FIREBASE_TOKEN_REVOKED');
    expect(auth.verifyIdToken).toHaveBeenCalledWith(token, true);
  });

  it('uses an active UID membership as authority and refreshes missing claims only for a verified email', async () => {
    const auth = installAuth({
      uid: 'active-uid',
      email: 'active@example.test',
      email_verified: true,
    });
    setMockAdminMembershipResolverForTest((docId) =>
      docId === 'active-uid_brand-alpha'
        ? {
            uid: 'active-uid',
            email: 'active@example.test',
            role: 'operationsEditor',
            tenantId: 'brand-alpha',
            status: 'active',
          }
        : null
    );

    await callAdmin().expect(200);

    expect(auth.verifyIdToken).toHaveBeenCalledWith(token, true);
    expect(auth.setCustomUserClaims).toHaveBeenCalledWith('active-uid', {
      role: 'operationsEditor',
      tenantId: 'brand-alpha',
    });
  });

  it('grants bootstrap access for the request only and does not persist privileged claims', async () => {
    const auth = installAuth({
      uid: 'bootstrap-uid',
      email: 'bootstrap@example.test',
      email_verified: true,
    });
    vi.spyOn(SecretManager, 'getSecret').mockResolvedValue('bootstrap@example.test');
    setMockAdminMembershipResolverForTest(() => null);

    await callAdmin().expect(200);

    expect(auth.verifyIdToken).toHaveBeenCalledWith(token, true);
    expect(auth.setCustomUserClaims).not.toHaveBeenCalled();
  });
});
