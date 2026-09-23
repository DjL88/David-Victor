import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  ShoppingBag,
  CheckCircle2,
  Plus,
  Minus,
  Package,
  Layers,
  Sparkles,
} from 'lucide-react';
import { CategoryPromoBanner, Product, moneyToMinor } from '../../commerce/models';
import { useTenantStyles } from '../../tenant/useTenant';
import { useTenant } from '../../tenant/TenantContext';
import { formatStorefrontCurrency } from '../../utils/formatters';

interface PromoShoppingListDialogProps {
  banner: CategoryPromoBanner | null;
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  selectedStoreName?: string;
  onAddAllToBasket: (plus: string[], title?: string) => void;
  onSelectProduct?: (product: Product) => void;
  getBasketQuantity?: (plu: string) => number;
  onUpdateQuantity?: (product: Product, quantity: number) => void;
}

export const PromoShoppingListDialog: React.FC<PromoShoppingListDialogProps> = ({
  banner,
  isOpen,
  onClose,
  products,
  selectedStoreName,
  onAddAllToBasket,
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

  if (!isOpen || !banner) return null;

  const linkedPlus = banner.linkedProductPlus || (banner.targetPlu ? [banner.targetPlu] : []);

  // Filter linked products based on availability and stock match mode:
  // OR mode: Hide unavailable linked products from the shopping list modal
  // AND mode: All linked products must be available (otherwise banner wouldn't be shown)
  const availableProducts = linkedPlus
    .map((plu) => products.find((p) => p.plu === plu))
    .filter((p): p is Product => {
      if (!p) return false;
      const inStock = p.stockStatus === 'IN_STOCK' || (p.stockQuantity !== undefined && p.stockQuantity > 0);
      return inStock && p.active !== false;
    });

  // Calculate sum of real prices for available items in minor units
  const totalMinor = availableProducts.reduce((sum, p) => sum + moneyToMinor(p.price), 0);

  const handleAddAll = () => {
    const plusToAdd = availableProducts.map((p) => p.plu);
    if (plusToAdd.length > 0) {
      onAddAllToBasket(plusToAdd, banner.title);
    }
    onClose();
  };

  return (
    <AnimatePresence>
      <div
        id="promo-shopping-list-dialog-backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto overflow-x-hidden"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="promo-shopping-list-dialog-title"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* HEADER BANNER */}
          <div className="relative h-44 sm:h-52 w-full overflow-hidden bg-gray-950 shrink-0">
            {banner.backgroundImageUrl && (
              <img
                src={banner.backgroundImageUrl}
                alt={banner.title}
                className="w-full h-full object-cover opacity-85"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/40 to-transparent" />

            {/* CLOSE BUTTON */}
            <button
              type="button"
              id="close-promo-shopping-list-btn"
              onClick={onClose}
              className="absolute right-3.5 top-3.5 z-20 w-8 h-8 rounded-full bg-black/50 text-white hover:bg-black/70 flex items-center justify-center backdrop-blur-xs transition-colors cursor-pointer"
              aria-label="Close shopping list"
            >
              <X className="w-4 h-4" />
            </button>

            {/* BADGES */}
            <div className="absolute top-3.5 left-3.5 z-10 flex flex-wrap items-center gap-1.5">
              {banner.badge && (
                <span
                  style={primaryBtnStyle}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-white text-[11px] font-extrabold tracking-wide shadow-xs"
                >
                  <Sparkles className="w-3 h-3" />
                  {banner.badge}
                </span>
              )}
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-black/50 backdrop-blur-md text-white/90 text-[10px] font-semibold border border-white/20">
                <Layers className="w-3 h-3 text-emerald-300" />
                Featured Collection
              </span>
            </div>

            {/* TITLE OVERLAY */}
            <div className="absolute bottom-3 left-4 right-4 z-10 text-white">
              <h2
                id="promo-shopping-list-dialog-title"
                className="text-lg sm:text-xl font-extrabold tracking-tight drop-shadow-md leading-tight"
              >
                {banner.title}
              </h2>
              {banner.subtitle && (
                <p className="text-xs text-gray-200/90 font-medium mt-0.5 drop-shadow-xs line-clamp-2">
                  {banner.subtitle}
                </p>
              )}
            </div>
          </div>

          {/* BODY */}
          <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
            {/* ITEM COUNT & STORE VERIFICATION */}
            <div className="flex items-center justify-between text-xs font-bold text-gray-800 px-1">
              <span>
                Available Products ({availableProducts.length})
              </span>
              {selectedStoreName && (
                <span className="text-[11px] text-gray-600 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  In stock at {selectedStoreName}
                </span>
              )}
            </div>

            {/* PRODUCT LIST */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {availableProducts.map((product) => {
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

                    {/* Quantity Controls */}
                    <div className="shrink-0 flex items-center gap-1">
                      {onUpdateQuantity && (
                        <>
                          {qty > 0 ? (
                            <div className="flex items-center gap-1.5 bg-emerald-50 p-1 rounded-xl border border-emerald-200">
                              <button
                                type="button"
                                onClick={() => onUpdateQuantity(product, qty - 1)}
                                className="w-6 h-6 rounded-lg bg-white text-emerald-800 hover:bg-emerald-100 flex items-center justify-center transition-colors cursor-pointer"
                                aria-label="Decrease quantity"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="text-xs font-black text-emerald-950 min-w-[16px] text-center">
                                {qty}
                              </span>
                              <button
                                type="button"
                                onClick={() => onUpdateQuantity(product, qty + 1)}
                                className="w-6 h-6 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 flex items-center justify-center transition-colors cursor-pointer"
                                aria-label="Increase quantity"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onUpdateQuantity(product, 1)}
                              className="px-2.5 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Add</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* FOOTER */}
          <div className="p-3.5 sm:p-4 bg-gray-50 border-t border-gray-100 flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              id="promo-dialog-add-all-btn"
              onClick={handleAddAll}
              disabled={availableProducts.length === 0}
              style={primaryBtnStyle}
              className="w-full py-3 px-4 rounded-2xl hover:brightness-105 active:scale-[0.98] text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>
                Add All ({availableProducts.length}) • {formatStorefrontCurrency(totalMinor, tenant)}
              </span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
