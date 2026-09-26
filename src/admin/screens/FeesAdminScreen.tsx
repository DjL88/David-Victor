import React, { useState, useEffect } from 'react';
import {
  TenantFeePolicy,
  AdminUser,
  policyFeeToMajor,
  policyFeeToMinor,
} from '../../commerce/models';
import { defaultAdminClient } from '../../commerce/HttpAdminClient';
import { onAdminAiPrefill } from '../adminAiGuide';
import { Coins, Check, RefreshCw, AlertCircle, Info } from 'lucide-react';

interface FeesAdminScreenProps {
  tenantId: string;
  currentUser: AdminUser;
}

export const FeesAdminScreen: React.FC<FeesAdminScreenProps> = ({
  tenantId,
  currentUser,
}) => {
  const [policy, setPolicy] = useState<TenantFeePolicy | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    loadPolicy();
  }, [tenantId]);

  const loadPolicy = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await defaultAdminClient.getFeePolicy(tenantId);
      setPolicy(data);
    } catch (err: any) {
      if (err?.code === 'POLICY_NOT_FOUND') {
        setPolicy({ deliveryFeeMode: 'FREE', serviceFeeMode: 'NONE', serviceFeeAmount: 0, bagFee: 0, smallOrderFeeEnabled: false, serviceFeeEnabled: false });
        setError('No fee policy has been configured. These are unsaved zero-fee fields; review and save to create the first policy.');
        return;
      }
      console.error(err);
      setPolicy(null);
      setError('Unable to load fee settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() =>
    onAdminAiPrefill('fees', ({ prefill }) => {
      if (!prefill) return;
      setPolicy((current) => {
        if (!current) return current;
        const next = { ...current };
        if (typeof prefill.deliveryFeeMode === 'string') {
          next.deliveryFeeMode = prefill.deliveryFeeMode as TenantFeePolicy['deliveryFeeMode'];
        }
        if (typeof prefill.fixedDeliveryFeeMajor === 'number') {
          next.fixedDeliveryFee = Math.round(prefill.fixedDeliveryFeeMajor * 100);
        }
        if (typeof prefill.freeDeliveryThresholdMajor === 'number') {
          next.freeDeliveryThreshold = Math.round(prefill.freeDeliveryThresholdMajor * 100);
        }
        if (typeof prefill.serviceFeeMode === 'string') {
          next.serviceFeeMode = prefill.serviceFeeMode as TenantFeePolicy['serviceFeeMode'];
        }
        if (typeof prefill.serviceFeeAmount === 'number') {
          next.serviceFeeAmount = next.serviceFeeMode === 'PERCENT'
            ? prefill.serviceFeeAmount
            : Math.round(prefill.serviceFeeAmount * 100);
        }
        if (typeof prefill.bagFeeMajor === 'number') {
          next.bagFee = Math.round(prefill.bagFeeMajor * 100);
        }
        if (typeof prefill.minimumBasketThresholdMajor === 'number') {
          next.minimumBasketThreshold = Math.round(prefill.minimumBasketThresholdMajor * 100);
        }
        if (typeof prefill.smallOrderFeeMajor === 'number') {
          next.smallOrderFee = Math.round(prefill.smallOrderFeeMajor * 100);
        }
        return next;
      });
    }),
  []);

  const handleServiceFeeModeChange = (newMode: 'FIXED' | 'PERCENT' | 'NONE') => {
    if (!policy) return;
    let newAmount = policy.serviceFeeAmount;
    if (newMode === 'FIXED') {
      // If switching from PERCENT or if current value is percentage range, set default minor units (49p = £0.49)
      if (policy.serviceFeeMode === 'PERCENT' || newAmount <= 20) {
        newAmount = 49;
      }
    } else if (newMode === 'PERCENT') {
      // If switching from FIXED or if current value is minor units (>20), set default percentage (3.5%)
      if (policy.serviceFeeMode === 'FIXED' || newAmount > 20) {
        newAmount = 3.5;
      }
    }
    setPolicy({
      ...policy,
      serviceFeeMode: newMode,
      serviceFeeAmount: newAmount,
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!policy) return;
    setSaving(true);
    setSaveSuccess(false);
    setError('');

    try {
      // Ensure all monetary fields saved to server are normalized minor units
      const normalizedPolicy: TenantFeePolicy = {
        ...policy,
        fixedDeliveryFee: policy.fixedDeliveryFee !== undefined ? policyFeeToMinor(policy.fixedDeliveryFee, 199) : undefined,
        dispatchFixedSurcharge: policy.dispatchFixedSurcharge !== undefined ? policyFeeToMinor(policy.dispatchFixedSurcharge, 50) : undefined,
        freeDeliveryThreshold: policy.freeDeliveryThreshold !== undefined ? policyFeeToMinor(policy.freeDeliveryThreshold, 3500) : undefined,
        serviceFeeAmount: policy.serviceFeeMode === 'PERCENT'
          ? (policy.serviceFeeAmount ?? 0)
          : policyFeeToMinor(policy.serviceFeeAmount, 49),
        serviceFeeMinCap: policy.serviceFeeMinCap !== undefined ? policyFeeToMinor(policy.serviceFeeMinCap, 49) : undefined,
        serviceFeeMaxCap: policy.serviceFeeMaxCap !== undefined ? policyFeeToMinor(policy.serviceFeeMaxCap, 350) : undefined,
        bagFee: policyFeeToMinor(policy.bagFee, 30),
        minimumBasketThreshold: policy.minimumBasketThreshold !== undefined ? policyFeeToMinor(policy.minimumBasketThreshold, 1000) : undefined,
        smallOrderFee: policy.smallOrderFee !== undefined ? policyFeeToMinor(policy.smallOrderFee, 150) : undefined,
      };

      const updated = await defaultAdminClient.updateFeePolicy(tenantId, normalizedPolicy, currentUser);
      setPolicy(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      setError('Fee settings could not be saved. Your edits are still on screen.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center text-gray-500">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        <span>Loading fee policy...</span>
      </div>
    );
  }

  if (!policy) {
    return <div className="p-8 text-center"><div role="alert" className="text-sm font-semibold text-rose-700">{error || 'Fee settings are unavailable.'}</div><button type="button" onClick={loadPolicy} className="mt-3 text-xs font-bold text-indigo-700 underline">Retry</button></div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Coins className="w-5 h-5 text-indigo-600" />
            <span>Fees & basket charges</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Configure the fees and basket thresholds applied to this brand.
          </p>
        </div>

        {saveSuccess && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 animate-in fade-in">
            <Check className="w-4 h-4" />
            <span>Fee settings saved</span>
          </div>
        )}
      </div>

      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800">{error}</div>}

      <form onSubmit={handleSave} className="space-y-6">
        {/* DELIVERY FEE CONFIGURATION */}
        <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <span>Delivery fee</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-gray-700 mb-1">Calculation Mode</label>
              <select
                data-admin-ai-target="fees-delivery-mode"
                value={policy.deliveryFeeMode}
                onChange={(e) =>
                  setPolicy({ ...policy, deliveryFeeMode: e.target.value as any })
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-xl font-semibold bg-white"
              >
                <option value="FIXED">Fixed Flat Fee (e.g. £1.99)</option>
                <option value="DISPATCH_COST">Pass-Through Deliverect Dispatch Quote</option>
                <option value="DISPATCH_PLUS_FIXED">Dispatch Cost + Fixed Brand Surcharge</option>
                <option value="DISPATCH_PLUS_PERCENT">Dispatch Cost + Percentage Margin</option>
                <option value="FREE">Always Free Delivery</option>
              </select>
            </div>

            {policy.deliveryFeeMode === 'FIXED' && (
              <div>
                <label className="block font-bold text-gray-700 mb-1">Fixed Delivery Fee (£)</label>
                <input
                  data-admin-ai-target="fees-fixed-delivery"
                  type="number"
                  step="0.01"
                  value={policyFeeToMajor(policy.fixedDeliveryFee, 199)}
                  onChange={(e) =>
                    setPolicy({
                      ...policy,
                      fixedDeliveryFee: Math.round((parseFloat(e.target.value) || 0) * 100),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl font-semibold"
                />
              </div>
            )}

            {policy.deliveryFeeMode === 'DISPATCH_PLUS_FIXED' && (
              <div>
                <label className="block font-bold text-gray-700 mb-1">Fixed Brand Surcharge (£)</label>
                <input
                  type="number"
                  step="0.01"
                  value={policyFeeToMajor(policy.dispatchFixedSurcharge, 50)}
                  onChange={(e) =>
                    setPolicy({
                      ...policy,
                      dispatchFixedSurcharge: Math.round((parseFloat(e.target.value) || 0) * 100),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl font-semibold"
                />
              </div>
            )}

            {policy.deliveryFeeMode === 'DISPATCH_PLUS_PERCENT' && (
              <div>
                <label className="block font-bold text-gray-700 mb-1">Percentage Surcharge (%)</label>
                <input
                  type="number"
                  step="0.5"
                  value={policy.dispatchPercentSurcharge ?? 10}
                  onChange={(e) =>
                    setPolicy({
                      ...policy,
                      dispatchPercentSurcharge: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl font-semibold"
                />
              </div>
            )}

            <div>
              <label className="block font-bold text-gray-700 mb-1">Free Delivery Threshold (£)</label>
              <input
                type="number"
                step="1.00"
                value={policyFeeToMajor(policy.freeDeliveryThreshold, 3500)}
                onChange={(e) =>
                  setPolicy({
                    ...policy,
                    freeDeliveryThreshold: Math.round((parseFloat(e.target.value) || 0) * 100),
                  })
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-xl font-semibold"
              />
              <span className="text-[10px] text-gray-400 block mt-1">
                Subtotal at which delivery fee automatically waives to £0.00
              </span>
            </div>
          </div>
        </div>

        {/* SERVICE FEE & BAG FEE */}
        <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">Service fee & packaging</h3>
            <label className="flex items-center gap-2 font-bold text-xs text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={policy.serviceFeeEnabled ?? true}
                onChange={(e) =>
                  setPolicy({ ...policy, serviceFeeEnabled: e.target.checked })
                }
                className="rounded text-indigo-600 w-4 h-4"
              />
              <span>Enable Service Fee</span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-bold text-gray-700 mb-1">Service Fee Mode</label>
              <select
                value={policy.serviceFeeMode}
                onChange={(e) => handleServiceFeeModeChange(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl font-semibold bg-white"
              >
                <option value="FIXED">Fixed Service Fee</option>
                <option value="PERCENT">Percentage of Subtotal</option>
                <option value="NONE">No Service Fee</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">
                {policy.serviceFeeMode === 'PERCENT' ? 'Service Fee (%)' : 'Service Fee (£)'}
              </label>
              <input
                type="number"
                step={policy.serviceFeeMode === 'PERCENT' ? '0.1' : '0.01'}
                value={
                  policy.serviceFeeMode === 'PERCENT'
                    ? (policy.serviceFeeAmount ?? 0)
                    : policyFeeToMajor(policy.serviceFeeAmount, 49)
                }
                onChange={(e) =>
                  setPolicy({
                    ...policy,
                    serviceFeeAmount:
                      policy.serviceFeeMode === 'PERCENT'
                        ? (parseFloat(e.target.value) || 0)
                        : Math.round((parseFloat(e.target.value) || 0) * 100),
                  })
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-xl font-semibold"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">Recyclable Bag Fee (£)</label>
              <input
                type="number"
                step="0.05"
                value={policyFeeToMajor(policy.bagFee, 30)}
                onChange={(e) =>
                  setPolicy({
                    ...policy,
                    bagFee: Math.round((parseFloat(e.target.value) || 0) * 100),
                  })
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-xl font-semibold"
              />
              <span className="text-[10px] text-gray-400 block mt-1">
                Mandated under retail carrier bag statutory regulations
              </span>
            </div>
          </div>

          {policy.serviceFeeMode === 'PERCENT' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2 border-t border-gray-100">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Service Fee Min Cap (£)</label>
                <input
                  type="number"
                  step="0.01"
                  value={policyFeeToMajor(policy.serviceFeeMinCap, 49)}
                  onChange={(e) =>
                    setPolicy({
                      ...policy,
                      serviceFeeMinCap: Math.round((parseFloat(e.target.value) || 0) * 100),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Service Fee Max Cap (£)</label>
                <input
                  type="number"
                  step="0.01"
                  value={policyFeeToMajor(policy.serviceFeeMaxCap, 350)}
                  onChange={(e) =>
                    setPolicy({
                      ...policy,
                      serviceFeeMaxCap: Math.round((parseFloat(e.target.value) || 0) * 100),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl font-semibold"
                />
              </div>
            </div>
          )}
        </div>

        {/* SMALL ORDER THRESHOLD */}
        <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">Basket minimums & small orders</h3>
            <label className="flex items-center gap-2 font-bold text-xs text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={policy.smallOrderFeeEnabled ?? true}
                onChange={(e) =>
                  setPolicy({ ...policy, smallOrderFeeEnabled: e.target.checked })
                }
                className="rounded text-indigo-600 w-4 h-4"
              />
              <span>Enable Small Order Surcharge</span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-gray-700 mb-1">Minimum Basket Threshold (£)</label>
              <input
                type="number"
                step="1.00"
                value={policyFeeToMajor(policy.minimumBasketThreshold, 1000)}
                onChange={(e) =>
                  setPolicy({
                    ...policy,
                    minimumBasketThreshold: Math.round((parseFloat(e.target.value) || 0) * 100),
                  })
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-xl font-semibold"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">Small Order Surcharge (£)</label>
              <input
                type="number"
                step="0.10"
                value={policyFeeToMajor(policy.smallOrderFee, 150)}
                onChange={(e) =>
                  setPolicy({
                    ...policy,
                    smallOrderFee: Math.round((parseFloat(e.target.value) || 0) * 100),
                  })
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-xl font-semibold"
              />
              <span className="text-[10px] text-gray-400 block mt-1">
                Applied when order subtotal is below the minimum basket threshold
              </span>
            </div>
          </div>
        </div>

        {/* REAUTHORIZATION & PAYMENT TOLERANCE */}
        <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-gray-900">Payment tolerance</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-gray-700 mb-1">Reauthorization Variance Tolerance (%)</label>
              <input
                type="number"
                step="1"
                min="0"
                max="100"
                value={policy.reauthorizationTolerancePercent ?? 10}
                onChange={(e) =>
                  setPolicy({
                    ...policy,
                    reauthorizationTolerancePercent: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-xl font-semibold"
              />
              <span className="text-[10px] text-gray-400 block mt-1">
                Tolerated percentage variance for substituted or weighted picking items before triggering full customer re-authentication
              </span>
            </div>
          </div>
        </div>

        <div className="pt-2 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={loadPolicy}
            className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100"
          >
            Reset
          </button>
          <button data-admin-ai-target="fees-save"
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-xs hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            <span>Save fee settings</span>
          </button>
        </div>
      </form>
    </div>
  );
};
