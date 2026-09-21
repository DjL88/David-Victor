import React, { useState, useEffect } from 'react';
import { VisualRule, AdminUser, TenantSchedulingPolicy, DEFAULT_TENANT_SCHEDULING_POLICY } from '../../commerce/models';
import { defaultAdminClient } from '../../commerce/HttpAdminClient';
import { TenantDispatchRules, DEFAULT_DISPATCH_RULES } from '../../rules/types';
import { ShieldCheck, Plus, Trash2, Edit3, Check, RefreshCw, AlertCircle, Truck, Clock, RefreshCw as RotateCw, CalendarClock } from 'lucide-react';

interface ProductRulesScreenProps {
  tenantId: string;
  currentUser: AdminUser;
}

export const ProductRulesScreen: React.FC<ProductRulesScreenProps> = ({
  tenantId,
  currentUser,
}) => {
  const [activeTab, setActiveTab] = useState<'product' | 'dispatch' | 'scheduling'>('product');
  const [rules, setRules] = useState<VisualRule[]>([]);
  const [dispatchRules, setDispatchRules] = useState<TenantDispatchRules>(DEFAULT_DISPATCH_RULES);
  const [schedulingPolicy, setSchedulingPolicy] = useState<TenantSchedulingPolicy>(DEFAULT_TENANT_SCHEDULING_POLICY);
  const [loading, setLoading] = useState<boolean>(true);
  const [editingRule, setEditingRule] = useState<VisualRule | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [dispatchSaving, setDispatchSaving] = useState<boolean>(false);
  const [dispatchSuccessMsg, setDispatchSuccessMsg] = useState<string | null>(null);
  const [schedulingSaving, setSchedulingSaving] = useState<boolean>(false);
  const [schedulingSuccessMsg, setSchedulingSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    loadRules();
  }, [tenantId]);

  const loadRules = async () => {
    setLoading(true);
    try {
      const [pRules, dRules, sPolicy] = await Promise.all([
        defaultAdminClient.getProductRules(tenantId),
        defaultAdminClient.getDispatchRules(tenantId),
        defaultAdminClient.getSchedulingPolicy?.(tenantId) ?? Promise.resolve(DEFAULT_TENANT_SCHEDULING_POLICY),
      ]);
      setRules(pRules);
      setDispatchRules(dRules);
      setSchedulingPolicy(sPolicy);
    } catch (err) {
      console.warn('[ProductRulesScreen] Error loading rules:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSchedulingPolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setSchedulingSaving(true);
    setSchedulingSuccessMsg(null);
    try {
      const updated = await defaultAdminClient.updateSchedulingPolicy?.(tenantId, schedulingPolicy);
      if (updated) setSchedulingPolicy(updated);
      setSchedulingSuccessMsg('Scheduling policy saved and active.');
      setTimeout(() => setSchedulingSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to save scheduling policy');
    } finally {
      setSchedulingSaving(false);
    }
  };

  const handleSaveDispatchRules = async (e: React.FormEvent) => {
    e.preventDefault();
    setDispatchSaving(true);
    setDispatchSuccessMsg(null);
    try {
      const updated = await defaultAdminClient.saveDispatchRules(tenantId, dispatchRules, currentUser);
      setDispatchRules(updated);
      setDispatchSuccessMsg('Dispatch orchestration rules saved and active.');
      setTimeout(() => setDispatchSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to save dispatch rules');
    } finally {
      setDispatchSaving(false);
    }
  };

  const handleCreateNew = () => {
    const newRule: VisualRule = {
      id: `rule-${Date.now()}`,
      name: 'New Product Rule',
      enabled: true,
      countries: ['GB'],
      priority: 50,
      matchConditions: [
        { field: 'productTag', operator: 'equals', value: 'AGE_RESTRICTED_18' },
      ],
      actions: [
        { type: 'MINIMUM_AGE', minimumAge: 18, params: { age: 18 } },
        { type: 'BADGE', label: '18+ Only', params: { text: '18+ Only', color: 'red' } },
      ],
    };
    setEditingRule(newRule);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule) return;
    setSaving(true);
    try {
      await defaultAdminClient.saveProductRule(tenantId, editingRule, currentUser);
      await loadRules();
      setEditingRule(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ruleId: string) => {
    if (!window.confirm('Delete this compliance rule?')) return;
    await defaultAdminClient.deleteProductRule(tenantId, ruleId, currentUser);
    await loadRules();
  };

  const handleToggle = async (rule: VisualRule) => {
    const updated = { ...rule, enabled: !rule.enabled };
    await defaultAdminClient.saveProductRule(tenantId, updated, currentUser);
    await loadRules();
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center text-gray-500">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        <span>Loading product rules...</span>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <span>Rules Engine & Orchestration Policies</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Configure declarative product compliance, merchandising triggers, and automated courier dispatch timing.
          </p>
        </div>

        {activeTab === 'product' && (
          <button
            type="button"
            onClick={handleCreateNew}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>New Declarative Rule</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-3 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab('product')}
          className={`pb-3 px-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'product'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Product & Compliance Rules</span>
          <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-gray-100 text-gray-600 font-semibold">
            {rules.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('dispatch')}
          className={`pb-3 px-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'dispatch'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Courier Dispatch Orchestration Rules</span>
          <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-mono font-semibold">
            {dispatchRules.assignmentEvent}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('scheduling')}
          className={`pb-3 px-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'scheduling'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <CalendarClock className="w-4 h-4" />
          <span>ASAP & Pre-Order Scheduling</span>
          {schedulingPolicy.acceptAsapOrdersOnly && (
            <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800 font-mono font-semibold">
              ASAP ONLY
            </span>
          )}
        </button>
      </div>

      {activeTab === 'dispatch' && (
        <form onSubmit={handleSaveDispatchRules} className="space-y-6">
          {dispatchSuccessMsg && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{dispatchSuccessMsg}</span>
            </div>
          )}

          {/* Trigger & Timing Card */}
          <div className="p-6 bg-white border border-gray-200 rounded-2xl shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  <span>Dispatch Assignment & Timing Strategy</span>
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Controls when couriers are requested and how pickup ETA is calculated relative to picking speed.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Courier Assignment Event Trigger
                </label>
                <select
                  value={dispatchRules.assignmentEvent}
                  onChange={(e) =>
                    setDispatchRules({
                      ...dispatchRules,
                      assignmentEvent: e.target.value as any,
                    })
                  }
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="START_PICKING">START_PICKING (Assign courier when picking begins - recommended)</option>
                  <option value="CHECKOUT_PAID">CHECKOUT_PAID (Assign courier immediately on payment pre-authorisation)</option>
                  <option value="ORDER_FINALISED">ORDER_FINALISED (Assign courier when Deliverect reports order finalised)</option>
                </select>
                <p className="text-[11px] text-gray-500 mt-1">
                  Recommended: <code className="text-indigo-600 font-mono">START_PICKING</code> ensures couriers arrive exactly when staff bag the order.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Courier Selection Policy
                </label>
                <select
                  value={dispatchRules.selectionPolicy}
                  onChange={(e) =>
                    setDispatchRules({
                      ...dispatchRules,
                      selectionPolicy: e.target.value as any,
                    })
                  }
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="CUSTOMER_CHOICE">CUSTOMER_CHOICE (Honour customer quote selection from checkout)</option>
                  <option value="CHEAPEST">CHEAPEST (Automatically assign lowest price quote)</option>
                  <option value="FASTEST">FASTEST (Automatically assign earliest courier pickup ETA)</option>
                  <option value="TENANT_PRIORITY">TENANT_PRIORITY (Strictly honour allowed provider priority order)</option>
                </select>
                <p className="text-[11px] text-gray-500 mt-1">
                  How the best quote is selected when multiple couriers respond to availability requests.
                </p>
              </div>
            </div>

            {/* Dynamic Timing Toggle & Metrics */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200/80 space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={dispatchRules.dynamicTiming}
                  onChange={(e) =>
                    setDispatchRules({
                      ...dispatchRules,
                      dynamicTiming: e.target.checked,
                    })
                  }
                  className="w-4 h-4 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500"
                />
                <div>
                  <span className="text-xs font-bold text-gray-900 block">
                    Dynamic Picking Time Estimation
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Calculate courier pickup ETA dynamically from order item count and store picking capacity.
                  </span>
                </div>
              </label>

              {dispatchRules.dynamicTiming && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-200/60">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">
                      Items Picked Per Minute (default: 3)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="20"
                      value={dispatchRules.itemsPickedPerMinute}
                      onChange={(e) =>
                        setDispatchRules({
                          ...dispatchRules,
                          itemsPickedPerMinute: Math.max(0.5, parseFloat(e.target.value) || 3),
                        })
                      }
                      className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">
                      Ready Buffer Minutes (default: 1)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="30"
                      value={dispatchRules.readyBufferMinutes}
                      onChange={(e) =>
                        setDispatchRules({
                          ...dispatchRules,
                          readyBufferMinutes: Math.max(0, parseInt(e.target.value, 10) || 1),
                        })
                      }
                      className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white font-mono"
                    />
                  </div>
                </div>
              )}

              {/* Dynamic Pick Preview Card */}
              <div className="p-3 bg-white rounded-lg border border-indigo-100 text-xs text-indigo-950 space-y-1">
                <span className="font-bold text-indigo-900 block text-[11px] uppercase tracking-wide">
                  Live Pick Window Calculation Preview
                </span>
                <p className="text-gray-600 text-[11px]">
                  For a <strong>6-item</strong> customer order:
                  {' '}
                  {dispatchRules.dynamicTiming ? (
                    <>
                      Picking takes <strong>{(6 / (dispatchRules.itemsPickedPerMinute || 3)).toFixed(1)} minutes</strong> (at {dispatchRules.itemsPickedPerMinute} items/min) + <strong>{dispatchRules.readyBufferMinutes} minute</strong> staging buffer.
                      Target courier pickup is scheduled for <strong>+{((6 / (dispatchRules.itemsPickedPerMinute || 3)) + Number(dispatchRules.readyBufferMinutes || 1)).toFixed(1)} minutes</strong> after picking begins.
                    </>
                  ) : (
                    <>
                      Static timing disabled. Courier pickup requested immediately upon trigger event.
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Resiliency & Timeout Limits */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Retry Interval (Seconds)
                </label>
                <input
                  type="number"
                  min="10"
                  max="300"
                  value={dispatchRules.retryIntervalSeconds}
                  onChange={(e) =>
                    setDispatchRules({
                      ...dispatchRules,
                      retryIntervalSeconds: Math.max(10, parseInt(e.target.value, 10) || 60),
                    })
                  }
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white font-mono"
                />
                <p className="text-[10px] text-gray-400 mt-1">Default 60s between assignment attempts</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Max Retry Attempts
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={dispatchRules.maxRetryAttempts}
                  onChange={(e) =>
                    setDispatchRules({
                      ...dispatchRules,
                      maxRetryAttempts: Math.max(1, parseInt(e.target.value, 10) || 3),
                    })
                  }
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white font-mono"
                />
                <p className="text-[10px] text-gray-400 mt-1">Attempts before escalating</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Unaccepted Courier Timeout
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={dispatchRules.unacceptedTimeoutMinutes}
                  onChange={(e) =>
                    setDispatchRules({
                      ...dispatchRules,
                      unacceptedTimeoutMinutes: Math.max(1, parseInt(e.target.value, 10) || 15),
                    })
                  }
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white font-mono"
                />
                <p className="text-[10px] text-gray-400 mt-1">Minutes before pending assignment times out</p>
              </div>
            </div>

            {/* Allowed Providers */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-700">
                Allowed Courier Providers Whitelist
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {['deliverect-dispatch', 'stuart', 'uber', 'gophr', 'relay', 'demo-dispatch'].map((prov) => {
                  const isChecked = dispatchRules.allowedProviders.includes(prov);
                  return (
                    <label
                      key={prov}
                      className={`px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer flex items-center justify-between transition-colors ${
                        isChecked
                          ? 'border-indigo-600 bg-indigo-50/60 text-indigo-900'
                          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <span className="truncate">{prov}</span>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setDispatchRules({
                              ...dispatchRules,
                              allowedProviders: [...dispatchRules.allowedProviders, prov],
                            });
                          } else {
                            setDispatchRules({
                              ...dispatchRules,
                              allowedProviders: dispatchRules.allowedProviders.filter((p) => p !== prov),
                            });
                          }
                        }}
                        className="sr-only"
                      />
                      {isChecked && <Check className="w-3.5 h-3.5 text-indigo-600 ml-1 shrink-0" />}
                    </label>
                  );
                })}
              </div>
              <p className="text-[11px] text-gray-500">
                Only quotes from these selected courier networks will be requested and eligible for dispatch.
              </p>
            </div>

            <div className="pt-4 border-t border-gray-100 flex items-center justify-end">
              <button
                type="submit"
                disabled={dispatchSaving}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 flex items-center gap-2 shadow-xs disabled:opacity-50"
              >
                {dispatchSaving && <RefreshCw className="w-4 h-4 animate-spin" />}
                <span>{dispatchSaving ? 'Saving Rules...' : 'Save Dispatch Rules'}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {activeTab === 'scheduling' && (
        <form onSubmit={handleSaveSchedulingPolicy} className="space-y-6">
          {schedulingSuccessMsg && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{schedulingSuccessMsg}</span>
            </div>
          )}

          <div className="p-6 bg-white border border-gray-200 rounded-2xl shadow-xs space-y-4">
            <div className="border-b border-gray-100 pb-3">
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-indigo-600" />
                <span>ASAP & Pre-Order Scheduling</span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Controls whether customers can build a basket for a closed store's next opening, or pick a
                later same-day time slot while the store is open. Pre-ordering beyond the current day is not
                supported, to keep the fulfilment model simple.
              </p>
            </div>

            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-amber-50 border border-amber-200">
              <input
                type="checkbox"
                checked={schedulingPolicy.acceptAsapOrdersOnly}
                onChange={(e) =>
                  setSchedulingPolicy({ ...schedulingPolicy, acceptAsapOrdersOnly: e.target.checked })
                }
                className="w-4 h-4 rounded text-amber-600 border-gray-300 focus:ring-amber-500"
              />
              <div>
                <span className="text-xs font-bold text-gray-900 block">Accept ASAP Orders Only</span>
                <span className="text-[11px] text-gray-600">
                  Disables both pre-order modes below. A closed store is simply unavailable rather than
                  offered for pre-order.
                </span>
              </div>
            </label>

            <fieldset disabled={schedulingPolicy.acceptAsapOrdersOnly} className="space-y-3 disabled:opacity-50">
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-gray-50 border border-gray-200">
                <input
                  type="checkbox"
                  checked={schedulingPolicy.allowNextOpeningPreOrder}
                  onChange={(e) =>
                    setSchedulingPolicy({ ...schedulingPolicy, allowNextOpeningPreOrder: e.target.checked })
                  }
                  className="w-4 h-4 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500"
                />
                <div>
                  <span className="text-xs font-bold text-gray-900 block">
                    1. Pre-Order for Next Opening
                  </span>
                  <span className="text-[11px] text-gray-600">
                    A customer may still build a basket for a currently closed store; it targets the store's
                    next real opening time.
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-gray-50 border border-gray-200">
                <input
                  type="checkbox"
                  checked={schedulingPolicy.allowSameDayScheduledPreOrder}
                  onChange={(e) =>
                    setSchedulingPolicy({ ...schedulingPolicy, allowSameDayScheduledPreOrder: e.target.checked })
                  }
                  className="w-4 h-4 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500"
                />
                <div>
                  <span className="text-xs font-bold text-gray-900 block">
                    2. Scheduled Pre-Order, Same Day
                  </span>
                  <span className="text-[11px] text-gray-600">
                    A customer may pick a specific later time slot, today only, while the store is or will be
                    open. Offered at checkout.
                  </span>
                </div>
              </label>
            </fieldset>

            <div className="pt-4 border-t border-gray-100 flex items-center justify-end">
              <button
                type="submit"
                disabled={schedulingSaving}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 flex items-center gap-2 shadow-xs disabled:opacity-50"
              >
                {schedulingSaving && <RefreshCw className="w-4 h-4 animate-spin" />}
                <span>{schedulingSaving ? 'Saving Policy...' : 'Save Scheduling Policy'}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {activeTab === 'product' && (
      <div className="grid grid-cols-1 gap-4">
        {rules.map((r) => (
          <div
            key={r.id}
            className={`p-5 rounded-2xl bg-white border transition-all ${
              r.enabled ? 'border-gray-200 shadow-xs' : 'border-gray-200 opacity-60 bg-gray-50/50'
            }`}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      r.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {r.enabled ? 'Active' : 'Disabled'}
                  </span>
                  <span className="text-xs font-bold text-gray-400">Priority: {r.priority}</span>
                  <span className="text-xs font-bold text-indigo-600">[{r.countries.join(', ')}]</span>
                </div>
                <h3 className="text-sm font-bold text-gray-900">{r.name}</h3>

                {/* Match conditions */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
                  <span className="text-gray-400 text-[11px]">Matches:</span>
                  {r.matchConditions.map((cond, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-lg bg-gray-100 text-gray-700 font-mono text-[11px]"
                    >
                      {cond.field} {cond.operator} "{String(cond.value)}"
                    </span>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
                  <span className="text-gray-400 text-[11px]">Enforces:</span>
                  {r.actions.map((act, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-800 font-semibold text-[11px]"
                    >
                      {act?.type} {act?.params ? JSON.stringify(act.params) : ''}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleToggle(r)}
                  className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-bold hover:bg-gray-50"
                >
                  {r.enabled ? 'Disable' : 'Enable'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingRule(JSON.parse(JSON.stringify(r)))}
                  className="p-2 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(r.id)}
                  className="p-2 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      )}

      {/* EDIT MODAL */}
      {editingRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-gray-900">Configure Declarative Rule</h3>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Rule Name</label>
                <input
                  type="text"
                  value={editingRule.name}
                  onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl font-semibold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Priority (Higher = First)</label>
                  <input
                    type="number"
                    value={editingRule.priority}
                    onChange={(e) =>
                      setEditingRule({ ...editingRule, priority: parseInt(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Active Status</label>
                  <label className="flex items-center gap-2 pt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingRule.enabled}
                      onChange={(e) => setEditingRule({ ...editingRule, enabled: e.target.checked })}
                      className="rounded text-indigo-600 w-4 h-4"
                    />
                    <span className="font-bold text-gray-800">Rule is Active</span>
                  </label>
                </div>
              </div>

              {/* Match Condition Editor */}
              <div className="p-3 bg-gray-50 rounded-xl space-y-2 border border-gray-100">
                <span className="font-bold text-gray-700 block">Match Condition</span>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={editingRule.matchConditions[0]?.field || 'productTag'}
                    onChange={(e) => {
                      const updated = [...editingRule.matchConditions];
                      updated[0] = { ...updated[0], field: e.target.value as any };
                      setEditingRule({ ...editingRule, matchConditions: updated });
                    }}
                    className="px-2 py-1.5 border border-gray-200 rounded-lg bg-white"
                  >
                    <option value="productTag">productTag</option>
                    <option value="category">category</option>
                    <option value="plu">plu</option>
                  </select>

                  <select
                    value={editingRule.matchConditions[0]?.operator || 'equals'}
                    onChange={(e) => {
                      const updated = [...editingRule.matchConditions];
                      updated[0] = { ...updated[0], operator: e.target.value as any };
                      setEditingRule({ ...editingRule, matchConditions: updated });
                    }}
                    className="px-2 py-1.5 border border-gray-200 rounded-lg bg-white"
                  >
                    <option value="equals">equals</option>
                    <option value="contains">contains</option>
                  </select>

                  <input
                    type="text"
                    value={String(editingRule.matchConditions[0]?.value || '')}
                    onChange={(e) => {
                      const updated = [...editingRule.matchConditions];
                      updated[0] = { ...updated[0], value: e.target.value };
                      setEditingRule({ ...editingRule, matchConditions: updated });
                    }}
                    className="px-2 py-1.5 border border-gray-200 rounded-lg bg-white font-mono"
                    placeholder="e.g. AGE_RESTRICTED_18"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingRule(null)}
                  className="px-4 py-2 rounded-xl font-bold text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-xs"
                >
                  {saving ? 'Saving...' : 'Save Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
