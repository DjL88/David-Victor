import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  Store as StoreIcon,
  CheckCircle2,
  ArrowRight,
  Layers,
  Filter,
  BadgePercent,
  Plus,
  Info,
  Flame,
  X,
  Play,
  Pause,
  Tag,
} from 'lucide-react';
import {
  CategoryPromoBanner,
  Category,
  Store,
  Product,
} from '../../commerce/models';
import {
  getBannersForCategory,
  checkBannerStock,
} from '../../commerce/promoBannerData';
import {
  DELIVERECT_CATALOG_DEALS,
  getDealForBanner,
  DeliverectDeal,
} from '../../commerce/dealModels';
import {
  BundleProduct,
  SAMPLE_DELIVERECT_BUNDLES,
  evaluateBundleStockStatus,
} from '../../commerce/bundleModels';
import { useTenantStyles } from '../../tenant/useTenant';
import { formatCurrency, formatMoney } from '../../utils/formatters';

export type CarouselSlide =
  | { type: 'banner'; id: string; banner: CategoryPromoBanner; bannerIndex: number }
  | { type: 'combos'; id: string; title: string };

interface PromotionalBannerCarouselProps {
  selectedCategoryId: string | null;
  categories: Category[];
  selectedStore: Store | null;
  products?: Product[];
  bundles?: BundleProduct[];
  onOpenStorePicker?: () => void;
  onSelectCategory?: (categoryId: string | null) => void;
  onSelectProductPlu?: (plu: string) => void;
  onSelectProduct?: (product: Product) => void;
  onOpenDealDialog?: (deal: DeliverectDeal) => void;
  onOpenBundleDialog?: (bundle: BundleProduct) => void;
  onFilterByDeal?: (deal: DeliverectDeal) => void;
  onClearDealFilter?: () => void;
  activeDealFilter?: DeliverectDeal | null;
  onAddItemsToBasket?: (plus: string[], dealTitle?: string) => void;
  onAddToCart?: (product: Product, quantity?: number) => void;
  getBasketQuantity?: (plu: string) => number;
  activeCarouselTab?: 'featured' | 'deals';
  onTabChange?: (tab: 'featured' | 'deals') => void;
}

export const PromotionalBannerCarousel: React.FC<PromotionalBannerCarouselProps> = ({
  selectedCategoryId,
  categories,
  selectedStore,
  products = [],
  bundles = SAMPLE_DELIVERECT_BUNDLES,
  onOpenStorePicker,
  onSelectCategory,
  onSelectProductPlu,
  onSelectProduct,
  onOpenDealDialog,
  onOpenBundleDialog,
  onFilterByDeal,
  onClearDealFilter,
  activeDealFilter,
  onAddItemsToBasket,
  onAddToCart,
  getBasketQuantity,
  activeCarouselTab = 'featured',
  onTabChange,
}) => {
  const { primaryBtnStyle, currencySymbol } = useTenantStyles();

  // Dynamic banner version state to respond to admin updates immediately
  const [bannerVersion, setBannerVersion] = useState(0);

  useEffect(() => {
    const handlePromoUpdate = () => {
      setBannerVersion((v) => v + 1);
    };
    window.addEventListener('promo-banners-updated', handlePromoUpdate);
    return () => window.removeEventListener('promo-banners-updated', handlePromoUpdate);
  }, []);

  // Retrieve banners filtered by selected category
  const banners = useMemo(() => {
    return getBannersForCategory(selectedCategoryId, categories);
  }, [selectedCategoryId, categories, bannerVersion]);

  // Build unified carousel slides where Combo Deals & Bundles is slide 2!
  const slides = useMemo<CarouselSlide[]>(() => {
    const list: CarouselSlide[] = [];
    const hasCombos = (bundles && bundles.length > 0) || DELIVERECT_CATALOG_DEALS.length > 0;

    if (banners.length === 0) {
      if (hasCombos) {
        list.push({ type: 'combos', id: 'combos-slide-main', title: 'Combo Deals' });
      }
      return list;
    }

    // Slide 1: Primary Featured Category Offer banner
    list.push({
      type: 'banner',
      id: `banner-${banners[0].id}`,
      banner: banners[0],
      bannerIndex: 0,
    });

    // Slide 2: Combo Deals & Bundles (User requested: "make Meal Deals & Bundles part of Featured Offers, like slide 2!")
    if (hasCombos) {
      list.push({
        type: 'combos',
        id: 'combos-slide-main',
        title: 'Combo Deals',
      });
    }

    // Slide 3+: Remaining promotional banners
    for (let i = 1; i < banners.length; i++) {
      list.push({
        type: 'banner',
        id: `banner-${banners[i].id}`,
        banner: banners[i],
        bannerIndex: i,
      });
    }

    return list;
  }, [banners, bundles]);

  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [autoCycle, setAutoCycle] = useState(true);
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null);

  // Deals carousel horizontal scroll track ref
  const dealsTrackRef = useRef<HTMLDivElement>(null);

  // Refs for timer callback
  const currentSlideIndexRef = useRef(currentSlideIndex);
  currentSlideIndexRef.current = currentSlideIndex;
  const slidesCountRef = useRef(slides.length);
  slidesCountRef.current = slides.length;

  // Reset index to 0 when category changes
  useEffect(() => {
    setCurrentSlideIndex(0);
    currentSlideIndexRef.current = 0;
  }, [selectedCategoryId]);

  // Sync when activeDealFilter is selected or activeCarouselTab is 'deals'
  useEffect(() => {
    if (activeDealFilter || activeCarouselTab === 'deals') {
      const comboIdx = slides.findIndex((s) => s.type === 'combos');
      if (comboIdx >= 0) {
        setCurrentSlideIndex(comboIdx);
        currentSlideIndexRef.current = comboIdx;
      }
    }
  }, [activeDealFilter, activeCarouselTab, slides]);

  const currentSlide: CarouselSlide | undefined = slides[currentSlideIndex] || slides[0];

  const handlePrevSlide = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (slides.length <= 1) return;
    const nextIdx = (currentSlideIndexRef.current - 1 + slides.length) % slides.length;
    currentSlideIndexRef.current = nextIdx;
    setCurrentSlideIndex(nextIdx);
    notifyTabChange(nextIdx);
  };

  const handleNextSlide = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (slides.length <= 1) return;
    const nextIdx = (currentSlideIndexRef.current + 1) % slides.length;
    currentSlideIndexRef.current = nextIdx;
    setCurrentSlideIndex(nextIdx);
    notifyTabChange(nextIdx);
  };

  const notifyTabChange = (idx: number) => {
    const targetSlide = slides[idx];
    if (targetSlide?.type === 'combos') {
      onTabChange?.('deals');
    } else {
      onTabChange?.('featured');
    }
  };

  const handleGoToSlide = (idx: number) => {
    currentSlideIndexRef.current = idx;
    setCurrentSlideIndex(idx);
    notifyTabChange(idx);
  };

  // Top tabs handler
  const handleTabFeatured = () => {
    // If currently on combo slide, jump back to Slide 1
    if (currentSlide?.type === 'combos') {
      handleGoToSlide(0);
    } else {
      onTabChange?.('featured');
    }
  };

  const handleTabCombos = () => {
    const comboIdx = slides.findIndex((s) => s.type === 'combos');
    if (comboIdx >= 0) {
      handleGoToSlide(comboIdx);
    }
  };

  // Active banner data when current slide is a banner
  const activeBanner = currentSlide?.type === 'banner' ? currentSlide.banner : undefined;

  // Evaluate stock for active banner
  const stockInfo = useMemo(() => {
    if (!activeBanner) return null;
    return checkBannerStock(activeBanner, products, selectedStore?.name);
  }, [activeBanner, products, selectedStore?.name]);

  // Check if banner is an offer / meal deal / bundle
  const activeDeal = useMemo(() => {
    if (!activeBanner) return null;
    return getDealForBanner(activeBanner, products);
  }, [activeBanner, products]);

  const handleActionClick = () => {
    if (!activeBanner) return;

    if (activeDeal && onOpenDealDialog) {
      onOpenDealDialog(activeDeal);
      return;
    }

    if (activeBanner.actionType === 'STORE_PICKER' && onOpenStorePicker) {
      onOpenStorePicker();
    } else if (activeBanner.actionType === 'PRODUCT' && activeBanner.targetPlu && onSelectProductPlu) {
      onSelectProductPlu(activeBanner.targetPlu);
    } else if (activeBanner.actionType === 'CATEGORY' && activeBanner.targetCategoryId && onSelectCategory) {
      onSelectCategory(activeBanner.targetCategoryId);
    } else if (activeBanner.targetPlu && onSelectProductPlu) {
      onSelectProductPlu(activeBanner.targetPlu);
    } else if (onOpenStorePicker) {
      onOpenStorePicker();
    }
  };

  // Auto-advance across slides smoothly when autoCycle is true
  useEffect(() => {
    if (!autoCycle || isPaused) {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current);
      return;
    }

    autoPlayRef.current = setInterval(() => {
      const numSlides = slidesCountRef.current;
      if (numSlides > 1) {
        const nextIdx = (currentSlideIndexRef.current + 1) % numSlides;
        currentSlideIndexRef.current = nextIdx;
        setCurrentSlideIndex(nextIdx);
        notifyTabChange(nextIdx);
      }
    }, 5500);

    return () => {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    };
  }, [autoCycle, isPaused, slides.length]);

  const handleDealsScroll = (direction: 'left' | 'right') => {
    if (!dealsTrackRef.current) return;
    const amount = direction === 'left' ? -320 : 320;
    dealsTrackRef.current.scrollBy({ left: amount, behavior: 'smooth' });
  };

  // If no slides at all, hide carousel
  if (slides.length === 0) {
    return null;
  }

  const isComboSlideActive = currentSlide?.type === 'combos';
  const totalCombosCount = bundles.length + DELIVERECT_CATALOG_DEALS.length;

  return (
    <div
      id="main-promotional-super-carousel"
      className="w-full max-w-full space-y-2 select-none overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role="region"
      aria-label="Store Promotional Carousel"
    >
      {/* UNIFIED CAROUSEL NAVIGATION TABS & AUTO-CYCLE TOGGLE */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar pb-0.5 px-0.5 w-full max-w-full">
        <div className="flex items-center gap-1.5 p-1 bg-gray-100/90 backdrop-blur-sm rounded-2xl shadow-2xs border border-gray-200/60 shrink-0">
          {/* TAB 1: Featured Offers (Contains all hero slides, including Slide 2 Combo Deals) */}
          <button
            type="button"
            id="carousel-tab-featured"
            onClick={handleTabFeatured}
            className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              !isComboSlideActive
                ? 'bg-white text-gray-950 shadow-2xs font-extrabold'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            <span>Featured Offers</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-gray-200 text-gray-700">
              {slides.length}
            </span>
          </button>

          {/* TAB 2: Combo Deals (Direct jump to Slide 2) */}
          {totalCombosCount > 0 && (
            <button
              type="button"
              id="carousel-tab-deals"
              onClick={handleTabCombos}
              className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isComboSlideActive
                  ? 'bg-emerald-600 text-white shadow-2xs font-extrabold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <BadgePercent className={`w-3.5 h-3.5 ${isComboSlideActive ? 'text-white' : 'text-emerald-600'}`} />
              <span>Combo Deals</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  isComboSlideActive
                    ? 'bg-emerald-700 text-emerald-100'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {totalCombosCount}
              </span>
            </button>
          )}
        </div>

        {/* AUTO-CYCLE TOGGLE PILL */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            id="toggle-carousel-autocycle"
            onClick={() => setAutoCycle((prev) => !prev)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
              autoCycle
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-2xs'
                : 'bg-gray-100 text-gray-500 border-gray-200'
            }`}
            title={autoCycle ? 'Auto-cycle running. Click to pause.' : 'Auto-cycle paused. Click to resume.'}
          >
            {autoCycle ? (
              <>
                <Pause className="w-3 h-3 text-emerald-600" />
                <span className="text-[11px] font-bold">Auto Cycle</span>
                {isPaused && (
                  <span className="text-[10px] text-amber-600 font-normal hidden sm:inline">(paused on hover)</span>
                )}
              </>
            ) : (
              <>
                <Play className="w-3 h-3 text-gray-500 fill-current" />
                <span className="text-[11px] font-medium">Cycle Paused</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* STANDARDIZED CAROUSEL CONTAINER (IDENTICAL HEIGHT ACROSS ALL SLIDES) */}
      <div className="relative w-full overflow-hidden rounded-3xl shadow-xl h-[420px] sm:h-[440px] md:h-[450px] bg-gray-950">
        <AnimatePresence initial={false} mode="wait">
          {/* ========================================================= */}
          {/* SLIDE TYPE: BANNER OFFER                                  */}
          {/* ========================================================= */}
          {currentSlide?.type === 'banner' && activeBanner && (
            <motion.div
              key={currentSlide.id}
              initial={{ opacity: 0, scale: 1.02 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="relative h-full w-full bg-gray-900"
            >
              {/* BACKGROUND IMAGE SLIDE */}
              <div
                className="absolute inset-0 w-full h-full bg-cover bg-center"
                style={{
                  backgroundImage: `url(${activeBanner.backgroundImageUrl})`,
                }}
              />

              {/* SOPHISTICATED GRADIENT OVERLAY */}
              <div className="absolute inset-0 bg-gradient-to-r from-gray-950/90 via-gray-950/70 to-gray-950/20" />
              <div className="absolute inset-0 bg-gradient-to-t from-gray-950/80 via-transparent to-black/30" />

              {/* CONTENT LAYER */}
              <div className="relative h-full flex flex-col justify-between p-6 sm:p-8 md:p-10 z-10">
                {/* TOP BAR */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {activeBanner.badge && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-white text-xs font-bold tracking-wide">
                        <Tag className="w-3.5 h-3.5 text-amber-300" />
                        <span>{activeBanner.badge}</span>
                      </div>
                    )}

                    {/* LIVE STORE STOCK LINKING BADGE */}
                    {stockInfo && stockInfo.totalLinkedCount > 0 && (
                      <div
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md border transition-colors ${
                          stockInfo.isEligible
                            ? 'bg-emerald-500/20 border-emerald-400/30 text-emerald-200'
                            : 'bg-rose-500/20 border-rose-400/30 text-rose-200'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            stockInfo.isEligible ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                          }`}
                        />
                        <span>
                          {stockInfo.statusLabel ||
                            (stockInfo.isEligible ? 'Stock Verified' : 'Check Location Stock')}
                        </span>
                      </div>
                    )}
                  </div>

                  {selectedStore?.name && (
                    <div className="text-xs text-white/80 flex items-center gap-1.5 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Serving from {selectedStore.name}</span>
                    </div>
                  )}
                </div>

                {/* MAIN PROMO HEADLINE & COPY */}
                <div className="max-w-xl space-y-3 py-2">
                  <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight drop-shadow-sm">
                    {activeBanner.title}
                  </h2>

                  <p className="text-sm sm:text-base text-gray-200/90 leading-relaxed font-medium line-clamp-3 sm:line-clamp-none drop-shadow-xs">
                    {activeBanner.subtitle}
                  </p>

                  {/* CTA BUTTONS */}
                  <div className="pt-2 flex flex-wrap items-center gap-2.5 sm:gap-3">
                    <button
                      type="button"
                      id="carousel-primary-action-btn"
                      onClick={handleActionClick}
                      className="inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl bg-white text-gray-950 font-bold text-xs sm:text-sm hover:bg-gray-100 active:scale-98 transition-all shadow-lg hover:shadow-white/20 cursor-pointer"
                    >
                      {activeDeal ? (
                        <BadgePercent className="w-4 h-4 text-emerald-600" />
                      ) : activeBanner.actionType === 'STORE_PICKER' ? (
                        <StoreIcon className="w-4 h-4 text-emerald-600" />
                      ) : activeBanner.actionType === 'PRODUCT' ? (
                        <ShoppingBag className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Layers className="w-4 h-4 text-emerald-600" />
                      )}
                      <span>
                        {activeDeal
                          ? `View Deal & Items • £${(activeDeal.dealPrice ?? 0).toFixed(2)}`
                          : activeBanner.buttonLabel}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-gray-500 group-hover:translate-x-0.5 transition-transform" />
                    </button>

                    {/* Option 2: Filter catalogue to this deal */}
                    {activeDeal && onFilterByDeal && (
                      <button
                        type="button"
                        id="carousel-filter-deal-btn"
                        onClick={() => onFilterByDeal(activeDeal)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2.5 sm:py-3 rounded-2xl bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/25 text-white font-bold text-xs sm:text-sm active:scale-98 transition-all cursor-pointer"
                      >
                        <Filter className="w-3.5 h-3.5 text-emerald-300" />
                        <span>Filter Catalogue</span>
                      </button>
                    )}

                    {/* Option 3: If AND story/deal, quick Add All to Basket */}
                    {activeDeal &&
                      activeDeal.stockMatchMode === 'AND' &&
                      onAddItemsToBasket && (
                        <button
                          type="button"
                          id="carousel-add-all-deal-btn"
                          onClick={() =>
                            onAddItemsToBasket(
                              activeDeal.linkedProductPlus,
                              activeDeal.title
                            )
                          }
                          className="inline-flex items-center gap-1.5 px-3.5 py-2.5 sm:py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-black text-xs sm:text-sm active:scale-98 transition-all shadow-md cursor-pointer"
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>Add All ({activeDeal.linkedProductPlus.length}) • £{(activeDeal.dealPrice ?? 0).toFixed(2)}</span>
                        </button>
                      )}
                  </div>
                </div>

                {/* BOTTOM CONTROLS & UNIFIED SLIDE INDICATORS */}
                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                  <div className="flex items-center gap-1.5">
                    {slides.map((s, idx) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handleGoToSlide(idx)}
                        className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                          idx === currentSlideIndex
                            ? 'w-7 bg-white'
                            : s.type === 'combos'
                            ? 'w-3 bg-emerald-400/80 hover:bg-emerald-300'
                            : 'w-2 bg-white/40 hover:bg-white/70'
                        }`}
                        aria-label={`Go to slide ${idx + 1}${s.type === 'combos' ? ' (Combo Deals)' : ''}`}
                        title={s.type === 'combos' ? 'Slide 2: Combo Deals' : `Slide ${idx + 1}`}
                      />
                    ))}
                    <span className="ml-2 text-[11px] font-semibold text-white/70 flex items-center gap-1">
                      <span>{currentSlideIndex + 1} of {slides.length}</span>
                      {slides.length > 1 && currentSlideIndex === 0 && (
                        <span className="hidden sm:inline text-emerald-300 text-[10px]">• Next: Combo Deals</span>
                      )}
                    </span>
                  </div>

                  {slides.length > 1 && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handlePrevSlide}
                        className="p-2 rounded-full bg-white/10 hover:bg-white/25 active:scale-95 text-white backdrop-blur-md border border-white/15 transition-all cursor-pointer"
                        aria-label="Previous slide"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={handleNextSlide}
                        className="p-2 rounded-full bg-white/10 hover:bg-white/25 active:scale-95 text-white backdrop-blur-md border border-white/15 transition-all cursor-pointer"
                        aria-label="Next slide"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ========================================================= */}
          {/* SLIDE TYPE: COMBO DEALS & BUNDLES (SLIDE 2)               */}
          {/* ========================================================= */}
          {currentSlide?.type === 'combos' && (
            <motion.div
              key="combos-slide-main"
              initial={{ opacity: 0, scale: 0.99 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="relative h-full w-full bg-gradient-to-br from-gray-950 via-emerald-950/85 to-gray-950 text-white p-4 sm:p-5 md:p-6 flex flex-col justify-between overflow-hidden"
            >
              {/* Header & Internal Combos Track Navigation */}
              <div className="flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <BadgePercent className="w-4 h-4 sm:w-5 sm:h-5" />
                  </span>
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold tracking-tight text-white flex items-center gap-2">
                      <span>Combo Deals</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                        Slide 2 • Discounts Apply in Basket
                      </span>
                    </h3>
                    <p className="text-[11px] sm:text-xs text-gray-300 line-clamp-1">
                      Combo deals, bundles & savings are automatically calculated and deducted from your basket subtotal
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {activeDealFilter && onClearDealFilter && (
                    <button
                      type="button"
                      onClick={onClearDealFilter}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-gray-200 transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Reset</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDealsScroll('left')}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer transition-colors"
                    aria-label="Scroll combo deals left"
                    title="Scroll left"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDealsScroll('right')}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer transition-colors"
                    aria-label="Scroll combo deals right"
                    title="Scroll right"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Seamless Rolling Carousel Track for Combos & Bundles */}
              <div
                ref={dealsTrackRef}
                className="flex items-stretch gap-3.5 overflow-x-auto no-scrollbar py-2 my-auto scroll-smooth w-full max-w-full"
              >
                {/* Deliverect Combo Bundles (e.g. Meal Deal Test with dynamic modifier groups) */}
                {bundles.map((bundle) => {
                  const groups = bundle.sections || bundle.modifierGroups || [];
                  const stock = evaluateBundleStockStatus(groups);
                  const isOutOfStock = stock.stockStatus === 'OUT_OF_STOCK';
                  const sectionNames = groups
                    .filter((g) => g.min > 0)
                    .map((g) => (g.max > 1 ? `${g.name} (${g.max})` : g.name))
                    .join(' • ');

                  return (
                    <div
                      key={`bundle-${bundle.id}`}
                      className={`w-72 sm:w-80 shrink-0 h-[275px] sm:h-[290px] rounded-2xl overflow-hidden bg-white/10 backdrop-blur-md border transition-all flex flex-col justify-between p-3 ${
                        isOutOfStock
                          ? 'border-white/5 opacity-75'
                          : 'border-emerald-500/40 hover:border-emerald-400/70 hover:bg-white/15'
                      }`}
                    >
                      {/* Top image & badge */}
                      <div className="relative h-24 sm:h-28 w-full rounded-xl overflow-hidden bg-gray-800 shrink-0">
                        <img
                          src={
                            bundle.imageUrl ||
                            bundle.image ||
                            'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80'
                          }
                          alt={bundle.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                        <span className="absolute top-2 left-2 px-2.5 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-black shadow-xs flex items-center gap-1">
                          <Layers className="w-3 h-3" />
                          Combo Deal
                        </span>
                        {isOutOfStock ? (
                          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-rose-600/90 text-white text-[10px] font-bold">
                            Out of Stock
                          </span>
                        ) : (
                          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/50 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold backdrop-blur-xs">
                            Deliverect Verified
                          </span>
                        )}
                        <span className="absolute bottom-1.5 left-2 right-2 text-xs font-bold text-white truncate">
                          {bundle.name}
                        </span>
                      </div>

                      {/* Middle details */}
                      <div className="py-2 flex-1 flex flex-col justify-between">
                        <div className="space-y-1">
                          <div className="flex items-baseline justify-between text-xs">
                            <span className="text-emerald-400 font-black text-sm">
                              From {formatMoney(bundle.price, bundle.currency || 'GBP')}
                            </span>
                            <span className="text-[10px] text-emerald-300 font-bold bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                              Build Your Combo
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-300 line-clamp-2 leading-tight">
                            {bundle.description || sectionNames}
                          </p>
                          {sectionNames && (
                            <p className="text-[10px] text-emerald-400/90 font-medium truncate">
                              Includes: {sectionNames}
                            </p>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="pt-1.5">
                          <button
                            type="button"
                            disabled={isOutOfStock}
                            onClick={() => onOpenBundleDialog?.(bundle)}
                            className={`w-full py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer active:scale-98 ${
                              isOutOfStock
                                ? 'bg-neutral-800 text-neutral-400 cursor-not-allowed border border-neutral-700'
                                : 'bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-black shadow-emerald-950/40'
                            }`}
                          >
                            <ShoppingBag className="w-3.5 h-3.5" />
                            <span>{isOutOfStock ? 'Unavailable at Store' : 'Customise & Add'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {DELIVERECT_CATALOG_DEALS.map((deal) => {
                  const isSelected = activeDealFilter?.id === deal.id;
                  const isAnd = deal.stockMatchMode === 'AND';

                  return (
                    <div
                      key={deal.id}
                      className={`w-72 sm:w-80 shrink-0 h-[275px] sm:h-[290px] rounded-2xl overflow-hidden bg-white/10 backdrop-blur-md border transition-all flex flex-col justify-between p-3 ${
                        isSelected
                          ? 'border-emerald-400 ring-2 ring-emerald-400/40 bg-white/15 shadow-lg'
                          : 'border-white/10 hover:border-white/25 hover:bg-white/12'
                      }`}
                    >
                      {/* Top image & badge */}
                      <div className="relative h-24 sm:h-28 w-full rounded-xl overflow-hidden bg-gray-800 shrink-0">
                        <img
                          src={deal.imageUrl}
                          alt={deal.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        <span className="absolute top-2 left-2 px-2.5 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-black shadow-xs">
                          {deal.badge}
                        </span>
                        <span className="absolute bottom-1.5 left-2 right-2 text-xs font-bold text-white truncate">
                          {deal.title}
                        </span>
                      </div>

                      {/* Middle details */}
                      <div className="py-2 flex-1 flex flex-col justify-between">
                        <div className="space-y-1">
                          <div className="flex items-baseline justify-between text-xs">
                            <span className="text-emerald-400 font-black text-sm">
                              £{(deal.dealPrice ?? 0).toFixed(2)}
                            </span>
                            {(deal.savings ?? 0) > 0 && (
                              <span className="text-[10px] text-emerald-300 font-bold bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                                Save £{(deal.savings ?? 0).toFixed(2)}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-300 line-clamp-2 leading-tight">
                            {deal.description}
                          </p>
                        </div>

                        {/* Action buttons */}
                        <div className="flex flex-col gap-1.5 pt-1.5">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  onClearDealFilter?.();
                                } else {
                                  onFilterByDeal?.(deal);
                                }
                              }}
                              className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                                isSelected
                                  ? 'bg-emerald-500 text-gray-950 font-black'
                                  : 'bg-white/20 hover:bg-white/30 text-white'
                              }`}
                            >
                              <Flame className="w-3 h-3" />
                              <span>{isSelected ? 'Filtered' : 'Filter Aisle'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => onOpenDealDialog?.(deal)}
                              className="py-1.5 px-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                              title="View deal breakdown dialog"
                            >
                              <Info className="w-3.5 h-3.5 text-emerald-300" />
                              <span>Details</span>
                            </button>
                          </div>

                          {isAnd && onAddItemsToBasket && (
                            <button
                              type="button"
                              onClick={() =>
                                onAddItemsToBasket(
                                  deal.linkedProductPlus,
                                  deal.title
                                )
                              }
                              className="w-full py-1.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer active:scale-98"
                            >
                              <ShoppingBag className="w-3 h-3" />
                              <span>Add All ({deal.linkedProductPlus.length}) • £{(deal.dealPrice ?? 0).toFixed(2)}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Footer Indicators & Slide Navigation */}
              <div className="flex items-center justify-between pt-2 border-t border-white/10 shrink-0 text-xs text-gray-400">
                <div className="flex items-center gap-1.5">
                  {slides.map((s, idx) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleGoToSlide(idx)}
                      className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                        idx === currentSlideIndex
                          ? 'w-7 bg-emerald-400 shadow-xs'
                          : s.type === 'combos'
                          ? 'w-3 bg-emerald-400/80 hover:bg-emerald-300'
                          : 'w-2 bg-white/40 hover:bg-white/70'
                      }`}
                      aria-label={`Go to slide ${idx + 1}`}
                      title={s.type === 'combos' ? 'Slide 2: Combo Deals' : `Slide ${idx + 1}`}
                    />
                  ))}
                  <span className="ml-2 text-[11px] font-semibold text-white/70">
                    Slide {currentSlideIndex + 1} of {slides.length} (Combo Deals)
                  </span>
                </div>

                {slides.length > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handlePrevSlide}
                      className="p-2 rounded-full bg-white/10 hover:bg-white/25 active:scale-95 text-white backdrop-blur-md border border-white/15 transition-all cursor-pointer"
                      aria-label="Previous slide"
                      title="Previous offer slide"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleNextSlide}
                      className="p-2 rounded-full bg-white/10 hover:bg-white/25 active:scale-95 text-white backdrop-blur-md border border-white/15 transition-all cursor-pointer"
                      aria-label="Next slide"
                      title="Next offer slide"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
