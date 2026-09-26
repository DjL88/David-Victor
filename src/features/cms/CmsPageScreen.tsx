import React, { useEffect, useMemo, useState } from 'react';
import type { CmsPage } from '../../commerce/cmsModels';
import type { Category, Product } from '../../commerce/models';
import { CmsPageView } from './CmsPageView';
import { useTenant } from '../../tenant/TenantContext';
import { useI18n } from '../../i18n/I18nContext';
import { isCmsPagePublished } from '../../commerce/cmsPublication';

interface CmsPageScreenProps {
  slug: string;
  products?: Product[];
  categories?: Category[];
  onSelectProduct?: (product: Product) => void;
  onSelectCategory?: (categoryId: string) => void;
  onAddToCart?: (product: Product) => void;
}

export const CmsPageScreen: React.FC<CmsPageScreenProps> = ({
  slug,
  products = [],
  categories = [],
  onSelectProduct,
  onSelectCategory,
  onAddToCart,
}) => {
  const { tenant } = useTenant();
  const { locale } = useI18n();
  const [pages, setPages] = useState<CmsPage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch('/api/v1/cms/pages', { headers: { Accept: 'application/json' } })
      .then(async (response) => {
        if (!response.ok) throw new Error(`CMS request failed (${response.status})`);
        return response.json();
      })
      .then((payload) => {
        if (!cancelled) setPages(Array.isArray(payload?.pages) ? payload.pages : []);
      })
      .catch(() => {
        if (!cancelled) setPages([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [slug, tenant?.tenantId]);

  const page = useMemo(() => {
    const normalized = slug.replace(/^\/+|\/+$/g, '').toLowerCase();
    const candidates = pages.filter((candidate) =>
      isCmsPagePublished(candidate) &&
      candidate.slug.replace(/^\/+|\/+$/g, '').toLowerCase() === normalized
    );
    return candidates.find(page => page.locale === locale) || candidates.find(page => page.locale === tenant?.locale) || candidates.find(page => page.locale === 'en-GB') || null;
  }, [pages, slug, locale, tenant?.locale]);

  useEffect(() => {
    if (!page) return;
    const previousTitle = document.title;
    const description = document.querySelector('meta[name="description"]');
    const previousDescription = description?.getAttribute('content') || '';
    document.title = page.seoTitle || page.title;
    if (description && page.seoDescription) description.setAttribute('content', page.seoDescription);
    return () => {
      document.title = previousTitle;
      if (description) description.setAttribute('content', previousDescription);
    };
  }, [page]);

  if (loading) return <div className="mx-auto max-w-5xl px-4 py-16 text-sm text-gray-500">Loading page…</div>;
  if (!page) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-gray-950">Page not found</h1>
        <p className="mt-2 text-gray-500">This page is not published or does not exist.</p>
        <a href="/" className="inline-flex mt-5 font-semibold underline">Return to shop</a>
      </div>
    );
  }

  return (
    <CmsPageView
      page={page}
      products={products}
      categories={categories}
      onSelectProduct={onSelectProduct}
      onSelectCategory={onSelectCategory}
      onAddToCart={onAddToCart}
    />
  );
};
