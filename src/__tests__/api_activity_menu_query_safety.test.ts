import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({ getDb: vi.fn() }));

vi.mock('../../server/firebase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/firebase')>();
  return { ...actual, getFirestoreDb: harness.getDb };
});
vi.mock('../../server/runtimeMode', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/runtimeMode')>();
  return { ...actual, isDemoMode: () => false, isTestMode: () => false };
});

import { encodeApiActivityCursor } from '../../server/apiActivityJournal';
import { ChannelMenuIngestionService } from '../../server/deliverect/ChannelMenuIngestionService';

// The production service builds the query. Only the Firestore transport is a
// synthetic double: these tests are not emulator/index/runtime verification.
function queryHarness() {
  const calls: unknown[][] = [];
  const query = {
    orderBy: vi.fn((field: string, direction: string) => {
      calls.push(['orderBy', field, direction]);
      return query;
    }),
    startAfter: vi.fn((receivedAt: string, id: string) => {
      calls.push(['startAfter', receivedAt, id]);
      return query;
    }),
    limit: vi.fn((value: number) => {
      calls.push(['limit', value]);
      return query;
    }),
    get: vi.fn(async (): Promise<{ docs: Array<{ data: () => unknown }> }> => {
      calls.push(['get']);
      return { docs: [] };
    }),
  };
  const journal = vi.fn(() => query);
  const tenant = vi.fn(() => ({ collection: journal }));
  const collection = vi.fn(() => ({ doc: tenant }));
  harness.getDb.mockReturnValue({ collection });
  return { query, calls, collection, tenant, journal };
}

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'staging');
  harness.getDb.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('production menu journal query error safety', () => {
  it('does not expose valid-looking secret or customer data from a query error code', async () => {
    const { query, collection, tenant, journal } = queryHarness();
    query.get.mockRejectedValueOnce(Object.assign(new Error('synthetic customer body'), {
      code: 'TOKEN_SYNTHETIC_CUSTOMER_123',
      stack: 'synthetic bearer token',
    }));

    const result = await ChannelMenuIngestionService.listRecentIngressPage('query-safety-tenant-a');
    expect(collection).toHaveBeenCalledWith('tenants');
    expect(tenant).toHaveBeenCalledWith('query-safety-tenant-a');
    expect(journal).toHaveBeenCalledWith('channelMenuIngress');
    expect(result).toMatchObject({
      items: [], status: 'UNAVAILABLE', source: 'MEMORY',
      errorCode: 'FIRESTORE_READ_FAILED', nextCursor: null,
    });
    expect(JSON.stringify(result)).not.toMatch(/TOKEN_SYNTHETIC|synthetic customer|bearer token/);
  });

  it('retains known permission diagnostics without interpreting OAuth scopes', async () => {
    const { query } = queryHarness();
    query.get.mockRejectedValueOnce({ code: 'permission-denied', message: 'synthetic raw details' });
    const result = await ChannelMenuIngestionService.listRecentIngressPage('query-safety-tenant-b');
    expect(result).toMatchObject({ status: 'UNAVAILABLE', errorCode: 'PERMISSION_DENIED' });
    expect(JSON.stringify(result)).not.toContain('synthetic raw details');
  });

  it('still returns an explicit unavailable page when the error code getter throws', async () => {
    const { query } = queryHarness();
    query.get.mockRejectedValueOnce(Object.defineProperty({}, 'code', {
      get() { throw new Error('synthetic-secret-getter'); },
    }));
    await expect(ChannelMenuIngestionService.listRecentIngressPage('query-safety-tenant-c'))
      .resolves.toMatchObject({ status: 'UNAVAILABLE', errorCode: 'FIRESTORE_READ_FAILED' });
  });

  it('orders the production query and applies cursor before the bounded sentinel limit', async () => {
    const { calls } = queryHarness();
    const receivedAt = '2026-09-26T12:00:00.000Z';
    const cursor = encodeApiActivityCursor({ receivedAt, id: 'event-z' });
    await ChannelMenuIngestionService.listRecentIngressPage('query-safety-tenant-d', { limit: 2, cursor });
    expect(calls).toEqual([
      ['orderBy', 'receivedAt', 'desc'],
      ['orderBy', 'eventId', 'desc'],
      ['startAfter', receivedAt, 'event-z'],
      ['limit', 3],
      ['get'],
    ]);
  });

  it('filters foreign-tenant records and marks the read partial rather than healthy', async () => {
    const { query } = queryHarness();
    const own = {
      tenantId: 'query-safety-tenant-e', eventId: 'own-event', status: 'PROCESSED',
      receivedAt: '2026-09-26T12:00:00.000Z', updatedAt: '2026-09-26T12:00:01.000Z',
      menuIds: ['own-menu'], channelLinkIds: ['own-channel'], byteSize: 100,
    };
    query.get.mockResolvedValueOnce({ docs: [
      { data: () => ({ ...own, tenantId: 'foreign-tenant', eventId: 'foreign-sentinel' }) },
      { data: () => own },
    ] });
    const result = await ChannelMenuIngestionService.listRecentIngressPage('query-safety-tenant-e');
    expect(result).toMatchObject({ status: 'PARTIAL', source: 'FIRESTORE', errorCode: 'TENANT_MISMATCH_FILTERED' });
    expect(result.items.map((item) => item.eventId)).toEqual(['own-event']);
    expect(JSON.stringify(result)).not.toContain('foreign-sentinel');
  });
});
