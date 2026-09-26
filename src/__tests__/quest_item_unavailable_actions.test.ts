import { describe, expect, it } from 'vitest';
import {
  buildQuestItemUnavailableActions,
  toCommerceItemInputs,
  type MappedBasket,
} from '../../server/deliverect/DeliverectBasketMapper';

describe('Quest item unavailable actions', () => {
  it('enables amend/remove/catalog substitution for BEST_MATCH', () => {
    expect(buildQuestItemUnavailableActions('BEST_MATCH')).toEqual([
      'ITEM_AMENDMENT',
      'ITEM_REMOVE',
      'ITEM_SUBSTITUTION_CATALOG',
    ]);
  });

  it('persists the customer-selected candidate while using catalogue permissions', () => {
    const basket = {
      id: 'basket-1',
      storeId: 'store-1',
      storeName: 'Store',
      fulfillmentType: 'pickup',
      items: [
        {
          id: 'line-1',
          plu: 'ORIGINAL',
          name: 'Original',
          quantity: 1,
          price: { amount: 200, currency: 'GBP' },
          unitPrice: { amount: 200, currency: 'GBP' },
          totalPrice: { amount: 200, currency: 'GBP' },
          substitutionPreference: 'CUSTOMER_SELECTED',
          preferredSubstitutePlu: 'SUB-1',
          preferredSubstituteName: 'Approved Substitute',
          preferredSubstitutePrice: { amount: 250, currency: 'GBP' },
          deliverect: {
            menuId: 'menu-1',
            rawUnitPriceMinor: 200,
          },
        },
      ],
      subtotal: { amount: 200, currency: 'GBP' },
      discounts: [],
      charges: [],
      total: { amount: 200, currency: 'GBP' },
      discountTotal: { amount: 0, currency: 'GBP' },
      currency: 'GBP',
      validationErrors: [],
      restrictions: [],
      updatedAt: new Date().toISOString(),
      deliverect: {
        basketId: 'basket-1',
        storeId: 'store-1',
        hasAuthoritativeTotal: true,
      },
    } as unknown as MappedBasket;

    const [item] = toCommerceItemInputs(basket);

    expect(item.itemUnavailableActions).toEqual([
      'ITEM_AMENDMENT',
      'ITEM_REMOVE',
      'ITEM_SUBSTITUTION_CATALOG',
    ]);
    expect(item.substituteCandidate).toEqual([
      {
        plu: 'SUB-1',
        name: 'Approved Substitute',
        quantity: 1,
        price: 250,
      },
    ]);
  });

  it('keeps removal/amendment available when substitution is disallowed', () => {
    expect(buildQuestItemUnavailableActions('DO_NOT_SUBSTITUTE')).toEqual([
      'ITEM_AMENDMENT',
      'ITEM_REMOVE',
    ]);
    expect(buildQuestItemUnavailableActions('REMOVE_IF_UNAVAILABLE')).toEqual([
      'ITEM_AMENDMENT',
      'ITEM_REMOVE',
    ]);
  });
});
