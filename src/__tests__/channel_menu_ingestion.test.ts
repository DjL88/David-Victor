import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ChannelMenuIngestionService,
  type ChannelMenuIngressJob,
  type ChannelMenuQueueClient,
} from '../../server/deliverect/ChannelMenuIngestionService';
import { setServerRuntimeMode } from '../../server/runtimeMode';
import { CommerceDiscoveryService } from '../../server/deliverect/CommerceDiscoveryService';
import { DeliverectApiClient } from '../../server/deliverect/DeliverectApiClient';
import { OAuthTokenManager } from '../../server/deliverect/OAuthTokenManager';
import { FirestorePlatformService } from '../../server/firestoreService';
import { DeliverectOperationalWebhookService } from '../../server/deliverect/DeliverectOperationalWebhookService';

class CapturingMenuQueue implements ChannelMenuQueueClient {
  jobs: ChannelMenuIngressJob[] = [];
  async enqueue(job: ChannelMenuIngressJob): Promise<void> {
    this.jobs.push(job);
  }
}

class FailOnceMenuQueue implements ChannelMenuQueueClient {
  attempts = 0;
  jobs: ChannelMenuIngressJob[] = [];

  async enqueue(job: ChannelMenuIngressJob): Promise<void> {
    this.attempts += 1;
    if (this.attempts === 1) {
      throw new Error('queue unavailable');
    }
    this.jobs.push(job);
  }
}

const sampleMenu = (overrides: Record<string, unknown> = {}) => ({
  menu: 'Main Menu',
  menuId: 'menu-1',
  menuType: 0,
  channelLinkId: 'channel-1',
  currency: 'GBP',
  categories: [
    {
      _id: 'cat-1',
      name: 'Drinks',
      subProducts: ['prod-1'],
    },
  ],
  products: {
    'prod-1': {
      _id: 'prod-1',
      plu: 'DRINK-1',
      gtin: ['500000000001'],
      name: 'Water',
      price: 125,
      productType: 1,
    },
  },
  modifierGroups: {},
  modifiers: {},
  snoozedProducts: {},
  ...overrides,
});

describe('durable Deliverect Channel Menu Push ingress', () => {
  let queue: CapturingMenuQueue;

  beforeEach(() => {
    setServerRuntimeMode('demo');
    queue = new CapturingMenuQueue();
    ChannelMenuIngestionService.setQueueClient(queue);
  });

  it('durably accepts a Menu Push and enqueues only a small storage pointer', async () => {
    const tenantId = `tenant-menu-${Date.now()}`;
    const payload = sampleMenu();
    const rawBody = JSON.stringify(payload);

    const receipt = await ChannelMenuIngestionService.acceptVerifiedMenuPush({
      tenantId,
      payload,
      rawBody,
    });

    expect(receipt.status).toBe('QUEUED');
    expect(receipt.menuIds).toEqual(['menu-1']);
    expect(receipt.channelLinkIds).toEqual(['channel-1']);
    expect(queue.jobs).toHaveLength(1);
    expect(JSON.stringify(queue.jobs[0])).not.toContain('Water');
    expect(JSON.stringify(queue.jobs[0]).length).toBeLessThan(1500);
  });

  it('finishes the staging in-memory fallback before acknowledging the Menu Push', async () => {
    const tenantId = `tenant-inline-${Date.now()}`;
    const payload = sampleMenu();
    ChannelMenuIngestionService.setQueueClient(null);

    const receipt = await ChannelMenuIngestionService.acceptVerifiedMenuPush({
      tenantId,
      payload,
      rawBody: JSON.stringify(payload),
    });

    expect(receipt.status).toBe('PROCESSED');
    const hosted = await ChannelMenuIngestionService.getLatestNormalizedMenu(
      tenantId,
      'channel-1',
      'menu-1'
    );
    expect(hosted).toMatchObject({
      menuId: 'menu-1',
      channelLinkId: 'channel-1',
      source: 'DELIVERECT_CHANNEL_PUSH',
    });
  });

  it('fails the callback when inline normalization cannot publish a usable menu', async () => {
    const tenantId = `tenant-inline-failure-${Date.now()}`;
    const payload = sampleMenu({ menuId: '' });
    ChannelMenuIngestionService.setQueueClient(null);

    await expect(
      ChannelMenuIngestionService.acceptVerifiedMenuPush({
        tenantId,
        payload,
        rawBody: JSON.stringify(payload),
        resolvedChannelLinkId: 'channel-1',
      })
    ).rejects.toThrow(/missing menuId or channelLinkId/i);
  });

  it('keeps an overlapping inline redelivery retryable until the owner finishes', async () => {
    const tenantId = `tenant-inline-overlap-${Date.now()}`;
    const payload = sampleMenu();
    ChannelMenuIngestionService.setQueueClient(null);

    let enteredStorage!: () => void;
    let failStorage!: (error: Error) => void;
    const storageEntered = new Promise<void>((resolve) => {
      enteredStorage = resolve;
    });
    const storageBlocked = new Promise<void>((_resolve, reject) => {
      failStorage = reject;
    });
    const storageSpy = vi
      .spyOn(ChannelMenuIngestionService as any, 'saveNormalizedObject')
      .mockImplementation(async () => {
        enteredStorage();
        await storageBlocked;
      });

    const first = ChannelMenuIngestionService.acceptVerifiedMenuPush({
      tenantId,
      payload,
      rawBody: JSON.stringify(payload),
    });
    await storageEntered;

    await expect(
      ChannelMenuIngestionService.acceptVerifiedMenuPush({
        tenantId,
        payload,
        rawBody: JSON.stringify(payload),
      })
    ).rejects.toMatchObject({ code: 'MENU_PROCESSING', statusCode: 503 });

    failStorage(new Error('late storage failure'));
    await expect(first).rejects.toThrow('late storage failure');
    storageSpy.mockRestore();
  });


  it('scopes hosted menu identity by tenant, account, location, channel link and menu', async () => {
    const tenantId = `tenant-full-scope-${Date.now()}`;
    ChannelMenuIngestionService.setQueueClient(null);
    const first = sampleMenu({ accountId: 'account-a', locationId: 'location-a' });
    await ChannelMenuIngestionService.acceptVerifiedMenuPush({ tenantId, payload: first, rawBody: JSON.stringify(first) });

    const hosted = await ChannelMenuIngestionService.getLatestNormalizedMenu(tenantId, 'channel-1', 'menu-1');
    expect(hosted).toMatchObject({
      accountId: 'account-a',
      locationId: 'location-a',
      channelLinkId: 'channel-1',
      menuId: 'menu-1',
      source: 'DELIVERECT_CHANNEL_PUSH',
    });
  });

  it('does not fabricate account or location identities when the verified menu lacks that provenance', async () => {
    const tenantId = `tenant-channel-scope-${Date.now()}`;
    ChannelMenuIngestionService.setQueueClient(null);
    const first = sampleMenu();
    await ChannelMenuIngestionService.acceptVerifiedMenuPush({
      tenantId,
      payload: first,
      rawBody: JSON.stringify(first),
    });

    const hosted = await ChannelMenuIngestionService.getLatestNormalizedMenu(
      tenantId,
      'channel-1',
      'menu-1'
    );
    expect(hosted).toMatchObject({
      identityScope: 'CHANNEL_LINK',
      channelLinkId: 'channel-1',
      menuId: 'menu-1',
      source: 'DELIVERECT_CHANNEL_PUSH',
    });
    expect(hosted).not.toHaveProperty('accountId');
    expect(hosted).not.toHaveProperty('locationId');
    expect(JSON.stringify(hosted)).not.toContain('unknown-account');
    expect(JSON.stringify(hosted)).not.toContain('unknown-location');
  });

  it('keeps the last-known-good menu live when replacement handover fails', async () => {
    const tenantId = `tenant-lkg-handover-${Date.now()}`;
    ChannelMenuIngestionService.setQueueClient(null);
    const first = sampleMenu({ accountId: 'account-a', locationId: 'location-a' });
    await ChannelMenuIngestionService.acceptVerifiedMenuPush({ tenantId, payload: first, rawBody: JSON.stringify(first) });

    const failure = vi.spyOn(DeliverectOperationalWebhookService, 'process').mockRejectedValueOnce(new Error('operational handover failed'));
    const replacement = sampleMenu({
      accountId: 'account-a',
      locationId: 'location-a',
      products: {
        'prod-1': { _id: 'prod-1', plu: 'DRINK-1', gtin: [], name: 'Replacement', price: 200, productType: 1 },
      },
      categories: [{ _id: 'cat-1', name: 'Drinks', subProducts: ['prod-1'] }],
    });

    await expect(ChannelMenuIngestionService.acceptVerifiedMenuPush({
      tenantId, payload: replacement, rawBody: JSON.stringify(replacement),
    })).rejects.toThrow(/operational handover failed/i);

    const hosted = await ChannelMenuIngestionService.getLatestNormalizedMenu(tenantId, 'channel-1', 'menu-1');
    expect(hosted?.products).toEqual(expect.arrayContaining([
      expect.objectContaining({ plu: 'DRINK-1', name: 'Water', priceMinor: 125, active: true }),
    ]));
    expect(hosted?.products).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ plu: 'DRINK-1', name: 'Replacement', priceMinor: 200 }),
    ]));
    failure.mockRestore();
  });

  it('materializes the existing Commerce-compatible catalogue shape in the worker', async () => {
    const tenantId = `tenant-materialize-${Date.now()}`;
    const payload = sampleMenu();
    const rawBody = JSON.stringify(payload);

    await ChannelMenuIngestionService.acceptVerifiedMenuPush({
      tenantId,
      payload,
      rawBody,
    });
    await ChannelMenuIngestionService.processJob(queue.jobs[0]);

    const hosted = await ChannelMenuIngestionService.getNormalizedMenuForTest(
      tenantId,
      'channel-1',
      'menu-1'
    );

    expect(hosted).toBeTruthy();
    expect(hosted.source).toBe('DELIVERECT_CHANNEL_PUSH');
    expect(hosted.categories[0]).toMatchObject({ id: 'cat-1', name: 'Drinks' });
    expect(hosted.products[0]).toMatchObject({
      plu: 'DRINK-1',
      name: 'Water',
      priceMinor: 125,
    });
  });

  it('archives an ordinary bounded removal while keeping the remaining catalogue live', async () => {
    const tenantId = `tenant-archive-${Date.now()}`;
    ChannelMenuIngestionService.setQueueClient(null);
    const productIds = Array.from({ length: 10 }, (_, index) => `prod-${index}`);
    const products = Object.fromEntries(productIds.map((id, index) => [id, {
      _id: id,
      plu: `DRINK-${index}`,
      gtin: [],
      name: `Drink ${index}`,
      price: 125 + index,
      productType: 1,
    }]));
    const first = sampleMenu({
      categories: [{ _id: 'cat-1', name: 'Drinks', subProducts: productIds }],
      products,
    });
    await ChannelMenuIngestionService.acceptVerifiedMenuPush({
      tenantId,
      payload: first,
      rawBody: JSON.stringify(first),
    });

    const retainedIds = productIds.slice(0, 9);
    const removed = sampleMenu({
      categories: [{ _id: 'cat-1', name: 'Drinks', subProducts: retainedIds }],
      products: Object.fromEntries(retainedIds.map((id) => [id, products[id]])),
    });
    await ChannelMenuIngestionService.acceptVerifiedMenuPush({
      tenantId,
      payload: removed,
      rawBody: JSON.stringify(removed),
    });

    const hosted = await ChannelMenuIngestionService.getLatestNormalizedMenu(
      tenantId,
      'channel-1',
      'menu-1'
    );
    const archived = hosted?.products?.find((product: any) => product.plu === 'DRINK-9');

    expect(hosted?.products?.filter((product: any) => product.active !== false)).toHaveLength(9);
    expect(archived).toMatchObject({
      plu: 'DRINK-9',
      active: false,
      metadata: {
        lifecycleStatus: 'ARCHIVED',
        archiveReason: 'REMOVED_FROM_CHANNEL_MENU',
      },
    });
  });

  it('rejects an empty replacement and preserves a non-empty last-known-good menu', async () => {
    const tenantId = `tenant-empty-replacement-${Date.now()}`;
    ChannelMenuIngestionService.setQueueClient(null);
    const first = sampleMenu();
    await ChannelMenuIngestionService.acceptVerifiedMenuPush({
      tenantId,
      payload: first,
      rawBody: JSON.stringify(first),
    });

    const empty = sampleMenu({
      categories: [{ _id: 'cat-1', name: 'Drinks', subProducts: [] }],
      products: {},
    });
    await expect(ChannelMenuIngestionService.acceptVerifiedMenuPush({
      tenantId,
      payload: empty,
      rawBody: JSON.stringify(empty),
    })).rejects.toMatchObject({ code: 'EMPTY_MENU_SNAPSHOT_REJECTED', statusCode: 422 });

    const hosted = await ChannelMenuIngestionService.getLatestNormalizedMenu(
      tenantId,
      'channel-1',
      'menu-1'
    );
    expect(hosted?.products).toEqual(
      expect.arrayContaining([expect.objectContaining({ plu: 'DRINK-1', active: true })])
    );
  });

  it('rejects a late buffered snapshot so it cannot overwrite newer catalogue truth', async () => {
    const tenantId = `tenant-stale-snapshot-${Date.now()}`;
    const older = sampleMenu({
      products: {
        'prod-old': { _id: 'prod-old', plu: 'OLD-1', gtin: [], name: 'Old', price: 100, productType: 1 },
      },
      categories: [{ _id: 'cat-1', name: 'Drinks', subProducts: ['prod-old'] }],
    });
    const newer = sampleMenu({
      products: {
        'prod-new': { _id: 'prod-new', plu: 'NEW-1', gtin: [], name: 'New', price: 200, productType: 1 },
      },
      categories: [{ _id: 'cat-1', name: 'Drinks', subProducts: ['prod-new'] }],
    });

    await ChannelMenuIngestionService.acceptVerifiedMenuPush({
      tenantId,
      payload: older,
      rawBody: JSON.stringify(older),
    });
    await new Promise((resolve) => setTimeout(resolve, 2));
    await ChannelMenuIngestionService.acceptVerifiedMenuPush({
      tenantId,
      payload: newer,
      rawBody: JSON.stringify(newer),
    });
    const oldJob = queue.jobs[0];
    const newJob = queue.jobs[1];

    await ChannelMenuIngestionService.processJob(newJob);
    await expect(ChannelMenuIngestionService.processJob(oldJob))
      .rejects.toMatchObject({ code: 'STALE_MENU_SNAPSHOT', statusCode: 409 });

    const hosted = await ChannelMenuIngestionService.getLatestNormalizedMenu(
      tenantId,
      'channel-1',
      'menu-1'
    );
    expect(hosted?.products).toEqual(
      expect.arrayContaining([expect.objectContaining({ plu: 'NEW-1', active: true })])
    );
    expect(hosted?.products).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ plu: 'OLD-1', active: true })])
    );
  });

  it('invalidates storefront catalogue caches only after worker processing', async () => {
    const tenantId = `tenant-cache-refresh-${Date.now()}`;
    const payload = sampleMenu();
    const rawBody = JSON.stringify(payload);
    const clearCache = vi.spyOn(
      CommerceDiscoveryService.getInstance(),
      'clearCache'
    );

    await ChannelMenuIngestionService.acceptVerifiedMenuPush({
      tenantId,
      payload,
      rawBody,
    });

    expect(clearCache).not.toHaveBeenCalled();

    await ChannelMenuIngestionService.processJob(queue.jobs[0]);

    expect(clearCache).toHaveBeenCalledTimes(1);
    clearCache.mockRestore();
  });

  it('serves the latest durable pushed menu back to storefront readers', async () => {
    const tenantId = `tenant-storefront-truth-${Date.now()}`;
    const payload = sampleMenu();
    const rawBody = JSON.stringify(payload);

    await ChannelMenuIngestionService.acceptVerifiedMenuPush({
      tenantId,
      payload,
      rawBody,
    });
    await ChannelMenuIngestionService.processJob(queue.jobs[0]);

    const hosted = await ChannelMenuIngestionService.getLatestNormalizedMenu(
      tenantId,
      'channel-1'
    );

    expect(hosted).toBeTruthy();
    expect(hosted.source).toBe('DELIVERECT_CHANNEL_PUSH');
    expect(hosted.menuId).toBe('menu-1');
    expect(hosted.products).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          plu: 'DRINK-1',
          name: 'Water',
          priceMinor: 125,
        }),
      ])
    );
  });

  it('serves pushed menu truth when the Commerce verification overlay is unavailable', async () => {
    const tenantId = `tenant-adapter-push-truth-${Date.now()}`;
    const payload = sampleMenu();
    const rawBody = JSON.stringify(payload);

    await ChannelMenuIngestionService.acceptVerifiedMenuPush({
      tenantId,
      payload,
      rawBody,
    });
    await ChannelMenuIngestionService.processJob(queue.jobs[0]);

    const tokenManager = new OAuthTokenManager({
      environment: 'staging',
      clientId: 'stub-client',
      clientSecret: 'stub-secret',
    });
    const getAccessToken = vi
      .spyOn(tokenManager, 'getAccessToken')
      .mockRejectedValue(new Error('Deliverect Store Menu request failed: HTTP 403'));

    const client = new DeliverectApiClient(
      tokenManager,
      tenantId,
      'account-1',
      ['channel-1']
    );
    vi.spyOn(client as any, 'resolveAccountId').mockResolvedValue('account-1');
    vi.spyOn(client as any, 'resolveStoreChannelLinkId').mockResolvedValue({
      channelLinkId: 'channel-1',
      store: { id: 'channel-1', channelLinkId: 'channel-1', name: 'Store' },
    });
    vi.spyOn(
      FirestorePlatformService,
      'getStoreProductSnoozes'
    ).mockResolvedValue({});

    const catalog = await client.getStoreCatalog('channel-1');

    expect(getAccessToken).toHaveBeenCalled();
    expect(catalog.activeMenuId).toBe('menu-1');
    expect(catalog.products).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          plu: 'DRINK-1',
          name: 'Water',
          priceMinor: 125,
        }),
      ])
    );
    expect(catalog.diagnostics).toMatchObject({
      channelLinkId: 'channel-1',
      rawProductCount: 1,
      parsedProductCount: 1,
      commerceOverlayStatus: 'UNAVAILABLE',
    });
    expect(catalog.products[0].metadata).toMatchObject({
      catalogConfidence: 'MEDIUM',
      catalogConfidenceScore: 70,
      commerceVerified: false,
    });

    vi.restoreAllMocks();
  });

  it('does not use Commerce as a catalogue fallback for a Channel-scoped store', async () => {
    const tenantId = `tenant-no-commerce-fallback-${Date.now()}`;
    const tokenManager = new OAuthTokenManager({
      environment: 'staging',
      clientId: 'stub-client',
      clientSecret: 'stub-secret',
    });
    const getAccessToken = vi
      .spyOn(tokenManager, 'getAccessToken')
      .mockResolvedValue('commerce-token');
    const client = new DeliverectApiClient(
      tokenManager,
      tenantId,
      'account-1',
      ['channel-1']
    );

    vi.spyOn(client as any, 'resolveAccountId').mockResolvedValue('account-1');
    vi.spyOn(client as any, 'resolveStoreChannelLinkId').mockResolvedValue({
      channelLinkId: 'channel-1',
      store: { id: 'channel-1', channelLinkId: 'channel-1', name: 'Store' },
    });
    vi.spyOn(
      ChannelMenuIngestionService,
      'getLatestNormalizedMenu'
    ).mockResolvedValue(null);

    await expect(client.getStoreCatalog('channel-1')).rejects.toMatchObject({
      code: 'MENU_NOT_AVAILABLE',
      statusCode: 503,
    });
    expect(getAccessToken).not.toHaveBeenCalled();

    vi.restoreAllMocks();
  });

  it('keeps the scoped root catalogue available when another location has not published', async () => {
    const tokenManager = new OAuthTokenManager({
      environment: 'staging',
      clientId: 'stub-client',
      clientSecret: 'stub-secret',
    });
    const client = new DeliverectApiClient(
      tokenManager,
      `tenant-partial-root-${Date.now()}`,
      'account-1',
      ['channel-1', 'channel-2']
    );

    vi.spyOn(client as any, 'resolveAccountId').mockResolvedValue('account-1');
    vi.spyOn(client, 'getStores').mockResolvedValue([
      { id: 'channel-1', channelLinkId: 'channel-1', name: 'Published' },
      { id: 'channel-2', channelLinkId: 'channel-2', name: 'Not published' },
    ] as any);
    vi.spyOn(client, 'getStoreCatalog').mockImplementation(async (storeId) => {
      if (storeId === 'channel-2') {
        throw new Error('No published Channel catalogue is available for this store.');
      }
      return {
        id: 'channel-1',
        type: 'STORE',
        storeId: 'channel-1',
        menus: [{ menuId: 'menu-1', name: 'Published', productCount: 1, categoryCount: 1 }],
        categories: [{ id: 'cat-1', name: 'Drinks' }],
        products: [{
          id: 'prod-1',
          plu: 'DRINK-1',
          gtin: [],
          name: 'Water',
          categoryIds: ['cat-1'],
          productTags: [],
          displayLabels: [],
          allergens: [],
          active: true,
          priceMinor: 125,
        }],
        totalProducts: 1,
        updatedAt: new Date().toISOString(),
      } as any;
    });

    const catalog = await client.getRootCatalog();

    expect(catalog.products.map((product) => product.plu)).toEqual(['DRINK-1']);
    expect(catalog.totalProducts).toBe(1);

    vi.restoreAllMocks();
  });

  it('strengthens pushed catalogue products with matching live Commerce evidence', async () => {
    const tenantId = `tenant-overlay-match-${Date.now()}`;
    const payload = sampleMenu();
    await ChannelMenuIngestionService.acceptVerifiedMenuPush({
      tenantId,
      payload,
      rawBody: JSON.stringify(payload),
    });
    await ChannelMenuIngestionService.processJob(queue.jobs[0]);

    const tokenManager = new OAuthTokenManager({
      environment: 'staging',
      clientId: 'stub-client',
      clientSecret: 'stub-secret',
    });
    const client = new DeliverectApiClient(
      tokenManager,
      tenantId,
      'account-1',
      ['channel-1']
    );
    vi.spyOn(client as any, 'resolveAccountId').mockResolvedValue('account-1');
    vi.spyOn(client as any, 'resolveStoreChannelLinkId').mockResolvedValue({
      channelLinkId: 'channel-1',
      store: { id: 'channel-1', channelLinkId: 'channel-1', name: 'Store' },
    });
    vi.spyOn(client, 'getRawStoreMenus').mockResolvedValue({
      accountId: 'account-1',
      channelLinkId: 'channel-1',
      storeId: 'channel-1',
      receivedAt: new Date().toISOString(),
      payload: sampleMenu({
        products: {
          'prod-1': {
            _id: 'prod-1',
            plu: 'DRINK-1',
            gtin: ['500000000001'],
            name: 'Water',
            price: 140,
            productType: 1,
          },
        },
      }),
    });
    vi.spyOn(client, 'getProductTagDefinitions').mockResolvedValue([]);
    vi.spyOn(FirestorePlatformService, 'getStoreProductSnoozes').mockResolvedValue({});

    const catalog = await client.getStoreCatalog('channel-1');

    expect(catalog.products[0]).toMatchObject({
      plu: 'DRINK-1',
      priceMinor: 140,
      metadata: {
        catalogConfidence: 'HIGH',
        catalogConfidenceScore: 100,
        commerceVerified: true,
      },
    });
    expect(catalog.diagnostics).toMatchObject({
      commerceOverlayStatus: 'VERIFIED',
      confidenceHighCount: 1,
      confidenceLowCount: 0,
    });

    vi.restoreAllMocks();
  });

  it('deduplicates retried Menu Pushes before creating another task', async () => {
    const tenantId = `tenant-dedupe-${Date.now()}`;
    const payload = sampleMenu();
    const rawBody = JSON.stringify(payload);

    const first = await ChannelMenuIngestionService.acceptVerifiedMenuPush({
      tenantId,
      payload,
      rawBody,
    });
    const second = await ChannelMenuIngestionService.acceptVerifiedMenuPush({
      tenantId,
      payload,
      rawBody,
    });

    expect(first.status).toBe('QUEUED');
    expect(second.status).toBe('DUPLICATE');
    expect(second.eventId).toBe(first.eventId);
    expect(queue.jobs).toHaveLength(1);
  });

  it('acknowledges durable ingress when the queue is degraded and retries on redelivery', async () => {
    const tenantId = `tenant-queue-degraded-${Date.now()}`;
    const payload = sampleMenu();
    const rawBody = JSON.stringify(payload);
    const failOnceQueue = new FailOnceMenuQueue();
    ChannelMenuIngestionService.setQueueClient(failOnceQueue);

    const first = await ChannelMenuIngestionService.acceptVerifiedMenuPush({
      tenantId,
      payload,
      rawBody,
    });

    expect(first.status).toBe('QUEUE_DEGRADED');
    expect(failOnceQueue.attempts).toBe(1);
    expect(failOnceQueue.jobs).toHaveLength(0);

    const second = await ChannelMenuIngestionService.acceptVerifiedMenuPush({
      tenantId,
      payload,
      rawBody,
    });

    expect(second.status).toBe('QUEUED');
    expect(second.eventId).toBe(first.eventId);
    expect(failOnceQueue.attempts).toBe(2);
    expect(failOnceQueue.jobs).toHaveLength(1);
    expect(failOnceQueue.jobs[0].eventId).toBe(first.eventId);
  });


  it('holds a destructive catalogue delta and preserves last-known-good truth', async () => {
    const tenantId = `tenant-destructive-delta-${Date.now()}`;
    const products: Record<string, any> = {};
    const productIds: string[] = [];
    for (let i = 0; i < 120; i += 1) {
      const id = `prod-${i}`;
      productIds.push(id);
      products[id] = {
        _id: id,
        plu: `SKU-${i}`,
        name: `Product ${i}`,
        price: 100 + i,
        productType: 1,
      };
    }
    const full = sampleMenu({
      categories: [{ _id: 'cat-1', name: 'All', subProducts: productIds }],
      products,
    });

    await ChannelMenuIngestionService.acceptVerifiedMenuPush({
      tenantId,
      payload: full,
      rawBody: JSON.stringify(full),
    });
    await ChannelMenuIngestionService.processJob(queue.jobs[0]);

    const before = await ChannelMenuIngestionService.getLatestNormalizedMenu(
      tenantId,
      'channel-1',
      'menu-1'
    );
    expect(before?.products).toHaveLength(120);

    queue.jobs = [];
    const retainedIds = productIds.slice(0, 10);
    const destructive = sampleMenu({
      categories: [{ _id: 'cat-1', name: 'All', subProducts: retainedIds }],
      products: Object.fromEntries(retainedIds.map((id) => [id, products[id]])),
    });
    await ChannelMenuIngestionService.acceptVerifiedMenuPush({
      tenantId,
      payload: destructive,
      rawBody: JSON.stringify(destructive),
    });
    const result = await ChannelMenuIngestionService.processJob(queue.jobs[0]);

    expect(result).toMatchObject({ processed: 0, reviewRequired: true });
    const after = await ChannelMenuIngestionService.getLatestNormalizedMenu(
      tenantId,
      'channel-1',
      'menu-1'
    );
    expect(after?.products).toHaveLength(120);
    expect(after?.products).toEqual(
      expect.arrayContaining([expect.objectContaining({ plu: 'SKU-119' })])
    );
  });

  it('atomically rejects an older worker that overlaps a newer publish', async () => {
    const tenantId = `tenant-overlap-order-${Date.now()}`;
    const older = sampleMenu({
      products: {
        'prod-old': {
          _id: 'prod-old',
          plu: 'OLD-1',
          gtin: [],
          name: 'Older product',
          price: 100,
          productType: 1,
        },
      },
      categories: [{ _id: 'cat-1', name: 'Drinks', subProducts: ['prod-old'] }],
    });
    const newer = sampleMenu({
      products: {
        'prod-new': {
          _id: 'prod-new',
          plu: 'NEW-1',
          gtin: [],
          name: 'Newer product',
          price: 200,
          productType: 1,
        },
      },
      categories: [{ _id: 'cat-1', name: 'Drinks', subProducts: ['prod-new'] }],
    });

    await ChannelMenuIngestionService.acceptVerifiedMenuPush({
      tenantId,
      payload: older,
      rawBody: JSON.stringify(older),
    });
    await ChannelMenuIngestionService.acceptVerifiedMenuPush({
      tenantId,
      payload: newer,
      rawBody: JSON.stringify(newer),
    });

    expect(queue.jobs).toHaveLength(2);
    const olderJob = queue.jobs[0];
    const newerJob = queue.jobs[1];
    olderJob.receivedAt = '2026-09-26T12:00:00.000Z';
    newerJob.receivedAt = '2026-09-26T12:01:00.000Z';

    let olderReachedPublish!: () => void;
    let releaseOlder!: () => void;
    const olderAtPublish = new Promise<void>((resolve) => {
      olderReachedPublish = resolve;
    });
    const olderRelease = new Promise<void>((resolve) => {
      releaseOlder = resolve;
    });
    const operational = vi
      .spyOn(DeliverectOperationalWebhookService, 'process')
      .mockImplementation(async (_tenantId, _eventType, menu: any) => {
        if (JSON.stringify(menu).includes('OLD-1')) {
          olderReachedPublish();
          await olderRelease;
        }
        return undefined as any;
      });

    const olderProcessing = ChannelMenuIngestionService.processJob(olderJob);
    await olderAtPublish;
    const newerResult = await ChannelMenuIngestionService.processJob(newerJob);
    expect(newerResult).toEqual({ processed: 1 });

    releaseOlder();
    const staleResult = await olderProcessing;
    operational.mockRestore();

    expect(staleResult).toEqual({ processed: 0 });
    const hosted = await ChannelMenuIngestionService.getLatestNormalizedMenu(
      tenantId,
      'channel-1',
      'menu-1'
    );
    expect(hosted?.receivedAt).toBe(newerJob.receivedAt);
    expect(hosted?.products).toEqual(
      expect.arrayContaining([expect.objectContaining({ plu: 'NEW-1', active: true })])
    );
    expect(hosted?.products).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ plu: 'OLD-1', active: true })])
    );
  });

  it('keeps very large menu content out of the Cloud Task body', async () => {
    const tenantId = `tenant-large-menu-${Date.now()}`;
    const payload = sampleMenu({
      description: 'x'.repeat(1_200_000),
    });
    const rawBody = JSON.stringify(payload);

    expect(Buffer.byteLength(rawBody)).toBeGreaterThan(1_000_000);
    await ChannelMenuIngestionService.acceptVerifiedMenuPush({
      tenantId,
      payload,
      rawBody,
    });

    expect(queue.jobs).toHaveLength(1);
    expect(Buffer.byteLength(JSON.stringify(queue.jobs[0]))).toBeLessThan(1500);
  });
});
