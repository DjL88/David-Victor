import { describe, expect, it } from 'vitest';
import { allocateProtectedBundlePrices } from '../commerce/bundleAllocation';
import type { BundleProduct, SelectedBundleModifier } from '../commerce/bundleModels';

function makeBundle(priceMinor: number): BundleProduct {
  return {
    id: 'b', plu: 'BUNDLE', name: 'Test bundle', price: priceMinor, priceMinor,
    currency: 'GBP', isCombo: true, stockStatus: 'IN_STOCK',
    sections: [{
      id: 'required', name: 'Required', min: 2, max: 2,
      modifiers: [
        { id: 'a', name: 'A', plu: 'A', standalonePlu: 'A', standalonePriceMinor: 90, price: 0, active: true, snoozed: false },
        { id: 'b', name: 'B', plu: 'B', standalonePlu: 'B', standalonePriceMinor: 90, price: 0, active: true, snoozed: false },
      ],
    }],
  };
}
function selections(bundle: BundleProduct): SelectedBundleModifier[] {
  return bundle.sections[0].modifiers.map((m) => ({
    modifierId: m.id, plu: m.plu, name: m.name, quantity: 1,
    price: m.price, priceMinor: m.priceMinor ?? m.price,
    standalonePlu: m.standalonePlu, standalonePriceMinor: m.standalonePriceMinor,
    sectionId: 'required', sectionName: 'Required',
  }));
}

describe('bundle pricing safety', () => {
  it('uses normal item total when a fixed bundle would cost more', () => {
    const bundle = makeBundle(200);
    const allocation = allocateProtectedBundlePrices(bundle, selections(bundle));
    expect(allocation.standaloneTotalMinor).toBe(180);
    expect(allocation.targetBundleTotalMinor).toBe(180);
    expect(allocation.discountTotalMinor).toBe(0);
    expect(allocation.components.every((c) => c.discountLineMinor === 0)).toBe(true);
  });

  it('creates no discount when bundle price equals normal item total', () => {
    const bundle = makeBundle(180);
    expect(allocateProtectedBundlePrices(bundle, selections(bundle)).discountTotalMinor).toBe(0);
  });

  it('retains a real saving when bundle price is lower', () => {
    const bundle = makeBundle(150);
    expect(allocateProtectedBundlePrices(bundle, selections(bundle)).discountTotalMinor).toBe(30);
  });
});
