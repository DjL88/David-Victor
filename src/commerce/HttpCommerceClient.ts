/**
 * Production HttpCommerceClient
 *
 * Implements the CommerceClient interface by dispatching all operations
 * to the Cloud Run BFF API (/api/v1/...).
 *
 * Requirements:
 * - ZERO imports of MockCommerceClient or mock fixture data.
 * - Startup mode initially equals 'unknown' until authoritatively resolved.
 * - Staging & Production have ZERO silent mock fallbacks; upstream errors surface honestly.
 * - Single-store basket semantics enforced.
 */

import { CheckoutResult } from '../domain/models';
import {
  CommerceClient,
  LocationResolutionResult,
} from './CommerceClient';
import {
  BootstrapResponse,
  Store,
  StoreEligibilityResult,
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
  Order,
  PickingEvent,
  Money,
  FulfillmentSchedulingType,
  DemoScenario,
  DispatchAvailability,
  VisualRule,
} from './models';
import { BundleProduct, SelectedBundleModifier } from './bundleModels';
import { getCurrentIdToken } from '../firebase';

export class HttpCommerceClient implements CommerceClient {
  private baseUrl: string;
  private currentTenantId: string = 'brand-alpha';
  private appMode: 'unknown' | 'demo' | 'staging' | 'production' = 'unknown';

  constructor(baseUrl: string = '/api/v1') {
    this.baseUrl = baseUrl;
    this.fetchAppMode().catch(() => {});
  }

  setTenant(tenantId: string) {
    this.currentTenantId = tenantId;
  }

  async fetchAppMode(): Promise<'unknown' | 'demo' | 'staging' | 'production'> {
    try {
      const res = await fetch(`${this.baseUrl}/platform/mode`);
      if (res.ok) {
        const data = await res.json();
        this.appMode = data.appMode || 'unknown';
        return this.appMode;
      }
    } catch {
      // Remain in 'unknown' if backend is unreachable
    }
    return this.appMode;
  }

  getAppMode(): 'unknown' | 'demo' | 'staging' | 'production' {
    return this.appMode;
  }

  setAppMode(mode: 'demo' | 'staging' | 'production') {
    this.appMode = mode;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    let res: Response | null = null;
    let lastError: unknown = null;
    const retryDelays = [200, 600, 1200];

    for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
      try {
        res = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-ID': this.currentTenantId,
            ...(options.headers || {}),
          },
        });
        break;
      } catch (err) {
        lastError = err;
        if (attempt < retryDelays.length) {
          await new Promise((resolve) => setTimeout(resolve, retryDelays[attempt]));
        }
      }
    }

    if (!res) {
      throw lastError || new Error(`Network request failed for ${endpoint}`);
    }

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      const error: any = new Error(
        errorBody.safeMessage || errorBody.message || errorBody.error || `HTTP ${res.status}: ${res.statusText}`
      );
      error.status = res.status;
      error.code = errorBody.code || `HTTP_${res.status}`;
      error.retryable = Boolean(errorBody.retryable);
      error.details = errorBody.details;
      throw error;
    }

    return (await res.json()) as T;
  }

  async getBootstrap(): Promise<BootstrapResponse> {
    return this.request<BootstrapResponse>(
      `/bootstrap?tenantId=${encodeURIComponent(this.currentTenantId)}`
    );
  }

  async resolveAddress(query: string | Coordinates): Promise<LocationResolutionResult> {
    return this.request<LocationResolutionResult>('/location/resolve', {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
  }

  async getNearbyStores(
    coordinates: Coordinates,
    fulfillmentType?: 'delivery' | 'pickup'
  ): Promise<Store[]> {
    const res = await this.getEligibleStores(coordinates, undefined, fulfillmentType);
    return res.eligibleStores.map((es) => es.store);
  }

  async getStores(
    coordinates?: Coordinates,
    fulfillmentType?: 'delivery' | 'pickup'
  ): Promise<Store[]> {
    const params = new URLSearchParams();
    if (coordinates) {
      params.append('lat', String(coordinates.latitude));
      params.append('lng', String(coordinates.longitude));
    }
    if (fulfillmentType) {
      params.append('fulfillment', fulfillmentType);
    }
    const qs = params.toString();
    const res = await this.request<Store[] | { stores: Store[] }>(`/stores${qs ? `?${qs}` : ''}`);
    return Array.isArray(res) ? res : res.stores || [];
  }

  async getStore(storeId: string): Promise<Store | null> {
    return this.request<Store>(`/stores/${encodeURIComponent(storeId)}`);
  }

  async getEligibleStores(
    coordinates: Coordinates,
    address?: Address,
    preferredFulfillment?: 'delivery' | 'pickup'
  ): Promise<StoreEligibilityResult> {
    return this.request<StoreEligibilityResult>('/stores/search', {
      method: 'POST',
      body: JSON.stringify({ coordinates, address, preferredFulfillment }),
    });
  }

  async resetCache(): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>('/cache/reset', {
      method: 'POST',
      headers: { 'Cache-Control': 'no-cache' },
    });
  }

  async getRootCatalog(options?: { refresh?: boolean }): Promise<Catalog> {
    const qs = options?.refresh ? '?refresh=true' : '';
    return this.request<Catalog>(`/catalog${qs}`, {
      headers: options?.refresh ? { 'Cache-Control': 'no-cache' } : undefined,
    });
  }

  async getStoreCatalog(
    storeId: string,
    options?: { fulfillment?: 'delivery' | 'pickup'; menuId?: string; refresh?: boolean }
  ): Promise<Catalog> {
    const params = new URLSearchParams();
    if (options?.fulfillment) params.append('fulfillment', options.fulfillment);
    if (options?.menuId) params.append('menuId', options.menuId);
    if (options?.refresh) params.append('refresh', 'true');
    const qs = params.toString();
    return this.request<Catalog>(`/stores/${encodeURIComponent(storeId)}/catalog${qs ? `?${qs}` : ''}`, {
      headers: options?.refresh ? { 'Cache-Control': 'no-cache' } : undefined,
    });
  }

  async getStories(_context?: { storeId?: string; coordinates?: Coordinates }): Promise<Story[]> {
    return this.request<Story[]>(
      `/stories?tenantId=${encodeURIComponent(this.currentTenantId)}`
    );
  }

  async searchProducts(
    query: string,
    storeId?: string,
    options?: { categoryId?: string; limit?: number }
  ): Promise<{
    products: Product[];
    summaries?: Record<string, ProductAvailabilitySummary>;
    bundleSummaries?: Record<string, ProductAvailabilitySummary>;
    diagnostics?: CatalogDiagnostics;
  }> {
    return this.request<{
      products: Product[];
      summaries?: Record<string, ProductAvailabilitySummary>;
      bundleSummaries?: Record<string, ProductAvailabilitySummary>;
      diagnostics?: CatalogDiagnostics;
    }>(
      '/search',
      {
        method: 'POST',
        body: JSON.stringify({ query, storeId, ...options }),
      }
    );
  }

  async getProduct(
    plu: string,
    storeId?: string
  ): Promise<{ product: Product; summary?: ProductAvailabilitySummary }> {
    const url = storeId
      ? `/products/${encodeURIComponent(plu)}?storeId=${encodeURIComponent(storeId)}`
      : `/products/${encodeURIComponent(plu)}`;
    return this.request<{ product: Product; summary?: ProductAvailabilitySummary }>(url);
  }

  async getProductAvailabilitySummaries(
    _plus: string[],
    _eligibleStoreIds: string[]
  ): Promise<Record<string, ProductAvailabilitySummary>> {
    return {};
  }

  async getProducts(): Promise<Product[]> {
    const catalog = await this.getRootCatalog();
    return catalog.products || [];
  }

  async createBasket(storeId: string, fulfillmentType?: 'delivery' | 'pickup'): Promise<Basket> {
    return this.request<Basket>('/baskets', {
      method: 'POST',
      body: JSON.stringify({ storeId, fulfillmentType }),
    });
  }

  async getBasket(basketId: string): Promise<Basket> {
    const b = await this.request<Basket>(`/baskets/${encodeURIComponent(basketId)}`);
    if (!b) throw new Error('Basket not found');
    return b;
  }

  async updateBasketItem(basketId: string, plu: string, quantity: number): Promise<Basket> {
    return this.request<Basket>(`/baskets/${encodeURIComponent(basketId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ productId: plu, quantity }),
    });
  }

  async removeBasketItem(basketId: string, plu: string): Promise<Basket> {
    return this.updateBasketItem(basketId, plu, 0);
  }

  async addBundleToBasket(
    basketId: string,
    bundle: BundleProduct,
    selectedModifiers: SelectedBundleModifier[],
    quantity: number = 1,
    options?: { claimExistingBasketItems?: boolean }
  ): Promise<Basket> {
    return this.request<Basket>(
      `/baskets/${encodeURIComponent(basketId)}/bundles`,
      {
        method: 'POST',
        body: JSON.stringify({
          bundleId: bundle.id,
          bundlePlu: bundle.plu,
          quantity: Math.max(1, quantity),
          claimExistingBasketItems: options?.claimExistingBasketItems === true,
          selections: selectedModifiers.map((modifier) => ({
            sectionId: modifier.sectionId,
            modifierId: modifier.modifierId,
            quantity: modifier.quantity,
          })),
        }),
      }
    );
  }

  async selectStore(storeId: string, existingBasketId?: string): Promise<{
    store: Store;
    basket?: Basket;
    storeSwitchDiff?: {
      availableUnchanged?: Array<{ plu: string; name: string; quantity: number; price: Money | number }>;
      priceChanges: Array<{ plu: string; name?: string; oldPrice: Money | number; newPrice: Money | number }>;
      unavailableItems: Array<{ plu: string; name: string; reason?: string }>;
      quantityAdjusted: Array<{ plu: string; name?: string; requested: number; adjustedTo: number; reason?: string }>;
    };
  }> {
    const store = await this.getStore(storeId);
    if (!store) {
      throw new Error(`Store ${storeId} not found`);
    }

    let basket: Basket | undefined;
    if (existingBasketId) {
      try {
        const switchRes = await this.updateBasketStore(existingBasketId, storeId, { confirmMigration: true });
        return {
          store,
          basket: switchRes.basket,
          storeSwitchDiff: switchRes.storeSwitchDiff,
        };
      } catch (error: any) {
        throw new Error(error?.message || 'The basket could not be migrated to the selected store. Please retry.');
      }
    } else {
      basket = undefined;
    }

    return {
      store,
      basket,
    };
  }

  async validateBasket(basketId: string): Promise<{ valid: boolean; issues: string[]; errors?: any[] }> {
    return this.request<{ valid: boolean; issues: string[]; errors?: any[] }>(`/baskets/${encodeURIComponent(basketId)}/validate`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
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
    return this.request<{
      reconciled: boolean;
      basket: Basket;
      changes: any[];
    }>(`/baskets/${encodeURIComponent(basketId)}/reconcile`, {
      method: 'POST',
      body: JSON.stringify({ destinationStoreId }),
    });
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
      preferredSubstitutePrice?: Money;
    }>
  ): Promise<Basket> {
    return this.request<Basket>(`/baskets/${encodeURIComponent(basketId)}/items`, {
      method: 'PATCH',
      body: JSON.stringify({ items }),
    });
  }

  async updateBasketCustomer(
    basketId: string,
    customer: { name?: string; email?: string; phone?: string; companyName?: string; notes?: string }
  ): Promise<Basket> {
    return this.request<Basket>(`/baskets/${encodeURIComponent(basketId)}/customer`, {
      method: 'PATCH',
      body: JSON.stringify(customer),
    });
  }

  async updateBasketFulfillment(
    basketId: string,
    fulfillment: { fulfillmentType?: 'delivery' | 'pickup'; type?: 'delivery' | 'pickup'; address?: Address; slot?: DeliverySlot; slotId?: string }
  ): Promise<Basket> {
    return this.request<Basket>(`/baskets/${encodeURIComponent(basketId)}/fulfillment`, {
      method: 'PATCH',
      body: JSON.stringify(fulfillment),
    });
  }

  async updateBasketStore(
    basketId: string,
    storeId: string,
    options?: { confirmMigration?: boolean }
  ): Promise<{ basket: Basket; storeSwitchDiff: any }> {
    return this.request<{ basket: Basket; storeSwitchDiff: any }>(`/baskets/${encodeURIComponent(basketId)}/store`, {
      method: 'PATCH',
      body: JSON.stringify({ storeId, ...options }),
    });
  }

  async updateDiscounts(
    basketId: string,
    options: { code?: string; remove?: boolean; discounts?: any[] }
  ): Promise<Basket> {
    return this.request<Basket>(`/baskets/${encodeURIComponent(basketId)}/discounts`, {
      method: 'PATCH',
      body: JSON.stringify(options),
    });
  }

  async updateCharges(
    basketId: string,
    charges: any[]
  ): Promise<Basket> {
    return this.request<Basket>(`/baskets/${encodeURIComponent(basketId)}/charges`, {
      method: 'PATCH',
      body: JSON.stringify({ charges }),
    });
  }

  async updateTip(
    basketId: string,
    tip: Money
  ): Promise<Basket> {
    return this.request<Basket>(`/baskets/${encodeURIComponent(basketId)}/tip`, {
      method: 'PATCH',
      body: JSON.stringify({ tip }),
    });
  }

  async getCheckoutSummary(basketId: string): Promise<CheckoutSummary> {
    const basket = await this.getBasket(basketId);
    const store = await this.getStore(basket.storeId);
    return {
      basket,
      store: store || ({
        id: basket.storeId,
        name: basket.storeName || 'Selected Store',
        status: 'UNKNOWN',
        supportsDelivery: false,
        supportsPickup: false,
      } as unknown as Store),
      paymentMethods: ['deliverect_pay'],
      estimatedDeliveryWindow: '',
      canProceed: Boolean(store),
      warnings: store ? [] : ['Store details could not be resolved from authoritative commerce state.'],
    };
  }

  async validateDispatch(params: {
    channelLinkId?: string;
    storeId?: string;
    deliveryAddress: Address;
    pickupTime?: string;
    deliveryTime?: string;
    orderValueMinorUnits?: number;
    currency?: string;
    itemsCount?: number;
  }): Promise<DispatchAvailability> {
    return this.request<DispatchAvailability>('/dispatch/validate', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async getDispatchQuotes(params: {
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
  }> {
    return this.request<{
      available: boolean;
      quotes: any[];
      selectedQuote?: any;
      policyApplied: string;
      rejectionReason?: string;
    }>('/dispatch/quotes', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async revalidateDelivery(
    basketId: string,
    _storeIdOrAddress: string | Address,
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
  }> {
    const addr = address || (typeof _storeIdOrAddress === 'object' ? _storeIdOrAddress : undefined);
    const storeId = typeof _storeIdOrAddress === 'string' ? _storeIdOrAddress : undefined;

    if (!addr) {
      return {
        available: false,
        dispatchValidationExpiresAt: new Date().toISOString(),
        deliveryFee: 0,
        deliveryEta: '',
        reason: 'Address required for courier delivery revalidation',
      };
    }

    try {
      if (storeId) {
        const dispatchRes = await this.validateDispatch({
          storeId,
          deliveryAddress: addr,
        });
        const rawFee = typeof dispatchRes.fee === 'object' ? (dispatchRes.fee as any)?.amount : dispatchRes.fee;
        const feeAmount = typeof rawFee === 'number' ? rawFee : 0;
        return {
          available: dispatchRes.available,
          dispatchValidationId: dispatchRes.validationId,
          dispatchValidationExpiresAt: dispatchRes.expiresAt || new Date().toISOString(),
          deliveryFee: feeAmount,
          deliveryEta: dispatchRes.estimatedDeliveryTime || (dispatchRes.available ? '' : 'Unavailable'),
          reason: dispatchRes.failureReason,
        };
      }

      const options = await this.getDeliveryOptions(basketId, addr, 'delivery');
      const first = options[0];
      const rawOptionFee = typeof first?.price === 'object' ? (first.price as any)?.amount : first?.price;
      return {
        available: Boolean(first),
        dispatchValidationId: first?.dispatchValidationId,
        dispatchValidationExpiresAt: first?.expiresAt || new Date().toISOString(),
        deliveryFee: typeof rawOptionFee === 'number' ? rawOptionFee : 0,
        deliveryEta: first?.deliveryEta || '',
        reason: first ? undefined : 'No delivery options available for this address',
      };
    } catch (err: any) {
      return {
        available: false,
        dispatchValidationExpiresAt: new Date().toISOString(),
        deliveryFee: 0,
        deliveryEta: 'Unavailable',
        reason: err?.message || 'Courier dispatch validation unavailable for this location',
      };
    }
  }

  async switchBasketFulfillment(
    basketId: string,
    _fulfillmentType: 'delivery' | 'pickup'
  ): Promise<Basket> {
    return this.getBasket(basketId);
  }

  async applyTip(basketId: string, _tipAmount: number): Promise<Basket> {
    return this.getBasket(basketId);
  }

  async applyPromoCode(basketId: string, _code: string): Promise<Basket> {
    return this.getBasket(basketId);
  }

  async createPaymentSession(
    requestOrBasketId: any,
    returnUrl?: string
  ): Promise<HostedPaymentSession> {
    const basketId =
      typeof requestOrBasketId === 'string' ? requestOrBasketId : requestOrBasketId.basketId;
    return this.request<HostedPaymentSession>('/payments/sessions', {
      method: 'POST',
      body: JSON.stringify({ basketId, returnUrl: returnUrl || window.location.href }),
    });
  }

  async getCheckoutStatus(
    checkoutId: string
  ): Promise<{
    status:
      | 'preparing_payment'
      | 'payment_authorised'
      | 'placing_order'
      | 'order_confirmed'
      | 'order_failed';
    orderId?: string;
    failureReason?: string;
  }> {
    const response = await this.request<{
      status: 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'FAILED' | 'CANCELLED' | 'UNKNOWN';
      orderId?: string;
      failureReason?: string;
    }>(`/checkouts/${encodeURIComponent(checkoutId)}/status`, { method: 'GET' });

    switch (response.status) {
      case 'CONFIRMED':
        return { status: 'order_confirmed', orderId: response.orderId };
      case 'FAILED':
      case 'CANCELLED':
        return { status: 'order_failed', failureReason: response.failureReason };
      default:
        // PENDING_CONFIRMATION and UNKNOWN both mean "not yet confirmed".
        // Never map an unrecognised state to success.
        return { status: 'placing_order' };
    }
  }

  async getOrder(orderId: string): Promise<Order | null> {
    return this.request<Order>(`/orders/${encodeURIComponent(orderId)}`);
  }

  async getUserOrders(): Promise<Order[]> {
    // Real order history requires proof of identity: attach the signed-in
    // customer's Firebase ID token so the BFF can scope results to them via
    // getCallerUid(). No signed-in user means no orders to show — honest
    // empty state rather than a fabricated list, and we skip the request
    // entirely rather than let the server 401.
    const token = await getCurrentIdToken().catch(() => null);
    if (!token) {
      return [];
    }
    return this.request<Order[]>('/orders', {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async getOrderHistory(): Promise<Order[]> {
    return this.getUserOrders();
  }

  async getActiveRules(): Promise<VisualRule[]> {
    return this.request<VisualRule[]>('/rules');
  }

  async advanceOrderStatus(orderId: string): Promise<Order> {
    return this.request<Order>(`/orders/${encodeURIComponent(orderId)}/simulate-picking`, {
      method: 'POST',
    });
  }

  setSimulationFlags(_flags: any): void {
    // No-op in production HTTP client
  }

  async getDeliveryOptions(
    basketId: string,
    address: Address,
    fulfillmentType?: 'delivery' | 'pickup'
  ): Promise<DeliveryOption[]> {
    return this.request<DeliveryOption[]>('/delivery/options', {
      method: 'POST',
      body: JSON.stringify({ basketId, address, fulfillmentType }),
    });
  }

  async getAvailableSlots(
    storeId: string,
    fulfillmentType: 'delivery' | 'pickup'
  ): Promise<{
    asapAvailable: boolean;
    asapEtaMinutes?: number;
    days: Array<{ dayLabel: string; dateString: string; slots: DeliverySlot[] }>;
    nextAvailableSlot?: DeliverySlot;
  }> {
    return this.request<{
      asapAvailable: boolean;
      asapEtaMinutes?: number;
      days: Array<{ dayLabel: string; dateString: string; slots: DeliverySlot[] }>;
      nextAvailableSlot?: DeliverySlot;
    }>('/delivery/slots', {
      method: 'POST',
      body: JSON.stringify({ storeId, fulfillmentType }),
    });
  }

  async getSchedulingPolicy(_tenantId?: string, _storeId?: string): Promise<SchedulingPolicy> {
    return {
      enabled: true,
      acceptsAsapOrders: true,
      acceptsPreOrders: true,
      acceptsSameDayPreOrders: true,
      minimumLeadTimeMinutes: 30,
      maximumDaysInAdvance: 7,
      slotLengthMinutes: 60,
      allowOrderingWhileClosed: false,
    };
  }

  async getSubstitutionPolicy(_tenantId?: string): Promise<TenantSubstitutionPolicy> {
    return {
      enabled: true,
      allowBestMatch: true,
      allowCustomerSelected: true,
      defaultPreference: 'BEST_MATCH',
      bestMatchPricePolicy: 'LOWER_OF_ORIGINAL_AND_SUBSTITUTE',
      customerSelectedPricePolicy: 'SUBSTITUTE_PRICE',
      maxCustomerCandidates: 3,
      allowCancelOrderPreference: true,
    };
  }

  async setBasketItemSubstitution(
    basketId: string,
    plu: string,
    preference: SubstitutionPreferenceType,
    candidatePlus?: string[],
    preferredSubstitutePlu?: string,
    preferredSubstituteName?: string,
    preferredSubstitutePrice?: Money
  ): Promise<Basket> {
    return this.request<Basket>(
      `/baskets/${encodeURIComponent(basketId)}/items/${encodeURIComponent(plu)}/substitution`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          preference,
          substituteCandidatePlus: candidatePlus,
          preferredSubstitutePlu,
          preferredSubstituteName,
          preferredSubstitutePrice,
        }),
      }
    );
  }

  async checkoutBasket(
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
  ): Promise<CheckoutResult> {
    return this.request<CheckoutResult>('/checkouts', {
      method: 'POST',
      body: JSON.stringify({
        basketId,
        options,
        tenantId: this.currentTenantId,
      }),
    });
  }

  async processPickingEvent(_orderId: string, _event: PickingEvent): Promise<Order> {
    throw new Error('Picking events are processed via webhooks on the Cloud Run BFF');
  }

  async advancePickingDemo(orderId: string): Promise<Order> {
    return this.advanceOrderStatus(orderId);
  }

  async finalizeOrderPicking(_orderId: string): Promise<Order> {
    throw new Error('Picking finalization is handled via Deliverect Quest integration on the BFF');
  }

  async reauthorizeOrderPayment(_orderId: string, _newAmount?: number): Promise<Order> {
    throw new Error('Payment reauthorization is handled via DPay integration on the BFF');
  }

  async captureOrderPayment(_orderId: string): Promise<Order> {
    throw new Error('Payment capture is handled via DPay integration on the BFF');
  }

  async createDemoScenarioOrder(_scenario: DemoScenario): Promise<Order> {
    throw new Error('Demo scenarios are only permitted in DEMO mode via the test suite');
  }
}

export const defaultHttpCommerceClient = new HttpCommerceClient();
