import { describe, it, expect, beforeEach } from 'vitest';
import { MockCommerceClient } from '../commerce/MockCommerceClient';
import { MOCK_PRODUCTS } from '../commerce/mockData';
import { Address } from '../commerce/models';

describe('Checkout Flow, Dispatch Expiry and Asynchronous Status', () => {
  let client: MockCommerceClient;
  const testAddress: Address = {
    formattedAddress: '10 High Street, Chelmsford, CM1 1BE',
    postcode: 'CM1 1BE',
    city: 'Chelmsford',
    country: 'GB',
    latitude: 51.7356,
    longitude: 0.4685,
  };

  beforeEach(() => {
    client = new MockCommerceClient('brand-alpha');
    client.setSimulationFlags({});
  });

  it('generates dispatch expiry timestamps and revalidates delivery successfully', async () => {
    const storeId = 'store-chelmsford-central';
    const basket = await client.createBasket(storeId);
    const bread = MOCK_PRODUCTS.find((p) => p.plu === 'PLU-ART-001')!;
    await client.updateBasketItem(basket.id, bread, 2);

    expect(basket.dispatchValidationExpiresAt).toBeDefined();

    const revalidation = await client.revalidateDelivery(basket.id, testAddress);
    expect(revalidation.available).toBe(true);
    expect(revalidation.dispatchValidationExpiresAt).toBeDefined();
    expect(revalidation.deliveryFee).toBeGreaterThanOrEqual(0);
  });

  it('handles simulated dispatch unavailable and provides alternative store options', async () => {
    client.setSimulationFlags({ simulateDispatchUnavailable: true });

    const storeId = 'store-chelmsford-central';
    const basket = await client.createBasket(storeId);

    const revalidation = await client.revalidateDelivery(basket.id, testAddress);
    expect(revalidation.available).toBe(false);
    expect(revalidation.reason).toContain('No couriers currently available');
    expect(revalidation.alternativeStores).toBeDefined();
    expect(revalidation.alternativeStores!.length).toBeGreaterThan(0);
    expect(revalidation.collectionEligible).toBe(true);
  });

  it('creates a secure hosted payment session and advances through asynchronous checkout states', async () => {
    const storeId = 'store-chelmsford-central';
    const basket = await client.createBasket(storeId);
    const bread = MOCK_PRODUCTS.find((p) => p.plu === 'PLU-ART-001')!;
    await client.updateBasketItem(basket.id, bread, 2);

    // Create session
    const session = await client.createPaymentSession(basket.id);
    expect(session.sessionId).toBeDefined();
    expect(session.redirectUrl).toContain('pay.deliverect.com');

    // First polling call: preparing payment
    const status1 = await client.getCheckoutStatus(session.sessionId);
    expect(['preparing_payment', 'payment_authorised']).toContain(status1.status);

    // Subsequent polling transitions towards confirmed
    let finalStatus = status1;
    for (let i = 0; i < 5; i++) {
      finalStatus = await client.getCheckoutStatus(session.sessionId);
      if (finalStatus.status === 'order_confirmed') break;
    }

    expect(finalStatus.status).toBe('order_confirmed');
    expect(finalStatus.orderId).toBeDefined();

    // Verify confirmed order details
    const order = await client.getOrder(finalStatus.orderId!);
    expect(order.orderReference).toBeDefined();
    expect(order.status).toBe('orderAccepted');
    expect(order.courier).toBeDefined();
    expect(order.items.length).toBeGreaterThan(0);
  });

  it('handles simulated payment failure without corrupting order state', async () => {
    client.setSimulationFlags({ simulatePaymentFailure: true });

    const storeId = 'store-chelmsford-central';
    const basket = await client.createBasket(storeId);
    const bread = MOCK_PRODUCTS.find((p) => p.plu === 'PLU-ART-001')!;
    await client.updateBasketItem(basket.id, bread, 1);

    const session = await client.createPaymentSession(basket.id);
    const status = await client.getCheckoutStatus(session.sessionId);

    expect(status.status).toBe('order_failed');
    expect(status.failureReason).toContain('Declined');
  });

  it('allows collection order submission without a delivery address', async () => {
    const storeId = 'store-chelmsford-central';
    const basket = await client.createBasket(storeId, 'pickup');
    const bread = MOCK_PRODUCTS.find((p) => p.plu === 'PLU-ART-001')!;
    await client.updateBasketItem(basket.id, bread, 1);

    // Checkout collection basket with null/undefined deliveryAddress
    const order = await client.checkoutBasket(basket.id, {
      deliveryAddress: undefined,
    });

    expect(order).toBeDefined();
    expect(order.id).toBeDefined();
    expect(['collection', 'pickup']).toContain(order.fulfillment?.type || (order as any).fulfillmentType);
  });
});
