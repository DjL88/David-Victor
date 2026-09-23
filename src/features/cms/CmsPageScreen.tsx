import React, { useEffect, useMemo, useState } from 'react';
import type { CmsBlock, CmsPage } from '../../commerce/cmsModels';

interface CmsPageScreenProps {
  slug: string;
}

function renderBlock(block: CmsBlock): React.ReactNode {
  switch (block.type) {
    case 'Hero':
      return (
        <section key={block.id} className="overflow-hidden rounded-3xl bg-gray-50 border border-gray-100">
          {block.imageUrl && <img src={block.imageUrl} alt="" className="w-full max-h-[460px] object-cover" />}
          <div className="p-6 md:p-10">
            {block.badge && <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{block.badge}</p>}
            <h1 className="mt-1 text-3xl md:text-5xl font-bold text-gray-950">{block.headline}</h1>
            {block.subheadline && <p className="mt-3 max-w-3xl text-base text-gray-600">{block.subheadline}</p>}
            {block.ctaText && block.ctaAction?.target && (
              <a href={block.ctaAction.target} className="inline-flex mt-5 rounded-xl bg-gray-950 px-5 py-3 text-sm font-bold text-white">
                {block.ctaText}
              </a>
            )}
          </div>
        </section>
      );
    case 'RichText':
      return <div key={block.id} className="whitespace-pre-wrap text-base leading-7 text-gray-700">{block.content}</div>;
    case 'Image':
      return (
        <figure key={block.id}>
          <img src={block.imageUrl} alt={block.altText} className="w-full rounded-2xl object-cover" />
          {block.caption && <figcaption className="mt-2 text-sm text-gray-500">{block.caption}</figcaption>}
        </figure>
      );
    case 'Video':
      return (
        <figure key={block.id}>
          <video controls playsInline poster={block.posterUrl} autoPlay={Boolean(block.autoplay)} muted={Boolean(block.autoplay)} className="w-full rounded-2xl">
            <source src={block.videoUrl} />
          </video>
          {block.caption && <figcaption className="mt-2 text-sm text-gray-500">{block.caption}</figcaption>}
        </figure>
      );
    case 'CTA':
      return (
        <section key={block.id} className="rounded-2xl border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-950">{block.title}</h2>
          {block.description && <p className="mt-2 text-gray-600">{block.description}</p>}
          <a href={block.actionUrl} className="inline-flex mt-4 rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-bold text-white">{block.buttonLabel}</a>
        </section>
      );
    case 'FAQ':
      return (
        <section key={block.id}>
          <h2 className="text-2xl font-bold text-gray-950">{block.title}</h2>
          <div className="mt-4 divide-y divide-gray-200 border-y border-gray-200">
            {block.items.map((item, index) => (
              <details key={`${block.id}-${index}`} className="py-4">
                <summary className="cursor-pointer font-semibold text-gray-900">{item.question}</summary>
                <p className="mt-2 text-gray-600">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      );
    case 'Divider':
      return <hr key={block.id} className="border-gray-200" />;
    case 'Spacer':
      return <div key={block.id} aria-hidden="true" style={{ height: Math.min(Math.max(block.heightPx, 0), 240) }} />;
    default:
      // Dynamic commerce blocks are rendered by the storefront commerce surfaces,
      // not duplicated here. Keeping them absent is safer than showing stale CMS copies.
      return null;
  }
}

export const CmsPageScreen: React.FC<CmsPageScreenProps> = ({ slug }) => {
  const [page, setPage] = useState<CmsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);

    fetch('/api/v1/cms/pages', { headers: { Accept: 'application/json' } })
      .then(async (response) => {
        if (!response.ok) throw new Error(`CMS request failed (${response.status})`);
        return response.json();
      })
      .then((payload) => {
        if (cancelled) return;
        const pages: CmsPage[] = Array.isArray(payload?.pages) ? payload.pages : [];
        const normalized = slug.replace(/^\/+|\/+$/g, '').toLowerCase();
        const match = pages.find((candidate) =>
          candidate.status === 'published' &&
          candidate.slug.replace(/^\/+|\/+$/g, '').toLowerCase() === normalized
        );
        setPage(match || null);
        setNotFound(!match);
      })
      .catch(() => {
        if (!cancelled) {
          setPage(null);
          setNotFound(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [slug]);

  const blocks = useMemo(
    () => [...(page?.blocks || [])].sort((a, b) => a.order - b.order),
    [page]
  );

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
  if (notFound || !page) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-gray-950">Page not found</h1>
        <p className="mt-2 text-gray-500">This page is not published or does not exist.</p>
        <a href="/" className="inline-flex mt-5 font-semibold underline">Return to shop</a>
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-6xl space-y-8 px-4 py-8 md:py-12">
      {blocks.length > 0 ? blocks.map(renderBlock) : (
        <header>
          <h1 className="text-3xl font-bold text-gray-950">{page.title}</h1>
        </header>
      )}
    </article>
  );
};
