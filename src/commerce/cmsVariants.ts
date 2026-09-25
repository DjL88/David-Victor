import type { CmsPage, CmsPageVariant } from './cmsModels';

export type CmsTranslationState = 'source' | 'draft' | 'reviewed';

export interface CmsVariantMetadata extends CmsPageVariant {
  familyId: string;
  translationState: CmsTranslationState;
  showFallbackNotice: boolean;
  markets: string[];
  regions: string[];
  locationIds: string[];
}

export function pageFamilyId(page: CmsPage): string {
  return page.variant?.familyId || page.slug;
}

export function pageVariantMetadata(page: CmsPage): CmsVariantMetadata {
  const variant = page.variant;
  return {
    familyId: variant?.familyId || page.slug,
    sourceLocale: variant?.sourceLocale,
    translationState: variant?.translationState || 'source',
    showFallbackNotice: variant?.showFallbackNotice ?? true,
    markets: variant?.markets || [],
    regions: variant?.regions || [],
    locationIds: variant?.locationIds || [],
    timeZone: variant?.timeZone,
    unpublishAt: variant?.unpublishAt,
    social: variant?.social,
  };
}

export interface CmsVariantAudience { locale: string; market?: string; region?: string; locationId?: string; }
export interface CmsVariantResolution { page?: CmsPage; usedFallback: boolean; requestedLocale: string; resolvedLocale?: string; }

function targetMatches(page: CmsPage, audience: CmsVariantAudience): boolean {
  const variant = pageVariantMetadata(page);
  const includesOrGlobal = (values: string[], value?: string) => values.length === 0 || (!!value && values.includes(value));
  return includesOrGlobal(variant.markets, audience.market) && includesOrGlobal(variant.regions, audience.region) && includesOrGlobal(variant.locationIds, audience.locationId);
}

export function resolvePageVariant(pages: CmsPage[], familyId: string, audience: CmsVariantAudience, defaultLocale: string): CmsVariantResolution {
  const eligible = pages.filter((page) => pageFamilyId(page) === familyId && targetMatches(page, audience));
  const exact = eligible.find((page) => page.locale === audience.locale);
  if (exact) return { page: exact, usedFallback: false, requestedLocale: audience.locale, resolvedLocale: exact.locale };
  const fallback = eligible.find((page) => page.locale === defaultLocale);
  return { page: fallback, usedFallback: !!fallback, requestedLocale: audience.locale, resolvedLocale: fallback?.locale };
}

export function resolveVariantNavigation(pages: CmsPage[], audience: CmsVariantAudience, defaultLocale: string): CmsVariantResolution[] {
  const published = pages.filter((p) => p.status === 'published' && p.navigationVisibility !== 'hidden');
  const families = Array.from(new Set(published.map(pageFamilyId)));
  return families.map((family) => resolvePageVariant(published, family, audience, defaultLocale)).filter((result) => !!result.page);
}
