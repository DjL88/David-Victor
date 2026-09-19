import React, { useState, useRef } from 'react';
import { Product, ProductAvailabilitySummary } from '../../commerce/models';
import { useTenantStyles } from '../../tenant/useTenant';
import { formatCurrency } from '../../utils/formatters';
import { ProductImage } from '../../components/media/Media';
import {
  Heart,
  RotateCcw,
  Plus,
  Check,
  ChevronLeft,
  ChevronRight,
  Truck,
  Flame,
} from 'lucide-react';

interface FavouritesCarouselProps {
  products: Product[];
  currentStoreId?: string;
  onAddToCart: (product: Product, quantity?: number) => void;
  onSelectProduct: (product: Product) => void;
  getBasketQuantity: (plu: string) => number;
}

export const FavouritesCarousel: React.FC<FavouritesCarouselProps> = ({
  products,
  currentStoreId,
  onAddToCart,
  onSelectProduct,
  getBasketQuantity,
}) => {
  const { primaryBtnStyle, currencySymbol } = useTenantStyles();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [activeFilter, setActiveFilter] = useState<'all' | 'buyAgain' | 'favourites'>('all');
  const [justAddedPlu, setJustAddedPlu] = useState<string | null>(null);

  // Local state for favourites (pre-seeded with popular essentials)
  const [favouritePlus, setFavouritePlus] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('dl_guest_favourites');
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return [
      'PLU-SOURDOUGH-01',
      'PLU-ORGANIC-EGGS-6PK',
      'PLU-ORGANIC-MILK-2L',
      'PLU-COLDPRESS-ORANGE',
      'PLU-ART-001',
    ];
  });

  // Recent purchases / buy again list
  const buyAgainPlus = [
    'PLU-SOURDOUGH-01',
    'PLU-COLDPRESS-ORANGE',
    'PLU-ORGANIC-MILK-2L',
    'PLU-ART-001',
    'PLU-CRISP-01',
  ];

  const toggleFavourite = (plu: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavouritePlus((prev) => {
      const updated = prev.includes(plu)
        ? prev.filter((p) => p !== plu)
        : [...prev, plu];
      try {
        localStorage.setItem('dl_guest_favourites', JSON.stringify(updated));
      } catch {
        // storage ignored
      }
      return updated;
    });
  };

  const handleQuickAdd = (product: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentQty = getBasketQuantity(product.plu) || 0;
    onAddToCart(product, currentQty + 1);
    setJustAddedPlu(product.plu);
    setTimeout(() => {
      setJustAddedPlu(null);
    }, 1500);
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 320;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  // Filter products for the carousel
  const eligibleProducts = products.filter((p) => {
    const isFav = favouritePlus.includes(p.plu);
    const isBuyAgain = buyAgainPlus.includes(p.plu);

    if (activeFilter === 'favourites') return isFav;
    if (activeFilter === 'buyAgain') return isBuyAgain;
    return isFav || isBuyAgain;
  });

  // Fallback to top products if user un-favourites everything
  const carouselProducts =
    eligibleProducts.length > 0 ? eligibleProducts : products.slice(0, 6);

  return (
    <section id="favourites-buy-again-carousel" className="px-4 py-1 w-full max-w-full overflow-hidden">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shadow-2xs">
            <Heart className="w-4 h-4 fill-rose-500 text-rose-500" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-gray-900 tracking-tight">
                Favourites & Buy Again
              </h2>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100/80 text-[10px] font-bold text-rose-700">
                <RotateCcw className="w-3 h-3" />
                1-Tap Reorder
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Your saved essentials ready for instant dispatch
            </p>
          </div>
        </div>

        {/* Filter Pills & Scroll Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-gray-100 p-0.5 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                activeFilter === 'all'
                  ? 'bg-white text-gray-900 shadow-2xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              All Items
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('buyAgain')}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                activeFilter === 'buyAgain'
                  ? 'bg-white text-gray-900 shadow-2xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <RotateCcw className="w-3 h-3" />
              <span>Buy Again</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('favourites')}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                activeFilter === 'favourites'
                  ? 'bg-white text-gray-900 shadow-2xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Heart className="w-3 h-3" />
              <span>Saved</span>
            </button>
          </div>

          <div className="hidden md:flex items-center gap-1">
            <button
              type="button"
              onClick={() => scroll('left')}
              className="w-7 h-7 rounded-full bg-white border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-600 shadow-2xs transition-colors"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => scroll('right')}
              className="w-7 h-7 rounded-full bg-white border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-600 shadow-2xs transition-colors"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Horizontal Carousel Track */}
      <div
        ref={scrollContainerRef}
        className="flex items-stretch gap-3 sm:gap-4 overflow-x-auto no-scrollbar pb-3 pt-1 scroll-smooth w-full max-w-full"
      >
        {carouselProducts.map((product) => {
          const isFav = favouritePlus.includes(product.plu);
          const isBuyAgain = buyAgainPlus.includes(product.plu);
          const inBasketQty = getBasketQuantity(product.plu);
          const isAdded = justAddedPlu === product.plu;
          const isOutOfStock = product.stockStatus === 'OUT_OF_STOCK' || product.stockQuantity === 0;
          const prodName = product.name || product.plu || 'Product';

          return (
            <div
              key={`fav-card-${product.plu}`}
              id={`fav-product-${product.plu}`}
              onClick={() => onSelectProduct(product)}
              className="w-52 sm:w-60 shrink-0 bg-white rounded-2xl border border-gray-100 hover:border-gray-300 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden cursor-pointer group"
            >
              {/* Card Top: Image & Badges */}
              <div className="relative p-3 pb-0">
                <div className="w-full h-32 rounded-xl bg-gray-50 overflow-hidden relative border border-gray-100 flex items-center justify-center">
                  <ProductImage
                    src={product.imageUrl || product.images?.[0]}
                    alt={prodName}
                    productName={prodName}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />

                  {/* Badge */}
                  <div className="absolute top-2 left-2 flex flex-col gap-1">
                    {isBuyAgain && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/90 backdrop-blur-xs text-white text-[10px] font-bold shadow-2xs">
                        <RotateCcw className="w-2.5 h-2.5" />
                        Bought 3x
                      </span>
                    )}
                    {isFav && !isBuyAgain && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/90 backdrop-blur-xs text-white text-[10px] font-bold shadow-2xs">
                        <Heart className="w-2.5 h-2.5 fill-current" />
                        Favourite
                      </span>
                    )}
                  </div>

                  {/* Heart Button */}
                  <button
                    type="button"
                    onClick={(e) => toggleFavourite(product.plu, e)}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 backdrop-blur-xs hover:bg-white shadow-xs flex items-center justify-center text-gray-400 hover:text-rose-500 transition-colors"
                    title={isFav ? 'Remove from favourites' : 'Save to favourites'}
                  >
                    <Heart
                      className={`w-3.5 h-3.5 transition-colors ${
                        isFav ? 'fill-rose-500 text-rose-500' : 'text-gray-400'
                      }`}
                    />
                  </button>

                  {/* Stock Warning overlay if applicable */}
                  {isOutOfStock && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-2xs flex items-center justify-center">
                      <span className="text-[11px] font-bold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full border border-gray-200">
                        Out of stock
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Card Body */}
              <div className="p-3 flex flex-col flex-1 justify-between">
                <div>
                  <h3 className="text-xs font-bold text-gray-900 line-clamp-2 group-hover:text-emerald-700 transition-colors leading-snug">
                    {prodName}
                  </h3>
                  {(product.supplementalInfo?.netQuantity || (product as any).packSize) && (
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {product.supplementalInfo?.netQuantity || (product as any).packSize}
                    </p>
                  )}
                </div>

                {/* Price and Add to Basket Action */}
                <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black text-gray-900">
                      {formatCurrency(product.price, currencySymbol)}
                    </span>
                    {product.deposit && (
                      <span className="text-[9px] text-emerald-700 font-semibold block">
                        +{formatCurrency(product.deposit, currencySymbol)} DRS
                      </span>
                    )}
                  </div>

                  {/* Quick 1-Tap Add Button */}
                  <button
                    type="button"
                    onClick={(e) => handleQuickAdd(product, e)}
                    disabled={isOutOfStock}
                    style={isAdded ? undefined : primaryBtnStyle}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 shadow-2xs transition-all active:scale-95 ${
                      isAdded
                        ? 'bg-emerald-700 text-white'
                        : isOutOfStock
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                        : 'text-white'
                    }`}
                  >
                    {isAdded ? (
                      <>
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>Added</span>
                      </>
                    ) : inBasketQty > 0 ? (
                      <>
                        <span className="w-4 h-4 rounded-full bg-white/30 text-white flex items-center justify-center text-[10px]">
                          {inBasketQty}
                        </span>
                        <span>Add</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
