import { describe, it, expect } from 'vitest';
import {
  normalizeAllergenKey,
  normalizeDietaryTag,
  resolveAllergenTags,
  isProductMatchingFilters,
  getAllergenIcon,
  CANONICAL_ALLERGENS,
} from '../domain/allergens';
import { Product } from '../commerce/models';
import { Nut, Wheat, Milk, Egg, Fish, Shell, Bean, Sprout, Leaf, Flame } from 'lucide-react';

describe('Allergen & Tag Consolidation Engine', () => {
  describe('Aliases & Normalization', () => {
    it('normalizes Milk / Dairy aliases to MILK', () => {
      expect(normalizeAllergenKey('Milk')).toBe('MILK');
      expect(normalizeAllergenKey('DAIRY')).toBe('MILK');
      expect(normalizeAllergenKey('Lactose')).toBe('MILK');
    });

    it('normalizes Egg / Eggs aliases to EGG', () => {
      expect(normalizeAllergenKey('Egg')).toBe('EGG');
      expect(normalizeAllergenKey('EGGS')).toBe('EGG');
    });

    it('normalizes Wheat / Gluten aliases to GLUTEN', () => {
      expect(normalizeAllergenKey('Wheat')).toBe('GLUTEN');
      expect(normalizeAllergenKey('gluten')).toBe('GLUTEN');
      expect(normalizeAllergenKey('BARLEY')).toBe('GLUTEN');
      expect(normalizeAllergenKey('Oats')).toBe('GLUTEN');
    });

    it('normalizes Nut / Peanuts / Almond aliases to NUTS', () => {
      expect(normalizeAllergenKey('Nuts')).toBe('NUTS');
      expect(normalizeAllergenKey('PEANUT')).toBe('NUTS');
      expect(normalizeAllergenKey('Almonds')).toBe('NUTS');
      expect(normalizeAllergenKey('Cashew')).toBe('NUTS');
      expect(normalizeAllergenKey('Hazelnut')).toBe('NUTS');
    });

    it('normalizes Soy / Soya aliases to SOYA', () => {
      expect(normalizeAllergenKey('Soy')).toBe('SOYA');
      expect(normalizeAllergenKey('SOYA')).toBe('SOYA');
      expect(normalizeAllergenKey('Soybean')).toBe('SOYA');
    });

    it('normalizes Sulphite / Sulphites / Sulfites to SULPHITES', () => {
      expect(normalizeAllergenKey('Sulphite')).toBe('SULPHITES');
      expect(normalizeAllergenKey('sulfites')).toBe('SULPHITES');
      expect(normalizeAllergenKey('SO2')).toBe('SULPHITES');
    });

    it('normalizes dietary lifestyle tags correctly', () => {
      expect(normalizeDietaryTag('Vegan')).toBe('VEGAN');
      expect(normalizeDietaryTag('VG')).toBe('VEGAN');
      expect(normalizeDietaryTag('Vegetarian')).toBe('VEGETARIAN');
      expect(normalizeDietaryTag('V')).toBe('VEGETARIAN');
      expect(normalizeDietaryTag('Gluten Free')).toBe('GLUTEN_FREE');
      expect(normalizeDietaryTag('GF')).toBe('GLUTEN_FREE');
      expect(normalizeDietaryTag('Dairy Free')).toBe('DAIRY_FREE');
    });
  });

  describe('Icon Mappings', () => {
    it('uses Nut icon for Nuts, NOT AlertTriangle', () => {
      expect(getAllergenIcon('NUTS')).toBe(Nut);
      expect(getAllergenIcon('peanut')).toBe(Nut);
    });

    it('uses Wheat icon for Gluten / Wheat', () => {
      expect(getAllergenIcon('GLUTEN')).toBe(Wheat);
      expect(getAllergenIcon('wheat')).toBe(Wheat);
    });

    it('uses Milk icon for Milk / Dairy', () => {
      expect(getAllergenIcon('MILK')).toBe(Milk);
      expect(getAllergenIcon('dairy')).toBe(Milk);
    });

    it('uses Egg icon for Egg / Eggs', () => {
      expect(getAllergenIcon('EGG')).toBe(Egg);
      expect(getAllergenIcon('eggs')).toBe(Egg);
    });

    it('uses Fish icon for Fish', () => {
      expect(getAllergenIcon('FISH')).toBe(Fish);
    });

    it('uses Shell icon for Crustaceans / Shellfish', () => {
      expect(getAllergenIcon('CRUSTACEAN')).toBe(Shell);
      expect(getAllergenIcon('mollusc')).toBe(Shell);
    });

    it('uses Bean icon for Soya', () => {
      expect(getAllergenIcon('SOYA')).toBe(Bean);
      expect(getAllergenIcon('soy')).toBe(Bean);
    });

    it('uses Sprout icon for Sesame', () => {
      expect(getAllergenIcon('SESAME')).toBe(Sprout);
    });

    it('uses Leaf icon for Celery', () => {
      expect(getAllergenIcon('CELERY')).toBe(Leaf);
    });

    it('uses Flame icon for Mustard', () => {
      expect(getAllergenIcon('MUSTARD')).toBe(Flame);
    });
  });

  describe('Filtering Evaluator (isProductMatchingFilters)', () => {
    const mockProducts: Product[] = [
      {
        id: '1',
        plu: 'PROD_1',
        name: 'Whole Milk',
        priceMinor: 150,
        gtin: [],
        categoryIds: ['cat-1'],
        productTags: [],
        allergens: ['Milk', 'Dairy'],
        displayLabels: ['Vegetarian'],
      },
      {
        id: '2',
        plu: 'PROD_2',
        name: 'Almond Milk',
        priceMinor: 200,
        gtin: [],
        categoryIds: ['cat-1'],
        productTags: [],
        allergens: ['Almond', 'Nuts'],
        displayLabels: ['Vegan', 'Vegetarian', 'Gluten Free'],
      },
      {
        id: '3',
        plu: 'PROD_3',
        name: 'Egg & Wheat Sandwich',
        priceMinor: 350,
        gtin: [],
        categoryIds: ['cat-1'],
        productTags: [],
        allergens: ['Wheat', 'Egg', 'Milk'],
        displayLabels: ['Vegetarian'],
      },
      {
        id: '4',
        plu: 'PROD_4',
        name: 'Organic Tofu',
        priceMinor: 250,
        gtin: [],
        categoryIds: ['cat-1'],
        productTags: [],
        allergens: ['Soya'],
        displayLabels: ['Vegan', 'Vegetarian', 'Organic'],
      },
    ];

    it('allows all products when no filters are set', () => {
      const results = mockProducts.filter((p) => isProductMatchingFilters(p, {}));
      expect(results.length).toBe(4);
    });

    it('hides products containing ANY selected excluded allergen', () => {
      // Exclude Milk (matches MILK and DAIRY)
      const excludeMilk = mockProducts.filter((p) =>
        isProductMatchingFilters(p, { excludedAllergens: ['MILK'] })
      );
      expect(excludeMilk.map((p) => p.plu)).toEqual(['PROD_2', 'PROD_4']);

      // Exclude Nuts
      const excludeNuts = mockProducts.filter((p) =>
        isProductMatchingFilters(p, { excludedAllergens: ['NUTS'] })
      );
      expect(excludeNuts.map((p) => p.plu)).toEqual(['PROD_1', 'PROD_3', 'PROD_4']);
    });

    it('requires products to match ALL positive dietary requirements', () => {
      // Single filter: Vegan
      const veganOnly = mockProducts.filter((p) =>
        isProductMatchingFilters(p, { selectedDietaryTags: ['VEGAN'] })
      );
      expect(veganOnly.map((p) => p.plu)).toEqual(['PROD_2', 'PROD_4']);

      // Multiple filters: Vegan AND Organic -> should match ONLY Organic Tofu
      const veganAndOrganic = mockProducts.filter((p) =>
        isProductMatchingFilters(p, { selectedDietaryTags: ['VEGAN', 'ORGANIC'] })
      );
      expect(veganAndOrganic.map((p) => p.plu)).toEqual(['PROD_4']);
    });

    it('handles combined excluded allergens and positive dietary requirements', () => {
      // Filter: Vegan, exclude Nuts
      const veganNoNuts = mockProducts.filter((p) =>
        isProductMatchingFilters(p, {
          selectedDietaryTags: ['VEGAN'],
          excludedAllergens: ['NUTS'],
        })
      );
      expect(veganNoNuts.map((p) => p.plu)).toEqual(['PROD_4']);
    });

    it('preserves unknown Deliverect tags without misclassifying them as standard allergens', () => {
      const unknownTagProduct: Product = {
        id: 'custom',
        plu: 'PROD_CUSTOM',
        name: 'Specialty Tea',
        priceMinor: 180,
        gtin: [],
        categoryIds: ['cat-1'],
        productTags: [],
        allergens: ['CUSTOM_HERB_X'],
        displayLabels: ['Artisanal'],
      };

      const resolved = resolveAllergenTags(unknownTagProduct.allergens);
      expect(resolved).toEqual([]); // Unknown tag is not treated as a standard allergen in resolveAllergenTags

      // Filtering with standard excluded allergens shouldn't hide unknown tag products
      expect(
        isProductMatchingFilters(unknownTagProduct, { excludedAllergens: ['MILK', 'NUTS'] })
      ).toBe(true);
    });
  });
});
