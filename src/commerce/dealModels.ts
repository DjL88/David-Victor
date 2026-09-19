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
 * Find or create a Deliverect deal matching a story
 */
export function getDealForStory(
  story: Story,
  _products: Product[]
): DeliverectDeal | null {
  if (!story.linkedProductPlus || story.linkedProductPlus.length === 0) {
    return null;
  }

  // 1. Exact match with a catalog deal
  const existing = DELIVERECT_CATALOG_DEALS.find((deal) => {
    return (
      deal.linkedProductPlus.length === story.linkedProductPlus?.length &&
      deal.linkedProductPlus.every((plu) => story.linkedProductPlus?.includes(plu))
    );
  });
  if (existing) return existing;

  // 2. Synthesize Deliverect deal from Story metadata
  const isAnd = story.stockMatchMode === 'AND';
  return {
    id: `deal-story-${story.id}`,
    type: isAnd ? 'MEAL_DEAL' : 'MULTIBUY',
    title: story.title,
    subtitle: story.caption || 'Special Deliverect offer',
    badge: story.tag || (isAnd ? 'Combo Deal' : 'Combo Deal (Multi-Buy)'),
    description: story.caption || 'Selected participating items from Deliverect catalog.',
    imageUrl: story.mediaUrl || story.thumbnailUrl || '',
    dealPrice: isAnd ? 9.95 : 3.00,
    originalPrice: isAnd ? 13.45 : 3.80,
    savings: isAnd ? 3.50 : 0.80,
    stockMatchMode: story.stockMatchMode || (isAnd ? 'AND' : 'OR'),
    linkedProductPlus: story.linkedProductPlus,
    deliverectTags: isAnd ? ['meal_deal', 'story_bundle'] : ['multibuy', 'story_promo'],
  };
}

/**
 * Find or create a Deliverect deal matching a promotional banner
 */
export function getDealForBanner(
  banner: CategoryPromoBanner,
  _products: Product[]
): DeliverectDeal | null {
  if (!banner.linkedProductPlus || banner.linkedProductPlus.length === 0) {
    return null;
  }

  const existing = DELIVERECT_CATALOG_DEALS.find((deal) => {
    return (
      deal.linkedProductPlus.length === banner.linkedProductPlus?.length &&
      deal.linkedProductPlus.every((plu) => banner.linkedProductPlus?.includes(plu))
    );
  });
  if (existing) return existing;

  const isAnd = banner.stockMatchMode === 'AND';
  return {
    id: `deal-banner-${banner.id}`,
    type: isAnd ? 'MEAL_DEAL' : 'MULTIBUY',
    title: banner.title,
    subtitle: banner.subtitle,
    badge: banner.badge || (isAnd ? 'Combo Deal' : 'Combo Deal (Multi-Buy)'),
    description: banner.subtitle,
    imageUrl: banner.backgroundImageUrl,
    dealPrice: isAnd ? 9.95 : 3.00,
    originalPrice: isAnd ? 13.45 : 3.80,
    savings: isAnd ? 3.50 : 0.80,
    stockMatchMode: banner.stockMatchMode || (isAnd ? 'AND' : 'OR'),
    linkedProductPlus: banner.linkedProductPlus,
    deliverectTags: isAnd ? ['meal_deal', 'banner_combo'] : ['multibuy', 'banner_promo'],
  };
}

/**
 * Resolves full Product entities for a given Deliverect deal
 */
export function getProductsForDeal(deal: DeliverectDeal, products: Product[]): Product[] {
  return deal.linkedProductPlus
    .map((plu) => products.find((p) => p.plu === plu))
    .filter((p): p is Product => Boolean(p));
}
