import React, { useMemo } from 'react';
import { Product, ProductAvailabilitySummary, BasketItem } from '../../commerce/models';
import { ProductCard } from '../../components/ProductCard';
import { getRenderableProducts } from '../../rules/availabilityRules';
import { Search as SearchIcon, X, TrendingUp } from 'lucide-react';

interface SearchScreenProps {
  query: string;
  onQueryChange: (q: string) => void;
  results: Product[];
  summaries: Record<string, ProductAvailabilitySummary>;
  loading: boolean;
  onSelectProduct: (p: Product) => void;
  onUpdateQuantity: (p: Product, q: number) => void;
  isStoreSelected: boolean;
  onPromptSelectStore: () => void;
  getBasketQuantity: (plu: string) => number;
  basketItems?: BasketItem[];
}

export const SearchScreen: React.FC<SearchScreenProps> = ({
  query,
  onQueryChange,
  results,
  summaries,
  loading,
  onSelectProduct,
  onUpdateQuantity,
  isStoreSelected,
  onPromptSelectStore,
  getBasketQuantity,
  basketItems = [],
}) => {
  const popularKeywords = ['Strawberries', 'Milk', 'Sourdough', 'Pizza', 'Rosé', 'IPA', 'Paracetamol', 'Crisps'];

  const renderableResults = useMemo(() => {
    return getRenderableProducts(results);
  }, [results]);

  return (
    <div id="search-screen-container" className="max-w-7xl mx-auto px-4 py-4">
      {/* Mobile Search Bar */}
      <div className="relative mb-4">
        <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          id="main-search-input"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search groceries, brands, GTIN barcode, or tags..."
          autoFocus
          className="w-full pl-10 pr-10 py-3.5 rounded-2xl bg-white border border-gray-200 text-sm font-semibold text-gray-900 focus:outline-hidden focus:border-emerald-500 shadow-xs transition-all"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQueryChange('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-xs"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Popular Suggestions if query empty */}
      {!query.trim() && (
        <div className="mb-6">
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            <span>Trending Searches</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {popularKeywords.map((kw) => (
              <button
                key={kw}
                type="button"
                onClick={() => onQueryChange(kw)}
                className="px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-xs font-semibold text-gray-700 hover:border-emerald-500 hover:text-emerald-700 transition-colors shadow-2xs"
              >
                {kw}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results Header */}
      {query.trim() && (
        <div className="flex items-center justify-between mb-3 text-xs text-gray-500">
          <span>
            {loading
              ? 'Searching catalogue...'
              : `Found ${renderableResults.length} ${renderableResults.length === 1 ? 'item' : 'items'} for "${query}"`}
          </span>
          {!isStoreSelected && (
            <span className="text-emerald-700 font-semibold">
              Showing multi-store availability
            </span>
          )}
        </div>
      )}

      {/* Results Grid */}
      {renderableResults.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          {renderableResults.map((product) => (
            <ProductCard
              key={product.plu}
              product={product}
              availabilitySummary={summaries[product.plu]}
              basketQuantity={getBasketQuantity(product.plu)}
              basketItems={basketItems}
              onSelectProduct={onSelectProduct}
              onUpdateQuantity={onUpdateQuantity}
              isStoreSelected={isStoreSelected}
              onPromptSelectStore={onPromptSelectStore}
            />
          ))}
        </div>
      ) : query.trim() && !loading ? (
        <div className="text-center py-16 text-gray-400">
          <SearchIcon className="w-12 h-12 stroke-1 mx-auto mb-2 text-gray-300" />
          <h3 className="text-sm font-bold text-gray-700">No matching products found</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
            Try searching for something else like fresh milk, sourdough, or craft beer.
          </p>
        </div>
      ) : null}
    </div>
  );
};
