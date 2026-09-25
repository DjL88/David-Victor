/**
 * Deterministic Altie merchandising engine.
 *
 * Pure by design: callers supply tenant-scoped first-party signals and policy
 * eligibility. No model/provider dependency and no cross-tenant state.
 */
export type RecommendationSurface =
  | 'SEARCH'
  | 'FILTER'
  | 'GOOD_BETTER_BEST'
  | 'BASKET_COMPLETION'
  | 'COMPLEMENT'
  | 'SUBSTITUTE';

export type RecommendationReasonCode =
  | 'QUERY_RELEVANCE'
  | 'CUSTOMER_AFFINITY'
  | 'POPULAR'
  | 'COMPLEMENT'
  | 'PRICE_FIT'
  | 'SUBSTITUTE_SUCCESS'
  | 'PROMOTION'
  | 'MARGIN'
  | 'ANONYMOUS_FALLBACK'
  | 'DIVERSITY';

export interface RecommendationCandidate {
  id: string;
  categoryId?: string;
  brand?: string;
  price: number;
  available: boolean;
  policyAllowed: boolean;
  queryRelevance?: number;
  customerAffinity?: number;
  popularity?: number;
  coOccurrence?: number;
  priceFit?: number;
  substitutionSuccess?: number;
  promotion?: number;
  margin?: number;
}

export interface RecommendationWeights {
  queryRelevance: number;
  customerAffinity: number;
  popularity: number;
  coOccurrence: number;
  priceFit: number;
  substitutionSuccess: number;
  promotion: number;
  margin: number;
}

export interface RecommendationContext {
  tenantId: string;
  surface: RecommendationSurface;
  anonymous?: boolean;
  personalisationEnabled?: boolean;
  limit?: number;
  weights?: Partial<RecommendationWeights>;
  maxPerBrand?: number;
  maxPerCategory?: number;
}

export interface RankedRecommendation {
  candidate: RecommendationCandidate;
  score: number;
  reasonCodes: RecommendationReasonCode[];
  explanation: string;
}

export interface RecommendationResult {
  tenantId: string;
  surface: RecommendationSurface;
  recommendations: RankedRecommendation[];
  filteredCandidateIds: string[];
}

const DEFAULT_WEIGHTS: RecommendationWeights = {
  queryRelevance: 4,
  customerAffinity: 3,
  popularity: 2,
  coOccurrence: 2,
  priceFit: 2,
  substitutionSuccess: 2,
  promotion: 1,
  margin: 0,
};

const bounded = (value?: number): number =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, Number(value))) : 0;

const reason = (code: RecommendationReasonCode): string => ({
  QUERY_RELEVANCE: 'strong match for the current query or filter',
  CUSTOMER_AFFINITY: 'matches this customer’s tenant-local purchase affinity',
  POPULAR: 'performs well with this retailer’s customers',
  COMPLEMENT: 'is frequently relevant alongside the current basket or product',
  PRICE_FIT: 'fits the relevant basket or customer price band',
  SUBSTITUTE_SUCCESS: 'has a strong accepted-substitute history',
  PROMOTION: 'has a current eligible promotion',
  MARGIN: 'matches the retailer’s configured merchandising weighting',
  ANONYMOUS_FALLBACK: 'ranked from relevance and aggregate retailer signals',
  DIVERSITY: 'selected to keep the recommendation set varied',
}[code]);

export function rankRecommendations(
  context: RecommendationContext,
  candidates: RecommendationCandidate[],
): RecommendationResult {
  if (!context.tenantId.trim()) throw new Error('tenantId is required');

  const weights = { ...DEFAULT_WEIGHTS, ...context.weights };
  const usePersonal = context.personalisationEnabled !== false && !context.anonymous;
  const filteredCandidateIds: string[] = [];

  const scored = candidates.flatMap((candidate): RankedRecommendation[] => {
    // Safety and policy are hard filters: merchandising can never outscore them.
    if (!candidate.available || !candidate.policyAllowed) {
      filteredCandidateIds.push(candidate.id);
      return [];
    }

    const signals: Array<[RecommendationReasonCode, number, number]> = [
      ['QUERY_RELEVANCE', bounded(candidate.queryRelevance), weights.queryRelevance],
      ['POPULAR', bounded(candidate.popularity), weights.popularity],
      ['COMPLEMENT', bounded(candidate.coOccurrence), weights.coOccurrence],
      ['PRICE_FIT', bounded(candidate.priceFit), weights.priceFit],
      ['SUBSTITUTE_SUCCESS', bounded(candidate.substitutionSuccess), weights.substitutionSuccess],
      ['PROMOTION', bounded(candidate.promotion), weights.promotion],
      ['MARGIN', bounded(candidate.margin), weights.margin],
    ];
    if (usePersonal) {
      signals.push(['CUSTOMER_AFFINITY', bounded(candidate.customerAffinity), weights.customerAffinity]);
    }

    const contributions = signals
      .map(([code, value, weight]) => ({ code, contribution: value * Math.max(0, weight) }))
      .filter(({ contribution }) => contribution > 0)
      .sort((a, b) => b.contribution - a.contribution || a.code.localeCompare(b.code));

    const reasonCodes = contributions.slice(0, 3).map(({ code }) => code);
    if (!usePersonal && reasonCodes.length) reasonCodes.push('ANONYMOUS_FALLBACK');

    const score = contributions.reduce((sum, item) => sum + item.contribution, 0);
    return [{
      candidate,
      score,
      reasonCodes,
      explanation: reasonCodes.length
        ? `Recommended because it ${reasonCodes.filter((c) => c !== 'ANONYMOUS_FALLBACK').map(reason).join(', ')}.`
        : 'Eligible recommendation with no positive ranking signal yet.',
    }];
  });

  scored.sort((a, b) => b.score - a.score || a.candidate.id.localeCompare(b.candidate.id));

  const limit = Math.max(1, context.limit ?? 10);
  const maxPerBrand = Math.max(1, context.maxPerBrand ?? 2);
  const maxPerCategory = Math.max(1, context.maxPerCategory ?? 3);
  const brands = new Map<string, number>();
  const categories = new Map<string, number>();
  const recommendations: RankedRecommendation[] = [];

  for (const item of scored) {
    const brand = item.candidate.brand?.trim().toLowerCase();
    const category = item.candidate.categoryId?.trim();
    if (brand && (brands.get(brand) || 0) >= maxPerBrand) continue;
    if (category && (categories.get(category) || 0) >= maxPerCategory) continue;

    recommendations.push(item);
    if (brand) brands.set(brand, (brands.get(brand) || 0) + 1);
    if (category) categories.set(category, (categories.get(category) || 0) + 1);
    if (recommendations.length >= limit) break;
  }

  return { tenantId: context.tenantId, surface: context.surface, recommendations, filteredCandidateIds };
}
