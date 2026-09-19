/**
 * Store Prioritization & Map Pin Service
 *
 * Implements the specification:
 * - Zone configuration (default 10km / 10,000m).
 * - "extend the search radius only to find the nearest store(s) if none appear in 10km.
 *    But shrink the radius to only show the closest 5 if more than 5 exist."
 * - Up to 5 local shops prioritized:
 *    1. Open and Delivery serviceable (nearest first)
 *    2. Open and Collection only (nearest first)
 *    3. Closed stores (greyed out)
 * - Map pin classification:
 *    - Closed: Grey pin
 *    - Open and delivering: Green pin
 *    - Open but collect only: Orange pin
 * - Address filtering: drops stores without valid address.
 */

import { Store, Coordinates } from '../commerce/models';
import { hasValidStoreAddress, evaluateStoreOpenNow } from './storeOpeningHoursService';

export const DEFAULT_ZONE_RADIUS_METERS = 10_000; // 10 km
export const MAX_MAP_STORES = 5;

export type MapPinType = 'open_delivery' | 'open_collect_only' | 'closed';

/**
 * Calculates haversine distance in meters between two lat/lng coordinates.
 */
export function calculateHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

export interface PrioritizedStore extends Store {
  distanceMeters: number;
  isOpen: boolean;
  isDeliveryServiceable: boolean;
  isCollectionAvailable: boolean;
  pinType: MapPinType;
  pinColorHex: string;
  pinBadgeLabel: string;
}

export interface PrioritizationOptions {
  zoneRadiusMeters?: number;
  maxStores?: number;
  targetDate?: Date;
  dispatchServiceabilityMap?: Record<string, boolean>;
}

/**
 * Filter, prioritize, and classify stores according to distance, opening hours,
 * dispatch delivery serviceability, and collection capability.
 */
export function prioritizeStoresForCustomer(
  stores: Store[],
  customerLocation: Coordinates,
  options: PrioritizationOptions = {}
): {
  stores: PrioritizedStore[];
  prioritizedStores: PrioritizedStore[];
  activeZoneRadiusMeters: number;
  radiusExpanded: boolean;
} {
  const zoneRadiusMeters = options.zoneRadiusMeters || DEFAULT_ZONE_RADIUS_METERS;
  const maxStores = options.maxStores || MAX_MAP_STORES;
  const targetDate = options.targetDate || new Date();
  const dispatchMap = options.dispatchServiceabilityMap || {};

  // 1. Address filtering: Drop locations without a valid address
  const validStores = stores.filter((s) => hasValidStoreAddress(s));

  // 2. Compute distance for all candidates
  const storesWithDistance = validStores.map((store) => {
    let distanceMeters = 0;
    const storeCoords = store.coordinates || (store.address as { coordinates?: Coordinates })?.coordinates;
    if (storeCoords && typeof storeCoords.latitude === 'number' && typeof storeCoords.longitude === 'number') {
      distanceMeters = calculateHaversineDistanceMeters(
        customerLocation.latitude,
        customerLocation.longitude,
        storeCoords.latitude,
        storeCoords.longitude
      );
    } else if (typeof store.distanceMeters === 'number') {
      distanceMeters = store.distanceMeters;
    }

    const openEvaluation = evaluateStoreOpenNow(store, targetDate);
    const isOpen = openEvaluation.isOpen;

    // Delivery capability & Dispatch validation
    // Store must have delivery enabled AND dispatch must be available
    const hasDeliveryCapability =
      store.supportsDelivery !== false && (store as unknown as { fulfillmentCapabilities?: { delivery?: boolean } }).fulfillmentCapabilities?.delivery !== false;
    const isDispatchEligible =
      dispatchMap[store.id] !== undefined
        ? dispatchMap[store.id]
        : store.dispatchAvailability?.available !== false;
    const isDeliveryServiceable = hasDeliveryCapability && isDispatchEligible;

    // Collection capability
    const isCollectionAvailable =
      store.supportsPickup !== false &&
      store.collectionAvailable !== false &&
      (store as unknown as { fulfillmentCapabilities?: { collection?: boolean } }).fulfillmentCapabilities?.collection !== false;

    // Pin classification: Green for Delivery, Orange for Collect Only, Grey for Closed
    let pinType: MapPinType = 'closed';
    let pinColorHex = '#94a3b8'; // Slate 400 (Grey)
    let pinBadgeLabel = 'Closed';

    if (!isOpen) {
      pinType = 'closed';
      pinColorHex = '#94a3b8'; // Grey
      pinBadgeLabel = 'Closed';
    } else if (isDeliveryServiceable) {
      pinType = 'open_delivery';
      pinColorHex = '#10b981'; // Emerald 500 (Green)
      pinBadgeLabel = isCollectionAvailable ? 'Delivery & Collection' : 'Delivery';
    } else if (isCollectionAvailable) {
      pinType = 'open_collect_only';
      pinColorHex = '#f59e0b'; // Amber 500 (Orange)
      pinBadgeLabel = 'Collection Only';
    } else {
      pinType = 'closed';
      pinColorHex = '#94a3b8';
      pinBadgeLabel = 'Unavailable';
    }

    return {
      ...store,
      distanceMeters,
      isOpen,
      isDeliveryServiceable,
      isCollectionAvailable,
      pinType,
      pinColorHex,
      pinBadgeLabel,
    } as PrioritizedStore;
  });

  // Sort strictly by distance ascending
  storesWithDistance.sort((a, b) => a.distanceMeters - b.distanceMeters);

  // 3. Zone filtering with expansion logic:
  // "The Zone could be configured to say 10km... extend the search radius only to
  //  find the nearest store(s) if none appear in 10km. But shrink the radius to only show
  //  the closest 5 if more than 5 exist."
  let inZone = storesWithDistance.filter((s) => s.distanceMeters <= zoneRadiusMeters);
  let radiusExpanded = false;
  let activeZoneRadiusMeters = zoneRadiusMeters;

  if (inZone.length === 0 && storesWithDistance.length > 0) {
    // Extend search radius to encompass closest stores
    radiusExpanded = true;
    inZone = storesWithDistance.slice(0, maxStores);
    activeZoneRadiusMeters = Math.max(zoneRadiusMeters, inZone[inZone.length - 1].distanceMeters + 500);
  }

  // 4. Prioritization ordering within eligible stores:
  // "prioritising delivery first before collection... nearest is serviceable, Y/N... Offers collection Y/N... Is Open, Y/N."
  // Priority 1: Open & Delivery Serviceable (sorted by distance)
  const openDelivery = inZone
    .filter((s) => s.isOpen && s.isDeliveryServiceable)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  // Priority 2: Open & Collection Only (sorted by distance)
  const openCollectionOnly = inZone
    .filter((s) => s.isOpen && !s.isDeliveryServiceable && s.isCollectionAvailable)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  // Priority 3: Closed (or pre-order only) stores (sorted by distance)
  const closedOrOther = inZone
    .filter((s) => !s.isOpen || (!s.isDeliveryServiceable && !s.isCollectionAvailable))
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  // Combine by priority order and cap at maxStores (5)
  const prioritized = [...openDelivery, ...openCollectionOnly, ...closedOrOther].slice(0, maxStores);

  return {
    stores: prioritized,
    prioritizedStores: prioritized,
    activeZoneRadiusMeters,
    radiusExpanded,
  };
}
