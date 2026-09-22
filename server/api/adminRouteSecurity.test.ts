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

  it('protects the direct binary upload fallback', () => {
    const directUpload = source.match(
      /v1Router\.put\('\/admin\/assets\/direct-upload\/:assetId'([\s\S]{0,260})/
    )?.[1] || '';

    expect(directUpload).toContain('requireAdminAuth()');
    expect(directUpload).toContain("requireAdminCapability('assets.write')");
  });
});
