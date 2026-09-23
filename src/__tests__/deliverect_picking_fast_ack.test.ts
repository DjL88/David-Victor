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
