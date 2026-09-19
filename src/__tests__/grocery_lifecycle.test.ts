import { describe, it, expect, beforeEach } from 'vitest';
import { MockCommerceClient } from '../commerce/MockCommerceClient';
import { MockAdminClient } from '../commerce/MockAdminClient';
import { MOCK_PRODUCTS, MOCK_STORES } from '../commerce/mockData';
import { moneyToMajor } from '../commerce/models';

describe('Grocery Post-Checkout Lifecycle & Payment States', () => {
  let commerceClient: MockCommerceClient;
  let adminClient: MockAdminClient;

  beforeEach(() => {
    commerceClient = new MockCommerceClient('brand-alpha');
    adminClient = new MockAdminClient();
  });

  it('demonstrates Scenario A: Perfect pick with immediate automatic capture', async () => {
    const order = await commerceClient.createDemoScenarioOrder('A');
    expect(order.status).toBe('READY_FOR_COURIER');
    expect(order.payment.state).toBe('CAPTURED');
    expect(order.payment.capturedAmount).toBe(order.payment.finalAmount);
    expect(order.picking.hasChanges).toBe(false);
    expect(order.picking.items.every((it) => it.state === 'PICKED')).toBe(true);
  });

  it('demonstrates Scenario B: Best-match substitution pricing, quantity amendment, and item removal', async () => {
    const order = await commerceClient.createDemoScenarioOrder('B');

    // 1. Best match substitution (Pepsi 1.5L -> Pepsi 2L charged at lower original price £2.00 instead of £2.40)
    const pepsiItem = order.picking.items.find((it) => it.plu === 'PLU-PEPSI-15L');
    expect(pepsiItem).toBeDefined();
    expect(pepsiItem?.state).toBe('SUBSTITUTED');
    expect(pepsiItem ? moneyToMajor(pepsiItem.finalPrice) : 0).toBe(2.00);
    expect(pepsiItem?.substitution ? moneyToMajor(pepsiItem.substitution.chargedPrice) : 0).toBe(2.00);
    expect(pepsiItem?.substitution ? moneyToMajor(pepsiItem.substitution.substitutePrice) : 0).toBe(2.40);

    // 2. Quantity amendment (Bananas 6 requested, 5 supplied, charged pro-rata £1.33 instead of £1.60)
    const bananaItem = order.picking.items.find((it) => it.plu === 'PLU-BANANAS-6PK');
    expect(bananaItem).toBeDefined();
    expect(bananaItem?.state).toBe('QUANTITY_AMENDED');
    expect(bananaItem ? moneyToMajor(bananaItem.finalPrice) : 0).toBe(1.33);

    // 3. Out of stock item removed (£0.00 charged)
    const iceCreamItem = order.picking.items.find((it) => it.plu === 'PLU-ICECREAM-VANILLA');
    expect(iceCreamItem).toBeDefined();
    expect(iceCreamItem?.state).toBe('REMOVED');
    expect(iceCreamItem ? moneyToMajor(iceCreamItem.finalPrice) : 0).toBe(0.00);

    // 4. Automatic capture since finalTotal <= authorizedMax
    expect(order.payment.state).toBe('CAPTURED');
    expect(moneyToMajor(order.payment.finalAmount)).toBeLessThanOrEqual(moneyToMajor(order.payment.authorizationMaximum));
    expect(order.status).toBe('READY_FOR_COURIER');
  });

  it('demonstrates Scenario D: High basket increase triggers reauthorization required', async () => {
    const order = await commerceClient.createDemoScenarioOrder('D');

    // Initial ceiling was £20.00, but final total reached £27.99 (exceeds authorized maximum)
    expect(order.payment.state).toBe('PAYMENT_ACTION_REQUIRED');
    expect(order.status).toBe('PAYMENT_FINALISING');
    expect(moneyToMajor(order.payment.finalAmount)).toBeGreaterThan(moneyToMajor(order.payment.authorizationMaximum));

    // Customer reauthorizes payment
    const reauthorized = await commerceClient.reauthorizeOrderPayment(order.id, 'tok_reauth_test');
    expect(reauthorized.payment.state).toBe('CAPTURED');
    expect(reauthorized.status).toBe('READY_FOR_COURIER');
    expect(reauthorized.payment.capturedAmount).toEqual(reauthorized.payment.finalAmount);
  });

  it('handles closed-store scheduled pre-ordering with delivery slots (Scenario E)', async () => {
    const closedStore = MOCK_STORES.find((s) => s.status === 'closed') || MOCK_STORES[1];

    // Ensure scheduling policy allows pre-ordering
    const config = await adminClient.getSchedulingConfig('brand-alpha');
    expect(config.acceptsPreOrders).toBe(true);

    const slotSchedule = await commerceClient.getAvailableSlots(closedStore.id, 'delivery');
    expect(slotSchedule.days.length).toBeGreaterThan(0);
    const allSlots = slotSchedule.days.flatMap((d) => d.slots);
    expect(allSlots.length).toBeGreaterThan(0);

    // Order demo scenario E (Closed store pre-order)
    const order = await commerceClient.createDemoScenarioOrder('E');
    expect(order.scheduledTime.type).toBe('SCHEDULED');
    expect(order.scheduledTime.slot).toBeDefined();
    expect(order.scheduledTime.slot?.dayLabel).toBe('Tomorrow');
    expect(order.fulfillment.schedulingMode).toBe('ASSIGN_NEAR_FULFILMENT');
  });

  it('enforces customer-selected substitution preferences', async () => {
    const basket = await commerceClient.createBasket('store-chelmsford-central');
    const artisanBread = MOCK_PRODUCTS.find((p) => p.plu === 'PLU-ART-001')!;
    await commerceClient.updateBasketItem(basket.id, artisanBread.plu, 1);

    // Set item substitution preference to DO_NOT_SUBSTITUTE
    await commerceClient.setBasketItemSubstitution(
      basket.id,
      artisanBread.plu,
      'DO_NOT_SUBSTITUTE'
    );

    const token = await commerceClient.tokenizePayment({
      type: 'CARD',
      cardholderName: 'Jane Doe',
    });

    const order = await commerceClient.submitOrder(basket.id, {
      paymentTokenRef: token.token,
      authorizationMaximum: 11.0,
      schedulingType: 'ASAP',
    });

    expect(order.picking.items[0].substitutionPreference).toBe('DO_NOT_SUBSTITUTE');
  });
});
