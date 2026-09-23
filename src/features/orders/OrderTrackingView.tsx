import React, { useState } from 'react';
import {
  Order,
  PickingItem,
  DemoScenario,
  PickingEventType,
  moneyToMajor,
} from '../../commerce/models';
import { useTenantStyles } from '../../tenant/useTenant';
import { useTenant } from '../../tenant/TenantContext';
import { useI18n } from '../../i18n/I18nContext';
import { formatCurrency } from '../../utils/formatters';
import { getCommerceClient } from '../../commerce/CommerceClientFactory';

const defaultCommerceClient = getCommerceClient() as any;
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Package,
  ShoppingBag,
  Truck,
  CreditCard,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  ChevronDown,
  Info,
  Sliders,
  Check,
  X,
  Repeat,
  Phone,
  Store as StoreIcon,
  Calendar,
  Layers,
} from 'lucide-react';

interface OrderTrackingViewProps {
  order: Order;
  onOrderUpdated?: (order: Order) => void;
  onBackToList?: () => void;
}

export const OrderTrackingView: React.FC<OrderTrackingViewProps> = ({
  order: initialOrder,
  onOrderUpdated,
  onBackToList,
}) => {
  const { primaryBtnStyle, currencySymbol, brandName } = useTenantStyles();
  const { appMode } = useTenant();
  const { t, formatDateTime } = useI18n();
  const isDemo = appMode === 'demo';
  const [order, setOrder] = useState<Order>(initialOrder);
  const [isAdvancing, setIsAdvancing] = useState<boolean>(false);
  const [isReauthorizing, setIsReauthorizing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'timeline' | 'items' | 'payment'>('items');
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Synchronize with prop changes
  React.useEffect(() => {
    setOrder(initialOrder);
  }, [initialOrder]);

  // Periodic polling for active picking / fulfillment updates from BFF
  React.useEffect(() => {
    const isTerminal = ['CANCELLED', 'ORDER_CANCELLED', 'ORDER_CANCELLED_UNAVAILABLE_ITEM', 'DELIVERED', 'FAILED'].includes(order.status);
    if (isTerminal || !order.id) return;

    const interval = setInterval(async () => {
      try {
        const fresh = await defaultCommerceClient.getOrder(order.id);
        if (fresh) {
          setOrder(fresh);
          onOrderUpdated?.(fresh);
        }
      } catch {
        // silent polling error
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [order.id, order.status, onOrderUpdated]);

  const notifyUpdate = (updated: Order, msg?: string) => {
    setOrder(updated);
    onOrderUpdated?.(updated);
    if (msg) {
      setFeedbackMessage(msg);
      setTimeout(() => setFeedbackMessage(null), 4000);
    }
  };

  // Helper to advance simulation picking step
  const handleSimulateNextStep = async () => {
    setIsAdvancing(true);
    try {
      // Find first pending item to pick
      const pendingItems = (order.picking?.items || []).filter((i) => i.state === 'PENDING');
      if (pendingItems.length > 0) {
        const updated = await defaultCommerceClient.advancePickingDemo(order.id);
        const lastEvt = updated.events?.[updated.events.length - 1];
        notifyUpdate(updated, lastEvt?.note || lastEvt?.title || 'Picking advanced');
      } else if (order.picking?.status !== 'COMPLETED') {
        const updated = await defaultCommerceClient.finalizeOrderPicking(order.id);
        notifyUpdate(
          updated,
          updated.status === 'PAYMENT_FINALISING'
            ? 'Picking completed! Reauthorization required due to price increase.'
            : 'Picking completed & payment captured automatically!'
        );
      } else {
        // Advance tracking status
        const updated = await defaultCommerceClient.advanceOrderStatus(order.id);
        notifyUpdate(updated, `Status advanced to ${updated.status}`);
      }
    } catch (err: any) {
      setFeedbackMessage(`Error: ${err.message}`);
    } finally {
      setIsAdvancing(false);
    }
  };

  // Switch demo scenario
  const handleLoadScenario = async (scenario: DemoScenario) => {
    setIsAdvancing(true);
    try {
      const demoOrder = await defaultCommerceClient.createDemoScenarioOrder(scenario);
      notifyUpdate(demoOrder, `Loaded Demo Scenario ${scenario}`);
    } catch (err: any) {
      setFeedbackMessage(`Error: ${err.message}`);
    } finally {
      setIsAdvancing(false);
    }
  };

  // Customer reauthorizes payment when ceiling exceeded
  const handleApproveReauthorization = async () => {
    setIsReauthorizing(true);
    try {
      const approvedTotal = order.finalOrder?.total || order.currentOrder.total;
      const updated = await defaultCommerceClient.reauthorizeOrderPayment(
        order.id,
        approvedTotal
      );
      notifyUpdate(
        updated,
        `Payment reauthorized and captured: ${formatCurrency(approvedTotal, currencySymbol)}!`
      );
    } catch (err: any) {
      setFeedbackMessage(`Reauthorization error: ${err.message}`);
    } finally {
      setIsReauthorizing(false);
    }
  };

  // Status mapping for visual badge
  const getStatusBadge = () => {
    switch (order.status) {
      case 'SUBMITTED':
        return { label: t('order.statusSubmitted'), bg: 'bg-blue-100 text-blue-800 border-blue-200' };
      case 'ACCEPTED':
      case 'orderAccepted':
      case 'STORE_ACCEPTED':
      case 'CONFIRMED':
      case 'ORDER_CONFIRMED':
        return { label: t('order.statusAccepted'), bg: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
      case 'PICKING':
      case 'preparing':
      case 'PICKING_STARTED':
        return { label: t('order.statusPicking'), bg: 'bg-amber-100 text-amber-800 border-amber-200' };
      case 'PICKING_WITH_CHANGES':
        return { label: t('order.statusPickingWithChanges'), bg: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
      case 'PICKED':
      case 'PICKING_COMPLETE':
      case 'readyForPickup':
        return { label: t('order.statusPickedPacked'), bg: 'bg-teal-100 text-teal-800 border-teal-200' };
      case 'READY':
      case 'READY_FOR_PICKUP':
        return { label: t('order.statusReadyCollection'), bg: 'bg-teal-100 text-teal-800 border-teal-200' };
      case 'PAYMENT_FINALISING':
        return { label: t('order.statusPaymentFinalising'), bg: 'bg-rose-100 text-rose-800 border-rose-200' };
      case 'READY_FOR_COURIER':
        return { label: t('order.statusReadyCourier'), bg: 'bg-purple-100 text-purple-800 border-purple-200' };
      case 'COURIER_ASSIGNED':
      case 'courierAssigned':
      case 'courierAtStore':
        return { label: t('order.statusCourierAssigned'), bg: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
      case 'OUT_FOR_DELIVERY':
      case 'outForDelivery':
      case 'DISPATCHING':
        return { label: t('order.statusOutForDelivery'), bg: 'bg-sky-100 text-sky-800 border-sky-200' };
      case 'DELIVERED':
      case 'delivered':
        return { label: t('order.statusDelivered'), bg: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
      case 'CANCELLED':
      case 'ORDER_CANCELLED':
      case 'ORDER_CANCELLED_UNAVAILABLE_ITEM':
        return { label: t('order.statusCancelled'), bg: 'bg-red-100 text-red-800 border-red-200' };
      default:
        return { label: String(order.status), bg: 'bg-gray-100 text-gray-800 border-gray-200' };
    }
  };

  // Payment status badge
  const getPaymentBadge = () => {
    switch (order.payment?.state) {
      case 'TOKENIZED':
        return { label: t('tracking.cardTokenized'), bg: 'bg-gray-100 text-gray-700' };
      case 'AUTHORIZED':
        return { label: t('tracking.preAuthorizedEstimated'), bg: 'bg-blue-100 text-blue-800' };
      case 'REAUTHORIZING':
      case 'PAYMENT_ACTION_REQUIRED':
        return { label: t('tracking.actionReauthorize'), bg: 'bg-rose-100 text-rose-800' };
      case 'CAPTURED':
        return { label: t('tracking.finalTotalCaptured'), bg: 'bg-emerald-100 text-emerald-800' };
      default:
        return { label: order.payment?.state || t('tracking.pending'), bg: 'bg-gray-100 text-gray-700' };
    }
  };

  const statusBadge = getStatusBadge();
  const paymentBadge = getPaymentBadge();
  const isReauthNeeded =
    order.status === 'PAYMENT_FINALISING' ||
    order.payment?.state === 'PAYMENT_ACTION_REQUIRED';

  const finalTotal = order.finalOrder?.total !== undefined ? order.finalOrder.total : order.currentOrder.total;
  const authorizedMax = order.payment?.authorizationMaximum !== undefined ? order.payment.authorizationMaximum : (order.payment?.authorizedAmount ?? 0);

  return (
    <div id="order-tracking-container" className="space-y-4">
      {/* Toast Feedback */}
      {feedbackMessage && (
        <div className="p-3 rounded-xl bg-gray-900 text-white text-xs flex items-center justify-between shadow-lg animate-in fade-in">
          <span>{feedbackMessage}</span>
          <button
            type="button"
            onClick={() => setFeedbackMessage(null)}
            className="text-gray-400 hover:text-white font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Header Card */}
      <div className="p-5 rounded-3xl bg-white border border-gray-100 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              {onBackToList && (
                <button
                  type="button"
                  onClick={onBackToList}
                  className="text-xs font-semibold text-gray-500 hover:text-gray-800"
                >
                  ← {t('tracking.allOrders')}
                </button>
              )}
              <span className="text-xs font-bold text-gray-400">{order.displayId}</span>
            </div>
            <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2 mt-0.5">
              <StoreIcon className="w-4 h-4 text-gray-500" />
              <span>{order.storeName}</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full border ${statusBadge.bg}`}
            >
              {statusBadge.label}
            </span>
          </div>
        </div>

        {/* Fulfillment & Scheduling Summary */}
        <div className="flex flex-wrap items-center justify-between p-3 rounded-2xl bg-gray-50 border border-gray-100 text-xs gap-3">
          <div className="flex items-center gap-2">
            {(order.fulfillment?.type || (order as any)?.fulfillmentType) === 'delivery' ? (
              <Truck className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <ShoppingBag className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            <div>
              <span className="font-bold text-gray-900">
                {(order.fulfillment?.type || (order as any)?.fulfillmentType) === 'delivery' ? t('tracking.courierDelivery') : t('tracking.storeCollection')}
              </span>
              <p className="text-gray-500 text-[11px]">
                {order.scheduledTime?.type === 'SCHEDULED' && order.scheduledTime.slot
                  ? `${t('tracking.scheduled')}: ${order.scheduledTime.slot.dayLabel} • ${order.scheduledTime.slot.formatted}`
                  : `${t('tracking.asapDelivery')}${order.delivery?.courier?.eta ? ` (${t('checkout.eta')}: ${order.delivery.courier.eta})` : ''}`}
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[11px] text-gray-400 block">{t('tracking.finalChargedTotal')}</span>
            <span className="text-sm font-extrabold text-gray-900">
              {formatCurrency(finalTotal, currencySymbol)}
            </span>
          </div>
        </div>
      </div>

      {/* ORDER CANCELLED BANNER */}
      {(order.status === 'CANCELLED' || order.status === 'ORDER_CANCELLED' || order.status === 'ORDER_CANCELLED_UNAVAILABLE_ITEM') && (
        <div
          id="order-cancelled-alert"
          className="p-4 rounded-3xl bg-red-50 border-2 border-red-200 text-red-950 space-y-2 shadow-xs"
        >
          <div className="flex items-center gap-2">
            <X className="w-5 h-5 text-red-600 shrink-0" />
            <span className="font-bold text-sm text-red-900">{t('tracking.orderCancelled')}</span>
          </div>
          <p className="text-xs text-red-800">
            {order.events?.find((e) => e.status === 'CANCELLED')?.note ||
              t('tracking.cancelledFallback')}
          </p>
          <div className="text-[11px] text-red-700 font-medium">
            {t('tracking.paymentHoldReleased')}
          </div>
        </div>
      )}

      {/* REAUTHORIZATION REQUIRED ALERT (If final basket exceeded ceiling) */}
      {isReauthNeeded && (
        <div
          id="reauthorization-prompt-card"
          className="p-4 rounded-3xl bg-rose-50 border-2 border-rose-300 text-rose-950 space-y-3 shadow-md animate-in slide-in-from-top-2"
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-rose-900">
                {t('tracking.reauthRequired')}
              </h3>
              <p className="text-xs text-rose-800 mt-1 leading-relaxed">
                {t('tracking.reauthPrefix')}{' '}
                <strong className="font-bold">{formatCurrency(finalTotal, currencySymbol)}</strong>, {t('tracking.reauthExceeds')}{' '}
                <strong className="font-bold">{formatCurrency(authorizedMax, currencySymbol)}</strong> by{' '}
                <span className="underline font-bold">
                  {formatCurrency(Math.max(0, moneyToMajor(finalTotal) - moneyToMajor(authorizedMax)), currencySymbol)}
                </span>
                . {t('tracking.reauthSuffix')}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-rose-200">
            <button
              type="button"
              onClick={handleApproveReauthorization}
              disabled={isReauthorizing}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
            >
              {isReauthorizing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{t('tracking.authorizing')}</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{t('tracking.approvePay')} {formatCurrency(finalTotal, currencySymbol)}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* GROCERY LIFECYCLE INFO BANNER */}
      <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-emerald-950 flex items-center justify-between text-xs gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
          <p className="text-[11px] leading-tight">
            <strong>{t('tracking.lifecycleTitle')}:</strong> {t('tracking.lifecycleNotice')}
          </p>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ${paymentBadge.bg}`}>
          {paymentBadge.label}
        </span>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex items-center border-b border-gray-200 text-xs font-bold text-gray-500">
        <button
          type="button"
          onClick={() => setActiveTab('items')}
          className={`pb-2 px-4 flex items-center gap-1.5 border-b-2 transition-colors ${
            activeTab === 'items'
              ? 'border-emerald-600 text-emerald-700 font-extrabold'
              : 'border-transparent hover:text-gray-700'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>{t('tracking.pickingItems')} ({order.picking.items.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('timeline')}
          className={`pb-2 px-4 flex items-center gap-1.5 border-b-2 transition-colors ${
            activeTab === 'timeline'
              ? 'border-emerald-600 text-emerald-700 font-extrabold'
              : 'border-transparent hover:text-gray-700'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>{t('tracking.timeline')} ({order.events?.length || 0})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('payment')}
          className={`pb-2 px-4 flex items-center gap-1.5 border-b-2 transition-colors ${
            activeTab === 'payment'
              ? 'border-emerald-600 text-emerald-700 font-extrabold'
              : 'border-transparent hover:text-gray-700'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>{t('tracking.paymentAuthorization')}</span>
        </button>
      </div>

      {/* TAB 1: ITEM-BY-ITEM PICKING STATUS */}
      {activeTab === 'items' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs px-1">
            <span className="font-bold text-gray-600">{t('tracking.storePickingState')}</span>
            <span className="text-gray-400 text-[11px]">
              {t('tracking.status')}: <strong className="text-gray-700">{order.picking.status}</strong>
            </span>
          </div>

          <div className="space-y-2">
            {order.picking.items.map((item) => {
              const isSubstituted = item.state === 'SUBSTITUTED';
              const isAmended = item.state === 'QUANTITY_AMENDED';
              const isRemoved = item.state === 'REMOVED';
              const isPicked = item.state === 'PICKED';
              const isPending = item.state === 'PENDING';

              return (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-2xl border transition-all text-xs ${
                    isSubstituted
                      ? 'bg-indigo-50/50 border-indigo-200'
                      : isAmended
                      ? 'bg-amber-50/50 border-amber-200'
                      : isRemoved
                      ? 'bg-gray-50 border-gray-200 opacity-75'
                      : isPicked
                      ? 'bg-white border-gray-100 shadow-2xs'
                      : 'bg-white border-dashed border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 flex-1">
                      {/* State Icon Indicator */}
                      <div className="mt-0.5">
                        {isPicked && (
                          <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                        {isSubstituted && (
                          <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center">
                            <Repeat className="w-3 h-3" />
                          </div>
                        )}
                        {isAmended && (
                          <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
                            <AlertTriangle className="w-3 h-3" />
                          </div>
                        )}
                        {isRemoved && (
                          <div className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center">
                            <X className="w-3 h-3" />
                          </div>
                        )}
                        {isPending && (
                          <div className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center">
                            <Clock className="w-3 h-3" />
                          </div>
                        )}
                      </div>

                      {/* Item details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-gray-900">{item?.name || item?.plu || 'Item'}</span>
                          {isSubstituted && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                              Substituted
                            </span>
                          )}
                          {isAmended && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                              Quantity Adjusted
                            </span>
                          )}
                          {isRemoved && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                              Out of stock • Refunded
                            </span>
                          )}
                          {isPicked && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                              Picked
                            </span>
                          )}
                          {isPending && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                              Awaiting Picker
                            </span>
                          )}
                        </div>

                        <p className="text-gray-500 text-[11px] mt-0.5">
                          {t('tracking.requested')}: {item.originalQuantity} × {formatCurrency(moneyToMajor(item.originalPrice) / (item.originalQuantity || 1), currencySymbol)}
                          {item.pickedQuantity > 0 && ` • ${t('tracking.supplied')}: ${item.pickedQuantity}`}
                        </p>

                        {/* Substitution Details Box */}
                        {isSubstituted && item.substitution && (
                          <div className="mt-2 p-2.5 rounded-xl bg-white border border-indigo-100 space-y-1">
                            <div className="flex items-center gap-1 text-[11px] font-bold text-indigo-950">
                              <Repeat className="w-3 h-3 text-indigo-600" />
                              <span>{t('tracking.substitute')}: {item.substitution.substituteName}</span>
                            </div>
                            <p className="text-[11px] text-gray-600">
                              {item.substitution.reason}
                            </p>
                            <div className="flex items-center gap-2 pt-1 text-[11px]">
                              <span className="text-gray-400 line-through">
                                {t('tracking.shelf')}: {formatCurrency(item.substitution.substitutePrice, currencySymbol)}
                              </span>
                              <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                                {t('tracking.youPay')}: {formatCurrency(item.finalPrice, currencySymbol)} ({t('checkout.bestMatchGuarantee')})
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Quantity Amendment Box */}
                        {isAmended && item.amendment && (
                          <div className="mt-2 p-2 rounded-xl bg-white border border-amber-100 text-[11px] text-amber-900">
                            <strong>{t('tracking.note')}:</strong> {item.amendment.reason}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Price column */}
                    <div className="text-right shrink-0">
                      <span className={`font-extrabold text-xs block ${isRemoved ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                        {formatCurrency(item.finalPrice, currencySymbol)}
                      </span>
                      {item.finalPrice !== item.originalPrice && (
                        <span className="text-[10px] text-gray-400 line-through block">
                          {t('tracking.was')} {formatCurrency(item.originalPrice, currencySymbol)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: ORDER TIMELINE */}
      {activeTab === 'timeline' && (
        <div className="p-4 rounded-3xl bg-white border border-gray-100 space-y-4 text-xs">
          <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
            {order.events?.map((evt, idx) => (
              <div key={evt.id || idx} className="relative">
                <div className="absolute -left-6 top-0.5 w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center ring-4 ring-white">
                  <Check className="w-2.5 h-2.5" />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-900">{evt.title}</span>
                    <span className="text-[11px] text-gray-400">
                      {formatDateTime(evt.timestamp, { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {evt.description && (
                    <p className="text-gray-500 text-[11px] mt-0.5">{evt.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: PAYMENT & AUTHORIZATION */}
      {activeTab === 'payment' && (
        <div className="p-5 rounded-3xl bg-white border border-gray-100 space-y-4 text-xs">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <span className="font-bold text-gray-900">{t('tracking.paymentBreakdown')}</span>
            <span className="text-gray-500 text-[11px]">{order.payment.method}</span>
          </div>

          <div className="space-y-2 text-gray-600">
            <div className="flex justify-between">
              <span>{t('tracking.originalEstimate')}</span>
              <span>{formatCurrency(order.originalBasket?.subtotal || order.currentOrder.subtotal, currencySymbol)}</span>
            </div>

            <div className="flex justify-between">
              <span>{t('tracking.approvedCeiling')}</span>
              <span className="font-bold text-gray-900">
                {formatCurrency(authorizedMax, currencySymbol)}
              </span>
            </div>

            <div className="flex justify-between">
              <span>{t('tracking.deliveryCharge')}</span>
              <span>{formatCurrency(order.currentOrder.deliveryCharge, currencySymbol)}</span>
            </div>

            <div className="flex justify-between">
              <span>{t('tracking.bagServiceFees')}</span>
              <span>{formatCurrency(moneyToMajor(order.currentOrder.bagFee) + moneyToMajor(order.currentOrder.serviceCharge), currencySymbol)}</span>
            </div>

            <div className="pt-2 border-t border-gray-200 flex justify-between font-extrabold text-sm text-gray-900">
              <span>{t('tracking.finalCaptured')}</span>
              <span className="text-emerald-700">{formatCurrency(finalTotal, currencySymbol)}</span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-gray-50 border border-gray-100 text-[11px] text-gray-500 space-y-1">
            <p className="font-bold text-gray-700">{t('tracking.auditHistory')}:</p>
            {order.payment.history.map((h, i) => (
              <div key={i} className="flex items-center justify-between text-[10px]">
                <span>
                  • {h.state} {h.note ? `— ${h.note}` : ''}
                </span>
                <span className="text-gray-400">
                  {formatDateTime(h.timestamp, { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* INTERACTIVE DEMO SCENARIOS & STEP SIMULATOR CONTROLS */}
      {isDemo && (
      <div className="p-4 rounded-3xl bg-gray-900 text-white space-y-3 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-200">
            <Sliders className="w-4 h-4 text-emerald-400" />
            <span>Interactive Lifecycle Simulator</span>
          </div>
          <span className="text-[10px] text-gray-400 font-mono">BFF Post-Checkout</span>
        </div>

        {/* Advance step button */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSimulateNextStep}
            disabled={isAdvancing}
            className="flex-1 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isAdvancing ? 'animate-spin' : ''}`} />
            <span>Advance Next Picking / Courier Step</span>
          </button>
        </div>

        {/* Demo Scenario Selector */}
        <div className="pt-2 border-t border-gray-800">
          <span className="text-[11px] font-bold text-gray-400 block mb-2">
            Load Pre-configured Scenarios:
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[11px]">
            <button
              type="button"
              onClick={() => handleLoadScenario('A')}
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-left border border-gray-700 transition-colors"
            >
              <strong className="block text-emerald-400 font-bold">Scenario A</strong>
              <span className="text-gray-300 text-[10px]">Perfect Pick (Auto-Capture)</span>
            </button>

            <button
              type="button"
              onClick={() => handleLoadScenario('B')}
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-left border border-gray-700 transition-colors"
            >
              <strong className="block text-indigo-400 font-bold">Scenario B</strong>
              <span className="text-gray-300 text-[10px]">Best Match & Amendments</span>
            </button>

            <button
              type="button"
              onClick={() => handleLoadScenario('C')}
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-left border border-gray-700 transition-colors"
            >
              <strong className="block text-sky-400 font-bold">Scenario C</strong>
              <span className="text-gray-300 text-[10px]">Customer Chosen Substitute</span>
            </button>

            <button
              type="button"
              onClick={() => handleLoadScenario('D')}
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-left border border-gray-700 transition-colors"
            >
              <strong className="block text-rose-400 font-bold">Scenario D</strong>
              <span className="text-gray-300 text-[10px]">Reauthorization Exceeded</span>
            </button>

            <button
              type="button"
              onClick={() => handleLoadScenario('E')}
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-left border border-gray-700 transition-colors"
            >
              <strong className="block text-amber-400 font-bold">Scenario E</strong>
              <span className="text-gray-300 text-[10px]">Closed Store Pre-Order</span>
            </button>

            <button
              type="button"
              onClick={() => handleLoadScenario('F')}
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-left border border-gray-700 transition-colors"
            >
              <strong className="block text-teal-400 font-bold">Scenario F</strong>
              <span className="text-gray-300 text-[10px]">Weight-Adjusted Produce</span>
            </button>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};
