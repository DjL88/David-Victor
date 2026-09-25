import React, { useState, useMemo, useEffect } from 'react';
import { Store, Coordinates, Address, normalizeStoreStatus } from '../../commerce/models';
import { useTenantStyles } from '../../tenant/useTenant';
import { formatDistance, formatCurrency } from '../../utils/formatters';
import { formatDistanceHuman } from '../../services/mapsDistanceService';
import { StoreLocationMap } from '../../components/maps/StoreLocationMap';
import {
  prioritizeStoresForCustomer,
  PrioritizedStore,
} from '../../services/storePrioritizationService';
import {
  Store as StoreIcon,
  X,
  Truck,
  ShoppingBag,
  Clock,
  Check,
  AlertCircle,
  Layers,
  Map as MapIcon,
  List,
  Search,
  Tag,
  Info,
  Phone,
  MapPin,
} from 'lucide-react';
import { catalogueProjectionCache } from '../../commerce/catalogStore';
import { Product, Money, moneyToMajor } from '../../commerce/models';
import { isDemoMode } from '../../domain/runtime';
import { getCommerceClient } from '../../commerce/CommerceClientFactory';
import { MarketplaceServiceBadge } from '../../components/MarketplaceServiceBadge';
import { isStorefrontMarketplaceService } from '../../commerce/deliveryMarketplace';

type StoreService = NonNullable<Store['services']>[number];

function StoreMarketplaceIcons({ services }: { services?: StoreService[] }) {
  const visible = (services || []).filter(isStorefrontMarketplaceService);
  if (visible.length === 0) return null;
  return (
    <section className="mt-6 border-t border-gray-200 pt-5">
      <h3 className="mb-3 text-base font-black text-gray-900">Also available on</h3>
      <div className="flex flex-wrap items-center gap-2" aria-label="Other active ordering channels">
        {visible.map((service) => <MarketplaceServiceBadge key={service.id} service={service} />)}
      </div>
    </section>
  );
}

function toMajorPrice(val?: Money | number | null): number | null {
  if (val === undefined || val === null) return null;
  if (typeof val === 'object' && typeof (val as any).amount === 'number') {
    return moneyToMajor(val);
  }
  if (typeof val === 'number') {
    if (isNaN(val) || !isFinite(val)) return null;
    return val >= 50 && Number.isInteger(val) ? val / 100 : val;
  }
  return null;
}

interface StorePickerModalProps {
  isOpen: boolean;
  stores: Store[];
  selectedStore: Store | null;
  onSelectStore: (store: Store | null) => void;
  onClose: () => void;
  loading: boolean;
  userCoordinates?: Coordinates | null;
  userAddress?: Address | null;
  dismissible?: boolean;
  targetProduct?: Product | null;
  onAddProductFromStore?: (store: Store, product: Product) => void;
}

export const StorePickerModal: React.FC<StorePickerModalProps> = ({
  isOpen,
  stores,
  selectedStore,
  onSelectStore,
  onClose,
  loading,
  userCoordinates = null,
  userAddress = null,
  dismissible = true,
  targetProduct = null,
  onAddProductFromStore,
}) => {
  const { primaryBtnStyle, currencySymbol } = useTenantStyles();
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [filterMode, setFilterMode] = useState<'active' | 'all'>('active');
  const [storeSearch, setStoreSearch] = useState<string>('');
  const [detailsStore, setDetailsStore] = useState<Store | null>(null);
  const [storeProductResults, setStoreProductResults] = useState<Record<string, { price?: Money | number; available: boolean }>>({});
  const [storeProductLoading, setStoreProductLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !targetProduct?.plu || stores.length === 0) {
      setStoreProductResults({});
      setStoreProductLoading(false);
      return;
    }
    setStoreProductLoading(true);
    let cancelled = false;
    const client = getCommerceClient();
    Promise.all(stores.map(async (store) => {
      try {
        const result = await client.getProduct(targetProduct.plu, store.id);
        const product = result?.product;
        const available = Boolean(product && product.active !== false && product.stockStatus !== 'OUT_OF_STOCK' && product.snoozed !== true && product.isSnoozed !== true);
        return [store.id, { price: product?.price, available }] as const;
      } catch {
        return [store.id, { available: false }] as const;
      }
    })).then((entries) => {
      if (!cancelled) {
        setStoreProductResults(Object.fromEntries(entries));
        setStoreProductLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [isOpen, stores, targetProduct?.plu]);

  const comparisonSummary = useMemo(() => {
    const available = Object.values(storeProductResults).filter((entry) => entry.available);
    const prices = available.map((entry) => toMajorPrice(entry.price)).filter((price): price is number => price != null);
    return {
      availableCount: available.length,
      minimumPrice: prices.length ? Math.min(...prices) : null,
      maximumPrice: prices.length ? Math.max(...prices) : null,
    };
  }, [storeProductResults]);

  const coords = useMemo(() => {
    if (userCoordinates && typeof userCoordinates.latitude === 'number') {
      return userCoordinates;
    }
    if (stores.length > 0 && stores[0].coordinates) {
      return stores[0].coordinates;
    }
    return { latitude: 51.5074, longitude: -0.1278 };
  }, [userCoordinates, stores]);

  // Compute prioritized stores according to customer location, 10km zone & dispatch serviceability
  const prioritizedResult = useMemo(() => {
    return prioritizeStoresForCustomer(stores, coords, {
      maxStores: 5,
      zoneRadiusMeters: 10000,
    });
  }, [stores, coords]);

  const prioritizedMap = useMemo(() => {
    const map = new Map<string, PrioritizedStore>();
    prioritizedResult.stores.forEach((ps) => {
      map.set(ps.id, ps);
    });
    return map;
  }, [prioritizedResult]);

  const activeCount = useMemo(() => {
    return stores.filter((s) => normalizeStoreStatus(s.status) !== 'CLOSED').length;
  }, [stores]);

  const baseDisplayedStores = useMemo(() => {
    // If searching, filter all valid stores by query
    if (storeSearch.trim()) {
      const q = storeSearch.trim().toLowerCase();
      return stores.filter((s) => {
        const norm = normalizeStoreStatus(s.status);
        if (filterMode === 'active' && norm === 'CLOSED') {
          return false;
        }
        const nameMatch = (s.name || '').toLowerCase().includes(q);
        const cityMatch = (s.address?.city || '').toLowerCase().includes(q);
        const streetMatch = (s.address?.line1 || '').toLowerCase().includes(q);
        return nameMatch || cityMatch || streetMatch;
      });
    }

    // In default active filter mode: show the prioritized stores (top 5, delivery prioritized)
    if (filterMode === 'active') {
      return prioritizedResult.stores;
    }

    // Otherwise "all" locations: show all stores
    return stores;
  }, [stores, filterMode, storeSearch, prioritizedResult]);

  const displayedStores = useMemo(() => {
    if (targetProduct && !isDemoMode() && Object.keys(storeProductResults).length > 0) {
      const availableStores = baseDisplayedStores.filter((store) => storeProductResults[store.id]?.available);
      return availableStores.length > 0 ? availableStores : baseDisplayedStores;
    }
    return baseDisplayedStores;
  }, [baseDisplayedStores, targetProduct, storeProductResults]);

  if (!isOpen) return null;

  if (targetProduct) {
    const inStockStores = displayedStores.filter((store) => storeProductResults[store.id]?.available);
    return (
      <div id="store-picker-modal-backdrop" className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4" onClick={dismissible ? onClose : undefined}>
        <div id="store-picker-card" className="relative w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between gap-3 mb-4">
            <div><h2 className="text-xl font-black text-gray-900">Local Stores in Stock</h2><p className="text-sm text-gray-500 mt-1">{targetProduct.name}</p></div>
            {dismissible && <button type="button" aria-label="Close" onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center"><X className="w-5 h-5" /></button>}
          </div>
          {detailsStore && (
            <div className="absolute inset-0 z-20 bg-white rounded-3xl p-6 overflow-y-auto">
              <div className="flex items-start justify-between gap-3 mb-4"><div><h2 className="text-xl font-black text-gray-900">{detailsStore.name}</h2>{detailsStore.brandStoreId && <p className="text-sm font-bold text-emerald-700 mt-1">Store ID: {detailsStore.brandStoreId}</p>}</div><button type="button" aria-label="Close location details" onClick={() => setDetailsStore(null)} className="w-9 h-9 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center"><X className="w-5 h-5" /></button></div>
              {detailsStore.coordinates && <div className="h-48 rounded-2xl overflow-hidden mb-4 border border-gray-200"><StoreLocationMap userCoordinates={detailsStore.coordinates} stores={[detailsStore]} selectedStore={detailsStore} onSelectStore={() => {}} height="192px" className="w-full h-full" /></div>}
              <div className="space-y-3 text-sm"><div className="flex gap-3"><MapPin className="w-5 h-5 text-gray-500 shrink-0" /><span>{[detailsStore.address?.line1, detailsStore.address?.city, detailsStore.address?.postcode].filter(Boolean).join(', ') || 'Address unavailable'}</span></div>{detailsStore.phone && <a href={`tel:${detailsStore.phone}`} className="flex gap-3 text-emerald-700 font-semibold"><Phone className="w-5 h-5 shrink-0" />{detailsStore.phone}</a>}</div>
              {detailsStore.openingHours && <section className="mt-6 pt-5 border-t border-gray-200"><h3 className="text-base font-black text-gray-900 mb-3">Opening hours</h3><div className="space-y-2 text-sm">{Array.isArray(detailsStore.openingHours) ? detailsStore.openingHours.map((hours) => { const days = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']; return <div key={`${hours.dayOfWeek}-${hours.startTime}`} className="flex justify-between"><span className="font-semibold">{days[hours.dayOfWeek] || `Day ${hours.dayOfWeek}`}</span><span>{hours.startTime}–{hours.endTime}</span></div>; }) : Object.entries(detailsStore.openingHours).map(([day, hours]) => <div key={day} className="flex justify-between"><span className="font-semibold capitalize">{day}</span><span>{hours.open}–{hours.close}</span></div>)}</div></section>}
              <StoreMarketplaceIcons services={detailsStore.services} />
            </div>
          )}
          <div className="overflow-y-auto flex-1 space-y-3 p-1">
            {storeProductLoading ? <div className="py-10 text-center text-sm text-gray-500">Checking local stock…</div> : inStockStores.length === 0 ? <div className="py-10 text-center rounded-2xl bg-gray-50 text-sm text-gray-600">This item is currently unavailable at nearby stores.</div> : inStockStores.map((store) => {
              const result = storeProductResults[store.id];
              const price = toMajorPrice(result?.price) ?? result?.price ?? targetProduct.price;
              return <div key={store.id} className="rounded-2xl border border-gray-200 p-4 shadow-2xs">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-bold text-gray-900">{store.name || 'Local Store'}</h3><p className="text-xs text-gray-500 mt-1">{[store.address?.line1, store.address?.city].filter(Boolean).join(', ') || 'Location details available'}</p></div><button type="button" aria-label={`View ${store.name} location information`} onClick={() => setDetailsStore(store)} className="w-9 h-9 rounded-full bg-gray-100 text-gray-600 hover:bg-emerald-100 hover:text-emerald-700 flex items-center justify-center shrink-0"><Info className="w-4 h-4" /></button></div>
                <div className="mt-4 flex items-center justify-between gap-3"><span className="text-lg font-black text-gray-900">{formatCurrency(price, currencySymbol)}</span><button type="button" onClick={() => onAddProductFromStore?.(store, targetProduct)} className="px-4 py-2 rounded-xl text-sm font-bold text-white shadow-sm" style={primaryBtnStyle}>Add to Basket</button></div>
              </div>;
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      id="store-picker-modal-backdrop"
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-x-hidden"
      onClick={dismissible ? onClose : undefined}
    >
      <div
        id="store-picker-card"
        className="relative w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col overflow-x-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
              <StoreIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Nearby Stores</h2>
              <p className="text-xs text-gray-500">
                Live routing & distance from your location
              </p>
            </div>
          </div>
          {dismissible && (
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {detailsStore && (
          <div className="absolute inset-0 z-20 bg-white rounded-3xl p-6 overflow-y-auto">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-xl font-black text-gray-900">{detailsStore.name}</h2>
                {detailsStore.brandStoreId && <p className="text-sm font-bold text-emerald-700 mt-1">Store ID: {detailsStore.brandStoreId}</p>}
              </div>
              <button type="button" aria-label="Close location details" onClick={() => setDetailsStore(null)} className="w-9 h-9 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center"><X className="w-5 h-5" /></button>
            </div>
            {detailsStore.coordinates && (
              <div className="h-48 rounded-2xl overflow-hidden mb-4 border border-gray-200">
                <StoreLocationMap userCoordinates={detailsStore.coordinates} stores={[detailsStore]} selectedStore={detailsStore} onSelectStore={() => {}} height="192px" className="w-full h-full" />
              </div>
            )}
            <div className="space-y-3 text-sm">
              <div className="flex gap-3"><MapPin className="w-5 h-5 text-gray-500 shrink-0" /><span>{[detailsStore.address?.line1, detailsStore.address?.city, detailsStore.address?.postcode].filter(Boolean).join(', ') || 'Address unavailable'}</span></div>
              {detailsStore.phone && <a href={`tel:${detailsStore.phone}`} className="flex gap-3 text-emerald-700 font-semibold"><Phone className="w-5 h-5 shrink-0" />{detailsStore.phone}</a>}
            </div>
            {detailsStore.openingHours && (
              <section className="mt-6 pt-5 border-t border-gray-200">
                <h3 className="text-base font-black text-gray-900 mb-3">Opening hours</h3>
                <div className="space-y-2 text-sm">
                  {Array.isArray(detailsStore.openingHours) ? detailsStore.openingHours.map((hours) => {
                    const days = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                    return <div key={`${hours.dayOfWeek}-${hours.startTime}`} className="flex justify-between"><span className="font-semibold">{days[hours.dayOfWeek] || `Day ${hours.dayOfWeek}`}</span><span>{hours.startTime}–{hours.endTime}</span></div>;
                  }) : Object.entries(detailsStore.openingHours).map(([day, hours]) => <div key={day} className="flex justify-between"><span className="font-semibold capitalize">{day}</span><span>{hours.open}–{hours.close}</span></div>)}
                </div>
              </section>
            )}
            <StoreMarketplaceIcons services={detailsStore.services} />
          </div>
        )}

        {/* View Switcher: List vs Map */}
        <div className="flex items-center justify-between mb-3 p-1 rounded-2xl bg-gray-100/80">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              viewMode === 'list'
                ? 'bg-white text-gray-900 shadow-2xs'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>List View</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('map')}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              viewMode === 'map'
                ? 'bg-white text-gray-900 shadow-2xs'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <MapIcon className="w-3.5 h-3.5" />
            <span>Interactive Map</span>
          </button>
        </div>

        {/* Option: Browse Brand-level Root Catalog without selecting a store */}
        <div className="mb-3 p-3 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Layers className="w-4 h-4 text-indigo-600 shrink-0" />
            <div>
              <p className="text-xs font-bold text-indigo-950">
                Browse Brand Catalog
              </p>
              <p className="text-[11px] text-indigo-800">
                Explore all products across all stores
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onSelectStore(null);
              onClose();
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              selectedStore === null
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-100'
            }`}
          >
            {selectedStore === null ? 'Active' : 'Browse All'}
          </button>
        </div>

        {/* Search & Active Stores Filter Bar */}
        <div className="space-y-2 mb-3">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              id="store-picker-search-input"
              value={storeSearch}
              onChange={(e) => setStoreSearch(e.target.value)}
              placeholder="Search stores by name, city or postcode..."
              className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-gray-50 hover:bg-gray-100/80 focus:bg-white border border-gray-200 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-xs text-gray-900 transition-all outline-none"
            />
            {storeSearch && (
              <button
                type="button"
                onClick={() => setStoreSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              id="filter-active-stores-btn"
              onClick={() => setFilterMode('active')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                filterMode === 'active'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Active Stores ({activeCount})
            </button>
            <button
              type="button"
              id="filter-all-stores-btn"
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                filterMode === 'all'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All Locations ({stores.length})
            </button>
          </div>
        </div>

        {/* Target Product Comparison Banner */}
        {targetProduct && (
          <div className="mb-3 p-3 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-white border border-emerald-100 overflow-hidden shrink-0 flex items-center justify-center">
                {targetProduct.imageUrl ? (
                  <img
                    src={targetProduct.imageUrl}
                    alt={targetProduct.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ShoppingBag className="w-4 h-4 text-emerald-600" />
                )}
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                  Comparing Price Across Stores
                </span>
                <h4 className="text-xs font-black text-gray-900 truncate">
                  {targetProduct.name}
                </h4>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] text-gray-500 block">Baseline</span>
              <span className="text-xs font-extrabold text-gray-900">
                {formatCurrency(toMajorPrice(targetProduct.price) ?? targetProduct.price, currencySymbol)}
              </span>
            </div>
          </div>
        )}

        {/* Content based on view mode */}
        {viewMode === 'map' ? (
          <div className="flex-1 flex flex-col min-h-[300px] max-h-[360px] overflow-hidden rounded-2xl border border-gray-100">
            <StoreLocationMap
              userCoordinates={coords}
              userAddress={userAddress || undefined}
              stores={displayedStores}
              selectedStore={selectedStore}
              onSelectStore={(st) => {
                onSelectStore(st);
                onClose();
              }}
              height="340px"
              className="w-full h-full flex-1"
            />
          </div>
        ) : (
          <div className="overflow-y-auto flex-1 space-y-2.5 p-1">
            {displayedStores.length === 0 ? (
              <div className="p-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                <StoreIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm font-bold text-gray-800">No stores found</p>
                <p className="text-xs text-gray-500 mt-1">
                  {targetProduct && !storeProductLoading ? 'This item is currently unavailable at nearby stores.' : 'Try clearing your search query or switching to “All Locations”.'}
                </p>
                {storeSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setStoreSearch('');
                      setFilterMode('all');
                    }}
                    className="mt-3 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold cursor-pointer hover:bg-emerald-700 transition-colors"
                  >
                    Reset Store Filter
                  </button>
                )}
              </div>
            ) : (
              displayedStores.map((store) => {
                const isSelected = selectedStore?.id === store.id;
                const normStatus = normalizeStoreStatus(store.status);
                const isClosed = normStatus === 'CLOSED';
                const prio = prioritizedMap.get(store.id);

                const isDeliveryOption = prio ? prio.pinType === 'open_delivery' : (store.supportsDelivery && !isClosed && store.dispatchAvailability?.available !== false);
                const isCollectOnly = prio ? prio.pinType === 'open_collect_only' : (!isDeliveryOption && store.collectionAvailable && !isClosed);
                const isStoreClosed = prio ? prio.pinType === 'closed' : isClosed;

                return (
                  <div
                    key={store.id}
                    id={`store-card-${store.id}`}
                    onClick={() => {
                      if (!isStoreClosed) {
                        onSelectStore(store);
                        onClose();
                      }
                    }}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/50 shadow-xs ring-1 ring-emerald-600'
                        : isStoreClosed
                        ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                        : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50/80 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-gray-900">{store?.name || 'Local Store'}</h3>
                          {isDeliveryOption && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                              Delivery
                            </span>
                          )}
                          {isCollectOnly && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 inline-block" />
                              Collect Only
                            </span>
                          )}
                          {isStoreClosed && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" />
                              Closed
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {store?.address?.line1 || 'Store Address'}
                          {store.distanceMeters ? ` • ${formatDistanceHuman(store.distanceMeters)} away` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button type="button" aria-label={`View ${store.name} location information`} onClick={(event) => { event.stopPropagation(); setDetailsStore(store); }} className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 hover:bg-emerald-100 hover:text-emerald-700 flex items-center justify-center"><Info className="w-4 h-4" /></button>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                      </div>
                    </div>

                    {/* Badges for delivery & collection */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100 text-xs">
                      {isDeliveryOption ? (
                        <div className="flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-md">
                          <Truck className="w-3 h-3" />
                          <span>Delivery{store.deliveryEta ? ` ${store.deliveryEta}` : ''}</span>
                          {typeof store.deliveryPrice === 'number' && (
                            <span className="text-[10px] font-normal text-emerald-800">
                              • {formatCurrency(store.deliveryPrice, currencySymbol)}
                            </span>
                          )}
                        </div>
                      ) : isCollectOnly ? (
                        <div className="flex items-center gap-1 font-semibold text-orange-800 bg-orange-100/70 px-2 py-0.5 rounded-md">
                          <ShoppingBag className="w-3 h-3 text-orange-600" />
                          <span>Collection ready 10-15m</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md text-[11px]">
                          <AlertCircle className="w-3 h-3 text-gray-400" />
                          <span>Currently closed</span>
                        </div>
                      )}
                    </div>

                    {/* Item and Price per store to inform store choice */}
                    {targetProduct ? (
                      (() => {
                        const avail = isDemoMode()
                          ? catalogueProjectionCache.getProductAvailability(store.id, targetProduct.plu)
                          : undefined;
                        const nonDemoResult = storeProductResults[store.id];
                        const storePriceRaw = avail?.storePrice ?? avail?.price ?? nonDemoResult?.price ?? targetProduct.price;
                        const storePrice = toMajorPrice(storePriceRaw) ?? storePriceRaw;
                        const isOutOfStock = isDemoMode()
                          ? (avail?.stockStatus === 'OUT_OF_STOCK' || avail?.stockQuantity === 0)
                          : (nonDemoResult ? !nonDemoResult.available : false);

                        return (
                          <div className="mt-2.5 pt-2 border-t border-gray-100 flex items-center justify-between text-xs bg-emerald-50/40 p-2 rounded-xl">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Tag className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span className="text-gray-700 font-semibold truncate">
                                {targetProduct.name}:
                              </span>
                            </div>
                            <div className="shrink-0 ml-2">
                              {isOutOfStock ? (
                                <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 font-bold text-[11px]">
                                  Out of stock
                                </span>
                              ) : (
                                <span className="font-extrabold text-emerald-900 bg-emerald-100/80 px-2.5 py-0.5 rounded-md border border-emerald-300 shadow-2xs">
                                  {formatCurrency(storePrice, currencySymbol)}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      /* When opened from header, show staple benchmark item and price per store (demo mode only) */
                      (() => {
                        if (!isDemoMode()) return null;
                        const staplePlu = 'PLU-SOURDOUGH-01';
                        const avail = catalogueProjectionCache.getProductAvailability(store.id, staplePlu);
                        if (!avail || (avail.storePrice == null && avail.price == null)) return null;
                        const staplePrice = toMajorPrice(avail.storePrice ?? avail.price) ?? (avail.storePrice ?? avail.price);
                        return (
                          <div className="mt-2 pt-1.5 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
                            <span className="flex items-center gap-1 truncate">
                              <Tag className="w-3 h-3 text-gray-400" />
                              <span>Sample staple (Sourdough):</span>
                            </span>
                            <span className="font-bold text-gray-800">
                              {formatCurrency(staplePrice, currencySymbol)}
                            </span>
                          </div>
                        );
                      })()
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};
