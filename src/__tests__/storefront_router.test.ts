import { describe, expect, it } from 'vitest';
import {
  findCategoryByRouteSlug,
  parseStorefrontRoute,
  pathForCategory,
  pathForProduct,
  pathForSearch,
  pathForTab,
  slugifyStorefrontSegment,
} from '../navigation/storefrontRouter';

describe('storefront router foundation', () => {
  it('parses shareable storefront routes', () => {
    expect(parseStorefrontRoute('/', '')).toEqual({ kind: 'home' });
    expect(parseStorefrontRoute('/search', '?q=milk')).toEqual({ kind: 'search', query: 'milk' });
    expect(parseStorefrontRoute('/aisle/fresh-food', '')).toEqual({ kind: 'aisle', slug: 'fresh-food' });
    expect(parseStorefrontRoute('/p/DLV1006', '')).toEqual({ kind: 'product', plu: 'DLV1006' });
    expect(parseStorefrontRoute('/basket', '')).toEqual({ kind: 'basket' });
    expect(parseStorefrontRoute('/checkout', '')).toEqual({ kind: 'checkout' });
    expect(parseStorefrontRoute('/orders/order-123', '')).toEqual({ kind: 'orders', orderId: 'order-123' });
    expect(parseStorefrontRoute('/account', '')).toEqual({ kind: 'account' });
    expect(parseStorefrontRoute('/about-us', '')).toEqual({ kind: 'cms', slug: 'about-us' });
    expect(parseStorefrontRoute('/pages/about-us', '')).toEqual({ kind: 'cms', slug: 'about-us' });
  });

  it('generates stable product category search and tab paths', () => {
    expect(pathForProduct('DLV1006')).toBe('/p/DLV1006');
    expect(pathForSearch('milk & bread')).toBe('/search?q=milk+%26+bread');
    expect(pathForTab('orders')).toBe('/orders');
    expect(pathForTab('account')).toBe('/account');
    expect(
      pathForCategory({ id: 'fresh-food', name: 'Fresh Food & Ready Meals' })
    ).toBe('/aisle/fresh-food-and-ready-meals');
  });

  it('slugifies and resolves nested category names without relying on category IDs', () => {
    const categories = [
      {
        id: 'root-1',
        name: 'Fresh Food',
        subcategories: [
          { id: 'leaf-1', name: 'Pizza & Pasta' },
        ],
      },
    ];

    expect(slugifyStorefrontSegment('Pizza & Pasta')).toBe('pizza-and-pasta');
    expect(findCategoryByRouteSlug(categories, 'pizza-and-pasta')?.id).toBe('leaf-1');
    expect(findCategoryByRouteSlug(categories, 'leaf-1')?.name).toBe('Pizza & Pasta');
  });
});
