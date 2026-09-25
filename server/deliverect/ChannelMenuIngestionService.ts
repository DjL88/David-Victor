import crypto from 'crypto';
import { getFirebaseStorage, getFirestoreDb } from '../firebase';
import { BFFError } from '../errors';
import { isDemoMode, isTestMode } from '../runtimeMode';
import { DeliverectApiClient } from './DeliverectApiClient';
import { DeliverectOperationalWebhookService } from './DeliverectOperationalWebhookService';
import { CommerceDiscoveryService } from './CommerceDiscoveryService';
import {
  getCloudTasksCapabilityHealth,
  getCloudTasksSecurityConfig,
} from '../cloudTasksSecurity';
import { normaliseDeliverectTranslations } from '../../src/i18n/entityTranslations';

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
  status: 'RECEIVED' | 'QUEUED' | 'PROCESSING' | 'PROCESSED' | 'REVIEW_REQUIRED' | 'QUEUE_FAILED' | 'FAILED';
  review?: {
    reason: 'DESTRUCTIVE_DELTA';
    previousProductCount: number;
    nextProductCount: number;
    removedProductCount: number;
    removedPercent: number;
    removedExamples: string[];
  };
  receivedAt: string;
  updatedAt: string;
  processedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  error?: string;
}

const memoryRaw = new Map<string, Buffer>();
const memoryNormalized = new Map<string, Buffer>();
const memoryIngress = new Map<string, ChannelMenuIngressRecord>();
const memoryHostedIndex = new Map<string, {
  tenantId: string;
  channelLinkId: string;
  menuId: string;
  normalizedStoragePath: string;
  updatedAt: string;
}>();
const pending = new Set<Promise<void>>();

const liveEnvironment = () =>
  !isDemoMode() && !isTestMode() && process.env.NODE_ENV !== 'test';

export function resolveChannelMenuQueueMode(
  env: NodeJS.ProcessEnv = process.env
): 'cloud-tasks' | 'in-memory' {
  const runtimeMode = String(env.APP_MODE || '').trim().toLowerCase();
  if (runtimeMode === 'production') return 'cloud-tasks';
  if (runtimeMode !== 'staging') return 'in-memory';

  const health = getCloudTasksCapabilityHealth(env, true);
  const bulkQueueReady =
    health.projectConfigured &&
    health.identityConfigured &&
    health.audienceConfigured &&
    health.appUrlConfigured &&
    health.queues.bulk;

  // The initial staging rollout intentionally has no Cloud Tasks resources.
  // Keep verified menu ingestion working in-process there, while production
  // continues to fail closed through the durable Cloud Tasks client.
  return bulkQueueReady ? 'cloud-tasks' : 'in-memory';
}

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
      this.queueClient =
        liveEnvironment() && resolveChannelMenuQueueMode() === 'cloud-tasks'
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
    if (existing && ['QUEUED', 'PROCESSING', 'PROCESSED', 'REVIEW_REQUIRED'].includes(existing.status)) {
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

  private static productKey(product: any): string {
    return String(product?.plu || product?.id || product?._id || product?.productId || '').trim();
  }

  static async destructiveDeltaReview(params: {
    tenantId: string;
    channelLinkId: string;
    menuId: string;
    nextProducts: any[];
  }): Promise<ChannelMenuIngressRecord['review'] | undefined> {
    const previous = await this.getLatestNormalizedMenu(
      params.tenantId,
      params.channelLinkId,
      params.menuId
    );
    const previousProducts = Array.isArray(previous?.products) ? previous.products : [];
    if (previousProducts.length < 20) return undefined;

    const previousKeys = new Set<string>(
      previousProducts.map((product: any) => this.productKey(product)).filter(Boolean)
    );
    const nextKeys = new Set<string>(
      params.nextProducts.map((product: any) => this.productKey(product)).filter(Boolean)
    );
    const removed = Array.from(previousKeys).filter((key) => !nextKeys.has(key));
    const removedPercent = previousKeys.size
      ? Math.round((removed.length / previousKeys.size) * 10000) / 100
      : 0;

    // Conservative platform defaults. Tenant-specific thresholds can be layered
    // on later without weakening this fail-safe. Both an absolute and relative
    // threshold avoid holding ordinary small catalogue edits.
    const percentThreshold = Math.max(1, Number(process.env.CATALOG_DESTRUCTIVE_DELTA_PERCENT || 25));
    const absoluteThreshold = Math.max(1, Number(process.env.CATALOG_DESTRUCTIVE_DELTA_COUNT || 100));
    if (removed.length < absoluteThreshold && removedPercent < percentThreshold) return undefined;

    return {
      reason: 'DESTRUCTIVE_DELTA',
      previousProductCount: previousKeys.size,
      nextProductCount: nextKeys.size,
      removedProductCount: removed.length,
      removedPercent,
      removedExamples: removed.slice(0, 20),
    };
  }

  static async processJob(
    job: ChannelMenuIngressJob,
    options: { approvedReviewEventId?: string } = {}
  ): Promise<{ processed: number; reviewRequired?: boolean }> {
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
          translations: normaliseDeliverectTranslations(
            menu?.menuTranslations,
            menu?.descriptionTranslations
          ),
          menuType: menu?.menuType,
          currency: menu?.currency,
          categories: parsed.categories,
          products: parsed.products,
          bundleCatalog: parsed.bundleCatalog,
          source: 'DELIVERECT_CHANNEL_PUSH',
          receivedAt: job.receivedAt,
          processedAt: new Date().toISOString(),
        };
        const review = options.approvedReviewEventId === job.eventId
          ? undefined
          : await this.destructiveDeltaReview({
              tenantId: job.tenantId,
              channelLinkId,
              menuId,
              nextProducts: parsed.products,
            });
        if (review) {
          await this.saveIngressRecord({
            ...processing,
            menuIds: menus.map(menuIdOf).filter(Boolean),
            channelLinkIds: menus.map(channelLinkIdOf).filter(Boolean),
            status: 'REVIEW_REQUIRED',
            review,
            updatedAt: new Date().toISOString(),
            error: undefined,
          });
          await this.recordReviewAlert(job.tenantId, job.eventId, review);
          // Preserve the last-known-good hosted menu. The raw candidate is
          // already durably buffered under this ingress event for authorised
          // review; do not publish or invalidate storefront caches.
          return { processed: 0, reviewRequired: true };
        }

        const normalizedBody = Buffer.from(JSON.stringify(normalized), 'utf8');
        const normalizedPath =
          `hosted-catalog/tenants/${safeSegment(job.tenantId)}/stores/${safeSegment(channelLinkId)}/menus/${safeSegment(menuId)}.json`;

        await this.saveNormalizedObject(normalizedPath, normalizedBody, {
          tenantId: job.tenantId,
          channelLinkId,
          menuId,
          eventId: job.eventId,
        });

        memoryHostedIndex.set(
          `${job.tenantId}:${channelLinkId}:${menuId}`,
          {
            tenantId: job.tenantId,
            channelLinkId,
            menuId,
            normalizedStoragePath: normalizedPath,
            updatedAt: normalized.processedAt,
          }
        );

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

      // A successful Menu Push becomes the new catalogue truth. Invalidate the
      // bounded storefront discovery/catalog caches only after the durable worker
      // has finished normalising every menu, so the next customer read refreshes
      // the combined catalogue instead of serving stale pre-publish data.
      CommerceDiscoveryService.getInstance().clearCache();

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

  static async listHeldReviews(tenantId: string): Promise<Array<{
    eventId: string;
    receivedAt: string;
    menuIds: string[];
    channelLinkIds: string[];
    review: NonNullable<ChannelMenuIngressRecord['review']>;
  }>> {
    const cleanTenantId = String(tenantId || '').trim();
    if (!cleanTenantId) return [];
    const db = liveEnvironment() ? getFirestoreDb() : null;
    let records: ChannelMenuIngressRecord[] = [];
    if (db) {
      const snap = await db
        .collection('tenants')
        .doc(cleanTenantId)
        .collection('channelMenuIngress')
        .where('status', '==', 'REVIEW_REQUIRED')
        .limit(50)
        .get();
      records = snap.docs.map((doc) => doc.data() as ChannelMenuIngressRecord);
    } else {
      records = Array.from(memoryIngress.values()).filter(
        (record) =>
          record.tenantId === cleanTenantId &&
          record.status === 'REVIEW_REQUIRED'
      );
    }
    return records
      .filter((record) => Boolean(record.review))
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
      .map((record) => ({
        eventId: record.eventId,
        receivedAt: record.receivedAt,
        menuIds: record.menuIds,
        channelLinkIds: record.channelLinkIds,
        review: record.review!,
      }));
  }

  private static async recordReviewAlert(
    tenantId: string,
    eventId: string,
    review: NonNullable<ChannelMenuIngressRecord['review']>
  ): Promise<void> {
    const db = liveEnvironment() ? getFirestoreDb() : null;
    if (!db) return;
    await db
      .collection('tenants')
      .doc(tenantId)
      .collection('adminAlerts')
      .doc(`catalogue-review-${safeSegment(eventId)}`)
      .set(
        {
          type: 'CATALOGUE_REVIEW_REQUIRED',
          severity: 'warning',
          status: 'OPEN',
          tenantId,
          eventId,
          title: 'Catalogue change needs review',
          message: `A Deliverect Menu Push would remove ${review.removedProductCount} products (${review.removedPercent}%). The previous catalogue remains live.`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
  }

  static async inspectDestructiveMenuPush(params: {
    tenantId: string;
    payload: any;
    resolvedChannelLinkId?: string;
  }): Promise<ChannelMenuIngressRecord['review'] | undefined> {
    for (const menu of menuArray(params.payload)) {
      const menuId = menuIdOf(menu);
      const channelLinkId =
        channelLinkIdOf(menu) || String(params.resolvedChannelLinkId || '').trim();
      if (!menuId || !channelLinkId) continue;
      const parsed = DeliverectApiClient.parseDeliverectMenu(menu, true, []);
      const review = await this.destructiveDeltaReview({
        tenantId: params.tenantId,
        channelLinkId,
        menuId,
        nextProducts: parsed.products,
      });
      if (review) return review;
    }
    return undefined;
  }

  static async approveReview(params: {
    tenantId: string;
    eventId: string;
    approvedBy: string;
  }): Promise<{ processed: number; reviewRequired?: boolean }> {
    const record = await this.getIngressRecord(params.tenantId, params.eventId);
    if (!record || record.status !== 'REVIEW_REQUIRED') {
      throw new BFFError(
        'MENU_NOT_AVAILABLE',
        'No held catalogue change was found for this tenant and event.',
        404
      );
    }
    const approvedAt = new Date().toISOString();
    await this.saveIngressRecord({
      ...record,
      approvedAt,
      approvedBy: params.approvedBy,
      updatedAt: approvedAt,
    });
    const result = await this.processJob(
      {
        jobId: record.jobId,
        eventId: record.eventId,
        tenantId: record.tenantId,
        storagePath: record.storagePath,
        receivedAt: record.receivedAt,
      },
      { approvedReviewEventId: record.eventId }
    );
    const db = liveEnvironment() ? getFirestoreDb() : null;
    if (db) {
      await db
        .collection('tenants')
        .doc(params.tenantId)
        .collection('adminAlerts')
        .doc(`catalogue-review-${safeSegment(record.eventId)}`)
        .set(
          {
            status: 'RESOLVED',
            resolvedAt: new Date().toISOString(),
            resolvedBy: params.approvedBy,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
    }
    return result;
  }

  static async getLatestNormalizedMenu(
    tenantId: string,
    channelLinkId: string,
    menuId?: string
  ): Promise<any | null> {
    const cleanTenantId = String(tenantId || '').trim();
    const cleanChannelLinkId = String(channelLinkId || '').trim();
    const cleanMenuId = String(menuId || '').trim();
    if (!cleanTenantId || !cleanChannelLinkId) return null;

    let normalizedStoragePath = '';

    if (!liveEnvironment()) {
      const candidates = Array.from(memoryHostedIndex.values())
        .filter(
          (entry) =>
            entry.tenantId === cleanTenantId &&
            entry.channelLinkId === cleanChannelLinkId &&
            (!cleanMenuId || entry.menuId === cleanMenuId)
        )
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      normalizedStoragePath = candidates[0]?.normalizedStoragePath || '';
    } else {
      const db = getFirestoreDb();
      if (!db) return null;
      const collection = db
        .collection('tenants')
        .doc(cleanTenantId)
        .collection('channelHostedMenus');

      if (cleanMenuId) {
        const snap = await collection
          .doc(safeSegment(`${cleanChannelLinkId}_${cleanMenuId}`))
          .get();
        if (snap.exists) {
          normalizedStoragePath = String(
            snap.data()?.normalizedStoragePath || ''
          );
        }
      } else {
        const snap = await collection
          .where('channelLinkId', '==', cleanChannelLinkId)
          .limit(25)
          .get();
        const candidates = snap.docs
          .map((doc) => doc.data())
          .filter((entry) => entry?.normalizedStoragePath)
          .sort((a, b) =>
            String(b?.updatedAt || '').localeCompare(
              String(a?.updatedAt || '')
            )
          );
        normalizedStoragePath = String(
          candidates[0]?.normalizedStoragePath || ''
        );
      }
    }

    if (!normalizedStoragePath) return null;
    try {
      const raw = await this.loadPrivateObject(normalizedStoragePath);
      const parsed = JSON.parse(raw.toString('utf8'));
      return parsed?.source === 'DELIVERECT_CHANNEL_PUSH' ? parsed : null;
    } catch {
      return null;
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
