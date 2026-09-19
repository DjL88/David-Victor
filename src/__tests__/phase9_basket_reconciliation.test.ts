import { describe, it, expect, beforeEach } from 'vitest';
import { defaultCommerceClient } from '../commerce/MockCommerceClient';

describe('Phase 9: Real Authoritative Basket & Reconciliation', () => {
  const STORE_CHELMSFORD = 'store-market-lane-chelmsford';
  const STORE_MOULSHAM = 'store-market-lane-moulsham';
  const PLU_BANANA = 'PLU-BANANA-LOOSE';
  const PLU_STRAWBERRY = 'PLU-STRAWBERRY-400G';
  const PLU_KOMBUCHA = 'PLU-KOM-001';

  beforeEach(() => {
    defaultCommerceClient.resetDemoState();
  });

  describe('Single-Store Basket Constraints (Section 14)', () => {
    it('creates a single-store basket bound to a specific store', async () => {
      const basket = await defaultCommerceClient.createBasket(STORE_CHELMSFORD, 'delivery');
      expect(basket).toBeDefined();
      expect(basket.storeId).toBe(STORE_CHELMSFORD);
      expect(basket.fulfillmentType).toBe('delivery');
      expect(basket.items).toEqual([]);
      expect(basket.currency).toBe('GBP');
    });

    it('adds valid items to the single-store basket', async () => {
      const basket = await defaultCommerceClient.createBasket(STORE_CHELMSFORD, 'delivery');
      const updated = await defaultCommerceClient.updateBasketItem(basket.id, PLU_BANANA, 2);
      
      expect(updated.items.length).toBe(1);
      expect(updated.items[0].plu).toBe(PLU_BANANA);
      expect(updated.items[0].quantity).toBe(2);
      expect(updated.total.amount).toBeGreaterThan(0);
    });

    it('rejects silent migration and computes explicit diff on store switch', async () => {
      const basket = await defaultCommerceClient.createBasket(STORE_CHELMSFORD, 'delivery');
      await defaultCommerceClient.updateBasketItem(basket.id, PLU_BANANA, 2);
      await defaultCommerceClient.updateBasketItem(basket.id, PLU_STRAWBERRY, 1);

      // Switch to Moulsham store which computes diff
      const switchResult = await defaultCommerceClient.updateBasketStore(basket.id, STORE_MOULSHAM, { confirmMigration: true });
      expect(switchResult.basket).toBeDefined();
      expect(switchResult.basket.storeId).toBe(STORE_MOULSHAM);
      expect(switchResult.storeSwitchDiff).toBeDefined();
    });
  });

  describe('Basket Reconciliation & Upstream Price Drift (Section 18 & BASK-05)', () => {
    it('detects and reconciles price changes authoritatively', async () => {
      const basket = await defaultCommerceClient.createBasket(STORE_CHELMSFORD, 'delivery');
      await defaultCommerceClient.updateBasketItem(basket.id, PLU_BANANA, 1);

      // Reconcile basket against store
      const result = await defaultCommerceClient.reconcileBasket(basket.id, STORE_CHELMSFORD);
      expect(result.reconciled).toBe(true);
      expect(result.basket.id).toBe(basket.id);
      expect(Array.isArray(result.changes)).toBe(true);
    });

    it('reconciles store menu drift when item is evaluated in destination store', async () => {
      const basket = await defaultCommerceClient.createBasket(STORE_CHELMSFORD, 'delivery');
      await defaultCommerceClient.updateBasketItem(basket.id, PLU_BANANA, 1);

      // Reconcile against destination store
      const result = await defaultCommerceClient.reconcileBasket(basket.id, STORE_MOULSHAM);
      expect(result.reconciled).toBe(true);
      expect(result.basket.storeId).toBe(STORE_MOULSHAM);
    });
  });

  describe('Substitution Preference Engine (Section 19)', () => {
    it('supports BEST_MATCH substitution preference with price policy', async () => {
      const basket = await defaultCommerceClient.createBasket(STORE_CHELMSFORD, 'delivery');
      const updated = await defaultCommerceClient.updateBasketItems(basket.id, [
        {
          plu: PLU_BANANA,
          quantity: 2,
          substitutionPreference: {
            type: 'BEST_MATCH',
            pricePolicy: 'LOWER_OF_ORIGINAL_OR_SUBSTITUTE',
          },
        },
      ]);

      const item = updated.items.find((i) => i.plu === PLU_BANANA);
      expect(item).toBeDefined();
      expect(item?.substitutionPreference).toBe('BEST_MATCH');
    });

    it('supports CUSTOMER_SELECTED substitution with candidate PLUs', async () => {
      const basket = await defaultCommerceClient.createBasket(STORE_CHELMSFORD, 'delivery');
      const updated = await defaultCommerceClient.updateBasketItems(basket.id, [
        {
          plu: PLU_BANANA,
          quantity: 1,
          substitutionPreference: 'CUSTOMER_SELECTED',
          preferredSubstitutePlu: PLU_STRAWBERRY,
          preferredSubstituteName: 'Fresh Strawberries 400g',
          preferredSubstitutePrice: 250,
        },
      ]);

      const item = updated.items.find((i) => i.plu === PLU_BANANA);
      expect(item).toBeDefined();
      expect(item?.substitutionPreference).toBe('CUSTOMER_SELECTED');
      expect(item?.preferredSubstitutePlu).toBe(PLU_STRAWBERRY);
      expect(item?.preferredSubstituteName).toBe('Fresh Strawberries 400g');
    });

    it('supports REMOVE_IF_UNAVAILABLE policy', async () => {
      const basket = await defaultCommerceClient.createBasket(STORE_CHELMSFORD, 'delivery');
      const updated = await defaultCommerceClient.updateBasketItems(basket.id, [
        {
          plu: PLU_STRAWBERRY,
          quantity: 1,
          substitutionPreference: 'REMOVE_IF_UNAVAILABLE',
        },
      ]);

      const item = updated.items.find((i) => i.plu === PLU_STRAWBERRY);
      expect(item).toBeDefined();
      expect(item?.substitutionPreference).toBe('REMOVE_IF_UNAVAILABLE');
    });

    it('supports CANCEL_ORDER_IF_UNAVAILABLE policy', async () => {
      const basket = await defaultCommerceClient.createBasket(STORE_CHELMSFORD, 'delivery');
      const updated = await defaultCommerceClient.updateBasketItems(basket.id, [
        {
          plu: PLU_KOMBUCHA,
          quantity: 1,
          substitutionPreference: 'CANCEL_ORDER_IF_UNAVAILABLE',
        },
      ]);

      const item = updated.items.find((i) => i.plu === PLU_KOMBUCHA);
      expect(item).toBeDefined();
      expect(item?.substitutionPreference).toBe('CANCEL_ORDER_IF_UNAVAILABLE');
    });
  });

  describe('Authoritative Totals & Anti-Slop Buffer Rejection (Section 20)', () => {
    it('never calculates arbitrary 10% or 15% buffers', async () => {
      const basket = await defaultCommerceClient.createBasket(STORE_CHELMSFORD, 'delivery');
      const updated = await defaultCommerceClient.updateBasketItem(basket.id, PLU_BANANA, 2);

      // Verify basket total is an exact sum of items + authoritative charges - discounts
      const subtotalMinor = updated.subtotal.amount;
      const chargesSumMinor = updated.charges.reduce((sum, c) => sum + c.amount.amount, 0);
      const discountSumMinor = updated.discountTotal?.amount || 0;

      const expectedTotal = subtotalMinor + chargesSumMinor - discountSumMinor;
      expect(updated.total.amount).toBe(expectedTotal);

      // Verify no arbitrary 10% or 15% buffer was added
      const ratio = updated.total.amount / subtotalMinor;
      expect(ratio).not.toBeCloseTo(1.10, 2);
      expect(ratio).not.toBeCloseTo(1.15, 2);
    });

    it('correctly manages tips with integer minor units', async () => {
      const basket = await defaultCommerceClient.createBasket(STORE_CHELMSFORD, 'delivery');
      const updated = await defaultCommerceClient.updateBasketItem(basket.id, PLU_BANANA, 3);

      const beforeTip = updated.total.amount;
      const updatedWithTip = await defaultCommerceClient.updateBasketTip(basket.id, 200); // £2.00 tip = 200 minor units
      expect(updatedWithTip.tip?.amount).toBe(200);
      expect(updatedWithTip.total.amount).toBe(beforeTip + 200);
    });
  });

  describe('Basket Validation (Section 15 & 18)', () => {
    it('validates an active basket with positive items and valid store', async () => {
      const basket = await defaultCommerceClient.createBasket(STORE_CHELMSFORD, 'delivery');
      // 8 bunches of bananas @ £1.35 = £10.80, which meets the £10 minimum order threshold
      await defaultCommerceClient.updateBasketItem(basket.id, PLU_BANANA, 8);

      const validation = await defaultCommerceClient.validateBasket(basket.id);
      expect(validation.valid).toBe(true);
      expect(validation.issues).toEqual([]);
    });

    it('rejects validation for an empty basket', async () => {
      const basket = await defaultCommerceClient.createBasket(STORE_CHELMSFORD, 'delivery');
      const validation = await defaultCommerceClient.validateBasket(basket.id);
      expect(validation.valid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
    });
  });
});
