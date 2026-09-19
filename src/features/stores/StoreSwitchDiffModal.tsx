import React from 'react';
import { useTenantStyles } from '../../tenant/useTenant';
import { formatCurrency } from '../../utils/formatters';
import { Money, moneyToMajor } from '../../commerce/models';
import {
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  X,
  Store,
  PackageCheck,
  PackageX,
  Sliders,
} from 'lucide-react';

interface StoreSwitchDiffModalProps {
  diff: {
    availableUnchanged?: Array<{ plu: string; name: string; quantity: number; price: Money | number }>;
    priceChanges: Array<{ plu: string; name?: string; oldPrice: Money | number; newPrice: Money | number }>;
    unavailableItems: Array<{ plu: string; name: string; reason?: string }>;
    quantityAdjusted: Array<{ plu: string; name?: string; requested: number; adjustedTo: number; reason?: string }>;
  } | null;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Customer confirmation modal for store switching with basket items.
 * Categorizes every line item into:
 * 1. Available unchanged
 * 2. Available but price changed
 * 3. Unavailable (out of stock / not carried / restricted)
 * 4. Quantity reduced due to local stock/restrictions
 *
 * NOTE: Never silently delete items; requires explicit customer confirmation.
 */
export const StoreSwitchDiffModal: React.FC<StoreSwitchDiffModalProps> = ({
  diff,
  onConfirm,
  onClose,
}) => {
  const { primaryBtnStyle, currencySymbol } = useTenantStyles();

  if (!diff) return null;

  const hasChanges =
    diff.priceChanges.length > 0 ||
    diff.unavailableItems.length > 0 ||
    diff.quantityAdjusted.length > 0 ||
    (diff.availableUnchanged && diff.availableUnchanged.length > 0);

  if (!hasChanges) return null;

  return (
    <div
      id="store-switch-diff-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="store-switch-title"
    >
      <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-150 border border-gray-100">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100">
          <div className="flex items-center gap-2.5 text-amber-600">
            <Store className="w-5 h-5" />
            <h2 id="store-switch-title" className="text-base font-extrabold text-gray-900">
              Store Switch Basket Review
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-gray-100 text-gray-400 hover:text-gray-700 flex items-center justify-center"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-gray-600 mb-4 leading-relaxed">
          Product ranges, local inventory, and pricing vary between store locations. Please review
          how switching to this new store impacts your basket:
        </p>

        <div className="space-y-3 max-h-72 overflow-y-auto pr-1 mb-5">
          {/* 1. Available Unchanged */}
          {diff.availableUnchanged && diff.availableUnchanged.length > 0 && (
            <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-100 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-emerald-900 mb-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Available Unchanged ({diff.availableUnchanged.length})</span>
              </div>
              <ul className="space-y-1 text-emerald-800">
                {diff.availableUnchanged.map((item, i) => (
                  <li key={i} className="flex justify-between items-center text-[11px]">
                    <span className="truncate pr-2">
                      {item?.name || item?.plu || 'Item'} × {item?.quantity || 1}
                    </span>
                    <span className="font-semibold">{formatCurrency(item.price, currencySymbol)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 2. Available but Price Changed */}
          {diff.priceChanges.length > 0 && (
            <div className="p-3 rounded-2xl bg-blue-50/70 border border-blue-100 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-blue-900 mb-1.5">
                <Sliders className="w-3.5 h-3.5 text-blue-600" />
                <span>Available but Price Changed ({diff.priceChanges.length})</span>
              </div>
              <div className="space-y-1.5 text-blue-900">
                {diff.priceChanges.map((change, i) => {
                  const isUp = moneyToMajor(change.newPrice) > moneyToMajor(change.oldPrice);
                  return (
                    <div key={i} className="flex items-center justify-between text-[11px]">
                      <span className="truncate pr-2">{change.name || `Item ${change.plu}`}</span>
                      <span className="font-bold flex items-center gap-1 shrink-0">
                        {isUp ? (
                          <TrendingUp className="w-3 h-3 text-red-500" />
                        ) : (
                          <TrendingDown className="w-3 h-3 text-emerald-500" />
                        )}
                        <span className="line-through text-gray-400 font-normal">
                          {formatCurrency(change.oldPrice, currencySymbol)}
                        </span>
                        <span>{formatCurrency(change.newPrice, currencySymbol)}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. Unavailable in Target Store */}
          {diff.unavailableItems.length > 0 && (
            <div className="p-3 rounded-2xl bg-red-50/70 border border-red-100 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-red-900 mb-1.5">
                <PackageX className="w-3.5 h-3.5 text-red-600" />
                <span>Unavailable in New Store ({diff.unavailableItems.length})</span>
              </div>
              <ul className="space-y-1 text-red-800">
                {diff.unavailableItems.map((item, i) => (
                  <li key={i} className="flex justify-between items-center text-[11px]">
                    <span className="truncate pr-2">{item?.name || item?.plu || 'Item'}</span>
                    <span className="text-[10px] text-red-600 font-semibold italic shrink-0">
                      {item?.reason || 'Out of stock'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 4. Quantity Reduced due to Stock or Limits */}
          {diff.quantityAdjusted.length > 0 && (
            <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-100 text-xs text-amber-900">
              <div className="flex items-center gap-1.5 font-bold text-amber-900 mb-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>Quantity Reduced ({diff.quantityAdjusted.length})</span>
              </div>
              <div className="space-y-1 text-amber-900">
                {diff.quantityAdjusted.map((adj, i) => (
                  <div key={i} className="flex justify-between items-center text-[11px]">
                    <span className="truncate pr-2">{adj.name || `Item ${adj.plu}`}</span>
                    <span className="font-semibold shrink-0">
                      {adj.requested} → {adj.adjustedTo}{' '}
                      <span className="text-[10px] text-amber-700 font-normal">
                        ({adj.reason || 'Stock limit'})
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <p className="text-[11px] text-gray-500 mb-5 leading-relaxed">
          * Confirming will update your basket with the adjusted quantities and prices for the new
          store.
        </p>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            id="store-switch-cancel-btn"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel Switch
          </button>
          <button
            type="button"
            id="store-switch-confirm-btn"
            onClick={onConfirm}
            style={primaryBtnStyle}
            className="px-5 py-2.5 rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-transform flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Confirm & Update Basket</span>
          </button>
        </div>
      </div>
    </div>
  );
};
