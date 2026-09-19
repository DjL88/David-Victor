import React, { useState, useEffect, useRef } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { Address, Coordinates } from '../../commerce/models';
import { useTenant } from '../../tenant/TenantContext';
import {
  parseGoogleGeocoderResult,
} from '../../services/mapsDistanceService';
import { Search, MapPin, Navigation, Loader2, X, Check } from 'lucide-react';

interface AddressAutocompleteInputProps {
  currentAddress?: Address | null;
  onSelectAddress: (
    selection: string | Coordinates | { address: Address; coordinates: Coordinates }
  ) => Promise<unknown> | void;
  loading?: boolean;
  onAddressResolved?: (res: { address: Address; coordinates: Coordinates }) => void;
}

export const AddressAutocompleteInput: React.FC<AddressAutocompleteInputProps> = ({
  currentAddress,
  onSelectAddress,
  loading = false,
  onAddressResolved,
}) => {
  const { appMode } = useTenant();
  const isDemo = appMode === 'demo';

  const placesLibrary = useMapsLibrary('places');
  const geocodingLibrary = useMapsLibrary('geocoding');

  const [inputValue, setInputValue] = useState<string>('');
  const [predictions, setPredictions] = useState<
    Array<{
      placeId: string;
      primaryText: string;
      secondaryText: string;
      fullText: string;
      coords?: Coordinates;
    }>
  >([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isGpsLocating, setIsGpsLocating] = useState<boolean>(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize Google Maps services when libraries load
  useEffect(() => {
    try {
      if (placesLibrary && !autocompleteServiceRef.current && window.google?.maps?.places) {
        autocompleteServiceRef.current = new placesLibrary.AutocompleteService();
      }
    } catch (e) {
      console.warn('Could not initialize Google Places AutocompleteService:', e);
    }
  }, [placesLibrary]);

  useEffect(() => {
    try {
      if (geocodingLibrary && !geocoderRef.current && window.google?.maps?.Geocoder) {
        geocoderRef.current = new geocodingLibrary.Geocoder();
      }
    } catch (e) {
      console.warn('Could not initialize Google Geocoder:', e);
    }
  }, [geocodingLibrary]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch predictions with debounce
  useEffect(() => {
    const query = inputValue.trim();
    if (!query || query.length < 2) {
      setPredictions([]);
      setIsDropdownOpen(false);
      return;
    }

    const timer = setTimeout(() => {
      setIsSearching(true);
      setErrorMsg(null);

      // Attempt Google Maps Places autocomplete if available
      if (autocompleteServiceRef.current && window.google?.maps?.places) {
        try {
          autocompleteServiceRef.current.getPlacePredictions(
            {
              input: query,
              componentRestrictions: { country: 'gb' },
              types: ['geocode', 'establishment'],
            },
            (results, status) => {
              setIsSearching(false);
              if (
                status === window.google?.maps?.places?.PlacesServiceStatus?.OK &&
                results &&
                results.length > 0
              ) {
                const formatted = results.slice(0, 5).map((p) => ({
                  placeId: p.place_id,
                  primaryText:
                    p.structured_formatting?.main_text || p.description.split(',')[0],
                  secondaryText:
                    p.structured_formatting?.secondary_text ||
                    p.description.split(',').slice(1).join(','),
                  fullText: p.description,
                }));
                setPredictions(formatted);
                setIsDropdownOpen(true);
              } else {
                fallbackSearch(query);
              }
            }
          );
        } catch (e) {
          console.warn('Google Places prediction error, using local fallback:', e);
          fallbackSearch(query);
        }
      } else {
        fallbackSearch(query);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [inputValue]);

  // Fallback search over local delivery zones and stores
  const fallbackSearch = (query: string) => {
    setIsSearching(false);
    const q = query.trim();
    if (q.length < 2) {
      setPredictions([]);
      setIsDropdownOpen(false);
      return;
    }

    const matches: Array<{
      placeId: string;
      primaryText: string;
      secondaryText: string;
      fullText: string;
      coords?: Coordinates;
    }> = [
      {
        placeId: `direct_query_${encodeURIComponent(q)}`,
        primaryText: q,
        secondaryText: 'Search address or postal code',
        fullText: q,
      },
    ];

    setPredictions(matches);
    setIsDropdownOpen(true);
  };

  // Handle selection of a prediction
  const handleSelectPrediction = async (prediction: {
    placeId: string;
    fullText: string;
    coords?: Coordinates;
    primaryText?: string;
    secondaryText?: string;
  }) => {
    setIsDropdownOpen(false);
    setInputValue('');
    setErrorMsg(null);

    // If coordinates are already known locally
    if (prediction.coords) {
      const parsedAddr: Address = {
        line1: prediction.primaryText || prediction.fullText.split(',')[0],
        city: 'Chelmsford',
        postalCode: prediction.fullText.includes('CM') ? 'CM1 1BE' : 'GB',
        country: 'GB',
        formattedAddress: prediction.fullText,
        latitude: prediction.coords.latitude,
        longitude: prediction.coords.longitude,
      };

      if (onAddressResolved) {
        onAddressResolved({ address: parsedAddr, coordinates: prediction.coords });
      }
      await onSelectAddress({ address: parsedAddr, coordinates: prediction.coords });
      return;
    }

    // Try Google Geocoder if available
    if (geocoderRef.current && window.google?.maps?.Geocoder) {
      try {
        const response = await geocoderRef.current.geocode({
          placeId: prediction.placeId,
        });

        if (response.results && response.results.length > 0) {
          const parsed = parseGoogleGeocoderResult(response.results[0]);
          if (onAddressResolved) {
            onAddressResolved(parsed);
          }
          await onSelectAddress(parsed);
          return;
        }
      } catch (err) {
        console.warn('Geocoding placeId failed, using fallback:', err);
      }
    }

    await onSelectAddress(prediction.fullText);
  };

  // Handle direct enter / submit
  const handleDirectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = inputValue.trim();
    if (!query) return;

    setIsDropdownOpen(false);
    setErrorMsg(null);

    // Try Google Geocoder if active
    if (geocoderRef.current && window.google?.maps?.Geocoder) {
      try {
        const response = await geocoderRef.current.geocode({
          address: query,
          componentRestrictions: { country: 'gb' },
        });

        if (response.results && response.results.length > 0) {
          const parsed = parseGoogleGeocoderResult(response.results[0]);
          if (onAddressResolved) {
            onAddressResolved(parsed);
          }
          await onSelectAddress(parsed);
          setInputValue('');
          return;
        }
      } catch (err) {
        console.warn('Geocoding address text failed, resolving via local engine:', err);
      }
    }

    // Delegation fallback (e.g. backend location resolver)
    try {
      await onSelectAddress(query);
      setInputValue('');
    } catch (err) {
      console.warn('Direct address resolution failed:', err);
      setErrorMsg('Could not resolve location. Please try another address or postal code.');
    }
  };

  // Handle GPS Device Location with Reverse Geocoding & Local Fallback
  const handleUseDeviceLocation = () => {
    setErrorMsg(null);
    if (!navigator.geolocation) {
      setErrorMsg('Geolocation is not supported by your browser');
      return;
    }

    setIsGpsLocating(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords: Coordinates = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };

        // Try Google Geocoder reverse geocode if active
        if (geocoderRef.current && window.google?.maps?.Geocoder) {
          try {
            const response = await geocoderRef.current.geocode({
              location: { lat: coords.latitude, lng: coords.longitude },
            });

            if (response.results && response.results.length > 0) {
              const parsed = parseGoogleGeocoderResult(response.results[0]);
              setIsGpsLocating(false);
              if (onAddressResolved) {
                onAddressResolved(parsed);
              }
              await onSelectAddress(parsed);
              return;
            }
          } catch (geoErr) {
            console.warn('GPS Google reverse geocoding failed:', geoErr);
          }
        }

        // Without authoritative reverse geocoding, do not fabricate a fake address
        setIsGpsLocating(false);
        setErrorMsg('Unable to reverse-geocode your GPS location into a postal address. Please type your street address or postal code above.');
      },
      (err) => {
        console.warn('Geolocation error:', err);
        setIsGpsLocating(false);
        setErrorMsg('Unable to retrieve your location. Please check browser permissions.');
      },
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 30000 }
    );
  };

  return (
    <div ref={containerRef} className="relative w-full space-y-3">
      {/* Search Input Box */}
      <form onSubmit={handleDirectSubmit} className="relative">
        <div className="relative flex items-center">
          <Search className="absolute left-3.5 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            id="postcode-search-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={() => {
              if (predictions.length > 0) setIsDropdownOpen(true);
            }}
            placeholder="Search address or postcode (e.g. CM1 1BE, High St)..."
            className="w-full pl-10 pr-24 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-medium text-gray-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 focus:outline-hidden transition-all shadow-2xs"
          />

          {inputValue && (
            <button
              type="button"
              onClick={() => {
                setInputValue('');
                setPredictions([]);
                setIsDropdownOpen(false);
              }}
              className="absolute right-16 p-1 text-gray-400 hover:text-gray-600 rounded-full"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="submit"
            disabled={loading || !inputValue.trim()}
            className="absolute right-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-xs active:scale-95 disabled:opacity-40 transition-all"
          >
            {isSearching ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              'Search'
            )}
          </button>
        </div>

        {/* Autocomplete Predictions Dropdown */}
        {isDropdownOpen && predictions.length > 0 && (
          <div
            id="places-autocomplete-dropdown"
            className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden z-50 divide-y divide-gray-100 animate-in fade-in slide-in-from-top-2 duration-150"
          >
            <div className="px-3.5 py-1.5 bg-gray-50/80 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Address Suggestions
            </div>
            {predictions.map((p) => (
              <button
                key={p.placeId}
                type="button"
                onClick={() => handleSelectPrediction(p)}
                className="w-full px-3.5 py-2.5 text-left hover:bg-emerald-50/60 flex items-start gap-2.5 transition-colors group"
              >
                <MapPin className="w-4 h-4 text-gray-400 group-hover:text-emerald-600 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-900 group-hover:text-emerald-950 truncate">
                    {p.primaryText}
                  </p>
                  <p className="text-[11px] text-gray-500 truncate">
                    {p.secondaryText}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </form>

      {/* GPS Location Button */}
      <button
        type="button"
        id="device-location-btn"
        onClick={handleUseDeviceLocation}
        disabled={loading || isGpsLocating}
        className="w-full py-2.5 px-4 rounded-2xl border border-gray-200 hover:border-emerald-300 bg-white hover:bg-emerald-50/40 flex items-center justify-center gap-2 text-xs font-bold text-gray-800 shadow-2xs active:scale-[0.99] transition-all"
      >
        {isGpsLocating ? (
          <>
            <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
            <span>Finding exact GPS location & distance...</span>
          </>
        ) : (
          <>
            <Navigation className="w-4 h-4 text-emerald-600" />
            <span>Use current device location (GPS)</span>
          </>
        )}
      </button>

      {errorMsg && (
        <p className="text-xs text-red-600 text-center font-medium">{errorMsg}</p>
      )}
    </div>
  );
};
