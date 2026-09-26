import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeliverectApiClient } from '../../server/deliverect/DeliverectApiClient';
import { IntegrationContext } from '../../server/deliverect/IntegrationContext';
import { FirestorePlatformService } from '../../server/firestoreService';

describe('Retail Channel local basket', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('does not call Deliverect Commerce when creating and updating a Retail/Quest basket', async () => {
    const tenantId = `retail-local-${Date.now()}`;
    const client = new DeliverectApiClient(tenantId) as any;
    vi.spyOn(IntegrationContext, 'getContext').mockResolvedValue({
      tenantId,
      environment: 'staging',
      orderRoute: 'retail_quest',
      channelName: 'leitchtech',
    } as any);
    client.resolveStoreChannelLinkId = vi.fn().mockResolvedValue({
      channelLinkId: 'channel-1',
      store: { id: 'channel-1', channelLinkId: 'channel-1', name: 'Market Lane', currency: 'GBP' },
    });
    client.getStoreCatalog = vi.fn().mockResolvedValue({
      id: 'menu-1',
      type: 'STORE',
      storeId: 'channel-1',
      activeMenuId: 'menu-1',
      categories: [],
      products: [{
        id: 'product-1',
        plu: 'DLV1007',
        gtin: [],
        name: 'Catalogue Item',
        categoryIds: [],
        productTags: [],
        displayLabels: [],
        allergens: [],
        price: { amount: 250, currency: 'GBP' },
        active: true,
        stockStatus: 'IN_STOCK',
      }],
      updatedAt: new Date().toISOString(),
    });
    const commerceApi = vi.spyOn(client, 'getCommerceBasketApi');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const empty = await client.createBasket('channel-1', 'pickup');
    const basket = await client.updateBasketItem(empty.id, 'DLV1007', 2);

    expect(empty.id).toMatch(/^bsk_/);
    expect(basket.channelLinkId).toBe('channel-1');
    expect(basket.items).toEqual([
      expect.objectContaining({ plu: 'DLV1007', quantity: 2, name: 'Catalogue Item' }),
    ]);
    expect(basket.total).toEqual({ amount: 500, currency: 'GBP' });
    expect(commerceApi).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('removes a line when it no longer exists in the current store catalogue', async () => {
    const tenantId = `retail-reconcile-${Date.now()}`;
    const client = new DeliverectApiClient(tenantId) as any;
    vi.spyOn(IntegrationContext, 'getContext').mockResolvedValue({
      tenantId,
      environment: 'staging',
      orderRoute: 'retail_quest',
      channelName: 'leitchtech',
    } as any);
    client.resolveStoreChannelLinkId = vi.fn().mockResolvedValue({
      channelLinkId: 'channel-2',
      store: { id: 'channel-2', channelLinkId: 'channel-2', name: 'Market Lane', currency: 'GBP' },
    });
    client.getStoreCatalog = vi.fn()
      .mockResolvedValueOnce({
        id: 'menu-2', type: 'STORE', storeId: 'channel-2', activeMenuId: 'menu-2', categories: [],
        products: [{ id: 'p2', plu: 'PLU-2', gtin: [], name: 'Temporary Item', categoryIds: [], productTags: [], displayLabels: [], allergens: [], price: { amount: 100, currency: 'GBP' }, active: true, stockStatus: 'IN_STOCK' }],
        updatedAt: new Date().toISOString(),
      })
      .mockResolvedValueOnce({
        id: 'menu-2', type: 'STORE', storeId: 'channel-2', activeMenuId: 'menu-2', categories: [], products: [], updatedAt: new Date().toISOString(),
      });

    const empty = await client.createBasket('channel-2', 'pickup');
    await client.updateBasketItem(empty.id, 'PLU-2', 1);
    const reconciled = await client.reconcileBasket(empty.id);

    expect(reconciled.basket.items).toEqual([]);
    expect(reconciled.changes).toEqual([
      expect.objectContaining({ plu: 'PLU-2', type: 'ITEM_REMOVED' }),
    ]);
  });

  it('revalidates the local catalogue basket and submits only the final Channel API order', async () => {
    const tenantId = `retail-submit-${Date.now()}`;
    const client = new DeliverectApiClient(tenantId) as any;
    vi.spyOn(IntegrationContext, 'getContext').mockResolvedValue({
      tenantId,
      environment: 'staging',
      orderRoute: 'retail_quest',
      channelName: 'leitchtech',
      deliverectAccountId: 'account-1',
    } as any);
    vi.spyOn(FirestorePlatformService, 'getIntegrationConfig').mockResolvedValue({
      tenantId,
      environment: 'staging',
      status: 'connected',
      orderRoute: 'retail_quest',
      channelName: 'leitchtech',
      deliverectAccountId: 'account-1',
    } as any);
    vi.spyOn(FirestorePlatformService, 'getTenantConfig').mockResolvedValue({
      id: tenantId,
      name: 'Test',
      brandName: 'Test',
      currency: 'GBP',
      featureFlags: {},
    } as any);
    client.resolveStoreChannelLinkId = vi.fn().mockResolvedValue({
      channelLinkId: 'channel-3',
      store: { id: 'channel-3', channelLinkId: 'channel-3', name: 'Market Lane', currency: 'GBP' },
    });
    client.getStoreCatalog = vi.fn().mockResolvedValue({
      id: 'menu-3', type: 'STORE', storeId: 'channel-3', activeMenuId: 'menu-3', categories: [],
      products: [{ id: 'p3', plu: 'PLU-3', gtin: [], name: 'Final Item', categoryIds: [], productTags: [], displayLabels: [], allergens: [], price: { amount: 375, currency: 'GBP' }, active: true, stockStatus: 'IN_STOCK' }],
      updatedAt: new Date().toISOString(),
    });
    vi.spyOn(client.tokenManager, 'getAuthorizationHeader').mockResolvedValue('Bearer channel-token');
    vi.spyOn(client.tokenManager, 'getChannelScopeNames').mockResolvedValue(['leitchtech']);
    const commerceApi = vi.spyOn(client, 'getCommerceBasketApi');
    let submittedUrl = '';
    let submittedBody: any;
    let submittedHeaders: HeadersInit | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      submittedUrl = String(url);
      submittedBody = JSON.parse(String(init?.body));
      submittedHeaders = init?.headers;
      return {
        ok: true,
        status: 201,
        text: async () => JSON.stringify({ id: 'upstream-order-1' }),
      } as Response;
    });

    const empty = await client.createBasket('channel-3', 'pickup');
    await client.updateBasketItem(empty.id, 'PLU-3', 2);
    const result = await client.submitRetailOrder(empty.id, {
      channelOrderReference: 'LT-1001',
      tenantId,
    });

    expect(commerceApi).not.toHaveBeenCalled();
    expect(submittedUrl).toBe('https://api.staging.deliverect.io/leitchtech/order/channel-3');
    expect(submittedHeaders).toMatchObject({
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-deliverect-version': 'retail',
    });
    expect(submittedBody).toMatchObject({
      channelOrderId: 'LT-1001',
      payment: { amount: 750, due: 750 },
      items: [{ plu: 'PLU-3', quantity: 2, price: 375 }],
    });
    expect(result.orderId).toBe('upstream-order-1');
    expect(result.status).toBe('ORDER_CONFIRMED');
  });
});
