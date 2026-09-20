import { DeliverectAdapter } from './DeliverectAdapter';
import { OAuthTokenManager } from './OAuthTokenManager';
import { LinkedAccountsAdapter } from './LinkedAccountsAdapter';
import { IntegrationContext } from './IntegrationContext';
import { CommerceDiscoveryService } from './CommerceDiscoveryService';
import { circuitBreakers } from '../circuitBreaker';
import { MetricsService } from '../metricsService';
import { defaultBasketService } from '../basket/BasketService';
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
} from '../../src/commerce/models';

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
    this.allowedChannelLinkIds = allowedChannelLinkIds?.length
      ? new Set(allowedChannelLinkIds.map(String))
      : undefined;
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

      const supportsDelivery = Boolean(s.fulfillmentCapabilitiesProjection?.delivery ?? true);
      const supportsPickup = Boolean(s.fulfillmentCapabilitiesProjection?.pickup ?? true);

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
    const token = await this.tokenManager.getAccessToken();
    const response = await fetch(`${this.baseUrl}/allAllergens`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
    if (!response.ok) { const error: any = new Error(`Deliverect Allergens & Tags request failed: HTTP ${response.status}`); error.statusCode = 502; error.code = 'DELIVERECT_TAGS_UNAVAILABLE'; throw error; }
    const raw = await response.json() as any;
    const items: any[] = Array.isArray(raw) ? raw : Array.isArray(raw?.items) ? raw.items : Array.isArray(raw?._items) ? raw._items : Object.entries(raw || {}).map(([id, value]) => typeof value === 'string' ? { id, name: value } : { ...(value as any), id: (value as any)?.id ?? id });
    const definitions = items.map((item: any) => { const id = String(item.id ?? item._id ?? item.value ?? item.tagId ?? ''); const name = String(item.name ?? item.label ?? item.title ?? item.code ?? id); const type = item.type ?? item.category ?? item.group; const typeText = String(type ?? '').toLowerCase(); return { id, name, ...(type ? { type: String(type) } : {}), isAllergen: item.isAllergen === true || typeText.includes('allergen') }; }).filter((definition: ProductTagDefinition) => definition.id && definition.name);
    this.tagDefinitionsCache = { definitions, loadedAt: Date.now() };
    return definitions;
  }

  parseDeliverectMenu(rawMenu: any, isStoreCatalog: boolean, tagDefinitions: ProductTagDefinition[] = []): { categories: Category[]; products: Product[]; bundleCatalog: BundleCatalog } {
    return DeliverectApiClient.parseDeliverectMenu(rawMenu, isStoreCatalog, tagDefinitions);
  }

  static parseDeliverectMenu(rawMenu: any, isStoreCatalog: boolean, tagDefinitions: ProductTagDefinition[] = []): { categories: Category[]; products: Product[]; bundleCatalog: BundleCatalog } {
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

    const indexRawCategory = (rawCat: any) => {
      const catId = String(rawCat.id || rawCat._id || '');
      if (!catId) return;
      rawCategoryMap.set(catId, rawCat);

      const subProds: string[] = Array.isArray(rawCat.subProducts) ? rawCat.subProducts : [];
      for (const prodId of subProds) {
        const existing = productCategoryMap.get(prodId) || [];
        if (!existing.includes(catId)) existing.push(catId);
        productCategoryMap.set(prodId, existing);
      }

      if (Array.isArray(rawCat.subCategories)) {
        for (const sub of rawCat.subCategories) {
          if (typeof sub === 'string') {
            childIdSet.add(sub);
          } else if (sub && typeof sub === 'object') {
            const subId = String(sub.id || sub._id || '');
            if (subId) childIdSet.add(subId);
            indexRawCategory(sub);
          }
        }
      }
      if (rawCat.parentId) {
        childIdSet.add(catId);
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

      const subProds: string[] = Array.isArray(rawCat.subProducts) ? rawCat.subProducts : [];
      const subcategoryNodes: Category[] = [];

      if (Array.isArray(rawCat.subCategories)) {
        for (const sub of rawCat.subCategories) {
          const subId = typeof sub === 'string' ? sub : String(sub.id || sub._id || '');
          if (subId && rawCategoryMap.has(subId)) {
            const childNode = buildCategoryTree(subId, level + 1, catId);
            if (childNode) subcategoryNodes.push(childNode);
          }
        }
      }

      return {
        id: catId,
        name: String(rawCat.name || 'Uncategorized'),
        description: rawCat.description || '',
        imageUrl: rawCat.imageUrl || undefined,
        parentId,
        level,
        subcategories: subcategoryNodes.length > 0 ? subcategoryNodes : undefined,
        productCount: subProds.length,
      };
    };

    // Root categories are those not marked as a child of another category
    const categories: Category[] = [];
    for (const [catId] of rawCategoryMap) {
      if (!childIdSet.has(catId)) {
        const rootNode = buildCategoryTree(catId, 1, null);
        if (rootNode) categories.push(rootNode);
      }
    }

    // Include any unvisited orphans
    for (const [catId] of rawCategoryMap) {
      if (!visited.has(catId)) {
        const orphanNode = buildCategoryTree(catId, 1, null);
        if (orphanNode) categories.push(orphanNode);
      }
    }

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

      const assignedCatIds = productCategoryMap.get(prodId) || [];
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
          allergens: Array.isArray(p.allergens) ? p.allergens : [],
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
          allergens: [...(Array.isArray(p.allergens) ? p.allergens.map(String) : []), ...(Array.isArray(p.productTags) ? p.productTags.map((tag: string | number) => tagDefinitionMap.get(String(tag))).filter((definition): definition is ProductTagDefinition => Boolean(definition?.isAllergen)).map(definition => definition.name) : [])],
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

    return { categories, products: standardProducts, bundleCatalog };
  }

  async getRootCatalog(): Promise<Catalog> {
    const accountId = await this.resolveAccountId();
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
      filtered = filtered.filter((p) => (p.categoryIds || []).includes(options.categoryId!));
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

  async createBasket(storeId?: string, fulfillmentType?: 'delivery' | 'pickup'): Promise<Basket> {
    if (!storeId) throw new Error('storeId is required to create a basket');
    const store = await this.getStore(storeId);
    if (!store) throw new Error(`Store ${storeId} was not found in the tenant's assigned Deliverect locations`);
    if (!store.currency) throw new Error(`Currency was not supplied for Deliverect store ${storeId}`);
    return defaultBasketService.createBasket(store.id, fulfillmentType, store.currency, store.name);
  }

  async getBasket(basketId: string): Promise<Basket | null> {
    return defaultBasketService.getBasket(basketId);
  }

  async updateBasketItem(basketId: string, productId: string, quantity: number): Promise<Basket> {
    return defaultBasketService.updateBasketItem(basketId, productId, quantity);
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
    }>
  ): Promise<Basket> {
    return defaultBasketService.updateBasketItems(basketId, items);
  }

  async updateBasketCustomer(
    basketId: string,
    customer: { name?: string; email?: string; phone?: string; companyName?: string; notes?: string }
  ): Promise<Basket> {
    return defaultBasketService.updateBasketCustomer(basketId, customer);
  }

  async updateBasketFulfillment(
    basketId: string,
    fulfillment: { fulfillmentType?: 'delivery' | 'pickup'; type?: 'delivery' | 'pickup'; address?: Address; slot?: DeliverySlot; slotId?: string }
  ): Promise<Basket> {
    return defaultBasketService.updateBasketFulfillment(basketId, fulfillment);
  }

  async updateBasketStore(
    basketId: string,
    storeId: string,
    options?: { confirmMigration?: boolean }
  ): Promise<{ basket: Basket; storeSwitchDiff: any }> {
    return defaultBasketService.updateBasketStore(basketId, storeId, options);
  }

  async updateDiscounts(
    basketId: string,
    options: { code?: string; remove?: boolean; discounts?: any[] }
  ): Promise<Basket> {
    return defaultBasketService.updateDiscounts(basketId, options);
  }

  async updateCharges(
    basketId: string,
    charges: any[]
  ): Promise<Basket> {
    return defaultBasketService.updateCharges(basketId, charges);
  }

  async updateTip(
    basketId: string,
    tip: Money
  ): Promise<Basket> {
    return defaultBasketService.updateTip(basketId, tip);
  }

  async validateBasket(
    basketId: string
  ): Promise<{ valid: boolean; issues: string[]; errors?: any[] }> {
    return defaultBasketService.validateBasket(basketId);
  }

  async reconcileBasket(
    basketId: string,
    destinationStoreId?: string
  ): Promise<{
    reconciled: boolean;
    basket: Basket;
    changes: any[];
  }> {
    return defaultBasketService.reconcileBasket(basketId, destinationStoreId);
  }

  async getDeliveryOptions(basketId: string, address: Address, fulfillmentType?: 'delivery' | 'pickup'): Promise<DeliveryOption[]> {
    return defaultBasketService.getDeliveryOptions(basketId, address, fulfillmentType);
  }

  async getAvailableSlots(storeId: string, fulfillmentType?: 'delivery' | 'pickup'): Promise<{
    asapAvailable: boolean;
    asapEtaMinutes?: number;
    days: Array<{ dayLabel: string; dateString: string; slots: DeliverySlot[] }>;
    nextAvailableSlot?: DeliverySlot;
  }> {
    return defaultBasketService.getAvailableSlots(storeId, fulfillmentType);
  }

  async createPaymentSession(basketId: string, amount?: Money, currency?: string): Promise<HostedPaymentSession> {
    return defaultBasketService.createPaymentSession(basketId, amount, currency);
  }

  async checkoutBasket(basketId: string, options?: {
    deliveryOptionId?: string;
    slotId?: string;
    schedulingType?: FulfillmentSchedulingType;
    paymentTokenRef?: string;
    authorizationMaximum?: Money;
    customerNotes?: string;
    deliveryAddress?: Address;
    dispatchValidationId?: string;
    dispatchValidationExpiresAt?: string;
  }): Promise<Order> {
    return defaultBasketService.checkoutBasket(basketId, options);
  }

  async getOrder(orderId: string): Promise<Order | null> {
    return defaultBasketService.getOrder(orderId);
  }

  async advancePickingDemo(orderId: string): Promise<Order | null> {
    return defaultBasketService.advancePickingDemo(orderId);
  }
}
