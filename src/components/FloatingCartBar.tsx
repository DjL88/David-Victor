import React from 'react';
import { Basket, moneyToMajor, moneyFromMajor } from '../commerce/models';
import { useTenantStyles } from '../tenant/useTenant';
import { formatCurrency } from '../utils/formatters';
import { ShoppingBag, ArrowRight } from 'lucide-react';

interface FloatingCartBarProps {
  basket: Basket | null;
  allBaskets?: Basket[];
  isMultiLocation?: boolean;
  itemCount: number;
  onOpenCart: () => void;
}

export const FloatingCartBar: React.FC<FloatingCartBarProps> = ({
  basket,
  allBaskets = [],
  isMultiLocation = false,
  itemCount,
  onOpenCart,
}) => {
  const { primaryBtnStyle, currencySymbol } = useTenantStyles();

  const effectiveBaskets =
    isMultiLocation && allBaskets.length > 1
      ? allBaskets
      : basket && basket.items && basket.items.length > 0
      ? [basket]
      : [];

  if (effectiveBaskets.length === 0 || itemCount === 0) return null;

  const totalMajor = effectiveBaskets.reduce((sum, b) => sum + moneyToMajor(b.total), 0);
  const totalSubtotalMajor = effectiveBaskets.reduce((sum, b) => sum + moneyToMajor(b.subtotal), 0);
  const totalSavingsMajor = effectiveBaskets.reduce(
    (sum, b) =>
      sum +
      (b.discountTotal
        ? moneyToMajor(b.discountTotal)
        : (b.discounts || []).reduce((dSum, d) => dSum + moneyToMajor(d.amount), 0)),
    0
  );
  const subtotalWithSavingsMajor = Math.max(0, totalSubtotalMajor - totalSavingsMajor);

  const currency = effectiveBaskets[0]?.currency || basket?.currency || 'GBP';
  const actualBasketTotalFormatted = formatCurrency(
    moneyFromMajor(totalMajor, currency),
    currencySymbol
  );
  const subtotalWithSavingsFormatted = formatCurrency(
    moneyFromMajor(subtotalWithSavingsMajor, currency),
    currencySymbol
  );
  const rawSubtotalFormatted = formatCurrency(
    moneyFromMajor(totalSubtotalMajor, currency),
    currencySymbol
  );

  return (
    <div
      id="floating-cart-bar"
      className="fixed bottom-18 sm:bottom-6 left-4 right-4 max-w-lg mx-auto z-40 animate-in slide-in-from-bottom-5 duration-200"
    >
      <button
        type="button"
        id="floating-view-basket-btn"
        onClick={onOpenCart}
        style={primaryBtnStyle}
        className="w-full py-2.5 sm:py-3 px-4 sm:px-5 rounded-2xl shadow-xl flex items-center justify-between font-bold text-sm active:scale-[0.98] transition-all hover:brightness-105 cursor-pointer"
      >
        <div className="flex items-center gap-2.5 sm:gap-3 text-left">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <ShoppingBag className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs sm:text-sm font-extrabold leading-tight">
              View Basket ({itemCount} {itemCount === 1 ? 'item' : 'items'})
            </span>
            <div className="text-[11px] sm:text-xs font-medium opacity-90 leading-tight mt-0.5 flex items-center gap-1.5 flex-wrap">
              <span>
                Subtotal: <strong className="font-extrabold">{subtotalWithSavingsFormatted}</strong>
              </span>
              {totalSavingsMajor > 0 && (
                <>
                  <span className="line-through opacity-75 text-[10px]">
                    {rawSubtotalFormatted}
                  </span>
                  <span className="px-1.5 py-0.5 rounded-md bg-white/20 text-white font-black text-[10px] tracking-wide border border-white/30">
                    Saved £{totalSavingsMajor.toFixed(2)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 text-right shrink-0">
          <div className="flex flex-col items-end">
            <span className="text-[10px] sm:text-[11px] font-semibold opacity-90 uppercase tracking-wider leading-none">
              Total
            </span>
            <span className="text-sm sm:text-base font-black leading-tight text-white mt-0.5">
              {actualBasketTotalFormatted}
            </span>
          </div>
          <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center shrink-0 ml-1">
            <ArrowRight className="w-4 h-4 stroke-[2.5]" />
          </div>
        </div>
      </button>
    </div>
  );
};
