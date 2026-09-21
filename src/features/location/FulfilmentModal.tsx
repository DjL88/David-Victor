import React from 'react';
import { Address, EligibleStore } from '../../commerce/models';
import { useTenantStyles } from '../../tenant/useTenant';
import { Truck, ShoppingBag, MapPin, ChevronRight, X, Sparkles, CheckCircle2 } from 'lucide-react';

interface FulfilmentModalProps {
  isOpen: boolean;
  currentAddress: Address | null;
  deliveryStoresCount: number;
  collectionStoresCount: number;
  hasDeliveryCoverage: boolean;
  onSelectFulfillment: (type: 'delivery' | 'pickup') => void;
  onClose?: () => void;
  dismissible?: boolean;
}

export const FulfilmentModal: React.FC<FulfilmentModalProps> = ({
  isOpen,
  currentAddress,
  deliveryStoresCount,
  collectionStoresCount,
  hasDeliveryCoverage,
  onSelectFulfillment,
  onClose,
  dismissible = true,
}) => {
  const { primaryBtnStyle } = useTenantStyles();

  if (!isOpen) return null;

  return (
    <div
      id="fulfilment-modal-backdrop"
      className="fixed inset-0 z-55 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      onClick={dismissible ? onClose : undefined}
    >
      <div
        id="fulfilment-modal-card"
        className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">How would you like your order?</h2>
              <p className="text-xs text-gray-500">Choose delivery to your door or store collection</p>
            </div>
          </div>
          {dismissible && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Address pill */}
        {currentAddress && (
          <div className="mb-4 p-3 rounded-2xl bg-gray-50 border border-gray-100 flex items-center gap-2.5">
            <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="text-[10px] uppercase font-bold text-gray-400 block">Deliver to</span>
              <p className="text-xs font-bold text-gray-800 truncate">
                {currentAddress.line1}, {currentAddress.postalCode}
              </p>
            </div>
          </div>
        )}

        {/* Choices */}
        <div className="space-y-3">
          {/* Delivery Option */}
          <button
            type="button"
            id="fulfilment-option-delivery"
            onClick={() => onSelectFulfillment('delivery')}
            className={`w-full p-4 rounded-2xl border text-left flex items-center justify-between transition-all group cursor-pointer ${
              hasDeliveryCoverage
                ? 'border-emerald-200 hover:border-emerald-500 bg-white hover:bg-emerald-50/40 shadow-xs'
                : 'border-gray-200 bg-gray-50 opacity-75'
            }`}
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Truck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-900">Doorstep Delivery</span>
                  {hasDeliveryCoverage ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                      Available
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                      Limited Zone
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {hasDeliveryCoverage
                    ? `${deliveryStoresCount} nearby ${
                        deliveryStoresCount === 1 ? 'store delivers' : 'stores deliver'
                      } to your address`
                    : 'Collection available from nearby locations'}
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
          </button>

          {/* Collection Option */}
          <button
            type="button"
            id="fulfilment-option-pickup"
            onClick={() => onSelectFulfillment('pickup')}
            className="w-full p-4 rounded-2xl border border-blue-200 hover:border-blue-500 bg-white hover:bg-blue-50/40 shadow-xs text-left flex items-center justify-between transition-all group cursor-pointer"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-900">Click & Collect</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                    Free
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Pick up from {collectionStoresCount} local{' '}
                  {collectionStoresCount === 1 ? 'branch' : 'branches'}
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
          </button>
        </div>
      </div>
    </div>
  );
};
