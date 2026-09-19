import React, { useState, useEffect, useRef, Component, ErrorInfo, ReactNode, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Store, Coordinates, Address } from '../../commerce/models';
import { useTenantStyles } from '../../tenant/useTenant';
import {
  formatDistanceHuman,
  calculateHaversineDistanceMeters,
} from '../../services/mapsDistanceService';
import {
  prioritizeStoresForCustomer,
  PrioritizedStore,
  MAX_MAP_STORES,
  DEFAULT_ZONE_RADIUS_METERS,
} from '../../services/storePrioritizationService';
import { evaluateStoreOpenNow, hasValidStoreAddress } from '../../services/storeOpeningHoursService';
import {
  Store as StoreIcon,
  MapPin,
  Truck,
  ShoppingBag,
  Check,
  X,
  Clock,
} from 'lucide-react';

interface StoreLocationMapProps {
  userCoordinates: Coordinates;
  userAddress?: Address;
  stores: Store[];
  selectedStore: Store | null;
  onSelectStore?: (store: Store) => void;
  height?: string | number;
  className?: string;
  showControls?: boolean;
  zoneRadiusMeters?: number;
  dispatchServiceabilityMap?: Record<string, boolean>;
}

// Lightweight Error Boundary to catch any unhandled Leaflet or DOM errors
class MapErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('[MapErrorBoundary] Intercepted Maps render issue:', error?.message);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

export const StoreLocationMap: React.FC<StoreLocationMapProps> = (props) => {
  return (
    <MapErrorBoundary fallback={<StoreListFallbackView {...props} />}>
      <LeafletMapInner {...props} />
    </MapErrorBoundary>
  );
};

const LeafletMapInner: React.FC<StoreLocationMapProps> = ({
  userCoordinates,
  userAddress,
  stores,
  selectedStore,
  onSelectStore,
  height = '320px',
  className = '',
  showControls = true,
  zoneRadiusMeters = DEFAULT_ZONE_RADIUS_METERS,
  dispatchServiceabilityMap,
}) => {
  const { primaryBtnStyle } = useTenantStyles();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const [activeStoreForPopup, setActiveStoreForPopup] = useState<PrioritizedStore | null>(null);

  // Filter & prioritize stores up to 5 in delivery -> collection -> closed order
  const { prioritizedStores, activeZoneRadiusMeters, radiusExpanded } = useMemo(() => {
    return prioritizeStoresForCustomer(stores, userCoordinates, {
      zoneRadiusMeters,
      maxStores: MAX_MAP_STORES,
      dispatchServiceabilityMap,
    });
  }, [stores, userCoordinates, zoneRadiusMeters, dispatchServiceabilityMap]);

  // Initialize Map Instance
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Destroy existing map if initialized to prevent reuse issues
    if (mapInstanceRef.current) {
      try {
        mapInstanceRef.current.remove();
      } catch (err) {
        console.warn('Error removing map instance:', err);
      }
      mapInstanceRef.current = null;
    }

    const defaultLat =
      userCoordinates?.latitude ||
      stores[0]?.coordinates?.latitude ||
      51.5074;
    const defaultLng =
      userCoordinates?.longitude ||
      stores[0]?.coordinates?.longitude ||
      -0.1278;

    const map = L.map(mapContainerRef.current, {
      zoomControl: showControls,
      attributionControl: false,
    }).setView([defaultLat, defaultLng], 13);

    // CartoDB Voyager - a clean, high-contrast, light neutral cartography
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    // Ensure size is invalidated immediately and after layout settles
    map.invalidateSize();
    const timer1 = setTimeout(() => {
      try {
        map.invalidateSize();
      } catch {}
    }, 100);
    const timer2 = setTimeout(() => {
      try {
        map.invalidateSize();
      } catch {}
    }, 300);

    // Resize observer to ensure container resize is handled properly
    const resizeObserver = new ResizeObserver(() => {
      try {
        map.invalidateSize();
      } catch {}
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      resizeObserver.disconnect();
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (err) {
          console.warn('Error clearing map in cleanup:', err);
        }
        mapInstanceRef.current = null;
      }
    };
  }, [showControls, userCoordinates?.latitude, userCoordinates?.longitude]);

  // Handle Markers & Bounds Fit
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove existing markers
    markersRef.current.forEach((m) => {
      try {
        m.remove();
      } catch (err) {
        console.warn('Error removing marker:', err);
      }
    });
    markersRef.current = [];

    const bounds = L.latLngBounds([]);
    let hasPoints = false;

    // 1. Add User / Delivery Location Pin (Blue with animated ripple)
    if (userCoordinates && typeof userCoordinates.latitude === 'number') {
      const userLatLng = L.latLng(userCoordinates.latitude, userCoordinates.longitude);
      bounds.extend(userLatLng);
      hasPoints = true;

      const userIcon = L.divIcon({
        className: 'custom-user-pin',
        html: `
          <div class="relative flex items-center justify-center w-7 h-7">
            <div class="absolute w-6 h-6 rounded-full bg-blue-500 animate-ping opacity-50"></div>
            <div class="relative w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-md flex items-center justify-center">
              <div class="w-1.5 h-1.5 rounded-full bg-white"></div>
            </div>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const userMarker = L.marker(userLatLng, {
        icon: userIcon,
        title: userAddress?.formattedAddress || 'Your Location',
      }).addTo(map);

      userMarker.bindTooltip(userAddress?.line1 || 'Your Location', {
        direction: 'top',
        offset: [0, -10],
        className: 'font-semibold text-xs rounded-lg px-2 py-1 shadow-xs border border-gray-100',
      });

      markersRef.current.push(userMarker);
    }

    // 2. Add Store Markers with user-specified color coding:
    // - Closed: Grey pin
    // - Open & Delivering: Green pin
    // - Open & Collect only: Orange pin
    prioritizedStores.forEach((store, index) => {
      if (!store.coordinates || typeof store.coordinates.latitude !== 'number') return;
      const storeLatLng = L.latLng(store.coordinates.latitude, store.coordinates.longitude);
      bounds.extend(storeLatLng);
      hasPoints = true;

      const isSelected = selectedStore?.id === store.id;

      // Color classes per specification:
      // Green = open & delivering (#10b981)
      // Orange = open & collect only (#f59e0b)
      // Grey = closed (#94a3b8)
      let pinBgClass = 'bg-slate-400 border-slate-500';
      let iconSvg = `
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
      `;

      if (store.pinType === 'open_delivery') {
        pinBgClass = 'bg-emerald-500 border-emerald-600';
        iconSvg = `
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <rect x="1" y="3" width="15" height="13"></rect>
            <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
            <circle cx="5.5" cy="18.5" r="2.5"></circle>
            <circle cx="18.5" cy="18.5" r="2.5"></circle>
          </svg>
        `;
      } else if (store.pinType === 'open_collect_only') {
        pinBgClass = 'bg-amber-500 border-amber-600';
        iconSvg = `
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <path d="M16 10a4 4 0 0 1-8 0"></path>
          </svg>
        `;
      }

      const ringClass = isSelected
        ? 'ring-4 ring-emerald-400/50 scale-115'
        : 'ring-0';

      const storeIcon = L.divIcon({
        className: 'custom-store-pin',
        html: `
          <div class="flex flex-col items-center justify-center cursor-pointer transition-all duration-150 transform hover:scale-110">
            <div class="relative flex items-center justify-center w-8 h-8 rounded-full ${pinBgClass} ${ringClass} text-white border-2 border-white shadow-md">
              ${iconSvg}
              <span class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white text-gray-900 text-[9px] font-black flex items-center justify-center border border-gray-200 shadow-xs">
                ${index + 1}
              </span>
            </div>
            <div class="w-1.5 h-1.5 bg-gray-600/40 rounded-full mt-0.5"></div>
          </div>
        `,
        iconSize: [32, 38],
        iconAnchor: [16, 36],
      });

      const storeMarker = L.marker(storeLatLng, {
        icon: storeIcon,
        title: store.name,
      }).addTo(map);

      storeMarker.on('click', () => {
        setActiveStoreForPopup(store);
      });

      storeMarker.bindTooltip(
        `<span class="font-bold">${store.name}</span> <span class="text-[10px] opacity-75">(${store.pinBadgeLabel})</span>`,
        {
          direction: 'top',
          offset: [0, -32],
          className: 'font-semibold text-xs rounded-lg px-2 py-1 shadow-xs border border-gray-100',
        }
      );

      markersRef.current.push(storeMarker);
    });

    // Fit bounds with comfortable padding
    if (hasPoints) {
      try {
        map.fitBounds(bounds, {
          padding: [50, 50],
          maxZoom: 14,
        });
      } catch (e) {
        console.warn('Could not fit map bounds:', e);
      }
    }
  }, [prioritizedStores, selectedStore, userCoordinates, userAddress]);

  return (
    <div
      id="store-location-map-container"
      className={`relative w-full rounded-2xl overflow-hidden border border-gray-200/80 shadow-xs ${className}`}
      style={{ height }}
    >
      <style>{`
        .leaflet-interactive {
          cursor: pointer !important;
        }
        .custom-user-pin, .custom-store-pin {
          background: transparent !important;
          border: none !important;
          outline: none !important;
        }
        .leaflet-tooltip {
          background: white !important;
          border: 1px solid rgba(229, 231, 235, 0.8) !important;
          border-radius: 8px !important;
          color: #111827 !important;
          box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05) !important;
        }
        .leaflet-tooltip-top:before {
          border-top-color: white !important;
        }
      `}</style>

      {/* Map Element */}
      <div ref={mapContainerRef} className="w-full h-full" style={{ zIndex: 1 }} />

      {/* Floating map legend badge with the exact 3 pin colors */}
      <div className="absolute top-2 left-2 z-[400] bg-white/95 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-gray-200/80 shadow-2xs text-[10px] font-semibold text-gray-700 flex flex-wrap items-center gap-3 pointer-events-none">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-emerald-600" />
          <span>Delivery</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 border border-amber-600" />
          <span>Collection only</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-400 border border-slate-500" />
          <span>Closed</span>
        </span>
        {radiusExpanded && (
          <span className="text-[9px] text-gray-400 italic">
            (Zone radius extended)
          </span>
        )}
      </div>

      {/* Interactive Store Callout Card */}
      {activeStoreForPopup && (
        <div
          id="active-store-map-callout"
          className="absolute bottom-3 left-3 right-3 sm:left-auto sm:right-3 sm:w-80 z-[400] bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-gray-200/80 p-3.5 space-y-2.5 transition-all"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <StoreIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                <h4 className="text-xs font-bold text-gray-900 truncate">
                  {activeStoreForPopup.name}
                </h4>
              </div>
              <p className="text-[11px] text-gray-500 truncate mt-0.5">
                {activeStoreForPopup.address.line1}, {activeStoreForPopup.address.city}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveStoreForPopup(null)}
              className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
              aria-label="Close details"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-between text-[11px] py-1.5 px-2.5 rounded-xl bg-gray-50 border border-gray-100">
            <span className="font-semibold text-gray-900">
              {formatDistanceHuman(activeStoreForPopup.distanceMeters)} away
            </span>
            <span className="flex items-center gap-1 text-gray-600">
              {activeStoreForPopup.isDeliveryServiceable ? (
                <>
                  <Truck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{activeStoreForPopup.deliveryEta || '15–25 min'}</span>
                </>
              ) : activeStoreForPopup.isCollectionAvailable ? (
                <>
                  <ShoppingBag className="w-3.5 h-3.5 text-amber-600" />
                  <span>Collect in 10 min</span>
                </>
              ) : (
                <>
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  <span>Closed</span>
                </>
              )}
            </span>
          </div>

          {/* Operational Hours and Service status */}
          <div className="flex items-center justify-between text-[11px] px-0.5">
            <span
              className={`inline-flex items-center gap-1 font-semibold ${
                activeStoreForPopup.isOpen
                  ? activeStoreForPopup.isDeliveryServiceable
                    ? 'text-emerald-700'
                    : 'text-amber-700'
                  : 'text-gray-500'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  activeStoreForPopup.isOpen
                    ? activeStoreForPopup.isDeliveryServiceable
                      ? 'bg-emerald-500'
                      : 'bg-amber-500'
                    : 'bg-slate-400'
                }`}
              />
              {activeStoreForPopup.pinBadgeLabel}
            </span>

            <span className="text-[10px] text-gray-500 flex items-center gap-1">
              <Clock className="w-3 h-3 text-gray-400" />
              {evaluateStoreOpenNow(activeStoreForPopup).badgeText}
            </span>
          </div>

          {onSelectStore && (
            <button
              type="button"
              disabled={!activeStoreForPopup.isOpen}
              onClick={() => {
                if (activeStoreForPopup.isOpen) {
                  onSelectStore(activeStoreForPopup);
                  setActiveStoreForPopup(null);
                }
              }}
              style={activeStoreForPopup.isOpen ? primaryBtnStyle : undefined}
              className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                !activeStoreForPopup.isOpen
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : selectedStore?.id === activeStoreForPopup.id
                  ? 'bg-gray-200 text-gray-800'
                  : 'text-white shadow-2xs hover:brightness-105'
              }`}
            >
              {selectedStore?.id === activeStoreForPopup.id ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Active Store</span>
                </>
              ) : activeStoreForPopup.isOpen ? (
                <span>Select this store</span>
              ) : (
                <span>Currently closed</span>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Honest, accessible store list fallback view when Leaflet or interactive maps fail to load
 * Displays accurate real-world distances, operational status, and store selection.
 */
export const StoreListFallbackView: React.FC<StoreLocationMapProps> = ({
  userCoordinates,
  userAddress,
  stores,
  selectedStore,
  onSelectStore,
  height = '320px',
  className = '',
  zoneRadiusMeters = DEFAULT_ZONE_RADIUS_METERS,
  dispatchServiceabilityMap,
}) => {
  const { primaryBtnStyle } = useTenantStyles();

  const { prioritizedStores } = useMemo(() => {
    return prioritizeStoresForCustomer(stores, userCoordinates, {
      zoneRadiusMeters,
      maxStores: MAX_MAP_STORES,
      dispatchServiceabilityMap,
    });
  }, [stores, userCoordinates, zoneRadiusMeters, dispatchServiceabilityMap]);

  return (
    <div
      id="store-list-fallback-view"
      className={`relative w-full rounded-2xl bg-white border border-gray-200 shadow-xs flex flex-col justify-between overflow-hidden ${className}`}
      style={{ minHeight: height, maxHeight: typeof height === 'number' ? `${height}px` : height }}
    >
      {/* Location Header */}
      <div className="p-3 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-xl bg-gray-200 text-gray-800 flex items-center justify-center shrink-0">
            <MapPin className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-gray-900 truncate">
              {userAddress?.line1 || 'Your Location'}
            </p>
            <p className="text-[10px] text-gray-500 truncate">
              {prioritizedStores.length} nearby local {prioritizedStores.length === 1 ? 'store' : 'stores'} prioritized
            </p>
          </div>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[10px] font-semibold border border-gray-200 shrink-0">
          Store List
        </span>
      </div>

      {/* Stores List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 divide-y divide-gray-50">
        {prioritizedStores.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-400">
            No nearby stores found for this location.
          </div>
        ) : (
          prioritizedStores.map((store) => {
            const isSelected = selectedStore?.id === store.id;
            const openEval = evaluateStoreOpenNow(store);

            return (
              <div
                key={store.id}
                onClick={() => {
                  if (onSelectStore && store.isOpen) {
                    onSelectStore(store);
                  }
                }}
                className={`pt-2 first:pt-0 flex items-center justify-between gap-3 p-2.5 rounded-xl transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-gray-50 border border-gray-300 shadow-2xs'
                    : 'hover:bg-gray-50 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    style={isSelected ? primaryBtnStyle : undefined}
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      isSelected
                        ? 'text-white'
                        : !store.isOpen
                        ? 'bg-gray-100 text-gray-400'
                        : store.isDeliveryServiceable
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    <StoreIcon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-900 truncate">{store.name}</p>
                    <p className="text-[11px] text-gray-500 truncate">
                      {store.address.line1} • {formatDistanceHuman(store.distanceMeters)}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-semibold ${
                          !store.isOpen
                            ? 'text-gray-500'
                            : store.isDeliveryServiceable
                            ? 'text-emerald-700'
                            : 'text-amber-700'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            !store.isOpen
                              ? 'bg-slate-400'
                              : store.isDeliveryServiceable
                              ? 'bg-emerald-500'
                              : 'bg-amber-500'
                          }`}
                        />
                        {store.pinBadgeLabel}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {openEval.badgeText}
                      </span>
                    </div>
                  </div>
                </div>

                {onSelectStore && (
                  <button
                    type="button"
                    disabled={!store.isOpen}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (store.isOpen) onSelectStore(store);
                    }}
                    style={!isSelected && store.isOpen ? primaryBtnStyle : undefined}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                      isSelected
                        ? 'bg-gray-200 text-gray-800'
                        : !store.isOpen
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'text-white shadow-2xs hover:brightness-105'
                    }`}
                  >
                    {isSelected ? 'Selected' : store.isOpen ? 'Select' : 'Closed'}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// Backwards-compatible alias for any external consumers
export const ProximityRadarFallbackView = StoreListFallbackView;
