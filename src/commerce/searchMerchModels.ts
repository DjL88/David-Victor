/**
 * Search Merchandising & Optimisation Domain Models
 * Tenant- and locale-specific search tuning rules that affect ranking only
 * without mutating underlying Deliverect catalogue data.
 */

export interface TypoAlias {
  id: string;
  typo: string; // e.g. "choclit"
  resolvesTo: string; // e.g. "chocolate"
  locale?: string;
  isActive: boolean;
}

export interface SearchSynonym {
  id: string;
  term: string; // e.g. "soda"
  synonyms: string[]; // e.g. ["pop", "cola", "carbonated drink"]
  isActive: boolean;
}

export interface QueryRewrite {
  id: string;
  incomingQuery: string; // e.g. "breakfast essentials"
  rewrittenQuery: string; // e.g. "bread eggs milk butter"
  isActive: boolean;
}

export interface PinnedSearchProduct {
  id: string;
  query: string; // e.g. "chocolate"
  productPlu: string;
  position: number; // 1-indexed pin rank
  isActive: boolean;
}

export interface ProductBoostRule {
  id: string;
  type: 'product' | 'category' | 'brand';
  targetId: string; // PLU, Category ID, or Brand name
  targetName?: string;
  boostMultiplier: number; // e.g. 1.5 (boost), 0.5 (demote)
  reason?: string;
  isActive: boolean;
}

export interface SearchOptimisationConfig {
  tenantId: string;
  locale: string;
  typoAliases: TypoAlias[];
  synonyms: SearchSynonym[];
  queryRewrites: QueryRewrite[];
  pinnedProducts: PinnedSearchProduct[];
  boostRules: ProductBoostRule[];
  excludedProductPlus: string[]; // PLUs filtered out completely from search
  updatedAt: string;
}
