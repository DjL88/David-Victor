import React from 'react';
import type { Order } from '../commerce/models';
import { useTenantStyles } from '../tenant/useTenant';
import { useI18n } from '../i18n/I18nContext';
import { ArrowRight, Clock3, PackageCheck, ShoppingBag, Truck } from 'lucide-react';
import { getOrderEtaText } from '../features/orders/orderTrackingPresentation';
import { customerOrderReference, customerTrackerStage, trackerSteps } from '../features/orders/trackerEvidence';
import { useTrackerCopy } from '../features/orders/trackerCopy';

interface ActiveOrderBarProps {
  order: Order;
  onOpenTracking: () => void;
}

export const ActiveOrderBar: React.FC<ActiveOrderBarProps> = ({ order, onOpenTracking }) => {
  const { primaryBtnStyle } = useTenantStyles();
  const { t } = useI18n();
  const copy = useTrackerCopy();
  const stage = customerTrackerStage(order);
  const steps = trackerSteps(order);
  const stageIndex = steps.indexOf(stage);
  const isPickup = order.fulfillment.type === 'pickup';
  const eta = !isPickup && !['COMPLETE', 'FAILED', 'CANCELLED'].includes(stage) ? getOrderEtaText(order) : null;
  const reference = customerOrderReference(order);
  const statusText = stage === 'PREPARING' ? copy('tracker.preparing')
    : stage === 'READY' ? (isPickup ? t('order.statusReadyCollection') : t('order.statusReadyCourier'))
    : stage === 'ON_THE_WAY' ? t('order.statusOutForDelivery')
    : stage === 'COMPLETE' ? (isPickup ? t('tracking.collected') : t('order.statusDelivered'))
    : stage === 'CANCELLED' ? t('order.statusCancelled')
    : stage === 'FAILED' ? copy('tracker.failed')
    : stage === 'PLACED' ? copy('tracker.placed') : copy('tracker.unknown');

  return <div id="active-order-bar" className="fixed bottom-18 left-4 right-4 z-40 mx-auto max-w-lg sm:bottom-6">
    <button type="button" onClick={onOpenTracking} style={primaryBtnStyle}
      className="w-full rounded-2xl px-4 py-3 text-left shadow-xl transition-all hover:brightness-105 active:scale-[0.99]"
      aria-label={`${t('tracking.track')}${reference ? ` ${reference}` : ''}`}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20" aria-hidden="true">
          {stage === 'PREPARING' ? <ShoppingBag className="h-5 w-5" /> : stage === 'ON_THE_WAY' ? <Truck className="h-5 w-5" /> : stage === 'READY' ? <PackageCheck className="h-5 w-5" /> : <Clock3 className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-extrabold sm:text-sm">{statusText}{eta ? <span className="font-semibold opacity-90"> · {eta}</span> : null}</p>
              {(order.storeName || reference) && <p className="mt-0.5 truncate text-[11px] font-medium opacity-85">{[order.storeName, reference].filter(Boolean).join(' · ')}</p>}
            </div>
            <span className="flex shrink-0 items-center gap-1 text-xs font-extrabold">{t('tracking.track')}<ArrowRight className="h-4 w-4" aria-hidden="true" /></span>
          </div>
          <div className="mt-2 flex items-center gap-1.5" aria-hidden="true">{steps.map((step, index) => <span key={step} className={`h-1.5 flex-1 rounded-full ${stageIndex >= 0 && index <= stageIndex ? 'bg-white' : 'bg-white/30'}`} />)}</div>
        </div>
      </div>
    </button>
  </div>;
};
