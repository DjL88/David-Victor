import React, { useEffect, useMemo, useState } from 'react';
import { Check, Languages, RefreshCw } from 'lucide-react';
import { AdminUser, TenantConfig } from '../../commerce/models';
import { defaultAdminClient } from '../../commerce/HttpAdminClient';
import { SUPPORTED_LOCALES } from '../../i18n/locales';
import {
  BRAND_COPY_FIELDS,
  resolveStorefrontCopy,
  StorefrontCopyOverrides,
} from '../../i18n/copy';
import { TRANSLATIONS } from '../../i18n/translations';

interface LanguageTerminologyScreenProps {
  tenantId: string;
  currentUser: AdminUser;
}

export const LanguageTerminologyScreen: React.FC<LanguageTerminologyScreenProps> = ({
  tenantId,
  currentUser,
}) => {
  const [config, setConfig] = useState<TenantConfig | null>(null);
  const [defaultLocale, setDefaultLocale] = useState('en-GB');
  const [enabledLocales, setEnabledLocales] = useState<string[]>([]);
  const [copyLocale, setCopyLocale] = useState('en-GB');
  const [copyOverrides, setCopyOverrides] = useState<StorefrontCopyOverrides>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const next = await defaultAdminClient.getBranding(tenantId);
      const locales = next.enabledLocales?.length
        ? next.enabledLocales
        : SUPPORTED_LOCALES.map((locale) => locale.code);
      setConfig(next);
      setDefaultLocale(next.locale || 'en-GB');
      setEnabledLocales(locales);
      setCopyLocale((current) =>
        locales.includes(current) ? current : (next.locale || locales[0] || 'en-GB')
      );
      setCopyOverrides((next.copyOverrides || {}) as StorefrontCopyOverrides);
    } catch (err: any) {
      setError(err?.message || 'Could not load language settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [tenantId]);

  const selectableLocales = useMemo(
    () =>
      SUPPORTED_LOCALES.filter(
        (locale) => enabledLocales.includes(locale.code) || locale.code === defaultLocale
      ),
    [enabledLocales, defaultLocale]
  );

  const save = async () => {
    if (!config) return;
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const cleanedOverrides = Object.fromEntries(
        Object.entries(copyOverrides)
          .map(([locale, entries]) => [
            locale,
            Object.fromEntries(
              Object.entries(entries || {}).filter(
                ([, value]) => typeof value === 'string' && value.trim().length > 0
              )
            ),
          ])
          .filter(([, entries]) => Object.keys(entries as Record<string, string>).length > 0)
      );

      const updated = await defaultAdminClient.updateBranding(
        tenantId,
        {
          locale: defaultLocale,
          enabledLocales: Array.from(new Set([defaultLocale, ...enabledLocales])),
          copyOverrides: cleanedOverrides,
        },
        currentUser
      );
      setConfig(updated);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err?.message || 'Could not save language settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !config) {
    return (
      <div className="p-8 flex items-center justify-center text-gray-500">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        <span>Loading languages & wording…</span>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Languages className="w-5 h-5 text-indigo-600" />
            <span>Languages & wording</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Control storefront languages, dialects and brand-specific retail terminology without changing the UI.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
        >
          {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          <span>{saving ? 'Saving…' : 'Save languages & wording'}</span>
        </button>
      </div>

      {saved && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800">
          Languages & wording saved.
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800">
          {error}
        </div>
      )}

      <section data-admin-ai-target="languages-default" className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-4">
        <div>
          <h2 className="text-sm font-bold text-gray-900">Storefront languages</h2>
          <p className="text-xs text-gray-500 mt-1">
            Customers only see languages enabled here. The default language can never be disabled.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[0.8fr_1.2fr] gap-4">
          <label className="text-xs font-bold text-gray-700">
            Default language
            <select
              value={defaultLocale}
              onChange={(e) => {
                const locale = e.target.value;
                setDefaultLocale(locale);
                setEnabledLocales((current) =>
                  current.includes(locale) ? current : [...current, locale]
                );
              }}
              className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-xl text-xs bg-white"
            >
              {SUPPORTED_LOCALES.map((locale) => (
                <option key={locale.code} value={locale.code}>
                  {locale.flag} {locale.label}
                </option>
              ))}
            </select>
          </label>

          <div>
            <span className="block text-xs font-bold text-gray-700 mb-1">Enabled languages</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SUPPORTED_LOCALES.map((locale) => {
                const checked = enabledLocales.includes(locale.code);
                const locked = locale.code === defaultLocale;
                return (
                  <label
                    key={locale.code}
                    className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={locked}
                      onChange={(e) =>
                        setEnabledLocales((current) =>
                          e.target.checked
                            ? Array.from(new Set([...current, locale.code]))
                            : current.filter((code) => code !== locale.code)
                        )
                      }
                      className="rounded border-gray-300 text-indigo-600"
                    />
                    <span>{locale.flag} {locale.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section data-admin-ai-target="languages-terminology" className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Storefront terminology</h2>
            <p className="text-xs text-gray-500 mt-1 max-w-2xl">
              Tailor jargon such as Basket/Cart, Collect/Pickup, Aisles/Departments and other customer-facing wording by language.
            </p>
          </div>
          <label className="text-[11px] font-bold text-gray-700 min-w-[200px]">
            Edit wording for
            <select
              value={copyLocale}
              onChange={(e) => setCopyLocale(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-xl text-xs bg-white"
            >
              {selectableLocales.map((locale) => (
                <option key={locale.code} value={locale.code}>
                  {locale.flag} {locale.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {BRAND_COPY_FIELDS.map((field) => {
            const systemText = resolveStorefrontCopy({
              key: field.key,
              currentLocale: copyLocale,
              defaultLocale,
              fallbackLocale: 'en-GB',
              dictionaries: TRANSLATIONS,
            });
            const value = copyOverrides[copyLocale]?.[field.key] || '';

            return (
              <label key={field.key} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <span className="block text-[11px] font-bold text-gray-800">{field.label}</span>
                {field.hint && (
                  <span className="block text-[10px] text-gray-500 mt-0.5">{field.hint}</span>
                )}
                <input
                  type="text"
                  value={value}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    setCopyOverrides((current) => ({
                      ...current,
                      [copyLocale]: {
                        ...(current[copyLocale] || {}),
                        [field.key]: nextValue,
                      },
                    }));
                  }}
                  placeholder={systemText}
                  className="mt-2 w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-xs font-semibold"
                />
                <span className="block mt-1 text-[9px] text-gray-400">
                  Default: {systemText}
                </span>
              </label>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl bg-indigo-50 border border-indigo-100 px-3 py-2">
          <p className="text-[10px] text-indigo-900">
            Leave a field blank to inherit the platform wording for that language.
          </p>
          <button
            type="button"
            onClick={() =>
              setCopyOverrides((current) => {
                const next = { ...current };
                delete next[copyLocale];
                return next;
              })
            }
            className="text-[10px] font-bold text-indigo-700 hover:text-indigo-900 whitespace-nowrap"
          >
            Reset this language
          </button>
        </div>
      </section>
    </div>
  );
};
