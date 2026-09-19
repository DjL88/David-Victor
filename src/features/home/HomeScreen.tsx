import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { Product, ProductAvailabilitySummary, Story, Category, Store, BasketItem, moneyToMajor } from '../../commerce/models';
import { DeliverectDeal } from '../../commerce/dealModels';
import { BundleProduct } from '../../commerce/bundleModels';
import { StoriesRow } from '../stories/StoriesRow';
import { PromotionalBannerCarousel } from './PromotionalBannerCarousel';
import { ProductCard } from '../../components/ProductCard';
import { CategoryNav } from '../catalog/CategoryNav';
import { useTenant } from '../../tenant/TenantContext';
import { useTenantStyles } from '../../tenant/useTenant';
import {
  BadgePercent,
  Flame,
  Percent,
  Heart,
  ChevronRight,
  Search,
  Layers,
  X,
  ShoppingBag,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Tag,
  AlertCircle,
} from 'lucide-react';
import { ProductCardSkeleton } from '../../components/SkeletonLoader';
import { formatMoney } from '../../utils/formatters';
import { defaultRuleEngine } from '../../rules/RuleEngine';
import { getRenderableProducts } from '../../rules/availabilityRules';
import { resolveSearchQueryInfo, applySearchMerchandising, getActiveSearchConfig } from '../../commerce/searchMerchEngine';
import { getCategoryAndAllDescendantIds, findCategoryById } from '../../commerce/categoryHierarchy';
import { useFavourites } from '../../hooks/useFavourites';
import { DietaryPreferencesModal, CatalogFilterState } from '../catalog/DietaryPreferencesModal';

interface HomeScreenProps {
  stories: Story[];
  storiesLoading: boolean;
  onSelectStory: (index: number) => void;
  products: Product[];
  summaries: Record<string, ProductAvailabilitySummary>;
  productsLoading: boolean;
  catalogError?: string | null;
  onRetryCatalog?: () => void;
  selectedStore: Store | null;
  onOpenStorePicker: () => void;
  categories: Category[];
  breadcrumbs: Category[];
  selectedCategoryId: string | null;
  onSelectCategory: (id: string | null) => void;
  onSelectProduct: (p: Product) => void;
  onUpdateQuantity: (p: Product, q: number) => void;
  getBasketQuantity: (plu: string) => number;
  basketItems?: BasketItem[];
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  totalCatalogResults?: Product[];
  totalCatalogSummaries?: Record<string, ProductAvailabilitySummary>;
  searchLoading?: boolean;
  activeDealFilter?: DeliverectDeal | null;
  onFilterByDeal?: (deal: DeliverectDeal) => void;
  onClearDealFilter?: () => void;
  onOpenDealDialog?: (deal: DeliverectDeal) => void;
  bundles?: BundleProduct[];
  onOpenBundleDialog?: (bundle: BundleProduct) => void;
  onAddItemsToBasket?: (plus: string[], dealTitle?: string) => void;
  activeStores?: Store[];
  onSelectStore?: (store: Store | null) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  stories,
  storiesLoading,
  onSelectStory,
  products,
  summaries,
  productsLoading,
  catalogError,
  onRetryCatalog,
  selectedStore,
  onOpenStorePicker,
  categories,
  breadcrumbs,
  selectedCategoryId,
  onSelectCategory,
  onSelectProduct,
  onUpdateQuantity,
  getBasketQuantity,
  basketItems = [],
  searchQuery = '',
  onSearchChange,
  totalCatalogResults,
  totalCatalogSummaries = {},
  searchLoading = false,
  activeDealFilter = null,
  onFilterByDeal,
  onClearDealFilter,
  onOpenDealDialog,
  bundles,
  onOpenBundleDialog,
  onAddItemsToBasket,
  activeStores = [],
  onSelectStore,
}) => {
  const { tenant } = useTenant();
  const { primaryBtnStyle } = useTenantStyles();
  const { favourites, isFavourite } = useFavourites();
  const isStoreSelected = selectedStore !== null;
  const [mainCarouselTab, setMainCarouselTab] = useState<'featured' | 'deals'>('featured');

  // Filter state for dietary preferences & favourites toggle
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filterState, setFilterState] = useState<CatalogFilterState>({
    onlyFavourites: false,
    onlyBuyAgain: false,
    selectedDietaryTags: [],
    excludedAllergens: [],
  });

  // If a deal filter becomes active, ensure the carousel shows the deals view
  React.useEffect(() => {
    if (activeDealFilter) {
      setMainCarouselTab('deals');
    }
  }, [activeDealFilter]);

  // Search resolution info (evaluates typo aliases e.g. "choclit" -> "chocolate", rewrites, synonyms)
  const searchResolution = useMemo(() => {
    if (!searchQuery.trim()) return null;
    return resolveSearchQueryInfo(searchQuery);
  }, [searchQuery]);

  // Current category details
  const currentCategoryName = useMemo(() => {
    if (breadcrumbs.length > 0) {
      return breadcrumbs[breadcrumbs.length - 1]?.name || 'Current Aisle';
    }
    if (selectedCategoryId) {
      const cat = findCategoryById(categories, selectedCategoryId);
      if (cat) return cat.name;
    }
    return null;
  }, [breadcrumbs, selectedCategoryId, categories]);

  // Allowed category IDs for the currently selected category hierarchy
  const allowedCategoryIds = useMemo(() => {
    if (!selectedCategoryId) return [];
    return getCategoryAndAllDescendantIds(categories, selectedCategoryId);
  }, [selectedCategoryId, categories]);

  // Helper to check if a product satisfies dietary preferences, allergen exclusions, and favourites
  const matchesFilters = useCallback(
    (product: Product) => {
      if (filterState.onlyFavourites && !isFavourite(product.plu)) {
        return false;
      }

      const allProductTags = [
        ...(product.productTags || []),
        ...(product.displayLabels || []),
        ...(product.allergens || []),
        ...((product as any).tags || []),
      ].map((t) => (typeof t === 'string' ? t.trim().toUpperCase() : ''));

      // Excluded allergens: if product has any excluded allergen, filter it out
      if (filterState.excludedAllergens.length > 0) {
        const hasExcludedAllergen = filterState.excludedAllergens.some((allergen) => {
          const target = allergen.toUpperCase();
          return allProductTags.some((tag) => tag.includes(target));
        });
        if (hasExcludedAllergen) return false;
      }

      // Selected dietary tags: product must match all selected dietary lifestyle tags
      if (filterState.selectedDietaryTags.length > 0) {
        const matchesAllTags = filterState.selectedDietaryTags.every((dietTag) => {
          const target = dietTag.toUpperCase();
          return allProductTags.some((tag) => tag.includes(target));
        });
        if (!matchesAllTags) return false;
      }

      return true;
    },
    [filterState, isFavourite]
  );

  // Canonical renderable products adhering strictly to identical availability & rule evaluations as ProductCard
  const renderableBaseProducts = useMemo(() => {
    return getRenderableProducts(products).filter(matchesFilters);
  }, [products, matchesFilters]);

  const renderableTotalCatalog = useMemo(() => {
    return getRenderableProducts(totalCatalogResults || []).filter(matchesFilters);
  }, [totalCatalogResults, matchesFilters]);

  // Total catalog matching pool when searching
  const fullMatchingCatalog = useMemo(() => {
    if (!searchQuery.trim()) return [];
    if (renderableTotalCatalog.length > 0) {
      return renderableTotalCatalog;
    }
    const pool = renderableBaseProducts;
    const merchandised = applySearchMerchandising(pool, searchQuery, getActiveSearchConfig());
    return getRenderableProducts(merchandised.map((m) => m.product));
  }, [searchQuery, renderableTotalCatalog, renderableBaseProducts]);

  // Two-row search results partitioning when filtered on a category
  const { categorySearchResults, otherCatalogSearchResults } = useMemo(() => {
    if (!searchQuery.trim() || !selectedCategoryId) {
      return { categorySearchResults: [], otherCatalogSearchResults: [] };
    }

    const catMatches: Product[] = [];
    const otherMatches: Product[] = [];

    fullMatchingCatalog.forEach((p) => {
      const inCat = (p.categoryIds || []).some((cid) => allowedCategoryIds.includes(cid));
      if (inCat) {
        catMatches.push(p);
      } else {
        otherMatches.push(p);
      }
    });

    return {
      categorySearchResults: catMatches,
      otherCatalogSearchResults: otherMatches,
    };
  }, [searchQuery, selectedCategoryId, fullMatchingCatalog, allowedCategoryIds]);

  // Filter products by active deal filter, and then by search query if active
  const filteredProducts = useMemo(() => {
    let baseList = renderableBaseProducts;

    // Apply Deliverect deal filter if active
    if (activeDealFilter) {
      baseList = baseList.filter((p) =>
        activeDealFilter.linkedProductPlus.includes(p.plu)
      );
    }

    if (!searchQuery.trim()) return baseList;

    // If search is active at root (All Aisles), use the full matching catalog
    if (!selectedCategoryId && fullMatchingCatalog.length > 0) {
      return fullMatchingCatalog;
    }

    // Otherwise apply merchandising to the category products
    const merchandised = applySearchMerchandising(baseList, searchQuery, getActiveSearchConfig());
    return getRenderableProducts(merchandised.map((m) => m.product));
  }, [renderableBaseProducts, activeDealFilter, searchQuery, selectedCategoryId, fullMatchingCatalog]);

  // Pagination & lazy loading: 25 items per page
  const ITEMS_PER_PAGE = 25;
  const [visibleCount, setVisibleCount] = useState<number>(ITEMS_PER_PAGE);

  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [selectedCategoryId, searchQuery, activeDealFilter, filterState]);

  const paginatedProducts = useMemo(() => {
    return filteredProducts.slice(0, visibleCount);
  }, [filteredProducts, visibleCount]);

  // Helper to find category name for products shown from other aisles
  const getProductCategoryName = (product: Product): string => {
    if (!product.categoryIds || product.categoryIds.length === 0) return 'Other Aisles';
    for (const cid of product.categoryIds) {
      const cat = findCategoryById(categories, cid);
      if (cat) return cat.name;
    }
    return 'Other Aisles';
  };

  // Combined summaries helper
  const getAvailabilitySummary = (plu: string) => {
    return summaries[plu] || totalCatalogSummaries[plu];
  };

  // Derive Offers Near You (filtered by recommendation rules so restricted items aren't pushed in promotional carousels)
  const offers = useMemo(() => {
    return defaultRuleEngine
      .filterRecommendations(renderableBaseProducts)
      .filter((p) => p.originalPrice && p.price && moneyToMajor(p.originalPrice) > moneyToMajor(p.price));
  }, [renderableBaseProducts]);

  return (
    <div id="home-screen-container" className="w-full max-w-7xl mx-auto pb-20 space-y-4 overflow-x-hidden">
      {/* Instagram-style horizontal Stories */}
      {!searchQuery && (
        <StoriesRow
          stories={stories}
          loading={storiesLoading}
          onSelectStory={onSelectStory}
        />
      )}

      {/* Hero / Category-Customizable Promotional Carousel with background images and stock linking */}
      {!searchQuery && (
        <PromotionalBannerCarousel
          selectedCategoryId={selectedCategoryId}
          categories={categories}
          selectedStore={selectedStore}
          products={products}
          bundles={bundles}
          onOpenStorePicker={onOpenStorePicker}
          onSelectCategory={onSelectCategory}
          onSelectProductPlu={(plu) => {
            const prod = products.find((p) => p.plu === plu);
            if (prod) {
              onSelectProduct(prod);
            }
          }}
          onSelectProduct={onSelectProduct}
          onOpenDealDialog={onOpenDealDialog}
          onOpenBundleDialog={onOpenBundleDialog}
          onFilterByDeal={onFilterByDeal}
          onClearDealFilter={onClearDealFilter}
          activeDealFilter={activeDealFilter}
          onAddItemsToBasket={onAddItemsToBasket}
          onAddToCart={onUpdateQuantity}
          getBasketQuantity={getBasketQuantity}
          activeCarouselTab={mainCarouselTab}
          onTabChange={setMainCarouselTab}
        />
      )}

      {/* Category Navigation with integrated Search Bar and Deal Filter Toggle */}
      <CategoryNav
        categories={categories}
        breadcrumbs={breadcrumbs}
        selectedCategoryId={selectedCategoryId}
        onSelectCategory={onSelectCategory}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        activeDealFilter={activeDealFilter}
        onClearDealFilter={onClearDealFilter}
        onOpenDealSelector={() => {
          setMainCarouselTab('deals');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        isDealsActive={mainCarouselTab === 'deals'}
        activeStores={activeStores}
        selectedStore={selectedStore}
        onSelectStore={onSelectStore}
        onOpenStorePicker={onOpenStorePicker}
        filterState={filterState}
        onOpenFiltersModal={() => setIsFilterModalOpen(true)}
        onToggleFavouritesFilter={() =>
          setFilterState((prev) => ({ ...prev, onlyFavourites: !prev.onlyFavourites }))
        }
      />

      {/* Deliverect Meal Deals & Combos (Featured Bundles) */}
      {!selectedCategoryId && !searchQuery && !activeDealFilter && bundles && bundles.length > 0 && (
        <section id="meal-deals-combos-section" className="px-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-gray-900 tracking-tight">
                  Meal Deals & Combos
                </h2>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Deliverect Live
                </span>
              </div>
            </div>
            <span className="text-xs font-semibold text-emerald-600">
              Customise & Save
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {bundles.map((bundle) => {
              const totalItems = bundle.sections.reduce((acc, s) => acc + (s.max || 1), 0);

              return (
                <div
                  key={bundle.id}
                  id={`bundle-card-${bundle.id}`}
                  onClick={() => onOpenBundleDialog?.(bundle)}
                  className="group bg-white rounded-2xl border border-gray-200/90 hover:border-emerald-500 overflow-hidden shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="bg-emerald-600 text-white text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded-md shadow-2xs">
                          {bundle.badge || 'Meal Deal'}
                        </span>
                        <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-md">
                          {totalItems} items included
                        </span>
                      </div>
                      <span className="text-sm font-black text-gray-900 shrink-0">
                        {formatMoney(bundle.price, bundle.currency || 'GBP')}
                      </span>
                    </div>

                    <h3 className="font-extrabold text-gray-900 text-sm sm:text-base group-hover:text-emerald-700 transition-colors line-clamp-1">
                      {bundle.name}
                    </h3>

                    {bundle.description && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                        {bundle.description}
                      </p>
                    )}

                    {bundle.sections.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-gray-100 flex flex-wrap gap-1.5">
                        {bundle.sections.map((sec) => (
                          <span
                            key={sec.id}
                            className="inline-flex items-center text-[10px] font-medium bg-gray-50 text-gray-600 border border-gray-200/60 px-2 py-0.5 rounded-md"
                          >
                            <span className="font-bold text-gray-800 mr-1">{sec.max || 1}x</span>
                            {sec.name.replace(/Select your /i, '').replace(/\(.*\)/, '').trim()}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="px-4 pb-3 pt-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenBundleDialog?.(bundle);
                      }}
                      className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-xs group-hover:shadow-sm"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Customise Deal</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Offers Near You Carousel / Row (when viewing all categories, no search, no active deal filter) */}
      {!selectedCategoryId && !searchQuery && !activeDealFilter && offers.length > 0 && (
        <section id="offers-near-you-section" className="px-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <Percent className="w-4 h-4 text-rose-500" />
              <h2 className="text-base font-extrabold text-gray-900 tracking-tight">
                Offers Near You
              </h2>
            </div>
            <span className="text-xs font-semibold text-rose-600">
              Save on essentials
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
            {offers.slice(0, 4).map((product) => (
              <ProductCard
                key={`offer-${product.plu}`}
                product={product}
                availabilitySummary={summaries[product.plu]}
                basketQuantity={getBasketQuantity(product.plu)}
                basketItems={basketItems}
                onSelectProduct={onSelectProduct}
                onUpdateQuantity={onUpdateQuantity}
                isStoreSelected={isStoreSelected}
                onPromptSelectStore={onOpenStorePicker}
              />
            ))}
          </div>
        </section>
      )}

      {/* Main Product Listing / Popular Near You / Filtered Deal / Search Results */}
      <section id="main-product-listing" className="px-4">
        {/* ACTIVE DEAL FILTER HIGHLIGHT CARD */}
        {activeDealFilter && (
          <div
            id="active-deal-header-card"
            className="mb-4 p-4 rounded-3xl bg-emerald-50 border-2 border-emerald-200/90 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[11px] font-black uppercase tracking-wide">
                  {activeDealFilter.badge}
                </span>
                <span className="text-xs font-bold text-emerald-900">
                  {activeDealFilter.stockMatchMode === 'AND'
                    ? 'Deliverect Bundle Deal'
                    : 'Deliverect Multi-Buy Deal'}
                </span>
              </div>
              <h3 className="text-base font-extrabold text-emerald-950">
                {activeDealFilter.title}
              </h3>
              <p className="text-xs text-emerald-800/90 max-w-xl">
                {activeDealFilter.description}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {onOpenDealDialog && (
                <button
                  type="button"
                  id="view-deal-dialog-btn"
                  onClick={() => onOpenDealDialog(activeDealFilter)}
                  className="py-2 px-3.5 rounded-xl bg-white hover:bg-emerald-100/50 border border-emerald-300 text-emerald-900 text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1.5"
                >
                  <Layers className="w-3.5 h-3.5 text-emerald-700" />
                  <span>View Deal Breakdown</span>
                </button>
              )}

              {activeDealFilter.stockMatchMode === 'AND' && onAddItemsToBasket && (
                <button
                  type="button"
                  id="active-deal-add-all-btn"
                  onClick={() =>
                    onAddItemsToBasket(
                      activeDealFilter.linkedProductPlus,
                      activeDealFilter.title
                    )
                  }
                  className="py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-extrabold transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Add All to Basket • £{(activeDealFilter.dealPrice ?? 0).toFixed(2)}</span>
                </button>
              )}

              {onClearDealFilter && (
                <button
                  type="button"
                  id="active-deal-clear-btn"
                  onClick={onClearDealFilter}
                  className="p-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 transition-colors cursor-pointer"
                  title="Clear deal filter"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* SEARCH OPTIMIZATION BANNER (Typos, rewrites, synonyms) */}
        {searchQuery && searchResolution && (searchResolution.isCorrected || searchResolution.rewrittenFrom) && (
          <div
            id="search-merch-banner"
            className="mb-4 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200/90 text-emerald-950 flex flex-wrap items-center justify-between gap-2 text-xs shadow-2xs"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <span className="font-semibold">
                  Search optimization applied: Showing results for{' '}
                  <strong className="text-emerald-900 underline decoration-emerald-400">
                    "{searchResolution.normalizedQuery}"
                  </strong>
                </span>
                {searchResolution.correctedFrom && (
                  <span className="text-emerald-700 ml-1 font-medium">
                    (auto-corrected typo from <em>"{searchResolution.correctedFrom}"</em>)
                  </span>
                )}
                {searchResolution.rewrittenFrom && (
                  <span className="text-emerald-700 ml-1 font-medium">
                    (rewritten query from <em>"{searchResolution.rewrittenFrom}"</em>)
                  </span>
                )}
              </div>
            </div>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-200/70 text-emerald-900 uppercase tracking-wider">
              Smart Merch
            </span>
          </div>
        )}

        {/* SEARCH MODE: TWO ROWS IF FILTERED ON A CATEGORY */}
        {searchQuery && selectedCategoryId ? (
          <div className="space-y-6">
            {/* ROW 1: CATEGORY SPECIFIC RESULTS */}
            <div id="search-row-category" className="space-y-3">
              <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md bg-emerald-600 text-white text-xs font-black shadow-2xs">
                    Row 1
                  </span>
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold text-gray-900 tracking-tight">
                      Results in {currentCategoryName || 'Current Aisle'}
                    </h3>
                    <p className="text-[11px] text-gray-500">
                      Matches specifically within this section
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-gray-600">
                  {categorySearchResults.length} {categorySearchResults.length === 1 ? 'item' : 'items'}
                </span>
              </div>

              {categorySearchResults.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                  {categorySearchResults.map((product) => (
                    <ProductCard
                      key={`cat-search-${product.plu}`}
                      product={product}
                      availabilitySummary={getAvailabilitySummary(product.plu)}
                      basketQuantity={getBasketQuantity(product.plu)}
                      basketItems={basketItems}
                      onSelectProduct={onSelectProduct}
                      onUpdateQuantity={onUpdateQuantity}
                      isStoreSelected={isStoreSelected}
                      onPromptSelectStore={onOpenStorePicker}
                    />
                  ))}
                </div>
              ) : (
                <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/90 border border-amber-200 text-center">
                  <p className="text-xs sm:text-sm font-bold text-amber-950">
                    Item not found in {currentCategoryName || 'this Aisle'}
                  </p>
                  <p className="text-xs text-amber-800 mt-1">
                    0 items matching "{searchQuery}" in {currentCategoryName}. Check the total catalogue results below!
                  </p>
                </div>
              )}
            </div>

            {/* ROW 2: TOTAL CATALOGUE / OTHER AISLES RESULTS */}
            <div id="search-row-total-catalog" className="space-y-3 pt-2">
              <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md bg-sky-600 text-white text-xs font-black shadow-2xs">
                    Row 2
                  </span>
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold text-gray-900 tracking-tight">
                      Results across Total Catalogue & Other Aisles
                    </h3>
                    <p className="text-[11px] text-gray-500">
                      {categorySearchResults.length === 0
                        ? `Not found in ${currentCategoryName}, but found in other aisles`
                        : `Matches found across the rest of the store`}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-gray-600">
                  {otherCatalogSearchResults.length} {otherCatalogSearchResults.length === 1 ? 'item' : 'items'}
                </span>
              </div>

              {otherCatalogSearchResults.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                  {otherCatalogSearchResults.map((product) => {
                    const aisleName = getProductCategoryName(product);
                    return (
                      <div key={`other-search-${product.plu}`} className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1 text-[10px] font-bold text-sky-800 bg-sky-50 px-2 py-0.5 rounded-md w-fit border border-sky-200">
                          <Tag className="w-2.5 h-2.5 text-sky-600 shrink-0" />
                          <span className="truncate max-w-[130px]">Found in {aisleName}</span>
                        </div>
                        <ProductCard
                          product={product}
                          availabilitySummary={getAvailabilitySummary(product.plu)}
                          basketQuantity={getBasketQuantity(product.plu)}
                          basketItems={basketItems}
                          onSelectProduct={onSelectProduct}
                          onUpdateQuantity={onUpdateQuantity}
                          isStoreSelected={isStoreSelected}
                          onPromptSelectStore={onOpenStorePicker}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-400">
                  <p className="text-xs font-semibold">
                    No matching items found in other aisles.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* STANDARD OR ALL-AISLES SEARCH LISTING */
          <>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                {activeDealFilter ? (
                  <BadgePercent className="w-4 h-4 text-emerald-600" />
                ) : searchQuery ? (
                  <Search className="w-4 h-4 text-emerald-600" />
                ) : (
                  <ShoppingBag className="w-4 h-4 text-emerald-600" />
                )}
                <h2 className="text-base font-extrabold text-gray-900 tracking-tight">
                  {activeDealFilter
                    ? `Qualifying Items in ${activeDealFilter.title}`
                    : searchQuery
                    ? `Search results for "${searchQuery}"`
                    : selectedCategoryId
                    ? 'Products in Aisle'
                    : 'Shop our range'}
                </h2>
              </div>
              <span className="text-xs font-semibold text-gray-400">
                {filteredProducts.length} {filteredProducts.length === 1 ? 'item' : 'items'}
              </span>
            </div>

            {catalogError ? (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center max-w-md mx-auto my-8">
                <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-gray-900 mb-1">Catalog Unavailable</h3>
                <p className="text-xs text-gray-600 mb-4">{catalogError}</p>
                {onRetryCatalog && (
                  <button
                    type="button"
                    onClick={onRetryCatalog}
                    className="px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-gray-800 transition-colors shadow-xs"
                  >
                    Retry Loading Catalog
                  </button>
                )}
              </div>
            ) : productsLoading || searchLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                {[...Array(8)].map((_, i) => (
                  <ProductCardSkeleton key={i} />
                ))}
              </div>
            ) : filteredProducts.length > 0 ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                  {paginatedProducts.map((product) => (
                    <ProductCard
                      key={product.plu}
                      product={product}
                      availabilitySummary={getAvailabilitySummary(product.plu)}
                      basketQuantity={getBasketQuantity(product.plu)}
                      basketItems={basketItems}
                      onSelectProduct={onSelectProduct}
                      onUpdateQuantity={onUpdateQuantity}
                      isStoreSelected={isStoreSelected}
                      onPromptSelectStore={onOpenStorePicker}
                    />
                  ))}
                </div>

                {visibleCount < filteredProducts.length && (
                  <div className="flex flex-col items-center justify-center pt-8 pb-4">
                    <button
                      type="button"
                      id="load-more-products-btn"
                      onClick={() => setVisibleCount((prev) => prev + ITEMS_PER_PAGE)}
                      className="px-6 py-2.5 rounded-xl bg-white hover:bg-gray-50 border border-gray-300 text-gray-800 text-xs font-bold transition-all shadow-2xs hover:shadow-xs flex items-center gap-2 cursor-pointer active:scale-98"
                    >
                      <span>Load more items ({filteredProducts.length - visibleCount} remaining)</span>
                      <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
                    </button>
                    <p className="text-[11px] text-gray-400 mt-2">
                      Showing {paginatedProducts.length} of {filteredProducts.length} items
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <p className="text-sm font-semibold">
                  {searchQuery
                    ? `No products found matching "${searchQuery}".`
                    : 'No products currently available in this section.'}
                </p>
              </div>
            )}
          </>
        )}
      </section>

      {/* Dietary & Allergen Preferences Modal */}
      <DietaryPreferencesModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        products={products}
        filterState={filterState}
        onChangeFilterState={setFilterState}
        favouritesCount={favourites.length}
        buyAgainCount={0}
      />
    </div>
  );
};
