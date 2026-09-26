import { describe, it, expect, beforeEach } from 'vitest';
import { FirestorePlatformService } from '../../server/firestoreService';

describe('Strict Tenant Resolution & Branding Audit Tests', () => {
  beforeEach(() => {
    delete process.env.VITE_PREVIEW_TENANT;
  });

  it('resolves valid registered domain to correct tenant without fallbacks', async () => {
    // Valid domain registered in system
    const resolvedTenant = await FirestorePlatformService.resolveTenantByHostname('shop1.com');
    expect(resolvedTenant).toBe('brand-alpha');

    const resolvedBeta = await FirestorePlatformService.resolveTenantByHostname('shop2.com');
    expect(resolvedBeta).toBe('brand-beta');
  });

  it('returns null / 404 for unknown domain without falling back to brand-alpha', async () => {
    const resolvedUnknown = await FirestorePlatformService.resolveTenantByHostname('unknown-brand.unregistered.com');
    expect(resolvedUnknown).toBeNull();
  });

  it('fails safely when database / Firestore fails without falling back to brand-alpha or mock tenants', async () => {
    // Attempting to fetch a non-existent tenant must throw TENANT_NOT_FOUND, never falling back to mock or brand-alpha
    await expect(
      FirestorePlatformService.getTenantConfig('non-existent-tenant-id-xyz')
    ).rejects.toThrow();
  });

  it('requires tenant context to be resolved before route handlers consume it', async () => {
    const { resolveTenant, resolveAdminRequestedTenant } = await import('../../server/api/v1Router');

    const unauthReq: any = {
      headers: { 'x-tenant-id': 'brand-beta' },
      query: { tenantId: 'brand-beta' },
      hostname: 'attacker-site.com',
    };
    expect(() => resolveTenant(unauthReq)).toThrow('Tenant scope has not been resolved');

    expect(resolveTenant({ resolvedTenantId: 'brand-alpha' } as any)).toBe('brand-alpha');

    const tenantAdminReq: any = {
      headers: { 'x-tenant-id': 'brand-alpha' },
      adminUser: {
        uid: 'tenant-user',
        role: 'tenantAdmin',
        tenantId: 'brand-beta',
      },
    };
    expect(resolveTenant(tenantAdminReq)).toBe('brand-beta');

    // Route-bound tenant IDs remain authoritative for authenticated admin routes.
    const mismatchedAdminReq: any = {
      path: '/admin/tenants/brand-beta',
      params: { id: 'brand-beta' },
      headers: { 'x-tenant-id': 'brand-alpha' },
    };
    expect(resolveAdminRequestedTenant(mismatchedAdminReq)).toBe('brand-beta');
  }, 15_000);

  it('does not serve a custom domain until its mapping is active', async () => {
    const host = `pending-${Date.now()}.example.test`;

    const pending = await FirestorePlatformService.addOrUpdateDomain({
      hostname: host,
      tenantId: 'brand-alpha',
      isPrimary: false,
      status: 'pending',
    });
    expect(await FirestorePlatformService.resolveTenantByHostname(host)).toBeNull();

    await FirestorePlatformService.addOrUpdateDomain({
      hostname: host,
      tenantId: 'brand-alpha',
      isPrimary: false,
      status: 'active',
    });
    expect(await FirestorePlatformService.resolveTenantByHostname(host)).toBe('brand-alpha');

    await FirestorePlatformService.deleteDomain(pending.domainId);
  });

  it('requires each served hostname to be explicitly mapped and active', async () => {
    const apex = `exact-${Date.now()}.example.test`;
    const www = `www.${apex}`;

    const mapped = await FirestorePlatformService.addOrUpdateDomain({
      hostname: apex,
      tenantId: 'brand-alpha',
      status: 'active',
    });

    expect(await FirestorePlatformService.resolveTenantByHostname(apex)).toBe('brand-alpha');
    expect(await FirestorePlatformService.resolveTenantByHostname(www)).toBeNull();

    await FirestorePlatformService.deleteDomain(mapped.domainId);
  });

  it('keeps only one primary domain per tenant', async () => {
    const suffix = Date.now();
    const first = await FirestorePlatformService.addOrUpdateDomain({
      hostname: `primary-a-${suffix}.example.test`,
      tenantId: 'brand-alpha',
      isPrimary: true,
      status: 'active',
    });
    const second = await FirestorePlatformService.addOrUpdateDomain({
      hostname: `primary-b-${suffix}.example.test`,
      tenantId: 'brand-alpha',
      isPrimary: true,
      status: 'active',
    });

    const domains = await FirestorePlatformService.getDomainsForTenant('brand-alpha');
    const created = domains.filter((domain) => domain.hostname.includes(String(suffix)));
    expect(created.filter((domain) => domain.isPrimary)).toHaveLength(1);
    expect(created.find((domain) => domain.hostname === second.hostname)?.isPrimary).toBe(true);

    await FirestorePlatformService.deleteDomain(first.domainId);
    await FirestorePlatformService.deleteDomain(second.domainId);
  });

  it('persists branding changes (logo, colours, fonts) to BFF/storage and survives reload', async () => {
    const initialConfig = await FirestorePlatformService.getTenantConfig('brand-alpha');
    expect(initialConfig).toBeDefined();

    // Perform audit branding change
    const updatedBranding = {
      ...initialConfig,
      brandName: 'Audited Artisan Pantry',
      logoUrl: 'https://cdn.example.com/assets/audited-logo.svg',
      iconUrl: 'https://cdn.example.com/assets/audited-icon.png',
      primaryColour: '#0B3D91',
      secondaryColour: '#E65100',
      backgroundColour: '#FAFAFA',
      textColour: '#111827',
      fontFamily: 'Playfair Display',
      borderRadius: '16px',
    };

    const saved = await FirestorePlatformService.updateTenantConfig('brand-alpha', updatedBranding);
    expect(saved.brandName).toBe('Audited Artisan Pantry');
    expect(saved.logoUrl).toBe('https://cdn.example.com/assets/audited-logo.svg');
    expect(saved.primaryColour).toBe('#0B3D91');
    expect(saved.fontFamily).toBe('Playfair Display');
    expect(saved.borderRadius).toBe('16px');

    // Simulate page reload / subsequent request
    const reloaded = await FirestorePlatformService.getTenantConfig('brand-alpha');
    expect(reloaded.brandName).toBe('Audited Artisan Pantry');
    expect(reloaded.logoUrl).toBe('https://cdn.example.com/assets/audited-logo.svg');
    expect(reloaded.primaryColour).toBe('#0B3D91');
    expect(reloaded.secondaryColour).toBe('#E65100');
    expect(reloaded.fontFamily).toBe('Playfair Display');
    expect(reloaded.borderRadius).toBe('16px');
  });

  it('persists search merchandising and rules config across reloads', async () => {
    const searchConfig = {
      typoAliases: [
        { id: 'typo-audited', typo: 'orgnic', resolvesTo: 'organic', isActive: true },
      ],
      synonyms: [
        { id: 'syn-audited', term: 'pastry', synonyms: ['croissant', 'danish'], isActive: true },
      ],
      queryRewrites: [],
      pinnedProducts: [],
      boostRules: [],
      excludedProductPlus: [],
    };

    await FirestorePlatformService.saveTenantSearchConfig('brand-alpha', searchConfig);
    const loaded = await FirestorePlatformService.getTenantSearchConfig('brand-alpha');
    expect(loaded).toBeDefined();
    expect(loaded.typoAliases[0].typo).toBe('orgnic');
    expect(loaded.synonyms[0].synonyms).toContain('croissant');
  });
});
