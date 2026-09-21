import React, { useMemo } from 'react';
import { Category, Store } from '../../commerce/models';
import { DeliverectDeal } from '../../commerce/dealModels';
import { CatalogFilterState } from './DietaryPreferencesModal';
import { useTenantStyles } from '../../tenant/useTenant';
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
}) => {
  const { primaryBtnStyle, primaryColour } = useTenantStyles();

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
      onSelectCategory(parentCategory.id);
      return;
    }

    if (currentCategory) {
      onSelectCategory(currentCategory.id);
    } else {
      onSelectCategory(null);
    }
  };

  const leadingPillLabel = useParentBackPill && parentCategory
    ? `All ${parentCategory.name || 'Parent Aisle'}`
    : currentCategory?.name
      ? `All ${currentCategory.name}`
      : 'Search Aisles';

  const parentBackPillStyle = useParentBackPill
    ? {
        backgroundColor: `${primaryColour}12`,
        borderColor: `${primaryColour}55`,
        color: primaryColour,
      }
    : undefined;

  const handleBackClick = () => {
    if (breadcrumbs.length > 1) {
      onSelectCategory(breadcrumbs[breadcrumbs.length - 2].id);
    } else {
      onSelectCategory(null);
    }
  };

  const hasActiveAllergenOrDietary =
    (filterState?.excludedAllergens?.length || 0) > 0 ||
    (filterState?.selectedDietaryTags?.length || 0) > 0;

  return (
    <div
      id="category-nav-section"
      className="sticky top-[82px] md:top-[54px] z-30 bg-white/95 backdrop-blur-md border-y border-gray-200/80 shadow-xs px-3 sm:px-6 py-2 transition-all w-full max-w-full"
    >
      {/* Fixed Breadcrumbs Bar directly above Search Box */}
      <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1.5 overflow-x-auto no-scrollbar whitespace-nowrap">
        <button
          type="button"
          id="breadcrumb-all-aisles-btn"
          onClick={() => onSelectCategory(null)}
          className={`flex items-center gap-1 transition-colors ${
            breadcrumbs.length === 0
              ? 'font-extrabold text-gray-950'
              : 'hover:text-gray-900 font-semibold text-gray-600 hover:underline cursor-pointer'
          }`}
        >
          <LayoutGrid className="w-3.5 h-3.5 text-gray-700" />
          <span>Search Aisles</span>
        </button>

        {breadcrumbs.map((crumb, idx) => {
          if (!crumb) return null;
          const isLast = idx === breadcrumbs.length - 1;
          return (
            <React.Fragment key={crumb.id || idx}>
              <ChevronRight className="w-3 h-3 text-gray-400 shrink-0" />
              <button
                type="button"
                id={`breadcrumb-${crumb.id}`}
                onClick={() => onSelectCategory(crumb.id)}
                className={`truncate transition-colors cursor-pointer ${
                  isLast
                    ? 'font-bold text-gray-900'
                    : 'hover:text-gray-800 text-gray-600 hover:underline'
                }`}
              >
                {crumb.name || 'Category'}
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* Category Aisles Row: Filter Button + Search Bar + Subcategories & Back Arrow */}
      <div className="flex items-center gap-2 w-full max-w-full overflow-visible">
        {/* Left grouping: Merged Filter Button + Search Bar */}
        <div className="flex items-center gap-1.5 shrink-0 z-30 overflow-visible">
          {/* Merged Favourites, Allergens & Dietary Preferences Button */}
          {onOpenFiltersModal && (
            <button
              type="button"
              id="filter-allergens-dietary-btn"
              onClick={onOpenFiltersModal}
              className={`relative z-30 overflow-visible w-9 h-9 p-0 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer border shadow-2xs flex items-center justify-center ${
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
                <span className="absolute z-40 -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-emerald-600 text-white text-[9px] font-black flex items-center justify-center shadow-xs">
                  {activeFiltersCount +
                    (filterState?.onlyFavourites ? 1 : 0) +
                    (filterState?.onlyBuyAgain ? 1 : 0)}
                </span>
              )}
            </button>
          )}

          {/* Search Bar - Controlled responsive width preventing overflow */}
          {onSearchChange && (
            <div className="relative w-36 sm:w-48 md:w-56 shrink-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                id="aisle-search-input"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search..."
                className="w-full pl-7 pr-6 py-1.5 rounded-full bg-gray-100 hover:bg-gray-50 focus:bg-white border border-gray-200 focus:border-gray-900 focus:ring-1 focus:ring-gray-900/10 text-xs font-semibold text-gray-900 transition-all outline-hidden shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  id="clear-aisle-search-btn"
                  onClick={() => onSearchChange('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Subcategory / Shelf Pills with Untoggle Filter Buttons & Back Arrow left of 'Search Aisles' */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 flex-1 min-w-0">
          {/*
            Keep the compact arrow for intermediate levels. At a leaf, the leading
            "‹ All <parent>" pill below becomes the back control, avoiding duplicate
            navigation controls and the redundant "All <leaf>" label.
          */}
          {breadcrumbs.length > 0 && !useParentBackPill && (
            <button
              type="button"
              id="aisle-back-arrow-btn"
              onClick={handleBackClick}
              className="flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-700 transition-all shrink-0 cursor-pointer shadow-2xs border border-gray-200 group"
              title={
                breadcrumbs.length > 1
                  ? `Back to ${breadcrumbs[breadcrumbs.length - 2]?.name || 'Parent Aisle'}`
                  : 'Back to Search Aisles'
              }
              aria-label="Back to previous aisle"
            >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            </button>
          )}

          {/* ACTIVE FILTER UNTOGGLE BUTTONS (NO TEXT, LEFT OF SEARCH AISLES) */}
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

          {/* Active Deal Filter Chip */}
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

          <button
            type="button"
            id="cat-pill-all-items"
            onClick={handleAllItemsClick}
            style={
              useParentBackPill
                ? parentBackPillStyle
                : isAllItemsActive && !activeDealFilter
                  ? primaryBtnStyle
                  : undefined
            }
            className={`px-3 py-1 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1 border ${
              useParentBackPill
                ? 'shadow-2xs hover:brightness-95 active:scale-95'
                : isAllItemsActive && !activeDealFilter
                  ? 'shadow-xs border-transparent'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-transparent'
            }`}
            title={
              useParentBackPill && parentCategory
                ? `Back to all ${parentCategory.name || 'items'}`
                : undefined
            }
            aria-label={
              useParentBackPill && parentCategory
                ? `Back to all ${parentCategory.name || 'items'}`
                : undefined
            }
          >
            {useParentBackPill && <ArrowLeft className="w-3.5 h-3.5 shrink-0" />}
            <span>{leadingPillLabel}</span>
          </button>

          {displayedCategories.map((cat) => {
            if (!cat) return null;
            const isSelected = selectedCategoryId === cat.id;

            return (
              <button
                key={cat.id}
                id={`cat-pill-${cat.id}`}
                type="button"
                onClick={() => onSelectCategory(cat.id)}
                style={isSelected ? primaryBtnStyle : undefined}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer ${
                  isSelected
                    ? 'shadow-xs'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span>{cat.name || 'Category'}</span>
                {cat.subcategories && cat.subcategories.length > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                )}
              </button>
            );
          })}

          {/* "See More / Search Aisles" button opening the All Categories Dialog */}
          {onOpenAislesModal && (
            <button
              type="button"
              id="cat-pill-see-more-aisles"
              onClick={onOpenAislesModal}
              className="px-3 py-1 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs cursor-pointer active:scale-95"
              title="Open full aisle & category directory"
            >
              <LayoutGrid className="w-3 h-3 text-emerald-700" />
              <span>{remainingCategoriesCount > 0 ? `+${remainingCategoriesCount} More` : 'Search Aisles'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

