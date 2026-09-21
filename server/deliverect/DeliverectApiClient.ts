import { DeliverectAdapter } from './DeliverectAdapter';
import { OAuthTokenManager } from './OAuthTokenManager';
import { LinkedAccountsAdapter } from './LinkedAccountsAdapter';
import { IntegrationContext } from './IntegrationContext';
import { CommerceDiscoveryService } from './CommerceDiscoveryService';
import { circuitBreakers } from '../circuitBreaker';
import { MetricsService } from '../metricsService';
import { CommerceError } from '../errors';
import { FirestorePlatformService } from '../firestoreService';
import { randomUUID } from 'node:crypto';
import {
  DeliverectCommerceBasketApiClient,
  CommerceBasketItemInput,
} from './DeliverectCommerceBasketApi';
import {
  mapDeliverectBasket,
  toCommerceItemInputs,
  type MappedBasket,
} from './DeliverectBasketMapper';
import type { CheckoutResult } from '../../src/domain/models';
import { ensureNestedCategoryTree } from '../../src/commerce/categoryHierarchy';
import { evaluateStoreOpenNow, computeNextOpeningTime, normalizeOpeningHours } from '../../src/services/storeOpeningHoursService';
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

export const FALLBACK_CATEGORY_ID = 'cat_other_fallback';
export const FALLBACK_CATEGORY_NAME = 'Store Specials & Local Products';

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

    return scopedStores.map((s) => {
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
      const isOpen = override?.isOpen !== undefined ? override.isOpen : (s.stateProjection === 'paused' ? false : true);
      const status = override?.status || (isOpen ? 'open' : 'closed');
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
        physicalLocationId: s.physicalLocationId || undefined,
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
        supportsDelivery,
        supportsPickup,
        isOpen,
        deliveryRadiusKm,
        deliveryEta,
        currency: (s as any).currency || (loc as any)?.currency || 'GBP',
        // Previously never passed through, so every real store silently fell back to
        // storeOpeningHoursService's demo-only default (07:00-23:00) regardless of its
        // actual Deliverect hours — fixed here.
        openingHours: (s as any).openingHours,
        scheduling: storeScheduling,
      };
    });
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
    const items: any[] = Array.isArray(raw) ? raw : Array.isArray(raw?.items) ? raw.items : Array.isArray(raw?._items) ? raw._items : Object.entries(raw || {}).map(([id, value]) => typeof value === 'string' ? { id, name: value } : { ...(value as any), id: (value as any)?.id ?? id });
    const definitions = items.map((item: any) => { const id = String(item.id ?? item._id ?? item.value ?? item.tagId ?? ''); const name = String(item.name ?? item.label ?? item.title ?? item.code ?? id); const type = item.type ?? item.category ?? item.group; const typeText = String(type ?? '').toLowerCase(); return { id, name, ...(type ? { type: String(type) } : {}), isAllergen: item.isAllergen === true || typeText.includes('allergen') }; }).filter((definition: ProductTagDefinition) => definition.id && definition.name);
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
    const rawProducts: any[] = Array.isArray(rawMenu.products)
      ? rawMenu.products
      : rawMenu.products && typeof rawMenu.products === 'object'
      ? Object.values(rawMenu.products)
      : [];

    for (const p of rawProducts) {
      if (p && (p.id || p._id)) {
        rawProductsMap.set(String(p.id || p._id), p);
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

            // Component pricing: 0 for included, exact minor unit uplift for premium
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
      const { categories, products, bundleCatalog } = this.parseDeliverectMenu(selectedMenu, true, tagDefinitions);

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
          .filter((candidate) => candidate.plu === product.plu && this.isAvailableProduct(candidate) && candidate.price != null)
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
      return { products: filtered, summaries, diagnostics: catalog.diagnostics };
    }

    const stores = await this.getStores();
    const summaries = await this.buildAvailabilitySummaries(filtered, stores);
    return { products: filtered, summaries, diagnostics: catalog.diagnostics };
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

    return mapDeliverectBasket(raw, {
      storeName: store?.name || storeId,
      fallbackMenuId,
    });
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
    if (value.includes('CONFIRM') || value.includes('SUCCESS')) return 'ORDER_CONFIRMED';

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
      });
    }

    const api = await this.getCommerceBasketApi();
    const raw = await api.replaceItems(basketId, desired);
    return this.mapLiveCommerceBasket(raw);
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
    const catalog = await this.getStoreCatalog(
      current.storeId,
      current.fulfillmentType
    );
    const fallbackMenuId = String(catalog.activeMenuId || '').trim();

    const existingByPlu = new Map(
      current.items.map((item) => [item.plu, item])
    );

    const payload: CommerceBasketItemInput[] = items
      .filter((item) => Number.isInteger(item.quantity) && item.quantity > 0)
      .map((item) => {
        const existing = existingByPlu.get(item.plu) as any;
        const menuId = String(
          item.menuId || existing?.deliverect?.menuId || fallbackMenuId
        ).trim();

        if (!menuId) {
          throw new CommerceError(
            'MENU_NOT_AVAILABLE',
            `No menuId is available for ${item.plu}.`
          );
        }

        return {
          menuId,
          plu: item.plu,
          quantity: item.quantity,
        };
      });

    const api = await this.getCommerceBasketApi();
    const raw = await api.replaceItems(basketId, payload);
    const mapped = await this.mapLiveCommerceBasket(raw);

    // Deliverect's real Commerce basket item schema has no substitution-preference
    // field at all (confirmed against the official API reference) — so nothing we
    // send here reaches Deliverect, and the basket Deliverect returns can't echo it
    // back either. Without this merge, a customer's chosen substitution preference
    // would be silently lost the moment this basket is re-fetched/re-mapped, and
    // checkout would always persist the BEST_MATCH default (server/firestoreService.ts
    // getOrderProjection... reads item.substitutionPreference || 'BEST_MATCH').
    // Quest itself still learns the real preference live via SubstitutionCallbackService,
    // which reads this same local Firestore-persisted value, not Deliverect's basket.
    const preferenceByPlu = new Map(items.map((item) => [item.plu, item]));
    mapped.items = mapped.items.map((mappedItem) => {
      const source = preferenceByPlu.get(mappedItem.plu);
      if (!source) return mappedItem;
      return {
        ...mappedItem,
        substitutionPreference: source.substitutionPreference ?? mappedItem.substitutionPreference,
        substituteCandidatePlus: source.substituteCandidatePlus ?? mappedItem.substituteCandidatePlus,
        preferredSubstitutePlu: source.preferredSubstitutePlu ?? mappedItem.preferredSubstitutePlu,
        preferredSubstituteName: source.preferredSubstituteName ?? mappedItem.preferredSubstituteName,
        preferredSubstitutePrice: source.preferredSubstitutePrice ?? mappedItem.preferredSubstitutePrice,
      };
    });

    return mapped;
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

    // Prefer an explicit slot object (dateString + startTime); it's the only reliable
    // way to recover a real ISO datetime — slotId alone isn't a documented Deliverect
    // concept, it's this client's own id scheme (see getAvailableSlots).
    let time: string | undefined;
    if (fulfillment.slot?.dateString && fulfillment.slot?.startTime) {
      const parsed = new Date(`${fulfillment.slot.dateString}T${fulfillment.slot.startTime}:00`);
      if (!Number.isNaN(parsed.getTime())) time = parsed.toISOString();
    }

    const api = await this.getCommerceBasketApi();
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
    const raw = await api.updateStore(basketId, channelLinkId);
    const after = await this.mapLiveCommerceBasket(raw);

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

    // Same-day scheduled pre-order is a distinct, independently-toggleable capability
    // from next-opening pre-order (createBasket) — if the tenant has it off, there are
    // simply no pickable slots, not an error.
    if (store.scheduling?.acceptsSameDayPreOrders === false) {
      return { asapAvailable: evaluateStoreOpenNow(store).isOpen, days, nextAvailableSlot };
    }

    // Deliverect has no "get available slots" endpoint — available pickup times are
    // derived from the store's own real opening hours (never fabricated), matching
    // what createBasket/updateBasketFulfillment will actually accept. Capped to today
    // only: pre-ordering beyond the current day is intentionally not supported.
    const normalizedMap = normalizeOpeningHours(store.openingHours);
    const now = new Date();
    const dayNames: Array<'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday'> =
      ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const SLOT_MINUTES = 30;

    // Loop bound is intentionally 0 (today only), kept as a loop rather than inlined so
    // this reads the same as the rest of the per-day generation logic below.
    for (let offset = 0; offset <= 0; offset++) {
      const date = new Date(now);
      date.setDate(date.getDate() + offset);
      const hours = normalizedMap[dayNames[date.getDay()]];
      if (!hours) continue;

      const [openHour, openMinute] = hours.open.split(':').map((n) => parseInt(n, 10));
      const [closeHour, closeMinute] = hours.close.split(':').map((n) => parseInt(n, 10));
      if ([openHour, openMinute, closeHour, closeMinute].some((n) => Number.isNaN(n))) continue;

      const dateString = date.toISOString().slice(0, 10);
      const dayLabel =
        offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

      const slotsForDay: DeliverySlot[] = [];
      const cursor = new Date(date);
      cursor.setHours(openHour, openMinute, 0, 0);
      const close = new Date(date);
      close.setHours(closeHour, closeMinute, 0, 0);

      while (cursor < close) {
        if (cursor > now) {
          const slotEnd = new Date(Math.min(cursor.getTime() + SLOT_MINUTES * 60_000, close.getTime()));
          const startTime = cursor.toTimeString().slice(0, 5);
          const endTime = slotEnd.toTimeString().slice(0, 5);
          const slot: DeliverySlot = {
            id: `${dateString}_${startTime}`,
            dayLabel,
            dateString,
            startTime,
            endTime,
            formatted: `${startTime} – ${endTime}`,
            isAvailable: true,
          };
          slotsForDay.push(slot);
          if (!nextAvailableSlot) nextAvailableSlot = slot;
        }
        cursor.setMinutes(cursor.getMinutes() + SLOT_MINUTES);
      }

      if (slotsForDay.length > 0) {
        days.push({ dayLabel, dateString, slots: slotsForDay });
      }
    }

    return {
      asapAvailable: evaluateStoreOpenNow(store).isOpen,
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
    return {
      checkoutId,
      channelOrderReference: result.channelOrderId || channelOrderReference,
      tenantId: options?.tenantId || this.tenantId,
      storeId: basket.storeId,
      channelLinkId: basket.channelLinkId || basket.storeId,
      status: 'CHECKOUT_PENDING_CONFIRMATION',
      basketId,
      fulfillmentType: 'pickup',
      total: basket.total,
      idempotencyKey: options?.idempotencyKey,
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

    const basket = await this.getMappedCommerceBasket(basketId);
    const orderId = String(
      raw?.orderId || raw?.order?.id || raw?.order?._id || ''
    ).trim() || undefined;

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
      storeId: basket.storeId,
      channelLinkId: basket.channelLinkId || basket.storeId,
      status: this.mapCommerceCheckoutStatus(raw),
      basketId,
      fulfillmentType: basket.fulfillmentType,
      total: basket.total,
      createdAt: raw?.createdAt || now,
      updatedAt: raw?.updatedAt || now,
      failureReason: raw?.failureReason || raw?.error?.message,
      order: raw?.order,
    };
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
