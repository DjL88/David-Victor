import React, { useState, useEffect } from 'react';
import { Address, Coordinates, Store } from '../../commerce/models';
import { useTenantStyles, useTenant } from '../../tenant/useTenant';
import { formatDistanceHuman, calculateHaversineDistanceMeters } from '../../services/mapsDistanceService';
import { AddressAutocompleteInput } from '../../components/maps/AddressAutocompleteInput';
import { StoreLocationMap } from '../../components/maps/StoreLocationMap';
import { MapPin, X, Check, Map as MapIcon, List, Navigation } from 'lucide-react';

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
  const [isLocating, setIsLocating] = useState(false);
  
  // Decoupled preview state so the modal doesn't instantly close on selection
  const [previewAddress, setPreviewAddress] = useState<Address | null>(currentAddress);
  const [previewCoords, setPreviewCoords] = useState<Coordinates | null>(coordinates);

  useEffect(() => {
    if (isOpen) {
      setPreviewAddress(currentAddress);
      setPreviewCoords(coordinates);
    }
  }, [isOpen, currentAddress, coordinates]);

  const handleClose = () => {
    localStorage.setItem('location_prompt_dismissed', 'true');
    onClose();
  };

  const handleConfirm = async () => {
    if (previewAddress && previewCoords) {
      await onSelectAddress({ address: previewAddress, coordinates: previewCoords });
    }
    handleClose();
  };

  const handleGpsClick = () => {
    setIsLocating(true);
    if (!navigator.geolocation) {
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(`https://api.postcodes.io/postcodes?lon=${longitude}&lat=${latitude}`);
          const data = await res.json();
          if (data.status === 200 && data.result && data.result.length > 0) {
            const pc = data.result[0];
            setPreviewAddress({
              line1: pc.admin_ward || 'Current Location',
              city: pc.admin_district || 'Local Area',
              postcode: pc.postcode,
              country: 'GB'
            });
            setPreviewCoords({ latitude, longitude });
          } else {
            setPreviewAddress({ line1: 'GPS Location', city: '', postcode: '', country: 'GB' });
            setPreviewCoords({ latitude, longitude });
          }
        } catch (e) {
          setPreviewAddress({ line1: 'GPS Location', city: '', postcode: '', country: 'GB' });
          setPreviewCoords({ latitude, longitude });
        }
        setIsLocating(false);
      },
      (err) => {
        console.warn("GPS failed", err);
        setIsLocating(false);
      },
      { timeout: 7000, maximumAge: 0 }
    );
  };

  if (!isOpen) return null;

  return (
    <div
      id="location-picker-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      onClick={dismissible ? handleClose : undefined}
    >
      <div
        id="location-picker-card"
        className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Delivery Address</h2>
              <p className="text-xs text-gray-500">Live distance and routing</p>
            </div>
          </div>
          {dismissible && (
            <button
              type="button"
              onClick={handleClose}
              className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="overflow-y-auto flex-1 no-scrollbar space-y-4 pb-4">
          
          {/* Active Preview Banner */}
          {previewAddress && (
            <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <MapPin className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                    Selected Location
                  </span>
                  <p className="text-xs font-bold text-gray-900 truncate">
                    {previewAddress.formattedAddress || `${previewAddress.line1 || previewAddress.street}, ${previewAddress.city}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMap(!showMap)}
                className="px-2.5 py-1 rounded-xl text-xs font-bold bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-100 flex items-center gap-1.5 transition-colors shrink-0 ml-2 cursor-pointer"
              >
                {showMap ? <List className="w-3.5 h-3.5" /> : <MapIcon className="w-3.5 h-3.5" />}
                <span>{showMap ? 'Hide Map' : 'Show Map'}</span>
              </button>
            </div>
          )}

          {/* GPS Button */}
          <button
            onClick={handleGpsClick}
            disabled={isLocating}
            className="w-full py-2.5 px-4 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 text-sm font-bold text-gray-700 flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Navigation className="w-4 h-4 text-emerald-600" />
            {isLocating ? 'Locating...' : 'Use Current Location'}
          </button>

          {/* Autocomplete Input */}
          <div>
            <AddressAutocompleteInput
              currentAddress={previewAddress}
              onSelectAddress={(sel: any) => {
                setPreviewAddress(sel.address);
                setPreviewCoords(sel.coordinates);
                setShowMap(true); // Auto-show map when they type an address
              }}
              loading={loading}
            />
          </div>

          {/* Interactive Google Map Preview */}
          {showMap && (
            <div className="relative h-48 w-full rounded-2xl overflow-hidden border border-gray-200">
              <StoreLocationMap
                userCoordinates={previewCoords || stores[0]?.coordinates || { latitude: 51.5074, longitude: -0.1278 }}
                userAddress={previewAddress || undefined}
                stores={stores}
                selectedStore={null}
                height="100%"
                showControls={false}
              />
            </div>
          )}

          {/* Saved Addresses */}
          {savedAddresses && savedAddresses.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-2">
                Saved Addresses
              </span>
              {savedAddresses.map((addr, idx) => {
                const isCurrent = previewAddress && (previewAddress.postalCode === addr.postalCode || previewAddress.line1 === addr.line1);
                const targetCoords = addr.latitude && addr.longitude ? { latitude: addr.latitude, longitude: addr.longitude } : (stores[0]?.coordinates || { latitude: 51.5074, longitude: -0.1278 });
                const activeBorderColor = tenant?.primaryColour || '#0d9488';
                const activeBgColor = `${tenant?.primaryColour || '#0d9488'}10`;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setPreviewAddress(addr);
                      setPreviewCoords(targetCoords);
                    }}
                    style={isCurrent ? { borderColor: activeBorderColor, backgroundColor: activeBgColor } : {}}
                    className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${
                      isCurrent ? 'shadow-xs ring-1 ring-inset' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <MapPin className="w-4 h-4 shrink-0" style={{ color: isCurrent ? activeBorderColor : '#9ca3af' }} />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-900 truncate">{addr.line1 || addr.street}</p>
                        <p className="text-[11px] text-gray-500 truncate">{addr.city}, {addr.postalCode}</p>
                      </div>
                    </div>
                    {isCurrent && (
                      <div className="w-5 h-5 rounded-full text-white flex items-center justify-center shrink-0 ml-2" style={{ backgroundColor: activeBorderColor }}>
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className="pt-4 border-t border-gray-100 mt-auto shrink-0">
          <button
            onClick={handleConfirm}
            style={primaryBtnStyle}
            disabled={!previewAddress}
            className="w-full py-3.5 rounded-2xl font-bold text-white shadow-md hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirm & Continue
          </button>
        </div>

      </div>
    </div>
  );
};