import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeliverectApiClient } from '../../server/deliverect/DeliverectApiClient';
import { FirestorePlatformService } from '../../server/firestoreService';
import { setServerRuntimeMode } from '../../server/runtimeMode';
import type { BundleProduct } from '../commerce/bundleModels';

describe('individual-line bundle basket write', () => {
  beforeEach(() => {
    setServerRuntimeMode('demo');
    vi.restoreAllMocks();
  });

  it('writes normal standalone PLUs, never the parent combo PLU, and applies the exact bundle saving', async () => {
    const basketId = `basket-bundle-${Date.now()}`;
    const tenantId = 'brand-alpha';
    const client = new DeliverectApiClient(tenantId) as any;

    const currentBasket: any = {
      id: basketId,
      storeId: 'store-1',
      storeName: 'Test Store',
      fulfillmentType: 'pickup',
      items: [],
      subtotal: { amount: 0, currency: 'GBP' },
      discounts: [],
      charges: [],
      total: { amount: 0, currency: 'GBP' },
      discountTotal: { amount: 0, currency: 'GBP' },
      currency: 'GBP',
      validationErrors: [],
      restrictions: [],
      updatedAt: new Date().toISOString(),
    };

    const bundle: BundleProduct = {
      id: 'bundle-1',
      plu: 'MEAL-DEAL-PARENT',
      name: 'Meal Deal',
      price: 500,
      priceMinor: 500,
      currency: 'GBP',
      isCombo: true,
      stockStatus: 'IN_STOCK',
      sections: [
        {
          id: 'required',
          name: 'Choose 3',
          min: 3,
          max: 3,
          isCombo: true,
          modifiers: [
            {
              id: 'a-mod',
              plu: 'A###',
              standalonePlu: 'A',
              standalonePriceMinor: 300,
              name: 'Main',
              price: 0,
              priceMinor: 0,
              active: true,
              snoozed: false,
            },
            {
              id: 'b-mod',
              plu: 'B###',
              standalonePlu: 'B',
              standalonePriceMinor: 200,
              name: 'Drink',
              price: 0,
              priceMinor: 0,
              active: true,
              snoozed: false,
            },
            {
              id: 'c-mod',
              plu: 'C###',
              standalonePlu: 'C',
              standalonePriceMinor: 100,
              name: 'Snack',
              price: 0,
              priceMinor: 0,
              active: true,
              snoozed: false,
            },
          ],
        },
      ],
    };

    client.getStoreCatalog = vi.fn().mockResolvedValue({
      id: 'menu-1',
      type: 'STORE',
      storeId: 'store-1',
      activeMenuId: 'menu-1',
      categories: [],
      products: [
        {
          id: 'a',
          plu: 'A',
          name: 'Main',
          price: { amount: 300, currency: 'GBP' },
          active: true,
          stockStatus: 'IN_STOCK',
        },
        {
          id: 'b',
          plu: 'B',
          name: 'Drink',
          price: { amount: 200, currency: 'GBP' },
          active: true,
          stockStatus: 'IN_STOCK',
        },
        {
          id: 'c',
          plu: 'C',
          name: 'Snack',
          price: { amount: 100, currency: 'GBP' },
          active: true,
          stockStatus: 'IN_STOCK',
        },
      ],
      bundleCatalog: {
        id: 'bundles-1',
        storeId: 'store-1',
        bundles: [bundle],
        totalBundles: 1,
        updatedAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    });

    let replacedItems: any[] = [];
    let appliedDiscounts: any[] = [];

    const api = {
      getBasket: vi.fn().mockResolvedValue({
        id: basketId,
        storeId: 'store-1',
        fulfillment: { type: 'pickup' },
        items: [],
        discounts: [],
        payment: { total: 0, subtotal: 0, discountsTotal: 0 },
      }),
      replaceItems: vi.fn().mockImplementation(async (_basketId: string, items: any[]) => {
        replacedItems = items;
        return {
          id: basketId,
          storeId: 'store-1',
          fulfillment: { type: 'pickup' },
          items: items.map((item) => ({
            id: `line-${item.plu}`,
            menuId: item.menuId,
            plu: item.plu,
            name: item.plu,
            quantity: item.quantity,
            price: item.plu === 'A' ? 300 : item.plu === 'B' ? 200 : 100,
          })),
          discounts: [],
          payment: { subtotal: 600, discountsTotal: 0, total: 600 },
        };
      }),
      updateDiscounts: vi.fn().mockImplementation(async (_basketId: string, discounts: any[]) => {
        appliedDiscounts = discounts;
        return {
          id: basketId,
          storeId: 'store-1',
          fulfillment: { type: 'pickup' },
          items: replacedItems.map((item) => ({
            id: `line-${item.plu}`,
            menuId: item.menuId,
            plu: item.plu,
            name: item.plu,
            quantity: item.quantity,
            price: item.plu === 'A' ? 300 : item.plu === 'B' ? 200 : 100,
          })),
          discounts: discounts.map((discount, index) => ({
            id: `discount-${index}`,
            code: discount.externalId || `discount-${index}`,
            name: discount.name,
            amount: discount.amount,
          })),
          payment: { subtotal: 600, discountsTotal: 100, total: 500 },
        };
      }),
    };

    client.getCommerceBasketApi = vi.fn().mockResolvedValue(api);
    client.mapLiveCommerceBasket = vi.fn().mockImplementation(async (raw: any) => {
      if (raw?.payment?.total === 500) {
        return {
          ...currentBasket,
          items: [
            { id: 'line-A', plu: 'A', name: 'Main', quantity: 1, price: { amount: 300, currency: 'GBP' } },
            { id: 'line-B', plu: 'B', name: 'Drink', quantity: 1, price: { amount: 200, currency: 'GBP' } },
            { id: 'line-C', plu: 'C', name: 'Snack', quantity: 1, price: { amount: 100, currency: 'GBP' } },
          ],
          subtotal: { amount: 600, currency: 'GBP' },
          discounts: [{ code: 'bundle', title: 'Combo Deal: Meal Deal', amount: { amount: 100, currency: 'GBP' } }],
          discountTotal: { amount: 100, currency: 'GBP' },
          total: { amount: 500, currency: 'GBP' },
        };
      }
      return currentBasket;
    });

    const result = await client.addBundleToBasket(basketId, {
      bundleId: bundle.id,
      bundlePlu: bundle.plu,
      quantity: 1,
      selections: [
        { sectionId: 'required', modifierId: 'a-mod', quantity: 1 },
        { sectionId: 'required', modifierId: 'b-mod', quantity: 1 },
        { sectionId: 'required', modifierId: 'c-mod', quantity: 1 },
      ],
    });

    expect(replacedItems).toEqual([
      expect.objectContaining({
        menuId: 'menu-1',
        plu: 'A',
        quantity: 1,
        itemUnavailableActions: [
          'ITEM_AMENDMENT',
          'ITEM_REMOVE',
          'ITEM_SUBSTITUTION_CATALOG',
        ],
      }),
      expect.objectContaining({
        menuId: 'menu-1',
        plu: 'B',
        quantity: 1,
        itemUnavailableActions: [
          'ITEM_AMENDMENT',
          'ITEM_REMOVE',
          'ITEM_SUBSTITUTION_CATALOG',
        ],
      }),
      expect.objectContaining({
        menuId: 'menu-1',
        plu: 'C',
        quantity: 1,
        itemUnavailableActions: [
          'ITEM_AMENDMENT',
          'ITEM_REMOVE',
          'ITEM_SUBSTITUTION_CATALOG',
        ],
      }),
    ]);
    expect(replacedItems.some((item) => item.plu === 'MEAL-DEAL-PARENT')).toBe(false);

    // Basket discount PATCH uses one order-level flat discount for the bundle.
    // Component-level protected pricing remains in our allocation ledger; PLU-only
    // item_flat_off payloads are not a valid substitute for Deliverect item references.
    expect(appliedDiscounts).toEqual([
      expect.objectContaining({
        type: 'order_flat_off',
        provider: 'restaurant',
        amount: 100,
        value: 100,
        name: 'Combo Deal: Meal Deal',
      }),
    ]);

    expect(result.items.map((item: any) => item.plu)).toEqual(['A', 'B', 'C']);
    expect(result.total.amount).toBe(500);

    const ledger = await FirestorePlatformService.getBasketBundleAllocations(
      tenantId,
      basketId
    );
    expect(ledger).toHaveLength(1);
    expect(ledger[0].discountTotalMinor).toBe(100);
    expect(ledger[0].components.map((component) => ({
      plu: component.componentPlu,
      protected: component.protectedLineTotalMinor,
    }))).toEqual([
      { plu: 'A', protected: 250 },
      { plu: 'B', protected: 167 },
      { plu: 'C', protected: 83 },
    ]);
  });
});
