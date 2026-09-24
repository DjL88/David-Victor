import crypto from 'crypto';
import { describe, expect, it } from 'vitest';
import { DeliverectWebhookAuthenticator } from '../commerce/WebhookAuthenticator';

describe('SEC-04 webhook authenticator security', () => {
  const secret = 'test-webhook-secret';
  const body = Buffer.from('{"orderId":"order-1","status":"accepted"}', 'utf8');
  const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');

  it('accepts the exact raw bytes with a valid Deliverect HMAC', () => {
    const auth = new DeliverectWebhookAuthenticator(secret);
    expect(auth.authenticate({ 'x-server-authorization-hmac-sha256': signature }, body)).toBe(true);
    expect(auth.authenticate({ 'x-server-authorization-hmac-sha256': `sha256=${signature}` }, body)).toBe(true);
  });

  it('rejects tampered payloads, malformed signatures and missing secrets', () => {
    const auth = new DeliverectWebhookAuthenticator(secret);
    expect(auth.authenticate({ 'x-server-authorization-hmac-sha256': signature }, Buffer.from('{}'))).toBe(false);
    expect(auth.authenticate({ 'x-server-authorization-hmac-sha256': 'not-a-digest' }, body)).toBe(false);
    expect(auth.authenticate({}, body)).toBe(false);
    expect(new DeliverectWebhookAuthenticator().authenticate({ 'x-server-authorization-hmac-sha256': signature }, body)).toBe(false);
  });

  it('uses the first signature when a repeated header is represented as an array', () => {
    const auth = new DeliverectWebhookAuthenticator(secret);
    expect(auth.authenticate({ 'x-server-authorization-hmac-sha256': [signature, 'bad'] }, body)).toBe(true);
  });
});
