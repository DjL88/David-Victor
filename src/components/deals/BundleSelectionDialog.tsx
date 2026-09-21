import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Plus,
  Minus,
  CheckCircle2,
  AlertCircle,
  ShoppingBag,
  Info,
  Clock,
  Package,
} from 'lucide-react';
import {
  BundleProduct,
  BundleModifierGroup,
  BundleModifier,
  SelectedBundleModifier,
  calculateBundlePrice,
  validateBundleSelection,
  evaluateBundleStockStatus,
} from '../../commerce/bundleModels';
import { formatMoney } from '../../utils/formatters';
import { useTenantStyles } from '../../tenant/useTenant';

interface BundleSelectionDialogProps {
  bundle: BundleProduct | null;
  isOpen: boolean;
  onClose: () => void;
  selectedStoreName?: string;
  onAddBundleToBasket: (
    bundle: BundleProduct,
    selectedModifiers: SelectedBundleModifier[],
    quantity?: number
  ) => void;
}

export const BundleSelectionDialog: React.FC<BundleSelectionDialogProps> = ({
  bundle,
  isOpen,
  onClose,
  selectedStoreName,
  onAddBundleToBasket,
}) => {
  const { primaryBtnStyle } = useTenantStyles();

  // Map of modifierId -> quantity selected
  const [selections, setSelections] = useState<Record<string, number>>({});
  const [bundleQuantity, setBundleQuantity] = useState<number>(1);

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

  // Pre-select auto-applied / default modifiers when bundle opens or changes
  useEffect(() => {
    if (bundle && isOpen) {
      const initialSelections: Record<string, number> = {};
      const sections = bundle.sections || bundle.modifierGroups || [];
      for (const group of sections) {
        let hasSelectionInGroup = false;
        for (const mod of group.modifiers) {
          if (
            (mod.isAutoApplied || (mod as any).defaultSelected || (mod as any).isDefault || (mod as any).default) &&
            !mod.snoozed &&
            mod.active !== false
          ) {
            initialSelections[mod.id] = 1;
            hasSelectionInGroup = true;
          }
        }
        // If a required section (min >= 1) has no explicit auto-applied flag, pre-select first active option
        if (!hasSelectionInGroup && group.min >= 1 && group.modifiers.length > 0) {
          const firstValid = group.modifiers.find((m) => !m.snoozed && m.active !== false);
          if (firstValid) {
            initialSelections[firstValid.id] = 1;
          }
        }
      }
      setSelections(initialSelections);
      setBundleQuantity(1);
    }
  }, [bundle, isOpen]);

  // Normalize groups
  const groups: BundleModifierGroup[] = useMemo(() => {
    if (!bundle) return [];
    return bundle.sections || bundle.modifierGroups || [];
  }, [bundle]);

  // Evaluate stock status dynamically
  const stockEvaluation = useMemo(() => {
    if (!bundle) return { stockStatus: 'IN_STOCK' as const };
    return evaluateBundleStockStatus(groups);
  }, [bundle, groups]);

  const isBundleOutOfStock = stockEvaluation.stockStatus === 'OUT_OF_STOCK';

  const hasPricedUpsells = useMemo(() => {
    return groups.some((group) =>
      group.modifiers?.some((m) => (m.price || m.priceMinor || 0) > 0)
    );
  }, [groups]);

  // Convert selections map into SelectedBundleModifier[]
  const selectedModifiersList: SelectedBundleModifier[] = useMemo(() => {
    if (!bundle) return [];
    const list: SelectedBundleModifier[] = [];

    for (const group of groups) {
      for (const mod of group.modifiers) {
        const qty = selections[mod.id] || 0;
        if (qty > 0) {
          list.push({
            modifierId: mod.id,
            plu: mod.plu,
            name: mod.name,
            price: mod.price,
            priceMinor: mod.price,
            quantity: qty,
            sectionId: group.id,
            sectionName: group.name,
          });
        }
      }
    }
    return list;
  }, [bundle, groups, selections]);

  // Validation
  const validation = useMemo(() => {
    if (!bundle) return { valid: false, errors: [] };
    return validateBundleSelection(bundle, selectedModifiersList);
  }, [bundle, selectedModifiersList]);

  // Total bundle price (base + uplifts)
  const bundlePriceMinor = useMemo(() => {
    if (!bundle) return 0;
    return calculateBundlePrice(bundle, selectedModifiersList).totalPriceMinor;
  }, [bundle, selectedModifiersList]);

  const currency = bundle?.currency || 'GBP';
  const totalPriceMinor = bundlePriceMinor * bundleQuantity;

  if (!isOpen || !bundle) return null;

  // Selection handlers
  const handleModifierIncrement = (group: BundleModifierGroup, mod: BundleModifier) => {
    if (mod.snoozed || mod.active === false || isBundleOutOfStock) return;

    const currentGroupQty = group.modifiers.reduce(
      (sum, m) => sum + (selections[m.id] || 0),
      0
    );
    const currentModQty = selections[mod.id] || 0;
    const groupMax = group.max;
    const modMax = mod.multiMax ?? 1;

    // Check group max limit
    if (groupMax > 0 && currentGroupQty >= groupMax) return;
    // Check modifier multiMax limit
    if (currentModQty >= modMax) return;

    setSelections((prev) => ({
      ...prev,
      [mod.id]: (prev[mod.id] || 0) + 1,
    }));
  };

  const handleModifierDecrement = (mod: BundleModifier) => {
    setSelections((prev) => {
      const current = prev[mod.id] || 0;
      if (current <= 1) {
        const next = { ...prev };
        delete next[mod.id];
        return next;
      }
      return {
        ...prev,
        [mod.id]: current - 1,
      };
    });
  };

  const handleConfirmAdd = () => {
    if (!validation.valid || isBundleOutOfStock) return;
    onAddBundleToBasket(bundle, selectedModifiersList, bundleQuantity);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.98 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="bg-white w-full max-w-2xl max-h-[92vh] sm:max-h-[88vh] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden text-neutral-900 border border-neutral-100"
          id="bundle-selection-dialog"
        >
          {/* Header */}
          <div className="relative px-6 py-5 border-b border-neutral-100 bg-neutral-50/70 flex items-start justify-between">
            <div className="pr-8">
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Combo Deal
                </span>
                {isBundleOutOfStock && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800">
                    <Clock className="w-3.5 h-3.5" />
                    Currently Unavailable
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold tracking-tight text-neutral-950">{bundle.name}</h2>
              {bundle.description && (
                <p className="text-sm text-neutral-600 mt-0.5 line-clamp-2">{bundle.description}</p>
              )}
              <div className="mt-2 flex items-center gap-2">
                <span className="text-base font-bold text-neutral-900">
                  {bundle.price != null
                    ? `${hasPricedUpsells ? 'From ' : ''}${formatMoney(bundle.price, currency)}`
                    : 'Price unavailable'}
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-full text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/60 transition-colors focus:outline-none"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Out of stock warning banner */}
          {isBundleOutOfStock && (
            <div className="bg-rose-50 border-b border-rose-100 px-6 py-3 flex items-start gap-3 text-rose-900 text-sm">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Cannot order this meal deal: </span>
                {stockEvaluation.outOfStockReason ||
                  'One or more required components are currently out of stock or snoozed.'}
              </div>
            </div>
          )}

          {/* Modifier Groups / Sections */}
          <div className="flex-1 overflow-y-auto p-6 space-y-7 divide-y divide-neutral-100">
            {groups.map((group, groupIdx) => {
              const isRequired = group.min > 0;
              const isOptionalUpsell = group.isUpsell || group.min === 0;

              // Hide optional upsell section if all modifiers in it are out of stock / snoozed
              const isAllModifiersOutOfStock =
                group.modifiers.length > 0 &&
                group.modifiers.every((m) => m.snoozed || m.active === false);

              if (isOptionalUpsell && isAllModifiersOutOfStock) {
                return null;
              }

              const currentGroupCount = group.modifiers.reduce(
                (sum, m) => sum + (selections[m.id] || 0),
                0
              );
              const isComplete =
                isRequired && currentGroupCount >= group.min && currentGroupCount <= group.max;

              return (
                <div key={group.id} className={groupIdx > 0 ? 'pt-6' : ''}>
                  {/* Group Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-neutral-900">{group.name}</h3>
                        {isRequired ? (
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              isComplete
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {isComplete ? 'Complete' : 'Required'}
                          </span>
                        ) : (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600">
                            Optional Add-on
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {isRequired
                          ? group.min === group.max
                            ? `Select exactly ${group.min} ${group.min === 1 ? 'item' : 'items'}`
                            : `Select between ${group.min} and ${group.max} items`
                          : `Select up to ${group.max} optional items`}
                      </p>
                    </div>

                    {/* Progress Indicator */}
                    <div className="text-right">
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-md inline-flex items-center gap-1.5 ${
                          isComplete
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-neutral-100 text-neutral-600'
                        }`}
                      >
                        {isComplete && <CheckCircle2 className="w-3.5 h-3.5" />}
                        {currentGroupCount} of {group.max} selected
                      </span>
                    </div>
                  </div>

                  {/* Modifiers List */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {group.modifiers.map((mod) => {
                      const qty = selections[mod.id] || 0;
                      const isSnoozed = mod.snoozed || mod.active === false;
                      const hasUplift = (mod.price || 0) > 0;
                      const canIncrement =
                        !isSnoozed &&
                        !isBundleOutOfStock &&
                        currentGroupCount < group.max &&
                        qty < (mod.multiMax ?? 1);

                      return (
                        <div
                          key={mod.id}
                          className={`relative border rounded-xl p-3.5 transition-all flex flex-col justify-between ${
                            qty > 0
                              ? 'border-neutral-900 bg-neutral-50/70 ring-1 ring-neutral-900'
                              : isSnoozed
                              ? 'border-neutral-200 bg-neutral-50/50 opacity-60'
                              : 'border-neutral-200 bg-white hover:border-neutral-300'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2.5">
                            {/* Product thumbnail image */}
                            {mod.imageUrl ? (
                              <img
                                src={mod.imageUrl}
                                alt={mod.name}
                                referrerPolicy="no-referrer"
                                className="w-12 h-12 rounded-lg object-cover bg-neutral-100 shrink-0 border border-neutral-200/70"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0 border border-neutral-200/60 text-neutral-400">
                                <Package className="w-5 h-5 text-neutral-400" />
                              </div>
                            )}

                            <div className="flex-1 min-w-0">
                              <span className="font-semibold text-sm text-neutral-900 block truncate">
                                {mod.name}
                              </span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {hasUplift && (
                                  <span className="text-xs font-semibold text-neutral-800 bg-neutral-100 px-1.5 py-0.5 rounded">
                                    +{formatMoney(mod.price, currency)}
                                  </span>
                                )}
                                {mod.calories && (
                                  <span className="text-xs text-neutral-400">
                                    {mod.calories} kcal
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Quantity Controls or Selector */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              {isSnoozed ? (
                                <span className="text-[11px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                                  Out of Stock
                                </span>
                              ) : qty > 0 ? (
                                <div className="flex items-center gap-1 bg-white border border-neutral-300 rounded-lg p-0.5 shadow-sm">
                                  <button
                                    type="button"
                                    onClick={() => handleModifierDecrement(mod)}
                                    className="p-1 hover:bg-neutral-100 rounded text-neutral-600 focus:outline-none"
                                    aria-label={`Remove one ${mod.name}`}
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                  <span className="w-5 text-center text-xs font-bold text-neutral-900">
                                    {qty}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleModifierIncrement(group, mod)}
                                    disabled={!canIncrement}
                                    className={`p-1 rounded focus:outline-none ${
                                      canIncrement
                                        ? 'hover:bg-neutral-100 text-neutral-900'
                                        : 'text-neutral-300 cursor-not-allowed'
                                    }`}
                                    aria-label={`Add one more ${mod.name}`}
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleModifierIncrement(group, mod)}
                                  disabled={!canIncrement}
                                  className={`px-3 py-1 text-xs font-medium rounded-lg border transition-colors ${
                                    canIncrement
                                      ? 'border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-800'
                                      : 'border-neutral-200 bg-neutral-100 text-neutral-400 cursor-not-allowed'
                                  }`}
                                >
                                  Select
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer with validation status & Add to Basket button */}
          <div className="px-6 py-4 border-t border-neutral-100 bg-neutral-50/80 flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Left side: validation guidance & bundle quantity */}
            <div className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-4">
              <div className="flex items-center gap-1.5 border border-neutral-200 bg-white rounded-xl p-1 shadow-sm">
                <button
                  type="button"
                  onClick={() => setBundleQuantity((q) => Math.max(1, q - 1))}
                  disabled={bundleQuantity <= 1 || isBundleOutOfStock}
                  className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-600 disabled:opacity-40 focus:outline-none"
                  aria-label="Decrease deal quantity"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-6 text-center text-sm font-bold text-neutral-900">
                  {bundleQuantity}
                </span>
                <button
                  type="button"
                  onClick={() => setBundleQuantity((q) => q + 1)}
                  disabled={isBundleOutOfStock}
                  className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-900 disabled:opacity-40 focus:outline-none"
                  aria-label="Increase deal quantity"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {!validation.valid && (
                <div className="flex items-center gap-1.5 text-xs text-amber-800 font-medium">
                  <Info className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{validation.errors[0] || 'Please complete all required sections'}</span>
                </div>
              )}
            </div>

            {/* Right side: Add to basket button */}
            <button
              type="button"
              onClick={handleConfirmAdd}
              disabled={!validation.valid || isBundleOutOfStock}
              style={validation.valid && !isBundleOutOfStock ? primaryBtnStyle : undefined}
              className={`w-full sm:w-auto min-w-[200px] py-3 px-6 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-sm ${
                validation.valid && !isBundleOutOfStock
                  ? 'text-white hover:opacity-95 active:scale-[0.99]'
                  : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>
                {isBundleOutOfStock
                  ? 'Currently Unavailable'
                  : !selectedStoreName
                  ? 'Select Store for Price'
                  : `Add to Basket • ${formatMoney(totalPriceMinor, currency)}`}
              </span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
