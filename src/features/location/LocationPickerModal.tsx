import React, { useState } from 'react';
import { Address, Coordinates, Store } from '../../commerce/models';
import { useTenantStyles, useTenant } from '../../tenant/useTenant';
import { formatDistanceHuman, calculateHaversineDistanceMeters } from '../../services/mapsDistanceService';
import { AddressAutocompleteInput } from '../../components/maps/AddressAutocompleteInput';
import { StoreLocationMap } from '../../components/maps/StoreLocationMap';
import { MapPin, X, Check, Map as MapIcon, List } from 'lucide-react';

interface LocationPickerModalProps {
  isOpen: boolean;
  currentAddress: Address | null;
  onClose: () => void;
  onSelectAddress: (
    query: string | Coordinates | { address: Address; coordinates: Coordinates }
  ) => Promise<unknown> | void | Promise<void>;
  loading: boolean;
  stores?: Store[];
  coordinates?: Coordinates | null;
  savedAddresses?: Address[];
  dismissible?: boolean;
}

export const LocationPickerModal: React.FC<LocationPickerModalProps> = ({
  isOpen,
  currentAddress,
  onClose,
  onSelectAddress,
  loading,
  stores = [],
  coordinates = null,
  savedAddresses = [],
  dismissible = true,
}) => {
  const { primaryBtnStyle } = useTenantStyles();
  const { tenant } = useTenant();
  const [showMap, setShowMap] = useState<boolean>(true);

  if (!isOpen) return null;

  return (
    <div
      id="location-picker-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      onClick={dismissible ? onClose : undefined}
    >
      <div
        id="location-picker-card"
        className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Delivery Address & Zone</h2>
              <p className="text-xs text-gray-500">Live distance and routing from nearby stores</p>
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

        {/* Current Active Address Banner */}
        {currentAddress && (
          <div className="mb-4 p-3 rounded-2xl bg-emerald-50/70 border border-emerald-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <MapPin className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                  Current Location
                </span>
                <p className="text-xs font-bold text-gray-900 truncate">
                  {currentAddress.formattedAddress || `${currentAddress.line1}, ${currentAddress.city}`}
                </p>
              </div>
            </div>
            {coordinates && (
              <button
                type="button"
                onClick={() => setShowMap(!showMap)}
                className="px-2.5 py-1 rounded-xl text-xs font-bold bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-100 flex items-center gap-1.5 transition-colors shrink-0 ml-2 cursor-pointer"
              >
                {showMap ? <List className="w-3.5 h-3.5" /> : <MapIcon className="w-3.5 h-3.5" />}
                <span>{showMap ? 'Hide Map' : 'Show Map'}</span>
              </button>
            )}
          </div>
        )}

        {/* Real-Time Places Autocomplete & GPS Reverse Geocoding */}
        <div className="mb-4">
          <AddressAutocompleteInput
            currentAddress={currentAddress}
            onSelectAddress={async (sel) => {
              await onSelectAddress(sel);
            }}
            loading={loading}
          />
        </div>

        {/* Interactive Google Map Preview */}
        {showMap && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5 px-0.5">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                Store Delivery Map
              </span>
              <span className="text-[11px] text-gray-400">
                {stores.length} locations
              </span>
            </div>
            <StoreLocationMap
              userCoordinates={coordinates || stores[0]?.coordinates || { latitude: 51.5074, longitude: -0.1278 }}
              userAddress={currentAddress || undefined}
              stores={stores}
              selectedStore={null}
              height="200px"
              showControls={false}
            />
          </div>
        )}

        {/* Saved Delivery Addresses */}
        {savedAddresses && savedAddresses.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-2">
              Saved Addresses
            </span>

            {savedAddresses.map((addr, idx) => {
              const isCurrent =
                currentAddress &&
                (currentAddress.postalCode === addr.postalCode ||
                  currentAddress.line1 === addr.line1);

              const targetCoords = addr.latitude && addr.longitude
                ? { latitude: addr.latitude, longitude: addr.longitude }
                : (stores[0]?.coordinates || { latitude: 51.5074, longitude: -0.1278 });

              const distMeters = coordinates
                ? calculateHaversineDistanceMeters(coordinates, targetCoords)
                : 0;

              const activeBorderColor = tenant?.primaryColour || '#0d9488';
              const activeBgColor = `${tenant?.primaryColour || '#0d9488'}10`;

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() =>
                    onSelectAddress({
                      address: addr,
                      coordinates: targetCoords,
                    })
                  }
                  style={isCurrent ? { borderColor: activeBorderColor, backgroundColor: activeBgColor } : {}}
                  className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${
                    isCurrent
                      ? 'shadow-xs ring-1 ring-inset'
                      : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <MapPin
                      className="w-4 h-4 shrink-0"
                      style={{ color: isCurrent ? activeBorderColor : '#9ca3af' }}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-900 truncate">{addr.line1}</p>
                      <p className="text-[11px] text-gray-500 truncate">
                        {addr.city}, {addr.postalCode}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {distMeters > 0 && (
                      <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        {formatDistanceHuman(distMeters)}
                      </span>
                    )}
                    {isCurrent && (
                      <div
                        className="w-5 h-5 rounded-full text-white flex items-center justify-center"
                        style={{ backgroundColor: activeBorderColor }}
                      >
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

