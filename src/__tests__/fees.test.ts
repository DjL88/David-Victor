import { describe, it, expect, beforeEach } from 'vitest';
import { MockCommerceClient } from '../commerce/MockCommerceClient';
import { MOCK_PRODUCTS, MOCK_FEE_POLICIES } from '../commerce/mockData';
import { moneyToMajor, policyFeeToMajor, policyFeeToMinor } from '../commerce/models';

describe('Authoritative Fee Policies and Calculations', () => {
  let client: MockCommerceClient;

  beforeEach(() => {
    client = new MockCommerceClient('brand-alpha');
  });

  it('policyFeeToMajor and policyFeeToMinor handle minor units, major units, and objects cleanly', () => {
    // Integer minor units (pence): 300p = £3.00
    expect(policyFeeToMinor(300)).toBe(300);
    expect(policyFeeToMajor(300)).toBe(3.00);

    // Legacy float major units: 1.99 = £1.99
    expect(policyFeeToMinor(1.99)).toBe(199);
    expect(policyFeeToMajor(1.99)).toBe(1.99);

    // Money object: { amount: 250, currency: 'GBP' }
    expect(policyFeeToMinor({ amount: 250, currency: 'GBP' })).toBe(250);
    expect(policyFeeToMajor({ amount: 250, currency: 'GBP' })).toBe(2.50);

    // Undefined/null fallback
    expect(policyFeeToMinor(undefined, 199)).toBe(199);
    expect(policyFeeToMajor(null, 199)).toBe(1.99);

    // Verify £3.00 entered as pounds (300 minor units) produces £3.00 major, NEVER £0.03
    const savedMinor = Math.round(3.00 * 100); // 300
    expect(savedMinor).toBe(300);
    expect(policyFeeToMajor(savedMinor)).toBe(3.00);
    expect(policyFeeToMajor(savedMinor)).not.toBe(0.03);
  });

  it('calculates fixed delivery fee, service charge, bag fee, and deposit correctly', async () => {
    // Brand Alpha default policy: Fixed £1.99 delivery, 2.5% service fee, £0.30 bag fee, small order fee £1.50 under £10
    const storeId = 'store-chelmsford-central';
    const basket = await client.createBasket(storeId);

    // Add 1 loaf of bread (£2.85) - below £10 min threshold
    const bread = MOCK_PRODUCTS.find((p) => p.plu === 'PLU-ART-001')!;
    const updatedBasket = await client.updateBasketItem(basket.id, bread, 1);

    expect(moneyToMajor(updatedBasket.subtotal)).toBe(2.85);

    // Check individual charges
    const deliveryCharge = updatedBasket.charges.find((c) => c.id === 'delivery_fee');
    const serviceCharge = updatedBasket.charges.find((c) => c.id === 'service_fee');
    const bagCharge = updatedBasket.charges.find((c) => c.id === 'bag_fee');
    const smallOrderCharge = updatedBasket.charges.find((c) => c.id === 'small_order_fee');

    expect(deliveryCharge ? moneyToMajor(deliveryCharge.amount) : 0).toBe(1.99);
    expect(bagCharge ? moneyToMajor(bagCharge.amount) : 0).toBe(0.30);
    // Subtotal 2.85 < 10.00, so small order fee of 1.50 applies
    expect(smallOrderCharge ? moneyToMajor(smallOrderCharge.amount) : 0).toBe(1.50);

    // Total must strictly equal sum of subtotal + charges - discounts + depositTotal
    const expectedTotal = Number(
      (
        moneyToMajor(updatedBasket.subtotal) +
        (deliveryCharge ? moneyToMajor(deliveryCharge.amount) : 0) +
        (serviceCharge ? moneyToMajor(serviceCharge.amount) : 0) +
        (bagCharge ? moneyToMajor(bagCharge.amount) : 0) +
        (smallOrderCharge ? moneyToMajor(smallOrderCharge.amount) : 0)
      ).toFixed(2)
    );
    expect(moneyToMajor(updatedBasket.total)).toBe(expectedTotal);
  });

  it('waives delivery fee when basket subtotal exceeds freeDeliveryThreshold', async () => {
    const storeId = 'store-chelmsford-central';
    const basket = await client.createBasket(storeId);

    // Add 15 bottles of wine or gin to exceed £35 free delivery threshold
    const gin = MOCK_PRODUCTS.find((p) => p.plu === 'PLU-GIN-001')!; // £38.00
    const updatedBasket = await client.updateBasketItem(basket.id, gin, 1);

    expect(moneyToMajor(updatedBasket.subtotal)).toBe(38.00);

    const deliveryCharge = updatedBasket.charges.find((c) => c.id === 'delivery_fee');
    expect(deliveryCharge ? moneyToMajor(deliveryCharge.amount) : 0).toBe(0.00);
    expect(deliveryCharge?.title).toContain('Free');

    // Small order fee should not apply since 38.00 >= 10.00
    const smallOrderCharge = updatedBasket.charges.find((c) => c.id === 'small_order_fee');
    expect(smallOrderCharge).toBeUndefined();
  });

  it('calculates refundable DRS beverage deposit separately', async () => {
    const storeId = 'store-chelmsford-central';
    const basket = await client.createBasket(storeId);

    // Add 3 kombucha cans (£0.20 deposit each)
    const kombucha = MOCK_PRODUCTS.find((p) => p.plu === 'PLU-KOM-001')!;
    const updatedBasket = await client.updateBasketItem(basket.id, kombucha, 3);

    expect(moneyToMajor(updatedBasket.depositTotal)).toBe(0.60);
    expect(moneyToMajor(updatedBasket.total)).toBeGreaterThan(moneyToMajor(updatedBasket.subtotal));
  });

  it('applies courier tip directly to charges', async () => {
    const storeId = 'store-chelmsford-central';
    const basket = await client.createBasket(storeId);
    const bread = MOCK_PRODUCTS.find((p) => p.plu === 'PLU-ART-001')!;
    await client.updateBasketItem(basket.id, bread, 2);

    const withTip = await client.applyTip(basket.id, 3.00);
    expect(moneyToMajor(withTip.tip)).toBe(3.00);

    const tipCharge = withTip.charges.find((c) => c.id === 'courier_tip');
    expect(tipCharge ? moneyToMajor(tipCharge.amount) : 0).toBe(3.00);
  });

  it('applies promo code discounts authoritatively', async () => {
    const storeId = 'store-chelmsford-central';
    const basket = await client.createBasket(storeId);
    const gin = MOCK_PRODUCTS.find((p) => p.plu === 'PLU-GIN-001')!;
    await client.updateBasketItem(basket.id, gin, 1);

    const discounted = await client.applyPromoCode(basket.id, 'SAVE5');
    expect(discounted.discounts?.length).toBe(1);
    expect(discounted.discounts?.[0] ? moneyToMajor(discounted.discounts[0].amount) : 0).toBe(5.00);
  });
});
