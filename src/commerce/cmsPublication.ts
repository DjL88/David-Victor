import type { CmsPage } from './cmsModels';

/** Invalid schedules fail closed; all dates are absolute instants. */
export function isCmsPagePublished(page: CmsPage, now = Date.now()): boolean {
  if (page.status !== 'published') return false;
  const start = page.publishDate ? Date.parse(page.publishDate) : -Infinity;
  const end = page.variant?.unpublishAt ? Date.parse(page.variant.unpublishAt) : Infinity;
  return !Number.isNaN(start) && !Number.isNaN(end) && start <= now && now < end;
}

export function cmsNavigationPages(pages: CmsPage[], placement: 'header' | 'footer' | 'account', locale: string, defaultLocale: string): CmsPage[] {
  const groups = new Map<string, CmsPage[]>();
  for (const page of pages.filter(isPageVisible)) {
    const variants = groups.get(page.slug) || [];
    variants.push(page);
    groups.set(page.slug, variants);
  }
  return [...groups.values()].map(group => group.find(p => p.locale === locale) || group.find(p => p.locale === defaultLocale) || group.find(p => p.locale === 'en-GB'))
    .filter((page): page is CmsPage => !!page && (placement === 'account' ? page.showInAccount === true || ['footer', 'both'].includes(page.navigationVisibility) : [placement, 'both'].includes(page.navigationVisibility)))
    .sort((a, b) => (a.navigationOrder ?? 999) - (b.navigationOrder ?? 999));
}

function isPageVisible(page: CmsPage): boolean { return isCmsPagePublished(page); }
