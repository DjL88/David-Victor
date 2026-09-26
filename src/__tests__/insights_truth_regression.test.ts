import { beforeAll, describe, expect, it } from 'vitest';
import { AnalyticsService } from '../../server/analyticsService';
import { setServerRuntimeMode } from '../../server/runtimeMode';
import type { AnalyticsEvent, AnalyticsEventType } from '../analytics/analyticsModels';

function event(
  id: string,
  type: AnalyticsEventType,
  timestamp: string,
  extras: Partial<AnalyticsEvent> = {},
): AnalyticsEvent {
  return {
    id,
    type,
    tenantId: 'ignored_by_trusted_boundary',
    sessionId: extras.sessionId || 'ses_truth',
    timestamp,
    locale: 'en-GB',
    platform: 'web',
    ...extras,
  };
}

async function seed(tenantId: string, events: AnalyticsEvent[]): Promise<void> {
  for (const value of events) {
    await AnalyticsService.trackEvent(tenantId, value);
  }
}

describe('Insights truth regressions', () => {
  beforeAll(() => {
    setServerRuntimeMode('demo');
  });

  it('shows unknown when supporting evidence was never observed instead of inventing healthy or estimated metrics', async () => {
    const tenantId = 'tenant_insights_unknown';
    await seed(tenantId, [
      event('evt_1', 'SESSION_STARTED', '2026-09-26T12:00:00.000Z'),
      event('evt_2', 'PRODUCT_VIEW', '2026-09-26T12:00:10.000Z', { productPlu: 'PLU_A' }),
      event('evt_3', 'SEARCH', '2026-09-26T12:00:20.000Z', { searchTerm: 'milk' }),
    ]);

    const insights = await AnalyticsService.getInsights(tenantId, '30d');

    expect(insights.serviceabilityRate).toBeNull();
    expect(insights.pickingSuccessRate).toBeNull();
    expect(insights.products[0]).toMatchObject({
      impressions: null,
      outOfStockImpressions: null,
      pickSuccessRate: null,
      estimatedLostRevenue: null,
      ordersCount: null,
      revenue: null,
    });
    expect(insights.searches[0].resultsCount).toBeNull();
    expect(insights.abandonedBasket[0]?.averageAbandonedValue).toBeNull();
    expect(insights.evidence).toMatchObject({
      source: 'analytics_events',
      status: 'AVAILABLE',
      eventCount: 3,
      serviceabilityChecks: 0,
      pickingOutcomeEvents: 0,
      financialStatus: 'NO_CAPTURE_EVIDENCE',
    });
  });

  it('uses explicit serviceability, picking and abandonment events when they exist', async () => {
    const tenantId = 'tenant_insights_explicit';
    await seed(tenantId, [
      event('evt_1', 'SESSION_STARTED', '2026-09-26T12:00:00.000Z'),
      event('evt_2', 'ELIGIBLE_STORES_RETURNED', '2026-09-26T12:00:10.000Z', { coarseRegion: 'B1' }),
      event('evt_3', 'ITEM_PICKED', '2026-09-26T12:00:20.000Z', { productPlu: 'PLU_A' }),
      event('evt_4', 'ITEM_SUBSTITUTED', '2026-09-26T12:00:30.000Z', { productPlu: 'PLU_B' }),
      event('evt_5', 'BASKET_ABANDONED', '2026-09-26T12:00:40.000Z', { properties: { totalAmount: 2450 } }),
    ]);

    const insights = await AnalyticsService.getInsights(tenantId, '30d');

    expect(insights.serviceabilityRate).toBe(100);
    expect(insights.pickingSuccessRate).toBe(50);
    expect(insights.abandonedBasket[0]?.averageAbandonedValue).toBe(2450);
    expect(insights.products.find((product) => product.plu === 'PLU_A')?.pickSuccessRate).toBe(100);
    expect(insights.products.find((product) => product.plu === 'PLU_B')?.pickSuccessRate).toBe(0);
  });

  it('counts recommendation conversion only when the same recommendation was presented, accepted and then paid', async () => {
    const tenantId = 'tenant_insights_altie';
    await seed(tenantId, [
      event('evt_p1', 'ARTIE_RECOMMENDATION_PRESENTED', '2026-09-26T12:00:00.000Z', { properties: { recommendationId: 'rec_good' } }),
      event('evt_p2', 'ARTIE_RECOMMENDATION_PRESENTED', '2026-09-26T12:00:00.000Z', { properties: { recommendationId: 'rec_good' } }),
      event('evt_a1', 'ARTIE_RECOMMENDATION_ACCEPTED', '2026-09-26T12:01:00.000Z', { properties: { recommendationId: 'rec_good' } }),
      event('evt_paid', 'ARTIE_RECOMMENDATION_PAID', '2026-09-26T12:02:00.000Z', { properties: { recommendationId: 'rec_good', attributedRevenue: 250 } }),
      event('evt_orphan_paid', 'ARTIE_RECOMMENDATION_PAID', '2026-09-26T12:02:00.000Z', { properties: { recommendationId: 'rec_orphan', attributedRevenue: 999 } }),
      event('evt_orphan_accept', 'ARTIE_RECOMMENDATION_ACCEPTED', '2026-09-26T12:01:00.000Z', { properties: { recommendationId: 'rec_missing_presentation' } }),
    ]);

    const insights = await AnalyticsService.getInsights(tenantId, '30d');

    expect(insights.artieRecommendations).toEqual({
      presented: 1,
      accepted: 1,
      paid: 1,
      presentedToAcceptedRate: 100,
      presentedToPaidRate: 100,
      acceptedToPaidRate: 100,
      attributedRevenue: 250,
    });
    expect(insights.evidence.recommendationChains).toBe(1);
  });

  it('does not treat browser order totals or store acceptance as paid financial evidence', async () => {
    const tenantId = 'tenant_insights_unpaid';
    await seed(tenantId, [
      event('evt_submit', 'ORDER_SUBMITTED', '2026-09-26T12:00:00.000Z', {
        properties: { totalAmount: 9999, currency: 'GBP' },
      }),
      event('evt_accept', 'ORDER_ACCEPTED', '2026-09-26T12:01:00.000Z'),
    ]);

    const insights = await AnalyticsService.getInsights(tenantId, '30d');

    expect(insights.totalOrders).toBeNull();
    expect(insights.totalGrossMerchandiseValue).toBeNull();
    expect(insights.averageOrderValue).toBeNull();
    expect(insights.funnel.find((stage) => stage.stage === 'payment_captured')?.visitors).toBe(0);
    expect(insights.evidence).toMatchObject({
      financialSource: 'payment_captured_events',
      financialCaptureEvents: 0,
      financialAmountEvents: 0,
      financialCurrency: null,
      financialStatus: 'NO_CAPTURE_EVIDENCE',
    });
  });

  it('deduplicates verified payment captures and only totals complete single-currency evidence', async () => {
    const tenantId = 'tenant_insights_dedup';
    await seed(tenantId, [
      event('evt_paid_1', 'PAYMENT_CAPTURED', '2026-09-26T12:00:00.000Z', {
        orderReferenceHash: 'order_hash_1',
        properties: { totalAmount: 2500, currency: 'GBP' },
      }),
      event('evt_paid_duplicate', 'PAYMENT_CAPTURED', '2026-09-26T12:00:05.000Z', {
        orderReferenceHash: 'order_hash_1',
        properties: { totalAmount: 2500, currency: 'GBP' },
      }),
    ]);

    const insights = await AnalyticsService.getInsights(tenantId, '30d');

    expect(insights.totalOrders).toBe(1);
    expect(insights.totalGrossMerchandiseValue).toBe(2500);
    expect(insights.averageOrderValue).toBe(2500);
    expect(insights.evidence).toMatchObject({
      financialCaptureEvents: 1,
      financialAmountEvents: 1,
      financialCurrency: 'GBP',
      financialStatus: 'AVAILABLE',
    });
  });

  it('does not combine money across currencies or invent story and regional purchase attribution', async () => {
    const tenantId = 'tenant_insights_currency';
    await seed(tenantId, [
      event('evt_story_open', 'STORY_OPEN', '2026-09-26T12:00:00.000Z', {
        storyId: 'story_1',
        coarseRegion: 'B1',
      }),
      event('evt_story_click', 'STORY_PRODUCT_CLICK', '2026-09-26T12:00:10.000Z', {
        storyId: 'story_1',
        coarseRegion: 'B1',
      }),
      event('evt_paid_gbp', 'PAYMENT_CAPTURED', '2026-09-26T12:01:00.000Z', {
        orderReferenceHash: 'order_gbp',
        properties: { totalAmount: 1000, currency: 'GBP' },
      }),
      event('evt_paid_eur', 'PAYMENT_CAPTURED', '2026-09-26T12:02:00.000Z', {
        orderReferenceHash: 'order_eur',
        properties: { totalAmount: 1200, currency: 'EUR' },
      }),
    ]);

    const insights = await AnalyticsService.getInsights(tenantId, '30d');

    expect(insights.totalOrders).toBe(2);
    expect(insights.totalGrossMerchandiseValue).toBeNull();
    expect(insights.averageOrderValue).toBeNull();
    expect(insights.evidence.financialStatus).toBe('MIXED_CURRENCY');
    expect(insights.evidence.financialCurrency).toBeNull();
    expect(insights.stories[0]).toMatchObject({
      title: null,
      capturedSales: null,
      directConversionRate: null,
      assistedConversionRate: null,
      orders: null,
    });
    expect(insights.regions[0]).toMatchObject({
      region: 'B1',
      country: null,
      city: null,
      ordersCount: null,
      revenue: null,
      conversionRate: null,
    });
  });

  it('counts abandonment only from explicit abandonment telemetry rather than inferring it from an unfinished basket session', async () => {
    const tenantId = 'tenant_insights_abandonment';
    await seed(tenantId, [
      event('evt_add', 'ADD_TO_BASKET', '2026-09-26T12:00:00.000Z', { productPlu: 'PLU_A' }),
      event('evt_abandoned', 'BASKET_ABANDONED', '2026-09-26T12:05:00.000Z', {
        sessionId: 'ses_explicit_abandon',
        productPlu: 'PLU_B',
        properties: { totalAmount: 2450 },
      }),
    ]);

    const insights = await AnalyticsService.getInsights(tenantId, '30d');

    expect(insights.abandonedBasket[0]).toMatchObject({
      abandonedCount: 1,
      recoveredCount: null,
      recoveryRate: null,
      averageAbandonedValue: 2450,
    });
    expect(insights.abandonedBasket[0].topAbandonedPlus).toEqual([
      { plu: 'PLU_B', name: 'Product (PLU_B)', frequency: 1 },
    ]);
  });
});
