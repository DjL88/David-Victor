import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express, { Request, Response } from 'express';
import { HttpAdminClient, getAdminAuthorizationHeader } from '../commerce/HttpAdminClient';
import { ALL_MOCK_ADMIN_USERS } from '../commerce/mockData';
import { verifyAdminSession, setMockAdminAuthForTest } from '../../server/firebase';
import { v1Router } from '../../server/api/v1Router';
import { setServerRuntimeMode } from '../../server/runtimeMode';
import { ConnectionDiagnostics } from '../../server/deliverect/ConnectionDiagnostics';
import { setRuntimeMode } from '../domain/runtime';

describe('Admin Authentication & RBAC Regression Tests', () => {
  const originalAppMode = process.env.APP_MODE;
  const originalDeliverectEnv = process.env.DELIVERECT_ENV;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env.APP_MODE = originalAppMode;
    process.env.DELIVERECT_ENV = originalDeliverectEnv;
    setServerRuntimeMode((originalAppMode as any) || 'demo');
    setRuntimeMode('UNKNOWN');
    vi.restoreAllMocks();
  });

  describe('1. HttpAdminClient Token Generation Rules', () => {
    it('generates dev_token_<role>_<userId> when getRuntimeMode() is DEMO and no Firebase user is logged in', async () => {
      setRuntimeMode('DEMO');
      const client = new HttpAdminClient('brand-alpha');
      const superAdmin = ALL_MOCK_ADMIN_USERS[0]; // platformSuperAdmin
      client.setActiveAdminUser(superAdmin);

      const headers = await client.getHeadersAsync();
      expect(headers['Authorization']).toBe(`Bearer dev_token_${superAdmin.role}_${superAdmin.id}`);
      expect(headers['X-Tenant-ID']).toBe('brand-alpha');
    });

    it('updates dev_token when active admin user is switched in Demo mode', async () => {
      setRuntimeMode('DEMO');
      const client = new HttpAdminClient('brand-alpha');
      const tenantManager = ALL_MOCK_ADMIN_USERS[1]; // tenantAdmin
      client.setActiveAdminUser(tenantManager);

      const headers = await client.getHeadersAsync();
      expect(headers['Authorization']).toBe(`Bearer dev_token_${tenantManager.role}_${tenantManager.id}`);
    });

    it('NEVER generates a dev token when getRuntimeMode() is STAGING without Firebase token', async () => {
      setRuntimeMode('STAGING');
      const client = new HttpAdminClient('brand-alpha');
      const superAdmin = ALL_MOCK_ADMIN_USERS[0];
      client.setActiveAdminUser(superAdmin);

      const headers = await client.getHeadersAsync();
      expect(headers['Authorization']).toBeUndefined();
      expect(headers['X-Tenant-ID']).toBe('brand-alpha');
    });

    it('NEVER generates a dev token when getRuntimeMode() is PRODUCTION without Firebase token', async () => {
      setRuntimeMode('PRODUCTION');
      const client = new HttpAdminClient('brand-alpha');
      const superAdmin = ALL_MOCK_ADMIN_USERS[0];
      client.setActiveAdminUser(superAdmin);

      const headers = await client.getHeadersAsync();
      expect(headers['Authorization']).toBeUndefined();
    });

    it('prefers real cached Firebase token over dev token even in Demo mode', async () => {
      setRuntimeMode('DEMO');
      const client = new HttpAdminClient('brand-alpha');
      client.setActiveAdminUser(ALL_MOCK_ADMIN_USERS[0]);
      client.setCachedRealToken('real-firebase-jwt-token-xyz');

      const headers = await client.getHeadersAsync();
      expect(headers['Authorization']).toBe('Bearer real-firebase-jwt-token-xyz');
      client.setCachedRealToken(null);
    });

    it('dynamically responds to getRuntimeMode() changes without client recreation or stale state', async () => {
      setRuntimeMode('UNKNOWN');
      const client = new HttpAdminClient('brand-alpha');
      const superAdmin = ALL_MOCK_ADMIN_USERS[0];
      client.setActiveAdminUser(superAdmin);

      // In UNKNOWN: no dev token
      let headers = await client.getHeadersAsync();
      expect(headers['Authorization']).toBeUndefined();

      // Mode updates to DEMO dynamically:
      setRuntimeMode('DEMO');
      headers = await client.getHeadersAsync();
      expect(headers['Authorization']).toBe(`Bearer dev_token_${superAdmin.role}_${superAdmin.id}`);

      // Mode transitions to STAGING:
      setRuntimeMode('STAGING');
      headers = await client.getHeadersAsync();
      expect(headers['Authorization']).toBeUndefined();
    });
  });

  describe('2. Backend verifyAdminSession Role and Mode Resolution', () => {
    it('Demo mode + platformSuperAdmin dev token resolves session with isSuperAdmin=true', async () => {
      process.env.APP_MODE = 'demo';
      setServerRuntimeMode('demo');

      const session = await verifyAdminSession('Bearer dev_token_platformSuperAdmin_usr-alpha-super', 'brand-alpha');
      expect(session).not.toBeNull();
      expect(session?.role).toBe('platformSuperAdmin');
      expect(session?.isSuperAdmin).toBe(true);
    });

    it('Demo mode + tenantAdmin dev token resolves session with isSuperAdmin=false', async () => {
      process.env.APP_MODE = 'demo';
      setServerRuntimeMode('demo');

      const session = await verifyAdminSession('Bearer dev_token_tenantAdmin_usr-alpha-owner', 'brand-alpha');
      expect(session).not.toBeNull();
      expect(session?.role).toBe('tenantAdmin');
      expect(session?.isSuperAdmin).toBe(false);
    });

    it('Staging mode strictly REJECTS dev tokens', async () => {
      process.env.APP_MODE = 'staging';
      setServerRuntimeMode('staging');

      const session = await verifyAdminSession('Bearer dev_token_platformSuperAdmin_usr-alpha-super', 'brand-alpha');
      expect(session).toBeNull();
    });

    it('Staging mode rejects requests without Authorization header', async () => {
      process.env.APP_MODE = 'staging';
      setServerRuntimeMode('staging');

      const session = await verifyAdminSession(undefined, 'brand-alpha');
      expect(session).toBeNull();
    });

    it('Staging mode authorizes real Firebase token with platformSuperAdmin custom claim', async () => {
      process.env.APP_MODE = 'staging';
      setServerRuntimeMode('staging');

      const mockAdminAuth = {
        verifyIdToken: vi.fn().mockResolvedValue({
          uid: 'firebase-super-uid-123',
          email: 'superadmin@bwydi.com',
          role: 'platformSuperAdmin',
          platformSuperAdmin: true,
        }),
      };

      setMockAdminAuthForTest(mockAdminAuth as any);

      const session = await verifyAdminSession('Bearer real-firebase-super-jwt', 'brand-alpha');
      expect(session).not.toBeNull();
      expect(session?.role).toBe('platformSuperAdmin');
      expect(session?.isSuperAdmin).toBe(true);
      expect(session?.uid).toBe('firebase-super-uid-123');

      setMockAdminAuthForTest(null);
    });
  });

  describe('3. Platform Deliverect OAuth Route (/admin/platform/integrations/deliverect/test-oauth)', () => {
    let app: express.Express;

    beforeEach(() => {
      app = express();
      app.use(express.json());
      app.use('/api/v1', v1Router);

      // Mock ConnectionDiagnostics.testPlatformOAuth so external HTTP call is not executed
      vi.spyOn(ConnectionDiagnostics, 'testPlatformOAuth').mockResolvedValue({
        status: 'CONNECTED',
        success: true,
        message: 'Deliverect OAuth authentication succeeded.',
        latencyMs: 142,
        environment: 'staging',
        httpStatus: 200,
      } as any);
    });

    // Helper to simulate request without supertest dependency
    const makeRequest = (authHeader?: string) => {
      return new Promise<{ status: number; body: any }>((resolve) => {
        const req = {
          method: 'POST',
          url: '/api/v1/admin/platform/integrations/deliverect/test-oauth',
          headers: {
            'content-type': 'application/json',
            ...(authHeader ? { authorization: authHeader } : {}),
          },
          body: { environment: 'staging' },
        } as any;

        const res = {
          statusCode: 200,
          status(code: number) {
            this.statusCode = code;
            return this;
          },
          json(data: any) {
            resolve({ status: this.statusCode, body: data });
            return this;
          },
          setHeader() {},
          getHeader() {},
        } as any;

        (app as any).handle(req, res);
      });
    };

    it('Demo mode + Platform SuperAdmin dev token -> Authentication and Authorization SUCCEED (not 401)', async () => {
      process.env.APP_MODE = 'demo';
      setServerRuntimeMode('demo');

      const response = await makeRequest('Bearer dev_token_platformSuperAdmin_usr-alpha-super');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.status).toBe('CONNECTED');
    });

    it('Demo mode + Ordinary Tenant Admin dev token -> Returns 403 Forbidden', async () => {
      process.env.APP_MODE = 'demo';
      setServerRuntimeMode('demo');

      const response = await makeRequest('Bearer dev_token_tenantAdmin_usr-alpha-manager');
      expect(response.status).toBe(403);
      expect(response.body.code).toBe('FORBIDDEN_SUPERADMIN_ONLY');
    });

    it('Demo or Staging without Authorization header -> Returns 401 Unauthorized', async () => {
      process.env.APP_MODE = 'demo';
      setServerRuntimeMode('demo');

      const response = await makeRequest(undefined);
      expect(response.status).toBe(401);
      expect(response.body.code).toBe('AUTH_REQUIRED');
    });

    it('Staging mode + dev token -> Strictly returns 401 Unauthorized', async () => {
      process.env.APP_MODE = 'staging';
      setServerRuntimeMode('staging');

      const response = await makeRequest('Bearer dev_token_platformSuperAdmin_usr-alpha-super');
      expect(response.status).toBe(401);
      expect(response.body.code).toBe('DEV_TOKEN_NOT_ALLOWED');
    });
  });
});
