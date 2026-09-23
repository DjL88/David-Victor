import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

describe('commerce P0 security boundaries', () => {
  const routerSource = fs.readFileSync(path.resolve(process.cwd(), 'server/api/v1Router.ts'), 'utf8');
  const webhookSource = fs.readFileSync(path.resolve(process.cwd(), 'server/deliverect/WebhookService.ts'), 'utf8');
  const authSource = fs.readFileSync(path.resolve(process.cwd(), 'server/firebase.ts'), 'utf8');

  it('never lets the browser choose the DPay authorization amount', () => {
    expect(routerSource).not.toContain('checkoutOptions.authorizationMaximum || basket.total');
    expect(routerSource).toContain('PaymentService.calculateApprovedAuthorizationCeiling(basket.total)');
  });

  it('requires an existing DPay payment to be bound to the same tenant and basket', () => {
    expect(routerSource).toContain("code: 'PAYMENT_BASKET_MISMATCH'");
    expect(routerSource).toContain("code: 'TENANT_ISOLATION_ERROR'");
    expect(routerSource).toContain("code: 'PAYMENT_BINDING_REQUIRED'");
  });

  it('does not accept channelLinkId or other payload values as webhook HMAC secrets', () => {
    expect(webhookSource).not.toContain('Verified Deliverect staging webhook using channelLinkId HMAC fallback');
    expect(webhookSource).not.toContain('for (const stagingSecret of stagingSecrets)');
    expect(webhookSource).toContain('Never derive an HMAC secret from webhook payload fields');
  });

  it('does not bootstrap the first signed-in user or a hard-coded owner email as superadmin', () => {
    expect(authSource).not.toContain('isFirstAdmin');
    expect(authSource).not.toContain('First authenticated user');
    expect(authSource).not.toContain("'dleitch22@gmail.com'");
    expect(authSource).toContain('decoded.email_verified === true');
  });
});
