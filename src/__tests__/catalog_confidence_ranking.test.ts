import { describe, expect, it, vi } from 'vitest';
import { DeliverectApiClient } from '../../server/deliverect/DeliverectApiClient';
import { OAuthTokenManager } from '../../server/deliverect/OAuthTokenManager';

const product = (plu: string, score: number, extra: Record<string, unknown> = {}) => ({
  id: plu,
  plu,
  gtin: [],
  name: plu,
  categoryIds: [],
  productTags: [],
  displayLabels: [],
  allergens: [],
  active: true,
  priceMinor: 100,
  stockStatus: 'IN_STOCK',
  metadata: {
    catalogConfidenceScore: score,
  },
  ...extra,
});

describe('catalog confidence search ranking', () => {
  it('promotes verified matches, demotes unavailable ambiguity, and hides archived products', async () => {
    const tokenManager = new OAuthTokenManager({
      environment: 'staging',
      clientId: 'stub-client',
      clientSecret: 'stub-secret',
    });
    const client = new DeliverectApiClient(
      tokenManager,
      'tenant-ranking',
      'account-1',
      ['store-1']
    );

    vi.spyOn(client, 'getStoreCatalog').mockResolvedValue({
      id: 'store-1',
      type: 'STORE',
      storeId: 'store-1',
      categories: [],
      products: [
        product('AMBIGUOUS', 55),
        product('SNOOZED', 100, { stockStatus: 'OUT_OF_STOCK', snoozed: true }),
        product('VERIFIED', 100),
        product('ARCHIVED', 100, {
          active: false,
          metadata: { lifecycleStatus: 'ARCHIVED', catalogConfidenceScore: 100 },
        }),
      ],
      totalProducts: 4,
      updatedAt: new Date().toISOString(),
    } as any);

    const result = await client.searchProducts('', 'store-1');

    expect(result.products.map((item) => item.plu)).toEqual([
      'VERIFIED',
      'AMBIGUOUS',
      'SNOOZED',
    ]);
    expect(result.products.some((item) => item.plu === 'ARCHIVED')).toBe(false);
  });
});
