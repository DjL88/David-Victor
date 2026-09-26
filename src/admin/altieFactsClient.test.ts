import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyAltieFactsState } from '../altie/knowledgeFacts';

const credentials = vi.hoisted(() => ({ headers: vi.fn() }));
vi.mock('../commerce/HttpAdminClient', () => ({ defaultAdminClient: { getHeadersAsync: credentials.headers } }));
import { HttpAltieFactsClient } from './altieFactsClient';

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => {
  vi.clearAllMocks();
  credentials.headers.mockResolvedValue({ Authorization: 'Bearer synthetic-session', 'X-Tenant-ID': 'brand-a', 'X-Firebase-AppCheck': 'synthetic-appcheck', 'Content-Type': 'application/json' });
});

describe('Altie facts authenticated HTTP client', () => {
  it('reuses Admin auth and App Check while pinning this library to platform scope', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ scope: 'PLATFORM', state: emptyAltieFactsState(), builtIn: [], builtInVersion: 'test' }));
    await new HttpAltieFactsClient(fetcher).load();
    expect(fetcher).toHaveBeenCalledWith('/api/v1/admin/altie-facts', expect.objectContaining({
      method: 'GET', cache: 'no-store', headers: expect.objectContaining({ Authorization: 'Bearer synthetic-session', 'X-Firebase-AppCheck': 'synthetic-appcheck', 'X-Tenant-ID': 'platform' }),
    }));
  });

  it('does not request anything when authentication is absent', async () => {
    credentials.headers.mockResolvedValue({ 'Content-Type': 'application/json' });
    const fetcher = vi.fn();
    await expect(new HttpAltieFactsClient(fetcher).load()).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects a failed load rather than fabricating an empty library and hides upstream text', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ error: 'Bearer raw-private-value', code: 'unexpected-secret-code' }, 503));
    const failure = await new HttpAltieFactsClient(fetcher).load().catch((error) => error);
    expect(failure.code).toBe('FACTS_UNAVAILABLE');
    expect(failure.message).not.toContain('raw-private-value');
  });

  it('rejects malformed successful responses and unconfirmed mutation receipts', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ success: true }));
    const client = new HttpAltieFactsClient(fetcher);
    await expect(client.load()).rejects.toMatchObject({ code: 'FACTS_RESPONSE_INVALID' });
    await expect(client.mutate({ action: 'publish', expectedRevision: 0 })).rejects.toMatchObject({ code: 'FACTS_RESPONSE_INVALID' });
  });

  it('sends the reviewed revision and never automatically retries a conflict', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ code: 'FACTS_REVISION_CONFLICT', error: 'not rendered' }, 409));
    await expect(new HttpAltieFactsClient(fetcher).mutate({ action: 'publish', expectedRevision: 7 })).rejects.toMatchObject({ code: 'FACTS_REVISION_CONFLICT', status: 409 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ action: 'publish', expectedRevision: 7 });
  });

  it('honours cancellation before dispatch and does not accept an HTML export', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('<html>login</html>', { headers: { 'Content-Type': 'text/html' } }));
    const client = new HttpAltieFactsClient(fetcher);
    const controller = new AbortController(); controller.abort();
    await expect(client.load(controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetcher).not.toHaveBeenCalled();
    await expect(client.exportReference()).rejects.toMatchObject({ code: 'FACTS_RESPONSE_INVALID' });
  });
});
