import type { Category, Product } from '../commerce/models';
import type { MobileTab } from '../components/MobileNav';

export type StorefrontRoute =
  | { kind: 'home' }
  | { kind: 'search'; query: string }
  | { kind: 'aisle'; slug: string }
  | { kind: 'product'; plu: string }
  | { kind: 'basket' }
  | { kind: 'checkout' }
  | { kind: 'orders'; orderId?: string }
  | { kind: 'account' }
  | { kind: 'cms'; slug: string };

export function slugifyStorefrontSegment(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

export function parseStorefrontRoute(
  pathname: string = typeof window !== 'undefined' ? window.location.pathname : '/',
  search: string = typeof window !== 'undefined' ? window.location.search : ''
): StorefrontRoute {
  const cleanPath = '/' + String(pathname || '/').replace(/^\/+|\/+$/g, '');
  const parts = cleanPath.split('/').filter(Boolean).map((part) => decodeURIComponent(part));
  const params = new URLSearchParams(search || '');

  if (parts.length === 0) return { kind: 'home' };
  if (parts[0] === 'search') return { kind: 'search', query: params.get('q') || '' };
  if (parts[0] === 'aisle' && parts[1]) return { kind: 'aisle', slug: parts[1] };
  if (parts[0] === 'p' && parts[1]) return { kind: 'product', plu: parts[1] };
  if (parts[0] === 'basket') return { kind: 'basket' };
  if (parts[0] === 'checkout') return { kind: 'checkout' };
  if (parts[0] === 'orders') return { kind: 'orders', orderId: parts[1] || undefined };
  if (parts[0] === 'account') return { kind: 'account' };
  if (parts[0] === 'pages' && parts[1]) return { kind: 'cms', slug: parts.slice(1).join('/') };

  // Unknown top-level slugs are intentionally reserved for CMS pages.
  return { kind: 'cms', slug: parts.join('/') };
}

export function pathForTab(tab: MobileTab): string {
  if (tab === 'search') return '/search';
  if (tab === 'orders') return '/orders';
  if (tab === 'account') return '/account';
  return '/';
}

export function pathForSearch(query: string): string {
  const params = new URLSearchParams();
  if (query.trim()) params.set('q', query.trim());
  const suffix = params.toString();
  return suffix ? `/search?${suffix}` : '/search';
}

export function pathForProduct(product: Pick<Product, 'plu'> | string): string {
  const plu = typeof product === 'string' ? product : product.plu;
  return `/p/${encodeURIComponent(plu)}`;
}

export function pathForCategory(category: Pick<Category, 'id' | 'name'>): string {
  const slug = slugifyStorefrontSegment(category.name) || slugifyStorefrontSegment(category.id);
  return `/aisle/${encodeURIComponent(slug)}`;
}

export function replaceStorefrontUrl(path: string): void {
  if (typeof window === 'undefined') return;
  const current = window.location.pathname + window.location.search;
  if (current === path) return;
  window.history.replaceState({ storefront: true }, '', path);
}

export function pushStorefrontUrl(
  path: string,
  state: Record<string, unknown> = {}
): void {
  if (typeof window === 'undefined') return;
  const current = window.location.pathname + window.location.search;
  if (current === path) return;
  window.history.pushState({ storefront: true, ...state }, '', path);
}

export function flattenCategories(categories: Category[]): Category[] {
  const result: Category[] = [];
  const visit = (items: Category[]) => {
    for (const category of items || []) {
      result.push(category);
      if (category.subcategories?.length) visit(category.subcategories);
    }
  };
  visit(categories || []);
  return result;
}

export function findCategoryByRouteSlug(categories: Category[], slug: string): Category | null {
  const normalized = slugifyStorefrontSegment(slug);
  return (
    flattenCategories(categories).find((category) =>
      slugifyStorefrontSegment(category.name) === normalized ||
      slugifyStorefrontSegment(category.id) === normalized
    ) || null
  );
}
