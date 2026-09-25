import React from 'react';
import type { Order } from '../commerce/models';
import { useTenantStyles } from '../tenant/useTenant';
import { useI18n } from '../i18n/I18nContext';
import { ArrowRight, Clock3, PackageCheck, ShoppingBag, Truck } from 'lucide-react';
import {
  getOrderEtaText,
  getOrderTrackerStage,
  getTrackerStageIndex,
  getTrackerStepLabels,
} from '../features/orders/orderTrackingPresentation';

interface ActiveOrderBarProps {
  order: Order;
  onOpenTracking: () => void;
}

export const ActiveOrderBar: React.FC<ActiveOrderBarProps> = ({ order, onOpenTracking }) => {
  const { primaryBtnStyle } = useTenantStyles();
  const { t } = useI18n();
  const stageIndex = getTrackerStageIndex(order);
  const labels = getTrackerStepLabels(order);
  const eta = getOrderEtaText(order);
  const stage = getOrderTrackerStage(order.status);
  const isPickup = order.fulfillment.type === 'pickup';

  const statusText =
    stage === 'PICKING'
      ? t('order.statusPicking')
      : stage === 'READY'
      ? isPickup
        ? t('order.statusReadyCollection')
        : t('order.statusReadyCourier')
      : stage === 'FULFILLING'
      ? t('order.statusOutForDelivery')
      : stage === 'COMPLETE'
      ? t('order.statusDelivered')
      : t('order.statusAccepted');

  return (
    <div
      id="active-order-bar"
      className="fixed bottom-18 left-4 right-4 z-40 mx-auto max-w-lg animate-in slide-in-from-bottom-5 duration-200 sm:bottom-6"
    >
      <button
        type="button"
        onClick={onOpenTracking}
        style={primaryBtnStyle}
        className="w-full rounded-2xl px-4 py-3 text-left shadow-xl transition-all hover:brightness-105 active:scale-[0.99]"
        aria-label={`Track order ${order.displayId || order.id}`}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
            {stage === 'PICKING' ? (
              <ShoppingBag className="h-5 w-5" />
            ) : stage === 'FULFILLING' ? (
              <Truck className="h-5 w-5" />
            ) : stage === 'READY' ? (
              <PackageCheck className="h-5 w-5" />
            ) : (
              <Clock3 className="h-5 w-5" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-extrabold sm:text-sm">
                  {statusText}
                  {eta ? <span className="font-semibold opacity-90"> · {eta}</span> : null}
                </p>
                <p className="mt-0.5 truncate text-[11px] font-medium opacity-85">
                  {order.storeName} · {order.displayId}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1 text-xs font-extrabold">
                <span>Track</span>
                <ArrowRight className="h-4 w-4" />
              </div>
            </div>

            <div className="mt-2 flex items-center gap-1.5" aria-hidden="true">
              {labels.map((label, index) => (
                <React.Fragment key={label}>
                  <span
                    className={`h-1.5 flex-1 rounded-full ${index <= stageIndex ? 'bg-white' : 'bg-white/30'}`}
                  />
                  {index < labels.length - 1 ? null : null}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </button>
    </div>
  );
};
