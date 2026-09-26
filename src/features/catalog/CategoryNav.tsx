import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Category, Store } from '../../commerce/models';
import { DeliverectDeal } from '../../commerce/dealModels';
import { CatalogFilterState } from './DietaryPreferencesModal';
import { useTenantStyles } from '../../tenant/useTenant';
import { useI18n } from '../../i18n/I18nContext';
import {
  ChevronRight,
  LayoutGrid,
  Search,
  X,
  BadgePercent,
  ArrowLeft,
  SlidersHorizontal,
  Heart,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';

interface CategoryNavProps {
  categories: Category[];
  breadcrumbs: Category[];
  selectedCategoryId: string | null;
  onSelectCategory: (categoryId: string | null) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  activeDealFilter?: DeliverectDeal | null;
  onClearDealFilter?: () => void;
  onOpenDealSelector?: () => void;
  isDealsActive?: boolean;
  activeStores?: Store[];
  selectedStore?: Store | null;
  onSelectStore?: (store: Store | null) => void;
  onOpenStorePicker?: () => void;
  filterState?: CatalogFilterState;
  onOpenFiltersModal?: () => void;
  onOpenAislesModal?: () => void;
  onToggleFavouritesFilter?: () => void;
  onToggleBuyAgainFilter?: () => void;
  onClearAllergenFilters?: () => void;
  favouritesCount?: number;
  activeFiltersCount?: number;
  onProductIntent?: () => void;
}

export const CategoryNav: React.FC<CategoryNavProps> = ({
  categories,
  breadcrumbs,
  selectedCategoryId,
  onSelectCategory,
  searchQuery = '',
  onSearchChange,
  activeDealFilter,
  onClearDealFilter,
  onOpenDealSelector,
  isDealsActive = false,
  filterState,
  onOpenFiltersModal,
  onOpenAislesModal,
  onToggleFavouritesFilter,
  onToggleBuyAgainFilter,
  onClearAllergenFilters,
  favouritesCount = 0,
  activeFiltersCount = 0,
  onProductIntent,
}) => {
  const { primaryBtnStyle, primaryColour } = useTenantStyles();
  const { t } = useI18n();
  const anchorRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const [dockMode, setDockMode] = useState<'normal' | 'top'>('normal');

  useEffect(() => {
    let frame = 0;

    const updateDocking = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const anchor = anchorRef.current;
        const nav = navRef.current;
        if (!anchor || !nav) return;

        const measuredHeight = Math.ceil(nav.getBoundingClientRect().height);
        if (measuredHeight > 0) {
          document.documentElement.style.setProperty('--category-nav-height', `${measuredHeight}px`);
        }

        if (window.innerWidth >= 768) {
          setDockMode('normal');
          return;
        }

        const header = document.getElementById('sticky-header-container');
        const headerBottom = header?.getBoundingClientRect().bottom || 0;
        const rect = anchor.getBoundingClientRect();

        // Mobile filters now have one simple behaviour:
        // stay in normal document flow until they naturally reach the header,
        // then dock beneath it. Scrolling back up releases them immediately.
        setDockMode(rect.top <= headerBottom + 4 ? 'top' : 'normal');
      });
    };

    updateDocking();
    window.addEventListener('scroll', updateDocking, { passive: true });
    window.addEventListener('resize', updateDocking);
    window.visualViewport?.addEventListener('resize', updateDocking);
    window.visualViewport?.addEventListener('scroll', updateDocking);

    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateDocking) : null;
    if (navRef.current) observer?.observe(navRef.current);

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('scroll', updateDocking);
      window.removeEventListener('resize', updateDocking);
      window.visualViewport?.removeEventListener('resize', updateDocking);
      window.visualViewport?.removeEventListener('scroll', updateDocking);
    };
  }, []);

  const selectCategoryWithIntent = (categoryId: string | null) => {
    onSelectCategory(categoryId);
    onProductIntent?.();
  };

  // Hide bundle category under aisles
  const visibleCategories = useMemo(() => {
    return (categories || []).filter((cat) => {
      if (!cat) return false;
      const name = (cat.name || '').toLowerCase();
      const id = (cat.id || '').toLowerCase();
      return !name.includes('bundle') && !id.includes('bundle');
    });
  }, [categories]);

  // Limit horizontal category list to 6 items to avoid massive horizontal scroll fatigue
  const MAX_VISIBLE_PILLS = 6;
  const displayedCategories = useMemo(() => {
    return visibleCategories.slice(0, MAX_VISIBLE_PILLS);
  }, [visibleCategories]);

  const remainingCategoriesCount = Math.max(0, visibleCategories.length - MAX_VISIBLE_PILLS);

  // Determine current active container category (the innermost category represented by the breadcrumbs)
  const currentCategory = breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1] : null;

  // Leaf categories are represented alongside their siblings. At that lowest level,
  // an "All <leaf>" pill is redundant (for example "All Bananas" beside "Bananas").
  // Instead, the leading pill becomes an explicit branded back-to-parent control:
  // "‹ All Fruit". Intermediate/root categories retain the existing "All <category>"
  // behaviour so users can still view every product below that branch.
  const currentCategoryHasChildren = Boolean(
    currentCategory?.subcategories && currentCategory.subcategories.length > 0
  );
  const parentCategory = breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2] : null;
  const isLeafCategory = Boolean(currentCategory && !currentCategoryHasChildren);
  const useParentBackPill = Boolean(isLeafCategory && parentCategory);

  const isAllItemsActive = useParentBackPill
    ? false
    : currentCategory
      ? selectedCategoryId === currentCategory.id
      : selectedCategoryId === null;

  const handleAllItemsClick = () => {
    if (useParentBackPill && parentCategory) {
      selectCategoryWithIntent(parentCategory.id);
      return;
    }

    if (currentCategory) {
      selectCategoryWithIntent(currentCategory.id);
    } else {
      selectCategoryWithIntent(null);
    }
  };

  const leadingPillLabel = useParentBackPill && parentCategory
    ? `${t('aisles.allCategoryPrefix')} ${parentCategory.name || t('aisles.parentAisle')}`
    : currentCategory?.name
      ? `${t('aisles.allCategoryPrefix')} ${currentCategory.name}`
      : t('aisles.searchAisles');

  const parentBackPillStyle = useParentBackPill
    ? {
        backgroundColor: `${primaryColour}12`,
        borderColor: `${primaryColour}55`,
        color: primaryColour,
      }
    : undefined;

  const handleBackClick = () => {
    if (breadcrumbs.length > 1) {
      selectCategoryWithIntent(breadcrumbs[breadcrumbs.length - 2].id);
    } else {
      onSelectCategory(null);
    }
  };

  const hasActiveAllergenOrDietary =
    (filterState?.excludedAllergens?.length || 0) > 0 ||
    (filterState?.selectedDietaryTags?.length || 0) > 0;

  // Native sticky positioning is smoother than toggling between normal flow
  // and fixed positioning while the user scrolls. dockMode now only controls
  // the visual shadow/data attribute used by the scroll-snap rules.
  const dockClass =
    dockMode === 'top'
      ? 'sticky z-[35] shadow-md'
      : 'sticky z-30 shadow-xs';

  const dockStyle: React.CSSProperties = {
    top: 'var(--storefront-header-height, 104px)',
  };

  return (
    <div
      ref={anchorRef}
      id="category-nav-anchor"
      className="relative w-full max-w-full"
    >
      <div
        ref={navRef}
        id="category-nav-section"
        style={dockStyle}
        data-dock-mode={dockMode}
        className={`${dockClass} bg-white/95 backdrop-blur-md border-y border-gray-200/80 px-3 sm:px-6 py-2 transition-[box-shadow,background-color] w-full max-w-full space-y-1.5`}
      >
      {/* ROW 1: AISLE CATEGORIES & NAVIGATION */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 w-full max-w-full">
        {/* 'Search Aisles' button at the start */}
        {onOpenAislesModal && (
          <button
            type="button"
            id="cat-pill-search-aisles"
            onClick={onOpenAislesModal}
            className="px-3 py-1.5 rounded-full text-xs font-black transition-all shrink-0 flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer active:scale-95"
            title={t('aisles.searchAisles')}
          >
            <LayoutGrid className="w-3.5 h-3.5 text-white shrink-0" />
            <span>{t('aisles.searchAisles')}</span>
          </button>
        )}

        {/* Back navigation button when inside sub-categories */}
        {breadcrumbs.length === 1 && (
          <button
            type="button"
            id="cat-pill-back-all-aisles"
            onClick={() => selectCategoryWithIntent(null)}
            className="px-3 py-1.5 rounded-full text-xs font-extrabold transition-all shrink-0 flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-200/80 shadow-2xs cursor-pointer active:scale-95"
          >
            <ArrowLeft className="w-3.5 h-3.5 shrink-0 text-gray-600" />
            <span>{t('aisles.all')}</span>
          </button>
        )}

        {breadcrumbs.length >= 2 && (
          <button
            type="button"
            id="cat-pill-back-parent-cat"
            onClick={() => selectCategoryWithIntent(breadcrumbs[breadcrumbs.length - 2].id)}
            className="px-3 py-1.5 rounded-full text-xs font-extrabold transition-all shrink-0 flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs cursor-pointer active:scale-95"
          >
            <ArrowLeft className="w-3.5 h-3.5 shrink-0 text-emerald-700" />
            <span>{t('aisles.allCategoryPrefix')} {breadcrumbs[breadcrumbs.length - 2]?.name || t('aisles.parentAisle')}</span>
          </button>
        )}

        {/* Category Pills */}
        {displayedCategories.map((cat) => {
          if (!cat) return null;
          const isSelected = selectedCategoryId === cat.id;

          return (
            <button
              key={cat.id}
              id={`cat-pill-${cat.id}`}
              type="button"
              onClick={() => selectCategoryWithIntent(cat.id)}
              style={isSelected ? primaryBtnStyle : undefined}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer ${
                isSelected
                  ? 'shadow-xs'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200/60'
              }`}
            >
              <span>{cat.name || t('aisles.category')}</span>
              {cat.subcategories && cat.subcategories.length > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
              )}
            </button>
          );
        })}

        {/* remaining count tag if more categories exist */}
        {remainingCategoriesCount > 0 && onOpenAislesModal && (
          <button
            type="button"
            id="cat-pill-remaining-count"
            onClick={onOpenAislesModal}
            className="px-2.5 py-1.5 rounded-full text-xs font-extrabold transition-all shrink-0 bg-gray-100 text-gray-600 hover:bg-gray-200 cursor-pointer"
          >
            +{remainingCategoriesCount} {t('aisles.more')}
          </button>
        )}
      </div>

      {/* ROW 2: FILTERS & SEARCH BAR */}
      <div className="flex items-center gap-2 w-full max-w-full">
        {/* Left: Filter Modal Button */}
        {onOpenFiltersModal && (
          <button
            type="button"
            id="filter-allergens-dietary-btn"
            onClick={onOpenFiltersModal}
            className={`relative z-10 overflow-visible w-8 h-8 p-0 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer border shadow-2xs flex items-center justify-center ${
              activeFiltersCount > 0 || filterState?.onlyFavourites || filterState?.onlyBuyAgain
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800 ring-2 ring-emerald-400/20'
                : 'bg-white hover:bg-gray-100 border-gray-200 text-gray-700 active:scale-95'
            }`}
            title="Filter by favourites, allergens & dietary preferences"
            aria-label="Filter favourites, allergens and diet"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-gray-700" />
            {(activeFiltersCount > 0 ||
              (filterState?.onlyFavourites ? 1 : 0) + (filterState?.onlyBuyAgain ? 1 : 0) > 0) && (
              <span className="absolute z-20 -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-emerald-600 text-white text-[9px] font-black flex items-center justify-center shadow-xs">
                {activeFiltersCount +
                  (filterState?.onlyFavourites ? 1 : 0) +
                  (filterState?.onlyBuyAgain ? 1 : 0)}
              </span>
            )}
          </button>
        )}

        {/* Middle: Search Input */}
        {onSearchChange && (
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              id="aisle-search-input"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onFocus={() => {
                onProductIntent?.();
              }}
              placeholder={t('aisles.productsSearchPlaceholder')}
              className="w-full pl-8 pr-7 py-1.5 rounded-full bg-gray-100 hover:bg-gray-50 focus:bg-white border border-gray-200 focus:border-gray-900 focus:ring-1 focus:ring-gray-900/10 text-xs font-semibold text-gray-900 transition-all outline-hidden shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                id="clear-aisle-search-btn"
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
                title={t('aisles.clearSearch')}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {/* Right: Active Untoggle Filter Chips & Active Deal Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          {filterState?.onlyFavourites && onToggleFavouritesFilter && (
            <button
              type="button"
              id="untoggle-favourites-filter-btn"
              onClick={onToggleFavouritesFilter}
              className="w-7 h-7 rounded-full bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 transition-all shrink-0 cursor-pointer shadow-2xs flex items-center justify-center active:scale-95"
              title="Remove Favourites filter"
              aria-label="Remove Favourites filter"
            >
              <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
            </button>
          )}

          {filterState?.onlyBuyAgain && onToggleBuyAgainFilter && (
            <button
              type="button"
              id="untoggle-buy-again-filter-btn"
              onClick={onToggleBuyAgainFilter}
              className="w-7 h-7 rounded-full bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-600 transition-all shrink-0 cursor-pointer shadow-2xs flex items-center justify-center active:scale-95"
              title="Remove Buy Again filter"
              aria-label="Remove Buy Again filter"
            >
              <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
            </button>
          )}

          {hasActiveAllergenOrDietary && onClearAllergenFilters && (
            <button
              type="button"
              id="untoggle-allergen-filter-btn"
              onClick={onClearAllergenFilters}
              className="w-7 h-7 rounded-full bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 transition-all shrink-0 cursor-pointer shadow-2xs flex items-center justify-center active:scale-95"
              title="Remove Allergen / Dietary filters"
              aria-label="Remove Allergen / Dietary filters"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
            </button>
          )}

          {activeDealFilter && (
            <div
              id="active-deal-nav-chip"
              style={primaryBtnStyle}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-white text-xs font-black shrink-0 shadow-xs"
            >
              <BadgePercent className="w-3 h-3 text-white/80 shrink-0" />
              <span className="truncate max-w-[110px] sm:max-w-[160px]">
                {activeDealFilter.title}
              </span>
              {onClearDealFilter && (
                <button
                  type="button"
                  id="clear-deal-nav-chip-btn"
                  onClick={onClearDealFilter}
                  className="p-0.5 rounded-full hover:bg-black/20 transition-colors ml-0.5 cursor-pointer"
                  title="Clear deal filter"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
};

