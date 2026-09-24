import { OAuth2Client } from 'google-auth-library';
import { PaymentService } from './deliverect/PaymentService';
import { FirestorePlatformService } from './firestoreService';
import { NotificationService } from './notificationService';
import { AnalyticsService } from './analyticsService';
import { isDemoMode } from './runtimeMode';

let cloudTasksOidcVerifier: Pick<OAuth2Client, 'verifyIdToken'> = new OAuth2Client();

export function setCloudTasksOidcVerifierForTest(
  verifier: Pick<OAuth2Client, 'verifyIdToken'> | null
): void {
  cloudTasksOidcVerifier = verifier || new OAuth2Client();
}

export function assertCloudTasksRuntimeConfig(): void {
  if (isDemoMode() || process.env.NODE_ENV === 'test') return;

  const required = {
    CLOUD_TASKS_SA_EMAIL: process.env.CLOUD_TASKS_SA_EMAIL,
    CLOUD_TASKS_AUDIENCE: process.env.CLOUD_TASKS_AUDIENCE,
    APP_URL: process.env.APP_URL,
  };
  const missing = Object.entries(required)
    .filter(([, value]) => !String(value || '').trim())
    .map(([key]) => key);

  if (missing.length) {
    throw new Error(
      `Cloud Tasks live runtime configuration is incomplete: missing ${missing.join(', ')}.`
    );
  }
}

/**
 * Cryptographically verifies Google Cloud Tasks OIDC tokens.
 *
 * Section 20/23/24: Cloud Tasks Worker Security.
 * Strictly verifies the OIDC token issuer (accounts.google.com),
 * audience (matching CLOUD_TASKS_AUDIENCE / CLOUD_RUN_URL),
 * and expected service-account email (matching CLOUD_TASKS_SA_EMAIL).
 *
 * Explicitly rejects arbitrary headers like x-cloudtasks-queuename or bare Bearer headers.
 */
export async function verifyCloudTasksOidcToken(req: any): Promise<{ email: string; sub: string }> {
  const authHeader = req.headers?.authorization;
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    const err: any = new Error('Unauthorized task worker request. Missing Bearer authorization header.');
    err.statusCode = 401;
    err.code = 'OIDC_AUTH_REQUIRED';
    throw err;
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    const err: any = new Error('Unauthorized task worker request. Empty bearer token.');
    err.statusCode = 401;
    err.code = 'OIDC_AUTH_REQUIRED';
    throw err;
  }

  // In demo mode with explicit demo token, allow demo execution
  if (isDemoMode() && token === 'demo-token') {
    return { email: 'demo-worker@project.iam.gserviceaccount.com', sub: 'demo-worker' };
  }

  const expectedAudience = String(process.env.CLOUD_TASKS_AUDIENCE || '').trim();
  const expectedEmail = String(process.env.CLOUD_TASKS_SA_EMAIL || '').trim();
  if (!expectedAudience || !expectedEmail) {
    const err: any = new Error('Cloud Tasks OIDC verifier is not configured for this live runtime.');
    err.statusCode = 401;
    err.code = 'OIDC_CONFIG_MISSING';
    throw err;
  }

  try {
    const ticket = await cloudTasksOidcVerifier.verifyIdToken({
      idToken: token,
      audience: expectedAudience,
    });
    const payload = ticket.getPayload();
    if (!payload) {
      const err: any = new Error('Empty OIDC token payload.');
      err.statusCode = 401;
      err.code = 'OIDC_TOKEN_INVALID';
      throw err;
    }

    if (payload.iss !== 'accounts.google.com' && payload.iss !== 'https://accounts.google.com') {
      const err: any = new Error(`Invalid OIDC token issuer: ${payload.iss}`);
      err.statusCode = 401;
      err.code = 'OIDC_ISSUER_INVALID';
      throw err;
    }

    if (payload.email_verified !== true) {
      const err: any = new Error('Cloud Tasks OIDC service-account email is not verified.');
      err.statusCode = 401;
      err.code = 'OIDC_EMAIL_NOT_VERIFIED';
      throw err;
    }

    if (payload.email !== expectedEmail) {
      const err: any = new Error('Cloud Tasks OIDC service account does not match the configured worker identity.');
      err.statusCode = 401;
      err.code = 'OIDC_SERVICE_ACCOUNT_MISMATCH';
      throw err;
    }

    return { email: payload.email || '', sub: payload.sub };
  } catch (err: any) {
    if (err.statusCode) throw err;
    const authErr: any = new Error(
      `Cloud Tasks OIDC token cryptographic verification failed: ${err.message}`
    );
    authErr.statusCode = 401;
    authErr.code = 'OIDC_TOKEN_INVALID';
    throw authErr;
  }
}

export interface SettlementJob {
  jobId: string;
  orderId: string;
  tenantId: string;
  webhookEventId: string;
  enqueuedAt: string;
  attempts: number;
}

export interface CancellationJob {
  jobId: string;
  orderId: string;
  tenantId: string;
  reason?: string;
  enqueuedAt: string;
  attempts: number;
}

export interface ITaskQueueClient {
  enqueueSettlement(job: SettlementJob): Promise<void>;
  enqueueCancellation(job: CancellationJob): Promise<void>;
}

export class CloudTasksQueueClient implements ITaskQueueClient {
  private tasksClient: any = null;

  private getClient(): any {
    if (this.tasksClient === null) {
      try {
        const { CloudTasksClient } = require('@google-cloud/tasks');
        this.tasksClient = new CloudTasksClient();
      } catch {
        this.tasksClient = false;
      }
    }
    return this.tasksClient || null;
  }

  async enqueueSettlement(job: SettlementJob): Promise<void> {
    const queue = process.env.CLOUD_TASKS_QUEUE;
    const location = process.env.CLOUD_TASKS_LOCATION || 'europe-west1';
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT;
    const client = this.getClient();
    const isLiveEnvironment = !isDemoMode() && process.env.NODE_ENV !== 'test';

    if (isLiveEnvironment && (!queue || !projectId || !client)) {
      throw new Error(
        `[CloudTasksQueueClient] Cloud Tasks is required in production/staging but is unconfigured (queue: ${queue || 'missing'}, project: ${projectId || 'missing'}). Silent fallback disallowed.`
      );
    }

    if (client && queue && projectId) {
      try {
        const parent = client.queuePath(projectId, location, queue);
        const appUrl = String(process.env.APP_URL || '').replace(/\/$/, '');
        const serviceAccountEmail = String(process.env.CLOUD_TASKS_SA_EMAIL || '').trim();
        const audience = String(process.env.CLOUD_TASKS_AUDIENCE || '').trim();
        if (isLiveEnvironment && (!appUrl || !serviceAccountEmail || !audience)) {
          throw new Error(
            '[CloudTasksQueueClient] APP_URL, CLOUD_TASKS_SA_EMAIL and CLOUD_TASKS_AUDIENCE are required in live modes.'
          );
        }
        const task: any = {
          httpRequest: {
            httpMethod: 'POST',
            url: `${appUrl}/api/v1/internal/tasks/settlement`,
            headers: {
              'Content-Type': 'application/json',
            },
            body: Buffer.from(JSON.stringify(job)).toString('base64'),
            ...(serviceAccountEmail
              ? {
                  oidcToken: {
                    serviceAccountEmail,
                    audience,
                  },
                }
              : {}),
          },
        };
        await client.createTask({ parent, task });
        console.log(`[CloudTasksQueueClient] Enqueued settlement job ${job.jobId} to Cloud Tasks queue ${queue}`);
        return;
      } catch (err: any) {
        if (isLiveEnvironment) {
          console.error(`[CloudTasksQueueClient] Critical: Cloud Tasks dispatch failed in live environment:`, err.message);
          throw err;
        }
        console.warn(`[CloudTasksQueueClient] Cloud Tasks dispatch failed (${err.message}), falling back to background worker execution in demo/test`);
      }
    }

    // Direct background execution ONLY if permitted in demo or test environments
    setImmediate(async () => {
      try {
        await AsyncWorkerService.processSettlementJob(job);
      } catch (err) {
        console.error(`[CloudTasksQueueClient] Settlement fallback execution failed:`, err);
      }
    });
  }

  async enqueueCancellation(job: CancellationJob): Promise<void> {
    const queue = process.env.CLOUD_TASKS_QUEUE;
    const location = process.env.CLOUD_TASKS_LOCATION || 'europe-west1';
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT;
    const client = this.getClient();
    const isLiveEnvironment = !isDemoMode() && process.env.NODE_ENV !== 'test';

    if (isLiveEnvironment && (!queue || !projectId || !client)) {
      throw new Error(
        `[CloudTasksQueueClient] Cloud Tasks is required in production/staging but is unconfigured (queue: ${queue || 'missing'}, project: ${projectId || 'missing'}). Silent fallback disallowed.`
      );
    }

    if (client && queue && projectId) {
      try {
        const parent = client.queuePath(projectId, location, queue);
        const appUrl = String(process.env.APP_URL || '').replace(/\/$/, '');
        const serviceAccountEmail = String(process.env.CLOUD_TASKS_SA_EMAIL || '').trim();
        const audience = String(process.env.CLOUD_TASKS_AUDIENCE || '').trim();
        if (isLiveEnvironment && (!appUrl || !serviceAccountEmail || !audience)) {
          throw new Error(
            '[CloudTasksQueueClient] APP_URL, CLOUD_TASKS_SA_EMAIL and CLOUD_TASKS_AUDIENCE are required in live modes.'
          );
        }
        const task: any = {
          httpRequest: {
            httpMethod: 'POST',
            url: `${appUrl}/api/v1/internal/tasks/cancellation`,
            headers: {
              'Content-Type': 'application/json',
            },
            body: Buffer.from(JSON.stringify(job)).toString('base64'),
            ...(serviceAccountEmail
              ? {
                  oidcToken: {
                    serviceAccountEmail,
                    audience,
                  },
                }
              : {}),
          },
        };
        await client.createTask({ parent, task });
        console.log(`[CloudTasksQueueClient] Enqueued cancellation job ${job.jobId} to Cloud Tasks queue ${queue}`);
        return;
      } catch (err: any) {
        if (isLiveEnvironment) {
          console.error(`[CloudTasksQueueClient] Critical: Cloud Tasks dispatch failed in live environment:`, err.message);
          throw err;
        }
        console.warn(`[CloudTasksQueueClient] Cloud Tasks dispatch failed (${err.message}), falling back to background worker execution in demo/test`);
      }
    }

    setImmediate(async () => {
      try {
        await AsyncWorkerService.processCancellationJob(job);
      } catch (err) {
        console.error(`[CloudTasksQueueClient] Cancellation fallback execution failed:`, err);
      }
    });
  }
}

export class InMemoryTaskQueueClient implements ITaskQueueClient {
  async enqueueSettlement(job: SettlementJob): Promise<void> {
    const promise = new Promise<void>((resolve) => {
      setImmediate(async () => {
        try {
          await AsyncWorkerService.processSettlementJob(job);
        } catch (err) {
          console.error(`[InMemoryTaskQueueClient] Settlement job ${job.jobId} error:`, err);
        } finally {
          AsyncWorkerService.removePendingJob(promise);
          resolve();
        }
      });
    });
    AsyncWorkerService.addPendingJob(promise);
  }

  async enqueueCancellation(job: CancellationJob): Promise<void> {
    const promise = new Promise<void>((resolve) => {
      setImmediate(async () => {
        try {
          await AsyncWorkerService.processCancellationJob(job);
        } catch (err) {
          console.error(`[InMemoryTaskQueueClient] Cancellation job ${job.jobId} error:`, err);
        } finally {
          AsyncWorkerService.removePendingJob(promise);
          resolve();
        }
      });
    });
    AsyncWorkerService.addPendingJob(promise);
  }
}

/**
 * Asynchronous worker service for decoupling payment settlement and order cancellation
 * from synchronous inbound webhook processing.
 *
 * Uses ITaskQueueClient contract to dispatch tasks to Cloud Tasks / Cloud Pub/Sub in production,
 * and isolated in-memory ticks in demo/test mode.
 */
export class AsyncWorkerService {
  private static activeJobs = new Map<string, boolean>();
  private static pendingJobs = new Set<Promise<void>>();
  private static queueClient: ITaskQueueClient | null = null;

  static getQueueClient(): ITaskQueueClient {
    if (!this.queueClient) {
      if (!isDemoMode() && process.env.NODE_ENV !== 'test') {
        this.queueClient = new CloudTasksQueueClient();
      } else {
        this.queueClient = new InMemoryTaskQueueClient();
      }
    }
    return this.queueClient;
  }

  static setQueueClient(client: ITaskQueueClient): void {
    this.queueClient = client;
  }

  static addPendingJob(p: Promise<void>): void {
    this.pendingJobs.add(p);
  }

  static removePendingJob(p: Promise<void>): void {
    this.pendingJobs.delete(p);
  }

  /**
   * Waits for all currently pending background worker jobs to complete.
   * Useful in testing and graceful shutdown.
   */
  static async waitForIdle(): Promise<void> {
    while (this.pendingJobs.size > 0) {
      await Promise.all(Array.from(this.pendingJobs));
    }
  }

  /**
   * Enqueues an asynchronous payment settlement job.
   */
  static enqueuePaymentSettlement(params: {
    orderId: string;
    tenantId: string;
    webhookEventId: string;
  }): void {
    const jobId = `settle_${params.orderId}_${Date.now()}`;
    const job: SettlementJob = {
      jobId,
      orderId: params.orderId,
      tenantId: params.tenantId,
      webhookEventId: params.webhookEventId,
      enqueuedAt: new Date().toISOString(),
      attempts: 0,
    };

    console.log(`[AsyncWorkerService] Enqueued payment settlement job for order ${params.orderId} (Job: ${jobId})`);
    this.getQueueClient().enqueueSettlement(job);
  }

  /**
   * Enqueues an asynchronous order cancellation job.
   */
  static enqueueOrderCancellation(params: {
    orderId: string;
    tenantId: string;
    reason?: string;
  }): void {
    const jobId = `cancel_${params.orderId}_${Date.now()}`;
    const job: CancellationJob = {
      jobId,
      orderId: params.orderId,
      tenantId: params.tenantId,
      reason: params.reason,
      enqueuedAt: new Date().toISOString(),
      attempts: 0,
    };

    console.log(`[AsyncWorkerService] Enqueued order cancellation job for order ${params.orderId} (Job: ${jobId})`);
    this.getQueueClient().enqueueCancellation(job);
  }

  static async processSettlementJob(job: SettlementJob, maxRetries = 3): Promise<void> {
    if (this.activeJobs.get(job.orderId)) {
      console.log(`[AsyncWorkerService] Settlement job for order ${job.orderId} is already in progress, skipping duplicate.`);
      return;
    }

    this.activeJobs.set(job.orderId, true);
    try {
      job.attempts++;
      console.log(`[AsyncWorkerService] Executing payment settlement for order ${job.orderId} (Attempt ${job.attempts})...`);

      const settlement = await PaymentService.settleOrderPayment(job.orderId, job.tenantId);

      const targetOrder = await FirestorePlatformService.getOrderProjection(job.orderId);
      if (targetOrder) {
        await FirestorePlatformService.updateOrderProjectionState(targetOrder.orderId, 'PICKED', {
          updatedViaWebhookId: job.webhookEventId,
          paymentState:
            settlement.status === 'SETTLED'
              ? 'CAPTURED'
              : settlement.status === 'PAYMENT_ACTION_REQUIRED'
              ? 'PAYMENT_ACTION_REQUIRED'
              : 'CAPTURE_FAILED',
          finalAmount: settlement.finalAmount,
          capturedAmount: settlement.capturedAmount,
          residualHoldReleased: settlement.residualHoldReleased,
          settlementDetails: settlement,
        });

        if (targetOrder.checkoutId) {
          await FirestorePlatformService.updateCheckoutStatus(targetOrder.checkoutId, 'READY' as any, {
            orderId: targetOrder.orderId,
          });
        }

        // Phase 14 notifications & analytics
        NotificationService.notifyPickingComplete(targetOrder).catch((err) =>
          console.error('[AsyncWorkerService] Notification error:', err)
        );

        AnalyticsService.trackEvent(targetOrder.tenantId, {
          type: 'PICKING_COMPLETE',
          storeId: targetOrder.channelLinkId,
          properties: { finalAmount: settlement.finalAmount },
        }).catch((err) => console.error('[AsyncWorkerService] Analytics error:', err));

        if (settlement.status === 'SETTLED') {
          AnalyticsService.trackEvent(targetOrder.tenantId, {
            type: 'PAYMENT_CAPTURED',
            storeId: targetOrder.channelLinkId,
            properties: { capturedAmount: settlement.capturedAmount },
          }).catch((err) => console.error('[AsyncWorkerService] Analytics error:', err));
        }
      }

      console.log(`[AsyncWorkerService] Settlement job for order ${job.orderId} completed successfully with status: ${settlement.status}`);
    } catch (err: any) {
      console.error(`[AsyncWorkerService] Settlement job for order ${job.orderId} failed:`, err.message);
      if (job.attempts < maxRetries) {
        const backoffMs = Math.min(2000, Math.pow(2, job.attempts) * 100);
        console.log(`[AsyncWorkerService] Retrying settlement job for order ${job.orderId} in ${backoffMs}ms...`);
        this.activeJobs.delete(job.orderId);
        await new Promise((r) => setTimeout(r, backoffMs));
        return this.processSettlementJob(job, maxRetries);
      }
    } finally {
      this.activeJobs.delete(job.orderId);
    }
  }

  static async processCancellationJob(job: CancellationJob): Promise<void> {
    try {
      console.log(`[AsyncWorkerService] Executing order cancellation for order ${job.orderId}...`);
      await PaymentService.handleOrderCancellation(job.orderId, job.tenantId, job.reason);

      const targetOrder = await FirestorePlatformService.getOrderProjection(job.orderId);
      if (targetOrder) {
        NotificationService.notifyOrderCancelled(targetOrder, job.reason).catch((err) =>
          console.error('[AsyncWorkerService] Notification error:', err)
        );
        AnalyticsService.trackEvent(targetOrder.tenantId, {
          type: 'ORDER_CANCELLED',
          storeId: targetOrder.channelLinkId,
        }).catch((err) => console.error('[AsyncWorkerService] Analytics error:', err));
      }
    } catch (err: any) {
      console.error(`[AsyncWorkerService] Cancellation job for order ${job.orderId} failed:`, err.message);
    }
  }

  /**
   * Invoked by Cloud Tasks HTTP worker webhook handler for durable background execution.
   */
  static async handleCloudTaskJob(
    jobType: 'SETTLEMENT' | 'CANCELLATION',
    payload: any
  ): Promise<{ success: boolean; message?: string }> {
    if (jobType === 'SETTLEMENT') {
      const job: SettlementJob = {
        jobId: payload.jobId || `task_${Date.now()}`,
        orderId: payload.orderId,
        tenantId: payload.tenantId,
        webhookEventId: payload.webhookEventId,
        enqueuedAt: payload.enqueuedAt || new Date().toISOString(),
        attempts: payload.attempts || 1,
      };
      await this.processSettlementJob(job);
      return { success: true, message: `Processed settlement for order ${payload.orderId}` };
    } else if (jobType === 'CANCELLATION') {
      const job: CancellationJob = {
        jobId: payload.jobId || `task_${Date.now()}`,
        orderId: payload.orderId,
        tenantId: payload.tenantId,
        reason: payload.reason,
        enqueuedAt: payload.enqueuedAt || new Date().toISOString(),
        attempts: payload.attempts || 1,
      };
      await this.processCancellationJob(job);
      return { success: true, message: `Processed cancellation for order ${payload.orderId}` };
    }
    throw new Error(`Unsupported job type: ${jobType}`);
  }
}
