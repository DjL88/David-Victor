import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { TRANSLATIONS, LocaleTranslations } from './translations';
import { useTenant } from '../tenant/TenantContext';

interface I18nContextValue {
  locale: string;
  defaultLocale: string;
  fallbackLocale: string;
  availableLocales: Array<{ code: string; label: string; flag: string }>;
  t: (key: keyof LocaleTranslations, fallback?: string) => string;
  setLocale: (locale: string) => void;
  translateEntity: (entity: { name: string; translations?: Record<string, { name?: string; description?: string }> }) => string;
}

const AVAILABLE_LOCALES = [
  { code: 'en-GB', label: 'English (UK)', flag: '🇬🇧' },
  { code: 'es-ES', label: 'Español', flag: '🇪🇸' },
  { code: 'fr-FR', label: 'Français', flag: '🇫🇷' },
  { code: 'de-DE', label: 'Deutsch', flag: '🇩🇪' },
];

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { tenant } = useTenant();

  const defaultLocale = tenant?.locale || 'en-GB';
  const fallbackLocale = 'en-GB';

  const [currentLocale, setCurrentLocale] = useState<string>(() => {
    try {
      return localStorage.getItem('__pa_locale') || defaultLocale;
    } catch {
      return defaultLocale;
    }
  });

  useEffect(() => {
    if (tenant?.locale && !localStorage.getItem('__pa_locale')) {
      setCurrentLocale(tenant.locale);
    }
  }, [tenant?.locale]);

  const setLocale = (newLocale: string) => {
    setCurrentLocale(newLocale);
    try {
      localStorage.setItem('__pa_locale', newLocale);
      document.documentElement.lang = newLocale;
    } catch {
      // Ignored in restricted environments
    }
  };

  const t = useMemo(() => {
    return (key: keyof LocaleTranslations, fallback?: string): string => {
      // 1. Check current selected locale
      const activeDict = TRANSLATIONS[currentLocale];
      if (activeDict && activeDict[key]) {
        return activeDict[key];
      }

      // 2. Check tenant default locale
      const tenantDict = TRANSLATIONS[defaultLocale];
      if (tenantDict && tenantDict[key]) {
        return tenantDict[key];
      }

      // 3. Check system fallback locale (en-GB)
      const fallbackDict = TRANSLATIONS[fallbackLocale];
      if (fallbackDict && fallbackDict[key]) {
        return fallbackDict[key];
      }

      return fallback || key;
    };
  }, [currentLocale, defaultLocale, fallbackLocale]);

  /**
   * Translates a Deliverect product or category entity if localized strings
   * exist on the entity, falling back to base name.
   */
  const translateEntity = (entity: {
    name: string;
    translations?: Record<string, { name?: string; description?: string }>;
  }): string => {
    if (!entity) return '';
    if (entity.translations) {
      if (entity.translations[currentLocale]?.name) {
        return entity.translations[currentLocale].name!;
      }
      if (entity.translations[defaultLocale]?.name) {
        return entity.translations[defaultLocale].name!;
      }
    }
    return entity?.name || '';
  };

  return (
    <I18nContext.Provider
      value={{
        locale: currentLocale,
        defaultLocale,
        fallbackLocale,
        availableLocales: AVAILABLE_LOCALES,
        t,
        setLocale,
        translateEntity,
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
      availableLocales: AVAILABLE_LOCALES,
      t: (key: keyof LocaleTranslations, fallback?: string) =>
        TRANSLATIONS['en-GB']?.[key] || fallback || key,
      setLocale: () => {},
      translateEntity: (entity) => entity?.name || '',
    };
  }
  return context;
}
