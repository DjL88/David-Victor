import React, { useState, useEffect } from 'react';
import { TenantFeePolicy, AdminUser, moneyToMajor } from '../../commerce/models';
import { defaultAdminClient } from '../../commerce/HttpAdminClient';
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

  useEffect(() => {
    loadPolicy();
  }, [tenantId]);

  const loadPolicy = async () => {
    setLoading(true);
    try {
      const data = await defaultAdminClient.getFeePolicy(tenantId);
      setPolicy(data);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!policy) return;
    setSaving(true);
    setSaveSuccess(false);

    try {
      const updated = await defaultAdminClient.updateFeePolicy(tenantId, policy, currentUser);
      setPolicy(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !policy) {
    return (
      <div className="p-8 flex items-center justify-center text-gray-500">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        <span>Loading fee policy...</span>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Coins className="w-5 h-5 text-indigo-600" />
            <span>Authoritative Tenant Fee Policy</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Rules defined here are evaluated exclusively by the Backend-for-Frontend when reconciling baskets.
          </p>
        </div>

        {saveSuccess && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 animate-in fade-in">
            <Check className="w-4 h-4" />
            <span>Policy published & audited</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* DELIVERY FEE CONFIGURATION */}
        <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <span>1. Courier Delivery Fee Formula</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-gray-700 mb-1">Calculation Mode</label>
              <select
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
                  type="number"
                  step="0.01"
                  value={moneyToMajor(policy.fixedDeliveryFee ?? 1.99)}
                  onChange={(e) =>
                    setPolicy({ ...policy, fixedDeliveryFee: parseFloat(e.target.value) || 0 })
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
                  value={moneyToMajor(policy.dispatchFixedSurcharge ?? 0.5)}
                  onChange={(e) =>
                    setPolicy({
                      ...policy,
                      dispatchFixedSurcharge: parseFloat(e.target.value) || 0,
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
                value={moneyToMajor(policy.freeDeliveryThreshold ?? 35.0)}
                onChange={(e) =>
                  setPolicy({
                    ...policy,
                    freeDeliveryThreshold: parseFloat(e.target.value) || 0,
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
          <h3 className="text-sm font-bold text-gray-900">2. Service Fee & Packaging Charges</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-bold text-gray-700 mb-1">Service Fee Mode</label>
              <select
                value={policy.serviceFeeMode}
                onChange={(e) =>
                  setPolicy({ ...policy, serviceFeeMode: e.target.value as any })
                }
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
                step="0.01"
                value={policy.serviceFeeAmount}
                onChange={(e) =>
                  setPolicy({ ...policy, serviceFeeAmount: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-xl font-semibold"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">Recyclable Bag Fee (£)</label>
              <input
                type="number"
                step="0.05"
                value={moneyToMajor(policy.bagFee)}
                onChange={(e) =>
                  setPolicy({ ...policy, bagFee: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-xl font-semibold"
              />
              <span className="text-[10px] text-gray-400 block mt-1">
                Mandated under retail carrier bag statutory regulations
              </span>
            </div>
          </div>
        </div>

        {/* SMALL ORDER THRESHOLD */}
        <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-gray-900">3. Basket Minimums & Small Order Surcharges</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-gray-700 mb-1">Minimum Basket Threshold (£)</label>
              <input
                type="number"
                step="1.00"
                value={moneyToMajor(policy.minimumBasketThreshold ?? 10.0)}
                onChange={(e) =>
                  setPolicy({
                    ...policy,
                    minimumBasketThreshold: parseFloat(e.target.value) || 0,
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
                value={moneyToMajor(policy.smallOrderFee ?? 1.5)}
                onChange={(e) =>
                  setPolicy({ ...policy, smallOrderFee: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-xl font-semibold"
              />
              <span className="text-[10px] text-gray-400 block mt-1">
                Applied when order subtotal is below the minimum basket threshold
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
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-xs hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            <span>Publish Fee Policy</span>
          </button>
        </div>
      </form>
    </div>
  );
};
