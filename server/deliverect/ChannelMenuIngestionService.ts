import crypto from 'crypto';
import { getFirebaseStorage, getFirestoreDb } from '../firebase';
import { BFFError } from '../errors';
import { isDemoMode, isTestMode } from '../runtimeMode';
import { DeliverectApiClient } from './DeliverectApiClient';
import { DeliverectOperationalWebhookService } from './DeliverectOperationalWebhookService';
import { getCloudTasksSecurityConfig } from '../cloudTasksSecurity';

export interface ChannelMenuIngressJob {
  jobId: string;
  eventId: string;
  tenantId: string;
  storagePath: string;
  receivedAt: string;
}

export interface ChannelMenuIngressReceipt {
  accepted: true;
  status: 'QUEUED' | 'QUEUE_DEGRADED' | 'DUPLICATE';
  eventId: string;
  jobId: string;
  byteSize: number;
  menuIds: string[];
  channelLinkIds: string[];
}

export interface ChannelMenuQueueClient {
  enqueue(job: ChannelMenuIngressJob): Promise<void>;
}

interface ChannelMenuIngressRecord {
  eventId: string;
  jobId: string;
  tenantId: string;
  storagePath: string;
  byteSize: number;
  contentHash: string;
  menuIds: string[];
  channelLinkIds: string[];
  status: 'RECEIVED' | 'QUEUED' | 'PROCESSING' | 'PROCESSED' | 'QUEUE_FAILED' | 'FAILED';
  receivedAt: string;
  updatedAt: string;
  processedAt?: string;
  error?: string;
}

const memoryRaw = new Map<string, Buffer>();
const memoryNormalized = new Map<string, Buffer>();
const memoryIngress = new Map<string, ChannelMenuIngressRecord>();
const pending = new Set<Promise<void>>();

const liveEnvironment = () =>
  !isDemoMode() && !isTestMode() && process.env.NODE_ENV !== 'test';

const safeSegment = (value: string) =>
  String(value || '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 220);

const menuArray = (payload: any): any[] => {
  if (Array.isArray(payload)) return payload.filter(Boolean);
  if (Array.isArray(payload?.menus)) return payload.menus.filter(Boolean);
  return payload ? [payload] : [];
};

const menuIdOf = (menu: any): string =>
  String(menu?.menuId || menu?._id || menu?.id || '').trim();

const channelLinkIdOf = (menu: any): string =>
  String(
    menu?.channelLinkId ||
    menu?.storeId ||
    menu?.channelLink?._id ||
    menu?.channelLink?.id ||
    (typeof menu?.channelLink === 'string' ? menu.channelLink : '') ||
    ''
  ).trim();

class CloudTasksChannelMenuQueue implements ChannelMenuQueueClient {
  private client: any = null;

  private getClient(): any {
    if (this.client === null) {
      try {
        const { CloudTasksClient } = require('@google-cloud/tasks');
        this.client = new CloudTasksClient();
      } catch {
        this.client = false;
      }
    }
    return this.client || null;
  }

  async enqueue(job: ChannelMenuIngressJob): Promise<void> {
    const queue =
      process.env.CHANNEL_MENU_TASKS_QUEUE ||
      process.env.CLOUD_TASKS_BULK_QUEUE ||
      process.env.CLOUD_TASKS_QUEUE;
    const location = process.env.CLOUD_TASKS_LOCATION || 'europe-west1';
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT;
    const { appUrl, serviceAccountEmail, audience } =
      getCloudTasksSecurityConfig();
    const client = this.getClient();

    if (!queue || !projectId || !client) {
      throw new BFFError(
        'INTEGRATION_NOT_CONFIGURED',
        'Durable Menu Push queue is not configured. Configure CHANNEL_MENU_TASKS_QUEUE (or CLOUD_TASKS_QUEUE), project ID and the public BFF/worker URL.',
        503,
        true
      );
    }

    const parent = client.queuePath(projectId, location, queue);
    const taskName = client.taskPath(
      projectId,
      location,
      queue,
      safeSegment(`menu-${job.eventId}`)
    );
    const task: any = {
      name: taskName,
      httpRequest: {
        httpMethod: 'POST',
        url: `${String(appUrl).replace(/\/$/, '')}/api/v1/internal/tasks/channel-menu`,
        headers: { 'Content-Type': 'application/json' },
        body: Buffer.from(JSON.stringify(job)).toString('base64'),
        oidcToken: {
          serviceAccountEmail,
          audience,
        },
      },
    };

    try {
      await client.createTask({ parent, task });
    } catch (err: any) {
      // Deterministic task IDs make retries idempotent. Cloud Tasks returns
      // ALREADY_EXISTS for the same accepted Menu Push; that is success here.
      if (err?.code === 6 || /already exists/i.test(String(err?.message || ''))) {
        return;
      }
      throw err;
    }
  }
}

class InMemoryChannelMenuQueue implements ChannelMenuQueueClient {
  async enqueue(job: ChannelMenuIngressJob): Promise<void> {
    const work = new Promise<void>((resolve) => {
      setImmediate(async () => {
        try {
          await ChannelMenuIngestionService.processJob(job);
        } finally {
          pending.delete(work);
          resolve();
        }
      });
    });
    pending.add(work);
  }
}

/**
 * Durable ingress for large Deliverect Menu Push payloads.
 *
 * Request path:
 *   HMAC verify -> private object storage -> small Firestore journal -> Cloud Task -> 202
 *
 * The full menu is never placed in a Cloud Task or Firestore document, avoiding
 * both size limits when a retailer publishes tens of thousands of items.
 */
export class ChannelMenuIngestionService {
  private static queueClient: ChannelMenuQueueClient | null = null;

  static setQueueClient(client: ChannelMenuQueueClient | null): void {
    this.queueClient = client;
  }

  static getQueueClient(): ChannelMenuQueueClient {
    if (!this.queueClient) {
      this.queueClient = liveEnvironment()
        ? new CloudTasksChannelMenuQueue()
        : new InMemoryChannelMenuQueue();
    }
    return this.queueClient;
  }

  static async waitForIdle(): Promise<void> {
    while (pending.size) {
      await Promise.all(Array.from(pending));
    }
  }

  private static async getIngressRecord(
    tenantId: string,
    eventId: string
  ): Promise<ChannelMenuIngressRecord | null> {
    const memory = memoryIngress.get(`${tenantId}:${eventId}`);
    const db = liveEnvironment() ? getFirestoreDb() : null;
    if (!db) return memory || null;
    try {
      const doc = await db
        .collection('tenants')
        .doc(tenantId)
        .collection('channelMenuIngress')
        .doc(eventId)
        .get();
      return doc.exists ? (doc.data() as ChannelMenuIngressRecord) : memory || null;
    } catch {
      return memory || null;
    }
  }

  private static async saveIngressRecord(record: ChannelMenuIngressRecord): Promise<void> {
    memoryIngress.set(`${record.tenantId}:${record.eventId}`, record);
    const db = liveEnvironment() ? getFirestoreDb() : null;
    if (!db) {
      if (liveEnvironment()) {
        throw new BFFError(
          'DATABASE_UNAVAILABLE',
          'Menu Push could not be durably journalled because Firestore is unavailable.',
          503,
          true
        );
      }
      return;
    }
    await db
      .collection('tenants')
      .doc(record.tenantId)
      .collection('channelMenuIngress')
      .doc(record.eventId)
      .set(record, { merge: true });
  }

  private static async savePrivateObject(
    storagePath: string,
    body: Buffer,
    metadata: Record<string, string>
  ): Promise<void> {
    const storage = liveEnvironment() ? getFirebaseStorage() : null;
    if (!storage) {
      if (liveEnvironment()) {
        throw new BFFError(
          'STORAGE_NOT_CONFIGURED',
          'Menu Push could not be durably buffered because private Cloud Storage is unavailable.',
          503,
          true
        );
      }
      memoryRaw.set(storagePath, Buffer.from(body));
      return;
    }

    await storage.bucket().file(storagePath).save(body, {
      resumable: body.length > 5 * 1024 * 1024,
      metadata: {
        contentType: 'application/json',
        metadata,
      },
    });
  }

  private static async loadPrivateObject(storagePath: string): Promise<Buffer> {
    const storage = liveEnvironment() ? getFirebaseStorage() : null;
    if (!storage) {
      const value = memoryRaw.get(storagePath) || memoryNormalized.get(storagePath);
      if (!value) {
        throw new Error(`Buffered Menu Push object not found: ${storagePath}`);
      }
      return Buffer.from(value);
    }
    const [buffer] = await storage.bucket().file(storagePath).download();
    return buffer;
  }

  private static async saveNormalizedObject(
    storagePath: string,
    body: Buffer,
    metadata: Record<string, string>
  ): Promise<void> {
    const storage = liveEnvironment() ? getFirebaseStorage() : null;
    if (!storage) {
      memoryNormalized.set(storagePath, Buffer.from(body));
      return;
    }
    await storage.bucket().file(storagePath).save(body, {
      resumable: body.length > 5 * 1024 * 1024,
      metadata: {
        contentType: 'application/json',
        metadata,
      },
    });
  }

  static async acceptVerifiedMenuPush(params: {
    tenantId: string;
    payload: any;
    rawBody: Buffer | string;
    resolvedChannelLinkId?: string;
  }): Promise<ChannelMenuIngressReceipt> {
    const raw = Buffer.isBuffer(params.rawBody)
      ? params.rawBody
      : Buffer.from(params.rawBody, 'utf8');
    const contentHash = crypto.createHash('sha256').update(raw).digest('hex');
    const eventId = contentHash;
    const jobId = `menu_${eventId}`;
    const menus = menuArray(params.payload);
    const menuIds = Array.from(new Set(menus.map(menuIdOf).filter(Boolean)));
    const channelLinkIds = Array.from(
      new Set([
        ...menus.map(channelLinkIdOf).filter(Boolean),
        String(params.resolvedChannelLinkId || '').trim(),
      ].filter(Boolean))
    );

    const existing = await this.getIngressRecord(params.tenantId, eventId);
    if (existing && ['QUEUED', 'PROCESSING', 'PROCESSED'].includes(existing.status)) {
      return {
        accepted: true,
        status: 'DUPLICATE',
        eventId,
        jobId: existing.jobId,
        byteSize: existing.byteSize,
        menuIds: existing.menuIds,
        channelLinkIds: existing.channelLinkIds,
      };
    }

    const now = new Date().toISOString();
    const storagePath =
      `channel-ingress/tenants/${safeSegment(params.tenantId)}/menus/${eventId}.json`;

    await this.savePrivateObject(storagePath, raw, {
      tenantId: params.tenantId,
      eventId,
      kind: 'MENU_PUSH',
    });

    const record: ChannelMenuIngressRecord = {
      eventId,
      jobId,
      tenantId: params.tenantId,
      storagePath,
      byteSize: raw.length,
      contentHash,
      menuIds,
      channelLinkIds,
      status: 'RECEIVED',
      receivedAt: now,
      updatedAt: now,
    };
    await this.saveIngressRecord(record);

    const job: ChannelMenuIngressJob = {
      jobId,
      eventId,
      tenantId: params.tenantId,
      storagePath,
      receivedAt: now,
    };

    try {
      await this.getQueueClient().enqueue(job);
      await this.saveIngressRecord({
        ...record,
        status: 'QUEUED',
        updatedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      await this.saveIngressRecord({
        ...record,
        status: 'QUEUE_FAILED',
        updatedAt: new Date().toISOString(),
        error: String(err?.message || err),
      });
      // The verified payload is already durably buffered and journalled. Treat
      // queue delivery as degraded infrastructure rather than failing the
      // Deliverect webhook; a redelivery will retry because QUEUE_FAILED is not
      // considered a completed duplicate above.
      return {
        accepted: true,
        status: 'QUEUE_DEGRADED',
        eventId,
        jobId,
        byteSize: raw.length,
        menuIds,
        channelLinkIds,
      };
    }

    return {
      accepted: true,
      status: 'QUEUED',
      eventId,
      jobId,
      byteSize: raw.length,
      menuIds,
      channelLinkIds,
    };
  }

  static async processJob(job: ChannelMenuIngressJob): Promise<{ processed: number }> {
    const existing = await this.getIngressRecord(job.tenantId, job.eventId);
    if (existing?.status === 'PROCESSED') return { processed: existing.menuIds.length };

    const processing: ChannelMenuIngressRecord = existing || {
      eventId: job.eventId,
      jobId: job.jobId,
      tenantId: job.tenantId,
      storagePath: job.storagePath,
      byteSize: 0,
      contentHash: job.eventId,
      menuIds: [],
      channelLinkIds: [],
      status: 'PROCESSING',
      receivedAt: job.receivedAt,
      updatedAt: new Date().toISOString(),
    };
    await this.saveIngressRecord({
      ...processing,
      status: 'PROCESSING',
      updatedAt: new Date().toISOString(),
    });

    try {
      const raw = await this.loadPrivateObject(job.storagePath);
      const payload = JSON.parse(raw.toString('utf8'));
      const menus = menuArray(payload);
      const db = liveEnvironment() ? getFirestoreDb() : null;

      const fallbackChannelLinkId =
        existing?.channelLinkIds?.length === 1 ? existing.channelLinkIds[0] : '';

      for (const menu of menus) {
        const menuId = menuIdOf(menu);
        const channelLinkId = channelLinkIdOf(menu) || fallbackChannelLinkId;
        if (!menuId || !channelLinkId) {
          throw new BFFError(
            'VALIDATION_ERROR',
            'Buffered Menu Push is missing menuId or channelLinkId after verified routing.',
            422
          );
        }

        // Reuse the exact parser used by the Commerce API path so hosted Channel
        // menus preserve the existing storefront category/product/bundle shape.
        const parsed = DeliverectApiClient.parseDeliverectMenu(menu, true, []);
        const normalized = {
          menuId,
          channelLinkId,
          menu: menu?.menu || menu?.name || '',
          menuType: menu?.menuType,
          currency: menu?.currency,
          categories: parsed.categories,
          products: parsed.products,
          bundleCatalog: parsed.bundleCatalog,
          source: 'DELIVERECT_CHANNEL_PUSH',
          receivedAt: job.receivedAt,
          processedAt: new Date().toISOString(),
        };
        const normalizedBody = Buffer.from(JSON.stringify(normalized), 'utf8');
        const normalizedPath =
          `hosted-catalog/tenants/${safeSegment(job.tenantId)}/stores/${safeSegment(channelLinkId)}/menus/${safeSegment(menuId)}.json`;

        await this.saveNormalizedObject(normalizedPath, normalizedBody, {
          tenantId: job.tenantId,
          channelLinkId,
          menuId,
          eventId: job.eventId,
        });

        if (db) {
          await db
            .collection('tenants')
            .doc(job.tenantId)
            .collection('channelHostedMenus')
            .doc(safeSegment(`${channelLinkId}_${menuId}`))
            .set(
              {
                tenantId: job.tenantId,
                channelLinkId,
                menuId,
                menuName: normalized.menu,
                menuType: normalized.menuType,
                source: normalized.source,
                rawStoragePath: job.storagePath,
                normalizedStoragePath: normalizedPath,
                categoryCount: parsed.categories.length,
                productCount: parsed.products.length,
                bundleCount: parsed.bundleCatalog?.bundles?.length || 0,
                byteSize: normalizedBody.length,
                lastEventId: job.eventId,
                receivedAt: job.receivedAt,
                updatedAt: normalized.processedAt,
              },
              { merge: true }
            );
        }

        // Preserve existing operational menu metadata + snooze semantics after
        // durable storage, not on the request thread.
        const operationalMenu = channelLinkIdOf(menu)
          ? menu
          : { ...menu, channelLinkId };
        await DeliverectOperationalWebhookService.process(
          job.tenantId,
          'menu_update',
          operationalMenu,
          JSON.stringify(operationalMenu)
        );
      }

      await this.saveIngressRecord({
        ...processing,
        menuIds: menus.map(menuIdOf).filter(Boolean),
        channelLinkIds: menus.map(channelLinkIdOf).filter(Boolean),
        status: 'PROCESSED',
        processedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        error: undefined,
      });
      return { processed: menus.length };
    } catch (err: any) {
      await this.saveIngressRecord({
        ...processing,
        status: 'FAILED',
        error: String(err?.message || err),
        updatedAt: new Date().toISOString(),
      });
      throw err;
    }
  }

  static async getNormalizedMenuForTest(
    tenantId: string,
    channelLinkId: string,
    menuId: string
  ): Promise<any | null> {
    const path =
      `hosted-catalog/tenants/${safeSegment(tenantId)}/stores/${safeSegment(channelLinkId)}/menus/${safeSegment(menuId)}.json`;
    try {
      const raw = await this.loadPrivateObject(path);
      return JSON.parse(raw.toString('utf8'));
    } catch {
      return null;
    }
  }
}
