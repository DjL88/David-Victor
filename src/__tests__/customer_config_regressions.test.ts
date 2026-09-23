import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SEARCH_CONFIG } from '../commerce/searchMerchEngine';

describe('audit-led storefront configuration regressions', () => {
  const brandsSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/admin/screens/BrandsScreen.tsx'),
    'utf8'
  );
  const tenantContextSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/tenant/TenantContext.tsx'),
    'utf8'
  );
  const searchHookSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/hooks/useProductSearch.ts'),
    'utf8'
  );
  const accountSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/features/account/AccountScreen.tsx'),
    'utf8'
  );
  const productSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/features/product/ProductDetailModal.tsx'),
    'utf8'
  );

  it('persists the country, currency and requested domain from brand onboarding', () => {
    expect(brandsSource).toContain('currency,\n        country,\n        domain: defaultDomain.trim() || undefined');
  });

  it('does not seed live search with fake merchandising rules', () => {
    expect(DEFAULT_SEARCH_CONFIG.typoAliases).toEqual([]);
    expect(DEFAULT_SEARCH_CONFIG.synonyms).toEqual([]);
    expect(DEFAULT_SEARCH_CONFIG.queryRewrites).toEqual([]);
    expect(DEFAULT_SEARCH_CONFIG.pinnedProducts).toEqual([]);
    expect(DEFAULT_SEARCH_CONFIG.boostRules).toEqual([]);
  });

  it('loads persisted search configuration into the storefront search path', () => {
    expect(tenantContextSource).toContain('res.searchConfig ||');
    expect(searchHookSource).toContain('resolveSearchQueryInfo(query)');
    expect(searchHookSource).toContain('applySearchMerchandising(renderable, query)');
  });

  it('renders translated support and tenant-currency deposit copy', () => {
    expect(accountSource).not.toContain("${tenant.brandName} t('account.customerSupport')");
    expect(productSource).toContain("aria-label={t('product.closeDetails')}");
    expect(productSource).toContain("t('product.includesDeposit')");
    expect(productSource).not.toContain('Includes £{(depositAmount || 0).toFixed(2)}');
  });
});
