import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Catalog, Category, Product, ProductAvailabilitySummary } from '../commerce/models';
import { useTenant } from '../tenant/TenantContext';
import { defaultAnalyticsClient } from '../analytics';
import { catalogStore } from '../commerce/catalogStore';
import { getRenderableProducts } from '../rules/availabilityRules';
import {
  ensureNestedCategoryTree,
  getCategoryAndAllDescendantIds,
} from '../commerce/categoryHierarchy';

// Helper to recursively find category and its parent chain in arbitrary nested tree
function findCategoryPath(
  categories: Category[],
  targetId: string,
  currentPath: Category[] = []
): Category[] | null {
  for (const cat of categories) {
    const newPath = [...currentPath, cat];
    if (cat.id === targetId) {
      return newPath;
    }
    if (cat.subcategories && cat.subcategories.length > 0) {
      const subPath = findCategoryPath(cat.subcategories, targetId, newPath);
      if (subPath) return subPath;
    }
  }
  return null;
}

interface LastKnownCatalogSnapshot {
  tenantId: string;
  storeId?: string;
  catalog: Catalog;
  products: Product[];
  summaries: Record<string, ProductAvailabilitySummary>;
}

/**
 * Filters an already-fetched product result to a category plus all descendants.
 *
 * This is required for the feature-flagged sequential Deliverect format because
 * the raw backend menu contains empty structural parent rows. Until that
 * hierarchy is persisted server-side, sending only the empty parent category ID
 * to /search returns no products. Leaf categories can still use the efficient
 * server-side category filter.
 */
function filterProductsToCategoryTree(
  products: Product[],
  summaries: Record<string, ProductAvailabilitySummary>,
  categoryTree: Category[],
  categoryId: string
): {
  products: Product[];
  summaries: Record<string, ProductAvailabilitySummary>;
} {
  const allowedCategoryIds = new Set(
    getCategoryAndAllDescendantIds(categoryTree, categoryId)
  );

  const filteredProducts = products.filter((product) =>
    (product.categoryIds || []).some((id) => allowedCategoryIds.has(id))
  );

  const allowedPlus = new Set(filteredProducts.map((product) => product.plu));
  const filteredSummaries = Object.fromEntries(
    Object.entries(summaries).filter(([plu]) => allowedPlus.has(plu))
  );

  return {
    products: filteredProducts,
    summaries: filteredSummaries,
  };
}

export function useCatalog(selectedStoreId?: string) {
  const { client, tenant, appMode } = useTenant();
  const tenantId = tenant?.tenantId || 'brand-alpha';
  const sequentialCategoryGroupingEnabled = Boolean(
    tenant?.featureFlags?.enableSequentialCategoryGrouping
  );

  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [summaries, setSummaries] = useState<Record<string, ProductAvailabilitySummary>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState<boolean>(false);

  // Store last-known-good snapshot scoped strictly to tenantId + storeId
  const snapshotRef = useRef<LastKnownCatalogSnapshot | null>(null);
  const prevScopeRef = useRef<string>(`${tenantId}:${selectedStoreId || 'root'}`);

  // Compute the storefront category tree once from the current catalogue.
  // categoryHierarchy.ts also removes provably empty leaf categories, so the
  // nav and Aisles modal never receive dead empty rows.
  const rootCategoryTree = useMemo(() => {
    return ensureNestedCategoryTree(catalog?.categories || [], {
      enableSequentialCategoryGrouping: sequentialCategoryGroupingEnabled,
    });
  }, [catalog, sequentialCategoryGroupingEnabled]);

  // Compute category breadcrumbs for recursive navigation
  const breadcrumbs = useMemo(() => {
    if (!catalog || !selectedCategoryId) return [];
    return findCategoryPath(rootCategoryTree, selectedCategoryId) || [];
  }, [catalog, rootCategoryTree, selectedCategoryId]);

  const currentCategory = useMemo(() => {
    if (breadcrumbs.length === 0) return null;
    return breadcrumbs[breadcrumbs.length - 1];
  }, [breadcrumbs]);

  const currentSubcategories = useMemo(() => {
    if (!currentCategory) {
      return rootCategoryTree;
    }
    if (currentCategory.subcategories && currentCategory.subcategories.length > 0) {
      return currentCategory.subcategories;
    }
    // If currentCategory is a leaf node (e.g. Level 3), show its siblings from parent
    // so the user can easily switch shelves.
    if (breadcrumbs.length > 1) {
      const parent = breadcrumbs[breadcrumbs.length - 2];
      return parent.subcategories || [];
    }
    return [];
  }, [rootCategoryTree, currentCategory, breadcrumbs]);

  // When store or tenant changes, immediately clear catalog, products, and summaries
  // to avoid mixing an old store's products/prices into the new store's screen.
  useEffect(() => {
    const currentScope = `${tenantId}:${selectedStoreId || 'root'}`;
    if (prevScopeRef.current !== currentScope) {
      prevScopeRef.current = currentScope;
      setCatalog(null);
      setProducts([]);
      setSummaries({});
      setError(null);
      setIsStale(false);
      setSelectedCategoryId(null);

      // Invalidate snapshot if scope changed
      if (
        snapshotRef.current &&
        (snapshotRef.current.tenantId !== tenantId ||
          snapshotRef.current.storeId !== selectedStoreId)
      ) {
        snapshotRef.current = null;
      }
    }
  }, [tenantId, selectedStoreId]);

  // Load catalog (Root if no storeId, Store Catalog if storeId is selected)
  const fetchCatalog = useCallback(
    async (forceRefresh = false) => {
      try {
        setLoading(true);
        setError(null);

        let loadedCatalog: Catalog;
        if (selectedStoreId) {
          loadedCatalog = await client.getStoreCatalog(selectedStoreId, {
            refresh: forceRefresh,
          });
        } else {
          loadedCatalog = await client.getRootCatalog({ refresh: forceRefresh });
        }

        setCatalog(loadedCatalog);
        setIsStale(false);

        // Update snapshot
        snapshotRef.current = {
          tenantId,
          storeId: selectedStoreId,
          catalog: loadedCatalog,
          products: snapshotRef.current?.products || [],
          summaries: snapshotRef.current?.summaries || {},
        };
      } catch (err: unknown) {
        const errMessage = err instanceof Error ? err.message : 'Failed to load catalog';
        setError(errMessage);

        // Fail closed on error: clear catalog, never retain stale or mismatched data
        setCatalog(null);
        setIsStale(false);
        snapshotRef.current = null;
      } finally {
        setLoading(false);
      }
    },
    [client, selectedStoreId, tenantId]
  );

  // Load products whenever category or store changes.
  //
  // Sequential parent categories are empty in the raw Deliverect payload. For a
  // reconstructed parent node, fetch the current store/root product result once
  // without a server category filter and then filter against that parent's full
  // descendant-ID set. Populated leaf categories still use server filtering.
  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const selectedPath = selectedCategoryId
        ? findCategoryPath(rootCategoryTree, selectedCategoryId)
        : null;
      const selectedCategory =
        selectedPath && selectedPath.length > 0
          ? selectedPath[selectedPath.length - 1]
          : null;

      const isSequentialParent = Boolean(
        sequentialCategoryGroupingEnabled &&
          selectedCategoryId &&
          selectedCategory?.subcategories &&
          selectedCategory.subcategories.length > 0
      );

      const res = await client.searchProducts('', selectedStoreId, {
        categoryId:
          selectedCategoryId && !isSequentialParent
            ? selectedCategoryId
            : undefined,
      });

      let nextProducts = res.products;
      let nextSummaries = res.summaries || {};

      if (isSequentialParent && selectedCategoryId) {
        const filtered = filterProductsToCategoryTree(
          nextProducts,
          nextSummaries,
          rootCategoryTree,
          selectedCategoryId
        );
        nextProducts = filtered.products;
        nextSummaries = filtered.summaries;
      }

      setProducts(nextProducts);
      setSummaries(nextSummaries);
      setIsStale(false);

      if (
        snapshotRef.current &&
        snapshotRef.current.tenantId === tenantId &&
        snapshotRef.current.storeId === selectedStoreId
      ) {
        snapshotRef.current.products = nextProducts;
        snapshotRef.current.summaries = nextSummaries;
      }
    } catch (err: unknown) {
      const errMessage =
        err instanceof Error ? err.message : 'Failed to load products for category';
      console.warn('[useCatalog] Failed to load products for category:', err);
      setError(errMessage);

      // In live modes and on error: strictly clear stale products, summaries, and snapshots
      setProducts([]);
      setSummaries({});
      setIsStale(false);
      snapshotRef.current = null;
    } finally {
      setLoading(false);
    }
  }, [
    client,
    tenantId,
    selectedCategoryId,
    selectedStoreId,
    rootCategoryTree,
    sequentialCategoryGroupingEnabled,
  ]);

  useEffect(() => {
    fetchCatalog(false);
  }, [fetchCatalog]);

  // Product loading is separate from catalog loading so that when the catalogue
  // is normalised into a hierarchy, selecting a parent has the final tree ready
  // before descendant filtering runs.
  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Restrict catalogStore subscription strictly to demo mode only
  useEffect(() => {
    if (appMode !== 'demo') return;
    return catalogStore.subscribe(() => {
      fetchCatalog();
      loadProducts();
    });
  }, [appMode, fetchCatalog, loadProducts]);

  const navigateToCategory = (categoryId: string | null) => {
    setSelectedCategoryId(categoryId);
    if (categoryId) {
      defaultAnalyticsClient.track({
        type: 'CATEGORY_BROWSED',
        categoryId,
        storeId: selectedStoreId,
      });
    }
  };

  // Canonical renderableProducts adhering to identical availability & rule evaluations as ProductCard
  const renderableProducts = useMemo(() => {
    const list = getRenderableProducts(products);

    // Exclude combo / bundle sub-components from main catalog feed
    return list.filter((product) => {
      if ((product as any).isCombo) return false;
      if (product.plu && product.plu.includes('#')) return false;
      if (product.canonicalPlu && product.canonicalPlu.includes('#')) return false;
      return true;
    });
  }, [products]);

  return {
    catalog,
    products,
    renderableProducts,
    summaries,
    selectedCategoryId,
    currentCategory,
    currentSubcategories,
    breadcrumbs,
    loading,
    error,
    isStale,
    navigateToCategory,
    refreshCatalog: () => fetchCatalog(true),
    resetCache: async () => {
      await client.resetCache();
      await fetchCatalog(true);
    },
    client,
  };
}
