import { Product, BasketItem, Basket, Store, Money } from '../commerce/models';

/**
 * Matching conditions for declarative retail rules.
 * Supports matching on PLU, GTIN, tags, labels, category, brand,
 * metadata attributes, alcohol details, country, and fulfillment type.
 */
export interface RuleCondition {
  /** Match exact PLU or array of PLUs */
  plu?: string | string[];

  /** Match any GTIN in the list */
  gtin?: string | string[];

  /** Match if product has any of the specified tags (case-insensitive) */
  productTags?: string[];

  /** Match if product has any of the display labels */
  displayLabels?: string[];

  /** Match category ID or category name */
  category?: string | string[];

  /** Match brand name */
  brand?: string | string[];

  /** Match metadata attributes (key-value comparison) */
  metadata?: Record<string, unknown>;

  /** Match alcohol status */
  isAlcoholic?: boolean;

  /** Match minimum ABV threshold (percentage, e.g. 0.5) */
  minAbv?: number;

  /** Match country code (e.g. 'GB', 'IE') */
  country?: string | string[];

  /** Match fulfillment type */
  fulfillmentType?: 'delivery' | 'pickup' | ('delivery' | 'pickup')[];
}

/**
 * Group limit configuration for aggregated restrictions across multiple products.
 * e.g. Pain relief / paracetamol & aspirin combined limit of 2.
 */
export interface RuleGroupLimit {
  groupId: string;
  maxQuantity: number;
  groupName?: string;
}

/**
 * Declarative actions applied when a rule condition is satisfied.
 * The UI is advisory only. Backend-for-Frontend (BFF) and Commerce API
 * independently enforce these rules upon basket mutation and checkout authorization.
 */
export interface RuleActions {
  /** Minimum legal customer age required (e.g. 18, 16) */
  minimumAge?: number;

  /** Whether an age-gate modal / barrier is required before adding */
  requiresAgeGate?: boolean;

  /** Whether the customer must acknowledge their age */
  requiresAgeAcknowledgement?: boolean;

  /** Whether courier must perform physical ID check on delivery (e.g. Challenge 25) */
  requiresCourierAgeCheck?: boolean;

  /** Strictly omit product from rendering in customer catalogs */
  hideProduct?: boolean;

  /** Show product in catalogue but disable purchase */
  preventPurchase?: boolean;

  /** Prevent product from appearing in checkout upsell strips (e.g. HFSS legislation) */
  preventCheckoutUpsell?: boolean;

  /** Prevent product from being recommended across carousels */
  preventRecommendation?: boolean;

  /** Maximum quantity allowed for this specific product */
  maxQuantityPerProduct?: number;

  /** Maximum quantity allowed across an entire group of matching products */
  maxQuantityAcrossRuleGroup?: RuleGroupLimit;

  /** Minimum purchase quantity (e.g. minimum 2 for bulk promotions) */
  minimumQuantity?: number;

  /** Advisory warning text displayed on product detail or basket */
  warningText?: string;

  /** Visual badge text to render on product card (e.g. "18+", "Limit 2") */
  badge?: string;

  /** Exclude matching products from all basket and campaign discounts */
  excludeFromDiscounts?: boolean;

  /** Exclude matching products from story and carousel placements */
  preventStoryPlacement?: boolean;
  preventCarouselPlacement?: boolean;

  /** Explicit requirement to render allergens prominently */
  requiresAllergenDisplay?: boolean;
}

/**
 * A declarative retail rule originating from the BFF configuration.
 */
export interface RetailRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  priority?: number;
  conditions: RuleCondition;
  actions: RuleActions;
}

/**
 * Runtime context supplied to the Rule Engine for evaluation.
 */
export interface RuleEvaluationContext {
  country?: string;
  fulfillmentType?: 'delivery' | 'pickup';
  storeId?: string;
  sessionAgeAcknowledged?: Record<number, boolean>; // e.g. { 18: true, 16: true }
}

/**
 * Evaluation output for a single product.
 */
export interface ProductRuleDecision {
  shouldRender: boolean;
  canAddToCart: boolean;
  isGreyedOut: boolean;

  /**
   * Effective maximum quantity.
   * Computed using the LOWEST applicable explicit limit among:
   * - stockQuantity (when present; null/undefined means UNKNOWN stock, NOT zero)
   * - multiMax
   * - maximumQuantity
   * - maxQuantityPerProduct from rules
   * - remaining allowance from group limits
   * If NO explicit limits apply, this is null (never invent a limit).
   */
  effectiveMaximum: number | null;

  /** Effective minimum quantity (defaults to 1 unless minimumQuantity rule applies) */
  effectiveMinimum: number;

  /** Human-readable reason for the quantity limit */
  quantityLimitReason?: string;

  /** Badges to render on the product */
  badges: string[];

  /** Advisory warnings */
  warnings: string[];

  /** Age restriction details if applicable */
  ageRequirement?: {
    minimumAge: number;
    requiresGate: boolean;
    requiresAcknowledgement: boolean;
    requiresCourierCheck: boolean;
    isAcknowledgedInSession: boolean;
  };

  /** HFSS / Regulatory upsell prevention flag */
  preventCheckoutUpsell: boolean;

  /** Prevent recommendation flag */
  preventRecommendation: boolean;

  /** Whether allergen section must be displayed */
  requiresAllergenDisplay: boolean;

  discountEligible: boolean;
  preventStoryPlacement: boolean;
  preventCarouselPlacement: boolean;

  /** List of rule IDs that matched this product */
  appliedRuleIds: string[];

  /** Active group limits affecting this product */
  groupLimits: Array<{
    groupId: string;
    maxQuantity: number;
    currentQuantityInBasket: number;
    remainingAllowed: number;
  }>;
}

/**
 * Evaluation output for the whole basket.
 */
export interface BasketRuleDecision {
  valid: boolean;
  blockingIssues: string[];
  warnings: string[];
  requiresCourierAgeCheck: boolean;
  highestMinimumAge: number;
  unacknowledgedAgeRequirement?: number;
  itemDecisions: Record<
    string,
    {
      allowedQuantity: number;
      effectiveMax: number | null;
      issues: string[];
      ruleIds: string[];
    }
  >;
  groupTotals: Record<
    string,
    {
      groupId: string;
      maxQuantity: number;
      currentQuantity: number;
      exceeded: boolean;
    }
  >;
}

/**
 * Comparison diff when switching stores with items in basket.
 */
export interface StoreSwitchReconciliation {
  hasChanges: boolean;
  availableUnchanged: Array<{ plu: string; name: string; quantity: number; price: Money }>;
  priceChanges: Array<{
    plu: string;
    name: string;
    oldPrice: Money;
    newPrice: Money;
    quantity: number;
  }>;
  unavailableItems: Array<{
    plu: string;
    name: string;
    quantity: number;
    reason: 'OUT_OF_STOCK' | 'NOT_CARRIED' | 'RESTRICTED';
  }>;
  quantityAdjustments: Array<{
    plu: string;
    name: string;
    requestedQuantity: number;
    adjustedQuantity: number;
    reason: string;
  }>;
}

// ==========================================
// DISPATCH & COURIER ORCHESTRATION RULES
// ==========================================

export type DispatchAssignmentEvent = 'START_PICKING' | 'CHECKOUT_PAID' | 'ORDER_FINALISED';
export type CourierSelectionPolicy = 'CUSTOMER_CHOICE' | 'CHEAPEST' | 'FASTEST' | 'TENANT_PRIORITY';

export interface TenantDispatchRules {
  assignmentEvent: DispatchAssignmentEvent;
  dynamicTiming: boolean;
  itemsPickedPerMinute: number; // default 3
  readyBufferMinutes: number; // default 1
  retryIntervalSeconds: number; // default 60
  maxRetryAttempts: number; // default 3
  unacceptedTimeoutMinutes: number; // default 15
  selectionPolicy: CourierSelectionPolicy;
  allowedProviders?: string[];
  tenantPriorityOrder?: string[];
  courierTransitMinutes?: number;
  minimumPickupLeadMinutes?: number;
  defaultLeadTimeMinutes?: number;
}

export const DEFAULT_DISPATCH_RULES: TenantDispatchRules = {
  assignmentEvent: 'START_PICKING',
  dynamicTiming: true,
  itemsPickedPerMinute: 3,
  readyBufferMinutes: 1,
  retryIntervalSeconds: 60,
  maxRetryAttempts: 3,
  unacceptedTimeoutMinutes: 15,
  selectionPolicy: 'CUSTOMER_CHOICE',
  allowedProviders: ['deliverect-dispatch', 'just-eat', 'stuart', 'uber'],
  tenantPriorityOrder: ['deliverect-dispatch', 'just-eat', 'stuart', 'uber'],
};
