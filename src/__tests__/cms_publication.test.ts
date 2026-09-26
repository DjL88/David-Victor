import { describe, expect, it } from 'vitest';
import { cmsNavigationPages, isCmsPagePublished } from '../commerce/cmsPublication';
import type { CmsPage } from '../commerce/cmsModels';
const page = (extra: Partial<CmsPage> = {}): CmsPage => ({ id: 'p', tenantId: 't', slug: 'help', title: 'Help', seoTitle: '', seoDescription: '', locale: 'en-GB', status: 'published', navigationVisibility: 'footer', blocks: [], createdAt: '', updatedAt: '', ...extra });
describe('Customer CMS publication', () => {
  it('excludes drafts, future, expired and invalid schedules', () => {
    const now = Date.parse('2026-09-26T12:00:00Z');
    expect(isCmsPagePublished(page(), now)).toBe(true);
    for (const extra of [{status:'draft'}, {publishDate:'2026-09-27T00:00:00Z'}, {publishDate:'bad'}, {variant:{familyId:'help',unpublishAt:'2026-09-26T11:00:00Z'}}]) {
      expect(isCmsPagePublished(page(extra as Partial<CmsPage>), now)).toBe(false);
    }
  });
  it('resolves language before placement and exposes footer pages without account login', () => {
    const pages = [page(), page({id:'fr',locale:'fr-FR',navigationLabel:'Aide'}), page({id:'draft',slug:'private',status:'draft'})];
    expect(cmsNavigationPages(pages,'footer','fr-FR','en-GB').map(p=>p.id)).toEqual(['fr']);
    expect(cmsNavigationPages(pages,'header','fr-FR','en-GB')).toEqual([]);
    expect(cmsNavigationPages([page({showInAccount:true,navigationVisibility:'hidden'})],'account','en-GB','en-GB')).toHaveLength(1);
  });
});
