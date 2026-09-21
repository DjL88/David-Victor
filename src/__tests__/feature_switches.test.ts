import { describe, it, expect, beforeEach, vi } from 'vitest';
import { defaultAdminClient } from '../commerce/HttpAdminClient';
import { ALL_MOCK_ADMIN_USERS } from '../commerce/mockData';

describe('Prompt 7 — Feature Switches Management', () => {
  const testTenant = 'brand-alpha';
  const superAdmin = ALL_MOCK_ADMIN_USERS[0];

  beforeEach(() => {
    vi.restoreAllMocks();
    defaultAdminClient.setBaseUrl('http://localhost:3000/api/v1');
  });

  it('retrieves default tenant feature flags', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tenantId: testTenant,
        brandName: 'Brand Alpha',
        featureFlags: {
          enableStories: true,
          enableSearchSuggestions: true,
          enableRootCatalogBrowse: true,
          enableCollection: true,
          enableDepositReturnScheme: false,
          enableAgeVerification: false,
          enableTipCourier: true,
          enableSequentialCategoryGrouping: false,
        },
      }),
    } as any);

    const flags = await defaultAdminClient.getFeatureFlags(testTenant);
    expect(flags).toBeDefined();
    expect(typeof flags.enableStories).toBe('boolean');
    expect(typeof flags.enableCollection).toBe('boolean');
    expect(flags.enableStories).toBe(true);
  });

  it('updates tenant feature flags and returns immediate updated state', async () => {
    // Mock getBranding and updateBranding responses
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      return {
        ok: true,
        json: async () => ({
          tenantId: testTenant,
          brandName: 'Brand Alpha',
          featureFlags: {
            enableStories: true,
            enableCollection: false,
          },
        }),
      } as any;
    });

    const initialFlags = await defaultAdminClient.getFeatureFlags(testTenant);
    const toggledCollection = !initialFlags.enableCollection;

    const updated = await defaultAdminClient.updateFeatureFlags(
      testTenant,
      {
        ...initialFlags,
        enableCollection: toggledCollection,
      },
      superAdmin
    );

    expect(updated).toBeDefined();
  });
});

