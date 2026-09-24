import { beforeEach, describe, expect, it } from 'vitest';
import {
  PickingStatusIngressService,
  type PickingStatusIngressJob,
  type PickingStatusQueueClient,
} from '../../server/deliverect/PickingStatusIngressService';
import { setServerRuntimeMode } from '../../server/runtimeMode';

class CapturingPickingQueue implements PickingStatusQueueClient {
  jobs: PickingStatusIngressJob[] = [];

  async enqueue(job: PickingStatusIngressJob): Promise<void> {
    this.jobs.push(job);
  }
}

class FailOncePickingQueue implements PickingStatusQueueClient {
  attempts = 0;
  jobs: PickingStatusIngressJob[] = [];

  async enqueue(job: PickingStatusIngressJob): Promise<void> {
    this.attempts += 1;
    if (this.attempts === 1) {
      throw new Error('queue unavailable');
    }
    this.jobs.push(job);
  }
}

const pickingPayload = () => ({
  eventId: 'pick-event-1',
  eventType: 'PICKING_STATUS_UPDATE',
  eventData: {
    channelOrderId: 'LT2639000C',
    channelLink: 'channel-1',
    status: 'PICKING_STARTED',
  },
});

describe('durable Deliverect Picking Status ingress', () => {
  beforeEach(() => {
    setServerRuntimeMode('demo');
    PickingStatusIngressService.setQueueClient(null);
  });

  it('journals a verified callback before queueing it', async () => {
    const queue = new CapturingPickingQueue();
    PickingStatusIngressService.setQueueClient(queue);
    const payload = pickingPayload();
    const rawBody = JSON.stringify(payload);

    const receipt = await PickingStatusIngressService.acceptVerified({
      tenantId: `tenant-picking-${Date.now()}`,
      payload,
      rawBody,
      signature: 'test-signature',
    });

    expect(receipt.status).toBe('QUEUED');
    expect(queue.jobs).toHaveLength(1);
    expect(queue.jobs[0].eventId).toBe('pick-event-1');
    expect(queue.jobs[0].payload.eventType).toBe('PICKING_STATUS_UPDATE');
  });

  it('acknowledges durable ingress when the queue is degraded and retries on redelivery', async () => {
    const queue = new FailOncePickingQueue();
    PickingStatusIngressService.setQueueClient(queue);
    const tenantId = `tenant-picking-degraded-${Date.now()}`;
    const payload = pickingPayload();
    const rawBody = JSON.stringify(payload);

    const first = await PickingStatusIngressService.acceptVerified({
      tenantId,
      payload,
      rawBody,
      signature: 'test-signature',
    });

    expect(first.status).toBe('QUEUE_DEGRADED');
    expect(queue.attempts).toBe(1);
    expect(queue.jobs).toHaveLength(0);

    const second = await PickingStatusIngressService.acceptVerified({
      tenantId,
      payload,
      rawBody,
      signature: 'test-signature',
    });

    expect(second.status).toBe('QUEUED');
    expect(second.eventId).toBe(first.eventId);
    expect(second.jobId).toBe(first.jobId);
    expect(queue.attempts).toBe(2);
    expect(queue.jobs).toHaveLength(1);

    const duplicate = await PickingStatusIngressService.acceptVerified({
      tenantId,
      payload,
      rawBody,
      signature: 'test-signature',
    });

    expect(duplicate.status).toBe('DUPLICATE');
    expect(duplicate.eventId).toBe(first.eventId);
    expect(queue.attempts).toBe(2);
    expect(queue.jobs).toHaveLength(1);
  });
});
