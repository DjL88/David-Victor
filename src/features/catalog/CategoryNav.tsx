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
  favouritesCount = 0,
  activeFiltersCount = 0,
}) => {
  const { primaryBtnStyle } = useTenantStyles();

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

  // Determine whether "All Items" is currently active
  // At root: active when selectedCategoryId === null
  // Inside a category: active when selectedCategoryId === currentCategory.id
  const isAllItemsActive = currentCategory
    ? selectedCategoryId === currentCategory.id
    : selectedCategoryId === null;

  const handleAllItemsClick = () => {
    if (currentCategory) {
      // Inside a category: Show all items in this category (including all its subcategories and sub-subcategories)
      onSelectCategory(currentCategory.id);
    } else {
      // Supermarket root
      onSelectCategory(null);
    }
  };

  const handleBackClick = () => {
    if (breadcrumbs.length > 1) {
      // Go back to parent category
      onSelectCategory(breadcrumbs[breadcrumbs.length - 2].id);
    } else {
      // Go back to all aisles
      onSelectCategory(null);
    }
  };

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
          <span>All Aisles</span>
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
      <div className="flex items-center gap-2 w-full max-w-full overflow-hidden">
        {/* Left grouping: Merged Filter Button + Search Bar */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Merged Favourites, Allergens & Dietary Preferences Button */}
          {onOpenFiltersModal && (
            <button
              type="button"
              id="filter-allergens-dietary-btn"
              onClick={onOpenFiltersModal}
              className={`relative p-2 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer border shadow-2xs ${
                activeFiltersCount > 0 || filterState?.onlyFavourites
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800 ring-2 ring-emerald-400/20'
                  : 'bg-white hover:bg-gray-100 border-gray-200 text-gray-700 active:scale-95'
              }`}
              title="Filter by favourites, allergens & dietary preferences"
              aria-label="Filter favourites, allergens and diet"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-gray-700" />
              {(activeFiltersCount > 0 || (filterState?.onlyFavourites && 1)) && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-emerald-600 text-white text-[9px] font-black flex items-center justify-center shadow-xs">
                  {activeFiltersCount + (filterState?.onlyFavourites ? 1 : 0)}
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
                placeholder="Search aisle..."
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

        {/* Subcategory / Shelf Pills with Back Arrow left of 'All [Category]' */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 flex-1 min-w-0">
          {/* Back Arrow button placed immediately to the left of 'All [Category]' */}
          {breadcrumbs.length > 0 && (
            <button
              type="button"
              id="aisle-back-arrow-btn"
              onClick={handleBackClick}
              className="flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-700 transition-all shrink-0 cursor-pointer shadow-2xs border border-gray-200 group"
              title={
                breadcrumbs.length > 1
                  ? `Back to ${breadcrumbs[breadcrumbs.length - 2]?.name || 'Parent Aisle'}`
                  : 'Back to All Aisles'
              }
              aria-label="Back to previous aisle"
            >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
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
            style={isAllItemsActive && !activeDealFilter ? primaryBtnStyle : undefined}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
              isAllItemsActive && !activeDealFilter
                ? 'shadow-xs'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {currentCategory?.name ? `All ${currentCategory.name}` : 'All Aisles'}
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

          {/* "See More / All Aisles" button opening the All Categories Dialog */}
          {onOpenAislesModal && (
            <button
              type="button"
              id="cat-pill-see-more-aisles"
              onClick={onOpenAislesModal}
              className="px-3 py-1 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs cursor-pointer active:scale-95"
              title="Open full aisle & category directory"
            >
              <LayoutGrid className="w-3 h-3 text-emerald-700" />
              <span>{remainingCategoriesCount > 0 ? `+${remainingCategoriesCount} More` : 'All Aisles'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
