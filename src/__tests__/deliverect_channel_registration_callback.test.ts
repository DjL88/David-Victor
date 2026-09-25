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
    process.env.ALLOW_STAGING_CHANNEL_HMAC = 'true';

    vi.spyOn(FirestorePlatformService, 'resolveTenantByWebhookIdentifier')
      .mockImplementation(async (identifier: string) =>
        ['brand-alpha', 'account-123'].includes(identifier) ? 'brand-alpha' : null
      );
    vi.spyOn(FirestorePlatformService, 'getIntegrationConfig')
      .mockResolvedValue({
        tenantId: 'brand-alpha',
        deliverectAccountId: 'account-123',
        allowedChannelLinkIds: ['channel-link-789'],
        environment: 'staging',
        status: 'COMMERCE_VERIFIED',
      } as any);
    vi.spyOn(FirestorePlatformService, 'getIntegrationProfile')
      .mockResolvedValue(null);
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
    delete process.env.ALLOW_STAGING_CHANNEL_HMAC;
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

  it('rejects the legacy no-identifier registration URL before HMAC lookup', async () => {
    const res = await postRegister('/webhooks/deliverect/channel/register');
    expect(res.status).toBe(404);
  });

  it('also accepts the account-id URL already configured in Deliverect staging', async () => {
    const res = await postRegister('/webhooks/deliverect/account-123/channel/register');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.registration.tenantId).toBe('brand-alpha');
  });
  it('uses the trusted profile origin and ignores attacker-controlled forwarded hosts', async () => {
    vi.mocked(FirestorePlatformService.getIntegrationProfile).mockResolvedValue({
      id: 'brand-alpha__staging',
      tenantId: 'brand-alpha',
      environment: 'staging',
      status: 'ACTIVE',
      version: 1,
      publicBaseUrl: 'https://brand-alpha.integrations.example.test',
      credentialMode: 'platform',
      allowedChannelLinkIds: ['channel-link-789'],
      deliverect: {},
      secretRefs: {},
    } as any);

    const rawBody = JSON.stringify(registerPayload);
    const signature = WebhookService.computeHmacSignature(rawBody, registerPayload.channelLinkId);
    const res = await fetch(`${baseUrl}/webhooks/deliverect/account-123/channel/register`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-server-authorization-hmac-sha256': signature,
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'attacker.example.test',
      },
      body: rawBody,
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    const expectedBase = 'https://brand-alpha.integrations.example.test/api/v1/webhooks/deliverect/brand-alpha';
    expect(body.statusUpdateURL).toBe(expectedBase);
    expect(body.menuUpdateURL).toBe(`${expectedBase}/channel/menu_update`);
    expect(body.snoozeUnsnoozeURL).toBe(`${expectedBase}/channel/snooze`);
    expect(body.busyModeURL).toBe(`${expectedBase}/channel/busy_mode`);
    expect(body.updatePrepTimeURL).toBe(`${expectedBase}/channel/prep_time`);
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
      accepted: true,
      status: 'PROCESSED',
      menuIds: ['menu-abc'],
      channelLinkIds: ['channel-link-789'],
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
      accepted: true,
      status: 'PROCESSED',
      menuIds: ['menu-no-channel-link'],
      channelLinkIds: ['channel-link-789'],
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
      accepted: true,
      status: 'PROCESSED',
      menuIds: ['menu-location-secret'],
      channelLinkIds: ['channel-link-789'],
    });
  });

  it('rejects a staging callback when the signed bytes differ from the received bytes', async () => {
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

    await expect(
      WebhookService.resolveTenantForWebhook(
        reformattedBody,
        signature,
        'brand-alpha',
        { stagingTemporarySecrets: ['channel-link-789'] }
      )
    ).rejects.toMatchObject({ code: 'WEBHOOK_SIGNATURE_INVALID' });
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
