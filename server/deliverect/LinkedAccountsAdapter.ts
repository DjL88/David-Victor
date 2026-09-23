import fs from 'fs';
import path from 'path';
import { AccountLink, PhysicalLocation, CommerceStore } from '../../src/domain/models';
import { OAuthTokenManager, DeliverectEnvironmentName } from './OAuthTokenManager';
import { isDemoMode } from '../runtimeMode';
import { BFFError } from '../errors';
import { getFirestoreDb, markFirestorePermissionDenied, isFirestorePermissionDenied } from '../firebase';
import { FirestorePlatformService, cleanUndefined } from '../firestoreService';
import { circuitBreakers } from '../circuitBreaker';

function getLocalMappingPath(tenantId: string): string {
  if (!isDemoMode()) {
    throw BFFError.internal(
      'Local tenant mapping files are only permitted in explicit DEMO mode.'
    );
  }

  const safeTenantId = String(tenantId || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 120);

  if (!safeTenantId) {
    throw BFFError.invalidInput('A valid tenantId is required for local demo persistence.');
  }

  const dir = path.join(process.cwd(), '.data');
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {}
  }
  return path.join(dir, `tenant_mappings_${safeTenantId}.json`);
}

export interface RawDeliverectAccount {
  _id: string;
  name: string;
  status?: string;
  companyName?: string;
}

export interface RawDeliverectLocation {
  _id: string;
  accountId?: string;
  name: string;
  status?: string;
  address?: {
    street?: string;
    source?: string;
    coordinates?: [number, number];
    city?: string;
    postalCode?: string;
    postcode?: string;
    country?: string;
    phoneNumber?: string;
  };
  coordinates?: [number, number] | { latitude: number; longitude: number; lat?: number; lng?: number };
  phone?: string;
  email?: string;
  contact?: any;
  channelLinks?: Array<RawDeliverectChannelLink | string>;
  posSettings?: any;
  posLocationId?: string;
  timezone?: string;
  openingHours?: Array<{ dayOfWeek: number; startTime: string; endTime: string }>;
}

export interface RawDeliverectChannelLink {
  _id?: string;
  channelLinkId: string;
  locationId?: string;
  accountId?: string;
  name?: string;
  channel?: string | number;
  status?: string | number; // 'ONLINE' | 'OFFLINE' | 'PAUSED' | 'BUSY'
  menuUrl?: string;
  channelSettings?: { storeUrl?: string; [key: string]: any };
  application?: string;
  fulfillmentCapabilities?:
    | {
        delivery?: boolean;
        pickup?: boolean;
        collection?: boolean;
        scheduling?: boolean;
      }
    | string[]
    | any;
}

export interface LinkedAccountsSyncResult {
  tenantId: string;
  accounts: AccountLink[];
  locations: PhysicalLocation[];
  stores: CommerceStore[];
  syncedAt: string;
  status?: 'SUCCESS' | 'DISCOVERY_SUCCEEDED_PERSISTENCE_FAILED' | 'NO_ACCOUNTS_FOUND' | 'FAILED';
  persistenceStatus?: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  persistenceCode?: string;
  persistenceError?: string;
  message?: string;
}

export interface NormalizedFulfillmentCapabilities {
  delivery: boolean;
  pickup: boolean;
  scheduling: boolean;
  provenance?: 'fulfillmentTypes' | 'settings' | 'fulfillmentCapabilities' | 'unknown';
}

export function normalizeFulfillmentCapabilities(rawObj: any): NormalizedFulfillmentCapabilities | undefined {
  if (!rawObj || typeof rawObj !== 'object') {
    return undefined;
  }

  // Priority 1: Explicit `fulfillmentTypes` or `fulfillmentType`
  const rawTypes = rawObj.fulfillmentTypes !== undefined ? rawObj.fulfillmentTypes : rawObj.fulfillmentType;
  if (rawTypes !== undefined && rawTypes !== null) {
    const typesArray = Array.isArray(rawTypes)
      ? rawTypes
      : typeof rawTypes === 'string' || typeof rawTypes === 'number'
        ? [rawTypes]
        : [];

    const delivery = typesArray.some((t: any) => String(t).toUpperCase() === 'DELIVERY');
    const pickup = typesArray.some((t: any) => {
      const u = String(t).toUpperCase();
      return u === 'PICKUP' || u === 'COLLECTION' || u === 'CURBSIDE' || u === 'TAKEAWAY' || u === 'EATIN' || u === 'EAT_IN';
    });
    const scheduling = typesArray.some((t: any) => String(t).toUpperCase() === 'SCHEDULING');

    return {
      delivery,
      pickup,
      scheduling,
      provenance: 'fulfillmentTypes',
    };
  }

  // Priority 2: Explicit `settings.<type>.enabled` (or `.active`)
  if (rawObj.settings && typeof rawObj.settings === 'object') {
    const s = rawObj.settings;
    const hasPickup = s.pickup !== undefined || s.collection !== undefined || s.curbside !== undefined || s.takeaway !== undefined || s.eatIn !== undefined || s.eat_in !== undefined;
    const hasDelivery = s.delivery !== undefined;
    const hasScheduling = s.scheduling !== undefined;

    if (hasPickup || hasDelivery || hasScheduling) {
      const checkSetting = (settingVal: any): boolean => {
        if (settingVal == null) return false;
        if (typeof settingVal === 'boolean') return settingVal;
        if (typeof settingVal === 'object') {
          if (settingVal.enabled !== undefined) return Boolean(settingVal.enabled);
          if (settingVal.active !== undefined) return Boolean(settingVal.active);
        }
        return false;
      };

      const delivery = checkSetting(s.delivery);
      const pickup = checkSetting(s.pickup) || checkSetting(s.collection) || checkSetting(s.curbside) || checkSetting(s.takeaway) || checkSetting(s.eatIn) || checkSetting(s.eat_in);
      const scheduling = checkSetting(s.scheduling);

      return {
        delivery,
        pickup,
        scheduling,
        provenance: 'settings',
      };
    }
  }

  // Priority 3: Legacy `fulfillmentCapabilities` (array or object) or top-level flags (`deliveryEnabled`/`pickupEnabled`/`schedulingEnabled`)
  if (rawObj.fulfillmentCapabilities !== undefined && rawObj.fulfillmentCapabilities !== null) {
    if (Array.isArray(rawObj.fulfillmentCapabilities)) {
      const caps = rawObj.fulfillmentCapabilities;
      const delivery = caps.some((c: any) => String(c).toUpperCase() === 'DELIVERY');
      const pickup = caps.some((c: any) => {
        const u = String(c).toUpperCase();
        return u === 'PICKUP' || u === 'COLLECTION' || u === 'CURBSIDE' || u === 'TAKEAWAY';
      });
      const scheduling = caps.some((c: any) => String(c).toUpperCase() === 'SCHEDULING');
      return {
        delivery,
        pickup,
        scheduling,
        provenance: 'fulfillmentCapabilities',
      };
    } else if (typeof rawObj.fulfillmentCapabilities === 'object') {
      const caps = rawObj.fulfillmentCapabilities;
      if (caps.delivery !== undefined || caps.pickup !== undefined || caps.collection !== undefined || caps.scheduling !== undefined) {
        return {
          delivery: Boolean(caps.delivery),
          pickup: Boolean(caps.pickup ?? caps.collection),
          scheduling: Boolean(caps.scheduling),
          provenance: 'fulfillmentCapabilities',
        };
      }
    }
  }

  if (rawObj.deliveryEnabled !== undefined || rawObj.pickupEnabled !== undefined || rawObj.schedulingEnabled !== undefined) {
    return {
      delivery: Boolean(rawObj.deliveryEnabled),
      pickup: Boolean(rawObj.pickupEnabled),
      scheduling: Boolean(rawObj.schedulingEnabled),
      provenance: 'fulfillmentCapabilities',
    };
  }

  // Priority 4: Missing / unknown capability data -> UNKNOWN/FALSE (never default to true)
  return undefined;
}

export interface CommerceStoresDiscoveryResult {
  success: boolean;
  stores: CommerceStore[];
  count: number;
  status: 'COMMERCE_VERIFIED' | 'ACCOUNT_MAPPED';
  persistenceStatus: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  persistenceError?: string;
  persistenceCode?: string;
  message?: string;
}

// In-memory cache for linked account mappings (with Firestore persistence when available)
const inMemoryMappings = new Map<string, {
  accounts: AccountLink[];
  locations: PhysicalLocation[];
  stores: CommerceStore[];
  syncedAt: string;
}>();

const mappingRefreshAt = new Map<string, number>();
const mappingRefreshes = new Map<string, Promise<void>>();

export class LinkedAccountsAdapter {
  private tokenManager: OAuthTokenManager;
  private environment: DeliverectEnvironmentName;

  constructor(options?: {
    environment?: DeliverectEnvironmentName;
    clientId?: string;
    clientSecret?: string;
    tokenManager?: OAuthTokenManager;
  }) {
    this.environment = options?.environment || (process.env.DELIVERECT_ENV as DeliverectEnvironmentName) || 'staging';
    this.tokenManager = options?.tokenManager || new OAuthTokenManager({
      environment: this.environment,
      clientId: options?.clientId,
      clientSecret: options?.clientSecret,
    });
  }

  /**
   * Normalizes raw Deliverect API payload into discrete domain models:
   * Tenant -> DeliverectIntegration -> AccountLink[] -> PhysicalLocation[] -> CommerceStore[]
   */
  normalizeDeliverectPayload(
    tenantId: string,
    integrationId: string,
    rawAccounts: RawDeliverectAccount[],
    rawLocations: RawDeliverectLocation[]
  ): {
    accounts: AccountLink[];
    locations: PhysicalLocation[];
    stores: CommerceStore[];
  } {
    const accounts: AccountLink[] = [];
    const locations: PhysicalLocation[] = [];
    const stores: CommerceStore[] = [];

    // 1. Process Account Links
    for (const rawAcc of rawAccounts) {
      const accountLinkId = `acclink_${rawAcc._id}`;
      accounts.push({
        accountLinkId,
        integrationId,
        deliverectAccountId: rawAcc._id,
        displayName: rawAcc.name || rawAcc.companyName || rawAcc._id,
        status: rawAcc.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
      });
    }

    // If no explicit accounts array provided but locations exist with accountId
    if (accounts.length === 0 && rawLocations.length > 0) {
      const accountIds = Array.from(new Set(rawLocations.map((l) => l.accountId).filter(Boolean)));
      for (const accId of accountIds) {
        accounts.push({
          accountLinkId: `acclink_${accId}`,
          integrationId,
          deliverectAccountId: accId as string,
          displayName: `Deliverect Account ${accId}`,
          status: 'ACTIVE',
        });
      }
    }

    const primaryAccountId = accounts[0]?.accountLinkId || '';

    // 2. Process Physical Locations & Child Commerce Stores
    for (const rawLoc of rawLocations) {
      const locId = rawLoc._id || (rawLoc as any).id || (rawLoc as any).deliverectLocationId;
      if (!locId || locId === 'undefined') continue;
      const locAccountId = rawLoc.accountId ? `acclink_${rawLoc.accountId}` : primaryAccountId;
      const physicalLocationId = String(locId).startsWith('loc_') ? String(locId) : `loc_${locId}`;

      // Extract coordinates (GeoJSON [lng, lat] or object) - NEVER fabricate coordinates if missing
      let coordinates: { latitude: number; longitude: number } | undefined = undefined;
      if (
        Array.isArray(rawLoc.coordinates) &&
        rawLoc.coordinates.length >= 2 &&
        typeof rawLoc.coordinates[0] === 'number' &&
        typeof rawLoc.coordinates[1] === 'number'
      ) {
        coordinates = {
          latitude: rawLoc.coordinates[1],
          longitude: rawLoc.coordinates[0],
        };
      } else if (rawLoc.coordinates && typeof rawLoc.coordinates === 'object') {
        const latVal = (rawLoc.coordinates as any).latitude ?? (rawLoc.coordinates as any).lat;
        const lngVal = (rawLoc.coordinates as any).longitude ?? (rawLoc.coordinates as any).lng;
        if (typeof latVal === 'number' && typeof lngVal === 'number') {
          coordinates = { latitude: latVal, longitude: lngVal };
        }
      }

      // Extract address - NEVER fabricate address lines if missing
      let addressProjection:
        | { street?: string; city?: string; postcode?: string; country?: string }
        | undefined = undefined;
      if (rawLoc.address && typeof rawLoc.address === 'object') {
        const street = rawLoc.address.street || rawLoc.address.source;
        const city = rawLoc.address.city;
        const postcode = rawLoc.address.postalCode || rawLoc.address.postcode;
        const country = rawLoc.address.country;
        if (street || city || postcode || country) {
          addressProjection = {
            street: street || undefined,
            city: city || undefined,
            postcode: postcode || undefined,
            country: country || undefined,
          };
        }
      }

      locations.push({
        physicalLocationId,
        accountLinkId: locAccountId,
        deliverectLocationId: rawLoc._id || (rawLoc as any).id || (rawLoc as any).deliverectLocationId,
        name: rawLoc.name || 'Deliverect Location',
        addressProjection,
        coordinates,
        ...{ phone: rawLoc.phone, email: rawLoc.email, contact: rawLoc.contact },
        statusProjection: rawLoc.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
      });

      // 3. Process Commerce Stores (channel links attached to this physical location)
      const channelLinks = rawLoc.channelLinks || [];
      if (channelLinks.length > 0) {
        for (const rawLink of channelLinks) {
          const cl = typeof rawLink === 'string' ? { channelLinkId: rawLink } : rawLink;
          const chLinkId = cl.channelLinkId || cl._id;
          if (!chLinkId) continue;
          const fulfillmentCapabilitiesProjection = normalizeFulfillmentCapabilities(cl) || normalizeFulfillmentCapabilities(rawLink);
          stores.push({
            commerceStoreId: `cstore_${chLinkId}`,
            accountLinkId: locAccountId,
            physicalLocationId,
            channelLinkId: chLinkId,
            name: cl.name || `${rawLoc.name} (${cl.channel || 'Online'})`,
            stateProjection: this.mapStoreState(cl.status !== undefined ? String(cl.status) : undefined),
            ...(fulfillmentCapabilitiesProjection ? { fulfillmentCapabilitiesProjection } : {}),
            lastSeenAt: new Date().toISOString(),
          });
        }
      }
      // Note: If no channel links are present on rawLoc, we DO NOT synthesize a fake store.
      // "Unknown stays unknown" - a physical location without channel links has no commerce store.
    }

    return { accounts, locations, stores };
  }

  /**
   * Static normalizer for hierarchical Deliverect account responses.
   * Preserves native Deliverect identifiers without fabricating acc_* or chl_* prefixes.
   */
  static normalizeAccounts(rawAccountsWithLocations: Array<any>): Array<{
    deliverectAccountId: string;
    displayName: string;
    status: string;
    locations: Array<{
      deliverectLocationId: string;
      name: string;
      status: string;
      address?: any;
      coordinates?: any;
      commerceStores: Array<{
        channelLinkId: string;
        name: string;
        status?: string;
        channel?: string;
        fulfillmentCapabilities?: any;
      }>;
    }>;
  }> {
    const results: Array<any> = [];
    for (const rawAcc of rawAccountsWithLocations) {
      const accId = rawAcc._id || rawAcc.id;
      const locations: Array<any> = [];

      if (Array.isArray(rawAcc.locations)) {
        for (const loc of rawAcc.locations) {
          const locId = loc._id || loc.id;
          const stores: Array<any> = [];

          if (Array.isArray(loc.channelLinks)) {
            for (const cl of loc.channelLinks) {
              const chId = cl.channelLinkId || cl._id || cl.id;
              if (chId) {
                stores.push({
                  channelLinkId: chId,
                  name: cl.name || 'Store',
                  status: cl.status,
                  channel: cl.channel,
                  fulfillmentCapabilities: cl.fulfillmentCapabilities,
                });
              }
            }
          }

          locations.push({
            deliverectLocationId: locId,
            name: loc.name,
            status: loc.status || 'ACTIVE',
            address: loc.address,
            coordinates: loc.coordinates,
            commerceStores: stores,
          });
        }
      }

      results.push({
        deliverectAccountId: accId,
        displayName: rawAcc.name || rawAcc.companyName || accId,
        status: rawAcc.status || 'ACTIVE',
        locations,
      });
    }
    return results;
  }

  /**
   * Convenience normalizer for hierarchical Deliverect account responses
   */
  normalizeDeliverectAccounts(
    tenantId: string,
    rawAccountsWithLocations: Array<any>
  ): {
    accountLinks: AccountLink[];
    physicalLocations: PhysicalLocation[];
    commerceStores: CommerceStore[];
  } {
    const rawAccounts: RawDeliverectAccount[] = [];
    const rawLocations: RawDeliverectLocation[] = [];

    for (const rawAcc of rawAccountsWithLocations) {
      rawAccounts.push({
        _id: rawAcc._id || rawAcc.id,
        name: rawAcc.name,
        companyName: rawAcc.companyName,
        status: rawAcc.status,
      });

      if (Array.isArray(rawAcc.locations)) {
        for (const loc of rawAcc.locations) {
          rawLocations.push({
            _id: loc._id || loc.id,
            accountId: rawAcc._id || rawAcc.id,
            name: loc.name,
            status: loc.status,
            address: loc.address,
            coordinates: loc.coordinates,
            channelLinks: loc.channelLinks?.map((cl: any) => ({
              _id: cl._id || cl.id,
              channelLinkId: cl.channelLinkId || cl._id || cl.id,
              name: cl.name,
              channel: cl.channel,
              status: cl.status,
              fulfillmentCapabilities: cl.fulfillmentCapabilities,
            })),
          });
        }
      }
    }

    const res = this.normalizeDeliverectPayload(tenantId, `int_${tenantId}`, rawAccounts, rawLocations);
    return {
      accountLinks: res.accounts,
      physicalLocations: res.locations,
      commerceStores: res.stores,
    };
  }

  private mapStoreState(rawStatus?: string): 'open' | 'closed' | 'busy' | 'paused' | 'UNKNOWN' {
    if (!rawStatus) return 'UNKNOWN';
    const s = String(rawStatus).toLowerCase();
    if (s.includes('busy')) return 'busy';
    if (s.includes('pause')) return 'paused';
    if (s.includes('offline') || s.includes('closed') || s.includes('inactive')) return 'closed';
    if (s.includes('online') || s.includes('open') || s.includes('active')) return 'open';
    return 'UNKNOWN';
  }

  /**
   * Fetches physical locations for a given Deliverect account.
   * Probes GET /commerce/{accountId}/locations with fallback to GET /locations?account={accountId}.
   */
  async fetchLocationsForAccount(accountId: string, token?: string, baseUrl?: string): Promise<RawDeliverectLocation[]> {
    const activeToken = token || (await this.tokenManager.getAccessToken());
    const activeBaseUrl = baseUrl || this.tokenManager.config.baseUrl;

    const locations: RawDeliverectLocation[] = [];
    let cursor = 'new';
    for (let page = 1; page <= 100; page++) {
      const params = new URLSearchParams({ where: JSON.stringify({ account: accountId }), max_results: '500', cursor, page: String(page) });
      const res = await circuitBreakers.commerce.execute(() => fetch(`${activeBaseUrl}/locations?${params}`, {
        headers: { Authorization: `Bearer ${activeToken}`, Accept: 'application/json' },
      }));
      if (!res.ok) throw new Error(`Deliverect locations request failed: HTTP ${res.status}`);
      const body = await res.json() as any;
      const items = Array.isArray(body) ? body : body?._items || body?.items || [];
      locations.push(...items.filter((item: any) => item._id || item.id).map((item: any) => ({
        _id: item._id || item.id,
        name: item.name || item.locationName || '',
        accountId: item.accountId || item.account || accountId,
        address: item.address,
        coordinates: item.coordinates || item.address?.coordinates || item.geo,
        phone: item.phone || item.phoneNumber || item.contact?.phone || item.contact?.phoneNumber,
        email: item.email || item.contact?.email,
        contact: item.contact || item.contactDetails,
        status: item.status,
        channelLinks: item.channelLinks || item.stores || [],
      })));
      if (items.length === 0 || locations.length >= (body?._meta?.total ?? Infinity) || items.length < 500) return locations;
      cursor = body?._meta?.cursor || cursor;
    }
    throw new Error('Deliverect locations pagination limit exceeded');
  }

  /**
   * Fetches upstream accounts and physical locations from Deliverect using OAuth client credentials.
   * Uses GET /accounts endpoint and retrieves physical locations per account.
   */
  async fetchFromUpstream(tenantId: string, integrationId: string): Promise<LinkedAccountsSyncResult> {
    if (!this.tokenManager.isConfigured) {
      if (isDemoMode()) {
        return this.getDemoMappings(tenantId, integrationId);
      }
      throw new BFFError(
        'INTEGRATION_NOT_CONFIGURED',
        `Cannot fetch linked accounts for tenant "${tenantId}". Deliverect credentials are not configured for ${this.environment}.`,
        503
      );
    }

    const token = await this.tokenManager.getAccessToken();
    const { baseUrl } = this.tokenManager.config;

    let rawAccounts: any[] = [];
    let accHttpStatus: number = 200;

    // Query /accounts from official Deliverect reference contract
    try {
      const accRes = await circuitBreakers.commerce.execute(() => fetch(`${baseUrl}/accounts`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      }));

      accHttpStatus = accRes.status;
      if (accRes.ok) {
        const body = (await accRes.json()) as any;
        rawAccounts = Array.isArray(body)
          ? body
          : (body?._items || body?.data || body?.accounts || (body?._id || body?.id ? [body] : []));
      } else {
        console.warn(`[LinkedAccountsAdapter] /accounts query returned ${accRes.status}: ${accRes.statusText}`);
      }
    } catch (err: any) {
      console.warn(`[LinkedAccountsAdapter] /accounts query failed:`, err.message);
      accHttpStatus = 500;
    }

    const accountsCount = rawAccounts.length;
    const accountsDiscovered = accountsCount > 0;

    // Structured logging:
    console.info(`[Linked Accounts] LINKED_ACCOUNTS_HTTP_STATUS: ${accHttpStatus}`);
    console.info(`[Linked Accounts] LINKED_ACCOUNTS_COUNT: ${accountsCount}`);
    console.info(`[Linked Accounts] LINKED_ACCOUNTS_DISCOVERED: ${accountsDiscovered}`);

    // If zero accounts were returned, do not report success or attempt Firestore persistence
    if (accountsCount === 0) {
      console.info(`[Linked Accounts] FIRESTORE_PERSISTED: false (no accounts discovered)`);
      const syncResult: LinkedAccountsSyncResult = {
        tenantId,
        accounts: [],
        locations: [],
        stores: [],
        syncedAt: new Date().toISOString(),
        status: 'NO_ACCOUNTS_FOUND',
        message: 'No linked accounts were returned by Deliverect',
        persistenceStatus: 'SKIPPED',
      };
      return syncResult;
    }

    // Retrieve physical locations for all discovered accounts
    const rawLocations: RawDeliverectLocation[] = [];
    for (const rawAcc of rawAccounts) {
      const accId = rawAcc._id || rawAcc.id;
      // In Deliverect Eve/REST API, rawAcc.locations is an array of location IDs (strings, e.g. ["68518..."])
      // or may be full location objects. Check if they are full objects with name and _id:
      const hasFullLocationObjects =
        Array.isArray(rawAcc.locations) &&
        rawAcc.locations.length > 0 &&
        typeof rawAcc.locations[0] === 'object' &&
        rawAcc.locations[0] !== null &&
        Boolean(rawAcc.locations[0]._id || rawAcc.locations[0].id) &&
        Boolean(rawAcc.locations[0].name);

      if (hasFullLocationObjects) {
        for (const loc of rawAcc.locations) {
          rawLocations.push({
            ...loc,
            _id: loc._id || loc.id,
            accountId: loc.accountId || accId,
          });
        }
      } else if (accId) {
        try {
          const locs = await this.fetchLocationsForAccount(accId, token, baseUrl);
          for (const l of locs) {
            rawLocations.push({
              ...l,
              accountId: l.accountId || accId,
            });
          }
        } catch (locErr: any) {
          console.warn(`[LinkedAccountsAdapter] Location fetch for account ${accId} warning:`, locErr.message);
        }
      }
    }

    console.info(`[Linked Accounts] PHYSICAL_LOCATIONS_COUNT: ${rawLocations.length}`);

    // Normalize discovered accounts & locations
    const normalized = this.normalizeDeliverectPayload(
      tenantId,
      integrationId,
      rawAccounts,
      rawLocations
    );

    const syncResult: LinkedAccountsSyncResult = {
      tenantId,
      accounts: normalized.accounts,
      locations: normalized.locations,
      stores: normalized.stores,
      syncedAt: new Date().toISOString(),
    };

    // Auto-discover stores for the first linked account if present
    if (normalized.accounts.length > 0) {
      try {
        const primaryAccountId = normalized.accounts[0].deliverectAccountId;
        const storesDiscovery = await this.getCommerceStores(primaryAccountId, tenantId);
        if (storesDiscovery.success && storesDiscovery.stores.length > 0) {
          syncResult.stores = storesDiscovery.stores;
          syncResult.locations = inMemoryMappings.get(tenantId)?.locations || syncResult.locations;
          console.info(`[Linked Accounts] Discovered ${storesDiscovery.stores.length} Commerce stores for account ${primaryAccountId}.`);
        }
      } catch (storeErr) {
        console.warn('[Linked Accounts] Auto-discovery of commerce stores during account fetch warning:', storeErr);
      }
    }

    inMemoryMappings.set(tenantId, syncResult);
    const persistResult = await this.persistToFirestore(tenantId, syncResult);
    const firestorePersisted = persistResult.success;
    console.info(`[Linked Accounts] FIRESTORE_PERSISTED: ${firestorePersisted}`);

    if (firestorePersisted) {
      syncResult.status = 'SUCCESS';
      syncResult.persistenceStatus = 'SUCCESS';
    } else {
      syncResult.status = 'DISCOVERY_SUCCEEDED_PERSISTENCE_FAILED';
      syncResult.persistenceStatus = 'FAILED';
      syncResult.persistenceCode = persistResult.code || 'DATABASE_PERMISSION_DENIED';
      syncResult.persistenceError = persistResult.error || 'Missing or insufficient permissions (PERMISSION_DENIED).';
    }

    const newStatus = 'ACCOUNT_MAPPED';

    try {
      const updateData: any = {
        status: newStatus as any,
        lastSyncAt: syncResult.syncedAt,
      };
      const firstAccId = syncResult.accounts[0]?.deliverectAccountId;
      if (firstAccId && firstAccId.trim() !== '') {
        updateData.deliverectAccountId = firstAccId;
      }

      await FirestorePlatformService.updateIntegrationConfig(tenantId, updateData);

      await FirestorePlatformService.addAuditLog(tenantId, {
        userId: 'admin',
        userName: 'Administrator',
        userRole: 'tenantAdmin',
        tenantId,
        category: 'Integration',
        action: 'SYNC_LINKED_ACCOUNTS',
        details: `Discovered and mapped ${syncResult.accounts.length} account(s). Status: ${newStatus}${!firestorePersisted ? ' (Firestore persistence failed: PERMISSION_DENIED)' : ''}`,
      });
    } catch (err: any) {
      const isPerm =
        err?.message?.includes('PERMISSION_DENIED') ||
        err?.code === 7 ||
        err?.message?.includes('Missing or insufficient permissions');
      if (isPerm) {
        markFirestorePermissionDenied(err);
      } else {
        console.warn(`[LinkedAccountsAdapter] Failed to update integration status in Firestore:`, err);
      }
    }

    return syncResult;
  }

  /**
   * Discovers Commerce Stores directly from the official Deliverect Commerce API contract:
   * GET /commerce/{accountId}/stores
   * Supports Deliverect Eve pagination and normalizes returned fields without fabricating synthetic IDs.
   */
  async getCommerceStores(accountId: string, tenantId: string): Promise<CommerceStoresDiscoveryResult> {
    if (!accountId || accountId.trim() === '') {
      throw new BFFError(
        'INVALID_INPUT',
        'A Deliverect Account ID is required to discover Commerce stores.',
        400
      );
    }

    if (!this.tokenManager.isConfigured) {
      if (isDemoMode()) {
        const demo = this.getDemoMappings(tenantId, `int_${tenantId}`);
        return {
          success: true,
          stores: demo.stores,
          count: demo.stores.length,
          status: 'COMMERCE_VERIFIED',
          persistenceStatus: 'SUCCESS',
        };
      }
      throw new BFFError(
        'INTEGRATION_NOT_CONFIGURED',
        `Cannot discover commerce stores for tenant "${tenantId}". Deliverect credentials are not configured for ${this.environment}.`,
        503
      );
    }

    const token = await this.tokenManager.getAccessToken();
    const { baseUrl } = this.tokenManager.config;

    let rawStoresList: any[] = [];
    let storesHttpStatus = 200;
    let page = 1;
    const size = 50;
    let hasMorePages = true;

    try {
      while (hasMorePages && page <= 50) {
        const url = `${baseUrl}/commerce/${encodeURIComponent(accountId)}/stores?page=${page}&size=${size}`;
        const res = await circuitBreakers.commerce.execute(() => fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        }));

        storesHttpStatus = res.status;
        if (!res.ok) {
          console.warn(`[LinkedAccountsAdapter] Commerce stores query returned ${res.status}: ${res.statusText}`);
          break;
        }

        const body = (await res.json()) as any;
        // Parse exact documented items property
        const pageItems: any[] = Array.isArray(body?.items)
          ? body.items
          : Array.isArray(body)
            ? body
            : [];

        rawStoresList.push(...pageItems);

        // Pagination using returned total, page, and size
        const total = typeof body?.total === 'number' ? body.total : undefined;
        const returnedPage = typeof body?.page === 'number' ? body.page : page;
        const returnedSize = typeof body?.size === 'number' ? body.size : size;

        if (pageItems.length === 0) {
          hasMorePages = false;
        } else if (total !== undefined && (rawStoresList.length >= total || returnedPage * returnedSize >= total)) {
          hasMorePages = false;
        } else if (total === undefined && pageItems.length < returnedSize) {
          hasMorePages = false;
        } else {
          page = returnedPage + 1;
        }
      }
    } catch (err: any) {
      console.warn(`[LinkedAccountsAdapter] Commerce stores query failed:`, err.message);
      storesHttpStatus = 500;
    }

    if (storesHttpStatus < 200 || storesHttpStatus >= 300) {
      throw new Error('Deliverect store discovery failed: HTTP ' + storesHttpStatus);
    }

    // Restore fresh GET /locations?where={"account":accountId} correlation
    let freshLocations: RawDeliverectLocation[] = [];
    try {
      freshLocations = await this.fetchLocationsForAccount(accountId, token, baseUrl);
    } catch (locErr: any) {
      console.warn(`[LinkedAccountsAdapter] Fresh physical locations fetch for account ${accountId} warning:`, locErr?.message || locErr);
    }

    const channelDetails = new Map<string, any>();
    const channelIds = Array.from(new Set(freshLocations.flatMap(loc =>
      (Array.isArray(loc.channelLinks) ? loc.channelLinks : []).map(link =>
        String(typeof link === 'string' ? link : (link.channelLinkId || link._id || ''))
      ).filter(Boolean)
    )));
    await Promise.all(channelIds.map(async channelLinkId => {
      try {
        const response = await circuitBreakers.commerce.execute(() => fetch(`${baseUrl}/channelLinks/${encodeURIComponent(channelLinkId)}`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        }));
        if (response.ok) {
          const detail = await response.json();
          channelDetails.set(channelLinkId, detail);
        } else {
          console.warn(`[LinkedAccountsAdapter] Channel link ${channelLinkId} returned HTTP ${response.status}`);
        }
      } catch (channelErr: any) {
        console.warn(`[LinkedAccountsAdapter] Channel link ${channelLinkId} fetch warning:`, channelErr?.message || channelErr);
      }
    }));

    const channelLocations = new Map<string, string>();
    const channelToLocationMap = new Map<string, RawDeliverectLocation>();

    for (const loc of freshLocations) {
      const locId = loc._id;
      const links = Array.isArray(loc.channelLinks) ? loc.channelLinks : [];
      for (const link of links) {
        const chId = typeof link === 'string' ? link : (link?.channelLinkId || link?._id || (link as any)?.id);
        if (chId) {
          channelLocations.set(String(chId), locId);
          channelToLocationMap.set(String(chId), loc);
        }
      }
    }

    // Fallback correlation from cachedStores if present and not already mapped
    const cachedStores = inMemoryMappings.get(tenantId)?.stores || [];
    for (const store of cachedStores) {
      if (
        store.channelLinkId &&
        store.physicalLocationId &&
        store.physicalLocationId !== 'loc_undefined' &&
        !channelLocations.has(store.channelLinkId)
      ) {
        channelLocations.set(store.channelLinkId, store.physicalLocationId);
      }
    }

    // Normalize stores using only returned fields - do not invent missing values
    const stores: CommerceStore[] = [];
    for (const rawStore of rawStoresList) {
      const rawId = rawStore._id || rawStore.id || rawStore.channelLinkId || rawStore.storeId;
      const channelLinkId = rawStore.channelLinkId || rawStore.channelLink || rawStore.id || rawStore._id;
      if (!channelLinkId && !rawId) continue;

      const storeIdentifier = channelLinkId || rawId;
      const correlatedLoc =
        channelToLocationMap.get(storeIdentifier) ||
        (channelLinkId ? channelToLocationMap.get(channelLinkId) : undefined) ||
        (rawId ? channelToLocationMap.get(rawId) : undefined);

      // Missing values remain absent rather than defaulting to "Store", "open", or fabricated capabilities
      const name = rawStore.name || rawStore.storeName || (correlatedLoc ? correlatedLoc.name : '') || '';
      const stateProjection = this.mapStoreState(rawStore.state || rawStore.status);

      // Correlate using returned channelLinks string IDs, without guessing physical IDs
      const rawPhysicalId =
        channelLocations.get(storeIdentifier) ||
        (channelLinkId ? channelLocations.get(channelLinkId) : undefined) ||
        (rawId ? channelLocations.get(rawId) : undefined) ||
        rawStore.locationId ||
        rawStore.physicalLocationId ||
        rawStore.location?._id ||
        rawStore.location?.id ||
        (correlatedLoc ? correlatedLoc._id : null);
      const physicalLocationId =
        rawPhysicalId && rawPhysicalId !== 'loc_undefined' && rawPhysicalId !== 'undefined'
          ? (String(rawPhysicalId).startsWith('loc_') ? String(rawPhysicalId) : `loc_${rawPhysicalId}`)
          : null;

      // Commerce Store capabilities are exposed by Deliverect primarily via
      // `fulfillmentTypes` and/or `settings.<fulfillmentType>.enabled`.
      // Reuse the shared normalizer so the live Commerce store path handles the
      // same documented shapes as the linked-account/channel-link path. The
      // previous hand-written branch only checked legacy `fulfillmentCapabilities`
      // / `pickupEnabled`, causing real pickup-capable stores to become
      // supportsPickup=false in the storefront.
      const channelDetail =
        channelDetails.get(String(storeIdentifier)) ||
        (channelLinkId ? channelDetails.get(String(channelLinkId)) : undefined) ||
        (rawId ? channelDetails.get(String(rawId)) : undefined);
      const correlatedChannelLink =
        Array.isArray(correlatedLoc?.channelLinks)
          ? correlatedLoc.channelLinks.find((link: any) => {
              const id = String(
                typeof link === 'string'
                  ? link
                  : link?.channelLinkId || link?._id || link?.id || ''
              );
              return (
                id === String(storeIdentifier) ||
                id === String(channelLinkId || '') ||
                id === String(rawId || '')
              );
            })
          : undefined;

      const fulfillmentCapabilitiesProjection =
        normalizeFulfillmentCapabilities(rawStore) ||
        normalizeFulfillmentCapabilities(channelDetail) ||
        normalizeFulfillmentCapabilities(correlatedChannelLink);

      // Address: preserve returned fields; fall back to correlated physical location address; absent if not provided
      let address: { street?: string; city?: string; postcode?: string; country?: string } | undefined = undefined;
      const rawAddress = rawStore.address || rawStore.location?.address || correlatedLoc?.address;
      if (rawAddress && typeof rawAddress === 'object') {
        const street = rawAddress.street || rawAddress.source || undefined;
        const city = rawAddress.city || undefined;
        const postcode = rawAddress.postcode || rawAddress.postalCode || undefined;
        const country = rawAddress.country || undefined;
        if (street || city || postcode || country) {
          address = {
            ...(street ? { street } : {}),
            ...(city ? { city } : {}),
            ...(postcode ? { postcode } : {}),
            ...(country ? { country } : {}),
          };
        }
      }

      // Coordinates: map from returned data or correlated physical location - NEVER fabricate or default to London
      let coordinates: { latitude: number; longitude: number } | undefined = undefined;
      const rawCoords = rawStore.coordinates || rawAddress?.coordinates || rawStore.location?.coordinates || rawStore.geo || correlatedLoc?.coordinates;
      if (Array.isArray(rawCoords) && rawCoords.length >= 2 && rawCoords.every(Number.isFinite)) {
        coordinates = { latitude: rawCoords[1], longitude: rawCoords[0] };
      } else if (rawCoords && typeof rawCoords === 'object') {
        const lat = rawCoords.latitude ?? rawCoords.lat;
        const lng = rawCoords.longitude ?? rawCoords.lng ?? rawCoords.lon;
        if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
          coordinates = { latitude: lat, longitude: lng };
        }
      } else if (typeof rawStore.latitude === 'number' && typeof rawStore.longitude === 'number') {
        coordinates = { latitude: rawStore.latitude, longitude: rawStore.longitude };
      }

      // Delivery radius and ETA
      const deliveryRadiusKm =
        typeof rawStore.deliveryRadiusKm === 'number'
          ? rawStore.deliveryRadiusKm
          : typeof rawStore.deliveryRadius === 'number'
            ? rawStore.deliveryRadius
            : undefined;
      const deliveryEta = rawStore.deliveryEta || rawStore.eta || undefined;
      const openingHours = rawStore.openingHours || rawStore.hours || rawStore.schedule || undefined;
      const channelLocationId = rawStore.channelLocationId || rawStore.locationId || rawStore.location?._id || rawStore.location?.id || undefined;

      const storeRecord: CommerceStore = {
        commerceStoreId: `cstore_${storeIdentifier}`,
        accountLinkId: `acclink_${accountId}`,
        physicalLocationId: physicalLocationId ? (String(physicalLocationId).startsWith('loc_') ? String(physicalLocationId) : `loc_${physicalLocationId}`) : null,
        channelLocationId: channelLocationId ? String(channelLocationId) : undefined,
        channelLinkId: storeIdentifier,
        name,
        stateProjection,
        ...(fulfillmentCapabilitiesProjection ? { fulfillmentCapabilitiesProjection } : {}),
        ...(coordinates ? { coordinates } : {}),
        ...(address ? { address } : {}),
        ...(deliveryRadiusKm !== undefined ? { deliveryRadiusKm } : {}),
        ...(deliveryEta ? { deliveryEta } : {}),
        ...(openingHours ? { openingHours } : {}),
        ...(correlatedLoc?.posSettings?.dma?.locationId || correlatedLoc?.posLocationId ? { brandStoreId: String(correlatedLoc?.posSettings?.dma?.locationId || correlatedLoc?.posLocationId) } : {}),
        ...(correlatedLoc?.address?.phoneNumber || correlatedLoc?.contact?.phoneNumber ? { phone: correlatedLoc?.address?.phoneNumber || correlatedLoc?.contact?.phoneNumber } : {}),
        ...(correlatedLoc?.contact?.email ? { email: correlatedLoc.contact.email } : {}),
        ...(correlatedLoc?.timezone ? { timezone: correlatedLoc.timezone } : {}),
        services: (Array.isArray(correlatedLoc?.channelLinks) ? correlatedLoc.channelLinks : []).map((link: any) => {
          const id = String(typeof link === 'string' ? link : (link.channelLinkId || link._id || ''));
          const detail = channelDetails.get(id) || (typeof link === 'object' ? link : {});
          const candidateUrl = detail.menuUrl || detail.channelSettings?.storeUrl;
          const url = typeof candidateUrl === 'string' && /^https?:\/\//i.test(candidateUrl) ? candidateUrl : undefined;
          return { id, name: String(detail.name || detail.application || detail.channel || 'Ordering channel'), channel: detail.channel, ...(url ? { url } : {}), source: 'DELIVERECT' as const };
        }).filter((service: any) => service.id),
        ...(rawStore.currency ? { currency: rawStore.currency } : {}),
        ...(rawStore.status ? { status: rawStore.status } : {}),
        lastSeenAt: new Date().toISOString(),
      };

      stores.push(storeRecord);
    }

    const storesDiscovered = stores.length > 0;
    console.info(`[Commerce Stores] COMMERCE_STORES_HTTP_STATUS: ${storesHttpStatus}`);
    console.info(`[Commerce Stores] COMMERCE_STORES_RAW_ITEMS_COUNT: ${rawStoresList.length}`);
    console.info(`[Commerce Stores] COMMERCE_STORES_COUNT: ${stores.length}`);
    console.info(`[Commerce Stores] COMMERCE_STORES_DISCOVERED: ${storesDiscovered}`);

    // Update in-memory mappings so that getTenantMappings reflects the discovered stores and locations
    const existing = inMemoryMappings.get(tenantId) || {
      tenantId,
      accounts: [],
      locations: [],
      stores: [],
      syncedAt: new Date().toISOString(),
    };
    if (freshLocations.length > 0) {
      const normalizedFreshLocs: PhysicalLocation[] = freshLocations.map(rawLoc => {
        let coords: { latitude: number; longitude: number } | undefined = undefined;
        if (Array.isArray(rawLoc.coordinates) && rawLoc.coordinates.length >= 2) {
          coords = { latitude: rawLoc.coordinates[1], longitude: rawLoc.coordinates[0] };
        } else if (rawLoc.coordinates && typeof rawLoc.coordinates === 'object') {
          const lat = (rawLoc.coordinates as any).latitude ?? (rawLoc.coordinates as any).lat;
          const lng = (rawLoc.coordinates as any).longitude ?? (rawLoc.coordinates as any).lng;
          if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
            coords = { latitude: lat, longitude: lng };
          }
        }
        let addrProj: { street?: string; city?: string; postcode?: string; country?: string } | undefined = undefined;
        if (rawLoc.address && typeof rawLoc.address === 'object') {
          const street = rawLoc.address.street || rawLoc.address.source;
          const city = rawLoc.address.city;
          const postcode = rawLoc.address.postalCode || rawLoc.address.postcode;
          const country = rawLoc.address.country;
          if (street || city || postcode || country) {
            addrProj = {
              ...(street ? { street } : {}),
              ...(city ? { city } : {}),
              ...(postcode ? { postcode } : {}),
              ...(country ? { country } : {}),
            };
          }
        }
        const locId = rawLoc._id || (rawLoc as any).id || (rawLoc as any).deliverectLocationId;
        const physicalLocationId =
          locId && locId !== 'undefined'
            ? (String(locId).startsWith('loc_') ? String(locId) : `loc_${locId}`)
            : `loc_${accountId}_${Math.random().toString(36).substring(2, 7)}`;
        return {
          physicalLocationId,
          accountLinkId: `acclink_${accountId}`,
          deliverectLocationId: rawLoc._id || (rawLoc as any).id || (rawLoc as any).deliverectLocationId,
          name: rawLoc.name || 'Deliverect Location',
          addressProjection: addrProj,
          coordinates: coords,
          statusProjection: (rawLoc.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE') as any,
          brandStoreId: rawLoc.posSettings?.dma?.locationId || rawLoc.posLocationId || undefined,
          phone: rawLoc.address?.phoneNumber || rawLoc.contact?.phoneNumber || undefined,
          email: rawLoc.contact?.email || undefined,
          timezone: rawLoc.timezone || undefined,
          openingHours: Array.isArray(rawLoc.openingHours) ? rawLoc.openingHours : undefined,
          services: (Array.isArray(rawLoc.channelLinks) ? rawLoc.channelLinks : []).map((link: any) => {
            const id = String(typeof link === 'string' ? link : (link.channelLinkId || link._id || ''));
            const detail = channelDetails.get(id) || (typeof link === 'object' ? link : {});
            const candidateUrl = detail.menuUrl || detail.channelSettings?.storeUrl;
            const url = typeof candidateUrl === 'string' && /^https?:\/\//i.test(candidateUrl) ? candidateUrl : undefined;
            return { id, name: String(detail.name || detail.application || detail.channel || 'Ordering channel'), channel: detail.channel, ...(url ? { url } : {}), source: 'DELIVERECT' as const };
          }).filter((service: any) => service.id),
        };
      });
      existing.locations = [
        ...existing.locations.filter(loc => loc.accountLinkId !== 'acclink_' + accountId && loc.physicalLocationId !== 'loc_undefined'),
        ...normalizedFreshLocs,
      ];
    }
    existing.stores = [...existing.stores.filter(store => store.accountLinkId !== 'acclink_' + accountId), ...stores];
    inMemoryMappings.set(tenantId, existing);

    // Keep local disk snapshot synchronized
    try {
      const filePath = getLocalMappingPath(tenantId);
      fs.writeFileSync(filePath, JSON.stringify(existing, null, 2), 'utf8');
    } catch {}

    // Persist discovered stores to Firestore: unified path tenants/{tenantId}/commerceStores/{channelLinkId}
    let firestorePersisted = false;
    let persistenceError: string | undefined = undefined;
    let persistenceCode: string | undefined = undefined;

    if (stores.length > 0) {
      try {
        const db = getFirestoreDb();
        if (db) {
          const batch = db.batch();
          const tenantRef = db.collection('tenants').doc(tenantId);
          for (const st of stores) {
            batch.set(tenantRef.collection('commerceStores').doc(st.channelLinkId), cleanUndefined(st), { merge: true });
          }
          await batch.commit();
          firestorePersisted = true;
        } else {
          persistenceCode = 'DATABASE_PERMISSION_DENIED';
          persistenceError = 'Firestore database is not initialized.';
        }
      } catch (err: any) {
        const isPerm =
          err?.message?.includes('PERMISSION_DENIED') ||
          err?.code === 7 ||
          err?.message?.includes('Missing or insufficient permissions');
        if (isPerm) {
          markFirestorePermissionDenied(err);
          persistenceCode = 'DATABASE_PERMISSION_DENIED';
          persistenceError = 'Missing or insufficient permissions (PERMISSION_DENIED). Cloud Run service account requires roles/datastore.user.';
        } else {
          persistenceCode = 'DATABASE_ERROR';
          persistenceError = err.message;
        }
      }
    }
    console.info(`[Commerce Stores] FIRESTORE_PERSISTED: ${firestorePersisted}`);

    return {
      success: true,
      stores,
      count: stores.length,
      status: storesDiscovered ? 'COMMERCE_VERIFIED' : 'ACCOUNT_MAPPED',
      persistenceStatus: stores.length === 0 ? 'SKIPPED' : firestorePersisted ? 'SUCCESS' : 'FAILED',
      persistenceError,
      persistenceCode,
      message: storesDiscovered ? undefined : 'No commerce stores were returned by Deliverect for this account.',
    };
  }

  /**
   * Retrieves mapped accounts and stores for a tenant.
   */
  async getTenantMappings(tenantId: string, integrationId: string = `int_${tenantId}`): Promise<LinkedAccountsSyncResult> {
    let cached = inMemoryMappings.get(tenantId);
    if (!cached) {
      const fromDb = await this.loadFromFirestore(tenantId);
      if (fromDb && (fromDb.accounts.length || fromDb.stores.length)) {
        cached = fromDb;
        inMemoryMappings.set(tenantId, cached);
      }
    }
    if (cached) {
      if (!isDemoMode() && this.tokenManager.isConfigured && cached.accounts.length && Date.now() - (mappingRefreshAt.get(tenantId) || 0) > 60000) {
        let refresh = mappingRefreshes.get(tenantId);
        if (!refresh) {
          const accounts = cached.accounts;
          refresh = (async () => {
            try {
              for (const account of accounts) await this.getCommerceStores(account.deliverectAccountId, tenantId);
              const updated = inMemoryMappings.get(tenantId);
              if (updated) {
                updated.syncedAt = new Date().toISOString();
                await this.persistToFirestore(tenantId, { tenantId, ...updated });
              }
            } catch (error) {
              console.warn('[LinkedAccountsAdapter] Live mapping refresh failed; retaining last known mapping:', error instanceof Error ? error.message : 'Unknown error');
            } finally {
              mappingRefreshAt.set(tenantId, Date.now());
              mappingRefreshes.delete(tenantId);
            }
          })();
          mappingRefreshes.set(tenantId, refresh);
        }
        await refresh;
      }
      return { tenantId, ...(inMemoryMappings.get(tenantId) || cached) };
    }

    // If in demo mode, return standard demo mapped objects
    if (isDemoMode()) {
      const demo = this.getDemoMappings(tenantId, integrationId);
      inMemoryMappings.set(tenantId, demo);
      return demo;
    }

    // If configured in non-demo mode, fetch live
    if (this.tokenManager.isConfigured) {
      return this.fetchFromUpstream(tenantId, integrationId);
    }

    throw new BFFError(
      'INTEGRATION_NOT_CONFIGURED',
      `Deliverect integration for tenant "${tenantId}" is unconfigured.`,
      503
    );
  }

  /**
   * Deterministic Demo Mappings
   */
  private getDemoMappings(tenantId: string, integrationId: string): LinkedAccountsSyncResult {
    const accountLinkId = `acclink_${tenantId}_demo`;
    const accounts: AccountLink[] = [
      {
        accountLinkId,
        integrationId,
        deliverectAccountId: `acc_${tenantId}`,
        displayName: `${tenantId.toUpperCase()} Flagship Retail`,
        status: 'ACTIVE',
      },
    ];

    const locations: PhysicalLocation[] = [
      {
        physicalLocationId: `loc_${tenantId}_central`,
        accountLinkId,
        deliverectLocationId: `dloc_${tenantId}_01`,
        name: 'Covent Garden Flagship',
        addressProjection: {
          street: '14 Floral Street',
          city: 'London',
          postcode: 'WC2E 9DH',
          country: 'GB',
        },
        coordinates: {
          latitude: 51.5126,
          longitude: -0.1248,
        },
        statusProjection: 'ACTIVE',
      },
      {
        physicalLocationId: `loc_${tenantId}_chelsea`,
        accountLinkId,
        deliverectLocationId: `dloc_${tenantId}_02`,
        name: 'Chelsea Kings Road',
        addressProjection: {
          street: '88 King\'s Road',
          city: 'London',
          postcode: 'SW3 4TZ',
          country: 'GB',
        },
        coordinates: {
          latitude: 51.4908,
          longitude: -0.1601,
        },
        statusProjection: 'ACTIVE',
      },
    ];

    const stores: CommerceStore[] = [
      {
        commerceStoreId: `cstore_${tenantId}_covent_delivery`,
        accountLinkId,
        physicalLocationId: `loc_${tenantId}_central`,
        channelLinkId: `chl_${tenantId}_covent_del`,
        name: 'Covent Garden (Express Delivery)',
        stateProjection: 'open',
        fulfillmentCapabilitiesProjection: {
          delivery: true,
          pickup: false,
          scheduling: true,
        },
        lastSeenAt: new Date().toISOString(),
      },
      {
        commerceStoreId: `cstore_${tenantId}_covent_pickup`,
        accountLinkId,
        physicalLocationId: `loc_${tenantId}_central`,
        channelLinkId: `chl_${tenantId}_covent_col`,
        name: 'Covent Garden (Click & Collect)',
        stateProjection: 'open',
        fulfillmentCapabilitiesProjection: {
          delivery: false,
          pickup: true,
          scheduling: true,
        },
        lastSeenAt: new Date().toISOString(),
      },
      {
        commerceStoreId: `cstore_${tenantId}_chelsea_all`,
        accountLinkId,
        physicalLocationId: `loc_${tenantId}_chelsea`,
        channelLinkId: `chl_${tenantId}_chelsea_all`,
        name: 'Chelsea Kings Road (All Services)',
        stateProjection: 'open',
        fulfillmentCapabilitiesProjection: {
          delivery: true,
          pickup: true,
          scheduling: true,
        },
        lastSeenAt: new Date().toISOString(),
      },
    ];

    return {
      tenantId,
      accounts,
      locations,
      stores,
      syncedAt: new Date().toISOString(),
    };
  }

  private async persistToFirestore(
    tenantId: string,
    result: LinkedAccountsSyncResult
  ): Promise<{ success: boolean; code?: string; error?: string }> {
    // Always write to local disk snapshot for offline/dev resilience
    try {
      const filePath = getLocalMappingPath(tenantId);
      fs.writeFileSync(filePath, JSON.stringify(result, null, 2), 'utf8');
    } catch {}

    const db = getFirestoreDb();
    if (!db) {
      return {
        success: false,
        code: 'DATABASE_PERMISSION_DENIED',
        error: 'Firestore database is not initialized or IAM permissions are missing.',
      };
    }

    try {
      const batch = db.batch();
      const tenantRef = db.collection('tenants').doc(tenantId);

      // Save Account Links
      for (const acc of result.accounts) {
        batch.set(tenantRef.collection('accountLinks').doc(acc.accountLinkId), cleanUndefined(acc), { merge: true });
      }

      // Save Physical Locations
      for (const loc of result.locations) {
        batch.set(tenantRef.collection('physicalLocations').doc(loc.physicalLocationId), cleanUndefined(loc), { merge: true });
      }

      // Save Commerce Stores
      for (const store of result.stores) {
        batch.set(tenantRef.collection('commerceStores').doc(store.channelLinkId), cleanUndefined(store), { merge: true });
      }

      await batch.commit();
      
      // Update local disk snapshot
      try {
        const filePath = getLocalMappingPath(tenantId);
        fs.writeFileSync(filePath, JSON.stringify(result, null, 2), 'utf8');
      } catch {}

      return { success: true };
    } catch (err: any) {
      // Even if Firestore fails (e.g. PERMISSION_DENIED), write to local disk snapshot
      try {
        const filePath = getLocalMappingPath(tenantId);
        fs.writeFileSync(filePath, JSON.stringify(result, null, 2), 'utf8');
      } catch {}

      const isPerm =
        err?.message?.includes('PERMISSION_DENIED') ||
        err?.code === 7 ||
        err?.message?.includes('Missing or insufficient permissions');

      if (isPerm) {
        markFirestorePermissionDenied(err);
        return {
          success: false,
          code: 'DATABASE_PERMISSION_DENIED',
          error: 'Missing or insufficient permissions (PERMISSION_DENIED). Cloud Run service account requires roles/datastore.user.',
        };
      }

      console.warn(`[LinkedAccountsAdapter] Firestore persistence warning:`, err);
      return {
        success: false,
        code: 'DATABASE_ERROR',
        error: err?.message || String(err),
      };
    }
  }

  private async loadFromFirestore(tenantId: string): Promise<LinkedAccountsSyncResult | null> {
    if (!isFirestorePermissionDenied()) {
      const db = getFirestoreDb();
      if (db) {
        try {
          const tenantRef = db.collection('tenants').doc(tenantId);
          const [accSnap, locSnap, storeSnap] = await Promise.all([
            tenantRef.collection('accountLinks').get(),
            tenantRef.collection('physicalLocations').get(),
            tenantRef.collection('commerceStores').get(),
          ]);

          if (!accSnap.empty || !locSnap.empty || !storeSnap.empty) {
            const accounts: AccountLink[] = [];
            const locations: PhysicalLocation[] = [];
            const stores: CommerceStore[] = [];

            accSnap.forEach((d) => accounts.push(d.data() as AccountLink));
            locSnap.forEach((d) => locations.push(d.data() as PhysicalLocation));
            storeSnap.forEach((d) => stores.push(d.data() as CommerceStore));

            const res: LinkedAccountsSyncResult = {
              tenantId,
              accounts,
              locations,
              stores,
              syncedAt: new Date().toISOString(),
            };

            // Keep disk snapshot fresh
            try {
              const filePath = getLocalMappingPath(tenantId);
              fs.writeFileSync(filePath, JSON.stringify(res, null, 2), 'utf8');
            } catch {}

            return res;
          }
        } catch (err: any) {
          const isPerm =
            err?.code === 7 ||
            err?.code === 'PERMISSION_DENIED' ||
            err?.message?.includes('PERMISSION_DENIED') ||
            err?.message?.includes('Missing or insufficient permissions');

          if (isPerm) {
            markFirestorePermissionDenied(err);
            console.info(`[LinkedAccountsAdapter] Firestore IAM permission unavailable for ${tenantId}, checking disk cache.`);
          } else {
            console.warn(`[LinkedAccountsAdapter] Firestore read failed, checking disk cache:`, err?.message || err);
          }
        }
      }
    }

    // Disk cache fallback
    try {
      const filePath = getLocalMappingPath(tenantId);
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf8');
        if (raw && raw.trim().length > 0) {
          const parsed = JSON.parse(raw) as LinkedAccountsSyncResult;
          if (parsed && Array.isArray(parsed.accounts) && (parsed.accounts.length > 0 || parsed.stores?.length > 0)) {
            // Sanitize any legacy corrupted entries from older builds
            if (Array.isArray(parsed.locations)) {
              parsed.locations = parsed.locations.filter(
                loc => loc && loc.physicalLocationId && loc.physicalLocationId !== 'loc_undefined'
              );
            }
            if (Array.isArray(parsed.stores)) {
              parsed.stores = parsed.stores.map(st => ({
                ...st,
                physicalLocationId: st.physicalLocationId === 'loc_undefined' ? null : st.physicalLocationId,
              }));
            }
            console.info(`[LinkedAccountsAdapter] Restored ${parsed.accounts.length} accounts and ${parsed.stores?.length || 0} stores from local disk snapshot for ${tenantId}.`);
            return parsed;
          }
        }
      }
    } catch (diskErr) {
      console.warn(`[LinkedAccountsAdapter] Warning reading local disk snapshot:`, diskErr);
    }

    return null;
  }
}

export const linkedAccountsAdapter = new LinkedAccountsAdapter();
