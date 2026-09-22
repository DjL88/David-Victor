import { describe, expect, it } from 'vitest';
import { DeliverectApiClient } from '../../server/deliverect/DeliverectApiClient';
import {
  allocateProtectedBundlePrices,
} from '../commerce/bundleAllocation';
import type {
  BundleProduct,
  SelectedBundleModifier,
} from '../commerce/bundleModels';

describe('protected bundle component allocation', () => {
  const bundle: BundleProduct = {
    id: 'bundle-1',
    plu: 'MEAL-DEAL',
    name: 'Meal Deal',
    price: 500,
    priceMinor: 500,
    currency: 'GBP',
    isCombo: true,
    stockStatus: 'IN_STOCK',
    sections: [
      {
        id: 'required',
        name: 'Choose items',
        min: 3,
        max: 3,
        isCombo: true,
        modifiers: [
          {
            id: 'a',
            plu: 'A###',
            standalonePlu: 'A',
            standalonePriceMinor: 300,
            name: '£3 Main',
            price: 0,
            priceMinor: 0,
            active: true,
            snoozed: false,
          },
          {
            id: 'b',
            plu: 'B###',
            standalonePlu: 'B',
            standalonePriceMinor: 200,
            name: '£2 Premium Drink',
            price: 100,
            priceMinor: 100,
            active: true,
            snoozed: false,
          },
          {
            id: 'c',
            plu: 'C###',
            standalonePlu: 'C',
            standalonePriceMinor: 100,
            name: '£1 Snack',
            price: 0,
            priceMinor: 0,
            active: true,
            snoozed: false,
          },
        ],
      },
    ],
  };

  const selection: SelectedBundleModifier[] = [
    {
      modifierId: 'a',
      plu: 'A###',
      name: '£3 Main',
      quantity: 1,
      price: 0,
      priceMinor: 0,
      sectionId: 'required',
      sectionName: 'Choose items',
    },
    {
      modifierId: 'b',
      plu: 'B###',
      name: '£2 Premium Drink',
      quantity: 1,
      price: 100,
      priceMinor: 100,
      sectionId: 'required',
      sectionName: 'Choose items',
    },
    {
      modifierId: 'c',
      plu: 'C###',
      name: '£1 Snack',
      quantity: 1,
      price: 0,
      priceMinor: 0,
      sectionId: 'required',
      sectionName: 'Choose items',
    },
  ];

  it('weights the £5 base price by £3/£2/£1 standalone values and assigns the £1 uplift to its item', () => {
    const allocation = allocateProtectedBundlePrices(bundle, selection);

    expect(allocation.baseBundlePriceMinor).toBe(500);
    expect(allocation.upliftTotalMinor).toBe(100);
    expect(allocation.targetBundleTotalMinor).toBe(600);
    expect(allocation.standaloneTotalMinor).toBe(600);
    expect(allocation.discountTotalMinor).toBe(0);

    const main = allocation.components.find((component) => component.componentPlu === 'A')!;
    const premium = allocation.components.find((component) => component.componentPlu === 'B')!;
    const snack = allocation.components.find((component) => component.componentPlu === 'C')!;

    // £5 base + £1 uplift equals the exact £6 shelf total, so this is
    // priced-by-item rather than inventing a zero-value discount allocation.
    expect(main.protectedUnitPricesMinor).toEqual([300]);
    expect(premium.protectedUnitPricesMinor).toEqual([200]);
    expect(snack.protectedUnitPricesMinor).toEqual([100]);

    expect(
      allocation.components.reduce(
        (sum, component) => sum + component.protectedLineTotalMinor,
        0
      )
    ).toBe(600);
  });

  it('removing one bundle component never reprices the surviving components upward', () => {
    const noUpliftBundle: BundleProduct = {
      ...bundle,
      sections: [
        {
          ...bundle.sections[0],
          modifiers: bundle.sections[0].modifiers.map((modifier) => ({
            ...modifier,
            price: 0,
            priceMinor: 0,
          })),
        },
      ],
    };
    const noUpliftSelection = selection.map((item) => ({
      ...item,
      price: 0,
      priceMinor: 0,
    }));

    const allocation = allocateProtectedBundlePrices(
      noUpliftBundle,
      noUpliftSelection
    );
    expect(allocation.targetBundleTotalMinor).toBe(500);
    expect(allocation.discountTotalMinor).toBe(100);

    const survivingTotal = allocation.components
      .filter((component) => component.componentPlu !== 'B')
      .reduce((sum, component) => sum + component.protectedLineTotalMinor, 0);

    expect(survivingTotal).toBe(333);
    expect(
      allocation.components.find((component) => component.componentPlu === 'A')
        ?.protectedLineTotalMinor
    ).toBe(250);
    expect(
      allocation.components.find((component) => component.componentPlu === 'C')
        ?.protectedLineTotalMinor
    ).toBe(83);
  });

  it('resolves bundle variants back to standalone PLUs and prices from the menu', () => {
    const rawMenu = {
      menuId: 'menu-1',
      currency: 'GBP',
      categories: [],
      modifierGroups: {
        group: {
          id: 'group',
          name: 'Choose 3',
          min: 3,
          max: 3,
          isCombo: true,
          modifiers: ['mod-a', 'mod-b', 'mod-c'],
        },
      },
      modifiers: {
        'mod-a': {
          id: 'mod-a',
          name: 'Main in bundle',
          plu: 'A###',
          referenceId: 'A',
          price: 0,
        },
        'mod-b': {
          id: 'mod-b',
          name: 'Premium drink in bundle',
          plu: 'B###',
          referenceId: 'B',
          price: 100,
        },
        'mod-c': {
          id: 'mod-c',
          name: 'Snack in bundle',
          plu: 'C###',
          referenceId: 'C',
          price: 0,
        },
      },
      products: [
        { id: 'a-normal', plu: 'A', name: 'Main', price: 300 },
        { id: 'b-normal', plu: 'B', name: 'Drink', price: 200 },
        { id: 'c-normal', plu: 'C', name: 'Snack', price: 100 },
        {
          id: 'bundle-1',
          plu: 'MEAL-DEAL',
          name: 'Meal Deal',
          price: 500,
          isCombo: true,
          modifierGroups: ['group'],
        },
      ],
    };

    const parsed = DeliverectApiClient.parseDeliverectMenu(rawMenu, true);
    const parsedBundle = parsed.bundleCatalog.bundles[0];
    const parsedModifiers = parsedBundle.sections[0].modifiers;

    expect(parsedModifiers.map((modifier) => ({
      plu: modifier.standalonePlu,
      price: modifier.standalonePriceMinor,
      uplift: modifier.priceMinor,
    }))).toEqual([
      { plu: 'A', price: 300, uplift: 0 },
      { plu: 'B', price: 200, uplift: 100 },
      { plu: 'C', price: 100, uplift: 0 },
    ]);
  });

  it('fails closed when a required component has no authoritative standalone price', () => {
    const broken: BundleProduct = {
      ...bundle,
      sections: [
        {
          ...bundle.sections[0],
          modifiers: bundle.sections[0].modifiers.map((modifier) =>
            modifier.id === 'c'
              ? { ...modifier, standalonePriceMinor: undefined }
              : modifier
          ),
        },
      ],
    };

    expect(() => allocateProtectedBundlePrices(broken, selection)).toThrow(
      /missing an authoritative standalone price/i
    );
  });

  it('prices by item when a configured bundle would cost more than its selected standalone products', () => {
    const expensiveBundle: BundleProduct = {
      ...bundle,
      price: 700,
      priceMinor: 700,
    };

    const allocation = allocateProtectedBundlePrices(expensiveBundle, selection);
    expect(allocation.standaloneTotalMinor).toBe(600);
    expect(allocation.targetBundleTotalMinor).toBe(600);
    expect(allocation.discountTotalMinor).toBe(0);
    expect(allocation.components.map((component) => component.protectedLineTotalMinor))
      .toEqual([300, 200, 100]);
  });
});
