import { VisualRule, VisualRuleMatchCondition } from '../commerce/models';
import { RetailRule, RuleCondition, RuleActions } from './types';

/**
 * Converts an admin-authored VisualRule into the RetailRule shape the real
 * evaluator (ProductRuleEvaluator/RuleEngine) understands. VisualRule.matchConditions
 * is an array of single-field {field, operator, value} triples (implicitly ANDed);
 * RuleCondition is one object with named fields, so multiple conditions targeting
 * the same field are merged into that field's array (matched as OR within the field,
 * AND across fields — e.g. two `productTag` conditions match "either tag", but a
 * `productTag` + `category` condition together require both).
 */
function applyMatchCondition(conditions: RuleCondition, condition: VisualRuleMatchCondition): void {
  const values =
    condition.operator === 'in'
      ? condition.value.split(',').map((v) => v.trim()).filter(Boolean)
      : [condition.value];

  switch (condition.field) {
    case 'plu':
      conditions.plu = [...(Array.isArray(conditions.plu) ? conditions.plu : conditions.plu ? [conditions.plu] : []), ...values];
      break;
    case 'productTag':
      conditions.productTags = [...(conditions.productTags || []), ...values];
      break;
    case 'category':
      conditions.category = [...(Array.isArray(conditions.category) ? conditions.category : conditions.category ? [conditions.category] : []), ...values];
      break;
    case 'brand':
      conditions.brand = [...(Array.isArray(conditions.brand) ? conditions.brand : conditions.brand ? [conditions.brand] : []), ...values];
      break;
    case 'isAlcohol':
      conditions.isAlcoholic = String(condition.value).trim().toLowerCase() === 'true';
      break;
    case 'ruleGroup':
      // No dedicated ruleGroup field on RuleCondition; route through the
      // generic metadata matcher rather than dropping the condition.
      conditions.metadata = { ...(conditions.metadata || {}), ruleGroup: condition.value };
      break;
  }
}

function applyAction(actions: RuleActions, action: VisualRule['actions'][number]): void {
  switch (action.type) {
    case 'MINIMUM_AGE':
      actions.minimumAge = action.minimumAge;
      actions.requiresAgeGate = action.requiresGate;
      actions.requiresAgeAcknowledgement = action.requiresAcknowledgement;
      break;
    case 'PREVENT_UPSELL':
      actions.preventCheckoutUpsell = true;
      break;
    case 'PREVENT_RECOMMENDATION':
      actions.preventRecommendation = true;
      break;
    case 'EXCLUDE_FROM_DISCOUNTS':
      actions.excludeFromDiscounts = true;
      break;
    case 'PREVENT_STORY_PLACEMENT':
      actions.preventStoryPlacement = true;
      break;
    case 'PREVENT_CAROUSEL_PLACEMENT':
      actions.preventCarouselPlacement = true;
      break;
    case 'PREVENT_PURCHASE':
      actions.preventPurchase = true;
      if (action.reason) actions.warningText = actions.warningText || action.reason;
      break;
    case 'HIDE_PRODUCT':
      actions.hideProduct = true;
      break;
    case 'MAX_QUANTITY_PER_ORDER':
      actions.maxQuantityPerProduct = action.maximum;
      if (action.reason) actions.warningText = actions.warningText || action.reason;
      break;
    case 'COMBINED_GROUP_LIMIT':
      actions.maxQuantityAcrossRuleGroup = {
        groupId: action.groupId,
        maxQuantity: action.maximum,
        groupName: action.groupName,
      };
      break;
    case 'REQUIRES_COURIER_VERIFICATION':
      actions.requiresCourierAgeCheck = true;
      break;
    case 'REQUIRES_ALLERGEN_DISPLAY':
      actions.requiresAllergenDisplay = true;
      break;
    case 'BADGE':
      actions.badge = action.label;
      break;
    case 'WARNING':
      actions.warningText = action.text;
      break;
  }
}

export function visualRuleToRetailRule(rule: VisualRule): RetailRule {
  const conditions: RuleCondition = {};
  for (const condition of rule.matchConditions || []) {
    applyMatchCondition(conditions, condition);
  }
  // Activates the evaluator's existing (previously dormant) country check —
  // see ProductRuleEvaluator.matchesCondition's `condition.country && context.country`.
  if (rule.countries && rule.countries.length > 0) {
    conditions.country = rule.countries;
  }

  const actions: RuleActions = {};
  for (const action of rule.actions || []) {
    applyAction(actions, action);
  }

  return {
    id: rule.id,
    name: rule.name,
    enabled: rule.enabled,
    priority: rule.priority,
    conditions,
    actions,
  };
}

export function visualRulesToRetailRules(rules: VisualRule[]): RetailRule[] {
  return (rules || []).map(visualRuleToRetailRule);
}
