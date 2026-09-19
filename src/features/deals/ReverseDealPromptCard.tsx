import React, { useState } from 'react';
import { BadgePercent, Plus, Check, ShieldCheck, AlertCircle, ArrowRight } from 'lucide-react';
import { Product } from '../../commerce/models';
import { DeliverectDeal } from '../../commerce/dealModels';
import { ReverseDealPrompt } from '../../commerce/reverseDealEngine';
import { ProductImage } from '../../components/media/Media';
import { formatCurrency } from '../../utils/formatters';

interface ReverseDealPromptCardProps {
  prompt: ReverseDealPrompt;
  onAddMissingItem?: (product: Product) => Promise<void> | void;
  onOpenDealPopup?: (deal: DeliverectDeal) => void;
  currencySymbol?: string;
  variant?: 'checkout' | 'basket';
}

export const ReverseDealPromptCard: React.FC<ReverseDealPromptCardProps> = ({
  prompt,
  onAddMissingItem,
  onOpenDealPopup,
  currencySymbol = '£',
  variant = 'checkout',
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [isAdded, setIsAdded] = useState(false);

  const {
    deal,
    missingProduct,
    missingSlotName,
    presentItems,
    dealPrice,
    totalSavings,
    incrementalCost,
    regularMissingPrice,
  } = prompt;

  const handleAction = async () => {
    if (onOpenDealPopup) {
      onOpenDealPopup(deal);
      return;
    }
    if (!onAddMissingItem || isAdding || isAdded) return;
    setIsAdding(true);
    try {
      await onAddMissingItem(missingProduct);
      setIsAdded(true);
    } catch (err) {
      console.error('Failed to add missing meal deal item', err);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div
      className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
        variant === 'checkout'
          ? 'bg-gradient-to-br from-amber-50/90 via-orange-50/40 to-emerald-50/60 border-amber-300 shadow-sm p-4 my-3'
          : 'bg-gradient-to-br from-amber-50/80 via-white to-emerald-50/50 border-amber-200 p-3.5 my-2.5'
      }`}
    >
      {/* Deal Header */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <BadgePercent className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-900">
                Combo Deal Opportunity
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black tracking-tight">
                Save {currencySymbol}{totalSavings.toFixed(2)}
              </span>
            </div>
            <h4 className="text-xs font-extrabold text-gray-900 leading-tight">
              Complete the {deal.title}
            </h4>
          </div>
        </div>

        <div className="text-right shrink-0">
          <span className="text-[10px] text-gray-500 block">Bundle Price</span>
          <span className="text-xs font-black text-emerald-700">
            {currencySymbol}{dealPrice.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Progress tracker: 2 of 3 in basket */}
      <div className="mb-3 bg-white/80 rounded-xl p-2.5 border border-amber-100">
        <div className="flex items-center justify-between text-[11px] font-bold text-gray-700 mb-1.5">
          <span>You have 2 of 3 items in your basket:</span>
          <span className="text-amber-800 font-extrabold">2/3 items ready</span>
        </div>

        <div className="grid grid-cols-3 gap-1.5 mb-2">
          {presentItems.map((item, idx) => (
            <div
              key={item.plu || idx}
              className="flex items-center gap-1.5 p-1.5 rounded-lg bg-emerald-50/80 border border-emerald-200/60"
            >
              <Check className="w-3 h-3 text-emerald-600 shrink-0" />
              <span className="text-[10px] font-bold text-emerald-950 truncate" title={item.name}>
                {item.name}
              </span>
            </div>
          ))}

          {/* Missing Item Slot */}
          <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-amber-100/70 border border-dashed border-amber-400">
            <Plus className="w-3 h-3 text-amber-700 shrink-0 animate-pulse" />
            <span className="text-[10px] font-extrabold text-amber-900 truncate">
              + {missingSlotName || '3rd Item'}
            </span>
          </div>
        </div>

        {/* Missing Item Showcase & Action */}
        <div className="flex items-center gap-2.5 pt-1.5 border-t border-gray-100">
          <div className="w-11 h-11 rounded-lg overflow-hidden bg-white border border-gray-200 shrink-0 shadow-2xs">
            <ProductImage
              src={missingProduct.imageUrl}
              alt={missingProduct.name}
              productName={missingProduct.name}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wide">
                Suggested 3rd Item
              </span>
            </div>
            <p className="text-xs font-bold text-gray-900 truncate" title={missingProduct.name}>
              {missingProduct.name}
            </p>
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="line-through text-gray-400">
                {currencySymbol}{regularMissingPrice.toFixed(2)}
              </span>
              <span className="font-extrabold text-emerald-700">
                Only +{currencySymbol}{incrementalCost.toFixed(2)} to unlock deal!
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAction}
            disabled={isAdding || isAdded}
            className={`px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 shadow-xs shrink-0 cursor-pointer ${
              isAdded
                ? 'bg-emerald-600 text-white cursor-default'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
          >
            {isAdding ? (
              <span className="inline-block animate-spin">⟳</span>
            ) : isAdded ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Deal Applied!</span>
              </>
            ) : onOpenDealPopup ? (
              <>
                <span>Choose 3rd Item</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                <span>Add 3rd Item</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Compliance Guarantee Footer */}
      <div className="flex items-center justify-between text-[10px] text-gray-500 pt-1">
        <div className="flex items-center gap-1 text-emerald-800 font-medium">
          <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
          <span>UK Food Promotion & Placement Compliant (Non-HFSS)</span>
        </div>
        <span className="text-gray-400">Automatic bundle recalculation</span>
      </div>
    </div>
  );
};
