import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server/app';
import { AssetService } from '../../server/assetService';
import { setMockAdminAuthForTest } from '../../server/firebase';
import { setServerRuntimeMode } from '../../server/runtimeMode';
import { installMockFirebaseAdminToken } from './helpers/firebaseAuthHarness';

const bucket = 'hi-domino-d0abb.firebasestorage.app';
const mediaUrl = (objectPath: string, selectedBucket = bucket) =>
  `https://firebasestorage.googleapis.com/v0/b/${selectedBucket}/o/${encodeURIComponent(objectPath)}?alt=media&token=test`;

describe('SEC-01 media and private asset boundaries', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setServerRuntimeMode('demo');
  });

  afterEach(() => {
    setMockAdminAuthForTest(null);
    setServerRuntimeMode(null);
    vi.restoreAllMocks();
  });

  it('rejects a Firebase Storage URL from a foreign bucket before fetching upstream', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const app = await createApp({ serveFrontend: false, initializeDependencies: false });

    const response = await request(app)
      .get('/media/firebase')
      .query({ url: mediaUrl('tenant-assets-public/tenants/brand-alpha/story.png', 'evil.firebasestorage.app') })
      .expect(400);

    expect(response.body.code).toBe('MEDIA_BUCKET_NOT_PERMITTED');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects shared-bucket objects outside the David-Victor public tenant prefix', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const app = await createApp({ serveFrontend: false, initializeDependencies: false });

    const response = await request(app)
      .get('/media/firebase')
      .query({ url: mediaUrl('photos_pawtraits/attacker.svg') })
      .expect(400);

    expect(response.body.code).toBe('MEDIA_PATH_NOT_PERMITTED');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('never re-serves SVG or other active content on the application origin', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<svg xmlns="http://www.w3.org/2000/svg"></svg>', {
        status: 200,
        headers: {
          'content-type': 'image/svg+xml',
          'content-length': '46',
        },
      })
    );
    const app = await createApp({ serveFrontend: false, initializeDependencies: false });

    const response = await request(app)
      .get('/media/firebase')
      .query({ url: mediaUrl('tenant-assets-public/tenants/brand-alpha/logo.svg') })
      .expect(415);

    expect(response.body.code).toBe('MEDIA_TYPE_NOT_PERMITTED');
  });

  it('streams permitted media with sandbox and nosniff headers', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x01, 0x02]), {
        status: 200,
        headers: {
          'content-type': 'image/png',
          'content-length': '6',
          etag: '"asset-etag"',
        },
      })
    );
    const app = await createApp({ serveFrontend: false, initializeDependencies: false });

    const response = await request(app)
      .get('/media/firebase')
      .query({ url: mediaUrl('tenant-assets-public/tenants/brand-alpha/story.png') })
      .expect(200);

    expect(response.headers['content-type']).toContain('image/png');
    expect(response.headers['content-security-policy']).toBe("sandbox; default-src 'none'");
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['content-disposition']).toBe('inline');
  });

  it('rejects media declared larger than 50 MB without buffering it', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
        status: 200,
        headers: {
          'content-type': 'image/png',
          'content-length': String(50 * 1024 * 1024 + 1),
        },
      })
    );
    const app = await createApp({ serveFrontend: false, initializeDependencies: false });

    const response = await request(app)
      .get('/media/firebase')
      .query({ url: mediaUrl('tenant-assets-public/tenants/brand-alpha/too-large.png') })
      .expect(413);

    expect(response.body.code).toBe('MEDIA_TOO_LARGE');
  });

  it('returns private brand guidelines as 404 publicly but permits authenticated admin download', async () => {
    const asset = {
      id: 'ast_private',
      tenantId: 'brand-alpha',
      type: 'BRAND_GUIDELINES',
      fileName: 'brand-guidelines.svg',
      storagePath: 'tenant-assets-private/tenants/brand-alpha/brand-guidelines/ast_private.svg',
      publicUrl: '',
      contentType: 'image/svg+xml',
      byteSize: 32,
      status: 'READY',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any;
    vi.spyOn(AssetService, 'getAsset').mockResolvedValue(asset);
    vi.spyOn(AssetService, 'getAssetBinary').mockResolvedValue(Buffer.from('<svg></svg>'));

    const app = await createApp({ serveFrontend: false, initializeDependencies: false });

    await request(app)
      .get('/api/v1/assets/brand-alpha/ast_private')
      .set('Host', 'localhost')
      .expect(404);

    const { token } = installMockFirebaseAdminToken();
    const privateResponse = await request(app)
      .get('/api/v1/admin/assets/brand-alpha/ast_private/file')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-ID', 'brand-alpha')
      .expect(200);

    expect(privateResponse.headers['cache-control']).toBe('private, no-store');
    expect(privateResponse.headers['content-disposition']).toContain('attachment');
    expect(privateResponse.headers['content-security-policy']).toBe("sandbox; default-src 'none'");
  });

  it('rejects SVG event-handler bypasses such as onbegin through the real admin upload route', async () => {
    const { token } = installMockFirebaseAdminToken();
    const app = await createApp({ serveFrontend: false, initializeDependencies: false });
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><animate onbegin="alert(1)" /></svg>';

    const response = await request(app)
      .post('/api/v1/admin/assets/upload')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-ID', 'brand-alpha')
      .send({
        tenantId: 'brand-alpha',
        type: 'LOGO',
        fileName: 'unsafe.svg',
        fileData: Buffer.from(svg).toString('base64'),
        contentType: 'image/svg+xml',
        byteSize: Buffer.byteLength(svg),
      })
      .expect(400);

    expect(response.body.code).toBe('VALIDATION_ERROR');
  });
});
