import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebhookService } from '../../server/deliverect/WebhookService';
import { TenantSecretResolver } from '../../server/deliverect/IntegrationContext';
import { FirestorePlatformService } from '../../server/firestoreService';

describe('Deliverect staging Channel HMAC', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.DELIVERECT_ENV;
  });

  it('accepts Deliverect staging channelLinkId as the temporary HMAC secret for a mapped store', async () => {
    const tenantId = 'brand-channel-test';
    const channelLinkId = '6ab3f5966c7eb5ae3baf869f';
    const payload = {
      accountId: '68517fde1c3ddaa7f6d0275c',
      locationId: '685180831c3ddaa7f6d02a8f',
      channelLinkId,
      menuId: '6aad703bb3aef90f42ab33d6',
    };
    const rawBody = JSON.stringify(payload);
    const signature = WebhookService.computeHmacSignature(rawBody, channelLinkId);

    vi.spyOn(TenantSecretResolver, 'resolveTenantSecret').mockResolvedValue(null);
    vi.spyOn(FirestorePlatformService, 'getIntegrationConfig').mockResolvedValue({
      tenantId,
      environment: 'staging',
      status: 'COMMERCE_VERIFIED',
      deliverectAccountId: payload.accountId,
      allowedChannelLinkIds: [channelLinkId],
    } as any);
    vi.spyOn(FirestorePlatformService, 'getTenantStores').mockResolvedValue([
      { channelLinkId, deliverectLocationId: payload.locationId },
    ] as any);

    await expect(
      WebhookService.resolveTenantForWebhook(rawBody, signature, tenantId)
    ).resolves.toMatchObject({
      tenantId,
      secret: channelLinkId,
    });
  });

  it('does not allow the channelLinkId temporary secret in production', async () => {
    const tenantId = 'brand-channel-prod';
    const channelLinkId = '6ab3f5966c7eb5ae3baf869f';
    const payload = {
      accountId: '68517fde1c3ddaa7f6d0275c',
      channelLinkId,
      status: 'active',
    };
    const rawBody = JSON.stringify(payload);
    const signature = WebhookService.computeHmacSignature(rawBody, channelLinkId);

    process.env.DELIVERECT_ENV = 'production';
    vi.spyOn(TenantSecretResolver, 'resolveTenantSecret').mockResolvedValue(null);
    vi.spyOn(FirestorePlatformService, 'getIntegrationConfig').mockResolvedValue({
      tenantId,
      environment: 'production',
      status: 'CONNECTED',
      deliverectAccountId: payload.accountId,
      allowedChannelLinkIds: [channelLinkId],
    } as any);
    vi.spyOn(FirestorePlatformService, 'getTenantStores').mockResolvedValue([
      { channelLinkId },
    ] as any);

    await expect(
      WebhookService.resolveTenantForWebhook(rawBody, signature, tenantId)
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'WEBHOOK_SIGNATURE_INVALID',
    });
  });
});
