import { CategoryPromoBanner, Category, Product } from './models';
import { defaultAdminClient } from './HttpAdminClient';
import { isDemoMode } from '../domain/runtime';

export const DEFAULT_PROMO_BANNERS: CategoryPromoBanner[] = [
  // GLOBAL / HOME BANNERS (When on All Categories / Home)
  {
    id: 'banner-home-courier',
    categoryId: undefined,
    categorySlugMatch: 'all',
    badge: 'Express Delivery • 15–25 Mins',
    title: 'Fresh Groceries Delivered in Minutes',
    subtitle: 'Woodfired sourdough pizzas, handpicked British berries, bakery warm from the oven and cold drinks right to your door.',
    backgroundImageUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1600&auto=format&fit=crop&q=85',
    buttonLabel: 'Select Nearby Store',
    actionType: 'STORE_PICKER',
  },
  {
    id: 'banner-home-meal-deal',
    categoryId: undefined,
    categorySlugMatch: 'all',
    badge: 'Trending Combo • Save £3.50',
    title: 'Artisan Evening Meal Deal £9.95',
    subtitle: 'Hand-stretched sourdough Margherita, artisan potato crisps & cold craft beer. Stock verified across local branches.',
    backgroundImageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=1600&auto=format&fit=crop&q=85',
    buttonLabel: 'Order Meal Deal',
    actionType: 'PRODUCT',
    targetPlu: 'PLU-PIZZA-MARGHERITA-WOODFIRED',
    linkedProductPlus: [
      'PLU-PIZZA-MARGHERITA-WOODFIRED',
      'PLU-CRISPS-SEA-SALT-CIDER-150G',
      'PLU-BEER-VERDANT-LIGHTBULB-440ML',
    ],
    stockMatchMode: 'AND',
  },

  // SNACKS & CRISPS BANNERS (Shown when filtered into Snacks / Crisps)
  {
    id: 'banner-snacks-walkers-lays',
    categoryId: 'cat-snacks-confectionery',
    categorySlugMatch: 'snack',
    badge: 'Brand Spotlight • Walkers & Lays',
    title: 'Walkers Sensations & Lays Reserve Crisps',
    subtitle: 'Hand-cooked crunch in Thai Sweet Chilli, Roasted Chicken & Sea Salt Cider Vinegar. Multi-buy deal: 2 for £3.00.',
    backgroundImageUrl: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=1600&auto=format&fit=crop&q=85',
    buttonLabel: 'Shop Crisps Range • From £1.80',
    actionType: 'PRODUCT',
    targetPlu: 'PLU-CRISPS-SEA-SALT-CIDER-150G',
    linkedProductPlus: [
      'PLU-CRISPS-SEA-SALT-CIDER-150G',
      'PLU-CRISPS-TRUFFLE-ROSEMARY-150G',
    ],
    stockMatchMode: 'OR',
  },
  {
    id: 'banner-snacks-doritos-dip',
    categoryId: 'cat-snacks-confectionery',
    categorySlugMatch: 'snack',
    badge: 'Snack Combo Deal',
    title: 'Doritos Tangy Cheese & Chunky Salsa',
    subtitle: 'Loaded tortilla corn chips paired with mild tomato salsa. Essential pairing for matchday or movie night.',
    backgroundImageUrl: 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?w=1600&auto=format&fit=crop&q=85',
    buttonLabel: 'Grab Doritos Combo • £3.20',
    actionType: 'CATEGORY',
    targetCategoryId: 'cat-snacks-confectionery',
    linkedProductPlus: [
      'PLU-CRISPS-SEA-SALT-CIDER-150G',
    ],
    stockMatchMode: 'OR',
  },
  {
    id: 'banner-snacks-sweet-chocolate',
    categoryId: 'cat-snacks-confectionery',
    categorySlugMatch: 'snack',
    badge: 'Artisan Confectionery',
    title: 'Single-Origin Chocolates & Salted Nuts',
    subtitle: '70% dark cocoa bars, sea salt roasted almonds, and luxury brownies fresh from the patisserie.',
    backgroundImageUrl: 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?w=1600&auto=format&fit=crop&q=85',
    buttonLabel: 'Explore Sweet Treats',
    actionType: 'CATEGORY',
    targetCategoryId: 'cat-snacks-chocolate',
    linkedProductPlus: [
      'PLU-FUDGE-BROWNIES-4PK',
      'PLU-COOKIES-CHOC-CHIP-4PK',
    ],
    stockMatchMode: 'OR',
  },

  // BAKERY & BREAD BANNERS
  {
    id: 'banner-bakery-sourdough',
    categoryId: 'cat-fresh-bakery',
    categorySlugMatch: 'baker',
    badge: 'Morning Bake • Fresh Today',
    title: 'Slow-Fermented Artisan Sourdough',
    subtitle: 'Stoneground organic flour, 36-hour slow fermentation with blistered crust. Delivered warm before breakfast.',
    backgroundImageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=1600&auto=format&fit=crop&q=85',
    buttonLabel: 'Order Sourdough • £3.40',
    actionType: 'PRODUCT',
    targetPlu: 'PLU-SOURDOUGH-BOULE-800G',
    linkedProductPlus: [
      'PLU-SOURDOUGH-BOULE-800G',
      'PLU-CROISSANT-ALL-BUTTER-2PK',
    ],
    stockMatchMode: 'OR',
  },
  {
    id: 'banner-bakery-pastries',
    categoryId: 'cat-fresh-bakery',
    categorySlugMatch: 'baker',
    badge: 'French Patisserie',
    title: 'All-Butter Viennoiserie & Pain au Chocolat',
    subtitle: 'Flaky French butter croissants and rich Belgian chocolate batons. Pairs effortlessly with fresh morning roast.',
    backgroundImageUrl: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=1600&auto=format&fit=crop&q=85',
    buttonLabel: 'Shop Morning Pastries',
    actionType: 'CATEGORY',
    targetCategoryId: 'cat-fresh-bakery',
    linkedProductPlus: [
      'PLU-CROISSANT-ALL-BUTTER-2PK',
      'PLU-PAIN-AU-CHOCOLAT-2PK',
    ],
    stockMatchMode: 'OR',
  },

  // DRINKS & ALCOHOL BANNERS
  {
    id: 'banner-drinks-craft-beer',
    categoryId: 'cat-beer-wine-spirits',
    categorySlugMatch: 'beer',
    badge: 'Chilled Delivery • 18+ Only',
    title: 'Juicy Hazy IPAs & Cold Session Ciders',
    subtitle: 'Direct from independent breweries. Delivered refrigerated to your doorstep in 20 minutes.',
    backgroundImageUrl: 'https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=1600&auto=format&fit=crop&q=85',
    buttonLabel: 'Browse Cold Beers • From £3.20',
    actionType: 'PRODUCT',
    targetPlu: 'PLU-BEER-VERDANT-LIGHTBULB-440ML',
    linkedProductPlus: [
      'PLU-BEER-VERDANT-LIGHTBULB-440ML',
    ],
    stockMatchMode: 'OR',
  },
  {
    id: 'banner-drinks-cellar-wine',
    categoryId: 'cat-beer-wine-spirits',
    categorySlugMatch: 'wine',
    badge: 'Sommelier Reserve',
    title: 'Natural Wines & Provence Rosé',
    subtitle: 'Organic Burgundy Chablis, vintage Rioja Reserva, and pale Provence rosés curated for discerning tables.',
    backgroundImageUrl: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1600&auto=format&fit=crop&q=85',
    buttonLabel: 'View Wine Cellar',
    actionType: 'PRODUCT',
    targetPlu: 'PLU-WINE-CHABLIS-ORGANIC-75CL',
    linkedProductPlus: [
      'PLU-WINE-CHABLIS-ORGANIC-75CL',
      'PLU-WINE-RIOJA-RESERVA-75CL',
    ],
    stockMatchMode: 'OR',
  },

  // FRESH PRODUCE BANNERS
  {
    id: 'banner-produce-berries',
    categoryId: 'cat-fresh-produce',
    categorySlugMatch: 'produce',
    badge: 'Farm Direct Harvest',
    title: 'Fragrant British Strawberries & Blueberries',
    subtitle: 'Picked this morning from local Essex & Kent fruit growers. Sweet, vibrant, and packed with vitamins.',
    backgroundImageUrl: 'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?w=1600&auto=format&fit=crop&q=85',
    buttonLabel: 'Grab Fresh Berries • £2.50',
    actionType: 'PRODUCT',
    targetPlu: 'PLU-STRAWBERRY-400G',
    linkedProductPlus: [
      'PLU-STRAWBERRY-400G',
      'PLU-RASPBERRY-150G',
    ],
    stockMatchMode: 'OR',
  },
  {
    id: 'banner-produce-organic-veg',
    categoryId: 'cat-fresh-produce',
    categorySlugMatch: 'produce',
    badge: 'Soil Association Certified',
    title: 'Heritage Organic Greens & Living Herbs',
    subtitle: 'Wild baby rocket, living potted basil, Isle of Wight garlic, and sweet vine tomatoes.',
    backgroundImageUrl: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=1600&auto=format&fit=crop&q=85',
    buttonLabel: 'Shop Organic Vegetables',
    actionType: 'CATEGORY',
    targetCategoryId: 'cat-fresh-produce',
    linkedProductPlus: [
      'PLU-SPINACH-BABY-200G',
      'PLU-TOMATOES-VINE-400G',
    ],
    stockMatchMode: 'OR',
  },
];

const getStorageKey = (tenantId: string = 'brand-alpha') => `bwydi_hero_promo_banners_${tenantId}`;

function loadInitialBannersForTenant(tenantId: string = 'brand-alpha'): CategoryPromoBanner[] {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const saved = window.localStorage.getItem(getStorageKey(tenantId));
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
      // Fallback for brand-alpha legacy key
      if (tenantId === 'brand-alpha') {
        const legacy = window.localStorage.getItem('bwydi_hero_promo_banners');
        if (legacy) {
          const parsed = JSON.parse(legacy);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      }
    } catch (e) {
      console.warn(`Failed to load promo banners from storage for tenant ${tenantId}:`, e);
    }
  }
  return isDemoMode() ? [...DEFAULT_PROMO_BANNERS] : [];
}

// In-memory tenant banner store keyed by tenantId
const customBannersByTenant: Record<string, CategoryPromoBanner[]> = {};
const listeners = new Set<(tenantId?: string) => void>();

function notifyListeners(tenantId?: string): void {
  const tId = tenantId || 'brand-alpha';
  if (typeof window !== 'undefined' && window.localStorage && customBannersByTenant[tId]) {
    try {
      window.localStorage.setItem(getStorageKey(tId), JSON.stringify(customBannersByTenant[tId]));
    } catch (e) {
      console.warn(`Failed to persist promo banners for tenant ${tId}:`, e);
    }
  }
  listeners.forEach((fn) => {
    try {
      fn(tenantId);
    } catch (err) {
      console.error('Error in promo banner listener:', err);
    }
  });
}

export function subscribePromoBanners(callback: (tenantId?: string) => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

/**
 * Fetches promotional hero banners from the Firestore backend for a specific tenant.
 * Updates in-memory store and local cache.
 */
export async function fetchPromoBannersForTenant(tenantId: string = 'brand-alpha'): Promise<CategoryPromoBanner[]> {
  try {
    const res = await fetch(`/api/v1/tenants/${encodeURIComponent(tenantId)}/hero-banners`, {
      headers: {
        'Accept': 'application/json',
        'X-Tenant-ID': tenantId,
      },
    });
    if (res.ok) {
      const banners = await res.json();
      if (Array.isArray(banners)) {
        customBannersByTenant[tenantId] = banners;
        if (typeof window !== 'undefined' && window.localStorage) {
          try {
            window.localStorage.setItem(getStorageKey(tenantId), JSON.stringify(banners));
          } catch {
            // ignore
          }
        }
        notifyListeners(tenantId);
        return banners;
      }
    }
  } catch (err) {
    console.warn(`[PromoBanners] Failed to fetch banners from API for tenant ${tenantId}:`, err);
  }

  if (!customBannersByTenant[tenantId]) {
    customBannersByTenant[tenantId] = loadInitialBannersForTenant(tenantId);
  }
  return customBannersByTenant[tenantId];
}

export function getPromoBanners(tenantId: string = 'brand-alpha'): CategoryPromoBanner[] {
  if (!customBannersByTenant[tenantId]) {
    customBannersByTenant[tenantId] = loadInitialBannersForTenant(tenantId);
  }
  return [...customBannersByTenant[tenantId]];
}

export async function savePromoBanner(banner: CategoryPromoBanner, tenantId: string = 'brand-alpha'): Promise<void> {
  if (!customBannersByTenant[tenantId]) {
    customBannersByTenant[tenantId] = loadInitialBannersForTenant(tenantId);
  }
  const idx = customBannersByTenant[tenantId].findIndex((b) => b.id === banner.id);
  if (idx >= 0) {
    customBannersByTenant[tenantId][idx] = { ...banner };
  } else {
    customBannersByTenant[tenantId].unshift({ ...banner });
  }
  notifyListeners(tenantId);

  // Sync to Firestore backend via Admin API
  try {
    if (defaultAdminClient?.saveHeroBanner) {
      await defaultAdminClient.saveHeroBanner(banner, tenantId);
    } else {
      await fetch(`/api/v1/admin/tenants/${encodeURIComponent(tenantId)}/hero-banners`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': tenantId },
        body: JSON.stringify(banner),
      });
    }
  } catch (err) {
    console.warn(`[PromoBanners] Backend sync failed for banner ${banner.id}:`, err);
  }
}

export async function deletePromoBanner(bannerId: string, tenantId: string = 'brand-alpha'): Promise<void> {
  if (!customBannersByTenant[tenantId]) {
    customBannersByTenant[tenantId] = loadInitialBannersForTenant(tenantId);
  }
  customBannersByTenant[tenantId] = customBannersByTenant[tenantId].filter((b) => b.id !== bannerId);
  notifyListeners(tenantId);

  // Sync to Firestore backend via Admin API
  try {
    if (defaultAdminClient?.deleteHeroBanner) {
      await defaultAdminClient.deleteHeroBanner(bannerId, tenantId);
    } else {
      await fetch(`/api/v1/admin/tenants/${encodeURIComponent(tenantId)}/hero-banners/${encodeURIComponent(bannerId)}`, {
        method: 'DELETE',
        headers: { 'X-Tenant-ID': tenantId },
      });
    }
  } catch (err) {
    console.warn(`[PromoBanners] Backend sync failed for deleting banner ${bannerId}:`, err);
  }
}

export async function reorderPromoBanners(newBanners: CategoryPromoBanner[], tenantId: string = 'brand-alpha'): Promise<void> {
  customBannersByTenant[tenantId] = [...newBanners];
  notifyListeners(tenantId);

  // Sync to Firestore backend via Admin API
  try {
    if (defaultAdminClient?.reorderHeroBanners) {
      await defaultAdminClient.reorderHeroBanners(newBanners, tenantId);
    } else {
      await fetch(`/api/v1/admin/tenants/${encodeURIComponent(tenantId)}/hero-banners/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': tenantId },
        body: JSON.stringify({ banners: newBanners }),
      });
    }
  } catch (err) {
    console.warn(`[PromoBanners] Backend sync failed for reordering banners:`, err);
  }
}

export async function purgePromoBanners(tenantId: string = 'brand-alpha'): Promise<void> {
  customBannersByTenant[tenantId] = [];
  notifyListeners(tenantId);
}

export async function resetPromoBanners(tenantId: string = 'brand-alpha'): Promise<void> {
  // Sync to Firestore backend via Admin API
  try {
    if (defaultAdminClient?.resetHeroBanners) {
      const res = await defaultAdminClient.resetHeroBanners(tenantId);
      customBannersByTenant[tenantId] = res && res.length > 0 ? res : [...DEFAULT_PROMO_BANNERS];
    } else {
      const res = await fetch(`/api/v1/admin/tenants/${encodeURIComponent(tenantId)}/hero-banners/reset`, {
        method: 'POST',
        headers: { 'X-Tenant-ID': tenantId },
      });
      if (res.ok) {
        const banners = await res.json();
        customBannersByTenant[tenantId] = Array.isArray(banners) ? banners : [...DEFAULT_PROMO_BANNERS];
      } else {
        customBannersByTenant[tenantId] = [...DEFAULT_PROMO_BANNERS];
      }
    }
  } catch {
    customBannersByTenant[tenantId] = [...DEFAULT_PROMO_BANNERS];
  }
  notifyListeners(tenantId);
}

/**
 * Filters banners appropriate for the active category context and tenant:
 * - When categoryId is null: returns global/home banners
 * - When categoryId is selected: returns banners matching categoryId or category name/slug keywords
 */
export function getBannersForCategory(
  categoryId: string | null,
  categories: Category[],
  tenantId: string = 'brand-alpha'
): CategoryPromoBanner[] {
  const currentBanners = getPromoBanners(tenantId);

  if (!categoryId) {
    // Return all banners meant for the home view or custom configured banners
    if (currentBanners.length > 0) {
      // Prioritize global/home banners first, followed by category-specific ones so all banners are browsable in the carousel
      const homeBanners = currentBanners.filter(
        (b) => !b.categoryId || b.categorySlugMatch === 'all'
      );
      const otherBanners = currentBanners.filter(
        (b) => b.categoryId && b.categorySlugMatch !== 'all'
      );
      const combined = [...homeBanners, ...otherBanners];
      return combined.length > 0 ? combined : isDemoMode() ? [...DEFAULT_PROMO_BANNERS] : [];
    }
    return isDemoMode() ? [...DEFAULT_PROMO_BANNERS] : [];
  }

  // Find target category name and details
  const findCat = (cats: Category[], id: string): Category | null => {
    for (const c of cats) {
      if (c.id === id) return c;
      if (c.subcategories) {
        const found = findCat(c.subcategories, id);
        if (found) return found;
      }
    }
    return null;
  };

  const currentCat = findCat(categories, categoryId);
  const catName = (currentCat?.name || '').toLowerCase();
  const catIdLower = categoryId.toLowerCase();

  // Filter banners matching exact categoryId, ancestor categoryId, or semantic keywords
  const matched = currentBanners.filter((banner) => {
    if (banner.categoryId && (banner.categoryId === categoryId || catIdLower.includes(banner.categoryId))) {
      return true;
    }
    if (banner.categorySlugMatch) {
      const slug = banner.categorySlugMatch.toLowerCase();
      if (slug !== 'all' && (catName.includes(slug) || catIdLower.includes(slug))) {
        return true;
      }
    }
    return false;
  });

  if (matched.length > 0) {
    return matched;
  }

  // Fallback: If no custom banner exists for this category, generate an on-the-fly dynamic banner
  return [
    {
      id: `dynamic-banner-${categoryId}`,
      categoryId,
      categorySlugMatch: catName,
      badge: `${currentCat?.name || 'Category'} Spotlight`,
      title: `Explore Fresh ${currentCat?.name || 'Groceries'}`,
      subtitle: currentCat?.description || `Curated range in stock from local Essex stores. Fast courier delivery direct to door.`,
      backgroundImageUrl: currentCat?.imageUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1600&auto=format&fit=crop&q=85',
      buttonLabel: `Shop ${currentCat?.name || 'Items'}`,
      actionType: 'CATEGORY',
      targetCategoryId: categoryId,
    },
  ];
}

/**
 * Checks if a banner's linked stock is in stock at the given store.
 * Returns:
 * - isEligible: whether it should be shown based on AND / OR logic
 * - inStockCount: count of linked items in stock
 * - totalLinkedCount: total linked items
 * - inStockStatusText: user-friendly label (e.g. "In stock at Moulsham Street")
 */
export function checkBannerStock(
  banner: CategoryPromoBanner,
  products: Product[],
  storeName?: string
): {
  isEligible: boolean;
  inStockCount: number;
  totalLinkedCount: number;
  statusLabel?: string;
} {
  const linkedPlus = banner.linkedProductPlus || (banner.targetPlu ? [banner.targetPlu] : []);
  if (linkedPlus.length === 0) {
    return { isEligible: true, inStockCount: 0, totalLinkedCount: 0 };
  }

  let inStockCount = 0;
  let foundInCatalogCount = 0;

  for (const plu of linkedPlus) {
    const p = products.find((prod) => prod.plu === plu || prod.id === plu);
    if (p) {
      foundInCatalogCount++;
      const inStock = p.stockStatus === 'IN_STOCK' || (p.stockQuantity !== undefined && p.stockQuantity > 0);
      if (inStock && p.active !== false) {
        inStockCount++;
      }
    }
  }

  const mode = banner.stockMatchMode || 'OR';
  let isEligible = false;

  if (!storeName) {
    // "All Stores" mode: store location stock is not locked to a single branch.
    if (foundInCatalogCount === 0) {
      // General promo or cross-store PLU banners remain eligible when in "All Stores" mode
      isEligible = true;
    } else {
      isEligible = mode === 'AND' ? inStockCount === foundInCatalogCount : inStockCount > 0;
    }
  } else {
    // Specific store location selected
    if (foundInCatalogCount === 0) {
      // If banner has explicit PLUs but none exist in this store's catalog:
      // Category/Store picker banners or OR match banners remain eligible; AND banners require match
      isEligible = mode !== 'AND' || banner.actionType === 'STORE_PICKER' || banner.actionType === 'CATEGORY';
    } else {
      isEligible = mode === 'AND' ? inStockCount === linkedPlus.length : inStockCount > 0;
    }
  }

  let statusLabel: string | undefined = undefined;
  if (storeName) {
    if (isEligible) {
      statusLabel = mode === 'AND' && linkedPlus.length > 1
        ? `In Stock at ${storeName} (${inStockCount}/${linkedPlus.length} items)`
        : `In Stock at ${storeName}`;
    } else {
      statusLabel = `Out of stock at ${storeName}`;
    }
  } else {
    if (isEligible) {
      statusLabel = 'Available across stores';
    }
  }

  return {
    isEligible,
    inStockCount,
    totalLinkedCount: linkedPlus.length,
    statusLabel,
  };
}

