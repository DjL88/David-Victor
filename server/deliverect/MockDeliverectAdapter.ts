import { DeliverectAdapter } from './DeliverectAdapter';
import { defaultCommerceClient } from '../../src/commerce/MockCommerceClient';
import { CommerceDiscoveryService } from './CommerceDiscoveryService';
import {
  Store,
  StoreEligibilityResult,
  Catalog,
  Product,
  ProductAvailabilitySummary,
  Basket,
  Coordinates,
  Address,
  DeliveryOption,
  DeliverySlot,
  HostedPaymentSession,
  Order,
  Money,
  FulfillmentSchedulingType,
  CatalogDiagnostics,
} from '../../src/commerce/models';
import { CheckoutResult } from '../../src/domain/models';
import { getServerRuntimeMode } from '../runtimeMode';

export class MockDeliverectAdapter implements DeliverectAdapter {
  readonly adapterName = 'MockDeliverectAdapter (Deliverect Commerce Simulator)';
  readonly isConnected = false;
  private discoveryService = CommerceDiscoveryService.getInstance();

  constructor() {
    const mode = getServerRuntimeMode();
    if (mode !== 'demo') {
      throw new Error(
        `[Security Violation] MockDeliverectAdapter instantiated in non-demo mode ("${mode}"). Live Deliverect integration is required.`
      );
    }
  }

  async testConnection(accountId?: string): Promise<{ success: boolean; message: string; latencyMs: number }> {
    const appMode = getServerRuntimeMode();
    if (appMode !== 'demo') {
      return {
        success: false,
        message: 'Mock Deliverect adapter is not permitted in staging/production. Live API credentials are required.',
        latencyMs: 15,
      };
    }
    return {
      success: true,
      message: `[Demo Sandbox] Mock Deliverect handshake verified for channel account ${accountId || 'sandbox-demo'}.`,
      latencyMs: 40,
    };
  }

  async getStores(coords?: Coordinates, fulfillmentType?: 'delivery' | 'pickup'): Promise<Store[]> {
    if (coords) {
      return defaultCommerceClient.getNearbyStores(coords, fulfillmentType);
    }
    return defaultCommerceClient.getNearbyStores({ latitude: 51.7356, longitude: 0.4685 }, fulfillmentType);
  }

  async getStore(storeId: string): Promise<Store | null> {
    return defaultCommerceClient.getStore(storeId);
  }

  async getEligibleStores(
    coords: Coordinates,
    address?: Address,
    preferredFulfillment?: 'delivery' | 'pickup'
  ): Promise<StoreEligibilityResult> {
    return this.discoveryService.discoverStores({
      coordinates: coords,
      address,
      preferredFulfillment,
      tenantId: 'brand-alpha',
      appMode: 'demo',
    });
  }

  async getRootCatalog(): Promise<Catalog> {
    return defaultCommerceClient.getRootCatalog();
  }

  async getStoreCatalog(storeId: string, fulfillmentType?: 'delivery' | 'pickup'): Promise<Catalog> {
    return this.discoveryService.getStoreCatalog({
      tenantId: 'brand-alpha',
      storeId,
      fulfillmentType,
      appMode: 'demo',
    });
  }

  async getProduct(productId: string, storeId?: string): Promise<{ product: Product; summary?: ProductAvailabilitySummary } | null> {
    return defaultCommerceClient.getProduct(productId, storeId);
  }

  async searchProducts(
    query: string,
    storeId?: string,
    options?: { categoryId?: string; limit?: number }
  ): Promise<{
    products: Product[];
    summaries?: Record<string, ProductAvailabilitySummary>;
    diagnostics?: CatalogDiagnostics;
  }> {
    return defaultCommerceClient.searchProducts(query, storeId, options);
  }

  async createBasket(storeId?: string, fulfillmentType?: 'delivery' | 'pickup'): Promise<Basket> {
    return defaultCommerceClient.createBasket(storeId || 'store-01', fulfillmentType);
  }

  async getBasket(basketId: string): Promise<Basket | null> {
    return defaultCommerceClient.getBasket(basketId);
  }

  async updateBasketItem(basketId: string, productId: string, quantity: number): Promise<Basket> {
    return defaultCommerceClient.updateBasketItem(basketId, productId, quantity);
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
    return (defaultCommerceClient as any).updateBasketItems(basketId, items);
  }

  async updateBasketCustomer(
    basketId: string,
    customer: { name?: string; email?: string; phone?: string; companyName?: string; notes?: string }
  ): Promise<Basket> {
    return (defaultCommerceClient as any).updateBasketCustomer(basketId, customer);
  }

  async updateBasketFulfillment(
    basketId: string,
    fulfillment: { fulfillmentType?: 'delivery' | 'pickup'; type?: 'delivery' | 'pickup'; address?: Address; slot?: DeliverySlot; slotId?: string }
  ): Promise<Basket> {
    return (defaultCommerceClient as any).updateBasketFulfillment(basketId, fulfillment);
  }

  async updateBasketStore(
    basketId: string,
    storeId: string,
    options?: { confirmMigration?: boolean }
  ): Promise<{ basket: Basket; storeSwitchDiff: any }> {
    return (defaultCommerceClient as any).updateBasketStore(basketId, storeId, options);
  }

  async updateDiscounts(
    basketId: string,
    options: { code?: string; remove?: boolean; discounts?: any[] }
  ): Promise<Basket> {
    if (options.code) {
      return (defaultCommerceClient as any).applyPromoCode(basketId, options.code);
    }
    const b = await defaultCommerceClient.getBasket(basketId);
    if (!b) throw new Error('Basket not found');
    if (options.remove) {
      b.discounts = [];
      (defaultCommerceClient as any).recalculateBasketTotals(b);
    }
    return b;
  }

  async updateCharges(
    basketId: string,
    charges: any[]
  ): Promise<Basket> {
    return (defaultCommerceClient as any).updateBasketCharges(basketId, charges);
  }

  async updateTip(
    basketId: string,
    tip: Money
  ): Promise<Basket> {
    return (defaultCommerceClient as any).updateBasketTip(basketId, tip);
  }

  async validateBasket(
    basketId: string
  ): Promise<{ valid: boolean; issues: string[]; errors?: any[] }> {
    return defaultCommerceClient.validateBasket(basketId);
  }

  async reconcileBasket(
    basketId: string,
    destinationStoreId?: string
  ): Promise<{
    reconciled: boolean;
    basket: Basket;
    changes: any[];
  }> {
    return (defaultCommerceClient as any).reconcileBasket(basketId, destinationStoreId);
  }

  async getDeliveryOptions(basketId: string, address: Address, fulfillmentType?: 'delivery' | 'pickup'): Promise<DeliveryOption[]> {
    return defaultCommerceClient.getDeliveryOptions
      ? defaultCommerceClient.getDeliveryOptions(basketId, address, fulfillmentType)
      : [];
  }

  async getAvailableSlots(storeId: string, fulfillmentType?: 'delivery' | 'pickup'): Promise<{
    asapAvailable: boolean;
    asapEtaMinutes?: number;
    days: Array<{ dayLabel: string; dateString: string; slots: DeliverySlot[] }>;
    nextAvailableSlot?: DeliverySlot;
  }> {
    return defaultCommerceClient.getAvailableSlots
      ? defaultCommerceClient.getAvailableSlots(storeId, fulfillmentType || 'delivery')
      : { asapAvailable: true, days: [] };
  }

  async createPaymentSession(basketId: string, _amount?: Money, _currency?: string): Promise<HostedPaymentSession> {
    return defaultCommerceClient.createPaymentSession(basketId);
  }

  async checkoutBasket(basketId: string, options?: {
    deliveryOptionId?: string;
    slotId?: string;
    schedulingType?: FulfillmentSchedulingType;
    paymentTokenRef?: string;
    authorizationMaximum?: Money;
    customerNotes?: string;
    deliveryAddress?: Address;
    dispatchValidationId?: string;
    dispatchValidationExpiresAt?: string;
    idempotencyKey?: string;
    channelOrderReference?: string;
  }): Promise<Order> {
    return defaultCommerceClient.checkoutBasket(basketId, options);
  }

  async checkout(basketId: string, options?: {
    deliveryOptionId?: string;
    slotId?: string;
    schedulingType?: FulfillmentSchedulingType;
    paymentTokenRef?: string;
    authorizationMaximum?: Money;
    customerNotes?: string;
    deliveryAddress?: Address;
    dispatchValidationId?: string;
    dispatchValidationExpiresAt?: string;
    idempotencyKey?: string;
    channelOrderReference?: string;
    tenantId?: string;
  }): Promise<CheckoutResult> {
    const basket = await defaultCommerceClient.getBasket(basketId);
    if (!basket) {
      throw new Error(`Basket "${basketId}" not found`);
    }

    const order = await defaultCommerceClient.checkoutBasket(basketId, options);
    const checkoutId = `chk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const channelOrderReference = options?.channelOrderReference || order.orderReference || `ORD-${Date.now().toString().slice(-6)}`;
    const now = new Date().toISOString();

    const checkoutResult: CheckoutResult = {
      checkoutId,
      channelOrderReference,
      orderId: order.id,
      tenantId: options?.tenantId || 'brand-alpha',
      storeId: order.storeId,
      channelLinkId: order.storeId,
      status: 'CHECKOUT_PENDING_CONFIRMATION',
      basketId,
      fulfillmentType: basket.fulfillmentType || 'delivery',
      total: basket.total,
      idempotencyKey: options?.idempotencyKey,
      dispatchValidationId: options?.dispatchValidationId,
      order,
      createdAt: now,
      updatedAt: now,
    };

    return checkoutResult;
  }

  async getCheckout(checkoutId: string): Promise<CheckoutResult | null> {
    return null;
  }

  async confirmCheckoutDemo(checkoutId: string): Promise<CheckoutResult | null> {
    return null;
  }

  async getOrder(orderId: string): Promise<Order | null> {
    return defaultCommerceClient.getOrder(orderId);
  }

  async advancePickingDemo(orderId: string): Promise<Order | null> {
    return defaultCommerceClient.advancePickingDemo
      ? defaultCommerceClient.advancePickingDemo(orderId)
      : null;
  }
}
