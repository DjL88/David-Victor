import { AnalyticsEvent, AnalyticsEventType, InsightsDashboardData } from './analyticsModels';

export interface TrackEventParams {
  type: AnalyticsEventType;
  storeId?: string;
  productPlu?: string;
  categoryId?: string;
  storyId?: string;
  searchTerm?: string;
  coarseRegion?: string;
  orderReferenceHash?: string;
  properties?: Record<string, string | number | boolean | undefined>;
}

export interface AnalyticsClient {
  /**
   * Emits a privacy-sanitized analytics domain event.
   */
  track(params: TrackEventParams): void;

  /**
   * Sets current tenant and locale context.
   */
  setContext(tenantId: string, locale: string): void;

  /**
   * Sets coarse location context (never exact coordinates).
   */
  setCoarseRegion(coarseRegion: string): void;

  /**
   * Retrieves aggregated insights for admin analytics views.
   */
  getInsights(tenantId: string, timeframe?: '7d' | '30d' | '90d'): Promise<InsightsDashboardData>;

  /**
   * Retrieves recent raw de-identified events for telemetry auditing.
   */
  getRecentEvents(tenantId: string, limit?: number): Promise<AnalyticsEvent[]>;
}
