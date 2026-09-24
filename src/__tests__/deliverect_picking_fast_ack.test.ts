import crypto from 'crypto';
import express from 'express';
import http from 'http';
import { AddressInfo } from 'net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { v1Router } from '../../server/api/v1Router';
import {
  PickingStatusIngressService,
  type PickingStatusQueueClient,
} from '../../server/deliverect/PickingStatusIngressService';
import { setServerRuntimeMode } from '../../server/runtimeMode';

describe('Deliverect picker status fast acknowledgement', () => {
  let server: http.Server;
  let baseUrl = '';
  let enqueue: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    setServerRuntimeMode('demo');
    enqueue = vi.fn().mockResolvedValue(undefined);
    PickingStatusIngressService.setQueueClient({
      enqueue,
    } as PickingStatusQueueClient);

    const app = express();
    app.use(
      express.json({
        verify: (req: any, _res, buf) => {
          req.rawBody = buf;
        },
      })
    );
    app.use('/api/v1', v1Router);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    PickingStatusIngressService.setQueueClient(null);
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('returns plain 200 after authentication and queues the picking event', async () => {
    const payload = {
      event: 'PICKING_STARTED',
      orderId: 'order-123',
      channelOrderId: 'LT26390001',
      channelLinkId: 'store-1',
    };
    const raw = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', 'demo_deliverect_webhook_secret_key_123')
      .update(raw)
      .digest('hex');

    const res = await fetch(
      `${baseUrl}/webhooks/deliverect/brand-alpha/picking/status`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-deliverect-signature': signature,
          'x-deliverect-event-id': 'pick-start-123',
        },
        body: raw,
      }
    );

    expect(res.status).toBe(200);
    expect(await res.text()).toBe('OK');
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue.mock.calls[0][0]).toMatchObject({
      tenantId: 'brand-alpha',
      eventId: 'pick-start-123',
      payload: expect.objectContaining({
        status: 'PICKING_STARTED',
        channelOrderId: 'LT26390001',
      }),
    });
  });

  it('preserves an explicit PICKING_STATUS_UPDATE envelope and normalizes its eventData status', async () => {
    const payload = {
      eventId: 'snappy-pick-1',
      eventType: 'PICKING_STATUS_UPDATE',
      eventData: {
        channelOrderId: 'LT-PICK-1',
        channelLink: 'store-1',
        status: 'PICKING_STARTED',
      },
    };
    const raw = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', 'demo_deliverect_webhook_secret_key_123')
      .update(raw)
      .digest('hex');

    const res = await fetch(
      `${baseUrl}/webhooks/deliverect/brand-alpha/picking/status`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-deliverect-signature': signature,
        },
        body: raw,
      }
    );

    expect(res.status).toBe(200);
    expect(await res.text()).toBe('OK');
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue.mock.calls[0][0]).toMatchObject({
      tenantId: 'brand-alpha',
      eventId: 'snappy-pick-1',
      payload: expect.objectContaining({
        eventType: 'PICKING_STATUS_UPDATE',
        status: 'PICKING_STARTED',
        pickingStatus: 'PICKING_STARTED',
        channelOrderId: 'LT-PICK-1',
        channelLinkId: 'store-1',
      }),
    });
  });

  it('does not coerce a generic numeric order status into a picking event', async () => {
    const payload = {
      orderId: '6ab5302954810e7f7f2f7fdf',
      status: 25,
      timeStamp: '2026-09-24T14:14:01.937425Z',
      reason: 'Waiting for order to be released by LEITCHTECH',
      channelOrderId: 'LT2639000C',
      location: '685180831c3ddaa7f6d02a8f',
      channelLink: '6ab3f5966c7eb5ae3baf869f',
    };
    const raw = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', 'demo_deliverect_webhook_secret_key_123')
      .update(raw)
      .digest('hex');

    const res = await fetch(
      `${baseUrl}/webhooks/deliverect/brand-alpha/picking/status`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-deliverect-signature': signature,
        },
        body: raw,
      }
    );

    expect(res.status).toBe(200);
    expect(await res.text()).toBe('OK');
    expect(enqueue).toHaveBeenCalledTimes(1);

    const queued = enqueue.mock.calls[0][0];
    expect(queued.payload.status).toBe(25);
    expect(queued.payload.reason).toContain('Waiting for order to be released');
    expect(queued.payload).not.toHaveProperty('pickingStatus');
    expect(queued.payload.channelOrderId).toBe('LT2639000C');
  });

  it('rejects a bad signature before queueing or acknowledging', async () => {
    const res = await fetch(
      `${baseUrl}/webhooks/deliverect/brand-alpha/picking/status`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-deliverect-signature': 'deadbeef',
        },
        body: JSON.stringify({
          event: 'PICKING_STARTED',
          orderId: 'order-123',
        }),
      }
    );

    expect(res.status).toBe(401);
    expect(enqueue).not.toHaveBeenCalled();
  });
});
