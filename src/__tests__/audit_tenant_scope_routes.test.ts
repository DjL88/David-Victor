import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import http from 'http';
import { AddressInfo } from 'net';
import { v1Router } from '../../server/api/v1Router';
import { setServerRuntimeMode } from '../../server/runtimeMode';
import { setMockAdminAuthForTest } from '../../server/firebase';
import { FirestorePlatformService } from '../../server/firestoreService';

describe('audit P0 tenant-scope routes', () => {
  let server: http.Server;
  let baseUrl = '';

  beforeEach(async () => {
    vi.restoreAllMocks();
    process.env.APP_MODE = 'staging';
    setServerRuntimeMode('staging');

    const app = express();
    app.use(express.json());
    app.use('/api/v1', v1Router);
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    setMockAdminAuthForTest(null);
    setServerRuntimeMode(null);
    delete process.env.APP_MODE;
    vi.restoreAllMocks();
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('authenticates a platform admin without inventing a retailer tenant', async () => {
    const verifyIdToken = vi.fn().mockResolvedValue({
      uid: 'platform-1',
      email: 'platform@example.test',
      email_verified: true,
      role: 'platformSuperAdmin',
      platformSuperAdmin: true,
    });
    setMockAdminAuthForTest({ verifyIdToken } as any);

    const res = await fetch(`${baseUrl}/admin/auth/me`, {
      headers: { Authorization: 'Bearer real-token' },
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      role: 'platformSuperAdmin',
      tenantId: 'platform',
    });
    expect(body.tenantId).not.toBe('brand-alpha');
    expect(verifyIdToken).toHaveBeenCalled();
  });

  it('does not expose settlement metadata for an order owned by another tenant', async () => {
    setMockAdminAuthForTest({
      verifyIdToken: vi.fn().mockResolvedValue({
        uid: 'ops-a',
        email: 'ops-a@example.test',
        email_verified: true,
        role: 'operationsEditor',
        tenantId: 'tenant-a',
      }),
    } as any);

    vi.spyOn(FirestorePlatformService, 'getOrderProjection').mockResolvedValue({
      orderId: 'order-b',
      tenantId: 'tenant-b',
      paymentId: 'pay-sensitive-b',
      paymentState: 'CAPTURED',
      authorizedMaximum: 5000,
      capturedAmount: 4500,
      total: 5000,
      itemsCount: 1,
      fulfillmentType: 'delivery',
      status: 'DELIVERED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);

    const res = await fetch(`${baseUrl}/orders/order-b/settlement`, {
      headers: {
        Authorization: 'Bearer real-token',
        'X-Tenant-ID': 'tenant-a',
      },
    });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toMatchObject({ code: 'ORDER_NOT_FOUND' });
    expect(body).not.toHaveProperty('paymentId');
    expect(JSON.stringify(body)).not.toContain('pay-sensitive-b');
  });
});
