import { Category } from './models';

/**
 * Deliverect Commerce API Category Hierarchy Standards:
 * Up to 3 levels of nesting supported:
 * Level 1: Department (e.g., Fresh Produce, Bakery & Bread, Dairy & Chilled)
 * Level 2: Aisle / Subcategory (e.g., Artisan Sourdough & Specialty Loaves, Citrus & Apples)
 * Level 3: Shelf / Sub-subcategory (e.g., San Francisco White Sourdough, Organic Blueberries)
 */

export interface FlattenedCategoryOption {
  id: string;
  name: string;
  level: 1 | 2 | 3;
  parentId: string | null;
  path: string; // e.g. "cat-bakery > cat-bakery-sourdough > cat-bakery-sourdough-white"
  fullPathNames: string; // e.g. "Bakery & Bread > Artisan Sourdough > San Francisco White Sourdough"
  productCount?: number;
  indentPrefix?: string;
}

/**
 * Recursively collects the given categoryId and all its descendant category IDs (Level 2 and Level 3).
 * When filtering products by a category, checking if product.categoryIds intersects this list ensures
 * that selecting a Department or Aisle displays all child shelf items.
 */
export function getCategoryAndAllDescendantIds(
  categories: Category[],
  targetCategoryId: string
): string[] {
  const targetCategory = findCategoryById(categories, targetCategoryId);
  if (!targetCategory) return [targetCategoryId];

  const ids: string[] = [targetCategory.id];

  function collect(cat: Category) {
    if (cat.subcategories && cat.subcategories.length > 0) {
      for (const sub of cat.subcategories) {
        ids.push(sub.id);
        collect(sub);
      }
    }
  }

  collect(targetCategory);
  return ids;
}

/**
 * Recursively finds a category by its ID at any of the 3 levels.
 */
export function findCategoryById(
  categories: Category[],
  targetId: string
): Category | null {
  for (const cat of categories) {
    if (cat.id === targetId) return cat;
    if (cat.subcategories && cat.subcategories.length > 0) {
      const found = findCategoryById(cat.subcategories, targetId);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Finds the breadcrumb path from Level 1 down to the target category.
 */
export function getCategoryBreadcrumbPath(
  categories: Category[],
  targetId: string,
  currentPath: Category[] = []
): Category[] | null {
  for (const cat of categories) {
    const newPath = [...currentPath, cat];
    if (cat.id === targetId) return newPath;
    if (cat.subcategories && cat.subcategories.length > 0) {
      const subPath = getCategoryBreadcrumbPath(cat.subcategories, targetId, newPath);
      if (subPath) return subPath;
    }
  }
  return null;
}

/**
 * Flattens 3-level categories into an indented list suitable for dropdowns and admin selectors.
 */
export function flattenCategoriesWithIndentation(
  categories: Category[],
  parentPath = '',
  parentNames = '',
  currentLevel: 1 | 2 | 3 = 1,
  parentId: string | null = null
): FlattenedCategoryOption[] {
  const result: FlattenedCategoryOption[] = [];

  for (const cat of categories) {
    if (!cat) continue;
    const catName = cat.name || '';
    const path = parentPath ? `${parentPath} > ${cat.id}` : cat.id;
    const fullPathNames = parentNames ? `${parentNames} > ${catName}` : catName;

    const indentPrefix = currentLevel === 1 ? '' : currentLevel === 2 ? '— ' : '—— ';
    result.push({
      id: cat.id,
      name: catName,
      level: (cat.level || currentLevel) as 1 | 2 | 3,
      parentId: cat.parentId || parentId,
      path,
      fullPathNames,
      productCount: cat.productCount,
      indentPrefix,
    });

    if (cat.subcategories && cat.subcategories.length > 0) {
      const nextLevel = Math.min(3, currentLevel + 1) as 1 | 2 | 3;
      result.push(
        ...flattenCategoriesWithIndentation(
          cat.subcategories,
          path,
          fullPathNames,
          nextLevel,
          cat.id
        )
      );
    }
  }

  return result;
}

/**
 * Formats a product's category membership for display in tables and detail cards.
 */
export function getProductCategoryDisplay(
  categories: Category[],
  categoryIds: string[] = []
): { primaryName: string; fullBreadcrumb: string; level: number } {
  if (!categoryIds || categoryIds.length === 0) {
    return { primaryName: 'Uncategorised', fullBreadcrumb: 'Uncategorised', level: 1 };
  }

  // Find the deepest assigned category in the hierarchy
  let deepestCrumb: Category[] | null = null;

  for (const catId of categoryIds) {
    const chain = getCategoryBreadcrumbPath(categories, catId);
    if (chain && (!deepestCrumb || chain.length > deepestCrumb.length)) {
      deepestCrumb = chain;
    }
  }

  if (!deepestCrumb || deepestCrumb.length === 0) {
    const fallbackId = categoryIds[0] || 'Uncategorised';
    return { primaryName: fallbackId, fullBreadcrumb: fallbackId, level: 1 };
  }

  const deepest = deepestCrumb[deepestCrumb.length - 1];
  const primaryName = deepest?.name || categoryIds[0] || 'Category';
  const fullBreadcrumb = deepestCrumb.map((c) => c?.name || '').filter(Boolean).join(' › ');
  const level = Math.min(3, deepestCrumb.length);

  return { primaryName, fullBreadcrumb, level };
}
