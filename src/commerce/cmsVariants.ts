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
