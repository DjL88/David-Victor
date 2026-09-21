import { describe, it, expect } from 'vitest';
import { RuleEngine } from '../rules/RuleEngine';
import { RetailRule } from '../rules/types';
import { Product, Basket, BasketItem, Money } from '../commerce/models';

describe('Prompt 9 — Product Rules Engine Phase 1', () => {
  const basePrice: Money = { amount: 120, currency: 'GBP' };
  const aspirinPrice: Money = { amount: 150, currency: 'GBP' };

  const baseProduct: Product = {
    id: 'prod-paracetamol',
    plu: 'PLU-PARACETAMOL-500MG',
    gtin: ['5000000000001'],
    allergens: [],
    name: 'Paracetamol 500mg Tablets 16 Pack',
    description: 'Pain relief tablets',
    price: basePrice,
    categoryIds: ['cat-pharmacy'],
    productTags: ['PHARMACY', 'PAIN_RELIEF', 'PARACETAMOL'],
    displayLabels: ['Pharmacy'],
    inStock: true,
  };

  const aspirinProduct: Product = {
    id: 'prod-aspirin',
    plu: 'PLU-ASPIRIN-300MG',
    gtin: ['5000000000002'],
    allergens: [],
    name: 'Aspirin 300mg Tablets 16 Pack',
    price: aspirinPrice,
    categoryIds: ['cat-pharmacy'],
    productTags: ['PHARMACY', 'PAIN_RELIEF', 'ASPIRIN'],
    displayLabels: ['Pharmacy'],
    inStock: true,
  };

  const vodkaProduct: Product = {
    id: 'prod-vodka',
    plu: 'PLU-VODKA-70CL',
    gtin: ['5000000000003'],
    allergens: [],
    name: 'Premium Vodka 70cl',
    price: { amount: 1800, currency: 'GBP' },
    categoryIds: ['cat-spirits'],
    productTags: ['ALCOHOL', 'SPIRITS', 'AGE_RESTRICTED_18'],
    displayLabels: ['18+ Alcohol'],
    beverageInfo: {
      isAlcoholic: true,
      alcoholByVolume: 37.5,
    },
    inStock: true,
  };

  const hfssChipsProduct: Product = {
    id: 'prod-chips',
    plu: 'PLU-CHIPS-LARGE',
    gtin: ['5000000000004'],
    allergens: [],
    name: 'Large Salted Potato Crisps 150g',
    price: { amount: 200, currency: 'GBP' },
    categoryIds: ['cat-snacks'],
    productTags: ['HFSS', 'HIGH_FAT_SALT_SUGAR'],
    displayLabels: ['Snacks'],
    inStock: true,
  };

  const mockRules: RetailRule[] = [
    {
      id: 'rule-paracetamol-aspirin-group-limit',
      name: 'Combined Pain Relief Limit 2 Packs',
      priority: 100,
      enabled: true,
      countries: ['GB', 'IE'],
      conditions: {
        productTags: ['PARACETAMOL', 'ASPIRIN'],
      },
      actions: {
        maxQuantityPerProduct: 2,
        maxQuantityAcrossRuleGroup: {
          groupId: 'pain-relief-group',
          maxQuantity: 2,
          groupName: 'Pain Relief Products',
        },
        warningText: 'Maximum 2 packs of pain relief products allowed per order by regulation.',
      },
    },
    {
      id: 'rule-alcohol-18',
      name: 'Alcohol 18+ Mandatory ID & Challenge 25',
      priority: 90,
      enabled: true,
      countries: ['GB'],
      conditions: {
        isAlcoholic: true,
      },
      actions: {
        minimumAge: 18,
        requiresAgeGate: true,
        requiresAgeAcknowledgement: true,
        requiresCourierAgeCheck: true,
        badge: '18+',
      },
    },
    {
      id: 'rule-hfss-upsell-suppression',
      name: 'HFSS Checkout Upsell Suppression',
      priority: 80,
      enabled: true,
      countries: ['GB'],
      conditions: {
        productTags: ['HFSS'],
      },
      actions: {
        preventCheckoutUpsell: true,
        preventRecommendation: true,
        excludeFromDiscounts: true,
      },
    },
  ];

  it('evaluates age gate and Challenge 25 courier check requirements on alcoholic items', () => {
    const engine = new RuleEngine(mockRules);
    const decision = engine.evaluateProduct(vodkaProduct, { country: 'GB' });

    expect(decision.minimumAge).toBe(18);
    expect(decision.requiresAgeGate).toBe(true);
    expect(decision.requiresCourierAgeCheck).toBe(true);
    expect(decision.badge).toBe('18+');
  });

  it('suppresses HFSS products from checkout upsell strips', () => {
    const engine = new RuleEngine(mockRules);
    const upsells = engine.filterUpsells([hfssChipsProduct, baseProduct], { country: 'GB' });

    expect(upsells.some((p) => p.plu === hfssChipsProduct.plu)).toBe(false);
    expect(upsells.some((p) => p.plu === baseProduct.plu)).toBe(true);
  });

  it('evaluates combined group quantity limits across paracetamol and aspirin in basket', () => {
    const engine = new RuleEngine(mockRules);

    const basketItems: BasketItem[] = [
      {
        id: 'item-1',
        name: baseProduct.name,
        price: basePrice,
        channelLinkId: 'store-1',
        plu: baseProduct.plu,
        quantity: 2,
        itemPrice: basePrice,
        totalPrice: { amount: 240, currency: 'GBP' },
      },
      {
        id: 'item-2',
        name: aspirinProduct.name,
        price: aspirinPrice,
        channelLinkId: 'store-1',
        plu: aspirinProduct.plu,
        quantity: 1,
        itemPrice: aspirinPrice,
        totalPrice: { amount: 150, currency: 'GBP' },
      },
    ];

    const basket: Basket = {
      id: 'bsk-test-1',
      basketId: 'bsk-test-1',
      tenantId: 'brand-alpha',
      storeId: 'store-1',
      storeName: 'Test Store',
      fulfillmentType: 'delivery',
      channelLinkId: 'store-1',
      items: basketItems,
      subtotal: { amount: 390, currency: 'GBP' },
      total: { amount: 390, currency: 'GBP' },
      totalPrice: { amount: 390, currency: 'GBP' },
      discountTotal: { amount: 0, currency: 'GBP' },
      discounts: [],
      charges: [],
      currency: 'GBP',
      validationErrors: [],
      restrictions: [],
      updatedAt: new Date().toISOString(),
    };

    const decision = engine.evaluateBasket(
      basket,
      [baseProduct, aspirinProduct],
      { country: 'GB' }
    );

    expect(decision.isValid).toBe(false);
    expect(decision.groupViolations.length).toBeGreaterThan(0);
    expect(decision.groupViolations[0].groupId).toBe('pain-relief-group');
    expect(decision.groupViolations[0].totalQuantity).toBe(3);
    expect(decision.groupViolations[0].maxAllowed).toBe(2);
  });
});
