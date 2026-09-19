/**
 * Analytics Provider Boundary
 * 
 * Section 38: Real analytics event pipeline.
 * Dispatches events through AnalyticsClient interface.
 * When in DEMO mode, uses DemoAnalyticsClient.
 * When in STAGING or PRODUCTION, uses HttpAnalyticsClient (sending events to /api/v1/analytics/events).
 */

import { AnalyticsClient, TrackEventParams } from './AnalyticsClient';
import { AnalyticsEvent, AnalyticsEventType, InsightsDashboardData } from './analyticsModels';
import { MockAnalyticsClient } from './MockAnalyticsClient';
import { HttpAnalyticsClient } from './HttpAnalyticsClient';
import { getRuntimeMode } from '../domain/runtime';

export * from './AnalyticsClient';
export * from './analyticsModels';
export { MockAnalyticsClient, MockAnalyticsClient as DemoAnalyticsClient } from './MockAnalyticsClient';
export { HttpAnalyticsClient } from './HttpAnalyticsClient';

class DelegatingAnalyticsClient implements AnalyticsClient {
  private demoClient: MockAnalyticsClient | null = null;
  private httpClient: HttpAnalyticsClient | null = null;
  private currentTenantId = 'brand-alpha';
  private currentLocale = 'en-GB';
  private currentCoarseRegion?: string;

  private getActiveClient(): AnalyticsClient {
    const mode = getRuntimeMode();
    if (mode === 'DEMO') {
      if (!this.demoClient) {
        this.demoClient = new MockAnalyticsClient(this.currentTenantId, this.currentLocale);
        if (this.currentCoarseRegion) {
          this.demoClient.setCoarseRegion(this.currentCoarseRegion);
        }
      }
      return this.demoClient;
    }

    if (!this.httpClient) {
      this.httpClient = new HttpAnalyticsClient(this.currentTenantId, this.currentLocale);
      if (this.currentCoarseRegion) {
        this.httpClient.setCoarseRegion(this.currentCoarseRegion);
      }
    }
    return this.httpClient;
  }

  track(params: TrackEventParams): void {
    this.getActiveClient().track(params);
  }

  setContext(tenantId: string, locale: string): void {
    this.currentTenantId = tenantId;
    this.currentLocale = locale;
    if (this.demoClient) this.demoClient.setContext(tenantId, locale);
    if (this.httpClient) this.httpClient.setContext(tenantId, locale);
  }

  setCoarseRegion(coarseRegion: string): void {
    this.currentCoarseRegion = coarseRegion;
    if (this.demoClient) this.demoClient.setCoarseRegion(coarseRegion);
    if (this.httpClient) this.httpClient.setCoarseRegion(coarseRegion);
  }

  async getInsights(tenantId: string, timeframe?: '7d' | '30d' | '90d'): Promise<InsightsDashboardData> {
    return this.getActiveClient().getInsights(tenantId, timeframe);
  }

  async getRecentEvents(tenantId: string, limit?: number): Promise<AnalyticsEvent[]> {
    return this.getActiveClient().getRecentEvents(tenantId, limit);
  }
}

export const defaultAnalyticsClient: AnalyticsClient = new DelegatingAnalyticsClient();

export function getAnalyticsClient(): AnalyticsClient {
  return defaultAnalyticsClient;
}
