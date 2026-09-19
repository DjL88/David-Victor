import { useState, useEffect, useCallback, useMemo } from 'react';
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

export function useCatalog(selectedStoreId?: string) {
  const { client, appMode } = useTenant();

  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [summaries, setSummaries] = useState<Record<string, ProductAvailabilitySummary>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load catalog');
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
      if (res.summaries) {
        setSummaries(res.summaries);
      } else {
        setSummaries({});
      }
    } catch (err: unknown) {
      console.warn('Network issue loading products for category, attempting local fallback:', err);
      try {
        const local = catalogStore.getProducts();
        if (local && local.length > 0) {
          const filtered = selectedCategoryId
            ? local.filter((p) => p.categoryIds?.includes(selectedCategoryId))
            : local;
          setProducts(filtered);
          setError(null);
          return;
        }
      } catch {
        // local fallback not applicable
      }
      console.error('Failed to load products for category:', err);
      setError(err instanceof Error ? err.message : 'Failed to load products for category');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [client, selectedCategoryId, selectedStoreId]);

  useEffect(() => {
    fetchCatalog(false);
    loadProducts();
  }, [fetchCatalog, loadProducts]);

  // Restrict catalogStore subscription to demo mode only (local mock inventory / 86 toggles)
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
    navigateToCategory,
    refreshCatalog: () => fetchCatalog(true),
    resetCache: async () => {
      await client.resetCache();
      await fetchCatalog(true);
    },
    client,
  };
}
