import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  ShoppingBag,
  CheckCircle2,
  Filter,
  Layers,
  Info,
  BadgePercent,
  Plus,
  Package,
} from 'lucide-react';
import { DeliverectDeal, getProductsForDeal } from '../../commerce/dealModels';
import { Product, Store, moneyToMinor } from '../../commerce/models';
import { useTenantStyles } from '../../tenant/useTenant';
import { useTenant } from '../../tenant/TenantContext';
import { formatStorefrontCurrency } from '../../utils/formatters';

interface MealDealDialogProps {
  deal: DeliverectDeal | null;
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  selectedStore?: Store | null;
  onAddAllToBasket: (plus: string[], dealTitle?: string) => void;
  onFilterByDeal: (deal: DeliverectDeal) => void;
  onSelectProduct?: (product: Product) => void;
  getBasketQuantity?: (plu: string) => number;
  onUpdateQuantity?: (product: Product, quantity: number) => void;
}

export const MealDealDialog: React.FC<MealDealDialogProps> = ({
  deal,
  isOpen,
  onClose,
  products,
  selectedStore,
  onAddAllToBasket,
  onFilterByDeal,
  onSelectProduct,
  getBasketQuantity,
  onUpdateQuantity,
}) => {
  const { primaryBtnStyle } = useTenantStyles();
  const { tenant } = useTenant();

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !deal) return null;

  const dealProducts = getProductsForDeal(deal, products);
  const isAndMode = deal.stockMatchMode === 'AND';

  // Calculate regular sum of items in integer minor units
  const itemizedTotalMinor = dealProducts.reduce((sum, p) => {
    return sum + moneyToMinor(p.price);
  }, 0);

  const dealPriceMinor = moneyToMinor(deal.dealPrice);
  const rawSavingsMinor =
    deal.savings > 0 ? moneyToMinor(deal.savings) : Math.max(0, itemizedTotalMinor - dealPriceMinor);

  const handleAddAll = () => {
    onAddAllToBasket(deal.linkedProductPlus, deal.title);
    onClose();
  };

  const handleFilterCatalog = () => {
    onFilterByDeal(deal);
    onClose();
  };

  return (
    <AnimatePresence>
      <div
        id="meal-deal-dialog-backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto overflow-x-hidden"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="meal-deal-dialog-title"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* TOP BANNER WITH IMAGE & BADGES */}
          <div className="relative h-44 sm:h-52 w-full overflow-hidden bg-gray-950 shrink-0">
            {deal.imageUrl && (
              <img
                src={deal.imageUrl}
                alt={deal.title}
                className="w-full h-full object-cover opacity-85"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/40 to-transparent" />

            {/* CLOSE BUTTON */}
            <button
              type="button"
              id="close-deal-dialog-btn"
              onClick={onClose}
              className="absolute right-3.5 top-3.5 z-20 w-8 h-8 rounded-full bg-black/50 text-white hover:bg-black/70 flex items-center justify-center backdrop-blur-xs transition-colors cursor-pointer"
              aria-label="Close deal dialog"
            >
              <X className="w-4 h-4" />
            </button>

            {/* BADGES */}
            <div className="absolute top-3.5 left-3.5 z-10 flex flex-wrap items-center gap-1.5">
              <span
                style={primaryBtnStyle}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-white text-[11px] font-extrabold tracking-wide shadow-xs"
              >
                <BadgePercent className="w-3 h-3" />
                {deal.badge}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-black/50 backdrop-blur-md text-white/90 text-[10px] font-semibold border border-white/20">
                <Layers className="w-3 h-3 text-emerald-300" />
                {isAndMode ? 'Combo Deal' : 'Multi-Buy'}
              </span>
            </div>

            {/* TITLE OVERLAY */}
            <div className="absolute bottom-3 left-4 right-4 z-10 text-white">
              <h2
                id="meal-deal-dialog-title"
                className="text-lg sm:text-xl font-extrabold tracking-tight drop-shadow-md leading-tight"
              >
                {deal.title}
              </h2>
              {deal.subtitle && (
                <p className="text-xs text-gray-200/90 font-medium mt-0.5 drop-shadow-xs line-clamp-1">
                  {deal.subtitle}
                </p>
              )}
            </div>
          </div>

          {/* BODY: SCROLLABLE CONTENT */}
          <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
            {/* PRICING & SAVINGS SUMMARY CARD */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 border border-gray-200">
              <div>
                <span className="text-[11px] font-bold text-gray-600 uppercase tracking-wider block">
                  {isAndMode ? 'Combo Deal Price' : 'Multi-Buy Price'}
                </span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-2xl font-black text-gray-950 tracking-tight">
                    {formatStorefrontCurrency(deal.dealPrice, tenant)}
                  </span>
                  {(deal.originalPrice ?? 0) > (deal.dealPrice ?? 0) && (
                    <span className="text-sm font-semibold text-gray-400 line-through">
                      {formatStorefrontCurrency(deal.originalPrice, tenant)}
                    </span>
                  )}
                </div>
              </div>

              {rawSavingsMinor > 0 && (
                <div className="text-right">
                  <span
                    style={primaryBtnStyle}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-white text-xs font-black shadow-2xs"
                  >
                    <BadgePercent className="w-3.5 h-3.5" />
                    Save {formatStorefrontCurrency(rawSavingsMinor, tenant)}
                  </span>
                  <span className="text-[10px] text-gray-500 font-medium block mt-1">
                    Deliverect POS combo discount
                  </span>
                </div>
              )}
            </div>

            {/* DESCRIPTION */}
            {deal.description && (
              <div className="text-xs text-gray-600 leading-relaxed bg-gray-50 p-3 rounded-2xl border border-gray-100 space-y-1.5">
                <p className="font-medium text-gray-800">{deal.description}</p>
                <div className="flex items-center gap-1.5 text-[11px] text-gray-500 font-semibold pt-1 border-t border-gray-200/60">
                  <Info className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                  <span>
                    {isAndMode
                      ? `All ${dealProducts.length} items must be in stock to complete this combo.`
                      : 'Select any combination of qualifying items to trigger this discount.'}
                  </span>
                </div>
              </div>
            )}

            {/* LIST OF PARTICIPATING ITEMS (MATCHING BUNDLE SELECTION DIALOG CARDS) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-gray-800 px-1">
                <span>
                  {isAndMode
                    ? `Items in this Deal (${dealProducts.length})`
                    : `Participating Flavours & Options (${dealProducts.length})`}
                </span>
                {selectedStore?.name && (
                  <span className="text-[11px] text-gray-600 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Verified at {selectedStore.name}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {dealProducts.map((product) => {
                  if (!product) return null;
                  const qty = getBasketQuantity ? getBasketQuantity(product.plu) : 0;
                  const prodName = product.name || product.plu || 'Product';
                  const prodImg = product.imageUrl || product.image;

                  return (
                    <div
                      key={product.plu}
                      className={`relative flex items-center justify-between p-3 rounded-2xl border transition-all gap-3 bg-white ${
                        qty > 0
                          ? 'border-emerald-400/60 bg-emerald-50/20 shadow-xs'
                          : 'border-gray-200/80 hover:border-gray-300 hover:bg-gray-50/50'
                      }`}
                    >
                      {/* Product Image & Details */}
                      <div
                        className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                        onClick={() => {
                          onSelectProduct?.(product);
                          onClose();
                        }}
                      >
                        <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-gray-100 shrink-0 border border-gray-200/60 flex items-center justify-center">
                          {prodImg ? (
                            <img
                              src={prodImg}
                              alt={prodName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-gray-900 truncate hover:text-emerald-700 transition-colors">
                            {prodName}
                          </p>
                          {product.brand && (
                            <p className="text-[11px] text-gray-500 truncate font-medium">
                              {product.brand}
                            </p>
                          )}
                          <span className="text-xs font-bold text-gray-700">
                            {formatStorefrontCurrency(product.price, tenant)}
                          </span>
                        </div>
                      </div>

                      {/* Add / In Cart Action Button */}
                      <div className="shrink-0">
                        {onUpdateQuantity && (
                          <button
                            type="button"
                            onClick={() => onUpdateQuantity(product, qty + 1)}
                            style={qty > 0 ? primaryBtnStyle : undefined}
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                              qty > 0
                                ? 'text-white shadow-xs'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                            title="Add item to cart"
                          >
                            <Plus className="w-3 h-3" />
                            <span>{qty > 0 ? `Selected (${qty})` : 'Add'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* FOOTER ACTIONS */}
          <div className="p-3.5 sm:p-4 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row items-center gap-2.5 shrink-0">
            {/* Action 1: Add all items to basket */}
            <button
              type="button"
              id="dialog-add-all-to-basket-btn"
              onClick={handleAddAll}
              style={primaryBtnStyle}
              className="w-full sm:flex-1 py-3 px-4 rounded-2xl hover:brightness-105 active:scale-[0.98] text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>
                {isAndMode
                  ? `Add All ${dealProducts.length} Items • ${formatStorefrontCurrency(deal.dealPrice, tenant)}`
                  : `Add Deal Items • From ${formatStorefrontCurrency(deal.dealPrice, tenant)}`}
              </span>
            </button>

            {/* Action 2: Filter main catalog to this deal */}
            <button
              type="button"
              id="dialog-filter-catalog-btn"
              onClick={handleFilterCatalog}
              className="w-full sm:w-auto py-3 px-4 rounded-2xl bg-white hover:bg-gray-100 active:scale-[0.98] border border-gray-200 text-gray-800 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Filter className="w-3.5 h-3.5 text-gray-700" />
              <span>Filter Catalogue</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
