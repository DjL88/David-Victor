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

  it('ignores historic allocation ownership and derives opportunity from current basket', () => {
    const offers = findMissedBundleOffers(
      [{ plu: 'M1', quantity: 1 }, { plu: 'S1', quantity: 1 }],
      [bundle]
    );
    expect(offers).toHaveLength(1);
    expect(offers[0].missingSection.choices.map((choice) => choice.plu)).toEqual(['D1']);
  });

  it('filters missing-section choices against the current store catalogue', () => {
    const multiChoice: BundleProduct = {
      ...bundle,
      sections: bundle.sections.map((section) => section.id !== 'drink' ? section : {
        ...section,
        modifiers: [
          ...section.modifiers,
          { id: 'd2', name: 'Drink B', plu: 'D2###', standalonePlu: 'D2', active: true, snoozed: false, price: 0 },
        ],
      }),
    };
    const offers = findMissedBundleOffers(
      [{ plu: 'M1', quantity: 1 }, { plu: 'S1', quantity: 1 }],
      [multiChoice],
      [
        { plu: 'D1', active: true, stockStatus: 'IN_STOCK' },
        { plu: 'D2', active: true, stockStatus: 'OUT_OF_STOCK' },
      ]
    );
    expect(offers).toHaveLength(1);
    expect(offers[0].missingSection.choices.map((choice) => choice.plu)).toEqual(['D1']);
  });

  it('does not let one shared PLU unit satisfy two required sections', () => {
    const shared: BundleProduct = {
      ...bundle,
      id: 'shared',
      sections: [
        { id: 'one', name: 'One', min: 1, max: 1, modifiers: [{ id: 'x1', name: 'X', plu: 'X#1', standalonePlu: 'X', active: true, snoozed: false, price: 0 }] },
        { id: 'two', name: 'Two', min: 1, max: 1, modifiers: [{ id: 'x2', name: 'X', plu: 'X#2', standalonePlu: 'X', active: true, snoozed: false, price: 0 }] },
        { id: 'three', name: 'Three', min: 1, max: 1, modifiers: [{ id: 'y', name: 'Y', plu: 'Y#', standalonePlu: 'Y', active: true, snoozed: false, price: 0 }] },
      ],
    };
    expect(findMissedBundleOffers([{ plu: 'X', quantity: 1 }], [shared])).toHaveLength(0);
  });

  it('does not prompt after the bundle is already fully represented', () => {
    expect(findMissedBundleOffers([
      { plu: 'M1', quantity: 1 }, { plu: 'S1', quantity: 1 }, { plu: 'D1', quantity: 1 },
    ], [bundle])).toHaveLength(0);
  });
});


it('keeps distinct deal opportunities even when their missing section overlaps', () => {
  const base = bundle;
  const cheaper = { ...base, id: 'cheaper', plu: 'CHEAPER', priceMinor: Math.max(0, (base.priceMinor || 0) - 100) };
  const dearer = { ...base, id: 'dearer', plu: 'DEARER', priceMinor: base.priceMinor };
  const required = (base.sections || []).filter((section) => !section.isUpsell && section.min > 0);
  const basketItems = required.slice(0, -1).flatMap((section) => {
    const modifier = section.modifiers.find((candidate) => candidate.standalonePlu);
    return modifier?.standalonePlu ? [{ plu: modifier.standalonePlu, quantity: section.min }] : [];
  });
  const offers = findMissedBundleOffers(basketItems, [dearer as any, cheaper as any]);
  expect(offers.map((offer) => offer.bundle.id).sort()).toEqual(['cheaper', 'dearer']);
});
