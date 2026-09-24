import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createApp } from '../../server/app';
import http from 'http';
import { v1Router } from '../../server/api/v1Router';
import {
  getServerRuntimeMode,
  setServerRuntimeMode,
  assertNoMockPermitted,
  assertRuntimeConfigured,
} from '../../server/runtimeMode';
import { FirestorePlatformService } from '../../server/firestoreService';
import { MOCK_STORES, MOCK_PRODUCTS } from '../commerce/mockData';

describe('Runtime Provenance & Mock Leak Regression Tests', () => {
  const originalEnv = { ...process.env };
  let server: http.Server;
  let baseUrl: string;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    setServerRuntimeMode('demo');
    vi.restoreAllMocks();
  });

  // Setup express server for testing BFF routes
  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1', v1Router);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address() as any;
        baseUrl = `http://localhost:${addr.port}/api/v1`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    setServerRuntimeMode('demo');
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  // =========================================================================
  // 1. Authoritative Runtime Mode Gatekeeper
  // =========================================================================
  describe('1. Runtime Mode Resolution & Gatekeeper', () => {
    it('fails closed to "unknown" when APP_MODE is unset and no live credentials exist', () => {
      delete process.env.APP_MODE;
      delete process.env.DELIVERECT_ENV;
      delete process.env.DELIVERECT_CLIENT_ID;
      delete process.env.DELIVERECT_CLIENT_SECRET;
      setServerRuntimeMode(null);

      expect(getServerRuntimeMode()).toBe('unknown');
      expect(() => assertRuntimeConfigured()).toThrowError(/APP_MODE environment variable is required/);
    });

    it('resolves explicitly to "staging" when APP_MODE=staging', () => {
      setServerRuntimeMode('staging');
      expect(getServerRuntimeMode()).toBe('staging');
      expect(() => assertNoMockPermitted('fetchCatalog')).toThrowError(/strictly forbidden in runtime mode "staging"/);
    });

    it('resolves explicitly to "production" when APP_MODE=production', () => {
      setServerRuntimeMode('production');
      expect(getServerRuntimeMode()).toBe('production');
      expect(() => assertNoMockPermitted('fetchCatalog')).toThrowError(/strictly forbidden in runtime mode "production"/);
    });

    it('only permits mock operations when APP_MODE=demo', () => {
      setServerRuntimeMode('demo');
      expect(getServerRuntimeMode()).toBe('demo');
      expect(() => assertNoMockPermitted('fetchCatalog')).not.toThrow();
    });

    it('GET /api/v1/platform/mode reports allowMockFallback=false in staging mode', async () => {
      setServerRuntimeMode('staging');
      const res = await fetch(`${baseUrl}/platform/mode`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.appMode).toBe('staging');
      expect(data.isStaging).toBe(true);
      expect(data.isDemo).toBe(false);
      expect(data.allowMockFallback).toBe(false);
    });

    it('GET /api/v1/platform/mode reports allowMockFallback=false in production mode', async () => {
      setServerRuntimeMode('production');
      const res = await fetch(`${baseUrl}/platform/mode`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.appMode).toBe('production');
      expect(data.isProduction).toBe(true);
      expect(data.isDemo).toBe(false);
      expect(data.allowMockFallback).toBe(false);
    });

    it('GET /api/v1/platform/mode reports allowMockFallback=false when unknown', async () => {
      delete process.env.DELIVERECT_CLIENT_ID;
      delete process.env.DELIVERECT_CLIENT_SECRET;
      delete process.env.DELIVERECT_ENV;
      setServerRuntimeMode('unknown');
      const res = await fetch(`${baseUrl}/platform/mode`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.appMode).toBe('unknown');
      expect(data.allowMockFallback).toBe(false);
    });
  });

  // =========================================================================
  // 2. Tenant Resolution Fail-Closed Behavior
  // =========================================================================
  describe('2. Tenant Resolution Fail-Closed in Live Modes', () => {
    it('throws 404 TENANT_NOT_FOUND when non-existent tenant is queried in staging mode', async () => {
      setServerRuntimeMode('staging');
      await expect(
        FirestorePlatformService.getTenantConfig('non-existent-tenant-xyz')
      ).rejects.toMatchObject({
        code: 'TENANT_NOT_FOUND',
        statusCode: 404,
      });
    });

    it('throws 404 TENANT_NOT_FOUND when non-existent tenant is queried in production mode', async () => {
      setServerRuntimeMode('production');
      await expect(
        FirestorePlatformService.getTenantConfig('unknown-brand-999')
      ).rejects.toMatchObject({
        code: 'TENANT_NOT_FOUND',
        statusCode: 404,
      });
    });

    it('GET /api/v1/bootstrap returns 404 for an unknown public host in staging mode', async () => {
      setServerRuntimeMode('staging');
      const app = await createApp({ serveFrontend: false, initializeDependencies: false });

      const res = await request(app)
        .get('/api/v1/bootstrap?tenantId=unconfigured-tenant-abc')
        .set('Host', 'unknown-tenant.example.test')
        .set('X-Tenant-ID', 'unconfigured-tenant-abc')
        .set('X-Test-Simulate-Public', 'true')
        .expect(404);

      expect(res.body.code).toBe('TENANT_NOT_FOUND');
    });
  });

  // =========================================================================
  // 3. Store Discovery & Catalog Mock Leak Prevention
  // =========================================================================
  describe('3. Store Discovery & Catalog Mock Leak Prevention in Staging', () => {
    it('POST /api/v1/stores/search does not return mock stores in staging mode when integration is unconfigured', async () => {
      setServerRuntimeMode('staging');
      delete process.env.DELIVERECT_CLIENT_ID;
      delete process.env.DELIVERECT_CLIENT_SECRET;

      const res = await fetch(`${baseUrl}/stores/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': 'brand-alpha',
        },
        body: JSON.stringify({
          coordinates: {
            latitude: 51.7356,
            longitude: 0.4685,
          },
        }),
      });

      // In staging without credentials, it must fail closed (503 INTEGRATION_NOT_CONFIGURED)
      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data.code).toBe('INTEGRATION_NOT_CONFIGURED');

      // Verify no mock store data leaked in response
      const responseString = JSON.stringify(data);
      for (const store of MOCK_STORES) {
        expect(responseString).not.toContain(store.id);
        expect(responseString).not.toContain(store.name);
      }
    });

    it('GET /api/v1/catalog does not return mock products in staging mode when integration is unconfigured', async () => {
      setServerRuntimeMode('staging');
      delete process.env.DELIVERECT_CLIENT_ID;
      delete process.env.DELIVERECT_CLIENT_SECRET;

      const res = await fetch(`${baseUrl}/catalog`, {
        headers: { 'x-tenant-id': 'brand-alpha' },
      });

      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data.code).toBe('INTEGRATION_NOT_CONFIGURED');

      // Verify fixture PLUs are not leaked
      const responseString = JSON.stringify(data);
      expect(responseString).not.toContain('PLU-SND-001');
      expect(responseString).not.toContain('PLU-BAK-001');
      expect(responseString).not.toContain('PLU_BREAD');
      expect(responseString).not.toContain('PLU_MILK');
    });

    it('GET /api/v1/stores/:id/catalog does not return mock items in staging mode', async () => {
      setServerRuntimeMode('staging');
      delete process.env.DELIVERECT_CLIENT_ID;
      delete process.env.DELIVERECT_CLIENT_SECRET;

      const res = await fetch(`${baseUrl}/stores/store-chelmsford-high/catalog`, {
        headers: { 'x-tenant-id': 'brand-alpha' },
      });

      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data.code).toBe('INTEGRATION_NOT_CONFIGURED');

      const responseString = JSON.stringify(data);
      expect(responseString).not.toContain('Artisan Sourdough');
      expect(responseString).not.toContain('Woodfired Margherita');
    });
  });

  // =========================================================================
  // 4. Hero Banners, Stories & Policies Provenance
  // =========================================================================
  describe('4. Hero Banners, Stories & Policies Provenance in Staging', () => {
    it('getTenantHeroBanners returns empty array [] in staging mode for an unconfigured tenant', async () => {
      setServerRuntimeMode('staging');
      const banners = await FirestorePlatformService.getTenantHeroBanners('unconfigured-tenant-999');
      // Must return [] and not mock banners
      expect(banners).toEqual([]);
    });

    it('getTenantHeroBanners in staging mode does not leak mock banners into brand-alpha', async () => {
      setServerRuntimeMode('staging');
      const banners = await FirestorePlatformService.getTenantHeroBanners('brand-alpha');
      const bannerString = JSON.stringify(banners);
      expect(bannerString).not.toContain('Fresh Groceries Delivered in Minutes');
      expect(bannerString).not.toContain('banner-home-courier');
    });

    it('getTenantStories returns empty array [] in staging mode for an unconfigured tenant', async () => {
      setServerRuntimeMode('staging');
      const stories = await FirestorePlatformService.getTenantStories('unconfigured-tenant-999');
      expect(stories).toEqual([]);
    });

    it('getTenantStories in staging mode does not leak mock stories into brand-alpha', async () => {
      setServerRuntimeMode('staging');
      const stories = await FirestorePlatformService.getTenantStories('brand-alpha');
      const storyString = JSON.stringify(stories);
      expect(storyString).not.toContain('story-bakery-morning');
    });

    it('getTenantFeePolicy throws error in staging mode if no Firestore policy exists', async () => {
      setServerRuntimeMode('staging');
      await expect(
        FirestorePlatformService.getTenantFeePolicy('unconfigured-tenant-999')
      ).rejects.toMatchObject({
        statusCode: expect.any(Number),
      });
    });
  });
});
