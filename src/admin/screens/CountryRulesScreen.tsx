import React, { useState, useEffect } from 'react';
import { AdminUser } from '../../commerce/models';
import { defaultAdminClient } from '../../commerce/HttpAdminClient';
import { Globe, Shield, Check, RefreshCw, AlertTriangle } from 'lucide-react';

interface CountryRulesScreenProps {
  tenantId: string;
  currentUser: AdminUser;
}

export const CountryRulesScreen: React.FC<CountryRulesScreenProps> = ({
  tenantId,
  currentUser,
}) => {
  const [country, setCountry] = useState<string>('GB');
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Statutory parameters for selected country
  const [ageThreshold, setAgeThreshold] = useState<number>(18);
  const [requireCourierChallenge25, setRequireCourierChallenge25] = useState<boolean>(true);
  const [requireAlcoholLicenceDisplay, setRequireAlcoholLicenceDisplay] = useState<boolean>(true);
  const [enableDrsDeposit, setEnableDrsDeposit] = useState<boolean>(true);
  const [drsCanFee, setDrsCanFee] = useState<number>(0.20);
  const [hfssPromotionBan, setHfssPromotionBan] = useState<boolean>(true);
  const [otcMedicineOrderLimit, setOtcMedicineOrderLimit] = useState<number>(2);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);

    try {
      const payload = [
        { key: 'ageThreshold', value: ageThreshold },
        { key: 'requireCourierChallenge25', value: requireCourierChallenge25 },
        { key: 'requireAlcoholLicenceDisplay', value: requireAlcoholLicenceDisplay },
        { key: 'enableDrsDeposit', value: enableDrsDeposit },
        { key: 'drsCanFee', value: drsCanFee },
        { key: 'hfssPromotionBan', value: hfssPromotionBan },
        { key: 'otcMedicineOrderLimit', value: otcMedicineOrderLimit },
      ];

      await defaultAdminClient.updateCountryRules(tenantId, country, payload, currentUser);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Globe className="w-5 h-5 text-indigo-600" />
            <span>Country Statutory & Regulatory Rules</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Configure jurisdiction-level regulatory obligations evaluated by the Rule Engine.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-gray-700">Jurisdiction:</label>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-bold bg-white"
          >
            <option value="GB">United Kingdom (GB)</option>
            <option value="IE">Ireland (IE)</option>
            <option value="US">United States (US)</option>
          </select>
        </div>
      </div>

      {saveSuccess && (
        <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 animate-in fade-in">
          <Check className="w-4 h-4" />
          <span>Country regulatory configuration saved and synced across stores</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Challenge 25 & Age Verification */}
        <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-red-600" />
            <h3 className="text-sm font-bold text-gray-900">Alcohol & Age Verification Policy</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-gray-700 mb-1">Statutory Age Threshold</label>
              <input
                type="number"
                value={ageThreshold}
                onChange={(e) => setAgeThreshold(parseInt(e.target.value) || 18)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl font-semibold"
              />
            </div>

            <div className="flex flex-col justify-center space-y-2 pt-2">
              <label className="flex items-center gap-2 font-bold text-gray-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requireCourierChallenge25}
                  onChange={(e) => setRequireCourierChallenge25(e.target.checked)}
                  className="rounded text-indigo-600 w-4 h-4"
                />
                <span>Mandate Courier "Challenge 25" Physical ID Check at Door</span>
              </label>

              <label className="flex items-center gap-2 font-bold text-gray-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requireAlcoholLicenceDisplay}
                  onChange={(e) => setRequireAlcoholLicenceDisplay(e.target.checked)}
                  className="rounded text-indigo-600 w-4 h-4"
                />
                <span>Display Premises Licence on Store Information</span>
              </label>
            </div>
          </div>
        </div>

        {/* Deposit Return Scheme & HFSS */}
        <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-gray-900">DRS & HFSS Statutory Compliance</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-3">
              <label className="flex items-center gap-2 font-bold text-gray-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableDrsDeposit}
                  onChange={(e) => setEnableDrsDeposit(e.target.checked)}
                  className="rounded text-indigo-600 w-4 h-4"
                />
                <span>Enable Deposit Return Scheme (DRS) Bottle Fees</span>
              </label>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Default Can/Bottle Deposit (£)</label>
                <input
                  type="number"
                  step="0.05"
                  value={drsCanFee}
                  onChange={(e) => setDrsCanFee(parseFloat(e.target.value) || 0.20)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl font-semibold"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-2 font-bold text-gray-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hfssPromotionBan}
                  onChange={(e) => setHfssPromotionBan(e.target.checked)}
                  className="rounded text-indigo-600 w-4 h-4"
                />
                <span>Enforce HFSS Upsell & Checkout Promotion Restrictions</span>
              </label>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Max OTC Analgesic Packs per Order</label>
                <input
                  type="number"
                  value={otcMedicineOrderLimit}
                  onChange={(e) => setOtcMedicineOrderLimit(parseInt(e.target.value) || 2)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl font-semibold"
                />
                <span className="text-[10px] text-gray-400 block mt-1">
                  MHRA regulations prohibit selling &gt; 2 packs of paracetamol/ibuprofen per transaction
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-2 flex items-center justify-end gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-xs hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            <span>Publish Country Regulations</span>
          </button>
        </div>
      </form>
    </div>
  );
};
