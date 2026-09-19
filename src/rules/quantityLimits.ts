import { BasketItem, Product } from '../commerce/models';
import { defaultRuleEngine } from './RuleEngine';

export interface QuantityValidationResult {
  allowed: boolean;
  maxAllowed: number;
  reason?: string;
}

/**
 * Validates a requested quantity change against individual and group limits.
 *
 * NOTE: The UI is advisory only. Backend BFF enforces identical limits independently.
 */
export function validateProductQuantityChange(
  product: Product,
  newQuantity: number,
  currentBasketItems: BasketItem[] = []
): QuantityValidationResult {
  const decision = defaultRuleEngine.evaluateProduct(
    product,
    {},
    currentBasketItems,
    0
  );

  const maxAllowed = decision.effectiveMaximum ?? 99;

  if (newQuantity > maxAllowed) {
    return {
      allowed: false,
      maxAllowed,
      reason:
        decision.quantityLimitReason ||
        `Quantity exceeds the limit of ${maxAllowed} for this item.`,
    };
  }

  return {
    allowed: true,
    maxAllowed,
  };
}
