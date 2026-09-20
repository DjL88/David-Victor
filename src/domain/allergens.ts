import React from 'react';
import {
  Wheat,
  Milk,
  Egg,
  Fish,
  Nut,
  Shell,
  Bean,
  Sprout,
  Leaf,
  Flame,
  Flower2,
  FlaskConical,
  ShieldCheck,
  Heart,
  Apple,
} from 'lucide-react';
import { Product } from '../commerce/models';

export interface AllergenTagConfig {
  key: string;
  label: string;
  icon: React.FC<{ className?: string }>;
  badgeColor: string; // Tailwind color classes
  textColor: string;
  isDietaryPreference?: boolean; // e.g. Vegan, Vegetarian
}

export const CANONICAL_ALLERGENS: Record<
  string,
  {
    key: string;
    label: string;
    icon: React.FC<{ className?: string }>;
    badgeColor: string;
    textColor: string;
    aliases: RegExp[];
  }
> = {
  GLUTEN: {
    key: 'GLUTEN',
    label: 'Gluten',
    icon: Wheat,
    badgeColor: 'bg-amber-100 border-amber-200 text-amber-800',
    textColor: 'text-amber-800',
    aliases: [/GLUTEN/i, /WHEAT/i, /BARLEY/i, /OATS/i, /RYE/i, /SPELT/i, /KAMUT/i, /CEREAL/i],
  },
  MILK: {
    key: 'MILK',
    label: 'Milk',
    icon: Milk,
    badgeColor: 'bg-blue-100 border-blue-200 text-blue-800',
    textColor: 'text-blue-800',
    aliases: [/MILK/i, /DAIRY/i, /LACTOSE/i],
  },
  EGG: {
    key: 'EGG',
    label: 'Egg',
    icon: Egg,
    badgeColor: 'bg-yellow-100 border-yellow-200 text-yellow-800',
    textColor: 'text-yellow-800',
    aliases: [/EGG/i, /EGGS/i],
  },
  NUTS: {
    key: 'NUTS',
    label: 'Nuts',
    icon: Nut,
    badgeColor: 'bg-rose-100 border-rose-200 text-rose-800',
    textColor: 'text-rose-800',
    aliases: [
      /NUT/i,
      /NUTS/i,
      /PEANUT/i,
      /PEANUTS/i,
      /ALMOND/i,
      /CASHEW/i,
      /HAZELNUT/i,
      /PISTACHIO/i,
      /PECAN/i,
      /WALNUT/i,
      /MACADAMIA/i,
      /TREE_NUT/i,
    ],
  },
  SOYA: {
    key: 'SOYA',
    label: 'Soya',
    icon: Bean,
    badgeColor: 'bg-emerald-100 border-emerald-200 text-emerald-800',
    textColor: 'text-emerald-800',
    aliases: [/SOY/i, /SOYA/i, /SOYBEAN/i],
  },
  SULPHITES: {
    key: 'SULPHITES',
    label: 'Sulphites',
    icon: FlaskConical,
    badgeColor: 'bg-purple-100 border-purple-200 text-purple-800',
    textColor: 'text-purple-800',
    aliases: [/SULPHITE/i, /SULPHITES/i, /SULFITE/i, /SULFITES/i, /SO2/i],
  },
  SHELLFISH: {
    key: 'SHELLFISH',
    label: 'Crustaceans & Molluscs',
    icon: Shell,
    badgeColor: 'bg-orange-100 border-orange-200 text-orange-800',
    textColor: 'text-orange-800',
    aliases: [/CRUSTACEAN/i, /CRUSTACEANS/i, /MOLLUSC/i, /MOLLUSCS/i, /SHELLFISH/i],
  },
  SESAME: {
    key: 'SESAME',
    label: 'Sesame',
    icon: Sprout,
    badgeColor: 'bg-stone-100 border-stone-200 text-stone-800',
    textColor: 'text-stone-800',
    aliases: [/SESAME/i],
  },
  CELERY: {
    key: 'CELERY',
    label: 'Celery',
    icon: Leaf,
    badgeColor: 'bg-green-100 border-green-200 text-green-800',
    textColor: 'text-green-800',
    aliases: [/CELERY/i],
  },
  MUSTARD: {
    key: 'MUSTARD',
    label: 'Mustard',
    icon: Flame,
    badgeColor: 'bg-yellow-100 border-yellow-200 text-yellow-800',
    textColor: 'text-yellow-800',
    aliases: [/MUSTARD/i],
  },
  FISH: {
    key: 'FISH',
    label: 'Fish',
    icon: Fish,
    badgeColor: 'bg-cyan-100 border-cyan-200 text-cyan-800',
    textColor: 'text-cyan-800',
    aliases: [/FISH/i],
  },
  LUPIN: {
    key: 'LUPIN',
    label: 'Lupin',
    icon: Flower2,
    badgeColor: 'bg-pink-100 border-pink-200 text-pink-800',
    textColor: 'text-pink-800',
    aliases: [/LUPIN/i],
  },
};

export const ALLERGEN_MAP: Record<string, AllergenTagConfig> = {
  GLUTEN: {
    key: 'GLUTEN',
    label: 'Gluten',
    icon: Wheat,
    badgeColor: 'bg-amber-100 border-amber-200 text-amber-800',
    textColor: 'text-amber-800',
  },
  MILK: {
    key: 'MILK',
    label: 'Milk',
    icon: Milk,
    badgeColor: 'bg-blue-100 border-blue-200 text-blue-800',
    textColor: 'text-blue-800',
  },
  DAIRY: {
    key: 'MILK',
    label: 'Milk',
    icon: Milk,
    badgeColor: 'bg-blue-100 border-blue-200 text-blue-800',
    textColor: 'text-blue-800',
  },
  NUTS: {
    key: 'NUTS',
    label: 'Nuts',
    icon: Nut,
    badgeColor: 'bg-rose-100 border-rose-200 text-rose-800',
    textColor: 'text-rose-800',
  },
  EGG: {
    key: 'EGG',
    label: 'Egg',
    icon: Egg,
    badgeColor: 'bg-yellow-100 border-yellow-200 text-yellow-800',
    textColor: 'text-yellow-800',
  },
  EGGS: {
    key: 'EGG',
    label: 'Egg',
    icon: Egg,
    badgeColor: 'bg-yellow-100 border-yellow-200 text-yellow-800',
    textColor: 'text-yellow-800',
  },
  FISH: {
    key: 'FISH',
    label: 'Fish',
    icon: Fish,
    badgeColor: 'bg-cyan-100 border-cyan-200 text-cyan-800',
    textColor: 'text-cyan-800',
  },
  SOYA: {
    key: 'SOYA',
    label: 'Soya',
    icon: Bean,
    badgeColor: 'bg-emerald-100 border-emerald-200 text-emerald-800',
    textColor: 'text-emerald-800',
  },
  SHELLFISH: {
    key: 'SHELLFISH',
    label: 'Crustaceans & Molluscs',
    icon: Shell,
    badgeColor: 'bg-orange-100 border-orange-200 text-orange-800',
    textColor: 'text-orange-800',
  },
  SESAME: {
    key: 'SESAME',
    label: 'Sesame',
    icon: Sprout,
    badgeColor: 'bg-stone-100 border-stone-200 text-stone-800',
    textColor: 'text-stone-800',
  },
  CELERY: {
    key: 'CELERY',
    label: 'Celery',
    icon: Leaf,
    badgeColor: 'bg-green-100 border-green-200 text-green-800',
    textColor: 'text-green-800',
  },
  MUSTARD: {
    key: 'MUSTARD',
    label: 'Mustard',
    icon: Flame,
    badgeColor: 'bg-yellow-100 border-yellow-200 text-yellow-800',
    textColor: 'text-yellow-800',
  },
  SULPHITES: {
    key: 'SULPHITES',
    label: 'Sulphites',
    icon: FlaskConical,
    badgeColor: 'bg-purple-100 border-purple-200 text-purple-800',
    textColor: 'text-purple-800',
  },
  LUPIN: {
    key: 'LUPIN',
    label: 'Lupin',
    icon: Flower2,
    badgeColor: 'bg-pink-100 border-pink-200 text-pink-800',
    textColor: 'text-pink-800',
  },
  VEGAN: {
    key: 'VEGAN',
    label: 'Vegan',
    icon: Leaf,
    badgeColor: 'bg-emerald-100 border-emerald-200 text-emerald-800',
    textColor: 'text-emerald-800',
    isDietaryPreference: true,
  },
  VEGETARIAN: {
    key: 'VEGETARIAN',
    label: 'Vegetarian',
    icon: Apple,
    badgeColor: 'bg-green-100 border-green-200 text-green-800',
    textColor: 'text-green-800',
    isDietaryPreference: true,
  },
  ORGANIC: {
    key: 'ORGANIC',
    label: 'Organic',
    icon: Heart,
    badgeColor: 'bg-emerald-100 border-emerald-200 text-emerald-800',
    textColor: 'text-emerald-800',
    isDietaryPreference: true,
  },
  GLUTEN_FREE: {
    key: 'GLUTEN_FREE',
    label: 'Gluten Free',
    icon: ShieldCheck,
    badgeColor: 'bg-emerald-100 border-emerald-200 text-emerald-800',
    textColor: 'text-emerald-800',
    isDietaryPreference: true,
  },
  DAIRY_FREE: {
    key: 'DAIRY_FREE',
    label: 'Dairy Free',
    icon: ShieldCheck,
    badgeColor: 'bg-emerald-100 border-emerald-200 text-emerald-800',
    textColor: 'text-emerald-800',
    isDietaryPreference: true,
  },
  NUT_FREE: {
    key: 'NUT_FREE',
    label: 'Nut Free',
    icon: ShieldCheck,
    badgeColor: 'bg-emerald-100 border-emerald-200 text-emerald-800',
    textColor: 'text-emerald-800',
    isDietaryPreference: true,
  },
};

/**
 * Normalizes a raw allergen string/ID into a canonical allergen key.
 * Examples:
 * MILK / DAIRY -> MILK
 * EGG / EGGS -> EGG
 * NUT / NUTS / PEANUT -> NUTS
 * SOY / SOYA -> SOYA
 * SULPHITE / SULPHITES -> SULPHITES
 * GLUTEN / WHEAT -> GLUTEN
 */
export function normalizeAllergenKey(rawTag: string): string {
  if (!rawTag || typeof rawTag !== 'string') return '';
  const cleaned = rawTag.trim().toUpperCase().replace(/[\s\-_]+/g, '_');

  // Check aliases in CANONICAL_ALLERGENS
  for (const entry of Object.values(CANONICAL_ALLERGENS)) {
    if (entry.aliases.some((pattern) => pattern.test(cleaned))) {
      return entry.key;
    }
  }

  return cleaned;
}

/**
 * Checks if a string represents a known standard allergen
 */
export function isKnownAllergen(rawTag: string): boolean {
  if (!rawTag || typeof rawTag !== 'string') return false;
  const normalized = normalizeAllergenKey(rawTag);
  return Boolean(CANONICAL_ALLERGENS[normalized]);
}

/**
 * Returns the appropriate Lucide icon for a canonical or raw allergen key
 */
export function getAllergenIcon(canonicalOrRawKey: string): React.FC<{ className?: string }> {
  const normalized = normalizeAllergenKey(canonicalOrRawKey);
  const entry = CANONICAL_ALLERGENS[normalized];
  if (entry) return entry.icon;
  if (ALLERGEN_MAP[normalized]) return ALLERGEN_MAP[normalized].icon;
  return ShieldCheck;
}

/**
 * Normalizes a dietary lifestyle tag string
 */
export function normalizeDietaryTag(rawTag: string): string {
  if (!rawTag || typeof rawTag !== 'string') return '';
  const cleaned = rawTag.trim().toUpperCase().replace(/[\s\-_]+/g, '_');

  if (cleaned.includes('VEGAN') || cleaned === 'VG') return 'VEGAN';
  if (cleaned.includes('VEGETARIAN') || cleaned === 'V' || cleaned === 'VEGGIE') return 'VEGETARIAN';
  if (cleaned.includes('GLUTEN_FREE') || cleaned === 'GF' || cleaned === 'NO_GLUTEN') return 'GLUTEN_FREE';
  if (cleaned.includes('DAIRY_FREE') || cleaned === 'DF' || cleaned === 'NO_DAIRY') return 'DAIRY_FREE';
  if (cleaned.includes('NUT_FREE') || cleaned === 'NO_NUTS') return 'NUT_FREE';
  if (cleaned.includes('ORGANIC')) return 'ORGANIC';
  if (cleaned.includes('HALAL')) return 'HALAL';
  if (cleaned.includes('KOSHER')) return 'KOSHER';
  if (cleaned.includes('PROTEIN')) return 'HIGH_PROTEIN';
  if (cleaned.includes('SUGAR')) return 'LOW_SUGAR';

  return cleaned;
}

export function isDietaryTag(rawTag: string): boolean {
  const norm = normalizeDietaryTag(rawTag);
  return [
    'VEGAN',
    'VEGETARIAN',
    'GLUTEN_FREE',
    'DAIRY_FREE',
    'NUT_FREE',
    'ORGANIC',
    'HALAL',
    'KOSHER',
    'HIGH_PROTEIN',
    'LOW_SUGAR',
  ].includes(norm);
}

export function getCanonicalDietaryLabel(tag: string): string {
  const norm = normalizeDietaryTag(tag);
  switch (norm) {
    case 'VEGAN':
      return 'Vegan';
    case 'VEGETARIAN':
      return 'Vegetarian';
    case 'GLUTEN_FREE':
      return 'Gluten Free';
    case 'DAIRY_FREE':
      return 'Dairy Free';
    case 'NUT_FREE':
      return 'Nut Free';
    case 'ORGANIC':
      return 'Organic';
    case 'HALAL':
      return 'Halal';
    case 'KOSHER':
      return 'Kosher';
    case 'HIGH_PROTEIN':
      return 'High Protein';
    case 'LOW_SUGAR':
      return 'Low Sugar';
    default:
      return tag.charAt(0).toUpperCase() + tag.slice(1).toLowerCase();
  }
}

/**
 * Resolves standard allergen & dietary tags from a list of raw product tags/strings
 */
export function resolveAllergenTags(tags?: string[]): AllergenTagConfig[] {
  if (!tags || tags.length === 0) return [];

  const matched: AllergenTagConfig[] = [];
  const seenKeys = new Set<string>();

  for (const rawTag of tags) {
    if (!rawTag) continue;
    const canonicalKey = normalizeAllergenKey(rawTag);

    if (CANONICAL_ALLERGENS[canonicalKey]) {
      if (!seenKeys.has(canonicalKey)) {
        seenKeys.add(canonicalKey);
        const item = CANONICAL_ALLERGENS[canonicalKey];
        matched.push({
          key: item.key,
          label: item.label,
          icon: item.icon,
          badgeColor: item.badgeColor,
          textColor: item.textColor,
        });
      }
    } else {
      const dietNorm = normalizeDietaryTag(rawTag);
      if (ALLERGEN_MAP[dietNorm] && !seenKeys.has(dietNorm)) {
        seenKeys.add(dietNorm);
        matched.push(ALLERGEN_MAP[dietNorm]);
      }
    }
  }

  return matched;
}

export interface ProductFilterOptions {
  excludedAllergens?: string[];
  selectedDietaryTags?: string[];
  onlyFavourites?: boolean;
  onlyBuyAgain?: boolean;
}

/**
 * Canonical product matching function according to storefront rules:
 * 1. Excluded allergens: If product contains ANY selected excluded allergen -> hide product.
 * 2. Positive dietary filters: If multiple positive dietary filters are selected, product MUST match ALL selected positive requirements.
 * 3. Never compares raw unnormalized display strings.
 */
export function isProductMatchingFilters(
  product: Product,
  filterState: ProductFilterOptions,
  isFavourite?: (plu: string) => boolean,
  buyAgainSet?: Set<string>
): boolean {
  if (filterState.onlyFavourites && isFavourite && !isFavourite(product.plu)) {
    return false;
  }
  if (filterState.onlyBuyAgain && buyAgainSet && !buyAgainSet.has(product.plu)) {
    return false;
  }

  // 1. ALLERGEN EXCLUSIONS:
  // If product contains ANY selected excluded allergen -> hide product
  if (filterState.excludedAllergens && filterState.excludedAllergens.length > 0) {
    const rawAllergens = product.allergens || [];
    const productCanonicalAllergens = new Set(
      rawAllergens.map((a) => normalizeAllergenKey(String(a)))
    );

    const hasExcludedAllergen = filterState.excludedAllergens.some((excluded) => {
      const canonicalExcluded = normalizeAllergenKey(String(excluded));
      return productCanonicalAllergens.has(canonicalExcluded);
    });

    if (hasExcludedAllergen) {
      return false;
    }
  }

  // 2. DIETARY/LIFESTYLE:
  // If multiple positive dietary filters are selected, product must match ALL selected positive requirements
  if (filterState.selectedDietaryTags && filterState.selectedDietaryTags.length > 0) {
    const productDietaryTags = [
      ...(product.displayLabels || []),
      ...(product.productTagLabels || []),
      ...(product.productTags || []),
    ].map((t) => normalizeDietaryTag(String(t)));

    const productDietarySet = new Set(productDietaryTags);

    const matchesAllSelectedDietary = filterState.selectedDietaryTags.every((selectedTag) => {
      const canonicalSelected = normalizeDietaryTag(String(selectedTag));
      return productDietarySet.has(canonicalSelected);
    });

    if (!matchesAllSelectedDietary) {
      return false;
    }
  }

  return true;
}

