import crypto from 'crypto';
import { FirestorePlatformService } from '../firestoreService';
import { WebhookService } from './WebhookService';
import { getDeliverectAdapter } from './index';
import { Money } from '../../src/domain/models';
import type { Catalog, Product } from '../../src/commerce/models';
import { visualRulesToRetailRules } from '../../src/rules/visualRuleAdapter';
import { evaluateProductRules } from '../../src/rules/ProductRuleEvaluator';
import { isDemoMode } from '../runtimeMode';

export interface QuestSubstituteItem {
  plu: string;
  quantity: number;
  name: string;
  price: number;
}

export interface QuestSubstituteSearchOptions {
  searchPhrase?: string;
  isSubItem?: boolean;
  channelLinkId?: string;
}

interface CandidatePolicy {
  maxPriceIncreaseMinor: number;
  requireSharedCategory: boolean;
  maxCandidates: number;
  learnedPluAffinity: Record<string, string[]>;
}

interface ProductSubstitutionPolicy {
  neverSubstitute: boolean;
  maxPriceIncreaseMinor?: number;
  requireSameCategory?: boolean;
  preferredSubstitutePlus: string[];
}

export interface SubstitutionCallbackResponse {
  orderId: string;
  plu: string;
  preference: 'BEST_MATCH' | 'CUSTOMER_SELECTED' | 'REMOVE_IF_UNAVAILABLE' | 'CANCEL_ORDER_IF_UNAVAILABLE';
  substitutionPolicy?: 'BEST_MATCH' | 'CUSTOMER_SELECTED' | 'REMOVE_IF_UNAVAILABLE' | 'CANCEL_ORDER_IF_UNAVAILABLE';
  action: 'SUBSTITUTE' | 'REMOVE' | 'CANCEL_ORDER';
  pricePolicy?: 'LOWER_OF_ORIGINAL_OR_SUBSTITUTE' | 'SUBSTITUTE_PRICE' | 'CUSTOMER_APPROVED';
  originalPrice?: Money;
  allowPriceIncrease?: boolean;
  candidates?: Array<{
    plu: string;
    name?: string;
    approvedPrice?: Money;
  }>;
  instructions: string;
}

export class SubstitutionCallbackService {
  private static productPriceMinor(product?: Product): number | undefined {
    if (!product) return undefined;
    if (typeof product.price === 'number' && Number.isInteger(product.price)) return product.price;
    if (product.price && typeof product.price === 'object' && Number.isInteger(product.price.amount)) {
      return product.price.amount;
    }
    if (Number.isInteger(product.priceMinor)) return product.priceMinor;
    if (typeof product.basePrice === 'number' && Number.isInteger(product.basePrice)) return product.basePrice;
    if (product.basePrice && typeof product.basePrice === 'object' && Number.isInteger(product.basePrice.amount)) {
      return product.basePrice.amount;
    }
    return undefined;
  }

  private static categoryNames(catalog: Catalog): Map<string, string> {
    const names = new Map<string, string>();
    const visit = (categories: any[]) => {
      for (const category of categories || []) {
        const id = String(category?.id || category?._id || '').trim();
        if (id) names.set(id, String(category?.name || category?.title || '').trim());
        visit(Array.isArray(category?.children) ? category.children : []);
        visit(Array.isArray(category?.subcategories) ? category.subcategories : []);
      }
    };
    visit((catalog.categories || []) as any[]);
    return names;
  }

  /**
   * Products may only cross between unrestricted products, or remain inside the
   * same regulated class. This prevents an ordinary grocery item being replaced
   * with alcohol/tobacco (or vice versa), even if category data is incomplete.
   */
  private static regulatedClass(product: Product, categoryNames: Map<string, string>): 'ALCOHOL' | 'TOBACCO' | null {
    if (product.beverageInfo?.isAlcoholic === true || Number(product.beverageInfo?.alcoholByVolume || 0) > 0) {
      return 'ALCOHOL';
    }
    const labels = [
      ...(product.tags || []),
      ...(product.productTags || []).map(String),
      ...(product.displayLabels || []),
      ...(product.productTagLabels || []),
      ...(product.categoryIds || []).map((id) => categoryNames.get(id) || ''),
    ].join(' ').toLowerCase();
    if (/\b(alcohol|alcoholic|beer|wine|spirits?|cider|lager|vodka)\b/.test(labels)) return 'ALCOHOL';
    if (/\b(tobacco|cigarettes?|cigars?|nicotine|vapes?|vaping)\b/.test(labels)) return 'TOBACCO';
    return null;
  }

  private static tagTokens(product: Product): Set<string> {
    return new Set([
      ...(product.tags || []),
      ...(product.productTags || []),
      ...(product.productTagLabels || []),
      ...(product.displayLabels || []),
    ].map((value) => String(value).trim().toLowerCase()).filter(Boolean));
  }

  private static async productSubstitutionPolicy(
    tenantId: string,
    product: Product
  ): Promise<ProductSubstitutionPolicy> {
    const visualRules = await FirestorePlatformService.getTenantRules(tenantId).catch(() => []);
    const retailRules = visualRulesToRetailRules(visualRules.filter((rule: any) => rule?.enabled !== false));
    const decision = evaluateProductRules(product, retailRules);
    const matchedRuleIds = new Set(decision.appliedRuleIds);
    const matchingPolicies = retailRules
      .filter((rule) => matchedRuleIds.has(rule.id) && rule.actions.substitutionPolicy)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0))
      .map((rule) => rule.actions.substitutionPolicy!);
    const firstWith = <K extends keyof ProductSubstitutionPolicy>(key: K) =>
      matchingPolicies.find((policy) => policy[key] !== undefined)?.[key];
    return {
      neverSubstitute: matchingPolicies.some((policy) => policy.neverSubstitute === true),
      maxPriceIncreaseMinor: firstWith('maxPriceIncreaseMinor') as number | undefined,
      requireSameCategory: firstWith('requireSameCategory') as boolean | undefined,
      preferredSubstitutePlus: Array.from(new Set(
        matchingPolicies.flatMap((policy) => policy.preferredSubstitutePlus || []).map(String).filter(Boolean)
      )),
    };
  }

  private static async candidatePolicy(tenantId: string): Promise<CandidatePolicy> {
    const tenant = await FirestorePlatformService.getTenantConfig(tenantId).catch(() => null);
    const configured = tenant?.featureFlags?.substitutionCandidatePolicy;
    return {
      // Brands can set this to 0 for same/lower only, or another minor-unit
      // ceiling. Same/lower price is the safe default; a brand can explicitly
      // permit an uplift through Product Rules.
      maxPriceIncreaseMinor: Number.isInteger(configured?.maxPriceIncreaseMinor)
        ? Math.max(0, configured!.maxPriceIncreaseMinor!)
        : 0,
      requireSharedCategory: configured?.requireSharedCategory !== false,
      maxCandidates: Number.isInteger(configured?.maxCandidates)
        ? Math.min(50, Math.max(1, configured!.maxCandidates!))
        : 10,
      learnedPluAffinity:
        configured?.learnedPluAffinity && typeof configured.learnedPluAffinity === 'object'
          ? configured.learnedPluAffinity
          : {},
    };
  }

  private static async storeCatalogCandidates(params: {
    tenantId: string;
    channelLinkId?: string;
    originalPlu: string;
    originalPriceMinor?: number;
    chosen: QuestSubstituteItem[];
    searchPhrase?: string;
  }): Promise<QuestSubstituteItem[]> {
    if (!params.channelLinkId) return params.chosen;
    try {
      const adapter = getDeliverectAdapter(params.tenantId);
      const catalog = await adapter.getStoreCatalog(params.channelLinkId);
      const products = (catalog.products || []) as Product[];
      const original = products.find((product) => product.plu === params.originalPlu || product.id === params.originalPlu);
      if (!original) return params.chosen;

      const policy = await this.candidatePolicy(params.tenantId);
      const categoryNames = this.categoryNames(catalog);
      const originalCategories = new Set(original.categoryIds || []);
      const originalClass = this.regulatedClass(original, categoryNames);
      const originalTags = this.tagTokens(original);
      const originalPrice = params.originalPriceMinor ?? this.productPriceMinor(original);
      const phrase = String(params.searchPhrase || '').trim().toLowerCase();
      const productPolicy = await this.productSubstitutionPolicy(params.tenantId, original);
      if (productPolicy.neverSubstitute) return [];
      const maxPriceIncreaseMinor = productPolicy.maxPriceIncreaseMinor ?? policy.maxPriceIncreaseMinor;
      const requireSharedCategory = productPolicy.requireSameCategory ?? policy.requireSharedCategory;
      const learnedOrder = Array.from(new Set([
        ...productPolicy.preferredSubstitutePlus,
        ...(policy.learnedPluAffinity[original.plu] || []),
      ]));
      const learnedRank = new Map(learnedOrder.map((plu, index) => [String(plu), index]));

      const isAvailable = (product: Product) =>
        product.active !== false &&
        product.snoozed !== true &&
        product.isSnoozed !== true &&
        product.inStock !== false &&
        product.stockStatus !== 'OUT_OF_STOCK' &&
        !(product.stockQuantity !== null && product.stockQuantity !== undefined && product.stockQuantity <= 0);
      const isRegulatedMatch = (product: Product) =>
        this.regulatedClass(product, categoryNames) === originalClass;
      const isTagMatch = (product: Product) => {
        if (originalTags.size === 0) return true;
        const candidateTags = this.tagTokens(product);
        return [...originalTags].every((tag) => candidateTags.has(tag));
      };
      const sharedCategory = (product: Product) =>
        (product.categoryIds || []).some((id) => originalCategories.has(id));
      const matchesSearch = (product: Product) =>
        !phrase || [product.name, product.brand, product.plu]
          .some((value) => String(value || '').toLowerCase().includes(phrase));

      // A customer-selected item leads the list when it still exists at this
      // store and passes the regulated-product boundary. The explicit choice is
      // not discarded merely because it exceeds the automatic price/category
      // ceiling. It still must be available and remain inside tag/regulatory
      // safety boundaries. An explicit choice returns exactly one candidate.
      const byPlu = new Map(products.map((product) => [product.plu, product]));
      const chosen = params.chosen.filter((candidate) => {
        const product = byPlu.get(candidate.plu);
        return Boolean(product && isAvailable(product) && isRegulatedMatch(product) && isTagMatch(product));
      });
      if (chosen.length > 0) return chosen.slice(0, 1);
      const chosenPlus = new Set(chosen.map((candidate) => candidate.plu));

      const automatic = products
        .filter((product) => product.plu !== original.plu && !chosenPlus.has(product.plu))
        .filter(isAvailable)
        .filter(isRegulatedMatch)
        .filter(isTagMatch)
        .filter(matchesSearch)
        .filter((product) => !requireSharedCategory || sharedCategory(product))
        .filter((product) => {
          const price = this.productPriceMinor(product);
          return Number.isInteger(price) &&
            (!Number.isInteger(originalPrice) || price! <= originalPrice! + maxPriceIncreaseMinor);
        })
        .sort((a, b) => {
          const learnedA = learnedRank.has(a.plu) ? learnedRank.get(a.plu)! : Number.MAX_SAFE_INTEGER;
          const learnedB = learnedRank.has(b.plu) ? learnedRank.get(b.plu)! : Number.MAX_SAFE_INTEGER;
          if (learnedA !== learnedB) return learnedA - learnedB;
          const categoryA = sharedCategory(a) ? 0 : 1;
          const categoryB = sharedCategory(b) ? 0 : 1;
          if (categoryA !== categoryB) return categoryA - categoryB;
          const priceA = this.productPriceMinor(a) || 0;
          const priceB = this.productPriceMinor(b) || 0;
          return Math.abs(priceA - (originalPrice || 0)) - Math.abs(priceB - (originalPrice || 0));
        })
        .map((product) => ({
          plu: product.plu,
          quantity: 1,
          name: product.name || product.plu,
          price: this.productPriceMinor(product)!,
        }));

      return [...chosen, ...automatic].slice(0, policy.maxCandidates);
    } catch (error: any) {
      console.warn('[SubstitutionCallback] Store catalogue recommendation failed', {
        tenantId: params.tenantId,
        channelLinkId: params.channelLinkId,
        originalPlu: params.originalPlu,
        error: String(error?.message || error),
      });
      return params.chosen;
    }
  }

  /**
   * WH-04: Verifies signature for GET substitute callbacks.
   * In staging and production, unsigned callbacks MUST be rejected.
   * Supports Deliverect verified empty-body GET signing as well as path/query candidates.
   */
  static verifyGetSignature(
    path: string,
    query: Record<string, any>,
    headers: Record<string, string | string[] | undefined>,
    tenantId: string = 'brand-alpha',
    overrideSecret?: string
  ): boolean {
    const signature =
      (headers['x-server-authorization-hmac-sha256'] as string) ||
      (headers['x-deliverect-signature'] as string) ||
      (headers['x-signature'] as string) ||
      (query.signature as string);

    // Staging and production MUST reject unsigned callbacks.
    // Only permitted without signature in explicit demo mode.
    if (!signature) {
      if (isDemoMode()) {
        return true;
      }
      return false;
    }

    const secret = overrideSecret || WebhookService.getWebhookSecret(tenantId);
    if (!secret) {
      return false;
    }

    const cleanSignature = signature.replace(/^sha256=/i, '').trim();
    let bufA: Buffer;
    try {
      bufA = Buffer.from(cleanSignature, 'hex');
    } catch {
      return false;
    }

    // 1. Deliverect standard empty-body HMAC (verified contract for GET requests)
    const hmacEmpty = crypto.createHmac('sha256', secret).update('').digest('hex');
    const bufBEmpty = Buffer.from(hmacEmpty, 'hex');
    if (bufA.length === bufBEmpty.length && crypto.timingSafeEqual(bufA, bufBEmpty)) {
      return true;
    }

    // 2. Candidate: Raw path + query
    const queryString = Object.keys(query)
      .filter((k) => k !== 'signature')
      .sort()
      .map((k) => `${k}=${query[k]}`)
      .join('&');
    const pathWithQuery = queryString ? `${path}?${queryString}` : path;

    const hmac1 = crypto.createHmac('sha256', secret).update(pathWithQuery).digest('hex');
    const bufB1 = Buffer.from(hmac1, 'hex');
    if (bufA.length === bufB1.length && crypto.timingSafeEqual(bufA, bufB1)) {
      return true;
    }

    // 3. Candidate: Path alone
    const hmac2 = crypto.createHmac('sha256', secret).update(path).digest('hex');
    const bufB2 = Buffer.from(hmac2, 'hex');
    if (bufA.length === bufB2.length && crypto.timingSafeEqual(bufA, bufB2)) {
      return true;
    }

    return false;
  }

  /**
   * Best-effort re-ranking of Deliverect-supplied substitute candidates so the
   * picker sees the closest matches first: same category as the original
   * item, then within roughly +/-20% of its price. This only REORDERS —
   * Deliverect's DV-09 candidate schema is still unconfirmed (see
   * docs/DELIVERECT_VERIFICATION.md), so nothing here changes candidate
   * shape or drops a candidate Deliverect sent. Any catalog lookup failure
   * (unknown store, adapter error) falls back to the original order.
   */
  private static async rankSubstituteCandidates(
    rawCandidates: any[],
    originalPlu: string,
    originalPriceAmount: number | undefined,
    channelLinkId: string | undefined,
    tenantId: string
  ): Promise<any[]> {
    if (!Array.isArray(rawCandidates) || rawCandidates.length <= 1 || !channelLinkId) {
      return rawCandidates;
    }

    try {
      const adapter = getDeliverectAdapter(tenantId);
      const catalog = await adapter.getStoreCatalog(channelLinkId);
      const productsByPlu = new Map((catalog.products || []).map((p) => [p.plu, p]));

      const originalCategoryIds = new Set(productsByPlu.get(originalPlu)?.categoryIds || []);

      const priceOfProduct = (product?: { price?: any; priceMinor?: number }): number | undefined => {
        if (!product) return undefined;
        if (typeof product.price === 'number') return product.price;
        if (product.price && typeof product.price === 'object' && Number.isInteger((product.price as any).amount)) {
          return (product.price as any).amount;
        }
        return Number.isInteger(product.priceMinor) ? product.priceMinor : undefined;
      };

      const scored = rawCandidates.map((candidate, index) => {
        const product = candidate?.plu ? productsByPlu.get(candidate.plu) : undefined;
        const candidateCategoryIds = new Set(product?.categoryIds || []);
        const sameCategory =
          originalCategoryIds.size > 0 &&
          [...candidateCategoryIds].some((id) => originalCategoryIds.has(id));

        const candidatePrice =
          typeof candidate?.price === 'number'
            ? candidate.price
            : (candidate?.price?.amount ?? candidate?.approvedPrice?.amount ?? priceOfProduct(product));

        let priceDelta = Number.POSITIVE_INFINITY;
        if (typeof candidatePrice === 'number' && originalPriceAmount) {
          priceDelta = Math.abs(candidatePrice - originalPriceAmount) / originalPriceAmount;
        }
        const withinPriceBand = priceDelta <= 0.2;
        const rank = sameCategory && withinPriceBand ? 0 : sameCategory ? 1 : withinPriceBand ? 2 : 3;

        return { candidate, index, rank, priceDelta };
      });

      scored.sort((a, b) => {
        if (a.rank !== b.rank) return a.rank - b.rank;
        if (a.priceDelta !== b.priceDelta) return a.priceDelta - b.priceDelta;
        return a.index - b.index; // stable fallback
      });

      return scored.map((s) => s.candidate);
    } catch {
      return rawCandidates;
    }
  }

  /**
   * Resolves the substitution policy and candidates for a specific item in an order.
   */
  static async getSubstitutionForPlu(
    orderId: string,
    plu: string,
    tenantId: string = 'brand-alpha'
  ): Promise<SubstitutionCallbackResponse | null> {
    // 1. Fetch from Firestore order projection via universal correlation identifier lookup
    let orderProj = await FirestorePlatformService.getOrderProjectionByExternalIdentifier(orderId);
    if (!orderProj) {
      // Try by checkout ID or channel order reference
      const checkouts = await FirestorePlatformService.getCheckoutByReference(orderId);
      if (checkouts?.orderId) {
        orderProj = await FirestorePlatformService.getOrderProjectionByExternalIdentifier(checkouts.orderId);
      }
    }

    // 2. Fall back to Deliverect adapter if not yet projected in Firestore
    let adapterOrder: any = null;
    if (!orderProj) {
      try {
        const adapter = getDeliverectAdapter(tenantId);
        adapterOrder = await adapter.getOrder(orderId);
      } catch {
        // adapter may not find order
      }
    }

    if (!orderProj && !adapterOrder) {
      return null;
    }

    // 3. Find the line item
    let pickingItem = orderProj?.picking?.items?.find((i) => i.plu === plu || i.id === plu);
    const rawItemPrice = pickingItem?.originalPrice;
    let originalPrice: Money | undefined =
      typeof rawItemPrice === 'number'
        ? { amount: rawItemPrice, currency: 'GBP' }
        : rawItemPrice;

    if (!pickingItem && adapterOrder) {
      const basketItem = adapterOrder.originalBasket?.items?.find((i: any) => i.plu === plu || i.id === plu);
      if (basketItem) {
        pickingItem = {
          id: basketItem.id || `item_${basketItem.plu}`,
          plu: basketItem.plu,
          name: basketItem.name,
          originalQuantity: basketItem.quantity,
          pickedQuantity: 0,
          originalPrice: basketItem.price,
          finalPrice: basketItem.price,
          state: 'PENDING',
          substitutionPreference: basketItem.substitutionPreference || 'BEST_MATCH',
          preferredSubstitutePlu: (basketItem as any).preferredSubstitutePlu,
          preferredSubstituteName: (basketItem as any).preferredSubstituteName,
          preferredSubstitutePrice: (basketItem as any).preferredSubstitutePrice,
        } as any;
        originalPrice =
          typeof basketItem.price === 'number'
            ? { amount: basketItem.price, currency: 'GBP' }
            : basketItem.price;
      }
    }

    if (!pickingItem) {
      return null;
    }

    // Deliverect may identify the order line by its internal item id rather
    // than by PLU. Once the line is resolved, all catalogue work uses the
    // actual PLU.
    plu = String(pickingItem.plu || plu).trim();

    const pref = pickingItem.substitutionPreference || 'BEST_MATCH';
    const channelLinkId = orderProj?.channelLinkId || adapterOrder?.storeId;

    // 4. Build response according to platform rules
    switch (pref) {
      case 'BEST_MATCH': {
        const bestMatchCandidates: Array<{ plu: string; name?: string; approvedPrice?: Money }> = [];
        const rawBestMatchCandidates = await this.rankSubstituteCandidates(
          (pickingItem as any).substituteCandidates || (pickingItem as any).candidates || [],
          plu,
          originalPrice?.amount,
          channelLinkId,
          tenantId
        );
        for (const c of rawBestMatchCandidates) {
          bestMatchCandidates.push({
            plu: c.plu,
            name: c.name,
            approvedPrice:
              typeof c.price === 'number'
                ? { amount: c.price, currency: 'GBP' }
                : c.approvedPrice || (typeof c.price === 'object' ? c.price : undefined),
          });
        }
        if (bestMatchCandidates.length === 0 && pickingItem.preferredSubstitutePlu) {
          bestMatchCandidates.push({
            plu: pickingItem.preferredSubstitutePlu,
            name: pickingItem.preferredSubstituteName,
            approvedPrice: originalPrice,
          });
        }
        return {
          orderId,
          plu,
          preference: 'BEST_MATCH',
          substitutionPolicy: 'BEST_MATCH',
          action: 'SUBSTITUTE',
          pricePolicy: 'LOWER_OF_ORIGINAL_OR_SUBSTITUTE',
          originalPrice: originalPrice || { amount: 0, currency: 'GBP' },
          allowPriceIncrease: false,
          candidates: bestMatchCandidates.length > 0 ? bestMatchCandidates : undefined,
          instructions:
            'Select best matching alternative. Customer pays lower of original or substitute price (Best-Match Price Guarantee).',
        };
      }

      case 'CUSTOMER_SELECTED': {
        const candidates: Array<{ plu: string; name?: string; approvedPrice?: Money }> = [];
        const preferredPlu = String(pickingItem.preferredSubstitutePlu || '').trim();
        const rawCandidates = [
          ...((pickingItem as any).substituteCandidates || (pickingItem as any).candidates || []),
        ];

        // CUSTOMER_SELECTED is a singular customer instruction, not a ranked
        // recommendation mode. Returning the whole saved candidate set made
        // Quest show every possible substitute even after the customer chose
        // one. Preserve only the selected PLU here; availability and regulated
        // product boundaries are still enforced against the store catalogue in
        // storeCatalogCandidates(). If no explicit choice survived checkout,
        // leave the list empty so the governed automatic fallback can run.
        const selected = preferredPlu
          ? rawCandidates.find((candidate: any) => String(candidate?.plu || '').trim() === preferredPlu)
          : undefined;

        if (preferredPlu) {
          const selectedPrice =
            (pickingItem as any).preferredSubstitutePrice ??
            selected?.price ??
            selected?.approvedPrice;
          candidates.push({
            plu: preferredPlu,
            name: pickingItem.preferredSubstituteName || selected?.name,
            approvedPrice:
              typeof selectedPrice === 'number'
                ? { amount: selectedPrice, currency: 'GBP' }
                : selectedPrice || originalPrice,
          });
        }
        return {
          orderId,
          plu,
          preference: 'CUSTOMER_SELECTED',
          substitutionPolicy: 'CUSTOMER_SELECTED',
          action: 'SUBSTITUTE',
          pricePolicy: 'CUSTOMER_APPROVED',
          originalPrice: originalPrice || { amount: 0, currency: 'GBP' },
          candidates,
          instructions:
            candidates.length > 0
              ? `Customer has approved replacement: ${candidates.map((c) => c.name || c.plu).join(', ')}.`
              : 'Customer requested substitution from approved candidates, but no candidate was pre-selected. Default to Best Match.',
        };
      }

      case 'DO_NOT_SUBSTITUTE':
      case 'REMOVE_IF_UNAVAILABLE':
        return {
          orderId,
          plu,
          preference: 'REMOVE_IF_UNAVAILABLE',
          substitutionPolicy: 'REMOVE_IF_UNAVAILABLE',
          action: 'REMOVE',
          originalPrice: originalPrice || { amount: 0, currency: 'GBP' },
          instructions: 'Item is unavailable and customer explicitly requested removal without replacement.',
        };

      case 'CANCEL_ORDER_IF_UNAVAILABLE':
        return {
          orderId,
          plu,
          preference: 'CANCEL_ORDER_IF_UNAVAILABLE',
          substitutionPolicy: 'CANCEL_ORDER_IF_UNAVAILABLE',
          action: 'CANCEL_ORDER',
          originalPrice: originalPrice || { amount: 0, currency: 'GBP' },
          instructions: 'Customer opted to cancel the entire order if this required item is unavailable.',
        };

      default:
        return {
          orderId,
          plu,
          preference: 'BEST_MATCH',
          substitutionPolicy: 'BEST_MATCH',
          action: 'SUBSTITUTE',
          pricePolicy: 'LOWER_OF_ORIGINAL_OR_SUBSTITUTE',
          originalPrice: originalPrice || { amount: 0, currency: 'GBP' },
          allowPriceIncrease: false,
          instructions: 'Select best matching alternative.',
        };
    }
  }

  static async getQuestSubstituteCandidates(
    orderId: string,
    plu: string,
    tenantId: string = 'brand-alpha',
    options: QuestSubstituteSearchOptions = {}
  ): Promise<QuestSubstituteItem[]> {
    const policy = await this.getSubstitutionForPlu(orderId, plu, tenantId);
    if (!policy) return [];

    const candidates = Array.isArray((policy as any)?.candidates)
      ? (policy as any).candidates
      : [];

    const chosen = candidates
      .map((candidate: any) => {
        const amount =
          candidate?.price?.amount ??
          candidate?.approvedPrice?.amount ??
          candidate?.priceMinor;

        if (!candidate?.plu || !Number.isInteger(amount)) return null;

        return {
          plu: String(candidate.plu),
          quantity:
            Number.isInteger(candidate.quantity) && candidate.quantity > 0
              ? candidate.quantity
              : 1,
          name: String(candidate.name || candidate.plu),
          price: amount,
        } satisfies QuestSubstituteItem;
      })
      .filter(Boolean) as QuestSubstituteItem[];

    if (policy.action !== 'SUBSTITUTE') return [];

    const orderProj = await FirestorePlatformService.getOrderProjectionByExternalIdentifier(orderId);
    return this.storeCatalogCandidates({
      tenantId,
      channelLinkId: orderProj?.channelLinkId || options.channelLinkId,
      originalPlu: policy.plu,
      originalPriceMinor: policy.originalPrice?.amount,
      chosen,
      searchPhrase: options.searchPhrase,
    });
  }
}
