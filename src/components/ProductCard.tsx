import React from 'react';
import { Product, ProductAvailabilitySummary, BasketItem, Money, moneyToMajor } from '../commerce/models';
import { evaluateProductAvailability } from '../rules/availabilityRules';
import { QuantitySelector } from './QuantitySelector';
import { useTenantStyles } from '../tenant/useTenant';
import { Plus, Store as StoreIcon, ShieldAlert, Heart } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';
import { ProductImage } from './media/Media';
import { useFavourites } from '../hooks/useFavourites';

function toMajorPrice(val?: Money | number | null): number | null {
  if (val === undefined || val === null) return null;
  if (typeof val === 'object' && typeof (val as any).amount === 'number') {
    return moneyToMajor(val);
  }
  if (typeof val === 'number') {
    if (isNaN(val) || !isFinite(val)) return null;
    return val >= 50 && Number.isInteger(val) ? val / 100 : val;
  }
  return null;
}

interface ProductCardProps {
  product: Product;
  availabilitySummary?: ProductAvailabilitySummary;
  basketQuantity?: number;
  basketItems?: BasketItem[];
  onSelectProduct: (product: Product) => void;
  onUpdateQuantity: (product: Product, quantity: number) => void;
  isStoreSelected: boolean;
  onPromptSelectStore?: (product?: Product) => void;
}

/**
 * Product Card component adhering to generic rule engine and availability aggregation.
 *
 * NOTE: The UI is advisory only. Backend BFF and Commerce API
 * independently enforce all rules upon basket mutation and checkout authorization.
 */
export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  availabilitySummary,
  basketQuantity = 0,
  basketItems = [],
  onSelectProduct,
  onUpdateQuantity,
  isStoreSelected,
  onPromptSelectStore,
}) => {
  const { primaryBtnStyle, currencySymbol } = useTenantStyles();
  const { isFavourite, toggleFavourite } = useFavourites();
  const isFav = isFavourite(product.plu);

  const decision = evaluateProductAvailability(
    product,
    basketQuantity,
    {},
    basketItems
  );

  // Inactive or hidden product: do not render
  if (!decision.shouldRender) {
    return null;
  }

  const origPriceMajor = moneyToMajor(product.originalPrice);
  const priceMajor =
    moneyToMajor(product.price) ||
    (typeof product.priceMinor === 'number' ? product.priceMinor / 100 : 0) ||
    (typeof (product as any).basePrice === 'number'
      ? (product as any).basePrice / 100
      : moneyToMajor((product as any).basePrice));
  const hasDiscount = origPriceMajor > 0 && priceMajor > 0 && origPriceMajor > priceMajor;
  const depositMajor = moneyToMajor(product.supplementalInfo?.deposit ?? product.deposit);

  // Aggregate availability logic before store selection
  let availabilityLabel: string | null = null;
  let isUnavailableNearby = false;

  if (!isStoreSelected && availabilitySummary) {
    if (availabilitySummary.availableStoreCount === 0) {
      availabilityLabel = 'Currently unavailable near you';
      isUnavailableNearby = true;
    } else if (
      availabilitySummary.deliveryAvailable === false &&
      availabilitySummary.collectionAvailable === true
    ) {
      availabilityLabel = 'Collection only nearby';
    } else {
      const count = availabilitySummary.availableStoreCount || 0;
      const total = availabilitySummary.eligibleStoreCount && availabilitySummary.eligibleStoreCount > 0
        ? availabilitySummary.eligibleStoreCount
        : count;
      if (count >= total && total > 0) {
        availabilityLabel = `Available at all ${count} shops`;
      } else if (total > 0) {
        availabilityLabel = `Available at ${count} of ${total} shops`;
      }
    }
  }

  // Derive price display: when no store is selected, show accurate price or from-price if variance exists
  const displayPriceText = React.useMemo(() => {
    if (isStoreSelected) {
      if (product.price != null) {
        return formatCurrency(product.price, currencySymbol);
      }
      if (typeof product.priceMinor === 'number') {
        return formatCurrency(product.priceMinor / 100, currencySymbol);
      }
      if (typeof (product as any).basePrice === 'number') {
        return formatCurrency((product as any).basePrice / 100, currencySymbol);
      }
      if ((product as any).basePrice != null) {
        return formatCurrency((product as any).basePrice, currencySymbol);
      }
      return 'Price unavailable';
    }

    // When all locations selected / pre-store browsing:
    const minP = toMajorPrice(availabilitySummary?.minimumPrice);
    const maxP = toMajorPrice(availabilitySummary?.maximumPrice);

    if (minP != null && maxP != null) {
      if (Math.abs(minP - maxP) > 0.001) {
        return `From ${formatCurrency(minP, currencySymbol)}`;
      }
      return formatCurrency(minP, currencySymbol);
    }

    if (minP != null) {
      return formatCurrency(minP, currencySymbol);
    }

    if (product.price != null) {
      return formatCurrency(product.price, currencySymbol);
    }

    if (typeof product.priceMinor === 'number') {
      return formatCurrency(product.priceMinor / 100, currencySymbol);
    }

    if (typeof (product as any).basePrice === 'number') {
      return formatCurrency((product as any).basePrice / 100, currencySymbol);
    }

    if ((product as any).basePrice != null) {
      return formatCurrency((product as any).basePrice, currencySymbol);
    }

    return 'Price unavailable';
  }, [isStoreSelected, product.price, product.priceMinor, (product as any).basePrice, availabilitySummary, currencySymbol]);

  // Handle Add button click
  const handleAddClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isStoreSelected && onPromptSelectStore) {
      onPromptSelectStore(product);
      return;
    }
    if (decision.canAddToCart) {
      onUpdateQuantity(product, basketQuantity + 1);
    }
  };

  return (
    <div
      id={`product-card-${product.plu}`}
      onClick={() => onSelectProduct(product)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onSelectProduct(product);
        }
      }}
      className={`group relative flex flex-col justify-between bg-white rounded-2xl p-3 border border-gray-100 shadow-xs hover:shadow-md transition-all cursor-pointer select-none overflow-hidden ${
        decision.isGreyedOut ? 'opacity-60 grayscale-[40%]' : ''
      }`}
    >
      {/* Top Badges derived from RuleEngine + Favourite Heart */}
      <div className="absolute top-2 left-2 right-2 z-10 flex items-center justify-between gap-1">
        <div className="flex flex-wrap gap-1 pointer-events-none">
          {hasDiscount && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white shadow-2xs">
              SAVE {(origPriceMajor - priceMajor).toFixed(2)}
            </span>
          )}

          {decision.badges?.map((badge, idx) => {
            const isAge = badge.includes('18+') || badge.includes('16+');
            const isLimit = badge.toLowerCase().includes('limit');
            const isOutOfStock = badge.toLowerCase().includes('out of stock');

            return (
              <span
                key={idx}
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-2xs flex items-center gap-0.5 ${
                  isOutOfStock
                    ? 'bg-red-100 text-red-700'
                    : isAge
                    ? 'bg-purple-100 text-purple-700'
                    : isLimit
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {isAge && <ShieldAlert className="w-2.5 h-2.5" />}
                {badge}
              </span>
            );
          })}
        </div>

        {/* Heart Favourite Button */}
        <button
          type="button"
          id={`fav-btn-${product.plu}`}
          aria-label={isFav ? 'Remove from favourites' : 'Add to favourites'}
          onClick={(e) => {
            e.stopPropagation();
            toggleFavourite(product.plu);
          }}
          className={`w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-xs shrink-0 ${
            isFav
              ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
              : 'bg-white/90 backdrop-blur-xs text-gray-400 hover:text-rose-500 hover:bg-white'
          }`}
        >
          <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-rose-500 text-rose-500' : 'stroke-current'}`} />
        </button>
      </div>

      {/* Product Image */}
      <div className="relative w-full aspect-square rounded-xl bg-gray-50 overflow-hidden mb-2.5 flex items-center justify-center">
        <ProductImage
          src={product?.imageUrl}
          alt={product?.name || 'Product'}
          productName={product?.name || 'Product'}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />

        {/* DRS deposit tag on image corner */}
        {depositMajor > 0 && (
          <span className="absolute bottom-1.5 left-1.5 text-[9px] font-bold bg-black/75 text-white backdrop-blur-xs px-1.5 py-0.5 rounded-md">
            +£{depositMajor.toFixed(2)} DRS
          </span>
        )}
      </div>

      {/* Product Information */}
      <div className="flex-1 flex flex-col justify-between">
        <div>
          {product?.brand && (
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-0.5 truncate">
              {product.brand}
            </span>
          )}
          <h3 className="text-sm font-bold text-gray-900 line-clamp-2 leading-snug group-hover:opacity-80 transition-opacity">
            {product?.name || product?.plu || 'Product'}
          </h3>
        </div>

        {/* Aggregate Availability (Only before store selection) */}
        {!isStoreSelected && availabilityLabel && (
          <div
            className={`mt-2 text-[11px] font-medium rounded-lg px-2 py-1 flex items-center gap-1 truncate ${
              isUnavailableNearby
                ? 'text-gray-600 bg-gray-100'
                : 'text-gray-800 bg-gray-100 font-semibold'
            }`}
          >
            <StoreIcon className="w-3 h-3 shrink-0 text-gray-600" />
            <span className="truncate">{availabilityLabel}</span>
          </div>
        )}

        {/* Price & Action Row */}
        <div className="mt-3 pt-2 border-t border-gray-50 flex items-center justify-between gap-2">
          <div>
            <div className="flex flex-wrap items-baseline gap-1">
              <span className="text-base font-extrabold text-gray-900">
                {displayPriceText}
              </span>

              {hasDiscount && (
                <span className="text-xs text-gray-400 line-through">
                  {formatCurrency(product.originalPrice || 0, currencySymbol)}
                </span>
              )}
            </div>

            {depositMajor > 0 ? (
              <span className="text-[10px] text-gray-600 font-medium block">
                +£{depositMajor.toFixed(2)} deposit
              </span>
            ) : product.nutritionalInfo?.portionSize ? (
              <span className="text-[10px] text-gray-400 block">
                {product.nutritionalInfo.portionSize}
              </span>
            ) : null}
          </div>

          {/* Action Button: Add or Stepper */}
          <div>
            {decision.isGreyedOut ? (
              <button
                type="button"
                disabled
                className="text-xs font-semibold px-2.5 py-1.5 bg-gray-100 text-gray-400 rounded-full cursor-not-allowed"
              >
                Unavailable
              </button>
            ) : !isStoreSelected ? (
              <button
                type="button"
                onClick={handleAddClick}
                style={primaryBtnStyle}
                className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full shadow-xs active:scale-95 transition-transform"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            ) : basketQuantity > 0 ? (
              <QuantitySelector
                quantity={basketQuantity}
                maxQuantity={decision.effectiveLimit}
                onIncrement={() => onUpdateQuantity(product, basketQuantity + 1)}
                onDecrement={() => onUpdateQuantity(product, basketQuantity - 1)}
                size="sm"
              />
            ) : (
              <button
                type="button"
                onClick={handleAddClick}
                style={primaryBtnStyle}
                className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full shadow-xs active:scale-95 transition-transform"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
