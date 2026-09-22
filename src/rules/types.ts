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
  countries?: string[];
  conditions: RuleCondition;
  actions: RuleActions;
}

/**
 * Runtime context supplied to the Rule Engine for evaluation.
 */
export interface RuleEvaluationContext {
  country?: string;
  /** UK-specific: England / Scotland / Wales / Northern Ireland, derived from the store's postcode. */
  nation?: string;
  region?: string;
  county?: string;
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

  /** Convenience aliases for age restrictions */
  minimumAge?: number;
  requiresAgeGate?: boolean;
  requiresCourierAgeCheck?: boolean;
  badge?: string;

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
  /** Alias for valid */
  isValid?: boolean;
  blockingIssues: string[];
  warnings: string[];
  requiresCourierAgeCheck: boolean;
  highestMinimumAge: number;
  unacknowledgedAgeRequirement?: number;
  /** Active group violations list */
  groupViolations?: Array<{
    groupId: string;
    maxAllowed: number;
    totalQuantity: number;
  }>;
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

// ==========================================
// ENTERPRISE FOUNDATION CONTRACTS (forward-ported)
// ==========================================

/**
 * Capacity is a reservation problem, not just a UI limit. A production implementation
 * must atomically reserve/release capacity at checkout so concurrent shoppers cannot
 * consume the same stock or fulfilment slot.
 */
export interface CapacityPolicy {
  enabled: boolean;
  /** Maximum accepted orders in a rolling window for a location. */
  maxOrdersPerWindow?: number;
  windowMinutes?: number;
  /** Optional cap on concurrently active orders being picked/prepared. */
  maxActiveOrders?: number;
  /** Optional delivery capacity expressed as available driver/order slots. */
  deliverySlots?: number;
  /** Percentage of configured capacity at which the storefront should warn/slow intake. */
  warningThresholdPercent?: number;
  /** Behaviour once hard capacity is reached. */
  onCapacityReached: 'PAUSE_CHECKOUT' | 'DELIVERY_ONLY_PAUSE' | 'NEXT_AVAILABLE_SLOT';
}

export type DemandSignalMetric =
  | 'ORDER_RATE'
  | 'UNIT_RATE'
  | 'PRODUCT_UNIT_RATE'
  | 'DISCOUNT_REDEMPTION_RATE'
  | 'STOCK_DEPLETION_RATE';

export interface DemandThreshold {
  /** Observation window used to calculate the signal. */
  windowMinutes: number;
  /** Minimum sample count prevents tiny volumes being treated as a spike. */
  minimumSamples: number;
  /** Multiplier over the rolling baseline, e.g. 3 = 3x normal demand. */
  baselineMultiplier: number;
  /** Optional absolute threshold as an additional guardrail. */
  absoluteThreshold?: number;
}

export type DemandProtectionAction =
  | { type: 'MAX_QUANTITY_PER_ORDER'; maximum: number }
  | { type: 'PAUSE_PRODUCT' }
  | { type: 'PAUSE_DISCOUNT' }
  | { type: 'REQUIRE_MANUAL_REVIEW' };

export interface DemandProtectionStage {
  threshold: DemandThreshold;
  actions: DemandProtectionAction[];
}

/**
 * Tenant-configurable automatic protection. Stages are evaluated in order of severity,
 * allowing patterns such as Limit 2 -> Limit 1 -> Pause product as demand accelerates.
 * These policies generate temporary runtime protections; they do not mutate source stock.
 */
export interface DemandProtectionPolicy {
  id: string;
  name: string;
  enabled: boolean;
  metric: DemandSignalMetric;
  productPlu?: string;
  productTag?: string;
  category?: string;
  discountId?: string;
  countries?: string[];
  storeIds?: string[];
  /** Rolling baseline period used for comparison. */
  baselineMinutes: number;
  /** Automatic protection expires unless the signal remains elevated. */
  protectionTtlMinutes: number;
  stages: DemandProtectionStage[];
  /** Safety option for regulated/high-impact policies. */
  requireApproval?: boolean;
}

export interface CapacityReservation {
  reservationId: string;
  tenantId: string;
  storeId: string;
  orderId: string;
  status: 'HELD' | 'COMMITTED' | 'RELEASED' | 'EXPIRED';
  expiresAt: string;
  createdAt: string;
}

/**
 * Generic idempotency envelope for durable side effects such as checkout, order submission,
 * capacity reservation and event delivery. Implementations persist this before invoking a
 * non-idempotent dependency and return the recorded result on safe retries.
 */
export interface IdempotencyRecord {
  tenantId: string;
  operation: string;
  key: string;
  requestHash: string;
  status: 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED_RETRYABLE' | 'FAILED_FINAL';
  resourceId?: string;
  resultReference?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}

/**
 * Durable platform event. Consumers acknowledge their own delivery independently so an
 * analytics, BI or notification outage cannot make an order disappear.
 */
export interface PlatformEvent<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  eventId: string;
  schemaVersion: number;
  tenantId: string;
  type: string;
  occurredAt: string;
  correlationId?: string;
  locationId?: string;
  resourceId?: string;
  payload: TPayload;
}

export interface EventDeliveryAttempt {
  eventId: string;
  destinationId: string;
  attempt: number;
  status: 'PENDING' | 'DELIVERED' | 'RETRYING' | 'DEAD_LETTER';
  nextAttemptAt?: string;
  lastHttpStatus?: number;
  lastErrorCode?: string;
  updatedAt: string;
}

// ==========================================
// OPERATIONAL EXCEPTIONS & ORDER RECOVERY
// ==========================================

export type OrderExceptionType =
  | 'ACCEPTANCE_TIMEOUT'
  | 'PAYMENT_UNCERTAIN'
  | 'FULFILMENT_STALLED'
  | 'COURIER_UNAVAILABLE'
  | 'CUSTOMER_CANCELLATION'
  | 'STORE_CANCELLATION'
  | 'PROVIDER_ERROR'
  | 'UNKNOWN';

export type OrderExceptionStatus =
  | 'OPEN'
  | 'RETRY_SCHEDULED'
  | 'MANUAL_REVIEW'
  | 'RECOVERED'
  | 'CANCELLED'
  | 'COMPENSATION_PENDING'
  | 'RESOLVED';

export interface OrderOperationalException {
  exceptionId: string;
  tenantId: string;
  orderId: string;
  storeId?: string;
  type: OrderExceptionType;
  status: OrderExceptionStatus;
  reasonCode: string;
  correlationId?: string;
  sourceSystem?: string;
  attemptCount: number;
  firstObservedAt: string;
  lastObservedAt: string;
  nextRetryAt?: string;
  resolvedAt?: string;
  /** No provider-specific callback behaviour belongs in this neutral exception record. */
  metadata?: Record<string, string | number | boolean | null>;
}

export interface OrderExceptionPolicy {
  tenantId: string;
  acceptanceTimeoutMinutes: number;
  maximumRetryAttempts: number;
  retryDelaySeconds: number;
  onRetriesExhausted: 'MANUAL_REVIEW' | 'CANCEL' | 'KEEP_OPEN';
}

// ==========================================
// TRUST, REFUNDS & CUSTOMER CARE
// ==========================================

export type CustomerDataVisibility = 'NONE' | 'MASKED' | 'FULL';
export type RefundAuthority = 'NONE' | 'STORE' | 'CENTRAL' | 'BOTH';

export interface CustomerCareAccessPolicy {
  refundAuthority: RefundAuthority;
  customerDataVisibility: CustomerDataVisibility;
  canViewRiskSignals: boolean;
  canIssuePartialRefund: boolean;
  canIssueFullRefund: boolean;
  canIssueVoucher: boolean;
  canResendOrder: boolean;
  canOverrideAutomatedDecision: boolean;
  /** Optional location scope for store-operated support teams. */
  storeIds?: string[];
  locationGroupIds?: string[];
  maximumRefundAmountMinor?: number;
}

export interface TenantCustomerCarePolicy {
  /** Retailers can disable automatic refunds completely. */
  automaticRefundsEnabled: boolean;
  selfServiceClaimsEnabled: boolean;
  claimWindowMinutes: number;
  /** Optional SLA after which an unresolved eligible review can auto-resolve. */
  reviewSlaMinutes?: number;
  onReviewSlaExpired: 'AUTO_REFUND_IF_ELIGIBLE' | 'ESCALATE' | 'KEEP_OPEN';
  rolePolicies: Partial<Record<'platformSuperAdmin' | 'tenantAdmin' | 'marketingEditor' | 'operationsEditor' | 'viewer', CustomerCareAccessPolicy>>;
}

export type CustomerIssueType =
  | 'ORDER_NOT_RECEIVED'
  | 'ITEM_MISSING'
  | 'ITEM_DAMAGED'
  | 'ITEM_EXPIRED'
  | 'WRONG_ITEM'
  | 'QUALITY_ISSUE'
  | 'OTHER';

export type CustomerCaseStatus =
  | 'OPEN'
  | 'EVIDENCE_REQUIRED'
  | 'AUTO_APPROVED'
  | 'REVIEW_REQUIRED'
  | 'APPROVED'
  | 'DECLINED'
  | 'REFUND_PENDING'
  | 'REFUNDED'
  | 'RESEND_PENDING'
  | 'RESOLVED'
  | 'ESCALATED';

export interface CustomerCase {
  caseId: string;
  tenantId: string;
  orderId: string;
  storeId: string;
  customerId?: string;
  issueType: CustomerIssueType;
  status: CustomerCaseStatus;
  source: 'SELF_SERVICE' | 'PHONE' | 'ADMIN' | 'SYSTEM';
  affectedItems?: Array<{ plu: string; quantity: number; amountMinor?: number }>;
  requestedAmountMinor?: number;
  currency: string;
  riskAssessmentId?: string;
  openedAt: string;
  reviewDueAt?: string;
  resolvedAt?: string;
  assignedTo?: string;
}

export type ResolutionType = 'PARTIAL_REFUND' | 'FULL_REFUND' | 'VOUCHER' | 'ORDER_RESEND' | 'DECLINE';

export interface CaseResolution {
  resolutionId: string;
  caseId: string;
  type: ResolutionType;
  amountMinor?: number;
  currency?: string;
  voucherId?: string;
  replacementOrderId?: string;
  reasonCode: string;
  actorId: string;
  actorScope: 'STORE' | 'CENTRAL' | 'SYSTEM';
  createdAt: string;
}

export type RefundableChargeType = 'ITEM' | 'DELIVERY_FEE' | 'SERVICE_FEE' | 'BAG_FEE' | 'TIP' | 'OTHER_FEE';

export interface RefundLedgerLine {
  lineId: string;
  type: RefundableChargeType;
  /** PLU is present for item-level refund lines. */
  plu?: string;
  originalQuantity?: number;
  refundedQuantity: number;
  originalAmountMinor: number;
  refundedAmountMinor: number;
  remainingRefundableAmountMinor: number;
}

export interface OrderRefundLedger {
  tenantId: string;
  orderId: string;
  currency: string;
  originalOrderAmountMinor: number;
  totalRefundedAmountMinor: number;
  remainingRefundableAmountMinor: number;
  lines: RefundLedgerLine[];
  version: number;
  updatedAt: string;
}

/**
 * Refund requests must be committed transactionally against the refund ledger using the
 * idempotency key and expected ledger version. This prevents duplicate refunds from
 * retries/concurrent agents and prevents an item quantity or fee being refunded twice.
 */
export interface RefundRequest {
  refundRequestId: string;
  idempotencyKey: string;
  tenantId: string;
  orderId: string;
  caseId?: string;
  expectedLedgerVersion: number;
  lines: Array<{
    lineId: string;
    quantity?: number;
    amountMinor: number;
  }>;
  actorId: string;
  reasonCode: string;
  createdAt: string;
}

export type RiskDecision = 'ALLOW' | 'STEP_UP' | 'LIMIT' | 'MANUAL_REVIEW' | 'TEMPORARY_HOLD';

export interface RiskSignal {
  code:
    | 'ORDER_VELOCITY'
    | 'ADDRESS_ACCOUNT_VELOCITY'
    | 'PAYMENT_INSTRUMENT_VELOCITY'
    | 'DECLINE_VELOCITY'
    | 'LOW_VALUE_BASKET_PATTERN'
    | 'REFUND_CLAIM_VELOCITY'
    | 'MISSING_ITEM_CLAIM_RATE'
    | 'WHOLE_ORDER_CLAIM_RATE'
    | 'DEVICE_ACCOUNT_VELOCITY'
    | 'COHORT_INCIDENT';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  observedValue?: number;
  thresholdReference?: string;
}

export interface RiskAssessment {
  assessmentId: string;
  tenantId: string;
  subjectReference: string;
  /** Store only privacy-minimised/hashed linkage references where practical. */
  linkageReferences?: string[];
  signals: RiskSignal[];
  decision: RiskDecision;
  reasonCodes: string[];
  createdAt: string;
  expiresAt?: string;
  requiresHumanReview: boolean;
}

export interface DeliveryEvidence {
  orderId: string;
  provider: string;
  eventType: string;
  occurredAt: string;
  proofReference?: string;
  locationReference?: string;
  recipientReference?: string;
}

export interface CourierCompensationClaim {
  claimId: string;
  tenantId: string;
  orderId: string;
  customerCaseId?: string;
  provider: string;
  status: 'ELIGIBLE' | 'DRAFT' | 'SUBMITTED' | 'ACCEPTED' | 'REJECTED' | 'PAID';
  amountMinor?: number;
  currency?: string;
  evidenceReferences: string[];
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// LOCALE & TENANT TERMINOLOGY
// ==========================================

export interface TenantLocaleProfile {
  tenantId: string;
  defaultLocale: string;
  supportedLocales: string[];
  fallbackLocale: string;
  currency: string;
  timezone: string;
  measurementSystem: 'METRIC' | 'IMPERIAL' | 'MIXED';
  dateFormat?: string;
  timeFormat?: '12H' | '24H';
}

export interface TenantTerminologyEntry {
  key: string;
  /** Tenant-specific wording, e.g. store/shop, basket/cart, collection/pickup. */
  value: string;
  locale: string;
  updatedAt: string;
  updatedBy: string;
}

export interface TenantTerminologyProfile {
  tenantId: string;
  entries: TenantTerminologyEntry[];
  /** Missing tenant terms fall back to translated platform copy, never raw translation keys. */
  fallbackToPlatformTranslation: boolean;
}

// ==========================================
// ORGANISATION & CONFIGURATION INHERITANCE
// ==========================================

export type OrganisationNodeType = 'ORGANISATION' | 'BRAND' | 'MARKET' | 'REGION' | 'LOCATION_GROUP' | 'LOCATION';

export interface OrganisationNode {
  nodeId: string;
  tenantId: string;
  type: OrganisationNodeType;
  name: string;
  parentNodeId?: string;
  enabled: boolean;
  country?: string;
  locale?: string;
  timezone?: string;
}

export interface ConfigurationOverride<T = Record<string, unknown>> {
  overrideId: string;
  tenantId: string;
  nodeId: string;
  resourceType: string;
  values: Partial<T>;
  version: number;
  updatedAt: string;
  updatedBy: string;
}

export interface ResolvedConfiguration<T = Record<string, unknown>> {
  tenantId: string;
  targetNodeId: string;
  resourceType: string;
  value: T;
  /** Root-to-leaf provenance makes inherited values explainable in the admin UI and audit log. */
  appliedNodeIds: string[];
  sourceRevisionIds: string[];
  resolvedAt: string;
}

// ==========================================
// VERSIONED TENANT CONTROL PLANE
// ==========================================

export type ConfigurationRevisionStatus = 'DRAFT' | 'VALIDATED' | 'PUBLISHED' | 'SUPERSEDED' | 'ROLLED_BACK';

export interface ConfigurationRevision<T = Record<string, unknown>> {
  revisionId: string;
  tenantId: string;
  resourceType: string;
  resourceId: string;
  version: number;
  status: ConfigurationRevisionStatus;
  payload: T;
  createdAt: string;
  createdBy: string;
  validatedAt?: string;
  publishedAt?: string;
  publishedBy?: string;
  supersedesRevisionId?: string;
  rollbackOfRevisionId?: string;
  changeReason?: string;
}

export interface ConfigurationWriteGuard {
  tenantId: string;
  resourceType: string;
  resourceId: string;
  expectedVersion: number;
  idempotencyKey: string;
}

export interface PublishedConfigurationPointer {
  tenantId: string;
  resourceType: string;
  resourceId: string;
  revisionId: string;
  version: number;
  publishedAt: string;
}

/**
 * Enterprise configuration changes use optimistic concurrency: stale writers are rejected,
 * publication points to an immutable validated revision, and rollback publishes a known prior
 * revision rather than trying to reconstruct old state from mutable documents.
 */
export interface ConfigurationPublishRequest {
  revisionId: string;
  expectedPublishedVersion: number;
  actorId: string;
  reason?: string;
}

// ==========================================
// STOREFRONT NETWORKS & MARKETPLACES
// ==========================================

export type StorefrontNetworkMode = 'SINGLE_TENANT' | 'MULTI_TENANT_MARKETPLACE' | 'BRAND_GROUP';

export interface StorefrontNetworkMember {
  tenantId: string;
  enabled: boolean;
  displayNameOverride?: string;
  sortOrder?: number;
  /** Optional group/operating-company label while preserving the underlying consumer brand. */
  operatorLabel?: string;
  locationGroupIds?: string[];
}

export interface StorefrontNetwork {
  networkId: string;
  name: string;
  mode: StorefrontNetworkMode;
  enabled: boolean;
  /** Membership is an explicit allow-list: tenants not listed never appear in this storefront. */
  members: StorefrontNetworkMember[];
  defaultTenantId?: string;
  /** Network presentation can be independent from each member tenant's own white-label storefront. */
  brandingProfileId?: string;
  loyaltyProfileId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StorefrontNetworkContext {
  networkId: string;
  selectedTenantId?: string;
  eligibleTenantIds: string[];
  /** Orders remain tenant-owned even when discovery starts in a shared marketplace. */
  orderTenantId?: string;
}

/**
 * A network is a discovery/presentation boundary, not a replacement tenancy model.
 * Configuration, permissions, order ownership, refunds, risk, residency and audit remain
 * scoped to the selected member tenant unless an explicit cross-tenant capability says otherwise.
 */
export interface NetworkCapabilityPolicy {
  networkId: string;
  sharedCustomerIdentity: boolean;
  sharedLoyalty: boolean;
  sharedBasket: boolean;
  crossTenantCheckout: boolean;
  sharedCustomerCare: boolean;
}

// ==========================================
// DATA RESIDENCY & REGIONAL FAILOVER
// ==========================================

export interface DataResidencyPolicy {
  tenantId: string;
  /** Logical home region chosen by retailer policy, contract or applicable law. */
  primaryRegion: string;
  /** Regions that may process/store regulated customer data during normal operation. */
  approvedRegions: string[];
  /** Explicit disaster-recovery/failover destinations; never route outside this allow-list. */
  failoverRegions: string[];
  /** Data classes covered by the residency boundary. */
  protectedDataClasses: Array<'CUSTOMER_PII' | 'ORDER_PII' | 'PAYMENT_REFERENCES' | 'CUSTOMER_CARE' | 'RISK_DATA'>;
  crossRegionFailoverEnabled: boolean;
  /** Maximum temporary residency after an approved failover before repatriation is due. */
  failoverResidencyTtlHours: number;
  /** Whether the tenant requires all protected data to return to its home region. */
  repatriationRequired: boolean;
}

export interface RegionalDataPlacement {
  tenantId: string;
  resourceType: string;
  resourceId: string;
  homeRegion: string;
  currentRegion: string;
  placementReason: 'PRIMARY' | 'FAILOVER';
  failedOverAt?: string;
  repatriateBy?: string;
  lastVerifiedAt: string;
}

export interface RegionalFailoverEvent {
  eventId: string;
  tenantId: string;
  fromRegion: string;
  toRegion: string;
  reasonCode: string;
  startedAt: string;
  recoveredAt?: string;
  status: 'ACTIVE' | 'REPATRIATION_PENDING' | 'REPATRIATED' | 'FAILED';
  affectedResourceIds?: string[];
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
