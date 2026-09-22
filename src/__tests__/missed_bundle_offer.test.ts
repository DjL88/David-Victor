import { describe, expect, it } from 'vitest';
import { findMissedBundleOffers, type BundleProduct } from '../commerce/bundleModels';

const bundle: BundleProduct = {
  id: 'meal', plu: 'MEAL', name: 'Meal Deal', price: 500, priceMinor: 500,
  currency: 'GBP', isCombo: true, stockStatus: 'IN_STOCK',
  sections: [
    { id: 'main', name: 'Main', min: 1, max: 1, modifiers: [{ id: 'm1', name: 'Main A', plu: 'M1###', standalonePlu: 'M1', active: true, snoozed: false, price: 0 }] },
    { id: 'snack', name: 'Snack', min: 1, max: 1, modifiers: [{ id: 's1', name: 'Snack A', plu: 'S1###', standalonePlu: 'S1', active: true, snoozed: false, price: 0 }] },
    { id: 'drink', name: 'Drink', min: 1, max: 1, modifiers: [{ id: 'd1', name: 'Drink A', plu: 'D1###', standalonePlu: 'D1', active: true, snoozed: false, price: 0 }] },
  ],
};

describe('findMissedBundleOffers', () => {
  it('prompts only when exactly one required unit remains', () => {
    const offers = findMissedBundleOffers([{ plu: 'M1', quantity: 1 }, { plu: 'S1', quantity: 1 }], [bundle]);
    expect(offers).toHaveLength(1);
    expect(offers[0].missingComponents).toEqual([{
      plu: 'D1',
      name: 'Drink A',
      quantityNeeded: 1,
      sectionId: 'drink',
      modifierId: 'd1',
      imageUrl: undefined,
    }]);
  });

  it('does not prompt at an arbitrary percentage when two required units remain', () => {
    expect(findMissedBundleOffers([{ plu: 'M1', quantity: 1 }], [bundle])).toHaveLength(0);
  });

  it('does not prompt after the bundle is already fully represented', () => {
    expect(findMissedBundleOffers([
      { plu: 'M1', quantity: 1 }, { plu: 'S1', quantity: 1 }, { plu: 'D1', quantity: 1 },
    ], [bundle])).toHaveLength(0);
  });
  it('does not reuse units already claimed by an active combo discount', () => {
    const twoFor: BundleProduct = {
      id: 'nuts-2', plu: 'NUTS2', name: '2 for £2', price: 200, priceMinor: 200,
      currency: 'GBP', isCombo: true, stockStatus: 'IN_STOCK',
      sections: [
        { id: 'one', name: 'First', min: 1, max: 1, modifiers: [{ id: 'n1', name: 'Nuts', plu: 'S1###', standalonePlu: 'S1', active: true, snoozed: false, price: 0 }] },
        { id: 'two', name: 'Second', min: 1, max: 1, modifiers: [{ id: 'n2', name: 'Nuts', plu: 'S1###', standalonePlu: 'S1', active: true, snoozed: false, price: 0 }] },
      ],
    };
    const items = [
      { plu: 'M1', quantity: 1 }, { plu: 'S1', quantity: 1 }, { plu: 'D1', quantity: 1 },
    ];
    expect(findMissedBundleOffers(items, [bundle, twoFor], [{ title: 'Combo Deal: Meal Deal' }])).toHaveLength(0);
  });

  it('leaves surplus quantity free after an allocated combo consumes one unit', () => {
    const twoFor: BundleProduct = {
      id: 'nuts-2', plu: 'NUTS2', name: '2 for £2', price: 200, priceMinor: 200,
      currency: 'GBP', isCombo: true, stockStatus: 'IN_STOCK',
      sections: [
        { id: 'one', name: 'First', min: 1, max: 1, modifiers: [{ id: 'n1', name: 'Nuts', plu: 'S1###', standalonePlu: 'S1', active: true, snoozed: false, price: 0 }] },
        { id: 'two', name: 'Second', min: 1, max: 1, modifiers: [{ id: 'n2', name: 'Nuts', plu: 'S1###', standalonePlu: 'S1', active: true, snoozed: false, price: 0 }] },
      ],
    };
    const items = [
      { plu: 'M1', quantity: 1 }, { plu: 'S1', quantity: 2 }, { plu: 'D1', quantity: 1 },
    ];
    const offers = findMissedBundleOffers(items, [bundle, twoFor], [{ title: 'Combo Deal: Meal Deal' }]);
    expect(offers.some((offer) => offer.bundle.id === 'nuts-2')).toBe(true);
  });
});
