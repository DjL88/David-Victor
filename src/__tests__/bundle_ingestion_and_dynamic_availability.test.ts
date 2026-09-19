import { describe, it, expect } from 'vitest';
import { DeliverectApiClient } from '../../server/deliverect/DeliverectApiClient';
import {
  evaluateBundleSectionAvailability,
  evaluateBundleStockStatus,
  BundleProduct,
  BundleModifierGroup,
} from '../commerce/bundleModels';

describe('Bundle Ingestion & Dynamic Availability Engine (Step 6 Prompt 1)', () => {
  const sampleDeliverectBundleMenu = {
    menuId: 'menu_meal_deals_001',
    name: 'Lunch & Meal Deals',
    currency: 'GBP',
    categories: [
      {
        id: 'cat_meal_deals',
        name: 'Meal Deals',
        subCategories: [],
        productIds: ['prod_meal_deal_test', 'prod_standard_sandwich'],
      },
    ],
    modifierGroups: {
      mg_mains: {
        id: 'mg_mains',
        name: 'Choose 1 Main',
        min: 1,
        max: 1,
        multiMin: 1,
        multiMax: 1,
        isCombo: true,
        modifiers: ['mod_chicken_wrap', 'mod_vegan_salad'],
      },
      mg_snacks: {
        id: 'mg_snacks',
        name: 'Choose 3 Snacks',
        min: 3,
        max: 3,
        multiMin: 3, // Requires 3 distinct options
        multiMax: 1, // Max 1 of each snack
        isCombo: true,
        modifiers: ['mod_crisps', 'mod_baked_beans', 'mod_apple'],
      },
      mg_drinks: {
        id: 'mg_drinks',
        name: 'Choose 1 Drink',
        min: 1,
        max: 1,
        multiMin: 1,
        multiMax: 1,
        isCombo: true,
        modifiers: ['mod_diet_coke', 'mod_orange_juice'],
      },
      mg_upsell_dessert: {
        id: 'mg_upsell_dessert',
        name: 'Add a Sweet Treat (Optional)',
        min: 0,
        max: 2,
        multiMin: 0,
        multiMax: 2,
        isCombo: false,
        isUpsell: true,
        modifiers: ['mod_brownie', 'mod_strawberries'],
      },
    },
    modifiers: {
      mod_chicken_wrap: {
        id: 'mod_chicken_wrap',
        name: 'Roast Chicken Salad Wrap',
        plu: 'PLU_CW_01',
        price: 0, // Included in base price
        active: true,
      },
      mod_vegan_salad: {
        id: 'mod_vegan_salad',
        name: 'Mediterranean Falafel Salad',
        plu: 'PLU_FS_02',
        price: 0,
        active: true,
      },
      mod_crisps: {
        id: 'mod_crisps',
        name: 'Sea Salt & Vinegar Crisps',
        plu: 'PLU_CR_01',
        price: 0,
        active: true,
      },
      mod_baked_beans: {
        id: 'mod_baked_beans',
        name: "Dave's Baked Beans",
        plu: 'PLU_DBB_01',
        price: 0,
        active: true,
      },
      mod_apple: {
        id: 'mod_apple',
        name: 'Braeburn Apple',
        plu: 'PLU_AP_01',
        price: 0,
        active: true,
      },
      mod_diet_coke: {
        id: 'mod_diet_coke',
        name: 'Diet Coke 330ml',
        plu: 'PLU_DC_330',
        price: 0,
        active: true,
      },
      mod_orange_juice: {
        id: 'mod_orange_juice',
        name: 'Fresh Orange Juice 250ml',
        plu: 'PLU_OJ_250',
        price: 30, // +30p minor unit uplift
        active: true,
      },
      mod_brownie: {
        id: 'mod_brownie',
        name: 'Belgian Chocolate Brownie',
        plu: 'PLU_BR_01',
        price: 150, // +£1.50 uplift
        active: true,
      },
      mod_strawberries: {
        id: 'mod_strawberries',
        name: 'Fresh Strawberries Pot',
        plu: 'PLU_SB_01',
        price: 50, // +50p minor unit uplift
        active: true,
      },
    },
    products: [
      {
        id: 'prod_meal_deal_test',
        plu: 'PLU_MD_TEST',
        name: 'Meal Deal Test',
        description: 'Includes 1 Main, 3 Snacks, and 1 Drink for £5.00',
        price: 500, // £5.00 base price in minor units
        isCombo: true,
        modifierGroups: ['mg_mains', 'mg_snacks', 'mg_drinks', 'mg_upsell_dessert'],
      },
      {
        id: 'prod_standard_sandwich',
        plu: 'PLU_STD_SW',
        name: 'Standard BLT Sandwich',
        description: 'Fresh BLT sandwich on malted bread',
        price: 350,
        isCombo: false,
      },
    ],
  };

  it('identifies parent combo items (isCombo: true) and extracts them into bundleCatalog', () => {
    const result = DeliverectApiClient.parseDeliverectMenu(sampleDeliverectBundleMenu, true);

    expect(result.bundleCatalog).toBeDefined();
    expect(result.bundleCatalog.totalBundles).toBe(1);
    expect(result.bundleCatalog.bundles.length).toBe(1);

    const bundle = result.bundleCatalog.bundles[0];
    expect(bundle.id).toBe('prod_meal_deal_test');
    expect(bundle.name).toBe('Meal Deal Test');
    expect(bundle.isCombo).toBe(true);
    expect(bundle.price).toBe(500); // minor units
    expect(bundle.priceMinor).toBe(500);
    expect(bundle.currency).toBe('GBP');

    // Standard products should NOT contain the combo
    expect(result.products.some((p) => p.id === 'prod_meal_deal_test')).toBe(false);
    expect(result.products.some((p) => p.id === 'prod_standard_sandwich')).toBe(true);
  });

  it('correctly extracts sections (modifier groups) with combo and upsell flags and selection boundaries', () => {
    const result = DeliverectApiClient.parseDeliverectMenu(sampleDeliverectBundleMenu, true);
    const bundle = result.bundleCatalog.bundles[0];

    expect(bundle.sections.length).toBe(4);

    // Mains section
    const mains = bundle.sections.find((s) => s.id === 'mg_mains')!;
    expect(mains).toBeDefined();
    expect(mains.min).toBe(1);
    expect(mains.max).toBe(1);
    expect(mains.isCombo).toBe(true);
    expect(mains.isUpsell).toBe(false);
    expect(mains.modifiers.length).toBe(2);

    // Snacks section (requires exactly 3 items)
    const snacks = bundle.sections.find((s) => s.id === 'mg_snacks')!;
    expect(snacks).toBeDefined();
    expect(snacks.min).toBe(3);
    expect(snacks.max).toBe(3);
    expect(snacks.multiMin).toBe(3);
    expect(snacks.multiMax).toBe(1);
    expect(snacks.isCombo).toBe(true);
    expect(snacks.isUpsell).toBe(false);

    // Upsell section
    const upsell = bundle.sections.find((s) => s.id === 'mg_upsell_dessert')!;
    expect(upsell).toBeDefined();
    expect(upsell.min).toBe(0);
    expect(upsell.max).toBe(2);
    expect(upsell.isUpsell).toBe(true);
  });

  it('correctly maps included components (price: 0) and premium uplifts (e.g. +50p for Strawberries)', () => {
    const result = DeliverectApiClient.parseDeliverectMenu(sampleDeliverectBundleMenu, true);
    const bundle = result.bundleCatalog.bundles[0];

    const mains = bundle.sections.find((s) => s.id === 'mg_mains')!;
    const chicken = mains.modifiers.find((m) => m.id === 'mod_chicken_wrap')!;
    expect(chicken.price).toBe(0);
    expect(chicken.priceMinor).toBe(0);

    const drinks = bundle.sections.find((s) => s.id === 'mg_drinks')!;
    const oj = drinks.modifiers.find((m) => m.id === 'mod_orange_juice')!;
    expect(oj.price).toBe(30); // 30 minor units (+30p)

    const upsell = bundle.sections.find((s) => s.id === 'mg_upsell_dessert')!;
    const strawberries = upsell.modifiers.find((m) => m.id === 'mod_strawberries')!;
    expect(strawberries.price).toBe(50); // 50 minor units (+50p)
  });

  it('evaluates stock status as IN_STOCK when all required sections satisfy constraints', () => {
    const result = DeliverectApiClient.parseDeliverectMenu(sampleDeliverectBundleMenu, true);
    const bundle = result.bundleCatalog.bundles[0];

    expect(bundle.stockStatus).toBe('IN_STOCK');
    expect(bundle.outOfStockReason).toBeUndefined();
  });

  it("dynamically inherits OUT_OF_STOCK when a required section cannot meet min constraint due to snoozed items (e.g. Dave's Baked Beans)", () => {
    // In mg_snacks, min is 3, with 3 items available: crisps, baked_beans, apple.
    // If Dave's Baked Beans is snoozed, only 2 active items remain: crisps and apple.
    // Since distinct options (2) < min (3) with multiMax 1 per distinct option without duplicates,
    // the section cannot be satisfied and the parent bundle inherits OUT_OF_STOCK!
    const menuWithSnooze = JSON.parse(JSON.stringify(sampleDeliverectBundleMenu));
    menuWithSnooze.modifiers.mod_baked_beans.snoozed = true;

    const result = DeliverectApiClient.parseDeliverectMenu(menuWithSnooze, true);
    const bundle = result.bundleCatalog.bundles[0];

    expect(bundle.stockStatus).toBe('OUT_OF_STOCK');
    expect(bundle.outOfStockReason).toContain('Choose 3 Snacks');
  });

  it('supports snoozing via rawMenu.snoozedProducts dictionary', () => {
    const menuWithSnoozedDict = JSON.parse(JSON.stringify(sampleDeliverectBundleMenu));
    menuWithSnoozedDict.snoozedProducts = {
      PLU_DBB_01: true, // Snoozed by PLU
    };

    const result = DeliverectApiClient.parseDeliverectMenu(menuWithSnoozedDict, true);
    const bundle = result.bundleCatalog.bundles[0];

    expect(bundle.stockStatus).toBe('OUT_OF_STOCK');
  });

  it('does NOT mark bundle OUT_OF_STOCK when an optional upsell component is snoozed', () => {
    const menuWithUpsellSnooze = JSON.parse(JSON.stringify(sampleDeliverectBundleMenu));
    menuWithUpsellSnooze.modifiers.mod_strawberries.snoozed = true;

    const result = DeliverectApiClient.parseDeliverectMenu(menuWithUpsellSnooze, true);
    const bundle = result.bundleCatalog.bundles[0];

    // Parent bundle is still in stock because upsell is min: 0
    expect(bundle.stockStatus).toBe('IN_STOCK');

    const upsell = bundle.sections.find((s) => s.id === 'mg_upsell_dessert')!;
    const strawberries = upsell.modifiers.find((m) => m.id === 'mod_strawberries')!;
    expect(strawberries.snoozed).toBe(true);
  });

  it('marks bundle OUT_OF_STOCK immediately if the parent bundle product itself is snoozed', () => {
    const menuWithParentSnooze = JSON.parse(JSON.stringify(sampleDeliverectBundleMenu));
    menuWithParentSnooze.products[0].snoozed = true;

    const result = DeliverectApiClient.parseDeliverectMenu(menuWithParentSnooze, true);
    const bundle = result.bundleCatalog.bundles[0];

    expect(bundle.stockStatus).toBe('OUT_OF_STOCK');
    expect(bundle.outOfStockReason).toContain('snoozed');
  });

  it('unit tests evaluateBundleSectionAvailability directly', () => {
    const section: BundleModifierGroup = {
      id: 'sec_test',
      name: 'Drinks',
      min: 2,
      max: 2,
      isCombo: true,
      isUpsell: false,
      modifiers: [
        { id: '1', name: 'Water', plu: 'W', price: 0, active: true, snoozed: false },
        { id: '2', name: 'Cola', plu: 'C', price: 0, active: true, snoozed: true },
      ],
    };

    // Only 1 available, min is 2 -> satisfied: false
    const eval1 = evaluateBundleSectionAvailability(section);
    expect(eval1.isSatisfied).toBe(false);
    expect(eval1.availableModifierCount).toBe(1);

    // If max quantity per item allows repeats (multiMax: 2)
    const sectionWithMultiMax: BundleModifierGroup = {
      ...section,
      multiMax: 2,
    };
    const eval2 = evaluateBundleSectionAvailability(sectionWithMultiMax);
    expect(eval2.isSatisfied).toBe(true); // Can pick 2 Waters!
  });
});
