import type { CmsPage } from './cmsModels';

export type CmsTranslationState = 'source' | 'draft' | 'reviewed';

export interface CmsVariantMetadata {
  familyId: string;
  sourceLocale?: string;
  translationState: CmsTranslationState;
  showFallbackNotice: boolean;
  markets: string[];
  regions: string[];
  locationIds: string[];
  timeZone?: string;
  unpublishAt?: string;
  social?: { title?: string; description?: string; imageUrl?: string };
}

export function pageFamilyId(page: CmsPage): string {
  return (page as CmsPage & { variant?: Partial<CmsVariantMetadata> }).variant?.familyId || page.slug;
}

export function pageVariantMetadata(page: CmsPage): CmsVariantMetadata {
  const variant = (page as CmsPage & { variant?: Partial<CmsVariantMetadata> }).variant;
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
