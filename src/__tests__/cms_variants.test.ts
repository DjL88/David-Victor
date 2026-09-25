import { describe, expect, it } from 'vitest';
import type { CmsPage } from '../commerce/cmsModels';
import { pageFamilyId, pageVariantMetadata } from '../commerce/cmsVariants';

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
