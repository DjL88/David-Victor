import { AnalyticsClient, TrackEventParams } from './AnalyticsClient';
import { AnalyticsEvent, InsightsDashboardData } from './analyticsModels';
import { getAdminAuthorizationHeader } from '../commerce/HttpAdminClient';

export class HttpAnalyticsClient implements AnalyticsClient {
  private tenantId: string = 'brand-alpha';
  private locale: string = 'en-GB';
  private coarseRegion?: string;
  private sessionId: string;
  private queue: Array<Partial<AnalyticsEvent>> = [];
  private flushTimer: any = null;

  constructor(tenantId: string = 'brand-alpha', locale: string = 'en-GB') {
    this.tenantId = tenantId;
    this.locale = locale;
    this.sessionId = this.getOrCreateSessionId();
  }

  private getOrCreateSessionId(): string {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        let sid = sessionStorage.getItem('__pa_sid');
        if (!sid) {
          sid = `ses_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          sessionStorage.setItem('__pa_sid', sid);
        }
        return sid;
      }
    } catch {
      // Fallback
    }
    return `ses_${Date.now()}`;
  }

  setContext(tenantId: string, locale: string): void {
    this.tenantId = tenantId;
    this.locale = locale;
  }

  setCoarseRegion(coarseRegion: string): void {
    this.coarseRegion = coarseRegion;
  }

  track(params: TrackEventParams): void {
    const event: Partial<AnalyticsEvent> = {
      type: params.type,
      tenantId: this.tenantId,
      sessionId: this.sessionId,
      storeId: params.storeId,
      productPlu: params.productPlu,
      categoryId: params.categoryId,
      storyId: params.storyId,
      searchTerm: params.searchTerm,
      coarseRegion: params.coarseRegion || this.coarseRegion,
      orderReferenceHash: params.orderReferenceHash,
      locale: this.locale,
      timestamp: new Date().toISOString(),
      properties: params.properties,
    };

    this.queue.push(event);
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flushQueue();
    }, 200);
  }

  private async flushQueue(): Promise<void> {
    if (this.queue.length === 0) return;
    const batch = [...this.queue];
    this.queue = [];

    try {
      if (batch.length === 1) {
        await fetch('/api/v1/analytics/events', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': this.tenantId,
          },
          body: JSON.stringify(batch[0]),
        });
      } else {
        await fetch('/api/v1/analytics/events/batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': this.tenantId,
          },
          body: JSON.stringify({ events: batch }),
        });
      }
    } catch (err) {
      console.warn('[HttpAnalyticsClient] Failed to flush events to BFF:', err);
    }
  }

  async getInsights(
    tenantId: string,
    timeframe: '7d' | '30d' | '90d' = '30d'
  ): Promise<InsightsDashboardData> {
    const headers: Record<string, string> = {
      'x-tenant-id': tenantId,
    };
    const authHeader = await getAdminAuthorizationHeader();
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const res = await fetch(`/api/v1/analytics/insights?timeframe=${timeframe}`, {
      headers,
    });
    if (!res.ok) {
      throw new Error(`Insights request failed with status ${res.status}`);
    }
    return await res.json();
  }

  async getRecentEvents(tenantId: string, limit: number = 50): Promise<AnalyticsEvent[]> {
    const headers: Record<string, string> = {
      'x-tenant-id': tenantId,
    };
    const authHeader = await getAdminAuthorizationHeader();
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const res = await fetch(`/api/v1/analytics/events?limit=${limit}`, { headers });
    if (!res.ok) {
      throw new Error(`Analytics events request failed with status ${res.status}`);
    }
    return await res.json();
  }
}
