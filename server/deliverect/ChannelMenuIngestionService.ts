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
  status: 'QUEUED' | 'PROCESSED' | 'QUEUE_DEGRADED' | 'DUPLICATE';
  eventId: string;
  jobId: string;
  byteSize: number;
  menuIds: string[];
  channelLinkIds: string[];
}

export interface ChannelMenuQueueClient {
  execution?: 'async' | 'inline';
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
  menuNames?: string[];
  channelLinkIds: string[];
  channelNames?: string[];
  accountIds?: string[];
  accountNames?: string[];
  locationIds?: string[];
  locationNames?: string[];
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
  accountId: string;
  locationId: string;
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

const accountIdOf = (menu: any): string => metadataText(menu?.accountId, menu?.account?._id, menu?.account?.id);
const locationIdOf = (menu: any): string => metadataText(menu?.locationId, menu?.location?._id, menu?.location?.id);

const channelLinkIdOf = (menu: any): string =>
  String(
    menu?.channelLinkId ||
    menu?.storeId ||
    menu?.channelLink?._id ||
    menu?.channelLink?.id ||
    (typeof menu?.channelLink === 'string' ? menu.channelLink : '') ||
    ''
  ).trim();

const metadataText = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

const uniqueMetadata = (values: string[]): string[] =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

class CloudTasksChannelMenuQueue implements ChannelMenuQueueClient {
  readonly execution = 'async' as const;
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
  readonly execution = 'inline' as const;

  async enqueue(job: ChannelMenuIngressJob): Promise<void> {
    // Serverless instances can be suspended as soon as the webhook response is
    // sent. Staging deliberately runs without Cloud Tasks, so finish the small
    // normalization/storage job on the authenticated request instead of
    // scheduling fire-and-forget work that may never run.
    const work = ChannelMenuIngestionService.processJob(job).then(() => undefined);
    pending.add(work);
    try {
      await work;
    } finally {
      pending.delete(work);
    }
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
    const menuNames = uniqueMetadata(menus.map((menu) => metadataText(
      menu?.menuName,
      menu?.menu,
      menu?.name
    )));
    const channelLinkIds = Array.from(
      new Set([
        ...menus.map(channelLinkIdOf).filter(Boolean),
        String(params.resolvedChannelLinkId || '').trim(),
      ].filter(Boolean))
    );
    const channelNames = uniqueMetadata(menus.map((menu) => metadataText(
      menu?.channelName,
      menu?.channel?.name,
      menu?.application
    )));
    const accountIds = uniqueMetadata(menus.map((menu) => metadataText(
      menu?.accountId,
      menu?.account?._id,
      menu?.account?.id
    )));
    const accountNames = uniqueMetadata(menus.map((menu) => metadataText(
      menu?.accountName,
      menu?.account?.name
    )));
    const locationIds = uniqueMetadata(menus.map((menu) => metadataText(
      menu?.locationId,
      menu?.location?._id,
      menu?.location?.id
    )));
    const locationNames = uniqueMetadata(menus.map((menu) => metadataText(
      menu?.locationName,
      menu?.location?.name
    )));

    const queue = this.getQueueClient();
    const existing = await this.getIngressRecord(params.tenantId, eventId);
    const terminalDuplicate =
      existing && ['PROCESSED', 'REVIEW_REQUIRED'].includes(existing.status);
    const durableQueueDuplicate =
      existing &&
      queue.execution !== 'inline' &&
      ['QUEUED', 'PROCESSING'].includes(existing.status);

    if (terminalDuplicate || durableQueueDuplicate) {
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

    if (
      existing &&
      queue.execution === 'inline' &&
      ['QUEUED', 'PROCESSING'].includes(existing.status)
    ) {
      const leaseMs = Math.max(
        30_000,
        Number(process.env.CHANNEL_MENU_INLINE_LEASE_MS || 300_000)
      );
      const updatedAtMs = Date.parse(existing.updatedAt);
      const leaseActive =
        Number.isFinite(updatedAtMs) && Date.now() - updatedAtMs < leaseMs;
      if (leaseActive) {
        throw new BFFError(
          'MENU_PROCESSING',
          'This Menu Push is still being processed. Retry the delivery shortly.',
          503,
          true
        );
      }
      // A stale inline lease means the request that owned it was interrupted.
      // Reuse the durable raw object and allow this redelivery to recover it.
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
      menuNames,
      channelLinkIds,
      channelNames,
      accountIds,
      accountNames,
      locationIds,
      locationNames,
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
      await queue.enqueue(job);
    } catch (err: any) {
      if (queue.execution === 'inline') {
        // processJob has already journalled FAILED. Propagate the error so
        // Deliverect reports the publish as failed and can retry it, rather than
        // accepting a catalogue that the storefront cannot serve.
        console.error('[Channel Menu Inline Processing Failed]', {
          tenantId: params.tenantId,
          eventId,
          menuIds,
          channelLinkIds,
          error: String(err?.message || err),
        });
        throw err;
      }
      await this.saveIngressRecord({
        ...record,
        status: 'QUEUE_FAILED',
        updatedAt: new Date().toISOString(),
        error: String(err?.message || err),
      });
      // The verified payload is already durably buffered and journalled. The
      // route returns a retryable 503 for this receipt so Deliverect redelivery
      // can enqueue it again; QUEUE_FAILED is intentionally not a duplicate.
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

    if (queue.execution === 'inline') {
      const completed = await this.getIngressRecord(params.tenantId, eventId);
      return {
        accepted: true,
        status: completed?.status === 'PROCESSED' ? 'PROCESSED' : 'QUEUED',
        eventId,
        jobId,
        byteSize: raw.length,
        menuIds,
        channelLinkIds,
      };
    }

    // Cloud Tasks uses deterministic task IDs, so enqueueing before marking the
    // ingress record QUEUED is safe to retry and avoids a lost-task window. Do
    // not overwrite a worker that advanced unusually quickly.
    const afterEnqueue = await this.getIngressRecord(params.tenantId, eventId);
    if (!afterEnqueue || ['RECEIVED', 'QUEUE_FAILED'].includes(afterEnqueue.status)) {
      await this.saveIngressRecord({
        ...record,
        status: 'QUEUED',
        updatedAt: new Date().toISOString(),
      });
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
        const accountId = accountIdOf(menu) || (existing?.accountIds?.length === 1 ? existing.accountIds[0] : '');
        const locationId = locationIdOf(menu) || (existing?.locationIds?.length === 1 ? existing.locationIds[0] : '');
        const hasFullScope = Boolean(accountId && locationId);
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
        const processedAt = new Date().toISOString();

        // Product removals are soft deletes in our hosted catalogue. Deliverect
        // omits disabled/unpublished items from a new menu payload, but Admin
        // still needs historical visibility. Carry forward removed products as
        // inactive ARCHIVED tombstones; storefront filtering already excludes
        // active === false. If a PLU returns in a later push, the live product
        // naturally replaces its archived tombstone.
        const previousNormalized = await this.getLatestNormalizedMenu(
          job.tenantId,
          channelLinkId,
          menuId
        ).catch(() => null);
        const nextKeys = new Set(
          parsed.products.map((product: any) => this.productKey(product)).filter(Boolean)
        );
        const archivedProducts = (Array.isArray(previousNormalized?.products)
          ? previousNormalized.products
          : []
        )
          .filter((product: any) => {
            const key = this.productKey(product);
            return Boolean(key) && !nextKeys.has(key);
          })
          .map((product: any) => ({
            ...product,
            active: false,
            metadata: {
              ...(product?.metadata || {}),
              lifecycleStatus: 'ARCHIVED',
              archivedAt: product?.metadata?.archivedAt || processedAt,
              archiveReason: product?.metadata?.archiveReason || 'REMOVED_FROM_CHANNEL_MENU',
            },
          }));

        const normalizedProducts = [
          ...parsed.products.map((product: any) => ({
            ...product,
            metadata: {
              ...(product?.metadata || {}),
              lifecycleStatus: product?.active === false ? 'INACTIVE' : 'ACTIVE',
            },
          })),
          ...archivedProducts,
        ];

        const normalized = {
          menuId,
          ...(accountId ? { accountId } : {}),
          ...(locationId ? { locationId } : {}),
          identityScope: hasFullScope ? 'ACCOUNT_LOCATION' : 'CHANNEL_LINK',
          channelLinkId,
          menu: menu?.menu || menu?.name || '',
          translations: normaliseDeliverectTranslations(
            menu?.menuTranslations,
            menu?.descriptionTranslations
          ),
          menuType: menu?.menuType,
          currency: menu?.currency,
          categories: parsed.categories,
          products: normalizedProducts,
          bundleCatalog: parsed.bundleCatalog,
          source: 'DELIVERECT_CHANNEL_PUSH',
          receivedAt: job.receivedAt,
          processedAt,
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
            channelLinkIds: menus
              .map((candidate) => channelLinkIdOf(candidate) || fallbackChannelLinkId)
              .filter(Boolean),
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
        const provenancePath = hasFullScope
          ? `accounts/${safeSegment(accountId)}/locations/${safeSegment(locationId)}/`
          : '';
        const normalizedPath =
          `hosted-catalog/tenants/${safeSegment(job.tenantId)}/${provenancePath}stores/${safeSegment(channelLinkId)}/menus/${safeSegment(menuId)}/versions/${safeSegment(job.eventId)}.json`;

        await this.saveNormalizedObject(normalizedPath, normalizedBody, {
          tenantId: job.tenantId,
          ...(accountId ? { accountId } : {}),
          ...(locationId ? { locationId } : {}),
          channelLinkId,
          menuId,
          eventId: job.eventId,
        });

        // Validate/update operational metadata before publishing the new pointer.
        // If this step fails, the versioned candidate remains stored but the
        // storefront continues to resolve the previous last-known-good menu.
        const operationalMenu = channelLinkIdOf(menu)
          ? menu
          : { ...menu, channelLinkId };
        await DeliverectOperationalWebhookService.process(
          job.tenantId,
          'menu_update',
          operationalMenu,
          JSON.stringify(operationalMenu)
        );

        memoryHostedIndex.set(
          hasFullScope
            ? `${job.tenantId}:${accountId}:${locationId}:${channelLinkId}:${menuId}`
            : `${job.tenantId}:${channelLinkId}:${menuId}`,
          {
            tenantId: job.tenantId,
            accountId,
            locationId,
            channelLinkId,
            menuId,
            normalizedStoragePath: normalizedPath,
            updatedAt: normalized.processedAt,
          }
        );

        if (db) {
          const collection = db
            .collection('tenants')
            .doc(job.tenantId)
            .collection('channelHostedMenus');
          const pointer = {
            tenantId: job.tenantId,
            ...(accountId ? { accountId } : {}),
            ...(locationId ? { locationId } : {}),
            identityScope: normalized.identityScope,
            channelLinkId,
            menuId,
            menuName: normalized.menu,
            menuType: normalized.menuType,
            source: normalized.source,
            rawStoragePath: job.storagePath,
            normalizedStoragePath: normalizedPath,
            categoryCount: parsed.categories.length,
            productCount: normalizedProducts.length,
            activeProductCount: normalizedProducts.filter((product: any) => product?.active !== false).length,
            archivedProductCount: normalizedProducts.filter((product: any) => product?.metadata?.lifecycleStatus === 'ARCHIVED').length,
            bundleCount: parsed.bundleCatalog?.bundles?.length || 0,
            byteSize: normalizedBody.length,
            lastEventId: job.eventId,
            receivedAt: job.receivedAt,
            updatedAt: normalized.processedAt,
          };
          const batch = db.batch();
          // Canonical aliases make the hot read path deterministic and bounded.
          // The old channel+menu key is retained for backwards compatibility.
          batch.set(
            collection.doc(safeSegment(`${channelLinkId}_${menuId}`)),
            { ...pointer, pointerType: 'MENU_ALIAS' },
            { merge: true }
          );
          batch.set(
            collection.doc(safeSegment(`${channelLinkId}__latest`)),
            { ...pointer, pointerType: 'CHANNEL_LATEST_ALIAS' },
            { merge: true }
          );
          if (hasFullScope) {
            batch.set(
              collection.doc(safeSegment(`${accountId}_${locationId}_${channelLinkId}_${menuId}`)),
              { ...pointer, pointerType: 'SCOPED' },
              { merge: true }
            );
          }
          await batch.commit();
        }


      }

      // A successful Menu Push becomes the new catalogue truth. Invalidate the
      // bounded storefront discovery/catalog caches only after the durable worker
      // has finished normalising every menu, so the next customer read refreshes
      // the combined catalogue instead of serving stale pre-publish data.
      CommerceDiscoveryService.getInstance().clearCache();

      await this.saveIngressRecord({
        ...processing,
        menuIds: menus.map(menuIdOf).filter(Boolean),
        channelLinkIds: menus
          .map((menu) => channelLinkIdOf(menu) || fallbackChannelLinkId)
          .filter(Boolean),
        status: 'PROCESSED',
        processedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        error: undefined,
      });
      console.info('[Channel Menu Processed]', {
        tenantId: job.tenantId,
        eventId: job.eventId,
        menuIds: menus.map(menuIdOf).filter(Boolean),
        channelLinkIds: menus
          .map((menu) => channelLinkIdOf(menu) || fallbackChannelLinkId)
          .filter(Boolean),
        menuCount: menus.length,
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

  static async listRecentIngress(tenantId: string, limit: number = 100): Promise<Array<{
    eventId: string;
    status: ChannelMenuIngressRecord['status'];
    receivedAt: string;
    updatedAt: string;
    processedAt?: string;
    menuIds: string[];
    menuNames?: string[];
    channelLinkIds: string[];
    channelNames?: string[];
    accountIds?: string[];
    accountNames?: string[];
    locationIds?: string[];
    locationNames?: string[];
    byteSize: number;
    error?: string;
    review?: ChannelMenuIngressRecord['review'];
  }>> {
    const cleanTenantId = String(tenantId || '').trim();
    if (!cleanTenantId) return [];
    const boundedLimit = Math.min(200, Math.max(1, Number(limit) || 100));
    const db = liveEnvironment() ? getFirestoreDb() : null;
    let records: ChannelMenuIngressRecord[] = [];
    if (db) {
      const snap = await db
        .collection('tenants')
        .doc(cleanTenantId)
        .collection('channelMenuIngress')
        .orderBy('receivedAt', 'desc')
        .limit(boundedLimit)
        .get();
      records = snap.docs.map((doc) => doc.data() as ChannelMenuIngressRecord);
    } else {
      records = Array.from(memoryIngress.values())
        .filter((record) => record.tenantId === cleanTenantId)
        .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
        .slice(0, boundedLimit);
    }
    return records.map((record) => ({
      eventId: record.eventId,
      status: record.status,
      receivedAt: record.receivedAt,
      updatedAt: record.updatedAt,
      processedAt: record.processedAt,
      menuIds: record.menuIds,
      menuNames: record.menuNames,
      channelLinkIds: record.channelLinkIds,
      channelNames: record.channelNames,
      accountIds: record.accountIds,
      accountNames: record.accountNames,
      locationIds: record.locationIds,
      locationNames: record.locationNames,
      byteSize: record.byteSize,
      error: record.error,
      review: record.review,
    }));
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

      const aliasId = cleanMenuId
        ? safeSegment(`${cleanChannelLinkId}_${cleanMenuId}`)
        : safeSegment(`${cleanChannelLinkId}__latest`);
      const alias = await collection.doc(aliasId).get();
      if (alias.exists) {
        normalizedStoragePath = String(alias.data()?.normalizedStoragePath || '');
      } else {
        // Migration fallback for pointers written before canonical aliases.
        // Apply an exact menu predicate before the bound so a requested menu
        // cannot be hidden by unrelated channel documents.
        let query: any = collection.where('channelLinkId', '==', cleanChannelLinkId);
        if (cleanMenuId) query = query.where('menuId', '==', cleanMenuId);
        const snap = await query.limit(50).get();
        const candidates = snap.docs
          .map((doc: any) => doc.data())
          .filter((entry: any) => entry?.normalizedStoragePath)
          .sort((a: any, b: any) =>
            String(b?.updatedAt || '').localeCompare(
              String(a?.updatedAt || '')
            )
          );
        normalizedStoragePath = String(candidates[0]?.normalizedStoragePath || '');
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
    return this.getLatestNormalizedMenu(tenantId, channelLinkId, menuId);
  }
}
