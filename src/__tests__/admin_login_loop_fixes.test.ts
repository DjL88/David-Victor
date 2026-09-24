import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server/app';
import { installMockFirebaseAdminToken } from './helpers/firebaseAuthHarness';
import { setServerRuntimeMode } from '../../server/runtimeMode';
import { HttpAdminClient } from '../commerce/HttpAdminClient';

describe('Admin Login Loop Fixes (5 Code Errors)', () => {
  const originalAppMode = process.env.APP_MODE;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.APP_MODE = 'staging';
    setServerRuntimeMode('staging');
  });

  afterEach(() => {
    process.env.APP_MODE = originalAppMode;
    setServerRuntimeMode((originalAppMode as any) || 'demo');
    vi.restoreAllMocks();
  });

  it('Error 1 & 2: authenticated admin identity works on an unmapped managed hostname', async () => {
    const { token } = installMockFirebaseAdminToken();
    const app = await createApp({ serveFrontend: false, initializeDependencies: false });

    const response = await request(app)
      .get('/api/v1/admin/auth/me')
      .set('Host', 'cloud-run-container-12345.a.run.app')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.role).toBe('platformSuperAdmin');
  });

  it('Error 1 & 2: authenticated admin routes can use their explicit tenant scope in staging', async () => {
    const { token } = installMockFirebaseAdminToken();
    const app = await createApp({ serveFrontend: false, initializeDependencies: false });

    const response = await request(app)
      .get('/api/v1/admin/memberships')
      .set('Host', 'random-host.run.app')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-ID', 'custom-tenant')
      .expect(200);

    expect(response.body).toEqual([]);
  });

  it('keeps an explicitly selected tenant when a Platform SuperAdmin identity still references an old tenant', async () => {
    const client = new HttpAdminClient('brand-alpha');
    client.setActiveAdminUser({
      id: 'super-1',
      uid: 'super-1',
      name: 'Super Admin',
      email: 'super@example.com',
      role: 'platformSuperAdmin',
      tenantId: 'brand-alpha',
      isSuperAdmin: true,
    } as any);

    await client.switchTenantAsSuperAdmin('68517fde1c3ddaa7f6d0275c');

    // Re-applying the authenticated identity must not snap the client back to
    // brand-alpha just because that legacy tenantId is present on the user.
    client.setActiveAdminUser({
      id: 'super-1',
      uid: 'super-1',
      name: 'Super Admin',
      email: 'super@example.com',
      role: 'platformSuperAdmin',
      tenantId: 'brand-alpha',
      isSuperAdmin: true,
    } as any);

    const headers = await client.getHeadersAsync();
    expect(headers['X-Tenant-ID']).toBe('68517fde1c3ddaa7f6d0275c');
  });

  it('Error 4: HttpAdminClient normalizes user.id from uid if id is omitted by server payload', async () => {
    const client = new HttpAdminClient('brand-alpha');
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        uid: 'user-uid-abc-123',
        email: 'dleitch22@gmail.com',
        role: 'platformSuperAdmin',
        isSuperAdmin: true,
        tenantId: 'brand-alpha',
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const user = await client.getCurrentAdminUser();
    expect(user.id).toBe('user-uid-abc-123');
    expect(user.uid).toBe('user-uid-abc-123');
    expect(user.email).toBe('dleitch22@gmail.com');
  });
});
