import { CheckoutResult } from '../domain/models';
import type { CmsPage } from './cmsModels';
import {
  BootstrapResponse,
  Store,
  EligibleStore,
  StoreEligibilityResult,
  MAX_ELIGIBLE_STORES,
  COLLECTION_FALLBACK_RADIUS_METERS,
  Catalog,
  CatalogDiagnostics,
  Product,
  ProductAvailabilitySummary,
  Basket,
  CheckoutSummary,
  Coordinates,
  Address,
  Story,
  HostedPaymentSession,
  DeliveryOption,
  DeliverySlot,
  SchedulingPolicy,
  TenantSubstitutionPolicy,
  SubstitutionPreferenceType,
  OrderPaymentInfo,
  FulfillmentSchedulingType,
  Order,
  PickingEvent,
  DemoScenario,
  Money,
  VisualRule,
} from './models';

export interface LocationResolutionResult {
  address: Address;
  coordinates: Coordinates;
  formattedText: string;
}

export interface CommerceClient {
  /**
   * Retrieves tenant configuration, brand theme, and feature flags.
   * Corresponds to GET /api/v1/bootstrap
   */
  getBootstrap(): Promise<BootstrapResponse>;

  /**
   * Resolves a postal code, partial street address, or geo-coordinates
   * into a standardized address and coordinates.
   */
  resolveAddress(query: string | Coordinates): Promise<LocationResolutionResult>;

  /**
   * Discovers eligible stores nearby ordered by distance, including
   * delivery and collection availability.
   */
  getNearbyStores(
    coordinates: Coordinates,
    fulfillmentType?: 'delivery' | 'pickup'
  ): Promise<Store[]>;

  /**
   * Retrieves all available stores for the tenant.
   */
  getStores(
    coordinates?: Coordinates,
    fulfillmentType?: 'delivery' | 'pickup'
  ): Promise<Store[]>;

  /**
   * Retrieves a single store by ID through the authoritative CommerceClient abstraction.
   */
  getStore(storeId: string): Promise<Store | null>;

  /**
   * Discovers and ranks eligible stores for customer coordinates/address.
   * Serviceable delivery stores sort first by distance ascending.
   * If fewer than desired results exist, includes pickup-capable stores within 20 km.
   * Maximum 10 total stores returned. No stores outside 20 km are included.
   */
  getEligibleStores(
    coordinates: Coordinates,
    address?: Address,
    preferredFulfillment?: 'delivery' | 'pickup'
  ): Promise<StoreEligibilityResult>;

  /**
   * Resets all server-side and client-side commerce caches.
   */
  resetCache?: () => Promise<{ success: boolean; message: string }>;

  /**
   * Fetches the brand-wide Root Catalog before a specific store is selected.
   * Products here represent the master brand catalog without location-specific pricing.
   */
  getRootCatalog(options?: { refresh?: boolean }): Promise<Catalog>;

  /**
   * Fetches the authoritative Store Catalog for a selected store,
   * containing store-specific range, inventory, and pricing.
   */
  getStoreCatalog(
    storeId: string,
    options?: { fulfillment?: 'delivery' | 'pickup'; menuId?: string; refresh?: boolean }
  ): Promise<Catalog>;

  /**
   * Fetches stories targeted to the current context (country, store, availability).
   */
  getStories(context?: { storeId?: string; coordinates?: Coordinates }): Promise<Story[]>;

  /** Retrieves published CMS pages for the current tenant. */
  getCmsPages?(): Promise<CmsPage[]>;

  /**
   * Searches the catalog.
   * If storeId is provided, searches store catalog with authoritative pricing and availability.
   * If storeId is omitted, searches root catalog and returns store availability summary.
   */
  searchProducts(
    query: string,
    storeId?: string,
    options?: { categoryId?: string; limit?: number }
  ): Promise<{
    products: Product[];
    summaries?: Record<string, ProductAvailabilitySummary>;
    bundleSummaries?: Record<string, ProductAvailabilitySummary>;
    diagnostics?: CatalogDiagnostics;
  }>;

  /**
   * Retrieves single product by PLU, either with root info or store-specific pricing/availability.
   */
  getProduct(
    plu: string,
    storeId?: string
  ): Promise<{
    product: Product;
    summary?: ProductAvailabilitySummary;
  }>;

  /**
   * Pre-evaluates availability of products across eligible stores for root catalog browsing.
   */
  getProductAvailabilitySummaries(
    plus: string[],
    eligibleStoreIds: string[]
  ): Promise<Record<string, ProductAvailabilitySummary>>;

  /**
   * Retrieves all products (for previews/demos).
   */
  getProducts?(): Promise<Product[]>;

  /**
   * Initializes or gets an existing basket with the selected store.
   */
  createBasket(
    storeId: string,
    fulfillmentType?: 'delivery' | 'pickup'
  ): Promise<Basket>;

  /**
   * Retrieves an authoritative basket by ID.
   */
  getBasket(basketId: string): Promise<Basket>;

  /**
   * Adds or updates a product in the basket with the specified quantity.
   * Enforces stock, multiMax, and legal rules on the BFF.
   */
  updateBasketItem(
    basketId: string,
    plu: string,
    quantity: number
  ): Promise<Basket>;

  /**
   * Removes a product from the basket.
   */
  removeBasketItem(
    basketId: string,
    plu: string
  ): Promise<Basket>;

  /**
   * Adds a complex combo / bundle product to the basket with serialized sub-items
   * representing modifier group selections and premium uplifts.
   */
  addBundleToBasket?(
    basketId: string,
    bundle: import('./bundleModels').BundleProduct,
    selectedModifiers: import('./bundleModels').SelectedBundleModifier[],
    quantity?: number,
    options?: { claimExistingBasketItems?: boolean }
  ): Promise<Basket>;

  /**
   * Switches store for the customer.
   * If an existing basket exists, re-validates item availability and pricing against destination store.
   */
  selectStore(
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
  }>;

  /**
   * Reconciles basket against store menu and stock availability, detecting price drift and out of stock items.
   */
  reconcileBasket?(
    basketId: string,
    destinationStoreId?: string
  ): Promise<{
    reconciled: boolean;
    basket: Basket;
    changes: Array<{
      plu: string;
      name?: string;
      type: 'PRICE_CHANGED' | 'OUT_OF_STOCK' | 'ITEM_REMOVED' | 'QUANTITY_ADJUSTED';
      oldPrice?: Money;
      newPrice?: Money;
      oldQuantity?: number;
      newQuantity?: number;
      message: string;
    }>;
  }>;

  /**
   * Updates multiple items in a basket, with line preservation semantics.
   */
  updateBasketItems?(
    basketId: string,
    items: Array<{
      plu: string;
      menuId?: string;
      quantity: number;
      substitutionPreference?: any;
      substituteCandidatePlus?: string[];
      preferredSubstitutePlu?: string;
      preferredSubstituteName?: string;
      preferredSubstitutePrice?: Money;
    }>
  ): Promise<Basket>;

  /**
   * Updates customer details attached to the basket.
   */
  updateBasketCustomer?(
    basketId: string,
    customer: { name?: string; email?: string; phone?: string; companyName?: string; notes?: string }
  ): Promise<Basket>;

  /**
   * Updates fulfillment context (delivery vs pickup, address, slot) for the basket.
   */
  updateBasketFulfillment?(
    basketId: string,
    fulfillment: { fulfillmentType?: 'delivery' | 'pickup'; type?: 'delivery' | 'pickup'; address?: Address; slot?: DeliverySlot; slotId?: string }
  ): Promise<Basket>;

  /**
   * Switches store for the basket with authoritative revalidation.
   */
  updateBasketStore?(
    basketId: string,
    storeId: string,
    options?: { confirmMigration?: boolean }
  ): Promise<{
    basket: Basket;
    storeSwitchDiff: {
      availableUnchanged?: Array<{ plu: string; name: string; quantity: number; price: number }>;
      priceChanges: Array<{ plu: string; name?: string; oldPrice: number; newPrice: number }>;
      unavailableItems: Array<{ plu: string; name: string; reason?: string }>;
      quantityAdjusted: Array<{ plu: string; name?: string; requested: number; adjustedTo: number; reason?: string }>;
    };
  }>;

  /**
   * Validates basket items, delivery dispatch window, and age restrictions.
   */
  validateBasket(basketId: string): Promise<{
    valid: boolean;
    issues: string[];
  }>;

  /**
   * Prepares checkout summary and payment methods.
   */
  getCheckoutSummary(basketId: string): Promise<CheckoutSummary>;

  /**
   * Revalidates delivery feasibility and dispatch quotes with the BFF.
   * If dispatch validation expires or is close to expiring, this must be called.
   */
  revalidateDelivery(
    basketId: string,
    storeIdOrAddress: string | Address,
    address?: Address
  ): Promise<{
    available: boolean;
    dispatchValidationId?: string;
    dispatchValidationExpiresAt: string;
    deliveryFee: number;
    deliveryEta: string;
    reason?: string;
    alternativeStores?: Store[];
    collectionEligible?: boolean;
  }>;

  /**
   * Retrieves courier delivery quotes according to tenant policy.
   */
  getDispatchQuotes?(params: {
    channelLinkId?: string;
    storeId?: string;
    deliveryAddress: Address;
    itemsCount?: number;
    orderValueMinorUnits?: number;
    currency?: string;
    requiresAgeCheck?: boolean;
    minimumAge?: number;
    policy?: string;
    allowedProviders?: string[];
  }): Promise<{
    available: boolean;
    quotes: any[];
    selectedQuote?: any;
    policyApplied: string;
    rejectionReason?: string;
  }>;

  /**
   * Switches basket fulfillment between delivery and pickup/collection.
   */
  switchBasketFulfillment?(
    basketId: string,
    fulfillmentType: 'delivery' | 'pickup'
  ): Promise<Basket>;

  /**
   * Sets or updates courier gratuity tip.
   */
  applyTip(basketId: string, tipAmount: number): Promise<Basket>;

  /**
   * Applies promotional discount code to basket.
   */
  applyPromoCode(basketId: string, code: string): Promise<Basket>;

  /**
   * Initiates payment session with Deliverect Pay via the BFF.
   * Never transmits raw card details; returns hosted payment redirect URL.
   */
  createPaymentSession(
    requestOrBasketId:
      | string
      | {
          basketId: string;
          paymentMethod?: string;
          returnUrl?: string;
          tipAmount?: number;
        },
    returnUrl?: string
  ): Promise<HostedPaymentSession>;

  /**
   * Polls checkout status following hosted payment flow or webhook completion.
   */
  getCheckoutStatus(sessionId: string): Promise<{
    status: 'preparing_payment' | 'payment_authorised' | 'placing_order' | 'order_confirmed' | 'order_failed';
    orderId?: string;
    failureReason?: string;
  }>;

  /**
   * Fetches an authoritative order by ID with tracking status history.
   */
  getOrder(orderId: string): Promise<any>;

  /**
   * Fetches the user's past and active orders.
   */
  getUserOrders(): Promise<any[]>;

  /**
   * Advances order tracking status (for simulation & interactive demo).
   */
  advanceOrderStatus(orderId: string): Promise<any>;

  /**
   * Configures simulation modes for testing (e.g. simulate dispatch failure, price change, etc.)
   */
  setSimulationFlags(flags: {
    simulatePriceChange?: boolean;
    simulateItemUnavailable?: boolean;
    simulateDispatchExpired?: boolean;
    simulateDispatchUnavailable?: boolean;
    simulatePaymentFailure?: boolean;
  }): void;

  // ========================================================
  // GROCERY POST-CHECKOUT & SCHEDULING EXTENSIONS
  // ========================================================

  /**
   * Retrieves available delivery options/couriers for a basket and address.
   * If multiple options are feasible, returns all options (e.g., Uber Direct, JET Go, Standard).
   */
  getDeliveryOptions?(
    basketId: string,
    address: Address,
    fulfillmentType?: 'delivery' | 'pickup'
  ): Promise<DeliveryOption[]>;

  /**
   * Retrieves available fulfillment time slots based on store opening hours, lead times, and scheduling policy.
   */
  getAvailableSlots?(
    storeId: string,
    fulfillmentType: 'delivery' | 'pickup'
  ): Promise<{
    asapAvailable: boolean;
    asapEtaMinutes?: number;
    days: Array<{ dayLabel: string; dateString: string; slots: DeliverySlot[] }>;
    nextAvailableSlot?: DeliverySlot;
  }>;

  /**
   * Retrieves store / tenant scheduling policy.
   */
  getSchedulingPolicy?(tenantId?: string, storeId?: string): Promise<SchedulingPolicy>;

  /**
   * Retrieves tenant substitution pricing and preference policy.
   */
  getSubstitutionPolicy?(tenantId?: string): Promise<TenantSubstitutionPolicy>;

  /**
   * Updates customer substitution choice for a specific item in the basket.
   */
  setBasketItemSubstitution?(
    basketId: string,
    plu: string,
    preference: SubstitutionPreferenceType,
    candidatePlus?: string[],
    preferredSubstitutePlu?: string,
    preferredSubstituteName?: string,
    preferredSubstitutePrice?: Money
  ): Promise<Basket>;

  /**
   * Tokenizes payment method details (e.g. via Deliverect Pay / Hosted Elements).
   * Raw card details never reach or are stored on application servers.
   */
  tokenizePayment?(cardDetails?: {
    cardNumberMasked?: string;
    expiry?: string;
    brand?: string;
    type?: string;
    cardholderName?: string;
    last4?: string;
    [key: string]: any;
  }): Promise<{ token: string; reference: string }>;

  /**
   * Retrieves order history for the current user.
   */
  getOrderHistory?(): Promise<Order[]>;

  /**
   * Retrieves the tenant's active (enabled) merchandising/visual rules —
   * hide product, age gates, quantity limits, badges, etc. — so the
   * storefront's RuleEngine can actually enforce what's configured in admin.
   */
  getActiveRules?(): Promise<VisualRule[]>;

  /**
   * Authorizes estimated amount and customer-approved authorization maximum.
   */
  authorizePayment?(
    orderId: string,
    amount: number,
    authorizationMaximum: number,
    tokenRef: string
  ): Promise<OrderPaymentInfo>;


  /**
   * Updates authoritative charges associated with the basket (e.g. bag fee, service fee).
   */
  updateBasketCharges?(
    basketId: string,
    charges?: any[]
  ): Promise<Basket>;

  /**
   * Updates tip amount on the basket.
   */
  updateBasketTip?(
    basketId: string,
    tipAmount: Money
  ): Promise<Basket>;

  /**
   * Applies promotional discount codes to the basket.
   */
  applyBasketDiscounts?(
    basketId: string,
    code: string
  ): Promise<Basket>;

  /**
   * Requests a Deliverect Pay session or token authorization for the basket.
   */
  requestPayment?(
    basketId: string,
    options: {
      paymentMethod?: string;
      returnUrl?: string;
      tokenRef?: string;
      authorizationMaximum?: Money;
    }
  ): Promise<{
    paymentId: string;
    status: 'AUTHORIZED' | 'PENDING' | 'ACTION_REQUIRED';
    redirectUrl?: string;
  }>;

  /**
   * Completes checkout of the validated basket in Deliverect Commerce.
   * ASYNCHRONOUS CHECKOUT RULE:
   * Initiates basket checkout; the initial state is checkout pending ('placement_in_progress').
   * Order confirmation is established through the Deliverect Checkout Status Webhook or getCheckout().
   * In-store acceptance is a subsequent operational lifecycle event.
   */
  checkoutBasket(
    basketId: string,
    options?: {
      deliveryOptionId?: string;
      slotId?: string;
      schedulingType?: FulfillmentSchedulingType;
      paymentTokenRef?: string;
      paymentId?: string;
      authorizationMaximum?: Money;
      orderRoute?: 'retail_quest' | 'commerce_checkout';
      fulfillmentType?: 'delivery' | 'pickup' | 'collection';
      customerNotes?: string;
      deliveryAddress?: Address;
      dispatchValidationId?: string;
      dispatchValidationExpiresAt?: string;
    }
  ): Promise<CheckoutResult>;

  /**
   * Retrieves checkout / order state by checkout or order reference.
   */
  getCheckout?(checkoutId: string): Promise<Order>;

  /**
   * Retrieves authoritative order projection state.
   */
  getOrderState?(orderId: string): Promise<Order>;

  /**
   * Submits a finalized grocery order from the basket (delegates to checkoutBasket).
   * @deprecated Prefer checkoutBasket() for Deliverect Commerce Basket Checkout
   */
  submitOrder?(
    basketId: string,
    options?: {
      deliveryOptionId?: string;
      slotId?: string;
      schedulingType?: FulfillmentSchedulingType;
      paymentTokenRef?: string;
      authorizationMaximum?: Money;
      customerNotes?: string;
      deliveryAddress?: Address;
    }
  ): Promise<Order>;

  /**
   * Ingests a Quest picking event or webhook update for an order.
   * Handles idempotency and out-of-order deliveries.
   */
  processPickingEvent?(orderId: string, event: PickingEvent): Promise<Order>;

  /**
   * Advances picking simulation step-by-step for live demonstration and testing.
   */
  advancePickingDemo?(orderId: string): Promise<Order>;

  /**
   * Completes picking for an order, calculates final totals, determines if re-authorization is needed,
   * and triggers capture if within authorized maximum.
   */
  finalizeOrderPicking?(orderId: string): Promise<Order>;

  /**
   * Re-authorizes customer payment if picking modifications exceeded the original authorized maximum.
   */
  reauthorizeOrderPayment?(orderId: string, newAmount?: number): Promise<Order>;

  /**
   * Captures the final picked order amount against the authorized payment token.
   */
  captureOrderPayment?(orderId: string): Promise<Order>;

  /**
   * Bootstraps one of the predefined demonstration scenarios (A through F)
   */
  createDemoScenarioOrder?(scenario: DemoScenario): Promise<Order>;
}
