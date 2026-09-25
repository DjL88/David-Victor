import React, { useState, useEffect } from 'react';
import { TenantFeatureFlags, AdminUser } from '../../commerce/models';
import { defaultAdminClient } from '../../commerce/HttpAdminClient';
import { Sliders, Check, RefreshCw } from 'lucide-react';
import { TENANT_FEATURE_DEFINITIONS } from '../featureSwitchRegistry';

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
  const [error, setError] = useState<string>('');

  useEffect(() => {
    loadFlags();
  }, [tenantId]);

  const loadFlags = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await defaultAdminClient.getFeatureFlags(tenantId);
      setFlags(data);
    } catch (e) {
      console.error('Failed to load feature flags:', e);
      setError('Feature switches could not be loaded.');
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
    setError('');

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
      setError('Feature switches could not be saved. No changes were applied.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center text-gray-500 text-xs">
        <RefreshCw className="w-4 h-4 animate-spin mr-2" />
        <span>Loading feature switches for {tenantId}...</span>
      </div>
    );
  }

  if (!flags) {
    return <div role="alert" className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-xs text-rose-800">{error || 'Feature switches are unavailable.'} <button type="button" onClick={loadFlags} className="ml-2 font-bold underline">Retry</button></div>;
  }

  const featureDefinitions = TENANT_FEATURE_DEFINITIONS;


  return (
    <div className={compact ? 'space-y-4' : 'space-y-6'}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-200">
        <div>
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-600" />
            <span>Features ({tenantId})</span>
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Only genuine tenant capabilities live here. Market, compliance and integration configuration remain owned by their respective settings.
          </p>
        </div>

        {saveSuccess && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 animate-in fade-in">
            <Check className="w-4 h-4" />
            <span>Saved successfully</span>
          </div>
        )}
      </div>

      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800">{error}</div>}

      <form onSubmit={handleSave} className="space-y-4">
        <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 shadow-2xs">
          {featureDefinitions.map((f) => (
            <div key={f.key} className="p-3.5 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-gray-900 block">{f.title}</span>
                <span className="text-[11px] text-gray-500 block leading-snug">{f.description}</span>
                <span className="text-[10px] uppercase tracking-wide text-gray-400">Owned by {f.owner.toLowerCase()}</span>
              </div>

              <button
                type="button"
                onClick={() => handleToggle(f.key)}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors shrink-0 ${
                  flags[f.key] ? 'bg-indigo-600' : 'bg-gray-200'
                }`}
                aria-label={`Toggle ${f.title}`}
                aria-pressed={Boolean(flags[f.key])}
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
