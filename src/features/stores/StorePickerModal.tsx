import React, { useState, useMemo } from 'react';
import { Store, Coordinates, Address, normalizeStoreStatus } from '../../commerce/models';
import { useTenantStyles } from '../../tenant/useTenant';
import { formatDistance, formatCurrency } from '../../utils/formatters';
import { formatDistanceHuman } from '../../services/mapsDistanceService';
import { StoreLocationMap } from '../../components/maps/StoreLocationMap';
import {
  prioritizeStoresForCustomer,
  PrioritizedStore,
} from '../../services/storePrioritizationService';
import { evaluateStoreOpenNow } from '../../services/storeOpeningHoursService';
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
  ExternalLink,
  MapPin,
} from 'lucide-react';
import { catalogueProjectionCache } from '../../commerce/catalogStore';
import { Product, Money, moneyToMajor } from '../../commerce/models';
import { isDemoMode } from '../../domain/runtime';

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
}) => {
  const { primaryBtnStyle, currencySymbol } = useTenantStyles();
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [fulfillmentMode, setFulfillmentMode] = useState<'delivery' | 'collection'>('delivery');
  const [storeSearch, setStoreSearch] = useState<string>('');
  const [detailsStore, setDetailsStore] = useState<Store | null>(null);

  const coords = useMemo(() => {
    if (userCoordinates && typeof userCoordinates.latitude === 'number') {
      return userCoordinates;
    }
    if (stores.length > 0 && stores[0].coordinates) {
      return stores[0].coordinates;
    }
    return { latitude: 51.5074, longitude: -0.1278 };
  }, [userCoordinates, stores]);

  const prioritizedResult = useMemo(() => {
    return prioritizeStoresForCustomer(stores, coords, {
      maxStores: 20, // Increased to capture distant locations without culling
      zoneRadiusMeters: 50000, 
    });
  }, [stores, coords]);

  const prioritizedMap = useMemo(() => {
    const map = new Map<string, PrioritizedStore>();
    prioritizedResult.stores.forEach((ps) => {
      map.set(ps.id, ps);
    });
    return map;
  }, [prioritizedResult]);

  const displayedStores = useMemo(() => {
    let filtered = stores.map(s => prioritizedMap.get(s.id) || (s as any));
    
    // Apply Fulfillment Filter explicitly
    if (fulfillmentMode === 'delivery') {
      filtered = filtered.filter(s => s.isDeliveryServiceable || s.supportsDelivery || (s.services || []).some((srv: any) => srv.name.toLowerCase().includes('delivery')));
    } else {
      filtered = filtered.filter(s => s.isCollectionAvailable || s.collectionAvailable || (s.services || []).some((srv: any) => srv.name.toLowerCase().includes('collection') || srv.name.toLowerCase().includes('pickup')));
    }

    if (storeSearch.trim()) {
      const q = storeSearch.trim().toLowerCase();
      filtered = filtered.filter((s) => {
        const nameMatch = (s.name || '').toLowerCase().includes(q);
        const cityMatch = (s.address?.city || '').toLowerCase().includes(q);
        const streetMatch = (s.address?.line1 || s.address?.street || '').toLowerCase().includes(q);
        return nameMatch || cityMatch || streetMatch;
      });
    }

    // Sort valid active ones first
    return filtered.sort((a, b) => {
      const aOpen = evaluateStoreOpenNow(a as any).isOpen;
      const bOpen = evaluateStoreOpenNow(b as any).isOpen;
      if (aOpen && !bOpen) return -1;
      if (!aOpen && bOpen) return 1;
      return (a.distanceMeters || 0) - (b.distanceMeters || 0);
    });
  }, [stores, fulfillmentMode, storeSearch, prioritizedMap]);

  if (!isOpen) return null;

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
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
              <StoreIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Nearby Stores</h2>
              <p className="text-xs text-gray-500">Live routing & distance</p>
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

        {/* Store Info Dialog Overlay */}
        {detailsStore && (
          <div className="absolute inset-0 z-20 bg-white rounded-3xl p-6 overflow-y-auto">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-xl font-black text-gray-900">{detailsStore.name}</h2>
                {detailsStore.brandStoreId && <p className="text-sm font-bold text-emerald-700 mt-1">Store ID: {detailsStore.brandStoreId}</p>}
              </div>
              <button type="button" aria-label="Close location details" onClick={() => setDetailsStore(null)} className="w-9 h-9 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center cursor-pointer hover:bg-gray-200"><X className="w-5 h-5" /></button>
            </div>
            {detailsStore.coordinates && (
              <div className="h-48 rounded-2xl overflow-hidden mb-4 border border-gray-200 relative">
                <StoreLocationMap userCoordinates={detailsStore.coordinates} stores={[detailsStore]} selectedStore={detailsStore} height="100%" className="w-full h-full absolute inset-0" />
              </div>
            )}
            <div className="space-y-3 text-sm">
              <div className="flex gap-3">
                <MapPin className="w-5 h-5 text-gray-500 shrink-0" />
                <span>{[detailsStore.address?.line1 || detailsStore.address?.street, detailsStore.address?.city, detailsStore.address?.postcode].filter(Boolean).join(', ') || 'Address unavailable'}</span>
              </div>
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
          </div>
        )}

        {/* View Switcher & Fulfillment Filter */}
        <div className="space-y-2 shrink-0 mb-3">
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button onClick={() => setFulfillmentMode('delivery')} className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-lg transition-colors ${fulfillmentMode === 'delivery' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
              <Truck className="w-3.5 h-3.5" /> Delivery
            </button>
            <button onClick={() => setFulfillmentMode('collection')} className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-lg transition-colors ${fulfillmentMode === 'collection' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
              <ShoppingBag className="w-3.5 h-3.5" /> Collection
            </button>
          </div>

          <div className="flex items-center justify-between p-1 rounded-xl bg-gray-50 border border-gray-100">
            <button type="button" onClick={() => setViewMode('list')} className={`flex-1 py-1 px-3 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${viewMode === 'list' ? 'bg-white text-gray-900 shadow-xs ring-1 ring-gray-200' : 'text-gray-500 hover:text-gray-900'}`}>
              <List className="w-3.5 h-3.5" /> List View
            </button>
            <button type="button" onClick={() => setViewMode('map')} className={`flex-1 py-1 px-3 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${viewMode === 'map' ? 'bg-white text-gray-900 shadow-xs ring-1 ring-gray-200' : 'text-gray-500 hover:text-gray-900'}`}>
              <MapIcon className="w-3.5 h-3.5" /> Interactive Map
            </button>
          </div>
        </div>

        <div className="mb-3 p-3 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <Layers className="w-4 h-4 text-indigo-600 shrink-0" />
            <div>
              <p className="text-xs font-bold text-indigo-950">Browse Brand Catalog</p>
              <p className="text-[11px] text-indigo-800">Explore all products across all stores</p>
            </div>
          </div>
          <button type="button" onClick={() => { onSelectStore(null); onClose(); }} className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${selectedStore === null ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-100'}`}>
            {selectedStore === null ? 'Active' : 'Browse All'}
          </button>
        </div>

        <div className="relative w-full mb-3 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={storeSearch}
            onChange={(e) => setStoreSearch(e.target.value)}
            placeholder="Search stores by name, city or postcode..."
            className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-gray-50 hover:bg-gray-100/80 focus:bg-white border border-gray-200 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-xs text-gray-900 transition-all outline-none"
          />
          {storeSearch && (
            <button type="button" onClick={() => setStoreSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {targetProduct && (
          <div className="mb-3 p-3 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-white border border-emerald-100 overflow-hidden shrink-0 flex items-center justify-center">
                {targetProduct.imageUrl ? <img src={targetProduct.imageUrl} alt={targetProduct.name} className="w-full h-full object-cover" /> : <ShoppingBag className="w-4 h-4 text-emerald-600" />}
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Comparing Price Across Stores</span>
                <h4 className="text-xs font-black text-gray-900 truncate">{targetProduct.name}</h4>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] text-gray-500 block">Baseline</span>
              <span className="text-xs font-extrabold text-gray-900">{formatCurrency(toMajorPrice(targetProduct.price) ?? targetProduct.price, currencySymbol)}</span>
            </div>
          </div>
        )}

        {viewMode === 'map' ? (
          <div className="flex-1 flex flex-col min-h-[300px] max-h-[360px] overflow-hidden rounded-2xl border border-gray-100 relative">
            <StoreLocationMap
              userCoordinates={coords}
              userAddress={userAddress || undefined}
              stores={displayedStores as Store[]}
              selectedStore={selectedStore}
              onSelectStore={(st) => { onSelectStore(st); onClose(); }}
              height="100%"
              className="w-full h-full flex-1 absolute inset-0"
            />
          </div>
        ) : (
          <div className="overflow-y-auto flex-1 space-y-2.5 pr-1 no-scrollbar">
            {displayedStores.length === 0 ? (
              <div className="p-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                <StoreIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm font-bold text-gray-800">No stores found</p>
                <p className="text-xs text-gray-500 mt-1">Try clearing your search query or switching fulfillment modes.</p>
              </div>
            ) : (
              displayedStores.map((store: any) => {
                const isSelected = selectedStore?.id === store.id;
                const normStatus = normalizeStoreStatus(store.status);
                const openEval = evaluateStoreOpenNow(store);
                const isStoreClosed = !openEval.isOpen || normStatus === 'CLOSED';

                return (
                  <div
                    key={store.id}
                    onClick={() => {
                      if (!isStoreClosed) { onSelectStore(store); onClose(); }
                    }}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                      isSelected ? 'border-emerald-600 bg-emerald-50/50 shadow-xs ring-1 ring-emerald-600' : isStoreClosed ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50/80 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-gray-900">{store?.name || 'Local Store'}</h3>
                          {isStoreClosed && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" />Closed</span>}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {store?.address?.line1 || store?.address?.street || 'Store Address'}
                          {store.distanceMeters ? ` • ${formatDistanceHuman(store.distanceMeters)} away` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button type="button" aria-label={`View ${store.name} location information`} onClick={(event) => { event.stopPropagation(); setDetailsStore(store); }} className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 hover:bg-emerald-100 hover:text-emerald-700 flex items-center justify-center transition-colors"><Info className="w-4 h-4" /></button>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100 text-[11px]">
                      {fulfillmentMode === 'delivery' ? (
                        <div className="flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-md">
                          <Truck className="w-3 h-3" />
                          <span>Delivery{store.deliveryEta ? ` ${store.deliveryEta}` : ''}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 font-semibold text-orange-800 bg-orange-100/70 px-2 py-0.5 rounded-md">
                          <ShoppingBag className="w-3 h-3 text-orange-600" />
                          <span>Collection ready 10-15m</span>
                        </div>
                      )}
                    </div>
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