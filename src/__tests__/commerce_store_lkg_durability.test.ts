import { afterEach, describe, expect, it, vi } from 'vitest';
import { LinkedAccountsAdapter } from '../../server/deliverect/LinkedAccountsAdapter';

describe('Commerce store last-known-good durability', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('preserves the persisted working mapping when Deliverect returns HTTP 200 with zero stores', async () => {
    const tokenManager = {
      isConfigured: true,
      getAccessToken: vi.fn(async () => 'token'),
      config: { baseUrl: 'https://deliverect.invalid' },
    };

    const adapter = new LinkedAccountsAdapter({ tokenManager: tokenManager as any });
    const lastKnownStore = {
      commerceStoreId: 'cstore_channel-1',
      accountLinkId: 'acclink_account-1',
      physicalLocationId: 'loc_location-1',
      channelLinkId: 'channel-1',
      name: 'Working Store',
      stateProjection: 'open',
      lastSeenAt: '2026-09-24T10:00:00.000Z',
      services: [{ id: 'uber-eats-link', name: 'Uber Eats', status: 'ACTIVE', marketplace: 'uber-eats' }],
    };

    (adapter as any).loadFromFirestore = vi.fn(async () => ({
      accounts: [],
      locations: [{
        physicalLocationId: 'loc_location-1',
        accountLinkId: 'acclink_account-1',
        deliverectLocationId: 'location-1',
        name: 'Working Location',
        statusProjection: 'ACTIVE',
      }],
      stores: [lastKnownStore],
      syncedAt: '2026-09-24T10:00:00.000Z',
    }));

    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('/commerce/account-1/stores')) {
        return new Response(JSON.stringify({ items: [], total: 0, page: 1, size: 50 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (String(url).includes('/locations?')) {
        return new Response(JSON.stringify({ _items: [], _meta: { total: 0 } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as any);

    const result = await adapter.getCommerceStores('account-1', 'tenant-lkg-existing');

    expect(result.success).toBe(true);
    expect(result.status).toBe('STALE_LAST_KNOWN_GOOD');
    expect(result.persistenceStatus).toBe('SKIPPED');
    expect(result.orphanedChannelLinkIds).toEqual([]);
    expect(result.stores).toEqual([lastKnownStore]);
    expect((result.stores[0] as any).services).toEqual(lastKnownStore.services);
    expect(result.count).toBe(1);
    expect(result.message).toMatch(/preserved as last-known-good/i);
  });

  it('does not treat an empty first discovery as authoritative removal evidence', async () => {
    const tokenManager = {
      isConfigured: true,
      getAccessToken: vi.fn(async () => 'token'),
      config: { baseUrl: 'https://deliverect.invalid' },
    };

    const adapter = new LinkedAccountsAdapter({ tokenManager: tokenManager as any });
    (adapter as any).loadFromFirestore = vi.fn(async () => null);

    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('/commerce/account-empty/stores')) {
        return new Response(JSON.stringify({ items: [], total: 0, page: 1, size: 50 }), { status: 200 });
      }
      if (String(url).includes('/locations?')) {
        return new Response(JSON.stringify({ _items: [], _meta: { total: 0 } }), { status: 200 });
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as any);

    const result = await adapter.getCommerceStores('account-empty', 'tenant-lkg-empty');

    expect(result.status).toBe('STALE_LAST_KNOWN_GOOD');
    expect(result.stores).toEqual([]);
    expect(result.persistenceStatus).toBe('SKIPPED');
    expect(result.orphanedChannelLinkIds).toEqual([]);
  });

  it('preserves the persisted working mapping when the Commerce endpoint returns HTTP 403', async () => {
    const tokenManager = {
      isConfigured: true,
      getAccessToken: vi.fn(async () => 'token'),
      config: { baseUrl: 'https://deliverect.invalid' },
    };

    const adapter = new LinkedAccountsAdapter({ tokenManager: tokenManager as any });
    const lastKnownStore = {
      commerceStoreId: 'cstore_channel-403',
      accountLinkId: 'acclink_account-403',
      physicalLocationId: 'loc_location-403',
      channelLinkId: 'channel-403',
      name: 'Provisioned Store',
      stateProjection: 'open',
      lastSeenAt: '2026-09-24T10:00:00.000Z',
    };

    (adapter as any).loadFromFirestore = vi.fn(async () => ({
      accounts: [],
      locations: [],
      stores: [lastKnownStore],
      syncedAt: '2026-09-24T10:00:00.000Z',
    }));

    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('/commerce/account-403/stores')) {
        return new Response(null, { status: 403, statusText: 'Forbidden' });
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as any);

    const result = await adapter.getCommerceStores('account-403', 'tenant-lkg-403');

    expect(result.success).toBe(true);
    expect(result.status).toBe('STALE_LAST_KNOWN_GOOD');
    expect(result.persistenceStatus).toBe('SKIPPED');
    expect(result.stores).toEqual([lastKnownStore]);
    expect(result.count).toBe(1);
    expect(result.message).toMatch(/HTTP 403/i);
  });
});
