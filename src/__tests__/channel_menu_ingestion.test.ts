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

    expect(receipt.status).toBe('QUEUED');
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

  it('serves pushed menu truth through the real storefront adapter before calling Commerce', async () => {
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
      .mockRejectedValue(new Error('Commerce fallback must not be called'));

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

    expect(getAccessToken).not.toHaveBeenCalled();
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
