import { CategoryPromoBanner, Category, Product } from './models';

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

// In-memory tenant banner store with localStorage persistence
const PROMO_BANNER_STORAGE_KEY = 'deliverect_tenant_promo_banners';

function loadBannersFromStorage(): CategoryPromoBanner[] {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(PROMO_BANNER_STORAGE_KEY);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load promo banners from localStorage:', e);
    }
  }
  return [...DEFAULT_PROMO_BANNERS];
}

function persistBanners(banners: CategoryPromoBanner[]): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(PROMO_BANNER_STORAGE_KEY, JSON.stringify(banners));
      window.dispatchEvent(new CustomEvent('promo-banners-updated', { detail: banners }));
    } catch (e) {
      console.warn('Failed to persist promo banners to localStorage:', e);
    }
  }
}

let customBanners: CategoryPromoBanner[] = loadBannersFromStorage();

export function getPromoBanners(): CategoryPromoBanner[] {
  if (typeof window !== 'undefined') {
    customBanners = loadBannersFromStorage();
  }
  return [...customBanners];
}

export function savePromoBanner(banner: CategoryPromoBanner): void {
  const current = getPromoBanners();
  const idx = current.findIndex((b) => b.id === banner.id);
  if (idx >= 0) {
    current[idx] = { ...banner, active: banner.active !== false };
  } else {
    current.push({ ...banner, active: banner.active !== false });
  }
  customBanners = current;
  persistBanners(customBanners);
}

export function togglePromoBannerActive(bannerId: string): void {
  const current = getPromoBanners();
  const idx = current.findIndex((b) => b.id === bannerId);
  if (idx >= 0) {
    current[idx].active = current[idx].active === false;
    customBanners = current;
    persistBanners(customBanners);
  }
}

export function deletePromoBanner(bannerId: string): void {
  const current = getPromoBanners();
  customBanners = current.filter((b) => b.id !== bannerId);
  persistBanners(customBanners);
}

export function purgePromoBanners(): void {
  customBanners = [];
  persistBanners([]);
}

export function resetPromoBanners(): void {
  customBanners = [...DEFAULT_PROMO_BANNERS];
  persistBanners(customBanners);
}

export function reorderPromoBanners(fromIndex: number, toIndex: number): void {
  const current = getPromoBanners();
  if (fromIndex < 0 || fromIndex >= current.length || toIndex < 0 || toIndex >= current.length) return;
  const [removed] = current.splice(fromIndex, 1);
  current.splice(toIndex, 0, removed);
  customBanners = current;
  persistBanners(customBanners);
}

/**
 * Filters banners appropriate for the active category context:
 * - When categoryId is null: returns global/home banners
 * - When categoryId is selected: returns banners matching categoryId or category name/slug keywords
 * - If blank (0 active banners): returns [] so the storefront completely hides the section/tab!
 */
export function getBannersForCategory(
  categoryId: string | null,
  categories: Category[]
): CategoryPromoBanner[] {
  const allBanners = getPromoBanners();
  const activeBanners = allBanners.filter((b) => b.active !== false);

  // If blank (no active banners in the tenant), return empty list so the section is hidden!
  if (activeBanners.length === 0) {
    return [];
  }

  if (!categoryId) {
    // Return banners meant for the home view
    const homeBanners = activeBanners.filter(
      (b) => !b.categoryId || b.categorySlugMatch === 'all'
    );
    return homeBanners.length > 0 ? homeBanners : activeBanners.slice(0, 3);
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
  const matched = activeBanners.filter((banner) => {
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

  // Fallback to active global banners if no category-specific banner exists
  const globalBanners = activeBanners.filter((b) => !b.categoryId || b.categorySlugMatch === 'all');
  if (globalBanners.length > 0) {
    return globalBanners;
  }

  // If no banners match, return empty rather than generating synthetic fake banners
  return [];
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
  for (const plu of linkedPlus) {
    const p = products.find((prod) => prod.plu === plu);
    if (p) {
      const inStock = p.stockStatus === 'IN_STOCK' || (p.stockQuantity !== undefined && p.stockQuantity > 0);
      if (inStock && p.active !== false) {
        inStockCount++;
      }
    }
  }

  const mode = banner.stockMatchMode || 'OR';
  const isEligible = mode === 'AND' ? inStockCount === linkedPlus.length : inStockCount > 0;

  let statusLabel: string | undefined = undefined;
  if (storeName) {
    if (isEligible) {
      statusLabel = mode === 'AND'
        ? `In Stock at ${storeName} (${inStockCount}/${linkedPlus.length} items)`
        : `In Stock at ${storeName}`;
    } else {
      statusLabel = `Out of stock at ${storeName}`;
    }
  }

  return {
    isEligible,
    inStockCount,
    totalLinkedCount: linkedPlus.length,
    statusLabel,
  };
}
