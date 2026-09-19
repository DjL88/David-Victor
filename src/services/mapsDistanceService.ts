import { Address, Coordinates, Store } from '../commerce/models';

/**
 * Enterprise Geocoding Provider abstraction.
 * Note: Public OpenStreetMap Nominatim is strictly rate-limited and prohibited for consumer high-volume checkout.
 * Production deployments must configure Google Maps, Mapbox, HERE, or a commercial/self-hosted geocoding cluster.
 */
export interface GeocodingProvider {
  providerId: 'google' | 'mapbox' | 'here' | 'commercial_osm' | 'mock';
  searchAddress(query: string, country?: string): Promise<Array<{
    address: Address;
    coordinates: Coordinates;
    formattedAddress: string;
    placeId: string;
  }>>;
  reverseGeocode(coordinates: Coordinates): Promise<Address | null>;
}

/**
 * Calculates the great-circle distance between two geographic coordinates using the Haversine formula.
 * IMPORTANT ARCHITECTURAL RULE:
 * This calculation is strictly a client-side visual display & approximate sorting utility.
 * Authoritative delivery serviceability, courier availability, and driving route distance
 * are ALWAYS determined server-side via Deliverect Dispatch validation, never by client Haversine radius.
 * @returns Distance in meters
 */
export function calculateHaversineDistanceMeters(
  a: Coordinates,
  b: Coordinates
): number {
  if (!a || !b) return 0;
  if (
    typeof a.latitude !== 'number' ||
    typeof a.longitude !== 'number' ||
    typeof b.latitude !== 'number' ||
    typeof b.longitude !== 'number'
  ) {
    return 0;
  }

  const R = 6371000; // Earth's radius in meters
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);

  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

  return Math.round(R * c);
}

/**
 * Formats a distance in meters to a clean human-readable string.
 */
export function formatDistanceHuman(
  meters: number,
  options: { preferMiles?: boolean } = { preferMiles: true }
): string {
  if (meters < 0 || isNaN(meters)) return 'Nearby';

  if (options.preferMiles) {
    const miles = meters / 1609.344;
    if (miles < 0.1) {
      return `${meters} m`;
    }
    return `${miles.toFixed(1)} mi`;
  } else {
    if (meters < 1000) {
      return `${meters} m`;
    }
    const km = meters / 1000;
    return `${km.toFixed(1)} km`;
  }
}

/**
 * Estimates delivery ETA based on distance in meters and store preparation delay.
 */
export function estimateDeliveryEta(
  distanceMeters: number,
  prepDelayMinutes: number = 10
): { etaRange: string; etaMinutes: number } {
  // Assume courier travel speed ~ 20 km/h in urban settings plus traffic buffer
  const travelMinutes = Math.max(5, Math.ceil((distanceMeters / 1000) * 3));
  const baseTotal = prepDelayMinutes + travelMinutes;
  const minEta = Math.max(15, Math.round(baseTotal * 0.9));
  const maxEta = Math.max(minEta + 10, Math.round(baseTotal * 1.25));

  return {
    etaRange: `${minEta}–${maxEta} min`,
    etaMinutes: baseTotal,
  };
}

/**
 * Updates an array of stores with accurate real-time distance from user coordinates,
 * dynamic ETA, and sorted by nearest distance.
 */
export function calculateStoresWithDistance(
  stores: Store[],
  userCoords: Coordinates
): Store[] {
  return stores
    .map((store) => {
      const distanceMeters = calculateHaversineDistanceMeters(
        userCoords,
        store.coordinates
      );
      const { etaRange, etaMinutes } = estimateDeliveryEta(
        distanceMeters,
        store.preparationTimeDelay || 10
      );

      // Dynamically calculate courier delivery price if distance-tiered
      let deliveryPrice = store.deliveryPrice;
      if (typeof deliveryPrice === 'number' || (deliveryPrice && typeof deliveryPrice === 'object')) {
        const miles = distanceMeters / 1609.344;
        const baseRate = 1.99;
        const perMileRate = 0.5;
        const computedFee = Number((baseRate + Math.max(0, miles - 1) * perMileRate).toFixed(2));
        deliveryPrice = computedFee;
      }

      return {
        ...store,
        distanceMeters,
        deliveryEta: etaRange,
        deliveryPrice,
        dispatchAvailability: store.dispatchAvailability
          ? {
              ...store.dispatchAvailability,
              deliveryEtaMinutes: etaMinutes,
              deliveryPrice: typeof deliveryPrice === 'number' ? deliveryPrice : undefined,
            }
          : undefined,
      };
    })
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}

/**
 * Normalizes a Google Maps GeocoderResult or Place into standard Address and Coordinates.
 */
export function parseGoogleGeocoderResult(
  result: google.maps.GeocoderResult
): { address: Address; coordinates: Coordinates } {
  const components = result.address_components || [];

  let streetNumber = '';
  let route = '';
  let city = '';
  let postalCode = '';
  let country = 'GB';

  components.forEach((c) => {
    if (c.types.includes('street_number')) {
      streetNumber = c.long_name;
    }
    if (c.types.includes('route')) {
      route = c.long_name;
    }
    if (
      c.types.includes('postal_town') ||
      c.types.includes('locality') ||
      c.types.includes('sublocality')
    ) {
      if (!city) city = c.long_name;
    }
    if (c.types.includes('postal_code')) {
      postalCode = c.long_name;
    }
    if (c.types.includes('country')) {
      country = c.short_name;
    }
  });

  const line1 = [streetNumber, route].filter(Boolean).join(' ') || result.formatted_address.split(',')[0];
  const coordinates: Coordinates = {
    latitude: result.geometry.location.lat(),
    longitude: result.geometry.location.lng(),
  };

  const address: Address = {
    line1,
    city: city || 'Chelmsford',
    postalCode: postalCode || 'CM1 1BE',
    country,
    formattedAddress: result.formatted_address,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
  };

  return { address, coordinates };
}
