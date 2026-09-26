import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Order, DemoScenario } from '../../commerce/models';
import { useTenant } from '../../tenant/TenantContext';
import { useTenantStyles } from '../../tenant/useTenant';
import { useI18n } from '../../i18n/I18nContext';
import { formatCurrency } from '../../utils/formatters';
import { OrderTrackingView } from './OrderTrackingView';
import { customerOrderReference, customerTrackerStage } from './trackerEvidence';
import { useTrackerCopy } from './trackerCopy';
import { useOrdersCopy } from './ordersCopy';
import {
  Clock,
  CheckCircle2,
  Package,
  ArrowRight,
  Play,
  Sliders,
  Store,
  ChevronRight,
  AlertCircle,
  Truck,
  RotateCcw,
} from 'lucide-react';

export const OrdersScreen: React.FC<{
  initialOrderId?: string;
  onNavigateOrder?: (orderId?: string) => void;
}> = ({ initialOrderId, onNavigateOrder }) => {
  const { primaryBtnStyle, currencySymbol } = useTenantStyles();
  const { t } = useI18n();
  const trackerCopy = useTrackerCopy();
  const ordersCopy = useOrdersCopy();
  const { appMode, client, tenant } = useTenant();
  const tenantId = tenant?.tenantId || '';
  const isDemo = appMode === 'demo';
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState(false);
  const loadGeneration = useRef(0);

  const getOrderStatusLabel = (order: Order) => {
    switch (customerTrackerStage(order)) {
      case 'PLACED': return trackerCopy('tracker.placed');
      case 'PREPARING': return trackerCopy('tracker.preparing');
      case 'READY': return order.fulfillment?.type === 'pickup' ? t('order.statusReadyCollection') : t('order.statusReadyCourier');
      case 'ON_THE_WAY': return t('order.statusOutForDelivery');
      case 'COMPLETE': return order.fulfillment?.type === 'pickup' ? ordersCopy('orders.collected') : t('order.statusDelivered');
      case 'CANCELLED': return t('order.statusCancelled');
      case 'FAILED': return trackerCopy('tracker.failed');
      default: return trackerCopy('tracker.unknown');
    }
  };

  const getPaymentStatusLabel = (state?: string) => {
    switch (state) {
      case 'AUTHORIZED':
        return t('orders.paymentAuthorized');
      case 'CAPTURED':
        return t('orders.paymentCaptured');
      case 'PAYMENT_ACTION_REQUIRED':
      case 'REAUTHORIZING':
        return t('orders.paymentActionRequired');
      case 'TOKENIZED':
        return t('orders.paymentTokenized');
      default:
        return t('orders.pending');
    }
  };

  const loadOrders = useCallback(async () => {
    const requestId = ++loadGeneration.current;
    const expectedTenantId = tenantId;
    setLoading(true);
    setLoadError(false);

    if (!expectedTenantId) {
      setOrders([]);
      setSelectedOrder(null);
      setLoading(false);
      setLoadError(true);
      return;
    }

    try {
      if (!client.getOrderHistory) throw new Error('Order history is unavailable');
      const history = await client.getOrderHistory();
      if (requestId !== loadGeneration.current) return;
      if ((history || []).some((entry) => entry.tenantId !== expectedTenantId)) {
        throw new Error('Order history scope mismatch');
      }

      const scopedHistory = history || [];
      setOrders(scopedHistory);
      if (initialOrderId) {
        const routedOrder = scopedHistory.find((entry) => entry.id === initialOrderId);
        if (routedOrder) {
          setSelectedOrder(routedOrder);
        } else {
          const directOrder = await client.getOrder(initialOrderId);
          if (requestId !== loadGeneration.current) return;
          if (directOrder && directOrder.tenantId !== expectedTenantId) {
            throw new Error('Direct order scope mismatch');
          }
          setSelectedOrder(directOrder || null);
        }
      }
    } catch {
      if (requestId !== loadGeneration.current) return;
      setOrders([]);
      setSelectedOrder(null);
      setLoadError(true);
    } finally {
      if (requestId === loadGeneration.current) setLoading(false);
    }
  }, [client, initialOrderId, tenantId]);

  useEffect(() => {
    loadGeneration.current += 1;
    setOrders([]);
    setSelectedOrder(null);
    setLoadError(false);
    void loadOrders();
    return () => { loadGeneration.current += 1; };
  }, [loadOrders]);

  const handleCreateDemo = async (scenario: DemoScenario) => {
    const requestId = ++loadGeneration.current;
    setLoading(true);
    setLoadError(false);
    try {
      if (!client.createDemoScenarioOrder) throw new Error('Demo scenarios are unavailable');
      const newOrder = await client.createDemoScenarioOrder(scenario);
      if (requestId !== loadGeneration.current) return;
      if (!tenantId || newOrder.tenantId !== tenantId) throw new Error('Demo order scope mismatch');
      setSelectedOrder(newOrder);
      setOrders((previous) => [newOrder, ...previous.filter((entry) => entry.id !== newOrder.id)]);
    } catch {
      if (requestId === loadGeneration.current) setLoadError(true);
    } finally {
      if (requestId === loadGeneration.current) setLoading(false);
    }
  };

  if (selectedOrder) {
    return (
      <div id="orders-screen" className="max-w-3xl mx-auto px-4 py-6">
        <OrderTrackingView
          order={selectedOrder}
          onOrderUpdated={(updated) => {
            setSelectedOrder(updated);
            setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
          }}
          onBackToList={() => {
            setSelectedOrder(null);
            onNavigateOrder?.();
          }}
        />
      </div>
    );
  }

  return (
    <div id="orders-screen" className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-emerald-600" />
          <h1 className="text-xl font-bold text-gray-900">{t('orders.title')}</h1>
        </div>
        <button
          type="button"
          onClick={() => void loadOrders()}
          disabled={loading}
          className="text-xs font-semibold text-gray-500 hover:text-gray-900 flex items-center gap-1 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{t('orders.refresh')}</span>
        </button>
      </div>

      {/* Demo tooling is intentionally sandbox-only and never shown to live white-label customers. */}
      {isDemo && <div className="p-4 rounded-3xl bg-linear-to-r from-gray-900 via-gray-800 to-gray-900 text-white shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Play className="w-4 h-4 text-emerald-400 fill-current" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Grocery Post-Checkout Simulator
            </span>
          </div>
          <span className="text-[10px] bg-gray-700 px-2 py-0.5 rounded-full text-gray-300">
            Quest Picking + Deliverect Pay
          </span>
        </div>
        <p className="text-xs text-gray-300">
          In retail and grocery, customers are never charged immediately at checkout. Try one of our
          demo scenarios to experience the real-time picking events, price guarantees, and payment captures:
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs pt-1">
          <button
            type="button"
            onClick={() => handleCreateDemo('A')}
            className="p-2.5 rounded-xl bg-gray-800/90 hover:bg-gray-700/90 border border-gray-700 text-left transition-colors"
          >
            <strong className="block text-emerald-400 font-bold text-xs">Scenario A</strong>
            <span className="text-[11px] text-gray-300">Perfect Pick (Auto-Capture)</span>
          </button>

          <button
            type="button"
            onClick={() => handleCreateDemo('B')}
            className="p-2.5 rounded-xl bg-gray-800/90 hover:bg-gray-700/90 border border-gray-700 text-left transition-colors"
          >
            <strong className="block text-indigo-400 font-bold text-xs">Scenario B</strong>
            <span className="text-[11px] text-gray-300">Substitutions & Best Price</span>
          </button>

          <button
            type="button"
            onClick={() => handleCreateDemo('C')}
            className="p-2.5 rounded-xl bg-gray-800/90 hover:bg-gray-700/90 border border-gray-700 text-left transition-colors"
          >
            <strong className="block text-sky-400 font-bold text-xs">Scenario C</strong>
            <span className="text-[11px] text-gray-300">Customer Substitute Picked</span>
          </button>

          <button
            type="button"
            onClick={() => handleCreateDemo('D')}
            className="p-2.5 rounded-xl bg-gray-800/90 hover:bg-gray-700/90 border border-gray-700 text-left transition-colors"
          >
            <strong className="block text-rose-400 font-bold text-xs">Scenario D</strong>
            <span className="text-[11px] text-gray-300">Auth Exceeded (Reauth Req.)</span>
          </button>

          <button
            type="button"
            onClick={() => handleCreateDemo('E')}
            className="p-2.5 rounded-xl bg-gray-800/90 hover:bg-gray-700/90 border border-gray-700 text-left transition-colors"
          >
            <strong className="block text-amber-400 font-bold text-xs">Scenario E</strong>
            <span className="text-[11px] text-gray-300">Closed Store Scheduled Slot</span>
          </button>

          <button
            type="button"
            onClick={() => handleCreateDemo('F')}
            className="p-2.5 rounded-xl bg-gray-800/90 hover:bg-gray-700/90 border border-gray-700 text-left transition-colors"
          >
            <strong className="block text-teal-400 font-bold text-xs">Scenario F</strong>
            <span className="text-[11px] text-gray-300">Weight-Adjusted Produce</span>
          </button>
        </div>
      </div>}

      {/* Orders List */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 px-1">
          {t('orders.recentActivity')} ({orders.length})
        </h2>

        {loading ? (
          <div role="status" aria-live="polite" className="p-8 text-center bg-white rounded-3xl border border-gray-100 space-y-2">
            <RotateCcw className="w-7 h-7 text-gray-300 mx-auto animate-spin" aria-hidden="true" />
            <p className="text-xs font-bold text-gray-700">{ordersCopy('orders.loading')}</p>
          </div>
        ) : loadError ? (
          <div role="alert" className="p-6 text-center bg-amber-50 rounded-3xl border border-amber-200 space-y-3">
            <AlertCircle className="w-8 h-8 text-amber-600 mx-auto" aria-hidden="true" />
            <p className="text-xs font-bold text-amber-950">{ordersCopy('orders.loadFailed')}</p>
            <button type="button" onClick={() => void loadOrders()} className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100">{t('orders.refresh')}</button>
          </div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-3xl border border-gray-100 space-y-2">
            <Package className="w-10 h-10 text-gray-300 mx-auto" />
            <p className="text-xs font-bold text-gray-700">{t('orders.noActive')}</p>
            <p className="text-xs text-gray-400">
              {isDemo ? 'Place an order from the shop or launch a scenario above to test the lifecycle.' : t('orders.emptyLive')}
            </p>
          </div>
        ) : (
          orders.map((order) => {
            const finalTotal = order.finalOrder?.total ?? order.currentOrder?.total;
            const reference = customerOrderReference(order);
            const isReauthNeeded =
              order.status === 'PAYMENT_FINALISING' ||
              order.payment?.state === 'PAYMENT_ACTION_REQUIRED';

            return (
              <button
                key={order.id}
                type="button"
                onClick={() => {
                  setSelectedOrder(order);
                  onNavigateOrder?.(order.id);
                }}
                aria-label={`${t('orders.trackOrder')}${reference ? ` · ${reference}` : ''}`}
                className="w-full p-4 rounded-3xl bg-white border border-gray-100 shadow-2xs hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 transition-all cursor-pointer space-y-3 group text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400">{reference || trackerCopy('tracker.orderReference')}</span>
                    <span className="text-xs font-semibold text-gray-700">• {order.storeName}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isReauthNeeded && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                        {t('orders.actionRequired')}
                      </span>
                    )}
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700">
                      {getOrderStatusLabel(order)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-600">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-gray-400" />
                    <span>
                      {order.picking.items.length} {t(order.picking.items.length === 1 ? 'orders.item' : 'orders.items')}
                      {order.picking.hasChanges && ` (${t('orders.withSubstitutions')})`}
                    </span>
                  </div>
                  <span className="font-extrabold text-gray-900 text-sm">
                    {formatCurrency(finalTotal, currencySymbol)}
                  </span>
                </div>

                <div className="pt-2 border-t border-gray-50 flex items-center justify-between text-xs">
                  <span className="text-gray-400 text-[11px]">
                    {t('orders.payment')}: {getPaymentStatusLabel(order.payment?.state)}
                  </span>
                  <span className="font-bold text-emerald-700 group-hover:text-emerald-800 flex items-center gap-1">
                    <span>{t('orders.trackOrder')}</span>
                    <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
