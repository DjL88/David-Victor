import React, { useMemo } from 'react';
import { Product } from '../../commerce/models';
import { useTenantStyles } from '../../tenant/useTenant';
import {
  X,
  Heart,
  RotateCcw,
  Check,
  SlidersHorizontal,
  ShieldCheck,
} from 'lucide-react';
import {
  normalizeAllergenKey,
  getAllergenIcon,
  normalizeDietaryTag,
  getCanonicalDietaryLabel,
  isDietaryTag,
  isKnownAllergen,
  CANONICAL_ALLERGENS,
} from '../../domain/allergens';

export interface CatalogFilterState {
  onlyFavourites: boolean;
  onlyBuyAgain: boolean;
  selectedDietaryTags: string[];
  excludedAllergens: string[];
}

interface DietaryPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  filterState: CatalogFilterState;
  onChangeFilterState: (next: CatalogFilterState) => void;
  favouritesCount: number;
  buyAgainCount: number;
}

export const DietaryPreferencesModal: React.FC<DietaryPreferencesModalProps> = ({
  isOpen,
  onClose,
  products,
  filterState,
  onChangeFilterState,
  favouritesCount,
  buyAgainCount,
}) => {
  const { primaryBtnStyle } = useTenantStyles();

  // Extract all unique dietary tags dynamically from the available products
  const dynamicDietaryTags = useMemo(() => {
    const tagSet = new Map<string, { label: string; count: number }>();

    products.forEach((p) => {
      const candidates: string[] = [
        ...(p.displayLabels || []),
        ...(p.productTagLabels || []),
        ...(p.productTags || []),
      ];

      candidates.forEach((raw) => {
        if (!raw || typeof raw !== 'string') return;
        // Product tags also contain merchandising, operational and raw numeric
        // Deliverect tag IDs. Only expose the small canonical set that is
        // meaningful as a customer dietary/lifestyle preference.
        if (!isDietaryTag(raw)) return;
        const norm = normalizeDietaryTag(raw);
        if (!norm) return;

        const label = getCanonicalDietaryLabel(raw);
        const existing = tagSet.get(norm);
        if (existing) {
          existing.count += 1;
        } else {
          tagSet.set(norm, { label, count: 1 });
        }
      });
    });

    return Array.from(tagSet.entries()).map(([tag, data]) => ({
      tag,
      label: data.label,
      count: data.count,
    }));
  }, [products]);

  const allergenOptions = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    products.forEach((product) =>
      (product.allergens || []).forEach((raw) => {
        const label = String(raw).trim();
        // Never turn an unresolved/raw tag id into a customer-facing allergen.
        // Allergens must resolve to our explicit canonical safety vocabulary.
        if (!label || !isKnownAllergen(label)) return;
        const canonicalKey = normalizeAllergenKey(label);
        const canonicalConfig = CANONICAL_ALLERGENS[canonicalKey];
        if (!canonicalConfig) return;
        const displayLabel = canonicalConfig.label;

        const existing = counts.get(canonicalKey);
        if (existing) {
          existing.count += 1;
        } else {
          counts.set(canonicalKey, { label: displayLabel, count: 1 });
        }
      })
    );
    return Array.from(counts.entries()).map(([id, value]) => ({
      id,
      ...value,
      icon: getAllergenIcon(id),
    }));
  }, [products]);

  if (!isOpen) return null;

  const toggleDietaryTag = (tag: string) => {
    const exists = filterState.selectedDietaryTags.includes(tag);
    const next = exists
      ? filterState.selectedDietaryTags.filter((t) => t !== tag)
      : [...filterState.selectedDietaryTags, tag];
    onChangeFilterState({ ...filterState, selectedDietaryTags: next });
  };

  const toggleAllergenExclusion = (allergenId: string) => {
    const exists = filterState.excludedAllergens.includes(allergenId);
    const next = exists
      ? filterState.excludedAllergens.filter((a) => a !== allergenId)
      : [...filterState.excludedAllergens, allergenId];
    onChangeFilterState({ ...filterState, excludedAllergens: next });
  };

  const clearAllFilters = () => {
    onChangeFilterState({
      onlyFavourites: false,
      onlyBuyAgain: false,
      selectedDietaryTags: [],
      excludedAllergens: [],
    });
  };

  const totalActiveFilters =
    (filterState.onlyFavourites ? 1 : 0) +
    (filterState.onlyBuyAgain ? 1 : 0) +
    filterState.selectedDietaryTags.length +
    filterState.excludedAllergens.length;

  return (
    <div
      id="dietary-preferences-modal-backdrop"
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        id="dietary-preferences-card"
        className="w-full max-w-lg bg-white rounded-3xl p-5 sm:p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900 leading-tight">
                Diet, Allergens & Favourites
              </h2>
              <p className="text-xs text-gray-500">
                Filter aisle products by your preferences and dietary needs
              </p>
            </div>
          </div>
          <button
            type="button"
            id="close-dietary-modal-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-5">
          {/* Section 1: Shopping Shortcuts */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5">
              Saved & Previous Purchases
            </h3>
            <div className="grid grid-cols-2 gap-2.5">
              {/* Favourites Toggle */}
              <button
                type="button"
                id="filter-toggle-favourites"
                onClick={() =>
                  onChangeFilterState({
                    ...filterState,
                    onlyFavourites: !filterState.onlyFavourites,
                  })
                }
                className={`p-3 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                  filterState.onlyFavourites
                    ? 'bg-rose-50 border-rose-300 text-rose-950 font-bold shadow-xs'
                    : 'bg-gray-50/70 hover:bg-gray-100 border-gray-200 text-gray-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center ${
                      filterState.onlyFavourites
                        ? 'bg-rose-500 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    <Heart className="w-3.5 h-3.5 fill-current" />
                  </div>
                  <div>
                    <span className="text-xs font-bold block">Favourites</span>
                    <span className="text-[10px] text-gray-500">
                      {favouritesCount} saved items
                    </span>
                  </div>
                </div>
                {filterState.onlyFavourites && (
                  <Check className="w-4 h-4 text-rose-600 shrink-0" />
                )}
              </button>

              {/* Buy Again Toggle */}
              <button
                type="button"
                id="filter-toggle-buy-again"
                onClick={() =>
                  onChangeFilterState({
                    ...filterState,
                    onlyBuyAgain: !filterState.onlyBuyAgain,
                  })
                }
                className={`p-3 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                  filterState.onlyBuyAgain
                    ? 'bg-blue-50 border-blue-300 text-blue-950 font-bold shadow-xs'
                    : 'bg-gray-50/70 hover:bg-gray-100 border-gray-200 text-gray-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center ${
                      filterState.onlyBuyAgain
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold block">Buy Again</span>
                    <span className="text-[10px] text-gray-500">
                      {buyAgainCount} previous items
                    </span>
                  </div>
                </div>
                {filterState.onlyBuyAgain && (
                  <Check className="w-4 h-4 text-blue-600 shrink-0" />
                )}
              </button>
            </div>
          </div>

          {/* Section 2: Dietary Lifestyles (Derived Dynamically from Item Tags) */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Dietary & Lifestyle Tags
              </h3>
              <span className="text-[11px] text-gray-500">
                Pulled from live aisle items
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {dynamicDietaryTags.map(({ tag, label, count }) => {
                const isSelected = filterState.selectedDietaryTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    id={`diet-tag-${tag.toLowerCase()}`}
                    onClick={() => toggleDietaryTag(tag)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                    <span>{label}</span>
                    <span
                      className={`text-[10px] px-1 py-0.2 rounded-md ${
                        isSelected ? 'bg-emerald-700 text-emerald-100' : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Allergen Exclusions */}
          <div>
            <div className="flex items-center gap-1.5 mb-2.5">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Exclude Allergens (Safety Filter)
              </h3>
            </div>
            <div className="space-y-1.5">
              {allergenOptions.length === 0 ? (
                <p className="text-xs text-gray-500 bg-gray-50 rounded-xl p-3">No verified allergen tags are present in the current catalog.</p>
              ) : allergenOptions.map(({ id, label, count, icon: Icon }) => {
                const isExcluded = filterState.excludedAllergens.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    id={`allergen-toggle-${id.toLowerCase()}`}
                    onClick={() => toggleAllergenExclusion(id)}
                    className={`w-full px-3 py-2 rounded-xl text-xs flex items-center justify-between border transition-all cursor-pointer ${
                      isExcluded
                        ? 'bg-amber-50 border-amber-300 text-amber-950 font-bold'
                        : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-700 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${isExcluded ? 'text-amber-600' : 'text-gray-400'}`} aria-hidden="true" />
                      <span>Exclude {label} ({count})</span>
                    </div>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-lg font-bold ${
                        isExcluded ? 'bg-amber-200/80 text-amber-900' : 'text-gray-400'
                      }`}
                    >
                      {isExcluded ? 'Excluded' : 'Allowed'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 mt-2 border-t border-gray-100 flex items-center justify-between gap-3">
          <button
            type="button"
            id="clear-all-filters-btn"
            onClick={clearAllFilters}
            disabled={totalActiveFilters === 0}
            className={`text-xs font-semibold py-2 px-3 rounded-xl transition-colors ${
              totalActiveFilters > 0
                ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 cursor-pointer'
                : 'text-gray-300 cursor-not-allowed'
            }`}
          >
            Reset Filters
          </button>

          <button
            type="button"
            id="apply-dietary-filters-btn"
            onClick={onClose}
            style={primaryBtnStyle}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-transform cursor-pointer"
          >
            <span>Apply Preferences</span>
            {totalActiveFilters > 0 && (
              <span className="bg-white/20 text-white px-1.5 py-0.2 rounded-full text-[10px]">
                {totalActiveFilters} active
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
