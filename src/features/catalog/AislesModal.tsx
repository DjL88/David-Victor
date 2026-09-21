import React, { useState, useMemo, useEffect } from 'react';
import { Category, Product } from '../../commerce/models';
import { useTenantStyles, useTenant } from '../../tenant/useTenant';
import { ensureNestedCategoryTree } from '../../commerce/categoryHierarchy';
import {
  Search,
  X,
  LayoutGrid,
  ChevronRight,
  Layers,
  ArrowRight,
  Sparkles,
  Check,
  ArrowLeft,
} from 'lucide-react';

interface AislesModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  products: Product[];
  selectedCategoryId: string | null;
  onSelectCategory: (categoryId: string | null) => void;
  storeName?: string;
}

export const AislesModal: React.FC<AislesModalProps> = ({
  isOpen,
  onClose,
  categories = [],
  products = [],
  selectedCategoryId,
  onSelectCategory,
  storeName,
}) => {
  const { primaryBtnStyle } = useTenantStyles();
  const [searchQuery, setSearchQuery] = useState('');
  const [browsePath, setBrowsePath] = useState<Category[]>([]);

  useEffect(() => {
    if (isOpen) {
      setBrowsePath([]);
      setSearchQuery('');
    }
  }, [isOpen]);

  const { tenant } = useTenant();

  // Normalize category tree to guarantee top-level array only contains level 1 root categories (c. 10 categories)
  const rootCategories = useMemo(() => {
    const tree = ensureNestedCategoryTree(categories || [], {
      enableSequentialCategoryGrouping: tenant?.featureFlags?.enableSequentialCategoryGrouping,
    });
    return tree.filter((cat) => {
      if (!cat) return false;
      const name = (cat.name || '').toLowerCase();
      const id = (cat.id || '').toLowerCase();
      return !name.includes('bundle') && !id.includes('bundle');
    });
  }, [categories, tenant?.featureFlags?.enableSequentialCategoryGrouping]);

  const visibleCategories = browsePath.length > 0
    ? browsePath[browsePath.length - 1].subcategories || []
    : rootCategories;

  // Search across all category levels when searchQuery is provided, or show current level when browsing
  const filteredCategories = useMemo((): Category[] => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return visibleCategories;

    // Helper to recursively collect matching categories at any level
    const matches: Category[] = [];
    const visit = (cats: Category[]) => {
      for (const cat of cats) {
        if (
          (cat.name || '').toLowerCase().includes(q) ||
          (cat.description || '').toLowerCase().includes(q)
        ) {
          matches.push(cat);
        }
        if (cat.subcategories && cat.subcategories.length > 0) {
          visit(cat.subcategories);
        }
      }
    };
    visit(rootCategories);
    return matches;
  }, [visibleCategories, rootCategories, searchQuery]);

  const categoryFallbackImages = useMemo(() => {
    const result = new Map<string, string>();
    const collectIds = (category: Category): string[] => [category.id, ...(category.subcategories || []).flatMap(collectIds)];
    const visit = (category: Category) => {
      const ids = new Set(collectIds(category));
      const product = products.find((candidate) => candidate.active !== false && candidate.stockStatus !== 'OUT_OF_STOCK' && Boolean(candidate.imageUrl) && (candidate.categoryIds || []).some((id) => ids.has(id)));
      if (product?.imageUrl) result.set(category.id, product.imageUrl);
      (category.subcategories || []).forEach(visit);
    };
    categories.forEach(visit);
    return result;
  }, [categories, products]);

  if (!isOpen) return null;

  const handleSelect = (categoryId: string | null) => {
    onSelectCategory(categoryId);
    onClose();
  };

  return (
    <div
      id="aisles-directory-dialog-overlay"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="aisles-directory-dialog-container"
        className="bg-white w-full max-w-2xl max-h-[85vh] sm:max-h-[82vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-250 border border-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Search */}
        <div className="p-4 sm:p-5 border-b border-gray-100 bg-white sticky top-0 z-10">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <LayoutGrid className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-extrabold text-gray-950 leading-tight">
                  {browsePath.length > 0 ? browsePath[browsePath.length - 1].name : 'All Aisles'}
                </h2>
                <p className="text-[11px] text-gray-500 font-medium">
                  {storeName ? `Browsing ${storeName}` : 'Select an aisle or product shelf'}
                </p>
              </div>
            </div>

            <button
              type="button"
              id="close-aisles-modal-btn"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-500 hover:text-gray-900 flex items-center justify-center transition-all cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search Input within Aisles Modal */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              id="aisles-modal-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search aisles, dairy, bakery, produce..."
              className="w-full pl-9 pr-8 py-2.5 rounded-2xl bg-gray-50 hover:bg-gray-100/80 focus:bg-white border border-gray-200 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 text-xs font-semibold text-gray-900 transition-all outline-hidden shadow-2xs"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                id="clear-aisles-search-btn"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-full cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Category List / Grid */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 no-scrollbar flex-1 bg-gray-50/50">
          {browsePath.length > 0 && (
            <div className="flex gap-2">
              <button type="button" onClick={() => { setBrowsePath((path) => path.slice(0, -1)); setSearchQuery(''); }} className="px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs font-bold text-gray-700 flex items-center gap-1.5">
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
              <button type="button" onClick={() => handleSelect(browsePath[browsePath.length - 1].id)} className="flex-1 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800">
                View all in {browsePath[browsePath.length - 1].name}
              </button>
            </div>
          )}

          {/* Quick "All Aisles" option */}
          {browsePath.length === 0 && (
          <button
            type="button"
            id="aisles-modal-select-all-btn"
            onClick={() => handleSelect(null)}
            className={`w-full p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 text-left cursor-pointer shadow-2xs ${
              selectedCategoryId === null
                ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-500/20'
                : 'bg-white hover:bg-gray-50 border-gray-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                  selectedCategoryId === null
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <span className="font-extrabold text-xs sm:text-sm text-gray-950 block">
                  All Supermarket Aisles
                </span>
                <span className="text-[11px] text-gray-500 block">
                  Browse entire catalog without category filters
                </span>
              </div>
            </div>

            {selectedCategoryId === null ? (
              <span className="px-2 py-1 rounded-full bg-emerald-600 text-white text-[10px] font-black flex items-center gap-1">
                <Check className="w-3 h-3" /> Selected
              </span>
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
          </button>
          )}

          {/* Filtered Aisles */}
          {filteredCategories.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm font-bold text-gray-700">No aisles matching &quot;{searchQuery}&quot;</p>
              <p className="text-xs text-gray-400 mt-1">Try searching for milk, fruit, bread, or snacks</p>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="mt-3 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-700 cursor-pointer"
              >
                Clear Search
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCategories.map((cat) => {
                const isSelected = selectedCategoryId === cat.id;
                const hasSubs = cat.subcategories && cat.subcategories.length > 0;
                const categoryImage = cat.imageUrl || categoryFallbackImages.get(cat.id);

                return (
                  <div
                    key={cat.id}
                    id={`aisles-modal-cat-${cat.id}`}
                    className={`rounded-2xl border transition-all p-3 sm:p-4 bg-white shadow-2xs ${
                      isSelected
                        ? 'border-emerald-300 ring-2 ring-emerald-500/20'
                        : 'border-gray-200/90 hover:border-gray-300'
                    }`}
                  >
                    {/* Main Category Header Row */}
                    <div className="flex items-center justify-between gap-3">
                      <div
                        onClick={() => hasSubs ? (setBrowsePath((path) => [...path, cat]), setSearchQuery('')) : handleSelect(cat.id)}
                        className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer group"
                      >
                        {categoryImage ? (
                          <img
                            src={categoryImage}
                            alt={cat.name}
                            className="w-11 h-11 rounded-xl object-cover border border-gray-100 shadow-2xs shrink-0 group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-xl bg-gray-100 text-gray-700 flex items-center justify-center font-bold text-xs shrink-0">
                            {cat.name.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <span className="font-extrabold text-xs sm:text-sm text-gray-950 block truncate group-hover:text-emerald-700 transition-colors">
                            {cat.name}
                          </span>
                          {cat.description && (
                            <span className="text-[11px] text-gray-400 block truncate">
                              {cat.description}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        id={`aisle-select-btn-${cat.id}`}
                        onClick={() => hasSubs ? (setBrowsePath((path) => [...path, cat]), setSearchQuery('')) : handleSelect(cat.id)}
                        style={isSelected ? primaryBtnStyle : undefined}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1 ${
                          isSelected
                            ? 'shadow-xs'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {hasSubs ? (
                          <><span>Open</span><ChevronRight className="w-3.5 h-3.5" /></>
                        ) : isSelected ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Active</span>
                          </>
                        ) : (
                          <>
                            <span>All</span>
                            <ArrowRight className="w-3 h-3" />
                          </>
                        )}
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
