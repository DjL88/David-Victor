export interface MenuStructureIssue {
  severity: 'INFO' | 'WARNING' | 'ERROR';
  code: string;
  message: string;
  categoryId?: string;
  productId?: string;
}

export interface MenuCategoryInspection {
  id: string;
  name: string;
  directProductCount: number;
  childCategoryIds: string[];
  hasNativeSubCategories: boolean;
  merchandising: {
    status: 'EXPLICIT' | 'NOT_EXPOSED';
    value?: unknown;
    sourceField?: string;
  };
}

export interface DeliverectMenuInspection {
  menuId: string;
  menuName: string;
  menuType?: number;
  categoryCount: number;
  productCount: number;
  nativeHierarchyDetected: boolean;
  categories: MenuCategoryInspection[];
  orphanProductIds: string[];
  unmappedCategoryProductRefs: string[];
  missingSubCategoryRefs: string[];
  duplicateCategoryIds: string[];
  duplicateProductIds: string[];
  numericProductTagIds: string[];
  merchandisingSummary: {
    explicitCategoryCount: number;
    notExposedCategoryCount: number;
    note: string;
  };
  issues: MenuStructureIssue[];
}

function asArray(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value);
  return [];
}

function refId(value: any): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return String(value?.id || value?._id || value?.productId || value?.categoryId || value?.plu || '');
}

function categoryId(category: any): string {
  return String(category?.id || category?._id || category?.categoryId || '');
}

function productId(product: any): string {
  return String(product?.id || product?._id || product?.productId || product?.plu || '');
}

function explicitMerchandising(category: any): MenuCategoryInspection['merchandising'] {
  // Do not infer merchandising from category name/order. Only surface literal fields
  // if Deliverect exposes them in the received payload.
  if (Object.prototype.hasOwnProperty.call(category || {}, 'isMerchandising')) {
    return { status: 'EXPLICIT', value: category.isMerchandising, sourceField: 'isMerchandising' };
  }
  if (Object.prototype.hasOwnProperty.call(category || {}, 'merchandising')) {
    return { status: 'EXPLICIT', value: category.merchandising, sourceField: 'merchandising' };
  }
  return { status: 'NOT_EXPOSED' };
}

export function inspectDeliverectMenu(rawMenu: any): DeliverectMenuInspection {
  const rawCategories = asArray(rawMenu?.categories);
  const rawProducts = asArray(rawMenu?.products);

  const categoryIds = rawCategories.map(categoryId).filter(Boolean);
  const productIds = rawProducts.map(productId).filter(Boolean);
  const categoryIdSet = new Set(categoryIds);
  const productIdSet = new Set(productIds);

  const duplicateCategoryIds = Array.from(new Set(categoryIds.filter((id, i) => categoryIds.indexOf(id) !== i)));
  const duplicateProductIds = Array.from(new Set(productIds.filter((id, i) => productIds.indexOf(id) !== i)));
  const referencedProducts = new Set<string>();
  const unmappedCategoryProductRefs = new Set<string>();
  const missingSubCategoryRefs = new Set<string>();
  const numericProductTagIds = new Set<string>();

  const categories: MenuCategoryInspection[] = rawCategories.map((category: any) => {
    const id = categoryId(category);
    const rawProductRefs = Array.isArray(category?.subProducts)
      ? category.subProducts
      : Array.isArray(category?.productIds)
        ? category.productIds
        : Array.isArray(category?.products)
          ? category.products
          : [];
    const productRefs = rawProductRefs.map(refId).filter(Boolean);
    for (const ref of productRefs) {
      referencedProducts.add(ref);
      if (!productIdSet.has(ref)) unmappedCategoryProductRefs.add(ref);
    }

    const rawChildren = Array.isArray(category?.subCategories)
      ? category.subCategories
      : Array.isArray(category?.subcategories)
        ? category.subcategories
        : [];
    const childCategoryIds = rawChildren.map(refId).filter(Boolean);
    for (const childId of childCategoryIds) if (!categoryIdSet.has(childId)) missingSubCategoryRefs.add(childId);

    return {
      id,
      name: String(category?.name || ''),
      directProductCount: productRefs.length,
      childCategoryIds,
      hasNativeSubCategories: childCategoryIds.length > 0,
      merchandising: explicitMerchandising(category),
    };
  });

  for (const product of rawProducts) {
    for (const tag of Array.isArray(product?.productTags) ? product.productTags : []) {
      const tagId = String(tag);
      if (/^\d+$/.test(tagId)) numericProductTagIds.add(tagId);
    }
  }

  const orphanProductIds = productIds.filter((id) => !referencedProducts.has(id));
  const issues: MenuStructureIssue[] = [];
  for (const id of duplicateCategoryIds) issues.push({ severity: 'ERROR', code: 'DUPLICATE_CATEGORY_ID', message: `Duplicate category id ${id}.`, categoryId: id });
  for (const id of duplicateProductIds) issues.push({ severity: 'ERROR', code: 'DUPLICATE_PRODUCT_ID', message: `Duplicate product id ${id}.`, productId: id });
  for (const id of missingSubCategoryRefs) issues.push({ severity: 'ERROR', code: 'MISSING_SUBCATEGORY_REFERENCE', message: `Category references missing subcategory ${id}.`, categoryId: id });
  for (const id of unmappedCategoryProductRefs) issues.push({ severity: 'ERROR', code: 'MISSING_PRODUCT_REFERENCE', message: `Category references product ${id}, but that product is absent from the menu.`, productId: id });
  for (const id of orphanProductIds) issues.push({ severity: 'WARNING', code: 'ORPHAN_PRODUCT', message: `Product ${id} is not referenced by any category.`, productId: id });

  const explicitCategoryCount = categories.filter((c) => c.merchandising.status === 'EXPLICIT').length;
  return {
    menuId: String(rawMenu?.menuId || rawMenu?.id || rawMenu?._id || ''),
    menuName: String(rawMenu?.menu || rawMenu?.name || ''),
    ...(typeof rawMenu?.menuType === 'number' ? { menuType: rawMenu.menuType } : {}),
    categoryCount: rawCategories.length,
    productCount: rawProducts.length,
    nativeHierarchyDetected: categories.some((c) => c.hasNativeSubCategories),
    categories,
    orphanProductIds,
    unmappedCategoryProductRefs: Array.from(unmappedCategoryProductRefs),
    missingSubCategoryRefs: Array.from(missingSubCategoryRefs),
    duplicateCategoryIds,
    duplicateProductIds,
    numericProductTagIds: Array.from(numericProductTagIds).sort((a,b) => Number(a)-Number(b)),
    merchandisingSummary: {
      explicitCategoryCount,
      notExposedCategoryCount: categories.length - explicitCategoryCount,
      note: explicitCategoryCount > 0
        ? 'Only literal isMerchandising/merchandising fields from the received payload are reported. No category-name inference is used.'
        : 'The public Commerce menu payload did not expose a literal merchandising flag. Bwydi will not infer one from category names or ordering.',
    },
    issues,
  };
}

export function selectRawMenu(payload: any, requestedMenuId?: string): any | null {
  const menus = Array.isArray(payload) ? payload : Array.isArray(payload?._items) ? payload._items : payload ? [payload] : [];
  if (menus.length === 0) return null;
  if (!requestedMenuId) return menus[0];
  return menus.find((menu: any) => String(menu?.menuId || menu?.id || menu?._id || '') === requestedMenuId) || null;
}
