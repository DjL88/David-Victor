import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminResourceAdapterRegistry } from './adminResourceAdapters';
import { ConfigurationRevisionService } from './configurationRevisionService';
import { FirestorePlatformService } from '../firestoreService';

describe('AdminResourceAdapterRegistry', () => {
  beforeEach(() => {
    ConfigurationRevisionService.resetForTest();
    vi.restoreAllMocks();
  });

  it('builds branding before/after/diff on the server and creates a validated revision', async () => {
    vi.spyOn(FirestorePlatformService, 'getTenantConfig').mockResolvedValue({
      tenantId: 'tenant-a',
      brandName: 'Old Brand',
      tagline: 'Old',
      logoUrl: '/old.png',
      iconUrl: '/old-icon.png',
      primaryColour: '#111111',
      secondaryColour: '#222222',
      backgroundColour: '#ffffff',
      textColour: '#000000',
      fontFamily: 'Inter',
      borderRadius: '12px',
      country: 'GB',
      currency: 'GBP',
      currencySymbol: '£',
      locale: 'en-GB',
      supportDetails: { email: '', phone: '', openingHours: '' },
      featureFlags: {
        enableStories: true,
        enableRootCatalogBrowse: true,
        enableCollection: true,
        allowStoreSwitchingWithBasket: true,
        enableNutritionalInfo: true,
        enableDeposits: true,
        enableAgeVerification: true,
        enableSearchSuggestions: true,
      },
    });

    const preview = await AdminResourceAdapterRegistry.prepareProposal({
      tenantId: 'tenant-a',
      actorId: 'admin-1',
      actionName: 'branding.proposeUpdate',
      input: { primaryColour: '#abcdef' },
    });

    expect(preview.beforeSnapshot).toMatchObject({ primaryColour: '#111111' });
    expect(preview.afterSnapshot).toMatchObject({ primaryColour: '#abcdef' });
    expect(preview.diff).toEqual([
      { path: 'primaryColour', before: '#111111', after: '#abcdef' },
    ]);
    expect(preview.revisionIds).toHaveLength(1);
    const revision = await ConfigurationRevisionService.getRevision(
      'tenant-a',
      preview.revisionIds[0]
    );
    expect(revision.status).toBe('VALIDATED');
  });

  it('keeps unadapted write actions proposal-only with an explicit warning', async () => {
    const preview = await AdminResourceAdapterRegistry.prepareProposal({
      tenantId: 'tenant-a',
      actorId: 'admin-1',
      actionName: 'fees.proposeUpdate',
      input: { serviceFeeAmount: 249 },
    });
    expect(preview.revisionIds).toEqual([]);
    expect(preview.warnings[0]).toContain('cannot be applied');
  });
});
