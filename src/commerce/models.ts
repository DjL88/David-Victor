import {
  BundleModifier,
  BundleModifierGroup,
  BundleProduct,
  BundleCatalog,
  evaluateBundleSectionAvailability,
  evaluateBundleStockStatus,
} from './bundleModels';

export * from './bundleModels';

// ==========================================
// MONEY & CURRENCY (INTEGER MINOR UNITS)
// ==========================================

export interface Money {
  /** Integer minor units (e.g. 250 for £2.50, 100 for $1.00) */
  amount: number;
  /** ISO-4217 Currency Code (e.g. 'GBP', 'EUR', 'USD') */
  currency: string;
  /** Number of decimal places, typically 2 */
  fractionalDigits?: number;
  /** Pre-formatted string representation */
  formatted?: string;
}

export function toMoney(minorUnits: number, currency: string = 'GBP'): Money {
  const safe = typeof minorUnits === 'number' && !isNaN(minorUnits) && isFinite(minorUnits) ? Math.round(minorUnits) : 0;
  return { amount: safe, currency };
}

export function moneyFromPence(pence: number, currency: string = 'GBP'): Money {
  const safe = typeof pence === 'number' && !isNaN(pence) && isFinite(pence) ? Math.round(pence) : 0;
  return { amount: safe, currency };
}

export function moneyFromMajor(major: number, currency: string = 'GBP'): Money {
  const safe = typeof major === 'number' && !isNaN(major) && isFinite(major) ? major : 0;
  return { amount: Math.round(safe * 100), currency };
}

export function moneyToMajor(money?: Money | number | null): number {
  if (money === undefined || money === null) return 0;
  if (typeof money === 'number') {
    if (isNaN(money) || !isFinite(money)) return 0;
    // Commerce prices are integer minor units (e.g. 25 minor units = 0.25, 500 = 5.00)
    return money / 100;
  }
  if (typeof money === 'object' && typeof (money as any).amount === 'number') {
    const amt = (money as any).amount;
    return !isNaN(amt) && isFinite(amt) ? amt / 100 : 0;
  }
  return 0;
}

export function moneyToMinor(money?: Money | number | null): number {
  if (money === undefined || money === null) return 0;
  if (typeof money === 'number') {
    if (isNaN(money) || !isFinite(money)) return 0;
    return Math.round(money);
  }
  if (typeof money === 'object' && typeof (money as any).amount === 'number') {
    const amt = (money as any).amount;
    return !isNaN(amt) && isFinite(amt) ? Math.round(amt) : 0;
  }
  return 0;
}

export function policyFeeToMinor(val: Money | number | undefined | null, fallbackMinor: number = 0): number {
  if (val === undefined || val === null) return fallbackMinor;
  if (typeof val === 'object' && typeof (val as any).amount === 'number') {
    const amt = (val as any).amount;
    return !isNaN(amt) && isFinite(amt) ? Math.round(amt) : fallbackMinor;
  }
  if (typeof val === 'number') {
    if (isNaN(val) || !isFinite(val)) return fallbackMinor;
    // Legacy mock data support: if val is a float (e.g. 1.99, 0.5) or a small float/int (< 50) that looks like major pounds, convert to minor
    if (!Number.isInteger(val) || (val > 0 && val < 50)) {
      return Math.round(val * 100);
    }
    return Math.round(val);
  }
  return fallbackMinor;
}

export function policyFeeToMajor(val: Money | number | undefined | null, fallbackMinor: number = 0): number {
  const minor = policyFeeToMinor(val, fallbackMinor);
  return minor / 100;
}

export function addMoney(a: Money, b: Money): Money {
  const aAmt = moneyToMinor(a);
  const bAmt = moneyToMinor(b);
  return { amount: aAmt + bAmt, currency: a.currency || b.currency || 'GBP' };
}

export function subMoney(a: Money, b: Money): Money {
  const aAmt = moneyToMinor(a);
  const bAmt = moneyToMinor(b);
  return { amount: Math.max(0, aAmt - bAmt), currency: a.currency || b.currency || 'GBP' };
}

export function formatMoney(money?: Money | number | null, currencyDefault: string = 'GBP'): string {
  if (money === undefined || money === null) return 'Price unavailable';
  let minorUnits: number;
  let curr = currencyDefault;

  if (typeof money === 'object') {
    const amt = (money as any).amount;
    if (typeof amt !== 'number' || isNaN(amt) || !isFinite(amt)) {
      return 'Price unavailable';
    }
    minorUnits = Math.round(amt);
    if ((money as any).currency) {
      curr = (money as any).currency;
    }
  } else if (typeof money === 'number') {
    if (isNaN(money) || !isFinite(money)) {
      return 'Price unavailable';
    }
    minorUnits = Math.round(money);
  } else {
    return 'Price unavailable';
  }

  const symbol = curr === 'GBP' || curr === '£' ? '£' : curr === 'EUR' || curr === '€' ? '€' : '$';
  return `${symbol}${(minorUnits / 100).toFixed(2)}`;
}

export interface TenantSupportDetails {
  email: string;
  phone: string;
  openingHours: string;
  helpCenterUrl?: string;
}

export interface TenantFeatureFlags {
  enableStories: boolean;
  enableRootCatalogBrowse: boolean;
  enableCollection: boolean;
  allowStoreSwitchingWithBasket: boolean;
  enableNutritionalInfo: boolean;
  enableDeposits: boolean;
  enableAgeVerification: boolean;
  enableSearchSuggestions: boolean;
  enableDepositReturnScheme?: boolean;
  enableTipCourier?: boolean;
  enableSequentialCategoryGrouping?: boolean;
  /** When true, Retail/Quest orders project frozen bundle savings into final item prices. Basket pricing remains order_flat_off. */
  sendBundleDiscountAsItemPrice?: boolean;
}

export type FeatureFlags = TenantFeatureFlags;

export interface TenantConfig {
  tenantId: string;
  brandName: string;
  tagline?: string;
  logoUrl: string;
  iconUrl: string;
  faviconUrl?: string;
  headerLogoMode?: 'ICON_WITH_TEXT' | 'WIDE_LOGO' | 'LOGO_ONLY';
  headerLogoMaxWidth?: number;
  status?: string;
  defaultDomain?: string;
  primaryColour: string;
  secondaryColour: string;
  backgroundColour: string;
  textColour: string;
  fontFamily: string;
  headingFontFamily?: string;
  carouselTitleFontFamily?: string;
  surfaceColour?: string;
  mutedTextColour?: string;
  borderColour?: string;
  successColour?: string;
  warningColour?: string;
  errorColour?: string;
  borderRadius: string; // e.g. '12px'
  country: string; // e.g. 'GB'
  currency: string; // e.g. 'GBP'
  currencySymbol: string; // e.g. '£'
  locale: string; // e.g. 'en-GB'
  /** Storefront languages enabled for this tenant. Defaults to all supported locales when omitted. */
  enabledLocales?: string[];
  /** Per-locale brand wording overrides keyed by typed storefront copy key. */
  copyOverrides?: Record<string, Record<string, string>>;
  supportDetails: TenantSupportDetails;
  featureFlags: TenantFeatureFlags;
}

export interface Tenant {
  config: TenantConfig;
  version: string;
}

export type StoreStatus =
  | 'OPEN'
  | 'CLOSED'
  | 'BUSY'
  | 'PAUSED'
  | 'ACTIVE'
  | 'INACTIVE'
  | 'open'
  | 'closed'
  | 'busy'
  | 'paused'
  | 'active'
  | 'inactive';

export function normalizeStoreStatus(status: StoreStatus | string): 'OPEN' | 'CLOSED' | 'BUSY' | 'PAUSED' {
  const s = String(status || '').toUpperCase();
  if (s === 'OPEN' || s === 'ACTIVE') {
    return 'OPEN';
  }
  if (s === 'BUSY') {
    return 'BUSY';
  }
  if (s === 'PAUSED') {
    return 'PAUSED';
  }
  return 'CLOSED';
}

export function isStoreOpen(statusOrStore: StoreStatus | Store): boolean {
  if (typeof statusOrStore === 'object' && statusOrStore !== null && 'status' in statusOrStore) {
    return normalizeStoreStatus(statusOrStore.status) === 'OPEN';
  }
  return normalizeStoreStatus(statusOrStore as StoreStatus) === 'OPEN';
}

export interface Address {
  street?: string;
  line1?: string;
  line2?: string;
  city: string;
  postalCode?: string;
  postcode?: string;
  country: string;
  formattedAddress?: string;
  latitude?: number;
  longitude?: number;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface DispatchAvailability {
  available: boolean;
  validationId?: string;
  expiresAt?: string;
  deliveryEtaMinutes?: number;
  deliveryPrice?: number;
  pickupEtaMinutes?: number;
  reason?: string;
  failureReason?: string;
  fee?: Money;
  estimatedDeliveryTime?: string;
  estimatedPickupTime?: string;
  provider?: string;
}

export interface StoreAvailability {
  storeId: string;
  status: StoreStatus;
  supportsDelivery: boolean;
  supportsPickup: boolean;
  estimatedDeliveryMinutes?: number;
  deliveryFee?: Money | number;
}

export interface StoreOrderingChannel {
  channel: 'DIRECT' | 'DELIVEROO' | 'UBER_EATS' | 'JUST_EAT' | 'IN_STORE';
  enabled: boolean;
  displayName: string;
  consumerUrl?: string;
  externalChannelId?: string;
}

export interface StoreSchedulingConfig {
  acceptsAsapOrders: boolean;
  acceptsPreOrders: boolean;
  acceptsSameDayPreOrders: boolean;
  minimumLeadTimeMinutes?: number;
  maximumDaysInAdvance?: number;
  slotLengthMinutes?: number;
}

export const MAX_ELIGIBLE_STORES = 10;
export const COLLECTION_FALLBACK_RADIUS_METERS = 20000; // 20 km

export interface EligibleStore {
  id?: string;
  name?: string;
  store: Store;
  deliveryServiceable: boolean;
  pickupAvailable: boolean;
  deliveryEta?: string;
  deliveryPrice?: Money | number;
  distanceMeters: number;
  dispatchAvailability?: DispatchAvailability;
  failureReason?: string;
  reasonUnavailable?: string;
}

export interface StoreEligibilityResult {
  eligibleStores: EligibleStore[];
  deliveryStores: EligibleStore[];
  collectionStores: EligibleStore[];
  hasDeliveryCoverage: boolean;
}

export interface Store {
  id: string;
  name: string;
  address: Address;
  coordinates: Coordinates;
  distanceMeters: number;
  status: StoreStatus;
  stateProjection?: 'open' | 'closed' | 'busy' | 'paused' | string;
  snoozed?: boolean;
  preparationTimeDelay?: number; // Delay in minutes
  supportsDelivery: boolean;
  supportsPickup: boolean;
  orderingChannels?: StoreOrderingChannel[];
  scheduling?: StoreSchedulingConfig;
  dispatchAvailability?: DispatchAvailability;
  deliveryEta?: string;
  deliveryPrice?: Money | number;
  collectionAvailable?: boolean;
  minOrderAmount?: Money | number;
  /** @deprecated Evaluate isStoreOpen(store) instead of static isOpen */
  isOpen?: boolean;
  /** @deprecated Deliverect Dispatch / serviceability evaluation is authoritative, not client radius */
  deliveryRadiusKm?: number;
  /** @deprecated Use orderingChannels instead */
  channelLinks?: Array<'DIRECT' | 'DELIVEROO' | 'UBER_EATS' | 'JUST_EAT'>;
  locationGroup?: string;
  /** Real geography derived from the store's address (postcodes.io for GB), cached once per store. */
  geography?: {
    country: string;
    nation?: string;
    region?: string;
    county?: string;
    town?: string;
    resolvedAt: string;
    source: 'postcodes.io' | 'address';
  };
  phone?: string;
  email?: string;
  openingHours?: Record<string, { open: string; close: string }> | Array<{ dayOfWeek: number; startTime: string; endTime: string }>;
  channelLinkId?: string;
  /** Channel-side store/location identifier when Deliverect exposes one. */
  channelLocationId?: string;
  /** Bwydi's normalized reference to the Deliverect physical location record. */
  physicalLocationId?: string;
  /** Raw Deliverect location ID, kept separate from the Commerce channelLinkId. */
  deliverectLocationId?: string;
  /** Retailer/POS-friendly store number, e.g. "1234". Never use this as Commerce storeId. */
  brandStoreId?: string;
  currency?: string;
  timezone?: string;
  services?: Array<{ id: string; name: string; channel?: string | number; url?: string; source: 'DELIVERECT' | 'MANUAL' }>;
}

/**
 * Physical brick-and-mortar location registered in Deliverect (`locationId`).
 * A physical branch may host multiple digital channels or POS links.
 */
export interface PhysicalLocation {
  id: string; // Deliverect locationId
  tenantId: string; // Deliverect accountId
  name: string;
  address: Address;
  coordinates: Coordinates;
  phone?: string;
  email?: string;
  openingHours?: Record<string, { open: string; close: string }>;
}

/**
 * Deliverect Commerce Store & Channel Link.
 * Distinguishes the specific commercial ordering channel (`channelLinkId` / `storeId`)
 * from the underlying physical location (`physicalLocationId` / `locationId`).
 */
export interface CommerceStore extends Store {
  channelLinkId: string;
  physicalLocationId: string;
}

/**
 * Authoritative stock status as originated upstream by Deliverect Commerce.
 * Deliverect does NOT originate 'LOW_STOCK'; 'LOW_STOCK' is strictly a derived UI concept
 * evaluated via isLowStock(stockQuantity, threshold).
 */
export type ProductStockStatus = 'IN_STOCK' | 'OUT_OF_STOCK';

/**
 * UI-only derived state based on numeric stock and configurable threshold.
 * Upstream commerce APIs (Deliverect) do NOT originate a 'LOW_STOCK' enum state.
 */
export function isLowStock(stockQuantity?: number | null, threshold: number = 5): boolean {
  return stockQuantity != null && stockQuantity > 0 && stockQuantity <= threshold;
}

/**
 * Store-level operational availability & pricing slice sourced from local store channel.
 * Deliverect Store Menus supply location-specific range and pricing.
 */
export interface StoreProductAvailability {
  storeId: string;
  productId?: string;
  plu: string;
  active?: boolean;
  price?: Money;
  originalPrice?: Money | number;
  stockStatus?: 'IN_STOCK' | 'OUT_OF_STOCK';
  /** null/undefined indicates unknown/untracked stock, NEVER treat as zero */
  stockQuantity?: number | null;
  minimumQuantity?: number;
  maximumQuantity?: number;
  deposit?: Money;
  // Deliverect snooze integration fields
  snoozed?: boolean;
  isSnoozed?: boolean;
  snoozedUntil?: string;
  snoozeEndTime?: string;
  // Backward compatibility fields for legacy views
  inStock?: boolean;
  storePrice?: number;
  isCarried?: boolean;
  lastSyncAt?: string;
}

export function isStoreProductSnoozed(availability?: StoreProductAvailability | null): boolean {
  if (!availability) return false;
  if (availability.snoozed === true || availability.isSnoozed === true) return true;
  if (availability.snoozedUntil || availability.snoozeEndTime) {
    const until = new Date(availability.snoozedUntil || availability.snoozeEndTime!).getTime();
    if (!isNaN(until) && until > Date.now()) return true;
  }
  return false;
}

export function isStoreProductAvailable(availability?: StoreProductAvailability | null): boolean {
  if (!availability) return false;
  if (availability.active === false || availability.isCarried === false) return false;
  if (isStoreProductSnoozed(availability)) return false;
  if (availability.stockStatus === 'OUT_OF_STOCK' || availability.inStock === false) return false;
  if (availability.stockQuantity !== null && availability.stockQuantity !== undefined && availability.stockQuantity <= 0) return false;
  return true;
}

export function getStoreProductPrice(availability: StoreProductAvailability, fallbackCurrency: string = 'GBP'): Money {
  if (availability.price) return availability.price;
  if (typeof availability.storePrice === 'number') {
    return moneyFromMajor(availability.storePrice, fallbackCurrency);
  }
  return toMoney(0, fallbackCurrency);
}

export function isStoreProductActive(availability: StoreProductAvailability): boolean {
  if (availability.active !== undefined) return availability.active;
  if (availability.inStock !== undefined) return availability.inStock;
  return true;
}

export interface ProductNutritionalInfo {
  energyKcal?: number;
  fat?: number;
  saturates?: number;
  carbohydrates?: number;
  sugars?: number;
  fibre?: number;
  protein?: number;
  salt?: number;
  portionSize?: string;
}

export interface ProductSupplementalInfo {
  storageInstructions?: string;
  origin?: string;
  ingredients?: string;
  netQuantity?: string;
  recyclingInfo?: string;
  manufacturer?: string;
  deposit?: number;
}

export interface BeverageInfo {
  alcoholByVolume?: number;
  isAlcoholic?: boolean;
  caffeineContent?: string;
}

export type ProductTag = 
  | 'VEGAN'
  | 'VEGETARIAN'
  | 'GLUTEN_FREE'
  | 'ORGANIC'
  | 'HALAL'
  | 'KOSHER'
  | 'AGE_RESTRICTED_18'
  | 'AGE_RESTRICTED_16'
  | 'MEDICINE_LIMIT'
  | 'HFSS'
  | 'FRESH'
  | 'FROZEN'
  | 'CHILLED'
  | 'SPECIAL_OFFER';

export type ProductMetadata = Record<string, unknown>;

/**
 * Brand-wide authoritative Root Product definition (Deliverect Root Menu item).
 * Store-agnostic and explicitly excludes location-specific availability and pricing.
 */
export interface ProductTagDefinition {
  id: string;
  name: string;
  type?: string;
  isAllergen?: boolean;
}

export interface Product {
  id: string;
  plu: string;
  canonicalPlu?: string;
  gtin: string[];
  gtins?: string[];
  name: string;
  description?: string;
  imageUrl?: string;
  images?: string[];
  brand?: string;
  categoryIds: string[];
  productTags: (ProductTag | string)[];
  tags?: string[];
  displayLabels: string[];
  allergens: string[];
  productTagLabels?: string[];
  unmappedProductTags?: string[];
  nutritionalInfo?: ProductNutritionalInfo;
  supplementalInfo?: ProductSupplementalInfo;
  multiMax?: number; // E.g. limit to 2 for paracetamol
  metadata?: ProductMetadata;
  beverageInfo?: BeverageInfo;

  // NOTE: Store-specific pricing, stock, deposit and active status are location-dependent
  // and belong authoritative in StoreProductAvailability. The fields below are provided
  // as optional convenience accessors for views rendering store-projected catalogs.
  image?: string;
  priceMinor?: number;
  modifierGroups?: unknown[];
  price?: Money | number;
  basePrice?: Money | number;
  originalPrice?: Money | number;
  deposit?: Money | number; // Deposit Return Scheme (DRS)
  minimumQuantity?: number;
  maximumQuantity?: number;
  stockStatus?: ProductStockStatus;
  stockQuantity?: number | null;
  active?: boolean;
  snoozed?: boolean;
  isSnoozed?: boolean;
  snoozeEndTime?: string;
  isUpsell?: boolean;
  inStock?: boolean;
}

/**
 * Brand-wide authoritative Root Product definition (Deliverect Root Menu item).
 * Store-agnostic and explicitly excludes location-specific availability and pricing.
 */
export type RootCatalogProduct = Product;

/**
 * Store-projected Product view for consumer UI.
 * Combines the store-agnostic Root Product with authoritative location-specific
 * availability, pricing, stock, and ranging from StoreProductAvailability.
 */
export interface StoreProduct extends Product {
  storeId?: string;
}

export interface ProductAvailability {
  productId: string;
  plu: string;
  inStock: boolean;
  stockQuantity?: number | null;
  price?: Money | number;
  originalPrice?: Money | number;
  active?: boolean;
}

export interface ProductAvailabilitySummary {
  productId?: string;
  plu: string;
  availableStoreCount: number;
  eligibleStoreCount: number;
  minimumPrice?: Money | number;
  maximumPrice?: Money | number;
  nearestAvailableStoreId?: string;
  deliveryAvailable: boolean;
  collectionAvailable: boolean;
  availableNearby?: boolean;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  iconName?: string;
  parentId?: string | null;
  level?: number;
  subcategories?: Category[]; // Arbitrary nested hierarchy
  productCount?: number;
}

export interface StoreMenuSummary {
  menuId: string;
  name: string;
  description?: string;
  imageUrl?: string;
  menuType?: number;
  productCount?: number;
  categoryCount?: number;
}

export interface CatalogDiagnostics {
  accountId?: string;
  channelLinkId?: string;
  storeId?: string;
  menusReturned?: number;
  selectedMenuId?: string;
  selectedMenuName?: string;
  rawProductCount?: number;
  parsedProductCount?: number;
  activeCount?: number;
  inactiveCount?: number;
  snoozedCount?: number;
  renderableCount?: number;
  unmappedProductTagIds?: string[];
  hiddenByRuleCount?: number;
  timestamp?: string;
}

export interface Catalog {
  id: string;
  type: 'ROOT' | 'STORE';
  storeId?: string;
  menus?: StoreMenuSummary[];
  activeMenuId?: string;
  categories: Category[];
  products?: Product[];
  totalProducts?: number;
  updatedAt: string;
  diagnostics?: CatalogDiagnostics;
  bundleCatalog?: BundleCatalog;
}

export type StoryActionType = 'PRODUCT' | 'CATEGORY' | 'SEARCH' | 'OFFER' | 'EXTERNAL_URL';

export interface StoryAction {
  type: StoryActionType;
  targetPlu?: string; // Stored reference to product rather than duplicating product data
  targetCategoryId?: string;
  searchQuery?: string;
  externalUrl?: string;
  offerCode?: string;
  buttonLabel?: string;
}

export type StoryStockMatchMode = 'AND' | 'OR';

export interface MarketingSchedule {
  startsAt?: string;
  endsAt?: string;
  weekdays?: number[]; // 1 Monday ... 7 Sunday
  dailyStartTime?: string; // HH:mm in timezone
  dailyEndTime?: string;
  timezone?: string;
}

export interface Story {
  id: string;
  title: string;
  author?: string;
  avatarUrl?: string;
  caption?: string;
  mediaType?: 'image' | 'video';
  mediaUrl?: string;
  thumbnailUrl?: string;
  startsAt?: string;
  endsAt?: string;
  schedule?: MarketingSchedule;
  countryCodes?: string[];
  storeIds?: string[];
  eligibleStoreIds?: string[];
  storeGroupIds?: string[];
  action?: StoryAction;
  tag?: string;
  // Multiple products linked for location stock verification
  linkedProductPlus?: string[];
  stockMatchMode?: StoryStockMatchMode; // 'AND' = all items must be in stock (e.g. meal deal), 'OR' = at least 1 in stock (e.g. crisps range)
  linkedBundleId?: string; // Explicitly link to a catalog DeliverectDeal / bundle
  sortOrder?: number;
  items?: Array<{
    id: string;
    mediaUrl: string;
    mediaType: string;
    caption?: string;
    duration?: number;
  }>;
  createdAt?: string;
}

export interface CategoryPromoBanner {
  id: string;
  categoryId?: string; // If undefined or 'all', shows on all/home
  categorySlugMatch?: string; // Keyword match e.g. 'snack', 'bakery', 'drink'
  title: string;
  subtitle: string;
  badge?: string;
  backgroundImageUrl: string;
  buttonLabel: string;
  actionType: 'CATEGORY' | 'PRODUCT' | 'SEARCH' | 'STORE_PICKER';
  targetPlu?: string;
  targetCategoryId?: string;
  searchQuery?: string;
  linkedProductPlus?: string[];
  stockMatchMode?: StoryStockMatchMode;
  linkedBundleId?: string; // Explicitly link to a catalog DeliverectDeal / bundle
  sortOrder?: number;
  schedule?: MarketingSchedule;
}

export interface CourierInfo {
  name?: string;
  eta?: string;
  coordinates?: Coordinates;
  currentCoordinates?: Coordinates;
  phone?: string;
  vehicleType?: string;
}

import type { SubstitutionPreferenceType, DeliverySlot } from './postCheckoutModels';

export { calculatePreChosenAlternativeExtraBuffer } from './substitutionPricing';

export interface SubstituteCandidate {
  plu: string;
  name?: string;
  quantity?: number;
  price?: Money;
  priority?: number;
}

export interface BasketItemSubItem {
  id?: string;
  modifierId?: string;
  plu: string;
  name: string;
  price: Money;
  priceMinor?: number;
  quantity: number;
  sectionId?: string;
  sectionName?: string;
}

export interface BasketItem {
  id: string;
  plu: string;
  name: string;
  brand?: string;
  unitPrice?: Money;
  itemPrice?: Money;
  totalPrice?: Money;
  channelLinkId?: string;
  price: Money;
  originalPrice?: Money;
  quantity: number;
  imageUrl?: string;
  deposit?: Money;
  totalDeposit?: Money;
  appliedRules?: string[];
  effectiveMaxQuantity?: number;
  substitutionPreference?: SubstitutionPreferenceType;
  substituteCandidates?: SubstituteCandidate[];
  substituteCandidatePlus?: string[];
  allowQuantityAmendment?: boolean;
  preferredSubstitutePlu?: string;
  preferredSubstituteName?: string;
  preferredSubstitutePrice?: Money;
  isCombo?: boolean;
  bundleId?: string;
  bundlePlu?: string;
  bundleName?: string;
  subItems?: BasketItemSubItem[];
  availabilityState?:
    | 'AVAILABLE'
    | 'UNAVAILABLE_AT_STORE'
    | 'PRICE_CHANGED'
    | 'QUANTITY_UNAVAILABLE';
  availabilityMessage?: string;
  previousPrice?: Money;
}

export type BasketChargeType =
  | 'deliveryFee'
  | 'serviceCharge'
  | 'bagFee'
  | 'smallOrderFee'
  | 'tip'
  | 'discount'
  | 'deposit'
  | 'depositTotal';

export interface BasketCharge {
  id: string;
  type: BasketChargeType;
  title: string;
  amount: Money;
  description?: string;
  taxable?: boolean;
}

export interface BasketDiscount {
  id?: string;
  code: string;
  title: string;
  amount: Money;
  description?: string;
}

export interface BasketValidationError {
  code: string;
  message: string;
  severity: 'warning' | 'blocking';
  plu?: string;
}

export interface Restriction {
  code: string;
  message: string;
  severity: 'warning' | 'blocking';
  plu?: string;
}

export interface Basket {
  id: string;
  basketId?: string;
  tenantId?: string;
  channelLinkId?: string;
  storeId: string;
  storeName: string;
  fulfillmentType: 'delivery' | 'pickup';
  items: BasketItem[];
  subtotal: Money; // Authoritative minor-unit money
  discounts: BasketDiscount[];
  /** Bwydi-owned bundle units already allocated to a deal; never reusable by missed-deal qualification. */
  bundleAllocatedUnits?: Array<{ plu: string; quantity: number }>;
  charges: BasketCharge[];
  depositTotal?: Money;
  tax?: Money;
  total: Money; // Authoritative minor-unit money
  totalPrice?: Money;
  discountTotal: Money;
  tip?: Money;
  // Local estimated values for UX rendering prior to server roundtrip
  estimatedSubtotal?: Money;
  estimatedTotal?: Money;
  currency: string;
  validationErrors: BasketValidationError[];
  restrictions: Restriction[];
  fulfillmentSlot?: DeliverySlot;
  deliveryAddress?: Address;
  customer?: { name?: string; email?: string; phone?: string; companyName?: string };
  dispatchValidationId?: string;
  dispatchValidationExpiresAt?: string;
  updatedAt: string;
}

export type CheckoutStatus =
  | 'preparing_payment'
  | 'payment_authorised'
  | 'placing_order'
  | 'order_confirmed'
  | 'order_failed';

export type OrderTrackingStatus =
  | 'orderAccepted'
  | 'preparing'
  | 'readyForPickup'
  | 'courierAssigned'
  | 'courierAtStore'
  | 'outForDelivery'
  | 'delivered'
  | 'cancelled';

// Re-export comprehensive Order aggregate and grocery post-checkout models
export * from './postCheckoutModels';

export interface HostedPaymentSession {
  sessionId: string;
  redirectUrl: string;
  expiresAt: string;
  amount: Money | number;
  currency: string;
  provider: 'DELIVERECT_PAY';
}

export type AdminRole =
  | 'platformSuperAdmin'
  | 'tenantAdmin'
  | 'marketingEditor'
  | 'operationsEditor'
  | 'viewer';

export interface AdminUser {
  id: string;
  uid?: string;
  name: string;
  email: string;
  role: AdminRole;
  tenantId: string;
  isSuperAdmin?: boolean;
}

export type DeliveryFeeMode =
  | 'DISPATCH_COST'
  | 'FIXED'
  | 'DISPATCH_PLUS_FIXED'
  | 'DISPATCH_PLUS_PERCENT'
  | 'FREE';

export interface TenantFeePolicy {
  deliveryFeeMode: DeliveryFeeMode;
  fixedDeliveryFee?: Money | number;
  dispatchFixedSurcharge?: Money | number;
  dispatchPercentSurcharge?: number;
  serviceFeeMode: 'FIXED' | 'PERCENT' | 'NONE';
  serviceFeeAmount: number;
  serviceFeeMinCap?: Money | number;
  serviceFeeMaxCap?: Money | number;
  bagFee: Money | number;
  freeDeliveryThreshold?: Money | number;
  minimumBasketThreshold?: Money | number;
  smallOrderFee?: Money | number;
  smallOrderFeeEnabled?: boolean;
  serviceFeeEnabled?: boolean;
  reauthorizationTolerancePercent?: number; // Tolerated variance before requiring re-auth
}

/**
 * Tenant-level policy controlling whether/how a customer can order from a store
 * that isn't open right now. Deliberately three distinct switches rather than one:
 * a store closed right now can still be ASAP-orderable once it opens (next-opening
 * pre-order), independently of whether customers may pick a specific later slot the
 * same day while the store is open (same-day scheduled pre-order). Pre-ordering
 * beyond the current day is intentionally not modeled here (kept simple).
 */
export interface TenantSchedulingPolicy {
  /** When true, disables both pre-order modes below — only ASAP-while-open orders are accepted. */
  acceptAsapOrdersOnly: boolean;
  /** Allow building/creating a basket for a closed store, targeting its next real opening time. */
  allowNextOpeningPreOrder: boolean;
  /** Allow picking a specific later time slot, same day, while the store is/will be open. */
  allowSameDayScheduledPreOrder: boolean;
}

export const DEFAULT_TENANT_SCHEDULING_POLICY: TenantSchedulingPolicy = {
  acceptAsapOrdersOnly: false,
  allowNextOpeningPreOrder: true,
  allowSameDayScheduledPreOrder: true,
};

export interface VisualRuleMatchCondition {
  field: 'productTag' | 'category' | 'brand' | 'ruleGroup' | 'isAlcohol' | 'plu';
  operator: 'equals' | 'contains' | 'in';
  value: string;
}

export type VisualRuleAction =
  | { type: 'MINIMUM_AGE'; minimumAge: number; requiresGate?: boolean; requiresAcknowledgement?: boolean; params?: Record<string, unknown> }
  | { type: 'PREVENT_UPSELL'; params?: Record<string, unknown> }
  | { type: 'PREVENT_RECOMMENDATION'; params?: Record<string, unknown> }
  | { type: 'EXCLUDE_FROM_DISCOUNTS'; params?: Record<string, unknown> }
  | { type: 'PREVENT_STORY_PLACEMENT'; params?: Record<string, unknown> }
  | { type: 'PREVENT_CAROUSEL_PLACEMENT'; params?: Record<string, unknown> }
  | { type: 'PREVENT_PURCHASE'; reason?: string; params?: Record<string, unknown> }
  | { type: 'HIDE_PRODUCT'; params?: Record<string, unknown> }
  | { type: 'MAX_QUANTITY_PER_ORDER'; maximum: number; reason?: string; params?: Record<string, unknown> }
  | { type: 'COMBINED_GROUP_LIMIT'; groupId: string; maximum: number; groupName?: string; params?: Record<string, unknown> }
  | { type: 'REQUIRES_COURIER_VERIFICATION'; verificationType?: string; params?: Record<string, unknown> }
  | { type: 'REQUIRES_ALLERGEN_DISPLAY'; params?: Record<string, unknown> }
  | { type: 'BADGE'; label: string; localizationKey?: string; params?: Record<string, unknown> }
  | { type: 'WARNING'; text: string; params?: Record<string, unknown> };

export interface VisualRule {
  id: string;
  name: string;
  enabled: boolean;
  countries: string[];
  priority: number;
  matchConditions: VisualRuleMatchCondition[];
  actions: VisualRuleAction[];
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: AdminRole;
  tenantId: string;
  category: 'Tenant' | 'Branding' | 'Stories' | 'Fees' | 'Rules' | 'Features' | 'Stores' | 'Integration' | 'Assets' | 'Compliance' | 'Payment';
  action: string;
  details: string;
  actorType?: 'human' | 'assistant' | 'system';
  changeSetId?: string;
  sourcePrompt?: string;
  actionRisk?: 'READ' | 'LOW_WRITE' | 'HIGH_WRITE' | 'RESTRICTED';
  beforeState?: unknown;
  afterState?: unknown;
  reversible?: boolean;
  reversedAt?: string;
}

export interface CheckoutSummary {
  basket: Basket;
  store: Store;
  deliveryAddress?: Address;
  estimatedDeliveryWindow: string;
  paymentMethods: string[];
  canProceed: boolean;
  warnings: string[];
}

export interface BootstrapResponse {
  tenant: TenantConfig;
  supportedCountries: string[];
  defaultLocation: {
    address: string;
    coordinates: Coordinates;
  };
}

// ==========================================
// CONNECTION HEALTH & REQUEST TRACE MODELS
// ==========================================

export type ConnectionTraceFailureType =
  | 'NOT_CONFIGURED'
  | 'PERMISSION_DENIED'
  | 'UPSTREAM_ERROR'
  | 'EMPTY_VALID_RESPONSE'
  | 'UNMAPPED_LOCATION'
  | 'RENDER_FILTERED';

export interface Stage1UpstreamTrace {
  stage: 'UPSTREAM';
  status: 'SUCCESS' | 'FAILED';
  httpStatus: number;
  latencyMs: number;
  url: string;
  rawMenusCount: number;
  rawProductsCount: number;
  payloadSizeBytes: number;
  timestamp: string;
  error?: { code: string; message: string };
}

export interface Stage2BffNormalizationTrace {
  stage: 'BFF_NORMALIZATION';
  status: 'SUCCESS' | 'FAILED';
  latencyMs: number;
  selectedMenuId: string;
  selectedMenuName: string;
  parsedProductsCount: number;
  activeCount: number;
  inactiveCount: number;
  snoozedCount: number;
  categoriesCount: number;
  bundlesCount: number;
  error?: { code: string; message: string };
}

export interface Stage3HttpClientTrace {
  stage: 'HTTP_CLIENT';
  status: 'SUCCESS' | 'FAILED';
  httpStatus: number;
  roundtripLatencyMs: number;
  receivedPayloadSize: number;
  receivedProductsCount: number;
  error?: { code: string; message: string };
}

export interface Stage4HookTrace {
  stage: 'HOOK';
  status: 'SUCCESS' | 'FAILED';
  hookName: 'useCatalog';
  productsInState: number;
  categoriesInState: number;
  summariesCount: number;
  error?: { code: string; message: string };
}

export interface Stage5VisibleCardsTrace {
  stage: 'VISIBLE_CARDS';
  status: 'SUCCESS' | 'FAILED' | 'ANOMALY_ZERO_RENDERABLE';
  renderableProductsCount: number;
  visibleCardCount: number;
  filterDropCount: number;
  filterDropReasons: Record<string, number>;
  zeroRenderableWarning: boolean;
  explanation: string;
  error?: { code: string; message: string };
}

export interface ConnectionTraceResult {
  traceId: string;
  tenantId: string;
  runtimeMode: string;
  storeId?: string;
  channelLinkId?: string;
  forceFailureType?: ConnectionTraceFailureType;
  overallStatus: 'SUCCESS' | 'FAILED' | 'ZERO_RENDERABLE_WARNING';
  exactFailureStage?: 'UPSTREAM' | 'BFF_NORMALIZATION' | 'HTTP_CLIENT' | 'HOOK' | 'RENDER_FILTER';
  exactErrorCode?: ConnectionTraceFailureType;
  errorMessage?: string;
  stage1Upstream: Stage1UpstreamTrace;
  stage2Bff: Stage2BffNormalizationTrace;
  stage3HttpClient: Stage3HttpClientTrace;
  stage4Hook: Stage4HookTrace;
  stage5Cards: Stage5VisibleCardsTrace;
  timestamp: string;

  // Convenient aliases for UI and assertions
  status?: 'SUCCESS' | 'FAILED' | 'ZERO_RENDERABLE_WARNING';
  failedStage?: 'UPSTREAM' | 'BFF_NORMALIZATION' | 'HTTP_CLIENT' | 'HOOK' | 'VISIBLE_CARDS';
  errorCode?: ConnectionTraceFailureType;
  totalDurationMs?: number;
  stages?: Array<{
    stage: 'UPSTREAM' | 'BFF_NORMALIZATION' | 'HTTP_CLIENT' | 'HOOK' | 'VISIBLE_CARDS';
    name: string;
    status: 'SUCCESS' | 'ERROR' | 'SKIPPED' | 'WARNING';
    count: number;
    details: any;
    error?: { code: string; message: string };
  }>;
}

export interface ConnectionHealthData {
  runtimeMode: 'demo' | 'staging' | 'production' | 'unknown';
  resolvedTenant: {
    tenantId: string;
    slug?: string;
    name?: string;
    country?: string;
  };
  hostname: string;
  deliverect: {
    environment: 'staging' | 'production';
    accountId: string | null;
    configured: boolean;
    status: 'CONNECTED' | 'DEGRADED' | 'DISCONNECTED' | 'UNCONFIGURED';
    connectionState: 'HEALTHY' | 'DISCONNECTED';
    apiUrl: string;
  };
  counts: {
    physicalLocationsCount: number;
    commerceStoresCount: number;
    accountsCount: number;
  };
  menus: {
    rootMenu: {
      id: string;
      name: string;
      productCount: number;
      rawCount: number;
    } | null;
    storeMenu: {
      id: string;
      name: string;
      storeId: string;
      channelLinkId: string;
      fulfillmentType: string;
      selectionReason: string;
    } | null;
  };
  products: {
    rawProductCount: number;
    parsedProductCount: number;
    activeCount: number;
    inactiveCount: number;
    snoozedCount: number;
    renderableProductCount: number;
    hiddenByRuleCount: number;
  };
  sync: {
    lastSuccessfulSync: string | null;
    lastCheckedAt: string;
  };
  lastFailure: {
    stage: string;
    code: ConnectionTraceFailureType;
    message: string;
    timestamp: string;
  } | null;
  security: {
    credentialsExposed: false;
    customerDataExposed: false;
  };

  // Top-level aliases for direct access
  tenantId?: string;
  deliverectEnvironment?: string;
  deliverectAccountId?: string | null;
  physicalLocationsCount?: number;
  commerceStoresCount?: number;
  rawProductCount?: number;
  parsedProductCount?: number;
  renderableProductCount?: number;
  chosenRootMenu?: string | null;
  chosenStoreMenu?: string | null;
  lastSuccessfulSync?: string | null;
}
