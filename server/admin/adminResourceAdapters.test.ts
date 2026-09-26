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

  it('applies and rolls back branding through versioned revisions in test mode', async () => {
    let live: any = {
      tenantId: 'tenant-a',
      brandName: 'Old Brand',
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
    };
    vi.spyOn(FirestorePlatformService, 'getTenantConfig').mockImplementation(async () => live);
    vi.spyOn(FirestorePlatformService, 'updateTenantConfig').mockImplementation(async (_tenantId, updates) => {
      live = { ...live, ...updates };
      return live;
    });

    const preview = await AdminResourceAdapterRegistry.prepareProposal({
      tenantId: 'tenant-a',
      actorId: 'admin-1',
      actionName: 'branding.proposeUpdate',
      input: { primaryColour: '#abcdef' },
      idempotencyKey: 'branding-apply-test',
    });

    const applied = await AdminResourceAdapterRegistry.applyRevision({
      tenantId: 'tenant-a',
      actorId: 'admin-1',
      actionName: 'branding.proposeUpdate',
      revisionId: preview.revisionIds[0],
    });
    expect((applied.result as any).primaryColour).toBe('#abcdef');

    const verification = await AdminResourceAdapterRegistry.verifyRevisionPersisted({
      tenantId: 'tenant-a',
      actionName: 'branding.proposeUpdate',
      revisionId: preview.revisionIds[0],
    });
    expect(verification).toMatchObject({
      verified: true,
      revisionId: preview.revisionIds[0],
      resource: { type: 'tenantBranding', id: 'tenant-a' },
      persistedSnapshot: { primaryColour: '#abcdef' },
    });

    const rolledBack = await AdminResourceAdapterRegistry.rollbackRevision({
      tenantId: 'tenant-a',
      actorId: 'admin-1',
      actionName: 'branding.proposeUpdate',
      revisionId: preview.revisionIds[0],
    });
    expect((rolledBack.result as any).primaryColour).toBe('#111111');
    expect(rolledBack.revisionId).not.toBe(preview.revisionIds[0]);
  });

  it('rejects applying a branding proposal after live branding has drifted', async () => {
    let live: any = {
      tenantId: 'tenant-a',
      brandName: 'Old Brand',
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
    };
    vi.spyOn(FirestorePlatformService, 'getTenantConfig').mockImplementation(async () => live);

    const preview = await AdminResourceAdapterRegistry.prepareProposal({
      tenantId: 'tenant-a',
      actorId: 'admin-1',
      actionName: 'branding.proposeUpdate',
      input: { primaryColour: '#abcdef' },
    });
    live = { ...live, primaryColour: '#333333' };

    await expect(
      AdminResourceAdapterRegistry.applyRevision({
        tenantId: 'tenant-a',
        actorId: 'admin-1',
        actionName: 'branding.proposeUpdate',
        revisionId: preview.revisionIds[0],
      })
    ).rejects.toMatchObject({ code: 'ADMIN_REVISION_LIVE_STATE_CONFLICT' });
  });

  it('rejects rollback when a newer human branding edit exists', async () => {
    let live: any = {
      tenantId: 'tenant-a',
      brandName: 'Old Brand',
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
    };
    vi.spyOn(FirestorePlatformService, 'getTenantConfig').mockImplementation(async () => live);
    vi.spyOn(FirestorePlatformService, 'updateTenantConfig').mockImplementation(async (_tenantId, updates) => {
      live = { ...live, ...updates };
      return live;
    });

    const preview = await AdminResourceAdapterRegistry.prepareProposal({
      tenantId: 'tenant-a',
      actorId: 'admin-1',
      actionName: 'branding.proposeUpdate',
      input: { primaryColour: '#abcdef' },
    });
    await AdminResourceAdapterRegistry.applyRevision({
      tenantId: 'tenant-a',
      actorId: 'admin-1',
      actionName: 'branding.proposeUpdate',
      revisionId: preview.revisionIds[0],
    });

    live = { ...live, primaryColour: '#444444' };
    await expect(
      AdminResourceAdapterRegistry.rollbackRevision({
        tenantId: 'tenant-a',
        actorId: 'admin-1',
        actionName: 'branding.proposeUpdate',
        revisionId: preview.revisionIds[0],
      })
    ).rejects.toMatchObject({ code: 'ADMIN_REVISION_LIVE_STATE_CONFLICT' });
  });

  it('fails verification when the persisted Branding state does not match the published revision', async () => {
    let live: any = {
      tenantId: 'tenant-a',
      brandName: 'Old Brand',
      primaryColour: '#111111',
      secondaryColour: '#222222',
      backgroundColour: '#ffffff',
      textColour: '#000000',
      locale: 'en-GB',
    };
    vi.spyOn(FirestorePlatformService, 'getTenantConfig').mockImplementation(async () => live);
    vi.spyOn(FirestorePlatformService, 'updateTenantConfig').mockImplementation(async (_tenantId, updates) => {
      live = { ...live, ...updates };
      return live;
    });

    const preview = await AdminResourceAdapterRegistry.prepareProposal({
      tenantId: 'tenant-a',
      actorId: 'admin-1',
      actionName: 'branding.proposeUpdate',
      input: { primaryColour: '#abcdef' },
    });
    await AdminResourceAdapterRegistry.applyRevision({
      tenantId: 'tenant-a',
      actorId: 'admin-1',
      actionName: 'branding.proposeUpdate',
      revisionId: preview.revisionIds[0],
    });

    live = { ...live, primaryColour: '#badbad' };
    await expect(
      AdminResourceAdapterRegistry.verifyRevisionPersisted({
        tenantId: 'tenant-a',
        actionName: 'branding.proposeUpdate',
        revisionId: preview.revisionIds[0],
      })
    ).rejects.toMatchObject({ code: 'ADMIN_CHANGESET_VERIFICATION_FAILED' });
  });

  it('does not invent persistence verification for unsupported write adapters', async () => {
    await expect(
      AdminResourceAdapterRegistry.verifyRevisionPersisted({
        tenantId: 'tenant-a',
        actionName: 'fees.proposeUpdate',
        revisionId: 'rev-unknown',
      })
    ).rejects.toMatchObject({ code: 'ADMIN_ACTION_VERIFY_NOT_CONNECTED' });
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
