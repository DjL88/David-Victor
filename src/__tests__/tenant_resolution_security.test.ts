import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server/app';
import { FirestorePlatformService } from '../../server/firestoreService';
import { setServerRuntimeMode } from '../../server/runtimeMode';

const tenant = (tenantId: string) => ({
  tenantId,
  brandName: tenantId,
  country: 'GB',
  currency: 'GBP',
  currencySymbol: '£',
  locale: 'en-GB',
  primaryColour: '#000000',
  secondaryColour: '#ffffff',
  backgroundColour: '#ffffff',
  textColour: '#111111',
  fontFamily: 'Arial',
  borderRadius: '8px',
  featureFlags: {},
});

describe('TEN-00 public tenant trust boundaries', () => {
  const original = {
    previewTenant: process.env.PREVIEW_TENANT_ID,
    previewSuffixes: process.env.PREVIEW_HOST_SUFFIXES,
    previewToken: process.env.PREVIEW_AUTH_TOKEN,
    edgeSecret: process.env.TRUSTED_EDGE_SECRET,
    edgeHeader: process.env.TRUSTED_EDGE_HEADER,
    appHostingBackendId: process.env.APP_HOSTING_BACKEND_ID,
    appHostingProjectId: process.env.FIREBASE_PROJECT_ID,
    appHostingLocation: process.env.APP_HOSTING_LOCATION,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    setServerRuntimeMode('staging');
    process.env.PREVIEW_TENANT_ID = 'brand-alpha';
    process.env.PREVIEW_HOST_SUFFIXES = 'hosted.app,run.app,web.app,firebaseapp.com,ai.studio';
    delete process.env.PREVIEW_AUTH_TOKEN;
    delete process.env.TRUSTED_EDGE_SECRET;
    delete process.env.TRUSTED_EDGE_HEADER;
    process.env.APP_HOSTING_BACKEND_ID = 'leitch-store-staging';
    process.env.FIREBASE_PROJECT_ID = 'leitch-tech-nonprod';
    process.env.APP_HOSTING_LOCATION = 'europe-west4';

    vi.spyOn(FirestorePlatformService, 'getTenantConfig').mockImplementation(async (id: string) => tenant(id) as any);
    vi.spyOn(FirestorePlatformService, 'getTenantSearchConfig').mockResolvedValue({} as any);
  });

  afterEach(() => {
    const restore = (key: string, value: string | undefined) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    };
    restore('PREVIEW_TENANT_ID', original.previewTenant);
    restore('PREVIEW_HOST_SUFFIXES', original.previewSuffixes);
    restore('PREVIEW_AUTH_TOKEN', original.previewToken);
    restore('TRUSTED_EDGE_SECRET', original.edgeSecret);
    restore('TRUSTED_EDGE_HEADER', original.edgeHeader);
    restore('APP_HOSTING_BACKEND_ID', original.appHostingBackendId);
    restore('FIREBASE_PROJECT_ID', original.appHostingProjectId);
    restore('APP_HOSTING_LOCATION', original.appHostingLocation);
    setServerRuntimeMode(null);
    vi.restoreAllMocks();
  });

  it('pins managed preview hosts to PREVIEW_TENANT_ID despite anonymous header/query overrides', async () => {
    const domainSpy = vi.spyOn(FirestorePlatformService, 'resolveTenantByHostname');

    const app = await createApp({ serveFrontend: false, initializeDependencies: false });
    const response = await request(app)
      .get('/api/v1/bootstrap?tenantId=brand-beta')
      .set('Host', 'x.hosted.app')
      .set('X-Tenant-ID', 'brand-beta')
      .expect(200);

    expect(response.body.tenant.tenantId).toBe('brand-alpha');
    expect(response.headers.vary).toContain('Host');
    expect(domainSpy).not.toHaveBeenCalled();
  });

  it('does not trust X-Forwarded-Host without the configured edge proof', async () => {
    vi.spyOn(FirestorePlatformService, 'resolveTenantByHostname').mockResolvedValue(null);

    const app = await createApp({ serveFrontend: false, initializeDependencies: false });
    const response = await request(app)
      .get('/api/v1/bootstrap')
      .set('Host', 'unknown.example.test')
      .set('X-Forwarded-Host', 'x.hosted.app')
      .expect(404);

    expect(response.body.code).toBe('TENANT_NOT_FOUND');
    expect(FirestorePlatformService.resolveTenantByHostname).toHaveBeenCalledWith('unknown.example.test');
  });

  it('resolves an active custom domain forwarded by this exact Firebase App Hosting origin', async () => {
    vi.spyOn(FirestorePlatformService, 'resolveTenantByHostname').mockImplementation(async (host: string) =>
      host === 'test1.leitch.shop' ? 'test1' : null
    );

    const app = await createApp({ serveFrontend: false, initializeDependencies: false });
    const response = await request(app)
      .get('/api/v1/bootstrap')
      .set('Host', 'leitch-store-staging--leitch-tech-nonprod.europe-west4.hosted.app')
      .set('X-Forwarded-Host', 'test1.leitch.shop')
      .expect(200);

    expect(response.body.tenant.tenantId).toBe('test1');
    expect(response.headers.vary).toContain('X-Forwarded-Host');
  });

  it('ignores an unregistered custom hostname forwarded to the App Hosting origin', async () => {
    vi.spyOn(FirestorePlatformService, 'resolveTenantByHostname').mockResolvedValue(null);

    const app = await createApp({ serveFrontend: false, initializeDependencies: false });
    const response = await request(app)
      .get('/api/v1/bootstrap')
      .set('Host', 'leitch-store-staging--leitch-tech-nonprod.europe-west4.hosted.app')
      .set('X-Forwarded-Host', 'unclaimed.example.test')
      .expect(200);

    expect(response.body.tenant.tenantId).toBe('brand-alpha');
  });

  it('resolves an active storefront hostname supplied by the App Hosting SPA and disables shared caching', async () => {
    vi.spyOn(FirestorePlatformService, 'resolveTenantByHostname').mockImplementation(async (host: string) =>
      host === 'test1.leitch.shop' ? 'test1' : null
    );

    const app = await createApp({ serveFrontend: false, initializeDependencies: false });
    const response = await request(app)
      .get('/api/v1/bootstrap')
      .set('Host', 'leitch-store-staging--leitch-tech-nonprod.europe-west4.hosted.app')
      .set('X-Storefront-Host', 'test1.leitch.shop')
      .expect(200);

    expect(response.body.tenant.tenantId).toBe('test1');
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.headers.vary).toContain('X-Storefront-Host');
  });

  it('honours X-Forwarded-Host only when the edge secret matches', async () => {
    process.env.TRUSTED_EDGE_SECRET = 'edge-secret';
    vi.spyOn(FirestorePlatformService, 'resolveTenantByHostname').mockImplementation(async (host: string) =>
      host === 'shop.brand.test' ? 'brand-beta' : null
    );

    const app = await createApp({ serveFrontend: false, initializeDependencies: false });
    const response = await request(app)
      .get('/api/v1/bootstrap')
      .set('Host', 'internal.run.invalid')
      .set('X-Forwarded-Host', 'shop.brand.test')
      .set('X-Bwydi-Edge-Secret', 'edge-secret')
      .expect(200);

    expect(response.body.tenant.tenantId).toBe('brand-beta');
  });

  it('does not classify suffix lookalikes such as run.app.evil.tld as managed preview hosts', async () => {
    vi.spyOn(FirestorePlatformService, 'resolveTenantByHostname').mockResolvedValue(null);

    const app = await createApp({ serveFrontend: false, initializeDependencies: false });
    const response = await request(app)
      .get('/api/v1/bootstrap')
      .set('Host', 'run.app.evil.tld')
      .expect(404);

    expect(response.body.code).toBe('TENANT_NOT_FOUND');
  });

  it('allows an explicit preview-token override on a non-preview host and disables public caching', async () => {
    process.env.PREVIEW_AUTH_TOKEN = 'preview-secret';

    const app = await createApp({ serveFrontend: false, initializeDependencies: false });
    const response = await request(app)
      .get('/api/v1/bootstrap?tenantId=brand-beta')
      .set('Host', 'preview-control.example.test')
      .set('X-Preview-Auth-Token', 'preview-secret')
      .expect(200);

    expect(response.body.tenant.tenantId).toBe('brand-beta');
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.headers.vary).toContain('Host');
  });
});
