import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { TRANSLATIONS, LocaleTranslations } from './translations';
import { useTenant } from '../tenant/TenantContext';
import { SUPPORTED_LOCALES, normaliseSupportedLocale, resolveEnabledLocales } from './locales';
import { resolveStorefrontCopy, StorefrontCopyOverrides } from './copy';
import { resolveEntityTranslation, type EntityTranslations } from './entityTranslations';

interface I18nContextValue {
  locale: string;
  defaultLocale: string;
  fallbackLocale: string;
  availableLocales: Array<{ code: string; label: string; flag: string }>;
  t: (key: keyof LocaleTranslations, fallback?: string) => string;
  setLocale: (locale: string) => void;
  translateEntity: (entity: { name: string; description?: string; translations?: EntityTranslations }) => string;
  formatCurrency: (minorUnits: number, currency?: string) => string;
  formatDateTime: (value: string | number | Date, options?: Intl.DateTimeFormatOptions) => string;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { tenant } = useTenant();

  const defaultLocale = normaliseSupportedLocale(tenant?.locale, 'en-GB');
  const fallbackLocale = 'en-GB';
  const availableLocales = useMemo(
    () => resolveEnabledLocales(tenant?.enabledLocales, defaultLocale),
    [tenant?.enabledLocales, defaultLocale]
  );

  const [currentLocale, setCurrentLocale] = useState<string>(() => defaultLocale);

  useEffect(() => {
    let persistedLocale: string | null = null;
    try {
      persistedLocale = localStorage.getItem('__pa_locale');
    } catch {
      persistedLocale = null;
    }

    const enabledCodes = new Set(availableLocales.map((item) => item.code));
    if (persistedLocale && enabledCodes.has(persistedLocale)) {
      if (persistedLocale !== currentLocale) setCurrentLocale(persistedLocale);
      return;
    }

    const nextLocale = enabledCodes.has(defaultLocale)
      ? defaultLocale
      : availableLocales[0]?.code || fallbackLocale;
    if (nextLocale !== currentLocale) setCurrentLocale(nextLocale);
  }, [availableLocales, currentLocale, defaultLocale, fallbackLocale]);

  const setLocale = (newLocale: string) => {
    if (!availableLocales.some((item) => item.code === newLocale)) return;
    setCurrentLocale(newLocale);
    try {
      localStorage.setItem('__pa_locale', newLocale);
    } catch {
      // Ignored in restricted environments
    }
    document.documentElement.lang = newLocale;
  };

  useEffect(() => {
    document.documentElement.lang = currentLocale;
  }, [currentLocale]);

  const t = useMemo(() => {
    return (key: keyof LocaleTranslations, fallback?: string): string =>
      resolveStorefrontCopy({
        key,
        currentLocale,
        defaultLocale,
        fallbackLocale,
        tenantOverrides: tenant?.copyOverrides as StorefrontCopyOverrides | undefined,
        dictionaries: TRANSLATIONS,
        fallback,
      });
  }, [currentLocale, defaultLocale, fallbackLocale, tenant?.copyOverrides]);

  /**
   * Resolves a translated Deliverect entity name using regional/language fallbacks.
   */
  const translateEntity = (entity: {
    name: string;
    description?: string;
    translations?: EntityTranslations;
  }): string =>
    resolveEntityTranslation(entity, 'name', currentLocale, defaultLocale, fallbackLocale);

  const formatCurrency = (minorUnits: number, currency: string = tenant?.currency || 'GBP') => {
    return new Intl.NumberFormat(currentLocale, {
      style: 'currency',
      currency,
    }).format((Number.isFinite(minorUnits) ? minorUnits : 0) / 100);
  };

  const formatDateTime = (
    value: string | number | Date,
    options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }
  ) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(currentLocale, options).format(date);
  };

  return (
    <I18nContext.Provider
      value={{
        locale: currentLocale,
        defaultLocale,
        fallbackLocale,
        availableLocales,
        t,
        setLocale,
        translateEntity,
        formatCurrency,
        formatDateTime,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
};

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    return {
      locale: 'en-GB',
      defaultLocale: 'en-GB',
      fallbackLocale: 'en-GB',
      availableLocales: SUPPORTED_LOCALES,
      t: (key: keyof LocaleTranslations, fallback?: string) =>
        TRANSLATIONS['en-GB']?.[key] || fallback || key,
      setLocale: () => {},
      translateEntity: (entity) => entity?.name || '',
      formatCurrency: (minorUnits: number, currency = 'GBP') =>
        new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format((Number.isFinite(minorUnits) ? minorUnits : 0) / 100),
      formatDateTime: (value, options = { dateStyle: 'medium', timeStyle: 'short' }) => {
        const date = value instanceof Date ? value : new Date(value);
        return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('en-GB', options).format(date);
      },
    };
  }
  return context;
}
