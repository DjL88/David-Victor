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
  | 'SEARCH_PERFORMED';

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
  | 'ORDER_CANCELLED';

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
  name: string;
  category: string;
  impressions: number;
  productViews: number;
  addToBasketCount: number;
  ordersCount: number;
  conversionRate: number; // percentage
  revenue: number;
  outOfStockImpressions: number;
  questRemovals: number;
  questSubstitutions: number;
  quantityReductions: number;
  pickSuccessRate: number; // percentage e.g. 96.4%
  estimatedLostRevenue: number;
}

export interface StoryPerformanceMetric {
  storyId: string;
  title: string;
  tag?: string;
  impressions: number;
  uniqueViewers?: number;
  opens: number;
  productClicks: number;
  addToBaskets: number;
  orders: number;
  capturedSales: number;
  directConversionRate: number; // Purchased directly through story CTA
  assistedConversionRate: number; // Viewed story, completed purchase later in session
}

export interface SearchQueryMetric {
  query: string;
  frequency: number;
  resultsCount: number;
  resultClicks: number;
  addToBasketCount: number;
  conversionRate: number;
  noResult: boolean;
}

export interface RegionalMetric {
  country: string;
  region: string; // Coarse administrative region e.g. "Essex", "Greater London"
  city: string;
  postcodeDistrict: string; // e.g. "CM1", "CM2", "E1"
  sessions: number;
  serviceabilityRate: number; // % of sessions that found a serviceable store
  noServiceableStoreRate: number;
  conversionRate: number;
  ordersCount: number;
  revenue: number;
}

export interface AbandonedBasketMetric {
  abandonedCount: number;
  recoveredCount: number;
  recoveryRate: number;
  averageAbandonedValue: number;
  topAbandonedPlus: Array<{ plu: string; name: string; frequency: number }>;
}

export interface InsightsDashboardData {
  timeframe: '7d' | '30d' | '90d';
  totalSessions: number;
  activeStoresCount: number;
  totalOrders: number;
  totalGrossMerchandiseValue: number;
  averageOrderValue: number;
  overallConversionRate: number;
  serviceabilityRate: number;
  pickingSuccessRate: number;
  funnel: FunnelStageMetric[];
  products: ProductPerformanceMetric[];
  stories: StoryPerformanceMetric[];
  searches: SearchQueryMetric[];
  regions: RegionalMetric[];
  abandonedBasket: AbandonedBasketMetric[];
}
