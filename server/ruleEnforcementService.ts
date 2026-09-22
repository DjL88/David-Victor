import { FirestorePlatformService } from './firestoreService';
import { CommerceError } from './errors';
import { evaluateProductRules } from '../src/rules/ProductRuleEvaluator';
import { evaluateBasketRules } from '../src/rules/BasketRuleEvaluator';
import { visualRulesToRetailRules } from '../src/rules/visualRuleAdapter';
import { RetailRule, RuleEvaluationContext } from '../src/rules/types';
import { Product, Basket, BasketItem } from '../src/commerce/models';

/**
 * Server-side enforcement of the admin-configured Product Rules engine.
 *
 * Until this file, RuleEngine/ProductRuleEvaluator/BasketRuleEvaluator were
 * entirely client-side (populated once in AppLayout.tsx) — a direct API call
 * bypassing the storefront UI could add a hidden/purchase-blocked/quantity-
 * capped item with zero gating. This mirrors the exact same evaluator logic
 * server-side so it can't be bypassed that way. It intentionally does NOT
 * enforce age-acknowledgement (no server-visible signal exists for that yet
 * — see BasketRuleEvaluator.ts, which itself only ever turns an unacknowledged
 * age requirement into a warning, never a blockingIssue).
 */

const RULES_CACHE_TTL_MS = 60_000;
const rulesCacheByTenant = new Map<string, { rules: RetailRule[]; loadedAt: number }>();

export async function getTenantRetailRules(tenantId: string): Promise<RetailRule[]> {
  const cached = rulesCacheByTenant.get(tenantId);
  if (cached && Date.now() - cached.loadedAt < RULES_CACHE_TTL_MS) {
    return cached.rules;
  }

  const visualRules = await FirestorePlatformService.getTenantRules(tenantId);
  const enabledRules = (visualRules || []).filter((r: any) => r?.enabled !== false);
  const rules = visualRulesToRetailRules(enabledRules);
  rulesCacheByTenant.set(tenantId, { rules, loadedAt: Date.now() });
  return rules;
}

/**
 * Throws if adding `requestedQuantity` of `product` to the basket would
 * violate a hide/prevent-purchase/quantity-limit rule. Does not enforce
 * age-gate acknowledgement (see file header).
 */
export async function assertProductAddAllowed(
  tenantId: string,
  product: Product,
  context: RuleEvaluationContext,
  basketItems: BasketItem[],
  requestedQuantity: number
): Promise<void> {
  const rules = await getTenantRetailRules(tenantId);
  if (rules.length === 0) return;

  const decision = evaluateProductRules(product, rules, context, basketItems, 0);

  if (!decision.shouldRender || decision.isGreyedOut) {
    throw new CommerceError(
      'RULE_VIOLATION',
      `${product.name} is not available for purchase at this store.`,
      403
    );
  }

  if (decision.effectiveMaximum !== null && requestedQuantity > decision.effectiveMaximum) {
    throw new CommerceError(
      'RULE_VIOLATION',
      `${product.name}: ${decision.quantityLimitReason || `maximum ${decision.effectiveMaximum} allowed`}.`,
      403
    );
  }
}

/**
 * Throws if the basket as a whole violates a blocking rule (cross-SKU group
 * quantity caps, an item that's become hidden/out-of-stock since it was
 * added, a per-item quantity now over its limit). Mirrors
 * BasketRuleEvaluator's `valid`/`blockingIssues` exactly — age-related
 * findings surface only as warnings there, never block checkout.
 */
export async function assertBasketCheckoutAllowed(
  tenantId: string,
  basket: Basket,
  productsByPlu: Map<string, Product>,
  context: RuleEvaluationContext
): Promise<void> {
  const rules = await getTenantRetailRules(tenantId);
  if (rules.length === 0) return;

  const decision = evaluateBasketRules(basket, productsByPlu, rules, context);
  if (!decision.valid) {
    throw new CommerceError(
      'RULE_VIOLATION',
      decision.blockingIssues.join(' ') || 'This basket cannot be checked out due to a store policy.',
      403,
      false,
      { blockingIssues: decision.blockingIssues }
    );
  }
}
