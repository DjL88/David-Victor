import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import http from 'http';
import { AddressInfo } from 'net';
import crypto from 'crypto';
import { v1Router } from '../../server/api/v1Router';
import { FirestorePlatformService } from '../../server/firestoreService';
import { setServerRuntimeMode } from '../../server/runtimeMode';

describe('Deliverect Channel registration contract', () => {
  let server: http.Server;
  let baseUrl = '';

  beforeEach(async () => {
    setServerRuntimeMode('staging');
    const app = express();
    app.use(express.json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    }));
    app.use('/api/v1', v1Router);
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    setServerRuntimeMode('demo');
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('accepts accountId-routed staging registration signed by channelLinkId and returns callback URLs', async () => {
    const suffix = Date.now().toString();
    const tenantId = `brand-registration-${suffix}`;
    const accountId = `account-${suffix}`;
    const channelLinkId = `channel-${suffix}`;

    await FirestorePlatformService.updateIntegrationConfig(tenantId, {
      deliverectAccountId: accountId,
      allowedChannelLinkIds: [channelLinkId],
      environment: 'staging',
      status: 'COMMERCE_VERIFIED',
    } as any);
    await FirestorePlatformService.saveTenantStore(tenantId, {
      channelLinkId,
      deliverectLocationId: `location-${suffix}`,
      lifecycleStatus: 'ACTIVE',
    });

    const payload = {
      accountId,
      locationId: `location-${suffix}`,
      channelLinkId,
      channelLocationId: `external-${suffix}`,
      channelLinkName: 'LeitchTech',
      status: 'register',
    };
    const rawBody = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', channelLinkId)
      .update(rawBody)
      .digest('hex');

    const res = await fetch(
      `${baseUrl}/webhooks/deliverect/${accountId}/channel/register`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-server-authorization-hmac-sha256': signature,
        },
        body: rawBody,
      }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.statusUpdateURL).toContain(
      `/api/v1/webhooks/deliverect/${tenantId}`
    );
    expect(body.menuUpdateURL).toContain('/channel/menu_update');
    expect(body.snoozeUnsnoozeURL).toContain('/channel/snooze');
    expect(body.busyModeURL).toContain('/channel/busy-mode');
    expect(body.updatePrepTimeURL).toContain('/channel/prep-time');
    expect(body.metadata).toMatchObject({
      tenantId,
      channelLinkId,
      status: 'register',
      quarantined: false,
    });
  });
});
