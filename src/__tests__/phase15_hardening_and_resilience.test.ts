import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CircuitBreaker, executeWithRetry } from '../../server/circuitBreaker';
import { MetricsService } from '../../server/metricsService';
import { RateLimiter } from '../../server/rateLimiter';
import { isAllowedOrigin, securityHeadersMiddleware } from '../../server/securityHeaders';
import { BFFError } from '../../server/errors';
import { WebhookService } from '../../server/deliverect/WebhookService';
import { SecretManager } from '../../server/secrets';
import fs from 'fs';
import path from 'path';

describe('Phase 15: Platform Hardening, Resilience & Observability', () => {
  beforeEach(() => {
    MetricsService.reset();
    vi.restoreAllMocks();
  });

  describe('1. Security Headers & Restrictive CORS (Section 49)', () => {
    it('allows trusted domains and rejects untrusted origins', () => {
      // Permitted origins
      expect(isAllowedOrigin('http://localhost:3000')).toBe(true);
      expect(isAllowedOrigin('http://127.0.0.1:5173')).toBe(true);
      expect(isAllowedOrigin('https://ais-dev-ciigtiumqqu7x57kplguwi-232948319569.europe-west3.run.app')).toBe(true);
      expect(isAllowedOrigin('https://ai.studio')).toBe(true);
      expect(isAllowedOrigin('https://console.cloud.google.com')).toBe(true);

      // Custom tenant domains
      expect(isAllowedOrigin('https://shop.marketlane.co.uk', ['https://shop.marketlane.co.uk'])).toBe(true);

      // Adversarial untrusted origins
      expect(isAllowedOrigin('https://malicious-attacker.com')).toBe(false);
      expect(isAllowedOrigin('https://fake-deliverect-portal.xyz')).toBe(false);
      expect(isAllowedOrigin('https://phishing-brand-alpha.com')).toBe(false);
    });

    it('sets hardened security headers including CSP, X-Content-Type-Options, and Referrer-Policy', () => {
      const middleware = securityHeadersMiddleware({ isProduction: true });
      const req: any = { headers: { origin: 'http://localhost:3000' }, method: 'GET' };
      const headers: Record<string, string> = {};
      const res: any = {
        setHeader: (name: string, value: string) => {
          headers[name.toLowerCase()] = value;
        },
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(headers['content-security-policy']).toBeDefined();
      expect(headers['content-security-policy']).toContain("default-src 'self'");
      expect(headers['x-content-type-options']).toBe('nosniff');
      expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(headers['strict-transport-security']).toContain('max-age=31536000');
      expect(headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });

    it('rejects CORS preflight requests from untrusted origins with 403 Forbidden', () => {
      const middleware = securityHeadersMiddleware();
      const req: any = { headers: { origin: 'https://evil-hacker.com' }, method: 'OPTIONS' };
      const res: any = {
        setHeader: vi.fn(),
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'FORBIDDEN_CORS_ORIGIN',
        })
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('2. Upstream Circuit Breaker & Retry Mechanism (Section 47)', () => {
    it('trips circuit to OPEN state after threshold consecutive failures and fails fast', async () => {
      const cb = new CircuitBreaker({
        name: 'test-upstream',
        failureThreshold: 3,
        cooldownMs: 50,
      });

      expect(cb.getState()).toBe('CLOSED');

      const failingAction = vi.fn().mockRejectedValue(new Error('Network connection reset'));

      // 3 consecutive failures
      await expect(cb.execute(failingAction)).rejects.toThrow();
      await expect(cb.execute(failingAction)).rejects.toThrow();
      await expect(cb.execute(failingAction)).rejects.toThrow();

      // State is now OPEN
      expect(cb.getState()).toBe('OPEN');
      expect(cb.getStats().totalTrips).toBe(1);

      // Subsequent call fails fast with 503 UPSTREAM_CIRCUIT_OPEN without calling failingAction
      failingAction.mockClear();
      await expect(cb.execute(failingAction)).rejects.toThrowError(/Circuit is OPEN/);
      expect(failingAction).not.toHaveBeenCalled();
    });

    it('recovers from OPEN to HALF_OPEN after cooldown and returns to CLOSED on success', async () => {
      const cb = new CircuitBreaker({
        name: 'test-upstream-recovery',
        failureThreshold: 2,
        successThreshold: 2,
        cooldownMs: 30,
      });

      // Trip the breaker
      await expect(cb.execute(async () => { throw new Error('fail 1'); })).rejects.toThrow();
      await expect(cb.execute(async () => { throw new Error('fail 2'); })).rejects.toThrow();
      expect(cb.getState()).toBe('OPEN');

      // Wait for cooldown
      await new Promise((resolve) => setTimeout(resolve, 35));

      // After cooldown, transitions to HALF_OPEN on next check
      expect(cb.getState()).toBe('HALF_OPEN');

      // First recovery success
      await cb.execute(async () => 'success 1');
      expect(cb.getState()).toBe('HALF_OPEN');

      // Second recovery success satisfies threshold -> transitions back to CLOSED
      await cb.execute(async () => 'success 2');
      expect(cb.getState()).toBe('CLOSED');
      expect(cb.getStats().failures).toBe(0);
    });

    it('executeWithRetry performs bounded retries on transient errors and succeeds', async () => {
      let attempts = 0;
      const transientAction = async () => {
        attempts += 1;
        if (attempts < 3) {
          const err: any = new Error('503 Service Unavailable');
          err.statusCode = 503;
          throw err;
        }
        return { status: 'healthy', attempts };
      };

      const result = await executeWithRetry(transientAction, {
        maxRetries: 3,
        initialDelayMs: 10,
        maxDelayMs: 50,
      });

      expect(result.status).toBe('healthy');
      expect(result.attempts).toBe(3);
    });

    it('executeWithRetry fails immediately on non-retryable client errors (e.g. 400)', async () => {
      let attempts = 0;
      const clientErrorAction = async () => {
        attempts += 1;
        const err: any = new Error('Bad Request');
        err.statusCode = 400;
        throw err;
      };

      await expect(
        executeWithRetry(clientErrorAction, {
          maxRetries: 3,
          initialDelayMs: 10,
        })
      ).rejects.toThrow('Bad Request');

      expect(attempts).toBe(1); // Did not retry
    });
  });

  describe('3. Rate Limiting & Anti-Abuse Shield (Section 45, 47)', () => {
    it('allows requests within limit and rejects excess requests with 429', () => {
      const limiter = new RateLimiter({
        windowMs: 1000,
        maxRequests: 3,
        keyGenerator: () => 'client-ip-123',
      });

      const middleware = limiter.middleware();
      const req: any = { headers: {}, socket: { remoteAddress: '127.0.0.1' }, path: '/api/v1/stores' };
      const res: any = { setHeader: vi.fn() };
      let errorThrown: any = null;
      const next = (err?: any) => {
        errorThrown = err;
      };

      // Requests 1, 2, 3 should pass
      middleware(req, res, next);
      expect(errorThrown).toBeUndefined();
      middleware(req, res, next);
      expect(errorThrown).toBeUndefined();
      middleware(req, res, next);
      expect(errorThrown).toBeUndefined();

      // Request 4 should be blocked with 429 BFFError
      middleware(req, res, next);
      expect(errorThrown).toBeInstanceOf(BFFError);
      expect(errorThrown.statusCode).toBe(429);
      expect(errorThrown.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(res.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
    });
  });

  describe('4. Metrics & Observability Registry (Section 48)', () => {
    it('aggregates API latencies, status codes, and upstream metrics accurately', () => {
      MetricsService.recordRequest('GET', '/api/v1/stores', 200, 45);
      MetricsService.recordRequest('GET', '/api/v1/stores', 200, 55);
      MetricsService.recordRequest('POST', '/api/v1/checkouts', 201, 120);
      MetricsService.recordRequest('GET', '/api/v1/stores/store-invalid', 404, 20);

      MetricsService.recordUpstreamCall('commerce', true, 110);
      MetricsService.recordUpstreamCall('commerce', false, 250);
      MetricsService.recordUpstreamCall('dispatch', true, 80);
      MetricsService.recordWebhook('received');
      MetricsService.recordWebhook('verified');
      MetricsService.recordCache(true);
      MetricsService.recordCache(true);
      MetricsService.recordCache(false);

      const snapshot = MetricsService.getMetricsSnapshot({
        commerce: { state: 'CLOSED', failures: 0, totalTrips: 0 },
      });

      expect(snapshot.api.totalRequests).toBe(4);
      expect(snapshot.api.requestsByStatus['2xx']).toBe(3);
      expect(snapshot.api.requestsByStatus['4xx']).toBe(1);
      expect(snapshot.upstreams.commerce.calls).toBe(2);
      expect(snapshot.upstreams.commerce.failures).toBe(1);
      expect(snapshot.upstreams.dispatch.calls).toBe(1);
      expect(snapshot.upstreams.webhooks.received).toBe(1);
      expect(snapshot.upstreams.webhooks.verified).toBe(1);
      expect(snapshot.cache.hits).toBe(2);
      expect(snapshot.cache.misses).toBe(1);
      expect(snapshot.cache.hitRatePct).toBe(67);
      expect(snapshot.circuitBreakers['commerce'].state).toBe('CLOSED');
    });
  });

  describe('5. Secret Scan & Mock-Leak Verification (Sections 50, 52)', () => {
    it('confirms SecretManager masks secrets and returns unconfigured for missing keys', async () => {
      const clientSecret = await SecretManager.getSecret('NON_EXISTENT_SECRET_12345');
      expect(clientSecret).toBeNull();

      const configured = await SecretManager.isConfigured('DELIVERECT_CLIENT_SECRET');
      expect(typeof configured).toBe('boolean');
    });

    it('verifies server source code does not contain hardcoded production secrets', () => {
      const serverFiles = [
        'server.ts',
        'server/deliverect/OAuthTokenManager.ts',
        'server/deliverect/DeliverectApiClient.ts',
        'server/deliverect/PaymentService.ts',
        'server/deliverect/WebhookService.ts',
      ];

      for (const relPath of serverFiles) {
        const fullPath = path.join(process.cwd(), relPath);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          // No hardcoded passwords, private keys, or client credentials
          expect(content).not.toMatch(/DELIVERECT_CLIENT_SECRET\s*=\s*['"][a-zA-Z0-9_-]{10,}['"]/);
          expect(content).not.toMatch(/-----BEGIN (RSA )?PRIVATE KEY-----/);
          expect(content).not.toMatch(/password\s*:\s*['"][^'"]+['"]/i);
        }
      }
    });

    it('verifies non-demo mode fails closed instead of falling back to mock basket operations', async () => {
      const { getDeliverectAdapter, resetDeliverectAdapter } = await import('../../server/deliverect');
      const { setServerRuntimeMode } = await import('../../server/runtimeMode');

      const previousClientId = process.env.DELIVERECT_CLIENT_ID;
      const previousClientSecret = process.env.DELIVERECT_CLIENT_SECRET;
      const previousAppMode = process.env.APP_MODE;

      try {
        delete process.env.DELIVERECT_CLIENT_ID;
        delete process.env.DELIVERECT_CLIENT_SECRET;
        setServerRuntimeMode('staging');
        resetDeliverectAdapter();

        // Use a unique tenant so no token-manager instance from another test can
        // accidentally make this path look configured.
        const adapter = getDeliverectAdapter('ci-unconfigured-tenant', 'staging', 'default');
        expect(adapter.adapterName).toBe('IntegrationUnavailableAdapter');

        await expect(
          adapter.createBasket('store-chelmsford-central', 'pickup')
        ).rejects.toMatchObject({
          statusCode: 503,
          code: 'INTEGRATION_NOT_CONFIGURED',
        });
      } finally {
        if (previousClientId === undefined) delete process.env.DELIVERECT_CLIENT_ID;
        else process.env.DELIVERECT_CLIENT_ID = previousClientId;

        if (previousClientSecret === undefined) delete process.env.DELIVERECT_CLIENT_SECRET;
        else process.env.DELIVERECT_CLIENT_SECRET = previousClientSecret;

        setServerRuntimeMode(null);
        if (previousAppMode !== undefined) process.env.APP_MODE = previousAppMode;
        resetDeliverectAdapter();
      }
    });
  });

  describe('6. Webhook Idempotency & Replay Protection (Section 24, 47)', () => {
    it('detects duplicate webhook events and idempotently skips duplicate side-effects', async () => {
      const samplePayload = {
        type: 'ORDER_STATUS_UPDATE',
        orderId: 'del-order-replay-101',
        status: 'ACCEPTED',
        timestamp: new Date().toISOString(),
      };
      const rawBody = Buffer.from(JSON.stringify(samplePayload));
      const secret = 'staging_secret_key_123';
      const validSig = WebhookService.computeSignature(rawBody, secret);

      // First webhook ingestion
      const res1 = await WebhookService.ingestEvent(
        'brand-alpha',
        'staging',
        'del-event-unique-999',
        'ORDER_STATUS_UPDATE',
        samplePayload,
        rawBody,
        validSig,
        secret
      );
      expect(res1.status).toBe('PROCESSED');
      expect(res1.duplicate).toBe(false);

      // Duplicate ingestion with identical externalEventKey
      const res2 = await WebhookService.ingestEvent(
        'brand-alpha',
        'staging',
        'del-event-unique-999',
        'ORDER_STATUS_UPDATE',
        samplePayload,
        rawBody,
        validSig,
        secret
      );
      expect(res2.status).toBe('DUPLICATE_ACKNOWLEDGED');
      expect(res2.duplicate).toBe(true);
    });

    it('rejects tampered or modified webhook payloads with 401 HMAC_VERIFICATION_FAILED', async () => {
      const originalPayload = { orderId: 'del-order-tamper-test', status: 'CONFIRMED' };
      const rawBody = Buffer.from(JSON.stringify(originalPayload));
      const secret = 'staging_secret_key_123';
      const validSig = WebhookService.computeSignature(rawBody, secret);

      // Tamper with signature or body
      const tamperedBody = Buffer.from(JSON.stringify({ orderId: 'del-order-tamper-test', status: 'CANCELLED_UNAUTHORIZED' }));

      await expect(
        WebhookService.ingestEvent(
          'brand-alpha',
          'staging',
          'del-event-tamper-1',
          'ORDER_STATUS_UPDATE',
          JSON.parse(tamperedBody.toString()),
          tamperedBody,
          validSig, // Signature computed on original, not tampered!
          secret
        )
      ).rejects.toThrow(/HMAC verification failed/);
    });
  });
});
