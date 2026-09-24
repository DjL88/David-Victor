import crypto from 'crypto';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../server/app';
import { FirestorePlatformService } from '../../server/firestoreService';
import { WebhookService } from '../../server/deliverect/WebhookService';
import { setServerRuntimeMode } from '../../server/runtimeMode';

describe('WP-08 signed webhook HTTP certification gate', () => {
  const tenantId = 'cert-http-tenant';
  const identifier = 'cert-http';
  const secret = 'cert-http-secret';

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.APP_MODE = 'staging';
    process.env.DELIVERECT_ENV = 'staging';
    setServerRuntimeMode('staging');
    WebhookService.resetWebhookIngressBucketsForTest();
    vi.spyOn(FirestorePlatformService, 'resolveTenantByWebhookIdentifier').mockResolvedValue(tenantId);
    vi.spyOn(FirestorePlatformService, 'getIntegrationConfig').mockResolvedValue({
      tenantId,
      environment: 'staging',
      webhookHmacSecret: secret,
    } as any);
  });

  afterEach(() => {
    delete process.env.APP_MODE;
    delete process.env.DELIVERECT_ENV;
    setServerRuntimeMode(null);
    WebhookService.resetWebhookIngressBucketsForTest();
    vi.restoreAllMocks();
  });

  const sign = (raw: string) => crypto.createHmac('sha256', secret).update(Buffer.from(raw)).digest('hex');

  it('preserves exact JSON bytes through Express and accepts a valid signed request', async () => {
    const raw = '{"status":20,"orderId":"order-cert-1","channelLinkId":"cl-cert"}';
    const resolver = vi.spyOn(WebhookService, 'resolveTenantForWebhook').mockImplementation(async (body, signature, candidate) => {
      expect(Buffer.isBuffer(body)).toBe(true);
      expect(body.toString('utf8')).toBe(raw);
      expect(signature).toBe(sign(raw));
      expect(candidate).toBe(tenantId);
      return { tenantId, secret } as any;
    });
    vi.spyOn(WebhookService, 'processWebhook').mockResolvedValue({ success: true } as any);

    const app = await createApp({ serveFrontend: false, initializeDependencies: false });
    const response = await request(app)
      .post(`/api/v1/webhooks/deliverect/${identifier}`)
      .set('content-type', 'application/json')
      .set('x-server-authorization-hmac-sha256', sign(raw))
      .send(raw);

    expect(response.status).toBe(200);
    expect(resolver).toHaveBeenCalledTimes(1);
  });

  it('rejects tampered bytes at the real HTTP boundary', async () => {
    const original = '{"status":20,"orderId":"order-cert-2"}';
    const tampered = '{"status":30,"orderId":"order-cert-2"}';
    vi.spyOn(WebhookService, 'resolveTenantForWebhook').mockImplementation(async (body, signature) => {
      const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
      if (signature !== expected) {
        const error: any = new Error('Invalid signature');
        error.statusCode = 401;
        error.code = 'WEBHOOK_SIGNATURE_INVALID';
        throw error;
      }
      return { tenantId, secret } as any;
    });

    const app = await createApp({ serveFrontend: false, initializeDependencies: false });
    const response = await request(app)
      .post(`/api/v1/webhooks/deliverect/${identifier}`)
      .set('content-type', 'application/json')
      .set('x-server-authorization-hmac-sha256', sign(original))
      .send(tampered);

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('WEBHOOK_SIGNATURE_INVALID');
  });

  it('rejects a missing signature through the same HTTP route', async () => {
    vi.spyOn(WebhookService, 'resolveTenantForWebhook').mockImplementation(async (_body, signature) => {
      if (!signature) {
        const error: any = new Error('Missing signature');
        error.statusCode = 401;
        error.code = 'WEBHOOK_SIGNATURE_REQUIRED';
        throw error;
      }
      return { tenantId, secret } as any;
    });
    const app = await createApp({ serveFrontend: false, initializeDependencies: false });
    const response = await request(app)
      .post(`/api/v1/webhooks/deliverect/${identifier}`)
      .set('content-type', 'application/json')
      .send('{"status":20}');
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('WEBHOOK_SIGNATURE_REQUIRED');
  });

  it('enforces status-webhook payload limits before application processing', async () => {
    const processSpy = vi.spyOn(WebhookService, 'processWebhook');
    const app = await createApp({ serveFrontend: false, initializeDependencies: false });
    const response = await request(app)
      .post(`/api/v1/webhooks/deliverect/${identifier}/picking/status`)
      .set('content-type', 'application/json')
      .send(JSON.stringify({ padding: 'x'.repeat(300 * 1024) }));
    expect(response.status).toBe(413);
    expect(response.body.code).toBe('WEBHOOK_PAYLOAD_TOO_LARGE');
    expect(processSpy).not.toHaveBeenCalled();
  });
});
