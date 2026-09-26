/**
 * Analytics Domain Models & Privacy-Preserving Event Architecture
 * Emits strictly de-identified domain events. Never records raw personal identifiers (PII),
 * raw payment credentials, exact street addresses, or precise GPS coordinates.
 */

export type FrontendAnalyticsEventType =
  | 'SESSION_STARTED'
  | 'BRAND_VIEW'
  | 'LOCATION_STARTED'
  | 'LOCATION_RESOLVED'
  | 'LOCATION_FAILED'
  | 'FULFILLMENT_SELECTED'
  | 'ELIGIBLE_STORES_RETURNED'
  | 'NO_DELIVERY_AVAILABLE'
  | 'STORE_LIST_VIEW'
  | 'STORE_SELECTED'
  | 'BROWSE_NEARBY_SELECTED'
  | 'ENTRY_STORIES_STARTED'
  | 'NO_SERVICEABLE_STORE'
  | 'CATEGORY_VIEW'
  | 'PRODUCT_VIEW'
  | 'STORY_IMPRESSION'
  | 'STORY_OPEN'
  | 'STORY_PRODUCT_CLICK'
  | 'SEARCH'
  | 'SEARCH_NO_RESULTS'
  | 'SEARCH_RESULT_CLICK'
  | 'ADD_TO_BASKET'
  | 'REMOVE_FROM_BASKET'
  | 'CHECKOUT_STARTED'
  | 'ORDER_SUBMITTED'
  | 'BACK_IN_STOCK_INTEREST'
  | 'BASKET_ABANDONED'
  | 'BASKET_VIEWED'
  | 'CATEGORY_BROWSED'
  | 'SEARCH_PERFORMED'
  | 'ARTIE_RECOMMENDATION_PRESENTED'
  | 'ARTIE_RECOMMENDATION_ACCEPTED';

export type BackendAnalyticsEventType =
  | 'ORDER_ACCEPTED'
  | 'PICKING_STARTED'
  | 'ITEM_PICKED'
  | 'ITEM_SUBSTITUTED'
  | 'ITEM_REMOVED'
  | 'ITEM_QUANTITY_AMENDED'
  | 'PICKING_COMPLETE'
  | 'PAYMENT_CAPTURED'
  | 'COURIER_ASSIGNED'
  | 'ORDER_DELIVERED'
  | 'ORDER_CANCELLED'
  | 'ARTIE_RECOMMENDATION_PAID';

export type AnalyticsEventType = FrontendAnalyticsEventType | BackendAnalyticsEventType;

export const AnalyticsEventType = {
  SESSION_STARTED: 'SESSION_STARTED',
  BRAND_VIEW: 'BRAND_VIEW',
  LOCATION_STARTED: 'LOCATION_STARTED',
  LOCATION_RESOLVED: 'LOCATION_RESOLVED',
  LOCATION_FAILED: 'LOCATION_FAILED',
  FULFILLMENT_SELECTED: 'FULFILLMENT_SELECTED',
  ELIGIBLE_STORES_RETURNED: 'ELIGIBLE_STORES_RETURNED',
  NO_DELIVERY_AVAILABLE: 'NO_DELIVERY_AVAILABLE',
  STORE_LIST_VIEW: 'STORE_LIST_VIEW',
  STORE_SELECTED: 'STORE_SELECTED',
  BROWSE_NEARBY_SELECTED: 'BROWSE_NEARBY_SELECTED',
  ENTRY_STORIES_STARTED: 'ENTRY_STORIES_STARTED',
  NO_SERVICEABLE_STORE: 'NO_SERVICEABLE_STORE',
  CATEGORY_VIEW: 'CATEGORY_VIEW',
  PRODUCT_VIEW: 'PRODUCT_VIEW',
  STORY_IMPRESSION: 'STORY_IMPRESSION',
  STORY_OPEN: 'STORY_OPEN',
  STORY_PRODUCT_CLICK: 'STORY_PRODUCT_CLICK',
  SEARCH: 'SEARCH',
  SEARCH_NO_RESULTS: 'SEARCH_NO_RESULTS',
  SEARCH_RESULT_CLICK: 'SEARCH_RESULT_CLICK',
  ADD_TO_BASKET: 'ADD_TO_BASKET',
  REMOVE_FROM_BASKET: 'REMOVE_FROM_BASKET',
  CHECKOUT_STARTED: 'CHECKOUT_STARTED',
  ORDER_SUBMITTED: 'ORDER_SUBMITTED',
  BACK_IN_STOCK_INTEREST: 'BACK_IN_STOCK_INTEREST',
  BASKET_ABANDONED: 'BASKET_ABANDONED',
  BASKET_VIEWED: 'BASKET_VIEWED',
  CATEGORY_BROWSED: 'CATEGORY_BROWSED',
  SEARCH_PERFORMED: 'SEARCH_PERFORMED',
  ARTIE_RECOMMENDATION_PRESENTED: 'ARTIE_RECOMMENDATION_PRESENTED',
  ARTIE_RECOMMENDATION_ACCEPTED: 'ARTIE_RECOMMENDATION_ACCEPTED',
  ORDER_ACCEPTED: 'ORDER_ACCEPTED',
  PICKING_STARTED: 'PICKING_STARTED',
  ITEM_PICKED: 'ITEM_PICKED',
  ITEM_SUBSTITUTED: 'ITEM_SUBSTITUTED',
  ITEM_REMOVED: 'ITEM_REMOVED',
  ITEM_QUANTITY_AMENDED: 'ITEM_QUANTITY_AMENDED',
  PICKING_COMPLETE: 'PICKING_COMPLETE',
  PAYMENT_CAPTURED: 'PAYMENT_CAPTURED',
  COURIER_ASSIGNED: 'COURIER_ASSIGNED',
  ORDER_DELIVERED: 'ORDER_DELIVERED',
  ORDER_CANCELLED: 'ORDER_CANCELLED',
  ARTIE_RECOMMENDATION_PAID: 'ARTIE_RECOMMENDATION_PAID',
} as const;

/**
 * Strictly de-identified event payload.
 */
export interface AnalyticsEvent {
  id: string;
  type: AnalyticsEventType;
  tenantId: string;
  sessionId: string;
  anonymousVisitorId?: string; // Optional: true anonymous browsing does not track across sessions
  storeId?: string;
  productPlu?: string;
  categoryId?: string;
  storyId?: string;
  searchTerm?: string;
  coarseRegion?: string; // e.g. "Essex", "London East", "CM1", coarse cell
  orderReferenceHash?: string; // Anonymized 1-way hash of order reference
  timestamp: string;
  locale: string;
  platform: 'web' | 'mobile_web' | 'ios_app' | 'android_app';
  properties?: Record<string, string | number | boolean | undefined>;
}

// ============================================
// ADMIN INSIGHTS AGGREGATE MODELS
// ============================================

export interface FunnelStageMetric {
  stage:
    | 'brand_store_landing'
    | 'product_view'
    | 'add_to_basket'
    | 'checkout'
    | 'order_submitted'
    | 'payment_captured'
    | 'delivered';
  label: string;
  visitors: number;
  conversionFromPrevious: number; // percentage (0-100)
  overallConversion: number; // percentage (0-100)
  dropoffRate: number; // percentage (0-100)
}

export interface ProductPerformanceMetric {
  plu: string;
  name: string | null;
  category: string | null;
  impressions: number | null;
  productViews: number;
  addToBasketCount: number | null;
  ordersCount: number | null;
  conversionRate: number | null; // percentage when product-view evidence exists
  revenue: number | null;
  outOfStockImpressions: number | null;
  questRemovals: number;
  questSubstitutions: number;
  quantityReductions: number;
  pickSuccessRate: number | null; // percentage when picking outcome evidence exists
  estimatedLostRevenue: number | null;
}

export interface StoryPerformanceMetric {
  storyId: string;
  title: string | null;
  tag?: string;
  impressions: number;
  uniqueViewers: number | null;
  opens: number;
  productClicks: number;
  addToBaskets: number | null;
  orders: number | null;
  capturedSales: number | null;
  directConversionRate: number | null; // Requires paid story-attribution evidence
  assistedConversionRate: number | null; // Requires paid assisted-attribution evidence
}

export interface SearchQueryMetric {
  query: string;
  frequency: number;
  resultsCount: number | null;
  resultClicks: number;
  addToBasketCount: number | null;
  conversionRate: number; // Result click-through rate; not purchase conversion
  noResult: boolean;
}

export interface RegionalMetric {
  country: string | null;
  region: string; // Observed coarse-region value; do not infer a city/country from it
  city: string | null;
  postcodeDistrict: string | null;
  sessions: number;
  serviceabilityRate: number | null; // % when serviceability checks exist
  noServiceableStoreRate: number | null;
  conversionRate: number | null;
  ordersCount: number | null;
  revenue: number | null;
}

export interface AbandonedBasketMetric {
  abandonedCount: number;
  recoveredCount: number | null;
  recoveryRate: number | null;
  averageAbandonedValue: number | null;
  topAbandonedPlus: Array<{ plu: string; name: string; frequency: number }>;
}

export interface ArtieRecommendationMetric {
  presented: number;
  accepted: number;
  paid: number;
  presentedToAcceptedRate: number | null;
  presentedToPaidRate: number | null;
  acceptedToPaidRate: number | null;
  attributedRevenue: number;
}

export interface InsightsEvidence {
  source: 'analytics_events';
  status: 'AVAILABLE' | 'EMPTY';
  observedAt: string | null;
  eventCount: number;
  serviceabilityChecks: number;
  pickingOutcomeEvents: number;
  searchEvents: number;
  recommendationChains: number;
  financialSource: 'payment_captured_events';
  financialCaptureEvents: number;
  financialAmountEvents: number;
  financialCurrency: string | null;
  financialStatus: 'NO_CAPTURE_EVIDENCE' | 'AVAILABLE' | 'PARTIAL' | 'MIXED_CURRENCY';
}

export interface InsightsDashboardData {
  timeframe: '7d' | '30d' | '90d';
  totalSessions: number;
  activeStoresCount: number;
  totalOrders: number | null;
  totalGrossMerchandiseValue: number | null;
  averageOrderValue: number | null;
  overallConversionRate: number | null;
  serviceabilityRate: number | null;
  pickingSuccessRate: number | null;
  funnel: FunnelStageMetric[];
  products: ProductPerformanceMetric[];
  stories: StoryPerformanceMetric[];
  searches: SearchQueryMetric[];
  regions: RegionalMetric[];
  abandonedBasket: AbandonedBasketMetric[];
  artieRecommendations: ArtieRecommendationMetric;
  evidence: InsightsEvidence;
}
