import { describe, expect, it } from 'vitest';
import { buildRecommendationAnalyticsEvent } from '../artie/RecommendationAnalytics';

describe('Altie recommendation analytics contract', () => {
  const input = {
    action: 'IMPRESSION' as const,
    recommendationId: 'rec_123',
    productId: 'sku_456',
    surface: 'BASKET_COMPLETION' as const,
    rank: 1,
    reasonCodes: ['BASKET_AFFINITY', 'PRICE_FIT', 'PRICE_FIT'],
    sessionId: 'sess_789',
    timestamp: '2026-09-25T00:00:00Z',
    anonymous: true,
    incrementalValueMinor: 250,
  };

  it('binds events to trusted tenant context and keeps a privacy-minimal schema', () => {
    const event = buildRecommendationAnalyticsEvent('tenant-a', input);
    expect(event.tenantId).toBe('tenant-a');
    expect(event.reasonCodes).toEqual(['BASKET_AFFINITY', 'PRICE_FIT']);
    expect(event.incrementalValueMinor).toBe(250);
    expect(event.timestamp).toBe('2026-09-25T00:00:00.000Z');
    expect(event).not.toHaveProperty('customerId');
    expect(event).not.toHaveProperty('email');
    expect(event).not.toHaveProperty('traits');
  });

  it('supports anonymous aggregate measurement without customer identity', () => {
    const event = buildRecommendationAnalyticsEvent('tenant-a', { ...input, anonymous: true });
    expect(event.anonymous).toBe(true);
    expect(Object.keys(event)).not.toContain('customerId');
  });

  it('cannot accept a browser supplied tenant in the event payload contract', () => {
    const event = buildRecommendationAnalyticsEvent('tenant-a', {
      ...input,
      // Runtime extra fields are discarded rather than persisted.
      tenantId: 'tenant-b',
    } as any);
    expect(event.tenantId).toBe('tenant-a');
    expect(Object.keys(event).filter((key) => key === 'tenantId')).toHaveLength(1);
  });

  it('rejects unsafe identifiers, timestamps, rank and monetary values', () => {
    expect(() => buildRecommendationAnalyticsEvent('tenant a', input)).toThrow(/tenantId/);
    expect(() => buildRecommendationAnalyticsEvent('tenant-a', { ...input, sessionId: 'person@example.com' })).toThrow(/sessionId/);
    expect(() => buildRecommendationAnalyticsEvent('tenant-a', { ...input, timestamp: 'not-a-date' })).toThrow(/timestamp/);
    expect(() => buildRecommendationAnalyticsEvent('tenant-a', { ...input, rank: -1 })).toThrow(/rank/);
    expect(() => buildRecommendationAnalyticsEvent('tenant-a', { ...input, incrementalValueMinor: 1.5 })).toThrow(/incrementalValueMinor/);
  });
});
