import React, { useState } from 'react';
import { BasketItem, Product } from '../../commerce/models';
import { useTenant } from '../../tenant/TenantContext';
import { useI18n } from '../../i18n/I18nContext';
import { ProductImage } from '../../components/media/Media';
import { defaultAnalyticsClient } from '../../analytics';
import { ShoppingBag, Plus, Check, Loader2 } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { isHfssTagged } from '../../commerce/reverseDealEngine';
import { ErrorBoundary } from '../../components/common/ErrorBoundary';

export interface CheckoutRecommendationsProps {
  // Supports legacy prop naming
  products?: Product[];
  currentBasketPlus?: string[];
  currentStoreId?: string;
  onAddToCart?: (product: Product, quantity?: number) => void;
  customerAgeVerified?: boolean;

  // Supports CheckoutModal prop naming
  basketItems?: BasketItem[];
  candidateProducts?: Product[];
  onAddRecommendation?: (product: Product) => void;
}

const CheckoutRecommendationsInternal: React.FC<CheckoutRecommendationsProps> = ({
  products,
  currentBasketPlus,
  currentStoreId,
  onAddToCart,
  customerAgeVerified = false,
  basketItems,
  candidateProducts,
  onAddRecommendation,
}) => {
  const { tenant } = useTenant();
  const { t } = useI18n();
  const [addingPlu, setAddingPlu] = useState<string | null>(null);
  const [addedPlus, setAddedPlus] = useState<Set<string>>(new Set());

  // Normalize candidate products and current basket PLUs safely
  const candidatePool: Product[] = (candidateProducts && candidateProducts.length > 0)
    ? candidateProducts
    : (products && products.length > 0)
    ? products
    : [];

  const basketPlusList: string[] = currentBasketPlus
    ? currentBasketPlus
    : (basketItems || []).map((i) => i.plu).filter(Boolean);

  const addHandler = onAddRecommendation
    ? onAddRecommendation
    : onAddToCart
    ? (p: Product) => onAddToCart(p, 1)
    : () => {};

  // Candidate essentials (bread, milk, eggs, orange juice, butter)
  const candidatePlus = [
    'PLU-SOURDOUGH-01',
    'PLU-ORGANIC-EGGS-6PK',
    'PLU-ORGANIC-MILK-2L',
    'PLU-COLDPRESS-ORANGE',
    'PLU-ART-001',
    'PLU-WHITE-FARMHOUSE-SLICED-800G',
    'PLU-JUICE-OJ-FRESH-1L',
  ];

  // Filter candidates against:
  // 1. Not already in current basket
  // 2. Active status & stock in selected store
  // 3. Regulatory / age restrictions (if not age verified, exclude 18+ items)
  // 4. HFSS / Checkout upsell restrictions (strictly exclude high fat/sugar items from checkout per UK regulations)
  const eligibleRecommendations = candidatePool.filter((product) => {
    if (!product || !product.plu) return false;
    if (basketPlusList.includes(product.plu)) return false;
    if (product.stockStatus === 'OUT_OF_STOCK' || product.active === false) return false;
    const isAlcoholic = product.beverageInfo?.isAlcoholic || Boolean(product.beverageInfo?.alcoholByVolume && product.beverageInfo.alcoholByVolume > 0.5);
    const minAge = (product as any).minAge || (isAlcoholic ? 18 : undefined);
    if (minAge && minAge >= 18 && !customerAgeVerified) return false;
    
    // HFSS Statutory Compliance check
    if (isHfssTagged(product)) return false;

    return candidatePlus.includes(product.plu);
  });

  if (eligibleRecommendations.length === 0) {
    return null;
  }

  const handleAdd = async (product: Product) => {
    setAddingPlu(product.plu);
    try {
      await Promise.resolve(addHandler(product));
      setAddedPlus((prev) => new Set(prev).add(product.plu));

      defaultAnalyticsClient.track({
        type: 'ADD_TO_BASKET',
        productPlu: product.plu,
        storeId: currentStoreId,
        properties: { source: 'checkout_recommendations' },
      });
    } catch (err) {
      console.error('Failed to add recommendation to basket', err);
    } finally {
      setAddingPlu(null);
    }
  };

  return (
    <div className="mt-4 p-4 rounded-2xl bg-amber-50/50 border border-amber-200/60">
      <div className="flex items-center gap-1.5 mb-3">
        <ShoppingBag className="w-4 h-4 text-amber-600" />
        <h4 className="text-xs font-bold text-amber-950">
          {t('basket.youMayHaveForgotten') || 'You may have forgotten'}
        </h4>
      </div>

      <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none">
        {eligibleRecommendations.slice(0, 4).map((product) => {
          if (!product) return null;
          const isAdding = addingPlu === product.plu;
          const isAdded = addedPlus.has(product.plu);
          const prodName = product.name || product.plu || 'Product';

          return (
            <div
              key={product.plu}
              className="flex items-center gap-2.5 p-2 rounded-xl bg-white border border-amber-200/50 shrink-0 w-56 shadow-2xs"
            >
              <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-gray-50">
                <ProductImage
                  src={product.imageUrl}
                  alt={prodName}
                  productName={prodName}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-gray-900 line-clamp-1">
                  {prodName}
                </p>
                <p className="text-[11px] font-mono text-gray-600">
                  {formatCurrency(product.price, '£')}
                </p>
              </div>

              <button
                type="button"
                disabled={isAdding || isAdded}
                onClick={() => handleAdd(product)}
                className="p-1.5 rounded-lg text-white font-bold transition-transform active:scale-95 disabled:opacity-50 shrink-0"
                style={{ backgroundColor: tenant?.primaryColour || '#059669' }}
                title="Add to order"
              >
                {isAdding ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : isAdded ? (
                  <Check className="w-3.5 h-3.5 text-white" />
                ) : (
                  <Plus className="w-3.5 h-3.5 text-white" />
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const CheckoutRecommendations: React.FC<CheckoutRecommendationsProps> = (props) => {
  return (
    <ErrorBoundary fallback={null}>
      <CheckoutRecommendationsInternal {...props} />
    </ErrorBoundary>
  );
};
