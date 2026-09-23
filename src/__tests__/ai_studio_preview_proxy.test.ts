import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  isAiStudioPreviewHost,
  resolvePreviewBffBaseUrl,
} from '../../server/aiStudioPreviewProxy';

describe('AI Studio preview BFF proxy', () => {
  it('detects AI Studio managed preview hosts without treating every Cloud Run host as preview', () => {
    expect(
      isAiStudioPreviewHost(
        'ais-dev-ciigtiumqqu7x57kplguwi-232948319569.europe-west3.run.app'
      )
    ).toBe(true);
    expect(isAiStudioPreviewHost('preview.ai.studio')).toBe(false);
    expect(isAiStudioPreviewHost('retail-storefront-delivery-platform-abc.europe-west3.run.app')).toBe(false);
    // Published AI Studio hosts are stable backends, not ephemeral preview sandboxes.
    expect(isAiStudioPreviewHost('1bwydi.ai.studio')).toBe(false);
  });

  it('accepts only a secure configured published backend outside tests', () => {
    expect(resolvePreviewBffBaseUrl({ PREVIEW_BFF_URL: 'https://published.example.com/' } as any))
      .toBe('https://published.example.com');
    expect(resolvePreviewBffBaseUrl({ PREVIEW_BFF_URL: 'not-a-url' } as any)).toBeNull();
    expect(resolvePreviewBffBaseUrl({ PREVIEW_BFF_URL: 'http://published.example.com' } as any)).toBeNull();
  });

  it('is mounted before the local v1 router so preview avoids sandbox Firestore IAM', () => {
    const serverSource = fs.readFileSync(path.resolve(process.cwd(), 'server.ts'), 'utf8');
    const proxyIndex = serverSource.indexOf("app.use('/api/v1', aiStudioPreviewBffProxy)");
    const localRouterIndex = serverSource.indexOf("app.use('/api/v1', v1Router)");

    expect(proxyIndex).toBeGreaterThan(-1);
    expect(localRouterIndex).toBeGreaterThan(proxyIndex);
  });

  it('forwards the configured preview tenant for bootstrap before the browser knows it', () => {
    const proxySource = fs.readFileSync(
      path.resolve(process.cwd(), 'server/aiStudioPreviewProxy.ts'),
      'utf8'
    );
    expect(proxySource).toContain("if (!headers['x-tenant-id'] && env.PREVIEW_TENANT_ID)");
    expect(proxySource).toContain("headers['x-tenant-id'] = env.PREVIEW_TENANT_ID.trim()");
  });
});
