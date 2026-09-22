import { describe, expect, it } from 'vitest';
import { evaluateBasketRules } from '../rules/BasketRuleEvaluator';
import { evaluateProductRules } from '../rules/ProductRuleEvaluator';
import type { Basket, Product } from '../commerce/models';
import type { RetailRule } from '../rules/types';

const product = (plu: string, tags: string[]): Product => ({
  id: plu, plu, gtin: [], name: plu, categoryIds: ['MED'], productTags: tags,
  displayLabels: [], allergens: [], active: true, stockStatus: 'IN_STOCK',
});
const rule: RetailRule = {
  id: 'medicine-cap', name: 'Medicine cap', enabled: true,
  conditions: { productTags: ['MEDICINE'] },
  actions: { maxQuantityAcrossRuleGroup: { groupId: 'medicine', groupName: 'medicine', maxQuantity: 2 } },
};
const a = product('A', ['MEDICINE']);
const b = product('B', ['MEDICINE']);
const c = product('C', ['OTHER']);

describe('combined group basket limits', () => {
  it('counts every matching product using rule conditions', () => {
    const basket = {
      id: 'basket', storeId: 'store', fulfillmentType: 'pickup',
      items: [{ plu: 'A', name: 'A', quantity: 1 }, { plu: 'B', name: 'B', quantity: 2 }],
      discounts: [], charges: [], subtotal: { amount: 0, currency: 'GBP' },
      total: { amount: 0, currency: 'GBP' },
    } as Basket;
    const result = evaluateBasketRules(basket, new Map([['A', a], ['B', b]]), [rule]);
    expect(result.valid).toBe(false);
    expect(result.groupTotals.medicine.currentQuantity).toBe(3);
    expect(result.groupViolations).toEqual([{ groupId: 'medicine', maxAllowed: 2, totalQuantity: 3 }]);
  });

  it('does not count unrelated products', () => {
    const basket = {
      id: 'basket', storeId: 'store', fulfillmentType: 'pickup',
      items: [{ plu: 'A', name: 'A', quantity: 1 }, { plu: 'C', name: 'C', quantity: 5 }],
      discounts: [], charges: [], subtotal: { amount: 0, currency: 'GBP' },
      total: { amount: 0, currency: 'GBP' },
    } as Basket;
    expect(evaluateBasketRules(basket, new Map([['A', a], ['C', c]]), [rule]).valid).toBe(true);
  });

  it('uses matching rule IDs on projected basket lines for add-button remaining capacity', () => {
    const projectedOther = { plu: 'B', name: 'B', quantity: 2, appliedRules: ['medicine-cap'] } as any;
    const decision = evaluateProductRules(a, [rule], {}, [projectedOther], 0);
    expect(decision.effectiveMaximum).toBe(0);
    expect(decision.canAddToCart).toBe(false);
  });
});
