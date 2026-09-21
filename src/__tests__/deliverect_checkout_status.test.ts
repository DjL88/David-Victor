import { describe, expect, it } from 'vitest';
import { DeliverectApiClient } from '../../server/deliverect/DeliverectApiClient';

describe('Deliverect checkout status mapping', () => {
  const mapStatus = (raw: any) =>
    (new DeliverectApiClient() as any).mapCommerceCheckoutStatus(raw);

  it('maps the documented Commerce checkout lifecycle without inventing success', () => {
    expect(mapStatus({ status: 'open' })).toBe('CHECKOUT_PENDING_CONFIRMATION');
    expect(mapStatus({ status: 'completed' })).toBe('ORDER_CONFIRMED');
    expect(mapStatus({ status: 'failed' })).toBe('ORDER_FAILED');
  });

  it('treats an explicit upstream order identifier as confirmed even before status wording settles', () => {
    expect(mapStatus({ status: 'open', orderId: 'ord_123' })).toBe('ORDER_CONFIRMED');
  });

  it('does not map an unknown checkout status to success', () => {
    expect(mapStatus({ status: 'mystery_state' })).toBe('CHECKOUT_PENDING_CONFIRMATION');
  });

  it('confirms a completed checkout even when the consumed basket can no longer be fetched', async () => {
    const client = new DeliverectApiClient('brand-alpha') as any;

    client.getCommerceBasketApi = async () => ({
      getCheckout: async () => ({
        id: 'checkout-complete-1',
        status: 'completed',
        basket: { id: 'basket-consumed-1' },
        channelOrderId: 'BWYDI-COMPLETE-1',
        orderId: 'deliverect-order-1',
      }),
    });
    client.getMappedCommerceBasket = async () => {
      const error: any = new Error('Basket is no longer readable after checkout');
      error.statusCode = 404;
      throw error;
    };

    const result = await client.getCheckout('checkout-complete-1');

    expect(result).toEqual(
      expect.objectContaining({
        checkoutId: 'checkout-complete-1',
        status: 'ORDER_CONFIRMED',
        basketId: 'basket-consumed-1',
        orderId: 'deliverect-order-1',
        channelOrderReference: 'BWYDI-COMPLETE-1',
      })
    );
  });

  it('returns a provisional pickup order with full basket lines for async webhook and Quest correlation', async () => {
    const client = new DeliverectApiClient('brand-alpha') as any;
    const basket = {
      id: 'basket_live_1',
      storeId: 'channel_link_1',
      channelLinkId: 'channel_link_1',
      storeName: 'Collection Store',
      fulfillmentType: 'pickup',
      items: [
        {
          id: 'line_1',
          plu: 'PLU-1',
          name: 'Milk',
          price: { amount: 175, currency: 'GBP' },
          quantity: 2,
          substitutionPreference: 'REMOVE_IF_UNAVAILABLE',
        },
      ],
      subtotal: { amount: 350, currency: 'GBP' },
      discounts: [],
      charges: [],
      total: { amount: 350, currency: 'GBP' },
      discountTotal: { amount: 0, currency: 'GBP' },
      currency: 'GBP',
      validationErrors: [],
      restrictions: [],
      customer: {
        name: 'Collection Customer',
        email: 'collection@example.com',
      },
      updatedAt: new Date().toISOString(),
    };

    client.getCommerceBasketApi = async () => ({
      reconcileBasket: async () => ({ id: basket.id }),
      checkoutUnpaidPickup: async () => ({
        checkoutId: 'checkout_live_1',
        channelOrderId: 'BWYDI-ORDER-1',
        channelOrderDisplayId: 'BW-000001',
      }),
    });
    client.mapLiveCommerceBasket = async () => basket;

    const result = await client.checkout(basket.id, { tenantId: 'brand-alpha' });

    expect(result.status).toBe('CHECKOUT_PENDING_CONFIRMATION');
    expect(result.fulfillmentType).toBe('pickup');
    expect(result.order).toEqual(
      expect.objectContaining({
        id: 'BWYDI-ORDER-1',
        channelOrderId: 'BWYDI-ORDER-1',
        basketId: basket.id,
        status: 'SUBMITTED',
        fulfillmentType: 'pickup',
        fulfillment: { type: 'pickup' },
        paymentState: 'NO_CAPTURE_REQUIRED',
      })
    );
    expect(result.order.originalBasket.items).toEqual(basket.items);
    expect(result.order.currentOrder).toEqual({
      itemCount: 2,
      total: { amount: 350, currency: 'GBP' },
    });
  });
});
