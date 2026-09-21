import {
  Store,
  EligibleStore,
  StoreEligibilityResult,
  Catalog,
  Product,
  Category,
  ProductAvailabilitySummary,
  Coordinates,
  Address,
  MAX_ELIGIBLE_STORES,
  COLLECTION_FALLBACK_RADIUS_METERS,
  Money,
  moneyToMajor,
  toMoney,
  normalizeStoreStatus,
} from '../../src/commerce/models';
export { calculateHaversineDistanceMeters } from '../../src/services/mapsDistanceService';
import { calculateHaversineDistanceMeters } from '../../src/services/mapsDistanceService';
import { evaluateStoreOpenNow, computeNextOpeningTime } from '../../src/services/storeOpeningHoursService';
import { DispatchAdapter, DispatchValidationResult } from './DispatchAdapter';
import { getDispatchAdapter } from './index';
import { DemoDispatchAdapter } from './DemoDispatchAdapter';
import { LRUCache, CacheStats } from '../utils/lruCache';

/**
 * Data provider contract for CommerceDiscoveryService.
 * Allows decoupling discovery logic from mock fixtures or live upstream data stores.
 */
export interface CommerceDiscoveryDataProvider {
  getStores(tenantId: string): Promise<Store[]> | Store[];
  getCategories(tenantId: string): Promise<Category[]> | Category[];
  getProducts(tenantId: string, storeId?: string): Promise<Product[]> | Product[];
}

/**
 * Section 12 Platform Policy Defaults
 */
export const MAX_VISIBLE_STORES = 10;
export const COLLECTION_RADIUS_METRES = 20_000; // 20 km
export const DISCOVERY_PAGE_SIZE = 25;
export const DISPATCH_VALIDATION_CONCURRENCY = 4;

/**
 * Controlled concurrency runner for evaluating external validations (e.g. Dispatch).
 * Ensures we never overload upstream APIs or create unconstrained fan-outs.
 */
export async function asyncPool<T, R>(
  concurrency: number,
  items: T[],
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  async function worker(): Promise<void> {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      try {
        results[index] = await fn(items[index]);
      } catch (err) {
        // Individual validation error is caught per-item
        results[index] = undefined as any;
      }
    }
  }

  const pool = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(pool);
  return results;
}

/**
 * CommerceDiscoveryService
 * Authoritative orchestrator for Store Discovery, Pre-Store Root Browsing,
 * and Store-Specific Catalog mapping.
 * Memory-bounded LRU caches protect against unbounded memory growth under 850-store loads.
 */
export class CommerceDiscoveryService {
  private static instance: CommerceDiscoveryService;

  // Memory-bounded LRU caches per Section 45
  private candidateStoresCache = new LRUCache<string, StoreEligibilityResult>({
    maxSize: 500, // Max 500 coordinate candidate sets
    defaultTtlMs: 5 * 60 * 1000, // 5 minutes
  });

  private rootCatalogCache = new LRUCache<string, { catalog: Catalog; summaries: Record<string, ProductAvailabilitySummary> }>({
    maxSize: 50,
    defaultTtlMs: 5 * 60 * 1000,
  });

  private storeCatalogCache = new LRUCache<string, Catalog>({
    maxSize: 500, // Max 500 store-menu variants
    defaultTtlMs: 2 * 60 * 1000, // 2 minutes
  });

  // In-flight request deduplication (stampede protection)
  private inFlightDiscovery: Map<string, Promise<StoreEligibilityResult>> = new Map();

  private static dataProvider: CommerceDiscoveryDataProvider | null = null;

  public static setDataProvider(provider: CommerceDiscoveryDataProvider | null): void {
    CommerceDiscoveryService.dataProvider = provider;
  }

  public static getDataProvider(): CommerceDiscoveryDataProvider | null {
    return CommerceDiscoveryService.dataProvider;
  }

  public static getInstance(): CommerceDiscoveryService {
    if (!CommerceDiscoveryService.instance) {
      CommerceDiscoveryService.instance = new CommerceDiscoveryService();
    }
    return CommerceDiscoveryService.instance;
  }

  public clearCache(): void {
    this.candidateStoresCache.clear();
    this.rootCatalogCache.clear();
    this.storeCatalogCache.clear();
    this.inFlightDiscovery.clear();
  }

  public getCacheStats(): {
    candidateStores: CacheStats;
    rootCatalog: CacheStats;
    storeCatalog: CacheStats;
    inFlightCount: number;
  } {
    return {
      candidateStores: this.candidateStoresCache.getStats(),
      rootCatalog: this.rootCatalogCache.getStats(),
      storeCatalog: this.storeCatalogCache.getStats(),
      inFlightCount: this.inFlightDiscovery.size,
    };
  }

  /**
   * Section 12: Store Discovery Algorithm
   * 1. Resolve lat/lng.
   * 2. Retrieve nearest Commerce store candidates (bounded candidate set <= 25).
   * 3. For delivery candidates, evaluate serviceability with controlled concurrency.
   * 4. Rank serviceable delivery stores by distance.
   * 5. Fill remaining visible positions with collection-capable stores <= 20 km.
   * 6. Return at most 10 stores.
   * 7. Preserve store operational concepts: open, closed, busy, paused.
   */
  public async discoverStores(params: {
    coordinates: Coordinates;
    address?: Address;
    deliveryAddress?: Address;
    preferredFulfillment?: 'delivery' | 'pickup';
    fulfillmentType?: 'delivery' | 'pickup';
    tenantId: string;
    appMode?: string;
    customStores?: Store[];
    dispatchAdapter?: DispatchAdapter;
  }): Promise<StoreEligibilityResult> {
    const {
      coordinates,
      address = params.deliveryAddress,
      // Default to 'pickup', not 'delivery': delivery is gated off entirely outside
      // demo mode (DeliverectApiClient.createBasket/checkout both reject it), so any
      // caller that omits this should get pickup-eligible ranking, not delivery-only
      // results that would leave the customer unable to actually order.
      preferredFulfillment = params.fulfillmentType || 'pickup',
      tenantId,
      appMode,
      customStores,
      dispatchAdapter,
    } = params;

    const cacheKey = `${tenantId}:${coordinates.latitude.toFixed(4)},${coordinates.longitude.toFixed(4)}:${preferredFulfillment}`;
    const now = Date.now();

    // Check cache (TTL 5 minutes for candidate sets handled by LRUCache)
    const cached = this.candidateStoresCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Deduplicate in-flight identical queries
    if (this.inFlightDiscovery.has(cacheKey)) {
      return this.inFlightDiscovery.get(cacheKey)!;
    }

    const discoveryPromise = (async () => {
      // 1. Source stores
      let rawStores: Store[] = [];
      const effectiveMode = appMode || 'unknown';
      if (customStores && customStores.length > 0) {
        rawStores = customStores;
      } else if (CommerceDiscoveryService.dataProvider && effectiveMode === 'demo') {
        rawStores = await CommerceDiscoveryService.dataProvider.getStores(tenantId);
      } else {
        // In staging/production, when no custom stores are supplied from upstream,
        // we do not fabricate stores.
        rawStores = [];
      }

      // Calculate distance to each store from coordinates
      const storesWithDist = rawStores.map((s) => {
        const dist = calculateHaversineDistanceMeters(coordinates, s.coordinates);
        return {
          ...s,
          distanceMeters: dist,
        };
      });

      // Sort by distance ascending and slice to bounded candidate set (DISCOVERY_PAGE_SIZE = 25)
      storesWithDist.sort((a, b) => a.distanceMeters - b.distanceMeters);
      const candidateSet = storesWithDist.slice(0, DISCOVERY_PAGE_SIZE);

      // 2. Evaluate delivery candidates with controlled concurrency (DISPATCH_VALIDATION_CONCURRENCY = 4)
      const evaluatedEntries: EligibleStore[] = await asyncPool(
        DISPATCH_VALIDATION_CONCURRENCY,
        candidateSet,
        async (store): Promise<EligibleStore> => {
          const normStatus = normalizeStoreStatus(store.status);
          const isOperational =
            normStatus !== 'CLOSED' ||
            Boolean(store.scheduling?.acceptsPreOrders) ||
            Boolean(store.scheduling?.acceptsSameDayPreOrders);

          let dispatchResult: DispatchValidationResult | null = null;
          if (store.supportsDelivery && isOperational) {
            try {
              const activeDispatchAdapter =
                dispatchAdapter ||
                (effectiveMode === 'demo' ? new DemoDispatchAdapter() : getDispatchAdapter(tenantId));
              dispatchResult = await activeDispatchAdapter.validateAvailability({
                channelLinkId: store.channelLinkId || store.id,
                storeId: store.id,
                deliveryAddress: {
                  ...address,
                  coordinates,
                },
              });
            } catch (err: any) {
              if (err.code === 'INTEGRATION_NOT_CONFIGURED' || err.status === 503) {
                throw err;
              }
              dispatchResult = {
                available: false,
                reason: err.message || 'Courier dispatch validation failed',
              };
            }
          }

          // Delivery criteria: supports delivery, operational, and dispatch validation confirms availability
          const deliveryServiceable = Boolean(
            store.supportsDelivery &&
            isOperational &&
            (dispatchResult ? dispatchResult.available : store.dispatchAvailability?.available === true)
          );

          // Collection criteria: supports pickup, within 20km (COLLECTION_RADIUS_METRES policy), operational
          const isWithinPickupRange = store.distanceMeters <= COLLECTION_RADIUS_METRES;
          const pickupAvailable = Boolean(
            store.supportsPickup &&
            isWithinPickupRange &&
            isOperational
          );

          // Section 22: Never invent missing fee or ETA. Only preserve what is returned.
          const deliveryEta = dispatchResult?.deliveryEtaMinutes
            ? `${dispatchResult.deliveryEtaMinutes} mins`
            : store.deliveryEta || undefined;

          const deliveryPrice = dispatchResult?.deliveryPrice !== undefined
            ? dispatchResult.deliveryPrice
            : store.deliveryPrice;

          const dispatchAvailability = dispatchResult
            ? {
                available: dispatchResult.available,
                validationId: dispatchResult.validationId,
                expiresAt: dispatchResult.expiresAt,
                deliveryEtaMinutes: dispatchResult.deliveryEtaMinutes,
                deliveryPrice: dispatchResult.deliveryPrice,
                pickupEtaMinutes: dispatchResult.pickupEtaMinutes,
                failureReason: dispatchResult.failureReason || dispatchResult.reason,
                reason: dispatchResult.reason || dispatchResult.failureReason,
              }
            : store.dispatchAvailability;

          const eligibleStoreObj: EligibleStore & Record<string, any> = {
            id: store.id,
            name: store.name,
            dispatchAvailability,
            store: {
              ...store,
              dispatchAvailability,
              status: normStatus, // Operational status strictly preserved
            },
            deliveryServiceable,
            pickupAvailable,
            deliveryEta,
            deliveryPrice,
            distanceMeters: store.distanceMeters,
            reasonUnavailable: !deliveryServiceable && !pickupAvailable
              ? (dispatchResult?.reason || dispatchResult?.failureReason || 'Outside delivery and collection coverage')
              : (!deliveryServiceable && pickupAvailable ? (dispatchResult?.reason || dispatchResult?.failureReason || 'Delivery not serviceable for this location') : undefined),
          };

          return eligibleStoreObj;
        }
      );

      // Filter valid evaluated entries
      const validEntries = evaluatedEntries.filter(Boolean);

      // 3. Separate delivery vs collection candidates.
      // Steer customers toward stores that are open now (or opening soonest) rather
      // than pure nearest-first, which could rank a closer-but-closed store ahead of
      // one that's actually orderable right now.
      const rankByOpenNowThenDistance = (a: EligibleStore, b: EligibleStore): number => {
        const aOpen = evaluateStoreOpenNow(a.store).isOpen;
        const bOpen = evaluateStoreOpenNow(b.store).isOpen;
        if (aOpen !== bOpen) return aOpen ? -1 : 1;
        if (!aOpen) {
          const aNext = computeNextOpeningTime(a.store)?.getTime();
          const bNext = computeNextOpeningTime(b.store)?.getTime();
          if (aNext !== bNext) {
            if (aNext === undefined) return 1;
            if (bNext === undefined) return -1;
            return aNext - bNext;
          }
        }
        return a.distanceMeters - b.distanceMeters;
      };

      const deliveryStores = validEntries
        .filter((e) => e.deliveryServiceable)
        .sort(rankByOpenNowThenDistance);

      const collectionStores = validEntries
        .filter((e) => e.pickupAvailable && !e.deliveryServiceable)
        .sort(rankByOpenNowThenDistance);

      // 4. Combine based on Section 12 rule:
      // Rank serviceable delivery stores by distance.
      // Fill remaining visible positions with collection-capable stores <= 20 km.
      // Return at most MAX_VISIBLE_STORES = 10.
      const visibleEligible: EligibleStore[] = [...deliveryStores];
      for (const col of collectionStores) {
        if (visibleEligible.length >= MAX_VISIBLE_STORES) break;
        visibleEligible.push(col);
      }

      // Section 12 & DSP-07: Genuine zero-store state.
      // Do not invent fake stores or force unserviceable stores into eligible list when neither delivery nor collection is supported.
      const candidatePickups = validEntries.filter((e) => e.pickupAvailable);

      const finalResult: StoreEligibilityResult = {
        eligibleStores: visibleEligible.slice(0, MAX_VISIBLE_STORES),
        deliveryStores: deliveryStores.slice(0, MAX_VISIBLE_STORES),
        collectionStores: candidatePickups.slice(0, MAX_VISIBLE_STORES),
        hasDeliveryCoverage: deliveryStores.length > 0,
      };

      // Store in candidate cache (5 minutes TTL in LRUCache)
      this.candidateStoresCache.set(cacheKey, finalResult);

      return finalResult;
    })();

    this.inFlightDiscovery.set(cacheKey, discoveryPromise);
    try {
      return await discoveryPromise;
    } finally {
      this.inFlightDiscovery.delete(cacheKey);
    }
  }

  /**
   * Section 13: Pre-Store Browsing & Root Catalog with Availability Projection
   * Root Menu is store-agnostic.
   * Product availability (availableNearby) is derived ONLY from the small bounded
   * nearby eligible stores candidate set (<= 10 stores).
   */
  public async getRootCatalogWithNearbyProjection(params: {
    tenantId: string;
    candidateStoreIds?: string[];
    appMode?: string;
  }): Promise<{ catalog: Catalog; summaries: Record<string, ProductAvailabilitySummary> }> {
    const { tenantId, candidateStoreIds = [], appMode = 'unknown' } = params;

    let allProducts: Product[] = [];
    let categories: Category[] = [];
    let candidateStores: Store[] = [];

    if (CommerceDiscoveryService.dataProvider && appMode === 'demo') {
      allProducts = await CommerceDiscoveryService.dataProvider.getProducts(tenantId);
      categories = await CommerceDiscoveryService.dataProvider.getCategories(tenantId);
      const allStores = await CommerceDiscoveryService.dataProvider.getStores(tenantId);
      const boundedStoreIds = candidateStoreIds.slice(0, MAX_VISIBLE_STORES);
      candidateStores = allStores
        .filter((s) => (boundedStoreIds.length > 0 ? boundedStoreIds.includes(s.id) : true))
        .slice(0, MAX_VISIBLE_STORES);
    }

    // Phase 1: Filter out modifier/bundle sub-components or items with '#' in PLU
    const activeProducts = allProducts.filter((p) => p.active !== false && !p.plu?.includes('#'));

    const rootCatalog: Catalog = {
      id: `root-catalog-${tenantId}`,
      type: 'ROOT',
      categories,
      totalProducts: activeProducts.length,
      updatedAt: new Date().toISOString(),
    };

    const summaries: Record<string, ProductAvailabilitySummary> = {};

    for (const prod of activeProducts) {
      // Check if product is available in at least one candidate store
      let availableStoreCount = 0;
      let firstAvailableStoreId: string | undefined;
      let deliveryAvailable = false;
      let collectionAvailable = false;

      for (const store of candidateStores) {
        const isOperational =
          normalizeStoreStatus(store.status) !== 'CLOSED' ||
          Boolean(store.scheduling?.acceptsPreOrders) ||
          Boolean(store.scheduling?.acceptsSameDayPreOrders);

        if (!isOperational) continue;

        // In a store context, check active & in-stock
        const isCarried = prod.active !== false;
        const inStock = prod.stockStatus !== 'OUT_OF_STOCK';

        if (isCarried && inStock) {
          availableStoreCount++;
          if (!firstAvailableStoreId) {
            firstAvailableStoreId = store.id;
          }
          if (store.supportsDelivery) deliveryAvailable = true;
          if (store.supportsPickup) collectionAvailable = true;
        }
      }

      const availableNearby = availableStoreCount > 0;

      summaries[prod.plu] = {
        productId: prod.id,
        plu: prod.plu,
        availableStoreCount,
        eligibleStoreCount: candidateStores.length,
        nearestAvailableStoreId: firstAvailableStoreId,
        deliveryAvailable,
        collectionAvailable,
        availableNearby,
      };
    }

    return {
      catalog: rootCatalog,
      summaries,
    };
  }

  /**
   * Section 9: Store-Specific Menu Catalog
   * Sourced directly for a specific channelLinkId / storeId and optional fulfillment.
   * Authoritative for local store range, pricing, stock quantities, and active items.
   */
  public async getStoreCatalog(params: {
    tenantId: string;
    storeId: string;
    fulfillmentType?: 'delivery' | 'pickup';
    appMode?: string;
  }): Promise<Catalog> {
    const { tenantId, storeId, fulfillmentType = 'delivery', appMode = 'unknown' } = params;
    const cacheKey = `${tenantId}:${storeId}:${fulfillmentType}`;

    const cached = this.storeCatalogCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    let store: Store | undefined;
    let storeProducts: Product[] = [];
    let categories: Category[] = [];

    if (CommerceDiscoveryService.dataProvider && appMode === 'demo') {
      const allStores = await CommerceDiscoveryService.dataProvider.getStores(tenantId);
      store = allStores.find((s) => s.id === storeId);
      if (store) {
        const allProducts = await CommerceDiscoveryService.dataProvider.getProducts(tenantId, storeId);
        categories = await CommerceDiscoveryService.dataProvider.getCategories(tenantId);
        storeProducts = allProducts
          .map((p) => ({
            ...p,
            storeId: store!.id,
            active: p.active !== false,
            stockStatus: p.stockStatus || 'IN_STOCK',
          }))
          .filter((p) => p.active !== false && !p.plu?.includes('#'));
      }
    }

    if (!store) {
      const err: any = new Error(`Store not found: ${storeId}`);
      err.statusCode = 404;
      err.code = 'STORE_NOT_FOUND';
      throw err;
    }

    const catalog: Catalog = {
      id: `store-catalog-${storeId}-${fulfillmentType}`,
      type: 'STORE',
      storeId,
      categories,
      totalProducts: storeProducts.length,
      updatedAt: new Date().toISOString(),
      products: storeProducts,
    };

    // Store in cache (2 minutes TTL in LRUCache)
    this.storeCatalogCache.set(cacheKey, catalog);

    return catalog;
  }
}
