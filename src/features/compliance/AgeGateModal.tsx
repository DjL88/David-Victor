import React from 'react';
import { Product } from '../../commerce/models';
import { useTenantStyles } from '../../tenant/useTenant';
import { ShieldAlert, ShieldCheck, X, AlertTriangle } from 'lucide-react';

interface AgeGateModalProps {
  isOpen: boolean;
  product: Product | null;
  minimumAge: number;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Advisory Age-Gate Modal.
 *
 * NOTE: The UI is advisory only. The Backend-for-Frontend (BFF)
 * and Deliverect Commerce API enforce identical age verification rules
 * independently during order authorization and courier dispatch.
 */
export const AgeGateModal: React.FC<AgeGateModalProps> = ({
  isOpen,
  product,
  minimumAge,
  onConfirm,
  onCancel,
}) => {
  const { primaryBtnStyle } = useTenantStyles();

  if (!isOpen || !product) return null;

  return (
    <div
      id="age-gate-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-gate-title"
    >
      <div
        id="age-gate-modal-card"
        className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-150 border border-gray-100 relative"
      >
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 text-gray-400 hover:text-gray-700 flex items-center justify-center transition-colors"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Warning Icon Badge */}
        <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>

        {/* Header */}
        <h2 id="age-gate-title" className="text-xl font-black text-gray-900 mb-1 leading-snug">
          Age Verification Required
        </h2>

        <p className="text-sm font-semibold text-purple-900 mb-2">
          Must be {minimumAge} or older to purchase this item
        </p>

        {/* Product Information Snippet */}
        <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-100 flex items-center gap-3 mb-4">
          {product?.imageUrl && (
            <img
              src={product.imageUrl}
              alt={product?.name || 'Restricted Product'}
              className="w-12 h-12 rounded-xl object-cover bg-white shrink-0 border border-gray-100"
            />
          )}
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-bold text-gray-900 truncate">{product?.name || 'Restricted Item'}</h4>
            <span className="text-[11px] font-semibold text-purple-700 block">
              {minimumAge}+ Restricted Product
            </span>
          </div>
        </div>

        {/* Courier Challenge 25 Notice */}
        <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200/70 text-xs text-amber-900 space-y-1 mb-5">
          <div className="flex items-center gap-1.5 font-bold">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>Courier Delivery Verification (Challenge 25)</span>
          </div>
          <p className="text-[11px] text-amber-800 leading-relaxed">
            Our courier will verify a valid government photo ID (passport, driving licence, PASS card)
            upon delivery if you appear under 25.
          </p>
        </div>

        {/* Backend Regulatory Disclaimer */}
        <p className="text-[10px] text-gray-400 mb-6 leading-relaxed">
          * Notice: This advisory gate records your age acknowledgment for this session. The Deliverect
          Commerce backend independently enforces legal restrictions on order dispatch.
        </p>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            id="age-gate-cancel-btn"
            onClick={onCancel}
            className="flex-1 py-3 rounded-2xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            I am under {minimumAge}
          </button>
          <button
            type="button"
            id="age-gate-confirm-btn"
            onClick={onConfirm}
            style={primaryBtnStyle}
            className="flex-1 py-3 rounded-2xl text-xs font-bold shadow-md active:scale-95 transition-transform flex items-center justify-center gap-1.5"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>I am {minimumAge} or older</span>
          </button>
        </div>
      </div>
    </div>
  );
};
