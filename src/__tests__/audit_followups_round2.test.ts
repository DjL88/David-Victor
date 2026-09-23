import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');

describe('audit follow-up security and routing closures', () => {
  it('protects dispatch mutation routes with operations authentication', () => {
    const source = read('server/api/v1Router.ts');
    expect(source).toContain("v1Router.post('/dispatch/assign', requireAdminAuth('operationsEditor')");
    expect(source).toContain("v1Router.post('/dispatch/cancel', requireAdminAuth('operationsEditor')");
  });

  it('does not accept the shared Deliverect webhook secret in live tenant resolution', () => {
    const source = read('server/deliverect/WebhookService.ts');
    expect(source).not.toContain('Legacy shared secret is accepted');
    expect(source).toContain("if (isDemoMode() || process.env.NODE_ENV === 'test')");
  });

  it('invalidates commerce discovery caches after menu and snooze mutations', () => {
    const source = read('server/deliverect/DeliverectOperationalWebhookService.ts');
    const calls = source.match(/CommerceDiscoveryService\.getInstance\(\)\.clearCache\(\)/g) || [];
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });

  it('requires ownership proof for guest order reads and stores only a hash', () => {
    const router = read('server/api/v1Router.ts');
    const persistence = read('server/firestoreService.ts');
    expect(router).toContain("req.headers['x-order-access-token']");
    expect(router).toContain("crypto.timingSafeEqual");
    expect(router).toContain("crypto.createHash('sha256')");
    expect(persistence).toContain('orderAccessTokenHash: orderAccessTokenHash || undefined');
  });

  it('keeps domain activation fail-closed behind DNS re-verification and TLS readiness', () => {
    const source = read('server/api/v1Router.ts');
    expect(source).toContain("'/admin/domains/:domainId/activate'");
    expect(source).toContain("requireAdminAuth('platformSuperAdmin')");
    expect(source).toContain("req.body?.tlsReady !== true");
    expect(source).toContain('FirebaseAuthDomainService.ensureAuthorizedDomain');
  });

  it('code-splits admin and checkout and renders CMS routes', () => {
    const app = read('src/App.tsx');
    const layout = read('src/app/AppLayout.tsx');
    expect(app).toContain("lazy(() =>");
    expect(app).toContain("import('./admin/AdminLayout')");
    expect(layout).toContain("import('../features/checkout/CheckoutModal')");
    expect(layout).toContain("activeRoute.kind === 'cms'");
    expect(layout).toContain('<CmsPageScreen');
  });
});
