import { Product, BasketItem } from '../commerce/models';
import {
  RetailRule,
  RuleEvaluationContext,
  ProductRuleDecision,
  RuleCondition,
} from './types';

/**
 * Checks if a product matches a given rule condition.
 * Matching supports PLU, GTIN, tags, labels, category, brand,
 * metadata attributes, alcohol details, country, and fulfillment type.
 */
function normalizeRuleTokens(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values.flatMap((value) => {
    if (typeof value === 'string') return [value.toUpperCase()];
    if (typeof value === 'number' && Number.isFinite(value)) return [String(value)];
    return [];
  });
}

export function matchesCondition(
  product: Product,
  condition: RuleCondition,
  context: RuleEvaluationContext = {}
): boolean {
  // 1. PLU match
  if (condition.plu) {
    const targetPlus = Array.isArray(condition.plu) ? condition.plu : [condition.plu];
    if (!targetPlus.includes(product.plu)) return false;
  }

  // 2. GTIN match
  if (condition.gtin) {
    const targetGtins = Array.isArray(condition.gtin) ? condition.gtin : [condition.gtin];
    const hasGtin = product.gtin && product.gtin.some((g) => targetGtins.includes(g));
    if (!hasGtin) return false;
  }

  // 3. Product Tags match (case-insensitive)
  if (condition.productTags && condition.productTags.length > 0) {
    const prodTagsLower = normalizeRuleTokens(product.productTags);
    const hasTag = normalizeRuleTokens(condition.productTags).some((tag) => prodTagsLower.includes(tag));
    if (!hasTag) return false;
  }

  // 4. Display Labels match
  if (condition.displayLabels && condition.displayLabels.length > 0) {
    const prodLabelsLower = normalizeRuleTokens(product.displayLabels);
    const hasLabel = normalizeRuleTokens(condition.displayLabels).some((label) => prodLabelsLower.includes(label));
    if (!hasLabel) return false;
  }

  // 5. Category match (by category ID)
  if (condition.category) {
    const targetCats = Array.isArray(condition.category)
      ? condition.category
      : [condition.category];
    const hasCat = product.categoryIds && product.categoryIds.some((c) => targetCats.includes(c));
    if (!hasCat) return false;
  }

  // 6. Brand match
  if (condition.brand) {
    const targetBrands = (Array.isArray(condition.brand) ? condition.brand : [condition.brand]).map(
      (b) => b.toLowerCase()
    );
    if (!product.brand || !targetBrands.includes(product.brand.toLowerCase())) {
      return false;
    }
  }

  // 7. Metadata attributes match
  if (condition.metadata) {
    if (!product.metadata) return false;
    for (const [key, expectedValue] of Object.entries(condition.metadata)) {
      if (product.metadata[key] !== expectedValue) {
        return false;
      }
    }
  }

  // 8. Alcohol condition match
  if (condition.isAlcoholic !== undefined) {
    const isAlcoholic = Boolean(product.beverageInfo?.isAlcoholic);
    if (isAlcoholic !== condition.isAlcoholic) return false;
  }

  if (condition.minAbv !== undefined) {
    const abv = product.beverageInfo?.alcoholByVolume ?? 0;
    if (abv < condition.minAbv) return false;
  }

  // 9. Country match
  if (condition.country && context.country) {
    const targetCountries = (
      Array.isArray(condition.country) ? condition.country : [condition.country]
    ).map((c) => c.toUpperCase());
    if (!targetCountries.includes(context.country.toUpperCase())) return false;
  }

  // 10. Fulfillment type match
  if (condition.fulfillmentType && context.fulfillmentType) {
    const targetTypes = Array.isArray(condition.fulfillmentType)
      ? condition.fulfillmentType
      : [condition.fulfillmentType];
    if (!targetTypes.includes(context.fulfillmentType)) return false;
  }

  return true;
}

/**
 * Evaluates all applicable retail rules and inventory limits for a product.
 *
 * Requirements:
 * - ACTIVE + IN_STOCK: Normal product
 * - ACTIVE + OUT_OF_STOCK: Render greyed out with disabled Add button
 * - INACTIVE: Do not render product (shouldRender: false)
 * - stockQuantity null or missing: Means UNKNOWN STOCK, not zero! Do not invent stock limits.
 * - multiMax: Enforce if supplied.
 * - maximumQuantity: Enforce if supplied.
 * - Lowest applicable limit must be calculated for effectiveMaximum.
 * - If no explicit limit exists, effectiveMaximum remains null (never invent an artificial 99).
 * - Group limits: e.g. products with MEDICINE_LIMIT_GROUP have a combined basket cap.
 */
export function evaluateProductRules(
  product: Product,
  rules: RetailRule[],
  context: RuleEvaluationContext = {},
  basketItems: BasketItem[] = [],
  currentBasketQuantity: number = 0
): ProductRuleDecision {
  // 1. Inactive product check (hard business rule)
  if (product.active === false) {
    return {
      shouldRender: false,
      canAddToCart: false,
      isGreyedOut: true,
      effectiveMaximum: 0,
      effectiveMinimum: 1,
      badges: [],
      warnings: [],
      preventCheckoutUpsell: true,
      preventRecommendation: true,
      requiresAllergenDisplay: false,
      discountEligible: true,
      preventStoryPlacement: false,
      preventCarouselPlacement: false,
      appliedRuleIds: [],
      groupLimits: [],
    };
  }

  // 2. Identify all matching enabled rules
  const matchingRules = rules
    .filter((r) => r.enabled)
    .filter((r) => matchesCondition(product, r.conditions, context))
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  const appliedRuleIds = matchingRules.map((r) => r.id);

  // 3. Check hideProduct action
  const shouldHide = matchingRules.some((r) => r.actions.hideProduct === true);
  if (shouldHide) {
    return {
      shouldRender: false,
      canAddToCart: false,
      isGreyedOut: true,
      effectiveMaximum: 0,
      effectiveMinimum: 1,
      badges: [],
      warnings: [],
      preventCheckoutUpsell: true,
      preventRecommendation: true,
      requiresAllergenDisplay: false,
      discountEligible: true,
      preventStoryPlacement: false,
      preventCarouselPlacement: false,
      appliedRuleIds,
      groupLimits: [],
    };
  }

  // 4. Out of Stock / Snoozed check
  // NOTE: null or undefined stockQuantity means UNKNOWN STOCK, not 0!
  const isOutOfStock =
    product.isSnoozed === true ||
    product.stockStatus === 'OUT_OF_STOCK' ||
    (product.stockQuantity !== null && product.stockQuantity !== undefined && product.stockQuantity <= 0);

  const isPreventPurchase = matchingRules.some((r) => r.actions.preventPurchase === true);
  const isGreyedOut = isOutOfStock || isPreventPurchase;

  // 5. Gather all explicit limit constraints to find the lowest applicable limit
  interface ExplicitLimit {
    value: number;
    source: string;
  }
  const explicitLimits: ExplicitLimit[] = [];

  // A) Stock quantity (only if explicitly supplied and non-null)
  if (product.stockQuantity !== null && product.stockQuantity !== undefined) {
    explicitLimits.push({
      value: Math.max(0, product.stockQuantity),
      source: `Stock limit (${product.stockQuantity} available)`,
    });
  }

  // B) Product-level multiMax
  if (product.multiMax !== null && product.multiMax !== undefined) {
    explicitLimits.push({
      value: product.multiMax,
      source: `Max ${product.multiMax} per order`,
    });
  }

  // C) Product-level maximumQuantity
  if (product.maximumQuantity !== null && product.maximumQuantity !== undefined) {
    explicitLimits.push({
      value: product.maximumQuantity,
      source: `Max ${product.maximumQuantity} allowed`,
    });
  }

  // D) Configured rule maxQuantityPerProduct
  for (const rule of matchingRules) {
    if (rule.actions.maxQuantityPerProduct !== undefined) {
      explicitLimits.push({
        value: rule.actions.maxQuantityPerProduct,
        source: rule.actions.warningText || `Rule: Max ${rule.actions.maxQuantityPerProduct} per order`,
      });
    }
  }

  // E) Configured Group Limits across multiple products (e.g. MEDICINE_LIMIT_GROUP)
  const groupLimitsInfo: ProductRuleDecision['groupLimits'] = [];

  for (const rule of matchingRules) {
    const group = rule.actions.maxQuantityAcrossRuleGroup;
    if (!group) continue;

    // Calculate how many items already in the basket belong to this group
    // Exclude the current product's quantity so we measure other items in the group
    let otherGroupQuantityInBasket = 0;
    for (const item of basketItems) {
      if (item.plu !== product.plu && item.appliedRules?.includes(group.groupId)) {
        otherGroupQuantityInBasket += item.quantity;
      }
    }

    const currentItemQty = currentBasketQuantity;
    const totalGroupCurrent = otherGroupQuantityInBasket + currentItemQty;
    const remainingGroupCapacity = Math.max(0, group.maxQuantity - otherGroupQuantityInBasket);

    groupLimitsInfo.push({
      groupId: group.groupId,
      maxQuantity: group.maxQuantity,
      currentQuantityInBasket: totalGroupCurrent,
      remainingAllowed: remainingGroupCapacity,
    });

    explicitLimits.push({
      value: remainingGroupCapacity,
      source: `Group limit: Max ${group.maxQuantity} across ${group.groupName || 'this category'}`,
    });
  }

  // 6. Calculate effectiveMaximum using lowest applicable limit
  let effectiveMaximum: number | null = null;
  let quantityLimitReason: string | undefined = undefined;

  if (isGreyedOut) {
    effectiveMaximum = 0;
    quantityLimitReason = isOutOfStock ? 'Out of stock' : 'Purchase unavailable';
  } else if (explicitLimits.length > 0) {
    explicitLimits.sort((a, b) => a.value - b.value);
    effectiveMaximum = explicitLimits[0].value;
    quantityLimitReason = explicitLimits[0].source;
  } else {
    // Never invent an artificial limit when none is supplied!
    effectiveMaximum = null;
  }

  // 7. Calculate minimumQuantity
  let effectiveMinimum = product.minimumQuantity ?? 1;
  for (const rule of matchingRules) {
    if (rule.actions.minimumQuantity !== undefined) {
      effectiveMinimum = Math.max(effectiveMinimum, rule.actions.minimumQuantity);
    }
  }

  // 8. Determine if user can add more to cart
  const canAddToCart =
    !isGreyedOut && (effectiveMaximum === null || currentBasketQuantity < effectiveMaximum);

  // 9. Badges
  const badges: string[] = [];
  if (isOutOfStock) {
    badges.push('Out of stock');
  } else if (
    product.stockQuantity != null &&
    product.stockQuantity <= 3 &&
    product.stockQuantity > 0
  ) {
    badges.push(`Only ${product.stockQuantity} left`);
  }

  for (const rule of matchingRules) {
    if (rule.actions.badge && !badges.includes(rule.actions.badge)) {
      badges.push(rule.actions.badge);
    }
  }

  // 10. Warnings
  const warnings: string[] = [];
  for (const rule of matchingRules) {
    if (rule.actions.warningText && !warnings.includes(rule.actions.warningText)) {
      warnings.push(rule.actions.warningText);
    }
  }

  // 11. Age restrictions
  let ageRequirement: ProductRuleDecision['ageRequirement'] = undefined;
  const ageRules = matchingRules.filter((r) => r.actions.minimumAge !== undefined);
  if (ageRules.length > 0) {
    const highestMinAge = Math.max(...ageRules.map((r) => r.actions.minimumAge!));
    const requiresGate = ageRules.some((r) => r.actions.requiresAgeGate === true);
    const requiresAck = ageRules.some((r) => r.actions.requiresAgeAcknowledgement === true);
    const requiresCourierCheck = ageRules.some((r) => r.actions.requiresCourierAgeCheck === true);
    const isAcknowledged = Boolean(context.sessionAgeAcknowledged?.[highestMinAge]);

    ageRequirement = {
      minimumAge: highestMinAge,
      requiresGate,
      requiresAcknowledgement: requiresAck,
      requiresCourierCheck,
      isAcknowledgedInSession: isAcknowledged,
    };
  }

  // 12. HFSS / Upsell / Recommendation flags
  const preventCheckoutUpsell = matchingRules.some(
    (r) => r.actions.preventCheckoutUpsell === true
  );
  const preventRecommendation = matchingRules.some(
    (r) => r.actions.preventRecommendation === true
  );
  const requiresAllergenDisplay = matchingRules.some(
    (r) => r.actions.requiresAllergenDisplay === true
  );
  const discountEligible = !matchingRules.some((r) => r.actions.excludeFromDiscounts === true);
  const preventStoryPlacement = matchingRules.some((r) => r.actions.preventStoryPlacement === true);
  const preventCarouselPlacement = matchingRules.some((r) => r.actions.preventCarouselPlacement === true);

  return {
    shouldRender: true,
    canAddToCart,
    isGreyedOut,
    effectiveMaximum,
    effectiveMinimum,
    quantityLimitReason,
    badges,
    warnings,
    ageRequirement,
    preventCheckoutUpsell,
    preventRecommendation,
    requiresAllergenDisplay,
    discountEligible,
    preventStoryPlacement,
    preventCarouselPlacement,
    appliedRuleIds,
    groupLimits: groupLimitsInfo,
  };
}
