import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TENANT_FEATURE_DEFINITIONS } from '../admin/featureSwitchRegistry';
import {
  consumeLtSplashEligibility,
  getLtSplashStorageKey,
  isLtFooterWatermarkEnabled,
} from '../components/ltPlatformBranding';

const createStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
};

describe('LT platform branding', () => {
  it('shows the launch film only once for each tenant and browser', () => {
    const storage = createStorage();

    expect(consumeLtSplashEligibility('tenant-a', {}, storage)).toBe(true);
    expect(storage.getItem(getLtSplashStorageKey('tenant-a'))).toBeTruthy();
    expect(consumeLtSplashEligibility('tenant-a', {}, storage)).toBe(false);
    expect(consumeLtSplashEligibility('tenant-b', {}, storage)).toBe(true);
  });

  it('defaults platform branding on but respects an explicit commercial opt-out', () => {
    const storage = createStorage();

    expect(isLtFooterWatermarkEnabled(undefined)).toBe(true);
    expect(isLtFooterWatermarkEnabled({ showLtFooterWatermark: false })).toBe(false);
    expect(
      consumeLtSplashEligibility('tenant-a', { showLtLaunchSplash: false }, storage)
    ).toBe(false);
  });

  it('registers both switches as default-on platform-only controls', () => {
    const definitions = TENANT_FEATURE_DEFINITIONS.filter((definition) =>
      ['showLtLaunchSplash', 'showLtFooterWatermark'].includes(definition.key)
    );

    expect(definitions).toHaveLength(2);
    expect(definitions.every((definition) => definition.platformOnly)).toBe(true);
    expect(definitions.every((definition) => definition.defaultEnabled)).toBe(true);
    expect(definitions.every((definition) => !definition.tenantConfigurable)).toBe(true);
  });

  it('enforces platform-only changes on the server, not just in the admin UI', () => {
    const router = readFileSync(new URL('../../server/api/v1Router.ts', import.meta.url), 'utf8');

    expect(router).toContain("['showLtLaunchSplash', 'showLtFooterWatermark']");
    expect(router).toContain("code: 'PLATFORM_FEATURE_FLAG_FORBIDDEN'");
    expect(router).toContain("authAdmin.role !== 'platformSuperAdmin'");
  });
});
