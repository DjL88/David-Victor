import { Product, Basket, BasketItem, Store, Story, Money, moneyFromMajor } from '../commerce/models';
import {
  RetailRule,
  RuleEvaluationContext,
  ProductRuleDecision,
  BasketRuleDecision,
  StoreSwitchReconciliation,
} from './types';
import { evaluateProductRules } from './ProductRuleEvaluator';
import { evaluateBasketRules } from './BasketRuleEvaluator';

/**
 * Generic Rules and Retail Availability Engine.
 *
 * NOTE: The UI is advisory only. In production, the BFF and
 * Deliverect Commerce API execute identical declarative rules
 * server-side for security and legal compliance.
 */
export class RuleEngine {
  private rules: RetailRule[] = [];
  private defaultContext: RuleEvaluationContext = {};

  constructor(initialRules: RetailRule[] = []) {
    this.rules = [...initialRules];
  }

  /**
   * Updates or replaces the rules with new tenant/country configuration.
   */
  public setRules(rules: RetailRule[]): void {
    this.rules = [...rules];
  }

  /**
   * Sets the ambient context (selected store's country, storeId,
   * fulfillmentType) merged into every evaluation call that doesn't supply
   * its own explicit value for a given field. Every real call site
   * (ProductCard, HomeScreen, checkout quantity limits, etc.) evaluates with
   * an empty {} context, so without this, country/store-scoped rules could
   * never match regardless of how they're configured.
   */
  public setDefaultContext(context: RuleEvaluationContext): void {
    this.defaultContext = { ...context };
  }

  private withDefaultContext(context: RuleEvaluationContext): RuleEvaluationContext {
    return { ...this.defaultContext, ...context };
  }

  /**
   * Adds a new declarative rule.
   */
  public addRule(rule: RetailRule): void {
    this.rules.push(rule);
  }

  /**
   * Retrieves current active rules.
   */
  public getRules(): RetailRule[] {
    return [...this.rules];
  }

  /**
   * Evaluates availability, inventory limits, and regulatory rules for a single product.
   */
  public evaluateProduct(
    product: Product,
    context: RuleEvaluationContext = {},
    basketItems: BasketItem[] = [],
    currentBasketQuantity: number = 0
  ): ProductRuleDecision {
    return evaluateProductRules(
      product,
      this.rules,
      this.withDefaultContext(context),
      basketItems,
      currentBasketQuantity
    );
  }

  /**
   * Evaluates the entire basket against individual, group, age, and stock constraints.
   */
  public evaluateBasket(
    basket: Basket,
    products: Product[] | Map<string, Product>,
    context: RuleEvaluationContext = {}
  ): BasketRuleDecision {
    const productsMap =
      products instanceof Map
        ? products
        : new Map(products.map((p) => [p.plu, p]));

    return evaluateBasketRules(basket, productsMap, this.rules, this.withDefaultContext(context));
  }

  /**
   * Filters out products that must not appear in checkout upsell strips.
   * e.g. Products with preventCheckoutUpsell=true (such as HFSS items).
   * Note: The component does not hard-code "HFSS" logic; rule evaluation determines this.
   */
  public filterUpsells(
    products: Product[],
    context: RuleEvaluationContext = {}
  ): Product[] {
    return products.filter((product) => {
      const decision = this.evaluateProduct(product, context);
      return decision.shouldRender && !decision.isGreyedOut && !decision.preventCheckoutUpsell;
    });
  }

  /**
   * Filters out products that must not appear in promotional recommendations.
   */
  public filterRecommendations(
    products: Product[],
    context: RuleEvaluationContext = {}
  ): Product[] {
    return products.filter((product) => {
      const decision = this.evaluateProduct(product, context);
      return decision.shouldRender && !decision.isGreyedOut && !decision.preventRecommendation;
    });
  }

  /**
   * Evaluates whether a story is eligible to be displayed in the current context.
   * Supports startsAt/endsAt scheduling, store targeting, and AND/OR stock availability of linked products.
   */
  public isStoryEligible(
    story: Story,
    context: RuleEvaluationContext = {},
    targetProduct?: Product,
    linkedProducts?: Product[]
  ): boolean {
    context = this.withDefaultContext(context);
    const now = new Date();

    // 1. Time-based scheduling
    if (story.startsAt && new Date(story.startsAt) > now) {
      return false;
    }
    if (story.endsAt && new Date(story.endsAt) < now) {
      return false;
    }

    // 2. Country code filter
    if (
      context.country &&
      story.countryCodes &&
      story.countryCodes.length > 0 &&
      !story.countryCodes.includes(context.country)
    ) {
      return false;
    }

    // 3. Store filter (if store is selected and story has explicit store restrictions)
    const rawStoreIds = story.storeIds || (story as any).eligibleStoreIds || [];
    if (context.storeId && rawStoreIds.length > 0) {
      const targetId = context.storeId.toLowerCase();
      // Match exact store ID or normalized name (e.g., handles store-chelmsford-central vs store-market-lane-chelmsford)
      const matchesStore = rawStoreIds.some((id: string) => {
        const norm1 = id.toLowerCase().replace(/store-market-lane-|store-|-central|-st|-bypass/g, '');
        const norm2 = targetId.replace(/store-market-lane-|store-|-central|-st|-bypass/g, '');
        return id === context.storeId || norm1 === norm2 || targetId.includes(norm1);
      });
      if (!matchesStore) {
        return false;
      }
    }

    // Helper to test if an individual product is in stock and permitted
    const isProductInStock = (prod: Product): boolean => {
      if (prod.active === false) return false;
      if (prod.stockStatus === 'OUT_OF_STOCK') return false;
      if (prod.stockQuantity !== undefined && prod.stockQuantity <= 0) return false;

      const decision = this.evaluateProduct(prod, context);
      if (!decision.shouldRender || decision.isGreyedOut) {
        return false;
      }
      return true;
    };

    // 4. Multiple linked products with AND / OR stock logic
    if (linkedProducts && linkedProducts.length > 0) {
      const mode = story.stockMatchMode || 'OR';
      if (mode === 'AND') {
        // E.g., Meal Deal: EVERY component must be in stock at this location
        const expectedCount = story.linkedProductPlus?.length || 0;
        if (expectedCount > 0 && linkedProducts.length < expectedCount) {
          return false;
        }
        const allInStock = linkedProducts.every((prod) => isProductInStock(prod));
        if (!allInStock) {
          return false;
        }
      } else {
        // E.g., Crisps Range: At least 1 item must be in stock at this location
        const atLeastOneInStock = linkedProducts.some((prod) => isProductInStock(prod));
        if (!atLeastOneInStock) {
          return false;
        }
      }
    } else if (story.action && story.action.type === 'PRODUCT' && targetProduct) {
      // Single product target fallback
      if (!isProductInStock(targetProduct)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Compares basket items against a destination store when switching stores.
   * Categorizes items into:
   * - Available unchanged
   * - Available but price changed
   * - Unavailable (out of stock, inactive, or not carried)
   * - Quantity reduced due to local stock/restrictions
   * Never silently deletes basket items; enables customer confirmation.
   */
  public reconcileStoreSwitch(
    currentBasket: Basket,
    targetStoreProducts: Product[],
    _targetStore: Store,
    context: RuleEvaluationContext = {}
  ): StoreSwitchReconciliation {
    const targetMap = new Map(targetStoreProducts.map((p) => [p.plu, p]));

    const availableUnchanged: StoreSwitchReconciliation['availableUnchanged'] = [];
    const priceChanges: StoreSwitchReconciliation['priceChanges'] = [];
    const unavailableItems: StoreSwitchReconciliation['unavailableItems'] = [];
    const quantityAdjustments: StoreSwitchReconciliation['quantityAdjustments'] = [];

    for (const item of currentBasket.items) {
      if (!item) continue;
      const targetProduct = targetMap.get(item.plu);
      const itemName = item.name || targetProduct?.name || item.plu;

      if (!targetProduct || targetProduct.active === false) {
        unavailableItems.push({
          plu: item.plu,
          name: itemName,
          quantity: item.quantity,
          reason: 'NOT_CARRIED',
        });
        continue;
      }

      const decision = this.evaluateProduct(targetProduct, context);
      const prodName = targetProduct.name || itemName;

      if (decision.isGreyedOut || !decision.shouldRender) {
        unavailableItems.push({
          plu: item.plu,
          name: prodName,
          quantity: item.quantity,
          reason: 'OUT_OF_STOCK',
        });
        continue;
      }

      const currency = item.price.currency || 'GBP';
      const rawNewPrice = targetProduct.price ?? item.price;
      const newPrice: Money =
        typeof rawNewPrice === 'object' && rawNewPrice !== null && 'amount' in rawNewPrice
          ? rawNewPrice
          : moneyFromMajor(typeof rawNewPrice === 'number' ? rawNewPrice : 0, currency);

      const getNumPrice = (p: any): number => {
        if (!p) return 0;
        if (typeof p === 'number') return p;
        if (typeof p === 'object' && 'amount' in p) return p.amount / 100;
        return 0;
      };
      const priceChanged = Math.abs(getNumPrice(newPrice) - getNumPrice(item.price)) > 0.001;

      // Check if quantity needs adjustment due to local stock or explicit limit
      let adjustedQty = item.quantity;
      if (decision.effectiveMaximum !== null && item.quantity > decision.effectiveMaximum) {
        adjustedQty = decision.effectiveMaximum;
        quantityAdjustments.push({
          plu: item.plu,
          name: prodName,
          requestedQuantity: item.quantity,
          adjustedQuantity: adjustedQty,
          reason: decision.quantityLimitReason || `Reduced to store limit of ${adjustedQty}`,
        });
      }

      if (priceChanged) {
        priceChanges.push({
          plu: item.plu,
          name: prodName,
          oldPrice: item.price,
          newPrice,
          quantity: adjustedQty,
        });
      } else if (adjustedQty === item.quantity) {
        availableUnchanged.push({
          plu: item.plu,
          name: prodName,
          quantity: adjustedQty,
          price: newPrice,
        });
      }
    }

    const hasChanges =
      priceChanges.length > 0 ||
      unavailableItems.length > 0 ||
      quantityAdjustments.length > 0;

    return {
      hasChanges,
      availableUnchanged,
      priceChanges,
      unavailableItems,
      quantityAdjustments,
    };
  }
}

/**
 * Singleton default rule engine instance.
 */
export const defaultRuleEngine = new RuleEngine();
