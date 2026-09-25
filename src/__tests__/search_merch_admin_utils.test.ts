import { describe, expect, it } from 'vitest';
import {
  mergeSearchMerchReferences,
  resolveSearchMerchTargetName,
  splitSearchMerchReferences,
} from '../admin/searchMerchAdminUtils';

describe('Search merchandising admin reference helpers', () => {
  it('accepts comma-separated text entry while trimming empty values', () => {
    expect(splitSearchMerchReferences(' PLU-1, PLU-2 ,, PLU-3 ')).toEqual([
      'PLU-1',
      'PLU-2',
      'PLU-3',
    ]);
  });

  it('merges multi-entry PLUs without duplicating existing exclusions', () => {
    expect(
      mergeSearchMerchReferences(['PLU-1', 'PLU-2'], 'PLU-2, PLU-3, PLU-3'),
    ).toEqual(['PLU-1', 'PLU-2', 'PLU-3']);
  });

  it('resolves live product and category labels but preserves valid free text', () => {
    const products = [{ plu: 'P-100', name: 'Fresh Milk' }];
    const categories = [{ id: 'cat-dairy', name: 'Dairy' }];

    expect(resolveSearchMerchTargetName('product', 'P-100', products, categories)).toBe('Fresh Milk');
    expect(resolveSearchMerchTargetName('category', 'cat-dairy', products, categories)).toBe('Dairy');
    expect(resolveSearchMerchTargetName('brand', 'Local Brand', products, categories)).toBe('Local Brand');
    expect(resolveSearchMerchTargetName('product', 'CUSTOM-PLU', products, categories)).toBe('CUSTOM-PLU');
  });
});
