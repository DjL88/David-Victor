import { Category } from './models';

/**
 * Category hierarchy helpers for Bwydi / Deliverect catalogues.
 *
 * Deliverect can send categories in two materially different shapes:
 *
 * 1. Explicit hierarchy
 *    parentId / subcategories / children are present.
 *
 * 2. Sequential retail hierarchy
 *    the category array is flat and empty categories are structural headers.
 *    A common 3-level example is:
 *
 *      Dairy & Eggs       []
 *      Milk               []
 *      Whole Milk         [products]
 *      Semi Skimmed Milk  [products]
 *      Yogurt             []
 *      Greek Style        [products]
 *
 *    In that format the intended tree is:
 *
 *      Dairy & Eggs
 *        Milk
 *          Whole Milk
 *          Semi Skimmed Milk
 *        Yogurt
 *          Greek Style
 *
 * The sequential parser is intentionally feature-flagged because the empty-row
 * convention is not a universal Deliverect contract.
 */

export interface FlattenedCategoryOption {
  id: string;
  name: string;
  level: 1 | 2 | 3;
  parentId: string | null;
  path: string;
  fullPathNames: string;
  productCount?: number;
  indentPrefix?: string;
}

/**
 * Kept for backwards compatibility with older imports/tests.
 * New hierarchy construction uses Category[] directly so 3 levels are retained.
 */
export interface GroupedMenu {
  headerId: string;
  headerName: string;
  leafCategories: {
    id: string;
    name: string;
    productIds: string[];
  }[];
}

interface CategoryTreeOptions {
  enableSequentialCategoryGrouping?: boolean;
}

const PRODUCT_ARRAY_KEYS = ['subProducts', 'productIds', 'products'] as const;

function asId(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (!value || typeof value !== 'object') return '';
  const objectValue = value as Record<string, unknown>;
  return String(
    objectValue.id ||
      objectValue._id ||
      objectValue.productId ||
      objectValue.plu ||
      ''
  );
}

/**
 * Returns an exact direct product count when the source still exposes product
 * reference arrays. Returns undefined when that information is not present.
 */
function getArrayDirectProductCount(category: any): number | undefined {
  if (!category || typeof category !== 'object') return undefined;

  for (const key of PRODUCT_ARRAY_KEYS) {
    if (Array.isArray(category[key])) return category[key].length;
  }

  return undefined;
}

/**
 * DeliverectApiClient normalises subProducts into productCount before this helper
 * is called. The previous implementation ignored productCount, causing every
 * normalised category to look empty whenever the sequential flag was enabled.
 */
function getKnownProductCount(category: any): number | undefined {
  const arrayCount = getArrayDirectProductCount(category);
  if (arrayCount !== undefined) return arrayCount;

  const count = Number(category?.productCount);
  return Number.isFinite(count) && count >= 0 ? count : undefined;
}

function hasKnownProducts(category: any): boolean {
  const count = getKnownProductCount(category);
  return count !== undefined && count > 0;
}

function isKnownEmpty(category: any): boolean {
  return getKnownProductCount(category) === 0;
}

function makeCategoryNode(
  source: any,
  index: number,
  level: 1 | 2 | 3,
  parentId: string | null
): Category {
  const id = String(source?.id || source?._id || `category-${index}`);
  const count = getKnownProductCount(source);

  return {
    ...source,
    id,
    name: String(source?.name || 'Category'),
    description: source?.description || '',
    imageUrl: source?.imageUrl || undefined,
    parentId,
    level,
    subcategories: undefined,
    ...(count !== undefined ? { productCount: count } : {}),
  };
}

function appendChild(parent: Category, child: Category): void {
  if (!parent.subcategories) parent.subcategories = [];
  if (!parent.subcategories.some((existing) => existing.id === child.id)) {
    parent.subcategories.push(child);
  }
}

/**
 * Deliverect resizer URLs can have a different host/signature while still
 * pointing at the same underlying asset. Comparing the final path segment makes
 * the sequential root-boundary heuristic a little more robust than exact URL
 * equality while remaining deterministic.
 */
function imageIdentity(imageUrl?: string): string {
  if (!imageUrl) return '';
  const withoutQuery = String(imageUrl).split('?')[0].replace(/\/+$/, '');
  const parts = withoutQuery.split('/');
  return (parts[parts.length - 1] || '').toLowerCase();
}

function hasExplicitHierarchy(categories: any[]): boolean {
  const ids = new Set(
    categories
      .map((category) => String(category?.id || category?._id || ''))
      .filter(Boolean)
  );

  return categories.some((category) => {
    if (!category) return false;

    if (Array.isArray(category.subcategories) && category.subcategories.length > 0) return true;
    if (Array.isArray(category.subCategories) && category.subCategories.length > 0) return true;
    if (Array.isArray(category.children) && category.children.length > 0) return true;

    const parentId = String(
      category.parentId ||
        category.parent ||
        category.parentCategoryId ||
        category.parent_id ||
        category.categoryParentId ||
        ''
    );

    if (parentId && ids.has(parentId)) return true;
    if (Number(category.level) > 1) return true;

    return false;
  });
}

/**
 * In the sequential 3-level format, a new department/root is represented by an
 * empty category immediately followed by another empty category using the same
 * category artwork. The second row is the first aisle within that department.
 *
 * This matches Deliverect retail payloads such as:
 *   Dairy & Eggs []  (same artwork)
 *   Milk         []  (same artwork)
 *   Whole Milk   [products]
 *
 * Empty aisle rows that never acquire products are later pruned.
 */
function detectSequentialRootMarkers(categories: any[]): Set<number> {
  const markers = new Set<number>();

  for (let index = 0; index < categories.length - 1; index += 1) {
    const current = categories[index];
    const next = categories[index + 1];

    if (!isKnownEmpty(current) || !isKnownEmpty(next)) continue;

    const currentImage = imageIdentity(current?.imageUrl);
    const nextImage = imageIdentity(next?.imageUrl);

    if (currentImage && nextImage && currentImage === nextImage) {
      markers.add(index);
    }
  }

  return markers;
}

/**
 * Builds a 3-level hierarchy for Deliverect's flat sequential retail format.
 *
 * Important behaviour:
 * - populated categories before the first structural header remain roots
 *   (e.g. Deals);
 * - root marker -> level 1;
 * - following empty rows -> level 2 aisle headers;
 * - following populated rows -> level 3 shelves;
 * - a later root marker starts a new level 1 department;
 * - empty level 2 rows with no populated descendants are pruned later.
 */
function buildThreeLevelSequentialTree(categories: any[]): Category[] {
  const rootMarkers = detectSequentialRootMarkers(categories);
  const roots: Category[] = [];

  let currentRoot: Category | null = null;
  let currentSection: Category | null = null;

  categories.forEach((rawCategory, index) => {
    if (!rawCategory) return;

    if (rootMarkers.has(index)) {
      const root = makeCategoryNode(rawCategory, index, 1, null);
      root.subcategories = [];
      roots.push(root);
      currentRoot = root;
      currentSection = null;
      return;
    }

    if (hasKnownProducts(rawCategory)) {
      if (currentSection) {
        appendChild(
          currentSection,
          makeCategoryNode(rawCategory, index, 3, currentSection.id)
        );
        return;
      }

      if (currentRoot) {
        appendChild(currentRoot, makeCategoryNode(rawCategory, index, 2, currentRoot.id));
        return;
      }

      // Standalone populated category before/without an empty structural header.
      roots.push(makeCategoryNode(rawCategory, index, 1, null));
      return;
    }

    if (isKnownEmpty(rawCategory)) {
      if (currentRoot) {
        const section = makeCategoryNode(rawCategory, index, 2, currentRoot.id);
        section.subcategories = [];
        appendChild(currentRoot, section);
        currentSection = section;
        return;
      }

      // A payload can begin with a single empty parent rather than the richer
      // same-image root marker convention. Preserve legacy behaviour here.
      const root = makeCategoryNode(rawCategory, index, 1, null);
      root.subcategories = [];
      roots.push(root);
      currentRoot = root;
      currentSection = null;
      return;
    }

    // Unknown product state: preserve the category rather than incorrectly
    // deleting it. It can still be navigated if an upstream source omitted counts.
    roots.push(makeCategoryNode(rawCategory, index, 1, null));
    currentRoot = null;
    currentSection = null;
  });

  return roots;
}

/**
 * Legacy 2-level fallback for sequential feeds without the richer 3-level
 * same-image marker pattern. This preserves the behaviour of the old feature
 * flag, but now understands productCount as well as raw product arrays.
 */
function buildTwoLevelSequentialTree(categories: any[]): Category[] {
  const roots: Category[] = [];
  let currentHeader: Category | null = null;

  categories.forEach((rawCategory, index) => {
    if (!rawCategory) return;

    if (isKnownEmpty(rawCategory)) {
      const root = makeCategoryNode(rawCategory, index, 1, null);
      root.subcategories = [];
      roots.push(root);
      currentHeader = root;
      return;
    }

    if (hasKnownProducts(rawCategory) && currentHeader) {
      appendChild(currentHeader, makeCategoryNode(rawCategory, index, 2, currentHeader.id));
      return;
    }

    roots.push(makeCategoryNode(rawCategory, index, 1, null));
    currentHeader = null;
  });

  return roots;
}

function buildSequentialCategoryTree(categories: any[]): Category[] {
  const rootMarkers = detectSequentialRootMarkers(categories);
  return rootMarkers.size > 0
    ? buildThreeLevelSequentialTree(categories)
    : buildTwoLevelSequentialTree(categories);
}

/**
 * Removes only categories that are PROVABLY empty.
 *
 * A category is kept when:
 * - it has at least one visible descendant; or
 * - productCount / raw product arrays prove it contains products; or
 * - product state is unknown (fail open for visibility rather than deleting data).
 *
 * This means storefronts no longer render dead Deliverect rows such as an empty
 * "Wraps" aisle, while valid structural parents such as "Dairy & Eggs" remain
 * because they contain populated descendants.
 */
export function pruneEmptyCategoryTree(categories: Category[]): Category[] {
  const pruneNode = (category: Category): Category | null => {
    const children = (category.subcategories || [])
      .map(pruneNode)
      .filter((child): child is Category => Boolean(child));

    const arrayDirectCount = getArrayDirectProductCount(category as any);
    const numericCount = getKnownProductCount(category as any);
    const childCount = children.reduce((sum, child) => sum + (child.productCount || 0), 0);

    let productCount: number | undefined;
    if (arrayDirectCount !== undefined) {
      productCount = arrayDirectCount + childCount;
    } else if (numericCount !== undefined) {
      // Numeric productCount may already include descendants, so never double-count it.
      productCount = Math.max(numericCount, childCount);
    } else if (children.length > 0) {
      productCount = childCount;
    }

    if (children.length > 0) {
      return {
        ...category,
        subcategories: children,
        ...(productCount !== undefined ? { productCount } : {}),
      };
    }

    // No descendants remain. Only remove the node when we KNOW it is empty.
    if (numericCount === 0) return null;

    return {
      ...category,
      subcategories: undefined,
      ...(productCount !== undefined ? { productCount } : {}),
    };
  };

  return categories
    .map(pruneNode)
    .filter((category): category is Category => Boolean(category));
}

function buildExplicitCategoryTree(inputCategories: Category[] | any[]): Category[] {
  const categoryMap = new Map<string, Category>();
  const childIdsByParent = new Map<string, Set<string>>();
  const childIds = new Set<string>();

  const addRelationship = (parentId: string, childId: string) => {
    if (!parentId || !childId || parentId === childId) return;
    if (!childIdsByParent.has(parentId)) childIdsByParent.set(parentId, new Set());
    childIdsByParent.get(parentId)!.add(childId);
    childIds.add(childId);
  };

  const collect = (
    categories: any[],
    nestedParentId: string | null = null,
    nestedLevel: number = 1
  ) => {
    for (const rawCategory of categories) {
      if (!rawCategory) continue;

      const id = String(rawCategory.id || rawCategory._id || '');
      if (!id) continue;

      const explicitParentId = String(
        rawCategory.parentId ||
          rawCategory.parent ||
          rawCategory.parentCategoryId ||
          rawCategory.parent_id ||
          rawCategory.categoryParentId ||
          nestedParentId ||
          ''
      );

      const existing = categoryMap.get(id);
      const copy: Category = {
        ...(existing || {}),
        ...rawCategory,
        id,
        name: String(rawCategory.name || existing?.name || 'Category'),
        parentId: explicitParentId || existing?.parentId || null,
        level: Math.min(3, Number(rawCategory.level || existing?.level || nestedLevel || 1)),
        subcategories: undefined,
      };
      categoryMap.set(id, copy);

      if (explicitParentId) addRelationship(explicitParentId, id);

      const nestedChildren = Array.isArray(rawCategory.subcategories)
        ? rawCategory.subcategories
        : Array.isArray(rawCategory.subCategories)
          ? rawCategory.subCategories
          : Array.isArray(rawCategory.children)
            ? rawCategory.children
            : [];

      if (nestedChildren.length > 0) {
        for (const child of nestedChildren) {
          const childId = asId(child);
          if (childId) addRelationship(id, childId);
        }
        collect(nestedChildren, id, Math.min(3, nestedLevel + 1));
      }
    }
  };

  collect(inputCategories as any[]);

  const building = new Set<string>();
  const buildNode = (
    categoryId: string,
    level: 1 | 2 | 3,
    parentId: string | null
  ): Category | null => {
    if (building.has(categoryId)) return null;

    const source = categoryMap.get(categoryId);
    if (!source) return null;

    building.add(categoryId);
    const children = Array.from(childIdsByParent.get(categoryId) || [])
      .map((childId) => buildNode(childId, Math.min(3, level + 1) as 1 | 2 | 3, categoryId))
      .filter((child): child is Category => Boolean(child));
    building.delete(categoryId);

    return {
      ...source,
      parentId,
      level,
      subcategories: children.length > 0 ? children : undefined,
    };
  };

  const roots: Category[] = [];
  for (const categoryId of categoryMap.keys()) {
    if (childIds.has(categoryId)) continue;
    const root = buildNode(categoryId, 1, null);
    if (root) roots.push(root);
  }

  // Defensive orphan handling for malformed/cyclic payloads.
  if (roots.length === 0) {
    for (const categoryId of categoryMap.keys()) {
      const root = buildNode(categoryId, 1, null);
      if (root) roots.push(root);
    }
  }

  return roots;
}

/**
 * Parses Deliverect's flattened sequential category array into the historical
 * GroupedMenu shape. Retained for compatibility; storefront logic should use
 * ensureNestedCategoryTree so 3 levels are not collapsed.
 */
export function buildCategoryHierarchy(deliverectCategories: any[]): GroupedMenu[] {
  const tree = pruneEmptyCategoryTree(buildSequentialCategoryTree(deliverectCategories || []));
  const rawById = new Map<string, any>();
  for (const raw of deliverectCategories || []) {
    const id = String(raw?.id || raw?._id || '');
    if (id) rawById.set(id, raw);
  }

  const collectLeaves = (category: Category): GroupedMenu['leafCategories'] => {
    if (!category.subcategories || category.subcategories.length === 0) {
      const raw = rawById.get(category.id);
      const productRefs = PRODUCT_ARRAY_KEYS.flatMap((key) =>
        Array.isArray(raw?.[key]) ? raw[key] : []
      );
      return [
        {
          id: category.id,
          name: category.name,
          productIds: Array.from(new Set(productRefs.map(asId).filter(Boolean))),
        },
      ];
    }

    return category.subcategories.flatMap(collectLeaves);
  };

  return tree.map((root) => ({
    headerId: root.id,
    headerName: root.name,
    leafCategories: collectLeaves(root),
  }));
}

/**
 * Converts the legacy GroupedMenu structure into Category[] tree nodes.
 */
export function convertGroupedMenuToCategories(groupedMenu: GroupedMenu[]): Category[] {
  return pruneEmptyCategoryTree(
    groupedMenu.map((group) => {
      const subcategories: Category[] = group.leafCategories.map((leaf) => ({
        id: leaf.id,
        name: leaf.name,
        level: 2,
        parentId: group.headerId,
        productCount: leaf.productIds.length,
      }));

      return {
        id: group.headerId,
        name: group.headerName,
        level: 1,
        parentId: null,
        subcategories: subcategories.length > 0 ? subcategories : undefined,
        productCount: subcategories.reduce((sum, subcategory) => sum + (subcategory.productCount || 0), 0),
      };
    })
  );
}

/**
 * Normalises flat/explicit/sequential category inputs into a clean tree.
 *
 * Storefront safety rule: provably empty leaf categories are always removed.
 * Structural parents are retained whenever they have populated descendants.
 */
export function ensureNestedCategoryTree(
  inputCategories: Category[] | any[],
  options?: CategoryTreeOptions
): Category[] {
  if (!inputCategories || inputCategories.length === 0) return [];

  const input = inputCategories.filter(Boolean);
  if (input.length === 0) return [];

  const explicitHierarchy = hasExplicitHierarchy(input);

  if (options?.enableSequentialCategoryGrouping && !explicitHierarchy) {
    const hasEmptyRows = input.some(isKnownEmpty);
    const hasPopulatedRows = input.some(hasKnownProducts);

    if (hasEmptyRows && hasPopulatedRows) {
      return pruneEmptyCategoryTree(buildSequentialCategoryTree(input));
    }
  }

  return pruneEmptyCategoryTree(buildExplicitCategoryTree(input));
}

/**
 * Recursively collects a category and all descendants. Parent-category product
 * filtering can then match any product assigned to a child shelf.
 */
export function getCategoryAndAllDescendantIds(
  categories: Category[],
  targetCategoryId: string
): string[] {
  const tree = ensureNestedCategoryTree(categories);
  const targetCategory = findCategoryByIdInTree(tree, targetCategoryId);
  if (!targetCategory) return [targetCategoryId];

  const ids: string[] = [];
  const collect = (category: Category) => {
    ids.push(category.id);
    for (const child of category.subcategories || []) collect(child);
  };
  collect(targetCategory);
  return ids;
}

function findCategoryByIdInTree(categories: Category[], targetId: string): Category | null {
  for (const category of categories) {
    if (category.id === targetId) return category;
    const childMatch = findCategoryByIdInTree(category.subcategories || [], targetId);
    if (childMatch) return childMatch;
  }
  return null;
}

/** Recursively finds a category by ID at any supported level. */
export function findCategoryById(categories: Category[], targetId: string): Category | null {
  return findCategoryByIdInTree(ensureNestedCategoryTree(categories), targetId);
}

function getBreadcrumbPathInTree(
  categories: Category[],
  targetId: string,
  currentPath: Category[]
): Category[] | null {
  for (const category of categories) {
    const nextPath = [...currentPath, category];
    if (category.id === targetId) return nextPath;

    const childPath = getBreadcrumbPathInTree(
      category.subcategories || [],
      targetId,
      nextPath
    );
    if (childPath) return childPath;
  }

  return null;
}

/** Finds the breadcrumb path from level 1 down to the target category. */
export function getCategoryBreadcrumbPath(
  categories: Category[],
  targetId: string,
  currentPath: Category[] = []
): Category[] | null {
  const tree = currentPath.length === 0 ? ensureNestedCategoryTree(categories) : categories;
  return getBreadcrumbPathInTree(tree, targetId, currentPath);
}

/** Flattens nested categories into an indented admin/dropdown list. */
export function flattenCategoriesWithIndentation(
  categories: Category[],
  parentPath = '',
  parentNames = '',
  currentLevel: 1 | 2 | 3 = 1,
  parentId: string | null = null
): FlattenedCategoryOption[] {
  const result: FlattenedCategoryOption[] = [];

  for (const category of categories) {
    if (!category) continue;

    const categoryName = category.name || '';
    const path = parentPath ? `${parentPath} > ${category.id}` : category.id;
    const fullPathNames = parentNames
      ? `${parentNames} > ${categoryName}`
      : categoryName;
    const indentPrefix = currentLevel === 1 ? '' : currentLevel === 2 ? '— ' : '—— ';

    result.push({
      id: category.id,
      name: categoryName,
      level: (category.level || currentLevel) as 1 | 2 | 3,
      parentId: category.parentId || parentId,
      path,
      fullPathNames,
      productCount: category.productCount,
      indentPrefix,
    });

    if (category.subcategories && category.subcategories.length > 0) {
      const nextLevel = Math.min(3, currentLevel + 1) as 1 | 2 | 3;
      result.push(
        ...flattenCategoriesWithIndentation(
          category.subcategories,
          path,
          fullPathNames,
          nextLevel,
          category.id
        )
      );
    }
  }

  return result;
}

/** Formats a product's deepest category assignment for tables/detail cards. */
export function getProductCategoryDisplay(
  categories: Category[],
  categoryIds: string[] = []
): { primaryName: string; fullBreadcrumb: string; level: number } {
  if (!categoryIds || categoryIds.length === 0) {
    return {
      primaryName: 'Uncategorised',
      fullBreadcrumb: 'Uncategorised',
      level: 1,
    };
  }

  let deepestBreadcrumb: Category[] | null = null;

  for (const categoryId of categoryIds) {
    const chain = getCategoryBreadcrumbPath(categories, categoryId);
    if (chain && (!deepestBreadcrumb || chain.length > deepestBreadcrumb.length)) {
      deepestBreadcrumb = chain;
    }
  }

  if (!deepestBreadcrumb || deepestBreadcrumb.length === 0) {
    const fallbackId = categoryIds[0] || 'Uncategorised';
    return {
      primaryName: fallbackId,
      fullBreadcrumb: fallbackId,
      level: 1,
    };
  }

  const deepest = deepestBreadcrumb[deepestBreadcrumb.length - 1];
  return {
    primaryName: deepest?.name || categoryIds[0] || 'Category',
    fullBreadcrumb: deepestBreadcrumb
      .map((category) => category?.name || '')
      .filter(Boolean)
      .join(' › '),
    level: Math.min(3, deepestBreadcrumb.length),
  };
}
