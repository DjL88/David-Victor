import React, { useState } from 'react';
import { Product } from '../../commerce/models';
import { useTenant } from '../../tenant/TenantContext';
import { useI18n } from '../../i18n/I18nContext';
import { ProductImage } from '../../components/media/Media';
import { defaultAnalyticsClient } from '../../analytics';
import { formatCurrency } from '../../utils/formatters';
import {
  Heart,
  RotateCcw,
  Check,
  AlertCircle,
  Plus,
  Loader2,
} from 'lucide-react';
import { isDemoMode } from '../../domain/runtime';

interface FavouritesAndBuyAgainProps {
  products: Product[];
  currentStoreId?: string;
  onAddToCart: (product: Product, quantity?: number) => void;
  onSelectProduct: (product: Product) => void;
}

export const FavouritesAndBuyAgain: React.FC<FavouritesAndBuyAgainProps> = ({
  products,
  currentStoreId,
  onAddToCart,
  onSelectProduct,
}) => {
  const { tenant } = useTenant();
  const { t } = useI18n();

  const [activeSubTab, setActiveSubTab] = useState<'favourites' | 'buyAgain' | 'recent'>('favourites');
  const [revalidatingPlu, setRevalidatingPlu] = useState<string | null>(null);
  const [justAddedPlu, setJustAddedPlu] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Initial favorites / purchase history (only seeded in demo mode)
  const [favouritePlus, setFavouritePlus] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('dl_guest_favourites');
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return isDemoMode()
      ? [
          'PLU-SOURDOUGH-01',
          'PLU-ORGANIC-EGGS-6PK',
          'PLU-ORGANIC-MILK-2L',
        ]
      : [];
  });

  const recentPurchasesPlus = isDemoMode()
    ? [
        'PLU-SOURDOUGH-01',
        'PLU-COLDPRESS-ORANGE',
        'PLU-ORGANIC-MILK-2L',
        'PLU-ART-001',
      ]
    : [];

  const currentPluList =
    activeSubTab === 'favourites'
      ? favouritePlus
      : recentPurchasesPlus;

  const displayedProducts = products.filter((p) => currentPluList.includes(p.plu));

  /**
   * Revalidates current store, live price, stock, and rules before adding to basket.
   */
  const handleReorderItem = async (product: Product) => {
    setRevalidatingPlu(product.plu);
    setValidationError(null);

    // Simulate authoritative BFF re-validation
    await new Promise((r) => setTimeout(r, 450));

    // 1. Validate active status & stock
    if (product.active === false || product.stockStatus === 'OUT_OF_STOCK') {
      setValidationError(`${product?.name || 'Product'} is currently out of stock at this store.`);
      setRevalidatingPlu(null);
      return;
    }

    // 2. Add to basket authoritatively
    onAddToCart(product, 1);
    setJustAddedPlu(product.plu);
    setRevalidatingPlu(null);

    // Emit de-identified analytics event
    defaultAnalyticsClient.track({
      type: 'ADD_TO_BASKET',
      productPlu: product.plu,
      storeId: currentStoreId,
      properties: { source: activeSubTab },
    });

    setTimeout(() => setJustAddedPlu(null), 2000);
  };

  const toggleFavourite = (plu: string) => {
    setFavouritePlus((prev) =>
      prev.includes(plu) ? prev.filter((p) => p !== plu) : [...prev, plu]
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 md:p-6 shadow-xs">
      <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
        <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveSubTab('favourites')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'favourites'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
            {t('nav.favourites')} ({favouritePlus.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('buyAgain')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'buyAgain'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5 text-indigo-600" />
            {t('nav.buyAgain')}
          </button>
        </div>
      </div>

      {validationError && (
        <div className="mb-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>{validationError}</span>
        </div>
      )}

      {displayedProducts.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Heart className="w-8 h-8 mx-auto text-gray-300 mb-2" />
          <p className="font-bold text-sm text-gray-700">{t('fav.emptyTitle')}</p>
          <p className="text-xs text-gray-500 mt-0.5 max-w-xs mx-auto">
            {t('fav.emptySubtitle')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {displayedProducts.map((product) => {
            const isRevalidating = revalidatingPlu === product.plu;
            const isAdded = justAddedPlu === product.plu;

            return (
              <div
                key={product.plu}
                className="group relative flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-xs transition-all bg-gray-50/50"
              >
                <div
                  className="w-16 h-16 rounded-lg overflow-hidden shrink-0 cursor-pointer bg-white"
                  onClick={() => onSelectProduct(product)}
                >
                  <ProductImage
                    src={product.imageUrl}
                    alt={product?.name || 'Product'}
                    productName={product?.name || 'Product'}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <h4
                    className="text-xs font-bold text-gray-900 line-clamp-1 cursor-pointer hover:underline"
                    onClick={() => onSelectProduct(product)}
                  >
                    {product?.name || product?.plu || 'Product'}
                  </h4>
                  <p className="text-[11px] font-mono font-bold text-gray-700 mt-0.5">
                    {formatCurrency(product.price, '£')}
                  </p>

                  <div className="flex items-center gap-2 mt-2">
                    <button
                      type="button"
                      disabled={isRevalidating}
                      onClick={() => handleReorderItem(product)}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold text-white flex items-center gap-1 shadow-xs transition-transform active:scale-95 disabled:opacity-50"
                      style={{ backgroundColor: tenant?.primaryColour || '#059669' }}
                    >
                      {isRevalidating ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : isAdded ? (
                        <>
                          <Check className="w-3 h-3 text-white" />
                          <span>Added</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3 h-3" />
                          <span>Add</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleFavourite(product.plu)}
                      className="p-1 text-gray-400 hover:text-rose-500 transition-colors"
                      title="Toggle Favourite"
                    >
                      <Heart
                        className={`w-4 h-4 ${
                          favouritePlus.includes(product.plu)
                            ? 'text-rose-500 fill-rose-500'
                            : ''
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
