import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

describe('admin route security policy', () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), 'server/api/v1Router.ts'), 'utf8');

  it('requires an explicit capability or scoped role for every admin mutation', () => {
    const routePattern = /v1Router\.(post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]([\s\S]{0,360})/g;
    const unsecured: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = routePattern.exec(source))) {
      const [, method, route, middlewareHead] = match;
      if (!route.startsWith('/admin')) continue;
      const hasExplicitPolicy =
        /requireAdminCapability\(/.test(middlewareHead) ||
        /requirePlatformSuperAdmin\(/.test(middlewareHead) ||
        /requireAdminAuth\(\s*['"]/.test(middlewareHead);

      if (!hasExplicitPolicy) unsecured.push(`${method.toUpperCase()} ${route}`);
    }

    expect(unsecured, `Admin mutations missing an explicit permission policy: ${unsecured.join(', ')}`).toEqual([]);
  });

  it('makes route tenant parameters authoritative over x-tenant-id', () => {
    expect(source).toContain('resolveAdminRequestedTenant');
    const helper = source.match(/export function resolveAdminRequestedTenant[\s\S]{0,900}/)?.[0] || '';
    expect(helper.indexOf('req.params?.tenantId')).toBeGreaterThanOrEqual(0);
    expect(helper.indexOf("req.path?.startsWith('/admin/tenants/')")).toBeGreaterThanOrEqual(0);
    expect(helper.indexOf("req.headers['x-tenant-id']")).toBeGreaterThan(helper.indexOf('req.params?.tenantId'));
  });

  it('never activates a newly claimed custom domain before verification', () => {
    const domainRoute = source.match(/v1Router\.post\('\/admin\/domains'[\s\S]{0,2400}/)?.[0] || '';
    expect(domainRoute).toContain("status: 'pending'");
    expect(domainRoute).toContain('DOMAIN_ALREADY_CLAIMED');
  });

  it('protects the direct binary upload fallback', () => {
    const directUpload = source.match(
      /v1Router\.put\('\/admin\/assets\/direct-upload\/:assetId'([\s\S]{0,260})/
    )?.[1] || '';

    expect(directUpload).toContain('requireAdminAuth()');
    expect(directUpload).toContain("requireAdminCapability('assets.write')");
  });
});
