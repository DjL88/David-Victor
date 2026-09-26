import { useI18n } from '../../i18n/I18nContext';

/**
 * Orders-specific fallback copy still flows through the normal tenant/locale
 * resolver. Locales without an explicit translation fall back to English
 * rather than bypassing white-label copy overrides.
 */
export const ORDERS_COPY = {
  'orders.loading': 'Loading orders…',
  'orders.loadFailed': 'Orders could not be loaded. Please try again.',
  'orders.collected': 'Collected',
} as const;

type OrdersCopyFields = Partial<Record<keyof typeof ORDERS_COPY, string>>;
declare module '../../i18n/translations' {
  interface LocaleTranslations extends OrdersCopyFields {}
}

export function useOrdersCopy() {
  const { t } = useI18n();
  return (key: keyof typeof ORDERS_COPY): string => t(key, ORDERS_COPY[key]);
}
