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

export interface RecommendationAnalyticsInput {
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

export interface RecommendationAnalyticsEvent extends RecommendationAnalyticsInput {
  tenantId: string;
}

const safeId = (value: string, field: string): string => {
  const clean = String(value || '').trim();
  if (!clean || clean.length > 160 || !/^[A-Za-z0-9._:-]+$/.test(clean)) {
    throw new Error(`${field} must be a non-empty opaque identifier.`);
  }
  return clean;
};

const safeTimestamp = (value: string): string => {
  const clean = String(value || '').trim();
  const epoch = Date.parse(clean);
  if (!clean || !Number.isFinite(epoch)) throw new Error('timestamp must be a valid ISO timestamp.');
  return new Date(epoch).toISOString();
};

/**
 * Builds the deliberately small Altie measurement event at a trusted server
 * boundary. Tenant identity is supplied separately from the browser payload so
 * a client cannot attribute recommendation activity to another tenant.
 *
 * This contract intentionally has no customer/contact/protected-trait fields.
 * Anonymous and opted-out traffic can therefore still be measured at aggregate
 * session/recommendation level without leaking customer identity.
 */
export function buildRecommendationAnalyticsEvent(
  trustedTenantId: string,
  params: RecommendationAnalyticsInput
): RecommendationAnalyticsEvent {
  const tenantId = safeId(trustedTenantId, 'tenantId');
  const recommendationId = safeId(params.recommendationId, 'recommendationId');
  const productId = safeId(params.productId, 'productId');
  const sessionId = safeId(params.sessionId, 'sessionId');
  const rank = Number(params.rank);
  if (!Number.isInteger(rank) || rank < 0 || rank > 1000) {
    throw new Error('rank must be an integer between 0 and 1000.');
  }
  if (
    params.incrementalValueMinor !== undefined &&
    (!Number.isInteger(params.incrementalValueMinor) || params.incrementalValueMinor < 0)
  ) {
    throw new Error('incrementalValueMinor must be a non-negative integer.');
  }

  return {
    tenantId,
    action: params.action,
    recommendationId,
    productId,
    surface: params.surface,
    rank,
    reasonCodes: Array.from(new Set((params.reasonCodes || []).map((code) => safeId(code, 'reasonCode')))).slice(0, 8),
    sessionId,
    timestamp: safeTimestamp(params.timestamp),
    anonymous: Boolean(params.anonymous),
    ...(params.incrementalValueMinor !== undefined
      ? { incrementalValueMinor: params.incrementalValueMinor }
      : {}),
  };
}
