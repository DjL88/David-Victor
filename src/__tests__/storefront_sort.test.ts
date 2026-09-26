import { describe, expect, it } from 'vitest';
import {
  hasSortableBrand,
  sortStorefrontProducts,
} from '../features/catalog/storefrontSort';

const products = [
  { plu: 'C', name: 'Cherry', brand: 'Zulu', price: { amount: 300, currency: 'GBP' } },
  { plu: 'A', name: 'Apple', brand: 'Alpha', price: { amount: 100, currency: 'GBP' } },
  { plu: 'B', name: 'Banana', price: { amount: 200, currency: 'GBP' } },
  { plu: 'D', name: 'Date' },
] as any[];

describe('storefront category sorting', () => {
  it('preserves original merchandising order for DEFAULT', () => {
    expect(sortStorefrontProducts(products, 'DEFAULT')).toBe(products);
  });

  it('sorts by price in either direction while keeping missing prices last', () => {
    expect(
      sortStorefrontProducts(products, 'PRICE_ASC').map((product) => product.plu)
    ).toEqual(['A', 'B', 'C', 'D']);

    expect(
      sortStorefrontProducts(products, 'PRICE_DESC').map((product) => product.plu)
    ).toEqual(['C', 'B', 'A', 'D']);
  });

  it('sorts names A-Z and Z-A', () => {
    expect(
      sortStorefrontProducts(products, 'NAME_ASC').map((product) => product.name)
    ).toEqual(['Apple', 'Banana', 'Cherry', 'Date']);

    expect(
      sortStorefrontProducts(products, 'NAME_DESC').map((product) => product.name)
    ).toEqual(['Date', 'Cherry', 'Banana', 'Apple']);
  });

  it('sorts brand values alphabetically and puts missing brands last', () => {
    expect(hasSortableBrand(products)).toBe(true);
    expect(
      sortStorefrontProducts(products, 'BRAND_ASC').map((product) => product.plu)
    ).toEqual(['A', 'C', 'B', 'D']);
  });

  it('does not advertise brand sorting when the filtered list has no brand data', () => {
    expect(
      hasSortableBrand([
        { plu: '1', name: 'One' },
        { plu: '2', name: 'Two', brand: '   ' },
      ] as any)
    ).toBe(false);
  });
});
