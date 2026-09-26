import React, { useEffect, useRef, useState } from 'react';
import type { DemoScenario, Order } from '../../commerce/models';
import { useTenant } from '../../tenant/TenantContext';
import { useTenantStyles } from '../../tenant/useTenant';
import { useI18n } from '../../i18n/I18nContext';
import { getCommerceClient } from '../../commerce/CommerceClientFactory';
import { RefreshCw } from 'lucide-react';
import { OrderProgressHero } from './OrderProgressHero';
import { OrderPickingItems, OrderProductImage } from './OrderPickingItems';
import { capturedPayment, currentOrderTotal, customerOrderReference, customerTrackerStage, observedMoney } from './trackerEvidence';
import { useTrackerCopy } from './trackerCopy';

interface OrderTrackingViewProps {
  order: Order;
  onOrderUpdated?: (order: Order) => void;
  onBackToList?: () => void;
}

// Switching tenant, store or order must discard in-flight responses and local presentation state.
export const OrderTrackingView: React.FC<OrderTrackingViewProps> = (props) => (
  <ScopedOrderTrackingView key={`${props.order.tenantId}:${props.order.storeId}:${props.order.id}`} {...props} />
);

type TrackerClient = {
  getOrder(id: string): Promise<Order | null>;
  advancePickingDemo?(id: string): Promise<Order>;
  finalizeOrderPicking?(id: string): Promise<Order>;
  advanceOrderStatus?(id: string): Promise<Order>;
  createDemoScenarioOrder?(scenario: DemoScenario): Promise<Order>;
  reauthorizeOrderPayment?(id: string, amount: NonNullable<Order['finalOrder']>['total']): Promise<Order>;
};

const ScopedOrderTrackingView: React.FC<OrderTrackingViewProps> = ({ order: initialOrder, onOrderUpdated, onBackToList }) => {
  const { appMode } = useTenant();
  const { brandName } = useTenantStyles();
  const { t, formatCurrency, formatDateTime } = useI18n();
  const copy = useTrackerCopy();
  const isDemo = appMode === 'demo';
  const [order, setOrder] = useState(initialOrder);
  const [activeTab, setActiveTab] = useState<'items' | 'timeline' | 'payment' | 'receipt'>('items');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pollFailed, setPollFailed] = useState(false);
  const mounted = useRef(true);
  const generation = useRef(0);
  const latestOrder = useRef(order);
  const onUpdated = useRef(onOrderUpdated);
  onUpdated.current = onOrderUpdated;
  latestOrder.current = order;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; generation.current += 1; };
  }, []);
  useEffect(() => {
    generation.current += 1;
    setOrder(initialOrder);
  }, [initialOrder]);

  const matchesOrder = (candidate: Order) => candidate.id === initialOrder.id && candidate.tenantId === initialOrder.tenantId && candidate.storeId === initialOrder.storeId;
  const stage = customerTrackerStage(order);
  const terminal = ['COMPLETE', 'CANCELLED', 'FAILED'].includes(stage);
  useEffect(() => {
    if (terminal || !order.id) return;
    let disposed = false;
    let running = false;
    const interval = setInterval(async () => {
      if (running) return;
      running = true;
      const requestGeneration = generation.current;
      try {
        const fresh = await (getCommerceClient() as unknown as TrackerClient).getOrder(order.id);
        if (disposed || requestGeneration !== generation.current) return;
        if (!fresh || !matchesOrder(fresh)) throw new Error('Order identity mismatch');
        const oldTime = Date.parse(latestOrder.current.updatedAt);
        const newTime = Date.parse(fresh.updatedAt);
        if (Number.isFinite(oldTime) && Number.isFinite(newTime) && newTime < oldTime) return;
        setOrder(fresh);
        setPollFailed(false);
        onUpdated.current?.(fresh);
      } catch {
        if (!disposed && requestGeneration === generation.current) setPollFailed(true);
      } finally { running = false; }
    }, 4000);
    return () => { disposed = true; clearInterval(interval); };
  }, [order.id, order.tenantId, order.storeId, terminal]);

  const runAction = async (action: (client: TrackerClient) => Promise<Order>, allowDemoIdentityChange = false) => {
    if (busy) return;
    const actionGeneration = ++generation.current;
    setBusy(true);
    setFeedback(null);
    try {
      const updated = await action(getCommerceClient() as unknown as TrackerClient);
      if (!mounted.current || actionGeneration !== generation.current) return;
      if (!updated || (!allowDemoIdentityChange && !matchesOrder(updated))) throw new Error('Order identity mismatch');
      setOrder(updated);
      onUpdated.current?.(updated);
      setFeedback(copy('tracker.paymentUpdate'));
    } catch {
      if (mounted.current && actionGeneration === generation.current) setFeedback(copy('tracker.actionFailed'));
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const advanceDemo = () => {
    if (!isDemo) return;
    void runAction(async (client) => {
      const pending = order.picking?.items?.some((item) => item.state === 'PENDING');
      const action = pending ? client.advancePickingDemo : order.picking?.status !== 'COMPLETED' ? client.finalizeOrderPicking : client.advanceOrderStatus;
      if (!action) throw new Error('Simulation unavailable');
      return action.call(client, order.id);
    });
  };
  const loadScenario = (scenario: DemoScenario) => {
    if (!isDemo) return;
    void runAction(async (client) => {
      if (!client.createDemoScenarioOrder) throw new Error('Simulation unavailable');
      return client.createDemoScenarioOrder(scenario);
    }, true);
  };

  const money = (value: unknown) => {
    const amount = observedMoney(value);
    return amount ? formatCurrency(amount.amount, amount.currency) : t('product.priceUnavailable');
  };
  const captured = capturedPayment(order);
  const total = currentOrderTotal(order);
  const authorised = observedMoney(order.payment?.authorizationMaximum) || observedMoney(order.payment?.authorizedAmount);
  const pickup = order.fulfillment?.type === 'pickup';
  const reference = customerOrderReference(order);
  const paymentNotice = captured ? copy('tracker.captureRecorded')
    : order.payment?.state === 'AUTHORIZED' ? copy('tracker.authorised')
    : order.payment?.state === 'RELEASED' ? copy('tracker.releaseRecorded')
    : order.payment?.state === 'NO_CAPTURE_REQUIRED' ? copy('tracker.noOnlineCapture')
    : copy('tracker.paymentPending');
  const paymentLabel = captured ? t('tracking.finalTotalCaptured')
    : order.payment?.state === 'AUTHORIZED' ? t('tracking.preAuthorizedEstimated')
    : order.payment?.state === 'PAYMENT_ACTION_REQUIRED' ? t('tracking.actionReauthorize') : t('tracking.pending');
  const reauthNeeded = order.payment?.state === 'PAYMENT_ACTION_REQUIRED';
  const reauthAmount = observedMoney(order.finalOrder?.total) || observedMoney(order.currentOrder?.total);
  const pickingLabel = order.picking?.status === 'IN_PROGRESS' ? copy('tracker.inProgress')
    : order.picking?.status === 'COMPLETED' ? copy('tracker.preparationComplete')
    : order.picking?.status === 'CANCELLED' ? t('order.statusCancelled') : copy('tracker.pendingItems');
  const tabs = [
    { id: 'items' as const, label: `${t('tracking.pickingItems')} (${order.picking?.items?.length || 0})` },
    { id: 'timeline' as const, label: `${t('tracking.timeline')} (${order.events?.length || 0})` },
    { id: 'payment' as const, label: t('tracking.paymentAuthorization') },
    ...(order.receipt?.available ? [{ id: 'receipt' as const, label: order.receipt.isVatReceipt ? 'VAT receipt' : 'Receipt' }] : []),
  ];

  return <div id="order-tracking-container" className="min-w-0 space-y-4">
    {onBackToList && <button type="button" onClick={onBackToList} className="rounded-lg px-2 py-2 text-sm font-semibold text-gray-600 hover:text-gray-950">← {t('tracking.allOrders')}</button>}
    {feedback && <div role="status" className="flex items-center justify-between gap-3 rounded-xl bg-gray-900 p-3 text-sm text-white"><span>{feedback}</span><button type="button" onClick={() => setFeedback(null)} aria-label="Dismiss message">×</button></div>}
    {pollFailed && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{copy('tracker.updateFailed')}</p>}
    <OrderProgressHero order={order} />

    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-white p-4 text-sm">
      <div><strong>{pickup ? t('tracking.storeCollection') : t('tracking.courierDelivery')}</strong>
        <p className="mt-1 text-xs text-gray-600">{order.scheduledTime?.type === 'SCHEDULED' && order.scheduledTime.slot
          ? `${t('tracking.scheduled')}: ${order.scheduledTime.slot.dayLabel || ''} ${order.scheduledTime.slot.formatted || order.scheduledTime.slot.startTime || ''}`
          : pickup ? copy('tracker.asapCollection') : t('tracking.asapDelivery')}</p>
      </div>
      <div className="text-right"><span className="block text-xs text-gray-500">{captured ? copy('tracker.captured') : copy('tracker.total')}</span><strong className="text-base">{money(total)}</strong></div>
    </div>

    {stage === 'CANCELLED' && <div id="order-cancelled-alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
      <strong>{t('tracking.orderCancelled')}</strong><p className="mt-1">{order.payment?.state === 'RELEASED' ? copy('tracker.releaseRecorded') : copy('tracker.paymentPending')}</p>
    </div>}
    {reauthNeeded && <div id="reauthorization-prompt-card" className="space-y-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
      <h2 className="font-bold">{t('tracking.reauthRequired')}</h2>
      <p>{copy('tracker.total')}: {money(reauthAmount)}</p>
      <p>{t('tracking.approvedCeiling')}: {money(authorised)}</p>
      <button type="button" disabled={busy || !reauthAmount} onClick={() => {
        if (!reauthAmount) return;
        void runAction(async (client) => {
          if (!client.reauthorizeOrderPayment) throw new Error('Reauthorisation unavailable');
          return client.reauthorizeOrderPayment(order.id, reauthAmount);
        });
      }} className="rounded-xl bg-rose-700 px-4 py-2 font-bold text-white disabled:opacity-50">{busy ? t('tracking.authorizing') : `${t('tracking.approvePay')} ${money(reauthAmount)}`}</button>
    </div>}
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-xs text-gray-700"><p>{paymentNotice}</p><span className="rounded-full bg-white px-2 py-1 font-semibold">{paymentLabel}</span></div>

    <div role="tablist" aria-label="Order details" className="flex max-w-full gap-1 overflow-x-auto border-b border-gray-200">
      {tabs.map((tab) => <button key={tab.id} id={`tracker-tab-${tab.id}`} role="tab" type="button" aria-selected={activeTab === tab.id} aria-controls={`tracker-panel-${tab.id}`}
        onClick={() => setActiveTab(tab.id)} onKeyDown={(event) => {
          if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const i = tabs.findIndex((candidate) => candidate.id === tab.id);
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (i + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
          setActiveTab(tabs[next].id);
          document.getElementById(`tracker-tab-${tabs[next].id}`)?.focus();
        }} tabIndex={activeTab === tab.id ? 0 : -1}
        className={`shrink-0 border-b-2 px-3 py-3 text-xs font-bold ${activeTab === tab.id ? 'border-gray-900 text-gray-950' : 'border-transparent text-gray-500'}`}>{tab.label}</button>)}
    </div>
    <section role="tabpanel" id={`tracker-panel-${activeTab}`} aria-labelledby={`tracker-tab-${activeTab}`} tabIndex={0} className="min-w-0">
      {activeTab === 'items' && <div className="space-y-3"><p className="text-xs font-semibold text-gray-600">{pickingLabel}</p><OrderPickingItems order={order} /></div>}
      {activeTab === 'timeline' && <div className="rounded-2xl border border-gray-100 bg-white p-4">
        {!order.events?.length && <p className="text-sm text-gray-600">{copy('tracker.noTimeline')}</p>}
        <ol className="space-y-4">{order.events?.map((event, index) => <li key={event.id || index} className="border-l-2 border-gray-200 pl-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><strong>{event.title}</strong><time className="text-xs text-gray-500">{formatDateTime(event.timestamp, { hour: '2-digit', minute: '2-digit' })}</time></div>{event.description && <p className="mt-1 text-gray-600">{event.description}</p>}</li>)}</ol>
      </div>}
      {activeTab === 'payment' && <div className="space-y-4 rounded-2xl border border-gray-100 bg-white p-4 text-sm">
        <h2 className="font-bold">{t('tracking.paymentBreakdown')}</h2>{order.payment?.method && <p className="text-xs text-gray-600">{order.payment.method}</p>}
        <dl className="space-y-3">
          <div className="flex justify-between gap-3"><dt>{t('tracking.originalEstimate')}</dt><dd>{money(order.originalBasket?.total)}</dd></div>
          <div className="flex justify-between gap-3"><dt>{t('tracking.approvedCeiling')}</dt><dd>{money(authorised)}</dd></div>
          {(order.currentOrder?.charges || []).map((charge) => <div key={charge.id} className="flex justify-between gap-3"><dt>{charge.title}</dt><dd>{money(charge.amount)}</dd></div>)}
          <div className="flex justify-between gap-3 border-t border-gray-100 pt-3 font-bold"><dt>{captured ? copy('tracker.captured') : copy('tracker.total')}</dt><dd>{money(total)}</dd></div>
        </dl>
        {!captured && <p className="text-xs text-gray-500">{copy('tracker.paymentUnknown')}</p>}
        {!!order.payment?.history?.length && <div className="space-y-2 border-t border-gray-100 pt-3"><h3 className="text-xs font-semibold">{t('tracking.auditHistory')}</h3>{order.payment.history.map((entry, index) => <div key={`${entry.timestamp}:${index}`} className="flex flex-wrap justify-between gap-2 text-xs text-gray-600"><span>{entry.state}{entry.amount ? ` · ${money(entry.amount)}` : ''}</span><time>{formatDateTime(entry.timestamp, { hour: '2-digit', minute: '2-digit' })}</time></div>)}</div>}
      </div>}
      {activeTab === 'receipt' && order.receipt?.available && <div className="space-y-4 rounded-2xl border border-gray-100 bg-white p-4 text-sm">
        <h2 className="font-bold">{order.receipt.isVatReceipt ? 'VAT receipt' : 'Receipt'}</h2>
        <p>{order.receipt.legalName || brandName}{reference ? ` · ${reference}` : ''}</p>
        {order.receipt.legalAddress && <p>{order.receipt.legalAddress}</p>}
        {order.receipt.isVatReceipt && order.receipt.vatRegistrationNumber && <p>VAT: {order.receipt.vatRegistrationNumber}</p>}
        {(order.receipt.items || []).map((item) => <div key={item.id || item.plu} className="flex items-center gap-3">
          <OrderProductImage order={order} plu={item.plu} name={item.name || item.plu} snapshot={item.imageUrl} />
          <div className="min-w-0 flex-1"><strong>{item.name || item.plu}</strong><p className="text-xs text-gray-600">× {item.quantity} · {money(item.unitPrice || item.price)}</p></div>
          <span>{money(item.totalPrice || (observedMoney(item.unitPrice || item.price) ? { amount: (item.unitPrice || item.price).amount * item.quantity, currency: (item.unitPrice || item.price).currency } : null))}</span>
        </div>)}
        {(order.receipt.discounts || []).map((discount) => <div key={discount.id || discount.code} className="flex justify-between gap-3"><span>{discount.title}</span><span>−{money(discount.amount)}</span></div>)}
        {(order.receipt.charges || []).map((charge) => <div key={charge.id} className="flex justify-between gap-3"><span>{charge.title}</span><span>{money(charge.amount)}</span></div>)}
        {order.receipt.tax && <div className="flex justify-between"><span>{order.receipt.isVatReceipt ? 'VAT' : 'Tax'}</span><span>{money(order.receipt.tax)}</span></div>}
        <div className="flex justify-between border-t border-gray-100 pt-3 font-bold"><span>{captured ? copy('tracker.captured') : copy('tracker.total')}</span><span>{money(total)}</span></div>
      </div>}
    </section>

    {isDemo && <div className="space-y-3 rounded-2xl bg-gray-900 p-4 text-white">
      <h2 className="text-sm font-bold">Interactive Lifecycle Simulator</h2>
      <button type="button" onClick={advanceDemo} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-semibold disabled:opacity-50"><RefreshCw className={busy ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} aria-hidden="true" />Advance Next Picking / Courier Step</button>
      <div className="flex flex-wrap gap-2">{(['A', 'B', 'C', 'D', 'E', 'F'] as DemoScenario[]).map((scenario) => <button type="button" key={scenario} onClick={() => loadScenario(scenario)} disabled={busy} className="rounded-lg bg-gray-800 px-3 py-2 text-xs disabled:opacity-50">Scenario {scenario}</button>)}</div>
    </div>}
  </div>;
};
