import React, { useState, useEffect } from 'react';
import { Order, DemoScenario } from '../../commerce/models';
import { useTenant } from '../../tenant/TenantContext';
import { getCommerceClient } from '../../commerce/CommerceClientFactory';

const defaultCommerceClient = getCommerceClient() as any;
import { useTenantStyles } from '../../tenant/useTenant';
import { useI18n } from '../../i18n/I18nContext';
import { formatCurrency } from '../../utils/formatters';
import { OrderTrackingView } from './OrderTrackingView';
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

export const OrdersScreen: React.FC<{ initialOrderId?: string }> = ({ initialOrderId }) => {
  const { primaryBtnStyle, currencySymbol } = useTenantStyles();
  const { t } = useI18n();
  const { appMode } = useTenant();
  const isDemo = appMode === 'demo';
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const getOrderStatusLabel = (status: string) => {
    switch (status) {
      case 'SUBMITTED':
        return t('order.statusSubmitted');
      case 'ACCEPTED':
      case 'orderAccepted':
      case 'STORE_ACCEPTED':
      case 'CONFIRMED':
      case 'ORDER_CONFIRMED':
        return t('order.statusAccepted');
      case 'PICKING':
      case 'preparing':
      case 'PICKING_STARTED':
        return t('order.statusPicking');
      case 'PICKING_WITH_CHANGES':
        return t('order.statusPickingWithChanges');
      case 'PICKED':
      case 'PICKING_COMPLETE':
      case 'readyForPickup':
        return t('order.statusPickedPacked');
      case 'READY':
      case 'READY_FOR_PICKUP':
        return t('order.statusReadyCollection');
      case 'PAYMENT_FINALISING':
        return t('order.statusPaymentFinalising');
      case 'READY_FOR_COURIER':
        return t('order.statusReadyCourier');
      case 'COURIER_ASSIGNED':
      case 'courierAssigned':
        return t('order.statusCourierAssigned');
      case 'courierAtStore':
        return t('order.statusCourierAtStore');
      case 'OUT_FOR_DELIVERY':
      case 'outForDelivery':
      case 'DISPATCHING':
        return t('order.statusOutForDelivery');
      case 'DELIVERED':
      case 'delivered':
        return t('order.statusDelivered');
      case 'CANCELLED':
      case 'ORDER_CANCELLED':
      case 'ORDER_CANCELLED_UNAVAILABLE_ITEM':
        return t('order.statusCancelled');
      default:
        return String(status);
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
        return state || t('orders.pending');
    }
  };

  const loadOrders = async () => {
    setLoading(true);
    try {
      const history = await defaultCommerceClient.getOrderHistory();
      setOrders(history);
      if (initialOrderId) {
        const routedOrder = history.find((order) => order.id === initialOrderId);
        if (routedOrder) setSelectedOrder(routedOrder);
      }
      // If there are orders and none selected, or to sync
      if (selectedOrder) {
        const found = history.find((o) => o.id === selectedOrder.id);
        if (found) setSelectedOrder(found);
      }
    } catch (e) {
      console.error('Failed to load orders', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [initialOrderId]);

  const handleCreateDemo = async (scenario: DemoScenario) => {
    setLoading(true);
    try {
      const newOrder = await defaultCommerceClient.createDemoScenarioOrder(scenario);
      await loadOrders();
      setSelectedOrder(newOrder);
    } finally {
      setLoading(false);
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
          onBackToList={() => setSelectedOrder(null)}
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
          onClick={loadOrders}
          className="text-xs font-semibold text-gray-500 hover:text-gray-900 flex items-center gap-1"
        >
          <RotateCcw className="w-3.5 h-3.5" />
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

        {orders.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-3xl border border-gray-100 space-y-2">
            <Package className="w-10 h-10 text-gray-300 mx-auto" />
            <p className="text-xs font-bold text-gray-700">{t('orders.noActive')}</p>
            <p className="text-xs text-gray-400">
              {isDemo ? 'Place an order from the shop or launch a scenario above to test the lifecycle.' : t('orders.emptyLive')}
            </p>
          </div>
        ) : (
          orders.map((order) => {
            const finalTotal = order.finalOrder?.total ?? order.currentOrder.total;
            const isReauthNeeded =
              order.status === 'PAYMENT_FINALISING' ||
              order.payment?.state === 'PAYMENT_ACTION_REQUIRED';

            return (
              <div
                key={order.id}
                onClick={() => setSelectedOrder(order)}
                className="p-4 rounded-3xl bg-white border border-gray-100 shadow-2xs hover:shadow-md transition-all cursor-pointer space-y-3 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400">{order.displayId}</span>
                    <span className="text-xs font-semibold text-gray-700">• {order.storeName}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isReauthNeeded && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                        {t('orders.actionRequired')}
                      </span>
                    )}
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700">
                      {getOrderStatusLabel(String(order.status))}
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
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
