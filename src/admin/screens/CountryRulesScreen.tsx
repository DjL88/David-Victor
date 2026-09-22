import React, { useState } from 'react';
import { Globe, Shield, AlertTriangle } from 'lucide-react';

interface CountryRulesScreenProps {
  tenantId: string;
  currentUser: unknown;
}

export const CountryRulesScreen: React.FC<CountryRulesScreenProps> = ({
  tenantId: _tenantId,
  currentUser: _currentUser,
}) => {
  const [country, setCountry] = useState<string>('GB');

  // Statutory parameters for selected country
  const [ageThreshold, setAgeThreshold] = useState<number>(18);
  const [requireCourierChallenge25, setRequireCourierChallenge25] = useState<boolean>(true);
  const [requireAlcoholLicenceDisplay, setRequireAlcoholLicenceDisplay] = useState<boolean>(true);
  const [enableDrsDeposit, setEnableDrsDeposit] = useState<boolean>(true);
  const [drsCanFee, setDrsCanFee] = useState<number>(0.20);
  const [hfssPromotionBan, setHfssPromotionBan] = useState<boolean>(true);
  const [otcMedicineOrderLimit, setOtcMedicineOrderLimit] = useState<number>(2);

  // NOTE: HttpAdminClient.getCountryRules / updateCountryRules are not yet wired to a
  // BFF endpoint or persistence backend (no /admin/tenants/:id/country-rules route
  // exists in server/api/v1Router.ts). Until that backend is built, this screen is
  // display-only so it never claims a save succeeded when nothing was persisted.

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Globe className="w-5 h-5 text-indigo-600" />
            <span>Country Rules</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Review the regulatory controls planned for each jurisdiction. Editing stays disabled until these rules have a durable backend and enforcement path.
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

      <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-50 text-amber-800 text-xs font-semibold border border-amber-200">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          Not Connected: this screen is not yet wired to a persistence backend. Values shown below
          are local to this session only and are not saved or enforced by the Rule Engine.
        </span>
      </div>

      <fieldset disabled className="space-y-6 opacity-75">
        <legend className="sr-only">Country rules preview</legend>
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
          <span className="text-xs font-semibold text-gray-500">
            Backend + rule-engine enforcement required before editing is enabled.
          </span>
        </div>
      </fieldset>
    </div>
  );
};
