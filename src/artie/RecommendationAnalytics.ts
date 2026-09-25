export type RecommendationAnalyticsAction =
  | 'IMPRESSION'
  | 'CLICK'
  | 'ADD_TO_BASKET'
  | 'CONVERSION'
  | 'IGNORE'
  | 'SUBSTITUTION_ACCEPTED';

export type RecommendationAnalyticsSurface =
  | 'SEARCH'
  | 'FILTER'
  | 'GOOD_BETTER_BEST'
  | 'BASKET_COMPLETION'
  | 'COMPLEMENT'
  | 'SUBSTITUTE';

export interface RecommendationAnalyticsEvent {
  tenantId: string;
  action: RecommendationAnalyticsAction;
  recommendationId: string;
  productId: string;
  surface: RecommendationAnalyticsSurface;
  rank: number;
  reasonCodes: string[];
  sessionId: string;
  timestamp: string;
  anonymous: boolean;
  incrementalValueMinor?: number;
}

const safeId = (value: string, field: string): string => {
  const clean = String(value || '').trim();
  if (!clean || clean.length > 160 || !/^[A-Za-z0-9._:-]+$/.test(clean)) {
    throw new Error(`${field} must be a non-empty opaque identifier.`);
  }
  return clean;
};

/**
 * Builds the deliberately small event contract used to measure Artie.
 *
 * Customer identity, contact details and inferred traits are intentionally not
 * accepted by this API. The server-side analytics boundary remains responsible
 * for deriving tenant context from the request rather than trusting another
 * tenant identifier supplied by a browser.
 */
export function buildRecommendationAnalyticsEvent(params: RecommendationAnalyticsEvent): RecommendationAnalyticsEvent {
  const tenantId = safeId(params.tenantId, 'tenantId');
  const recommendationId = safeId(params.recommendationId, 'recommendationId');
  const productId = safeId(params.productId, 'productId');
  const sessionId = safeId(params.sessionId, 'sessionId');
  const rank = Number(params.rank);
  if (!Number.isInteger(rank) || rank < 0 || rank > 1000) throw new Error('rank must be an integer between 0 and 1000.');
  if (params.incrementalValueMinor !== undefined && (!Number.isInteger(params.incrementalValueMinor) || params.incrementalValueMinor < 0)) {
    throw new Error('incrementalValueMinor must be a non-negative integer.');
  }

  return {
    tenantId,
    action: params.action,
    recommendationId,
    productId,
    surface: params.surface,
    rank,
    reasonCodes: Array.from(new Set(params.reasonCodes.map((code) => safeId(code, 'reasonCode')))).slice(0, 8),
    sessionId,
    timestamp: params.timestamp,
    anonymous: Boolean(params.anonymous),
    ...(params.incrementalValueMinor !== undefined ? { incrementalValueMinor: params.incrementalValueMinor } : {}),
  };
}
