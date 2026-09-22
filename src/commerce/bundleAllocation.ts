import {
  BundleProduct,
  SelectedBundleModifier,
  validateBundleSelection,
} from './bundleModels';

export interface ProtectedBundleComponentAllocation {
  modifierId: string;
  componentPlu: string;
  componentName: string;
  sectionId: string;
  sectionName: string;
  quantity: number;
  standaloneUnitPriceMinor: number;
  upliftUnitPriceMinor: number;
  protectedUnitPricesMinor: number[];
  standaloneLineTotalMinor: number;
  protectedLineTotalMinor: number;
  discountLineMinor: number;
}

export interface ProtectedBundleAllocation {
  bundleId: string;
  bundlePlu: string;
  bundleName: string;
  currency: string;
  bundleQuantity: number;
  baseBundlePriceMinor: number;
  upliftTotalMinor: number;
  targetBundleTotalMinor: number;
  standaloneTotalMinor: number;
  discountTotalMinor: number;
  components: ProtectedBundleComponentAllocation[];
}

function allocateByLargestRemainder(totalMinor: number, weights: number[]): number[] {
  if (!Number.isInteger(totalMinor) || totalMinor < 0) {
    throw new Error('Bundle allocation total must be a non-negative integer minor-unit amount.');
  }
  if (weights.length === 0) {
    if (totalMinor === 0) return [];
    throw new Error('Cannot allocate a positive bundle price across zero qualifying components.');
  }
  if (weights.some((weight) => !Number.isFinite(weight) || weight <= 0)) {
    throw new Error('Every qualifying bundle component must have a positive standalone price.');
  }

  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const exactShares = weights.map((weight) => (totalMinor * weight) / totalWeight);
  const allocated = exactShares.map((share) => Math.floor(share));
  let penniesRemaining = totalMinor - allocated.reduce((sum, value) => sum + value, 0);

  const remainderOrder = exactShares
    .map((share, index) => ({ index, remainder: share - Math.floor(share) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);

  for (let i = 0; i < penniesRemaining; i++) {
    allocated[remainderOrder[i % remainderOrder.length].index] += 1;
  }

  return allocated;
}

/**
 * Converts a storefront bundle selection into protected per-component values.
 *
 * Rules:
 * - The base bundle price is allocated only across required/non-upsell components.
 * - Allocation is weighted by each component's real standalone shelf price.
 * - Any explicit bundle uplift belongs entirely to that component.
 * - Optional upsell-only components receive their explicit uplift as their protected price.
 * - The allocation is frozen at checkout; later Quest removal never reprices survivors.
 * - Bad configuration that makes a bundle cost more than standalone is rejected.
 */
export function allocateProtectedBundlePrices(
  bundle: BundleProduct,
  selectedModifiers: SelectedBundleModifier[],
  bundleQuantity: number = 1
): ProtectedBundleAllocation {
  if (!Number.isInteger(bundleQuantity) || bundleQuantity <= 0) {
    throw new Error('Bundle quantity must be a positive integer.');
  }

  const validation = validateBundleSelection(bundle, selectedModifiers);
  if (!validation.valid) {
    throw new Error(validation.firstErrorMessage || 'Bundle selection is invalid.');
  }

  const sections = bundle.sections || bundle.modifierGroups || [];
  const selected = selectedModifiers.map((selection) => {
    const section = sections.find((candidate) => candidate.id === selection.sectionId);
    if (!section) throw new Error(`Unknown bundle section ${selection.sectionId}.`);

    const modifier = section.modifiers.find(
      (candidate) =>
        candidate.id === selection.modifierId ||
        candidate.plu === selection.plu ||
        candidate.standalonePlu === selection.plu
    );
    if (!modifier) throw new Error(`Unknown bundle component ${selection.modifierId}.`);

    // Required combo components are normal saleable products and need a
    // standalone shelf identity. Optional upsells are different: Deliverect can
    // publish them only as modifier PLUs. In that case the modifier PLU itself is
    // the basket identity and its configured uplift is its deal price.
    const isOptionalUpsell = section.isUpsell === true || section.min === 0;
    const componentPlu = String(modifier.standalonePlu || (isOptionalUpsell ? modifier.plu : '')).trim();
    const configuredUpliftUnitPriceMinor = Math.max(
      0,
      Math.round(selection.priceMinor ?? selection.price ?? modifier.priceMinor ?? modifier.price ?? 0)
    );

    if (!componentPlu) {
      throw new Error(
        `Bundle component "${modifier.name}" is not mapped to a standalone product PLU.`
      );
    }
    const declaredStandalonePriceMinor = modifier.standalonePriceMinor;
    const standalonePriceMinor =
      Number.isInteger(declaredStandalonePriceMinor) && (declaredStandalonePriceMinor as number) >= 0
        ? (declaredStandalonePriceMinor as number)
        : isOptionalUpsell
          ? configuredUpliftUnitPriceMinor
          : undefined;
    if (standalonePriceMinor === undefined) {
      throw new Error(
        `Bundle component "${modifier.name}" is missing an authoritative standalone price.`
      );
    }

    // Optional components are conditional discounts, never surcharges.
    // Use the resolved selection price when supplied by the store-aware deal
    // engine, and clamp again here so every caller gets the same protection.
    const upliftUnitPriceMinor = isOptionalUpsell
      ? Math.min(configuredUpliftUnitPriceMinor, standalonePriceMinor as number)
      : configuredUpliftUnitPriceMinor;

    return {
      selection,
      section,
      modifier,
      componentPlu,
      standalonePriceMinor: standalonePriceMinor as number,
      upliftUnitPriceMinor,
    };
  });

  // A combo is a benefit, never a surcharge. If its configured fixed price
  // plus selected uplifts is higher than buying these exact selections normally,
  // price the allocation by item instead and create no discount.
  const nominalBaseBundlePriceMinor = Math.max(
    0,
    Math.round(bundle.priceMinor ?? bundle.price ?? 0)
  );
  const nominalUpliftTotalMinor = selected.reduce(
    (sum, entry) =>
      sum + entry.upliftUnitPriceMinor * entry.selection.quantity * bundleQuantity,
    0
  );
  const selectedStandaloneTotalMinor = selected.reduce(
    (sum, entry) =>
      sum + entry.standalonePriceMinor * entry.selection.quantity * bundleQuantity,
    0
  );
  const nominalTargetTotalMinor =
    nominalBaseBundlePriceMinor * bundleQuantity + nominalUpliftTotalMinor;

  if (nominalTargetTotalMinor >= selectedStandaloneTotalMinor) {
    const components: ProtectedBundleComponentAllocation[] = selected.map((entry) => {
      const quantity = entry.selection.quantity * bundleQuantity;
      const protectedUnitPricesMinor = new Array(quantity).fill(entry.standalonePriceMinor);
      const lineTotal = entry.standalonePriceMinor * quantity;
      return {
        modifierId: entry.modifier.id,
        componentPlu: entry.componentPlu,
        componentName: entry.modifier.name,
        sectionId: entry.section.id,
        sectionName: entry.section.name,
        quantity,
        standaloneUnitPriceMinor: entry.standalonePriceMinor,
        upliftUnitPriceMinor: entry.upliftUnitPriceMinor,
        protectedUnitPricesMinor,
        standaloneLineTotalMinor: lineTotal,
        protectedLineTotalMinor: lineTotal,
        discountLineMinor: 0,
      };
    });
    return {
      bundleId: bundle.id,
      bundlePlu: bundle.plu,
      bundleName: bundle.name,
      currency: bundle.currency || 'GBP',
      bundleQuantity,
      baseBundlePriceMinor: nominalBaseBundlePriceMinor,
      upliftTotalMinor: nominalUpliftTotalMinor,
      targetBundleTotalMinor: selectedStandaloneTotalMinor,
      standaloneTotalMinor: selectedStandaloneTotalMinor,
      discountTotalMinor: 0,
      components,
    };
  }

  // Expand required/base components into individual units so penny rounding remains
  // deterministic even when a section allows multiple quantities of the same PLU.
  const baseUnits: Array<{ selectedIndex: number; unitIndex: number; weight: number }> = [];
  selected.forEach((entry, selectedIndex) => {
    const participatesInBase = !entry.section.isUpsell && entry.section.min > 0;
    if (!participatesInBase) return;

    if (entry.standalonePriceMinor <= 0) {
      throw new Error(
        `Required bundle component "${entry.modifier.name}" must have a positive standalone price for proportional allocation.`
      );
    }

    for (let unitIndex = 0; unitIndex < entry.selection.quantity; unitIndex++) {
      baseUnits.push({
        selectedIndex,
        unitIndex,
        weight: entry.standalonePriceMinor,
      });
    }
  });

  const baseBundlePriceMinor = Math.max(
    0,
    Math.round(bundle.priceMinor ?? bundle.price ?? 0)
  );
  const oneBundleBaseAllocations = allocateByLargestRemainder(
    baseBundlePriceMinor,
    baseUnits.map((unit) => unit.weight)
  );

  const baseAllocationsBySelected = selected.map((entry) =>
    new Array(entry.selection.quantity).fill(0)
  );
  baseUnits.forEach((unit, index) => {
    baseAllocationsBySelected[unit.selectedIndex][unit.unitIndex] =
      oneBundleBaseAllocations[index];
  });

  const components: ProtectedBundleComponentAllocation[] = selected.map(
    (entry, selectedIndex) => {
      const protectedUnitPricesOneBundle = baseAllocationsBySelected[selectedIndex].map(
        (baseAllocation) => baseAllocation + entry.upliftUnitPriceMinor
      );

      // Optional upsell sections do not participate in the base allocation. Their
      // customer price is their explicit uplift.
      if (entry.section.isUpsell || entry.section.min === 0) {
        for (let i = 0; i < protectedUnitPricesOneBundle.length; i++) {
          protectedUnitPricesOneBundle[i] = entry.upliftUnitPriceMinor;
        }
      }

      const protectedUnitPricesMinor: number[] = [];
      for (let bundleIndex = 0; bundleIndex < bundleQuantity; bundleIndex++) {
        protectedUnitPricesMinor.push(...protectedUnitPricesOneBundle);
      }

      const quantity = entry.selection.quantity * bundleQuantity;
      const standaloneLineTotalMinor =
        entry.standalonePriceMinor * quantity;
      const protectedLineTotalMinor = protectedUnitPricesMinor.reduce(
        (sum, value) => sum + value,
        0
      );

      return {
        modifierId: entry.modifier.id,
        componentPlu: entry.componentPlu,
        componentName: entry.modifier.name,
        sectionId: entry.section.id,
        sectionName: entry.section.name,
        quantity,
        standaloneUnitPriceMinor: entry.standalonePriceMinor,
        upliftUnitPriceMinor: entry.upliftUnitPriceMinor,
        protectedUnitPricesMinor,
        standaloneLineTotalMinor,
        protectedLineTotalMinor,
        discountLineMinor: standaloneLineTotalMinor - protectedLineTotalMinor,
      };
    }
  );

  const upliftTotalMinor =
    selected.reduce(
      (sum, entry) =>
        sum +
        entry.upliftUnitPriceMinor *
          entry.selection.quantity *
          bundleQuantity,
      0
    );
  const targetBundleTotalMinor =
    baseBundlePriceMinor * bundleQuantity + upliftTotalMinor;
  const standaloneTotalMinor = components.reduce(
    (sum, component) => sum + component.standaloneLineTotalMinor,
    0
  );
  const protectedTotalMinor = components.reduce(
    (sum, component) => sum + component.protectedLineTotalMinor,
    0
  );

  if (protectedTotalMinor !== targetBundleTotalMinor) {
    throw new Error(
      `Bundle allocation mismatch: protected total ${protectedTotalMinor} does not equal target ${targetBundleTotalMinor}.`
    );
  }

  return {
    bundleId: bundle.id,
    bundlePlu: bundle.plu,
    bundleName: bundle.name,
    currency: bundle.currency || 'GBP',
    bundleQuantity,
    baseBundlePriceMinor,
    upliftTotalMinor,
    targetBundleTotalMinor,
    standaloneTotalMinor,
    discountTotalMinor: standaloneTotalMinor - targetBundleTotalMinor,
    components,
  };
}
