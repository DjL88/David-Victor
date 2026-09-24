import crypto from 'crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebhookService } from '../../server/deliverect/WebhookService';
import { FirestorePlatformService } from '../../server/firestoreService';
import { SecretManager } from '../../server/secrets';

const sign = (raw: string, secret: string) =>
  crypto.createHmac('sha256', secret).update(Buffer.from(raw, 'utf8')).digest('hex');

describe('Deliverect HMAC certification contract', () => {
  afterEach(() => {
    delete process.env.APP_MODE;
    delete process.env.DELIVERECT_ENV;
    vi.restoreAllMocks();
    WebhookService.resetWebhookIngressBucketsForTest();
  });

  it('accepts Deliverect staging HMAC using an already-mapped channelLinkId', async () => {
    process.env.APP_MODE = 'staging';
    process.env.DELIVERECT_ENV = 'staging';
    const raw = '{"channelLinkId":"cl-staging-123","status":"PAUSED"}';

    vi.spyOn(SecretManager, 'getSecret').mockResolvedValue(undefined as any);
    vi.spyOn(FirestorePlatformService, 'getIntegrationConfig').mockResolvedValue({
      tenantId: 'tenant-a',
      environment: 'staging',
      allowedChannelLinkIds: ['cl-staging-123'],
    } as any);
    vi.spyOn(FirestorePlatformService, 'getTenantStores').mockResolvedValue([
      { id: 'store-a', channelLinkId: 'cl-staging-123', lifecycleStatus: 'ACTIVE' },
    ] as any);

    const temporarySecrets = await WebhookService.getMappedStagingChannelLinkSecrets(
      'tenant-a',
      JSON.parse(raw)
    );
    expect(temporarySecrets).toContain('cl-staging-123');

    await expect(
      WebhookService.resolveTenantForWebhook(
        Buffer.from(raw),
        sign(raw, 'cl-staging-123'),
        'tenant-a',
        { stagingTemporarySecrets: temporarySecrets }
      )
    ).resolves.toMatchObject({ tenantId: 'tenant-a', secret: 'cl-staging-123' });
  });

  it('accepts a mapped staging locationId where Deliverect uses location as the temporary secret', async () => {
    process.env.APP_MODE = 'staging';
    process.env.DELIVERECT_ENV = 'staging';
    const raw = '{"locationId":"loc-deliverect-9","status":"ONLINE"}';

    vi.spyOn(SecretManager, 'getSecret').mockResolvedValue(undefined as any);
    vi.spyOn(FirestorePlatformService, 'getIntegrationConfig').mockResolvedValue({
      tenantId: 'tenant-a',
      environment: 'staging',
    } as any);
    vi.spyOn(FirestorePlatformService, 'getTenantStores').mockResolvedValue([
      {
        id: 'store-a',
        channelLinkId: 'cl-staging-123',
        deliverectLocationId: 'loc-deliverect-9',
        lifecycleStatus: 'ACTIVE',
      },
    ] as any);

    const temporarySecrets = await WebhookService.getMappedStagingChannelLinkSecrets(
      'tenant-a',
      JSON.parse(raw)
    );
    expect(temporarySecrets).toContain('loc-deliverect-9');

    await expect(
      WebhookService.resolveTenantForWebhook(
        Buffer.from(raw),
        sign(raw, 'loc-deliverect-9'),
        'tenant-a',
        { stagingTemporarySecrets: temporarySecrets }
      )
    ).resolves.toMatchObject({ tenantId: 'tenant-a', secret: 'loc-deliverect-9' });
  });

  it('never accepts channelLink/location temporary secrets in production', async () => {
    process.env.APP_MODE = 'production';
    process.env.DELIVERECT_ENV = 'production';
    const raw = '{"channelLinkId":"cl-prod-123","status":"PAUSED"}';

    vi.spyOn(SecretManager, 'getSecret').mockResolvedValue(undefined as any);
    vi.spyOn(FirestorePlatformService, 'getIntegrationConfig').mockResolvedValue({
      tenantId: 'tenant-a',
      environment: 'production',
      allowedChannelLinkIds: ['cl-prod-123'],
    } as any);

    await expect(
      WebhookService.resolveTenantForWebhook(
        Buffer.from(raw),
        sign(raw, 'cl-prod-123'),
        'tenant-a',
        { stagingTemporarySecrets: ['cl-prod-123'] }
      )
    ).rejects.toMatchObject({ statusCode: 401, code: 'WEBHOOK_SIGNATURE_INVALID' });
  });

  it('signs exact raw bytes: formatting changes invalidate the signature', () => {
    const secret = 'cert-secret';
    const raw = '{"a":1,"b":2}';
    const reformatted = '{ "a": 1, "b": 2 }';
    const signature = sign(raw, secret);

    expect(WebhookService.verifyDeliverectHmac(Buffer.from(raw), signature, secret)).toBe(true);
    expect(WebhookService.verifyDeliverectHmac(Buffer.from(reformatted), signature, secret)).toBe(false);
  });
});
