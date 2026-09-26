import type { Product } from '../../commerce/models';
import { moneyToMinor } from '../../commerce/models';

export type StorefrontSortMode =
  | 'DEFAULT'
  | 'PRICE_ASC'
  | 'PRICE_DESC'
  | 'NAME_ASC'
  | 'NAME_DESC'
  | 'BRAND_ASC';

function normalizeText(value: unknown): string {
  return String(value || '').trim();
}

function productPriceMinor(product: Product): number | null {
  const candidates = [
    product.price,
    product.priceMinor,
    (product as any).basePrice,
    (product as any).unitPrice,
  ];

  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null) continue;
    const amount = moneyToMinor(candidate as any);
    if (Number.isFinite(amount)) return amount;
  }

  return null;
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, undefined, {
    sensitivity: 'base',
    numeric: true,
  });
}

export function hasSortableBrand(products: Product[]): boolean {
  return products.some((product) => normalizeText(product.brand).length > 0);
}

export function sortStorefrontProducts(
  products: Product[],
  mode: StorefrontSortMode
): Product[] {
  if (mode === 'DEFAULT') return products;

  return [...products].sort((a, b) => {
    if (mode === 'PRICE_ASC' || mode === 'PRICE_DESC') {
      const aPrice = productPriceMinor(a);
      const bPrice = productPriceMinor(b);

      if (aPrice === null && bPrice === null) {
        return compareText(normalizeText(a.name || a.plu), normalizeText(b.name || b.plu));
      }
      if (aPrice === null) return 1;
      if (bPrice === null) return -1;

      const priceDiff =
        mode === 'PRICE_ASC' ? aPrice - bPrice : bPrice - aPrice;
      if (priceDiff !== 0) return priceDiff;
      return compareText(normalizeText(a.name || a.plu), normalizeText(b.name || b.plu));
    }

    if (mode === 'BRAND_ASC') {
      const aBrand = normalizeText(a.brand);
      const bBrand = normalizeText(b.brand);

      if (!aBrand && !bBrand) {
        return compareText(normalizeText(a.name || a.plu), normalizeText(b.name || b.plu));
      }
      if (!aBrand) return 1;
      if (!bBrand) return -1;

      const brandDiff = compareText(aBrand, bBrand);
      if (brandDiff !== 0) return brandDiff;
      return compareText(normalizeText(a.name || a.plu), normalizeText(b.name || b.plu));
    }

    const aName = normalizeText(a.name || a.plu);
    const bName = normalizeText(b.name || b.plu);
    const result = compareText(aName, bName);
    return mode === 'NAME_DESC' ? -result : result;
  });
}
