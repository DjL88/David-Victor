import crypto from 'crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server/app';
import { WebhookService } from '../../server/deliverect/WebhookService';
import { SecretManager } from '../../server/secrets';
import { setServerRuntimeMode } from '../../server/runtimeMode';

describe('SEC-03 canonical Deliverect webhook security', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.APP_MODE = 'staging';
    process.env.DELIVERECT_ENV = 'staging';
    delete process.env.ALLOW_STAGING_CHANNEL_HMAC;
    setServerRuntimeMode('staging');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setServerRuntimeMode(null);
    delete process.env.APP_MODE;
    delete process.env.DELIVERECT_ENV;
    delete process.env.ALLOW_STAGING_CHANNEL_HMAC;
  });

  it('rejects a channelLinkId staging signature by default', async () => {
    const raw = Buffer.from(JSON.stringify({ status: 'PICKING_STARTED' }));
    const channelLinkSecret = 'channel-link-secret';
    const signature = crypto.createHmac('sha256', channelLinkSecret).update(raw).digest('hex');

    await expect(
      WebhookService.resolveTenantForWebhook(
        raw,
        signature,
        'brand-alpha',
        { stagingTemporarySecrets: [channelLinkSecret] }
      )
    ).rejects.toMatchObject({ code: expect.stringMatching(/WEBHOOK_(SIGNATURE_INVALID|SECRET_MISSING)/) });
  });

  it('dedupes an exact replay even when the provider sends a different event ID', async () => {
    const payload = {
      status: 'PICKING_STARTED',
      timestamp: new Date().toISOString(),
      marker: 'sec03-replay-' + Date.now(),
    };
    const raw = Buffer.from(JSON.stringify(payload));
    const secret = WebhookService.getWebhookSecret('brand-alpha');
    const signature = WebhookService.computeHmacSignature(raw, secret);

    const first = await WebhookService.processWebhook(
      payload,
      raw,
      {
        'x-server-authorization-hmac-sha256': signature,
        'x-deliverect-event-id': 'provider-event-one',
      },
      'brand-alpha'
    );
    const second = await WebhookService.processWebhook(
      { ...payload, id: 'provider-event-two' },
      raw,
      {
        'x-server-authorization-hmac-sha256': signature,
        'x-deliverect-event-id': 'provider-event-two',
      },
      'brand-alpha'
    );

    expect(first.status).not.toBe('DEDUPLICATED');
    expect(second.status).toBe('DEDUPLICATED');
    expect(second.eventId).toBe(first.eventId);
  });

  it('returns 404 for an unknown path identifier without consulting Secret Manager', async () => {
    const secretSpy = vi.spyOn(SecretManager, 'getSecret');
    const app = await createApp({ serveFrontend: false, initializeDependencies: false });

    const response = await request(app)
      .post('/api/v1/webhooks/deliverect/sec03-definitely-unknown/channel/busy_mode')
      .set('Host', 'localhost')
      .send({ status: 'busy' })
      .expect(404);

    expect(response.body.code).toBe('INTEGRATION_NOT_CONFIGURED');
    expect(secretSpy).not.toHaveBeenCalled();
  });

  it('rejects a 2 MB picking-status webhook at the 256 KB route boundary', async () => {
    const app = await createApp({ serveFrontend: false, initializeDependencies: false });
    const payload = JSON.stringify({ status: 'PICKING_STARTED', padding: 'x'.repeat(2 * 1024 * 1024) });

    const response = await request(app)
      .post('/api/v1/webhooks/deliverect/brand-alpha/picking/status')
      .set('Host', 'localhost')
      .set('Content-Type', 'application/json')
      .send(payload)
      .expect(413);

    expect(response.body.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('rejects webhook timestamps older than five minutes when present', () => {
    expect(() =>
      WebhookService.assertFreshWebhookTimestamp({
        timestamp: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
      })
    ).toThrow(/five-minute replay window/);
  });
});
