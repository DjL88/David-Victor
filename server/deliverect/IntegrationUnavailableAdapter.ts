import { DeliverectAdapter } from './DeliverectAdapter';
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
} from '../../src/commerce/models';

export class IntegrationUnavailableAdapter implements DeliverectAdapter {
  readonly adapterName = 'IntegrationUnavailableAdapter';
  readonly isConnected = false;

  constructor(
    public readonly environment: string = 'staging',
    public readonly tenantId: string = 'default'
  ) {}

  async testConnection(): Promise<{ success: boolean; message: string; latencyMs: number }> {
    return {
      success: false,
      message: 'Deliverect live integration is not configured. Active DELIVERECT_CLIENT_ID and DELIVERECT_CLIENT_SECRET environment variables are required.',
      latencyMs: 0,
    };
  }

  private throwUnavailable(operation: string): never {
    const error: any = new Error(
      `Deliverect Commerce Integration is not configured for staging/production. Live credentials (DELIVERECT_CLIENT_ID / DELIVERECT_CLIENT_SECRET) are required for ${operation}.`
    );
    error.status = 503;
    error.statusCode = 503;
    error.code = 'INTEGRATION_NOT_CONFIGURED';
    throw error;
  }

  async getStores(_coords?: Coordinates, _fulfillmentType?: 'delivery' | 'pickup'): Promise<Store[]> {
    this.throwUnavailable('getStores');
  }

  async getStore(_storeId: string): Promise<Store | null> {
    this.throwUnavailable('getStore');
  }

  async getEligibleStores(
    _coords: Coordinates,
    _address?: Address,
    _preferredFulfillment?: 'delivery' | 'pickup'
  ): Promise<StoreEligibilityResult> {
    this.throwUnavailable('getEligibleStores');
  }

  async getRootCatalog(): Promise<Catalog> {
    this.throwUnavailable('getRootCatalog');
  }

  async getStoreCatalog(_storeId: string, _fulfillmentType?: 'delivery' | 'pickup'): Promise<Catalog> {
    this.throwUnavailable('getStoreCatalog');
  }

  async getProduct(_productId: string, _storeId?: string): Promise<{ product: Product; summary?: ProductAvailabilitySummary } | null> {
    this.throwUnavailable('getProduct');
  }

  async searchProducts(_query: string, _storeId?: string, _options?: { categoryId?: string; limit?: number }): Promise<{ products: Product[]; summaries?: Record<string, ProductAvailabilitySummary> }> {
    this.throwUnavailable('searchProducts');
  }

  async createBasket(_storeId?: string, _fulfillmentType?: 'delivery' | 'pickup'): Promise<Basket> {
    this.throwUnavailable('createBasket');
  }

  async getBasket(_basketId: string): Promise<Basket | null> {
    this.throwUnavailable('getBasket');
  }

  async updateBasketItem(_basketId: string, _productId: string, _quantity: number): Promise<Basket> {
    this.throwUnavailable('updateBasketItem');
  }

  async updateBasketItems(_basketId: string, _items: any[]): Promise<Basket> {
    this.throwUnavailable('updateBasketItems');
  }

  async updateBasketCustomer(_basketId: string, _customer: any): Promise<Basket> {
    this.throwUnavailable('updateBasketCustomer');
  }

  async updateBasketFulfillment(_basketId: string, _fulfillment: any): Promise<Basket> {
    this.throwUnavailable('updateBasketFulfillment');
  }

  async updateBasketStore(_basketId: string, _storeId: string, _options?: any): Promise<any> {
    this.throwUnavailable('updateBasketStore');
  }

  async updateDiscounts(_basketId: string, _options: any): Promise<Basket> {
    this.throwUnavailable('updateDiscounts');
  }

  async updateCharges(_basketId: string, _charges: any[]): Promise<Basket> {
    this.throwUnavailable('updateCharges');
  }

  async updateTip(_basketId: string, _tip: any): Promise<Basket> {
    this.throwUnavailable('updateTip');
  }

  async validateBasket(_basketId: string): Promise<{ valid: boolean; issues: string[]; errors?: any[] }> {
    this.throwUnavailable('validateBasket');
  }

  async reconcileBasket(_basketId: string, _destinationStoreId?: string): Promise<any> {
    this.throwUnavailable('reconcileBasket');
  }

  async getDeliveryOptions(_basketId: string, _address: Address, _fulfillmentType?: 'delivery' | 'pickup'): Promise<DeliveryOption[]> {
    this.throwUnavailable('getDeliveryOptions');
  }

  async getAvailableSlots(_storeId: string, _fulfillmentType?: 'delivery' | 'pickup'): Promise<{
    asapAvailable: boolean;
    asapEtaMinutes?: number;
    days: Array<{ dayLabel: string; dateString: string; slots: DeliverySlot[] }>;
    nextAvailableSlot?: DeliverySlot;
  }> {
    this.throwUnavailable('getAvailableSlots');
  }

  async createPaymentSession(_basketId: string, _amount?: Money, _currency?: string): Promise<HostedPaymentSession> {
    this.throwUnavailable('createPaymentSession');
  }

  async checkoutBasket(_basketId: string, _options?: {
    deliveryOptionId?: string;
    slotId?: string;
    schedulingType?: FulfillmentSchedulingType;
    paymentTokenRef?: string;
    authorizationMaximum?: Money;
    customerNotes?: string;
    deliveryAddress?: Address;
    dispatchValidationId?: string;
    dispatchValidationExpiresAt?: string;
  }): Promise<Order> {
    this.throwUnavailable('checkoutBasket');
  }

  async getOrder(_orderId: string): Promise<Order | null> {
    this.throwUnavailable('getOrder');
  }

  async advancePickingDemo(_orderId: string): Promise<Order | null> {
    this.throwUnavailable('advancePickingDemo');
  }
}
