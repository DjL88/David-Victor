import { BasketItem, Product } from './models';
import { DELIVERECT_CATALOG_DEALS, DeliverectDeal } from './dealModels';
import { defaultRuleEngine } from '../rules/RuleEngine';

export interface ReverseDealPrompt {
  deal: DeliverectDeal;
  missingProduct: Product;
  missingSlotName?: string;
  presentItems: Array<{
    plu: string;
    name: string;
    imageUrl?: string;
    price: number;
    quantity: number;
  }>;
  currentTwoItemsPrice: number;
  regularMissingPrice: number;
  fullRegularPrice: number;
  dealPrice: number;
  totalSavings: number;
  incrementalCost: number; // Extra money the customer pays to unlock the meal deal
  isHfssBlocked: boolean;
  hfssReason?: string;
}

/**
 * Checks if a product is HFSS (High in Fat, Sugar or Salt) tagged,
 * in accordance with The Food (Promotion and Placement) (England) Regulations.
 */
export function isHfssTagged(product: Product | null | undefined): boolean {
  if (!product) return false;

  const allTags = [
    ...(product.productTags || []),
    ...(product.displayLabels || []),
    ...((product as any).tags || []),
  ].map((t) => String(t).trim().toUpperCase());

  // 1. Explicit HFSS product tags or regulatory tags
  if (
    allTags.includes('HFSS') ||
    allTags.includes('HFSS_RESTRICTED') ||
    allTags.includes('HFSS_RESTRICTED_CHECKOUT') ||
    allTags.some((t) => t.includes('HFSS'))
  ) {
    return true;
  }

  // 2. Direct boolean flags
  if ((product as any).isHfss === true || (product as any).hfss === true) {
    return true;
  }

  // 3. Nutritional info HFSS flag
  if ((product.nutritionalInfo as any)?.isHfss === true || (product.nutritionalInfo as any)?.hfssScore >= 4) {
    return true;
  }

  // 4. Rule Engine evaluation
  try {
    const decision = defaultRuleEngine.evaluateProduct(product, { country: 'GB' });
    if (decision.preventCheckoutUpsell || decision.badges?.includes('HFSS')) {
      return true;
    }
  } catch {
    // Non-blocking fallback
  }

  return false;
}

/**
 * Helper to get major price number from product or basket item
 */
function getMajorPrice(priceOrProduct: any): number {
  if (typeof priceOrProduct === 'number') return priceOrProduct;
  if (!priceOrProduct) return 0;
  if (typeof priceOrProduct.price === 'number') return priceOrProduct.price;
  if (typeof priceOrProduct.price === 'object' && priceOrProduct.price !== null) {
    if ('amount' in priceOrProduct.price) return priceOrProduct.price.amount / 100;
  }
  if ('amount' in priceOrProduct) return priceOrProduct.amount / 100;
  return 0;
}

/**
 * Reverse Deal Calculation Engine:
 * Analyzes current basket items against 3-item meal deals.
 * If 2 of 3 items are present in the basket, prompts the user to add the 3rd item
 * to complete the deal and unlock volume discount savings—UNLESS the missing item is HFSS tagged.
 *
 * CRITICAL RULE:
 * Basket items that are ALREADY part of an active/completed deal (either another bundle,
 * a multi-buy, or an applied basket discount) are NOT eligible for reverse deal prompts.
 */
export function calculateReverseDeals(
  basketItems: BasketItem[] = [],
  allProducts: Product[] = [],
  deals: DeliverectDeal[] = DELIVERECT_CATALOG_DEALS,
  basketDiscounts: Array<{ id?: string; title?: string; [key: string]: any }> = []
): { eligible: ReverseDealPrompt[]; hfssBlocked: ReverseDealPrompt[] } {
  const eligible: ReverseDealPrompt[] = [];
  const hfssBlocked: ReverseDealPrompt[] = [];

  if (!basketItems || basketItems.length === 0 || !allProducts || allProducts.length === 0) {
    return { eligible, hfssBlocked };
  }

  // 1. Build initial counts of items in the basket by PLU
  const availablePluCounts: Record<string, number> = {};
  for (const item of basketItems) {
    if (item.plu && item.quantity > 0) {
      availablePluCounts[item.plu] = (availablePluCounts[item.plu] || 0) + item.quantity;
    }
  }

  // 2. Consume items that are ALREADY in a completed deal in the basket.
  // This includes:
  // - Fully satisfied 'AND' deals (e.g. all items in bundle already present in basket)
  // - Fully satisfied 'OR' multibuy deals (e.g. pairs of qualifying items)
  for (const deal of deals) {
    if (deal.stockMatchMode === 'AND' && deal.linkedProductPlus && deal.linkedProductPlus.length > 0) {
      const fullSets = Math.min(...deal.linkedProductPlus.map((plu) => availablePluCounts[plu] || 0));
      if (fullSets > 0) {
        for (const plu of deal.linkedProductPlus) {
          availablePluCounts[plu] = Math.max(0, (availablePluCounts[plu] || 0) - fullSets);
        }
      }
    } else if (deal.stockMatchMode === 'OR' && deal.linkedProductPlus && deal.linkedProductPlus.length > 0) {
      const totalMatching = deal.linkedProductPlus.reduce(
        (sum, plu) => sum + (availablePluCounts[plu] || 0),
        0
      );
      const pairs = Math.floor(totalMatching / 2);
      if (pairs > 0) {
        let toDeduct = pairs * 2;
        for (const plu of deal.linkedProductPlus) {
          if (toDeduct <= 0) break;
          const take = Math.min(availablePluCounts[plu] || 0, toDeduct);
          availablePluCounts[plu] -= take;
          toDeduct -= take;
        }
      }
    }
  }

  // 3. Consume items mapped from active basket discounts
  if (basketDiscounts && basketDiscounts.length > 0) {
    for (const discount of basketDiscounts) {
      const matchingDeal = deals.find(
        (d) => d.id === discount.id || (discount.title && discount.title.includes(d.title))
      );
      if (matchingDeal?.linkedProductPlus) {
        for (const plu of matchingDeal.linkedProductPlus) {
          if ((availablePluCounts[plu] || 0) > 0) {
            availablePluCounts[plu] = Math.max(0, availablePluCounts[plu] - 1);
          }
        }
      }
    }
  }

  // 4. Iterate through 3-item bundle/meal deals using ONLY unbundled, available items
  for (const deal of deals) {
    if (deal.stockMatchMode !== 'AND') continue;
    if (!deal.linkedProductPlus || deal.linkedProductPlus.length !== 3) continue;

    // Check how many of the 3 items are present in the UNCOMMITTED available pool
    const presentPlus = deal.linkedProductPlus.filter((plu) => (availablePluCounts[plu] || 0) > 0);
    const missingPlus = deal.linkedProductPlus.filter((plu) => (availablePluCounts[plu] || 0) === 0);

    // We are looking for EXACTLY 2 of 3 items present
    if (presentPlus.length === 2 && missingPlus.length === 1) {
      const missingPlu = missingPlus[0];
      const missingProduct = allProducts.find((p) => p.plu === missingPlu);

      if (!missingProduct || missingProduct.active === false) {
        continue;
      }

      // Check slot name if defined
      let missingSlotName: string | undefined;
      if (deal.slots && deal.slots.length > 0) {
        const slot = deal.slots.find((s) => s.allowedPlus.includes(missingPlu));
        if (slot) missingSlotName = slot.name;
      }

      // Present items details
      const presentItems = presentPlus.map((plu) => {
        const bItem = basketItems.find((i) => i.plu === plu);
        const prod = allProducts.find((p) => p.plu === plu);
        return {
          plu,
          name: bItem?.name || prod?.name || plu,
          imageUrl: bItem?.imageUrl || prod?.imageUrl,
          price: bItem ? getMajorPrice(bItem) : prod ? getMajorPrice(prod) : 0,
          quantity: bItem?.quantity || 1,
        };
      });

      const currentTwoItemsPrice = presentItems.reduce((sum, i) => sum + i.price, 0);
      const regularMissingPrice = getMajorPrice(missingProduct);
      const fullRegularPrice = Number((currentTwoItemsPrice + regularMissingPrice).toFixed(2));
      const totalSavings = Math.max(0, Number((fullRegularPrice - deal.dealPrice).toFixed(2)));
      const incrementalCost = Math.max(0, Number((deal.dealPrice - currentTwoItemsPrice).toFixed(2)));

      // Check HFSS status of missing item
      const isHfss = isHfssTagged(missingProduct);

      const prompt: ReverseDealPrompt = {
        deal,
        missingProduct,
        missingSlotName,
        presentItems,
        currentTwoItemsPrice,
        regularMissingPrice,
        fullRegularPrice,
        dealPrice: deal.dealPrice,
        totalSavings,
        incrementalCost,
        isHfssBlocked: isHfss,
        hfssReason: isHfss
          ? 'Item is classified as High in Fat, Sugar or Salt (HFSS); checkout promotion is legally restricted.'
          : undefined,
      };

      if (isHfss) {
        hfssBlocked.push(prompt);
      } else {
        eligible.push(prompt);
      }

      // Mark these 2 items as allocated so another reverse deal doesn't duplicate-prompt for the same items
      for (const plu of presentPlus) {
        availablePluCounts[plu] = Math.max(0, (availablePluCounts[plu] || 0) - 1);
      }
    }
  }

  return { eligible, hfssBlocked };
}
