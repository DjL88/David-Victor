/**
 * Deliverect Bundle / Combo Data Models and Availability Engine
 *
 * Implements authoritative mapping for Deliverect combo products (isCombo: true),
 * modifierGroups (sections), modifiers (components), and dynamic stock calculation.
 */

export interface BundleModifier {
  id: string;
  name: string;
  plu: string;
  /** Normal standalone product PLU used when exploding the bundle into pickable items. */
  standalonePlu?: string;
  /** Normal shelf price in integer minor units, used as the proportional allocation weight. */
  standalonePriceMinor?: number;
  price: number; // Bundle uplift in minor units: 0 for included, 50 for +50p uplift
  priceMinor?: number;
  priceFormatted?: string;
  active: boolean;
  snoozed: boolean;
  multiMin?: number;
  multiMax?: number;
  max?: number;
  isAutoApplied?: boolean;
  imageUrl?: string;
  description?: string;
  calories?: number;
}

export interface BundleModifierGroup {
  id: string;
  name: string;
  min: number;
  max: number;
  multiMin?: number;
  multiMax?: number;
  isCombo?: boolean;
  isUpsell?: boolean;
  modifiers: BundleModifier[];
  satisfied?: boolean;
  availableCapacity?: number;
}

export interface BundleProduct {
  id: string;
  plu: string;
  name: string;
  description?: string;
  imageUrl?: string;
  image?: string;
  price: number; // Base price in integer minor units, e.g. 500 = £5.00
  priceMinor: number;
  currency: string;
  isCombo: true;
  stockStatus: 'IN_STOCK' | 'OUT_OF_STOCK';
  sections: BundleModifierGroup[];
  modifierGroups?: BundleModifierGroup[];
  categoryIds?: string[];
  allergens?: string[];
  tags?: string[];
  badge?: string;
  outOfStockReason?: string;
}

export interface BundleCatalog {
  id: string;
  storeId?: string;
  accountId?: string;
  bundles: BundleProduct[];
  totalBundles: number;
  updatedAt: string;
}

export interface SelectedBundleModifier {
  modifierId: string;
  plu: string;
  name: string;
  quantity: number;
  price: number;
  priceMinor: number;
  /** Display/debug only; the BFF re-resolves these from authoritative catalogue data. */
  standalonePlu?: string;
  standalonePriceMinor?: number;
  sectionId: string;
  sectionName: string;
}

export interface AddBundleSelectionInput {
  sectionId: string;
  modifierId: string;
  quantity: number;
}

export interface AddBundleToBasketRequest {
  bundleId?: string;
  bundlePlu?: string;
  quantity?: number;
  selections: AddBundleSelectionInput[];
}

export interface BundleSectionValidation {
  sectionId: string;
  sectionName: string;
  min: number;
  max: number;
  multiMin?: number;
  multiMax?: number;
  totalSelectedCount: number;
  distinctCount: number;
  satisfied: boolean;
  errorMessage?: string;
}

export interface BundleValidationResult {
  isValid: boolean;
  valid: boolean;
  totalSelectedCount: number;
  sections: Record<string, BundleSectionValidation>;
  selectedModifiers: SelectedBundleModifier[];
  firstErrorMessage?: string;
  errors: string[];
}

function normalizeBundleSelections(
  selections: Record<string, Record<string, number>> | SelectedBundleModifier[]
): Record<string, Record<string, number>> {
  if (Array.isArray(selections)) {
    const map: Record<string, Record<string, number>> = {};
    for (const item of selections) {
      if (!map[item.sectionId]) map[item.sectionId] = {};
      map[item.sectionId][item.modifierId] = (map[item.sectionId][item.modifierId] || 0) + item.quantity;
    }
    return map;
  }
  return selections || {};
}

/**
 * Evaluates whether a section (modifier group) can satisfy its selection constraints.
 * - Upsell sections (isUpsell: true or min: 0) are always satisfied.
 * - Required sections (min > 0) require sufficient active, non-snoozed components.
 */
export function evaluateBundleSectionAvailability(section: BundleModifierGroup): {
  satisfied: boolean;
  isSatisfied: boolean;
  availableCapacity: number;
  availableModifierCount: number;
  reason?: string;
} {
  // Required section: collect active, non-snoozed components
  const activeNonSnoozed = section.modifiers.filter((m) => m.active !== false && !m.snoozed);
  const distinctCount = activeNonSnoozed.length;

  // Upsell / optional sections never block availability
  if (section.isUpsell || section.min === 0) {
    return {
      satisfied: true,
      isSatisfied: true,
      availableCapacity: distinctCount,
      availableModifierCount: distinctCount,
    };
  }

  if (distinctCount === 0) {
    return {
      satisfied: false,
      isSatisfied: false,
      availableCapacity: 0,
      availableModifierCount: 0,
      reason: `Required section "${section.name}" has 0 active non-snoozed components (requires min: ${section.min})`,
    };
  }

  // Constraint 1: Minimum distinct options (multiMin on group)
  if (typeof section.multiMin === 'number' && section.multiMin > 0 && distinctCount < section.multiMin) {
    return {
      satisfied: false,
      isSatisfied: false,
      availableCapacity: distinctCount,
      availableModifierCount: distinctCount,
      reason: `Required section "${section.name}" requires at least ${section.multiMin} distinct options, but only ${distinctCount} active non-snoozed options are available`,
    };
  }

  // Constraint 2: Calculate total selection capacity considering multiMax per item or section
  let totalCapacity = 0;
  for (const mod of activeNonSnoozed) {
    const modMax =
      typeof mod.multiMax === 'number'
        ? mod.multiMax
        : typeof mod.max === 'number'
        ? mod.max
        : typeof section.multiMax === 'number'
        ? section.multiMax
        : 1; // Default to 1 per modifier unless multiMax/max is explicitly set
    totalCapacity += Math.max(0, modMax);
  }

  if (totalCapacity < section.min) {
    return {
      satisfied: false,
      isSatisfied: false,
      availableCapacity: totalCapacity,
      availableModifierCount: distinctCount,
      reason: `Required section "${section.name}" cannot satisfy minimum of ${section.min} items (only ${totalCapacity} selectable from active non-snoozed items)`,
    };
  }

  return {
    satisfied: true,
    isSatisfied: true,
    availableCapacity: totalCapacity,
    availableModifierCount: distinctCount,
  };
}

/**
 * Calculates dynamic bundle stock status based on section constraints.
 * A bundle is IN_STOCK if every required section (min > 0) is satisfied.
 */
export function evaluateBundleStockStatus(sections: BundleModifierGroup[]): {
  stockStatus: 'IN_STOCK' | 'OUT_OF_STOCK';
  outOfStockReason?: string;
} {
  for (const section of sections) {
    const check = evaluateBundleSectionAvailability(section);
    section.satisfied = check.satisfied;
    section.availableCapacity = check.availableCapacity;

    if (!check.satisfied) {
      return {
        stockStatus: 'OUT_OF_STOCK',
        outOfStockReason: check.reason,
      };
    }
  }

  return {
    stockStatus: 'IN_STOCK',
  };
}

/**
 * Validates customer selections for a bundle against all group constraints:
 * - Minimum and Maximum total items per section
 * - Minimum distinct options (multiMin on group)
 * - Maximum quantity per modifier (multiMax on modifier or group)
 * - Active / Snoozed status enforcement (snoozed cannot be selected)
 */
export function validateBundleSelection(
  bundle: BundleProduct,
  rawSelections: Record<string, Record<string, number>> | SelectedBundleModifier[]
): BundleValidationResult {
  const selections = normalizeBundleSelections(rawSelections);
  const sectionsValidation: Record<string, BundleSectionValidation> = {};
  const selectedModifiers: SelectedBundleModifier[] = [];
  let totalSelectedCount = 0;
  let overallValid = true;
  let firstErrorMessage: string | undefined;
  const errors: string[] = [];

  const sections = bundle.sections || bundle.modifierGroups || [];

  for (const section of sections) {
    const groupSelections = selections[section.id] || {};
    let sectionTotalCount = 0;
    let distinctCount = 0;
    let sectionError: string | undefined;

    // Check each modifier selected in this section
    for (const modifier of section.modifiers) {
      const qty = groupSelections[modifier.id] || 0;
      if (qty > 0) {
        // Enforce snooze / inactive check
        if (modifier.snoozed || modifier.active === false) {
          sectionError = `"${modifier.name}" is out of stock and cannot be selected`;
          overallValid = false;
        }

        // Enforce modifier multiMax / max
        const modMax =
          typeof modifier.multiMax === 'number'
            ? modifier.multiMax
            : typeof modifier.max === 'number'
            ? modifier.max
            : typeof section.multiMax === 'number'
            ? section.multiMax
            : section.max;

        if (qty > modMax) {
          sectionError = `Maximum ${modMax} of "${modifier.name}" allowed`;
          overallValid = false;
        }

        sectionTotalCount += qty;
        distinctCount += 1;

        selectedModifiers.push({
          modifierId: modifier.id,
          plu: modifier.plu,
          name: modifier.name,
          quantity: qty,
          price: modifier.price || modifier.priceMinor || 0,
          priceMinor: modifier.priceMinor ?? modifier.price ?? 0,
          standalonePlu: modifier.standalonePlu,
          standalonePriceMinor: modifier.standalonePriceMinor,
          sectionId: section.id,
          sectionName: section.name,
        });
      }
    }

    // Check min constraint (required section)
    if (sectionTotalCount < section.min) {
      sectionError = `Please select at least ${section.min} item${section.min > 1 ? 's' : ''} for "${section.name}" (selected ${sectionTotalCount})`;
      overallValid = false;
    }

    // Check max constraint
    if (sectionTotalCount > section.max) {
      sectionError = `You can select at most ${section.max} item${section.max > 1 ? 's' : ''} for "${section.name}" (selected ${sectionTotalCount})`;
      overallValid = false;
    }

    // Check multiMin (minimum distinct items)
    if (
      typeof section.multiMin === 'number' &&
      section.multiMin > 0 &&
      sectionTotalCount >= section.min &&
      distinctCount < section.multiMin
    ) {
      sectionError = `"${section.name}" requires at least ${section.multiMin} different options (selected ${distinctCount})`;
      overallValid = false;
    }

    const isSatisfied = !sectionError && sectionTotalCount >= section.min && sectionTotalCount <= section.max;
    if (!isSatisfied && overallValid) {
      overallValid = false;
    }

    if (sectionError) {
      errors.push(sectionError);
      if (!firstErrorMessage) {
        firstErrorMessage = sectionError;
      }
    }

    sectionsValidation[section.id] = {
      sectionId: section.id,
      sectionName: section.name,
      min: section.min,
      max: section.max,
      multiMin: section.multiMin,
      multiMax: section.multiMax,
      totalSelectedCount: sectionTotalCount,
      distinctCount,
      satisfied: isSatisfied,
      errorMessage: sectionError,
    };

    totalSelectedCount += sectionTotalCount;
  }

  return {
    isValid: overallValid,
    valid: overallValid,
    totalSelectedCount,
    sections: sectionsValidation,
    selectedModifiers,
    firstErrorMessage,
    errors,
  };
}

/**
 * Calculates live bundle price including base combo price and modifier uplifts.
 * Base price and modifier prices are in minor units (e.g. 500 = £5.00, 50 = £0.50).
 */
export function calculateBundlePrice(
  bundle: BundleProduct,
  rawSelections: Record<string, Record<string, number>> | SelectedBundleModifier[]
): {
  basePriceMinor: number;
  modifierUpliftMinor: number;
  totalPriceMinor: number;
  currency: string;
  formattedTotal: string;
} {
  const selections = normalizeBundleSelections(rawSelections);
  const basePriceMinor = bundle.priceMinor ?? bundle.price ?? 0;
  let modifierUpliftMinor = 0;

  const sections = bundle.sections || bundle.modifierGroups || [];
  for (const section of sections) {
    const groupSelections = selections[section.id] || {};
    for (const modifier of section.modifiers) {
      const qty = groupSelections[modifier.id] || 0;
      if (qty > 0) {
        const unitUplift = modifier.priceMinor ?? modifier.price ?? 0;
        modifierUpliftMinor += unitUplift * qty;
      }
    }
  }

  const totalPriceMinor = basePriceMinor + modifierUpliftMinor;
  const currencySymbol = bundle.currency === 'USD' ? '$' : bundle.currency === 'EUR' ? '€' : '£';
  const formattedTotal = `${currencySymbol}${(totalPriceMinor / 100).toFixed(2)}`;

  return {
    basePriceMinor,
    modifierUpliftMinor,
    totalPriceMinor,
    currency: bundle.currency || 'GBP',
    formattedTotal,
  };
}

export interface MissedBundleOffer {
  bundle: BundleProduct;
  /** 0..1 — required units already present in basket / total required units for one instance. */
  matchRatio: number;
  presentUnits: number;
  requiredUnits: number;
  /** One suggested item per still-unsatisfied required section, to complete the combo. */
  missingComponents: Array<{ plu: string; name: string; quantityNeeded: number }>;
}

/**
 * Detects "missed offer" bundles: combos where the customer already has most
 * all but the final required unit of the bundle in their basket, individually
 * added, but hasn't gotten the combo discount because they never went
 * through the explicit bundle-add flow. Purely a suggestion — completing the
 * bundle still requires the customer to confirm via BundleSelectionDialog,
 * the same explicit action as adding any other combo, so this never silently
 * changes pricing on its own.
 *
 * Coverage per required section is capped at that section's `min` (adding 5
 * of an item a bundle only needs 1 of doesn't "cover" a different section),
 * and only non-upsell sections with min > 0 count toward the required total.
 */
export function findMissedBundleOffers(
  basketItems: Array<{ plu: string; quantity: number }>,
  bundles: BundleProduct[],
): MissedBundleOffer[] {
  const basketQtyByPlu = new Map<string, number>();
  basketItems.forEach((item) => {
    basketQtyByPlu.set(item.plu, (basketQtyByPlu.get(item.plu) || 0) + item.quantity);
  });

  const offers: MissedBundleOffer[] = [];

  for (const bundle of bundles) {
    if (bundle.stockStatus === 'OUT_OF_STOCK') continue;
    const sections = (bundle.sections || bundle.modifierGroups || []).filter(
      (section) => !section.isUpsell && section.min > 0
    );
    if (sections.length === 0) continue;

    let requiredUnits = 0;
    let presentUnits = 0;
    const missingComponents: MissedBundleOffer['missingComponents'] = [];

    for (const section of sections) {
      requiredUnits += section.min;

      let sectionPresent = 0;
      for (const modifier of section.modifiers) {
        if (!modifier.standalonePlu || modifier.active === false || modifier.snoozed) continue;
        sectionPresent += basketQtyByPlu.get(modifier.standalonePlu) || 0;
      }
      const covered = Math.min(sectionPresent, section.min);
      presentUnits += covered;

      if (covered < section.min) {
        const suggestion = section.modifiers.find(
          (modifier) => modifier.standalonePlu && modifier.active !== false && !modifier.snoozed
        );
        if (suggestion?.standalonePlu) {
          missingComponents.push({
            plu: suggestion.standalonePlu,
            name: suggestion.name,
            quantityNeeded: section.min - covered,
          });
        }
      }
    }

    if (requiredUnits === 0) continue;
    const matchRatio = presentUnits / requiredUnits;

    // Only prompt at the genuinely useful moment: one required unit away from
    // qualification. Percentage thresholds produce noisy prompts for larger bundles.
    if (presentUnits === requiredUnits - 1 && missingComponents.length === 1 && missingComponents[0].quantityNeeded === 1) {
      offers.push({ bundle, matchRatio, presentUnits, requiredUnits, missingComponents });
    }
  }

  return offers.sort((a, b) => b.matchRatio - a.matchRatio);
}

/**
 * Standard Deliverect Bundle Catalog fixtures, reflecting the prompt's
 * Meal Deal combo with required sections, exact minor unit uplifts, and snoozed modifiers.
 */
export const SAMPLE_DELIVERECT_BUNDLES: BundleProduct[] = [
  {
    id: 'prod_meal_deal_test',
    plu: 'PLU_MD_TEST',
    name: 'Meal Deal Test',
    description: 'Includes 1 Main, 3 Snacks, and 1 Drink with optional Sweet Treat from £5.00',
    price: 500, // £5.00 base price in minor units
    priceMinor: 500,
    currency: 'GBP',
    isCombo: true,
    stockStatus: 'IN_STOCK',
    imageUrl: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=600&auto=format&fit=crop&q=80',
    badge: 'Meal Deal • Save up to £2.80',
    categoryIds: ['cat_meal_deals', 'cat_sandwiches', 'cat_lunch'],
    sections: [
      {
        id: 'mg_mains',
        name: 'Choose 1 Main',
        min: 1,
        max: 1,
        multiMin: 1,
        multiMax: 1,
        isCombo: true,
        isUpsell: false,
        modifiers: [
          {
            id: 'mod_chicken_wrap',
            name: 'Roast Chicken Salad Wrap',
            plu: 'PLU_CW_01',
            price: 0,
            priceMinor: 0,
            active: true,
            snoozed: false,
            imageUrl: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=200&auto=format&fit=crop&q=80',
            description: 'Sliced roast chicken breast with crisp lettuce & mayo',
          },
          {
            id: 'mod_vegan_salad',
            name: 'Mediterranean Falafel Salad',
            plu: 'PLU_FS_02',
            price: 0,
            priceMinor: 0,
            active: true,
            snoozed: false,
            imageUrl: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=200&auto=format&fit=crop&q=80',
            description: 'Herbed falafels with cucumber, tomato & lemon dressing',
          },
        ],
      },
      {
        id: 'mg_snacks',
        name: 'Choose 3 Snacks',
        min: 3,
        max: 3,
        multiMin: 3, // Requires 3 distinct options
        multiMax: 1, // Max 1 of each snack
        isCombo: true,
        isUpsell: false,
        modifiers: [
          {
            id: 'mod_crisps',
            name: 'Sea Salt & Vinegar Crisps',
            plu: 'PLU_CR_01',
            price: 0,
            priceMinor: 0,
            active: true,
            snoozed: false,
            description: 'Hand-cooked crunch crisps with sea salt & malt vinegar',
          },
          {
            id: 'mod_baked_beans',
            name: "Dave's Baked Beans",
            plu: 'PLU_DBB_01',
            price: 0,
            priceMinor: 0,
            active: true,
            snoozed: false,
            description: 'Rich tomato sauce with tender haricot beans',
          },
          {
            id: 'mod_apple',
            name: 'Braeburn Apple',
            plu: 'PLU_AP_01',
            price: 0,
            priceMinor: 0,
            active: true,
            snoozed: false,
            description: 'Crisp, sweet & juicy British Braeburn apple',
          },
        ],
      },
      {
        id: 'mg_drinks',
        name: 'Choose 1 Drink',
        min: 1,
        max: 1,
        multiMin: 1,
        multiMax: 1,
        isCombo: true,
        isUpsell: false,
        modifiers: [
          {
            id: 'mod_diet_coke',
            name: 'Diet Coke 330ml',
            plu: 'PLU_DC_330',
            price: 0,
            priceMinor: 0,
            active: true,
            snoozed: false,
            isAutoApplied: true,
            imageUrl: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=200&auto=format&fit=crop&q=80',
            description: 'No sugar sparkling soft drink with vegetable extracts',
          },
          {
            id: 'mod_orange_juice',
            name: 'Fresh Orange Juice 250ml',
            plu: 'PLU_OJ_250',
            price: 30, // +30p minor unit uplift
            priceMinor: 30,
            active: true,
            snoozed: false,
            imageUrl: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=200&auto=format&fit=crop&q=80',
            description: '100% freshly squeezed smooth orange juice',
          },
        ],
      },
      {
        id: 'mg_upsell_dessert',
        name: 'Add a Sweet Treat (Optional)',
        min: 0,
        max: 2,
        multiMin: 0,
        multiMax: 2,
        isCombo: false,
        isUpsell: true,
        modifiers: [
          {
            id: 'mod_brownie',
            name: 'Belgian Chocolate Brownie',
            plu: 'PLU_BR_01',
            price: 150, // +£1.50 uplift
            priceMinor: 150,
            active: true,
            snoozed: false,
            description: 'Decadent fudge brownie made with 70% dark Belgian chocolate',
          },
          {
            id: 'mod_strawberries',
            name: 'Fresh Strawberries Pot',
            plu: 'PLU_SB_01',
            price: 50, // +50p minor unit uplift
            priceMinor: 50,
            active: true,
            snoozed: false,
            description: 'Sweet British strawberries washed and ready to eat',
          },
        ],
      },
    ],
  },
];
