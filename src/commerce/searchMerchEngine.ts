import { Product } from './models';
import { SearchOptimisationConfig } from './searchMerchModels';

export interface MerchandisedSearchResult {
  product: Product;
  score: number;
  isPinned?: boolean;
  pinPosition?: number;
  boostApplied?: number;
  matchType?: 'exact' | 'synonym' | 'typo_alias' | 'pinned';
}

export interface SearchResolutionInfo {
  originalQuery: string;
  normalizedQuery: string;
  isCorrected: boolean;
  correctedFrom?: string;
  correctedTo?: string;
  rewrittenFrom?: string;
}

export function resolveSearchQueryInfo(
  rawQuery: string,
  config: SearchOptimisationConfig = getActiveSearchConfig()
): SearchResolutionInfo {
  const originalQuery = rawQuery.trim();
  if (!originalQuery) {
    return { originalQuery: '', normalizedQuery: '', isCorrected: false };
  }

  let normalizedQuery = originalQuery.toLowerCase();
  let correctedFrom: string | undefined;
  let correctedTo: string | undefined;

  // 1. Check Typo Aliases (e.g. "choclit" -> "chocolate")
  if (config?.typoAliases) {
    for (const alias of config.typoAliases) {
      if (!alias.isActive) continue;
      const typoLower = alias.typo.toLowerCase();
      const resolvesLower = alias.resolvesTo.toLowerCase();

      if (normalizedQuery === typoLower) {
        correctedFrom = alias.typo;
        correctedTo = alias.resolvesTo;
        normalizedQuery = resolvesLower;
        break;
      } else if (normalizedQuery.includes(typoLower)) {
        const regex = new RegExp(`\\b${typoLower}\\b`, 'gi');
        if (regex.test(normalizedQuery)) {
          correctedFrom = alias.typo;
          correctedTo = alias.resolvesTo;
          normalizedQuery = normalizedQuery.replace(regex, resolvesLower);
        }
      }
    }
  }

  // 2. Check Query Rewrites (e.g. "breakfast essentials" -> "bread eggs milk butter")
  let rewrittenFrom: string | undefined;
  if (config?.queryRewrites) {
    const rewrite = config.queryRewrites.find(
      (r) => r.isActive && r.incomingQuery.toLowerCase() === normalizedQuery
    );
    if (rewrite) {
      rewrittenFrom = rewrite.incomingQuery;
      normalizedQuery = rewrite.rewrittenQuery.toLowerCase();
    }
  }

  return {
    originalQuery,
    normalizedQuery,
    isCorrected: Boolean(correctedFrom),
    correctedFrom,
    correctedTo,
    rewrittenFrom,
  };
}

/**
 * Applies search merchandising and ranking rules.
 * Never mutates Deliverect product entities. Affects ranking order only.
 */
export function applySearchMerchandising(
  products: Product[],
  rawQuery: string,
  config: SearchOptimisationConfig = getActiveSearchConfig()
): MerchandisedSearchResult[] {
  if (!rawQuery.trim()) {
    return products.map((p) => ({ product: p, score: 1 }));
  }

  const queryInfo = resolveSearchQueryInfo(rawQuery, config);
  const normalizedQuery = queryInfo.normalizedQuery;

  // 3. Collect search tokens including synonyms
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  const expandedTokens = new Set<string>(tokens);

  if (config?.synonyms) {
    config.synonyms.forEach((syn) => {
      if (!syn.isActive) return;
      const termLower = syn.term.toLowerCase();
      if (tokens.includes(termLower)) {
        syn.synonyms.forEach((s) => expandedTokens.add(s.toLowerCase()));
      }
      // Also reverse synonym check
      if (syn.synonyms.some((s) => tokens.includes(s.toLowerCase()))) {
        expandedTokens.add(termLower);
      }
    });
  }

  // 4. Filter out excluded products
  const excludedSet = new Set(config?.excludedProductPlus || []);
  const eligibleProducts = products.filter((p) => !excludedSet.has(p.plu));

  // 5. Calculate base score and merchandising boosts
  const scoredResults: MerchandisedSearchResult[] = [];

  eligibleProducts.forEach((product) => {
    if (!product) return;
    let score = 0;
    const nameLower = (product.name || '').toLowerCase();
    const descLower = (product.description || '').toLowerCase();
    const brandLower = (product.brand || '').toLowerCase();
    const categoriesLower = (product.categoryIds || []).join(' ').toLowerCase();
    const labelsLower = (product.displayLabels || []).join(' ').toLowerCase();
    const tagsLower = (product.productTags || []).join(' ').toLowerCase();
    const gtinLower = (product.gtin || []).join(' ').toLowerCase();
    const pluLower = (product.plu || '').toLowerCase();

    // Check matches against tokens
    let matched = false;
    for (const token of expandedTokens) {
      if (nameLower.includes(token)) {
        score += 10;
        matched = true;
      }
      if (brandLower.includes(token)) {
        score += 8;
        matched = true;
      }
      if (categoriesLower.includes(token) || labelsLower.includes(token) || tagsLower.includes(token)) {
        score += 5;
        matched = true;
      }
      if (gtinLower.includes(token) || pluLower.includes(token)) {
        score += 15;
        matched = true;
      }
      if (descLower.includes(token)) {
        score += 2;
        matched = true;
      }
    }

    if (!matched) {
      return; // Not relevant to query
    }

    // Apply Boost Rules
    let totalMultiplier = 1.0;
    if (config?.boostRules) {
      config.boostRules.forEach((rule) => {
        if (!rule.isActive) return;
        if (rule.type === 'product' && rule.targetId === product.plu) {
          totalMultiplier *= rule.boostMultiplier;
        } else if (
          rule.type === 'category' &&
          (product.categoryIds || []).some((c) => c.toLowerCase() === rule.targetId.toLowerCase())
        ) {
          totalMultiplier *= rule.boostMultiplier;
        }
      });
    }

    score *= totalMultiplier;

    scoredResults.push({
      product,
      score,
      boostApplied: totalMultiplier !== 1.0 ? totalMultiplier : undefined,
      matchType: queryInfo.isCorrected ? 'typo_alias' : 'exact',
    });
  });

  // Sort by score descending
  scoredResults.sort((a, b) => b.score - a.score);

  // 6. Apply Pinned Products
  if (config?.pinnedProducts) {
    const pinsForQuery = config.pinnedProducts
      .filter((p) => p.isActive && (
        p.query.toLowerCase() === rawQuery.trim().toLowerCase() ||
        p.query.toLowerCase() === normalizedQuery
      ))
      .sort((a, b) => a.position - b.position);

    for (const pin of pinsForQuery) {
      const existingIdx = scoredResults.findIndex((r) => r.product.plu === pin.productPlu);
      let pinnedItem: MerchandisedSearchResult;

      if (existingIdx >= 0) {
        pinnedItem = scoredResults.splice(existingIdx, 1)[0];
      } else {
        const prod = products.find((p) => p.plu === pin.productPlu);
        if (prod && !excludedSet.has(prod.plu)) {
          pinnedItem = { product: prod, score: 9999 };
        } else {
          continue;
        }
      }

      pinnedItem.isPinned = true;
      pinnedItem.pinPosition = pin.position;
      pinnedItem.matchType = 'pinned';

      const insertIdx = Math.min(pin.position - 1, scoredResults.length);
      scoredResults.splice(insertIdx, 0, pinnedItem);
    }
  }

  return scoredResults;
}

export const DEFAULT_SEARCH_CONFIG: SearchOptimisationConfig = {
  tenantId: 'brand-alpha',
  locale: 'en-GB',
  typoAliases: [
    { id: 'typo-1', typo: 'choclit', resolvesTo: 'chocolate', isActive: true },
    { id: 'typo-2', typo: 'sourdow', resolvesTo: 'sourdough', isActive: true },
    { id: 'typo-3', typo: 'chese', resolvesTo: 'cheese', isActive: true },
  ],
  synonyms: [
    { id: 'syn-1', term: 'soda', synonyms: ['pop', 'cola', 'fizzy drink'], isActive: true },
    { id: 'syn-2', term: 'milk', synonyms: ['dairy', 'oat milk', 'almond milk'], isActive: true },
    { id: 'syn-3', term: 'bread', synonyms: ['loaf', 'sourdough', 'baguette', 'bakery'], isActive: true },
  ],
  queryRewrites: [
    { id: 'qr-1', incomingQuery: 'breakfast essentials', rewrittenQuery: 'bread eggs milk butter', isActive: true },
    { id: 'qr-2', incomingQuery: 'evening snack', rewrittenQuery: 'chips crisps chocolate dip', isActive: true },
  ],
  pinnedProducts: [
    { id: 'pin-1', query: 'chocolate', productPlu: 'PLU-ART-001', position: 1, isActive: true },
  ],
  boostRules: [
    { id: 'boost-1', type: 'category', targetId: 'Bakery', targetName: 'Bakery', boostMultiplier: 1.4, isActive: true },
    { id: 'boost-2', type: 'product', targetId: 'PLU-SOURDOUGH-01', targetName: 'Slow Fermented Sourdough', boostMultiplier: 1.5, isActive: true },
  ],
  excludedProductPlus: [],
  updatedAt: new Date().toISOString(),
};

let currentSearchConfig: SearchOptimisationConfig = { ...DEFAULT_SEARCH_CONFIG };

export function getActiveSearchConfig(): SearchOptimisationConfig {
  return currentSearchConfig;
}

export function setActiveSearchConfig(config: SearchOptimisationConfig): void {
  currentSearchConfig = config;
}
