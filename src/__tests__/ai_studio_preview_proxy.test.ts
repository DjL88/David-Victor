import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import {
  isAiStudioPreviewHost,
  resolvePreviewBffBaseUrl,
} from '../../server/aiStudioPreviewProxy';
import { createApp } from '../../server/app';

describe('AI Studio preview BFF proxy', () => {
  const originalPreviewBffUrl = process.env.PREVIEW_BFF_URL;
  const originalPreviewTenantId = process.env.PREVIEW_TENANT_ID;

  afterEach(() => {
    if (originalPreviewBffUrl === undefined) delete process.env.PREVIEW_BFF_URL;
    else process.env.PREVIEW_BFF_URL = originalPreviewBffUrl;
    if (originalPreviewTenantId === undefined) delete process.env.PREVIEW_TENANT_ID;
    else process.env.PREVIEW_TENANT_ID = originalPreviewTenantId;
    vi.restoreAllMocks();
  });

  it('detects AI Studio managed preview hosts without treating every Cloud Run host as preview', () => {
    expect(
      isAiStudioPreviewHost(
        'ais-dev-ciigtiumqqu7x57kplguwi-232948319569.europe-west3.run.app'
      )
    ).toBe(true);
    expect(isAiStudioPreviewHost('preview.ai.studio')).toBe(false);
    expect(isAiStudioPreviewHost('retail-storefront-delivery-platform-abc.europe-west3.run.app')).toBe(false);
    expect(isAiStudioPreviewHost('1bwydi.ai.studio')).toBe(false);
  });

  it('accepts only a secure configured published backend outside tests', () => {
    expect(resolvePreviewBffBaseUrl({ PREVIEW_BFF_URL: 'https://published.example.com/' } as any))
      .toBe('https://published.example.com');
    expect(resolvePreviewBffBaseUrl({ PREVIEW_BFF_URL: 'not-a-url' } as any)).toBeNull();
    expect(resolvePreviewBffBaseUrl({ PREVIEW_BFF_URL: 'http://published.example.com' } as any)).toBeNull();
  });

  it('proxies preview traffic before the local router and supplies the configured preview tenant', async () => {
    process.env.PREVIEW_BFF_URL = 'https://published.example.com';
    process.env.PREVIEW_TENANT_ID = 'brand-preview';

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ proxied: true }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'x-request-id': 'upstream-request',
        },
      })
    );

    const app = await createApp({ serveFrontend: false, initializeDependencies: false });
    const response = await request(app)
      .get('/api/v1/bootstrap')
      .set('X-Forwarded-Host', 'ais-dev-example.europe-west3.run.app')
      .expect(200);

    expect(response.body).toEqual({ proxied: true });
    expect(response.headers['x-bwydi-preview-backend']).toBe('published.example.com');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [target, init] = fetchMock.mock.calls[0];
    expect(String(target)).toBe('https://published.example.com/api/v1/bootstrap');
    expect((init?.headers as Record<string, string>)['x-tenant-id']).toBe('brand-preview');
    expect((init?.headers as Record<string, string>)['x-bwydi-preview-proxy']).toBe('ai-studio');
  });
});
