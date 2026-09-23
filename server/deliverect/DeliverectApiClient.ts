import { DeliverectAdapter } from './DeliverectAdapter';
import { OAuthTokenManager } from './OAuthTokenManager';
import { LinkedAccountsAdapter } from './LinkedAccountsAdapter';
import { IntegrationContext } from './IntegrationContext';
import { CommerceDiscoveryService, asyncPool } from './CommerceDiscoveryService';
import { resolveStoreGeography } from '../geographyService';
import { circuitBreakers } from '../circuitBreaker';
import { MetricsService } from '../metricsService';
import { CommerceError } from '../errors';
import { assertProductAddAllowed } from '../ruleEnforcementService';
import { FirestorePlatformService, BasketBundleAllocationRecord } from '../firestoreService';
import { toDisplayOrderReference } from '../orderReferenceService';
import { randomUUID } from 'node:crypto';
import { mergeDeliverectTagDefinitions } from './DeliverectTagDefinitions';
import {
  DeliverectCommerceBasketApiClient,
  CommerceBasketItemInput,
  CommerceBasketDiscountInput,
} from './DeliverectCommerceBasketApi';
import {
  mapDeliverectBasket,
  toCommerceItemInputs,
  buildQuestItemUnavailableActions,
  type MappedBasket,
} from './DeliverectBasketMapper';
import type { CheckoutResult } from '../../src/domain/models';
import { ensureNestedCategoryTree } from '../../src/commerce/categoryHierarchy';
import { evaluateStoreOpenNow, computeNextOpeningTime, normalizeOpeningHours } from '../../src/services/storeOpeningHoursService';
import {
  getZonedDateParts,
  resolveStoreTimeZone,
  weekdayIndexForDateString,
  zonedLocalDateTimeToUtc,
} from '../../src/utils/zonedTime';
import {
  Store,
  StoreStatus,
  StoreEligibilityResult,
  Catalog,
  CatalogDiagnostics,
  Category,
  Product,
  ProductTagDefinition,
  ProductAvailabilitySummary,
  Basket,
  Coordinates,
  Address,
  DeliveryOption,
  DeliverySlot,
  TenantFeatureFlags,
  HostedPaymentSession,
  Order,
  Money,
  toMoney,
  FulfillmentSchedulingType,
  BundleProduct,
  BundleCatalog,
  BundleModifierGroup,
  BundleModifier,
  evaluateBundleStockStatus,
  TenantSchedulingPolicy,
  DEFAULT_TENANT_SCHEDULING_POLICY,
} from '../../src/commerce/models';
import type {
  AddBundleToBasketRequest,
  SelectedBundleModifier,
} from '../../src/commerce/bundleModels';
import { allocateProtectedBundlePrices } from '../../src/commerce/bundleAllocation';
import { qualifyAutomaticDeals } from '../../src/commerce/automaticDealEngine';

export const FALLBACK_CATEGORY_ID = 'cat_other_fallback';
export const FALLBACK_CATEGORY_NAME = 'Store Specials & Local Products';

export type DeliverectChannelNameSource =
  | 'integration_config'
  | 'oauth_scope'
  | 'missing'
  | 'ambiguous';

export interface DeliverectChannelNameResolution {
  channelName?: string;
  source: DeliverectChannelNameSource;
  grantedChannelScopes: string[];
}

/**
 * Resolves the Channel API path segment without treating OAuth scope discovery
 * as an authorization gate. An explicitly configured Channel Name is
 * authoritative. OAuth genericChannel:<scope> is only a convenience fallback.
 */
export function resolveDeliverectChannelName(
  configuredChannelName: string | undefined,
  grantedChannelScopes: string[] = []
): DeliverectChannelNameResolution {
  const configured = String(configuredChannelName || '')
    .trim()
    .toLowerCase();
  if (configured) {
    return {
      channelName: configured,
      source: 'integration_config',
      grantedChannelScopes,
    };
  }

  const scopes = Array.from(
    new Set(
      grantedChannelScopes
        .map((scope) => String(scope || '').trim().toLowerCase())
        .filter(Boolean)
    )
  );

  if (scopes.length === 1) {
    return {
      channelName: scopes[0],
      source: 'oauth_scope',
      grantedChannelScopes: scopes,
    };
  }

  return {
    source: scopes.length > 1 ? 'ambiguous' : 'missing',
    grantedChannelScopes: scopes,
  };
}

export function applyCategoryFallback(
  categories: Category[],
  products: Product[],
  bundleProducts: BundleProduct[] = []
): void {
  const knownCatIds = new Set<string>();
  const collectCatIds = (cats: Category[]) => {
    for (const c of cats) {
      if (c && c.id) {
        knownCatIds.add(String(c.id));
        if (Array.isArray(c.subcategories) && c.subcategories.length > 0) {
          collectCatIds(c.subcategories);
        }
      }
    }
  };
  collectCatIds(categories);

  let unmappedCount = 0;

  for (const p of products) {
    const validCategoryIds = (p.categoryIds || []).filter((cid) => knownCatIds.has(cid));
    if (validCategoryIds.length === 0) {
      p.categoryIds = [FALLBACK_CATEGORY_ID];
      unmappedCount++;
    } else {
      p.categoryIds = validCategoryIds;
    }
  }

  for (const b of bundleProducts) {
    const validCategoryIds = (b.categoryIds || []).filter((cid) => knownCatIds.has(cid));
    if (validCategoryIds.length === 0) {
      b.categoryIds = [FALLBACK_CATEGORY_ID];
      unmappedCount++;
    } else {
      b.categoryIds = validCategoryIds;
    }
  }

  if (unmappedCount > 0 && !knownCatIds.has(FALLBACK_CATEGORY_ID)) {
    categories.push({
      id: FALLBACK_CATEGORY_ID,
      name: FALLBACK_CATEGORY_NAME,
      description: 'Store-specific items and local products',
      parentId: null,
      level: 1,
      productCount: unmappedCount,
    });
  }
}

/**
 * Directive 3: Normalize a product as snoozed only when the actual Deliverect value means
 * it is currently snoozed. Check lookup by both Deliverect product ID and PLU.
 * Do NOT use Boolean(snoozedMap[id]) on arbitrary objects.
 */
export function evaluateDeliverectSnooze(p: any, snoozedPayload: any, prodId: string, plu: string): boolean {
  if (p.snoozed === true || p.isSnoozed === true) {
    return true;
  }
  if (p.snoozedUntil || p.snoozeEndTime) {
    const until = new Date(p.snoozedUntil || p.snoozeEndTime).getTime();
    if (!isNaN(until) && until > Date.now()) {
      return true;
    }
  }

  if (!snoozedPayload) {
    return false;
  }

  if (Array.isArray(snoozedPayload)) {
    return (
      snoozedPayload.includes(prodId) ||
      (plu && snoozedPayload.includes(plu)) ||
      snoozedPayload.some((item: any) => {
        if (typeof item === 'string') return item === prodId || item === plu;
        if (item && typeof item === 'object') {
          const itemId = String(item.id || item._id || item.productId || item.plu || '');
          if (itemId && (itemId === prodId || itemId === plu)) {
            if (item.snoozed === false || item.isSnoozed === false) return false;
            if (item.snoozedUntil || item.snoozeEndTime) {
              const until = new Date(item.snoozedUntil || item.snoozeEndTime).getTime();
              return !isNaN(until) ? until > Date.now() : true;
            }
            return true;
          }
        }
        return false;
      })
    );
  }

  if (typeof snoozedPayload === 'object') {
    const entry = snoozedPayload[prodId] ?? (plu ? snoozedPayload[plu] : undefined);
    if (entry === undefined || entry === null) {
      return false;
    }
    if (typeof entry === 'boolean') {
      return entry;
    }
    if (typeof entry === 'number') {
      if (entry === 1) return true;
      if (entry === 0) return false;
      return entry > Date.now();
    }
    if (typeof entry === 'object') {
      if (entry.snoozed === true || entry.isSnoozed === true) {
        return true;
      }
      if (entry.snoozed === false || entry.isSnoozed === false) {
        return false;
      }
      if (entry.snoozeEndTime || entry.snoozedUntil || entry.until) {
        const until = new Date(entry.snoozeEndTime || entry.snoozedUntil || entry.until).getTime();
        return !isNaN(until) && until > Date.now();
      }
      return false;
    }
    if (typeof entry === 'string') {
      if (entry.toLowerCase() === 'true') return true;
      if (entry.toLowerCase() === 'false') return false;
      const until = new Date(entry).getTime();
      return !isNaN(until) && until > Date.now();
    }
  }

  return false;
}

/**
 * Directive 6: Explicit menu identification/selection to choose active menu or log selection
 * based on fulfillment (delivery vs pickup/collection) or requested menuId.
 */
function selectStoreMenu(
  rawMenus: any[],
  requestedMenuId?: string,
  fulfillmentType?: 'delivery' | 'pickup'
): { selectedMenu: any; selectionReason: string } {
  if (rawMenus.length === 0) {
    return { selectedMenu: null, selectionReason: 'no_menus' };
  }

  // 1. Explicit menuId requested
  if (requestedMenuId) {
    const found = rawMenus.find((m: any) => String(m.menuId || m.id || m._id) === requestedMenuId);
    if (found) {
      return { selectedMenu: found, selectionReason: `explicit_menu_id:${requestedMenuId}` };
    }
  }

  // 2. Filter active menus
  const activeMenus = rawMenus.filter((m: any) => m.active !== false && m.status !== 'INACTIVE');
  const candidatePool = activeMenus.length > 0 ? activeMenus : rawMenus;

  // 3. Match by fulfillmentType if provided
  if (fulfillmentType) {
    const isDelivery = fulfillmentType === 'delivery';
    const matched = candidatePool.find((m: any) => {
      const types = Array.isArray(m.orderTypes)
        ? m.orderTypes.map((t: any) => String(t).toUpperCase())
        : Array.isArray(m.fulfillmentTypes)
        ? m.fulfillmentTypes.map((t: any) => String(t).toUpperCase())
        : [];
      if (isDelivery && (types.includes('DELIVERY') || types.includes('ONLINE_DELIVERY'))) {
        return true;
      }
      if (!isDelivery && (types.includes('PICKUP') || types.includes('COLLECTION') || types.includes('TAKEAWAY'))) {
        return true;
      }
      if (isDelivery && m.menuType === 1) return true;
      if (!isDelivery && m.menuType === 2) return true;

      const name = String(m.menu || m.name || '').toLowerCase();
      if (isDelivery && name.includes('delivery')) return true;
      if (!isDelivery && (name.includes('pickup') || name.includes('collection') || name.includes('takeaway'))) return true;

      return false;
    });

    if (matched) {
      return {
        selectedMenu: matched,
        selectionReason: `matched_fulfillment:${fulfillmentType}`,
      };
    }
  }

  // 4. Default to first active menu or first available menu
  return {
    selectedMenu: candidatePool[0],
    selectionReason: activeMenus.length > 0 ? 'first_active_menu' : 'first_available_menu',
  };
}

export function productIdentityKey(product: Pick<Product, 'gtin' | 'plu'>): string {
  const rawGtins = Array.isArray(product.gtin) ? product.gtin : [product.gtin];
  const gtin = rawGtins
    .map((value) => String(value ?? '').trim().replace(/\s+/g, ''))
    .find(Boolean);
  return gtin ? `gtin:${gtin}` : `plu:${String(product.plu || '').trim()}`;
}

export function productsShareIdentity(
  left: Pick<Product, 'gtin' | 'plu'>,
  right: Pick<Product, 'gtin' | 'plu'>
): boolean {
  return productIdentityKey(left) === productIdentityKey(right);
}

export interface StoreConfigOverride {
  isOpen?: boolean;
  status?: StoreStatus;
  deliveryRadiusKm?: number;
  deliveryEta?: string;
  name?: string;
}

const storeOverrides: Map<string, StoreConfigOverride> = new Map();

export function setStoreOverride(storeId: string, override: StoreConfigOverride): void {
  const current = storeOverrides.get(storeId) || {};
  const merged = { ...current, ...override };
  storeOverrides.set(storeId, merged);
  const rawId = storeId.replace(/^cstore_/, '');
  storeOverrides.set(rawId, merged);
}

export function getStoreOverride(storeId: string): StoreConfigOverride | undefined {
  return storeOverrides.get(storeId) || storeOverrides.get(storeId.replace(/^cstore_/, ''));
}

export class DeliverectApiClient implements DeliverectAdapter {
  readonly adapterName = 'DeliverectApiClient (Live Deliverect Open API)';
  private tokenManager: OAuthTokenManager;
  private baseUrl: string;
  private tenantId: string = 'brand-alpha';
  private deliverectAccountId?: string;
  private allowedChannelLinkIds?: Set<string>;
  private tagDefinitionsCache?: { definitions: ProductTagDefinition[]; loadedAt: number };
  private static readonly TAG_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

  constructor(
    tokenManagerOrTenant?: OAuthTokenManager | string,
    tenantId?: string,
    deliverectAccountId?: string,
    allowedChannelLinkIds?: string[]
  ) {
    if (tokenManagerOrTenant instanceof OAuthTokenManager) {
      this.tokenManager = tokenManagerOrTenant;
      this.tenantId = tenantId || 'brand-alpha';
    } else if (typeof tokenManagerOrTenant === 'string') {
      this.tenantId = tokenManagerOrTenant;
      this.tokenManager = OAuthTokenManager.getInstance(tokenManagerOrTenant);
    } else {
      this.tokenManager = new OAuthTokenManager();
      this.tenantId = tenantId || 'brand-alpha';
    }
    this.deliverectAccountId = deliverectAccountId;
    this.allowedChannelLinkIds = allowedChannelLinkIds === undefined
      ? undefined
      : new Set(allowedChannelLinkIds.map(String));
    this.baseUrl = this.tokenManager.config.baseUrl;
  }

  get isConnected(): boolean {
    return this.tokenManager.isConfigured;
  }

  /**
   * Staging / production guard:
   * When an endpoint contract is awaiting verified staging confirmation,
   * fail explicitly with 501 NOT_IMPLEMENTED rather than falling back to mock fixtures.
   */
  private throwUnverifiedContract(operation: string): never {
    const error: any = new Error(
      `Deliverect live integration method "${operation}" requires active staging contract verification (501 NOT_IMPLEMENTED). Mock fallback is forbidden in non-demo mode.`
    );
    error.statusCode = 501;
    error.code = 'INTEGRATION_CAPABILITY_NOT_IMPLEMENTED';
    throw error;
  }

  /**
   * Resolves the authoritative Deliverect account ID for this tenant.
   */
  async resolveAccountId(): Promise<string> {
    if (this.deliverectAccountId && this.deliverectAccountId !== 'default') return this.deliverectAccountId;
    const context = await IntegrationContext.getContext(this.tenantId);
    if (!context.deliverectAccountId) {
      const error: any = new Error(`Tenant "${this.tenantId}" has no Deliverect account assigned. A platform super admin must assign an account before live commerce data can be read.`);
      error.statusCode = 503;
      error.code = 'DELIVERECT_ACCOUNT_NOT_ASSIGNED';
      throw error;
    }
    this.deliverectAccountId = context.deliverectAccountId;
    return context.deliverectAccountId;
  }

  /**
   * Resolves the channelLinkId for a store ID.
   */
  async resolveStoreChannelLinkId(storeId: string): Promise<{ channelLinkId: string; store: Store | null }> {
    const stores = await this.getStores();
    const store = stores.find(s => s.id === storeId || s.channelLinkId === storeId || s.id === `cstore_${storeId}`) || null;
    if (!store?.channelLinkId) {
      const error: any = new Error(`Store "${storeId}" is not assigned to tenant "${this.tenantId}".`);
      error.statusCode = 404;
      error.code = 'STORE_NOT_ASSIGNED_TO_TENANT';
      throw error;
    }
    return { channelLinkId: store.channelLinkId, store };
  }

  async testConnection(accountId?: string): Promise<{ success: boolean; message: string; latencyMs: number }> {
    const start = Date.now();
    try {
      return await circuitBreakers.commerce.execute(async () => {
        const token = await this.tokenManager.getAccessToken();
        const targetAccId = accountId || (await this.resolveAccountId().catch(() => ''));

        let menuCount = 0;
        if (targetAccId) {
          const res = await fetch(`${this.baseUrl}/commerce/${encodeURIComponent(targetAccId)}/menus`, {
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          });
          if (res.ok) {
            const menus = await res.json();
            menuCount = Array.isArray(menus) ? menus.length : 1;
          }
        }

        const latencyMs = Date.now() - start;
        MetricsService.recordUpstreamCall('commerce', true, latencyMs);

        return {
          success: true,
          message: `Live Deliverect Commerce handshake successful (${latencyMs}ms). Token valid for account ${targetAccId || 'primary'}. Root menus verified (${menuCount} discovered).`,
          latencyMs,
        };
      });
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      MetricsService.recordUpstreamCall('commerce', false, latencyMs);
      return {
        success: false,
        message: `Deliverect upstream network handshake failed: ${err.message}`,
        latencyMs,
      };
    }
  }

  async getStores(coords?: Coordinates, _fulfillmentType?: 'delivery' | 'pickup'): Promise<Store[]> {
    const adapter = new LinkedAccountsAdapter({ tokenManager: this.tokenManager });
    const sync = await adapter.getTenantMappings(this.tenantId || 'brand-alpha');
    const locMap = new Map(sync.locations.map((l) => [l.physicalLocationId, l]));

    const schedulingPolicy: TenantSchedulingPolicy = await FirestorePlatformService
      .getTenantSchedulingPolicy(this.tenantId || 'brand-alpha')
      .catch(() => DEFAULT_TENANT_SCHEDULING_POLICY);
    const storeScheduling = schedulingPolicy.acceptAsapOrdersOnly
      ? { acceptsAsapOrders: true, acceptsPreOrders: false, acceptsSameDayPreOrders: false }
      : {
          acceptsAsapOrders: true,
          acceptsPreOrders: schedulingPolicy.allowNextOpeningPreOrder,
          acceptsSameDayPreOrders: schedulingPolicy.allowSameDayScheduledPreOrder,
        };

    const accountId = await this.resolveAccountId();
    const operationalStates = await FirestorePlatformService
      .getStoreOperationalStates(this.tenantId || 'brand-alpha')
      .catch(() => ({}));
    const accountLinkIds = new Set(sync.accounts.filter(account => account.deliverectAccountId === accountId).map(account => account.accountLinkId));
    const scopedStores = sync.stores
      .filter(store => accountLinkIds.has(store.accountLinkId))
      .filter(store => !this.allowedChannelLinkIds || this.allowedChannelLinkIds.has(store.channelLinkId));
    if (accountLinkIds.size === 0) {
      const error: any = new Error(`Assigned Deliverect account "${accountId}" is not mapped to tenant "${this.tenantId}".`);
      error.statusCode = 503;
      error.code = 'TENANT_ACCOUNT_MAPPING_MISSING';
      throw error;
    }

    const stores: Store[] = scopedStores.map((s) => {
      const loc = s.physicalLocationId ? locMap.get(s.physicalLocationId) : undefined;
      // Do NOT fabricate central London coordinates. Retain exact store/location coordinates or keep undefined.
      let storeCoords: Coordinates | undefined = s.coordinates
        ? { latitude: s.coordinates.latitude, longitude: s.coordinates.longitude }
        : loc?.coordinates
          ? { latitude: loc.coordinates.latitude, longitude: loc.coordinates.longitude }
          : undefined;

      const supportsDelivery = Boolean(s.fulfillmentCapabilitiesProjection?.delivery ?? false);
      const supportsPickup = Boolean(s.fulfillmentCapabilitiesProjection?.pickup ?? false);

      const override = getStoreOverride(s.commerceStoreId) || (s.channelLinkId ? getStoreOverride(s.channelLinkId) : undefined);
      const operational = s.channelLinkId ? operationalStates[s.channelLinkId] : undefined;
      const operationalStatus = String(operational?.status || '').toUpperCase();
      const isPausedOperationally = operationalStatus === 'PAUSED' || operationalStatus === 'CLOSED';
      const isBusyOperationally = operationalStatus === 'BUSY';
      const isExplicitlyOnline = operationalStatus === 'ONLINE' || operationalStatus === 'OPEN';
      const isOpen =
        operationalStatus
          ? !isPausedOperationally
          : override?.isOpen !== undefined
            ? override.isOpen
            : s.stateProjection === 'paused'
              ? false
              : true;
      const status: StoreStatus =
        isPausedOperationally
          ? 'paused'
          : isBusyOperationally
            ? 'busy'
            : isExplicitlyOnline
              ? 'open'
              : override?.status || (isOpen ? 'open' : 'closed');
      const deliveryRadiusKm = override?.deliveryRadiusKm ?? s.deliveryRadiusKm ?? 5.0;
      const deliveryEta = override?.deliveryEta || s.deliveryEta || '15-25 mins';

      const sAddr = s.address as any;
      const locAddr = loc?.addressProjection as any;
      const street = sAddr?.street || sAddr?.line1 || locAddr?.street || locAddr?.line1 || '';
      const city = sAddr?.city || locAddr?.city || '';
      const postcode = sAddr?.postcode || sAddr?.postalCode || locAddr?.postcode || locAddr?.postalCode || '';
      const country = sAddr?.country || locAddr?.country || '';
      const formattedAddress = sAddr?.formattedAddress || [street, city, postcode, country].filter(Boolean).join(', ');
      const line1 = street || sAddr?.line1 || formattedAddress || '';

      // If storeCoords are missing and UK postcode is present, map known store postcodes accurately
      if (!storeCoords && postcode) {
        const cleanPc = postcode.toUpperCase().replace(/\s+/g, '');
        if (cleanPc === 'HR53UA') {
          storeCoords = { latitude: 52.205398, longitude: -3.034417 };
        }
      }

      return {
        id: s.channelLinkId || s.commerceStoreId,
        channelLinkId: s.channelLinkId,
        channelLocationId: s.channelLocationId || undefined,
        physicalLocationId: s.physicalLocationId || undefined,
        deliverectLocationId: loc?.deliverectLocationId || undefined,
        // Friendly retailer/POS store number (for example 1234). This is display
        // metadata only: Commerce APIs must continue to use channelLinkId.
        brandStoreId: s.brandStoreId || loc?.brandStoreId || undefined,
        name: override?.name || s.name,
        address: {
          street: street || line1,
          line1,
          city,
          postcode,
          postalCode: postcode,
          country,
          formattedAddress,
        },
        coordinates: storeCoords,
        distanceMeters: 0,
        status,
        stateProjection: operationalStatus
          ? operationalStatus.toLowerCase()
          : s.stateProjection,
        preparationTimeDelay:
          operational?.preparationTimeDelay ?? s.preparationTimeDelay,
        supportsDelivery,
        supportsPickup,
        isOpen,
        deliveryRadiusKm,
        deliveryEta,
        currency: (s as any).currency || (loc as any)?.currency || 'GBP',
        phone: s.phone || loc?.phone || undefined,
        email: s.email || loc?.email || undefined,
        timezone: s.timezone || loc?.timezone || undefined,
        services: s.services?.length ? s.services : loc?.services || undefined,
        // Previously never passed through, so every real store silently fell back to
        // storeOpeningHoursService's demo-only default (07:00-23:00) regardless of its
        // actual Deliverect hours — fixed here.
        openingHours: (s as any).openingHours || loc?.openingHours,
        scheduling: storeScheduling,
      };
    });

    // Nation/Region/County derived once per store and cached in Firestore
    // (see geographyService.ts) — bounded concurrency so a large store list
    // doesn't fire dozens of simultaneous postcodes.io/Firestore lookups.
    await asyncPool(4, stores, async (store) => {
      try {
        store.geography = await resolveStoreGeography(store.id, store.address);
      } catch (err) {
        console.warn(`[DeliverectApiClient] Could not resolve geography for store ${store.id}:`, err);
      }
    });

    return stores;
  }

  async getStore(storeId: string): Promise<Store | null> {
    const stores = await this.getStores();
    return stores.find((s) => s.id === storeId || s.channelLinkId === storeId || s.id === `cstore_${storeId}`) || null;
  }

  async getEligibleStores(
    coords: Coordinates,
    address?: Address,
    preferredFulfillment?: 'delivery' | 'pickup'
  ): Promise<StoreEligibilityResult> {
    const stores = await this.getStores(coords, preferredFulfillment);
    return CommerceDiscoveryService.getInstance().discoverStores({
      tenantId: this.tenantId,
      coordinates: coords,
      address,
      preferredFulfillment,
      customStores: stores.filter((store) => this.isUsableStore(store)),
      appMode: 'staging',
    });
  }

  async getProductTagDefinitions(forceRefresh = false): Promise<ProductTagDefinition[]> {
    if (!forceRefresh && this.tagDefinitionsCache && Date.now() - this.tagDefinitionsCache.loadedAt < DeliverectApiClient.TAG_CACHE_TTL_MS) return this.tagDefinitionsCache.definitions;
    const raw = await circuitBreakers.commerce.execute(async () => {
      const token = await this.tokenManager.getAccessToken();
      const response = await fetch(`${this.baseUrl}/allAllergens`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
      if (!response.ok) { const error: any = new Error(`Deliverect Allergens & Tags request failed: HTTP ${response.status}`); error.statusCode = 502; error.code = 'DELIVERECT_TAGS_UNAVAILABLE'; throw error; }
      return await response.json() as any;
    });
    // Normalize the known Deliverect response variants and merge documented standard
    // IDs so customer-facing UI never falls back to raw numeric productTags.
    const definitions = mergeDeliverectTagDefinitions(raw);
    this.tagDefinitionsCache = { definitions, loadedAt: Date.now() };
    return definitions;
  }

  parseDeliverectMenu(
    rawMenu: any,
    isStoreCatalog: boolean,
    tagDefinitions: ProductTagDefinition[] = [],
    options?: { featureFlags?: TenantFeatureFlags; enableSequentialCategoryGrouping?: boolean }
  ): { categories: Category[]; products: Product[]; bundleCatalog: BundleCatalog } {
    return DeliverectApiClient.parseDeliverectMenu(rawMenu, isStoreCatalog, tagDefinitions, options);
  }

  static parseDeliverectMenu(
    rawMenu: any,
    isStoreCatalog: boolean,
    tagDefinitions: ProductTagDefinition[] = [],
    options?: { featureFlags?: TenantFeatureFlags; enableSequentialCategoryGrouping?: boolean }
  ): { categories: Category[]; products: Product[]; bundleCatalog: BundleCatalog } {
    const tagDefinitionMap = new Map(tagDefinitions.map(definition => [String(definition.id), definition]));
    const productCategoryMap = new Map<string, string[]>();

    // 1. Pass 1: Build raw category map and associate products
    const rawCategoryList: any[] = Array.isArray(rawMenu.categories)
      ? rawMenu.categories
      : rawMenu.categories && typeof rawMenu.categories === 'object'
        ? Object.values(rawMenu.categories)
        : [];

    const rawCategoryMap = new Map<string, any>();
    const childIdSet = new Set<string>();
    const childIdsByParent = new Map<string, string[]>();
    const directProductIdsByCategory = new Map<string, string[]>();

    const referenceId = (value: any): string =>
      typeof value === 'string' || typeof value === 'number'
        ? String(value)
        : String(value?.id || value?._id || value?.productId || value?.plu || '');

    const addChild = (parentId: string, childId: string) => {
      if (!parentId || !childId || parentId === childId) return;
      const children = childIdsByParent.get(parentId) || [];
      if (!children.includes(childId)) children.push(childId);
      childIdsByParent.set(parentId, children);
      childIdSet.add(childId);
    };

    const indexRawCategory = (rawCat: any) => {
      const catId = String(rawCat.id || rawCat._id || '');
      if (!catId) return;
      rawCategoryMap.set(catId, rawCat);

      const rawProductRefs: any[] = Array.isArray(rawCat.productIds)
        ? rawCat.productIds
        : Array.isArray(rawCat.products)
          ? rawCat.products
          : Array.isArray(rawCat.subProducts)
            ? rawCat.subProducts
            : [];
      const productIds = rawProductRefs.map(referenceId).filter(Boolean);
      directProductIdsByCategory.set(catId, Array.from(new Set(productIds)));
      for (const prodId of productIds) {
        const existing = productCategoryMap.get(prodId) || [];
        if (!existing.includes(catId)) existing.push(catId);
        productCategoryMap.set(prodId, existing);
      }

      const rawSubCats = Array.isArray(rawCat.subCategories)
        ? rawCat.subCategories
        : Array.isArray(rawCat.subcategories)
          ? rawCat.subcategories
          : Array.isArray(rawCat.children)
            ? rawCat.children
            : Array.isArray(rawCat.subCategoryIds)
              ? rawCat.subCategoryIds
              : Array.isArray(rawCat.sub_categories)
                ? rawCat.sub_categories
                : [];

      if (rawSubCats.length > 0) {
        for (const sub of rawSubCats) {
          if (typeof sub === 'string') {
            addChild(catId, sub);
          } else if (sub && typeof sub === 'object') {
            const subId = String(sub.id || sub._id || '');
            if (subId) addChild(catId, subId);
            indexRawCategory(sub);
          }
        }
      }

      const rawParentId = rawCat.parentId || rawCat.parent || rawCat.parentCategoryId || rawCat.parent_id || rawCat.categoryParentId;
      if (rawParentId) {
        addChild(String(rawParentId), catId);
      }
    };

    for (const rawCat of rawCategoryList) {
      indexRawCategory(rawCat);
    }

    // 2. Pass 2: Reconstruct category tree preventing cycles
    const visited = new Set<string>();
    const buildCategoryTree = (catId: string, level: number = 1, parentId: string | null = null): Category | null => {
      if (visited.has(catId)) return null;
      visited.add(catId);

      const rawCat = rawCategoryMap.get(catId);
      if (!rawCat) return null;

      const subcategoryNodes: Category[] = [];

      for (const subId of childIdsByParent.get(catId) || []) {
        if (rawCategoryMap.has(subId)) {
          const childNode = buildCategoryTree(subId, level + 1, catId);
          if (childNode) subcategoryNodes.push(childNode);
        }
      }

      const descendantProductIds = new Set(directProductIdsByCategory.get(catId) || []);
      const collectDescendantProducts = (parentCategoryId: string, seen = new Set<string>()) => {
        if (seen.has(parentCategoryId)) return;
        seen.add(parentCategoryId);
        for (const childId of childIdsByParent.get(parentCategoryId) || []) {
          for (const productId of directProductIdsByCategory.get(childId) || []) descendantProductIds.add(productId);
          collectDescendantProducts(childId, seen);
        }
      };
      collectDescendantProducts(catId);

      return {
        id: catId,
        name: String(rawCat.name || 'Uncategorized'),
        description: rawCat.description || '',
        imageUrl: rawCat.imageUrl || undefined,
        parentId,
        level,
        subcategories: subcategoryNodes.length > 0 ? subcategoryNodes : undefined,
        productCount: descendantProductIds.size,
      };
    };

    // Root categories are those not marked as a child of another category
    const rawTreeCategories: Category[] = [];
    for (const [catId] of rawCategoryMap) {
      if (!childIdSet.has(catId)) {
        const rootNode = buildCategoryTree(catId, 1, null);
        if (rootNode) rawTreeCategories.push(rootNode);
      }
    }

    // Include any unvisited orphans
    for (const [catId] of rawCategoryMap) {
      if (!visited.has(catId)) {
        const orphanNode = buildCategoryTree(catId, 1, null);
        if (orphanNode) rawTreeCategories.push(orphanNode);
      }
    }

    // IMPORTANT: Keep flat Deliverect category feeds lossless here.
    //
    // Some retail menus encode hierarchy implicitly using sequential empty rows:
    //   Dairy & Eggs []
    //   Milk         []
    //   Whole Milk   [products]
    //
    // If we prune empty rows at the API adapter layer before the tenant feature
    // flag is available in the storefront, those structural parent rows are gone
    // forever and the browser cannot reconstruct the hierarchy.
    //
    // Therefore:
    // - explicit Deliverect parent/child relationships are normalised server-side;
    // - flat feeds are returned losslessly by default (including known-empty rows);
    // - callers that explicitly pass the sequential-grouping option may still ask
    //   for server-side grouping (useful for tests / future server-owned flags);
    // - the current storefront applies the tenant feature flag in useCatalog.
    const sequentialGroupingEnabled = Boolean(
      options?.enableSequentialCategoryGrouping ||
      options?.featureFlags?.enableSequentialCategoryGrouping
    );
    const hasExplicitCategoryHierarchy = childIdSet.size > 0;

    const categories: Category[] = hasExplicitCategoryHierarchy
      ? ensureNestedCategoryTree(rawTreeCategories)
      : sequentialGroupingEnabled
        ? ensureNestedCategoryTree(rawTreeCategories, {
            enableSequentialCategoryGrouping: true,
          })
        : rawTreeCategories;

    // Build raw modifier groups map
    const rawModifierGroupsMap = new Map<string, any>();
    const rawModifierGroups = rawMenu.modifierGroups;
    if (Array.isArray(rawModifierGroups)) {
      for (const mg of rawModifierGroups) {
        if (mg && (mg.id || mg._id)) {
          rawModifierGroupsMap.set(String(mg.id || mg._id), mg);
        }
      }
    } else if (rawModifierGroups && typeof rawModifierGroups === 'object') {
      for (const [key, mg] of Object.entries(rawModifierGroups)) {
        if (mg && typeof mg === 'object') {
          rawModifierGroupsMap.set(String((mg as any).id || (mg as any)._id || key), mg);
        }
      }
    }

    // Build raw modifiers map
    const rawModifiersMap = new Map<string, any>();
    const rawModifiers = rawMenu.modifiers;
    if (Array.isArray(rawModifiers)) {
      for (const mod of rawModifiers) {
        if (mod && (mod.id || mod._id)) {
          rawModifiersMap.set(String(mod.id || mod._id), mod);
        }
      }
    } else if (rawModifiers && typeof rawModifiers === 'object') {
      for (const [key, mod] of Object.entries(rawModifiers)) {
        if (mod && typeof mod === 'object') {
          rawModifiersMap.set(String((mod as any).id || (mod as any)._id || key), mod);
        }
      }
    }

    const rawProductsMap = new Map<string, any>();
    const rawStandaloneProductsByPlu = new Map<string, any>();
    const rawProducts: any[] = Array.isArray(rawMenu.products)
      ? rawMenu.products
      : rawMenu.products && typeof rawMenu.products === 'object'
      ? Object.values(rawMenu.products)
      : [];

    for (const p of rawProducts) {
      if (p && (p.id || p._id)) {
        rawProductsMap.set(String(p.id || p._id), p);
      }

      const productPlu = String(p?.plu || '').trim();
      if (productPlu && !productPlu.includes('#')) {
        const existing = rawStandaloneProductsByPlu.get(productPlu);
        const candidatePrice =
          typeof p?.price === 'number'
            ? Math.round(p.price)
            : typeof p?.priceMinor === 'number'
              ? Math.round(p.priceMinor)
              : -1;
        const existingPrice =
          typeof existing?.price === 'number'
            ? Math.round(existing.price)
            : typeof existing?.priceMinor === 'number'
              ? Math.round(existing.priceMinor)
              : -1;

        // If duplicate PLUs exist, retain the normal priced item rather than a
        // zero-value bundle/modifier variant.
        if (!existing || candidatePrice > existingPrice) {
          rawStandaloneProductsByPlu.set(productPlu, p);
        }
      }
    }

    const snoozedPayload = rawMenu.snoozedProducts || rawMenu.snoozed || {};

    const standardProducts: Product[] = [];
    const bundleProducts: BundleProduct[] = [];

    for (const p of rawProducts) {
      const prodId = String(p.id || p._id || '');
      const plu = String(p.plu || prodId);

      // Phase 1: Filter out modifier/bundle sub-components or items with '#' in PLU at ingestion layer
      if (plu.includes('#')) {
        continue;
      }

      const assignedCatIds = productCategoryMap.get(prodId) || productCategoryMap.get(plu) || [];
      const imageUrl = p.imageUrl || p.image || undefined;

      // Extract raw modifier groups (subProducts in Deliverect represent modifier group IDs for combos)
      const rawProductModGroups: any[] = Array.isArray(p.modifierGroups)
        ? p.modifierGroups
        : p.modifierGroups && typeof p.modifierGroups === 'object'
        ? Object.values(p.modifierGroups)
        : Array.isArray(p.subProducts)
        ? p.subProducts
        : Array.isArray(p.subItems)
        ? p.subItems
        : [];

      // Deliverect combos have productType 3, or subProducts pointing to modifierGroups, or explicit combo flags, or meal deal naming/PLU
      const hasModifierGroupsInSubProducts =
        Array.isArray(p.subProducts) &&
        p.subProducts.length > 0 &&
        p.subProducts.some((spId: any) => rawModifierGroupsMap.has(String(spId)));

      const isCombo = Boolean(
        p.isCombo === true ||
        p.isCombo === 'true' ||
        p.combo === true ||
        p.productType === 3 ||
        hasModifierGroupsInSubProducts ||
        (typeof p.name === 'string' && (
          p.name.toLowerCase().includes('meal deal') ||
          p.name.toLowerCase().includes('combo') ||
          p.name.toLowerCase().includes('bundle') ||
          p.name.toLowerCase().includes('set menu')
        )) ||
        (typeof p.plu === 'string' && (
          p.plu.startsWith('P-ME') ||
          p.plu.includes('MEALDEAL')
        ))
      );

      if (isCombo) {
        // Parse as BundleProduct
        const rawCurr = typeof p.currency === 'string' ? p.currency : (typeof rawMenu.currency === 'string' ? rawMenu.currency : 'GBP');
        const currency = rawCurr && rawCurr.length === 3 ? rawCurr : 'GBP';
        const basePrice = typeof p.price === 'number' ? Math.round(p.price) : typeof p.priceMinor === 'number' ? Math.round(p.priceMinor) : 500;

        const sections: BundleModifierGroup[] = rawProductModGroups.map((mgRef: any, groupIndex: number) => {
          const mgId = typeof mgRef === 'string' ? mgRef : String(mgRef.id || mgRef._id || `section_${groupIndex}`);
          const mgData = typeof mgRef === 'object' ? mgRef : rawModifierGroupsMap.get(mgId) || {};

          const sectionMin = typeof mgData.min === 'number' ? mgData.min : (typeof mgRef.min === 'number' ? mgRef.min : 0);
          const sectionMax = typeof mgData.max === 'number' ? mgData.max : (typeof mgRef.max === 'number' ? mgRef.max : Math.max(1, sectionMin));
          const isSectionCombo = mgData.isCombo !== undefined ? Boolean(mgData.isCombo) : (mgRef.isCombo !== undefined ? Boolean(mgRef.isCombo) : sectionMin > 0);
          const isSectionUpsell = mgData.isUpsell !== undefined ? Boolean(mgData.isUpsell) : (mgRef.isUpsell !== undefined ? Boolean(mgRef.isUpsell) : sectionMin === 0);

          // Modifiers in section - inspect modifiers, subProducts, subItems
          const rawModList: any[] = Array.isArray(mgData.modifiers)
            ? mgData.modifiers
            : Array.isArray(mgData.subProducts)
            ? mgData.subProducts
            : Array.isArray(mgData.subItems)
            ? mgData.subItems
            : Array.isArray(mgRef.modifiers)
            ? mgRef.modifiers
            : Array.isArray(mgRef.subProducts)
            ? mgRef.subProducts
            : [];

          const modifiers: BundleModifier[] = rawModList.map((mRef: any, modIndex: number) => {
            const mId = typeof mRef === 'string' ? mRef : String(mRef.id || mRef._id || `mod_${modIndex}`);
            const mData = typeof mRef === 'object' ? mRef : (rawModifiersMap.get(mId) || rawProductsMap.get(mId) || {});
            const modPlu = String(mData.plu || mRef.plu || mId);
            const modName = String(mData.name || mRef.name || modPlu);

            // Deliverect commonly publishes a zero-value bundle variant such as
            // DRN-03### and exposes the normal standalone PLU in referenceId. The
            // storefront bundle is exploded into normal products at basket time, so
            // retain the bundle uplift separately from the standalone shelf value.
            const referencedStandalonePlu = String(
              mData.referenceId ||
              mRef.referenceId ||
              mData.originalPlu ||
              mRef.originalPlu ||
              ''
            ).trim();
            // Real Deliverect combo sub-item PLUs are `{basePlu}###{SUFFIX}` (e.g.
            // "374263###PRNT"), not bare trailing hashes — a trailing-hash-only
            // regex (/#+$/) never matches once letters follow the "###", so it
            // silently failed to de-decorate every real combo PLU and left
            // standalonePlu unresolved whenever Deliverect also omitted referenceId.
            const deDecoratedPlu = modPlu.split('###')[0].trim();
            const standaloneCandidate =
              (referencedStandalonePlu
                ? rawStandaloneProductsByPlu.get(referencedStandalonePlu)
                : undefined) ||
              rawStandaloneProductsByPlu.get(deDecoratedPlu) ||
              rawStandaloneProductsByPlu.get(modPlu);
            const standalonePlu = String(
              standaloneCandidate?.plu ||
              referencedStandalonePlu ||
              (deDecoratedPlu !== modPlu ? deDecoratedPlu : '')
            ).trim() || undefined;
            const standalonePriceMinor =
              typeof standaloneCandidate?.price === 'number'
                ? Math.round(standaloneCandidate.price)
                : typeof standaloneCandidate?.priceMinor === 'number'
                  ? Math.round(standaloneCandidate.priceMinor)
                  : undefined;

            // Component pricing here is the bundle-specific uplift only: 0 for
            // included components, 100 for a +£1 premium choice, etc.
            const modPriceMinor = typeof mData.price === 'number' ? Math.round(mData.price) : (typeof mRef.price === 'number' ? Math.round(mRef.price) : 0);

            // Snooze & active evaluation
            const isModSnoozed = Boolean(
              mData.snoozed === true ||
              mData.isSnoozed === true ||
              mRef.snoozed === true ||
              mRef.isSnoozed === true ||
              evaluateDeliverectSnooze(mData, snoozedPayload, mId, modPlu)
            );

            const isModExplicitlyInactive =
              mData.active === false ||
              mData.available === false ||
              mRef.active === false ||
              mRef.available === false ||
              mData.status === 'INACTIVE' ||
              mData.status === 0;

            const isAutoApplied = Boolean(
              mData.isAutoApplied ||
              mRef.isAutoApplied ||
              mData.autoApplied ||
              mRef.autoApplied ||
              mData.default === true ||
              mRef.default === true ||
              mData.isDefault === true ||
              mRef.isDefault === true ||
              mData.preSelected === true ||
              mRef.preSelected === true ||
              (typeof mData.defaultQuantity === 'number' && mData.defaultQuantity > 0) ||
              (typeof mRef.defaultQuantity === 'number' && mRef.defaultQuantity > 0)
            );

            const modImg = mData.imageUrl || mData.image || mRef.imageUrl || mRef.image || rawProductsMap.get(mId)?.imageUrl || rawProductsMap.get(modPlu)?.imageUrl || undefined;

            return {
              id: mId,
              name: modName,
              plu: modPlu,
              standalonePlu,
              standalonePriceMinor,
              price: modPriceMinor,
              priceMinor: modPriceMinor,
              active: !isModExplicitlyInactive,
              snoozed: isModSnoozed,
              multiMin: typeof mData.multiMin === 'number' ? mData.multiMin : (typeof mRef.multiMin === 'number' ? mRef.multiMin : undefined),
              multiMax: typeof mData.multiMax === 'number' ? mData.multiMax : (typeof mRef.multiMax === 'number' ? mRef.multiMax : undefined),
              max: typeof mData.max === 'number' ? mData.max : (typeof mRef.max === 'number' ? mRef.max : undefined),
              imageUrl: modImg,
              isAutoApplied,
            };
          });

          return {
            id: mgId,
            name: String(mgData.name || mgRef.name || `Section ${groupIndex + 1}`),
            min: sectionMin,
            max: sectionMax,
            multiMin: typeof mgData.multiMin === 'number' ? mgData.multiMin : (typeof mgRef.multiMin === 'number' ? mgRef.multiMin : undefined),
            multiMax: typeof mgData.multiMax === 'number' ? mgData.multiMax : (typeof mgRef.multiMax === 'number' ? mgRef.multiMax : undefined),
            isCombo: isSectionCombo,
            isUpsell: isSectionUpsell,
            modifiers,
          };
        });

        // Dynamic stock status evaluation
        const stockEval = evaluateBundleStockStatus(sections);
        const isBundleSnoozed = evaluateDeliverectSnooze(p, snoozedPayload, prodId, plu);

        const finalStockStatus = isStoreCatalog
          ? (isBundleSnoozed || stockEval.stockStatus === 'OUT_OF_STOCK' ? 'OUT_OF_STOCK' : 'IN_STOCK')
          : 'IN_STOCK';

        const outOfStockReason = isBundleSnoozed
          ? 'Parent bundle item is snoozed'
          : (stockEval.outOfStockReason || undefined);

        const bundleProd: BundleProduct = {
          id: prodId,
          plu,
          name: String(p.name || plu),
          description: p.description || '',
          imageUrl,
          image: imageUrl,
          price: basePrice,
          priceMinor: basePrice,
          currency,
          isCombo: true,
          stockStatus: finalStockStatus,
          outOfStockReason,
          sections,
          modifierGroups: sections,
          categoryIds: assignedCatIds.length > 0 ? assignedCatIds : p.categoryIds || [],
          allergens: Array.isArray(p.allergens) ? p.allergens.map((value: string | number) => tagDefinitionMap.get(String(value))?.name || String(value)).filter((value: string) => !/^\d+$/.test(value)) : [],
          tags: Array.isArray(p.tags) ? p.tags : [],
        };

        bundleProducts.push(bundleProd);
      } else {
        // Standard Product parsing
        const baseProd: Product = {
          id: prodId,
          plu,
          gtin: p.gtin ? (Array.isArray(p.gtin) ? p.gtin : [p.gtin]) : [],
          name: String(p.name || plu),
          description: p.description || '',
          imageUrl,
          image: imageUrl,
          images: imageUrl ? [imageUrl] : [],
          categoryIds: assignedCatIds.length > 0 ? assignedCatIds : p.categoryIds || [],
          productTags: Array.isArray(p.productTags)
            ? p.productTags.filter((tag: unknown) => typeof tag === 'string' || (typeof tag === 'number' && Number.isFinite(tag))).map((tag: string | number) => String(tag))
            : [],
          displayLabels: Array.isArray(p.productTags) ? p.productTags.map((tag: string | number) => tagDefinitionMap.get(String(tag))).filter((definition): definition is ProductTagDefinition => Boolean(definition) && !definition!.isAllergen).map(definition => definition.name) : [],
          productTagLabels: Array.isArray(p.productTags) ? p.productTags.map((tag: string | number) => tagDefinitionMap.get(String(tag))?.name).filter((name): name is string => Boolean(name)) : [],
          unmappedProductTags: Array.isArray(p.productTags) ? p.productTags.map(String).filter((tagId: string) => !tagDefinitionMap.has(tagId)) : [],
          allergens: Array.from(new Set([...(Array.isArray(p.allergens) ? p.allergens.map((value: string | number) => tagDefinitionMap.get(String(value))?.name || String(value)).filter((value: string) => !/^\d+$/.test(value)) : []), ...(Array.isArray(p.productTags) ? p.productTags.map((tag: string | number) => tagDefinitionMap.get(String(tag))).filter((definition): definition is ProductTagDefinition => Boolean(definition?.isAllergen)).map(definition => definition.name) : [])])),
          modifierGroups: p.modifierGroups || (rawMenu.modifierGroups ? Object.values(rawMenu.modifierGroups) : undefined),
        };

        if (isStoreCatalog) {
          const hasPrice = typeof p.price === 'number';
          const rawCurr = typeof p.currency === 'string' ? p.currency : (typeof rawMenu.currency === 'string' ? rawMenu.currency : 'GBP');
          const currency = rawCurr && rawCurr.length === 3 ? rawCurr : 'GBP';
          const moneyPrice = hasPrice ? toMoney(p.price, currency) : undefined;

          // Directive 3: Inspect Deliverect snoozedProducts payload accurately.
          // Do NOT use Boolean(snoozedMap[id]) on arbitrary objects.
          // Check lookup by both Deliverect product ID and PLU.
          const isSnoozed = evaluateDeliverectSnooze(p, snoozedPayload, prodId, plu);

          // Directive 4: Do not treat missing active as false. Missing inventory state means unknown
          // unless Deliverect explicitly marks the item inactive/not ranged.
          const isExplicitlyInactive =
            p.active === false ||
            p.isRanged === false ||
            p.available === false ||
            (typeof p.status === 'string' && (p.status.toUpperCase() === 'INACTIVE' || p.status.toUpperCase() === 'UNAVAILABLE')) ||
            p.status === 0;

          const isOutOfStock =
            isSnoozed ||
            p.stockStatus === 'OUT_OF_STOCK' ||
            p.outOfStock === true ||
            (typeof p.stockQuantity === 'number' && p.stockQuantity <= 0);

          baseProd.price = moneyPrice;
          baseProd.basePrice = moneyPrice;
          baseProd.priceMinor = hasPrice ? p.price : undefined;
          baseProd.isSnoozed = isSnoozed;
          baseProd.stockStatus = isOutOfStock ? 'OUT_OF_STOCK' : 'IN_STOCK';
          baseProd.active = !isExplicitlyInactive;
          baseProd.multiMax = typeof p.multiMax === 'number' ? p.multiMax : undefined;
        } else {
          // Root Menu: store-agnostic, do not invent price, stock or availability
          baseProd.active = true;
        }

        standardProducts.push(baseProd);
      }
    }

    const bundleCatalog: BundleCatalog = {
      id: `bundle_catalog_${rawMenu.menuId || rawMenu.id || rawMenu._id || 'default'}`,
      storeId: isStoreCatalog ? String(rawMenu.channelLinkId || rawMenu.storeId || '') : undefined,
      accountId: String(rawMenu.accountId || ''),
      bundles: bundleProducts,
      totalBundles: bundleProducts.length,
      updatedAt: new Date().toISOString(),
    };

    applyCategoryFallback(categories, standardProducts, bundleProducts);

    return { categories, products: standardProducts, bundleCatalog };
  }

  async getRootCatalog(): Promise<Catalog> {
    const accountId = await this.resolveAccountId();

    // A tenant with an explicit store scope must never inherit the account-wide root menu.
    // Build its browse catalogue only from the assigned stores' own menus.
    if (this.allowedChannelLinkIds) {
      const allowedStores = (await this.getStores()).filter((store) => this.allowedChannelLinkIds!.has(String(store.channelLinkId)));
      if (allowedStores.length === 0) {
        return { id: `scoped_catalog_${accountId}`, type: 'ROOT', menus: [], categories: [], products: [], totalProducts: 0, updatedAt: new Date().toISOString() };
      }
      const storeCatalogs = await Promise.all(allowedStores.map((store) => this.getStoreCatalog(store.id)));
      const categories = new Map<string, Category>();
      const products = new Map<string, Product>();
      const bundles = new Map<string, BundleProduct>();
      const minorPrice = (product: Product) => typeof product.priceMinor === 'number' ? product.priceMinor : (typeof (product.price as any)?.amount === 'number' ? (product.price as any).amount : -1);

      for (const catalog of storeCatalogs) {
        for (const category of catalog.categories || []) if (!categories.has(category.id)) categories.set(category.id, category);
        const withinStore = new Map<string, Product>();
        for (const product of catalog.products || []) {
          const gtin = Array.isArray(product.gtin) ? product.gtin.find(Boolean) : product.gtin;
          const key = gtin ? `gtin:${gtin}` : `plu:${product.plu}`;
          const existing = withinStore.get(key);
          if (!existing || minorPrice(product) > minorPrice(existing)) withinStore.set(key, product);
        }
        for (const [key, product] of withinStore) {
          if (!products.has(key)) products.set(key, { ...product, price: undefined, priceMinor: undefined, stockStatus: undefined } as Product);
        }
        for (const bundle of catalog.bundleCatalog?.bundles || []) if (!bundles.has(bundle.plu)) bundles.set(bundle.plu, { ...bundle, price: undefined, priceMinor: undefined, stockStatus: undefined } as BundleProduct);
      }

      const finalCategories = Array.from(categories.values());
      const finalProducts = Array.from(products.values());
      const finalBundles = Array.from(bundles.values());
      applyCategoryFallback(finalCategories, finalProducts, finalBundles);

      return {
        id: `scoped_catalog_${accountId}`,
        type: 'ROOT',
        menus: storeCatalogs.flatMap((catalog) => catalog.menus || []),
        categories: finalCategories,
        products: finalProducts,
        totalProducts: finalProducts.length,
        bundleCatalog: { id: `scoped_bundles_${accountId}`, accountId, bundles: finalBundles, totalBundles: finalBundles.length, updatedAt: new Date().toISOString() },
        updatedAt: new Date().toISOString(),
      };
    }
    const token = await this.tokenManager.getAccessToken();

    return await circuitBreakers.commerce.execute(async () => {
      const start = Date.now();
      const url = `${this.baseUrl}/commerce/${encodeURIComponent(accountId)}/menus`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });

      const latencyMs = Date.now() - start;
      MetricsService.recordUpstreamCall('commerce', res.ok, latencyMs);

      if (!res.ok) {
        throw new Error(`Deliverect Root Menu request failed: HTTP ${res.status} (${url})`);
      }

      const rawData = await res.json();
      const rawMenus: any[] = Array.isArray(rawData) ? rawData : rawData?._items || [rawData];

      if (rawMenus.length === 0) {
        return {
          id: `root_catalog_${accountId}`,
          type: 'ROOT',
          menus: [],
          categories: [],
          products: [],
          totalProducts: 0,
          updatedAt: new Date().toISOString(),
        };
      }

      const menuSummaries = rawMenus.map((m: any) => {
        const prods = m.products ? (Array.isArray(m.products) ? m.products : Object.values(m.products)) : [];
        const cats = Array.isArray(m.categories) ? m.categories : [];
        return {
          menuId: String(m.menuId || m.id || m._id),
          name: String(m.menu || m.name || 'Root Menu'),
          description: m.description || '',
          imageUrl: m.menuImageURL || m.imageUrl || undefined,
          menuType: m.menuType,
          productCount: prods.length,
          categoryCount: cats.length,
        };
      });

      // Select primary root menu
      const primaryMenu = rawMenus[0];
      const tagDefinitions = await this.getProductTagDefinitions();
      const { categories, products, bundleCatalog } = this.parseDeliverectMenu(primaryMenu, false, tagDefinitions);

      return {
        id: String(primaryMenu.menuId || `root_catalog_${accountId}`),
        type: 'ROOT',
        menus: menuSummaries,
        activeMenuId: String(primaryMenu.menuId || ''),
        categories,
        products,
        totalProducts: products.length,
        bundleCatalog,
        updatedAt: new Date().toISOString(),
      };
    });
  }

  async getStoreCatalog(
    storeId: string,
    fulfillmentType?: 'delivery' | 'pickup',
    menuId?: string
  ): Promise<Catalog> {
    const accountId = await this.resolveAccountId();
    const { channelLinkId, store } = await this.resolveStoreChannelLinkId(storeId);
    const token = await this.tokenManager.getAccessToken();

    return await circuitBreakers.commerce.execute(async () => {
      const start = Date.now();
      const primaryUrl = `${this.baseUrl}/commerce/${encodeURIComponent(accountId)}/stores/${encodeURIComponent(channelLinkId)}/menus`;
      let res = await fetch(primaryUrl, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });

      // If store-specific endpoint returns 404, try alternative verified routes
      if (!res.ok && res.status === 404) {
        const altUrls = [
          `${this.baseUrl}/commerce/${encodeURIComponent(accountId)}/channelLinks/${encodeURIComponent(channelLinkId)}/menus`,
          store?.physicalLocationId ? `${this.baseUrl}/commerce/${encodeURIComponent(accountId)}/locations/${encodeURIComponent(store.physicalLocationId)}/menus` : null,
        ].filter(Boolean) as string[];

        for (const altUrl of altUrls) {
          const altRes = await fetch(altUrl, {
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          });
          if (altRes.ok) {
            res = altRes;
            break;
          }
        }
      }

      const latencyMs = Date.now() - start;
      MetricsService.recordUpstreamCall('commerce', res.ok, latencyMs);

      if (!res.ok) {
        throw new Error(
          `Deliverect Store Menu request failed: HTTP ${res.status} for store ${storeId} (channelLink ${channelLinkId})`
        );
      }

      const rawData = await res.json();
      const rawMenus: any[] = Array.isArray(rawData) ? rawData : rawData?._items || [rawData];

      if (rawMenus.length === 0) {
        const diagnostics: CatalogDiagnostics = {
          accountId,
          channelLinkId,
          storeId,
          menusReturned: 0,
          rawProductCount: 0,
          parsedProductCount: 0,
          activeCount: 0,
          inactiveCount: 0,
          snoozedCount: 0,
          renderableCount: 0,
          hiddenByRuleCount: 0,
          timestamp: new Date().toISOString(),
        };

        return {
          id: storeId,
          type: 'STORE',
          storeId,
          menus: [],
          categories: [],
          products: [],
          totalProducts: 0,
          updatedAt: new Date().toISOString(),
          diagnostics,
        };
      }

      const menuSummaries = rawMenus.map((m: any) => {
        const prods = m.products ? (Array.isArray(m.products) ? m.products : Object.values(m.products)) : [];
        const cats = Array.isArray(m.categories) ? m.categories : [];
        return {
          menuId: String(m.menuId || m.id || m._id),
          name: String(m.menu || m.name || 'Store Menu'),
          description: m.description || '',
          imageUrl: m.menuImageURL || m.imageUrl || undefined,
          menuType: m.menuType,
          productCount: prods.length,
          categoryCount: cats.length,
        };
      });

      // Directive 6: Explicit menu identification/selection based on requested menuId or fulfillmentType
      const { selectedMenu, selectionReason } = selectStoreMenu(rawMenus, menuId, fulfillmentType);
      const selectedMenuId = String(selectedMenu.menuId || selectedMenu.id || selectedMenu._id || '');
      const selectedMenuName = String(selectedMenu.menu || selectedMenu.name || 'Store Menu');

      const rawProductsList: any[] = Array.isArray(selectedMenu.products)
        ? selectedMenu.products
        : selectedMenu.products && typeof selectedMenu.products === 'object'
        ? Object.values(selectedMenu.products)
        : [];

      const tagDefinitions = await this.getProductTagDefinitions();
      const parsed = this.parseDeliverectMenu(selectedMenu, true, tagDefinitions);
      const categories = parsed.categories;
      const bundleCatalog = parsed.bundleCatalog;
      const operationalSnoozes = await FirestorePlatformService
        .getStoreProductSnoozes(this.tenantId || 'brand-alpha', channelLinkId)
        .catch(() => ({}));
      const products = parsed.products.map((product) => {
        const snooze = operationalSnoozes[product.plu];
        if (!snooze?.snoozed) return product;
        return {
          ...product,
          snoozed: true,
          isSnoozed: true,
          snoozedUntil: snooze.snoozeEnd,
          snoozeEndTime: snooze.snoozeEnd,
          stockStatus: 'OUT_OF_STOCK' as const,
        };
      });

      // Directive 1: Compute structured staging diagnostics
      const rawProductCount = rawProductsList.length;
      const parsedProductCount = products.length;
      const activeCount = products.filter((p) => p.active !== false).length;
      const inactiveCount = products.filter((p) => p.active === false).length;
      const snoozedCount = products.filter((p) => p.stockStatus === 'OUT_OF_STOCK').length;
      const renderableCount = activeCount;

      const diagnostics: CatalogDiagnostics = {
        accountId,
        channelLinkId,
        storeId,
        menusReturned: rawMenus.length,
        selectedMenuId,
        selectedMenuName,
        rawProductCount,
        parsedProductCount,
        activeCount,
        inactiveCount,
        snoozedCount,
        renderableCount,
        unmappedProductTagIds: Array.from(new Set(products.flatMap(product => product.unmappedProductTags || []))),
        hiddenByRuleCount: 0,
        timestamp: new Date().toISOString(),
      };

      console.info(
        `[DeliverectApiClient] Store Catalog Diagnostics: storeId=${storeId} channelLinkId=${channelLinkId} accountId=${accountId} menusReturned=${rawMenus.length} selectedMenuId=${selectedMenuId} ("${selectedMenuName}", reason=${selectionReason}) rawProducts=${rawProductCount} parsedProducts=${parsedProductCount} active=${activeCount} inactive=${inactiveCount} snoozed=${snoozedCount} renderable=${renderableCount} bundles=${bundleCatalog.totalBundles}`
      );

      return {
        id: storeId,
        type: 'STORE',
        storeId,
        menus: menuSummaries,
        activeMenuId: selectedMenuId,
        categories,
        products,
        totalProducts: products.length,
        bundleCatalog,
        updatedAt: new Date().toISOString(),
        diagnostics,
      };
    });
  }

  /** Returns the exact tenant-scoped Deliverect menu response for admin inspection. */
  async getRawStoreMenus(storeId: string): Promise<{ accountId: string; channelLinkId: string; storeId: string; receivedAt: string; payload: unknown }> {
    const accountId = await this.resolveAccountId();
    const { channelLinkId, store } = await this.resolveStoreChannelLinkId(storeId);
    const token = await this.tokenManager.getAccessToken();
    const urls = [
      `${this.baseUrl}/commerce/${encodeURIComponent(accountId)}/stores/${encodeURIComponent(channelLinkId)}/menus`,
      `${this.baseUrl}/commerce/${encodeURIComponent(accountId)}/channelLinks/${encodeURIComponent(channelLinkId)}/menus`,
      store?.physicalLocationId ? `${this.baseUrl}/commerce/${encodeURIComponent(accountId)}/locations/${encodeURIComponent(store.physicalLocationId)}/menus` : null,
    ].filter(Boolean) as string[];

    return await circuitBreakers.commerce.execute(async () => {
      let lastStatus = 502;
      for (const url of urls) {
        const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
        lastStatus = response.status;
        if (response.ok) {
          return { accountId, channelLinkId, storeId, receivedAt: new Date().toISOString(), payload: await response.json() };
        }
        if (response.status !== 404) break;
      }
      const error: any = new Error(`Deliverect raw menu request failed: HTTP ${lastStatus} for assigned store ${storeId}`);
      error.statusCode = 502;
      error.code = 'DELIVERECT_RAW_MENU_UNAVAILABLE';
      throw error;
    });
  }

  async getBundleCatalog(
    storeId?: string,
    fulfillmentType?: 'delivery' | 'pickup',
    menuId?: string
  ): Promise<BundleCatalog> {
    if (storeId) {
      const storeCatalog = await this.getStoreCatalog(storeId, fulfillmentType, menuId);
      return (
        storeCatalog.bundleCatalog || {
          id: `bundle_catalog_${storeId}`,
          storeId,
          bundles: [],
          totalBundles: 0,
          updatedAt: new Date().toISOString(),
        }
      );
    }
    const rootCatalog = await this.getRootCatalog();
    return (
      rootCatalog.bundleCatalog || {
        id: 'bundle_catalog_root',
        bundles: [],
        totalBundles: 0,
        updatedAt: new Date().toISOString(),
      }
    );
  }

  private isUsableStore(store: Store): boolean {
    const address = store.address;
    const coordinates = store.coordinates;
    const hasAddress = Boolean(
      address &&
      (address.postalCode || address.postcode || address.formattedAddress || address.line1 || address.street) &&
      address.city
    );
    const hasCoordinates = Boolean(
      coordinates &&
      Number.isFinite(coordinates.latitude) &&
      Number.isFinite(coordinates.longitude)
    );
    const status = String(store.status || '').toUpperCase();
    const projection = String(store.stateProjection || '').toLowerCase();
    const operational = !['CLOSED', 'INACTIVE', 'PAUSED'].includes(status) && !['closed', 'inactive', 'paused'].includes(projection);
    return hasAddress && hasCoordinates && operational;
  }

  private isAvailableProduct(product: Product): boolean {
    const snoozeEnd = product.snoozeEndTime ? new Date(product.snoozeEndTime).getTime() : 0;
    return product.active !== false &&
      product.stockStatus !== 'OUT_OF_STOCK' &&
      product.snoozed !== true &&
      product.isSnoozed !== true &&
      !(snoozeEnd > Date.now()) &&
      !(typeof product.stockQuantity === 'number' && product.stockQuantity <= 0);
  }

  private async buildAvailabilitySummaries(
    products: Product[],
    stores: Store[]
  ): Promise<Record<string, ProductAvailabilitySummary>> {
    const eligibleStores = stores.filter((store) => this.isUsableStore(store));
    const settled = await Promise.allSettled(
      eligibleStores.map(async (store) => ({ store, catalog: await this.getStoreCatalog(store.id) }))
    );
    const storeCatalogs = settled
      .filter((result): result is PromiseFulfilledResult<{ store: Store; catalog: Catalog }> => result.status === 'fulfilled')
      .map((result) => result.value);
    const summaries: Record<string, ProductAvailabilitySummary> = {};

    for (const product of products) {
      const records = storeCatalogs.flatMap(({ store, catalog }) =>
        (catalog.products || [])
          .filter((candidate) => productsShareIdentity(candidate, product) && this.isAvailableProduct(candidate) && candidate.price != null)
          .map((candidate) => ({ store, product: candidate }))
      );
      const prices = records.map(({ product: candidate }) => candidate.price!).filter(Boolean);
      const amounts = prices.map((price) => typeof price === 'number' ? price : price.amount);
      const minimumAmount = amounts.length ? Math.min(...amounts) : undefined;
      const maximumAmount = amounts.length ? Math.max(...amounts) : undefined;
      const currency = prices.find((price) => typeof price !== 'number') as Money | undefined;
      summaries[product.plu] = {
        plu: product.plu,
        productId: product.id,
        availableStoreCount: records.length,
        eligibleStoreCount: storeCatalogs.length,
        minimumPrice: minimumAmount == null ? undefined : toMoney(minimumAmount, currency?.currency || 'GBP'),
        maximumPrice: maximumAmount == null ? undefined : toMoney(maximumAmount, currency?.currency || 'GBP'),
        nearestAvailableStoreId: records[0]?.store.id,
        deliveryAvailable: records.some(({ store }) => store.supportsDelivery),
        collectionAvailable: records.some(({ store }) => store.supportsPickup),
      };
    }
    return summaries;
  }

  /**
   * Mirrors buildAvailabilitySummaries for bundles: bundles live in each
   * store catalogue's bundleCatalog rather than catalog.products, so they
   * never picked up a cross-store price range the same way normal products
   * do — the home carousel always showed "Price unavailable" with no store
   * selected regardless of actual bundle pricing.
   */
  private async buildBundleAvailabilitySummaries(
    bundles: BundleProduct[],
    stores: Store[]
  ): Promise<Record<string, ProductAvailabilitySummary>> {
    const eligibleStores = stores.filter((store) => this.isUsableStore(store));
    const settled = await Promise.allSettled(
      eligibleStores.map(async (store) => ({ store, catalog: await this.getStoreCatalog(store.id) }))
    );
    const storeCatalogs = settled
      .filter((result): result is PromiseFulfilledResult<{ store: Store; catalog: Catalog }> => result.status === 'fulfilled')
      .map((result) => result.value);
    const summaries: Record<string, ProductAvailabilitySummary> = {};

    for (const bundle of bundles) {
      const records = storeCatalogs.flatMap(({ store, catalog }) =>
        (catalog.bundleCatalog?.bundles || [])
          .filter((candidate) => candidate.plu === bundle.plu && candidate.stockStatus !== 'OUT_OF_STOCK')
          .map((candidate) => ({ store, bundle: candidate }))
      );
      const amounts = records
        .map(({ bundle: candidate }) => candidate.priceMinor ?? candidate.price)
        .filter((amount): amount is number => typeof amount === 'number');
      const minimumAmount = amounts.length ? Math.min(...amounts) : undefined;
      const maximumAmount = amounts.length ? Math.max(...amounts) : undefined;
      const currency = records[0]?.bundle.currency || 'GBP';

      summaries[bundle.plu] = {
        plu: bundle.plu,
        productId: bundle.id,
        availableStoreCount: records.length,
        eligibleStoreCount: storeCatalogs.length,
        minimumPrice: minimumAmount == null ? undefined : toMoney(minimumAmount, currency),
        maximumPrice: maximumAmount == null ? undefined : toMoney(maximumAmount, currency),
        nearestAvailableStoreId: records[0]?.store.id,
        deliveryAvailable: records.some(({ store }) => store.supportsDelivery),
        collectionAvailable: records.some(({ store }) => store.supportsPickup),
      };
    }
    return summaries;
  }

  async getProduct(productId: string, storeId?: string): Promise<{ product: Product; summary?: ProductAvailabilitySummary } | null> {
    const catalog = storeId ? await this.getStoreCatalog(storeId) : await this.getRootCatalog();
    const product = (catalog.products || []).find((p) => p.id === productId || p.plu === productId);
    if (!product) return null;

    if (storeId) {
      const available = this.isAvailableProduct(product) && product.price != null;
      return {
        product,
        summary: {
          plu: product.plu,
          productId: product.id,
          availableStoreCount: available ? 1 : 0,
          eligibleStoreCount: 1,
          minimumPrice: available ? product.price : undefined,
          maximumPrice: available ? product.price : undefined,
          nearestAvailableStoreId: available ? storeId : undefined,
          deliveryAvailable: available,
          collectionAvailable: available,
        },
      };
    }

    const stores = await this.getStores();
    const summaries = await this.buildAvailabilitySummaries([product], stores);
    return { product, summary: summaries[product.plu] };
  }

  async searchProducts(
    query: string,
    storeId?: string,
    options?: { categoryId?: string; limit?: number }
  ): Promise<{
    products: Product[];
    summaries?: Record<string, ProductAvailabilitySummary>;
    bundleSummaries?: Record<string, ProductAvailabilitySummary>;
    diagnostics?: CatalogDiagnostics;
  }> {
    const catalog = storeId ? await this.getStoreCatalog(storeId) : await this.getRootCatalog();
    const q = query.toLowerCase().trim();
    let filtered = catalog.products || [];
    if (q) {
      filtered = filtered.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        Boolean(p.description?.toLowerCase().includes(q)) ||
        p.plu.toLowerCase().includes(q)
      );
    }
    if (options?.categoryId) {
      const allowedCategoryIds = new Set<string>();
      const collectCategoryIds = (categories: Category[]) => {
        for (const category of categories) {
          if (category.id === options.categoryId || allowedCategoryIds.has(category.parentId || '')) {
            allowedCategoryIds.add(category.id);
          }
          if (category.subcategories?.length) collectCategoryIds(category.subcategories);
        }
      };
      collectCategoryIds(catalog.categories || []);
      if (allowedCategoryIds.size === 0) allowedCategoryIds.add(options.categoryId);
      filtered = filtered.filter((p) => (p.categoryIds || []).some((categoryId) => allowedCategoryIds.has(categoryId)));
    }
    if (options?.limit && options.limit > 0) filtered = filtered.slice(0, options.limit);

    if (storeId) {
      const summaries: Record<string, ProductAvailabilitySummary> = {};
      for (const product of filtered) {
        const available = this.isAvailableProduct(product) && product.price != null;
        summaries[product.plu] = {
          plu: product.plu,
          productId: product.id,
          availableStoreCount: available ? 1 : 0,
          eligibleStoreCount: 1,
          minimumPrice: available ? product.price : undefined,
          maximumPrice: available ? product.price : undefined,
          nearestAvailableStoreId: available ? storeId : undefined,
          deliveryAvailable: available,
          collectionAvailable: available,
        };
      }

      const bundleSummaries: Record<string, ProductAvailabilitySummary> = {};
      for (const bundle of catalog.bundleCatalog?.bundles || []) {
        const available = bundle.stockStatus !== 'OUT_OF_STOCK';
        const price = bundle.priceMinor ?? bundle.price;
        bundleSummaries[bundle.plu] = {
          plu: bundle.plu,
          productId: bundle.id,
          availableStoreCount: available ? 1 : 0,
          eligibleStoreCount: 1,
          minimumPrice: available ? price : undefined,
          maximumPrice: available ? price : undefined,
          nearestAvailableStoreId: available ? storeId : undefined,
          deliveryAvailable: available,
          collectionAvailable: available,
        };
      }

      return { products: filtered, summaries, bundleSummaries, diagnostics: catalog.diagnostics };
    }

    const stores = await this.getStores();
    const summaries = await this.buildAvailabilitySummaries(filtered, stores);
    const bundleSummaries = await this.buildBundleAvailabilitySummaries(catalog.bundleCatalog?.bundles || [], stores);
    return { products: filtered, summaries, bundleSummaries, diagnostics: catalog.diagnostics };
  }

  private async getCommerceBasketApi(): Promise<DeliverectCommerceBasketApiClient> {
    const accountId = await this.resolveAccountId();
    return new DeliverectCommerceBasketApiClient(
      this.tokenManager,
      accountId,
      this.baseUrl
    );
  }

  private async mapLiveCommerceBasket(raw: any): Promise<MappedBasket> {
    const storeId = String(raw?.storeId || raw?.channelLinkId || '').trim();
    if (!storeId) {
      throw new Error('Deliverect basket response is missing storeId/channelLinkId.');
    }

    const store = await this.getStore(storeId).catch(() => null);

    let fallbackMenuId = String(raw?.menuId || raw?.menu || '').trim();
    const needsFallbackMenu =
      Array.isArray(raw?.items) &&
      raw.items.some((item: any) => !item?.menuId && !item?.menu);

    if (!fallbackMenuId && needsFallbackMenu) {
      const fulfillmentType =
        String(raw?.fulfillment?.type || '').toLowerCase() === 'delivery'
          ? 'delivery'
          : 'pickup';
      const catalog = await this.getStoreCatalog(storeId, fulfillmentType);
      fallbackMenuId = String(catalog.activeMenuId || '').trim();
    }

    const mapped = mapDeliverectBasket(raw, {
      storeName: store?.name || storeId,
      fallbackMenuId,
    });

    const persistedPreferences =
      await FirestorePlatformService.getBasketSubstitutionPreferences(this.tenantId, mapped.id);

    if (Object.keys(persistedPreferences).length > 0) {
      mapped.items = mapped.items.map((item) => {
        const persisted = persistedPreferences[item.plu];
        if (!persisted) return item;
        return {
          ...item,
          substitutionPreference: persisted.preference,
          substituteCandidatePlus: persisted.substituteCandidatePlus,
          preferredSubstitutePlu: persisted.preferredSubstitutePlu,
          preferredSubstituteName: persisted.preferredSubstituteName,
          preferredSubstitutePrice: persisted.preferredSubstitutePrice,
        };
      });
    }

    // Surface only the aggregate unit ownership needed by storefront
    // qualification. The full protected-price ledger remains server-side.
    const bundleLedger = await FirestorePlatformService.getBasketBundleAllocations(
      this.tenantId,
      mapped.id
    );
    const allocatedByPlu = new Map<string, number>();
    bundleLedger.forEach((entry) => (entry.components || []).forEach((component) => {
      allocatedByPlu.set(
        component.componentPlu,
        (allocatedByPlu.get(component.componentPlu) || 0) + component.quantity
      );
    }));
    mapped.bundleAllocatedUnits = Array.from(allocatedByPlu, ([plu, quantity]) => ({ plu, quantity }));

    return mapped;
  }

  private async getMappedCommerceBasket(basketId: string): Promise<MappedBasket> {
    const api = await this.getCommerceBasketApi();
    const raw = await api.getBasket(basketId);
    return this.mapLiveCommerceBasket(raw);
  }

  private unsupportedLiveCapability(name: string): never {
    throw new CommerceError(
      'INTEGRATION_CAPABILITY_NOT_IMPLEMENTED',
      `${name} is not yet implemented on the live Deliverect path.`
    );
  }

  private mapCommerceCheckoutStatus(raw: any): CheckoutResult['status'] {
    const value = String(
      raw?.status || raw?.state || raw?.checkoutStatus || ''
    ).toUpperCase();

    const orderId = raw?.orderId || raw?.order?.id || raw?.order?._id;
    if (orderId) return 'ORDER_CONFIRMED';

    if (value.includes('FAIL') || value.includes('REJECT')) return 'ORDER_FAILED';
    if (value.includes('CANCEL')) return 'CANCELLED';
    if (
      value === 'COMPLETED' ||
      value.includes('CONFIRM') ||
      value.includes('SUCCESS')
    ) {
      return 'ORDER_CONFIRMED';
    }

    return 'CHECKOUT_PENDING_CONFIRMATION';
  }

  async createBasket(
    storeId?: string,
    fulfillmentType: 'delivery' | 'pickup' = 'pickup'
  ): Promise<Basket> {
    if (!storeId) {
      throw new CommerceError('STORE_NOT_FOUND', 'A store is required before creating a basket.');
    }

    if (fulfillmentType !== 'pickup') {
      throw new CommerceError(
        'INVALID_FULFILLMENT',
        'Delivery checkout is not enabled on the real Deliverect basket path yet. Please choose collection.'
      );
    }

    const { channelLinkId, store } = await this.resolveStoreChannelLinkId(storeId);
    const api = await this.getCommerceBasketApi();

    // If the store is closed right now, target its next real opening instead of
    // letting Deliverect default to ASAP (which it correctly rejects with a 422
    // "Fulfillment time is invalid" outside operating hours). This lets a customer
    // build a basket for pre-order/collection-when-open rather than being blocked —
    // unless the tenant's scheduling policy disallows it (acceptAsapOrdersOnly, or
    // allowNextOpeningPreOrder explicitly off), in which case a closed store stays
    // genuinely unavailable rather than silently offering a pre-order nobody asked for.
    const openStatus = evaluateStoreOpenNow(store);
    let pickupTime: string | undefined;
    if (!openStatus.isOpen) {
      if (store?.scheduling?.acceptsPreOrders === false) {
        throw new CommerceError(
          'STORE_CLOSED',
          `${store?.name || 'This store'} is closed right now and isn't accepting pre-orders.`
        );
      }
      pickupTime = computeNextOpeningTime(store)?.toISOString();
    }

    const raw = await api.createPickupBasket({ channelLinkId, pickupTime });
    return this.mapLiveCommerceBasket(raw);
  }

  async getBasket(basketId: string): Promise<Basket | null> {
    if (!basketId || basketId.startsWith('bsk_')) {
      return null;
    }

    try {
      return await this.getMappedCommerceBasket(basketId);
    } catch (error: any) {
      if (error?.status === 404 || error?.statusCode === 404) return null;
      throw error;
    }
  }

  async updateBasketItem(
    basketId: string,
    productId: string,
    quantity: number
  ): Promise<Basket> {
    const current = await this.getMappedCommerceBasket(basketId);
    const desired = toCommerceItemInputs(current);

    const existingIndex = desired.findIndex((item) => item.plu === productId);

    if (quantity <= 0) {
      if (existingIndex >= 0) desired.splice(existingIndex, 1);
    } else if (existingIndex >= 0) {
      desired[existingIndex] = {
        ...desired[existingIndex],
        quantity,
      };
    } else {
      const catalog = await this.getStoreCatalog(
        current.storeId,
        current.fulfillmentType
      );
      const product = catalog.products?.find((p) => p.plu === productId || p.id === productId);

      if (!product) {
        throw new CommerceError(
          'PRODUCT_NOT_AVAILABLE',
          `Product ${productId} is not available at the selected store.`
        );
      }

      const menuId = String(catalog.activeMenuId || '').trim();
      if (!menuId) {
        throw new CommerceError(
          'MENU_NOT_AVAILABLE',
          'Could not resolve the active Deliverect menu for this basket.'
        );
      }

      desired.push({
        menuId,
        plu: product.plu,
        quantity,
        itemUnavailableActions: buildQuestItemUnavailableActions('BEST_MATCH'),
      });
    }

    const api = await this.getCommerceBasketApi();

    // Deliverect Commerce replaceItems deliberately rejects an empty array.
    // An empty customer basket is therefore a local lifecycle state, not an
    // upstream mutation: clear all Bwydi-owned bundle pricing/allocation state
    // and return an empty mapped basket. The next add creates a fresh basket,
    // so we never keep an un-clearable final line just to satisfy Deliverect.
    if (desired.length === 0) {
      const existingDiscounts = Array.isArray((current as any)?.discounts)
        ? (current as any).discounts
        : [];
      const nonBundleDiscounts = existingDiscounts.filter(
        (discount: any) => !this.isManagedBundleDiscount(discount)
      );
      if (existingDiscounts.length !== nonBundleDiscounts.length) {
        await api.updateDiscounts(basketId, nonBundleDiscounts);
      }
      await FirestorePlatformService.replaceBasketBundleAllocations(this.tenantId, basketId, []);
      return {
        ...current,
        items: [],
        subtotal: { ...current.subtotal, amount: 0 },
        discountTotal: { ...current.discountTotal, amount: 0 },
        total: { ...current.total, amount: 0 },
        discounts: nonBundleDiscounts,
        updatedAt: new Date().toISOString(),
      };
    }

    const raw = await api.replaceItems(basketId, desired);
    const catalog = await this.getStoreCatalog(current.storeId, current.fulfillmentType);

    // A plain quantity change/removal can silently drop a bundle below its
    // required components (e.g. removing the last unit of an item a combo
    // needed) — re-check the ledger against the resulting basket and strip
    // any discount that no longer qualifies.
    const automaticDiscounts = await this.recalculateAutomaticDealDiscounts(
      basketId,
      desired,
      catalog,
      Array.isArray((raw as any)?.discounts) ? (raw as any).discounts : []
    );
    const finalRaw = await api.updateDiscounts(basketId, automaticDiscounts);
    return this.mapLiveCommerceBasket(finalRaw);
  }

  async updateBasketItems(
    basketId: string,
    items: Array<{
      plu: string;
      quantity: number;
      menuId?: string;
      substitutionPreference?: any;
      substituteCandidatePlus?: string[];
      preferredSubstitutePlu?: string;
      preferredSubstituteName?: string;
      preferredSubstitutePrice?: Money;
      name?: string;
      price?: Money;
    }>
  ): Promise<Basket> {
    const current = await this.getMappedCommerceBasket(basketId);

    for (const item of items) {
      if (item.substitutionPreference) {
        await FirestorePlatformService.saveBasketItemSubstitutionPreference(
          this.tenantId,
          basketId,
          item.plu,
          {
            preference: item.substitutionPreference,
            substituteCandidatePlus: item.substituteCandidatePlus,
            preferredSubstitutePlu: item.preferredSubstitutePlu,
            preferredSubstituteName: item.preferredSubstituteName,
            preferredSubstitutePrice: item.preferredSubstitutePrice,
          }
        );
      }
    }

    const catalog = await this.getStoreCatalog(
      current.storeId,
      current.fulfillmentType
    );
    const fallbackMenuId = String(catalog.activeMenuId || '').trim();

    // Preserve existing basket items so that updating a subset or adding a bundle does not wipe the basket
    const desired = toCommerceItemInputs(current);

    for (const item of items) {
      const existingIndex = desired.findIndex((d) => d.plu === item.plu);
      if (item.quantity <= 0) {
        if (existingIndex >= 0) {
          desired.splice(existingIndex, 1);
        }
      } else {
        const existing = current.items.find((i) => i.plu === item.plu) as any;
        const menuId = String(
          item.menuId || existing?.deliverect?.menuId || (existingIndex >= 0 ? desired[existingIndex].menuId : fallbackMenuId)
        ).trim();

        if (!menuId) {
          throw new CommerceError(
            'MENU_NOT_AVAILABLE',
            `No menuId is available for ${item.plu}.`
          );
        }

        const preference =
          item.substitutionPreference ||
          existing?.substitutionPreference ||
          'BEST_MATCH';
        const itemUnavailableActions =
          buildQuestItemUnavailableActions(preference);
        const preferredPrice = item.preferredSubstitutePrice;
        const substituteCandidate =
          String(preference).toUpperCase() === 'CUSTOMER_SELECTED' &&
          item.preferredSubstitutePlu
            ? [
                {
                  plu: item.preferredSubstitutePlu,
                  name:
                    item.preferredSubstituteName ||
                    item.preferredSubstitutePlu,
                  quantity: item.quantity,
                  ...(preferredPrice &&
                  typeof preferredPrice.amount === 'number'
                    ? { price: Math.round(preferredPrice.amount) }
                    : {}),
                },
              ]
            : undefined;

        if (existingIndex >= 0) {
          desired[existingIndex] = {
            ...desired[existingIndex],
            menuId,
            quantity: item.quantity,
            itemUnavailableActions,
            ...(substituteCandidate
              ? { substituteCandidate }
              : { substituteCandidate: undefined }),
          };
        } else {
          desired.push({
            menuId,
            plu: item.plu,
            quantity: item.quantity,
            itemUnavailableActions,
            ...(substituteCandidate ? { substituteCandidate } : {}),
          });
        }
      }
    }

    const api = await this.getCommerceBasketApi();
    const raw = await api.replaceItems(basketId, desired);

    const automaticDiscounts = await this.recalculateAutomaticDealDiscounts(
      basketId,
      desired,
      catalog,
      Array.isArray((raw as any)?.discounts) ? (raw as any).discounts : []
    );
    const finalRaw = await api.updateDiscounts(basketId, automaticDiscounts);
    return this.mapLiveCommerceBasket(finalRaw);
  }

  /**
   * Recognizes a Deliverect discount entry as one we manage for a bundle
   * instance (as opposed to a coupon or any other third-party discount,
   * which must be preserved untouched). Checks the current display prefix
   * plus the legacy one so baskets created before the rename still match.
   */
  private isManagedBundleDiscount(discount: any): boolean {
    const externalId = String(discount?.externalId || '');
    const name = String(discount?.name || discount?.title || '');
    return (
      externalId.startsWith('bwydi-bundle:') ||
      name.startsWith('Bwydi bundle:') ||
      name.startsWith('Combo Deal:')
    );
  }

  /**
   * Renders a bundle allocation ledger into per-item Deliverect discount
   * lines (one `item_flat_off` line per qualifying component, pro-rated via
   * each component's already-computed `discountLineMinor`) rather than one
   * flat order-level line — so Quest and the customer both see which
   * specific items are discounted, not an unexplained lump sum.
   */
  private buildManagedBundleDiscountLines(
    entries: BasketBundleAllocationRecord[]
  ): CommerceBasketDiscountInput[] {
    // Commerce basket discount PATCH accepts the bundle saving reliably as an
    // order-level flat discount. Item-level attribution belongs in our bundle
    // allocation ledger and can be projected to downstream order metadata when
    // that contract supports item references; sending PLU-only item_flat_off
    // discounts here causes Deliverect to reject the basket with HTTP 422.
    return entries
      .filter((entry) => entry.discountTotalMinor > 0)
      .map((entry) => ({
        type: 'order_flat_off' as const,
        provider: 'restaurant' as const,
        amount: entry.discountTotalMinor,
        value: entry.discountTotalMinor,
        name: `Combo Deal: ${entry.bundleName}`,
        externalId: `bwydi-bundle:${entry.bundleInstanceId}`,
      }));
  }

  /**
   * Re-validates the bundle allocation ledger against the basket's current
   * (post-mutation) item quantities and drops any bundle instance whose
   * required components are no longer fully present — e.g. the customer
   * removed one unit of an item that a combo depended on via a plain
   * quantity change, not by editing the bundle itself. Consumes the pool in
   * ledger order so two bundles can never both claim the same unit (an item
   * only ever discounts once). Returns null when nothing needs to change,
   * so callers can skip an unnecessary Deliverect discounts write.
   */
  private async recalculateAutomaticDealDiscounts(
    basketId: string,
    desired: Array<{ plu: string; quantity: number }>,
    catalog: Catalog,
    rawDiscounts: CommerceBasketDiscountInput[]
  ): Promise<CommerceBasketDiscountInput[]> {
    const allocations = qualifyAutomaticDeals(
      desired,
      catalog.bundleCatalog?.bundles || [],
      catalog.products || []
    );
    const now = new Date().toISOString();
    const records: BasketBundleAllocationRecord[] = allocations.map((allocation, index) => ({
      ...allocation,
      bundleInstanceId: `auto:${allocation.bundleId}:${index}`,
      createdAt: now,
    }));
    // The ledger is now a projection/diagnostic of current qualification, not
    // persistent ownership of basket units.
    await FirestorePlatformService.replaceBasketBundleAllocations(this.tenantId, basketId, records);
    const nonManaged = (rawDiscounts || []).filter((discount) => !this.isManagedBundleDiscount(discount));
    return [...nonManaged, ...this.buildManagedBundleDiscountLines(records)];
  }

  private async revalidateBundleDiscounts(
    basketId: string,
    desired: Array<{ plu: string; quantity: number }>,
    rawDiscounts: CommerceBasketDiscountInput[]
  ): Promise<CommerceBasketDiscountInput[] | null> {
    const ledger = await FirestorePlatformService.getBasketBundleAllocations(
      this.tenantId,
      basketId
    );
    if (ledger.length === 0) return null;

    const pool = new Map<string, number>();
    for (const item of desired) {
      pool.set(item.plu, (pool.get(item.plu) || 0) + item.quantity);
    }

    const validEntries: BasketBundleAllocationRecord[] = [];
    for (const entry of ledger) {
      const components = entry.components || [];
      const canSatisfy = components.every(
        (component) => (pool.get(component.componentPlu) || 0) >= component.quantity
      );
      if (canSatisfy) {
        components.forEach((component) => {
          pool.set(
            component.componentPlu,
            (pool.get(component.componentPlu) || 0) - component.quantity
          );
        });
        validEntries.push(entry);
      }
    }

    if (validEntries.length === ledger.length) return null;

    await FirestorePlatformService.replaceBasketBundleAllocations(
      this.tenantId,
      basketId,
      validEntries
    );

    const nonBundleDiscounts = (rawDiscounts || []).filter(
      (discount) => !this.isManagedBundleDiscount(discount)
    );
    return [...nonBundleDiscounts, ...this.buildManagedBundleDiscountLines(validEntries)];
  }

  async addBundleToBasket(
    basketId: string,
    request: AddBundleToBasketRequest
  ): Promise<Basket> {
    const api = await this.getCommerceBasketApi();
    const rawBefore = await api.getBasket(basketId);
    const current = await this.mapLiveCommerceBasket(rawBefore);

    const catalog = await this.getStoreCatalog(
      current.storeId,
      current.fulfillmentType
    );
    const bundle = catalog.bundleCatalog?.bundles.find(
      (candidate) =>
        (request.bundleId && candidate.id === request.bundleId) ||
        (request.bundlePlu && candidate.plu === request.bundlePlu)
    );

    if (!bundle) {
      throw new CommerceError(
        'PRODUCT_NOT_AVAILABLE',
        'The selected bundle is not available in the current store catalogue.'
      );
    }
    if (bundle.stockStatus === 'OUT_OF_STOCK') {
      throw new CommerceError(
        'PRODUCT_NOT_AVAILABLE',
        bundle.outOfStockReason || `${bundle.name} is currently unavailable.`
      );
    }

    const menuId = String(catalog.activeMenuId || '').trim();
    if (!menuId) {
      throw new CommerceError(
        'MENU_NOT_AVAILABLE',
        'Could not resolve the active Deliverect menu for this basket.'
      );
    }

    const normalProducts = catalog.products || [];
    const priceMinor = (product: Product): number | undefined => {
      const price = product.price ?? product.basePrice;
      if (typeof price === 'number' && Number.isInteger(price)) return price;
      if (
        price &&
        typeof price === 'object' &&
        Number.isInteger((price as Money).amount)
      ) {
        return (price as Money).amount;
      }
      if (Number.isInteger(product.priceMinor)) return product.priceMinor;
      return undefined;
    };

    // Re-resolve every component's normal PLU + shelf price from the selected
    // store catalogue. Client-supplied prices or normal-product PLUs are ignored.
    const authoritativeBundle: BundleProduct = {
      ...bundle,
      sections: (bundle.sections || bundle.modifierGroups || []).map((section) => ({
        ...section,
        modifiers: section.modifiers.map((modifier) => {
          // Deliverect modifiers may themselves carry the normal saleable PLU
          // (common for optional upsells) without a separate standalonePlu field.
          // Resolve that real catalogue product; never fabricate an identity.
          const declaredStandalonePlu = String(modifier.standalonePlu || '').trim();
          const product = normalProducts.find(
            (candidate) =>
              (declaredStandalonePlu && candidate.plu === declaredStandalonePlu) ||
              candidate.plu === String(modifier.plu || '').trim()
          );
          const standalonePlu = product?.plu || declaredStandalonePlu;

          if (!standalonePlu || !product) {
            return {
              ...modifier,
              standalonePlu: undefined,
              standalonePriceMinor: undefined,
            };
          }

          const shelfPrice = priceMinor(product);
          if (
            product.active === false ||
            product.stockStatus === 'OUT_OF_STOCK' ||
            shelfPrice === undefined
          ) {
            return {
              ...modifier,
              standalonePriceMinor: undefined,
            };
          }

          return {
            ...modifier,
            standalonePlu: product.plu,
            standalonePriceMinor: shelfPrice,
          };
        }),
      })),
    };
    authoritativeBundle.modifierGroups = authoritativeBundle.sections;

    const selectionByKey = new Map(
      request.selections.map((selection) => [`${selection.sectionId}:${selection.modifierId}`, selection])
    );
    const desired = toCommerceItemInputs(current);

    // Explicit builders are now only an item-selection convenience. They add
    // ordinary store products; the automatic deal engine recalculates pricing
    // from the resulting basket and never persists historical ownership.
    for (const section of authoritativeBundle.sections) {
      for (const modifier of section.modifiers) {
        const selected = selectionByKey.get(`${section.id}:${modifier.id}`);
        if (!selected || selected.quantity <= 0) continue;
        const componentPlu = String(modifier.standalonePlu || '').trim();
        const product = normalProducts.find((candidate) => candidate.plu === componentPlu);
        if (!componentPlu || !product || product.active === false || product.stockStatus === 'OUT_OF_STOCK') {
          throw new CommerceError('PRODUCT_NOT_AVAILABLE', `${modifier.name} is no longer available at this store.`);
        }
        await assertProductAddAllowed(
          this.tenantId,
          product,
          { storeId: current.storeId, fulfillmentType: current.fulfillmentType },
          current.items,
          selected.quantity * Math.max(1, request.quantity || 1)
        );
        const quantityToAdd = selected.quantity * Math.max(1, request.quantity || 1);
        const existing = desired.find((candidate) => candidate.plu === componentPlu);
        if (existing) existing.quantity += quantityToAdd;
        else desired.push({ menuId, plu: componentPlu, quantity: quantityToAdd, itemUnavailableActions: buildQuestItemUnavailableActions('BEST_MATCH') });
      }
    }

    if (selectionByKey.size !== request.selections.length) {
      throw new CommerceError('INVALID_BUNDLE_SELECTION', 'One or more selected bundle components are not valid for this store.');
    }

    const originalDiscounts: CommerceBasketDiscountInput[] = Array.isArray(rawBefore?.discounts) ? rawBefore.discounts : [];
    const automaticDiscounts = await this.recalculateAutomaticDealDiscounts(
      basketId,
      desired.map((item) => ({ plu: item.plu, quantity: item.quantity })),
      catalog,
      originalDiscounts
    );

    let itemsWritten = false;
    try {
      const afterItems = await api.replaceItems(basketId, desired);
      itemsWritten = true;
      const afterPricing = await api.updateDiscounts(basketId, automaticDiscounts);
      return await this.mapLiveCommerceBasket(afterPricing);
    } catch (error) {
      if (itemsWritten) {
        try {
          await api.replaceItems(basketId, toCommerceItemInputs(current));
          await api.updateDiscounts(basketId, originalDiscounts);
          await this.recalculateAutomaticDealDiscounts(
            basketId,
            current.items.map((item) => ({ plu: item.plu, quantity: item.quantity })),
            catalog,
            originalDiscounts
          );
        } catch (rollbackError) {
          console.error('[DeliverectApiClient] Bundle basket rollback failed:', rollbackError);
        }
      }
      throw error;
    }
  }

  async updateBasketCustomer(
    basketId: string,
    customer: {
      name?: string;
      email?: string;
      phone?: string;
      companyName?: string;
      notes?: string;
    }
  ): Promise<Basket> {
    const api = await this.getCommerceBasketApi();
    const raw = await api.updateCustomer(basketId, {
      name: customer.name,
      email: customer.email,
      phoneNumber: customer.phone,
      companyName: customer.companyName,
    });
    return this.mapLiveCommerceBasket(raw);
  }

  async updateBasketFulfillment(
    basketId: string,
    fulfillment: { fulfillmentType?: 'delivery' | 'pickup'; type?: 'delivery' | 'pickup'; address?: Address; slot?: DeliverySlot; slotId?: string }
  ): Promise<Basket> {
    const requestedType = fulfillment.type || fulfillment.fulfillmentType || 'pickup';
    if (requestedType !== 'pickup') {
      return this.unsupportedLiveCapability('Basket fulfillment update for delivery');
    }

    const api = await this.getCommerceBasketApi();
    let time: string | undefined;

    if (fulfillment.slot?.dateString && fulfillment.slot?.startTime) {
      const currentRaw = await api.getBasket(basketId);
      const storeId = String(currentRaw?.storeId || currentRaw?.channelLinkId || '').trim();
      const store = storeId ? await this.getStore(storeId) : null;
      const timeZone = resolveStoreTimeZone(store);
      const parsed = zonedLocalDateTimeToUtc(
        fulfillment.slot.dateString,
        fulfillment.slot.startTime,
        timeZone
      );

      if (!parsed) {
        throw new CommerceError(
          'INVALID_FULFILLMENT',
          `The selected collection time ${fulfillment.slot.dateString} ${fulfillment.slot.startTime} is not valid in timezone ${timeZone}.`,
          422
        );
      }
      time = parsed.toISOString();
    }

    const raw = await api.updateFulfillment(basketId, { type: 'pickup', time });
    return this.mapLiveCommerceBasket(raw);
  }

  /**
   * Compares basket line items before/after an upstream Deliverect operation (store
   * switch, reconcile) and classifies each pre-existing line. Never guesses *why* an
   * item disappeared (out of stock vs. not carried vs. restricted) since Deliverect
   * doesn't tell us — it's reported as REMOVED, not a fabricated specific reason.
   */
  private compareBasketItems(
    before: Basket,
    after: Basket
  ): Array<{
    plu: string;
    name: string;
    quantity: number;
    price: Money;
    status: 'UNCHANGED' | 'PRICE_CHANGED' | 'QUANTITY_REDUCED' | 'REMOVED';
    oldPrice?: Money;
    oldQuantity?: number;
  }> {
    const afterByPlu = new Map(after.items.map((item) => [item.plu, item]));

    return before.items.map((beforeItem) => {
      const afterItem = afterByPlu.get(beforeItem.plu);
      if (!afterItem) {
        return {
          plu: beforeItem.plu,
          name: beforeItem.name,
          quantity: beforeItem.quantity,
          price: beforeItem.price,
          status: 'REMOVED' as const,
          oldPrice: beforeItem.price,
          oldQuantity: beforeItem.quantity,
        };
      }
      if (afterItem.price.amount !== beforeItem.price.amount) {
        return {
          plu: beforeItem.plu,
          name: afterItem.name,
          quantity: afterItem.quantity,
          price: afterItem.price,
          status: 'PRICE_CHANGED' as const,
          oldPrice: beforeItem.price,
        };
      }
      if (afterItem.quantity < beforeItem.quantity) {
        return {
          plu: beforeItem.plu,
          name: afterItem.name,
          quantity: afterItem.quantity,
          price: afterItem.price,
          status: 'QUANTITY_REDUCED' as const,
          oldQuantity: beforeItem.quantity,
        };
      }
      return {
        plu: beforeItem.plu,
        name: afterItem.name,
        quantity: afterItem.quantity,
        price: afterItem.price,
        status: 'UNCHANGED' as const,
      };
    });
  }

  async updateBasketStore(
    basketId: string,
    storeId: string,
    _options?: { confirmMigration?: boolean }
  ): Promise<{ basket: Basket; storeSwitchDiff: any }> {
    const before = await this.getMappedCommerceBasket(basketId);
    const { channelLinkId } = await this.resolveStoreChannelLinkId(storeId);
    const api = await this.getCommerceBasketApi();
    let raw = await api.updateStore(basketId, channelLinkId);
    let after = await this.mapLiveCommerceBasket(raw);

    // Store switching is a fresh basket qualification event. Do not reconstruct
    // historical bundle ownership from the source store: evaluate the actual
    // destination basket against the destination catalogue and prices.
    const destinationCatalog = await this.getStoreCatalog(after.storeId, after.fulfillmentType);
    const destinationDesired = toCommerceItemInputs(after).map((item) => ({
      plu: item.plu,
      quantity: item.quantity,
    }));
    const automaticDiscounts = await this.recalculateAutomaticDealDiscounts(
      basketId,
      destinationDesired,
      destinationCatalog,
      Array.isArray((raw as any)?.discounts) ? (raw as any).discounts : []
    );
    raw = await api.updateDiscounts(basketId, automaticDiscounts);
    after = await this.mapLiveCommerceBasket(raw);

    const comparison = this.compareBasketItems(before, after);

    return {
      basket: after,
      storeSwitchDiff: {
        fromStoreId: before.storeId,
        toStoreId: after.storeId,
        changed: before.storeId !== after.storeId,
        availableUnchanged: comparison
          .filter((c) => c.status === 'UNCHANGED')
          .map((c) => ({ plu: c.plu, name: c.name, quantity: c.quantity, price: c.price })),
        priceChanges: comparison
          .filter((c) => c.status === 'PRICE_CHANGED')
          .map((c) => ({ plu: c.plu, name: c.name, oldPrice: c.oldPrice!, newPrice: c.price })),
        unavailableItems: comparison
          .filter((c) => c.status === 'REMOVED')
          .map((c) => ({ plu: c.plu, name: c.name })),
        quantityAdjusted: comparison
          .filter((c) => c.status === 'QUANTITY_REDUCED')
          .map((c) => ({ plu: c.plu, name: c.name, requested: c.oldQuantity!, adjustedTo: c.quantity })),
      },
    };
  }

  async updateDiscounts(_basketId: string, _options: any): Promise<Basket> {
    return this.unsupportedLiveCapability('Basket discounts');
  }

  async updateCharges(_basketId: string, _charges: any[]): Promise<Basket> {
    return this.unsupportedLiveCapability('Basket charges');
  }

  async updateTip(_basketId: string, _tip: Money): Promise<Basket> {
    return this.unsupportedLiveCapability('Basket tip');
  }

  async validateBasket(
    basketId: string
  ): Promise<{ valid: boolean; issues: string[]; errors?: any[] }> {
    const api = await this.getCommerceBasketApi();
    const raw = await api.validateBasket(basketId);

    const errors = Array.isArray(raw?.errors)
      ? raw.errors
      : Array.isArray(raw?.validationErrors)
      ? raw.validationErrors
      : [];

    return {
      valid: errors.length === 0,
      issues: errors.map((e: any) => String(e?.message || e?.description || e?.code || e)),
      errors,
    };
  }

  async reconcileBasket(
    basketId: string,
    _destinationStoreId?: string
  ): Promise<{
    reconciled: boolean;
    basket: Basket;
    changes: Array<{
      plu: string;
      name: string;
      type: 'PRICE_CHANGED' | 'OUT_OF_STOCK' | 'ITEM_REMOVED' | 'QUANTITY_ADJUSTED';
      oldPrice?: Money;
      newPrice?: Money;
      oldQuantity?: number;
      newQuantity?: number;
      message: string;
    }>;
  }> {
    const before = await this.getMappedCommerceBasket(basketId).catch(() => null);
    const api = await this.getCommerceBasketApi();
    const raw = await api.reconcileBasket(basketId);
    const after = await this.mapLiveCommerceBasket(raw);

    const comparison = before ? this.compareBasketItems(before, after) : [];
    const changes = comparison
      .filter((c) => c.status !== 'UNCHANGED')
      .map((c) => {
        if (c.status === 'REMOVED') {
          return {
            plu: c.plu,
            name: c.name,
            type: 'ITEM_REMOVED' as const,
            oldQuantity: c.oldQuantity,
            message: `${c.name} is no longer available and was removed from your basket.`,
          };
        }
        if (c.status === 'PRICE_CHANGED') {
          return {
            plu: c.plu,
            name: c.name,
            type: 'PRICE_CHANGED' as const,
            oldPrice: c.oldPrice,
            newPrice: c.price,
            message: `${c.name}'s price has changed.`,
          };
        }
        return {
          plu: c.plu,
          name: c.name,
          type: 'QUANTITY_ADJUSTED' as const,
          oldQuantity: c.oldQuantity,
          newQuantity: c.quantity,
          message: `${c.name} quantity was adjusted from ${c.oldQuantity} to ${c.quantity}.`,
        };
      });

    return {
      reconciled: true,
      basket: after,
      changes,
    };
  }

  async getDeliveryOptions(_basketId: string, _address: Address, _fulfillmentType?: 'delivery' | 'pickup'): Promise<DeliveryOption[]> {
    return this.unsupportedLiveCapability('Delivery options');
  }

  async getAvailableSlots(storeId: string, fulfillmentType: 'delivery' | 'pickup' = 'pickup'): Promise<{
    asapAvailable: boolean;
    asapEtaMinutes?: number;
    days: Array<{ dayLabel: string; dateString: string; slots: DeliverySlot[] }>;
    nextAvailableSlot?: DeliverySlot;
  }> {
    if (fulfillmentType !== 'pickup') {
      return this.unsupportedLiveCapability('Delivery slots');
    }

    const store = await this.getStore(storeId);
    if (!store) {
      throw new CommerceError('STORE_NOT_FOUND', `Store "${storeId}" was not found.`);
    }

    const days: Array<{ dayLabel: string; dateString: string; slots: DeliverySlot[] }> = [];
    let nextAvailableSlot: DeliverySlot | undefined;

    if (store.scheduling?.acceptsSameDayPreOrders === false) {
      return { asapAvailable: evaluateStoreOpenNow(store).isOpen, days, nextAvailableSlot };
    }

    // Deliverect opening hours are location-local. Generate slot labels using the
    // store timezone rather than the Cloud Run process timezone so BST/DST cannot
    // shift displayed or submitted collection times.
    const normalizedMap = normalizeOpeningHours(store.openingHours);
    const now = new Date();
    const timeZone = resolveStoreTimeZone(store);
    const localNow = getZonedDateParts(now, timeZone);
    const dayNames: Array<'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday'> =
      ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const hours = normalizedMap[dayNames[weekdayIndexForDateString(localNow.dateString)]];
    const SLOT_MINUTES = store.scheduling?.slotLengthMinutes || 30;
    const leadTimeMinutes = Math.max(0, store.scheduling?.minimumLeadTimeMinutes || 0);

    if (hours) {
      const [openHour, openMinute] = hours.open.split(':').map((n) => parseInt(n, 10));
      const [closeHour, closeMinute] = hours.close.split(':').map((n) => parseInt(n, 10));

      if (![openHour, openMinute, closeHour, closeMinute].some((n) => Number.isNaN(n))) {
        const openMinutes = openHour * 60 + openMinute;
        const closeMinutes = closeHour * 60 + closeMinute;
        const earliestMinute = localNow.hour * 60 + localNow.minute + leadTimeMinutes;
        const slotsForDay: DeliverySlot[] = [];

        for (let slotStart = openMinutes; slotStart + SLOT_MINUTES <= closeMinutes; slotStart += SLOT_MINUTES) {
          if (slotStart <= earliestMinute) continue;

          const slotEnd = slotStart + SLOT_MINUTES;
          const startTime =
            String(Math.floor(slotStart / 60)).padStart(2, '0') + ':' +
            String(slotStart % 60).padStart(2, '0');
          const endTime =
            String(Math.floor(slotEnd / 60)).padStart(2, '0') + ':' +
            String(slotEnd % 60).padStart(2, '0');

          // Validate the wall-clock time against the actual timezone. This drops
          // non-existent slots during a spring-forward DST transition.
          if (!zonedLocalDateTimeToUtc(localNow.dateString, startTime, timeZone)) continue;

          const slot: DeliverySlot = {
            id: `${localNow.dateString}_${startTime}`,
            dayLabel: 'Today',
            dateString: localNow.dateString,
            startTime,
            endTime,
            formatted: `${startTime} – ${endTime}`,
            isAvailable: true,
          };
          slotsForDay.push(slot);
          if (!nextAvailableSlot) nextAvailableSlot = slot;
        }

        if (slotsForDay.length > 0) {
          days.push({ dayLabel: 'Today', dateString: localNow.dateString, slots: slotsForDay });
        }
      }
    }

    return {
      asapAvailable: evaluateStoreOpenNow(store, now).isOpen,
      days,
      nextAvailableSlot,
    };
  }

  async createPaymentSession(_basketId: string, _amount?: Money, _currency?: string): Promise<HostedPaymentSession> {
    return this.unsupportedLiveCapability('Payment session');
  }

  async checkout(
    basketId: string,
    options?: {
      customerNotes?: string;
      idempotencyKey?: string;
      channelOrderReference?: string;
      tenantId?: string;
    }
  ): Promise<CheckoutResult> {
    const api = await this.getCommerceBasketApi();

    const reconciledRaw = await api.reconcileBasket(basketId);
    const basket = await this.mapLiveCommerceBasket(reconciledRaw);

    if (basket.fulfillmentType !== 'pickup') {
      throw new CommerceError(
        'INVALID_FULFILLMENT',
        'The first real Bwydi checkout milestone supports Collection only.'
      );
    }

    const channelOrderReference =
      options?.channelOrderReference ||
      `BWYDI-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;

    const result = await api.checkoutUnpaidPickup({
      basketId,
      amountMinor: basket.total.amount,
      channelOrderId: channelOrderReference,
      customer: basket.customer
        ? {
            name: basket.customer.name,
            email: basket.customer.email,
            phoneNumber: basket.customer.phone,
            companyName: basket.customer.companyName,
          }
        : undefined,
      orderNote: options?.customerNotes,
    });

    const checkoutId = String(result.checkoutId || '').trim();
    if (!checkoutId) {
      throw new CommerceError(
        'CHECKOUT_FAILED',
        'Deliverect accepted checkout but did not return a checkout ID.'
      );
    }

    const now = new Date().toISOString();
    const resolvedChannelOrderReference = result.channelOrderId || channelOrderReference;
    const channelLinkId = basket.channelLinkId || basket.storeId;

    return {
      checkoutId,
      channelOrderReference: resolvedChannelOrderReference,
      tenantId: options?.tenantId || this.tenantId,
      storeId: basket.storeId,
      channelLinkId,
      status: 'CHECKOUT_PENDING_CONFIRMATION',
      basketId,
      fulfillmentType: 'pickup',
      total: basket.total,
      idempotencyKey: options?.idempotencyKey,
      // Persist a provisional projection immediately. Deliverect creates the real
      // order asynchronously, but Quest/webhook correlation must already have the
      // basket lines and customer substitution choices available by checkoutId and
      // channelOrderId before the first upstream callback arrives.
      order: {
        id: resolvedChannelOrderReference,
        channelOrderId: resolvedChannelOrderReference,
        channelOrderDisplayId: result.channelOrderDisplayId,
        orderReference: resolvedChannelOrderReference,
        basketId,
        channelLinkId,
        status: 'SUBMITTED',
        fulfillmentType: 'pickup',
        fulfillment: { type: 'pickup' },
        originalBasket: {
          id: basket.id,
          fulfillmentType: 'pickup',
          items: basket.items,
          total: basket.total,
          currency: basket.currency,
        },
        currentOrder: {
          itemCount: basket.items.reduce((sum, item) => sum + item.quantity, 0),
          total: basket.total,
        },
        paymentState: 'NO_CAPTURE_REQUIRED',
        createdAt: now,
        updatedAt: now,
      },
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Submit the reconciled Commerce basket through Deliverect's Channel/Retail
   * Create Order API so the order is available to Quest without also creating a
   * Commerce checkout. The two order creation routes are deliberately exclusive.
   */
  async submitRetailOrder(
    basketId: string,
    options?: {
      paymentId?: string;
      authorizedMaximum?: Money;
      customerNotes?: string;
      deliveryAddress?: Address;
      dispatchValidationId?: string;
      idempotencyKey?: string;
      channelOrderReference?: string;
      tenantId?: string;
    }
  ): Promise<CheckoutResult> {
    const api = await this.getCommerceBasketApi();
    const reconciledRaw = await api.reconcileBasket(basketId);
    const basket = await this.mapLiveCommerceBasket(reconciledRaw);
    const rawFulfillmentTime = String(
      reconciledRaw?.fulfillment?.time ||
      reconciledRaw?.pickupTime ||
      ''
    ).trim();
    const parsedFulfillmentTime = rawFulfillmentTime ? new Date(rawFulfillmentTime) : null;
    const scheduledFulfillmentTime =
      parsedFulfillmentTime && !Number.isNaN(parsedFulfillmentTime.getTime())
        ? parsedFulfillmentTime.toISOString()
        : undefined;
    const context = await IntegrationContext.getContext(this.tenantId);

    // Read the latest persisted integration record as well as the cached
    // IntegrationContext. This prevents a newly saved channelName from waiting
    // up to the context-cache TTL before it can be used for an order.
    const latestIntegration = await FirestorePlatformService
      .getIntegrationConfig(this.tenantId)
      .catch(() => null);
    const configuredChannelName =
      latestIntegration?.channelName ||
      context.channelName;

    let channelResolution = resolveDeliverectChannelName(
      configuredChannelName
    );

    if (!channelResolution.channelName) {
      const grantedChannelScopes =
        await this.tokenManager.getChannelScopeNames();
      channelResolution = resolveDeliverectChannelName(
        configuredChannelName,
        grantedChannelScopes
      );
    }

    if (!channelResolution.channelName) {
      if (channelResolution.source === 'ambiguous') {
        throw new CommerceError(
          'INTEGRATION_NOT_CONFIGURED',
          `Retail/Quest ordering cannot choose a Deliverect Channel Name because the OAuth token exposes multiple genericChannel scopes (${channelResolution.grantedChannelScopes.join(
            ', '
          )}). Configure integration.channelName or DELIVERECT_CHANNEL_NAME with the assigned Channel Name to select the order endpoint explicitly.`,
          503
        );
      }

      throw new CommerceError(
        'INTEGRATION_NOT_CONFIGURED',
        'Retail/Quest ordering cannot determine the Deliverect Channel Name. No integration.channelName / DELIVERECT_CHANNEL_NAME is configured, and the OAuth token did not expose a readable genericChannel:<channel_scope> value. This does not prove Channel API permission is missing. Configure the assigned Channel Name explicitly so the app can attempt the real Deliverect Channel order endpoint.',
        503
      );
    }

    const channelName = channelResolution.channelName;
    console.log(
      `[DeliverectApiClient] Retail order channelName="${channelName}" source=${channelResolution.source}`
    );

    const channelLinkId = String(basket.channelLinkId || basket.storeId || '').trim();
    if (!channelLinkId) {
      throw new CommerceError(
        'VALIDATION_ERROR',
        'Retail/Quest order submission requires a channelLinkId.',
        422
      );
    }

    if (
      this.allowedChannelLinkIds &&
      this.allowedChannelLinkIds.size > 0 &&
      !this.allowedChannelLinkIds.has(channelLinkId)
    ) {
      throw new CommerceError(
        'FORBIDDEN',
        `Channel link "${channelLinkId}" is not provisioned for this tenant.`,
        403
      );
    }

    const channelOrderReference =
      options?.channelOrderReference ||
      `BWYDI-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const channelOrderDisplayId = toDisplayOrderReference(channelOrderReference);
    const now = new Date().toISOString();
    const hasOnlineAuthorization = Boolean(options?.paymentId);

    // Basket presentation and Retail/Quest order pricing are intentionally separate.
    // Commerce keeps one order_flat_off for a qualifying combo. When explicitly
    // enabled per tenant, the Retail order consumes the frozen bundle allocation
    // ledger and sends those savings as final per-unit item prices instead.
    const tenantConfig = await FirestorePlatformService.getTenantConfig(this.tenantId);
    const sendBundleDiscountAsItemPrice =
      tenantConfig.featureFlags?.sendBundleDiscountAsItemPrice === true;
    const bundleAllocations = sendBundleDiscountAsItemPrice
      ? await FirestorePlatformService.getBasketBundleAllocations(this.tenantId, basketId)
      : [];

    const protectedUnitPricePools = new Map<string, number[]>();
    let projectedBundleDiscountMinor = 0;
    if (sendBundleDiscountAsItemPrice) {
      for (const allocation of bundleAllocations) {
        projectedBundleDiscountMinor += Math.round(allocation.discountTotalMinor || 0);
        for (const component of allocation.components || []) {
          const pool = protectedUnitPricePools.get(component.componentPlu) || [];
          for (const price of component.protectedUnitPricesMinor || []) {
            if (!Number.isInteger(price) || price < 0) {
              throw new CommerceError(
                'BASKET_RECONCILIATION_REQUIRED',
                'Bundle allocation contains an invalid protected unit price.',
                409
              );
            }
            pool.push(price);
          }
          protectedUnitPricePools.set(component.componentPlu, pool);
        }
      }
    }

    let projectedRetailItemsTotalMinor = 0;
    const retailItems = basket.items.map((item: any) => {
      const unitPrice =
        typeof item?.unitPrice?.amount === 'number'
          ? Math.round(item.unitPrice.amount)
          : typeof item?.price?.amount === 'number'
            ? Math.round(item.price.amount)
            : typeof item?.price === 'number'
              ? Math.round(item.price)
              : 0;
      const protectedPrices = protectedUnitPricePools.get(item.plu) || [];
      if (protectedPrices.length > item.quantity) {
        throw new CommerceError(
          'BASKET_RECONCILIATION_REQUIRED',
          `Bundle allocation contains more protected units than basket quantity for ${item.plu}.`,
          409
        );
      }
      const protectedTotal = protectedPrices.reduce((sum, price) => sum + price, 0);
      const ordinaryQuantity = item.quantity - protectedPrices.length;
      projectedRetailItemsTotalMinor += protectedTotal + ordinaryQuantity * unitPrice;

      // Retail Channel order lines have one unit price per line. If qualified and
      // ordinary units of the same PLU are aggregated at different prices, silently
      // averaging would corrupt the protected allocation. Fail closed until the
      // outbound projector splits that line into separate price-homogeneous lines.
      if (
        protectedPrices.length > 0 &&
        ordinaryQuantity > 0 &&
        protectedPrices.some((price) => price !== unitPrice)
      ) {
        throw new CommerceError(
          'BASKET_RECONCILIATION_REQUIRED',
          `Bundle and non-bundle quantities for ${item.plu} require separate Retail order lines.`,
          409
        );
      }
      if (
        protectedPrices.length > 1 &&
        protectedPrices.some((price) => price !== protectedPrices[0])
      ) {
        throw new CommerceError(
          'BASKET_RECONCILIATION_REQUIRED',
          `Protected bundle quantities for ${item.plu} have different unit prices and require separate Retail order lines.`,
          409
        );
      }
      const outboundUnitPrice =
        protectedPrices.length > 0 ? Math.round(protectedUnitPricePools.get(item.plu)![0]) : unitPrice;

      const preference = item.substitutionPreference || 'BEST_MATCH';
      const echoedActions =
        Array.isArray(item.itemUnavailableActions) && item.itemUnavailableActions.length > 0
          ? item.itemUnavailableActions
          : Array.isArray(item.deliverectUnavailableActions) && item.deliverectUnavailableActions.length > 0
            ? item.deliverectUnavailableActions
            : undefined;
      const computedActions = buildQuestItemUnavailableActions(preference);
      const itemUnavailableActions = echoedActions || computedActions;

      // Deliverect's own echoed value (from a prior basket GET/reconcile)
      // takes precedence over what we compute from substitutionPreference.
      // That's deliberate, but it was previously silent: if Deliverect
      // narrows a line (e.g. no substitute group configured for that PLU in
      // the Retail catalog), the customer's preference is overridden with
      // no visibility anywhere. Surface the mismatch so a "substitution
      // never offered in Quest for this PLU" report is diagnosable instead
      // of looking identical to a real customer choice.
      if (echoedActions) {
        const echoedSet = new Set(echoedActions.map((a: string) => String(a).toUpperCase()));
        const computedSet = new Set(computedActions.map((a) => a.toUpperCase()));
        const isNarrower =
          computedSet.size > echoedSet.size ||
          [...computedSet].some((a) => !echoedSet.has(a));
        if (isNarrower) {
          console.warn(
            `[DeliverectApiClient] itemUnavailableActions for PLU ${item.plu} was narrowed by Deliverect's echoed basket value: computed ${JSON.stringify(computedActions)} from preference "${preference}", but Deliverect returned ${JSON.stringify(echoedActions)}. Likely cause: no substitute/linked-alternative configured for this PLU in the Deliverect Retail catalog.`
          );
        }
      }
      const preferredPlu = String(item.preferredSubstitutePlu || '').trim();
      const preferredName = String(item.preferredSubstituteName || preferredPlu).trim();
      const preferredPrice = item.preferredSubstitutePrice;
      const substituteCandidate =
        String(preference).toUpperCase() === 'CUSTOMER_SELECTED' && preferredPlu
          ? [
              {
                plu: preferredPlu,
                name: preferredName || preferredPlu,
                quantity: item.quantity,
                ...(preferredPrice && typeof preferredPrice.amount === 'number'
                  ? { price: Math.round(preferredPrice.amount) }
                  : {}),
              },
            ]
          : undefined;

      return {
        plu: item.plu,
        name: item.name || item.plu,
        price: outboundUnitPrice,
        quantity: item.quantity,
        ...(item.note ? { remark: item.note } : {}),
        itemUnavailableActions,
        ...(substituteCandidate ? { substituteCandidate } : {}),
      };
    });

    if (sendBundleDiscountAsItemPrice && bundleAllocations.length > 0) {
      const expectedItemsTotalMinor =
        basket.items.reduce((sum: number, item: any) => {
          const unit =
            typeof item?.unitPrice?.amount === 'number'
              ? Math.round(item.unitPrice.amount)
              : typeof item?.price?.amount === 'number'
                ? Math.round(item.price.amount)
                : typeof item?.price === 'number'
                  ? Math.round(item.price)
                  : 0;
          return sum + unit * item.quantity;
        }, 0) - projectedBundleDiscountMinor;

      if (projectedRetailItemsTotalMinor !== expectedItemsTotalMinor) {
        throw new CommerceError(
          'BASKET_RECONCILIATION_REQUIRED',
          `Bundle item-price projection does not reconcile: projected ${projectedRetailItemsTotalMinor}, expected ${expectedItemsTotalMinor}.`,
          409
        );
      }
    }

    const isScheduledMoreThanThirtyMinutesAhead =
      Boolean(scheduledFulfillmentTime) &&
      new Date(scheduledFulfillmentTime!).getTime() - Date.now() > 30 * 60_000;

    const payload: any = {
      channelOrderId: channelOrderReference,
      channelOrderDisplayId,
      orderType: basket.fulfillmentType === 'delivery' ? 2 : 1,
      deliveryIsAsap: !isScheduledMoreThanThirtyMinutesAhead,
      ...(scheduledFulfillmentTime
        ? basket.fulfillmentType === 'delivery'
          ? { deliveryTime: scheduledFulfillmentTime }
          : { pickupTime: scheduledFulfillmentTime }
        : {}),
      placedTime: now,
      courier: 'restaurant',
      decimalDigits: 2,
      payment: {
        amount: basket.total.amount,
        type: 0,
        due: hasOnlineAuthorization ? 0 : basket.total.amount,
        rebate: 0,
      },
      items: retailItems,
      // This flag tells the operational/POS flow not to collect payment again.
      // The actual PSP settlement remains AUTHORIZED until Quest finalisation.
      orderIsAlreadyPaid: hasOnlineAuthorization,
      note: options?.customerNotes,
      customer: basket.customer
        ? {
            name: basket.customer.name,
            email: basket.customer.email,
            phoneNumber: basket.customer.phone,
            companyName: basket.customer.companyName,
          }
        : undefined,
      validationId: options?.dispatchValidationId,
    };

    if (basket.fulfillmentType === 'delivery') {
      const address: any = options?.deliveryAddress || (basket as any)?.fulfillment?.address;
      if (!address) {
        throw new CommerceError(
          'VALIDATION_ERROR',
          'Delivery address is required for a Retail delivery order.',
          422
        );
      }
      payload.deliveryAddress = {
        street: address.street || address.line1 || address.formattedAddress,
        postalCode: address.postalCode || address.postcode,
        city: address.city,
        country: address.country,
        ...(typeof address.latitude === 'number' && typeof address.longitude === 'number'
          ? { coordinates: [{ latitude: address.latitude, longitude: address.longitude }] }
          : {}),
      };
    }

    // Real Deliverect traffic observed for another Retail integration (Snappy
    // Shopper) submits orders to api.deliverect.io, not api.deliverect.com —
    // distinct from the general Channel/webhook API, which does use .com.
    // Defaults to the .io equivalent of whichever environment (staging/
    // production) this.baseUrl is already pointed at; DELIVERECT_RETAIL_ORDER_BASE_URL
    // still overrides explicitly (e.g. to roll back to .com) if this turns out wrong.
    const retailOrderBaseUrl = (
      process.env.DELIVERECT_RETAIL_ORDER_BASE_URL || this.baseUrl.replace(/\.com(\/|$)/, '.io$1')
    ).replace(/\/+$/, '');
    const url = `${retailOrderBaseUrl}/${encodeURIComponent(channelName)}/order/${encodeURIComponent(channelLinkId)}`;
    console.log(`[DeliverectApiClient] Submitting retail order to: ${url}`);
    const send = async () => {
      const authorization = await this.tokenManager.getAuthorizationHeader();
      return fetch(url, {
        method: 'POST',
        headers: {
          Authorization: authorization,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });
    };

    let response = await send();
    if (response.status === 401) {
      this.tokenManager.invalidateCache();
      response = await send();
    }

    const responseText = await response.text();
    let raw: any = {};
    if (responseText) {
      try {
        raw = JSON.parse(responseText);
      } catch {
        raw = { raw: responseText };
      }
    }

    if (!response.ok) {
      const upstreamMessage = responseText || response.statusText;
      const diagnosticContext =
        `channelName="${channelName}" (source=${channelResolution.source}), channelLinkId="${channelLinkId}"`;

      if (response.status === 401) {
        throw new CommerceError(
          'INTEGRATION_AUTH_FAILED',
          `Deliverect rejected authentication for the Retail/Quest Channel order endpoint (${diagnosticContext}). Refresh/check the Deliverect credentials. Upstream: ${upstreamMessage}`,
          401
        );
      }

      if (response.status === 403) {
        throw new CommerceError(
          'FORBIDDEN',
          `Deliverect rejected permission to create the Retail/Quest order (${diagnosticContext}). The Channel Name was resolved successfully, so check the genericChannel permission and whether this channelLinkId is accessible to these credentials. Upstream: ${upstreamMessage}`,
          403
        );
      }

      if (response.status === 404) {
        throw new CommerceError(
          'CHECKOUT_FAILED',
          `Deliverect could not find the Retail/Quest Channel order endpoint or channel link (${diagnosticContext}). Verify the assigned Channel Name and channelLinkId. Upstream: ${upstreamMessage}`,
          404
        );
      }

      throw new CommerceError(
        'CHECKOUT_FAILED',
        `Deliverect Retail order submission failed (HTTP ${response.status}; ${diagnosticContext}): ${upstreamMessage}`,
        response.status
      );
    }

    const upstreamOrderId = String(
      raw?._id || raw?.id || raw?.orderId || raw?.order?._id || raw?.order?.id || channelOrderReference
    ).trim();
    const checkoutId = `retail_${channelOrderReference.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

    return {
      checkoutId,
      channelOrderReference,
      orderId: upstreamOrderId,
      tenantId: options?.tenantId || this.tenantId,
      storeId: basket.storeId,
      channelLinkId,
      status: 'ORDER_CONFIRMED',
      basketId,
      fulfillmentType: basket.fulfillmentType,
      total: basket.total,
      paymentId: options?.paymentId,
      idempotencyKey: options?.idempotencyKey,
      dispatchValidationId: options?.dispatchValidationId,
      order: {
        id: upstreamOrderId,
        channelOrderRawId: upstreamOrderId,
        channelOrderId: channelOrderReference,
        channelOrderDisplayId,
        orderReference: channelOrderReference,
        basketId,
        channelLinkId,
        status: 'SUBMITTED',
        fulfillmentType: basket.fulfillmentType,
        fulfillment: {
          type: basket.fulfillmentType,
          ...(basket.fulfillmentType === 'delivery' && payload.deliveryAddress
            ? { address: payload.deliveryAddress }
            : {}),
        },
        originalBasket: {
          id: basket.id,
          fulfillmentType: basket.fulfillmentType,
          items: basket.items,
          total: basket.total,
          currency: basket.currency,
        },
        currentOrder: {
          itemCount: basket.items.reduce((sum, item) => sum + item.quantity, 0),
          total: basket.total,
        },
        paymentId: options?.paymentId,
        paymentState: hasOnlineAuthorization ? 'AUTHORIZED' : 'UNPAID',
        authorizedMaximum: options?.authorizedMaximum?.amount,
        metadata: {
          orderRoute: 'retail_quest',
          dpayCaptureMode: options?.paymentId ? 'manual' : undefined,
        },
        createdAt: now,
        updatedAt: now,
      },
      createdAt: now,
      updatedAt: now,
    };
  }

  async getCheckout(checkoutId: string): Promise<CheckoutResult | null> {
    const api = await this.getCommerceBasketApi();
    const raw = await api.getCheckout(checkoutId);
    if (!raw) return null;

    const basketId = String(
      raw?.basket?.id || raw?.basketId || raw?.basket?._id || ''
    ).trim();

    if (!basketId) {
      throw new CommerceError(
        'CHECKOUT_FAILED',
        'Deliverect checkout response is missing its basket reference.'
      );
    }

    let basket: MappedBasket | null = null;
    try {
      basket = await this.getMappedCommerceBasket(basketId);
    } catch (basketError) {
      // A Commerce checkout is asynchronous and the source basket may no longer
      // be readable once POS order injection has begun. Checkout status/order
      // correlation must not depend on re-fetching that consumed basket.
      console.warn(
        '[DeliverectApiClient] Checkout status available but source basket could not be re-read:',
        basketError
      );
    }

    const orderId = String(
      raw?.orderId ||
      raw?.order?.id ||
      raw?.order?._id ||
      raw?.order?.channelOrderRawId ||
      raw?.order?.channelOrderId ||
      raw?.channelOrderId ||
      ''
    ).trim() || undefined;

    const rawStoreId = String(
      raw?.storeId ||
      raw?.channelLinkId ||
      raw?.order?.channelLinkId ||
      ''
    ).trim();
    const rawFulfillment = String(
      raw?.fulfillment?.type ||
      raw?.order?.fulfillment?.type ||
      raw?.order?.fulfillmentType ||
      ''
    ).trim().toLowerCase();
    const rawTotal =
      typeof raw?.payment?.total === 'number'
        ? { amount: Math.round(raw.payment.total), currency: raw?.currency || 'GBP' }
        : undefined;

    const now = new Date().toISOString();
    return {
      checkoutId: String(raw?.id || raw?._id || raw?.checkoutId || checkoutId),
      channelOrderReference: String(
        raw?.channelOrderId ||
        raw?.order?.channelOrderId ||
        raw?.channelOrderReference ||
        ''
      ),
      orderId,
      tenantId: this.tenantId,
      storeId: basket?.storeId || rawStoreId,
      channelLinkId: basket?.channelLinkId || rawStoreId || undefined,
      status: this.mapCommerceCheckoutStatus(raw),
      basketId,
      fulfillmentType:
        basket?.fulfillmentType ||
        (rawFulfillment === 'pickup' || rawFulfillment === 'collection'
          ? 'pickup'
          : rawFulfillment === 'delivery'
            ? 'delivery'
            : undefined),
      total: basket?.total || rawTotal,
      createdAt: raw?.createdAt || now,
      updatedAt: raw?.updatedAt || now,
      failureReason: raw?.failureReason || raw?.error?.message,
      order: raw?.order,
    } as CheckoutResult;
  }

  async checkoutBasket(): Promise<Order> {
    return this.unsupportedLiveCapability(
      'Legacy synchronous checkoutBasket; use async checkout()'
    );
  }

  async getOrder(_orderId: string): Promise<Order | null> {
    return null;
  }
}
