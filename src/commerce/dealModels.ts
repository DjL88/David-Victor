import { Product, Story, CategoryPromoBanner, StoryStockMatchMode } from './models';

export type DeliverectDealType = 'MEAL_DEAL' | 'MULTIBUY' | 'BUNDLE';

export interface DeliverectDealSlot {
  name: string; // e.g. "Main Dish", "Snack or Crisps", "Drink"
  description?: string;
  allowedPlus: string[];
}

export interface DeliverectDeal {
  id: string;
  externalDeliverectId?: string;
  type: DeliverectDealType;
  title: string;
  subtitle?: string;
  badge: string; // e.g. "Meal Deal £9.95", "Multi-Buy: 2 for £3", "Bundle • Save £4.20"
  description: string;
  imageUrl: string;
  dealPrice: number;
  originalPrice: number;
  savings: number;
  stockMatchMode: StoryStockMatchMode; // 'AND' = all required, 'OR' = any eligible flavour/item
  linkedProductPlus: string[];
  slots?: DeliverectDealSlot[];
  deliverectTags: string[];
  termsAndConditions?: string;
}

/**
 * Deliverect Meal Deals, Bundles and Multi-buys configured
 * through Deliverect POS/Menu Management or Admin CMS.
 * Fake/mock deals are purged so only verified or user-configured deals are presented.
 */
export let DELIVERECT_CATALOG_DEALS: DeliverectDeal[] = [];

export function getCatalogDeals(): DeliverectDeal[] {
  return [...DELIVERECT_CATALOG_DEALS];
}

export function saveCatalogDeal(deal: DeliverectDeal): void {
  const idx = DELIVERECT_CATALOG_DEALS.findIndex((d) => d.id === deal.id);
  if (idx >= 0) {
    DELIVERECT_CATALOG_DEALS[idx] = deal;
  } else {
    DELIVERECT_CATALOG_DEALS.push(deal);
  }
}

export function deleteCatalogDeal(dealId: string): void {
  DELIVERECT_CATALOG_DEALS = DELIVERECT_CATALOG_DEALS.filter((d) => d.id !== dealId);
}

export function purgeDeals(): void {
  DELIVERECT_CATALOG_DEALS = [];
}

/**
 * Find a genuine Deliverect deal matching a story.
 * Only returns a deal if explicitly linked to an authoritative Deliverect Combo / Bundle ID
 * or an explicit catalog deal. Returns null for ordinary shopping list stories/promotions.
 */
export function getDealForStory(
  story: Story,
  _products: Product[]
): DeliverectDeal | null {
  const linkedBundleId = (story as any).linkedBundleId;
  if (linkedBundleId) {
    const existing = DELIVERECT_CATALOG_DEALS.find((deal) => {
      return deal.id === linkedBundleId || deal.externalDeliverectId === linkedBundleId;
    });
    if (existing) return existing;
  }

  if (!story.linkedProductPlus || story.linkedProductPlus.length === 0) {
    return null;
  }

  // Check if an explicit catalog deal matches the linked PLUs
  const existing = DELIVERECT_CATALOG_DEALS.find((deal) => {
    return (
      deal.linkedProductPlus.length === story.linkedProductPlus?.length &&
      deal.linkedProductPlus.every((plu) => story.linkedProductPlus?.includes(plu))
    );
  });
  if (existing) return existing;

  // Do NOT synthesize fake deals for ordinary stories with linked products
  return null;
}

/**
 * Find a genuine Deliverect deal matching a promotional banner.
 * Only returns a deal if explicitly linked to an authoritative Deliverect Combo / Bundle ID
 * or an explicit catalog deal. Returns null for ordinary shopping list promotions.
 */
export function getDealForBanner(
  banner: CategoryPromoBanner,
  _products: Product[]
): DeliverectDeal | null {
  const linkedBundleId = (banner as any).linkedBundleId;
  if (linkedBundleId) {
    const existing = DELIVERECT_CATALOG_DEALS.find((deal) => {
      return deal.id === linkedBundleId || deal.externalDeliverectId === linkedBundleId;
    });
    if (existing) return existing;
  }

  if (!banner.linkedProductPlus || banner.linkedProductPlus.length === 0) {
    return null;
  }

  // Check if an explicit catalog deal matches the linked PLUs
  const existing = DELIVERECT_CATALOG_DEALS.find((deal) => {
    return (
      deal.linkedProductPlus.length === banner.linkedProductPlus?.length &&
      deal.linkedProductPlus.every((plu) => banner.linkedProductPlus?.includes(plu))
    );
  });
  if (existing) return existing;

  // Do NOT synthesize fake deals for ordinary banners with linked products
  return null;
}

/**
 * Resolves full Product entities for a given Deliverect deal
 */
export function getProductsForDeal(deal: DeliverectDeal, products: Product[]): Product[] {
  return deal.linkedProductPlus
    .map((plu) => products.find((p) => p.plu === plu))
    .filter((p): p is Product => Boolean(p));
}
