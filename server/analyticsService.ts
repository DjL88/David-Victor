import { randomUUID } from 'crypto';
import { AnalyticsEvent, AnalyticsEventType, InsightsDashboardData, FunnelStageMetric, ProductPerformanceMetric, StoryPerformanceMetric, SearchQueryMetric, RegionalMetric, AbandonedBasketMetric } from '../src/analytics/analyticsModels';
import { FirestorePlatformService } from './firestoreService';
import { BFFError } from './errors';

const SERVER_ONLY_EVENT_TYPES = new Set<AnalyticsEventType>([
  'ORDER_ACCEPTED',
  'PICKING_STARTED',
  'ITEM_PICKED',
  'ITEM_SUBSTITUTED',
  'ITEM_REMOVED',
  'ITEM_QUANTITY_AMENDED',
  'PICKING_COMPLETE',
  'PAYMENT_CAPTURED',
  'COURIER_ASSIGNED',
  'ORDER_DELIVERED',
  'ORDER_CANCELLED',
  'ARTIE_RECOMMENDATION_PAID',
]);

/**
 * PII and Payment Credential scrubbing patterns (Section 38 & 39).
 * Absolutely no raw email, phone, street address, payment token, PAN/CVC, or precise coordinates.
 */
const FORBIDDEN_PROPERTY_PATTERNS = [
  /email/i,
  /phone/i,
  /mobile/i,
  /tel/i,
  /name/i,
  /firstname/i,
  /lastname/i,
  /address/i,
  /street/i,
  /postcode_exact/i,
  /full_address/i,
  /card/i,
  /pan/i,
  /cvv/i,
  /cvc/i,
  /token/i,
  /secret/i,
  /password/i,
  /auth_header/i,
  /latitude/i,
  /longitude/i,
  /lat/i,
  /lng/i,
  /gps/i,
  /coords/i,
];

export class AnalyticsService {
  private static assertClientEvent(rawEvent: Partial<AnalyticsEvent>): void {
    const type = (rawEvent.type || 'SESSION_STARTED') as AnalyticsEventType;
    if (SERVER_ONLY_EVENT_TYPES.has(type)) {
      throw new BFFError(
        'VALIDATION_ERROR',
        'This analytics event may only be recorded by the server.',
        400
      );
    }
    if (
      rawEvent.properties &&
      Object.prototype.hasOwnProperty.call(rawEvent.properties, 'attributedRevenue')
    ) {
      throw new BFFError(
        'VALIDATION_ERROR',
        'Attributed revenue may only be recorded after a server-verified payment.',
        400
      );
    }
  }

  static async trackClientEvent(
    tenantId: string,
    rawEvent: Partial<AnalyticsEvent>
  ): Promise<AnalyticsEvent> {
    this.assertClientEvent(rawEvent);
    return this.trackEvent(tenantId, rawEvent);
  }

  static async trackClientEventsBatch(
    tenantId: string,
    rawEvents: Partial<AnalyticsEvent>[]
  ): Promise<AnalyticsEvent[]> {
    rawEvents.forEach((event) => this.assertClientEvent(event));
    return this.trackEventsBatch(tenantId, rawEvents);
  }

  /**
   * Sanitizes and scrubs an analytics event before persistence.
   * Enforces Section 38 rules:
   * - no raw delivery address
   * - no raw email/phone
   * - no payment token / PAN / CVC
   * - avoid precise raw GPS (extract coarse outcode only)
   * - pseudonymous session/user IDs
   */
  static sanitizeEvent(
    tenantId: string,
    rawEvent: Partial<AnalyticsEvent>
  ): AnalyticsEvent {
    // The trusted server boundary owns Firestore document identities. A
    // browser-supplied id must never overwrite another tenant's record.
    const eventId = `evt_${Date.now()}_${randomUUID()}`;
    const timestamp = rawEvent.timestamp || new Date().toISOString();
    const type = (rawEvent.type || 'SESSION_STARTED') as AnalyticsEventType;

    // Coarse region only - strip any exact addresses or coordinates
    let coarseRegion = rawEvent.coarseRegion;
    if (coarseRegion && /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(coarseRegion)) {
      // If a full UK postcode was passed, truncate to outcode (e.g., 'CM1 2BN' -> 'CM1')
      coarseRegion = coarseRegion.split(' ')[0].trim().toUpperCase();
    }

    // Sanitize properties object
    const sanitizedProps: Record<string, string | number | boolean | undefined> = {};
    if (rawEvent.properties && typeof rawEvent.properties === 'object') {
      for (const [key, value] of Object.entries(rawEvent.properties)) {
        const isForbidden = FORBIDDEN_PROPERTY_PATTERNS.some((pattern) => pattern.test(key));
        if (!isForbidden && value !== undefined && value !== null) {
          // Check if value looks like an email or phone
          if (typeof value === 'string') {
            if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
              // Strip email
              continue;
            }
            if (/^\+?[0-9\s\-()]{7,20}$/.test(value)) {
              // Strip phone
              continue;
            }
          }
          sanitizedProps[key] = value;
        }
      }
    }

    return {
      id: eventId,
      type,
      tenantId,
      sessionId: rawEvent.sessionId || `ses_anon_${Date.now()}`,
      anonymousVisitorId: rawEvent.anonymousVisitorId,
      storeId: rawEvent.storeId,
      productPlu: rawEvent.productPlu,
      categoryId: rawEvent.categoryId,
      storyId: rawEvent.storyId,
      searchTerm: rawEvent.searchTerm ? rawEvent.searchTerm.trim().toLowerCase().slice(0, 100) : undefined,
      coarseRegion,
      orderReferenceHash: rawEvent.orderReferenceHash,
      timestamp,
      locale: rawEvent.locale || 'en-GB',
      platform: rawEvent.platform || 'web',
      properties: Object.keys(sanitizedProps).length > 0 ? sanitizedProps : undefined,
    };
  }

  private static eventBuffer: AnalyticsEvent[] = [];
  private static flushTimer: NodeJS.Timeout | null = null;
  private static readonly BUFFER_MAX_SIZE = 50;
  private static readonly BUFFER_FLUSH_INTERVAL_MS = 500;

  /**
   * Records a sanitized analytics domain event.
   */
  static async trackEvent(
    tenantId: string,
    rawEvent: Partial<AnalyticsEvent>
  ): Promise<AnalyticsEvent> {
    const sanitized = this.sanitizeEvent(tenantId, rawEvent);
    await FirestorePlatformService.saveAnalyticsEvent(sanitized);
    return sanitized;
  }

  /**
   * High-throughput batch tracking for ingestion of multiple events.
   */
  static async trackEventsBatch(
    tenantId: string,
    rawEvents: Partial<AnalyticsEvent>[]
  ): Promise<AnalyticsEvent[]> {
    const sanitized = rawEvents.map((e) => this.sanitizeEvent(tenantId, e));
    await FirestorePlatformService.saveAnalyticsEventsBatch(sanitized);
    return sanitized;
  }

  /**
   * Non-blocking queue ingestion for high-throughput client beacons.
   * Flushes every 500ms or when buffer reaches 50 events.
   */
  static enqueueEvent(tenantId: string, rawEvent: Partial<AnalyticsEvent>): AnalyticsEvent {
    const sanitized = this.sanitizeEvent(tenantId, rawEvent);
    this.eventBuffer.push(sanitized);

    if (this.eventBuffer.length >= this.BUFFER_MAX_SIZE) {
      this.flushBuffer().catch((err) => {
        console.warn('[AnalyticsService] Failed to flush event buffer:', err);
      });
    } else if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null;
        this.flushBuffer().catch((err) => {
          console.warn('[AnalyticsService] Failed to flush event buffer on timer:', err);
        });
      }, this.BUFFER_FLUSH_INTERVAL_MS);
      this.flushTimer.unref();
    }

    return sanitized;
  }

  /**
   * Flushes pending buffered events immediately to Firestore.
   */
  static async flushBuffer(): Promise<number> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.eventBuffer.length === 0) {
      return 0;
    }

    const eventsToFlush = [...this.eventBuffer];
    this.eventBuffer = [];

    await FirestorePlatformService.saveAnalyticsEventsBatch(eventsToFlush);
    return eventsToFlush.length;
  }

  /**
   * Computes genuine analytics insights from ingested events.
   * Section 38: "Analytics values must come from actual events. Empty analytics = 'No data yet.' No fake metrics."
   */
  static async getInsights(
    tenantId: string,
    timeframe: '7d' | '30d' | '90d' = '30d'
  ): Promise<InsightsDashboardData> {
    const events = await FirestorePlatformService.getAnalyticsEvents(tenantId, 5000);

    // Filter by timeframe
    const now = Date.now();
    const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90;
    const cutoff = now - days * 24 * 60 * 60 * 1000;

    const filteredEvents = events.filter((e) => {
      const t = new Date(e.timestamp).getTime();
      return !isNaN(t) && t >= cutoff;
    });

    if (filteredEvents.length === 0) {
      // Genuine empty state - "No data yet"
      return {
        timeframe,
        totalSessions: 0,
        activeStoresCount: 0,
        totalOrders: null,
        totalGrossMerchandiseValue: null,
        averageOrderValue: null,
        overallConversionRate: null,
        serviceabilityRate: null,
        pickingSuccessRate: null,
        funnel: [],
        products: [],
        stories: [],
        searches: [],
        regions: [],
        abandonedBasket: [],
        artieRecommendations: { presented: 0, accepted: 0, paid: 0, presentedToAcceptedRate: null, presentedToPaidRate: null, acceptedToPaidRate: null, attributedRevenue: 0 },
        evidence: {
          source: 'analytics_events',
          status: 'EMPTY',
          observedAt: null,
          eventCount: 0,
          serviceabilityChecks: 0,
          pickingOutcomeEvents: 0,
          searchEvents: 0,
          recommendationChains: 0,
          financialSource: 'payment_captured_events',
          financialCaptureEvents: 0,
          financialAmountEvents: 0,
          financialCurrency: null,
          financialStatus: 'NO_CAPTURE_EVIDENCE',
        },
      };
    }

    // 1. Session and store counts
    const sessions = new Set<string>();
    const stores = new Set<string>();
    let totalGMV = 0;
    let financialCaptureEvents = 0;
    let financialAmountEvents = 0;
    const financialCurrencies = new Set<string>();
    const capturedOrderKeys = new Set<string>();
    let serviceableChecks = 0;
    let serviceableHits = 0;
    let pickingItems = 0;
    let pickingSubstitutions = 0;
    let pickingRemovals = 0;
    const recommendationEvidence = new Map<string, {
      presentedAt?: number;
      acceptedAt?: number;
      paidAt?: number;
      attributedRevenue: number;
    }>();

    const funnelCounts: Record<string, Set<string>> = {
      brand_store_landing: new Set(),
      product_view: new Set(),
      add_to_basket: new Set(),
      checkout: new Set(),
      order_submitted: new Set(),
      payment_captured: new Set(),
      delivered: new Set(),
    };

    const productMap = new Map<string, { views: number; adds: number; orders: number; revenue: number; picked: number; substitutions: number; removals: number; quantityReductions: number }>();
    const storyMap = new Map<string, { impressions: number; opens: number; clicks: number; adds: number; orders: number; revenue: number }>();
    const searchMap = new Map<string, { count: number; clicks: number; adds: number; noResult: boolean }>();
    const regionMap = new Map<string, { sessions: Set<string>; serviceableHits: number; totalChecks: number }>();

    for (const e of filteredEvents) {
      if (e.sessionId) sessions.add(e.sessionId);
      if (e.storeId) stores.add(e.storeId);

      // Funnel mapping by session
      switch (e.type) {
        case 'SESSION_STARTED':
        case 'BRAND_VIEW':
        case 'LOCATION_RESOLVED':
        case 'STORE_SELECTED':
          funnelCounts.brand_store_landing.add(e.sessionId);
          break;
        case 'PRODUCT_VIEW':
          funnelCounts.product_view.add(e.sessionId);
          if (e.productPlu) {
            const p = productMap.get(e.productPlu) || { views: 0, adds: 0, orders: 0, revenue: 0, picked: 0, substitutions: 0, removals: 0, quantityReductions: 0 };
            p.views++;
            productMap.set(e.productPlu, p);
          }
          break;
        case 'ADD_TO_BASKET':
          funnelCounts.add_to_basket.add(e.sessionId);
          if (e.productPlu) {
            const p = productMap.get(e.productPlu) || { views: 0, adds: 0, orders: 0, revenue: 0, picked: 0, substitutions: 0, removals: 0, quantityReductions: 0 };
            p.adds++;
            productMap.set(e.productPlu, p);
          }
          break;
        case 'CHECKOUT_STARTED':
          funnelCounts.checkout.add(e.sessionId);
          break;
        case 'ORDER_SUBMITTED':
          funnelCounts.order_submitted.add(e.sessionId);
          break;
        case 'PAYMENT_CAPTURED': {
          funnelCounts.payment_captured.add(e.sessionId);
          const captureKey = e.orderReferenceHash || e.id;
          if (!capturedOrderKeys.has(captureKey)) {
            capturedOrderKeys.add(captureKey);
            financialCaptureEvents++;
            const amount = e.properties?.totalAmount;
            const currency = typeof e.properties?.currency === 'string'
              ? e.properties.currency.trim().toUpperCase()
              : '';
            if (typeof amount === 'number' && Number.isFinite(amount) && amount >= 0) {
              financialAmountEvents++;
              totalGMV += amount;
            }
            if (currency) financialCurrencies.add(currency);
          }
          break;
        }
        case 'ORDER_ACCEPTED':
          break;
        case 'ORDER_DELIVERED':
          funnelCounts.delivered.add(e.sessionId);
          break;
        case 'ELIGIBLE_STORES_RETURNED':
          serviceableChecks++;
          serviceableHits++;
          break;
        case 'NO_DELIVERY_AVAILABLE':
        case 'NO_SERVICEABLE_STORE':
          serviceableChecks++;
          break;
        case 'ITEM_PICKED':
          pickingItems++;
          if (e.productPlu) {
            const p = productMap.get(e.productPlu) || { views: 0, adds: 0, orders: 0, revenue: 0, picked: 0, substitutions: 0, removals: 0, quantityReductions: 0 };
            p.picked++;
            productMap.set(e.productPlu, p);
          }
          break;
        case 'ITEM_SUBSTITUTED':
          pickingItems++;
          pickingSubstitutions++;
          if (e.productPlu) {
            const p = productMap.get(e.productPlu) || { views: 0, adds: 0, orders: 0, revenue: 0, picked: 0, substitutions: 0, removals: 0, quantityReductions: 0 };
            p.substitutions++;
            productMap.set(e.productPlu, p);
          }
          break;
        case 'ITEM_REMOVED':
          pickingItems++;
          pickingRemovals++;
          if (e.productPlu) {
            const p = productMap.get(e.productPlu) || { views: 0, adds: 0, orders: 0, revenue: 0, picked: 0, substitutions: 0, removals: 0, quantityReductions: 0 };
            p.removals++;
            productMap.set(e.productPlu, p);
          }
          break;
        case 'ITEM_QUANTITY_AMENDED':
          if (e.productPlu) {
            const p = productMap.get(e.productPlu) || { views: 0, adds: 0, orders: 0, revenue: 0, picked: 0, substitutions: 0, removals: 0, quantityReductions: 0 };
            p.quantityReductions++;
            productMap.set(e.productPlu, p);
          }
          break;
        case 'STORY_IMPRESSION':
          if (e.storyId) {
            const s = storyMap.get(e.storyId) || { impressions: 0, opens: 0, clicks: 0, adds: 0, orders: 0, revenue: 0 };
            s.impressions++;
            storyMap.set(e.storyId, s);
          }
          break;
        case 'STORY_OPEN':
          if (e.storyId) {
            const s = storyMap.get(e.storyId) || { impressions: 0, opens: 0, clicks: 0, adds: 0, orders: 0, revenue: 0 };
            s.opens++;
            storyMap.set(e.storyId, s);
          }
          break;
        case 'STORY_PRODUCT_CLICK':
          if (e.storyId) {
            const s = storyMap.get(e.storyId) || { impressions: 0, opens: 0, clicks: 0, adds: 0, orders: 0, revenue: 0 };
            s.clicks++;
            storyMap.set(e.storyId, s);
          }
          break;
        case 'SEARCH':
        case 'SEARCH_PERFORMED':
          if (e.searchTerm) {
            const query = e.searchTerm;
            const sm = searchMap.get(query) || { count: 0, clicks: 0, adds: 0, noResult: false };
            sm.count++;
            searchMap.set(query, sm);
          }
          break;
        case 'SEARCH_NO_RESULTS':
          if (e.searchTerm) {
            const query = e.searchTerm;
            const sm = searchMap.get(query) || { count: 0, clicks: 0, adds: 0, noResult: true };
            sm.count++;
            sm.noResult = true;
            searchMap.set(query, sm);
          }
          break;
        case 'ARTIE_RECOMMENDATION_PRESENTED': {
          const recommendationId = typeof e.properties?.recommendationId === 'string' ? e.properties.recommendationId.trim() : '';
          const eventAt = Date.parse(e.timestamp);
          if (recommendationId && Number.isFinite(eventAt)) {
            const current = recommendationEvidence.get(recommendationId) || { attributedRevenue: 0 };
            current.presentedAt = current.presentedAt === undefined ? eventAt : Math.min(current.presentedAt, eventAt);
            recommendationEvidence.set(recommendationId, current);
          }
          break;
        }
        case 'ARTIE_RECOMMENDATION_ACCEPTED': {
          const recommendationId = typeof e.properties?.recommendationId === 'string' ? e.properties.recommendationId.trim() : '';
          const eventAt = Date.parse(e.timestamp);
          if (recommendationId && Number.isFinite(eventAt)) {
            const current = recommendationEvidence.get(recommendationId) || { attributedRevenue: 0 };
            current.acceptedAt = current.acceptedAt === undefined ? eventAt : Math.min(current.acceptedAt, eventAt);
            recommendationEvidence.set(recommendationId, current);
          }
          break;
        }
        case 'ARTIE_RECOMMENDATION_PAID': {
          const recommendationId = typeof e.properties?.recommendationId === 'string' ? e.properties.recommendationId.trim() : '';
          const eventAt = Date.parse(e.timestamp);
          if (recommendationId && Number.isFinite(eventAt)) {
            const current = recommendationEvidence.get(recommendationId) || { attributedRevenue: 0 };
            if (current.paidAt === undefined || eventAt < current.paidAt) {
              current.paidAt = eventAt;
              current.attributedRevenue = typeof e.properties?.attributedRevenue === 'number'
                ? Math.max(0, e.properties.attributedRevenue)
                : 0;
            }
            recommendationEvidence.set(recommendationId, current);
          }
          break;
        }
        case 'SEARCH_RESULT_CLICK':
          if (e.searchTerm) {
            const query = e.searchTerm;
            const sm = searchMap.get(query) || { count: 0, clicks: 0, adds: 0, noResult: false };
            sm.clicks++;
            searchMap.set(query, sm);
          }
          break;
      }

      // Coarse region tracking
      if (e.coarseRegion) {
        const reg = regionMap.get(e.coarseRegion) || {
          sessions: new Set(),
          serviceableHits: 0,
          totalChecks: 0,
        };
        reg.sessions.add(e.sessionId);
        if (e.type === 'ELIGIBLE_STORES_RETURNED') {
          reg.serviceableHits++;
          reg.totalChecks++;
        } else if (e.type === 'NO_DELIVERY_AVAILABLE' || e.type === 'NO_SERVICEABLE_STORE') {
          reg.totalChecks++;
        }
        regionMap.set(e.coarseRegion, reg);
      }
    }

    let artiePresented = 0;
    let artieAccepted = 0;
    let artiePaid = 0;
    let artieAttributedRevenue = 0;
    for (const evidence of recommendationEvidence.values()) {
      if (evidence.presentedAt === undefined) continue;
      artiePresented++;
      const accepted = evidence.acceptedAt !== undefined && evidence.acceptedAt >= evidence.presentedAt;
      if (!accepted) continue;
      artieAccepted++;
      const paid = evidence.paidAt !== undefined && evidence.paidAt >= evidence.acceptedAt!;
      if (!paid) continue;
      artiePaid++;
      artieAttributedRevenue += evidence.attributedRevenue;
    }

    const totalSessionCount = sessions.size;
    const baseLanding = Math.max(funnelCounts.brand_store_landing.size, totalSessionCount);

    // Build funnel
    const stages: Array<{ stage: FunnelStageMetric['stage']; label: string; count: number }> = [
      { stage: 'brand_store_landing', label: 'Storefront Landing', count: baseLanding },
      { stage: 'product_view', label: 'Product Viewed', count: funnelCounts.product_view.size },
      { stage: 'add_to_basket', label: 'Added to Basket', count: funnelCounts.add_to_basket.size },
      { stage: 'checkout', label: 'Checkout Started', count: funnelCounts.checkout.size },
      { stage: 'order_submitted', label: 'Order Submitted', count: funnelCounts.order_submitted.size },
      { stage: 'payment_captured', label: 'Payment Captured', count: funnelCounts.payment_captured.size },
      { stage: 'delivered', label: 'Fulfilled / Delivered', count: funnelCounts.delivered.size },
    ];

    const funnel: FunnelStageMetric[] = stages.map((st, idx) => {
      const prevCount = idx === 0 ? baseLanding : stages[idx - 1].count || 1;
      const conversionFromPrevious = Math.min(100, Math.round((st.count / prevCount) * 1000) / 10);
      const overallConversion = Math.min(100, Math.round((st.count / baseLanding) * 1000) / 10);
      const dropoffRate = Math.max(0, Math.round((100 - conversionFromPrevious) * 10) / 10);
      return {
        stage: st.stage,
        label: st.label,
        visitors: st.count,
        conversionFromPrevious,
        overallConversion,
        dropoffRate,
      };
    });

    // Build product performance metrics
    const products: ProductPerformanceMetric[] = Array.from(productMap.entries()).map(([plu, stats]) => {
      const conversionRate = stats.views > 0 ? Math.round((stats.adds / stats.views) * 1000) / 10 : null;
      const pickingOutcomeCount = stats.picked + stats.substitutions + stats.removals;
      const pickSuccessRate = pickingOutcomeCount > 0
        ? Math.round((stats.picked / pickingOutcomeCount) * 1000) / 10
        : null;
      return {
        plu,
        name: null,
        category: null,
        impressions: null,
        productViews: stats.views,
        addToBasketCount: stats.adds,
        ordersCount: null,
        conversionRate,
        revenue: null,
        outOfStockImpressions: null,
        questRemovals: stats.removals,
        questSubstitutions: stats.substitutions,
        quantityReductions: stats.quantityReductions,
        pickSuccessRate,
        estimatedLostRevenue: null,
      };
    });

    // Build story metrics
    const stories: StoryPerformanceMetric[] = Array.from(storyMap.entries()).map(([storyId, stats]) => ({
      storyId,
      title: null,
      impressions: stats.impressions,
      uniqueViewers: null,
      opens: stats.opens,
      productClicks: stats.clicks,
      addToBaskets: null,
      orders: null,
      capturedSales: null,
      directConversionRate: null,
      assistedConversionRate: null,
    }));

    // Build searches
    const searches: SearchQueryMetric[] = Array.from(searchMap.entries()).map(([query, stats]) => ({
      query,
      frequency: stats.count,
      resultsCount: stats.noResult ? 0 : null,
      resultClicks: stats.clicks,
      addToBasketCount: null,
      conversionRate: stats.count > 0 ? Math.round((stats.clicks / stats.count) * 1000) / 10 : 0,
      noResult: stats.noResult,
    }));

    // Build regional breakdown
    const regions: RegionalMetric[] = Array.from(regionMap.entries()).map(([regionCode, stats]) => {
      const sRate = stats.totalChecks > 0 ? Math.round((stats.serviceableHits / stats.totalChecks) * 100) : null;
      const postcodeDistrict = /^[A-Z]{1,2}\d[A-Z\d]?$/i.test(regionCode) ? regionCode.toUpperCase() : null;
      return {
        country: null,
        region: regionCode,
        city: null,
        postcodeDistrict,
        sessions: stats.sessions.size,
        serviceabilityRate: sRate,
        noServiceableStoreRate: sRate === null ? null : 100 - sRate,
        conversionRate: null,
        ordersCount: null,
        revenue: null,
      };
    });

    const deliveredSessions = funnelCounts.delivered.size;
    const overallConversionRate = baseLanding > 0 ? Math.round((deliveredSessions / baseLanding) * 1000) / 10 : null;
    const serviceabilityRate = serviceableChecks > 0 ? Math.round((serviceableHits / serviceableChecks) * 100) : null;
    const pickingSuccessRate = pickingItems > 0
      ? Math.round(((pickingItems - (pickingSubstitutions + pickingRemovals)) / pickingItems) * 100)
      : null;

    // Basket abandonment is only counted from explicit abandonment events.
    // A basket session without a later order is not sufficient evidence that the
    // customer abandoned it, and recovery requires a dedicated attribution event.
    const explicitAbandonmentEvents = filteredEvents.filter((event) => event.type === 'BASKET_ABANDONED');
    const abandonedCount = new Set(explicitAbandonmentEvents.map((event) => event.sessionId)).size;
    const recoveredCount = null;
    const recoveryRate = null;

    const abandonedPluCounts = new Map<string, number>();
    for (const e of explicitAbandonmentEvents) {
      if (e.productPlu) {
        abandonedPluCounts.set(e.productPlu, (abandonedPluCounts.get(e.productPlu) || 0) + 1);
      }
    }

    const topAbandonedPlus = Array.from(abandonedPluCounts.entries())
      .map(([plu, frequency]) => {
        const prodMetric = products.find((p) => p.plu === plu);
        return {
          plu,
          name: prodMetric?.name || `Product (${plu})`,
          frequency,
        };
      })
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5);

    const abandonedBasket = [
      {
        abandonedCount,
        recoveredCount,
        recoveryRate,
        averageAbandonedValue: (() => {
          const values = filteredEvents
            .filter((event) => event.type === 'BASKET_ABANDONED')
            .map((event) => event.properties?.totalAmount)
            .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
          return values.length > 0 ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
        })(),
        topAbandonedPlus,
      },
    ];

    const financialCurrency =
      financialCurrencies.size === 1 ? Array.from(financialCurrencies)[0] : null;
    const financialStatus =
      financialCaptureEvents === 0
        ? 'NO_CAPTURE_EVIDENCE' as const
        : financialCurrencies.size > 1
          ? 'MIXED_CURRENCY' as const
          : financialAmountEvents !== financialCaptureEvents || !financialCurrency
            ? 'PARTIAL' as const
            : 'AVAILABLE' as const;
    const financialValuesAvailable = financialStatus === 'AVAILABLE';
    const totalOrders = financialCaptureEvents > 0 ? financialCaptureEvents : null;
    const grossMerchandiseValue = financialValuesAvailable ? totalGMV : null;

    return {
      timeframe,
      totalSessions: totalSessionCount,
      activeStoresCount: stores.size,
      totalOrders,
      totalGrossMerchandiseValue: grossMerchandiseValue,
      averageOrderValue: financialValuesAvailable && totalOrders
        ? Math.round(totalGMV / totalOrders)
        : null,
      overallConversionRate,
      serviceabilityRate,
      pickingSuccessRate,
      funnel,
      products,
      stories,
      searches,
      regions,
      abandonedBasket,
      artieRecommendations: {
        presented: artiePresented,
        accepted: artieAccepted,
        paid: artiePaid,
        presentedToAcceptedRate: artiePresented > 0 ? Math.round((artieAccepted / artiePresented) * 1000) / 10 : null,
        presentedToPaidRate: artiePresented > 0 ? Math.round((artiePaid / artiePresented) * 1000) / 10 : null,
        acceptedToPaidRate: artieAccepted > 0 ? Math.round((artiePaid / artieAccepted) * 1000) / 10 : null,
        attributedRevenue: artieAttributedRevenue,
      },
      evidence: {
        source: 'analytics_events',
        status: 'AVAILABLE',
        observedAt: filteredEvents.reduce<string | null>((latest, event) => !latest || event.timestamp > latest ? event.timestamp : latest, null),
        eventCount: filteredEvents.length,
        serviceabilityChecks: serviceableChecks,
        pickingOutcomeEvents: pickingItems,
        searchEvents: Array.from(searchMap.values()).reduce((sum, stats) => sum + stats.count, 0),
        recommendationChains: artiePaid,
        financialSource: 'payment_captured_events',
        financialCaptureEvents,
        financialAmountEvents,
        financialCurrency,
        financialStatus,
      },
    };
  }
}
