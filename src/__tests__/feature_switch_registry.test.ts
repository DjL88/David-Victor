import { describe, expect, it } from 'vitest';
import { TENANT_FEATURE_DEFINITIONS, TENANT_CONFIGURABLE_FEATURE_KEYS } from '../admin/featureSwitchRegistry';

describe('tenant feature switch registry', () => {
  it('has one definition for every surfaced switch and no duplicate ownership', () => {
    const keys = TENANT_FEATURE_DEFINITIONS.map((definition) => definition.key);
    const tenantConfigurableKeys = TENANT_FEATURE_DEFINITIONS
      .filter((definition) => definition.tenantConfigurable)
      .map((definition) => definition.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(TENANT_CONFIGURABLE_FEATURE_KEYS).toEqual(new Set(tenantConfigurableKeys));
  });

  it('keeps legal/provider specifics out of switch copy', () => {
    const copy = JSON.stringify(TENANT_FEATURE_DEFINITIONS);
    expect(copy).not.toMatch(/Challenge 25/i);
    expect(copy).not.toMatch(/Deliverect/i);
    expect(copy).not.toMatch(/100% of tips/i);
  });

  it('makes ownership explicit so settings can be consolidated without fake controls', () => {
    for (const definition of TENANT_FEATURE_DEFINITIONS) {
      expect(definition.owner).toMatch(/^(CONTENT|CATALOGUE|FULFILMENT|COMPLIANCE|CHECKOUT|INTEGRATION|PLATFORM)$/);
      if (definition.platformOnly || definition.unavailableReason) {
        expect(definition.tenantConfigurable).toBe(false);
      } else {
        expect(definition.tenantConfigurable).toBe(true);
      }
    }
  });
});
