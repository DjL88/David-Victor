import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TenantSecretResolver } from '../../server/deliverect/IntegrationContext';
import { SecretManager } from '../../server/secrets';

describe('tenant Deliverect credential isolation', () => {
  const keys = [
    'DELIVERECT_CLIENT_ID',
    'DELIVERECT_CLIENT_ID_BRAND_ALPHA',
    'DELIVERECT_CLIENT_SECRET',
    'DELIVERECT_CLIENT_SECRET_BRAND_ALPHA',
  ];

  beforeEach(() => {
    SecretManager.clearCache();
    for (const key of keys) delete process.env[key];
  });

  afterEach(() => {
    SecretManager.clearCache();
    for (const key of keys) delete process.env[key];
  });

  it('dedicated mode never falls back to the platform credential', async () => {
    process.env.DELIVERECT_CLIENT_ID = 'platform-client';
    expect(
      await TenantSecretResolver.resolveTenantSecret('brand-alpha', 'DELIVERECT_CLIENT_ID', 'dedicated')
    ).toBeNull();
  });

  it('platform mode ignores historical tenant credentials', async () => {
    process.env.DELIVERECT_CLIENT_ID = 'platform-client';
    process.env.DELIVERECT_CLIENT_ID_BRAND_ALPHA = 'tenant-client';

    expect(
      await TenantSecretResolver.resolveTenantSecret('brand-alpha', 'DELIVERECT_CLIENT_ID', 'platform')
    ).toBe('platform-client');
  });

  it('dedicated mode resolves only the tenant credential', async () => {
    process.env.DELIVERECT_CLIENT_SECRET = 'platform-secret';
    process.env.DELIVERECT_CLIENT_SECRET_BRAND_ALPHA = 'tenant-secret';

    expect(
      await TenantSecretResolver.resolveTenantSecret('brand-alpha', 'DELIVERECT_CLIENT_SECRET', 'dedicated')
    ).toBe('tenant-secret');
  });

  it('legacy mode preserves tenant-first fallback for existing records', async () => {
    process.env.DELIVERECT_CLIENT_ID = 'platform-client';
    process.env.DELIVERECT_CLIENT_ID_BRAND_ALPHA = 'legacy-tenant-client';

    expect(
      await TenantSecretResolver.resolveTenantSecret('brand-alpha', 'DELIVERECT_CLIENT_ID', 'legacy')
    ).toBe('legacy-tenant-client');
  });
});
