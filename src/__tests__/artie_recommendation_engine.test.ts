import { describe, expect, it } from 'vitest';
import { rankRecommendations } from '../artie/RecommendationEngine';

describe('Altie deterministic recommendation engine', () => {
  it('never recommends unavailable or policy-blocked products', () => {
    const result = rankRecommendations(
      { tenantId: 'tenant-a', surface: 'BASKET_COMPLETION' },
      [
        { id: 'safe', price: 2, available: true, policyAllowed: true, popularity: 0.5 },
        { id: 'blocked', price: 1, available: true, policyAllowed: false, popularity: 1 },
        { id: 'oos', price: 1, available: false, policyAllowed: true, popularity: 1 },
      ],
    );
    expect(result.recommendations.map((x) => x.candidate.id)).toEqual(['safe']);
    expect(result.filteredCandidateIds.sort()).toEqual(['blocked', 'oos']);
  });

  it('uses customer affinity only when personalisation is allowed', () => {
    const candidates = [
      { id: 'personal', price: 5, available: true, policyAllowed: true, customerAffinity: 1, popularity: 0.1 },
      { id: 'popular', price: 5, available: true, policyAllowed: true, customerAffinity: 0, popularity: 0.8 },
    ];
    expect(rankRecommendations({ tenantId: 't', surface: 'FILTER' }, candidates).recommendations[0].candidate.id).toBe('personal');
    expect(rankRecommendations({ tenantId: 't', surface: 'FILTER', anonymous: true }, candidates).recommendations[0].candidate.id).toBe('popular');
  });

  it('produces stable reason codes and respects diversity caps', () => {
    const result = rankRecommendations(
      { tenantId: 't', surface: 'SEARCH', limit: 3, maxPerBrand: 1 },
      [
        { id: 'a', brand: 'Same', price: 4, available: true, policyAllowed: true, queryRelevance: 1 },
        { id: 'b', brand: 'Same', price: 5, available: true, policyAllowed: true, queryRelevance: .9 },
        { id: 'c', brand: 'Other', price: 6, available: true, policyAllowed: true, popularity: .8 },
      ],
    );
    expect(result.recommendations.map((x) => x.candidate.id)).toEqual(['a', 'c']);
    expect(result.recommendations[0].reasonCodes).toContain('QUERY_RELEVANCE');
    expect(result.recommendations[0].explanation).toContain('current query or filter');
  });

  it('defaults margin influence to zero', () => {
    const result = rankRecommendations(
      { tenantId: 't', surface: 'GOOD_BETTER_BEST' },
      [
        { id: 'margin-only', price: 9, available: true, policyAllowed: true, margin: 1 },
        { id: 'relevant', price: 8, available: true, policyAllowed: true, queryRelevance: .2 },
      ],
    );
    expect(result.recommendations[0].candidate.id).toBe('relevant');
  });
});
