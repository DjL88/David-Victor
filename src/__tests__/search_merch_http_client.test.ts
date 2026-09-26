import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpAdminClient } from '../commerce/HttpAdminClient';
import { setRuntimeMode } from '../domain/runtime';

describe('HttpAdminClient search merchandising transport', () => {
  beforeEach(() => {
    setRuntimeMode('DEMO');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    setRuntimeMode('UNKNOWN');
  });

  it('preserves a successful null response so a tenant with no saved config can start cleanly', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: vi.fn().mockResolvedValue(null),
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new HttpAdminClient('tenant-new');
    await expect(client.getSearchConfig('tenant-new')).resolves.toBeNull();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/admin/tenants/tenant-new/search-config',
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Tenant-ID': 'tenant-new' }),
      }),
    );
  });

  it('throws for an unsuccessful response instead of presenting a request failure as an empty config', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        json: vi.fn().mockResolvedValue({ error: 'Search configuration is temporarily unavailable.' }),
      }),
    );

    const client = new HttpAdminClient('tenant-alpha');

    await expect(client.getSearchConfig('tenant-alpha')).rejects.toThrow(
      'Search configuration is temporarily unavailable.',
    );
  });
});
