import crypto from 'crypto';
import { FirestorePlatformService } from '../firestoreService';
import { WebhookService } from './WebhookService';
import { getDeliverectAdapter } from './index';
import { Money } from '../../src/domain/models';
import { isDemoMode } from '../runtimeMode';

export interface QuestSubstituteItem {
  plu: string;
  quantity: number;
  name: string;
  price: number;
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
        const adapter = getDeliverectAdapter();
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
        const rawCandidates = await this.rankSubstituteCandidates(
          (pickingItem as any).substituteCandidates || (pickingItem as any).candidates || [],
          plu,
          originalPrice?.amount,
          channelLinkId,
          tenantId
        );
        for (const c of rawCandidates) {
          candidates.push({
            plu: c.plu,
            name: c.name,
            approvedPrice:
              typeof c.price === 'number'
                ? { amount: c.price, currency: 'GBP' }
                : c.approvedPrice || (typeof c.price === 'object' ? c.price : undefined),
          });
        }
        if (candidates.length === 0 && pickingItem.preferredSubstitutePlu) {
          candidates.push({
            plu: pickingItem.preferredSubstitutePlu,
            name: pickingItem.preferredSubstituteName,
            approvedPrice: pickingItem.preferredSubstitutePrice,
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
    tenantId: string = 'brand-alpha'
  ): Promise<QuestSubstituteItem[]> {
    const policy = await this.getSubstitutionForPlu(orderId, plu, tenantId);
    if (!policy) return [];

    const candidates = Array.isArray((policy as any)?.candidates)
      ? (policy as any).candidates
      : [];

    return candidates
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
  }
}
