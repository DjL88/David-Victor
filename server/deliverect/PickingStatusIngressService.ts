import crypto from 'crypto';
import { BFFError } from '../errors';
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
  status: 'QUEUED';
  eventId: string;
  jobId: string;
}

export interface PickingStatusQueueClient {
  enqueue(job: PickingStatusIngressJob): Promise<void>;
}

const pending = new Set<Promise<void>>();

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
 * Live traffic is then committed to Cloud Tasks before the HTTP 200 is returned,
 * keeping Deliverect's request thread independent from Firestore/order settlement.
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

    const job: PickingStatusIngressJob = {
      jobId,
      eventId,
      tenantId: params.tenantId,
      payload: params.payload,
      rawBodyBase64: raw.toString('base64'),
      signature: params.signature,
      receivedAt: new Date().toISOString(),
    };

    await this.getQueueClient().enqueue(job);

    return {
      accepted: true,
      status: 'QUEUED',
      eventId,
      jobId,
    };
  }

  static async processJob(job: PickingStatusIngressJob): Promise<any> {
    const rawBody = Buffer.from(job.rawBodyBase64, 'base64');
    return WebhookService.processWebhook(
      job.payload,
      rawBody,
      {
        'x-server-authorization-hmac-sha256': job.signature,
        'x-deliverect-event-id': job.eventId,
        'content-type': 'application/json',
      },
      job.tenantId
    );
  }

  static async waitForIdle(): Promise<void> {
    while (pending.size) {
      await Promise.all(Array.from(pending));
    }
  }
}
