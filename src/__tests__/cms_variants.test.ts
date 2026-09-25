import { describe, expect, it } from 'vitest';
import type { CmsPage } from '../commerce/cmsModels';
import { pageFamilyId, pageVariantMetadata, resolvePageVariant, resolveVariantNavigation } from '../commerce/cmsVariants';

const page: CmsPage = {
  id: 'nl-home', tenantId: 'tenant-a', slug: 'home', title: 'Home', seoTitle: '', seoDescription: '',
  locale: 'nl-NL', status: 'draft', navigationVisibility: 'header', blocks: [], createdAt: '', updatedAt: '',
};

describe('CMS locale variants', () => {
  it('uses the stable slug as a backwards-compatible family and does not invent market targeting', () => {
    expect(pageFamilyId(page)).toBe('home');
    expect(pageVariantMetadata(page)).toMatchObject({ familyId: 'home', translationState: 'source', markets: [], regions: [], locationIds: [] });
  });

  it('preserves retailer-authored targeting, timezone and translation review metadata', () => {
    const configured: CmsPage = { ...page, variant: { familyId: 'homepage', sourceLocale: 'en-GB', translationState: 'reviewed', showFallbackNotice: true, markets: ['NL'], regions: ['west'], locationIds: ['ams-1'], timeZone: 'Europe/Amsterdam' } };
    expect(pageVariantMetadata(configured)).toMatchObject({ familyId: 'homepage', sourceLocale: 'en-GB', translationState: 'reviewed', markets: ['NL'], regions: ['west'], locationIds: ['ams-1'], timeZone: 'Europe/Amsterdam' });
  });
});


describe('CMS shared locale navigation', () => {
  const published = (id: string, locale: string, label: string, variant?: CmsPage['variant']): CmsPage => ({ ...page, id, locale, navigationLabel: label, status: 'published', variant });
  const en = published('home-en', 'en-GB', 'Home', { familyId: 'home', translationState: 'source' });
  const nl = published('home-nl', 'nl-NL', 'Start', { familyId: 'home', sourceLocale: 'en-GB', translationState: 'reviewed', markets: ['NL'] });

  it('selects the requested eligible locale without fallback', () => {
    const result = resolvePageVariant([en, nl], 'home', { locale: 'nl-NL', market: 'NL' }, 'en-GB');
    expect(result.page?.id).toBe('home-nl'); expect(result.usedFallback).toBe(false);
  });

  it('falls back visibly to the brand default and never crosses targeting', () => {
    const result = resolvePageVariant([en, nl], 'home', { locale: 'de-DE', market: 'DE' }, 'en-GB');
    expect(result.page?.id).toBe('home-en'); expect(result.usedFallback).toBe(true); expect(result.resolvedLocale).toBe('en-GB');
  });

  it('emits one shared navigation entry per logical page family', () => {
    const nav = resolveVariantNavigation([en, nl], { locale: 'nl-NL', market: 'NL' }, 'en-GB');
    expect(nav).toHaveLength(1); expect(nav[0].page?.navigationLabel).toBe('Start');
  });
});
