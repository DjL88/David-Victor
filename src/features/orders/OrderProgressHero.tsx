import React from 'react';
import type { Order } from '../../commerce/models';
import { useTenantStyles } from '../../tenant/useTenant';
import { useI18n } from '../../i18n/I18nContext';
import { safeHttpsUrl } from '../../utils/safeUrl';
import { dispatchProviderIdentity } from '../../commerce/deliveryMarketplace';
import { ChannelBrandIcon } from '../../components/MarketplaceServiceBadge';
import { ArrowUpRight, Check, Clock3, MapPin, PackageCheck, ShoppingBag, Truck } from 'lucide-react';
import { getOrderEtaText } from './orderTrackingPresentation';
import { customerOrderReference, customerTrackerStage, trackerSteps, type CustomerTrackerStage } from './trackerEvidence';
import { useTrackerCopy } from './trackerCopy';

export const OrderProgressHero: React.FC<{ order: Order }> = ({ order }) => {
  const { primaryBtnStyle } = useTenantStyles();
  const { t } = useI18n();
  const copy = useTrackerCopy();
  const stage = customerTrackerStage(order);
  const pickup = order.fulfillment?.type === 'pickup';
  const steps = trackerSteps(order);
  const index = steps.indexOf(stage);
  const terminal = ['COMPLETE', 'CANCELLED', 'FAILED'].includes(stage);
  const eta = !pickup && !terminal ? getOrderEtaText(order) : null;
  const trackingUrl = !pickup ? safeHttpsUrl(order.delivery?.trackingUrl || order.dispatch?.trackingUrl) : undefined;
  const provider = !pickup ? dispatchProviderIdentity(order) : undefined;
  const reference = customerOrderReference(order);
  const destination = pickup ? order.storeName : order.fulfillment?.address?.formattedAddress || order.fulfillment?.address?.line1 || order.fulfillment?.address?.street;

  const label = (value: CustomerTrackerStage): string => {
    switch (value) {
      case 'PLACED': return copy('tracker.placed');
      case 'PREPARING': return copy('tracker.preparing');
      case 'READY': return pickup ? t('order.statusReadyCollection') : t('order.statusReadyCourier');
      case 'ON_THE_WAY': return t('order.statusOutForDelivery');
      case 'COMPLETE': return pickup ? t('tracking.collected') : t('order.statusDelivered');
      case 'CANCELLED': return t('order.statusCancelled');
      case 'FAILED': return copy('tracker.failed');
      default: return copy('tracker.unknown');
    }
  };
  const icons = { PLACED: Clock3, PREPARING: ShoppingBag, READY: PackageCheck, ON_THE_WAY: Truck, COMPLETE: Check };

  return <section id="order-progress-hero" className="overflow-hidden rounded-[28px] border border-gray-100 bg-white shadow-sm" aria-label={t('tracking.progressLabel')}>
    <div className="px-5 py-5 sm:px-6">
      {reference && <p className="text-xs font-bold tracking-wide text-gray-500">{copy('tracker.orderReference')}: <span>{reference}</span></p>}
      <div role="status" aria-live="polite"><h1 className="mt-2 text-2xl font-black tracking-tight text-gray-950 sm:text-3xl">{label(stage)}</h1></div>
      {stage === 'PLACED' && <p className="mt-2 text-sm text-gray-600">{copy('tracker.waiting')}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-600">
        <span className="inline-flex items-center gap-2 font-semibold">{pickup ? <ShoppingBag className="h-4 w-4" aria-hidden="true" /> : <Truck className="h-4 w-4" aria-hidden="true" />}
          {pickup ? t('tracking.storeCollection') : t('tracking.courierDelivery')}
        </span>
        {provider && <span className="inline-flex items-center gap-2"><ChannelBrandIcon identity={provider} label={provider.label} />{provider.label}</span>}
        {eta && <span className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4" aria-hidden="true" />{eta}</span>}
      </div>
      {!pickup && !terminal && order.dispatch?.state === 'PICKUP_EN_ROUTE' && <p className="mt-2 text-xs font-semibold text-gray-700">{copy('tracker.courierToStore')}</p>}
      {!pickup && !terminal && order.dispatch?.state === 'ASSIGNED' && <p className="mt-2 text-xs font-semibold text-gray-700">{copy('tracker.courierAssigned')}</p>}
      <ol className={`mt-6 grid gap-2 ${pickup ? 'grid-cols-4' : 'grid-cols-5'}`}>
        {steps.map((step, stepIndex) => {
          const Icon = icons[step as keyof typeof icons] || Clock3;
          const reached = index >= 0 && stepIndex <= index;
          const current = stepIndex === index;
          return <li key={step} className="min-w-0" aria-current={current ? 'step' : undefined}>
            <div className="flex items-center">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${reached ? 'border-transparent text-white' : 'border-gray-200 bg-gray-50 text-gray-400'}`} style={reached ? primaryBtnStyle : undefined}>
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              {stepIndex < steps.length - 1 && <span className="mx-1 h-1 flex-1 rounded-full bg-gray-100" style={index > stepIndex ? primaryBtnStyle : undefined} aria-hidden="true" />}
            </div>
            <span className={`mt-2 block break-words text-[10px] font-semibold leading-snug ${reached ? 'text-gray-900' : 'text-gray-500'}`}>{label(step)}</span>
          </li>;
        })}
      </ol>
    </div>
    {(destination || trackingUrl) && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-gray-50/70 px-5 py-4 sm:px-6">
      {destination && <span className="inline-flex min-w-0 items-start gap-2 text-xs font-semibold text-gray-800"><MapPin className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" /><span className="break-words">{destination}</span></span>}
      {trackingUrl && <a href={trackingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800">
        {t('tracking.liveCourier')}<ArrowUpRight className="h-4 w-4" aria-hidden="true" />
      </a>}
    </div>}
  </section>;
};
