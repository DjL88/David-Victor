import { describe, it, expect } from 'vitest';
import { getDealForBanner, getDealForStory } from '../commerce/dealModels';
import { checkBannerStock } from '../commerce/promoBannerData';
import { CategoryPromoBanner, Story, Product } from '../commerce/models';

describe('Promotional Carousel Semantics & Deal Integrity', () => {
  const sampleProducts: Product[] = [
    {
      id: 'prod-1',
      plu: 'PLU-101',
      name: 'Organic Milk 1L',
      price: { amount: 180, currency: 'GBP' },
      stockStatus: 'IN_STOCK',
      stockQuantity: 10,
      active: true,
      categoryIds: ['cat-dairy'],
      gtin: ['012345678901'],
      productTags: [],
      displayLabels: [],
      allergens: [],
    },
    {
      id: 'prod-2',
      plu: 'PLU-102',
      name: 'Artisan Sourdough',
      price: { amount: 250, currency: 'GBP' },
      stockStatus: 'IN_STOCK',
      stockQuantity: 5,
      active: true,
      categoryIds: ['cat-bakery'],
      gtin: ['012345678902'],
      productTags: [],
      displayLabels: [],
      allergens: [],
    },
    {
      id: 'prod-3',
      plu: 'PLU-103',
      name: 'Unsalted Butter 250g',
      price: { amount: 220, currency: 'GBP' },
      stockStatus: 'OUT_OF_STOCK',
      stockQuantity: 0,
      active: true,
      categoryIds: ['cat-dairy'],
      gtin: ['012345678903'],
      productTags: [],
      displayLabels: [],
      allergens: [],
    },
  ];

  it('MUST NOT generate synthetic deals for banners with linked products when linkedBundleId is absent', () => {
    const bannerWithProducts: CategoryPromoBanner = {
      id: 'banner-breakfast',
      categoryId: 'all',
      title: 'Breakfast Favorites',
      subtitle: 'Get milk and sourdough fresh today',
      backgroundImageUrl: 'https://images.unsplash.com/photo-1525351484163-7529414344d8',
      buttonLabel: 'Explore Breakfast',
      actionType: 'CATEGORY',
      linkedProductPlus: ['PLU-101', 'PLU-102'],
      stockMatchMode: 'AND',
      sortOrder: 1,
    };

    const deal = getDealForBanner(bannerWithProducts, sampleProducts);
    
    // CRITICAL: MUST BE NULL - Zero fabricated deal prices, original prices, savings, or Meal Deal classifications
    expect(deal).toBeNull();
  });

  it('Returns genuine deal when banner has an explicit linkedBundleId matching a catalog deal', () => {
    const dealBanner: CategoryPromoBanner = {
      id: 'banner-meal-deal-1',
      categoryId: 'all',
      title: 'Lunch Combo Deal',
      subtitle: 'Main + Snack + Drink for £5.99',
      backgroundImageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c',
      buttonLabel: 'Get Deal',
      actionType: 'CATEGORY',
      linkedBundleId: 'deal-lunch-combo',
      linkedProductPlus: ['PLU-101', 'PLU-102'],
      stockMatchMode: 'AND',
      sortOrder: 2,
    };

    const deal = getDealForBanner(dealBanner, sampleProducts);
    expect(deal).not.toBeNull();
    expect(deal?.id).toBe('deal-lunch-combo');
  });

  it('MUST NOT generate synthetic deals for stories with linked products when linkedBundleId is absent', () => {
    const storyWithProducts: Story = {
      id: 'story-dairy',
      title: 'Fresh Dairy Selections',
      caption: 'Top picks for your morning coffee',
      mediaUrl: 'https://images.unsplash.com/photo-1550583724-b2692b85b150',
      mediaType: 'image',
      linkedProductPlus: ['PLU-101', 'PLU-103'],
      stockMatchMode: 'OR',
      sortOrder: 1,
    };

    const deal = getDealForStory(storyWithProducts, sampleProducts);
    expect(deal).toBeNull();
  });

  it('checkBannerStock evaluates stock match modes AND vs OR accurately', () => {
    const andBanner: CategoryPromoBanner = {
      id: 'b-and',
      categoryId: 'all',
      title: 'AND Stock Test',
      subtitle: 'Requires all items in stock',
      backgroundImageUrl: '',
      buttonLabel: 'Shop',
      actionType: 'CATEGORY',
      linkedProductPlus: ['PLU-101', 'PLU-103'], // PLU-103 is OUT_OF_STOCK
      stockMatchMode: 'AND',
      sortOrder: 1,
    };

    const andStock = checkBannerStock(andBanner, sampleProducts);
    expect(andStock.isEligible).toBe(false);
    expect(andStock.inStockCount).toBe(1);
    expect(andStock.totalLinkedCount).toBe(2);

    const orBanner: CategoryPromoBanner = {
      ...andBanner,
      id: 'b-or',
      stockMatchMode: 'OR',
    };

    const orStock = checkBannerStock(orBanner, sampleProducts);
    expect(orStock.isEligible).toBe(true);
    expect(orStock.inStockCount).toBe(1);
  });
});
