import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import http from 'http';
import type { AddressInfo } from 'net';
import { v1Router } from '../../server/api/v1Router';
import { WebhookService } from '../../server/deliverect/WebhookService';
import { FirestorePlatformService } from '../../server/firestoreService';
import { setServerRuntimeMode } from '../../server/runtimeMode';

describe('durable Deliverect channel ownership', () => {
  let server: http.Server;
  let baseUrl = '';
  let integration: any;
  const originalChannelBase = process.env.CHANNEL_PUBLIC_BASE_URL;
  const originalStagingHmac = process.env.ALLOW_STAGING_CHANNEL_HMAC;

  beforeEach(async () => {
    setServerRuntimeMode('staging');
    process.env.CHANNEL_PUBLIC_BASE_URL = 'https://channel.example.test';
    process.env.ALLOW_STAGING_CHANNEL_HMAC = 'true';

    integration = {
      tenantId: 'brand-alpha',
      deliverectAccountId: 'account-123',
      allowedChannelLinkIds: ['channel-link-789'],
      environment: 'staging',
      status: 'COMMERCE_VERIFIED',
    };

    vi.spyOn(FirestorePlatformService, 'resolveTenantByWebhookIdentifier')
      .mockResolvedValue('brand-alpha');
    vi.spyOn(FirestorePlatformService, 'getIntegrationConfig')
      .mockImplementation(async () => integration);
    vi.spyOn(FirestorePlatformService, 'updateIntegrationConfig')
      .mockImplementation(async (_tenantId: string, updates: any) => {
        integration = { ...integration, ...updates };
        return integration;
      });
    vi.spyOn(FirestorePlatformService, 'getIntegrationProfile').mockResolvedValue(null);
    vi.spyOn(FirestorePlatformService, 'getTenantStores').mockResolvedValue([{
      channelLinkId: 'channel-link-789',
      deliverectLocationId: 'location-456',
      physicalLocationId: 'loc_location-456',
      externalLocationId: 'external-100',
      lifecycleStatus: 'ACTIVE',
    }] as any);
    vi.spyOn(FirestorePlatformService, 'saveTenantStore')
      .mockImplementation(async (_tenantId: string, store: any) => store);
    vi.spyOn(FirestorePlatformService, 'addAuditLog').mockResolvedValue({} as any);

    const app = express();
    app.use(express.json({
      verify: (req: any, _res, buf) => { req.rawBody = buf; },
    }));
    app.use('/api/v1', v1Router);
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (originalChannelBase === undefined) delete process.env.CHANNEL_PUBLIC_BASE_URL;
    else process.env.CHANNEL_PUBLIC_BASE_URL = originalChannelBase;
    if (originalStagingHmac === undefined) delete process.env.ALLOW_STAGING_CHANNEL_HMAC;
    else process.env.ALLOW_STAGING_CHANNEL_HMAC = originalStagingHmac;
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  async function register() {
    const payload = {
      accountId: 'account-123',
      locationId: 'location-456',
      channelLinkId: 'channel-link-789',
      channelLocationId: 'external-100',
      status: 'register',
    };
    const rawBody = JSON.stringify(payload);
    const signature = WebhookService.computeHmacSignature(rawBody, payload.channelLinkId);
    return fetch(`${baseUrl}/webhooks/deliverect/account-123/channel/register`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-server-authorization-hmac-sha256': signature,
      },
      body: rawBody,
    });
  }

  it('keeps an explicit unassignment authoritative across a signed registration callback', async () => {
    integration.allowedChannelLinkIds = [];

    const response = await register();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.registration.warnings).toContain('CHANNEL_NOT_ASSIGNED');
    expect(FirestorePlatformService.updateIntegrationConfig).not.toHaveBeenCalled();
    expect(FirestorePlatformService.saveTenantStore).toHaveBeenCalledWith(
      'brand-alpha',
      expect.objectContaining({ channelLinkId: 'channel-link-789', assigned: false })
    );
  });

  it('initialises canonical ownership for a legacy tenant only when no explicit assignment state exists', async () => {
    delete integration.allowedChannelLinkIds;

    const response = await register();
    expect(response.status).toBe(200);
    expect(FirestorePlatformService.updateIntegrationConfig).toHaveBeenCalledWith(
      'brand-alpha',
      expect.objectContaining({ allowedChannelLinkIds: ['channel-link-789'] })
    );
    expect(FirestorePlatformService.saveTenantStore).toHaveBeenCalledWith(
      'brand-alpha',
      expect.objectContaining({ channelLinkId: 'channel-link-789', assigned: true })
    );
  });

  it('does not overwrite an environment profile assignment when the legacy integration has no array', async () => {
    delete integration.allowedChannelLinkIds;
    vi.mocked(FirestorePlatformService.getIntegrationProfile).mockResolvedValue({
      id: 'brand-alpha__staging',
      tenantId: 'brand-alpha',
      environment: 'staging',
      status: 'ACTIVE',
      version: 1,
      credentialMode: 'platform',
      allowedChannelLinkIds: [],
      deliverect: {},
      secretRefs: {},
    } as any);

    const response = await register();
    expect(response.status).toBe(200);
    expect(FirestorePlatformService.updateIntegrationConfig).not.toHaveBeenCalled();
    expect(FirestorePlatformService.saveTenantStore).toHaveBeenCalledWith(
      'brand-alpha',
      expect.objectContaining({ channelLinkId: 'channel-link-789', assigned: false })
    );
  });
});
