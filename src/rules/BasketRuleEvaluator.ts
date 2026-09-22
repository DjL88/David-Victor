import { Basket, BasketItem, Product } from '../commerce/models';
import {
  RetailRule,
  RuleEvaluationContext,
  BasketRuleDecision,
  RuleGroupLimit,
} from './types';
import { evaluateProductRules, matchesCondition } from './ProductRuleEvaluator';

/**
 * Evaluates an entire basket against regulatory, inventory, group,
 * and age constraints.
 *
 * NOTE: The UI is advisory only. The Backend-for-Frontend (BFF)
 * and Deliverect Commerce API enforce identical rules independently
 * prior to order completion.
 */
export function evaluateBasketRules(
  basket: Basket,
  productsMap: Map<string, Product>,
  rules: RetailRule[],
  context: RuleEvaluationContext = {}
): BasketRuleDecision {
  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  const itemDecisions: BasketRuleDecision['itemDecisions'] = {};
  const groupTotals: BasketRuleDecision['groupTotals'] = {};

  let requiresCourierAgeCheck = false;
  let highestMinimumAge = 0;
  let unacknowledgedAgeRequirement: number | undefined = undefined;

  // Track group limits configured in rules
  const activeGroupRules = new Map<string, RuleGroupLimit>();
  for (const rule of rules) {
    if (rule.enabled && rule.actions.maxQuantityAcrossRuleGroup) {
      const g = rule.actions.maxQuantityAcrossRuleGroup;
      activeGroupRules.set(g.groupId, g);
    }
  }

  // 1. Evaluate each item individually
  for (const item of basket.items) {
    const product = productsMap.get(item.plu);
    const itemIssues: string[] = [];

    if (!product) {
      blockingIssues.push(`Product ${item.name} (${item.plu}) is no longer available.`);
      itemIssues.push('Product not found in catalog');
      itemDecisions[item.plu] = {
        allowedQuantity: 0,
        effectiveMax: 0,
        issues: itemIssues,
        ruleIds: [],
      };
      continue;
    }

    // Evaluate single product decision
    const decision = evaluateProductRules(
      product,
      rules,
      context,
      basket.items,
      item.quantity
    );

    // Inactive product check
    if (!decision.shouldRender) {
      blockingIssues.push(`${product.name} is inactive and cannot be ordered.`);
      itemIssues.push('Product is inactive');
    }

    // Out of stock or greyed out check
    if (decision.isGreyedOut) {
      blockingIssues.push(`${product.name} is currently out of stock.`);
      itemIssues.push('Out of stock');
    }

    // Quantity exceeding effective maximum check
    if (decision.effectiveMaximum !== null && item.quantity > decision.effectiveMaximum) {
      blockingIssues.push(
        `Quantity for ${product.name} exceeds the limit of ${decision.effectiveMaximum} (${decision.quantityLimitReason || 'Limit reached'}).`
      );
      itemIssues.push(`Exceeds limit of ${decision.effectiveMaximum}`);
    }

    // Age restriction tracking
    if (decision.ageRequirement) {
      if (decision.ageRequirement.minimumAge > highestMinimumAge) {
        highestMinimumAge = decision.ageRequirement.minimumAge;
      }
      if (decision.ageRequirement.requiresCourierCheck) {
        requiresCourierAgeCheck = true;
      }
      if (
        decision.ageRequirement.requiresAcknowledgement &&
        !decision.ageRequirement.isAcknowledgedInSession
      ) {
        if (!unacknowledgedAgeRequirement || decision.ageRequirement.minimumAge > unacknowledgedAgeRequirement) {
          unacknowledgedAgeRequirement = decision.ageRequirement.minimumAge;
        }
      }
    }

    // Collect item warnings
    for (const w of decision.warnings) {
      if (!warnings.includes(w)) {
        warnings.push(w);
      }
    }

    itemDecisions[item.plu] = {
      allowedQuantity:
        decision.effectiveMaximum !== null
          ? Math.min(item.quantity, decision.effectiveMaximum)
          : item.quantity,
      effectiveMax: decision.effectiveMaximum,
      issues: itemIssues,
      ruleIds: decision.appliedRuleIds,
    };
  }

  // 2. Evaluate cross-product Group Limits (e.g. MEDICINE_LIMIT_GROUP)
  for (const [groupId, groupLimit] of activeGroupRules.entries()) {
    let currentQuantity = 0;

    for (const item of basket.items) {
      const product = productsMap.get(item.plu);
      if (!product) continue;

      // A group is defined by the conditions of the rule carrying the
      // COMBINED_GROUP_LIMIT action. Evaluate those conditions directly so
      // the total is independent of transient basket-line metadata.
      const matchesGroup = rules.some(
        (rule) =>
          rule.enabled &&
          rule.actions.maxQuantityAcrossRuleGroup?.groupId === groupId &&
          matchesCondition(product, rule.conditions, context)
      );
      if (matchesGroup) currentQuantity += item.quantity;
    }

    const exceeded = currentQuantity > groupLimit.maxQuantity;
    groupTotals[groupId] = {
      groupId,
      maxQuantity: groupLimit.maxQuantity,
      currentQuantity,
      exceeded,
    };

    if (exceeded) {
      blockingIssues.push(
        `Combined limit of ${groupLimit.maxQuantity} exceeded for ${groupLimit.groupName || 'restricted items'} (currently ${currentQuantity} in basket).`
      );
    }
  }

  // 3. Age acknowledgement check
  if (unacknowledgedAgeRequirement !== undefined) {
    warnings.push(
      `Age acknowledgement required: You must confirm you are ${unacknowledgedAgeRequirement} or older before checkout.`
    );
  }

  // 4. Courier age check notice
  if (requiresCourierAgeCheck) {
    warnings.push('Courier ID verification required on delivery (Challenge 25 policy).');
  }

  const groupViolations = Object.values(groupTotals)
    .filter((gt) => gt.exceeded)
    .map((gt) => ({
      groupId: gt.groupId,
      maxAllowed: gt.maxQuantity,
      totalQuantity: gt.currentQuantity,
    }));

  const isValid = blockingIssues.length === 0;

  return {
    valid: isValid,
    isValid,
    groupViolations,
    blockingIssues,
    warnings,
    requiresCourierAgeCheck,
    highestMinimumAge,
    unacknowledgedAgeRequirement,
    itemDecisions,
    groupTotals,
  };
}
