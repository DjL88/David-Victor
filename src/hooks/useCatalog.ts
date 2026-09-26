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
  const [bundleSummaries, setBundleSummaries] = useState<Record<string, ProductAvailabilitySummary>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState<boolean>(false);

  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  // Store last-known-good snapshot scoped strictly to tenantId + storeId
  const snapshotRef = useRef<LastKnownCatalogSnapshot | null>(null);
  const prevScopeRef = useRef<string>(`${tenantId}:${selectedStoreId || 'root'}`);
  const catalogRequestRef = useRef(0);
  const productsRequestRef = useRef(0);
  const productsRef = useRef<Product[]>([]);

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
      setBundleSummaries({});
      setError(null);
      setIsStale(false);
      setSelectedCategoryId(null);
      catalogRequestRef.current += 1;
      productsRequestRef.current += 1;

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
    async (forceRefresh = false, background = false) => {
      const requestId = ++catalogRequestRef.current;
      const requestScope = `${tenantId}:${selectedStoreId || 'root'}`;

      try {
        if (!background) setLoading(true);
        if (!background) setError(null);

        let loadedCatalog: Catalog;
        if (selectedStoreId) {
          loadedCatalog = await client.getStoreCatalog(selectedStoreId, {
            refresh: forceRefresh,
          });
        } else {
          loadedCatalog = await client.getRootCatalog({ refresh: forceRefresh });
        }

        if (
          requestId !== catalogRequestRef.current ||
          requestScope !== `${tenantId}:${selectedStoreId || 'root'}`
        ) {
          return;
        }

        setCatalog(loadedCatalog);
        setError(null);
        setIsStale(false);

        snapshotRef.current = {
          tenantId,
          storeId: selectedStoreId,
          catalog: loadedCatalog,
          products: snapshotRef.current?.products || [],
          summaries: snapshotRef.current?.summaries || {},
        };
      } catch (err: unknown) {
        if (requestId !== catalogRequestRef.current) return;
        const errMessage = err instanceof Error ? err.message : 'Failed to load catalog';
        setError(errMessage);

        const snapshot = snapshotRef.current;
        if (
          snapshot &&
          snapshot.tenantId === tenantId &&
          snapshot.storeId === selectedStoreId
        ) {
          setCatalog(snapshot.catalog);
          setProducts(snapshot.products);
          setSummaries(snapshot.summaries);
          setIsStale(true);
        } else if (background) {
          // A live refresh failure must not turn a previously usable menu into an
          // empty menu. Keep the visible projection and make freshness explicit.
          setIsStale(true);
        } else {
          setCatalog(null);
          setProducts([]);
          setSummaries({});
          setBundleSummaries({});
          setIsStale(false);
        }
      } finally {
        if (!background && requestId === catalogRequestRef.current) setLoading(false);
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
  const loadProducts = useCallback(async (background = false) => {
    const requestId = ++productsRequestRef.current;
    const requestScope = `${tenantId}:${selectedStoreId || 'root'}:${selectedCategoryId || 'all'}`;

    try {
      if (!background) setLoading(true);
      if (!background) setError(null);

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
      const nextBundleSummaries = res.bundleSummaries || {};

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

      if (
        requestId !== productsRequestRef.current ||
        requestScope !== `${tenantId}:${selectedStoreId || 'root'}:${selectedCategoryId || 'all'}`
      ) {
        return;
      }

      setProducts(nextProducts);
      setSummaries(nextSummaries);
      setBundleSummaries(nextBundleSummaries);
      setError(null);
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
      if (requestId !== productsRequestRef.current) return;
      const errMessage =
        err instanceof Error ? err.message : 'Failed to load products for category';
      console.warn('[useCatalog] Failed to load products for category:', err);
      setError(errMessage);

      const snapshot = snapshotRef.current;
      if (
        snapshot &&
        snapshot.tenantId === tenantId &&
        snapshot.storeId === selectedStoreId
      ) {
        setProducts(snapshot.products);
        setSummaries(snapshot.summaries);
        setIsStale(true);
      } else if (background) {
        setIsStale(true);
      } else {
        setProducts([]);
        setSummaries({});
        setBundleSummaries({});
        setIsStale(false);
      }
    } finally {
      if (!background && requestId === productsRequestRef.current) setLoading(false);
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
  // before descendant filtering runs. Once a usable grid is already visible,
  // never switch back to blocking/skeleton loading for category or live refreshes.
  useEffect(() => {
    loadProducts(productsRef.current.length > 0);
  }, [loadProducts]);

  // Keep live storefronts close to the canonical database without blanking the
  // menu between refreshes. Focus/visibility refreshes are immediate; the
  // bounded interval is deliberately modest to avoid turning every browser into
  // a hot polling loop.
  useEffect(() => {
    if (appMode === 'demo' || typeof window === 'undefined') return;

    let disposed = false;
    let inFlight = false;
    const refreshLiveProjection = async () => {
      if (disposed || inFlight || document.visibilityState === 'hidden') return;
      inFlight = true;
      try {
        // Refresh the catalogue once. Updating its category/menu projection
        // naturally triggers the background product reload effect above.
        // Calling loadProducts here as well previously caused a duplicate request
        // and a second foreground-loading pass that visibly blanked the grid.
        await fetchCatalog(true, true);
      } finally {
        inFlight = false;
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refreshLiveProjection();
    };
    const onFocus = () => void refreshLiveProjection();

    const intervalId = window.setInterval(() => {
      void refreshLiveProjection();
    }, 15_000);

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [appMode, fetchCatalog, loadProducts]);

  // Restrict catalogStore subscription strictly to demo mode only
  useEffect(() => {
    if (appMode !== 'demo') return;
    return catalogStore.subscribe(() => {
      fetchCatalog();
      loadProducts();
    });
  }, [appMode, fetchCatalog, loadProducts]);

  const navigateToCategory = (categoryId: string | null) => {
    setError(null);
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
    bundleSummaries,
    selectedCategoryId,
    currentCategory,
    currentSubcategories,
    breadcrumbs,
    loading,
    error,
    isStale,
    navigateToCategory,
    refreshCatalog: async () => {
      await fetchCatalog(true);
      await loadProducts();
    },
    resetCache: async () => {
      await client.resetCache();
      await fetchCatalog(true);
      await loadProducts();
    },
    client,
  };
}
