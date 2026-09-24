import { PaymentService } from './deliverect/PaymentService';
import { FirestorePlatformService } from './firestoreService';
import { IntegrationContext } from './deliverect/IntegrationContext';
import { NotificationService } from './notificationService';
import { AnalyticsService } from './analyticsService';
import { isDemoMode } from './runtimeMode';
import {
  getCloudTasksSecurityConfig,
  verifyCloudTasksOidcToken,
} from './cloudTasksSecurity';

export { verifyCloudTasksOidcToken } from './cloudTasksSecurity';

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
        const { appUrl, serviceAccountEmail, audience } =
          getCloudTasksSecurityConfig();
        const task: any = {
          httpRequest: {
            httpMethod: 'POST',
            url: `${appUrl}/api/v1/internal/tasks/settlement`,
            headers: {
              'Content-Type': 'application/json',
            },
            body: Buffer.from(JSON.stringify(job)).toString('base64'),
            oidcToken: {
              serviceAccountEmail,
              audience,
            },
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
        const { appUrl, serviceAccountEmail, audience } =
          getCloudTasksSecurityConfig();
        const task: any = {
          httpRequest: {
            httpMethod: 'POST',
            url: `${appUrl}/api/v1/internal/tasks/cancellation`,
            headers: {
              'Content-Type': 'application/json',
            },
            body: Buffer.from(JSON.stringify(job)).toString('base64'),
            oidcToken: {
              serviceAccountEmail,
              audience,
            },
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

      // Reauthorization is tenant/environment policy, never an implicit worker
      // default. Missing/inactive profiles fail closed to PAYMENT_ACTION_REQUIRED.
      let reauthorizeIfNeeded = false;
      try {
        // Reuse the canonical tenant integration resolver so activeEnv,
        // deployment environment guards, ACTIVE-profile requirements and
        // environment-scoped DPay configuration cannot drift from checkout.
        const integration = await IntegrationContext.getContext(job.tenantId);
        reauthorizeIfNeeded =
          integration.dpay?.enabled === true &&
          integration.dpay?.excessAmountPolicy === 'AUTO_REAUTHORIZE';
      } catch (err: any) {
        console.warn(
          `[AsyncWorkerService] Payment excess policy unavailable for ${job.tenantId}; defaulting to manual action required: ${err?.message || err}`
        );
      }

      const settlement = await PaymentService.settleOrderPayment(job.orderId, job.tenantId, {
        reauthorizeIfNeeded,
      });

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
