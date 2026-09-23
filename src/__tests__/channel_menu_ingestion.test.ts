import { beforeEach, describe, expect, it } from 'vitest';
import {
  ChannelMenuIngestionService,
  type ChannelMenuIngressJob,
  type ChannelMenuQueueClient,
} from '../../server/deliverect/ChannelMenuIngestionService';
import { setServerRuntimeMode } from '../../server/runtimeMode';

class CapturingMenuQueue implements ChannelMenuQueueClient {
  jobs: ChannelMenuIngressJob[] = [];
  async enqueue(job: ChannelMenuIngressJob): Promise<void> {
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
