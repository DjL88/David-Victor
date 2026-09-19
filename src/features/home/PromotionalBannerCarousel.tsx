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
  subscribePromoBanners,
  fetchPromoBannersForTenant,
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
import { ProductImage } from '../../components/media/Media';

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
  tenantId?: string;
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
  tenantId = 'brand-alpha',
}) => {
  const { primaryBtnStyle, currencySymbol } = useTenantStyles();

  // Internal tab state for uncontrolled usage, or respect controlled prop
  const [uncontrolledTab, setUncontrolledTab] = useState<'featured' | 'deals'>('featured');
  const currentTab = activeCarouselTab !== undefined ? activeCarouselTab : uncontrolledTab;

  const handleSetTab = (tab: 'featured' | 'deals') => {
    if (activeCarouselTab === undefined) {
      setUncontrolledTab(tab);
    }
    onTabChange?.(tab);
  };

  // Featured banners state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [autoCycle, setAutoCycle] = useState(true);
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null);

  // Deals carousel scroll ref & state
  const dealsTrackRef = useRef<HTMLDivElement>(null);
  const [dealSlideIndex, setDealSlideIndex] = useState(0);

  // Refs to prevent cross-component setState calls inside React state updaters
  const currentTabRef = useRef(currentTab);
  currentTabRef.current = currentTab;
  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;
  const dealSlideIndexRef = useRef(dealSlideIndex);
  dealSlideIndexRef.current = dealSlideIndex;

  const [bannerVersion, setBannerVersion] = useState(0);

  useEffect(() => {
    fetchPromoBannersForTenant(tenantId);
  }, [tenantId]);

  useEffect(() => {
    const unsub = subscribePromoBanners((updatedTenantId) => {
      if (!updatedTenantId || updatedTenantId === tenantId) {
        setBannerVersion((v) => v + 1);
      }
    });
    return () => unsub();
  }, [tenantId]);

  // Retrieve banners filtered by selected category
  const banners = useMemo(() => {
    return getBannersForCategory(selectedCategoryId, categories, tenantId);
  }, [selectedCategoryId, categories, bannerVersion, tenantId]);

  const bannersCountRef = useRef(banners.length);
  bannersCountRef.current = banners.length;

  // Reset index when category changes
  useEffect(() => {
    setCurrentIndex(0);
    currentIndexRef.current = 0;
  }, [selectedCategoryId]);

  const activeBanner: CategoryPromoBanner | undefined = banners[currentIndex] || banners[0];

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  };

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

  // Auto-advance across tabs and slides smoothly when autoCycle is true
  useEffect(() => {
    if (!autoCycle || isPaused) {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current);
      return;
    }

    autoPlayRef.current = setInterval(() => {
      const tab = currentTabRef.current;
      const numBanners = bannersCountRef.current;

      if (tab === 'featured') {
        if (numBanners > 1 && currentIndexRef.current + 1 < numBanners) {
          const nextIdx = currentIndexRef.current + 1;
          currentIndexRef.current = nextIdx;
          setCurrentIndex(nextIdx);
        } else {
          currentIndexRef.current = 0;
          setCurrentIndex(0);
          handleSetTab('deals');
        }
      } else if (tab === 'deals') {
        const maxDeals = DELIVERECT_CATALOG_DEALS.length;
        if (dealSlideIndexRef.current + 1 < maxDeals) {
          const nextIdx = dealSlideIndexRef.current + 1;
          dealSlideIndexRef.current = nextIdx;
          setDealSlideIndex(nextIdx);
          if (dealsTrackRef.current) {
            dealsTrackRef.current.scrollTo({ left: nextIdx * 300, behavior: 'smooth' });
          }
        } else {
          dealSlideIndexRef.current = 0;
          setDealSlideIndex(0);
          if (dealsTrackRef.current) {
            dealsTrackRef.current.scrollTo({ left: 0, behavior: 'smooth' });
          }
          handleSetTab('featured');
        }
      }
    }, 5000);

    return () => {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    };
  }, [autoCycle, isPaused]);

  const handleDealsScroll = (direction: 'left' | 'right') => {
    if (!dealsTrackRef.current) return;
    const amount = direction === 'left' ? -320 : 320;
    dealsTrackRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    const maxDeals = DELIVERECT_CATALOG_DEALS.length;
    const nextIdx = direction === 'right'
      ? Math.min(dealSlideIndexRef.current + 1, maxDeals - 1)
      : Math.max(dealSlideIndexRef.current - 1, 0);
    dealSlideIndexRef.current = nextIdx;
    setDealSlideIndex(nextIdx);
  };

  return (
    <div
      id="main-promotional-super-carousel"
      className="w-full max-w-full space-y-2 select-none overflow-hidden sm:px-6"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role="region"
      aria-label="Store Carousel"
    >
      {/* UNIFIED CAROUSEL NAVIGATION TABS */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar pb-0.5 px-4 sm:px-0 w-full max-w-full">
        <div className="flex items-center gap-1.5 p-1 bg-gray-100/90 backdrop-blur-sm rounded-2xl shadow-2xs border border-gray-200/60 shrink-0">
          {/* TAB 1: Featured Offers */}
          <button
            type="button"
            id="carousel-tab-featured"
            onClick={() => handleSetTab('featured')}
            className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              currentTab === 'featured'
                ? 'bg-white text-gray-950 shadow-2xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            <span>Featured Offers</span>
          </button>

          {/* TAB 2: Combo Deals (Merged Bundles & Meal Deals) */}
          <button
            type="button"
            id="carousel-tab-deals"
            onClick={() => handleSetTab('deals')}
            className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              currentTab === 'deals'
                ? 'bg-emerald-600 text-white shadow-2xs font-extrabold'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <BadgePercent className="w-3.5 h-3.5 text-emerald-400" />
            <span>Combo Deals</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                currentTab === 'deals'
                  ? 'bg-emerald-700 text-emerald-100'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {(bundles?.length || 0) + DELIVERECT_CATALOG_DEALS.length}
            </span>
          </button>
        </div>
      </div>

      {/* STANDARDIZED CAROUSEL CONTAINER (FLUSH & SQUARED ON MOBILE, ROUNDED ON DESKTOP) */}
      <div className="relative w-full overflow-hidden rounded-none sm:rounded-3xl shadow-none sm:shadow-xl h-[420px] sm:h-[440px] md:h-[450px] bg-gray-950">
        {/* ========================================================= */}
        {/* VIEW 1: FEATURED PROMOTIONAL BANNER                       */}
        {/* ========================================================= */}
        {currentTab === 'featured' && activeBanner && (
          <div className="relative h-full w-full bg-gray-900 rounded-none sm:rounded-3xl overflow-hidden">
            {/* BACKGROUND IMAGE SLIDE WITH SMOOTH TRANSITION */}
            <AnimatePresence initial={false} mode="wait">
              <motion.div
                key={activeBanner.id}
                initial={{ opacity: 0, scale: 1.04 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="absolute inset-0 w-full h-full bg-cover bg-center"
                style={{
                  backgroundImage: `url(${activeBanner.backgroundImageUrl})`,
                }}
              />
            </AnimatePresence>

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
                <motion.h2
                  key={`title-${activeBanner.id}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.1 }}
                  className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight drop-shadow-sm"
                >
                  {activeBanner.title}
                </motion.h2>

                <motion.p
                  key={`desc-${activeBanner.id}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.15 }}
                  className="text-sm sm:text-base text-gray-200/90 leading-relaxed font-medium line-clamp-3 sm:line-clamp-none drop-shadow-xs"
                >
                  {activeBanner.subtitle}
                </motion.p>

                {/* CTA BUTTONS */}
                <motion.div
                  key={`btn-${activeBanner.id}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.2 }}
                  className="pt-2 flex flex-wrap items-center gap-2.5 sm:gap-3"
                >
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
                </motion.div>
              </div>

              {/* BOTTOM CONTROLS: Dots on left, Auto-cycle icon + Left/Right arrows on right */}
              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                <div className="flex items-center gap-1.5">
                  {banners.map((banner, idx) => (
                    <button
                      key={banner.id}
                      type="button"
                      onClick={() => setCurrentIndex(idx)}
                      className={`h-2 rounded-full transition-all duration-300 ${
                        idx === currentIndex
                          ? 'w-7 bg-white'
                          : 'w-2 bg-white/40 hover:bg-white/70'
                      }`}
                      aria-label={`Go to slide ${idx + 1}`}
                    />
                  ))}
                  <span className="ml-2 text-[11px] font-semibold text-white/60">
                    {currentIndex + 1} of {banners.length}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Auto-cycle toggle as an icon button next to arrow buttons */}
                  <button
                    type="button"
                    id="carousel-autocycle-icon-btn"
                    onClick={() => setAutoCycle((prev) => !prev)}
                    className={`p-2 rounded-full backdrop-blur-md border transition-all cursor-pointer ${
                      autoCycle
                        ? 'bg-emerald-500/30 text-emerald-300 border-emerald-400/40 hover:bg-emerald-500/50'
                        : 'bg-white/10 text-white/60 border-white/15 hover:bg-white/20 hover:text-white'
                    }`}
                    title={autoCycle ? 'Auto cycle running (Click to pause)' : 'Auto cycle paused (Click to start)'}
                    aria-label={autoCycle ? 'Pause auto cycle' : 'Play auto cycle'}
                  >
                    {autoCycle ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                  </button>

                  {banners.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={handlePrev}
                        className="p-2 rounded-full bg-white/10 hover:bg-white/25 active:scale-95 text-white backdrop-blur-md border border-white/15 transition-all cursor-pointer"
                        aria-label="Previous slide"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={handleNext}
                        className="p-2 rounded-full bg-white/10 hover:bg-white/25 active:scale-95 text-white backdrop-blur-md border border-white/15 transition-all cursor-pointer"
                        aria-label="Next slide"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 2: COMBO DEALS (DELIVERECT BUNDLES & MEAL DEALS)      */}
        {/* ========================================================= */}
        {currentTab === 'deals' && (
          <div className="relative h-full w-full bg-gradient-to-br from-gray-950 via-emerald-950/85 to-gray-950 text-white p-4 sm:p-5 md:p-6 flex flex-col justify-between overflow-hidden rounded-none sm:rounded-3xl">
            {/* Header & Controls */}
            <div className="flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <BadgePercent className="w-4 h-4 sm:w-5 sm:h-5" />
                </span>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold tracking-tight text-white flex items-center gap-2">
                    <span>Deliverect Combo Deals</span>
                    <span className="hidden sm:inline px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                      Discounts Apply in Basket
                    </span>
                  </h3>
                  <p className="text-[11px] sm:text-xs text-gray-300 line-clamp-1">
                    Customise combos and multibuy savings are automatically calculated and deducted from your basket subtotal
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {activeDealFilter && onClearDealFilter && (
                  <button
                    type="button"
                    onClick={onClearDealFilter}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-gray-200 transition-colors cursor-pointer mr-1"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Reset</span>
                  </button>
                )}

                {/* Auto-cycle toggle as an icon button next to arrow buttons */}
                <button
                  type="button"
                  id="deals-carousel-autocycle-icon-btn"
                  onClick={() => setAutoCycle((prev) => !prev)}
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-white cursor-pointer transition-colors ${
                    autoCycle
                      ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-400/40 hover:bg-emerald-500/50'
                      : 'bg-white/10 hover:bg-white/20 text-white/60'
                  }`}
                  title={autoCycle ? 'Auto cycle running (Click to pause)' : 'Auto cycle paused (Click to start)'}
                  aria-label={autoCycle ? 'Pause auto cycle' : 'Play auto cycle'}
                >
                  {autoCycle ? <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />}
                </button>

                <button
                  type="button"
                  onClick={() => handleDealsScroll('left')}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer transition-colors"
                  aria-label="Previous deal"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDealsScroll('right')}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer transition-colors"
                  aria-label="Next deal"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Seamless Rolling Carousel Track for Combo Deals */}
            <div
              ref={dealsTrackRef}
              className="flex items-stretch gap-3.5 overflow-x-auto no-scrollbar py-2 my-auto scroll-smooth w-full max-w-full px-1"
            >
              {/* Deliverect Combo Bundles (e.g. Meal Deal with dynamic modifier groups) */}
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

            {/* Bottom Footer Indicators */}
            <div className="flex items-center justify-between pt-1 border-t border-white/10 shrink-0 text-xs text-gray-400">
              <div className="flex items-center gap-1.5">
                {Array.from({ length: (bundles?.length || 0) + DELIVERECT_CATALOG_DEALS.length }).map((_, idx) => (
                  <span
                    key={`deal-dot-${idx}`}
                    className={`h-1.5 rounded-full transition-all ${
                      dealSlideIndex === idx ? 'w-5 bg-emerald-400' : 'w-1.5 bg-white/30'
                    }`}
                  />
                ))}
              </div>
              <span className="text-[11px]">Swipe or use arrows to cycle through combo deals</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
