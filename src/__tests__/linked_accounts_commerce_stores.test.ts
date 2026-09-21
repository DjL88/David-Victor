import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LinkedAccountsAdapter } from '../../server/deliverect/LinkedAccountsAdapter';
import { OAuthTokenManager } from '../../server/deliverect/OAuthTokenManager';

describe('LinkedAccountsAdapter.getCommerceStores', () => {
  let mockTokenManager: OAuthTokenManager;
  let adapter: LinkedAccountsAdapter;
  let fetchMock: any;
  let consoleInfoSpy: any;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock;

    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    mockTokenManager = new OAuthTokenManager({
      environment: 'staging',
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
    });

    vi.spyOn(mockTokenManager, 'getAccessToken').mockResolvedValue('mock-access-token-xyz');
    Object.defineProperty(mockTokenManager, 'isConfigured', { get: () => true });

    adapter = new LinkedAccountsAdapter({
      environment: 'staging',
      tokenManager: mockTokenManager,
    });
    vi.spyOn(adapter, 'fetchLocationsForAccount').mockResolvedValue([]);
  });

  it('queries official /commerce/{accountId}/stores with page=1&size=50, not max_results', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        total: 1,
        page: 1,
        size: 50,
        items: [
          {
            id: 'store_123',
            channelLinkId: 'cl_123',
            name: 'Oxford Street Store',
            status: 'ONLINE',
            currency: 'GBP',
            address: {
              street: '100 Oxford St',
              city: 'London',
              postcode: 'W1D 1LL',
              country: 'GB',
            },
          },
        ],
      }),
    });

    const result = await adapter.getCommerceStores('acc_del_999', 'tenant_retailer');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = fetchMock.mock.calls[0][0];
    expect(calledUrl).toContain('/commerce/acc_del_999/stores?page=1&size=50');
    expect(calledUrl).not.toContain('max_results');

    expect(result.success).toBe(true);
    expect(result.count).toBe(1);
    expect(result.stores[0].channelLinkId).toBe('cl_123');
    expect(result.stores[0].name).toBe('Oxford Street Store');
    expect(result.stores[0].currency).toBe('GBP');
    expect(result.stores[0].address?.city).toBe('London');
    expect(result.stores[0].stateProjection).toBe('open');
  });

  it('maps documented fulfillmentTypes pickup capability from Commerce Store responses', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        total: 1,
        page: 1,
        size: 50,
        items: [
          {
            id: 'st_pickup_types',
            name: 'Pickup Store',
            status: 'open',
            fulfillmentTypes: ['pickup'],
          },
        ],
      }),
    });

    const result = await adapter.getCommerceStores('acc_pickup_types', 'tenant_retailer');

    expect(result.count).toBe(1);
    expect(result.stores[0].stateProjection).toBe('open');
    expect(result.stores[0].fulfillmentCapabilitiesProjection).toEqual({
      delivery: false,
      pickup: true,
      scheduling: false,
      provenance: 'fulfillmentTypes',
    });
  });

  it('maps documented settings.pickup.enabled capability from Commerce Store responses', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        total: 1,
        page: 1,
        size: 50,
        items: [
          {
            id: 'st_pickup_settings',
            name: 'Collection Store',
            status: 'open',
            settings: {
              pickup: { enabled: true },
              delivery: { enabled: false },
            },
          },
        ],
      }),
    });

    const result = await adapter.getCommerceStores('acc_pickup_settings', 'tenant_retailer');

    expect(result.count).toBe(1);
    expect(result.stores[0].fulfillmentCapabilitiesProjection).toEqual({
      delivery: false,
      pickup: true,
      scheduling: false,
      provenance: 'settings',
    });
  });

  it('paginates using returned total, page, and size', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          total: 3,
          page: 1,
          size: 2,
          items: [
            { id: 'st_1', name: 'Store 1', status: 'ONLINE' },
            { id: 'st_2', name: 'Store 2', status: 'PAUSED' },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          total: 3,
          page: 2,
          size: 2,
          items: [
            { id: 'st_3', name: 'Store 3', status: 'CLOSED' },
          ],
        }),
      });

    const result = await adapter.getCommerceStores('acc_multi', 'tenant_retailer');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain('/commerce/acc_multi/stores?page=1&size=50');
    expect(fetchMock.mock.calls[1][0]).toContain('/commerce/acc_multi/stores?page=2&size=50');

    expect(result.count).toBe(3);
    expect(result.stores.map((s) => s.name)).toEqual(['Store 1', 'Store 2', 'Store 3']);
    expect(result.stores[0].stateProjection).toBe('open');
    expect(result.stores[1].stateProjection).toBe('paused');
    expect(result.stores[2].stateProjection).toBe('closed');
  });

  it('does not invent store values (missing values remain absent, state does not default to open)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        total: 1,
        page: 1,
        size: 50,
        items: [
          {
            id: 'raw_minimal_store_1',
            // No name, no status, no currency, no address, no fulfillmentCapabilities
          },
        ],
      }),
    });

    const result = await adapter.getCommerceStores('acc_minimal', 'tenant_retailer');

    expect(result.count).toBe(1);
    const store = result.stores[0];
    expect(store.channelLinkId).toBe('raw_minimal_store_1');
    expect(store.name).toBe('');
    expect(store.stateProjection).toBe('UNKNOWN');
    expect(store.currency).toBeUndefined();
    expect(store.address).toBeUndefined();
    expect(store.fulfillmentCapabilitiesProjection).toBeUndefined();
  });

  it('outputs safe diagnostics without logging sensitive data or tokens', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        total: 1,
        page: 1,
        size: 50,
        items: [{ id: 'st_safe', name: 'Safe Store', status: 'ACTIVE' }],
      }),
    });

    await adapter.getCommerceStores('acc_safe', 'tenant_retailer');

    const logMessages = consoleInfoSpy.mock.calls.map((call: any[]) => call.join(' '));
    expect(logMessages.some((msg: string) => msg.includes('COMMERCE_STORES_HTTP_STATUS: 200'))).toBe(true);
    expect(logMessages.some((msg: string) => msg.includes('COMMERCE_STORES_RAW_ITEMS_COUNT: 1'))).toBe(true);
    expect(logMessages.some((msg: string) => msg.includes('COMMERCE_STORES_COUNT: 1'))).toBe(true);
    expect(logMessages.some((msg: string) => msg.includes('COMMERCE_STORES_DISCOVERED: true'))).toBe(true);

    // Tokens must never appear in logs
    for (const msg of logMessages) {
      expect(msg).not.toContain('mock-access-token-xyz');
      expect(msg).not.toContain('test-client-secret');
    }
  });

  it('decouples Firestore persistence failure from upstream discovery', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        total: 1,
        page: 1,
        size: 50,
        items: [{ id: 'st_survives', name: 'Surviving Store', status: 'ONLINE' }],
      }),
    });

    // In a test environment without Firestore Admin credentials initialized,
    // getFirestoreDb() returns null or throws, triggering the persistence error path.
    const result = await adapter.getCommerceStores('acc_db_fail', 'tenant_retailer');

    // Discovery must still report success with the discovered stores!
    expect(result.success).toBe(true);
    expect(result.count).toBe(1);
    expect(result.stores[0].name).toBe('Surviving Store');
    expect(result.status).toBe('COMMERCE_VERIFIED');
    // Persistence status reflects the DB failure, without nullifying the stores
    expect(['FAILED', 'SKIPPED']).toContain(result.persistenceStatus);
  });
});
