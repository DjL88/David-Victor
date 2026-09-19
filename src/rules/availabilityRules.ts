import { Product, BasketItem } from '../commerce/models';
import { defaultRuleEngine } from './RuleEngine';
import { ProductRuleDecision, RuleEvaluationContext } from './types';

export interface ProductAvailabilityDecision {
  shouldRender: boolean;
  canAddToCart: boolean;
  isGreyedOut: boolean;
  effectiveLimit: number;
  limitReason?: string;
  badgeLabel?: string;
  badges?: string[];
  warnings?: string[];
  ruleDecision?: ProductRuleDecision;
}

/**
 * Bridge function to evaluate product availability and rules using the generic RuleEngine.
 *
 * NOTE: The UI is advisory only. Backend BFF enforces identical limits independently.
 */
export function evaluateProductAvailability(
  product: Product,
  currentBasketQuantity: number = 0,
  context: RuleEvaluationContext = {},
  basketItems: BasketItem[] = []
): ProductAvailabilityDecision {
  const decision = defaultRuleEngine.evaluateProduct(
    product,
    context,
    basketItems,
    currentBasketQuantity
  );

  return {
    shouldRender: decision.shouldRender,
    canAddToCart: decision.canAddToCart,
    isGreyedOut: decision.isGreyedOut,
    effectiveLimit: decision.effectiveMaximum ?? 999,
    limitReason: decision.quantityLimitReason,
    badgeLabel: decision.badges.length > 0 ? decision.badges[0] : undefined,
    badges: decision.badges,
    warnings: decision.warnings,
    ruleDecision: decision,
  };
}

/**
 * Canonical test to determine if a product should be rendered in the storefront.
 * Evaluates the exact same business & rule engine logic as ProductCard:
 * - Hard business check: product.active === false -> false
 * - Rule engine check: hideProduct: true -> false
 */
export function isProductRenderable(
  product: Product,
  context: RuleEvaluationContext = {}
): boolean {
  const decision = evaluateProductAvailability(product, 0, context, []);
  return decision.shouldRender;
}

/**
 * Filter an array of products down to only those that pass canonical availability and rule evaluation.
 */
export function getRenderableProducts(
  products: Product[],
  context: RuleEvaluationContext = {}
): Product[] {
  if (!products || !Array.isArray(products)) return [];
  return products.filter((p) => isProductRenderable(p, context));
}

