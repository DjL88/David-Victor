import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FirestorePlatformService } from '../../server/firestoreService';
import { SubstitutionCallbackService } from '../../server/deliverect/SubstitutionCallbackService';
import { resetDeliverectAdapter, setDeliverectAdapter } from '../../server/deliverect';
import { setServerRuntimeMode } from '../../server/runtimeMode';

const tenantId = 'substitution-policy-tenant';

function catalog(products: any[]) {
  return {
    id: 'catalog-1',
    name: 'Store catalogue',
    products,
    categories: [
      { id: 'dairy', name: 'Dairy' },
      { id: 'snacks', name: 'Snacks' },
    ],
  } as any;
}

describe('Quest catalogue substitution candidate policy', () => {
  beforeEach(() => {
    setServerRuntimeMode('demo');
    resetDeliverectAdapter();
    vi.spyOn(FirestorePlatformService, 'getTenantConfig').mockResolvedValue({
      tenantId,
      featureFlags: {},
    } as any);
    vi.spyOn(FirestorePlatformService, 'getTenantRules').mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetDeliverectAdapter();
  });

  it('returns at most ten live same-category, same-or-lower-price candidates with mapped PLUs first', async () => {
    const products = [
      { id: 'milk', plu: 'MILK', name: 'Milk', price: 200, categoryIds: ['dairy'], active: true },
      { id: 'mapped', plu: 'MAPPED', name: 'Mapped milk', price: 180, categoryIds: ['dairy'], active: true },
      { id: 'close', plu: 'CLOSE', name: 'Close milk', price: 190, categoryIds: ['dairy'], active: true },
      { id: 'expensive', plu: 'EXPENSIVE', name: 'Expensive milk', price: 201, categoryIds: ['dairy'], active: true },
      { id: 'wrong-category', plu: 'SNACK', name: 'Snack', price: 100, categoryIds: ['snacks'], active: true },
      { id: 'oos', plu: 'OOS', name: 'Unavailable milk', price: 100, categoryIds: ['dairy'], stockStatus: 'OUT_OF_STOCK' },
    ];
    setDeliverectAdapter({ getStoreCatalog: vi.fn().mockResolvedValue(catalog(products)) } as any, tenantId);
    vi.mocked(FirestorePlatformService.getTenantRules).mockResolvedValue([{
      id: 'milk-map',
      name: 'Milk substitutions',
      enabled: true,
      countries: ['GB'],
      priority: 80,
      matchConditions: [{ field: 'plu', operator: 'equals', value: 'MILK' }],
      actions: [{
        type: 'SUBSTITUTION_POLICY',
        maxPriceIncreaseMinor: 0,
        requireSameCategory: true,
        preferredSubstitutePlus: ['MAPPED'],
      }],
    }]);

    const candidates = await (SubstitutionCallbackService as any).storeCatalogCandidates({
      tenantId,
      channelLinkId: 'store-1',
      originalPlu: 'MILK',
      originalPriceMinor: 200,
      chosen: [],
    });

    expect(candidates.map((candidate: any) => candidate.plu)).toEqual(['MAPPED', 'CLOSE']);
  });

  it('returns only the available customer-selected item and bypasses automatic price/category limits', async () => {
    const products = [
      { id: 'milk', plu: 'MILK', name: 'Milk', price: 200, categoryIds: ['dairy'], active: true },
      { id: 'choice', plu: 'CHOICE', name: 'Customer choice', price: 500, categoryIds: ['snacks'], active: true },
      { id: 'auto', plu: 'AUTO', name: 'Automatic milk', price: 180, categoryIds: ['dairy'], active: true },
    ];
    setDeliverectAdapter({ getStoreCatalog: vi.fn().mockResolvedValue(catalog(products)) } as any, tenantId);

    const candidates = await (SubstitutionCallbackService as any).storeCatalogCandidates({
      tenantId,
      channelLinkId: 'store-1',
      originalPlu: 'MILK',
      originalPriceMinor: 200,
      chosen: [{ plu: 'CHOICE', name: 'Customer choice', quantity: 1, price: 500 }],
    });

    expect(candidates).toEqual([{ plu: 'CHOICE', name: 'Customer choice', quantity: 1, price: 500 }]);
  });

  it('keeps tagged products inside the same tags and honours never-substitute rules', async () => {
    const products = [
      { id: 'beer', plu: 'BEER', name: 'Beer', price: 200, categoryIds: ['dairy'], tags: ['ALCOHOL'], active: true },
      { id: 'beer-alt', plu: 'BEER-ALT', name: 'Beer alternative', price: 180, categoryIds: ['dairy'], tags: ['ALCOHOL'], active: true },
      { id: 'ordinary', plu: 'ORDINARY', name: 'Ordinary drink', price: 150, categoryIds: ['dairy'], active: true },
    ];
    setDeliverectAdapter({ getStoreCatalog: vi.fn().mockResolvedValue(catalog(products)) } as any, tenantId);

    const tagged = await (SubstitutionCallbackService as any).storeCatalogCandidates({
      tenantId,
      channelLinkId: 'store-1',
      originalPlu: 'BEER',
      originalPriceMinor: 200,
      chosen: [],
    });
    expect(tagged.map((candidate: any) => candidate.plu)).toEqual(['BEER-ALT']);

    vi.mocked(FirestorePlatformService.getTenantRules).mockResolvedValue([{
      id: 'never-beer',
      name: 'Never substitute beer',
      enabled: true,
      countries: ['GB'],
      priority: 100,
      matchConditions: [{ field: 'plu', operator: 'equals', value: 'BEER' }],
      actions: [{ type: 'SUBSTITUTION_POLICY', neverSubstitute: true }],
    }]);
    const blocked = await (SubstitutionCallbackService as any).storeCatalogCandidates({
      tenantId,
      channelLinkId: 'store-1',
      originalPlu: 'BEER',
      originalPriceMinor: 200,
      chosen: [],
    });
    expect(blocked).toEqual([]);
  });
});
