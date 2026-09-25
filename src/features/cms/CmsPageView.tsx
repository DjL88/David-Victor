import React, { useState } from 'react';
import { CmsPage, CmsBlock } from '../../commerce/cmsModels';
import { Product, Category, Story } from '../../commerce/models';
import { getPromoBanners } from '../../commerce/promoBannerData';
import { useTenant } from '../../tenant/TenantContext';
import { HeroImage, ProductImage, CategoryImage } from '../../components/media/Media';
import { formatStorefrontCurrency } from '../../utils/formatters';
import {
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Store,
  HelpCircle,
  ShoppingBag,
} from 'lucide-react';

interface CmsPageViewProps {
  page: CmsPage;
  products?: Product[];
  categories?: Category[];
  stories?: Story[];
  onSelectProduct?: (product: Product) => void;
  onSelectCategory?: (categoryId: string) => void;
  onAddToCart?: (product: Product) => void;
}

export const CmsPageView: React.FC<CmsPageViewProps> = ({
  page,
  products = [],
  categories = [],
  stories = [],
  onSelectProduct = () => {},
  onSelectCategory = () => {},
  onAddToCart = () => {},
}) => {
  const { tenant } = useTenant();
  const [openFaqIndices, setOpenFaqIndices] = useState<Record<number, boolean>>({});

  const toggleFaq = (idx: number) => {
    setOpenFaqIndices((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const sortedBlocks = [...page.blocks].sort((a, b) => a.order - b.order);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Page Title & SEO Header */}
      <div className="border-b border-gray-100 pb-4">
        <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">
          {page.title}
        </h1>
        {page.seoDescription && (
          <p className="text-sm text-gray-500 mt-1">{page.seoDescription}</p>
        )}
      </div>

      {/* Render structured blocks safely */}
      {sortedBlocks.map((block) => {
        if (!block || !block.type) return null;
        switch (block.type) {
          case 'Hero':
            return (
              <HeroImage
                key={block.id}
                imageUrl={block.imageUrl}
                className="relative rounded-3xl overflow-hidden p-8 md:p-12 text-white shadow-md"
              >
                {block.badge && (
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-white/20 backdrop-blur-xs mb-3">
                    {block.badge}
                  </span>
                )}
                <h2 className="text-2xl md:text-4xl font-black tracking-tight mb-2">
                  {block.headline}
                </h2>
                {block.subheadline && (
                  <p className="text-sm md:text-base text-white/90 max-w-xl mb-4">
                    {block.subheadline}
                  </p>
                )}
                {block.ctaText && (
                  <button
                    type="button"
                    className="px-5 py-2.5 rounded-xl font-bold text-sm bg-white text-gray-900 shadow-md hover:bg-gray-50 transition-transform active:scale-95"
                  >
                    {block.ctaText}
                  </button>
                )}
              </HeroImage>
            );

          case 'RichText':
            return (
              <div
                key={block.id}
                className="prose prose-sm md:prose-base text-gray-700 max-w-none leading-relaxed"
              >
                {block.content.split('\n\n').map((para, pIdx) => (
                  <p key={pIdx} className="mb-3 text-sm md:text-base text-gray-700">
                    {para}
                  </p>
                ))}
              </div>
            );

          case 'ProductCarousel': {
            const referencedProducts = products.filter((p) =>
              block.productPlus.includes(p.plu)
            );
            return (
              <div key={block.id} className="space-y-3">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{block.title}</h3>
                  {block.subtitle && (
                    <p className="text-xs text-gray-500">{block.subtitle}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {referencedProducts.map((prod) => (
                    <div
                      key={prod.plu}
                      className="p-3 rounded-2xl bg-white border border-gray-100 hover:shadow-xs transition-all flex flex-col"
                    >
                      <div
                        className="h-32 rounded-xl overflow-hidden mb-2 cursor-pointer bg-gray-50"
                        onClick={() => onSelectProduct(prod)}
                      >
                        <ProductImage
                          src={prod.imageUrl}
                          alt={prod?.name || 'Product'}
                          productName={prod?.name || 'Product'}
                        />
                      </div>
                      <h4
                        className="font-bold text-xs text-gray-900 line-clamp-2 cursor-pointer hover:underline flex-1"
                        onClick={() => onSelectProduct(prod)}
                      >
                        {prod?.name || prod?.plu || 'Product'}
                      </h4>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
                        <span className="font-mono font-bold text-xs text-gray-800">
                          {formatStorefrontCurrency(prod.price, tenant)}
                        </span>
                        <button
                          type="button"
                          onClick={() => onAddToCart(prod)}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold text-white shadow-2xs"
                          style={{ backgroundColor: tenant?.primaryColour || '#059669' }}
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          }

          case 'CategoryCarousel': {
            const referencedCategories = categories.filter((c) =>
              block.categoryIds.includes(c.id)
            );
            return (
              <div key={block.id} className="space-y-3">
                <h3 className="text-lg font-bold text-gray-900">{block.title}</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {referencedCategories.map((cat) => (
                    <div
                      key={cat.id}
                      onClick={() => onSelectCategory(cat.id)}
                      className="cursor-pointer p-4 rounded-2xl bg-white border border-gray-100 hover:border-emerald-300 hover:shadow-xs transition-all text-center"
                    >
                      <div className="h-16 w-16 mx-auto rounded-xl overflow-hidden mb-2 bg-gray-50">
                        <CategoryImage
                          src={cat.imageUrl}
                          alt={cat?.name || 'Category'}
                          categoryName={cat?.name || 'Category'}
                        />
                      </div>
                      <span className="text-xs font-bold text-gray-800 line-clamp-1">
                        {cat?.name || 'Category'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          }

          case 'OfferCarousel': {
            const allBanners = getPromoBanners(tenant?.tenantId);
            const relevantBanners = block.bannerIds && block.bannerIds.length > 0
              ? allBanners.filter((b) => block.bannerIds!.includes(b.id))
              : allBanners;

            return (
              <div key={block.id} className="space-y-3">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{block.title}</h3>
                  {block.subtitle && (
                    <p className="text-xs text-gray-500">{block.subtitle}</p>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {relevantBanners.map((banner) => (
                    <div
                      key={banner.id}
                      className="relative rounded-2xl overflow-hidden h-48 bg-gray-900 text-white p-5 flex flex-col justify-between shadow-md border border-gray-100"
                    >
                      <img
                        src={banner.backgroundImageUrl}
                        alt={banner.title}
                        className="absolute inset-0 w-full h-full object-cover opacity-60"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                      <div className="relative z-10">
                        {banner.badge && (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500 text-white mb-2 shadow-xs">
                            {banner.badge}
                          </span>
                        )}
                        <h4 className="font-extrabold text-base text-white tracking-tight line-clamp-1">
                          {banner.title}
                        </h4>
                        <p className="text-xs text-gray-300 line-clamp-2 mt-1">
                          {banner.subtitle}
                        </p>
                      </div>
                      <div className="relative z-10 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (banner.targetCategoryId) {
                              onSelectCategory(banner.targetCategoryId);
                            }
                          }}
                          className="px-3.5 py-1.5 rounded-xl font-bold text-xs bg-white text-gray-900 hover:bg-gray-100 transition-transform active:scale-95 shadow-xs"
                        >
                          {banner.buttonLabel || 'Explore Offer'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          }

          case 'FAQ':
            return (
              <div key={block.id} className="space-y-3">
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-lg font-bold text-gray-900">{block.title}</h3>
                </div>
                <div className="divide-y divide-gray-100 rounded-2xl bg-white border border-gray-100 overflow-hidden">
                  {block.items.map((item, idx) => {
                    const isOpen = Boolean(openFaqIndices[idx]);
                    return (
                      <div key={idx} className="p-4">
                        <button
                          type="button"
                          onClick={() => toggleFaq(idx)}
                          className="w-full flex items-center justify-between text-left font-bold text-sm text-gray-900 gap-4"
                        >
                          <span>{item.question}</span>
                          {isOpen ? (
                            <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                          )}
                        </button>
                        {isOpen && (
                          <p className="mt-2 text-xs text-gray-600 leading-relaxed">
                            {item.answer}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );

          case 'Image':
            return (
              <figure key={block.id} className="space-y-2">
                <img
                  src={block.imageUrl}
                  alt={block.altText}
                  className={`w-full rounded-2xl object-cover ${block.aspectRatio === '1:1' ? 'aspect-square' : block.aspectRatio === '4:3' ? 'aspect-[4/3]' : 'aspect-video'}`}
                />
                {block.caption && <figcaption className="text-xs text-gray-500">{block.caption}</figcaption>}
              </figure>
            );

          case 'Video':
            return (
              <figure key={block.id} className="space-y-2">
                <video
                  src={block.videoUrl}
                  poster={block.posterUrl}
                  autoPlay={block.autoplay === true}
                  muted={block.autoplay === true}
                  playsInline
                  controls
                  className="w-full rounded-2xl bg-black"
                />
                {block.caption && <figcaption className="text-xs text-gray-500">{block.caption}</figcaption>}
              </figure>
            );

          case 'Stories':
            return (
              <section key={block.id} className="space-y-3">
                {block.title && <h3 className="text-lg font-bold text-gray-900">{block.title}</h3>}
                {stories.length > 0 ? (
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {stories.map((story) => (
                      <div key={story.id} className="min-w-28 max-w-28">
                        <div className="aspect-[3/4] overflow-hidden rounded-2xl bg-gray-100">
                          {story.thumbnailUrl || (story.mediaType !== 'video' && story.mediaUrl) ? (
                            <img
                              src={story.thumbnailUrl || story.mediaUrl}
                              alt={story.title || 'Story'}
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </div>
                        {story.title && <p className="mt-1 line-clamp-2 text-xs font-bold text-gray-800">{story.title}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">No stories are currently available.</p>
                )}
              </section>
            );

          case 'CTA':
            return (
              <div
                key={block.id}
                className="p-6 md:p-8 rounded-3xl text-center bg-gray-900 text-white shadow-lg space-y-3"
              >
                <h3 className="text-xl font-bold">{block.title}</h3>
                {block.description && (
                  <p className="text-xs md:text-sm text-gray-300 max-w-md mx-auto">
                    {block.description}
                  </p>
                )}
                <button
                  type="button"
                  className="px-6 py-2.5 rounded-xl font-bold text-xs text-gray-900 bg-white hover:bg-gray-100 shadow-md transition-transform active:scale-95"
                >
                  {block.buttonLabel}
                </button>
              </div>
            );

          case 'StoreFinder':
            return (
              <div
                key={block.id}
                className="p-6 rounded-3xl bg-emerald-50/70 border border-emerald-200/60 flex flex-col md:flex-row items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Store className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-emerald-950">{block.title}</h4>
                    {block.description && (
                      <p className="text-xs text-emerald-800/80">{block.description}</p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 shadow-xs flex items-center gap-1.5 shrink-0"
                >
                  <span>Locate Stores</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            );

          case 'Divider':
            return (
              <hr
                key={block.id}
                className={
                  block.style === 'bold'
                    ? 'border-t-2 border-gray-200 my-6'
                    : block.style === 'dashed'
                    ? 'border-t border-dashed border-gray-200 my-6'
                    : 'border-t border-gray-100 my-4'
                }
              />
            );

          case 'Spacer':
            return <div key={block.id} style={{ height: `${block.heightPx}px` }} />;

          default:
            return null;
        }
      })}
    </div>
  );
};
