import React, { useState, useEffect, useMemo } from 'react';
import { VisualRule, AdminUser, TenantSchedulingPolicy, DEFAULT_TENANT_SCHEDULING_POLICY, Product, Store } from '../../commerce/models';
import { defaultAdminClient } from '../../commerce/HttpAdminClient';
import { getCommerceClient } from '../../commerce/CommerceClientFactory';
import { TenantDispatchRules, DEFAULT_DISPATCH_RULES } from '../../rules/types';
import { ShieldCheck, Plus, Trash2, Edit3, Check, RefreshCw, AlertCircle, Truck, Clock, RefreshCw as RotateCw, CalendarClock } from 'lucide-react';

interface ProductRulesScreenProps {
  tenantId: string;
  currentUser: AdminUser;
  view?: 'product' | 'dispatch' | 'scheduling';
}

export const ProductRulesScreen: React.FC<ProductRulesScreenProps> = ({
  tenantId,
  currentUser,
  view,
}) => {
  const [activeTab, setActiveTab] = useState<'product' | 'dispatch' | 'scheduling'>(view || 'product');

  useEffect(() => {
    if (view) setActiveTab(view);
  }, [view]);
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
  const [operationsError, setOperationsError] = useState<string | null>(null);
  const [ruleError, setRuleError] = useState<string | null>(null);
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [tenantStores, setTenantStores] = useState<Store[]>([]);
  const [catalogCategories, setCatalogCategories] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    loadRules();
  }, [tenantId]);

  // Live catalog data for the condition editor's PLU/tag pickers, so staff
  // select real values instead of guessing/typing them from memory.
  useEffect(() => {
    const commerceClient = getCommerceClient(tenantId) as any;
    Promise.all([
      commerceClient.getProducts?.() || Promise.resolve([]),
      commerceClient.getCatalog?.() || Promise.resolve(null),
    ])
      .then(([products, catalog]: [Product[], any]) => {
        setCatalogProducts(products || []);
        const flatten = (categories: any[], depth = 0): Array<{ id: string; name: string }> =>
          (categories || []).flatMap((category) => [
            { id: String(category.id), name: `${'— '.repeat(depth)}${category.name || category.id}` },
            ...flatten(category.subcategories || [], depth + 1),
          ]);
        setCatalogCategories(flatten(catalog?.categories || []));
      })
      .catch((err: unknown) => console.warn('[ProductRulesScreen] Could not load catalog for condition pickers:', err));
  }, [tenantId]);

  const availableTags = useMemo(() => {
    const labels = new Map<string, string>();
    catalogProducts.forEach((p) => {
      (p.productTags || []).forEach((tag, index) => {
        const value = String(tag);
        const label = p.productTagLabels?.[index] || (!/^\d+$/.test(value) ? value : undefined);
        if (label) labels.set(value, label);
      });
      (p.tags || []).forEach((tag) => {
        const value = String(tag);
        if (!/^\d+$/.test(value)) labels.set(value, value);
      });
    });
    return Array.from(labels, ([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [catalogProducts]);

  const tagLabel = (value: unknown) =>
    availableTags.find((tag) => tag.value === String(value))?.label || String(value);
  const categoryLabel = (value: unknown) =>
    catalogCategories.find((category) => category.id === String(value))?.name || String(value);

  // Live store geography for the "Applies in" picker, so staff choose real
  // Country/Nation/Region/County values derived from actual store addresses
  // instead of typing country codes from memory.
  useEffect(() => {
    defaultAdminClient
      .getStores(tenantId)
      .then((stores) => setTenantStores(stores || []))
      .catch((err) => console.warn('[ProductRulesScreen] Could not load stores for geography picker:', err));
  }, [tenantId]);

  const availableGeographyTokens = useMemo(() => {
    const tokenSet = new Set<string>();
    tenantStores.forEach((s) => {
      const geo = s.geography;
      if (geo?.country) tokenSet.add(geo.country);
      if (geo?.nation) tokenSet.add(geo.nation);
      if (geo?.region) tokenSet.add(geo.region);
      if (geo?.county) tokenSet.add(geo.county);
      if (!geo && s.address?.country) tokenSet.add(s.address.country);
    });
    return Array.from(tokenSet).sort();
  }, [tenantStores]);

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
    setOperationsError(null);
    try {
      const updated = await defaultAdminClient.updateSchedulingPolicy?.(tenantId, schedulingPolicy);
      if (updated) setSchedulingPolicy(updated);
      setSchedulingSuccessMsg('Scheduling policy saved and active.');
      setTimeout(() => setSchedulingSuccessMsg(null), 4000);
    } catch (err: any) {
      setOperationsError(err.message || 'Failed to save scheduling policy.');
    } finally {
      setSchedulingSaving(false);
    }
  };

  const handleSaveDispatchRules = async (e: React.FormEvent) => {
    e.preventDefault();
    setDispatchSaving(true);
    setDispatchSuccessMsg(null);
    setOperationsError(null);
    try {
      const updated = await defaultAdminClient.saveDispatchRules(tenantId, dispatchRules, currentUser);
      setDispatchRules(updated);
      setDispatchSuccessMsg('Dispatch orchestration rules saved and active.');
      setTimeout(() => setDispatchSuccessMsg(null), 4000);
    } catch (err: any) {
      setOperationsError(err.message || 'Failed to save courier settings.');
    } finally {
      setDispatchSaving(false);
    }
  };

  const handleCreateNew = () => {
    const newRule: VisualRule = {
      id: `rule-${Date.now()}`,
      name: 'New rule',
      enabled: true,
      countries: ['GB'],
      priority: 50,
      matchConditions: [{ field: 'productTag', operator: 'equals', value: '' }],
      actions: [{ type: 'HIDE_PRODUCT' }],
    };
    setEditingRule(newRule);
  };

  const createAction = (type: string): any =>
    type === 'MINIMUM_AGE' ? { type, minimumAge: 18 } :
    type === 'MAX_QUANTITY_PER_ORDER' ? { type, maximum: 1 } :
    type === 'COMBINED_GROUP_LIMIT' ? { type, groupId: 'group', maximum: 1 } :
    type === 'BADGE' ? { type, label: 'Featured' } :
    type === 'WARNING' ? { type, text: 'Important information' } :
    type === 'PREVENT_PURCHASE' ? { type, reason: 'Unavailable' } :
    { type };

  const applyTemplate = (template: 'age' | 'alcohol' | 'quantity' | 'recommendations' | 'discounts') => {
    const base = editingRule || {
      id: `rule-${Date.now()}`, name: 'New rule', enabled: true, countries: ['GB'], priority: 50,
      matchConditions: [], actions: [],
    } as VisualRule;
    if (template === 'age') setEditingRule({ ...base, name: 'Age restricted products', matchConditions: [{ field: 'productTag', operator: 'equals', value: 'AGE_RESTRICTED_18' }], actions: [{ type: 'MINIMUM_AGE', minimumAge: 18 }, { type: 'REQUIRES_COURIER_VERIFICATION', verificationType: 'AGE' }] });
    if (template === 'alcohol') setEditingRule({ ...base, name: 'Alcohol controls', matchConditions: [{ field: 'isAlcohol', operator: 'equals', value: 'true' }], actions: [{ type: 'MINIMUM_AGE', minimumAge: 18 }, { type: 'PREVENT_UPSELL' }] });
    if (template === 'quantity') setEditingRule({ ...base, name: 'Quantity cap', matchConditions: [{ field: 'productTag', operator: 'equals', value: '' }], actions: [{ type: 'MAX_QUANTITY_PER_ORDER', maximum: 2 }] });
    if (template === 'recommendations') setEditingRule({ ...base, name: 'Exclude from promotion', matchConditions: [{ field: 'productTag', operator: 'equals', value: '' }], actions: [{ type: 'PREVENT_UPSELL' }, { type: 'PREVENT_RECOMMENDATION' }, { type: 'PREVENT_STORY_PLACEMENT' }, { type: 'PREVENT_CAROUSEL_PLACEMENT' }] });
    if (template === 'discounts') setEditingRule({ ...base, name: 'Exclude from discounts', matchConditions: [{ field: 'productTag', operator: 'equals', value: '' }], actions: [{ type: 'EXCLUDE_FROM_DISCOUNTS' }] });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule) return;
    const invalidCondition = editingRule.matchConditions.some((condition) => !String(condition.value ?? '').trim());
    if (invalidCondition) { setRuleError('Every Where condition needs a value before this rule can be saved.'); return; }
    if (editingRule.actions.length === 0) { setRuleError('Add at least one action before saving this rule.'); return; }
    setSaving(true);
    setRuleError(null);
    try {
      await defaultAdminClient.saveProductRule(tenantId, editingRule, currentUser);
      await loadRules();
      setEditingRule(null);
    } catch (err: any) {
      console.error('Failed to save product rule:', err);
      setRuleError(err?.message || 'This rule could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ruleId: string) => {
    if (!window.confirm('Delete this rule?')) return;
    setRuleError(null);
    try {
      await defaultAdminClient.deleteProductRule(tenantId, ruleId, currentUser);
      await loadRules();
    } catch (err: any) {
      setRuleError(err?.message || 'This rule could not be deleted.');
    }
  };

  const handleToggle = async (rule: VisualRule) => {
    const updated = { ...rule, enabled: !rule.enabled };
    setRuleError(null);
    try {
      await defaultAdminClient.saveProductRule(tenantId, updated, currentUser);
      await loadRules();
    } catch (err: any) {
      setRuleError(err?.message || 'This rule could not be updated.');
    }
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
            {activeTab === 'dispatch' ? (
              <Truck className="w-5 h-5 text-indigo-600" />
            ) : activeTab === 'scheduling' ? (
              <CalendarClock className="w-5 h-5 text-indigo-600" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
            )}
            <span>
              {activeTab === 'dispatch'
                ? 'Courier Settings'
                : activeTab === 'scheduling'
                ? 'Order Scheduling'
                : 'Product Rules'}
            </span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            {activeTab === 'dispatch'
              ? 'Control courier assignment, provider selection and picking-time orchestration.'
              : activeTab === 'scheduling'
              ? 'Configure ASAP and scheduled-order behaviour independently from product rules.'
              : 'Build product controls with clear Where → Action logic.'}
          </p>
        </div>

        {activeTab === 'product' && (
          <button
            type="button"
            onClick={handleCreateNew}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>New rule</span>
          </button>
        )}
      </div>

      {/* Legacy tabs remain available for direct reuse, but Admin navigation now gives each area its own page. */}
      {!view && <div className="flex items-center gap-3 border-b border-gray-200">
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
          <span>Product rules</span>
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
          <span>Courier settings</span>
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
          <span>Order scheduling</span>
          {schedulingPolicy.acceptAsapOrdersOnly && (
            <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800 font-mono font-semibold">
              ASAP ONLY
            </span>
          )}
        </button>
      </div>}

      {operationsError && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800">
          {operationsError}
        </div>
      )}

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
                Allowed courier providers
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
                <span>{dispatchSaving ? 'Saving…' : 'Save dispatch settings'}</span>
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
                <span>Order scheduling</span>
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
                <span className="text-xs font-bold text-gray-900 block">Accept ASAP orders only</span>
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
                    Pre-order for next opening
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
                    Scheduled pre-order, same day
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
                <span>{schedulingSaving ? 'Saving…' : 'Save scheduling settings'}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {activeTab === 'product' && (
      <div className="grid grid-cols-1 gap-4">
        {ruleError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800">{ruleError}</div>}
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div><h3 className="text-sm font-bold text-gray-900">Quick templates</h3><p className="text-xs text-gray-500 mt-0.5">Start with a common retail control, then customise it.</p></div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => applyTemplate('age')} className="px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-xs font-bold hover:bg-gray-100">18+ products</button>
              <button type="button" onClick={() => applyTemplate('alcohol')} className="px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-xs font-bold hover:bg-gray-100">Alcohol controls</button>
              <button type="button" onClick={() => applyTemplate('quantity')} className="px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-xs font-bold hover:bg-gray-100">Quantity cap</button>
              <button type="button" onClick={() => applyTemplate('recommendations')} className="px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-xs font-bold hover:bg-gray-100">No promotion</button>
              <button type="button" onClick={() => applyTemplate('discounts')} className="px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-xs font-bold hover:bg-gray-100">No discounts</button>
            </div>
          </div>
        </div>
        {rules.length === 0 && <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center"><ShieldCheck className="w-8 h-8 text-gray-300 mx-auto mb-3"/><h3 className="text-sm font-bold text-gray-900">No product rules yet</h3><p className="text-xs text-gray-500 mt-1">Create a rule to control matching products by tag, category, brand, group, alcohol status or PLU.</p><button type="button" onClick={handleCreateNew} className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold">Create first rule</button></div>}
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
                  <span className="text-gray-400 text-[11px]">Where:</span>
                  {r.matchConditions.map((cond, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-lg bg-gray-100 text-gray-700 font-mono text-[11px]"
                    >
                      {cond.field} {cond.operator} "{cond.field === 'productTag' ? tagLabel(cond.value) : cond.field === 'category' ? categoryLabel(cond.value) : String(cond.value)}"
                    </span>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
                  <span className="text-gray-400 text-[11px]">Action:</span>
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
            <div><h3 className="text-base font-bold text-gray-900">{rules.some((r) => r.id === editingRule.id) ? 'Edit product rule' : 'Create product rule'}</h3><p className="text-xs text-gray-500 mt-1">When the <strong>Where</strong> condition matches, the selected <strong>Action</strong> is applied.</p></div>
            {ruleError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">{ruleError}</div>}

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2 flex flex-wrap items-center gap-2 text-[11px]">
                <span className="font-bold text-gray-500">Rule preview</span>
                <span className="px-2 py-1 rounded-lg bg-white border border-gray-200">WHERE {editingRule.matchConditions.length} condition{editingRule.matchConditions.length === 1 ? '' : 's'}</span>
                <span className="text-gray-400">→</span>
                <span className="px-2 py-1 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-800 font-bold">{editingRule.actions.length} action{editingRule.actions.length === 1 ? '' : 's'}</span>
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Rule name</label>
                <input
                  type="text"
                  value={editingRule.name}
                  onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl font-semibold"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Applies in</label>
                  <input
                    type="text"
                    value={editingRule.countries.join(', ')}
                    onChange={(e)=>setEditingRule({...editingRule,countries:e.target.value.split(',').map(v=>v.trim()).filter(Boolean)})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl"
                    placeholder="GB, England, Essex…"
                    list="rule-geography-options"
                  />
                  <datalist id="rule-geography-options">
                    {availableGeographyTokens.map((token) => <option key={token} value={token} />)}
                  </datalist>
                  <p className="text-[10px] text-gray-400 mt-1">Country, nation (UK), region or county — derived from your stores' real addresses. Matches if the customer's store is in any of these, separated by commas.</p>
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Priority (higher runs first)</label>
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
                  <label className="block font-bold text-gray-700 mb-1">Status</label>
                  <label className="flex items-center gap-2 pt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingRule.enabled}
                      onChange={(e) => setEditingRule({ ...editingRule, enabled: e.target.checked })}
                      className="rounded text-indigo-600 w-4 h-4"
                    />
                    <span className="font-bold text-gray-800">Rule is active</span>
                  </label>
                </div>
              </div>

              {/* Where Editor */}
              <div className="p-3 bg-gray-50 rounded-xl space-y-3 border border-gray-100">
                <div className="flex items-center justify-between"><span className="font-bold text-gray-700">Where <span className="font-normal text-gray-400">all conditions match</span></span><button type="button" onClick={() => setEditingRule({...editingRule, matchConditions:[...editingRule.matchConditions,{field:'productTag',operator:'equals',value:''}]})} className="text-[11px] font-bold text-indigo-700">+ Add condition</button></div>
                {editingRule.matchConditions.map((condition, index) => <div key={index} className="grid grid-cols-[1fr_0.8fr_1.2fr_auto] gap-2 items-center">
                  <select value={condition.field} onChange={(e)=>{const a=[...editingRule.matchConditions];a[index]={...a[index],field:e.target.value as any};setEditingRule({...editingRule,matchConditions:a})}} className="px-2 py-2 border border-gray-200 rounded-lg bg-white"><option value="productTag">Product tag</option><option value="category">Category</option><option value="brand">Brand</option><option value="ruleGroup">Rule group</option><option value="isAlcohol">Alcohol product</option><option value="plu">PLU</option></select>
                  <select value={condition.operator} onChange={(e)=>{const a=[...editingRule.matchConditions];a[index]={...a[index],operator:e.target.value as any};setEditingRule({...editingRule,matchConditions:a})}} className="px-2 py-2 border border-gray-200 rounded-lg bg-white"><option value="equals">is</option><option value="contains">contains</option><option value="in">is one of</option></select>
                  {condition.field === 'productTag' ? (
                    <select value={String(condition.value||'')} onChange={(e)=>{const a=[...editingRule.matchConditions];a[index]={...a[index],value:e.target.value};setEditingRule({...editingRule,matchConditions:a})}} className="px-2 py-2 border border-gray-200 rounded-lg bg-white">
                      <option value="">Select product tag…</option>
                      {availableTags.map((tag) => <option key={tag.value} value={tag.value}>{tag.label}</option>)}
                    </select>
                  ) : condition.field === 'category' ? (
                    <select value={String(condition.value||'')} onChange={(e)=>{const a=[...editingRule.matchConditions];a[index]={...a[index],value:e.target.value};setEditingRule({...editingRule,matchConditions:a})}} className="px-2 py-2 border border-gray-200 rounded-lg bg-white">
                      <option value="">Select category…</option>
                      {catalogCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                    </select>
                  ) : condition.field === 'isAlcohol' ? (
                    <select value={String(condition.value||'')} onChange={(e)=>{const a=[...editingRule.matchConditions];a[index]={...a[index],value:e.target.value};setEditingRule({...editingRule,matchConditions:a})}} className="px-2 py-2 border border-gray-200 rounded-lg bg-white">
                      <option value="">Choose…</option><option value="true">Yes — alcoholic</option><option value="false">No — non-alcoholic</option>
                    </select>
                  ) : (
                    <input type="text" value={String(condition.value||'')} onChange={(e)=>{const a=[...editingRule.matchConditions];a[index]={...a[index],value:e.target.value};setEditingRule({...editingRule,matchConditions:a})}} className="px-2 py-2 border border-gray-200 rounded-lg bg-white" placeholder={condition.field==='plu'?'Search PLU or product name…':'Value'} list={condition.field==='plu'?'rule-plu-options':undefined}/>
                  )}
                  <button type="button" disabled={editingRule.matchConditions.length===1} onClick={()=>setEditingRule({...editingRule,matchConditions:editingRule.matchConditions.filter((_,i)=>i!==index)})} className="p-2 text-gray-400 hover:text-red-600 disabled:opacity-30" aria-label="Remove condition"><Trash2 className="w-4 h-4"/></button>
                </div>)}
                {/* Live catalog data backing the PLU/tag condition pickers above, instead of staff guessing exact values */}
                <datalist id="rule-plu-options">
                  {catalogProducts.map((p) => <option key={p.plu} value={p.plu}>{p.name}</option>)}
                </datalist>
                <datalist id="rule-tag-options">
                  {availableTags.map((tag) => <option key={tag.value} value={tag.value}>{tag.label}</option>)}
                </datalist>
              </div>

              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 space-y-3">
                <div className="flex items-center justify-between"><span className="font-bold text-gray-700">Actions <span className="font-normal text-gray-400">apply all</span></span><button type="button" onClick={()=>setEditingRule({...editingRule,actions:[...editingRule.actions,{type:'HIDE_PRODUCT'}]})} className="text-[11px] font-bold text-indigo-700">+ Add action</button></div>
                {editingRule.actions.map((action,index)=><div key={index} className="rounded-xl bg-white border border-indigo-100 p-2 space-y-2">
                  <div className="flex gap-2"><select value={action.type} onChange={(e)=>{const a=[...editingRule.actions];a[index]=createAction(e.target.value);setEditingRule({...editingRule,actions:a})}} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg bg-white font-semibold"><option value="HIDE_PRODUCT">Hide product</option><option value="PREVENT_PURCHASE">Prevent purchase</option><option value="MAX_QUANTITY_PER_ORDER">Limit quantity per order</option><option value="COMBINED_GROUP_LIMIT">Limit combined group quantity</option><option value="MINIMUM_AGE">Require minimum age</option><option value="PREVENT_UPSELL">Exclude from upsells</option><option value="PREVENT_RECOMMENDATION">Exclude from recommendations</option><option value="EXCLUDE_FROM_DISCOUNTS">Exclude from discounts</option><option value="PREVENT_STORY_PLACEMENT">Exclude from stories</option><option value="PREVENT_CAROUSEL_PLACEMENT">Exclude from carousels</option><option value="REQUIRES_COURIER_VERIFICATION">Require courier verification</option><option value="REQUIRES_ALLERGEN_DISPLAY">Require allergen display</option><option value="BADGE">Show badge</option><option value="WARNING">Show warning</option></select><button type="button" disabled={editingRule.actions.length===1} onClick={()=>setEditingRule({...editingRule,actions:editingRule.actions.filter((_,i)=>i!==index)})} className="p-2 text-gray-400 hover:text-red-600 disabled:opacity-30"><Trash2 className="w-4 h-4"/></button></div>
                  {action.type==='MAX_QUANTITY_PER_ORDER'&&<input type="number" min="1" value={(action as any).maximum||1} onChange={(e)=>{const a:any[]=[...editingRule.actions];a[index]={...a[index],maximum:Math.max(1,Number(e.target.value)||1)};setEditingRule({...editingRule,actions:a})}} className="w-full px-3 py-2 border border-gray-200 rounded-lg" />}
                  {action.type==='MINIMUM_AGE'&&<input type="number" min="1" max="100" value={(action as any).minimumAge||18} onChange={(e)=>{const a:any[]=[...editingRule.actions];a[index]={...a[index],minimumAge:Math.max(1,Number(e.target.value)||18)};setEditingRule({...editingRule,actions:a})}} className="w-full px-3 py-2 border border-gray-200 rounded-lg" />}
                  {action.type==='COMBINED_GROUP_LIMIT'&&<div className="grid grid-cols-2 gap-2"><input value={(action as any).groupId||''} onChange={(e)=>{const a:any[]=[...editingRule.actions];a[index]={...a[index],groupId:e.target.value};setEditingRule({...editingRule,actions:a})}} className="px-3 py-2 border border-gray-200 rounded-lg" placeholder="Group ID"/><input type="number" min="1" value={(action as any).maximum||1} onChange={(e)=>{const a:any[]=[...editingRule.actions];a[index]={...a[index],maximum:Math.max(1,Number(e.target.value)||1)};setEditingRule({...editingRule,actions:a})}} className="px-3 py-2 border border-gray-200 rounded-lg" placeholder="Limit"/></div>}
                  {action.type==='PREVENT_PURCHASE'&&<input value={(action as any).reason||''} onChange={(e)=>{const a:any[]=[...editingRule.actions];a[index]={...a[index],reason:e.target.value};setEditingRule({...editingRule,actions:a})}} className="w-full px-3 py-2 border border-gray-200 rounded-lg" placeholder="Reason shown to customer"/>}
                  {action.type==='BADGE'&&<input value={(action as any).label||''} onChange={(e)=>{const a:any[]=[...editingRule.actions];a[index]={...a[index],label:e.target.value};setEditingRule({...editingRule,actions:a})}} className="w-full px-3 py-2 border border-gray-200 rounded-lg" placeholder="Badge text"/>}
                  {action.type==='WARNING'&&<input value={(action as any).text||''} onChange={(e)=>{const a:any[]=[...editingRule.actions];a[index]={...a[index],text:e.target.value};setEditingRule({...editingRule,actions:a})}} className="w-full px-3 py-2 border border-gray-200 rounded-lg" placeholder="Warning message"/>}
                </div>)}
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
                  {saving ? 'Saving...' : 'Save rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
