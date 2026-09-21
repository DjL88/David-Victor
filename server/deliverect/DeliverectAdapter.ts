import {
  Store,
  StoreEligibilityResult,
  Catalog,
  CatalogDiagnostics,
  Product,
  ProductAvailabilitySummary,
  Basket,
  Coordinates,
  Address,
  DeliveryOption,
  DeliverySlot,
  HostedPaymentSession,
  Order,
  OrderPaymentInfo,
  TenantSubstitutionPolicy,
  Money,
  FulfillmentSchedulingType,
  PickingEvent,
  BundleCatalog,
} from '../../src/commerce/models';
import { CheckoutResult } from '../../src/domain/models';
import type { AddBundleToBasketRequest } from '../../src/commerce/bundleModels';

export interface DeliverectAdapter {
  readonly adapterName: string;
  readonly isConnected: boolean;

  testConnection?(accountId?: string): Promise<{ success: boolean; message: string; latencyMs: number }>;

  getStores(coords?: Coordinates, fulfillmentType?: 'delivery' | 'pickup'): Promise<Store[]>;
  getStore(storeId: string): Promise<Store | null>;
  getEligibleStores(
    coords: Coordinates,
    address?: Address,
    preferredFulfillment?: 'delivery' | 'pickup'
  ): Promise<StoreEligibilityResult>;

  getRootCatalog(): Promise<Catalog>;
  getStoreCatalog(storeId: string, fulfillmentType?: 'delivery' | 'pickup', menuId?: string): Promise<Catalog>;
  getBundleCatalog?(storeId?: string, fulfillmentType?: 'delivery' | 'pickup', menuId?: string): Promise<BundleCatalog>;
  getProduct(productId: string, storeId?: string): Promise<{ product: Product; summary?: ProductAvailabilitySummary } | null>;
  searchProducts(
    query: string,
    storeId?: string,
    options?: { categoryId?: string; limit?: number }
  ): Promise<{
    products: Product[];
    summaries?: Record<string, ProductAvailabilitySummary>;
    diagnostics?: CatalogDiagnostics;
  }>;

  createBasket(storeId?: string, fulfillmentType?: 'delivery' | 'pickup'): Promise<Basket>;
  getBasket(basketId: string): Promise<Basket | null>;
  updateBasketItem(basketId: string, productId: string, quantity: number): Promise<Basket>;
  updateBasketItems?(
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
  ): Promise<Basket>;
  addBundleToBasket?(
    basketId: string,
    request: AddBundleToBasketRequest
  ): Promise<Basket>;
  updateBasketCustomer?(
    basketId: string,
    customer: { name?: string; email?: string; phone?: string; companyName?: string; notes?: string }
  ): Promise<Basket>;
  updateBasketFulfillment?(
    basketId: string,
    fulfillment: { fulfillmentType?: 'delivery' | 'pickup'; type?: 'delivery' | 'pickup'; address?: Address; slot?: DeliverySlot; slotId?: string }
  ): Promise<Basket>;
  updateBasketStore?(
    basketId: string,
    storeId: string,
    options?: { confirmMigration?: boolean }
  ): Promise<{ basket: Basket; storeSwitchDiff: any }>;
  updateDiscounts?(
    basketId: string,
    options: { code?: string; remove?: boolean; discounts?: any[] }
  ): Promise<Basket>;
  updateCharges?(
    basketId: string,
    charges: any[]
  ): Promise<Basket>;
  updateTip?(
    basketId: string,
    tip: Money
  ): Promise<Basket>;
  validateBasket?(
    basketId: string
  ): Promise<{ valid: boolean; issues: string[]; errors?: any[] }>;
  reconcileBasket?(
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
  }>;

  getDeliveryOptions(basketId: string, address: Address, fulfillmentType?: 'delivery' | 'pickup'): Promise<DeliveryOption[]>;
  getAvailableSlots(storeId: string, fulfillmentType?: 'delivery' | 'pickup'): Promise<{
    asapAvailable: boolean;
    asapEtaMinutes?: number;
    days: Array<{ dayLabel: string; dateString: string; slots: DeliverySlot[] }>;
    nextAvailableSlot?: DeliverySlot;
  }>;

  createPaymentSession(basketId: string, amount?: Money, currency?: string): Promise<HostedPaymentSession>;

  checkoutBasket(basketId: string, options?: {
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
  }): Promise<Order>;

  checkout?(basketId: string, options?: {
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
  }): Promise<CheckoutResult>;

  getCheckout?(checkoutId: string): Promise<CheckoutResult | null>;
  confirmCheckoutDemo?(checkoutId: string): Promise<CheckoutResult | null>;

  getOrder(orderId: string): Promise<Order | null>;
  /** Demo/sandbox-only capability: manually advances a simulated order's picking state. Not part of the live Deliverect contract. */
  advancePickingDemo?(orderId: string): Promise<Order | null>;
}
