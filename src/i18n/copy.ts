import type { LocaleTranslations } from './translations';

export type StorefrontCopyKey = keyof LocaleTranslations;
export type StorefrontCopyOverrides = Record<string, Partial<Record<StorefrontCopyKey, string>>>;

export interface BrandCopyField {
  key: StorefrontCopyKey;
  label: string;
  hint?: string;
}

/**
 * Curated terms brands commonly want to adapt without redesigning the storefront.
 * The full typed dictionary remains available in code; Admin intentionally starts
 * with the high-value jargon/terminology layer.
 */
export const BRAND_COPY_FIELDS: BrandCopyField[] = [
  { key: 'header.basket', label: 'Basket / cart', hint: 'Shown in the storefront header.' },
  { key: 'basket.title', label: 'Basket title' },
  { key: 'nav.aisles', label: 'Aisles / departments' },
  { key: 'header.collect', label: 'Collect / pickup' },
  { key: 'fulfilment.collection', label: 'Collection method name' },
  { key: 'header.delivery', label: 'Delivery label' },
  { key: 'nav.orders', label: 'Orders label' },
  { key: 'nav.account', label: 'Account label' },
  { key: 'nav.favourites', label: 'Favourites / favorites' },
  { key: 'nav.buyAgain', label: 'Buy again label' },
  { key: 'checkout.title', label: 'Checkout title' },
  { key: 'checkout.secureCheckout', label: 'Secure checkout heading' },
  { key: 'checkout.scheduling', label: 'Fulfilment / fulfillment timing' },
  { key: 'checkout.substitutionPreferences', label: 'Substitution preferences heading' },
  { key: 'checkout.contactDetails', label: 'Contact details heading' },
  { key: 'checkout.paymentModel', label: 'Payment model heading' },
  { key: 'account.brandInfoPolicies', label: 'Account policies heading' },
  { key: 'account.customerSupport', label: 'Customer support wording' },
];

/**
 * Locale dialect defaults layered over the base dictionaries. en-US deliberately
 * reuses en-GB for untranslated sentences, but changes common retail terminology
 * and spelling automatically.
 */
export const SYSTEM_LOCALE_OVERRIDES: StorefrontCopyOverrides = {
  'en-US': {
    'nav.favourites': 'Favorites',
    'nav.aisles': 'Departments',
    'header.collect': 'Pickup',
    'header.basket': 'Cart',
    'basket.title': 'Your Cart',
    'basket.emptyTitle': 'Your cart is empty',
    'basket.startShopping': 'Start Shopping',
    'basket.clearBasket': 'Clear Cart',
    'basket.checkoutBtn': 'Review & Checkout',
    'fulfilment.collection': 'Store Pickup',
    'checkout.title': 'Grocery Checkout & Authorization',
    'checkout.scheduling': 'Fulfillment Timing',
    'checkout.authNoticeTitle': 'Retail Pre-Authorization Model',
    'checkout.authNoticeDesc': 'You are not charged immediately. We pre-authorize the estimated total. Payment is only captured after picking completes in store.',
    'checkout.authorizeAndSubmit': 'Authorize & Place Order',
    'checkout.authorizing': 'Authorizing & Securing Dispatch...',
  },
};

interface ResolveCopyArgs {
  key: StorefrontCopyKey;
  currentLocale: string;
  defaultLocale: string;
  fallbackLocale: string;
  tenantOverrides?: StorefrontCopyOverrides;
  dictionaries: Record<string, LocaleTranslations>;
  fallback?: string;
}

export function resolveStorefrontCopy({
  key,
  currentLocale,
  defaultLocale,
  fallbackLocale,
  tenantOverrides,
  dictionaries,
  fallback,
}: ResolveCopyArgs): string {
  const tenantCurrent = tenantOverrides?.[currentLocale]?.[key];
  if (tenantCurrent) return tenantCurrent;

  const systemCurrent = SYSTEM_LOCALE_OVERRIDES[currentLocale]?.[key];
  if (systemCurrent) return systemCurrent;

  const activeDict = dictionaries[currentLocale];
  if (activeDict?.[key]) return activeDict[key];

  const tenantDefault = tenantOverrides?.[defaultLocale]?.[key];
  if (tenantDefault) return tenantDefault;

  const systemDefault = SYSTEM_LOCALE_OVERRIDES[defaultLocale]?.[key];
  if (systemDefault) return systemDefault;

  const defaultDict = dictionaries[defaultLocale];
  if (defaultDict?.[key]) return defaultDict[key];

  const fallbackDict = dictionaries[fallbackLocale];
  if (fallbackDict?.[key]) return fallbackDict[key];

  return fallback || key;
}
