import { describe, expect, it } from 'vitest';
import { inspectDeliverectMenu, selectRawMenu } from '../../server/deliverect/DeliverectMenuInspector';

describe('Deliverect menu inspector', () => {
  it('validates native subcategory structure and product references', () => {
    const report = inspectDeliverectMenu({
      menuId: 'menu-1',
      menu: 'Retail',
      menuType: 0,
      categories: [
        { _id: 'parent', name: 'Toiletries', subCategories: ['child'], subProducts: [] },
        { _id: 'child', name: 'Soap', subCategories: [], subProducts: ['prod-1'] },
      ],
      products: [{ _id: 'prod-1', plu: 'SOAP1', productTags: [104, 106] }],
    });
    expect(report.nativeHierarchyDetected).toBe(true);
    expect(report.missingSubCategoryRefs).toEqual([]);
    expect(report.unmappedCategoryProductRefs).toEqual([]);
    expect(report.orphanProductIds).toEqual([]);
    expect(report.numericProductTagIds).toEqual(['104', '106']);
  });

  it('reports broken references and orphan products', () => {
    const report = inspectDeliverectMenu({
      menuId: 'broken',
      categories: [{ _id: 'cat', subCategories: ['missing-cat'], subProducts: ['missing-product'] }],
      products: [{ _id: 'orphan', plu: 'ORPHAN' }],
    });
    expect(report.missingSubCategoryRefs).toEqual(['missing-cat']);
    expect(report.unmappedCategoryProductRefs).toEqual(['missing-product']);
    expect(report.orphanProductIds).toEqual(['orphan']);
    expect(report.issues.map(i => i.code)).toEqual(expect.arrayContaining([
      'MISSING_SUBCATEGORY_REFERENCE','MISSING_PRODUCT_REFERENCE','ORPHAN_PRODUCT'
    ]));
  });

  it('never infers merchandising from a category name', () => {
    const report = inspectDeliverectMenu({
      menuId: 'menu-merch',
      categories: [{ _id: 'deals', name: 'Merchandise Deals', subProducts: [] }],
      products: [],
    });
    expect(report.categories[0].merchandising.status).toBe('NOT_EXPOSED');
    expect(report.merchandisingSummary.explicitCategoryCount).toBe(0);
  });

  it('surfaces only literal merchandising fields when present', () => {
    const report = inspectDeliverectMenu({
      menuId: 'menu-merch-explicit',
      categories: [{ _id: 'deals', name: 'Deals', isMerchandising: true }],
      products: [],
    });
    expect(report.categories[0].merchandising).toEqual({
      status: 'EXPLICIT', value: true, sourceField: 'isMerchandising'
    });
  });

  it('selects the exact requested published menu id', () => {
    const payload = [{ menuId: 'a' }, { menuId: 'b' }];
    expect(selectRawMenu(payload, 'b')?.menuId).toBe('b');
    expect(selectRawMenu(payload, 'missing')).toBeNull();
  });
});
