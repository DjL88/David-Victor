import type { CmsPage } from './cmsModels';

function normalizeCmsSlug(value: string): string {
  return String(value || '')
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase();
}

export function resolvePublishedCmsPage(
  pages: CmsPage[],
  slug: string,
  locale?: string,
  fallbackLocale: string = 'en-GB'
): CmsPage | null {
  const normalizedSlug = normalizeCmsSlug(slug);
  if (!normalizedSlug) return null;

  const candidates = (pages || []).filter(
    (page) =>
      page.status === 'published' &&
      normalizeCmsSlug(page.slug) === normalizedSlug
  );

  if (candidates.length === 0) return null;

  const requestedLocale = String(locale || '').trim().toLowerCase();
  const fallback = String(fallbackLocale || 'en-GB').trim().toLowerCase();

  return (
    candidates.find((page) => page.locale?.toLowerCase() === requestedLocale) ||
    candidates.find((page) => page.locale?.toLowerCase() === fallback) ||
    candidates[0]
  );
}
