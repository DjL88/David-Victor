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
});
