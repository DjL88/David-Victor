import React from 'react';
import {
  Wheat,
  Milk,
  Leaf,
  Apple,
  Flame,
  Egg,
  Fish,
  AlertTriangle,
  Heart,
  ShieldCheck,
} from 'lucide-react';

export interface AllergenTagConfig {
  key: string;
  label: string;
  icon: React.FC<{ className?: string }>;
  badgeColor: string; // Tailwind color classes
  textColor: string;
  isDietaryPreference?: boolean; // e.g. Vegan, Vegetarian
}

export const ALLERGEN_MAP: Record<string, AllergenTagConfig> = {
  GLUTEN: {
    key: 'GLUTEN',
    label: 'Gluten',
    icon: Wheat,
    badgeColor: 'bg-amber-100 border-amber-200 text-amber-800',
    textColor: 'text-amber-800',
  },
  GLUTEN_FREE: {
    key: 'GLUTEN_FREE',
    label: 'Gluten Free',
    icon: ShieldCheck,
    badgeColor: 'bg-emerald-100 border-emerald-200 text-emerald-800',
    textColor: 'text-emerald-800',
    isDietaryPreference: true,
  },
  DAIRY: {
    key: 'DAIRY',
    label: 'Dairy',
    icon: Milk,
    badgeColor: 'bg-blue-100 border-blue-200 text-blue-800',
    textColor: 'text-blue-800',
  },
  DAIRY_FREE: {
    key: 'DAIRY_FREE',
    label: 'Dairy Free',
    icon: ShieldCheck,
    badgeColor: 'bg-emerald-100 border-emerald-200 text-emerald-800',
    textColor: 'text-emerald-800',
    isDietaryPreference: true,
  },
  NUTS: {
    key: 'NUTS',
    label: 'Contains Nuts',
    icon: AlertTriangle,
    badgeColor: 'bg-rose-100 border-rose-200 text-rose-800',
    textColor: 'text-rose-800',
  },
  NUT_FREE: {
    key: 'NUT_FREE',
    label: 'Nut Free',
    icon: ShieldCheck,
    badgeColor: 'bg-emerald-100 border-emerald-200 text-emerald-800',
    textColor: 'text-emerald-800',
    isDietaryPreference: true,
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
  EGGS: {
    key: 'EGGS',
    label: 'Eggs',
    icon: Egg,
    badgeColor: 'bg-yellow-100 border-yellow-200 text-yellow-800',
    textColor: 'text-yellow-800',
  },
  EGG: {
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
  SPICY: {
    key: 'SPICY',
    label: 'Spicy',
    icon: Flame,
    badgeColor: 'bg-orange-100 border-orange-200 text-orange-800',
    textColor: 'text-orange-800',
  },
  ORGANIC: {
    key: 'ORGANIC',
    label: 'Organic',
    icon: Heart,
    badgeColor: 'bg-emerald-100 border-emerald-200 text-emerald-800',
    textColor: 'text-emerald-800',
    isDietaryPreference: true,
  },
};

/**
 * Resolves standard allergen & dietary tags from a list of raw product tags/strings
 */
export function resolveAllergenTags(tags?: string[]): AllergenTagConfig[] {
  if (!tags || tags.length === 0) return [];

  const matched: AllergenTagConfig[] = [];
  const seenKeys = new Set<string>();

  for (const rawTag of tags) {
    if (!rawTag) continue;
    const normalized = rawTag.toUpperCase().replace(/[\s\-_]+/g, '_');

    // Direct key match
    if (ALLERGEN_MAP[normalized] && !seenKeys.has(normalized)) {
      seenKeys.add(normalized);
      matched.push(ALLERGEN_MAP[normalized]);
      continue;
    }

    // Heuristic match for allergen/dietary keywords
    if ((normalized.includes('VEGAN') || normalized === 'VG') && !seenKeys.has('VEGAN')) {
      seenKeys.add('VEGAN');
      matched.push(ALLERGEN_MAP.VEGAN);
    } else if ((normalized.includes('VEGETARIAN') || normalized === 'V') && !seenKeys.has('VEGETARIAN')) {
      seenKeys.add('VEGETARIAN');
      matched.push(ALLERGEN_MAP.VEGETARIAN);
    } else if (normalized.includes('GLUTEN_FREE') || normalized === 'GF') {
      if (!seenKeys.has('GLUTEN_FREE')) {
        seenKeys.add('GLUTEN_FREE');
        matched.push(ALLERGEN_MAP.GLUTEN_FREE);
      }
    } else if (normalized.includes('NUT_FREE')) {
      if (!seenKeys.has('NUT_FREE')) {
        seenKeys.add('NUT_FREE');
        matched.push(ALLERGEN_MAP.NUT_FREE);
      }
    } else if (normalized.includes('NUT') && !seenKeys.has('NUTS')) {
      seenKeys.add('NUTS');
      matched.push(ALLERGEN_MAP.NUTS);
    } else if (normalized.includes('MILK') || normalized.includes('DAIRY')) {
      if (!seenKeys.has('DAIRY')) {
        seenKeys.add('DAIRY');
        matched.push(ALLERGEN_MAP.DAIRY);
      }
    }
  }

  return matched;
}
