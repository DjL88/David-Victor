import { describe, expect, it } from 'vitest';
import { buildSearchMerchEntityOptions, resolveSearchMerchTargetName } from '../admin/searchMerchEntityOptions';
import { Category, Product } from '../commerce/models';

const products: Product[] = [
  {
    id: 'p1',
    plu: 'PLU-001',
    gtin: [],
    name: 'Salted Crisps',
    brand: 'LTx Foods',
    categoryIds: ['snacks'],
    productTags: [],
    displayLabels: [],
    allergens: [],
  },
  {
    id: 'p2',
    plu: 'PLU-002',
    gtin: [],
    name: 'Cola',
    brand: 'LTx Drinks',
    categoryIds: ['drinks'],
    productTags: [],
    displayLabels: [],
    allergens: [],
  },
  {
    id: 'p3',
    plu: 'PLU-002',
    gtin: [],
    name: 'Duplicate Cola',
    brand: 'LTx Drinks',
    categoryIds: ['drinks'],
    productTags: [],
    displayLabels: [],
    allergens: [],
  },
];

const categories: Category[] = [
  {
    id: 'snacks',
    name: 'Snacks',
    subcategories: [{ id: 'crisps', name: 'Crisps' }],
  },
  { id: 'drinks', name: 'Drinks' },
];

describe('search merchandising live entity options', () => {
  it('builds stable product, nested-category and brand suggestions without duplicates', () => {
    const options = buildSearchMerchEntityOptions(products, categories);

    expect(options.products.map((option) => option.value)).toEqual(['PLU-002', 'PLU-001']);
    expect(options.products.find((option) => option.value === 'PLU-001')).toMatchObject({
      label: 'Salted Crisps',
      description: 'LTx Foods',
    });
    expect(options.categories).toContainEqual({ value: 'crisps', label: 'Snacks › Crisps' });
    expect(options.brands.map((option) => option.value)).toEqual(['LTx Drinks', 'LTx Foods']);
  });

  it('resolves display names for exact live targets while preserving unknown free-entry values', () => {
    const options = buildSearchMerchEntityOptions(products, categories);

    expect(resolveSearchMerchTargetName('product', 'PLU-001', options)).toBe('Salted Crisps');
    expect(resolveSearchMerchTargetName('category', 'crisps', options)).toBe('Snacks › Crisps');
    expect(resolveSearchMerchTargetName('brand', 'LTx Drinks', options)).toBe('LTx Drinks');
    expect(resolveSearchMerchTargetName('product', 'MANUAL-PLU', options)).toBeUndefined();
  });
});
