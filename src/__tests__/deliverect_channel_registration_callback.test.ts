import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import http from 'http';
import type { AddressInfo } from 'net';
import { v1Router } from '../../server/api/v1Router';
import { WebhookService } from '../../server/deliverect/WebhookService';
import { FirestorePlatformService } from '../../server/firestoreService';
import { setServerRuntimeMode } from '../../server/runtimeMode';

describe('Deliverect Channel registration callback', () => {
  let server: http.Server;
  let baseUrl = '';
  const originalChannelBase = process.env.CHANNEL_PUBLIC_BASE_URL;

  beforeEach(async () => {
    setServerRuntimeMode('staging');
    process.env.CHANNEL_PUBLIC_BASE_URL = 'https://channel.example.test';

    vi.spyOn(FirestorePlatformService, 'resolveTenantByIntegrationId')
      .mockResolvedValue(null);
    vi.spyOn(FirestorePlatformService, 'resolveTenantByDeliverectAccountId')
      .mockImplementation(async (accountId: string) =>
        accountId === 'account-123' ? 'brand-alpha' : null
      );
    vi.spyOn(FirestorePlatformService, 'getIntegrationConfig')
      .mockResolvedValue({
        tenantId: 'brand-alpha',
        deliverectAccountId: 'account-123',
        allowedChannelLinkIds: ['channel-link-789'],
        environment: 'staging',
        status: 'COMMERCE_VERIFIED',
      } as any);
    vi.spyOn(FirestorePlatformService, 'saveTenantStore')
      .mockImplementation(async (_tenantId: string, store: any) => store);
    vi.spyOn(FirestorePlatformService, 'getTenantStores')
      .mockResolvedValue([
        {
          id: 'channel-link-789',
          channelLinkId: 'channel-link-789',
          deliverectLocationId: 'location-456',
          physicalLocationId: 'loc_location-456',
          externalLocationId: 'external-100',
          lifecycleStatus: 'ACTIVE',
        },
      ] as any);
    vi.spyOn(FirestorePlatformService, 'addAuditLog')
      .mockResolvedValue({} as any);
    vi.spyOn(FirestorePlatformService, 'saveStoreOperationalState')
      .mockResolvedValue({} as any);
    vi.spyOn(FirestorePlatformService, 'claimWebhookIdempotency')
      .mockResolvedValue({ claimed: true } as any);

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
    vi.restoreAllMocks();
    if (originalChannelBase === undefined) {
      delete process.env.CHANNEL_PUBLIC_BASE_URL;
    } else {
      process.env.CHANNEL_PUBLIC_BASE_URL = originalChannelBase;
    }
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  const registerPayload = {
    accountId: 'account-123',
    locationId: 'location-456',
    channelLinkId: 'channel-link-789',
    channelLocationId: 'external-100',
    channelLinkName: 'LeitchTech',
    status: 'register',
  };

  async function postRegister(path: string) {
    const rawBody = JSON.stringify(registerPayload);
    const signature = WebhookService.computeHmacSignature(
      rawBody,
      registerPayload.channelLinkId
    );

    return fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-server-authorization-hmac-sha256': signature,
      },
      body: rawBody,
    });
  }

  it('accepts the standardized registration URL using accountId routing and staging channelLink HMAC', async () => {
    const res = await postRegister('/webhooks/deliverect/channel/register');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toMatchObject({
      statusUpdateURL: 'https://channel.example.test/api/v1/webhooks/deliverect/brand-alpha',
      menuUpdateURL: 'https://channel.example.test/api/v1/webhooks/deliverect/brand-alpha/channel/menu_update',
      snoozeUnsnoozeURL: 'https://channel.example.test/api/v1/webhooks/deliverect/brand-alpha/channel/snooze',
      busyModeURL: 'https://channel.example.test/api/v1/webhooks/deliverect/brand-alpha/channel/busy_mode',
      updatePrepTimeURL: 'https://channel.example.test/api/v1/webhooks/deliverect/brand-alpha/channel/prep_time',
    });
    expect(body.registration.channelStatus).toBe('REGISTERED');
  });

  it('also accepts the account-id URL already configured in Deliverect staging', async () => {
    const res = await postRegister('/webhooks/deliverect/account-123/channel/register');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.registration.tenantId).toBe('brand-alpha');
  });
  it('accepts a staging menu push signed with its channelLinkId', async () => {
    const menuPayload = {
      accountId: 'account-123',
      locationId: 'location-456',
      channelLinkId: 'channel-link-789',
      menuId: 'menu-abc',
      menu: 'Internal Test',
      products: {},
      categories: [],
      modifiers: {},
      modifierGroups: {},
    };
    const rawBody = JSON.stringify(menuPayload);
    const signature = WebhookService.computeHmacSignature(
      rawBody,
      menuPayload.channelLinkId
    );

    const res = await fetch(
      `${baseUrl}/webhooks/deliverect/brand-alpha/channel/menu_update`,
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
    expect(body).toMatchObject({
      success: true,
      type: 'menu_update',
      channelLinkId: 'channel-link-789',
      menuId: 'menu-abc',
    });
  });
  it('resolves a live menu push to the mapped store when Deliverect omits channelLinkId', async () => {
    const menuPayload = {
      accountId: 'account-123',
      locationId: 'location-456',
      menuId: 'menu-no-channel-link',
      menu: 'Internal Test',
      products: {},
      categories: [],
      modifiers: {},
      modifierGroups: {},
    };
    const rawBody = JSON.stringify(menuPayload);
    const signature = WebhookService.computeHmacSignature(
      rawBody,
      menuPayload.locationId
    );

    const res = await fetch(
      `${baseUrl}/webhooks/deliverect/account-123/channel/menu_update`,
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
    expect(body).toMatchObject({
      success: true,
      type: 'menu_update',
      channelLinkId: 'channel-link-789',
      menuId: 'menu-no-channel-link',
    });
  });

  it('accepts a live staging menu push signed with the mapped location id fallback', async () => {
    const menuPayload = {
      accountId: 'account-123',
      locationId: 'location-456',
      channelLinkId: 'channel-link-789',
      menuId: 'menu-location-secret',
      menu: 'Internal Test',
      products: {},
      categories: [],
      modifiers: {},
      modifierGroups: {},
    };
    const rawBody = JSON.stringify(menuPayload);
    const signature = WebhookService.computeHmacSignature(
      rawBody,
      menuPayload.locationId
    );

    const res = await fetch(
      `${baseUrl}/webhooks/deliverect/brand-alpha/channel/menu_update`,
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
    expect(body).toMatchObject({
      success: true,
      type: 'menu_update',
      channelLinkId: 'channel-link-789',
      menuId: 'menu-location-secret',
    });
  });

  it('can verify a staging callback against canonical JSON if a hosting hop reformatted the body', async () => {
    const payload = {
      accountId: 'account-123',
      locationId: 'location-456',
      channelLinkId: 'channel-link-789',
      menuId: 'menu-canonical',
    };
    const canonicalBody = JSON.stringify(payload);
    const reformattedBody = JSON.stringify(payload, null, 2);
    const signature = WebhookService.computeHmacSignature(
      canonicalBody,
      payload.channelLinkId
    );

    const resolved = await WebhookService.resolveTenantForWebhook(
      reformattedBody,
      signature,
      'brand-alpha',
      {
        stagingTemporarySecrets: ['channel-link-789'],
        stagingAlternateBodies: [canonicalBody],
      }
    );

    expect(resolved).toEqual({
      tenantId: 'brand-alpha',
      secret: 'channel-link-789',
    });
  });

  it('rejects an arbitrary payload channelLinkId even when the caller self-signs with it', async () => {
    const forgedPayload = {
      ...registerPayload,
      channelLinkId: 'attacker-chosen-secret',
    };
    const rawBody = JSON.stringify(forgedPayload);
    const signature = WebhookService.computeHmacSignature(
      rawBody,
      forgedPayload.channelLinkId
    );

    const res = await fetch(
      `${baseUrl}/webhooks/deliverect/account-123/channel/register`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-server-authorization-hmac-sha256': signature,
        },
        body: rawBody,
      }
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe('WEBHOOK_SIGNATURE_INVALID');
  });


});
