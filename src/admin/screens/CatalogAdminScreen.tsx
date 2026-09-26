import React, { useState, useMemo, useEffect } from 'react';
import { catalogStore } from '../../commerce/catalogStore';
import { Product, ProductStockStatus, formatMoney, moneyToMajor, Category, Store } from '../../commerce/models';
import { useTenant } from '../../tenant/TenantContext';
import { DEFAULT_TENANT_ID } from '../../tenant/constants';
import { defaultAdminClient } from '../../commerce/HttpAdminClient';
import { onAdminAiPrefill } from '../adminAiGuide';
import {
  Package,
  Search,
  RefreshCw,
  Store as StoreIcon,
  CheckCircle2,
  AlertTriangle,
  Info,
  Layers,
  Sliders,
  Eye,
  X,
  Radio,
  Tag,
  Barcode,
} from 'lucide-react';

function formatProductPrice(product: Product): string {
  const price = product.price ?? (product.priceMinor != null ? { amount: product.priceMinor, currency: 'GBP' } : undefined);
  return price == null ? 'Price unavailable' : formatMoney(price);
}

interface CatalogAdminScreenProps {
  tenantId?: string;
}

export const CatalogAdminScreen: React.FC<CatalogAdminScreenProps> = ({ tenantId = DEFAULT_TENANT_ID }) => {
  const { appMode } = useTenant();
  const isDemoMode = appMode === 'demo';

  const [products, setProducts] = useState<Product[]>(() => isDemoMode ? catalogStore.getProducts() : []);
  const [categories, setCategories] = useState<Category[]>(() => isDemoMode ? catalogStore.getCategories() : []);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState<boolean>(!isDemoMode);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterLifecycle, setFilterLifecycle] = useState<'all' | 'active' | 'archived' | 'inactive'>('all');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);



  useEffect(() =>
    onAdminAiPrefill('catalog', ({ prefill }) => {
      if (typeof prefill?.searchQuery === 'string') {
        setSearchQuery(prefill.searchQuery);
        setPage(1);
      }
    }),
  []);

  // Load products and categories from commerce client (handling location change)
  useEffect(() => {
    setLoadError(null);
    setProducts([]);
    setCategories([]);
    if (isDemoMode) {
      setLoading(false);
      setProducts(catalogStore.getProducts());
      setCategories(catalogStore.getCategories());
      return;
    }

    let isMounted = true;
    setLoading(true);

    const loadPromise = defaultAdminClient.getCommerceCatalog
      ? defaultAdminClient
          .getCommerceCatalog(tenantId, selectedLocationId === 'all' ? undefined : selectedLocationId)
          .then(({ stores: tenantStores, catalog }) => ({
            stores: tenantStores || [],
            products: catalog.products || [],
            categories: catalog.categories || [],
          }))
      : Promise.reject(new Error('Tenant-scoped Admin catalogue endpoint is unavailable.'));

    loadPromise
      .then((res) => {
        if (!isMounted) return;
        setStores(res.stores);
        setProducts(res.products);
        setCategories(res.categories || []);
      })
      .catch((err) => {
        console.error('Failed to fetch live catalog in admin:', err);
        if (isMounted) setLoadError(err instanceof Error ? err.message : 'Unable to load the selected catalogue.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isDemoMode, selectedLocationId, tenantId, reloadVersion]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.plu.toLowerCase().includes(q) ||
        p.brand?.toLowerCase().includes(q) ||
        p.gtin?.some((g) => g.toLowerCase().includes(q));

      const matchesCat = filterCategory === 'all' || p.categoryIds.includes(filterCategory);
      const lifecycle = String((p.metadata as any)?.lifecycleStatus || '').toUpperCase();
      const isArchived = lifecycle === 'ARCHIVED';
      const matchesLifecycle =
        filterLifecycle === 'all' ||
        (filterLifecycle === 'archived' && isArchived) ||
        (filterLifecycle === 'active' && !isArchived && p.active !== false) ||
        (filterLifecycle === 'inactive' && !isArchived && p.active === false);
      return matchesSearch && matchesCat && matchesLifecycle;
    });
  }, [products, searchQuery, filterCategory, filterLifecycle]);

  useEffect(() => { setPage(1); }, [searchQuery, filterCategory, filterLifecycle, selectedLocationId, pageSize, tenantId]);
  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedProducts = filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const inventorySummary = useMemo(() => ({
    total: filteredProducts.length,
    active: filteredProducts.filter((product) => (product.metadata as any)?.lifecycleStatus !== 'ARCHIVED' && product.active !== false).length,
    archived: filteredProducts.filter((product) => (product.metadata as any)?.lifecycleStatus === 'ARCHIVED').length,
    inactive: filteredProducts.filter((product) => (product.metadata as any)?.lifecycleStatus !== 'ARCHIVED' && product.active === false).length,
    outOfStock: filteredProducts.filter((product) => product.stockStatus === 'OUT_OF_STOCK' || product.stockQuantity === 0).length,
    unknown: filteredProducts.filter((product) => product.stockStatus == null && product.stockQuantity == null).length,
  }), [filteredProducts]);

  const downloadCatalog = (kind: 'products' | 'inventory' | 'json') => {
    const scope = selectedLocationId === 'all' ? 'root' : selectedLocationId;
    const safeScope = scope.replace(/[^a-zA-Z0-9_-]/g, '_');
    const csvCell = (value: unknown) => {
      const text = value == null ? '' : String(value);
      const safe = /^[=+@\-\t\r\n]/.test(text) ? "'" + text : text;
      return '"' + safe.replace(/"/g, '""') + '"';
    };
    const rows = filteredProducts.map((product) => {
      const price = product.price ?? (product.priceMinor != null ? { amount: product.priceMinor, currency: 'GBP' } : undefined);
      return [tenantId, scope, product.id, product.plu, product.name,
        price == null ? '' : moneyToMajor(price).toFixed(2),
        typeof price === 'object' ? price.currency : price == null ? '' : 'GBP',
        product.active == null ? 'unknown' : product.active,
        (product.metadata as any)?.lifecycleStatus || (product.active === false ? 'INACTIVE' : 'ACTIVE'),
        product.stockStatus ?? 'unknown', product.stockQuantity ?? '',
        product.categoryIds.join('|')];
    });
    const headers = ['tenantId', 'storeId', 'productId', 'plu', 'name', 'priceMajor', 'currency', 'active', 'lifecycleStatus', 'stockStatus', 'stockQuantity', 'categoryIds'];
    const content = kind === 'json'
      ? JSON.stringify({ tenantId, scope, exportedAt: new Date().toISOString(), products: filteredProducts }, null, 2)
      : '\uFEFF' + [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([content], { type: kind === 'json' ? 'application/json' : 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'catalog-' + kind + '-' + safeScope + (kind === 'json' ? '.json' : '.csv');
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleToggleSnooze = (product: Product) => {
    if (!isDemoMode) return;
    const isCurrentlyOut = product.stockStatus === 'OUT_OF_STOCK';
    const newStatus: ProductStockStatus = isCurrentlyOut ? 'IN_STOCK' : 'OUT_OF_STOCK';

    // Update in catalog store
    catalogStore.updateProduct(product.id, { stockStatus: newStatus });
    setProducts(catalogStore.getProducts());

    setActionSuccess(
      `${product.name} marked as ${newStatus === 'OUT_OF_STOCK' ? '86ed / Out of Stock' : 'Active / In Stock'}`
    );
    setTimeout(() => setActionSuccess(null), 3000);
  };

  const handleViewProduct = (product: Product) => {
    setSelectedProduct(product);
    setIsDetailModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner - Explaining Deliverect as Provider managed */}
      <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Package className="w-6 h-6 text-indigo-400" />
              <h2 className="text-xl font-bold text-white">Products & Stock</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Authoritative Master
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Operational visibility for products, pricing, ranging and stock. In live mode, Deliverect/POS remains authoritative; this page diagnoses what the storefront is receiving rather than acting as a PIM.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right text-xs">
              <span className="text-gray-400 block">Channel Link ID</span>
              <span className="font-mono text-emerald-400 font-bold">
                {selectedLocationId !== 'all' ? (stores.find((store) => store.id === selectedLocationId)?.channelLinkId || selectedLocationId) : 'Select a location'}
              </span>
            </div>
            <div className="h-8 w-px bg-gray-800" />
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 rounded-xl text-xs text-gray-300">
              <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
              <span>{isDemoMode ? 'Demo Sandbox (catalogStore)' : 'Live Deliverect Open API'}</span>
            </div>
          </div>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-700 text-emerald-200 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              data-admin-ai-target="catalog-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products by name, PLU, brand, or barcode/GTIN..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700 font-medium"
            >
              <option value="all">All Categories ({categories.length})</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              value={filterLifecycle}
              onChange={(e) => setFilterLifecycle(e.target.value as 'all' | 'active' | 'archived' | 'inactive')}
              aria-label="Product lifecycle"
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700 font-medium"
            >
              <option value="all">All states</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="inactive">Inactive</option>
            </select>

            <select
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700 font-medium"
            >
              <option value="all">All locations ({stores.length})</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
          <span>Showing {filteredProducts.length} items from pushed catalogue + live Commerce verification</span>
          <span className="flex items-center gap-1.5 text-indigo-600 font-medium">
            <Info className="w-3.5 h-3.5" />
            {isDemoMode ? 'Demo stock controls affect this sandbox only' : 'Manage stock in Deliverect or your POS'}
          </span>
        </div>
      </div>

      {loadError && (
        <div role="alert" className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-800 text-sm">
          <p className="font-semibold">Catalogue unavailable</p>
          <p>{loadError}</p>
          <button type="button" onClick={() => setReloadVersion((value) => value + 1)} className="mt-2 underline">Retry</button>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <label>Items per page <select aria-label="Items per page" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>{[25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
        <div className="flex items-center gap-3">
          <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button>
          <span>Page {currentPage} of {pageCount}</span>
          <button type="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Next</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 text-sm" aria-label="Catalogue availability summary">
        <div className="rounded-xl border p-3"><strong>{inventorySummary.active} of {inventorySummary.total}</strong><p>Active</p></div>
        <div className="rounded-xl border p-3"><strong>{inventorySummary.archived} of {inventorySummary.total}</strong><p>Archived / soft deleted</p></div>
        <div className="rounded-xl border p-3"><strong>{inventorySummary.inactive} of {inventorySummary.total}</strong><p>Inactive</p></div>
        <div className="rounded-xl border p-3"><strong>{inventorySummary.outOfStock} of {inventorySummary.total}</strong><p>Out of stock / snoozed</p></div>
        <div className="rounded-xl border p-3"><strong>{inventorySummary.unknown} of {inventorySummary.total}</strong><p>Stock unknown</p></div>
      </div>
      <div className="flex flex-wrap gap-3 text-sm">
        <button type="button" disabled={loading || !!loadError || !filteredProducts.length} onClick={() => downloadCatalog('products')} className="border rounded-lg px-3 py-2 disabled:opacity-40">Products CSV</button>
        <button type="button" disabled={loading || !!loadError || !filteredProducts.length || selectedLocationId === 'all'} onClick={() => downloadCatalog('inventory')} className="border rounded-lg px-3 py-2 disabled:opacity-40">Location inventory CSV</button>
        <button type="button" disabled={loading || !!loadError || !filteredProducts.length} onClick={() => downloadCatalog('json')} className="border rounded-lg px-3 py-2 disabled:opacity-40">Normalized JSON</button>
        <span className="text-xs text-gray-500 self-center">Exports include all filtered results across every page. Unknown quantities remain blank.</span>
      </div>

      {/* Catalogue Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-4">Deliverect PLU</th>
                <th className="py-3 px-4">Master Price</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Availability</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
                    <span>Loading catalogue items from Deliverect...</span>
                  </td>
                </tr>
              )}
              {!loading && !loadError && filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="font-semibold text-gray-600">No products found</p>
                    <p className="text-[11px] text-gray-400 mt-1">
                      {searchQuery || filterCategory !== 'all' || filterLifecycle !== 'all'
                        ? 'Try clearing your search, category, or lifecycle filter.'
                        : 'No items found in this store catalog.'}
                    </p>
                  </td>
                </tr>
              )}
              {!loading && !loadError && pagedProducts.map((p) => {
                const isOutOfStock = p.stockStatus === 'OUT_OF_STOCK';
                const isArchived = (p.metadata as any)?.lifecycleStatus === 'ARCHIVED';
                return (
                  <tr key={p.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={p.image || p.imageUrl || p.images?.[0] || ''}
                          alt={p.name}
                          className="w-10 h-10 rounded-xl object-cover border border-gray-100 bg-gray-50 shrink-0"
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <p className="font-bold text-gray-900 leading-snug">{p.name}</p>
                          <p className="text-[11px] text-gray-400 font-mono">ID: {p.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-gray-600">{p.plu}</td>
                    <td className="py-3 px-4 font-bold text-gray-900">
                      {formatProductPrice(p)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md font-medium text-[11px]">
                        {categories.find((c) => p.categoryIds.includes(c.id))?.name || 'General'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          isArchived
                            ? 'bg-slate-100 text-slate-700 border border-slate-300'
                            : isOutOfStock
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : p.active === false
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {isArchived ? 'Archived' : p.active === false ? 'Inactive' : isOutOfStock ? 'Out of Stock' : p.stockStatus === 'IN_STOCK' ? 'In Stock' : 'Stock unknown'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          disabled={!isDemoMode}
                          onClick={() => handleToggleSnooze(p)}
                          className={`px-3 py-1.5 rounded-xl font-semibold text-[11px] transition-colors cursor-pointer ${
                            isOutOfStock
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                          }`}
                          title={isDemoMode ? "Toggle demo stock" : "Manage stock in Deliverect or your POS"}
                        >
                          {isDemoMode ? (isOutOfStock ? 'Restore Stock' : '86 / Snooze') : 'Managed in Deliverect'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleViewProduct(p)}
                          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl"
                          title="View Authoritative Specs"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product details */}
      {isDetailModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-gray-900 text-base">Deliverect Item Specifications</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <div className="flex gap-4">
              <img
                src={selectedProduct.image || selectedProduct.imageUrl || selectedProduct.images?.[0] || ''}
                alt={selectedProduct.name}
                className="w-24 h-24 rounded-2xl object-cover border border-gray-100 shrink-0"
                referrerPolicy="no-referrer"
              />
              <div className="space-y-1">
                <h4 className="font-bold text-gray-900 text-base leading-snug">{selectedProduct.name}</h4>
                <p className="text-xs text-gray-500 line-clamp-2">{selectedProduct.description}</p>
                <p className="text-sm font-bold text-emerald-700 pt-1">
                  {formatProductPrice(selectedProduct)}
                </p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-2xl p-4 space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Deliverect Item ID:</span>
                <span className="font-mono font-medium">{selectedProduct.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">POS PLU Code:</span>
                <span className="font-mono font-bold">{selectedProduct.plu}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Barcode / GTIN:</span>
                <span className="font-mono">{selectedProduct.gtin?.join(', ') || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Tax Class:</span>
                <span>Standard Food & Beverage (VAT Exempt / 20%)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Modifier Groups:</span>
                <span>{selectedProduct.modifierGroups?.length || 0} configured</span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
