import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolveTenant } from '../../server/api/v1Router';
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

  it('Error 1 & 2: resolveTenant does NOT throw 404 on unmapped hostnames for admin routes', () => {
    const mockAdminReq: any = {
      path: '/admin/auth/me',
      hostname: 'cloud-run-container-12345.a.run.app',
      headers: {
        'x-forwarded-host': 'cloud-run-container-12345.a.run.app',
      },
      query: {},
    };

    expect(() => resolveTenant(mockAdminReq)).not.toThrow();
    const resolved = resolveTenant(mockAdminReq);
    expect(resolved).toBe('brand-alpha');
  });

  it('Error 1 & 2: resolveTenant respects x-tenant-id header on admin paths in staging', () => {
    const mockAdminReq: any = {
      path: '/admin/memberships',
      hostname: 'random-host.run.app',
      headers: {
        'x-forwarded-host': 'random-host.run.app',
        'x-tenant-id': 'custom-tenant',
      },
      query: {},
    };

    const resolved = resolveTenant(mockAdminReq);
    expect(resolved).toBe('custom-tenant');
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
