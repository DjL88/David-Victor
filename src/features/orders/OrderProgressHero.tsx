import React from 'react';
import type { Order } from '../../commerce/models';
import { useTenantStyles } from '../../tenant/useTenant';
import { useI18n } from '../../i18n/I18nContext';
import { safeHttpsUrl } from '../../utils/safeUrl';
import {
  ArrowUpRight,
  Check,
  Clock3,
  MapPin,
  PackageCheck,
  ShoppingBag,
  Store,
  Truck,
} from 'lucide-react';
import {
  getOrderEtaText,
  getOrderTrackerStage,
  getTrackerStageIndex,
} from './orderTrackingPresentation';

interface OrderProgressHeroProps {
  order: Order;
}

export const OrderProgressHero: React.FC<OrderProgressHeroProps> = ({ order }) => {
  const { primaryBtnStyle } = useTenantStyles();
  const { t } = useI18n();
  const stage = getOrderTrackerStage(order.status);
  const stageIndex = getTrackerStageIndex(order);
  const eta = getOrderEtaText(order);
  const pickup = order.fulfillment.type === 'pickup';
  const courierTrackingUrl = safeHttpsUrl(order.delivery?.trackingUrl);

  const statusLabel =
    stage === 'PICKING'
      ? t('order.statusPicking')
      : stage === 'READY'
      ? pickup
        ? t('order.statusReadyCollection')
        : t('order.statusReadyCourier')
      : stage === 'FULFILLING'
      ? t('order.statusOutForDelivery')
      : stage === 'COMPLETE'
      ? t('order.statusDelivered')
      : stage === 'CANCELLED'
      ? t('order.statusCancelled')
      : t('order.statusAccepted');

  const steps = [
    { label: t('order.statusAccepted'), icon: Store },
    { label: t('order.statusPicking'), icon: ShoppingBag },
    {
      label: pickup ? t('order.statusReadyCollection') : t('order.statusOutForDelivery'),
      icon: pickup ? PackageCheck : Truck,
    },
    {
      label: pickup ? t('tracking.collected') : t('order.statusDelivered'),
      icon: Check,
    },
  ];

  const destination =
    pickup
      ? order.storeName
      : order.fulfillment.address?.formattedAddress ||
        order.fulfillment.address?.line1 ||
        order.fulfillment.address?.street ||
        order.fulfillment.address?.postcode ||
        order.fulfillment.address?.postalCode;

  return (
    <section
      id="order-progress-hero"
      className="overflow-hidden rounded-[28px] border border-gray-100 bg-white shadow-sm"
    >
      <div className="relative overflow-hidden px-5 pb-5 pt-5 sm:px-6 sm:pt-6">
        <div
          className="pointer-events-none absolute -right-14 -top-16 h-44 w-44 rounded-full opacity-[0.08]"
          style={primaryBtnStyle}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-20 -left-14 h-40 w-40 rounded-full opacity-[0.05]"
          style={primaryBtnStyle}
          aria-hidden="true"
        />

        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400">
              {order.displayId}
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-gray-950 sm:text-3xl">
              {statusLabel}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
              <span className="inline-flex items-center gap-1.5 font-semibold text-gray-700">
                {pickup ? <ShoppingBag className="h-3.5 w-3.5" /> : <Truck className="h-3.5 w-3.5" />}
                {pickup ? t('tracking.storeCollection') : t('tracking.courierDelivery')}
              </span>
              {eta && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 className="h-3.5 w-3.5" />
                  {eta}
                </span>
              )}
            </div>
          </div>

          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
            style={primaryBtnStyle}
          >
            {stage === 'FULFILLING' ? (
              <Truck className="h-5 w-5" />
            ) : stage === 'PICKING' ? (
              <ShoppingBag className="h-5 w-5" />
            ) : stage === 'READY' ? (
              <PackageCheck className="h-5 w-5" />
            ) : (
              <Check className="h-5 w-5" />
            )}
          </div>
        </div>

        <div className="relative mt-6 grid grid-cols-4 gap-2" aria-label={t('tracking.progressLabel')}>
          {steps.map((step, index) => {
            const Icon = step.icon;
            const complete = index <= stageIndex && stage !== 'CANCELLED';
            const current = index === stageIndex && stage !== 'COMPLETE' && stage !== 'CANCELLED';
            return (
              <div key={step.label} className="min-w-0">
                <div className="flex items-center">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors ${
                      complete
                        ? 'border-transparent text-white'
                        : 'border-gray-200 bg-gray-50 text-gray-400'
                    }`}
                    style={complete ? primaryBtnStyle : undefined}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  {index < steps.length - 1 && (
                    <div className="mx-1.5 h-1 flex-1 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={`h-full rounded-full transition-all ${
                          index < stageIndex ? 'w-full' : current ? 'w-1/2' : 'w-0'
                        }`}
                        style={index <= stageIndex ? primaryBtnStyle : undefined}
                      />
                    </div>
                  )}
                </div>
                <p
                  className={`mt-1.5 truncate text-[10px] font-bold ${
                    complete ? 'text-gray-800' : 'text-gray-400'
                  }`}
                  title={step.label}
                >
                  {step.label}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-gray-100 bg-gray-50/70 px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-900">
              {pickup ? <Store className="h-4 w-4 text-gray-500" /> : <MapPin className="h-4 w-4 text-gray-500" />}
              <span className="truncate">{destination || order.storeName}</span>
            </div>
            <p className="mt-1 truncate text-[11px] text-gray-500">{order.storeName}</p>
          </div>

          {courierTrackingUrl && (
            <a
              href={courierTrackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-800 shadow-xs hover:bg-gray-50"
            >
              {t('tracking.liveCourier')}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>
    </section>
  );
};
