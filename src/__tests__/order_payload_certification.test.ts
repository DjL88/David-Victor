import { describe, expect, it } from 'vitest';
import {
  buildQuestItemUnavailableActions,
  mapDeliverectBasket,
  toCommerceItemInputs,
} from '../../server/deliverect/DeliverectBasketMapper';
import { projectRetailQuestOrder } from '../../server/deliverect/RetailQuestOrderContract';

describe('WP-05 order payload certification', () => {
  it('preserves restaurant modifiers/subItems and authoritative discounts + service charges', () => {
    const basket = mapDeliverectBasket({
      id: 'restaurant-basket-1',
      storeId: 'restaurant-store-1',
      menuId: 'menu-1',
      currency: 'GBP',
      decimalDigits: 2,
      items: [{
        id: 'line-1',
        plu: 'BURGER',
        name: 'Burger',
        quantity: 1,
        price: 1200,
        subItems: [
          { plu: 'CHEESE', name: 'Cheese', quantity: 1, price: 100, modifierId: 'extras' },
          { plu: 'BACON', name: 'Bacon', quantity: 1, price: 100, modifierId: 'extras' },
        ],
      }],
      payment: { subTotal: 1200, total: 1250 },
      serviceCharge: 150,
      discounts: [{ id: 'promo-1', code: 'SAVE100', title: 'Promotion', amount: 100 }],
    });

    expect(basket.total.amount).toBe(1250);
    expect(basket.charges).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'serviceCharge', amount: expect.objectContaining({ amount: 150 }) }),
    ]));
    expect(basket.discounts).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'SAVE100', amount: expect.objectContaining({ amount: 100 }) }),
    ]));

    const outbound = toCommerceItemInputs(basket);
    expect(outbound).toEqual([expect.objectContaining({
      menuId: 'menu-1',
      plu: 'BURGER',
      quantity: 1,
      subItems: [
        { plu: 'CHEESE', quantity: 1 },
        { plu: 'BACON', quantity: 1 },
      ],
    })]);
  });

  it('keeps Retail payment amount authoritative while fees/discounts remain reconciled in the basket total', () => {
    const payload = projectRetailQuestOrder({
      channelOrderId: 'LT-WP05-1',
      channelOrderDisplayId: 'LT-WP05-1',
      placedTime: '2026-09-24T20:00:00.000Z',
      fulfillmentType: 'pickup',
      totalMinor: 1250,
      hasOnlineAuthorization: true,
      items: [{ plu: 'BURGER', name: 'Burger', quantity: 1, unitPriceMinor: 1200 }],
    });

    expect(payload.payment).toEqual({ amount: 1250, type: 0, due: 0, rebate: 0 });
    expect(payload.orderIsAlreadyPaid).toBe(true);
    expect(payload.items[0]).toMatchObject({ plu: 'BURGER', price: 1200, quantity: 1 });
  });

  it('keeps unpaid Retail due semantics explicit and never marks the order already paid', () => {
    const payload = projectRetailQuestOrder({
      channelOrderId: 'LT-WP05-2',
      channelOrderDisplayId: 'LT-WP05-2',
      placedTime: '2026-09-24T20:00:00.000Z',
      fulfillmentType: 'pickup',
      totalMinor: 1250,
      hasOnlineAuthorization: false,
      items: [{ plu: 'BURGER', quantity: 1, unitPriceMinor: 1200 }],
    });

    expect(payload.payment).toEqual({ amount: 1250, type: 0, due: 1250, rebate: 0 });
    expect(payload.orderIsAlreadyPaid).toBe(false);
  });

  it('certifies cancellation semantics without inventing a provider field', () => {
    expect(buildQuestItemUnavailableActions('CANCEL_ORDER_IF_UNAVAILABLE')).toEqual([
      'ITEM_AMENDMENT',
      'CANCEL_ORDER',
    ]);

    const payload = projectRetailQuestOrder({
      channelOrderId: 'LT-WP05-3',
      channelOrderDisplayId: 'LT-WP05-3',
      placedTime: '2026-09-24T20:00:00.000Z',
      fulfillmentType: 'pickup',
      totalMinor: 500,
      hasOnlineAuthorization: false,
      items: [{
        plu: 'MILK',
        quantity: 1,
        unitPriceMinor: 500,
        substitutionPreference: 'CANCEL_ORDER_IF_UNAVAILABLE',
      }],
    });

    expect(payload.items[0].itemUnavailableActions).toEqual(['ITEM_AMENDMENT', 'CANCEL_ORDER']);
    expect(payload).not.toHaveProperty('cancelled');
    expect(payload).not.toHaveProperty('cancellation');
  });

  it('fails closed when restaurant totals cannot explain discounts/charges', () => {
    expect(() => mapDeliverectBasket({
      id: 'restaurant-basket-bad-total',
      storeId: 'restaurant-store-1',
      menuId: 'menu-1',
      currency: 'GBP',
      items: [{ plu: 'BURGER', quantity: 1, price: 1200 }],
      payment: { subTotal: 1200, total: 1200 },
      serviceCharge: 150,
      discounts: [{ amount: 100 }],
    })).toThrow(/total reconciliation failed/i);
  });
});
