import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Catalog, Category, Product, ProductAvailabilitySummary } from '../commerce/models';
import { useTenant } from '../tenant/TenantContext';
import { defaultAnalyticsClient } from '../analytics';
import { catalogStore } from '../commerce/catalogStore';
import { getRenderableProducts } from '../rules/availabilityRules';

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

export function useCatalog(selectedStoreId?: string) {
  const { client, tenant, appMode } = useTenant();
  const tenantId = tenant?.tenantId || 'brand-alpha';

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
      // Invalidate snapshot if scope changed
      if (
        snapshotRef.current &&
        (snapshotRef.current.tenantId !== tenantId || snapshotRef.current.storeId !== selectedStoreId)
      ) {
        snapshotRef.current = null;
      }
    }
  }, [tenantId, selectedStoreId]);

  // Load catalog (Root if no storeId, Store Catalog if storeId is selected)
  const fetchCatalog = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);
      let loadedCatalog: Catalog;
      if (selectedStoreId) {
        loadedCatalog = await client.getStoreCatalog(selectedStoreId, { refresh: forceRefresh });
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
  }, [client, selectedStoreId]);

  // Load products whenever category or store changes
  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await client.searchProducts('', selectedStoreId, {
        categoryId: selectedCategoryId || undefined,
      });

      setProducts(res.products);
      const newSummaries = res.summaries || {};
      setSummaries(newSummaries);
      setIsStale(false);

      if (snapshotRef.current && snapshotRef.current.tenantId === tenantId && snapshotRef.current.storeId === selectedStoreId) {
        snapshotRef.current.products = res.products;
        snapshotRef.current.summaries = newSummaries;
      }
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : 'Failed to load products for category';
      console.error('Failed to load products for category:', err);
      setError(errMessage);

      // In live modes and on error: strictly clear stale products, summaries, and snapshots
      setProducts([]);
      setSummaries({});
      setIsStale(false);
      snapshotRef.current = null;
    } finally {
      setLoading(false);
    }
  }, [client, tenantId, selectedCategoryId, selectedStoreId]);

  useEffect(() => {
    fetchCatalog(false);
    loadProducts();
  }, [fetchCatalog, loadProducts]);

  // Restrict catalogStore subscription strictly to demo mode only
  useEffect(() => {
    if (appMode !== 'demo') return;
    return catalogStore.subscribe(() => {
      fetchCatalog();
      loadProducts();
    });
  }, [appMode, fetchCatalog, loadProducts]);

  // Compute category breadcrumbs for recursive navigation
  const breadcrumbs = useMemo(() => {
    if (!catalog || !selectedCategoryId) return [];
    return findCategoryPath(catalog.categories, selectedCategoryId) || [];
  }, [catalog, selectedCategoryId]);

  const currentCategory = useMemo(() => {
    if (breadcrumbs.length === 0) return null;
    return breadcrumbs[breadcrumbs.length - 1];
  }, [breadcrumbs]);

  const currentSubcategories = useMemo(() => {
    if (!currentCategory) {
      return catalog?.categories || [];
    }
    if (currentCategory.subcategories && currentCategory.subcategories.length > 0) {
      return currentCategory.subcategories;
    }
    // If currentCategory is a leaf node (e.g. Level 3), show its siblings from parent so the user can easily switch shelves
    if (breadcrumbs.length > 1) {
      const parent = breadcrumbs[breadcrumbs.length - 2];
      return parent.subcategories || [];
    }
    return [];
  }, [catalog, currentCategory, breadcrumbs]);

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
    return getRenderableProducts(products);
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
