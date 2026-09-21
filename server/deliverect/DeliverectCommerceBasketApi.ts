/**
 * Deliverect Commerce Basket API
 *
 * Narrow, raw-contract client for the Deliverect Commerce basket -> checkout path.
 *
 * Verified Deliverect Commerce contracts used here (confirmed against the official
 * Deliverect API reference at developers.deliverect.com, Ordering Experience v3.0):
 *   POST  /commerce/{accountId}/baskets
 *   GET   /commerce/{accountId}/baskets/{basketId}
 *   PATCH /commerce/{accountId}/baskets/{basketId}/items
 *   PATCH /commerce/{accountId}/baskets/{basketId}/fulfillment
 *   POST  /commerce/{accountId}/baskets/{basketId}/reconcile
 *   POST  /commerce/{accountId}/v2/checkouts
 */

import { randomUUID } from 'node:crypto';
import { OAuthTokenManager } from './OAuthTokenManager';

export type JsonObject = Record<string, any>;

export interface CommerceBasketItemInput {
  menuId: string;
  plu: string;
  quantity: number;
  note?: string;
  subItems?: Array<{
    plu: string;
    customizationPlu?: string;
    quantity: number;
  }>;
}

export interface CommerceBasketCustomerInput {
  name?: string;
  companyName?: string;
  phoneNumber?: string;
  email?: string;
  externalId?: string;
}

export interface CommerceBasketStoreInput {
  storeId?: string;
  channelLinkId?: string;
}

export interface CommercePickupCustomerInput {
  name?: string;
  companyName?: string;
  phoneNumber?: string;
  email?: string;
  externalId?: string;
}

export interface CreatePickupBasketParams {
  channelLinkId?: string;
  storeId?: string;
  pickupTime?: string;
  pickupNotes?: string;
  items?: CommerceBasketItemInput[];
  customer?: CommercePickupCustomerInput;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
}

export interface UnpaidPickupCheckoutInput {
  basketId: string;
  amountMinor: number;
  channelOrderId?: string;
  channelOrderDisplayId?: string;
  externalPaymentId?: string;
  by?: string;
  includeCutlery?: boolean;
  customer?: CommercePickupCustomerInput;
  note?: string;
  orderNote?: string;
}

export interface CommerceCheckoutResult {
  accepted: boolean;
  rawResponse: JsonObject;
  checkout: JsonObject;
  checkoutId?: string;
  channelOrderId?: string;
  channelOrderDisplayId?: string;
  statusUrl?: string;
}

export interface CreatePickupTestOrderParams {
  channelLinkId: string;
  menuId?: string;
  plu?: string;
  quantity?: number;
  items?: CommerceBasketItemInput[];
  pickupTime?: string;
  pickupNotes?: string;
  orderNote?: string;
  customer?: CommercePickupCustomerInput;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  performCheckout?: boolean;
}

export interface CreatePickupTestOrderResult {
  basketId: string;
  basket: JsonObject;
  totalMinor: number;
  reconcileResponse: JsonObject;
  checkout?: JsonObject;
  checkoutResult?: CommerceCheckoutResult;
  channelOrderId?: string;
  channelOrderDisplayId?: string;
}

export class DeliverectCommerceBasketApiError extends Error {
  readonly code: string;
  readonly statusCode?: number;
  readonly status?: number;
  readonly responseBody?: unknown;
  readonly upstreamBody?: unknown;
  readonly operation?: string;

  constructor(
    message: string,
    code = 'DELIVERECT_COMMERCE_API_FAILED',
    statusCode?: number,
    responseBody?: unknown,
    operation?: string
  ) {
    super(message);
    this.name = 'DeliverectCommerceBasketApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.status = statusCode;
    this.responseBody = responseBody;
    this.upstreamBody = responseBody;
    this.operation = operation;
  }
}

export class DeliverectCommerceBasketApiClient {
  private readonly baseUrl: string;

  constructor(
    private readonly tokenManager: OAuthTokenManager,
    private readonly accountId: string,
    baseUrl?: string
  ) {
    this.baseUrl = (baseUrl || 'https://api.staging.deliverect.com').replace(/\/+$/, '');
  }

  private async request<T = JsonObject>(
    method: string,
    path: string,
    body?: unknown,
    operationName = 'Deliverect Commerce API Request',
    isRetry = false
  ): Promise<T> {
    const token = await this.tokenManager.getAccessToken();
    const url = `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    const init: RequestInit = {
      method,
      headers,
    };

    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }

    let response: Response;
    try {
      response = await fetch(url, init);
    } catch (err: any) {
      throw new DeliverectCommerceBasketApiError(
        `Network error calling Deliverect Commerce API (${method} ${path}): ${err?.message || err}`,
        'DELIVERECT_NETWORK_ERROR',
        undefined,
        undefined,
        operationName
      );
    }

    const text = await response.text();
    let json: JsonObject = {};
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = { rawText: text };
      }
    }

    if (response.status === 401) {
      if (!isRetry) {
        this.tokenManager.invalidateCache();
        return this.request<T>(method, path, body, operationName, true);
      }
      const detail = json?.message || json?.error || response.statusText;
      throw new DeliverectCommerceBasketApiError(
        `${operationName} failed with Deliverect HTTP 401: ${detail}`,
        'DELIVERECT_UNAUTHORIZED',
        401,
        json,
        operationName
      );
    }

    if (!response.ok) {
      const detail = json?.message || json?.error || response.statusText;
      let errorCode = 'DELIVERECT_HTTP_ERROR';
      if (response.status === 403 || json?.code === 'insufficient_permissions') {
        errorCode = 'BASKET_WRITE_PERMISSION_REQUIRED';
      }
      throw new DeliverectCommerceBasketApiError(
        `${operationName} failed with Deliverect HTTP ${response.status}: ${detail}`,
        errorCode,
        response.status,
        json,
        operationName
      );
    }

    return json as T;
  }

  async createPickupBasket(params: CreatePickupBasketParams): Promise<JsonObject> {
    const path = `/commerce/${this.accountId}/baskets`;
    const storeId = params.channelLinkId || params.storeId;

    let customerObj: CommercePickupCustomerInput | undefined = params.customer;
    if (!customerObj && (params.customerName || params.customerEmail || params.customerPhone)) {
      customerObj = {
        name: params.customerName,
        email: params.customerEmail,
        phoneNumber: params.customerPhone,
      };
    }

    const payload: JsonObject = {
      storeId,
      fulfillment: {
        type: 'pickup',
        // Deliverect's documented field is "time" (ISO datetime), not "pickupTime" —
        // the latter is silently ignored by the API. Keeping the params field named
        // pickupTime internally for clarity; only the outgoing JSON key must match
        // Deliverect's contract.
        ...(params.pickupTime ? { time: params.pickupTime } : {}),
        ...(params.pickupNotes ? { pickupNotes: params.pickupNotes } : {}),
      },
      ...(customerObj ? { customer: customerObj } : {}),
      ...(params.items && params.items.length > 0 ? { items: params.items } : {}),
    };

    return this.request('POST', path, payload, 'Create pickup basket');
  }

  async getBasket(basketId: string): Promise<JsonObject> {
    const path = `/commerce/${this.accountId}/baskets/${encodeURIComponent(basketId)}`;
    return this.request('GET', path, undefined, 'Get basket');
  }

  async updateCustomer(
    basketId: string,
    customer: CommerceBasketCustomerInput
  ): Promise<JsonObject> {
    const path = `/commerce/${this.accountId}/baskets/${encodeURIComponent(basketId)}/customer`;
    return this.request('PATCH', path, customer, 'Update basket customer');
  }

  async updateStore(
    basketId: string,
    storeId: string
  ): Promise<JsonObject> {
    const path = `/commerce/${this.accountId}/baskets/${encodeURIComponent(basketId)}/store`;
    return this.request('PATCH', path, { storeId }, 'Update basket store');
  }

  /**
   * PATCH /commerce/{accountId}/baskets/{basketId}/fulfillment
   * Updates the fulfilment type and/or requested time on an existing basket.
   * Pickup-only for now (matches the rest of this client); `time` is an ISO
   * datetime string that must fall within the store's real operating hours.
   */
  async updateFulfillment(
    basketId: string,
    fulfillment: { type: 'pickup'; time?: string; pickupNotes?: string }
  ): Promise<JsonObject> {
    const path = `/commerce/${this.accountId}/baskets/${encodeURIComponent(basketId)}/fulfillment`;
    return this.request('PATCH', path, fulfillment, 'Update basket fulfillment');
  }

  async validateBasket(basketId: string): Promise<JsonObject> {
    const path = `/commerce/${this.accountId}/baskets/${encodeURIComponent(basketId)}/validate`;
    return this.request('POST', path, {}, 'Validate basket');
  }

  async replaceItems(basketId: string, items: CommerceBasketItemInput[]): Promise<JsonObject> {
    if (!Array.isArray(items)) {
      throw new DeliverectCommerceBasketApiError(
        'replaceItems requires an item array',
        'INVALID_BASKET_ITEMS',
        400,
        undefined,
        'Replace basket items'
      );
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.menuId || typeof item.menuId !== 'string' || item.menuId.trim().length === 0) {
        throw new DeliverectCommerceBasketApiError(
          `Item at index ${i} is missing a valid menuId`,
          'INVALID_BASKET_ITEM_MENUID',
          400,
          undefined,
          'Replace basket items'
        );
      }
      if (!item.plu || typeof item.plu !== 'string' || item.plu.trim().length === 0) {
        throw new DeliverectCommerceBasketApiError(
          `Item at index ${i} is missing a valid plu`,
          'INVALID_BASKET_ITEM_PLU',
          400,
          undefined,
          'Replace basket items'
        );
      }
      if (typeof item.quantity !== 'number' || !Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new DeliverectCommerceBasketApiError(
          `Item at index ${i} must have a positive integer quantity`,
          'INVALID_BASKET_ITEM_QUANTITY',
          400,
          undefined,
          'Replace basket items'
        );
      }
    }

    const path = `/commerce/${this.accountId}/baskets/${encodeURIComponent(basketId)}/items`;
    // Replacement semantics sends complete RAW array as body
    return this.request('PATCH', path, items, 'Replace basket items');
  }

  async replaceBasketItems(basketId: string, items: CommerceBasketItemInput[]): Promise<JsonObject> {
    return this.replaceItems(basketId, items);
  }

  async reconcileBasket(basketId: string): Promise<JsonObject> {
    const path = `/commerce/${this.accountId}/baskets/${encodeURIComponent(basketId)}/reconcile`;
    return this.request('POST', path, {}, 'Reconcile basket');
  }

  getAuthoritativeTotalMinor(basket: JsonObject): number {
    const total = basket?.payment?.total;
    if (typeof total === 'number' && Number.isInteger(total) && total >= 0) {
      return total;
    }
    throw new DeliverectCommerceBasketApiError(
      'Basket does not contain a valid authoritative integer minor payment.total',
      'INVALID_AUTHORITATIVE_TOTAL',
      400,
      basket,
      'Get authoritative total'
    );
  }

  async getCheckout(checkoutId: string): Promise<JsonObject> {
    const path = `/commerce/${this.accountId}/v2/checkouts/${encodeURIComponent(checkoutId)}`;
    return this.request('GET', path, undefined, 'Get checkout');
  }

  async checkoutUnpaidPickup(input: UnpaidPickupCheckoutInput): Promise<CommerceCheckoutResult> {
    const path = `/commerce/${this.accountId}/v2/checkouts`;
    const randomSuffix = randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();

    const channelOrderId = input.channelOrderId || `BWYDI-STG-${Date.now()}-${randomSuffix}`;
    const channelOrderDisplayId = input.channelOrderDisplayId || `BW-${randomSuffix.slice(-6)}`;
    const externalPaymentId = input.externalPaymentId || `unpaid-${randomUUID()}`;

    const payload: JsonObject = {
      basket: { id: input.basketId },
      order: {
        channelOrderId,
        channelOrderDisplayId,
        by: input.by || 'Bwydi Web App',
        includeCutlery: input.includeCutlery ?? false,
      },
      payments: [
        {
          type: 'third_party',
          externalId: externalPaymentId,
          isPrepaid: false,
          amount: input.amountMinor,
          metadata: {},
        },
      ],
      ...(input.customer ? { customer: input.customer } : {}),
      ...(input.note || input.orderNote ? { note: input.note || input.orderNote } : {}),
    };

    const response = await this.request<JsonObject>('POST', path, payload, 'Checkout unpaid pickup');

    return {
      accepted: true,
      rawResponse: response,
      checkout: response,
      checkoutId: response?.id || response?._id || response?.checkoutId,
      channelOrderId: response?.channelOrderId || response?.order?.channelOrderId || channelOrderId,
      channelOrderDisplayId: response?.channelOrderDisplayId || response?.order?.channelOrderDisplayId || channelOrderDisplayId,
      statusUrl: response?.statusUrl || response?.links?.status,
    };
  }

  async createPickupTestOrder(params: CreatePickupTestOrderParams): Promise<CreatePickupTestOrderResult> {
    const basketRes = await this.createPickupBasket({
      channelLinkId: params.channelLinkId,
      pickupTime: params.pickupTime,
      pickupNotes: params.pickupNotes,
      customer: params.customer,
      customerName: params.customerName,
      customerEmail: params.customerEmail,
      customerPhone: params.customerPhone,
    });

    const basketId = basketRes.id || basketRes._id || basketRes.basketId;

    let itemsToSet: CommerceBasketItemInput[] = [];
    if (params.items && params.items.length > 0) {
      itemsToSet = params.items;
    } else if (params.menuId && params.plu) {
      itemsToSet = [
        {
          menuId: params.menuId,
          plu: params.plu,
          quantity: params.quantity || 1,
        },
      ];
    }

    if (itemsToSet.length > 0) {
      await this.replaceItems(basketId, itemsToSet);
    }

    const reconcileRes = await this.reconcileBasket(basketId);
    const totalMinor = this.getAuthoritativeTotalMinor(reconcileRes);

    let checkoutResult: CommerceCheckoutResult | undefined;
    if (params.performCheckout) {
      checkoutResult = await this.checkoutUnpaidPickup({
        basketId,
        amountMinor: totalMinor,
        customer: params.customer,
        orderNote: params.orderNote,
      });
    }

    return {
      basketId,
      basket: {
        ...reconcileRes,
        items: reconcileRes.items || itemsToSet,
      },
      totalMinor,
      reconcileResponse: reconcileRes,
      checkout: checkoutResult?.checkout,
      checkoutResult,
      channelOrderId: checkoutResult?.channelOrderId,
      channelOrderDisplayId: checkoutResult?.channelOrderDisplayId,
    };
  }
}

export { DeliverectCommerceBasketApiClient as DeliverectCommerceBasketApi };
export { DeliverectCommerceBasketApiError as DeliverectCommerceApiError };
