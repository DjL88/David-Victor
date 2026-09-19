import {
  CommerceClient,
  LocationResolutionResult,
} from './CommerceClient';
import {
  BootstrapResponse,
  Store,
  EligibleStore,
  StoreEligibilityResult,
  MAX_ELIGIBLE_STORES,
  COLLECTION_FALLBACK_RADIUS_METERS,
  Catalog,
  Product,
  ProductAvailabilitySummary,
  Basket,
  BasketDiscount,
  CheckoutSummary,
  Coordinates,
  Story,
  BasketItem,
  BasketCharge,
  Restriction,
  Address,
  Order,
  OrderTrackingStatus,
  HostedPaymentSession,
  CheckoutStatus,
  DeliveryOption,
  DeliverySlot,
  SchedulingPolicy,
  TenantSubstitutionPolicy,
  SubstitutionPreferenceType,
  OrderPaymentInfo,
  PickingEvent,
  PickingState,
  PickingItem,
  OrderSnapshot,
  DemoScenario,
  FulfillmentSchedulingType,
  CustomerOrderStatus,
  OrderDeliveryInfo,
  Money,
  toMoney,
  moneyFromMajor,
  moneyToMajor,
  formatMoney,
} from './models';
import {
  calculateSubstitutionPrice,
  DEFAULT_SUBSTITUTION_POLICY,
  calculateAuthorizationMaximum,
  calculatePreChosenAlternativeExtraBuffer,
} from './substitutionPricing';
import {
  generateAvailableSlots,
  DEFAULT_SCHEDULING_POLICY,
  isStoreCurrentlyOpen,
} from './slotEngine';
import {
  calculateStoresWithDistance,
  calculateHaversineDistanceMeters,
} from '../services/mapsDistanceService';
import {
  MOCK_TENANTS,
  MOCK_STORES,
  MOCK_CATEGORIES,
  MOCK_PRODUCTS,
  MOCK_STORIES,
  MOCK_SAVED_ADDRESSES,
  MOCK_FEE_POLICIES,
  MOCK_ORDERS,
} from './mockData';
import { DELIVERECT_CATALOG_DEALS } from './dealModels';
import {
  BundleProduct,
  SelectedBundleModifier,
  SAMPLE_DELIVERECT_BUNDLES,
  evaluateBundleStockStatus,
  calculateBundlePrice,
  BundleCatalog,
} from './bundleModels';
import { defaultRuleEngine } from '../rules/RuleEngine';
import { defaultAdminClient } from './MockAdminClient';
import { applySearchMerchandising, DEFAULT_SEARCH_CONFIG, getActiveSearchConfig } from './searchMerchEngine';
import { catalogStore, normalizeStoreId } from './catalogStore';
import { getCategoryAndAllDescendantIds } from './categoryHierarchy';
import { checkProductSnooze } from '../services/snoozeCheckService';

// In-memory basket storage for active sessions
const activeBaskets = new Map<string, Basket>();

export class MockCommerceClient implements CommerceClient {
  private currentTenantId: string = 'brand-alpha';

  private get currentProducts(): Product[] {
    return catalogStore.getProducts();
  }

  // In-memory orders for tracking
  private orders: Map<string, Order> = new Map();

  // In-memory payment sessions
  private paymentSessions: Map<
    string,
    {
      sessionId: string;
      basketId: string;
      status: CheckoutStatus;
      orderId?: string;
      expiresAt: string;
      failureReason?: string;
      pollCount: number;
    }
  > = new Map();

  // Test simulation flags
  private simulationFlags: {
    simulatePriceChange?: boolean;
    simulateItemUnavailable?: boolean;
    simulateDispatchExpired?: boolean;
    simulateDispatchUnavailable?: boolean;
    simulatePaymentFailure?: boolean;
  } = {};

  constructor(initialTenantId?: string) {
    if (initialTenantId && MOCK_TENANTS[initialTenantId]) {
      this.currentTenantId = initialTenantId;
    }
    // Initialize with mock orders
    MOCK_ORDERS.forEach((o) => {
      this.orders.set(o.id, { ...o });
    });
  }

  public resetDemoState(): void {
    activeBaskets.clear();
    this.orders.clear();
    MOCK_ORDERS.forEach((o) => {
      this.orders.set(o.id, { ...o });
    });
    this.paymentSessions.clear();
    this.simulationFlags = {};
  }

  public setSimulationFlags(flags: {
    simulatePriceChange?: boolean;
    simulateItemUnavailable?: boolean;
    simulateDispatchExpired?: boolean;
    simulateDispatchUnavailable?: boolean;
    simulatePaymentFailure?: boolean;
  }) {
    this.simulationFlags = { ...this.simulationFlags, ...flags };
  }

  public setTenant(tenantId: string) {
    if (MOCK_TENANTS[tenantId]) {
      this.currentTenantId = tenantId;
    }
  }

  private async simulateLatency(ms: number = 200): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async getBootstrap(): Promise<BootstrapResponse> {
    await this.simulateLatency(150);
    const tenant = MOCK_TENANTS[this.currentTenantId] || MOCK_TENANTS['onestop-express'];

    return {
      tenant,
      supportedCountries: ['GB'],
      defaultLocation: {
        address: 'Chelmsford, Essex, CM1 1BE',
        coordinates: { latitude: 51.7356, longitude: 0.4705 },
      },
    };
  }

  async resolveAddress(
    query: string | Coordinates
  ): Promise<LocationResolutionResult> {
    await this.simulateLatency(250);

    if (typeof query === 'object' && 'latitude' in query) {
      // Device GPS coordinates resolution
      return {
        address: {
          line1: 'Current GPS Location',
          city: 'Chelmsford',
          postalCode: 'CM1 1BE',
          country: 'GB',
          formattedAddress: 'Near High Street, Chelmsford CM1 1BE',
        },
        coordinates: query,
        formattedText: 'Near High Street, Chelmsford CM1 1BE',
      };
    }

    const trimmed = query.trim().toUpperCase();
    const matched = MOCK_SAVED_ADDRESSES.find(
      (a) =>
        a.postalCode.toUpperCase().includes(trimmed) ||
        a.line1.toUpperCase().includes(trimmed) ||
        a.city.toUpperCase().includes(trimmed)
    );

    if (matched) {
      return {
        address: matched,
        coordinates: { latitude: 51.7356, longitude: 0.4705 },
        formattedText: matched.formattedAddress || `${matched.line1}, ${matched.postalCode}`,
      };
    }

    // Default fallback geocoded address
    const fallbackAddress = {
      line1: query.trim() || 'High Street',
      city: 'Chelmsford',
      postalCode: query.length >= 5 ? query.trim().toUpperCase() : 'CM1 1BE',
      country: 'GB',
      formattedAddress: `${query.trim()}, Chelmsford`,
    };

    return {
      address: fallbackAddress,
      coordinates: { latitude: 51.7356, longitude: 0.4705 },
      formattedText: fallbackAddress.formattedAddress,
    };
  }

  async getStore(storeId: string): Promise<Store | null> {
    await this.simulateLatency(50);
    const store = MOCK_STORES.find((s) => s.id === storeId) || null;
    return store ? JSON.parse(JSON.stringify(store)) : null;
  }

  async getEligibleStores(
    coordinates: Coordinates,
    _address?: Address,
    _preferredFulfillment?: 'delivery' | 'pickup'
  ): Promise<StoreEligibilityResult> {
    await this.simulateLatency(150);

    const candidates = calculateStoresWithDistance(MOCK_STORES, coordinates);

    // 1. Evaluate delivery serviceability:
    // Store must support delivery, be within delivery dispatch coverage (<= 12km),
    // and status !== 'closed' (or accepts scheduled pre-orders).
    const serviceableDeliveryStores: EligibleStore[] = [];
    const pickupCapableFallbackStores: EligibleStore[] = [];

    candidates.forEach((s) => {
      const isWithinDeliveryRange = s.distanceMeters <= 12000;
      const isWithinPickupRange = s.distanceMeters <= COLLECTION_FALLBACK_RADIUS_METERS;
      const isOperational =
        s.status !== 'closed' ||
        Boolean(s.scheduling?.acceptsPreOrders) ||
        Boolean(s.scheduling?.acceptsSameDayPreOrders);

      const deliveryServiceable = Boolean(
        s.supportsDelivery &&
        isWithinDeliveryRange &&
        isOperational &&
        s.dispatchAvailability?.available !== false
      );

      const pickupAvailable = Boolean(
        s.supportsPickup &&
        isWithinPickupRange &&
        isOperational
      );

      const eligibleEntry: EligibleStore = {
        store: s,
        deliveryServiceable,
        pickupAvailable,
        deliveryEta: s.deliveryEta,
        deliveryPrice: s.deliveryPrice,
        distanceMeters: s.distanceMeters,
      };

      if (deliveryServiceable) {
        serviceableDeliveryStores.push(eligibleEntry);
      } else if (pickupAvailable) {
        pickupCapableFallbackStores.push(eligibleEntry);
      }
    });

    // 2. Sort serviceable delivery stores by distance ascending
    serviceableDeliveryStores.sort((a, b) => a.distanceMeters - b.distanceMeters);

    // 3. Sort collection-only fallback stores by distance ascending
    pickupCapableFallbackStores.sort((a, b) => a.distanceMeters - b.distanceMeters);

    // 4. Combine: serviceable delivery stores first, then collection-only stores within 20km
    // Cap at MAX_ELIGIBLE_STORES (10). Never include stores > 20km.
    const combinedEligible: EligibleStore[] = [...serviceableDeliveryStores];
    for (const p of pickupCapableFallbackStores) {
      if (combinedEligible.length >= MAX_ELIGIBLE_STORES) break;
      combinedEligible.push(p);
    }

    return {
      eligibleStores: combinedEligible.slice(0, MAX_ELIGIBLE_STORES),
      deliveryStores: serviceableDeliveryStores.slice(0, MAX_ELIGIBLE_STORES),
      collectionStores: pickupCapableFallbackStores.slice(0, MAX_ELIGIBLE_STORES),
      hasDeliveryCoverage: serviceableDeliveryStores.length > 0,
    };
  }

  async getNearbyStores(
    coordinates: Coordinates,
    fulfillmentType?: 'delivery' | 'pickup'
  ): Promise<Store[]> {
    await this.simulateLatency(150);

    let stores = calculateStoresWithDistance(MOCK_STORES, coordinates);

    if (fulfillmentType === 'delivery') {
      // Show delivery-supporting stores first, ordered by distance
      stores.sort((a, b) => {
        if (a.supportsDelivery && !b.supportsDelivery) return -1;
        if (!a.supportsDelivery && b.supportsDelivery) return 1;
        return a.distanceMeters - b.distanceMeters;
      });
    } else if (fulfillmentType === 'pickup') {
      stores = stores.filter((s) => s.supportsPickup);
      stores.sort((a, b) => a.distanceMeters - b.distanceMeters);
    } else {
      stores.sort((a, b) => a.distanceMeters - b.distanceMeters);
    }

    return stores;
  }

  async getStores(
    coordinates?: Coordinates,
    fulfillmentType?: 'delivery' | 'pickup'
  ): Promise<Store[]> {
    if (coordinates) {
      return this.getNearbyStores(coordinates, fulfillmentType);
    }
    return MOCK_STORES;
  }

  async resetCache(): Promise<{ success: boolean; message: string }> {
    await this.simulateLatency(100);
    return {
      success: true,
      message: 'Demo commerce cache reset successfully',
    };
  }

  async getRootCatalog(_options?: { refresh?: boolean }): Promise<Catalog> {
    await this.simulateLatency(200);

    // Root Catalog: only active products, brand-wide
    const activeProducts = this.currentProducts.filter((p) => p.active !== false);

    const bundleCatalog: BundleCatalog = {
      id: 'bundle-catalog-root',
      bundles: SAMPLE_DELIVERECT_BUNDLES,
      totalBundles: SAMPLE_DELIVERECT_BUNDLES.length,
      updatedAt: new Date().toISOString(),
    };

    return {
      id: 'root-catalog-gb',
      type: 'ROOT',
      categories: MOCK_CATEGORIES,
      totalProducts: activeProducts.length,
      bundleCatalog,
      updatedAt: new Date().toISOString(),
    };
  }

  async getStoreCatalog(
    storeId: string,
    _options?: { fulfillment?: 'delivery' | 'pickup'; menuId?: string; refresh?: boolean }
  ): Promise<Catalog> {
    await this.simulateLatency(250);

    const store = MOCK_STORES.find((s) => s.id === storeId);
    if (!store) {
      throw new Error(`Store not found: ${storeId}`);
    }

    const storeProducts = this.currentProducts
      .map((p) => this.applyStoreSpecifics(p, storeId))
      .filter((p) => p.active !== false);

    // Evaluate store-specific modifier snooze/stock status for combos
    const storeBundles = SAMPLE_DELIVERECT_BUNDLES.map((bundle) => {
      const sections = (bundle.sections || bundle.modifierGroups || []).map((sec) => ({
        ...sec,
        modifiers: sec.modifiers.map((m) => {
          const snooze = checkProductSnooze(storeId, m.plu);
          const isSnoozed = m.snoozed || (snooze && !snooze.isAvailable && snooze.reason === 'snoozed');
          const isActive = m.active !== false && (!snooze || snooze.isAvailable || snooze.reason !== 'out_of_stock');
          return {
            ...m,
            snoozed: isSnoozed,
            active: isActive,
          };
        }),
      }));

      const stockCheck = evaluateBundleStockStatus(sections);
      return {
        ...bundle,
        sections,
        modifierGroups: sections,
        stockStatus: stockCheck.stockStatus,
        outOfStockReason: stockCheck.outOfStockReason,
      };
    });

    const bundleCatalog: BundleCatalog = {
      id: `bundle-catalog-${storeId}`,
      storeId,
      bundles: storeBundles,
      totalBundles: storeBundles.length,
      updatedAt: new Date().toISOString(),
    };

    return {
      id: `store-catalog-${storeId}`,
      type: 'STORE',
      storeId,
      categories: MOCK_CATEGORIES,
      totalProducts: storeProducts.length,
      bundleCatalog,
      updatedAt: new Date().toISOString(),
    };
  }

  async getStories(context?: string | {
    storeId?: string;
    coordinates?: Coordinates;
  }): Promise<Story[]> {
    await this.simulateLatency(150);

    const storeId = typeof context === 'string' ? context : context?.storeId;

    let candidateStories = MOCK_STORIES;
    try {
      const tenantStories = await defaultAdminClient.getStories(this.currentTenantId);
      if (tenantStories && tenantStories.length > 0) {
        candidateStories = tenantStories;
      }
    } catch {
      // Fall back to default mock stories
    }

    return candidateStories.filter((story) => {
      let targetProduct: Product | undefined = undefined;
      if (story.action?.type === 'PRODUCT' && story.action.targetPlu) {
        targetProduct = this.currentProducts.find((p) => p.plu === story.action.targetPlu);
        if (targetProduct && storeId) {
          targetProduct = this.applyStoreSpecifics(targetProduct, storeId);
        }
      }

      // Collect multiple linked products for location-level AND/OR stock evaluation
      let linkedProducts: Product[] | undefined = undefined;
      const plusToEvaluate =
        story.linkedProductPlus && story.linkedProductPlus.length > 0
          ? story.linkedProductPlus
          : story.action?.targetPlu
          ? [story.action.targetPlu]
          : [];

      if (plusToEvaluate.length > 0) {
        linkedProducts = plusToEvaluate
          .map((plu) => {
            const p = this.currentProducts.find((prod) => prod.plu === plu);
            return p && storeId ? this.applyStoreSpecifics(p, storeId) : p;
          })
          .filter((p): p is Product => p !== undefined);
      }

      return defaultRuleEngine.isStoryEligible(
        story,
        { storeId, country: 'GB' },
        targetProduct,
        linkedProducts
      );
    });
  }

  async getProducts(): Promise<Product[]> {
    await this.simulateLatency(100);
    return JSON.parse(JSON.stringify(this.currentProducts));
  }

  async searchProducts(
    query: string,
    storeId?: string,
    options?: { categoryId?: string; limit?: number }
  ): Promise<{
    products: Product[];
    summaries?: Record<string, ProductAvailabilitySummary>;
  }> {
    await this.simulateLatency(150);

    const q = query.trim().toLowerCase();

    // If storeId is provided, project products with location-specific pricing, stock & active status
    const pool = this.currentProducts.map((p) => (storeId ? this.applyStoreSpecifics(p, storeId) : p));
    const activePool = pool.filter((p) => p && p.active !== false);

    let matches: Product[];

    if (q) {
      // Apply search merchandising across the active pool (evaluates typo aliases e.g. "choclit" -> "chocolate", query rewrites, synonyms, pins, boosts)
      const searchConfig = getActiveSearchConfig();
      const merchandised = applySearchMerchandising(activePool, query, searchConfig);
      let matchedProds = merchandised.map((m) => m.product);

      if (options?.categoryId) {
        const allowedCategoryIds = getCategoryAndAllDescendantIds(
          MOCK_CATEGORIES,
          options.categoryId
        );
        matchedProds = matchedProds.filter((p) =>
          (p.categoryIds || []).some((cid) => allowedCategoryIds.includes(cid))
        );
      }
      matches = matchedProds;
    } else {
      matches = activePool.filter((p) => {
        if (options?.categoryId) {
          const allowedCategoryIds = getCategoryAndAllDescendantIds(
            MOCK_CATEGORIES,
            options.categoryId
          );
          return (p.categoryIds || []).some((cid) => allowedCategoryIds.includes(cid));
        }
        return true;
      });
    }

    if (options?.limit) {
      matches = matches.slice(0, options.limit);
    }

    // If storeId is provided, store specifics have already been applied
    if (storeId) {
      return { products: matches };
    }

    // Before store selection: generate store availability summaries
    const summaries: Record<string, ProductAvailabilitySummary> = {};
    matches.forEach((p) => {
      summaries[p.plu] = this.computeAvailabilitySummary(p);
    });

    return { products: matches, summaries };
  }

  async getProduct(
    plu: string,
    storeId?: string
  ): Promise<{
    product: Product;
    summary?: ProductAvailabilitySummary;
  }> {
    await this.simulateLatency(150);

    const baseProduct = this.currentProducts.find((p) => p.plu === plu);
    if (!baseProduct) {
      throw new Error(`Product not found with PLU: ${plu}`);
    }

    if (storeId) {
      return {
        product: this.applyStoreSpecifics(baseProduct, storeId),
      };
    }

    return {
      product: baseProduct,
      summary: this.computeAvailabilitySummary(baseProduct),
    };
  }

  async getProductAvailabilitySummaries(
    plus: string[],
    eligibleStoreIds: string[] = []
  ): Promise<Record<string, ProductAvailabilitySummary>> {
    await this.simulateLatency(100);

    const summaries: Record<string, ProductAvailabilitySummary> = {};
    plus.forEach((plu) => {
      const product = this.currentProducts.find((p) => p.plu === plu);
      if (product) {
        summaries[plu] = this.computeAvailabilitySummary(product, eligibleStoreIds);
      }
    });

    return summaries;
  }

  async createBasket(
    storeId: string,
    fulfillmentType: 'delivery' | 'pickup' = 'delivery'
  ): Promise<Basket> {
    await this.simulateLatency(200);

    const store = MOCK_STORES.find((s) => s.id === storeId) || MOCK_STORES[0];
    const basketId = `bkt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const newBasket: Basket = {
      id: basketId,
      storeId: store.id,
      storeName: store.name,
      fulfillmentType,
      items: [],
      subtotal: toMoney(0, 'GBP'),
      discounts: [],
      charges: [],
      depositTotal: toMoney(0, 'GBP'),
      tax: toMoney(0, 'GBP'),
      total: toMoney(0, 'GBP'),
      currency: 'GBP',
      validationErrors: [],
      restrictions: [],
      discountTotal: toMoney(0, 'GBP'),
      tip: toMoney(0, 'GBP'),
      dispatchValidationExpiresAt: this.simulationFlags.simulateDispatchExpired
        ? new Date(Date.now() - 10000).toISOString()
        : new Date(Date.now() + 180000).toISOString(),
      updatedAt: new Date().toISOString(),
    };

    activeBaskets.set(basketId, newBasket);
    return newBasket;
  }

  async getBasket(basketId: string): Promise<Basket> {
    await this.simulateLatency(100);
    const basket = activeBaskets.get(basketId);
    if (!basket) {
      return this.createBasket(MOCK_STORES[0].id);
    }
    return basket;
  }

  async updateBasketItem(
    basketId: string,
    pluOrProduct: string | { plu: string },
    quantity: number
  ): Promise<Basket> {
    await this.simulateLatency(180);

    let basket = activeBaskets.get(basketId);
    if (!basket) {
      basket = await this.createBasket(MOCK_STORES[0].id);
    }

    const plu = typeof pluOrProduct === 'string' ? pluOrProduct : pluOrProduct?.plu;
    const product = this.currentProducts.find((p) => p.plu === plu);
    if (!product) {
      throw new Error(`Invalid PLU: ${plu}`);
    }

    const storeSpecificProduct = this.applyStoreSpecifics(product, basket.storeId);

    // Calculate effective maximum limit
    const limits: number[] = [];
    if (storeSpecificProduct.stockQuantity != null) {
      limits.push(storeSpecificProduct.stockQuantity);
    }
    if (storeSpecificProduct.multiMax != null) {
      limits.push(storeSpecificProduct.multiMax);
    }
    if (storeSpecificProduct.maximumQuantity != null) {
      limits.push(storeSpecificProduct.maximumQuantity);
    }

    const effectiveMax = limits.length > 0 ? Math.min(...limits) : 99;
    const clampedQuantity = Math.min(Math.max(0, quantity), effectiveMax);

    const existingIndex = basket.items.findIndex((item) => item.plu === plu);

    if (existingIndex > -1 && basket.items[existingIndex].isCombo) {
      if (clampedQuantity <= 0) {
        basket.items.splice(existingIndex, 1);
      } else {
        const existing = basket.items[existingIndex];
        basket.items[existingIndex] = {
          ...existing,
          quantity: clampedQuantity,
          totalPrice: {
            amount: existing.price.amount * clampedQuantity,
            currency: existing.price.currency,
          },
        };
      }
      this.recalculateBasketTotals(basket);
      activeBaskets.set(basket.id, basket);
      return { ...basket };
    }

    if (clampedQuantity <= 0) {
      if (existingIndex > -1) {
        basket.items.splice(existingIndex, 1);
      }
    } else {
      const itemPrice: Money = storeSpecificProduct.price != null
        ? (typeof storeSpecificProduct.price === 'object' && 'amount' in storeSpecificProduct.price
            ? storeSpecificProduct.price
            : moneyFromMajor(storeSpecificProduct.price, basket.currency))
        : toMoney(0, basket.currency);
      const originalPrice: Money | undefined = storeSpecificProduct.originalPrice != null
        ? (typeof storeSpecificProduct.originalPrice === 'object' && 'amount' in storeSpecificProduct.originalPrice
            ? storeSpecificProduct.originalPrice
            : moneyFromMajor(storeSpecificProduct.originalPrice, basket.currency))
        : undefined;
      const depositRaw = storeSpecificProduct.deposit;
      const deposit: Money | undefined = depositRaw != null
        ? (typeof depositRaw === 'object' && 'amount' in depositRaw ? depositRaw : moneyFromMajor(depositRaw, basket.currency))
        : undefined;

      const basketItem: BasketItem = {
        id: `item_${plu}`,
        plu,
        name: storeSpecificProduct.name || plu,
        price: itemPrice,
        unitPrice: itemPrice,
        totalPrice: { amount: itemPrice.amount * clampedQuantity, currency: itemPrice.currency },
        originalPrice,
        quantity: clampedQuantity,
        imageUrl: storeSpecificProduct.imageUrl,
        deposit,
        effectiveMaxQuantity: effectiveMax,
      };

      if (existingIndex > -1) {
        basket.items[existingIndex] = basketItem;
      } else {
        basket.items.push(basketItem);
      }
    }

    this.recalculateBasketTotals(basket);
    activeBaskets.set(basket.id, basket);
    return { ...basket };
  }

  async addBundleToBasket(
    basketId: string,
    bundle: BundleProduct,
    selectedModifiers: SelectedBundleModifier[],
    quantity: number = 1
  ): Promise<Basket> {
    await this.simulateLatency(180);

    let basket = activeBaskets.get(basketId);
    if (!basket) {
      basket = await this.createBasket(MOCK_STORES[0].id);
    }

    const clampedQuantity = Math.max(1, quantity);
    const currency = bundle.currency || basket.currency || 'GBP';
    const computedPrice = calculateBundlePrice(bundle, selectedModifiers);
    const itemPrice: Money = toMoney(computedPrice.totalPriceMinor, currency);

    // Construct subItems formatted compliant with Deliverect combo schema
    const subItems = selectedModifiers.map((mod, idx) => ({
      id: `${mod.modifierId}_${idx}`,
      modifierId: mod.modifierId,
      plu: mod.plu,
      name: mod.name,
      price: toMoney(mod.priceMinor || mod.price, currency),
      priceMinor: mod.priceMinor || mod.price,
      quantity: mod.quantity,
      sectionId: mod.sectionId,
      sectionName: mod.sectionName,
    }));

    const bundleItemId = `bundle_${bundle.plu}_${Date.now()}`;
    const basketItem: BasketItem = {
      id: bundleItemId,
      plu: bundle.plu,
      name: bundle.name,
      price: itemPrice,
      unitPrice: itemPrice,
      totalPrice: { amount: itemPrice.amount * clampedQuantity, currency },
      quantity: clampedQuantity,
      imageUrl: bundle.imageUrl || bundle.image,
      isCombo: true,
      bundleId: bundle.id,
      bundlePlu: bundle.plu,
      bundleName: bundle.name,
      subItems,
    };

    basket.items.push(basketItem);
    this.recalculateBasketTotals(basket);
    activeBaskets.set(basket.id, basket);
    return { ...basket };
  }

  async removeBasketItem(basketId: string, pluOrId: string): Promise<Basket> {
    const basket = activeBaskets.get(basketId);
    if (!basket) return this.updateBasketItem(basketId, pluOrId, 0);

    // Check if matches an item by unique ID or PLU
    const itemIdx = basket.items.findIndex((i) => i.id === pluOrId || i.plu === pluOrId);
    if (itemIdx > -1) {
      basket.items.splice(itemIdx, 1);
      this.recalculateBasketTotals(basket);
      activeBaskets.set(basket.id, basket);
      return { ...basket };
    }

    return this.updateBasketItem(basketId, pluOrId, 0);
  }

  async removeFromBasket(basketId: string, plu: string): Promise<Basket> {
    return this.removeBasketItem(basketId, plu);
  }

  async selectStore(
    storeId: string,
    existingBasketId?: string
  ): Promise<{
    store: Store;
    basket?: Basket;
    storeSwitchDiff?: {
      availableUnchanged?: Array<{ plu: string; name: string; quantity: number; price: Money | number }>;
      priceChanges: Array<{ plu: string; name?: string; oldPrice: Money | number; newPrice: Money | number }>;
      unavailableItems: Array<{ plu: string; name: string; reason?: string }>;
      quantityAdjusted: Array<{ plu: string; name?: string; requested: number; adjustedTo: number; reason?: string }>;
    };
  }> {
    await this.simulateLatency(300);

    const targetStore = MOCK_STORES.find((s) => s.id === storeId);
    if (!targetStore) {
      throw new Error(`Store not found: ${storeId}`);
    }

    if (!existingBasketId) {
      const newBasket = await this.createBasket(storeId);
      return { store: targetStore, basket: newBasket };
    }

    const currentBasket = activeBaskets.get(existingBasketId);
    if (!currentBasket || currentBasket.items.length === 0) {
      const newBasket = await this.createBasket(storeId);
      return { store: targetStore, basket: newBasket };
    }

    // Compare basket items against destination store
    const availableUnchanged: Array<{ plu: string; name: string; quantity: number; price: Money | number }> = [];
    const priceChanges: Array<{ plu: string; name: string; oldPrice: Money | number; newPrice: Money | number }> = [];
    const unavailableItems: Array<{ plu: string; name: string; reason?: string }> = [];
    const quantityAdjusted: Array<{ plu: string; name: string; requested: number; adjustedTo: number; reason?: string }> = [];

    const reconciledItems: BasketItem[] = [];

    for (const item of currentBasket.items) {
      const rawProduct = this.currentProducts.find((p) => p.plu === item.plu);
      if (!rawProduct || rawProduct.active === false) {
        unavailableItems.push({ plu: item.plu, name: item.name, reason: 'Not carried in this store' });
        continue;
      }

      const storeProduct = this.applyStoreSpecifics(rawProduct, storeId);

      if (storeProduct.stockStatus === 'OUT_OF_STOCK' || (storeProduct.stockQuantity !== null && storeProduct.stockQuantity !== undefined && storeProduct.stockQuantity <= 0)) {
        unavailableItems.push({ plu: item.plu, name: item.name, reason: 'Out of stock in this store' });
        continue;
      }

      const oldPriceMajor = moneyToMajor(item.price);
      const newPriceMajor = storeProduct.price != null ? moneyToMajor(storeProduct.price) : oldPriceMajor;
      const priceChanged = Math.abs(newPriceMajor - oldPriceMajor) > 0.001;
      const newPriceMoney = storeProduct.price != null
        ? (typeof storeProduct.price === 'number' ? moneyFromMajor(storeProduct.price, currentBasket.currency) : storeProduct.price)
        : (typeof item.price === 'number' ? moneyFromMajor(item.price, currentBasket.currency) : item.price);

      // Check stock limits in target store
      let targetQty = item.quantity;
      let qtyAdjusted = false;
      if (storeProduct.stockQuantity != null && targetQty > storeProduct.stockQuantity) {
        quantityAdjusted.push({
          plu: item.plu,
          name: item.name,
          requested: targetQty,
          adjustedTo: storeProduct.stockQuantity,
          reason: `Reduced to store stock limit of ${storeProduct.stockQuantity}`,
        });
        targetQty = storeProduct.stockQuantity;
        qtyAdjusted = true;
      }

      if (priceChanged) {
        priceChanges.push({ plu: item.plu, name: item.name, oldPrice: oldPriceMajor, newPrice: newPriceMajor });
      } else if (!qtyAdjusted) {
        availableUnchanged.push({
          plu: item.plu,
          name: item.name,
          quantity: targetQty,
          price: newPriceMajor,
        });
      }

      if (targetQty > 0) {
        reconciledItems.push({
          ...item,
          price: newPriceMoney,
          unitPrice: newPriceMoney,
          totalPrice: { amount: newPriceMoney.amount * targetQty, currency: newPriceMoney.currency },
          quantity: targetQty,
        });
      }
    }

    const updatedBasket: Basket = {
      ...currentBasket,
      storeId: targetStore.id,
      storeName: targetStore.name,
      items: reconciledItems,
      updatedAt: new Date().toISOString(),
    };

    this.recalculateBasketTotals(updatedBasket);
    activeBaskets.set(updatedBasket.id, updatedBasket);

    return {
      store: targetStore,
      basket: updatedBasket,
      storeSwitchDiff: {
        availableUnchanged,
        priceChanges,
        unavailableItems,
        quantityAdjusted,
      },
    };
  }

  async reconcileBasket(
    basketId: string,
    destinationStoreId?: string
  ): Promise<{
    reconciled: boolean;
    basket: Basket;
    changes: Array<{
      plu: string;
      name: string;
      type: 'PRICE_CHANGED' | 'OUT_OF_STOCK' | 'ITEM_REMOVED' | 'QUANTITY_ADJUSTED';
      oldPrice?: Money;
      newPrice?: Money;
      oldQuantity?: number;
      newQuantity?: number;
      message: string;
    }>;
  }> {
    await this.simulateLatency(120);
    const basket = activeBaskets.get(basketId);
    if (!basket) throw new Error('Basket not found');

    const targetStoreId = destinationStoreId || basket.storeId;
    const targetStore = MOCK_STORES.find((s) => s.id === targetStoreId);
    if (!targetStore) throw new Error(`Target store ${targetStoreId} not found`);

    const changes: Array<{
      plu: string;
      name: string;
      type: 'PRICE_CHANGED' | 'OUT_OF_STOCK' | 'ITEM_REMOVED' | 'QUANTITY_ADJUSTED';
      oldPrice?: Money;
      newPrice?: Money;
      oldQuantity?: number;
      newQuantity?: number;
      message: string;
    }> = [];

    const reconciledItems: BasketItem[] = [];

    for (const item of basket.items) {
      const rawProduct = this.currentProducts.find((p) => p.plu === item.plu);
      if (!rawProduct || rawProduct.active === false) {
        changes.push({
          plu: item.plu,
          name: item.name,
          type: 'ITEM_REMOVED',
          oldQuantity: item.quantity,
          newQuantity: 0,
          message: `${item.name} is no longer carried by this store.`,
        });
        continue;
      }

      const storeProduct = this.applyStoreSpecifics(rawProduct, targetStoreId);
      if (storeProduct.stockStatus === 'OUT_OF_STOCK' || storeProduct.stockQuantity === 0) {
        changes.push({
          plu: item.plu,
          name: item.name,
          type: 'OUT_OF_STOCK',
          oldQuantity: item.quantity,
          newQuantity: 0,
          message: `${item.name} is currently out of stock.`,
        });
        continue;
      }

      let effectiveQty = item.quantity;
      if (storeProduct.stockQuantity != null && effectiveQty > storeProduct.stockQuantity) {
        changes.push({
          plu: item.plu,
          name: item.name,
          type: 'QUANTITY_ADJUSTED',
          oldQuantity: item.quantity,
          newQuantity: storeProduct.stockQuantity,
          message: `${item.name} quantity adjusted to available stock (${storeProduct.stockQuantity}).`,
        });
        effectiveQty = storeProduct.stockQuantity;
      }

      const currentPriceMoney: Money = typeof item.price === 'object' && item.price !== null && 'amount' in item.price
        ? item.price
        : moneyFromMajor(Number(item.price) || 0, basket.currency);

      const storePriceMoney: Money = typeof storeProduct.price === 'object' && storeProduct.price !== null && 'amount' in storeProduct.price
        ? storeProduct.price
        : moneyFromMajor(Number(storeProduct.price) || 0, basket.currency);

      if (currentPriceMoney.amount !== storePriceMoney.amount) {
        changes.push({
          plu: item.plu,
          name: item.name,
          type: 'PRICE_CHANGED',
          oldPrice: currentPriceMoney,
          newPrice: storePriceMoney,
          message: `${item.name} price changed from £${(currentPriceMoney.amount / 100).toFixed(2)} to £${(storePriceMoney.amount / 100).toFixed(2)}.`,
        });
      }

      if (effectiveQty > 0) {
        reconciledItems.push({
          ...item,
          price: storePriceMoney,
          unitPrice: storePriceMoney,
          totalPrice: { amount: storePriceMoney.amount * effectiveQty, currency: storePriceMoney.currency },
          quantity: effectiveQty,
        });
      }
    }

    basket.items = reconciledItems;
    if (destinationStoreId) {
      basket.storeId = targetStore.id;
      basket.storeName = targetStore.name;
    }
    basket.updatedAt = new Date().toISOString();
    this.recalculateBasketTotals(basket);
    activeBaskets.set(basket.id, basket);

    return {
      reconciled: true,
      basket: { ...basket },
      changes,
    };
  }

  async validateBasket(basketId: string): Promise<{ valid: boolean; issues: string[] }> {
    await this.simulateLatency(150);
    const basket = activeBaskets.get(basketId);
    if (!basket) return { valid: false, issues: ['Basket not found'] };

    const issues: string[] = [];
    const store = MOCK_STORES.find((s) => s.id === basket.storeId);

    if (!store) {
      issues.push('Selected store is no longer accessible');
    } else {
      if (store.status === 'closed') {
        issues.push(`Store is currently closed (${store.deliveryEta || 'Reopens tomorrow'})`);
      }
      if (basket.fulfillmentType === 'delivery' && !store.supportsDelivery) {
        issues.push('Delivery is temporarily unavailable for this store. Please switch to collection.');
      }
      if (store.minOrderAmount) {
        const minOrderMajor = moneyToMajor(store.minOrderAmount);
        const subtotalMajor = moneyToMajor(basket.subtotal);
        if (subtotalMajor < minOrderMajor) {
          issues.push(`Minimum basket subtotal for delivery is £${minOrderMajor.toFixed(2)}`);
        }
      }
    }

    if (basket.items.length === 0) {
      issues.push('Your basket is empty');
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  async getCheckoutSummary(basketId: string): Promise<CheckoutSummary> {
    await this.simulateLatency(200);
    const basket = activeBaskets.get(basketId) || (await this.createBasket(MOCK_STORES[0].id));
    const store = MOCK_STORES.find((s) => s.id === basket.storeId) || MOCK_STORES[0];

    const validation = await this.validateBasket(basket.id);

    return {
      basket,
      store,
      deliveryAddress: MOCK_SAVED_ADDRESSES[0],
      estimatedDeliveryWindow: store.deliveryEta || '20–35 minutes',
      paymentMethods: ['Apple Pay', 'Google Pay', 'Credit / Debit Card', 'Deliverect Pay'],
      canProceed: validation.valid,
      warnings: validation.issues,
    };
  }

  async revalidateDelivery(
    basketId: string,
    storeIdOrAddress: string | Address,
    address?: Address
  ): Promise<{
    available: boolean;
    dispatchValidationExpiresAt: string;
    deliveryFee: number;
    deliveryEta: string;
    reason?: string;
    alternativeStores?: Store[];
    collectionEligible?: boolean;
  }> {
    await this.simulateLatency(350);

    const basket = activeBaskets.get(basketId);
    if (!basket) {
      return {
        available: false,
        reason: 'Basket not found',
        dispatchValidationExpiresAt: new Date().toISOString(),
        deliveryFee: 0,
        deliveryEta: 'N/A',
      };
    }

    const store = MOCK_STORES.find((s) => s.id === basket.storeId) || MOCK_STORES[0];

    if (this.simulationFlags.simulateDispatchUnavailable) {
      const altStores = MOCK_STORES.filter(
        (s) => s.id !== basket.storeId && s.status === 'open' && s.supportsDelivery
      );
      return {
        available: false,
        reason: 'No couriers currently available for this delivery address and store.',
        dispatchValidationExpiresAt: new Date().toISOString(),
        deliveryFee: 0,
        deliveryEta: 'N/A',
        alternativeStores: altStores,
        collectionEligible: true,
      };
    }

    if (store.status === 'closed') {
      return {
        available: false,
        reason: `Store is currently closed (${store.deliveryEta || 'Reopens soon'})`,
        dispatchValidationExpiresAt: new Date().toISOString(),
        deliveryFee: 0,
        deliveryEta: 'N/A',
        collectionEligible: false,
      };
    }

    // Refresh expiration to 3 minutes in future
    const newExpiresAt = new Date(Date.now() + 180000).toISOString();
    basket.dispatchValidationExpiresAt = newExpiresAt;

    // Refresh basket totals
    this.recalculateBasketTotals(basket);

    const deliveryCharge = basket.charges.find((c) => c.type === 'deliveryFee');
    const feeMajor = deliveryCharge
      ? moneyToMajor(deliveryCharge.amount)
      : store.deliveryPrice != null
      ? moneyToMajor(store.deliveryPrice)
      : 1.99;

    return {
      available: true,
      dispatchValidationExpiresAt: newExpiresAt,
      deliveryFee: feeMajor,
      deliveryEta: store.deliveryEta || '25–35 min',
      collectionEligible: store.collectionAvailable,
    };
  }

  async switchBasketFulfillment(
    basketId: string,
    fulfillmentType: 'delivery' | 'pickup'
  ): Promise<Basket> {
    await this.simulateLatency(120);
    const basket = activeBaskets.get(basketId);
    if (!basket) throw new Error('Basket not found');
    basket.fulfillmentType = fulfillmentType;
    this.recalculateBasketTotals(basket);
    return JSON.parse(JSON.stringify(basket));
  }

  async applyTip(basketId: string, tipAmount: number): Promise<Basket> {
    await this.simulateLatency(150);
    const basket = activeBaskets.get(basketId);
    if (!basket) throw new Error('Basket not found');

    basket.tip = moneyFromMajor(Math.max(0, Number(tipAmount.toFixed(2))), basket.currency);
    this.recalculateBasketTotals(basket);
    return basket;
  }

  async applyPromoCode(basketId: string, code: string): Promise<Basket> {
    await this.simulateLatency(250);
    const basket = activeBaskets.get(basketId);
    if (!basket) throw new Error('Basket not found');

    const cleanCode = code.trim().toUpperCase();
    if (cleanCode === 'SAVE5') {
      basket.discounts = [
        {
          id: 'dsc_save5',
          title: '£5.00 Off Order Discount',
          amount: moneyFromMajor(5.0, basket.currency),
          code: 'SAVE5',
        },
      ];
    } else if (cleanCode === 'FREEDELIV') {
      basket.discounts = [
        {
          id: 'dsc_freedeliv',
          title: 'Free Delivery Promotion',
          amount: moneyFromMajor(1.99, basket.currency),
          code: 'FREEDELIV',
        },
      ];
    } else {
      throw new Error(`Promo code "${code}" is invalid or has expired`);
    }

    this.recalculateBasketTotals(basket);
    return basket;
  }

  async createPaymentSession(
    requestOrBasketId:
      | string
      | {
          basketId: string;
          paymentMethod?: string;
          returnUrl?: string;
          tipAmount?: number;
        },
    returnUrlArg?: string
  ): Promise<HostedPaymentSession> {
    await this.simulateLatency(350);
    const basketId =
      typeof requestOrBasketId === 'string'
        ? requestOrBasketId
        : requestOrBasketId.basketId;
    const returnUrl =
      typeof requestOrBasketId === 'string'
        ? returnUrlArg
        : requestOrBasketId.returnUrl || returnUrlArg;

    const basket = activeBaskets.get(basketId);
    if (!basket) throw new Error('Basket not found');

    const sessionId = `hps_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const expiresAt = new Date(Date.now() + 600000).toISOString(); // 10 minutes

    this.paymentSessions.set(sessionId, {
      sessionId,
      basketId,
      status: 'preparing_payment',
      expiresAt,
      pollCount: 0,
    });

    const effectiveReturnUrl =
      returnUrl || (typeof window !== 'undefined' ? window.location.href : 'https://example.com/checkout');
    const redirectUrl = `https://pay.deliverect.com/hosted/checkout/${sessionId}?returnUrl=${encodeURIComponent(
      effectiveReturnUrl
    )}`;

    return {
      sessionId,
      redirectUrl,
      expiresAt,
      amount: basket.total,
      currency: basket.currency,
      provider: 'DELIVERECT_PAY',
    };
  }

  async getCheckoutStatus(
    sessionId: string
  ): Promise<{
    status: CheckoutStatus;
    orderId?: string;
    failureReason?: string;
    details?: string;
  }> {
    await this.simulateLatency(200);

    const session = this.paymentSessions.get(sessionId);
    if (!session) {
      return { status: 'order_failed', failureReason: 'Payment session not found or timed out' };
    }

    if (this.simulationFlags.simulatePaymentFailure) {
      session.status = 'order_failed';
      session.failureReason = 'Payment Declined: transaction was rejected by issuing bank (3D Secure Failed)';
      return {
        status: 'order_failed',
        failureReason: session.failureReason,
        details: 'The payment attempt was rejected. Your card has not been charged.',
      };
    }

    // Progression:
    // 0: preparing_payment
    // 1: payment_authorised
    // 2: placing_order
    // 3+: order_confirmed
    session.pollCount += 1;

    if (session.pollCount === 1) {
      session.status = 'preparing_payment';
      return { status: 'preparing_payment', details: 'Communicating with payment gateway...' };
    } else if (session.pollCount === 2) {
      session.status = 'payment_authorised';
      return { status: 'payment_authorised', details: 'Payment authorised. Securing store dispatch...' };
    } else if (session.pollCount === 3) {
      session.status = 'placing_order';

      // Create confirmed order
      const basket = activeBaskets.get(session.basketId);
      const store = MOCK_STORES.find((s) => s.id === basket?.storeId) || MOCK_STORES[0];
      const orderId = `ord_${Date.now()}`;
      const orderRef = `ORD-${Math.floor(100000 + Math.random() * 900000)}`;

      const defaultAddress = MOCK_SAVED_ADDRESSES[0];
      const itemsList = basket?.items ? JSON.parse(JSON.stringify(basket.items)) : [];
      const subtotal = basket?.subtotal ?? toMoney(0, 'GBP');
      const total = basket?.total ?? toMoney(0, 'GBP');
      const now = new Date().toISOString();

      const newOrder: Order = {
        id: orderId,
        displayId: `#${orderRef}`,
        orderReference: orderRef,
        tenantId: this.currentTenantId,
        storeId: store.id,
        storeName: store.name,
        status: 'orderAccepted',
        statusHistory: [{ status: 'orderAccepted', timestamp: now }],
        fulfillment: {
          type: basket?.fulfillmentType || 'delivery',
          address: defaultAddress,
          schedulingMode: 'RESERVE_AT_ORDER',
        },
        scheduledTime: {
          type: 'ASAP',
          asapEtaMinutes: 25,
          requestedAt: now,
        },
        originalBasket: basket ? JSON.parse(JSON.stringify(basket)) : ({} as any),
        currentOrder: {
          subtotal,
          charges: basket?.charges || [],
          discounts: basket?.discounts || [],
          depositTotal: basket?.depositTotal || toMoney(0, basket?.currency ?? 'GBP'),
          bagFee: toMoney(30, basket?.currency ?? 'GBP'),
          serviceCharge: toMoney(0, basket?.currency ?? 'GBP'),
          deliveryCharge: toMoney(249, basket?.currency ?? 'GBP'),
          tip: basket?.tip || toMoney(0, basket?.currency ?? 'GBP'),
          total,
          itemCount: itemsList.length,
        },
        payment: {
          paymentId: `pay_${orderRef}`,
          paymentTokenReference: `tok_${orderRef}`,
          state: 'AUTHORIZED',
          currency: basket?.currency ?? 'GBP',
          authorizedAmount: total,
          authorizationMaximum: moneyFromMajor(Number((moneyToMajor(total) * 1.1).toFixed(2)), basket?.currency ?? 'GBP'),
          finalAmount: total,
          capturedAmount: toMoney(0, basket?.currency ?? 'GBP'),
          method: 'Deliverect Pay',
          history: [{ state: 'AUTHORIZED', timestamp: now, amount: total }],
        },
        paymentSummary: {
          method: 'Deliverect Pay',
          totalPaid: moneyToMajor(total),
          transactionRef: `txn_dp_${orderRef}`,
          currency: basket?.currency ?? 'GBP',
        },
        picking: {
          status: 'IN_PROGRESS',
          totalItems: itemsList.length,
          itemsPicked: 0,
          hasChanges: false,
          items: itemsList.map((it: any, idx: number) => ({
            id: `pick_${idx + 1}`,
            plu: it.plu,
            name: it.name,
            originalQuantity: it.quantity,
            pickedQuantity: 0,
            originalPrice: it.price,
            finalPrice: it.price,
            state: 'PENDING',
          })),
        },
        events: [
          { id: `evt_sub_${Date.now()}`, status: 'orderAccepted', title: 'Order Accepted', timestamp: now },
        ],
        createdAt: now,
        updatedAt: now,
        basket: basket ? JSON.parse(JSON.stringify(basket)) : ({} as any),
        items: itemsList,
        deliveryAddress: defaultAddress,
        courier: {
          name: 'Alex Rivera',
          phone: '07700 900456',
          vehicleType: 'E-Moped',
          eta: '20–30 min',
        },
      };

      this.orders.set(orderId, newOrder);
      session.orderId = orderId;

      return { status: 'placing_order', details: 'Routing order to store terminal...' };
    } else {
      session.status = 'order_confirmed';
      return {
        status: 'order_confirmed',
        orderId: session.orderId,
        details: 'Order confirmed and scheduled for dispatch!',
      };
    }
  }

  async getOrder(orderId: string): Promise<Order | null> {
    await this.simulateLatency(150);
    return this.orders.get(orderId) || null;
  }

  async getUserOrders(): Promise<Order[]> {
    await this.simulateLatency(200);
    return Array.from(this.orders.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async advanceOrderStatus(orderId: string, status?: OrderTrackingStatus): Promise<Order> {
    await this.simulateLatency(150);
    const order = this.orders.get(orderId);
    if (!order) throw new Error('Order not found');

    const sequence: OrderTrackingStatus[] = [
      'orderAccepted',
      'preparing',
      'readyForPickup',
      'courierAssigned',
      'courierAtStore',
      'outForDelivery',
      'delivered',
    ];

    let nextStatus: OrderTrackingStatus;
    if (status) {
      nextStatus = status;
    } else {
      const currentIndex = sequence.indexOf(order.status as OrderTrackingStatus);
      nextStatus = sequence[Math.min(sequence.length - 1, currentIndex + 1)];
    }

    order.status = nextStatus;
    if (!order.statusHistory) {
      order.statusHistory = [];
    }
    order.statusHistory.push({
      status: nextStatus,
      timestamp: new Date().toISOString(),
    });

    if (nextStatus === 'outForDelivery' && order.courier) {
      order.courier.eta = '8–12 min';
      order.courier.currentCoordinates = { latitude: 51.736, longitude: 0.473 };
    } else if (nextStatus === 'delivered' && order.courier) {
      order.courier.eta = 'Delivered';
    }

    return order;
  }

  // ========================================================
  // GROCERY POST-CHECKOUT & SCHEDULING IMPLEMENTATION
  // ========================================================

  async getDeliveryOptions(
    basketId: string,
    address: Address,
    fulfillmentType: 'delivery' | 'pickup' = 'delivery'
  ): Promise<DeliveryOption[]> {
    await this.simulateLatency(120);
    const basket = activeBaskets.get(basketId);
    const store = MOCK_STORES.find((s) => s.id === basket?.storeId) || MOCK_STORES[0];

    if (fulfillmentType === 'pickup') {
      return [
        {
          id: 'opt-pickup-standard',
          providerName: store.name,
          displayName: 'In-Store Express Collection',
          price: moneyFromMajor(0),
          pickupEta: 'Ready in 15 mins',
          recommended: true,
          recommendationReason: 'FREE',
        },
      ];
    }

    // If store is Moulsham or single-option simulation, return 1 option
    if (store.id === 'store-moulsham-st') {
      return [
        {
          id: 'opt-standard-local',
          providerId: 'prov-local',
          providerName: 'Store Local Courier',
          displayName: 'Local Store Courier',
          price: moneyFromMajor(2.49),
          deliveryEta: '20–30 min',
          recommended: true,
        },
      ];
    }

    // Multi-courier delivery options (e.g. Uber Direct, JET Go, Standard)
    return [
      {
        id: 'opt-uber-direct',
        providerId: 'prov-uber',
        providerName: 'Uber Direct',
        displayName: 'Uber Direct Priority',
        price: moneyFromMajor(3.49),
        deliveryEta: '15–25 min',
        validationId: 'val_ub_9921',
        expiresAt: new Date(Date.now() + 900000).toISOString(),
        recommended: true,
        recommendationReason: 'FASTEST',
      },
      {
        id: 'opt-jet-go',
        providerId: 'prov-jet',
        providerName: 'JET Go Delivery',
        displayName: 'JET Go Eco-Courier',
        price: moneyFromMajor(2.49),
        deliveryEta: '25–35 min',
        validationId: 'val_jet_8812',
        expiresAt: new Date(Date.now() + 900000).toISOString(),
        recommended: false,
        recommendationReason: 'BEST VALUE',
      },
      {
        id: 'opt-standard-courier',
        providerId: 'prov-standard',
        providerName: 'Standard Courier',
        displayName: 'Standard Scheduled Courier',
        price: moneyFromMajor(1.99),
        deliveryEta: '35–50 min',
        validationId: 'val_std_7714',
        expiresAt: new Date(Date.now() + 900000).toISOString(),
      },
    ];
  }

  async getAvailableSlots(
    storeId: string,
    fulfillmentType: 'delivery' | 'pickup' = 'delivery'
  ): Promise<{
    asapAvailable: boolean;
    asapEtaMinutes?: number;
    days: Array<{ dayLabel: string; dateString: string; slots: DeliverySlot[] }>;
    nextAvailableSlot?: DeliverySlot;
  }> {
    await this.simulateLatency(120);
    const store = MOCK_STORES.find((s) => s.id === storeId) || MOCK_STORES[0];
    const policy = await this.getSchedulingPolicy(this.currentTenantId, storeId);
    return generateAvailableSlots(store, policy, new Date(), fulfillmentType);
  }

  async getSchedulingPolicy(tenantId?: string, storeId?: string): Promise<SchedulingPolicy> {
    return defaultAdminClient.getSchedulingConfig(tenantId || this.currentTenantId, { storeId });
  }

  async getSubstitutionPolicy(tenantId?: string): Promise<TenantSubstitutionPolicy> {
    return defaultAdminClient.getSubstitutionConfig(tenantId || this.currentTenantId);
  }

  async setBasketItemSubstitution(
    basketId: string,
    plu: string,
    preference: SubstitutionPreferenceType,
    candidatePlus?: string[],
    preferredSubstitutePlu?: string,
    preferredSubstituteName?: string,
    preferredSubstitutePrice?: Money | number
  ): Promise<Basket> {
    await this.simulateLatency(80);
    const basket = activeBaskets.get(basketId);
    if (!basket) throw new Error('Basket not found');

    const item = basket.items.find((i) => i.plu === plu);
    if (item) {
      item.substitutionPreference = preference;
      item.substituteCandidatePlus = candidatePlus;
      if (preferredSubstitutePlu !== undefined) {
        item.preferredSubstitutePlu = preferredSubstitutePlu;
      }
      if (preferredSubstituteName !== undefined) {
        item.preferredSubstituteName = preferredSubstituteName;
      }
      if (preferredSubstitutePrice !== undefined) {
        item.preferredSubstitutePrice = typeof preferredSubstitutePrice === 'number'
          ? moneyFromMajor(preferredSubstitutePrice, basket.currency)
          : preferredSubstitutePrice;
      }
    }

    basket.updatedAt = new Date().toISOString();
    return JSON.parse(JSON.stringify(basket));
  }

  async tokenizePayment(cardDetails?: {
    cardNumberMasked?: string;
    expiry?: string;
    brand?: string;
    type?: string;
    cardholderName?: string;
    last4?: string;
    [key: string]: any;
  }): Promise<{ token: string; reference: string }> {
    await this.simulateLatency(150);
    const reference = `ref_dp_${Math.floor(100000 + Math.random() * 900000)}`;
    const token = `tok_live_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    return { token, reference };
  }

  async getOrderHistory(): Promise<Order[]> {
    return this.getUserOrders();
  }

  async authorizePayment(
    orderId: string,
    amount: number | Money,
    authorizationMaximum: number | Money,
    tokenRef: string
  ): Promise<OrderPaymentInfo> {
    await this.simulateLatency(150);
    const order = this.orders.get(orderId);
    if (!order) throw new Error('Order not found');

    const currency = order.originalBasket.currency || 'GBP';
    const amountMoney = typeof amount === 'number' ? moneyFromMajor(amount, currency) : amount;
    const maxMoney = typeof authorizationMaximum === 'number' ? moneyFromMajor(authorizationMaximum, currency) : authorizationMaximum;

    const paymentInfo: OrderPaymentInfo = {
      paymentId: `pay_${Date.now()}`,
      paymentTokenReference: tokenRef,
      state: 'AUTHORIZED',
      currency,
      authorizedAmount: amountMoney,
      authorizationMaximum: maxMoney,
      finalAmount: amountMoney,
      capturedAmount: toMoney(0, currency),
      method: 'Deliverect Pay • Apple Pay / Card',
      history: [
        ...(order.payment?.history || []),
        {
          state: 'AUTHORIZED',
          timestamp: new Date().toISOString(),
          amount: maxMoney,
          note: `Authorized maximum approved by customer: ${formatMoney(maxMoney)} (Estimated basket: ${formatMoney(amountMoney)})`,
        },
      ],
    };

    order.payment = paymentInfo;
    return paymentInfo;
  }

  async updateBasketItems(
    basketId: string,
    items: Array<{
      plu: string;
      quantity: number;
      menuId?: string;
      substitutionPreference?: any;
      substituteCandidatePlus?: string[];
      preferredSubstitutePlu?: string;
      preferredSubstituteName?: string;
      preferredSubstitutePrice?: Money | number;
    }>
  ): Promise<Basket> {
    let currentBasket = activeBaskets.get(basketId);
    if (!currentBasket) throw new Error('Basket not found');

    for (const item of items) {
      currentBasket = await this.updateBasketItem(basketId, item.plu, item.quantity);
      const basketItem = currentBasket.items.find((i) => i.plu === item.plu);
      if (basketItem && item.quantity > 0) {
        if (item.substitutionPreference !== undefined) {
          basketItem.substitutionPreference =
            typeof item.substitutionPreference === 'object' && item.substitutionPreference !== null && 'type' in item.substitutionPreference
              ? item.substitutionPreference.type
              : item.substitutionPreference;
        }
        if (item.substituteCandidatePlus) {
          basketItem.substituteCandidatePlus = item.substituteCandidatePlus;
        }
        if (item.preferredSubstitutePlu) {
          basketItem.preferredSubstitutePlu = item.preferredSubstitutePlu;
        }
        if (item.preferredSubstituteName) {
          basketItem.preferredSubstituteName = item.preferredSubstituteName;
        }
        if (item.preferredSubstitutePrice) {
          basketItem.preferredSubstitutePrice =
            typeof item.preferredSubstitutePrice === 'object' && item.preferredSubstitutePrice !== null && 'amount' in item.preferredSubstitutePrice
              ? item.preferredSubstitutePrice
              : moneyFromMajor(Number(item.preferredSubstitutePrice) || 0, currentBasket.currency);
        }
      }
    }
    activeBaskets.set(currentBasket.id, currentBasket);
    return currentBasket;
  }

  async updateBasketCustomer(
    basketId: string,
    customer: { name?: string; email?: string; phone?: string; notes?: string }
  ): Promise<Basket> {
    const basket = activeBaskets.get(basketId);
    if (!basket) throw new Error('Basket not found');
    if (customer.name || customer.email || customer.phone) {
      basket.customer = {
        name: customer.name || basket.customer?.name,
        email: customer.email || basket.customer?.email,
        phone: customer.phone || basket.customer?.phone,
      };
    }
    return { ...basket };
  }

  async updateBasketFulfillment(
    basketId: string,
    fulfillment: { fulfillmentType?: 'delivery' | 'pickup'; type?: 'delivery' | 'pickup'; address?: Address; slot?: DeliverySlot; slotId?: string }
  ): Promise<Basket> {
    const basket = activeBaskets.get(basketId);
    if (!basket) throw new Error('Basket not found');
    const fType = fulfillment.fulfillmentType || fulfillment.type;
    if (fType) {
      basket.fulfillmentType = fType;
    }
    if (fulfillment.address) {
      basket.deliveryAddress = fulfillment.address;
    }
    if (fulfillment.slot) {
      basket.fulfillmentSlot = fulfillment.slot;
    }
    this.recalculateBasketTotals(basket);
    return { ...basket };
  }

  async updateBasketStore(
    basketId: string,
    storeId: string,
    _options?: { confirmMigration?: boolean }
  ): Promise<{ basket: Basket; storeSwitchDiff: any }> {
    const res = await this.selectStore(storeId, basketId);
    return {
      basket: res.basket || activeBaskets.get(basketId)!,
      storeSwitchDiff: res.storeSwitchDiff,
    };
  }

  async updateBasketCharges(
    basketId: string,
    charges?: any[]
  ): Promise<Basket> {
    const basket = activeBaskets.get(basketId);
    if (!basket) throw new Error('Basket not found');
    if (charges) {
      basket.charges = charges;
      this.recalculateBasketTotals(basket);
    }
    return { ...basket };
  }

  async updateBasketTip(
    basketId: string,
    tipAmount: number | Money
  ): Promise<Basket> {
    const tipMoney = typeof tipAmount === 'object' && 'amount' in tipAmount
      ? tipAmount
      : toMoney(tipAmount, 'GBP');
    const basket = activeBaskets.get(basketId);
    if (!basket) throw new Error('Basket not found');
    basket.tip = tipMoney;
    this.recalculateBasketTotals(basket);
    return { ...basket };
  }

  async applyBasketDiscounts(
    basketId: string,
    code: string
  ): Promise<Basket> {
    return this.applyPromoCode(basketId, code);
  }

  async requestPayment(
    basketId: string,
    options: {
      paymentMethod?: string;
      returnUrl?: string;
      tokenRef?: string;
      authorizationMaximum?: Money | number;
    }
  ): Promise<{
    paymentId: string;
    status: 'AUTHORIZED' | 'PENDING' | 'ACTION_REQUIRED';
    redirectUrl?: string;
  }> {
    const basket = activeBaskets.get(basketId);
    if (!basket) throw new Error('Basket not found');
    if (options.tokenRef) {
      return {
        paymentId: `pay_${Date.now()}`,
        status: 'AUTHORIZED',
      };
    }
    const session = await this.createPaymentSession({
      basketId,
      paymentMethod: options.paymentMethod,
      returnUrl: options.returnUrl,
    });
    return {
      paymentId: session.sessionId,
      status: 'PENDING',
      redirectUrl: session.redirectUrl,
    };
  }

  async getCheckout(checkoutId: string): Promise<Order> {
    return this.getOrder(checkoutId);
  }

  async getOrderState(orderId: string): Promise<Order> {
    return this.getOrder(orderId);
  }

  async checkoutBasket(
    basketId: string,
    options: {
      deliveryOptionId?: string;
      slotId?: string;
      schedulingType?: FulfillmentSchedulingType;
      paymentTokenRef?: string;
      authorizationMaximum?: Money | number;
      customerNotes?: string;
      deliveryAddress?: Address;
      dispatchValidationId?: string;
      dispatchValidationExpiresAt?: string;
    } = {}
  ): Promise<Order> {
    await this.simulateLatency(200);
    const basket = activeBaskets.get(basketId);
    if (!basket || basket.items.length === 0) {
      throw new Error('Cannot checkout with an empty basket');
    }

    const store = MOCK_STORES.find((s) => s.id === basket.storeId) || MOCK_STORES[0];
    const orderId = `ord_${Date.now()}`;
    const orderRef = `ORD-${Math.floor(100000 + Math.random() * 900000)}`;
    const now = new Date().toISOString();

    const deliveryAddress = options.deliveryAddress || MOCK_SAVED_ADDRESSES[0];
    const deliveryOptions = await this.getDeliveryOptions(basketId, deliveryAddress, basket.fulfillmentType);
    const chosenDeliveryOption =
      deliveryOptions.find((d) => d.id === options.deliveryOptionId) || deliveryOptions[0];

    const substitutionPolicy = await this.getSubstitutionPolicy(this.currentTenantId);
    const policyBufferRate = substitutionPolicy?.defaultBufferPercentage ?? 0;
    const { extraBufferAmount } = calculatePreChosenAlternativeExtraBuffer(basket.items, basket.currency);
    const { authorizationMaximum } = calculateAuthorizationMaximum(
      basket.total,
      true,
      policyBufferRate,
      basket.currency,
      extraBufferAmount
    );
    const customerApprovedMax: Money =
      options.authorizationMaximum && typeof options.authorizationMaximum === 'object' && 'amount' in options.authorizationMaximum
        ? options.authorizationMaximum
        : typeof options.authorizationMaximum === 'number'
        ? moneyFromMajor(options.authorizationMaximum, basket.currency)
        : authorizationMaximum;

    const toMoneyVal = (p: Money | number | undefined): Money => {
      if (typeof p === 'number') return moneyFromMajor(p, basket.currency);
      if (typeof p === 'object' && p !== null && 'amount' in p) return p;
      return toMoney(0, basket.currency);
    };

    // Convert basket items to Quest picking items
    const pickingItems: PickingItem[] = basket.items.map((bItem, idx) => ({
      id: `pick_item_${idx + 1}`,
      plu: bItem.plu,
      name: bItem.name,
      imageUrl: bItem.imageUrl,
      originalQuantity: bItem.quantity,
      pickedQuantity: 0,
      originalPrice: toMoneyVal(bItem.unitPrice || bItem.price),
      finalPrice: toMoneyVal(bItem.unitPrice || bItem.price),
      state: 'PENDING',
      substitutionPreference: bItem.substitutionPreference || 'BEST_MATCH',
      preferredSubstitutePlu: bItem.preferredSubstitutePlu,
    }));

    const paymentInfo: OrderPaymentInfo = {
      paymentId: `pay_${orderRef}`,
      paymentTokenReference: options.paymentTokenRef || `tok_live_${Date.now()}`,
      state: 'AUTHORIZED',
      currency: basket.currency,
      authorizedAmount: basket.total,
      authorizationMaximum: customerApprovedMax,
      finalAmount: basket.total,
      capturedAmount: toMoney(0, basket.currency),
      method: 'Deliverect Pay • Tokenized',
      history: [
        {
          state: 'AUTHORIZED',
          timestamp: now,
          amount: customerApprovedMax,
          note: `Payment token authorized for maximum ${formatMoney(customerApprovedMax)} (Estimated total: ${formatMoney(basket.total)})`,
        },
      ],
    };

    const bagFeeCharge = basket.charges.find((c) => c.type === 'bagFee')?.amount;
    const serviceFeeCharge = basket.charges.find((c) => c.type === 'serviceCharge')?.amount;

    const initialSnapshot: OrderSnapshot = {
      subtotal: basket.subtotal,
      charges: basket.charges.map((c) => ({ id: c.id, title: c.title, amount: c.amount, type: c.type })),
      discounts: basket.discounts.map((d) => ({ id: d.id, code: d.code, title: d.title, amount: d.amount })),
      depositTotal: basket.depositTotal || toMoney(0, basket.currency),
      bagFee: bagFeeCharge ? toMoneyVal(bagFeeCharge) : toMoney(0, basket.currency),
      serviceCharge: serviceFeeCharge ? toMoneyVal(serviceFeeCharge) : toMoney(0, basket.currency),
      deliveryCharge: chosenDeliveryOption.price,
      tip: toMoneyVal(basket.tip),
      total: basket.total,
      itemCount: basket.items.reduce((s, i) => s + i.quantity, 0),
    };

    const isScheduled = options.schedulingType === 'SCHEDULED' || Boolean(options.slotId);

    const newOrder: Order = {
      id: orderId,
      displayId: `#${orderRef}`,
      orderReference: orderRef,
      tenantId: this.currentTenantId,
      storeId: store.id,
      storeName: store.name,
      status: 'ACCEPTED',
      fulfillment: {
        type: basket.fulfillmentType,
        address: deliveryAddress,
        deliveryOption: chosenDeliveryOption,
        schedulingMode: isScheduled ? 'ASSIGN_NEAR_FULFILMENT' : 'RESERVE_AT_ORDER',
      },
      scheduledTime: {
        type: isScheduled ? 'SCHEDULED' : 'ASAP',
        asapEtaMinutes: isScheduled ? undefined : 25,
        requestedAt: now,
      },
      originalBasket: JSON.parse(JSON.stringify(basket)),
      currentOrder: initialSnapshot,
      payment: paymentInfo,
      picking: {
        status: 'IN_PROGRESS',
        startedAt: now,
        totalItems: pickingItems.length,
        itemsPicked: 0,
        hasChanges: false,
        items: pickingItems,
      },
      delivery: {
        deliveryOption: chosenDeliveryOption,
        dispatchSchedulingMode: isScheduled ? 'ASSIGN_NEAR_FULFILMENT' : 'RESERVE_AT_ORDER',
        isConfirmed: !isScheduled,
        provisionalNotice: isScheduled
          ? 'Courier availability will be confirmed closer to your delivery time'
          : undefined,
        courier: {
          name: 'Alex Rivera',
          phone: '07700 900456',
          vehicleType: 'E-Moped',
          eta: isScheduled ? 'Scheduled slot' : '20–30 min',
        },
      },
      events: [
        {
          id: `evt_sub_${Date.now()}`,
          status: 'SUBMITTED',
          title: 'Order Submitted',
          description: 'Payment method tokenized and authorized with Deliverect Pay.',
          timestamp: now,
        },
        {
          id: `evt_acc_${Date.now()}`,
          status: 'ACCEPTED',
          title: 'Store Accepted',
          description: `${store.name} accepted your order. Quest picking terminal engaged.`,
          timestamp: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
      basket: JSON.parse(JSON.stringify(basket)),
      items: JSON.parse(JSON.stringify(basket.items)),
      deliveryAddress,
      courier: {
        name: 'Alex Rivera',
        phone: '07700 900456',
        vehicleType: 'E-Moped',
        eta: '20–30 min',
      },
    };

    this.orders.set(orderId, newOrder);
    return newOrder;
  }

  /**
   * Submits a finalized grocery order from the basket (delegates to checkoutBasket).
   */
  async submitOrder(
    basketId: string,
    options: {
      deliveryOptionId?: string;
      slotId?: string;
      schedulingType?: FulfillmentSchedulingType;
      paymentTokenRef?: string;
      authorizationMaximum?: Money | number;
      customerNotes?: string;
      deliveryAddress?: Address;
    }
  ): Promise<Order> {
    return this.checkoutBasket(basketId, options);
  }

  async processPickingEvent(orderId: string, event: PickingEvent): Promise<Order> {
    await this.simulateLatency(100);
    const order = this.orders.get(orderId);
    if (!order) throw new Error('Order not found');

    // Duplicate detection & idempotency
    const existingEvent = order.events.find((e) => e.id === event.id);
    if (existingEvent) {
      return order;
    }

    const pickingState = order.picking;
    const substitutionPolicy = await this.getSubstitutionPolicy(order.tenantId);

    switch (event.type) {
      case 'ORDER_ACCEPTED':
        order.status = 'ACCEPTED';
        break;

      case 'PICKING_STARTED':
        order.status = 'PICKING';
        pickingState.status = 'IN_PROGRESS';
        pickingState.startedAt = event.timestamp;
        break;

      case 'ITEM_PICKED': {
        const item = pickingState.items.find((i) => i.plu === event.payload.plu);
        if (item) {
          item.state = 'PICKED';
          item.pickedQuantity = item.originalQuantity;
          item.finalPrice = item.originalPrice;
        }
        pickingState.itemsPicked = pickingState.items.filter((i) => i.state !== 'PENDING').length;
        break;
      }

      case 'QUANTITY_REDUCED': {
        const item = pickingState.items.find((i) => i.plu === event.payload.plu);
        if (item) {
          item.state = 'QUANTITY_AMENDED';
          item.pickedQuantity = event.payload.suppliedQuantity;
          const origMajor = moneyToMajor(item.originalPrice);
          const unitPrice = origMajor / item.originalQuantity;
          const itemCurr = typeof item.originalPrice === 'object' && item.originalPrice ? item.originalPrice.currency : 'GBP';
          item.finalPrice = moneyFromMajor(
            Number((unitPrice * event.payload.suppliedQuantity).toFixed(2)),
            itemCurr
          );
          item.amendment = {
            originalQuantity: item.originalQuantity,
            suppliedQuantity: event.payload.suppliedQuantity,
            reason: event.payload.reason || 'Store inventory limited',
          };
          pickingState.hasChanges = true;
        }
        pickingState.itemsPicked = pickingState.items.filter((i) => i.state !== 'PENDING').length;
        break;
      }

      case 'ITEM_REMOVED': {
        const item = pickingState.items.find((i) => i.plu === event.payload.plu);
        if (item) {
          item.state = 'REMOVED';
          item.pickedQuantity = 0;
          const curr = typeof item.originalPrice === 'object' && item.originalPrice ? item.originalPrice.currency : 'GBP';
          item.finalPrice = toMoney(0, curr);
          pickingState.hasChanges = true;
        }
        pickingState.itemsPicked = pickingState.items.filter((i) => i.state !== 'PENDING').length;
        break;
      }

      case 'BEST_MATCH_SUBSTITUTION': {
        const item = pickingState.items.find((i) => i.plu === event.payload.originalPlu);
        if (item) {
          const chargedPrice = calculateSubstitutionPrice(
            event.payload.originalPrice || item.originalPrice,
            event.payload.substitutePrice,
            substitutionPolicy.bestMatchPricePolicy
          );
          item.state = 'SUBSTITUTED';
          item.pickedQuantity = item.originalQuantity;
          item.finalPrice = chargedPrice;
          item.substitution = {
            type: 'BEST_MATCH',
            originalPlu: item.plu,
            originalName: item.name,
            originalPrice: item.originalPrice,
            substitutePlu: event.payload.substitutePlu,
            substituteName: event.payload.substituteName,
            substitutePrice: event.payload.substitutePrice,
            chargedPrice,
            reason: event.payload.reason || 'Best match substitution under price policy',
          };
          pickingState.hasChanges = true;
        }
        pickingState.itemsPicked = pickingState.items.filter((i) => i.state !== 'PENDING').length;
        break;
      }

      case 'CUSTOMER_SELECTED_SUBSTITUTION': {
        const item = pickingState.items.find((i) => i.plu === event.payload.originalPlu);
        if (item) {
          const chargedPrice = calculateSubstitutionPrice(
            event.payload.originalPrice || item.originalPrice,
            event.payload.substitutePrice,
            substitutionPolicy.customerSelectedPricePolicy
          );
          item.state = 'SUBSTITUTED';
          item.pickedQuantity = item.originalQuantity;
          item.finalPrice = chargedPrice;
          item.substitution = {
            type: 'CUSTOMER_SELECTED',
            originalPlu: item.plu,
            originalName: item.name,
            originalPrice: item.originalPrice,
            substitutePlu: event.payload.substitutePlu,
            substituteName: event.payload.substituteName,
            substitutePrice: event.payload.substitutePrice,
            chargedPrice,
            reason: event.payload.reason || 'Customer pre-selected alternative item',
          };
          pickingState.hasChanges = true;
        }
        pickingState.itemsPicked = pickingState.items.filter((i) => i.state !== 'PENDING').length;
        break;
      }

      case 'ORDER_CANCELLED_UNAVAILABLE_ITEM': {
        order.status = 'CANCELLED';
        pickingState.status = 'CANCELLED';
        const item = pickingState.items.find((i) => i.plu === event.payload.plu);
        if (item) {
          item.state = 'REMOVED';
          item.pickedQuantity = 0;
          const curr = typeof item.originalPrice === 'object' && item.originalPrice ? item.originalPrice.currency : 'GBP';
          item.finalPrice = toMoney(0, curr);
        }
        order.events.push({
          id: `evt_cancel_${Date.now()}`,
          status: 'CANCELLED',
          title: 'Order Cancelled (Unavailable Item)',
          note:
            event.payload.reason ||
            `Order cancelled per your instructions because "${item?.name || 'Item'}" is unavailable.`,
          timestamp: event.timestamp || new Date().toISOString(),
        });
        if (order.payment) {
          order.payment.state = 'RELEASED';
          order.payment.releasedAmount = order.payment.authorizedAmount;
          order.payment.history.push({
            state: 'RELEASED',
            timestamp: new Date().toISOString(),
            amount: order.payment.authorizedAmount,
            note: 'Payment pre-authorization hold released in full.',
          });
        }
        return order;
      }

      case 'PICKING_COMPLETED': {
        return this.finalizeOrderPicking(orderId);
      }
    }

    // Recalculate subtotal based on current picked/substituted/removed prices
    const currency = order.originalBasket.currency || 'GBP';
    const newSubtotalMajor = pickingState.items.reduce((sum, it) => sum + moneyToMajor(it.finalPrice), 0);
    order.currentOrder.subtotal = moneyFromMajor(Number(newSubtotalMajor.toFixed(2)), currency);
    const fixedChargesMajor = order.currentOrder.charges.reduce((s, c) => s + moneyToMajor(c.amount), 0);
    order.currentOrder.total = moneyFromMajor(Number((newSubtotalMajor + fixedChargesMajor).toFixed(2)), currency);

    if (pickingState.hasChanges) {
      order.status = 'PICKING_WITH_CHANGES';
    }

    order.events.push({
      id: event.id,
      status: order.status,
      title: event.type.replace(/_/g, ' '),
      description: `Picking update: ${pickingState.itemsPicked} of ${pickingState.totalItems} items picked`,
      timestamp: event.timestamp || new Date().toISOString(),
    });

    order.updatedAt = new Date().toISOString();
    return order;
  }

  async advancePickingDemo(orderId: string): Promise<Order> {
    const order = this.orders.get(orderId);
    if (!order) throw new Error('Order not found');

    const pendingItem = order.picking.items.find((i) => i.state === 'PENDING');
    if (!pendingItem) {
      if (order.picking.status !== 'COMPLETED') {
        return this.finalizeOrderPicking(orderId);
      }
      return order;
    }

    // Check item-level customer substitution preferences when an item cannot be fulfilled as-is
    if (pendingItem.substitutionPreference === 'CANCEL_ORDER_IF_UNAVAILABLE') {
      return this.processPickingEvent(orderId, {
        id: `evt_cancel_${Date.now()}`,
        sequence: order.events.length + 1,
        type: 'ORDER_CANCELLED_UNAVAILABLE_ITEM',
        payload: {
          plu: pendingItem.plu,
          reason: `Required item "${pendingItem.name}" is out of stock. Order cancelled per your substitution preference.`,
        },
        timestamp: new Date().toISOString(),
      });
    }

    if (
      pendingItem.substitutionPreference === 'REMOVE_IF_UNAVAILABLE' ||
      pendingItem.substitutionPreference === 'DO_NOT_SUBSTITUTE' ||
      pendingItem.plu === 'PLU-ICECREAM-VANILLA'
    ) {
      return this.processPickingEvent(orderId, {
        id: `evt_rem_${Date.now()}`,
        sequence: order.events.length + 1,
        type: 'ITEM_REMOVED',
        payload: {
          plu: pendingItem.plu,
          reason: `Item "${pendingItem.name}" is unavailable and removed with full refund.`,
        },
        timestamp: new Date().toISOString(),
      });
    }

    if (pendingItem.substitutionPreference === 'CUSTOMER_SELECTED') {
      const candidateProduct = pendingItem.preferredSubstitutePlu
        ? this.currentProducts.find((p) => p.plu === pendingItem.preferredSubstitutePlu)
        : null;
      const subPlu = candidateProduct?.plu || 'PLU-ART-001';
      const subName = candidateProduct?.name || 'Artisan Heritage Sourdough Boule 800g';
      const subPrice = candidateProduct ? moneyToMajor(candidateProduct.price) : 2.85;

      return this.processPickingEvent(orderId, {
        id: `evt_cust_sub_${Date.now()}`,
        sequence: order.events.length + 1,
        type: 'CUSTOMER_SELECTED_SUBSTITUTION',
        payload: {
          originalPlu: pendingItem.plu,
          originalPrice: pendingItem.originalPrice,
          substitutePlu: subPlu,
          substituteName: subName,
          substitutePrice: subPrice,
          reason: `Customer pre-selected alternative item: ${subName}`,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // Determine smart advancement based on item
    if (pendingItem.plu === 'PLU-PEPSI-15L') {
      // Demo: Pepsi 1.5L replaced with 2L under Lower Price Guarantee
      return this.processPickingEvent(orderId, {
        id: `evt_sub_${Date.now()}`,
        sequence: order.events.length + 1,
        type: 'BEST_MATCH_SUBSTITUTION',
        payload: {
          originalPlu: 'PLU-PEPSI-15L',
          originalPrice: 2.00,
          substitutePlu: 'PLU-PEPSI-20L',
          substituteName: 'Pepsi Max No Sugar Cola 2L Large Bottle',
          substitutePrice: 2.40,
          reason: 'Pepsi 1.5L unavailable. Upgraded to 2L with price match guarantee.',
        },
        timestamp: new Date().toISOString(),
      });
    }

    if (pendingItem.plu === 'PLU-BANANAS-6PK') {
      // Demo: Bananas quantity amended 6 -> 5
      return this.processPickingEvent(orderId, {
        id: `evt_amend_${Date.now()}`,
        sequence: order.events.length + 1,
        type: 'QUANTITY_REDUCED',
        payload: {
          plu: 'PLU-BANANAS-6PK',
          suppliedQuantity: 5,
          reason: 'Pack damaged, 5 premium bananas supplied',
        },
        timestamp: new Date().toISOString(),
      });
    }

    // Standard item picked
    return this.processPickingEvent(orderId, {
      id: `evt_pick_${Date.now()}`,
      sequence: order.events.length + 1,
      type: 'ITEM_PICKED',
      payload: { plu: pendingItem.plu },
      timestamp: new Date().toISOString(),
    });
  }

  async finalizeOrderPicking(orderId: string): Promise<Order> {
    await this.simulateLatency(150);
    const order = this.orders.get(orderId);
    if (!order) throw new Error('Order not found');

    // Mark any remaining pending items as picked
    order.picking.items.forEach((item) => {
      if (item.state === 'PENDING') {
        item.state = 'PICKED';
        item.pickedQuantity = item.originalQuantity;
        item.finalPrice = item.originalPrice;
      }
    });

    order.picking.status = 'COMPLETED';
    order.picking.completedAt = new Date().toISOString();
    order.picking.itemsPicked = order.picking.items.length;

    // Calculate final order
    const currency = order.originalBasket.currency || 'GBP';
    const finalSubtotalMajor = Number(
      order.picking.items.reduce((sum, item) => sum + moneyToMajor(item.finalPrice), 0).toFixed(2)
    );
    const fixedChargesMajor = order.currentOrder.charges.reduce((s, c) => s + moneyToMajor(c.amount), 0);
    const finalTotalMajor = Number((finalSubtotalMajor + fixedChargesMajor).toFixed(2));
    const finalSubtotal = moneyFromMajor(finalSubtotalMajor, currency);
    const finalTotal = moneyFromMajor(finalTotalMajor, currency);

    order.finalOrder = {
      ...order.currentOrder,
      subtotal: finalSubtotal,
      total: finalTotal,
    };
    order.currentOrder = order.finalOrder;

    const authorizedMax = order.payment.authorizationMaximum;
    const authorizedMaxMajor = moneyToMajor(authorizedMax);

    if (finalTotalMajor <= authorizedMaxMajor) {
      // Normal flow: captured automatically
      order.payment.finalAmount = finalTotal;
      order.payment.capturedAmount = finalTotal;
      order.payment.state = 'CAPTURED';
      order.payment.history.push({
        state: 'CAPTURED',
        timestamp: new Date().toISOString(),
        amount: finalTotal,
        note: `Final basket ${formatMoney(finalTotal)} captured successfully (within authorized limit ${formatMoney(authorizedMax)}).`,
      });

      order.status = 'READY_FOR_COURIER';
      order.events.push({
        id: `evt_fin_${Date.now()}`,
        status: 'READY_FOR_COURIER',
        title: 'Picking Complete & Payment Captured',
        description: `Final amount ${formatMoney(finalTotal)} captured against payment token.`,
        timestamp: new Date().toISOString(),
      });
    } else {
      // Reauthorization flow: final total exceeds customer authorized maximum
      order.payment.finalAmount = finalTotal;
      order.payment.state = 'PAYMENT_ACTION_REQUIRED';
      order.payment.history.push({
        state: 'PAYMENT_ACTION_REQUIRED',
        timestamp: new Date().toISOString(),
        amount: finalTotal,
        note: `Final total ${formatMoney(finalTotal)} exceeds authorized maximum ${formatMoney(authorizedMax)}. Reauthorization required.`,
      });

      order.status = 'PAYMENT_FINALISING';
      order.events.push({
        id: `evt_reauth_req_${Date.now()}`,
        status: 'PAYMENT_FINALISING',
        title: 'Payment Reauthorization Required',
        description: `Adjustments exceeded customer authorization limit by ${formatMoney(moneyFromMajor(finalTotalMajor - authorizedMaxMajor, currency))}.`,
        timestamp: new Date().toISOString(),
      });
    }

    order.updatedAt = new Date().toISOString();
    return order;
  }

  async reauthorizeOrderPayment(orderId: string, newAmount?: number | string | Money): Promise<Order> {
    await this.simulateLatency(200);
    const order = this.orders.get(orderId);
    if (!order) throw new Error('Order not found');

    const currency = order.originalBasket.currency || 'GBP';
    let approvedAmount: Money;
    if (typeof newAmount === 'object' && newAmount !== null && 'amount' in newAmount) {
      approvedAmount = newAmount;
    } else if (typeof newAmount === 'number') {
      approvedAmount = moneyFromMajor(newAmount, currency);
    } else if (typeof newAmount === 'string') {
      approvedAmount = moneyFromMajor(parseFloat(newAmount) || 0, currency);
    } else {
      approvedAmount = order.finalOrder?.total || order.currentOrder.total;
    }

    order.payment.authorizationMaximum = approvedAmount;
    order.payment.authorizedAmount = approvedAmount;
    order.payment.finalAmount = approvedAmount;
    order.payment.capturedAmount = approvedAmount;
    order.payment.state = 'CAPTURED';

    order.payment.history.push({
      state: 'REAUTHORIZING',
      timestamp: new Date().toISOString(),
      amount: approvedAmount,
      note: `Customer approved updated authorization amount ${formatMoney(approvedAmount)}.`,
    });
    order.payment.history.push({
      state: 'CAPTURED',
      timestamp: new Date().toISOString(),
      amount: approvedAmount,
      note: `Final amount ${formatMoney(approvedAmount)} captured after reauthorization.`,
    });

    order.status = 'READY_FOR_COURIER';
    order.events.push({
      id: `evt_reauth_success_${Date.now()}`,
      status: 'READY_FOR_COURIER',
      title: 'Reauthorization Approved & Captured',
      description: `Payment of ${formatMoney(approvedAmount)} confirmed. Order handed to courier dispatch.`,
      timestamp: new Date().toISOString(),
    });

    order.updatedAt = new Date().toISOString();
    return order;
  }

  async captureOrderPayment(orderId: string): Promise<Order> {
    await this.simulateLatency(150);
    const order = this.orders.get(orderId);
    if (!order) throw new Error('Order not found');

    const amount = order.finalOrder?.total || order.currentOrder.total;
    order.payment.capturedAmount = amount;
    order.payment.finalAmount = amount;
    order.payment.state = 'CAPTURED';
    order.payment.history.push({
      state: 'CAPTURED',
      timestamp: new Date().toISOString(),
      amount,
      note: `Manual capture completed for ${formatMoney(amount)}.`,
    });

    order.status = 'COURIER_ASSIGNED';
    return order;
  }

  async createDemoScenarioOrder(scenario: DemoScenario): Promise<Order> {
    await this.simulateLatency(150);
    const store = MOCK_STORES[0]; // Chelmsford High St
    const now = new Date();
    const orderRef = `ORD-${scenario}-${Math.floor(1000 + Math.random() * 9000)}`;
    const orderId = `demo-ord-${scenario.toLowerCase()}`;

    // Delivery option
    const deliveryOptions = await this.getDeliveryOptions('basket-dummy', MOCK_SAVED_ADDRESSES[0], 'delivery');
    const selectedOption = scenario === 'F' ? deliveryOptions[1] : deliveryOptions[0]; // JET Go for F, Uber Direct for others

    if (scenario === 'A') {
      // Scenario A: Perfect pick
      // All items picked, final total equals estimated, captured immediately
      const items: PickingItem[] = [
        {
          id: 'item-1',
          plu: 'PLU-MILK-4PT',
          name: 'British Whole Fresh Milk 4 Pints (2.27L)',
          originalQuantity: 1,
          pickedQuantity: 1,
          originalPrice: moneyFromMajor(1.85),
          finalPrice: moneyFromMajor(1.85),
          state: 'PICKED',
        },
        {
          id: 'item-2',
          plu: 'PLU-ART-001',
          name: 'Artisan Heritage Sourdough Boule 800g',
          originalQuantity: 1,
          pickedQuantity: 1,
          originalPrice: moneyFromMajor(2.85),
          finalPrice: moneyFromMajor(2.85),
          state: 'PICKED',
        },
        {
          id: 'item-3',
          plu: 'PLU-STRAWBERRIES-400G',
          name: 'Sweet British Strawberries Punnet 400g',
          originalQuantity: 1,
          pickedQuantity: 1,
          originalPrice: moneyFromMajor(2.50),
          finalPrice: moneyFromMajor(2.50),
          state: 'PICKED',
        },
      ];

      const deliveryFee = selectedOption.price;
      const bagFee = moneyFromMajor(0.30);
      const subtotal = moneyFromMajor(7.20);
      const total = moneyFromMajor(Number((7.20 + (deliveryFee.amount / 100) + 0.30).toFixed(2))); // total ~10.99
      const totalMajor = moneyToMajor(total);
      const authMax = moneyFromMajor(Number((totalMajor * 1.1).toFixed(2)));

      const order: Order = {
        id: orderId,
        displayId: `#${orderRef}`,
        orderReference: orderRef,
        tenantId: this.currentTenantId,
        storeId: store.id,
        storeName: store.name,
        status: 'READY_FOR_COURIER',
        fulfillment: {
          type: 'delivery',
          address: MOCK_SAVED_ADDRESSES[0],
          deliveryOption: selectedOption,
          schedulingMode: 'RESERVE_AT_ORDER',
        },
        scheduledTime: {
          type: 'ASAP',
          asapEtaMinutes: 20,
          requestedAt: now.toISOString(),
        },
        originalBasket: {
          id: `bkt_${orderRef}`,
          storeId: store.id,
          storeName: store.name,
          fulfillmentType: 'delivery',
          items: items.map((it) => ({
            id: it.id,
            plu: it.plu,
            name: it.name,
            price: it.originalPrice,
            unitPrice: it.originalPrice,
            totalPrice: it.finalPrice,
            quantity: it.originalQuantity,
          })),
          subtotal,
          charges: [
            { id: 'c1', title: 'Delivery Fee', amount: deliveryFee, type: 'deliveryFee' },
            { id: 'c2', title: 'Bag Fee', amount: bagFee, type: 'bagFee' },
          ],
          discounts: [],
          total,
          currency: 'GBP',
          validationErrors: [],
          restrictions: [],
          discountTotal: toMoney(0, 'GBP'),
          updatedAt: now.toISOString(),
        },
        currentOrder: {
          subtotal,
          charges: [
            { id: 'c1', title: 'Delivery Fee', amount: deliveryFee, type: 'deliveryFee' },
            { id: 'c2', title: 'Bag Fee', amount: bagFee, type: 'bagFee' },
          ],
          discounts: [],
          depositTotal: toMoney(0, 'GBP'),
          bagFee,
          serviceCharge: toMoney(0, 'GBP'),
          deliveryCharge: deliveryFee,
          tip: toMoney(0, 'GBP'),
          total,
          itemCount: 3,
        },
        finalOrder: {
          subtotal,
          charges: [
            { id: 'c1', title: 'Delivery Fee', amount: deliveryFee, type: 'deliveryFee' },
            { id: 'c2', title: 'Bag Fee', amount: bagFee, type: 'bagFee' },
          ],
          discounts: [],
          depositTotal: toMoney(0, 'GBP'),
          bagFee,
          serviceCharge: toMoney(0, 'GBP'),
          deliveryCharge: deliveryFee,
          tip: toMoney(0, 'GBP'),
          total,
          itemCount: 3,
        },
        payment: {
          paymentId: `pay_${orderRef}`,
          paymentTokenReference: `tok_${orderRef}`,
          state: 'CAPTURED',
          currency: 'GBP',
          authorizedAmount: total,
          authorizationMaximum: authMax,
          finalAmount: total,
          capturedAmount: total,
          method: 'Deliverect Pay • Apple Pay',
          history: [
            { state: 'AUTHORIZED', timestamp: now.toISOString(), amount: authMax, note: 'Authorized for order estimate' },
            { state: 'CAPTURED', timestamp: now.toISOString(), amount: total, note: 'All items picked. Captured final total.' },
          ],
        },
        picking: {
          status: 'COMPLETED',
          startedAt: now.toISOString(),
          completedAt: now.toISOString(),
          totalItems: 3,
          itemsPicked: 3,
          hasChanges: false,
          items,
        },
        delivery: {
          deliveryOption: selectedOption,
          dispatchSchedulingMode: 'RESERVE_AT_ORDER',
          isConfirmed: true,
          courier: {
            name: 'Alex Rivera',
            phone: '07700 900456',
            vehicleType: 'E-Moped',
            eta: '12–18 min',
          },
        },
        events: [
          { id: 'e1', status: 'SUBMITTED', title: 'Order Submitted', timestamp: now.toISOString() },
          { id: 'e2', status: 'ACCEPTED', title: 'Store Accepted', timestamp: now.toISOString() },
          { id: 'e3', status: 'PICKED', title: 'Picking Complete', timestamp: now.toISOString() },
          { id: 'e4', status: 'READY_FOR_COURIER', title: 'Ready for Courier', timestamp: now.toISOString() },
        ],
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      this.orders.set(orderId, order);
      return order;
    }

    if (scenario === 'B') {
      // Scenario B: Amendments & Substitutions (prompt requirement!)
      // ✓ Semi Skimmed Milk - Picked (£1.85)
      // ↻ Pepsi Max 2L - Replaced Pepsi Max 1.5L - £2.40 → £2.00 (Customer pays £2.00 under Lower Price Guarantee)
      // − Bananas - Requested 6, Supplied 5 (£1.60 -> £1.33)
      // × Ice Cream - Unavailable, Removed (£0.00 contribution)
      // Final total £6.80 subtotal + charges, captured safely against authorized max (£10.50)!
      const items: PickingItem[] = [
        {
          id: 'item-b-1',
          plu: 'PLU-MILK-4PT',
          name: 'British Whole Fresh Milk 4 Pints (2.27L)',
          originalQuantity: 1,
          pickedQuantity: 1,
          originalPrice: moneyFromMajor(1.85),
          finalPrice: moneyFromMajor(1.85),
          state: 'PICKED',
        },
        {
          id: 'item-b-2',
          plu: 'PLU-PEPSI-15L',
          name: 'Pepsi Max No Sugar Cola 1.5L',
          originalQuantity: 1,
          pickedQuantity: 1,
          originalPrice: moneyFromMajor(2.00),
          finalPrice: moneyFromMajor(2.00), // Charged lower of original (£2.00) and substitute (£2.40)
          state: 'SUBSTITUTED',
          substitution: {
            type: 'BEST_MATCH',
            originalPlu: 'PLU-PEPSI-15L',
            originalName: 'Pepsi Max No Sugar Cola 1.5L',
            originalPrice: moneyFromMajor(2.00),
            substitutePlu: 'PLU-PEPSI-20L',
            substituteName: 'Pepsi Max No Sugar Cola 2L Large Bottle',
            substitutePrice: moneyFromMajor(2.40),
            chargedPrice: moneyFromMajor(2.00),
            reason: 'Replaced Pepsi Max 1.5L (£2.00) with 2L bottle (£2.40). You pay the lower price £2.00.',
          },
        },
        {
          id: 'item-b-3',
          plu: 'PLU-BANANAS-6PK',
          name: 'Fairtrade Ripe Yellow Bananas (Pack of 6)',
          originalQuantity: 6,
          pickedQuantity: 5,
          originalPrice: moneyFromMajor(1.60),
          finalPrice: moneyFromMajor(1.33),
          state: 'QUANTITY_AMENDED',
          amendment: {
            originalQuantity: 6,
            suppliedQuantity: 5,
            reason: 'Requested 6, supplied 5. Charged pro-rata £1.33.',
          },
        },
        {
          id: 'item-b-4',
          plu: 'PLU-ICECREAM-VANILLA',
          name: 'Madagascan Vanilla Bean Dairy Ice Cream 500ml',
          originalQuantity: 1,
          pickedQuantity: 0,
          originalPrice: moneyFromMajor(3.50),
          finalPrice: moneyFromMajor(0.00),
          state: 'REMOVED',
        },
      ];

      const originalSubtotal = moneyFromMajor(8.95);
      const finalSubtotal = moneyFromMajor(5.18);
      const deliveryFee = selectedOption.price;
      const bagFee = moneyFromMajor(0.30);
      const originalTotal = moneyFromMajor(Number((8.95 + (deliveryFee.amount / 100) + 0.30).toFixed(2)));
      const finalTotal = moneyFromMajor(Number((5.18 + (deliveryFee.amount / 100) + 0.30).toFixed(2)));
      const authorizedMax = moneyFromMajor(Number(((originalTotal.amount / 100) + 1.50).toFixed(2))); // £14.24

      const order: Order = {
        id: orderId,
        displayId: `#${orderRef}`,
        orderReference: orderRef,
        tenantId: this.currentTenantId,
        storeId: store.id,
        storeName: store.name,
        status: 'READY_FOR_COURIER',
        fulfillment: {
          type: 'delivery',
          address: MOCK_SAVED_ADDRESSES[0],
          deliveryOption: selectedOption,
          schedulingMode: 'RESERVE_AT_ORDER',
        },
        scheduledTime: {
          type: 'ASAP',
          asapEtaMinutes: 20,
          requestedAt: now.toISOString(),
        },
        originalBasket: {
          id: `bkt_${orderRef}`,
          storeId: store.id,
          storeName: store.name,
          fulfillmentType: 'delivery',
          items: items.map((it) => ({
            id: it.id,
            plu: it.plu,
            name: it.name,
            price: it.originalPrice,
            unitPrice: it.originalPrice,
            totalPrice: it.finalPrice,
            quantity: it.originalQuantity,
          })),
          subtotal: originalSubtotal,
          charges: [
            { id: 'c1', title: 'Delivery Fee', amount: deliveryFee, type: 'deliveryFee' },
            { id: 'c2', title: 'Bag Fee', amount: bagFee, type: 'bagFee' },
          ],
          discounts: [],
          total: originalTotal,
          currency: 'GBP',
          validationErrors: [],
          restrictions: [],
          discountTotal: toMoney(0, 'GBP'),
          updatedAt: now.toISOString(),
        },
        currentOrder: {
          subtotal: finalSubtotal,
          charges: [
            { id: 'c1', title: 'Delivery Fee', amount: deliveryFee, type: 'deliveryFee' },
            { id: 'c2', title: 'Bag Fee', amount: bagFee, type: 'bagFee' },
          ],
          discounts: [],
          depositTotal: toMoney(0, 'GBP'),
          bagFee: bagFee,
          serviceCharge: toMoney(0, 'GBP'),
          deliveryCharge: deliveryFee,
          tip: toMoney(0, 'GBP'),
          total: finalTotal,
          itemCount: 3,
        },
        finalOrder: {
          subtotal: finalSubtotal,
          charges: [
            { id: 'c1', title: 'Delivery Fee', amount: deliveryFee, type: 'deliveryFee' },
            { id: 'c2', title: 'Bag Fee', amount: bagFee, type: 'bagFee' },
          ],
          discounts: [],
          depositTotal: toMoney(0, 'GBP'),
          bagFee: bagFee,
          serviceCharge: toMoney(0, 'GBP'),
          deliveryCharge: deliveryFee,
          tip: toMoney(0, 'GBP'),
          total: finalTotal,
          itemCount: 3,
        },
        payment: {
          paymentId: `pay_${orderRef}`,
          paymentTokenReference: `tok_${orderRef}`,
          state: 'CAPTURED',
          currency: 'GBP',
          authorizedAmount: originalTotal,
          authorizationMaximum: authorizedMax,
          finalAmount: finalTotal,
          capturedAmount: finalTotal,
          method: 'Deliverect Pay • Tokenized Visa',
          history: [
            { state: 'AUTHORIZED', timestamp: now.toISOString(), amount: authorizedMax, note: `Authorized ceiling approved by customer: ${formatMoney(authorizedMax)}` },
            { state: 'CAPTURED', timestamp: now.toISOString(), amount: finalTotal, note: `Picking complete with amendments. Captured final total ${formatMoney(finalTotal)} (within ${formatMoney(authorizedMax)} limit).` },
          ],
        },
        picking: {
          status: 'COMPLETED',
          startedAt: now.toISOString(),
          completedAt: now.toISOString(),
          totalItems: 4,
          itemsPicked: 4,
          hasChanges: true,
          items,
        },
        delivery: {
          deliveryOption: selectedOption,
          dispatchSchedulingMode: 'RESERVE_AT_ORDER',
          isConfirmed: true,
          courier: {
            name: 'Alex Rivera',
            phone: '07700 900456',
            vehicleType: 'E-Moped',
            eta: '15–20 min',
          },
        },
        events: [
          { id: 'e1', status: 'SUBMITTED', title: 'Order Submitted', timestamp: now.toISOString() },
          { id: 'e2', status: 'ACCEPTED', title: 'Store Accepted', timestamp: now.toISOString() },
          { id: 'e3', status: 'PICKING_WITH_CHANGES', title: 'Picking Complete with Substitutions', timestamp: now.toISOString() },
          { id: 'e4', status: 'READY_FOR_COURIER', title: 'Ready for Courier', timestamp: now.toISOString() },
        ],
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      this.orders.set(orderId, order);
      return order;
    }

    if (scenario === 'C') {
      // Scenario C: Customer-Selected Substitute
      const items: PickingItem[] = [
        {
          id: 'item-c-1',
          plu: 'PLU-SOURDOUGH-01',
          name: 'Slow Fermented Sourdough Boule 600g',
          originalQuantity: 1,
          pickedQuantity: 1,
          originalPrice: moneyFromMajor(3.25),
          finalPrice: moneyFromMajor(2.85),
          state: 'SUBSTITUTED',
          substitutionPreference: 'CUSTOMER_SELECTED',
          substitution: {
            type: 'CUSTOMER_SELECTED',
            originalPlu: 'PLU-SOURDOUGH-01',
            originalName: 'Slow Fermented Sourdough Boule 600g',
            originalPrice: moneyFromMajor(3.25),
            substitutePlu: 'PLU-ART-001',
            substituteName: 'Artisan Heritage Sourdough Boule 800g',
            substitutePrice: moneyFromMajor(2.85),
            chargedPrice: moneyFromMajor(2.85),
            reason: 'Replaced with customer-chosen substitute: Artisan Heritage Sourdough Boule 800g (£2.85)',
          },
        },
        {
          id: 'item-c-2',
          plu: 'PLU-ORGANIC-EGGS-6PK',
          name: 'Free Range Organic Rich Yolk Large Eggs (Pack of 6)',
          originalQuantity: 1,
          pickedQuantity: 1,
          originalPrice: moneyFromMajor(2.70),
          finalPrice: moneyFromMajor(2.70),
          state: 'PICKED',
        },
      ];

      const deliveryFee = selectedOption.price;
      const subtotal = moneyFromMajor(5.55);
      const total = moneyFromMajor(Number((5.55 + (deliveryFee.amount / 100) + 0.30).toFixed(2)));
      const origSubtotal = moneyFromMajor(5.95);
      const origTotal = moneyFromMajor(Number((5.95 + (deliveryFee.amount / 100)).toFixed(2)));
      const authMax = moneyFromMajor(12.00);

      const order: Order = {
        id: orderId,
        displayId: `#${orderRef}`,
        orderReference: orderRef,
        tenantId: this.currentTenantId,
        storeId: store.id,
        storeName: store.name,
        status: 'READY_FOR_COURIER',
        fulfillment: {
          type: 'delivery',
          address: MOCK_SAVED_ADDRESSES[0],
          deliveryOption: selectedOption,
          schedulingMode: 'RESERVE_AT_ORDER',
        },
        scheduledTime: {
          type: 'ASAP',
          asapEtaMinutes: 25,
          requestedAt: now.toISOString(),
        },
        originalBasket: {
          id: `bkt_${orderRef}`,
          storeId: store.id,
          storeName: store.name,
          fulfillmentType: 'delivery',
          items: items.map((it) => ({
            id: it.id,
            plu: it.plu,
            name: it.name,
            price: it.originalPrice,
            unitPrice: it.originalPrice,
            totalPrice: it.finalPrice,
            quantity: it.originalQuantity,
          })),
          subtotal: origSubtotal,
          charges: [{ id: 'c1', title: 'Delivery Fee', amount: selectedOption.price, type: 'deliveryFee' }],
          discounts: [],
          total: origTotal,
          currency: 'GBP',
          validationErrors: [],
          restrictions: [],
          discountTotal: toMoney(0, 'GBP'),
          updatedAt: now.toISOString(),
        },
        currentOrder: {
          subtotal,
          charges: [{ id: 'c1', title: 'Delivery Fee', amount: selectedOption.price, type: 'deliveryFee' }],
          discounts: [],
          depositTotal: toMoney(0, 'GBP'),
          bagFee: toMoney(0, 'GBP'),
          serviceCharge: toMoney(0, 'GBP'),
          deliveryCharge: selectedOption.price,
          tip: toMoney(0, 'GBP'),
          total,
          itemCount: 2,
        },
        payment: {
          paymentId: `pay_${orderRef}`,
          state: 'CAPTURED',
          currency: 'GBP',
          authorizedAmount: origTotal,
          authorizationMaximum: authMax,
          finalAmount: total,
          capturedAmount: total,
          method: 'Deliverect Pay',
          history: [
            { state: 'AUTHORIZED', timestamp: now.toISOString(), amount: authMax },
            { state: 'CAPTURED', timestamp: now.toISOString(), amount: total },
          ],
        },
        picking: {
          status: 'COMPLETED',
          totalItems: 2,
          itemsPicked: 2,
          hasChanges: true,
          items,
        },
        delivery: {
          deliveryOption: selectedOption,
          dispatchSchedulingMode: 'RESERVE_AT_ORDER',
          isConfirmed: true,
        },
        events: [
          { id: 'e1', status: 'ACCEPTED', title: 'Store Accepted', timestamp: now.toISOString() },
          { id: 'e2', status: 'PICKED', title: 'Customer Substitute Picked', timestamp: now.toISOString() },
        ],
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      this.orders.set(orderId, order);
      return order;
    }

    if (scenario === 'D') {
      // Scenario D: Exceeds authorized amount (Prompt requirement: Demo D)
      // Original authorized maximum was £20.00.
      // Weighted cuts or customer-approved luxury substitutions brought final total to £24.50.
      // Payment state is REAUTHORIZING / PAYMENT_ACTION_REQUIRED until customer reauthorizes!
      const items: PickingItem[] = [
        {
          id: 'item-d-1',
          plu: 'PLU-GIN-001',
          name: 'Cotswolds Artisan Botanical Dry Gin 70cl',
          originalQuantity: 1,
          pickedQuantity: 1,
          originalPrice: moneyFromMajor(15.00),
          finalPrice: moneyFromMajor(20.00), // Premium size substitution
          state: 'SUBSTITUTED',
          substitution: {
            type: 'BEST_MATCH',
            originalPlu: 'PLU-GIN-001',
            originalName: 'Cotswolds Botanical Dry Gin 50cl',
            originalPrice: moneyFromMajor(15.00),
            substitutePlu: 'PLU-GIN-001-70CL',
            substituteName: 'Cotswolds Botanical Dry Gin 70cl (Large)',
            substitutePrice: moneyFromMajor(20.00),
            chargedPrice: moneyFromMajor(20.00),
            reason: '50cl bottle unavailable; upgraded to 70cl presentation.',
          },
        },
        {
          id: 'item-d-2',
          plu: 'PLU-KOM-001',
          name: 'Organic Wild Berry Sparkling Kombucha 330ml Can',
          originalQuantity: 2,
          pickedQuantity: 2,
          originalPrice: moneyFromMajor(2.25),
          finalPrice: moneyFromMajor(4.50),
          state: 'PICKED',
        },
      ];

      const deliveryFee = selectedOption.price;
      const finalSubtotal = moneyFromMajor(24.50);
      const finalTotal = moneyFromMajor(Number((24.50 + (deliveryFee.amount / 100)).toFixed(2))); // ~27.99
      const origSubtotal = moneyFromMajor(19.50);
      const origTotal = moneyFromMajor(Number((19.50 + (deliveryFee.amount / 100)).toFixed(2)));
      const authorizedMax = moneyFromMajor(20.00); // Original authorized maximum exceeded!

      const order: Order = {
        id: orderId,
        displayId: `#${orderRef}`,
        orderReference: orderRef,
        tenantId: this.currentTenantId,
        storeId: store.id,
        storeName: store.name,
        status: 'PAYMENT_FINALISING',
        fulfillment: {
          type: 'delivery',
          address: MOCK_SAVED_ADDRESSES[0],
          deliveryOption: selectedOption,
          schedulingMode: 'RESERVE_AT_ORDER',
        },
        scheduledTime: {
          type: 'ASAP',
          asapEtaMinutes: 25,
          requestedAt: now.toISOString(),
        },
        originalBasket: {
          id: `bkt_${orderRef}`,
          storeId: store.id,
          storeName: store.name,
          fulfillmentType: 'delivery',
          items: items.map((it) => ({
            id: it.id,
            plu: it.plu,
            name: it.name,
            price: it.originalPrice,
            unitPrice: it.originalPrice,
            totalPrice: it.finalPrice,
            quantity: it.originalQuantity,
          })),
          subtotal: origSubtotal,
          charges: [{ id: 'c1', title: 'Delivery Fee', amount: selectedOption.price, type: 'deliveryFee' }],
          discounts: [],
          total: origTotal,
          currency: 'GBP',
          validationErrors: [],
          restrictions: [],
          discountTotal: toMoney(0, 'GBP'),
          updatedAt: now.toISOString(),
        },
        currentOrder: {
          subtotal: finalSubtotal,
          charges: [{ id: 'c1', title: 'Delivery Fee', amount: selectedOption.price, type: 'deliveryFee' }],
          discounts: [],
          depositTotal: toMoney(0, 'GBP'),
          bagFee: toMoney(0, 'GBP'),
          serviceCharge: toMoney(0, 'GBP'),
          deliveryCharge: selectedOption.price,
          tip: toMoney(0, 'GBP'),
          total: finalTotal,
          itemCount: 3,
        },
        finalOrder: {
          subtotal: finalSubtotal,
          charges: [{ id: 'c1', title: 'Delivery Fee', amount: selectedOption.price, type: 'deliveryFee' }],
          discounts: [],
          depositTotal: toMoney(0, 'GBP'),
          bagFee: toMoney(0, 'GBP'),
          serviceCharge: toMoney(0, 'GBP'),
          deliveryCharge: selectedOption.price,
          tip: toMoney(0, 'GBP'),
          total: finalTotal,
          itemCount: 3,
        },
        payment: {
          paymentId: `pay_${orderRef}`,
          state: 'PAYMENT_ACTION_REQUIRED',
          currency: 'GBP',
          authorizedAmount: origTotal,
          authorizationMaximum: authorizedMax,
          finalAmount: finalTotal,
          capturedAmount: toMoney(0, 'GBP'),
          method: 'Deliverect Pay • Visa **** 4242',
          refusalReason: `Final amount ${formatMoney(finalTotal)} exceeds authorized ceiling ${formatMoney(authorizedMax)}. Customer reauthorization required.`,
          history: [
            { state: 'AUTHORIZED', timestamp: now.toISOString(), amount: authorizedMax, note: `Initial customer ceiling: ${formatMoney(authorizedMax)}` },
            { state: 'PAYMENT_ACTION_REQUIRED', timestamp: now.toISOString(), amount: finalTotal, note: `Reauthorization required: final order ${formatMoney(finalTotal)} exceeds limit.` },
          ],
        },
        picking: {
          status: 'COMPLETED',
          completedAt: now.toISOString(),
          totalItems: 2,
          itemsPicked: 2,
          hasChanges: true,
          items,
        },
        delivery: {
          deliveryOption: selectedOption,
          dispatchSchedulingMode: 'RESERVE_AT_ORDER',
          isConfirmed: false,
          provisionalNotice: 'Awaiting payment reauthorization before courier dispatch.',
        },
        events: [
          { id: 'e1', status: 'ACCEPTED', title: 'Store Accepted', timestamp: now.toISOString() },
          { id: 'e2', status: 'PICKED', title: 'Picking Complete (Total Exceeded)', timestamp: now.toISOString() },
          { id: 'e3', status: 'PAYMENT_FINALISING', title: 'Payment Reauthorization Required', timestamp: now.toISOString() },
        ],
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      this.orders.set(orderId, order);
      return order;
    }

    if (scenario === 'E') {
      // Scenario E: Closed store scheduled pre-order
      // Store Wickford Depot is closed now, opens 07:00 tomorrow.
      // Order scheduled for tomorrow morning 08:00 – 08:30!
      // Dispatch mode: ASSIGN_NEAR_FULFILMENT with provisional status.
      const closedStore = MOCK_STORES.find((s) => s.id === 'store-wickford-bypass') || MOCK_STORES[3];
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      const slot: DeliverySlot = {
        id: `slot-${tomorrowStr}-0800`,
        dayLabel: 'Tomorrow',
        dateString: tomorrowStr,
        startTime: '08:00',
        endTime: '08:30',
        formatted: '08:00 – 08:30',
        isAvailable: true,
      };

      const items: PickingItem[] = [
        {
          id: 'item-e-1',
          plu: 'PLU-ART-001',
          name: 'Artisan Heritage Sourdough Boule 800g',
          originalQuantity: 2,
          pickedQuantity: 0,
          originalPrice: moneyFromMajor(2.85),
          finalPrice: moneyFromMajor(5.70),
          state: 'PENDING',
        },
        {
          id: 'item-e-2',
          plu: 'PLU-COLDPRESS-ORANGE',
          name: 'Cold Pressed Valencia Orange Juice 750ml',
          originalQuantity: 1,
          pickedQuantity: 0,
          originalPrice: moneyFromMajor(2.95),
          finalPrice: moneyFromMajor(2.95),
          state: 'PENDING',
        },
      ];

      const subtotalMajor = 8.65;
      const deliveryMajor = selectedOption.price.amount / 100;
      const totalMajor = Number((subtotalMajor + deliveryMajor + 0.30).toFixed(2));
      const authMaxMajor = Number((totalMajor * 1.1).toFixed(2));

      const subtotal = moneyFromMajor(subtotalMajor);
      const total = moneyFromMajor(totalMajor);
      const authMax = moneyFromMajor(authMaxMajor);
      const bagFee = moneyFromMajor(0.30);

      const order: Order = {
        id: orderId,
        displayId: `#${orderRef}`,
        orderReference: orderRef,
        tenantId: this.currentTenantId,
        storeId: closedStore.id,
        storeName: closedStore.name,
        status: 'SUBMITTED',
        fulfillment: {
          type: 'delivery',
          address: MOCK_SAVED_ADDRESSES[0],
          deliveryOption: selectedOption,
          schedulingMode: 'ASSIGN_NEAR_FULFILMENT',
          scheduledSlot: slot,
        },
        scheduledTime: {
          type: 'SCHEDULED',
          slot,
          requestedAt: now.toISOString(),
        },
        originalBasket: {
          id: `bkt_${orderRef}`,
          storeId: closedStore.id,
          storeName: closedStore.name,
          fulfillmentType: 'delivery',
          items: items.map((it) => ({
            id: it.id,
            plu: it.plu,
            name: it.name,
            price: it.originalPrice,
            unitPrice: it.originalPrice,
            totalPrice: it.finalPrice,
            quantity: it.originalQuantity,
          })),
          subtotal,
          charges: [
            { id: 'c1', title: 'Delivery Fee', amount: selectedOption.price, type: 'deliveryFee' },
            { id: 'c2', title: 'Bag Fee', amount: bagFee, type: 'bagFee' },
          ],
          discounts: [],
          total,
          currency: 'GBP',
          validationErrors: [],
          restrictions: [],
          discountTotal: toMoney(0, 'GBP'),
          updatedAt: now.toISOString(),
        },
        currentOrder: {
          subtotal,
          charges: [
            { id: 'c1', title: 'Delivery Fee', amount: selectedOption.price, type: 'deliveryFee' },
            { id: 'c2', title: 'Bag Fee', amount: bagFee, type: 'bagFee' },
          ],
          discounts: [],
          depositTotal: toMoney(0, 'GBP'),
          bagFee: bagFee,
          serviceCharge: toMoney(0, 'GBP'),
          deliveryCharge: selectedOption.price,
          tip: toMoney(0, 'GBP'),
          total,
          itemCount: 3,
        },
        payment: {
          paymentId: `pay_${orderRef}`,
          state: 'AUTHORIZED',
          currency: 'GBP',
          authorizedAmount: total,
          authorizationMaximum: authMax,
          finalAmount: total,
          capturedAmount: toMoney(0, 'GBP'),
          method: 'Deliverect Pay • Tokenized',
          history: [
            { state: 'AUTHORIZED', timestamp: now.toISOString(), amount: authMax, note: `Pre-authorized for scheduled order. Card will only be charged when picked tomorrow.` },
          ],
        },
        picking: {
          status: 'NOT_STARTED',
          totalItems: 2,
          itemsPicked: 0,
          hasChanges: false,
          items,
        },
        delivery: {
          deliveryOption: selectedOption,
          dispatchSchedulingMode: 'ASSIGN_NEAR_FULFILMENT',
          isConfirmed: false,
          provisionalNotice: 'Courier availability will be confirmed closer to your delivery time',
        },
        events: [
          { id: 'e1', status: 'SUBMITTED', title: 'Pre-Order Scheduled', description: 'Store currently closed. Order queued for morning opening at 07:00.', timestamp: now.toISOString() },
        ],
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      this.orders.set(orderId, order);
      return order;
    }

    // Default / Scenario F: Multi-courier dispatch selection
    const items: PickingItem[] = [
      {
        id: 'item-f-1',
        plu: 'PLU-PIZZA-01',
        name: 'Woodfired Margherita Pizza with Buffalo Mozzarella',
        originalQuantity: 2,
        pickedQuantity: 2,
        originalPrice: moneyFromMajor(5.95),
        finalPrice: moneyFromMajor(11.90),
        state: 'PICKED',
      },
    ];

    const subtotalMajor = 11.90;
    const deliveryMajor = selectedOption.price.amount / 100;
    const totalMajor = Number((subtotalMajor + deliveryMajor).toFixed(2));
    const authMaxMajor = totalMajor + 2;

    const subtotal = moneyFromMajor(subtotalMajor);
    const total = moneyFromMajor(totalMajor);
    const authMax = moneyFromMajor(authMaxMajor);

    const order: Order = {
      id: orderId,
      displayId: `#${orderRef}`,
      orderReference: orderRef,
      tenantId: this.currentTenantId,
      storeId: store.id,
      storeName: store.name,
      status: 'READY_FOR_COURIER',
      fulfillment: {
        type: 'delivery',
        address: MOCK_SAVED_ADDRESSES[0],
        deliveryOption: selectedOption,
        schedulingMode: 'RESERVE_AT_ORDER',
      },
      scheduledTime: {
        type: 'ASAP',
        asapEtaMinutes: 25,
        requestedAt: now.toISOString(),
      },
      originalBasket: {
        id: `bkt_${orderRef}`,
        storeId: store.id,
        storeName: store.name,
        fulfillmentType: 'delivery',
        items: items.map((it) => ({
          id: it.id,
          plu: it.plu,
          name: it.name,
          price: it.originalPrice,
          unitPrice: it.originalPrice,
          totalPrice: it.finalPrice,
          quantity: it.originalQuantity,
        })),
        subtotal,
        charges: [{ id: 'c1', title: `${selectedOption.displayName}`, amount: selectedOption.price, type: 'deliveryFee' }],
        discounts: [],
        total,
        currency: 'GBP',
        validationErrors: [],
        restrictions: [],
        discountTotal: toMoney(0, 'GBP'),
        updatedAt: now.toISOString(),
      },
      currentOrder: {
        subtotal,
        charges: [{ id: 'c1', title: `${selectedOption.displayName}`, amount: selectedOption.price, type: 'deliveryFee' }],
        discounts: [],
        depositTotal: toMoney(0, 'GBP'),
        bagFee: toMoney(0, 'GBP'),
        serviceCharge: toMoney(0, 'GBP'),
        deliveryCharge: selectedOption.price,
        tip: toMoney(0, 'GBP'),
        total,
        itemCount: 2,
      },
      payment: {
        paymentId: `pay_${orderRef}`,
        state: 'CAPTURED',
        currency: 'GBP',
        authorizedAmount: total,
        authorizationMaximum: authMax,
        finalAmount: total,
        capturedAmount: total,
        method: 'Deliverect Pay • JET Go Delivery',
        history: [{ state: 'CAPTURED', timestamp: now.toISOString(), amount: total }],
      },
      picking: {
        status: 'COMPLETED',
        totalItems: 1,
        itemsPicked: 1,
        hasChanges: false,
        items,
      },
      delivery: {
        deliveryOption: selectedOption,
        dispatchSchedulingMode: 'RESERVE_AT_ORDER',
        isConfirmed: true,
        courier: {
          name: 'Jordan Mills',
          vehicleType: 'E-Cargo Bike',
          eta: selectedOption.deliveryEta,
        },
      },
      events: [
        { id: 'e1', status: 'ACCEPTED', title: 'Store Accepted', timestamp: now.toISOString() },
        { id: 'e2', status: 'READY_FOR_COURIER', title: `Assigned to ${selectedOption.displayName}`, timestamp: now.toISOString() },
      ],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    this.orders.set(orderId, order);
    return order;
  }

  // --- Helper Methods ---

  private recalculateBasketTotals(basket: Basket) {
    const currency = basket.currency || 'GBP';

    const getItemMajorPrice = (item: BasketItem): number => {
      if (typeof item.price === 'number') return item.price;
      if (typeof item.price === 'object' && item.price !== null && 'amount' in item.price) {
        return item.price.amount / 100;
      }
      if (item.unitPrice) {
        return typeof item.unitPrice === 'number' ? item.unitPrice : ('amount' in item.unitPrice ? item.unitPrice.amount / 100 : 0);
      }
      return 0;
    };
    const getItemDeposit = (item: BasketItem): number => {
      if (typeof item.deposit === 'number') return item.deposit;
      if (typeof item.deposit === 'object' && item.deposit !== null && 'amount' in item.deposit) {
        return item.deposit.amount / 100;
      }
      return 0;
    };

    const subtotalMajor = basket.items.reduce((sum, i) => sum + getItemMajorPrice(i) * i.quantity, 0);
    const depositTotalMajor = basket.items.reduce((sum, i) => sum + getItemDeposit(i) * i.quantity, 0);

    const charges: BasketCharge[] = [];
    const policy = MOCK_FEE_POLICIES[this.currentTenantId] || MOCK_FEE_POLICIES['brand-alpha'];

    const store = MOCK_STORES.find((s) => s.id === basket.storeId);

    const getDeliveryMajor = (price: Money | number | undefined): number => {
      if (typeof price === 'number') return price;
      if (typeof price === 'object' && price !== null && 'amount' in price) return price.amount / 100;
      return 1.99;
    };

    const getMajor = (val: Money | number | undefined, fallback: number = 0): number => {
      if (typeof val === 'number') return val;
      if (typeof val === 'object' && val !== null && 'amount' in val) return val.amount / 100;
      return fallback;
    };

    const freeDeliveryThreshold = getMajor(policy.freeDeliveryThreshold);
    const fixedDeliveryFee = getMajor(policy.fixedDeliveryFee, 1.99);
    const dispatchFixedSurcharge = getMajor(policy.dispatchFixedSurcharge, 0.50);
    const bagFee = getMajor(policy.bagFee, 0.30);
    const serviceFeeMinCap = getMajor(policy.serviceFeeMinCap, 0);
    const serviceFeeMaxCap = getMajor(policy.serviceFeeMaxCap, 99);
    const minimumBasketThreshold = getMajor(policy.minimumBasketThreshold, 0);
    const smallOrderFee = getMajor(policy.smallOrderFee, 1.50);

    if (basket.fulfillmentType === 'delivery' && basket.items.length > 0) {
      let deliveryFeeMajor = 0;
      if (policy.deliveryFeeMode === 'FREE' || (freeDeliveryThreshold > 0 && subtotalMajor >= freeDeliveryThreshold)) {
        deliveryFeeMajor = 0;
      } else if (policy.deliveryFeeMode === 'FIXED') {
        deliveryFeeMajor = fixedDeliveryFee;
      } else if (policy.deliveryFeeMode === 'DISPATCH_PLUS_FIXED') {
        deliveryFeeMajor = getDeliveryMajor(store?.deliveryPrice) + dispatchFixedSurcharge;
      } else if (policy.deliveryFeeMode === 'DISPATCH_PLUS_PERCENT') {
        const base = getDeliveryMajor(store?.deliveryPrice);
        const surcharge = (base * (policy.dispatchPercentSurcharge ?? 10)) / 100;
        deliveryFeeMajor = base + surcharge;
      } else {
        // DISPATCH_COST
        deliveryFeeMajor = getDeliveryMajor(store?.deliveryPrice);
      }

      charges.push({
        id: 'delivery_fee',
        type: 'deliveryFee',
        title: deliveryFeeMajor === 0 ? 'Courier Delivery (Free qualifying order)' : 'Courier Delivery Fee',
        amount: moneyFromMajor(Number(deliveryFeeMajor.toFixed(2)), currency),
      });
    }

    if (basket.items.length > 0) {
      // Bag fee
      if (bagFee > 0) {
        charges.push({
          id: 'bag_fee',
          type: 'bagFee',
          title: 'Recyclable Bag Fee',
          amount: moneyFromMajor(Number(bagFee.toFixed(2)), currency),
        });
      }

      // Service charge
      let serviceCharge = 0;
      if (policy.serviceFeeMode === 'FIXED') {
        serviceCharge = policy.serviceFeeAmount ?? 0.49;
      } else if (policy.serviceFeeMode === 'PERCENT') {
        const raw = (subtotalMajor * (policy.serviceFeeAmount ?? 3.5)) / 100;
        serviceCharge = Math.min(serviceFeeMaxCap, Math.max(serviceFeeMinCap, raw));
      }

      if (serviceCharge > 0) {
        charges.push({
          id: 'service_fee',
          type: 'serviceCharge',
          title: 'Service & Packaging Fee',
          amount: moneyFromMajor(Number(serviceCharge.toFixed(2)), currency),
        });
      }

      // Small order fee
      if (minimumBasketThreshold > 0 && subtotalMajor < minimumBasketThreshold) {
        charges.push({
          id: 'small_order_fee',
          type: 'smallOrderFee',
          title: `Small Order Surcharge (under £${minimumBasketThreshold.toFixed(2)})`,
          amount: moneyFromMajor(Number(smallOrderFee.toFixed(2)), currency),
          description: `Add £${(minimumBasketThreshold - subtotalMajor).toFixed(2)} more to remove fee`,
        });
      }
    }

    // Tip
    const getTipMajor = (tip: Money | number | undefined): number => {
      if (typeof tip === 'number') return tip;
      if (typeof tip === 'object' && tip !== null && 'amount' in tip) return tip.amount / 100;
      return 0;
    };
    const tipMajor = getTipMajor(basket.tip);
    if (tipMajor > 0) {
      charges.push({
        id: 'courier_tip',
        type: 'tip',
        title: 'Driver Tip',
        amount: moneyFromMajor(Number(tipMajor.toFixed(2)), currency),
      });
    }

    // Deposit
    if (depositTotalMajor > 0) {
      charges.push({
        id: 'deposit',
        type: 'depositTotal',
        title: 'Deposit Return Scheme (DRS)',
        amount: moneyFromMajor(Number(depositTotalMajor.toFixed(2)), currency),
        description: 'Refundable on bottle/can recycling return',
      });
    }

    // Discounts & Meal Deal / Multi-Buy Automatic Pricing Engine
    const getDiscountMajor = (amount: Money | number | undefined): number => {
      if (typeof amount === 'number') return amount;
      if (typeof amount === 'object' && amount !== null && 'amount' in amount) return amount.amount / 100;
      return 0;
    };

    // 1. Preserve manual promo code discounts (e.g. promo code inputs like SAVE5, FREEDELIV)
    const manualDiscounts = (basket.discounts || []).filter(
      (d) => !d.id || !d.id.startsWith('dsc_deal_')
    );

    // 2. Automatically evaluate Deliverect Meal Deals & Multi-Buys
    const autoDealDiscounts: BasketDiscount[] = [];

    // Track available PLU quantities in basket to prevent double-discounting
    const availablePluQty: Record<string, number> = {};
    for (const item of basket.items) {
      if (item.plu) {
        availablePluQty[item.plu] = (availablePluQty[item.plu] || 0) + item.quantity;
      }
    }

    // Evaluate 'AND' Meal Deals & Bundles first (all required products in the bundle)
    for (const deal of DELIVERECT_CATALOG_DEALS) {
      if (deal.stockMatchMode === 'AND' && deal.linkedProductPlus.length > 0) {
        const possibleSets = Math.min(
          ...deal.linkedProductPlus.map((plu) => availablePluQty[plu] || 0)
        );

        if (possibleSets > 0) {
          // Calculate the original regular price of 1 set
          let regularSetPrice = 0;
          for (const plu of deal.linkedProductPlus) {
            const bItem = basket.items.find((i) => i.plu === plu);
            const unitPrice = bItem ? getItemMajorPrice(bItem) : 0;
            regularSetPrice += unitPrice;
          }

          const savingsPerSet = Math.max(0, regularSetPrice - deal.dealPrice);
          const totalSavings = Number((savingsPerSet * possibleSets).toFixed(2));

          if (totalSavings > 0) {
            autoDealDiscounts.push({
              id: `dsc_deal_${deal.id}`,
              code: 'MEALDEAL',
              title: `${deal.title} (${possibleSets > 1 ? `${possibleSets}x Combo` : 'Meal Deal Savings'})`,
              amount: moneyFromMajor(totalSavings, currency),
              description: `Bundle deal price £${deal.dealPrice.toFixed(2)} applied`,
            });

            // Consume these items from available pool
            for (const plu of deal.linkedProductPlus) {
              availablePluQty[plu] = (availablePluQty[plu] || 0) - possibleSets;
            }
          }
        }
      }
    }

    // Evaluate 'OR' Multi-Buys next (e.g. Any 2 bags for £3.00)
    for (const deal of DELIVERECT_CATALOG_DEALS) {
      if (deal.stockMatchMode === 'OR' && deal.linkedProductPlus.length > 0) {
        const qualifyingCount = deal.linkedProductPlus.reduce(
          (sum, plu) => sum + (availablePluQty[plu] || 0),
          0
        );
        const pairs = Math.floor(qualifyingCount / 2);

        if (pairs > 0) {
          const totalSavings = Number((deal.savings * pairs).toFixed(2));
          if (totalSavings > 0) {
            autoDealDiscounts.push({
              id: `dsc_deal_${deal.id}`,
              code: 'MULTIBUY',
              title: `${deal.title} (${pairs > 1 ? `${pairs}x Multi-Buys` : 'Multi-Buy'})`,
              amount: moneyFromMajor(totalSavings, currency),
              description: `Any 2 for £${deal.dealPrice.toFixed(2)} applied`,
            });

            // Deduct consumed items
            let toDeduct = pairs * 2;
            for (const plu of deal.linkedProductPlus) {
              if (toDeduct <= 0) break;
              const avail = availablePluQty[plu] || 0;
              const take = Math.min(avail, toDeduct);
              availablePluQty[plu] -= take;
              toDeduct -= take;
            }
          }
        }
      }
    }

    basket.discounts = [...manualDiscounts, ...autoDealDiscounts];
    const discountSumMajor = basket.discounts.reduce((acc, d) => acc + getDiscountMajor(d.amount), 0);

    const chargesSumMajor = charges.reduce((acc, c) => acc + (c.amount.amount / 100), 0);
    const totalMajor = Math.max(0, subtotalMajor + chargesSumMajor - discountSumMajor);

    basket.subtotal = moneyFromMajor(Number(subtotalMajor.toFixed(2)), currency);
    basket.depositTotal = moneyFromMajor(Number(depositTotalMajor.toFixed(2)), currency);
    basket.discountTotal = moneyFromMajor(Number(discountSumMajor.toFixed(2)), currency);
    basket.charges = charges;
    basket.total = moneyFromMajor(Number(totalMajor.toFixed(2)), currency);
    basket.updatedAt = new Date().toISOString();
  }

  public applyStoreSpecifics(product: Product, storeId: string): Product {
    const normStoreId = normalizeStoreId(storeId);
    const clone: Product = { ...product };
    const avail = catalogStore.getProductAvailability(normStoreId, product.plu);

    if (avail) {
      // 1. Location-specific price
      if (avail.storePrice !== undefined && avail.storePrice !== null) {
        clone.price = moneyFromMajor(avail.storePrice, 'GBP');
      } else if (avail.price !== undefined && avail.price !== null) {
        clone.price = typeof avail.price === 'number' ? moneyFromMajor(avail.price, 'GBP') : avail.price;
      }

      if (avail.originalPrice !== undefined && avail.originalPrice !== null) {
        clone.originalPrice = typeof avail.originalPrice === 'number' ? moneyFromMajor(avail.originalPrice, 'GBP') : avail.originalPrice;
      }

      // 2. Location-specific stock & quantity
      if (avail.stockQuantity !== undefined && avail.stockQuantity !== null) {
        clone.stockQuantity = avail.stockQuantity;
      }
      if (avail.stockStatus) {
        clone.stockStatus = avail.stockStatus;
      } else if (avail.stockQuantity !== undefined && avail.stockQuantity !== null) {
        if (avail.stockQuantity === 0) {
          clone.stockStatus = 'OUT_OF_STOCK';
        } else {
          clone.stockStatus = 'IN_STOCK';
        }
      }

      // 3. Location-specific active / carried status
      if (avail.active !== undefined) {
        clone.active = avail.active;
      }
      if (avail.isCarried === false) {
        clone.active = false;
      }
      if (avail.inStock === false && (avail.stockQuantity === 0 || avail.stockQuantity === undefined)) {
        if (avail.isCarried === false) {
          clone.active = false;
        } else {
          clone.stockStatus = 'OUT_OF_STOCK';
        }
      }

      // 4. Deliverect Snooze evaluation
      const snoozeInfo = checkProductSnooze(normStoreId, product.plu);
      if (snoozeInfo.isSnoozed) {
        clone.snoozed = true;
        clone.isSnoozed = true;
        clone.snoozeEndTime = snoozeInfo.snoozeEndTime;
        clone.active = false;
        clone.stockStatus = 'OUT_OF_STOCK';
        clone.stockQuantity = 0;
      } else if (!snoozeInfo.isAvailable) {
        clone.active = false;
        clone.stockStatus = 'OUT_OF_STOCK';
        clone.stockQuantity = 0;
      }
    } else {
      // Fallback location variations for mock stores
      if (normStoreId.includes('billericay')) {
        if (clone.plu === 'PLU-SOURDOUGH-01') {
          clone.stockQuantity = 1;
          clone.stockStatus = 'IN_STOCK';
        }
      }
    }

    return clone;
  }

  private computeAvailabilitySummary(
    product: Product,
    eligibleStoreIds?: string[]
  ): ProductAvailabilitySummary {
    let eligibleStores = MOCK_STORES;
    if (eligibleStoreIds && eligibleStoreIds.length > 0) {
      const allowedSet = new Set(eligibleStoreIds.slice(0, MAX_ELIGIBLE_STORES));
      eligibleStores = eligibleStores.filter((s) => allowedSet.has(s.id));
    }

    const availableStores = eligibleStores.filter((s) => {
      const snoozeCheck = checkProductSnooze(s.id, product.plu);
      if (!snoozeCheck.isAvailable || snoozeCheck.isSnoozed) {
        return false;
      }
      const sp = this.applyStoreSpecifics(product, s.id);
      if (sp.active === false) return false;
      if (sp.snoozed === true || sp.isSnoozed === true) return false;
      if (sp.stockStatus === 'OUT_OF_STOCK') return false;
      return true;
    });

    const prices = availableStores
      .map((s) => {
        const sp = this.applyStoreSpecifics(product, s.id);
        return moneyToMajor(sp.price);
      })
      .filter((p) => p > 0);

    const fallbackPrice = moneyToMajor(product.price || (product as any).basePrice);
    const minPrice = prices.length > 0 ? Math.min(...prices) : fallbackPrice;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : fallbackPrice;

    return {
      productId: product.id,
      plu: product.plu,
      availableStoreCount: availableStores.length,
      eligibleStoreCount: eligibleStores.length,
      minimumPrice: minPrice,
      maximumPrice: maxPrice,
      nearestAvailableStoreId: availableStores[0]?.id,
      deliveryAvailable: availableStores.some((s) => s.supportsDelivery && (s.dispatchAvailability ? s.dispatchAvailability.available !== false : true)),
      collectionAvailable: availableStores.some((s) => s.collectionAvailable || s.supportsPickup),
    };
  }
}

// Singleton default client instance
export const defaultCommerceClient = new MockCommerceClient();
