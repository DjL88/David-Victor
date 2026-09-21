import React, { useState, useEffect } from 'react';
import { TenantFeatureFlags, AdminUser } from '../../commerce/models';
import { defaultAdminClient } from '../../commerce/HttpAdminClient';
import { Sliders, Check, RefreshCw } from 'lucide-react';

interface FeatureSwitchesPanelProps {
  tenantId: string;
  currentUser: AdminUser;
  compact?: boolean;
  onFlagsUpdated?: (updated: TenantFeatureFlags) => void;
}

export const FeatureSwitchesPanel: React.FC<FeatureSwitchesPanelProps> = ({
  tenantId,
  currentUser,
  compact = false,
  onFlagsUpdated,
}) => {
  const [flags, setFlags] = useState<TenantFeatureFlags | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  useEffect(() => {
    loadFlags();
  }, [tenantId]);

  const loadFlags = async () => {
    setLoading(true);
    try {
      const data = await defaultAdminClient.getFeatureFlags(tenantId);
      setFlags(data);
    } catch (e) {
      console.error('Failed to load feature flags:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (key: keyof TenantFeatureFlags) => {
    if (!flags) return;
    setFlags({ ...flags, [key]: !flags[key] });
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!flags) return;
    setSaving(true);
    setSaveSuccess(false);

    try {
      const updated = await defaultAdminClient.updateFeatureFlags(tenantId, flags, currentUser);
      setFlags(updated);
      setSaveSuccess(true);
      if (onFlagsUpdated) {
        onFlagsUpdated(updated);
      }
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save feature flags:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !flags) {
    return (
      <div className="p-6 flex items-center justify-center text-gray-500 text-xs">
        <RefreshCw className="w-4 h-4 animate-spin mr-2" />
        <span>Loading feature switches for {tenantId}...</span>
      </div>
    );
  }

  const featureDefinitions: Array<{
    key: keyof TenantFeatureFlags;
    title: string;
    description: string;
  }> = [
    {
      key: 'enableStories',
      title: 'Instagram-Style Stories Drops',
      description: 'Display interactive top story circles connecting products and editorial content.',
    },
    {
      key: 'enableSearchSuggestions',
      title: 'Search Auto-Suggestions',
      description: 'Show live query autocomplete and popular search terms in search modal.',
    },
    {
      key: 'enableRootCatalogBrowse',
      title: 'Root Catalog Browse (Pre-Store Selection)',
      description: 'Permit customers to explore entire catalog before selecting fulfilling location.',
    },
    {
      key: 'enableCollection',
      title: 'Click & Collect (Pickup)',
      description: 'Allow customers to toggle between courier delivery and in-store collection.',
    },
    {
      key: 'enableDepositReturnScheme',
      title: 'Deposit Return Scheme (DRS)',
      description: 'Automatically enforce container deposit calculation and line items.',
    },
    {
      key: 'enableAgeVerification',
      title: 'Age Gating & Challenge 25',
      description: 'Mandate customer age acknowledgement and trigger courier door ID check flags.',
    },
    {
      key: 'enableTipCourier',
      title: 'Courier Tipping',
      description: 'Display tip shortcuts during checkout that pass 100% of tips to courier.',
    },
    {
      key: 'enableSequentialCategoryGrouping',
      title: 'Sequential Empty-Category Grouping',
      description: 'Treat empty sequential Deliverect categories as parent headers for subsequent populated categories.',
    },
  ];

  return (
    <div className={compact ? 'space-y-4' : 'space-y-6'}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-200">
        <div>
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-600" />
            <span>Tenant Feature Flags ({tenantId})</span>
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Toggle platform capabilities enabled for this tenant's storefront and checkout.
          </p>
        </div>

        {saveSuccess && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 animate-in fade-in">
            <Check className="w-4 h-4" />
            <span>Saved successfully</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 shadow-2xs">
          {featureDefinitions.map((f) => (
            <div key={f.key} className="p-3.5 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-gray-900 block">{f.title}</span>
                <span className="text-[11px] text-gray-500 block leading-snug">{f.description}</span>
              </div>

              <button
                type="button"
                onClick={() => handleToggle(f.key)}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors shrink-0 ${
                  flags[f.key] ? 'bg-indigo-600' : 'bg-gray-200'
                }`}
                aria-label={`Toggle ${f.title}`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    flags[f.key] ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>

        <div className="pt-2 flex items-center justify-end gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-2xs hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            <span>Save Feature Toggles</span>
          </button>
        </div>
      </form>
    </div>
  );
};
