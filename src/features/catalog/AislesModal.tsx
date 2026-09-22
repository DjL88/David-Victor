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

  // Derive both imagery and counts from the same product membership rule used by
  // the storefront: a category contains products assigned to itself OR any of its
  // descendants. Count unique PLUs, not category references, because retail feeds
  // can assign the same product at more than one level of the hierarchy.
  const categoryPresentation = useMemo(() => {
    const counts = new Map<string, number>();
    const images = new Map<string, string>();
    if (!isOpen) return { counts, images };

    const activeProducts = products.filter((product) => product.active !== false);
    const collectIds = (category: Category): string[] => [
      category.id,
      ...(category.subcategories || []).flatMap(collectIds),
    ];

    const visit = (category: Category) => {
      const descendantIds = new Set(
        collectIds(category).map((id) => String(id).trim().toLowerCase()).filter(Boolean)
      );
      const matching = activeProducts.filter((product) =>
        (product.categoryIds || []).some((id) =>
          descendantIds.has(String(id).trim().toLowerCase())
        )
      );

      // PLU is the saleable identity; fall back to product id only for malformed
      // catalogue rows so one product assigned at parent + shelf is never counted twice.
      const unique = new Map<string, Product>();
      matching.forEach((product) => {
        const key = String(product.plu || product.id || '').trim();
        if (key && !unique.has(key)) unique.set(key, product);
      });
      counts.set(category.id, unique.size);

      const representative = Array.from(unique.values()).find((product) => Boolean(product.imageUrl));
      if (representative?.imageUrl) images.set(category.id, representative.imageUrl);

      (category.subcategories || []).forEach(visit);
    };

    rootCategories.forEach(visit);
    return { counts, images };
  }, [isOpen, rootCategories, products]);

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
        className="bg-white w-full max-w-2xl h-[580px] max-h-[85vh] sm:max-h-[82vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Search */}
        <div className="p-4 sm:p-5 border-b border-gray-100 bg-white shrink-0">
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

          {/* Search Input within Aisles Modal (autoFocus removed to prevent keyboard engaging) */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              id="aisles-modal-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search aisles, dairy, bakery, produce..."
              className="w-full pl-9 pr-8 py-2.5 rounded-2xl bg-gray-50 hover:bg-gray-100/80 focus:bg-white border border-gray-200 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 text-xs font-semibold text-gray-900 transition-all outline-hidden shadow-2xs"
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
              <button type="button" onClick={() => { setBrowsePath((path) => path.slice(0, -1)); setSearchQuery(''); }} className="px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs font-bold text-gray-700 flex items-center gap-1.5 cursor-pointer shadow-2xs hover:bg-gray-50">
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
              <button type="button" onClick={() => handleSelect(browsePath[browsePath.length - 1].id)} className="flex-1 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 cursor-pointer hover:bg-emerald-100/80">
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
              className={`w-full p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 text-left cursor-pointer shadow-2xs ${
                selectedCategoryId === null
                  ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-500/20'
                  : 'bg-white hover:bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
                    selectedCategoryId === null
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-extrabold text-xs sm:text-sm text-gray-950 block">
                    All Aisles
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

          {/* Filtered Aisles Grid */}
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
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredCategories.map((cat) => {
                const isSelected = selectedCategoryId === cat.id;
                const hasSubs = cat.subcategories && cat.subcategories.length > 0;
                const categoryImage = cat.imageUrl || categoryPresentation.images.get(cat.id);
                const count = categoryPresentation.counts.get(cat.id) || 0;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    id={`aisles-modal-cat-${cat.id}`}
                    onClick={() =>
                      hasSubs
                        ? (setBrowsePath((path) => [...path, cat]), setSearchQuery(''))
                        : handleSelect(cat.id)
                    }
                    className={`group flex flex-col items-center text-center p-3 rounded-2xl border transition-all bg-white shadow-2xs hover:shadow-md cursor-pointer ${
                      isSelected
                        ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/30'
                        : 'border-gray-200/90 hover:border-emerald-300'
                    }`}
                  >
                    {categoryImage ? (
                      <img
                        src={categoryImage}
                        alt={cat.name}
                        className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover border border-gray-100 shadow-2xs group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center font-black text-lg group-hover:scale-105 transition-transform">
                        {cat.name.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span className="font-extrabold text-xs sm:text-sm text-gray-900 group-hover:text-emerald-700 transition-colors mt-2 line-clamp-2 leading-tight">
                      {cat.name}
                    </span>
                    <span className="text-[11px] font-medium text-gray-400 mt-0.5">
                      {count} {count === 1 ? 'item' : 'items'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
