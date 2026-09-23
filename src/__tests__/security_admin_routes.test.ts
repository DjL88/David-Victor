import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import http from 'http';
import { AddressInfo } from 'net';
import { v1Router } from '../../server/api/v1Router';
import { setServerRuntimeMode } from '../../server/runtimeMode';
import { setRuntimeMode } from '../domain/runtime';
import { LinkedAccountsAdapter } from '../../server/deliverect/LinkedAccountsAdapter';
import { FirestorePlatformService } from '../../server/firestoreService';
import { setMockAdminAuthForTest } from '../../server/firebase';

describe('Admin Security Hardening & Provisioning Fail-Closed Tests', () => {
  let app: express.Application;
  let server: http.Server;
  let baseUrl: string;
  const originalAppMode = process.env.APP_MODE;

  beforeEach(async () => {
    vi.restoreAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/v1', v1Router);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}/api/v1`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    process.env.APP_MODE = originalAppMode;
    setServerRuntimeMode((originalAppMode as any) || 'demo');
    setRuntimeMode('UNKNOWN');
    setMockAdminAuthForTest(null);
    vi.restoreAllMocks();
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  describe('1. Cache Reset Hardening (/api/v1/cache/reset)', () => {
    it('rejects unauthenticated requests with 401', async () => {
      setServerRuntimeMode('demo');
      const res = await fetch(`${baseUrl}/cache/reset`, { method: 'POST' });
      expect(res.status).toBe(401);
    });

    it('rejects tenantAdmin user with 403 FORBIDDEN_SUPERADMIN_ONLY', async () => {
      setServerRuntimeMode('demo');
      const res = await fetch(`${baseUrl}/cache/reset`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer dev_token_tenantAdmin_user123',
          'X-Tenant-ID': 'brand-alpha',
        },
      });
      
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.code).toBe('FORBIDDEN_SUPERADMIN_ONLY');
    });

    it('allows platformSuperAdmin user to reset cache', async () => {
      setServerRuntimeMode('demo');
      const res = await fetch(`${baseUrl}/cache/reset`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer dev_token_platformSuperAdmin_super123',
          'X-Tenant-ID': 'brand-alpha',
        },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });

  describe('2. Confirm Demo Checkout Hardening (/api/v1/checkouts/:checkoutId/confirm-demo)', () => {
    it('returns 403 FEATURE_DISABLED_IN_ENVIRONMENT in staging runtime', async () => {
      setServerRuntimeMode('staging');
      setMockAdminAuthForTest({
        verifyIdToken: vi.fn().mockResolvedValue({
          uid: 'tenant-admin-1',
          email: 'admin@brand-alpha.com',
          role: 'tenantAdmin',
          tenantId: 'brand-alpha',
        }),
      } as any);

      vi.spyOn(FirestorePlatformService, 'getCheckoutProjection').mockResolvedValue({
        checkoutId: 'chk_123',
        orderId: 'ord_123',
      } as any);

      const res = await fetch(`${baseUrl}/checkouts/chk_123/confirm-demo`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer real-jwt-token',
          'X-Tenant-ID': 'brand-alpha',
        },
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.code).toBe('FEATURE_DISABLED_IN_ENVIRONMENT');
    });

    it('returns 403 FEATURE_DISABLED_IN_ENVIRONMENT in production runtime', async () => {
      setServerRuntimeMode('production');
      setMockAdminAuthForTest({
        verifyIdToken: vi.fn().mockResolvedValue({
          uid: 'tenant-admin-1',
          email: 'admin@brand-alpha.com',
          role: 'tenantAdmin',
          tenantId: 'brand-alpha',
        }),
      } as any);

      const res = await fetch(`${baseUrl}/checkouts/chk_123/confirm-demo`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer real-jwt-token',
          'X-Tenant-ID': 'brand-alpha',
        },
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.code).toBe('FEATURE_DISABLED_IN_ENVIRONMENT');
    });
  });

  describe('3. Account Selection & Store Provisioning Fail-Closed (/api/v1/admin/tenants/:id/integration/select-account)', () => {
    it('requires platformSuperAdmin role and rejects tenantAdmin with 403 FORBIDDEN_SUPERADMIN_ONLY', async () => {
      setServerRuntimeMode('staging');
      setMockAdminAuthForTest({
        verifyIdToken: vi.fn().mockResolvedValue({
          uid: 'tenant-admin-1',
          email: 'admin@brand-alpha.com',
          role: 'tenantAdmin',
          tenantId: 'brand-alpha',
          platformSuperAdmin: false,
        }),
      } as any);

      const res = await fetch(`${baseUrl}/admin/tenants/brand-alpha/integration/select-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer real-jwt-token',
          'X-Tenant-ID': 'brand-alpha',
        },
        body: JSON.stringify({ accountId: 'acc_123' }),
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.code).toBe('FORBIDDEN_SUPERADMIN_ONLY');
    });

    it('fails closed in staging when account discovery fails or returns empty set', async () => {
      setServerRuntimeMode('staging');
      setMockAdminAuthForTest({
        verifyIdToken: vi.fn().mockResolvedValue({
          uid: 'super-admin-1',
          email: 'super@bwydi.com',
          role: 'platformSuperAdmin',
          platformSuperAdmin: true,
        }),
      } as any);

      vi.spyOn(LinkedAccountsAdapter.prototype, 'getTenantMappings').mockRejectedValue(
        new Error('Deliverect API 502 Bad Gateway')
      );

      const res = await fetch(`${baseUrl}/admin/tenants/brand-alpha/integration/select-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer real-jwt-token',
          'X-Tenant-ID': 'brand-alpha',
        },
        body: JSON.stringify({ accountId: 'acc_123' }),
      });

      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data.code).toBe('DELIVERECT_DISCOVERY_FAILED');
    });

    it('rejects accountId that is not in discovered accounts in staging mode', async () => {
      setServerRuntimeMode('staging');
      setMockAdminAuthForTest({
        verifyIdToken: vi.fn().mockResolvedValue({
          uid: 'super-admin-1',
          email: 'super@bwydi.com',
          role: 'platformSuperAdmin',
          platformSuperAdmin: true,
        }),
      } as any);

      vi.spyOn(LinkedAccountsAdapter.prototype, 'getTenantMappings').mockResolvedValue({
        accounts: [
          { deliverectAccountId: 'acc_real_999', accountLinkId: 'acclink_acc_real_999', displayName: 'Real Account' },
        ],
        stores: [],
      } as any);

      const res = await fetch(`${baseUrl}/admin/tenants/brand-alpha/integration/select-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer real-jwt-token',
          'X-Tenant-ID': 'brand-alpha',
        },
        body: JSON.stringify({ accountId: 'acc_fake_000' }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.code).toBe('UNKNOWN_DELIVERECT_ACCOUNT');
    });

    it('orphans requested channelLinkIds that Deliverect no longer returns instead of failing the account connection', async () => {
      setServerRuntimeMode('staging');
      setMockAdminAuthForTest({
        verifyIdToken: vi.fn().mockResolvedValue({
          uid: 'super-admin-1',
          email: 'super@bwydi.com',
          role: 'platformSuperAdmin',
          platformSuperAdmin: true,
        }),
      } as any);

      vi.spyOn(LinkedAccountsAdapter.prototype, 'getTenantMappings').mockResolvedValue({
        accounts: [
          { deliverectAccountId: 'acc_123', accountLinkId: 'acclink_acc_123', displayName: 'Account 123' },
        ],
        stores: [
          { channelLinkId: 'chn_store_1', accountLinkId: 'acclink_acc_123', name: 'Store 1' },
        ],
      } as any);
      const orphanSpy = vi.spyOn(FirestorePlatformService, 'markTenantStoreOrphaned').mockResolvedValue({} as any);
      vi.spyOn(FirestorePlatformService, 'updateIntegrationConfig').mockResolvedValue({} as any);
      vi.spyOn(FirestorePlatformService, 'addAuditLog').mockResolvedValue({} as any);

      const res = await fetch(`${baseUrl}/admin/tenants/brand-alpha/integration/select-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer real-jwt-token',
          'X-Tenant-ID': 'brand-alpha',
        },
        body: JSON.stringify({
          accountId: 'acc_123',
          channelLinkIds: ['chn_store_1', 'chn_deleted_99'],
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.allowedChannelLinkIds).toEqual(['chn_store_1']);
      expect(data.orphanedChannelLinkIds).toEqual(['chn_deleted_99']);
      expect(data.storesCount).toBe(1);
      expect(orphanSpy).toHaveBeenCalledWith(
        'brand-alpha',
        'chn_deleted_99',
        'CHANNEL_LINK_NOT_RETURNED_FOR_SELECTED_ACCOUNT'
      );
    });
  });

  describe('3b. Local location hard-delete', () => {
    it('allows a platformSuperAdmin to hard-delete the local projection without calling Deliverect', async () => {
      setServerRuntimeMode('staging');
      setMockAdminAuthForTest({
        verifyIdToken: vi.fn().mockResolvedValue({
          uid: 'super-admin-1',
          email: 'super@bwydi.com',
          role: 'platformSuperAdmin',
          platformSuperAdmin: true,
        }),
      } as any);

      const deleteSpy = vi.spyOn(FirestorePlatformService, 'deleteTenantStore').mockResolvedValue(true);
      vi.spyOn(FirestorePlatformService, 'addAuditLog').mockResolvedValue({} as any);

      const res = await fetch(`${baseUrl}/admin/tenants/brand-alpha/stores/chn_old_1`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer real-jwt-token',
          'X-Tenant-ID': 'brand-alpha',
        },
      });

      expect(res.status).toBe(200);
      expect(deleteSpy).toHaveBeenCalledWith('brand-alpha', 'chn_old_1');
    });
  });

  describe('4. Place Test Order Route (/api/v1/admin/tenants/:id/integration/test-order)', () => {
    it('requires platformSuperAdmin role', async () => {
      setServerRuntimeMode('staging');
      setMockAdminAuthForTest({
        verifyIdToken: vi.fn().mockResolvedValue({
          uid: 'tenant-admin-1',
          email: 'admin@brand-alpha.com',
          role: 'tenantAdmin',
          tenantId: 'brand-alpha',
          platformSuperAdmin: false,
        }),
      } as any);

      const res = await fetch(`${baseUrl}/admin/tenants/brand-alpha/integration/test-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer real-jwt-token',
          'X-Tenant-ID': 'brand-alpha',
        },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(403);
    });

    it('rejects when tenant has no mapped Deliverect account ID', async () => {
      setServerRuntimeMode('staging');
      setMockAdminAuthForTest({
        verifyIdToken: vi.fn().mockResolvedValue({
          uid: 'super-admin-1',
          email: 'super@bwydi.com',
          role: 'platformSuperAdmin',
          platformSuperAdmin: true,
        }),
      } as any);

      vi.spyOn(FirestorePlatformService, 'getIntegrationConfig').mockResolvedValue({
        deliverectAccountId: '',
      } as any);

      const res = await fetch(`${baseUrl}/admin/tenants/brand-alpha/integration/test-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer real-jwt-token',
          'X-Tenant-ID': 'brand-alpha',
        },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.code).toBe('ACCOUNT_REQUIRED');
    });
  });
});
