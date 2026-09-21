/**
 * Deliverect Commerce Basket API
 *
 * Narrow, raw-contract client for the Deliverect Commerce basket -> checkout path.
 * This file intentionally does NOT map into Bwydi's Basket/Order domain models yet.
 * It exists so staging behaviour can be verified without falling back to BasketService.
 *
 * Verified Deliverect Commerce contracts used here:
 *   POST  /commerce/{accountId}/baskets
 *   GET   /commerce/{accountId}/baskets/{basketId}
 *   PATCH /commerce/{accountId}/baskets/{basketId}/items
 *   POST  /commerce/{accountId}/baskets/{basketId}/reconcile
 *   POST  /commerce/{accountId}/v2/checkouts
 *
 * IMPORTANT:
 * - PATCH /items REPLACES the complete basket item list.
 * - Pickup is Deliverect's `pickup` fulfilment type (Bwydi UI may call this Collection).
 * - An unpaid pickup checkout can use third_party + isPrepaid:false.
 * - A 200 checkout response means the checkout was accepted; final order creation is async.
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

export interface CommercePickupCustomerInput {
  name?: string;
  companyName?: string;
  phoneNumber?: string;
  email?: string;
  externalId?: string;
}

export interface UnpaidPickupCheckoutInput {
  basketId: string;
  amountMinor: number;
  channelOrderId?: string;
  channelOrderDisplayId?: string;
  orderSource?: string;
  note?: string;
  externalPaymentId?: string;
}

export interface PickupTestOrderInput {
  channelLinkId: string;
  menuId: string;
  plu: string;
  quantity?: number;
  customer?: CommercePickupCustomerInput;
  pickupNotes?: string;
  orderNote?: string;
  performCheckout?: boolean;
}

export interface PickupTestOrderResult {
  accountId: string;
  channelLinkId: string;
  basketId: string;
  totalMinor: number;
  basket: JsonObject;
  reconciledBasket: JsonObject;
  checkout?: JsonObject;
  channelOrderId?: string;
  channelOrderDisplayId?: string;
}

export class DeliverectCommerceApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly operation: string;
  readonly upstreamBody?: unknown;

  constructor(options: {
    message: string;
    status: number;
    code: string;
    operation: string;
    upstreamBody?: unknown;
  }) {
    super(options.message);
    this.name = 'DeliverectCommerceApiError';
    this.status = options.status;
    this.code = options.code;
    this.operation = options.operation;
    this.upstreamBody = options.upstreamBody;
  }
}

export class DeliverectCommerceBasketApi {
  constructor(
    private readonly tokenManager: OAuthTokenManager,
    private readonly accountId: string
  ) {
    if (!accountId?.trim()) {
      throw new Error('DeliverectCommerceBasketApi requires a Deliverect accountId');
    }
  }

  private get baseUrl(): string {
    return this.tokenManager.config.baseUrl.replace(/\/$/, '');
  }

  private accountPath(path: string): string {
    return `/commerce/${encodeURIComponent(this.accountId)}${path}`;
  }

  private async request<T = JsonObject>(
    operation: string,
    path: string,
    init: RequestInit,
    retryOn401 = true
  ): Promise<T> {
    const token = await this.tokenManager.getAccessToken();
    const headers = new Headers(init.headers || {});
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('Accept', 'application/json');
    if (init.body != null && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    });

    if (response.status === 401 && retryOn401) {
      this.tokenManager.invalidateCache();
      return this.request<T>(operation, path, init, false);
    }

    const text = await response.text();
    let payload: unknown = undefined;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }

    if (!response.ok) {
      const upstreamCode =
        payload && typeof payload === 'object' && 'code' in payload
          ? String((payload as any).code)
          : '';

      let code = upstreamCode || `DELIVERECT_HTTP_${response.status}`;
      if (response.status === 403 && upstreamCode === 'insufficient_permissions') {
        code = 'BASKET_WRITE_PERMISSION_REQUIRED';
      }

      throw new DeliverectCommerceApiError({
        message: `${operation} failed with Deliverect HTTP ${response.status}${
          upstreamCode ? ` (${upstreamCode})` : ''
        }`,
        status: response.status,
        code,
        operation,
        upstreamBody: payload,
      });
    }

    return payload as T;
  }

  /**
   * Creates an empty pickup/collection basket for one Commerce store/channel link.
   */
  async createPickupBasket(options: {
    channelLinkId: string;
    customer?: CommercePickupCustomerInput;
    pickupNotes?: string;
  }): Promise<JsonObject> {
    if (!options.channelLinkId?.trim()) {
      throw new Error('channelLinkId is required');
    }

    const body: JsonObject = {
      storeId: options.channelLinkId,
      fulfillment: {
        type: 'pickup',
        ...(options.pickupNotes ? { pickupNotes: options.pickupNotes } : {}),
      },
    };

    if (options.customer && Object.values(options.customer).some(Boolean)) {
      body.customer = options.customer;
    }

    return this.request<JsonObject>(
      'Create pickup basket',
      this.accountPath('/baskets'),
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    );
  }

  async getBasket(basketId: string): Promise<JsonObject> {
    this.assertId('basketId', basketId);
    return this.request<JsonObject>(
      'Get basket',
      this.accountPath(`/baskets/${encodeURIComponent(basketId)}`),
      { method: 'GET' }
    );
  }

  /**
   * Deliverect PATCH /items is replacement semantics, not an append operation.
   * Always pass the COMPLETE desired item list.
   */
  async replaceItems(
    basketId: string,
    items: CommerceBasketItemInput[]
  ): Promise<JsonObject> {
    this.assertId('basketId', basketId);
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('replaceItems requires at least one basket item');
    }

    for (const item of items) {
      if (!item.menuId?.trim()) throw new Error('Every basket item requires menuId');
      if (!item.plu?.trim()) throw new Error('Every basket item requires plu');
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new Error(`Basket item ${item.plu || '(unknown)'} requires a positive integer quantity`);
      }
    }

    return this.request<JsonObject>(
      'Replace basket items',
      this.accountPath(`/baskets/${encodeURIComponent(basketId)}/items`),
      {
        method: 'PATCH',
        body: JSON.stringify(items),
      }
    );
  }

  async reconcileBasket(basketId: string): Promise<JsonObject> {
    this.assertId('basketId', basketId);
    return this.request<JsonObject>(
      'Reconcile basket',
      this.accountPath(`/baskets/${encodeURIComponent(basketId)}/reconcile`),
      { method: 'POST' }
    );
  }

  /**
   * Extracts the authoritative payable total documented by Deliverect as payment.total.
   * We deliberately do not calculate a local checkout amount here.
   */
  getAuthoritativeTotalMinor(basket: JsonObject): number {
    const value = basket?.payment?.total;
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(
        'Deliverect basket response did not contain an integer payment.total. Refusing to guess checkout amount.'
      );
    }
    return value;
  }

  /**
   * Checks out a pickup basket as an unpaid third-party order.
   * This bypasses DPay and Dispatch and is useful for the first real staging order.
   */
  async checkoutUnpaidPickup(input: UnpaidPickupCheckoutInput): Promise<{
    checkout: JsonObject;
    channelOrderId: string;
    channelOrderDisplayId: string;
  }> {
    this.assertId('basketId', input.basketId);
    if (!Number.isInteger(input.amountMinor) || input.amountMinor < 0) {
      throw new Error('amountMinor must be a non-negative integer');
    }

    const suffix = randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();
    const channelOrderId = input.channelOrderId || `BWYDI-STG-${Date.now()}-${suffix}`;
    const channelOrderDisplayId = input.channelOrderDisplayId || `BW-${suffix.slice(-6)}`;

    const body = {
      basket: {
        id: input.basketId,
      },
      order: {
        channelOrderId,
        channelOrderDisplayId,
        by: input.orderSource || 'Bwydi Web App',
        includeCutlery: false,
      },
      ...(input.note ? { note: input.note } : {}),
      payments: [
        {
          type: 'third_party',
          externalId: input.externalPaymentId || `unpaid-${randomUUID()}`,
          isPrepaid: false,
          amount: input.amountMinor,
          metadata: {},
        },
      ],
    };

    const checkout = await this.request<JsonObject>(
      'Checkout unpaid pickup basket',
      this.accountPath('/v2/checkouts'),
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    );

    return { checkout, channelOrderId, channelOrderDisplayId };
  }

  /**
   * Small staging diagnostic flow:
   * create pickup basket -> replace items -> reconcile -> optionally checkout unpaid.
   *
   * It deliberately stops before checkout unless performCheckout=true.
   */
  async createPickupTestOrder(input: PickupTestOrderInput): Promise<PickupTestOrderResult> {
    const quantity = input.quantity ?? 1;
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error('quantity must be a positive integer');
    }

    const created = await this.createPickupBasket({
      channelLinkId: input.channelLinkId,
      customer: input.customer,
      pickupNotes: input.pickupNotes,
    });

    const basketId = String(created?.id || created?._id || '');
    if (!basketId) {
      throw new Error('Create Basket succeeded but Deliverect returned no basket id');
    }

    const withItems = await this.replaceItems(basketId, [
      {
        menuId: input.menuId,
        plu: input.plu,
        quantity,
      },
    ]);

    const reconciledBasket = await this.reconcileBasket(basketId);
    const totalMinor = this.getAuthoritativeTotalMinor(reconciledBasket);

    const result: PickupTestOrderResult = {
      accountId: this.accountId,
      channelLinkId: input.channelLinkId,
      basketId,
      totalMinor,
      basket: withItems,
      reconciledBasket,
    };

    if (input.performCheckout) {
      const checkedOut = await this.checkoutUnpaidPickup({
        basketId,
        amountMinor: totalMinor,
        note: input.orderNote,
      });
      result.checkout = checkedOut.checkout;
      result.channelOrderId = checkedOut.channelOrderId;
      result.channelOrderDisplayId = checkedOut.channelOrderDisplayId;
    }

    return result;
  }

  private assertId(name: string, value: string): void {
    if (!value?.trim()) throw new Error(`${name} is required`);
  }
}
