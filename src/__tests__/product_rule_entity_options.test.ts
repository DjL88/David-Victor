import { describe, expect, it } from 'vitest';
import { buildProductRuleTagOptions, splitAdminRuleValues } from '../admin/productRuleEntityOptions';
import type { Product } from '../commerce/models';

const products: Product[] = [
  {
    id: 'p1',
    plu: 'PLU-001',
    gtin: [],
    name: 'Milk',
    brand: 'Dairy Co',
    categoryIds: ['dairy'],
    productTags: ['CHILLED', '9001'],
    productTagLabels: ['Chilled', 'Local favourite'],
    tags: ['Breakfast'],
    displayLabels: [],
    allergens: [],
  },
  {
    id: 'p2',
    plu: 'PLU-002',
    gtin: [],
    name: 'Yoghurt',
    categoryIds: ['dairy'],
    productTags: ['CHILLED'],
    productTagLabels: ['Chilled'],
    tags: ['Breakfast'],
    displayLabels: [],
    allergens: [],
  },
];

describe('product rule live entity helpers', () => {
  it('builds stable live tag suggestions including provider tag labels and dedupes values', () => {
    expect(buildProductRuleTagOptions(products)).toEqual([
      { value: 'Breakfast', label: 'Breakfast' },
      { value: 'CHILLED', label: 'Chilled' },
      { value: '9001', label: 'Local favourite' },
    ]);
  });

  it('preserves comma-separated multi-value semantics and manual values', () => {
    expect(splitAdminRuleValues('PLU-001, custom-plu, PLU-002')).toEqual([
      'PLU-001',
      'custom-plu',
      'PLU-002',
    ]);
    expect(splitAdminRuleValues('')).toEqual([]);
  });
});
