import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'crypto';
import request from 'supertest';
import { createApp } from '../../server/app';
import { FirestorePlatformService } from '../../server/firestoreService';
import { WebhookService } from '../../server/deliverect/WebhookService';
import { SecretManager } from '../../server/secrets';
import { setServerRuntimeMode } from '../../server/runtimeMode';

describe('SEC-03 Deliverect webhook security', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.APP_MODE = 'staging';
    process.env.DELIVERECT_ENV = 'staging';
    delete process.env.ALLOW_STAGING_CHANNEL_HMAC;
    setServerRuntimeMode('staging');
  });

  afterEach(() => {
    delete process.env.APP_MODE;
    delete process.env.DELIVERECT_ENV;
    delete process.env.ALLOW_STAGING_CHANNEL_HMAC;
    setServerRuntimeMode(null);
    vi.restoreAllMocks();
  });

  it('returns 404 for an unknown route identifier before any Secret Manager lookup', async () => {
    vi.spyOn(FirestorePlatformService, 'resolveTenantByWebhookIdentifier').mockResolvedValue(null);
    const secretLookup = vi.spyOn(SecretManager, 'getSecret').mockResolvedValue(null);

    const app = await createApp({ serveFrontend: false, initializeDependencies: false });
    const response = await request(app)
      .post('/api/v1/webhooks/deliverect/not-provisioned')
      .set('Content-Type', 'application/json')
      .send({ status: 20 })
      .expect(404);

    expect(response.body.code).toBe('WEBHOOK_TENANT_NOT_FOUND');
    expect(secretLookup).not.toHaveBeenCalled();
  });

  it('rejects a mapped channel-link HMAC by default when the staging escape hatch is off', async () => {
    const rawBody = Buffer.from(JSON.stringify({ status: 20 }), 'utf8');
    const temporarySecret = 'channel-link-secret';
    const signature = crypto
      .createHmac('sha256', temporarySecret)
      .update(rawBody)
      .digest('hex');

    vi.spyOn(SecretManager, 'getSecret').mockResolvedValue(null);
    vi.spyOn(FirestorePlatformService, 'getIntegrationConfig').mockResolvedValue({
      tenantId: 'brand-alpha',
      environment: 'staging',
    } as any);

    await expect(
      WebhookService.resolveTenantForWebhook(
        rawBody,
        signature,
        'brand-alpha',
        { stagingTemporarySecrets: [temporarySecret] }
      )
    ).rejects.toMatchObject({ code: 'WEBHOOK_SIGNATURE_INVALID' });
  });

  it('deduplicates the same tenant and raw body even when Deliverect sends a new event id', async () => {
    const rawBody = Buffer.from(JSON.stringify({ status: 20 }), 'utf8');
    vi.spyOn(WebhookService, 'resolveTenantForWebhook').mockResolvedValue({
      tenantId: 'brand-alpha',
      secret: 'canonical',
    });
    const claim = vi
      .spyOn(FirestorePlatformService, 'claimWebhookIdempotency')
      .mockResolvedValue({
        claimed: false,
        existingEventId: 'existing-event',
      } as any);

    await WebhookService.processWebhook(
      { status: 20 },
      rawBody,
      { 'x-deliverect-event-id': 'event-one' },
      'brand-alpha'
    );
    await WebhookService.processWebhook(
      { status: 20 },
      rawBody,
      { 'x-deliverect-event-id': 'event-two' },
      'brand-alpha'
    );

    expect(claim).toHaveBeenCalledTimes(2);
    const firstKey = claim.mock.calls[0][1];
    const secondKey = claim.mock.calls[1][1];
    expect(firstKey).toBe(secondKey);
    expect(firstKey).toBe(
      crypto
        .createHash('sha256')
        .update(Buffer.from('brand-alpha:', 'utf8'))
        .update(rawBody)
        .digest('hex')
    );
  });

  it('rejects stale timestamped payloads before claiming idempotency', async () => {
    const stale = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const rawBody = Buffer.from(JSON.stringify({ status: 20, timestamp: stale }), 'utf8');
    vi.spyOn(WebhookService, 'resolveTenantForWebhook').mockResolvedValue({
      tenantId: 'brand-alpha',
      secret: 'canonical',
    });
    const claim = vi.spyOn(FirestorePlatformService, 'claimWebhookIdempotency');

    await expect(
      WebhookService.processWebhook(
        { status: 20, timestamp: stale },
        rawBody,
        {},
        'brand-alpha'
      )
    ).rejects.toMatchObject({ code: 'WEBHOOK_TIMESTAMP_STALE', statusCode: 400 });

    expect(claim).not.toHaveBeenCalled();
  });

  it('returns 413 for a 2 MB status webhook before HMAC processing', async () => {
    const app = await createApp({ serveFrontend: false, initializeDependencies: false });
    const response = await request(app)
      .post('/api/v1/webhooks/deliverect/brand-alpha/picking/status')
      .set('Content-Type', 'application/json')
      .send({ padding: 'x'.repeat(2 * 1024 * 1024) })
      .expect(413);

    expect(response.body.code).toBe('WEBHOOK_PAYLOAD_TOO_LARGE');
    expect(response.body.limitBytes).toBe(256 * 1024);
  });

  it('fails startup if staging Channel HMAC is enabled in production', async () => {
    process.env.APP_MODE = 'production';
    process.env.ALLOW_STAGING_CHANNEL_HMAC = 'true';
    setServerRuntimeMode('production');

    await expect(
      createApp({ serveFrontend: false, initializeDependencies: false })
    ).rejects.toThrow(/ALLOW_STAGING_CHANNEL_HMAC/);
  });
});
