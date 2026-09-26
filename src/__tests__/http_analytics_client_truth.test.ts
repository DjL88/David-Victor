import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../commerce/HttpAdminClient', () => ({
  getAdminAuthorizationHeader: vi.fn(async () => 'Bearer test'),
}));

import { HttpAnalyticsClient } from '../analytics/HttpAnalyticsClient';

describe('HttpAnalyticsClient truth on unavailable analytics sources', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects a failed Insights response instead of fabricating zero/healthy metrics', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 503,
    })));

    const client = new HttpAnalyticsClient('tenant_truth');

    await expect(client.getInsights('tenant_truth', '30d')).rejects.toThrow(
      'Insights request failed with status 503',
    );
  });

  it('rejects an Insights network failure instead of returning a synthetic dashboard', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('network unavailable');
    }));

    const client = new HttpAnalyticsClient('tenant_truth');

    await expect(client.getInsights('tenant_truth', '7d')).rejects.toThrow(
      'network unavailable',
    );
  });

  it('rejects a failed telemetry response instead of presenting it as an empty event feed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 401,
    })));

    const client = new HttpAnalyticsClient('tenant_truth');

    await expect(client.getRecentEvents('tenant_truth', 50)).rejects.toThrow(
      'Analytics events request failed with status 401',
    );
  });
});
