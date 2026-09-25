import { AnalyticsClient, TrackEventParams } from './AnalyticsClient';
import { AnalyticsEvent, InsightsDashboardData } from './analyticsModels';

/**
 * Generates an in-memory session identifier that rotates per session
 * without persistent cross-device fingerprinting.
 */
function getOrCreateSessionId(): string {
  try {
    let sid = sessionStorage.getItem('__pa_sid');
    if (!sid) {
      sid = `ses_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      sessionStorage.setItem('__pa_sid', sid);
    }
    return sid;
  } catch {
    return `ses_${Date.now()}`;
  }
}

/**
 * Generates an optional anonymous visitor identifier stored in localStorage
 * if permitted by customer privacy mode.
 */
function getAnonymousVisitorId(): string | undefined {
  try {
    let vid = localStorage.getItem('__pa_vid');
    if (!vid) {
      vid = `anon_${Math.random().toString(36).substring(2, 11)}`;
      localStorage.setItem('__pa_vid', vid);
    }
    return vid;
  } catch {
    return undefined;
  }
}

/**
 * Forbidden PII and cardholder property keys that must NEVER enter analytics.
 */
const FORBIDDEN_PII_PATTERNS = [
  /email/i,
  /phone/i,
  /mobile/i,
  /name/i,
  /firstname/i,
  /lastname/i,
  /address/i,
  /postcode_exact/i,
  /street/i,
  /card/i,
  /cvv/i,
  /token/i,
  /secret/i,
  /password/i,
  /latitude/i,
  /longitude/i,
  /lat/i,
  /lng/i,
  /gps/i,
];

export class MockAnalyticsClient implements AnalyticsClient {
  private currentTenantId: string = 'brand-alpha';
  private currentLocale: string = 'en-GB';
  private currentCoarseRegion: string = 'Essex';
  private events: AnalyticsEvent[] = [];

  constructor(tenantId?: string, locale?: string) {
    if (tenantId) this.currentTenantId = tenantId;
    if (locale) this.currentLocale = locale;
    // Only seed initial synthetic events in demo mode
    if (this.isDemoMode()) {
      this.seedInitialEvents();
    }
  }

  private isDemoMode(): boolean {
    if (typeof window !== 'undefined' && (window as any).__APP_MODE__) {
      return (window as any).__APP_MODE__ === 'demo';
    }
    const mode = (import.meta as any).env?.VITE_APP_MODE;
    if (mode) return mode === 'demo';
    return true;
  }

  setContext(tenantId: string, locale: string): void {
    this.currentTenantId = tenantId;
    this.currentLocale = locale;
  }

  setCoarseRegion(coarseRegion: string): void {
    this.currentCoarseRegion = coarseRegion;
  }

  track(params: TrackEventParams): void {
    // 1. Sanitize properties - strip any potential PII or card data
    const sanitizedProps: Record<string, string | number | boolean | undefined> = {};
    if (params.properties) {
      for (const [key, val] of Object.entries(params.properties)) {
        const isForbidden = FORBIDDEN_PII_PATTERNS.some((pattern) => pattern.test(key));
        if (!isForbidden && val !== undefined) {
          sanitizedProps[key] = val;
        }
      }
    }

    const event: AnalyticsEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type: params.type,
      tenantId: this.currentTenantId,
      sessionId: getOrCreateSessionId(),
      anonymousVisitorId: getAnonymousVisitorId(),
      storeId: params.storeId,
      productPlu: params.productPlu,
      categoryId: params.categoryId,
      storyId: params.storyId,
      searchTerm: params.searchTerm,
      coarseRegion: params.coarseRegion || this.currentCoarseRegion,
      orderReferenceHash: params.orderReferenceHash,
      timestamp: new Date().toISOString(),
      locale: this.currentLocale,
      platform: 'web',
      properties: Object.keys(sanitizedProps).length > 0 ? sanitizedProps : undefined,
    };

    this.events.unshift(event);

    // Keep memory footprint bounded
    if (this.events.length > 500) {
      this.events.pop();
    }
  }

  async getRecentEvents(tenantId: string, limit: number = 50): Promise<AnalyticsEvent[]> {
    return this.events.filter((e) => e.tenantId === tenantId).slice(0, limit);
  }

  async getInsights(
    tenantId: string,
    timeframe: '7d' | '30d' | '90d' = '30d'
  ): Promise<InsightsDashboardData> {
    if (!this.isDemoMode()) {
      // In staging/production, strictly aggregate verified events; never fabricate fake metrics
      const tenantEvents = this.events.filter((e) => e.tenantId === tenantId);
      const sessionCount = tenantEvents.filter((e) => e.type === 'SESSION_STARTED').length;
      const orderCount = tenantEvents.filter((e) => e.type === 'ORDER_SUBMITTED' || e.type === 'ORDER_ACCEPTED').length;
      return {
        timeframe,
        totalSessions: sessionCount,
        activeStoresCount: 0,
        totalOrders: orderCount,
        totalGrossMerchandiseValue: 0,
        averageOrderValue: 0,
        overallConversionRate: sessionCount > 0 ? Number(((orderCount / sessionCount) * 100).toFixed(2)) : 0,
        serviceabilityRate: 0,
        pickingSuccessRate: 0,
        funnel: [
          { stage: 'brand_store_landing', label: 'Brand / Store Landing', visitors: sessionCount, conversionFromPrevious: 100, overallConversion: 100, dropoffRate: 0 },
          { stage: 'product_view', label: 'Product / Catalog View', visitors: tenantEvents.filter(e => e.type === 'PRODUCT_VIEW').length, conversionFromPrevious: 0, overallConversion: 0, dropoffRate: 0 },
          { stage: 'add_to_basket', label: 'Added to Basket', visitors: tenantEvents.filter(e => e.type === 'ADD_TO_BASKET').length, conversionFromPrevious: 0, overallConversion: 0, dropoffRate: 0 },
          { stage: 'checkout', label: 'Checkout Started', visitors: tenantEvents.filter(e => e.type === 'CHECKOUT_STARTED').length, conversionFromPrevious: 0, overallConversion: 0, dropoffRate: 0 },
          { stage: 'order_submitted', label: 'Order Submitted', visitors: orderCount, conversionFromPrevious: 0, overallConversion: 0, dropoffRate: 0 },
          { stage: 'delivered', label: 'Delivered to Door', visitors: tenantEvents.filter(e => e.type === 'ORDER_DELIVERED').length, conversionFromPrevious: 0, overallConversion: 0, dropoffRate: 0 },
        ],
        products: [],
        stories: [],
        searches: [],
        regions: [],
        abandonedBasket: [],
        artieRecommendations: { presented: 0, accepted: 0, paid: 0, presentedToAcceptedRate: 0, presentedToPaidRate: 0, acceptedToPaidRate: 0, attributedRevenue: 0 },
      };
    }

    const isBrandAlpha = tenantId === 'brand-alpha';

    // Scale numbers realistically based on selected timeframe
    const scale = timeframe === '7d' ? 0.25 : timeframe === '90d' ? 2.8 : 1.0;

    const totalSessions = Math.round((isBrandAlpha ? 14250 : 8920) * scale);
    const totalOrders = Math.round((isBrandAlpha ? 1845 : 980) * scale);
    const avgOrderValue = isBrandAlpha ? 34.60 : 42.15;
    const totalGMV = Number((totalOrders * avgOrderValue).toFixed(2));

    return {
      timeframe,
      totalSessions,
      activeStoresCount: isBrandAlpha ? 4 : 2,
      totalOrders,
      totalGrossMerchandiseValue: totalGMV,
      averageOrderValue: avgOrderValue,
      overallConversionRate: Number(((totalOrders / totalSessions) * 100).toFixed(2)),
      serviceabilityRate: isBrandAlpha ? 94.8 : 91.2,
      pickingSuccessRate: isBrandAlpha ? 96.2 : 95.1,

      funnel: [
        {
          stage: 'brand_store_landing',
          label: 'Brand / Store Landing',
          visitors: totalSessions,
          conversionFromPrevious: 100,
          overallConversion: 100,
          dropoffRate: 0,
        },
        {
          stage: 'product_view',
          label: 'Product / Catalog View',
          visitors: Math.round(totalSessions * 0.78),
          conversionFromPrevious: 78.0,
          overallConversion: 78.0,
          dropoffRate: 22.0,
        },
        {
          stage: 'add_to_basket',
          label: 'Added to Basket',
          visitors: Math.round(totalSessions * 0.38),
          conversionFromPrevious: 48.7,
          overallConversion: 38.0,
          dropoffRate: 51.3,
        },
        {
          stage: 'checkout',
          label: 'Checkout Started',
          visitors: Math.round(totalSessions * 0.21),
          conversionFromPrevious: 55.3,
          overallConversion: 21.0,
          dropoffRate: 44.7,
        },
        {
          stage: 'order_submitted',
          label: 'Order Submitted & Authorized',
          visitors: Math.round(totalSessions * 0.145),
          conversionFromPrevious: 69.0,
          overallConversion: 14.5,
          dropoffRate: 31.0,
        },
        {
          stage: 'payment_captured',
          label: 'Picked & Payment Settled',
          visitors: Math.round(totalSessions * 0.138),
          conversionFromPrevious: 95.2,
          overallConversion: 13.8,
          dropoffRate: 4.8,
        },
        {
          stage: 'delivered',
          label: 'Delivered to Door',
          visitors: totalOrders,
          conversionFromPrevious: 94.0,
          overallConversion: Number(((totalOrders / totalSessions) * 100).toFixed(1)),
          dropoffRate: 6.0,
        },
      ],

      products: [
        {
          plu: 'PLU-SOURDOUGH-01',
          name: 'Slow Fermented Sourdough Boule 600g',
          category: 'Bakery',
          impressions: Math.round(5200 * scale),
          productViews: Math.round(1820 * scale),
          addToBasketCount: Math.round(740 * scale),
          ordersCount: Math.round(580 * scale),
          conversionRate: 31.8,
          revenue: Math.round(580 * scale * 3.25),
          outOfStockImpressions: Math.round(120 * scale),
          questRemovals: Math.round(8 * scale),
          questSubstitutions: Math.round(24 * scale),
          quantityReductions: Math.round(12 * scale),
          pickSuccessRate: 94.8,
          estimatedLostRevenue: Math.round(180 * scale),
        },
        {
          plu: 'PLU-ART-001',
          name: 'Artisan Heritage Sourdough Boule 800g',
          category: 'Bakery',
          impressions: Math.round(4100 * scale),
          productViews: Math.round(1350 * scale),
          addToBasketCount: Math.round(510 * scale),
          ordersCount: Math.round(420 * scale),
          conversionRate: 31.1,
          revenue: Math.round(420 * scale * 2.85),
          outOfStockImpressions: Math.round(60 * scale),
          questRemovals: Math.round(4 * scale),
          questSubstitutions: Math.round(10 * scale),
          quantityReductions: Math.round(6 * scale),
          pickSuccessRate: 97.2,
          estimatedLostRevenue: Math.round(75 * scale),
        },
        {
          plu: 'PLU-ORGANIC-EGGS-6PK',
          name: 'Free Range Organic Rich Yolk Large Eggs (Pack of 6)',
          category: 'Dairy & Eggs',
          impressions: Math.round(6800 * scale),
          productViews: Math.round(2400 * scale),
          addToBasketCount: Math.round(980 * scale),
          ordersCount: Math.round(860 * scale),
          conversionRate: 35.8,
          revenue: Math.round(860 * scale * 2.70),
          outOfStockImpressions: Math.round(90 * scale),
          questRemovals: Math.round(5 * scale),
          questSubstitutions: Math.round(18 * scale),
          quantityReductions: Math.round(14 * scale),
          pickSuccessRate: 96.5,
          estimatedLostRevenue: Math.round(110 * scale),
        },
        {
          plu: 'PLU-COLDPRESS-ORANGE',
          name: 'Cold Pressed Valencia Orange Juice 750ml',
          category: 'Drinks & Juices',
          impressions: Math.round(3900 * scale),
          productViews: Math.round(1100 * scale),
          addToBasketCount: Math.round(420 * scale),
          ordersCount: Math.round(340 * scale),
          conversionRate: 30.9,
          revenue: Math.round(340 * scale * 2.95),
          outOfStockImpressions: Math.round(45 * scale),
          questRemovals: Math.round(2 * scale),
          questSubstitutions: Math.round(8 * scale),
          quantityReductions: Math.round(4 * scale),
          pickSuccessRate: 98.1,
          estimatedLostRevenue: Math.round(48 * scale),
        },
        {
          plu: 'PLU-ORGANIC-MILK-2L',
          name: 'Estate Whole Organic Fresh Milk 2 Litres',
          category: 'Dairy & Eggs',
          impressions: Math.round(7400 * scale),
          productViews: Math.round(2900 * scale),
          addToBasketCount: Math.round(1250 * scale),
          ordersCount: Math.round(1100 * scale),
          conversionRate: 37.9,
          revenue: Math.round(1100 * scale * 2.45),
          outOfStockImpressions: Math.round(140 * scale),
          questRemovals: Math.round(10 * scale),
          questSubstitutions: Math.round(32 * scale),
          quantityReductions: Math.round(18 * scale),
          pickSuccessRate: 95.8,
          estimatedLostRevenue: Math.round(195 * scale),
        },
      ],

      stories: [
        {
          storyId: 'story-morning-bake',
          title: 'Morning Sourdough Harvest',
          tag: 'Morning Fresh',
          impressions: Math.round(3800 * scale),
          uniqueViewers: Math.round(2950 * scale),
          opens: Math.round(2410 * scale),
          productClicks: Math.round(920 * scale),
          addToBaskets: Math.round(410 * scale),
          orders: Math.round(290 * scale),
          capturedSales: Math.round(290 * scale * 3.25),
          directConversionRate: 12.0, // Bought directly from story CTA
          assistedConversionRate: 24.5, // Story viewers who completed any basket that session
        },
        {
          storyId: 'story-organic-dairy',
          title: 'Pasture-Fed Jersey Dairy',
          tag: 'Local Heritage',
          impressions: Math.round(3100 * scale),
          uniqueViewers: Math.round(2480 * scale),
          opens: Math.round(1850 * scale),
          productClicks: Math.round(680 * scale),
          addToBaskets: Math.round(340 * scale),
          orders: Math.round(240 * scale),
          capturedSales: Math.round(240 * scale * 2.70),
          directConversionRate: 13.0,
          assistedConversionRate: 26.8,
        },
        {
          storyId: 'story-orchard-juices',
          title: 'Cold-Pressed Orchard Grove',
          tag: 'Weekend Refresh',
          impressions: Math.round(2400 * scale),
          uniqueViewers: Math.round(1950 * scale),
          opens: Math.round(1420 * scale),
          productClicks: Math.round(460 * scale),
          addToBaskets: Math.round(190 * scale),
          orders: Math.round(135 * scale),
          capturedSales: Math.round(135 * scale * 2.95),
          directConversionRate: 9.5,
          assistedConversionRate: 19.2,
        },
      ],

      searches: [
        {
          query: 'sourdough',
          frequency: Math.round(840 * scale),
          resultsCount: 4,
          resultClicks: Math.round(720 * scale),
          addToBasketCount: Math.round(430 * scale),
          conversionRate: 51.2,
          noResult: false,
        },
        {
          query: 'organic eggs',
          frequency: Math.round(690 * scale),
          resultsCount: 3,
          resultClicks: Math.round(610 * scale),
          addToBasketCount: Math.round(380 * scale),
          conversionRate: 55.1,
          noResult: false,
        },
        {
          query: 'choclit', // Typo query handled by search optimisation rule
          frequency: Math.round(180 * scale),
          resultsCount: 2,
          resultClicks: Math.round(140 * scale),
          addToBasketCount: Math.round(75 * scale),
          conversionRate: 41.6,
          noResult: false,
        },
        {
          query: 'gluten free bagels',
          frequency: Math.round(120 * scale),
          resultsCount: 0,
          resultClicks: 0,
          addToBasketCount: 0,
          conversionRate: 0,
          noResult: true,
        },
        {
          query: 'oat milk barista',
          frequency: Math.round(310 * scale),
          resultsCount: 2,
          resultClicks: Math.round(260 * scale),
          addToBasketCount: Math.round(155 * scale),
          conversionRate: 50.0,
          noResult: false,
        },
      ],

      regions: [
        {
          country: 'United Kingdom',
          region: 'Essex',
          city: 'Chelmsford',
          postcodeDistrict: 'CM1',
          sessions: Math.round(5400 * scale),
          serviceabilityRate: 98.2,
          noServiceableStoreRate: 1.8,
          conversionRate: 14.8,
          ordersCount: Math.round(800 * scale),
          revenue: Math.round(800 * scale * 34.50),
        },
        {
          country: 'United Kingdom',
          region: 'Essex',
          city: 'Chelmsford South',
          postcodeDistrict: 'CM2',
          sessions: Math.round(4200 * scale),
          serviceabilityRate: 96.5,
          noServiceableStoreRate: 3.5,
          conversionRate: 13.9,
          ordersCount: Math.round(584 * scale),
          revenue: Math.round(584 * scale * 35.20),
        },
        {
          country: 'United Kingdom',
          region: 'Essex',
          city: 'Billericay',
          postcodeDistrict: 'CM12',
          sessions: Math.round(2800 * scale),
          serviceabilityRate: 91.0,
          noServiceableStoreRate: 9.0,
          conversionRate: 11.5,
          ordersCount: Math.round(322 * scale),
          revenue: Math.round(322 * scale * 36.80),
        },
        {
          country: 'United Kingdom',
          region: 'Essex',
          city: 'Brentwood',
          postcodeDistrict: 'CM14',
          sessions: Math.round(1850 * scale),
          serviceabilityRate: 84.5,
          noServiceableStoreRate: 15.5,
          conversionRate: 7.5,
          ordersCount: Math.round(139 * scale),
          revenue: Math.round(139 * scale * 33.10),
        },
      ],

      abandonedBasket: [
        {
          abandonedCount: Math.round(480 * scale),
          recoveredCount: Math.round(145 * scale),
          recoveryRate: 30.2,
          averageAbandonedValue: 29.40,
          topAbandonedPlus: [
            { plu: 'PLU-SOURDOUGH-01', name: 'Slow Fermented Sourdough Boule', frequency: Math.round(195 * scale) },
            { plu: 'PLU-ORGANIC-MILK-2L', name: 'Estate Whole Organic Milk', frequency: Math.round(180 * scale) },
            { plu: 'PLU-COLDPRESS-ORANGE', name: 'Cold Pressed Orange Juice', frequency: Math.round(110 * scale) },
          ],
      artieRecommendations: { presented: 0, accepted: 0, paid: 0, presentedToAcceptedRate: 0, presentedToPaidRate: 0, acceptedToPaidRate: 0, attributedRevenue: 0 },
        },
      ],
    };
  }

  private seedInitialEvents(): void {
    const now = Date.now();
    const demoEvents: Array<{ type: any; plu?: string; query?: string }> = [
      { type: 'SESSION_STARTED' },
      { type: 'BRAND_VIEW' },
      { type: 'STORE_SELECTED' },
      { type: 'CATEGORY_VIEW' },
      { type: 'PRODUCT_VIEW', plu: 'PLU-SOURDOUGH-01' },
      { type: 'ADD_TO_BASKET', plu: 'PLU-SOURDOUGH-01' },
      { type: 'SEARCH', query: 'organic eggs' },
      { type: 'PRODUCT_VIEW', plu: 'PLU-ORGANIC-EGGS-6PK' },
      { type: 'ADD_TO_BASKET', plu: 'PLU-ORGANIC-EGGS-6PK' },
      { type: 'CHECKOUT_STARTED' },
      { type: 'ORDER_SUBMITTED' },
      { type: 'ORDER_ACCEPTED' },
      { type: 'PICKING_STARTED' },
      { type: 'ITEM_PICKED', plu: 'PLU-SOURDOUGH-01' },
      { type: 'PICKING_COMPLETE' },
      { type: 'PAYMENT_CAPTURED' },
      { type: 'COURIER_ASSIGNED' },
      { type: 'ORDER_DELIVERED' },
    ];

    demoEvents.forEach((de, idx) => {
      this.events.push({
        id: `seed_evt_${idx + 1}`,
        type: de.type,
        tenantId: 'brand-alpha',
        sessionId: 'ses_demo_101',
        anonymousVisitorId: 'anon_demo_user',
        storeId: 'store-moulsham-st',
        productPlu: de.plu,
        searchTerm: de.query,
        coarseRegion: 'Essex',
        orderReferenceHash: de.type.startsWith('ORDER') ? 'ord_hash_98a3b' : undefined,
        timestamp: new Date(now - (demoEvents.length - idx) * 120000).toISOString(),
        locale: 'en-GB',
        platform: 'web',
      });
    });
  }
}

// Global analytics client instance
export const defaultAnalyticsClient = new MockAnalyticsClient();
export { MockAnalyticsClient as DemoAnalyticsClient };
