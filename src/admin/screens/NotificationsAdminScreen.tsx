import React, { useState, useEffect } from 'react';
import {
  NotificationEventRule,
  OrderLiveStatus,
  OrderStatusType,
} from '../../commerce/notificationModels';
import {
  DEFAULT_NOTIFICATION_RULES,
  defaultNotificationService,
  buildLiveStatusForOrder,
} from '../../commerce/notificationService';
import { LiveActivityMockWidget } from '../../components/notifications/LiveActivityMockWidget';
import { Order } from '../../commerce/models';
import { useTenant } from '../../tenant/TenantContext';
import {
  Bell,
  Check,
  Smartphone,
  Mail,
  MessageSquare,
  Radio,
  Clock,
  Activity,
  RefreshCw,
  Send,
  CheckCircle2,
  Volume2,
} from 'lucide-react';

interface NotificationsAdminScreenProps {
  tenantId: string;
}

export const NotificationsAdminScreen: React.FC<NotificationsAdminScreenProps> = ({
  tenantId,
}) => {
  const [rules, setRules] = useState<NotificationEventRule[]>(() => {
    const existing = defaultNotificationService.getSettings(tenantId);
    return existing.eventRules || DEFAULT_NOTIFICATION_RULES;
  });
  const [selectedRuleId, setSelectedRuleId] = useState<string>(rules[0]?.id || 'rule-order-created');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [testNotificationToast, setTestNotificationToast] = useState<{
    channel: string;
    title: string;
    body: string;
  } | null>(null);

  // Sync when tenant changes
  useEffect(() => {
    const existing = defaultNotificationService.getSettings(tenantId);
    if (existing?.eventRules?.length > 0) {
      setRules(existing.eventRules);
      setSelectedRuleId(existing.eventRules[0]?.id || 'rule-order-created');
      setIsDirty(false);
    }
  }, [tenantId]);

  // Live status preview progression simulator state
  const [simulatedStatus, setSimulatedStatus] = useState<OrderStatusType>('DISPATCHED');
  const [hasSubstitutions, setHasSubstitutions] = useState(false);

  const selectedRule = rules.find((r) => r.id === selectedRuleId) || rules[0] || DEFAULT_NOTIFICATION_RULES[0];

  const { tenant } = useTenant();
  const brandDisplayName = tenant?.brandName || (tenantId === 'default' ? 'White-Label Commerce' : tenantId);

  const handleSave = () => {
    // Preview-only until notification settings have a durable BFF persistence adapter.
    defaultNotificationService.saveSettings({
      tenantId,
      senderName: `${brandDisplayName} Updates`,
      replyToEmail: `support@${tenant?.tenantId || tenantId || 'platform'}.com`,
      eventRules: rules,
      updatedAt: new Date().toISOString(),
    });
    setIsDirty(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleDispatchTest = () => {
    if (!selectedRule) return;
    const channel = selectedRule.channels[0] || 'push';
    const formattedTitle = selectedRule.template.title
      .replace('{{orderRef}}', 'ORD-8942')
      .replace('{{brandName}}', brandDisplayName)
      .replace('{{authAmount}}', '38.20');
    const formattedBody = selectedRule.template.body
      .replace('{{orderRef}}', 'ORD-8942')
      .replace('{{brandName}}', brandDisplayName)
      .replace('{{slotTime}}', '10:00–11:00 Today')
      .replace('{{storeName}}', 'Chelmsford Central')
      .replace('{{pickupCode}}', '8942')
      .replace('{{substitutionSummary}}', 'Wild Rocket for Baby Spinach');

    setTestNotificationToast({
      channel: channel.toUpperCase(),
      title: formattedTitle,
      body: formattedBody,
    });

    setTimeout(() => {
      setTestNotificationToast(null);
    }, 4500);
  };

  const toggleChannel = (channel: 'sms' | 'email' | 'push' | 'whatsapp') => {
    setRules((prev) =>
      prev.map((r) => {
        if (r.id !== selectedRule.id) return r;
        const channels = r.channels.includes(channel)
          ? r.channels.filter((c) => c !== channel)
          : [...r.channels, channel];
        setIsDirty(true);
        return { ...r, channels };
      })
    );
  };

  // Mock order for the live widget
  const mockOrder: any = {
    id: 'ORD-8942-ALPHA',
    tenantId,
    storeId: 'store-chelmsford',
    customer: {
      name: 'Eleanor Vance',
      email: 'eleanor.vance@example.co.uk',
      phone: '+44 7700 900123',
    },
    items: [
      {
        product: {
          plu: 'PLU-SOURDOUGH-01',
          name: 'Slow Fermented Sourdough Boule 600g',
          price: 3.25,
          categoryId: 'bakery',
          status: 'ACTIVE',
        },
        quantity: 2,
        pickedQuantity: 2,
      },
    ],
    fulfilmentType: 'DELIVERY',
    deliverySlot: {
      date: '2026-03-17',
      startTime: '10:00',
      endTime: '11:00',
    },
    subtotal: 14.5,
    deliveryFee: 2.99,
    tip: 1.0,
    total: 18.49,
    status: simulatedStatus,
    paymentStatus: 'CAPTURED',
    timeline: [
      { status: 'CREATED', timestamp: '2026-03-17T09:30:00Z', note: 'Order placed' },
      { status: 'CONFIRMED', timestamp: '2026-03-17T09:31:00Z', note: 'Payment pre-authorised' },
      { status: 'PICKING', timestamp: '2026-03-17T09:40:00Z', note: 'Picker assigned in aisle 3' },
      { status: 'DISPATCHED', timestamp: '2026-03-17T09:55:00Z', note: 'Loaded in EV van 4' },
    ],
    substitutions: hasSubstitutions
      ? [
          {
            originalPlu: 'PLU-SOURDOUGH-01',
            substitutedPlu: 'PLU-ART-001',
            originalPrice: 3.25,
            substitutedPrice: 3.85,
            priceCharged: 3.25, // Lower Price Guarantee
            approvedByCustomer: true,
          },
        ]
      : [],
    createdAt: '2026-03-17T09:30:00Z',
    updatedAt: '2026-03-17T09:55:00Z',
  };

  const liveStatus: OrderLiveStatus = buildLiveStatusForOrder(
    mockOrder,
    'Chelmsford Artisan Grocers'
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* PREVIEW DEVICE NOTIFICATION TOAST */}
      {testNotificationToast && (
        <div className="fixed top-4 right-4 z-50 max-w-md w-full animate-in slide-in-from-top-4 duration-300">
          <div className="bg-gray-950/95 text-white rounded-2xl p-4 shadow-2xl border border-gray-800 backdrop-blur-md flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0 shadow-xs">
              <Bell className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-indigo-400">
                  {testNotificationToast.channel} PREVIEW
                </span>
                <span className="text-[10px] text-gray-400 font-mono">Just Now</span>
              </div>
              <h4 className="text-xs font-bold text-white mt-0.5">{testNotificationToast.title}</h4>
              <p className="text-[11px] text-gray-300 mt-1 leading-snug line-clamp-3">
                {testNotificationToast.body}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Bell className="w-5 h-5 text-indigo-600" />
            <span>Notifications</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Design notification triggers and preview customer messaging. Provider delivery and durable settings are not connected yet.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {saveSuccess && (
            <span className="text-xs font-bold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
              <Check className="w-3.5 h-3.5" />
              Preview updated for this session
            </span>
          )}
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-xs hover:bg-indigo-700 flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>{isDirty ? 'Update preview' : 'Preview settings'}</span>
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 flex items-start gap-3">
        <Activity className="w-4 h-4 mt-0.5 shrink-0" />
        <div>
          <p className="font-bold">Preview only — delivery is not connected</p>
          <p className="mt-1 leading-relaxed">
            Notification rules currently live in browser/server memory for this session. They are not stored durably and this page does not send SMS, email, WhatsApp or push notifications. Use it to design the experience only.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: EVENT TRIGGERS LIST (4 COLS) */}
        <div className="lg:col-span-4 space-y-3">
          <span className="text-xs font-bold text-gray-700 block px-1">
            Order lifecycle triggers ({rules.length})
          </span>
          <div className="space-y-2">
            {rules.map((rule) => {
              const isSelected = rule.id === selectedRuleId;
              return (
                <div
                  key={rule.id}
                  onClick={() => setSelectedRuleId(rule.id)}
                  className={`cursor-pointer p-3.5 rounded-2xl border transition-all ${
                    isSelected
                      ? 'bg-indigo-50/70 border-indigo-300 shadow-xs'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-gray-900 font-mono">
                      {rule.eventType}
                    </span>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        rule.enabled ? 'bg-emerald-500' : 'bg-gray-300'
                      }`}
                    />
                  </div>

                  <p className="text-[11px] text-gray-500 mt-1 line-clamp-1">
                    {rule.template.title}
                  </p>

                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100/80">
                    <span className="text-[10px] text-gray-400 font-mono">
                      {rule.channels.join(', ').toUpperCase()}
                    </span>
                    {rule.debounceSeconds > 0 && (
                      <span className="text-[10px] text-indigo-600 font-mono">
                        • {rule.debounceSeconds}s delay
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* MIDDLE COLUMN: TEMPLATE & CHANNEL EDITOR (4 COLS) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-xs font-bold text-gray-900">
                Trigger: <span className="font-mono text-indigo-600">{selectedRule.eventType}</span>
              </h3>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedRule.enabled}
                  onChange={(e) =>
                    setRules((prev) =>
                      prev.map((r) =>
                        r.id === selectedRule.id ? { ...r, enabled: e.target.checked } : r
                      )
                    )
                  }
                  className="rounded border-gray-300 text-indigo-600"
                />
                <span className="text-xs font-bold text-gray-700">Enabled</span>
              </label>
            </div>

            {/* CHANNEL TOGGLES */}
            <div>
              <span className="text-[11px] font-bold text-gray-700 block mb-2">
                Preview channels
              </span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'push', label: 'Push', icon: Radio },
                  { id: 'sms', label: 'SMS', icon: Smartphone },
                  { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
                  { id: 'email', label: 'Email', icon: Mail },
                ].map((c) => {
                  const Icon = c.icon;
                  const isChecked = selectedRule.channels.includes(c.id as any);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleChannel(c.id as any)}
                      className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all ${
                        isChecked
                          ? 'bg-indigo-50 text-indigo-900 border-indigo-300'
                          : 'bg-gray-50 text-gray-500 border-gray-200'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{c.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* TEMPLATE EDITORS */}
            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-1">
                Notification headline
              </label>
              <input
                type="text"
                value={selectedRule.template.title}
                onChange={(e) =>
                  setRules((prev) =>
                    prev.map((r) =>
                      r.id === selectedRule.id
                        ? { ...r, template: { ...r.template, title: e.target.value } }
                        : r
                    )
                  )
                }
                className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-1">
                Message body
              </label>
              <textarea
                rows={3}
                value={selectedRule.template.body}
                onChange={(e) =>
                  setRules((prev) =>
                    prev.map((r) =>
                      r.id === selectedRule.id
                        ? { ...r, template: { ...r.template, body: e.target.value } }
                        : r
                    )
                  )
                }
                className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white"
              />
              <span className="text-[10px] text-gray-400 mt-0.5 block font-mono">
                Variables: {'{storeName}'}, {'{orderId}'}, {'{slotTime}'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">
                  Debounce Delay
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={selectedRule.debounceSeconds}
                    onChange={(e) =>
                      setRules((prev) =>
                        prev.map((r) =>
                          r.id === selectedRule.id
                            ? { ...r, debounceSeconds: Number(e.target.value) }
                            : r
                        )
                      )
                    }
                    className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-mono bg-white"
                  />
                  <span className="text-xs text-gray-500">sec</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">
                  Max Retries
                </label>
                <input
                  type="number"
                  value={selectedRule.retryPolicy?.maxAttempts ?? 3}
                  onChange={(e) =>
                    setRules((prev) =>
                      prev.map((r) =>
                        r.id === selectedRule.id
                          ? {
                              ...r,
                              retryPolicy: {
                                backoffSeconds: r.retryPolicy?.backoffSeconds ?? 5,
                                maxAttempts: Number(e.target.value) || 1,
                              },
                            }
                          : r
                      )
                    )
                  }
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-mono bg-white"
                  min="1"
                  max="5"
                />
              </div>
            </div>

            {/* DISPATCH LIVE TEST NOTIFICATION BUTTON */}
            <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
              <span className="text-[11px] text-gray-500 font-medium">Test this channel trigger:</span>
              <button
                type="button"
                onClick={handleDispatchTest}
                className="px-3 py-1.5 rounded-xl bg-gray-900 text-white hover:bg-gray-800 text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <Send className="w-3 h-3 text-indigo-400" />
                <span>Dispatch Test Trigger</span>
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: LIVE ACTIVITY / DYNAMIC ISLAND SIMULATOR (4 COLS) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h3 className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-indigo-600" />
                <span>Live Activity & Dynamic Island</span>
              </h3>
              <span className="text-[10px] font-mono text-gray-400">iOS 16+ / Web</span>
            </div>

            {/* STAGE SELECTOR CONTROLS */}
            <div>
              <span className="text-[11px] font-bold text-gray-700 block mb-1">
                Simulate Order Status:
              </span>
              <select
                value={simulatedStatus}
                onChange={(e) => setSimulatedStatus(e.target.value as any)}
                className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-bold bg-white"
              >
                <option value="CREATED">CREATED</option>
                <option value="CONFIRMED">CONFIRMED (Payment Auth)</option>
                <option value="PICKING">PICKING (In-Store)</option>
                <option value="READY_FOR_COLLECTION">READY FOR COLLECTION</option>
                <option value="DISPATCHED">DISPATCHED (In Transit)</option>
                <option value="DELIVERED">DELIVERED</option>
              </select>
            </div>

            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={hasSubstitutions}
                onChange={(e) => setHasSubstitutions(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600"
              />
              <span className="text-xs font-semibold text-gray-700">
                Trigger Quest substitution event
              </span>
            </label>

            {/* LIVE WIDGET */}
            <div className="pt-2">
              <LiveActivityMockWidget
                status={liveStatus}
                orderId={mockOrder.id}
                storeName="Chelmsford Artisan Grocers"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
