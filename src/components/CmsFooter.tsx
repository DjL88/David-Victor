import React, { useEffect, useState } from 'react';
import type { CmsPage } from '../commerce/cmsModels';
import { cmsNavigationPages } from '../commerce/cmsPublication';
import { useTenant } from '../tenant/TenantContext';
import { useI18n } from '../i18n/I18nContext';

export function CmsFooter() {
  const { tenant } = useTenant();
  const { locale } = useI18n();
  const [pages, setPages] = useState<CmsPage[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    setPages([]);
    fetch('/api/v1/cms/pages', { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error('CMS unavailable'); return response.json(); })
      .then(data => { if (!controller.signal.aborted) setPages(Array.isArray(data.pages) ? data.pages : []); })
      .catch(() => { if (!controller.signal.aborted) setPages([]); });
    return () => controller.abort();
  }, [tenant?.tenantId]);
  const links = cmsNavigationPages(pages, 'footer', locale, tenant?.locale || 'en-GB');
  if (!links.length) return null;
  return <nav aria-label="Information and policies" className="flex flex-wrap justify-center gap-x-6 gap-y-3 border-t border-gray-200 px-4 pt-6 pb-24 md:pb-6">
    {links.map(page => <a key={page.id} className="max-w-full break-words text-sm underline underline-offset-4" href={`/pages/${encodeURIComponent(page.slug)}`}>{page.navigationLabel || page.title}</a>)}
  </nav>;
}
