import { describe, it, expect, beforeEach } from 'vitest';
import { MockAdminClient } from '../commerce/MockAdminClient';
import { ALL_MOCK_ADMIN_USERS } from '../commerce/mockData';

describe('Tenant Isolation and RBAC Authorization', () => {
  let adminClient: MockAdminClient;
  const marcusAlphaAdmin = ALL_MOCK_ADMIN_USERS.find((u) => u.id === 'usr-alpha-owner')!; // brand-alpha tenantAdmin
  const julianBetaAdmin = ALL_MOCK_ADMIN_USERS.find((u) => u.id === 'usr-beta-admin')!; // brand-beta tenantAdmin
  const superAdmin = ALL_MOCK_ADMIN_USERS.find((u) => u.id === 'usr-alpha-super')!; // platformSuperAdmin

  beforeEach(() => {
    adminClient = new MockAdminClient();
  });

  it('allows tenant admin to read and update their own branding configuration', async () => {
    const branding = await adminClient.getBranding('brand-alpha');
    expect(branding.brandName).toBe('Chelmsford Artisan Grocer');

    const updated = await adminClient.updateBranding(
      'brand-alpha',
      { brandName: 'Chelmsford Artisan Grocer & Pantry' },
      marcusAlphaAdmin
    );
    expect(updated.brandName).toBe('Chelmsford Artisan Grocer & Pantry');

    // Audit log must record this action
    const logs = await adminClient.getAuditLogs('brand-alpha');
    const brandingLog = logs.find((l) => l.action.includes('Branding') || l.action.includes('BRANDING'));
    expect(brandingLog).toBeDefined();
    expect(brandingLog?.userId).toBe(marcusAlphaAdmin.id);
  });

  it('strictly prohibits a tenant admin from updating another brand resources (Tenant Isolation)', async () => {
    // Marcus (brand-alpha) attempts to modify Brand Beta's fee policy
    await expect(
      adminClient.updateFeePolicy(
        'brand-beta',
        {
          deliveryFeeMode: 'FREE',
          serviceFeeMode: 'NONE',
          serviceFeeAmount: 0,
          bagFee: 0,
        },
        marcusAlphaAdmin
      )
    ).rejects.toThrow(/Unauthorized/);
  });

  it('allows platform super admin to inspect and manage both tenants', async () => {
    const alphaBranding = await adminClient.getBranding('brand-alpha');
    const betaBranding = await adminClient.getBranding('brand-beta');

    expect(alphaBranding.id).toBe('brand-alpha');
    expect(betaBranding.id).toBe('brand-beta');

    // Super admin can update Brand Beta
    const updatedBeta = await adminClient.updateBranding(
      'brand-beta',
      { tagline: 'Super Admin Approved Bakes' },
      superAdmin
    );
    expect(updatedBeta.tagline).toBe('Super Admin Approved Bakes');
  });

  it('maintains completely isolated audit logs for each tenant', async () => {
    // Perform actions on both
    await adminClient.updateFeatureFlags(
      'brand-alpha',
      { enableStories: true, enableSearchSuggestions: true, enableRootCatalogBrowse: true, enableCollection: true, enableDepositReturnScheme: true, enableAgeVerification: true, enableTipCourier: true },
      marcusAlphaAdmin
    );

    await adminClient.updateFeatureFlags(
      'brand-beta',
      { enableStories: false, enableSearchSuggestions: true, enableRootCatalogBrowse: true, enableCollection: true, enableDepositReturnScheme: false, enableAgeVerification: true, enableTipCourier: false },
      julianBetaAdmin
    );

    const alphaLogs = await adminClient.getAuditLogs('brand-alpha');
    const betaLogs = await adminClient.getAuditLogs('brand-beta');

    expect(alphaLogs.every((l) => l.tenantId === 'brand-alpha')).toBe(true);
    expect(betaLogs.every((l) => l.tenantId === 'brand-beta')).toBe(true);
  });
});
