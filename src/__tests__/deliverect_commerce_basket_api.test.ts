import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OAuthTokenManager } from '../../server/deliverect/OAuthTokenManager';
import {
  DeliverectCommerceBasketApi,
  DeliverectCommerceApiError,
} from '../../server/deliverect/DeliverectCommerceBasketApi';

describe('DeliverectCommerceBasketApi', () => {
  const accountId = 'acc_test_123';
  let tokenManager: OAuthTokenManager;

  beforeEach(() => {
    vi.restoreAllMocks();
    tokenManager = new OAuthTokenManager({
      environment: 'staging',
      clientId: 'dummy_client_id',
      clientSecret: 'dummy_client_secret',
    });
    vi.spyOn(tokenManager, 'getAccessToken').mockResolvedValue('test_bearer_token');
    vi.spyOn(tokenManager, 'invalidateCache').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('createPickupBasket sends POST with correct path and body (storeId, fulfillment.type = pickup)', async () => {
    let capturedUrl = '';
    let capturedMethod = '';
    let capturedBody: any = null;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      capturedUrl = String(url);
      capturedMethod = init?.method || 'GET';
      capturedBody = JSON.parse(String(init?.body || '{}'));
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ id: 'basket_999', storeId: 'store_channel_1' }),
      } as Response;
    });

    const api = new DeliverectCommerceBasketApi(tokenManager, accountId);
    const result = await api.createPickupBasket({
      channelLinkId: 'store_channel_1',
      pickupNotes: 'Hold at counter',
      customer: { name: 'Jane Doe', email: 'jane@example.com' },
    });

    expect(capturedUrl).toBe('https://api.staging.deliverect.com/commerce/acc_test_123/baskets');
    expect(capturedMethod).toBe('POST');
    expect(capturedBody.storeId).toBe('store_channel_1');
    expect(capturedBody.fulfillment.type).toBe('pickup');
    expect(capturedBody.fulfillment.pickupNotes).toBe('Hold at counter');
    expect(capturedBody.customer.name).toBe('Jane Doe');
    expect(result.id).toBe('basket_999');
  });

  it('PATCH items sends raw complete array with menuId, plu, positive integer quantity', async () => {
    let capturedUrl = '';
    let capturedMethod = '';
    let capturedBody: any = null;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      capturedUrl = String(url);
      capturedMethod = init?.method || 'GET';
      capturedBody = JSON.parse(String(init?.body || '[]'));
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ id: 'basket_999', items: capturedBody }),
      } as Response;
    });

    const api = new DeliverectCommerceBasketApi(tokenManager, accountId);
    const itemsInput = [
      { menuId: 'menu_1', plu: 'PLU_A', quantity: 2 },
      { menuId: 'menu_1', plu: 'PLU_B', quantity: 1 },
    ];

    const result = await api.replaceItems('basket_999', itemsInput);

    expect(capturedUrl).toBe('https://api.staging.deliverect.com/commerce/acc_test_123/baskets/basket_999/items');
    expect(capturedMethod).toBe('PATCH');
    // Replacement semantics sends complete RAW array, NOT { items: [...] }
    expect(Array.isArray(capturedBody)).toBe(true);
    expect(capturedBody.length).toBe(2);
    expect(capturedBody[0]).toEqual({ menuId: 'menu_1', plu: 'PLU_A', quantity: 2 });
    expect(capturedBody[1]).toEqual({ menuId: 'menu_1', plu: 'PLU_B', quantity: 1 });
  });

  it('validates each item contains menuId, plu, and positive integer quantity', async () => {
    const api = new DeliverectCommerceBasketApi(tokenManager, accountId);

    await expect(api.replaceItems('b1', [])).rejects.toThrow('replaceItems requires at least one basket item');
    await expect(api.replaceItems('b1', [{ menuId: '', plu: 'PLU_1', quantity: 1 }])).rejects.toThrow('menuId');
    await expect(api.replaceItems('b1', [{ menuId: 'm1', plu: '', quantity: 1 }])).rejects.toThrow('plu');
    await expect(api.replaceItems('b1', [{ menuId: 'm1', plu: 'PLU_1', quantity: 0 }])).rejects.toThrow('positive integer quantity');
    await expect(api.replaceItems('b1', [{ menuId: 'm1', plu: 'PLU_1', quantity: -2 }])).rejects.toThrow('positive integer quantity');
    await expect(api.replaceItems('b1', [{ menuId: 'm1', plu: 'PLU_1', quantity: 1.5 }])).rejects.toThrow('positive integer quantity');
  });

  it('reconcile calls POST /commerce/{accountId}/baskets/{basketId}/reconcile', async () => {
    let capturedUrl = '';
    let capturedMethod = '';

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      capturedUrl = String(url);
      capturedMethod = init?.method || 'GET';
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ id: 'b1', payment: { total: 1550 } }),
      } as Response;
    });

    const api = new DeliverectCommerceBasketApi(tokenManager, accountId);
    const result = await api.reconcileBasket('b1');

    expect(capturedUrl).toBe('https://api.staging.deliverect.com/commerce/acc_test_123/baskets/b1/reconcile');
    expect(capturedMethod).toBe('POST');
    expect(result.payment.total).toBe(1550);
  });

  it('getAuthoritativeTotalMinor reads payment.total and throws if missing or invalid', () => {
    const api = new DeliverectCommerceBasketApi(tokenManager, accountId);

    expect(api.getAuthoritativeTotalMinor({ payment: { total: 2450 } })).toBe(2450);
    expect(api.getAuthoritativeTotalMinor({ payment: { total: 0 } })).toBe(0);

    expect(() => api.getAuthoritativeTotalMinor({})).toThrow('payment.total');
    expect(() => api.getAuthoritativeTotalMinor({ payment: { total: -100 } })).toThrow('payment.total');
    expect(() => api.getAuthoritativeTotalMinor({ payment: { total: 12.5 } })).toThrow('payment.total');
    expect(() => api.getAuthoritativeTotalMinor({ payment: { total: '100' as any } })).toThrow('payment.total');
  });

  it('checkoutUnpaidPickup uses POST /v2/checkouts, payments array with type: third_party and isPrepaid: false', async () => {
    let capturedUrl = '';
    let capturedMethod = '';
    let capturedBody: any = null;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      capturedUrl = String(url);
      capturedMethod = init?.method || 'GET';
      capturedBody = JSON.parse(String(init?.body || '{}'));
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ status: 'ACCEPTED', checkoutId: 'chk_111' }),
      } as Response;
    });

    const api = new DeliverectCommerceBasketApi(tokenManager, accountId);
    const result = await api.checkoutUnpaidPickup({
      basketId: 'basket_555',
      amountMinor: 1800,
      note: 'Pickup order note',
    });

    expect(capturedUrl).toBe('https://api.staging.deliverect.com/commerce/acc_test_123/v2/checkouts');
    expect(capturedMethod).toBe('POST');
    expect(capturedBody.basket.id).toBe('basket_555');
    expect(capturedBody.payments).toHaveLength(1);
    expect(capturedBody.payments[0].type).toBe('third_party');
    expect(capturedBody.payments[0].isPrepaid).toBe(false);
    expect(capturedBody.payments[0].amount).toBe(1800);
    expect(result.checkout.status).toBe('ACCEPTED');
  });

  it('channelOrderId is unique across multiple checkout calls', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ status: 'ACCEPTED' }),
      } as Response;
    });

    const api = new DeliverectCommerceBasketApi(tokenManager, accountId);
    const res1 = await api.checkoutUnpaidPickup({ basketId: 'b1', amountMinor: 1000 });
    const res2 = await api.checkoutUnpaidPickup({ basketId: 'b1', amountMinor: 1000 });

    expect(res1.channelOrderId).not.toBe(res2.channelOrderId);
    expect(res1.channelOrderDisplayId).not.toBe(res2.channelOrderDisplayId);
  });

  it('maps HTTP 403 with code insufficient_permissions to BASKET_WRITE_PERMISSION_REQUIRED', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return {
        ok: false,
        status: 403,
        text: async () => JSON.stringify({ code: 'insufficient_permissions', message: 'Forbidden' }),
      } as Response;
    });

    const api = new DeliverectCommerceBasketApi(tokenManager, accountId);

    try {
      await api.createPickupBasket({ channelLinkId: 'store_1' });
      expect.unreachable('Should have thrown error');
    } catch (err: any) {
      expect(err).toBeInstanceOf(DeliverectCommerceApiError);
      expect(err.status).toBe(403);
      expect(err.code).toBe('BASKET_WRITE_PERMISSION_REQUIRED');
      expect(err.operation).toBe('Create pickup basket');
    }
  });

  it('invalidates token cache and retries once on HTTP 401', async () => {
    let callCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: false,
          status: 401,
          text: async () => JSON.stringify({ message: 'Token expired' }),
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ id: 'basket_recovered' }),
      } as Response;
    });

    const api = new DeliverectCommerceBasketApi(tokenManager, accountId);
    const res = await api.createPickupBasket({ channelLinkId: 's1' });

    expect(callCount).toBe(2);
    expect(tokenManager.invalidateCache).toHaveBeenCalledTimes(1);
    expect(res.id).toBe('basket_recovered');
  });

  it('throws after second HTTP 401 without looping infinitely', async () => {
    let callCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callCount++;
      return {
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ message: 'Still Unauthorized' }),
      } as Response;
    });

    const api = new DeliverectCommerceBasketApi(tokenManager, accountId);

    await expect(api.createPickupBasket({ channelLinkId: 's1' })).rejects.toThrow('Create pickup basket failed with Deliverect HTTP 401');
    expect(callCount).toBe(2);
    expect(tokenManager.invalidateCache).toHaveBeenCalledTimes(1);
  });
});
