import crypto from 'crypto';
import { BFFError } from '../errors';
import { getFirestoreDb } from '../firebase';
import { isDemoMode, isTestMode } from '../runtimeMode';
import { WebhookService } from './WebhookService';
import { getCloudTasksSecurityConfig } from '../cloudTasksSecurity';

export interface PickingStatusIngressJob {
  jobId: string;
  eventId: string;
  tenantId: string;
  payload: any;
  rawBodyBase64: string;
  signature: string;
  receivedAt: string;
}

export interface PickingStatusIngressReceipt {
  accepted: true;
  status: 'QUEUED' | 'QUEUE_DEGRADED' | 'DUPLICATE';
  eventId: string;
  jobId: string;
}

export interface PickingStatusQueueClient {
  enqueue(job: PickingStatusIngressJob): Promise<void>;
}

interface PickingStatusIngressRecord {
  eventId: string;
  jobId: string;
  tenantId: string;
  payload: any;
  rawBodyBase64: string;
  signature: string;
  status: 'RECEIVED' | 'QUEUED' | 'PROCESSING' | 'PROCESSED' | 'QUEUE_FAILED' | 'FAILED';
  receivedAt: string;
  updatedAt: string;
  processedAt?: string;
  error?: string;
}

const pending = new Set<Promise<void>>();
const memoryIngress = new Map<string, PickingStatusIngressRecord>();

const liveEnvironment = () =>
  !isDemoMode() && !isTestMode() && process.env.NODE_ENV !== 'test';

const safeSegment = (value: string) =>
  String(value || '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 220);

class CloudTasksPickingStatusQueue implements PickingStatusQueueClient {
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

  async enqueue(job: PickingStatusIngressJob): Promise<void> {
    const queue =
      process.env.CHANNEL_REALTIME_TASKS_QUEUE ||
      process.env.CLOUD_TASKS_REALTIME_QUEUE ||
      process.env.CLOUD_TASKS_QUEUE;
    const location = process.env.CLOUD_TASKS_LOCATION || 'europe-west1';
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT;
    const { appUrl, serviceAccountEmail, audience } =
      getCloudTasksSecurityConfig();
    const client = this.getClient();

    if (!queue || !projectId || !client) {
      throw new BFFError(
        'INTEGRATION_NOT_CONFIGURED',
        'Realtime Channel callback queue is not configured. Configure CHANNEL_REALTIME_TASKS_QUEUE (or CLOUD_TASKS_QUEUE), project ID and the public BFF/worker URL.',
        503,
        true
      );
    }

    const parent = client.queuePath(projectId, location, queue);
    const taskName = client.taskPath(
      projectId,
      location,
      queue,
      safeSegment(`picking-${job.eventId}`)
    );
    const task: any = {
      name: taskName,
      httpRequest: {
        httpMethod: 'POST',
        url: `${String(appUrl).replace(/\/$/, '')}/api/v1/internal/tasks/picking-status`,
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
      if (err?.code === 6 || /already exists/i.test(String(err?.message || ''))) {
        return;
      }
      throw err;
    }
  }
}

class InMemoryPickingStatusQueue implements PickingStatusQueueClient {
  async enqueue(job: PickingStatusIngressJob): Promise<void> {
    const work = new Promise<void>((resolve) => {
      setImmediate(async () => {
        try {
          await PickingStatusIngressService.processJob(job);
        } catch (err) {
          console.error('[PickingStatusIngress] Background processing failed:', err);
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
 * Fast, durable acknowledgement path for Deliverect picker status callbacks.
 *
 * HMAC authentication is completed by the route before this service is called.
 * Live traffic is durably journalled before Cloud Tasks enqueue is attempted.
 * A queue outage is exposed as degraded infrastructure without turning an
 * already-persisted verified callback into an HTTP failure.
 */
export class PickingStatusIngressService {
  private static queueClient: PickingStatusQueueClient | null = null;

  static setQueueClient(client: PickingStatusQueueClient | null): void {
    this.queueClient = client;
  }

  static getQueueClient(): PickingStatusQueueClient {
    if (!this.queueClient) {
      this.queueClient = liveEnvironment()
        ? new CloudTasksPickingStatusQueue()
        : new InMemoryPickingStatusQueue();
    }
    return this.queueClient;
  }

  private static ingressKey(tenantId: string, eventId: string): string {
    return `${tenantId}:${eventId}`;
  }

  private static ingressDocId(eventId: string): string {
    return crypto.createHash('sha256').update(eventId).digest('hex');
  }

  private static async getIngressRecord(
    tenantId: string,
    eventId: string
  ): Promise<PickingStatusIngressRecord | null> {
    const memory = memoryIngress.get(this.ingressKey(tenantId, eventId));
    const db = liveEnvironment() ? getFirestoreDb() : null;
    if (!db) return memory || null;

    try {
      const doc = await db
        .collection('tenants')
        .doc(tenantId)
        .collection('pickingStatusIngress')
        .doc(this.ingressDocId(eventId))
        .get();
      return doc.exists ? (doc.data() as PickingStatusIngressRecord) : memory || null;
    } catch {
      return memory || null;
    }
  }

  private static async saveIngressRecord(
    record: PickingStatusIngressRecord
  ): Promise<void> {
    memoryIngress.set(this.ingressKey(record.tenantId, record.eventId), record);
    const db = liveEnvironment() ? getFirestoreDb() : null;
    if (!db) {
      if (liveEnvironment()) {
        throw new BFFError(
          'DATABASE_UNAVAILABLE',
          'Picking Status could not be durably journalled because Firestore is unavailable.',
          503,
          true
        );
      }
      return;
    }

    await db
      .collection('tenants')
      .doc(record.tenantId)
      .collection('pickingStatusIngress')
      .doc(this.ingressDocId(record.eventId))
      .set(record, { merge: true });
  }

  static async acceptVerified(params: {
    tenantId: string;
    payload: any;
    rawBody: Buffer | string;
    signature: string;
    externalEventId?: string;
  }): Promise<PickingStatusIngressReceipt> {
    const raw = Buffer.isBuffer(params.rawBody)
      ? params.rawBody
      : Buffer.from(params.rawBody, 'utf8');
    const contentHash = crypto.createHash('sha256').update(raw).digest('hex');
    const eventId = String(
      params.externalEventId ||
      params.payload?.eventId ||
      params.payload?.id ||
      params.payload?._id ||
      contentHash
    ).trim();
    const jobId = `picking_${contentHash}`;
    const existing = await this.getIngressRecord(params.tenantId, eventId);

    if (
      existing &&
      ['QUEUED', 'PROCESSING', 'PROCESSED'].includes(existing.status)
    ) {
      return {
        accepted: true,
        status: 'DUPLICATE',
        eventId,
        jobId: existing.jobId,
      };
    }

    const receivedAt = existing?.receivedAt || new Date().toISOString();
    const rawBodyBase64 = raw.toString('base64');
    const record: PickingStatusIngressRecord = {
      eventId,
      jobId,
      tenantId: params.tenantId,
      payload: params.payload,
      rawBodyBase64,
      signature: params.signature,
      status: 'RECEIVED',
      receivedAt,
      updatedAt: new Date().toISOString(),
    };

    // Persist the verified callback before relying on Cloud Tasks. If the queue
    // is unavailable, the webhook can still be acknowledged and a later
    // redelivery can safely retry enqueue.
    await this.saveIngressRecord(record);

    const job: PickingStatusIngressJob = {
      jobId,
      eventId,
      tenantId: params.tenantId,
      payload: params.payload,
      rawBodyBase64,
      signature: params.signature,
      receivedAt,
    };

    try {
      await this.getQueueClient().enqueue(job);
      await this.saveIngressRecord({
        ...record,
        status: 'QUEUED',
        updatedAt: new Date().toISOString(),
        error: undefined,
      });

      return {
        accepted: true,
        status: 'QUEUED',
        eventId,
        jobId,
      };
    } catch (err: any) {
      await this.saveIngressRecord({
        ...record,
        status: 'QUEUE_FAILED',
        updatedAt: new Date().toISOString(),
        error: String(err?.message || err),
      });

      return {
        accepted: true,
        status: 'QUEUE_DEGRADED',
        eventId,
        jobId,
      };
    }
  }

  static async processJob(job: PickingStatusIngressJob): Promise<any> {
    const existing = await this.getIngressRecord(job.tenantId, job.eventId);
    const processing: PickingStatusIngressRecord = existing || {
      eventId: job.eventId,
      jobId: job.jobId,
      tenantId: job.tenantId,
      payload: job.payload,
      rawBodyBase64: job.rawBodyBase64,
      signature: job.signature,
      status: 'PROCESSING',
      receivedAt: job.receivedAt,
      updatedAt: new Date().toISOString(),
    };

    await this.saveIngressRecord({
      ...processing,
      status: 'PROCESSING',
      updatedAt: new Date().toISOString(),
      error: undefined,
    });

    try {
      const rawBody = Buffer.from(job.rawBodyBase64, 'base64');
      const result = await WebhookService.processWebhook(
        job.payload,
        rawBody,
        {
          'x-server-authorization-hmac-sha256': job.signature,
          'x-deliverect-event-id': job.eventId,
          'content-type': 'application/json',
        },
        job.tenantId
      );

      await this.saveIngressRecord({
        ...processing,
        status: 'PROCESSED',
        processedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        error: undefined,
      });

      return result;
    } catch (err: any) {
      await this.saveIngressRecord({
        ...processing,
        status: 'FAILED',
        updatedAt: new Date().toISOString(),
        error: String(err?.message || err),
      });
      throw err;
    }
  }

  static async waitForIdle(): Promise<void> {
    while (pending.size) {
      await Promise.all(Array.from(pending));
    }
  }
}
