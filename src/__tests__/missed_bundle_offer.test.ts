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

  it('does not reuse a unit already allocated to another bundle', () => {
    const offers = findMissedBundleOffers(
      [{ plu: 'M1', quantity: 1 }, { plu: 'S1', quantity: 1 }],
      [bundle],
      [{ plu: 'S1', quantity: 1 }]
    );
    expect(offers).toHaveLength(0);
  });

  it('keeps quantity above an existing allocation available for a legitimate offer', () => {
    const offers = findMissedBundleOffers(
      [{ plu: 'M1', quantity: 1 }, { plu: 'S1', quantity: 2 }],
      [bundle],
      [{ plu: 'S1', quantity: 1 }]
    );
    expect(offers).toHaveLength(1);
    expect(offers[0].missingComponents[0].plu).toBe('D1');
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


it('shows only the strongest missed deal when two bundles compete for the same missing product', () => {
  const base = bundle;
  const cheaper = { ...base, id: 'cheaper', plu: 'CHEAPER', priceMinor: Math.max(0, (base.priceMinor || 0) - 100) };
  const dearer = { ...base, id: 'dearer', plu: 'DEARER', priceMinor: base.priceMinor };
  const required = (base.sections || []).filter((section) => !section.isUpsell && section.min > 0);
  const basketItems = required.slice(0, -1).flatMap((section) => {
    const modifier = section.modifiers.find((candidate) => candidate.standalonePlu);
    return modifier?.standalonePlu ? [{ plu: modifier.standalonePlu, quantity: section.min }] : [];
  });
  const offers = findMissedBundleOffers(basketItems, [dearer as any, cheaper as any]);
  expect(offers.length).toBeLessThanOrEqual(1);
  if (offers.length === 1) expect(offers[0].bundle.id).toBe('cheaper');
});
