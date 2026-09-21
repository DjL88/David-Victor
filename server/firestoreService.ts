import fs from 'fs';
import path from 'path';
import { getFirestoreDb, markFirestorePermissionDenied, isFirestorePermissionDenied, isFirestorePermissionDeniedError } from './firebase';
import { FirestoreRestService } from './firestoreRest';
import { TenantConfig, Story, Order, AuditLogEntry, TenantFeePolicy, CategoryPromoBanner, TenantSchedulingPolicy, DEFAULT_TENANT_SCHEDULING_POLICY, Money, SubstitutionPreferenceType } from '../src/commerce/models';
import { MOCK_TENANTS, MOCK_STORIES, MOCK_FEE_POLICIES, MOCK_AUDIT_LOGS } from '../src/commerce/mockData';
import { DEFAULT_PROMO_BANNERS } from '../src/commerce/promoBannerData';
import { isDemoMode, getServerRuntimeMode, assertNoMockPermitted, isTestMode } from './runtimeMode';
import { BFFError } from './errors';
import { DeliverectOrderMapper } from './deliverect/DeliverectOrderMapper';
import type { ProtectedBundleAllocation } from '../src/commerce/bundleAllocation';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
}

// Local in-memory store for audit logs when running offline or in unit tests
const inMemoryAuditLogs: Record<string, AuditLogEntry[]> = {};
const inMemoryAnalyticsEvents: Record<string, AnalyticsEvent[]> = {};
const inMemoryNotificationSubscriptions: Record<string, NotificationSubscription> = {};
const inMemoryNotifications: Record<string, DomainNotification> = {};
const inMemoryStories: Record<string, Story[]> = {};
const inMemoryStoriesPurged: Record<string, boolean> = {};
const inMemoryHeroBanners: Record<string, CategoryPromoBanner[]> = {};
const inMemoryHeroBannersPurged: Record<string, boolean> = {};

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): FirestoreErrorInfo {
  const errMsg = error instanceof Error ? error.message : String(error);
  const isPerm =
    errMsg.includes('PERMISSION_DENIED') ||
    (error as any)?.code === 7 ||
    errMsg.includes('Missing or insufficient permissions');

  if (isPerm) {
    markFirestorePermissionDenied(error);
  }

  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    operationType,
    path,
  };
  if (!isPerm) {
    console.error('[Firestore Admin Error]:', JSON.stringify(errInfo));
  }
  return errInfo;
}

export interface IntegrationConfig {
  tenantId: string;
  deliverectAccountId?: string;
  channelLinkId?: string;
  /** Explicit tenant storefront allowlist; absent means all stores in the assigned account. */
  allowedChannelLinkIds?: string[];
  /** Deliverect Channel API scope/name for Retail order creation. */
  channelName?: string;
  /** Which Deliverect endpoint creates the live order. */
  orderRoute?: 'retail_quest' | 'commerce_checkout';
  environment: 'staging' | 'production';
  status: 'connected' | 'standalone' | 'error' | 'UNCONFIGURED' | 'OAUTH_VERIFIED' | 'ACCOUNT_MAPPED' | 'COMMERCE_VERIFIED' | 'CONNECTED';
  connectionState?: 'CONNECTED' | 'DISCONNECTED' | 'DEGRADED' | 'CHECKING';
  bffProxyUrl?: string;
  lastSyncAt?: string;
  updatedAt?: string;
}

import { CheckoutResult, CheckoutStatus, WebhookEvent, DomainPaymentProjection, SettlementResult, DomainNotification, NotificationSubscription } from '../src/domain/models';
import { AnalyticsEvent } from '../src/analytics/analyticsModels';
import { PickingState, PickingItem, DispatchStateRecord } from '../src/commerce/postCheckoutModels';
import { TenantDispatchRules, DEFAULT_DISPATCH_RULES } from '../src/rules/types';

// GDPR-safe, de-identified read projection for order tracking
export interface CustomerSavedAddress {
  id: string;
  label: string;
  line1: string;
  line2?: string;
  city: string;
  postalCode: string;
  country: string;
  isDefault?: boolean;
}

export interface CustomerAccountProfile {
  tenantId: string;
  customerUid: string;
  displayName?: string;
  email?: string;
  phone?: string;
  locale?: string;
  addresses: CustomerSavedAddress[];
  notifications: {
    orderUpdates: boolean;
    deliveryUpdates: boolean;
    marketing: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface OrderProjection {
  orderId: string;
  tenantId: string;
  channelLinkId?: string;
  customerUid?: string;
  orderAccessTokenHash?: string;
  status: string;
  itemsCount?: number;
  total?: number;
  currency?: string;
  fulfillmentType?: string;
  destinationArea?: string; // Masked postcode area (e.g., 'CM1' or 'SW1'), NO private street address
  estimatedDeliveryTime?: string;
  checkoutId?: string;
  basketId?: string;
  channelOrderId?: string;
  channelOrderDisplayId?: string;
  channelOrderRawId?: string;
  deliverectAccountId?: string;
  deliverectLocationId?: string;
  orderReference?: string;
  channelOrderReference?: string;
  picking?: PickingState;
  dispatch?: DispatchStateRecord;
  paymentState?: string;
  paymentId?: string;
  authorizedMaximum?: number;
  finalAmount?: number;
  capturedAmount?: number;
  residualHoldReleased?: number;
  settlementDetails?: SettlementResult;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface BasketItemSubstitutionPreferenceRecord {
  preference: SubstitutionPreferenceType;
  substituteCandidatePlus?: string[];
  preferredSubstitutePlu?: string;
  preferredSubstituteName?: string;
  preferredSubstitutePrice?: Money;
  updatedAt: string;
}

interface BasketSubstitutionPreferencesDocument {
  tenantId: string;
  basketId: string;
  items: Record<string, BasketItemSubstitutionPreferenceRecord>;
  updatedAt: string;
}

export interface BasketBundleAllocationRecord extends ProtectedBundleAllocation {
  bundleInstanceId: string;
  createdAt: string;
}

interface BasketBundleAllocationsDocument {
  tenantId: string;
  basketId: string;
  instances: BasketBundleAllocationRecord[];
  updatedAt: string;
}

export function cleanUndefined<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(cleanUndefined).filter((v) => v !== undefined) as unknown as T;
  }
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj as Record<string, any>)) {
    if (value !== undefined) {
      cleaned[key] = typeof value === 'object' && value !== null ? cleanUndefined(value) : value;
    }
  }
  return cleaned as T;
}

const DOMAINS_STORAGE_PATH = path.join(process.cwd(), 'data', 'domains.json');
const TENANTS_STORAGE_PATH = path.join(process.cwd(), 'data', 'tenants.json');
const INTEGRATIONS_STORAGE_PATH = path.join(process.cwd(), 'data', 'integrations.json');
const HERO_BANNERS_STORAGE_PATH = path.join(process.cwd(), 'data', 'hero_banners.json');

function loadPersistedHeroBanners(): Record<string, CategoryPromoBanner[]> {
  try {
    if (fs.existsSync(HERO_BANNERS_STORAGE_PATH)) {
      const raw = fs.readFileSync(HERO_BANNERS_STORAGE_PATH, 'utf-8');
      if (raw && raw.trim().length > 0) {
        return JSON.parse(raw);
      }
    }
  } catch (e) {
    console.warn('[FirestoreService] Could not read persisted hero banners file:', e);
  }
  return {};
}

function savePersistedHeroBanners(bannersMap: Record<string, CategoryPromoBanner[]>): void {
  try {
    const dir = path.dirname(HERO_BANNERS_STORAGE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(HERO_BANNERS_STORAGE_PATH, JSON.stringify(bannersMap, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[FirestoreService] Could not write persisted hero banners file:', e);
  }
}

function loadPersistedTenants(): Record<string, TenantConfig> {
  try {
    if (fs.existsSync(TENANTS_STORAGE_PATH)) {
      const raw = fs.readFileSync(TENANTS_STORAGE_PATH, 'utf-8');
      if (raw && raw.trim().length > 0) {
        return JSON.parse(raw);
      }
    }
  } catch (e) {
    console.warn('[FirestoreService] Could not read persisted tenants file:', e);
  }
  return {};
}

function savePersistedTenants(tenants: Record<string, TenantConfig>): void {
  try {
    const dir = path.dirname(TENANTS_STORAGE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(TENANTS_STORAGE_PATH, JSON.stringify(tenants, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[FirestoreService] Could not write persisted tenants file:', e);
  }
}

function loadPersistedIntegrations(): Record<string, IntegrationConfig> {
  try {
    if (fs.existsSync(INTEGRATIONS_STORAGE_PATH)) {
      const raw = fs.readFileSync(INTEGRATIONS_STORAGE_PATH, 'utf-8');
      if (raw && raw.trim().length > 0) {
        return JSON.parse(raw);
      }
    }
  } catch (e) {
    console.warn('[FirestoreService] Could not read persisted integrations file:', e);
  }
  return {};
}

function savePersistedIntegrations(integrations: Record<string, IntegrationConfig>): void {
  try {
    const dir = path.dirname(INTEGRATIONS_STORAGE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(INTEGRATIONS_STORAGE_PATH, JSON.stringify(integrations, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[FirestoreService] Could not write persisted integrations file:', e);
  }
}

// In-memory tenant registry with disk persistence fallback
const inMemoryTenants: Record<string, TenantConfig> = { ...MOCK_TENANTS, ...loadPersistedTenants() };
const inMemoryIntegrations: Record<string, IntegrationConfig> = { ...loadPersistedIntegrations() };
const inMemoryCheckouts: Record<string, CheckoutResult> = {};
const inMemoryBasketSubstitutionPreferences: Record<string, BasketSubstitutionPreferencesDocument> = {};
const inMemoryBasketBundleAllocations: Record<string, BasketBundleAllocationsDocument> = {};
const inMemoryOrderProjections: Record<string, OrderProjection> = {};
const inMemoryWebhookEvents: Record<string, WebhookEvent> = {};
const inMemoryWebhookClaims: Record<string, string> = {};
const inMemoryPaymentProjections: Record<string, DomainPaymentProjection> = {};
const inMemorySearchConfigs: Record<string, any> = {};
const inMemoryDispatchRules: Record<string, TenantDispatchRules> = {};
const inMemoryCustomerProfiles: Record<string, CustomerAccountProfile> = {};

export interface DomainRecord {
  domainId: string;
  hostname: string;
  tenantId: string;
  isPrimary?: boolean;
  status?: 'active' | 'pending';
  createdAt?: string;
  updatedAt?: string;
}

function loadPersistedDomains(): Record<string, DomainRecord> {
  try {
    if (fs.existsSync(DOMAINS_STORAGE_PATH)) {
      const raw = fs.readFileSync(DOMAINS_STORAGE_PATH, 'utf-8');
      if (raw && raw.trim().length > 0) {
        return JSON.parse(raw);
      }
    }
  } catch (e) {
    console.warn('[FirestoreService] Could not read persisted domains file:', e);
  }
  return {};
}

function savePersistedDomains(domains: Record<string, DomainRecord>): void {
  try {
    const dir = path.dirname(DOMAINS_STORAGE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DOMAINS_STORAGE_PATH, JSON.stringify(domains, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[FirestoreService] Could not write persisted domains file:', e);
  }
}

// In-memory domain registry with disk persistence fallback
const inMemoryDomains: Record<string, DomainRecord> = {
  '1bwydi.ai.studio': {
    domainId: 'dom_1bwydi',
    hostname: '1bwydi.ai.studio',
    tenantId: 'brand-alpha',
    isPrimary: true,
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  'localhost': {
    domainId: 'dom_localhost',
    hostname: 'localhost',
    tenantId: 'brand-alpha',
    isPrimary: true,
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  '127.0.0.1': {
    domainId: 'dom_127001',
    hostname: '127.0.0.1',
    tenantId: 'brand-alpha',
    isPrimary: true,
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  'www.shop1.com': {
    domainId: 'dom_shop1',
    hostname: 'www.shop1.com',
    tenantId: 'brand-alpha',
    isPrimary: true,
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  'shop1.com': {
    domainId: 'dom_shop1_apex',
    hostname: 'shop1.com',
    tenantId: 'brand-alpha',
    isPrimary: false,
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  'www.shop2.com': {
    domainId: 'dom_shop2',
    hostname: 'www.shop2.com',
    tenantId: 'brand-beta',
    isPrimary: true,
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  'shop2.com': {
    domainId: 'dom_shop2_apex',
    hostname: 'shop2.com',
    tenantId: 'brand-beta',
    isPrimary: false,
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  ...loadPersistedDomains(),
};

export class FirestoreService {
  /**
   * Retrieves all tenants across the platform (Platform Super Admin).
   */
  static async listAllTenants(): Promise<TenantConfig[]> {
    const db = getFirestoreDb();
    if (!db || isFirestorePermissionDenied()) {
      return Object.values(inMemoryTenants);
    }

    try {
      const snap = await db.collection('tenants').get();
      const list: TenantConfig[] = [];
      const seenIds = new Set<string>();

      snap.forEach((d) => {
        const tenant = d.data() as TenantConfig;
        if (tenant && tenant.tenantId && !seenIds.has(tenant.tenantId)) {
          list.push(tenant);
          seenIds.add(tenant.tenantId);
          inMemoryTenants[tenant.tenantId] = tenant;
        }
      });

      // Merge in-memory and disk provisioned tenants
      for (const [id, t] of Object.entries(inMemoryTenants)) {
        if (!seenIds.has(id)) {
          list.push(t);
        }
      }

      savePersistedTenants(inMemoryTenants);
      return list;
    } catch (err: any) {
      if (isFirestorePermissionDeniedError(err)) {
        markFirestorePermissionDenied(err);
      } else {
        handleFirestoreError(err, OperationType.LIST, 'tenants');
      }
      return Object.values(inMemoryTenants);
    }
  }

  /**
   * Retrieves tenant configuration by tenantId.
   */
  static async getTenantConfig(tenantId: string = 'brand-alpha'): Promise<TenantConfig> {
    const isDemo = isDemoMode();

    // In demo mode or when permission is denied, check in-memory cache directly
    if ((isDemo || isFirestorePermissionDenied()) && inMemoryTenants[tenantId]) {
      return inMemoryTenants[tenantId];
    }

    const db = getFirestoreDb();
    if (!db || isFirestorePermissionDenied()) {
      if (inMemoryTenants[tenantId]) {
        return inMemoryTenants[tenantId];
      }
      throw new BFFError('TENANT_NOT_FOUND', `Tenant not found: "${tenantId}" is not provisioned on this platform.`, 404);
    }

    try {
      const snap = await db.collection('tenants').doc(tenantId).get();

      if (snap.exists) {
        const tenant = snap.data() as TenantConfig;
        inMemoryTenants[tenantId] = tenant;
        return tenant;
      }

      if (inMemoryTenants[tenantId]) {
        return inMemoryTenants[tenantId];
      }

      throw new BFFError('TENANT_NOT_FOUND', `Tenant not found: "${tenantId}" is not provisioned on this platform.`, 404);
    } catch (err: any) {
      if (err instanceof BFFError) {
        throw err;
      }
      if (isFirestorePermissionDeniedError(err)) {
        markFirestorePermissionDenied(err);
      }
      if (inMemoryTenants[tenantId]) {
        return inMemoryTenants[tenantId];
      }
      throw new BFFError('TENANT_NOT_FOUND', `Tenant not found: "${tenantId}" is not provisioned on this platform.`, 404);
    }
  }

  /**
   * Retrieves all registered domain-to-tenant mappings.
   */
  static async listAllDomains(): Promise<DomainRecord[]> {
    const list: DomainRecord[] = [];
    const seenHostnames = new Set<string>();

    const db = getFirestoreDb();
    if (db && !isFirestorePermissionDenied()) {
      try {
        const snap = await db.collection('domains').get();
        snap.forEach((d) => {
          const data = d.data();
          if (data && data.hostname && data.tenantId) {
            const host = data.hostname.toLowerCase().trim();
            list.push({
              domainId: d.id,
              hostname: host,
              tenantId: data.tenantId,
              isPrimary: data.isPrimary ?? false,
              status: data.status || 'active',
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
            });
            seenHostnames.add(host);
          }
        });
      } catch (err: any) {
        if (isFirestorePermissionDeniedError(err)) {
          markFirestorePermissionDenied(err);
        }
      }
    }

    // Merge in-memory and disk-persisted domains
    for (const [host, rec] of Object.entries(inMemoryDomains)) {
      if (!seenHostnames.has(host.toLowerCase())) {
        list.push(rec);
        seenHostnames.add(host.toLowerCase());
      }
    }

    return list;
  }

  /**
   * Retrieves registered domains for a specific tenant.
   */
  static async getDomainsForTenant(tenantId: string): Promise<DomainRecord[]> {
    const all = await this.listAllDomains();
    return all.filter((d) => d.tenantId === tenantId);
  }

  /**
   * Adds or updates a domain mapping.
   */
  static async addOrUpdateDomain(params: {
    hostname: string;
    tenantId: string;
    isPrimary?: boolean;
    status?: 'active' | 'pending';
  }): Promise<DomainRecord> {
    const cleanHost = (params.hostname || '').toLowerCase().trim().split(':')[0];
    if (!cleanHost) {
      throw new BFFError('INVALID_INPUT', 'A valid hostname or domain name is required.', 400);
    }
    const tenantId = params.tenantId.trim();
    const now = new Date().toISOString();
    const domainSlug = cleanHost.replace(/[^a-zA-Z0-9.-]/g, '_').toLowerCase();
    const domainId = `dom_${domainSlug}`;

    const record: DomainRecord = {
      domainId,
      hostname: cleanHost,
      tenantId,
      isPrimary: params.isPrimary ?? false,
      status: params.status || 'active',
      createdAt: inMemoryDomains[cleanHost]?.createdAt || now,
      updatedAt: now,
    };

    // 1. Update in-memory & disk persistence
    inMemoryDomains[cleanHost] = record;
    savePersistedDomains(inMemoryDomains);

    // 2. Persist to Firestore if available
    const db = getFirestoreDb();
    if (db && !isFirestorePermissionDenied()) {
      try {
        const topDomainRef = db.collection('domains').doc(domainSlug);
        await topDomainRef.set(
          {
            domainId,
            hostname: cleanHost,
            tenantId,
            isPrimary: record.isPrimary,
            status: record.status,
            updatedAt: now,
          },
          { merge: true }
        );

        // Also record under tenant subcollection
        const tenantDomainRef = db.collection('tenants').doc(tenantId).collection('domains').doc(domainSlug);
        await tenantDomainRef.set(
          {
            domain: cleanHost,
            hostname: cleanHost,
            tenantId,
            isPrimary: record.isPrimary,
            status: record.status,
            updatedAt: now,
          },
          { merge: true }
        );
      } catch (err: any) {
        if (isFirestorePermissionDeniedError(err)) {
          markFirestorePermissionDenied(err);
        } else {
          console.warn('[FirestoreService] Could not persist domain to Firestore:', err.message);
        }
      }
    }

    return record;
  }

  /**
   * Deletes a domain mapping.
   */
  static async deleteDomain(domainIdOrHostname: string): Promise<boolean> {
    const target = domainIdOrHostname.toLowerCase().trim();
    let foundHostname: string | null = null;

    for (const [host, rec] of Object.entries(inMemoryDomains)) {
      if (host === target || rec.domainId === target) {
        foundHostname = host;
        delete inMemoryDomains[host];
        break;
      }
    }

    if (foundHostname) {
      savePersistedDomains(inMemoryDomains);
    }

    const db = getFirestoreDb();
    if (db && !isFirestorePermissionDenied()) {
      try {
        const slug = (foundHostname || target).replace(/^dom_/, '').replace(/[^a-zA-Z0-9.-]/g, '_').toLowerCase();
        await db.collection('domains').doc(slug).delete();
      } catch (err: any) {
        if (isFirestorePermissionDeniedError(err)) {
          markFirestorePermissionDenied(err);
        }
      }
    }

    return true;
  }

  /**
   * Resolves a tenant ID by hostname with full multi-level fallbacks.
   */
  static async resolveTenantByHostname(hostname: string): Promise<string | null> {
    const cleanHost = (hostname || '').toLowerCase().trim().split(':')[0];
    if (!cleanHost) return null;

    // 1. Direct match in persistent / in-memory domain registry
    if (inMemoryDomains[cleanHost]) {
      return inMemoryDomains[cleanHost].tenantId;
    }

    // 2. www-prefixed or non-www equivalent
    if (cleanHost.startsWith('www.')) {
      const withoutWww = cleanHost.slice(4);
      if (inMemoryDomains[withoutWww]) {
        return inMemoryDomains[withoutWww].tenantId;
      }
    } else {
      const withWww = `www.${cleanHost}`;
      if (inMemoryDomains[withWww]) {
        return inMemoryDomains[withWww].tenantId;
      }
    }

    // 3. Firestore query if connected and not denied
    const db = getFirestoreDb();
    if (db && !isFirestorePermissionDenied()) {
      try {
        const snap = await db.collection('domains').where('hostname', '==', cleanHost).limit(1).get();
        if (!snap.empty) {
          const data = snap.docs[0].data();
          if (data && data.tenantId) {
            inMemoryDomains[cleanHost] = {
              domainId: snap.docs[0].id,
              hostname: cleanHost,
              tenantId: data.tenantId,
              isPrimary: data.isPrimary ?? true,
              status: data.status || 'active',
              createdAt: data.createdAt || new Date().toISOString(),
              updatedAt: data.updatedAt || new Date().toISOString(),
            };
            return data.tenantId as string;
          }
        }
      } catch (err: any) {
        if (isFirestorePermissionDeniedError(err)) {
          markFirestorePermissionDenied(err);
        }
      }
    }

    // 4. Check if any tenant has this as defaultDomain
    for (const t of Object.values(inMemoryTenants)) {
      const tDom = (t as any).defaultDomain || (t as any).domain;
      if (tDom && tDom.toLowerCase().split(':')[0] === cleanHost) {
        return t.tenantId;
      }
    }

    // 5. Subdomain heuristic (e.g. brand-beta.1bwydi.ai.studio -> brand-beta)
    const hostParts = cleanHost.split('.');
    if (hostParts.length > 2) {
      const candidateSlug = hostParts[0].toLowerCase();
      if (inMemoryTenants[candidateSlug]) {
        return candidateSlug;
      }
      if (candidateSlug.startsWith('brand-') || candidateSlug === 'marketlane') {
        return candidateSlug;
      }
    }

    // 6. Explicit authorized preview environment variable (if authorized by server configuration)
    if (process.env.PREVIEW_TENANT_ID && (
      cleanHost.includes('ai.studio') ||
      cleanHost.includes('aistudio') ||
      cleanHost.includes('run.app') ||
      cleanHost.includes('localhost') ||
      cleanHost.includes('127.0.0.1') ||
      cleanHost.includes('googleusercontent.com')
    )) {
      return process.env.PREVIEW_TENANT_ID;
    }

    return null;
  }

  /**
   * Resolves tenant ID by integration identifier (for tenant/integration-specific webhook routes).
   */
  static async resolveTenantByIntegrationId(integrationId: string): Promise<string | null> {
    if (!integrationId) return null;
    const db = getFirestoreDb();
    if (db) {
      try {
        const snap = await db.collection('integrations').where('integrationId', '==', integrationId).limit(1).get();
        if (!snap.empty) {
          return (snap.docs[0].data()?.tenantId as string) || snap.docs[0].id;
        }
      } catch (err) {
        console.warn(`[FirestoreService] Failed to resolve tenant for integrationId "${integrationId}":`, err);
      }
    }
    for (const [tId, cfg] of Object.entries(inMemoryIntegrations)) {
      if ((cfg as any).integrationId === integrationId || tId === integrationId) {
        return tId;
      }
    }
    return null;
  }

  /**
   * Creates a new brand / tenant directly in Firestore (Super Admin Provisioning).
   * Generates default domains, integration in UNCONFIGURED state, RBAC membership, fee & scheduling policies, and audit logs.
   */
  static async createTenant(newTenant: Partial<TenantConfig> & { initialAdminEmail?: string; adminEmail?: string; domain?: string }): Promise<TenantConfig> {
    const tenantId = newTenant.tenantId || `brand-${Date.now().toString(36)}`;
    const fullTenant: TenantConfig = {
      tenantId,
      brandName: newTenant.brandName || (isDemoMode() ? 'New Artisan Brand' : tenantId),
      tagline: newTenant.tagline || (isDemoMode() ? 'Fresh essentials delivered in minutes' : ''),
      logoUrl: newTenant.logoUrl || '',
      iconUrl: newTenant.iconUrl || '',
      primaryColour: newTenant.primaryColour || '#059669',
      secondaryColour: newTenant.secondaryColour || '#f59e0b',
      backgroundColour: newTenant.backgroundColour || '#f8fafc',
      textColour: newTenant.textColour || '#0f172a',
      fontFamily: newTenant.fontFamily || "'Plus Jakarta Sans', system-ui, sans-serif",
      borderRadius: newTenant.borderRadius || '16px',
      country: newTenant.country || 'GB',
      currency: newTenant.currency || 'GBP',
      currencySymbol: newTenant.currencySymbol || '£',
      locale: newTenant.locale || 'en-GB',
      supportDetails: newTenant.supportDetails || (isDemoMode() ? {
        email: `support@${tenantId}.co.uk`,
        phone: '0800 000 0000',
        openingHours: 'Mon - Sun: 08:00 - 22:00',
      } : {
        email: '',
        phone: '',
        openingHours: '',
      }),
      featureFlags: newTenant.featureFlags || {
        enableStories: true,
        enableRootCatalogBrowse: true,
        enableCollection: true,
        allowStoreSwitchingWithBasket: true,
        enableNutritionalInfo: true,
        enableDeposits: true,
        enableAgeVerification: true,
        enableSearchSuggestions: true,
      },
    };

    inMemoryTenants[tenantId] = fullTenant;
    savePersistedTenants(inMemoryTenants);

    const domainName = newTenant.domain || `${tenantId}.marketlane.app`;
    try {
      await FirestoreService.addOrUpdateDomain({
        hostname: domainName,
        tenantId,
        isPrimary: true,
        status: 'active',
      });
    } catch (dErr) {
      console.warn('[FirestoreService] Could not auto-register domain for new tenant:', dErr);
    }

    const db = getFirestoreDb();
    if (!db || isFirestorePermissionDenied()) {
      console.info(`[Firestore Admin] Running in standalone/fallback mode; created tenant ${tenantId} and registered domain ${domainName}`);
      savePersistedTenants(inMemoryTenants);
      await FirestorePlatformService.addAuditLog(tenantId, {
        userId: 'system-provisioner',
        userName: 'Platform Super Admin',
        userRole: 'platformSuperAdmin',
        tenantId,
        category: 'Tenant',
        action: 'PROVISION_TENANT',
        details: `Provisioned new tenant: ${tenantId} (${fullTenant.brandName}) mapped to ${domainName}`,
      });
      return fullTenant;
    }

    const domainSlug = domainName.replace(/[^a-zA-Z0-9.-]/g, '_').toLowerCase();

    try {
      const now = new Date().toISOString();
      const batch = db.batch();

      // 1. Primary Tenant Branding Document
      const tenantRef = db.collection('tenants').doc(tenantId);
      batch.set(tenantRef, {
        ...fullTenant,
        status: isDemoMode() ? 'active' : 'draft',
        createdAt: now,
        updatedAt: now,
      });

      // 2. Integration & Channel Mapping (UNCONFIGURED status per Phase 4 baseline)
      const integrationRef = db.collection('integrations').doc(tenantId);
      batch.set(integrationRef, {
        integrationId: `int_${tenantId}`,
        tenantId,
        deliverectAccountId: '',
        environment: 'staging',
        status: 'UNCONFIGURED',
        connectionState: 'DISCONNECTED',
        lastCheckedAt: null,
        diagnosticMessage: 'Deliverect credentials not yet configured. Integration pending initial setup.',
        bffProxyUrl: '/api/v1',
        createdAt: now,
        updatedAt: now,
      });

      // 3. Subdomain and Domain Routing
      const isPlatformSubdomain = domainName.endsWith('.marketlane.app');
      // Top-level domains collection
      const topDomainRef = db.collection('domains').doc(domainSlug);
      batch.set(topDomainRef, {
        domainId: domainSlug,
        hostname: domainName,
        tenantId,
        status: isPlatformSubdomain ? 'active' : 'pending',
        verificationMethod: isPlatformSubdomain ? 'platform_subdomain' : 'dns_cname',
        isPrimary: true,
        createdAt: now,
        updatedAt: now,
      });

      // Subcollection inside tenant
      const domainRef = db.collection('tenants').doc(tenantId).collection('domains').doc('default');
      batch.set(domainRef, {
        domain: domainName,
        tenantId,
        isPrimary: true,
        isVerified: isPlatformSubdomain,
        status: isPlatformSubdomain ? 'active' : 'pending',
        sslStatus: isPlatformSubdomain ? 'provisioned' : 'pending',
        createdAt: now,
        updatedAt: now,
      });

      // 4. Initial Admin RBAC Membership
      const adminEmail = newTenant.initialAdminEmail || newTenant.adminEmail;
      if (adminEmail) {
        const membershipKey = `${adminEmail.toLowerCase().trim()}_${tenantId}`;
        const membershipRef = db.collection('tenantMemberships').doc(membershipKey);
        batch.set(membershipRef, {
          membershipId: membershipKey,
          email: adminEmail.toLowerCase().trim(),
          tenantId,
          role: 'tenantAdmin',
          status: 'active',
          assignedAt: now,
        });
      }

      // 5. Default Fee Policy (clean unconfigured state, no Brand Alpha mock inheritance)
      const feePolicyRef = db.collection('tenants').doc(tenantId).collection('feePolicies').doc('default');
      const defaultFeePolicy = {
        tenantId,
        status: 'UNCONFIGURED',
        deliveryFeeMode: 'DISPATCH_COST',
        serviceFeeMode: 'NONE',
        serviceFeeAmount: 0,
        bagFee: 0,
        serviceFeeEnabled: false,
        smallOrderFeeEnabled: false,
        updatedAt: now,
      };
      batch.set(feePolicyRef, {
        ...defaultFeePolicy,
        tenantId,
        updatedAt: now,
      });

      // 6. Default Scheduling Policy
      const schedulingPolicyRef = db.collection('tenants').doc(tenantId).collection('schedulingPolicies').doc('default');
      batch.set(schedulingPolicyRef, {
        tenantId,
        allowAsap: true,
        allowScheduledToday: true,
        allowFutureDays: true,
        maxAdvanceDays: 7,
        slotDurationMinutes: 30,
        bufferMinutes: 15,
        updatedAt: now,
      });

      // 7. Feature Flags (top-level collection)
      const featureFlagsRef = db.collection('featureFlags').doc(tenantId);
      batch.set(featureFlagsRef, {
        tenantId,
        flags: fullTenant.featureFlags,
        updatedAt: now,
      });

      // Commit entire provisioning state atomically
      await batch.commit();
      console.log(`[Firestore Admin] Successfully provisioned new tenant atomically: ${tenantId}`);

      // Record audit log
      await FirestorePlatformService.addAuditLog(tenantId, {
        userId: 'system-provisioner',
        userName: 'Platform Super Admin',
        userRole: 'platformSuperAdmin',
        tenantId,
        category: 'Tenant',
        action: 'PROVISION_TENANT',
        details: `Provisioned new tenant: ${tenantId} (${fullTenant.brandName}) with default domain ${domainName}`,
      });
    } catch (err: any) {
      if (isFirestorePermissionDeniedError(err)) {
        markFirestorePermissionDenied(err);
      } else {
        handleFirestoreError(err, OperationType.CREATE, `tenants/${tenantId}`);
      }
      console.warn(`[Firestore Admin] Batch commit fallback for ${tenantId} (${err.message})`);
      savePersistedTenants(inMemoryTenants);
      await FirestorePlatformService.addAuditLog(tenantId, {
        userId: 'system-provisioner',
        userName: 'Platform Super Admin',
        userRole: 'platformSuperAdmin',
        tenantId,
        category: 'Tenant',
        action: 'PROVISION_TENANT',
        details: `Provisioned new tenant: ${tenantId} (${fullTenant.brandName}) with default domain ${domainName}`,
      });
      return fullTenant;
    }

    return fullTenant;
  }

  /**
   * Updates tenant branding and features in Firestore.
   */
  static async updateTenantConfig(tenantId: string, updates: Partial<TenantConfig>): Promise<TenantConfig> {
    let current: TenantConfig;
    try {
      current = await this.getTenantConfig(tenantId);
    } catch {
      current = await this.createTenant({
        tenantId,
        brandName: (updates as any).brandName || (updates as any).name || tenantId,
        country: (updates as any).country || 'GB',
        currency: (updates as any).currency || 'GBP',
      });
    }
    const updated = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    inMemoryTenants[tenantId] = updated;
    savePersistedTenants(inMemoryTenants);

    const db = getFirestoreDb();
    if (!db || isFirestorePermissionDenied()) {
      return updated;
    }

    try {
      await db.collection('tenants').doc(tenantId).set(updated, { merge: true });
      console.log(`[Firestore Admin] Updated tenant config for ${tenantId}`);
    } catch (err: any) {
      if (isFirestorePermissionDeniedError(err)) {
        markFirestorePermissionDenied(err);
      } else {
        console.error(`[Firestore Admin] Failed to update tenant config for ${tenantId}:`, err);
      }
      return updated;
    }

    return updated;
  }

  /**
   * Deletes tenant configuration from Firestore and memory.
   */
  static async deleteTenantConfig(tenantId: string): Promise<boolean> {
    delete inMemoryTenants[tenantId];
    savePersistedTenants(inMemoryTenants);

    const db = getFirestoreDb();
    if (db && !isFirestorePermissionDenied()) {
      try {
        await db.collection('tenants').doc(tenantId).delete();
        console.log(`[Firestore Admin] Deleted tenant config for ${tenantId}`);
      } catch (err: any) {
        if (isFirestorePermissionDeniedError(err)) {
          markFirestorePermissionDenied(err);
        } else {
          console.error(`[Firestore Admin] Failed to delete tenant config for ${tenantId}:`, err);
        }
      }
    }
    return true;
  }

  /**
   * Retrieves stories for a tenant from Firestore or memory.
   */
  static async getTenantStories(tenantId: string = 'brand-alpha'): Promise<Story[]> {
    if (inMemoryStories[tenantId]) {
      return inMemoryStories[tenantId];
    }
    if (inMemoryStoriesPurged[tenantId]) {
      return [];
    }

    const db = getFirestoreDb();
    if (!db) {
      if (isDemoMode() && !inMemoryStoriesPurged[tenantId]) {
        inMemoryStories[tenantId] = [...MOCK_STORIES];
        return inMemoryStories[tenantId];
      }
      return [];
    }

    try {
      const snap = await db.collection('tenants').doc(tenantId).collection('stories').get();

      if (!snap.empty) {
        const stories: Story[] = [];
        snap.forEach((d) => stories.push(d.data() as Story));
        inMemoryStories[tenantId] = stories;
        return stories;
      }

      if (isDemoMode() && !inMemoryStoriesPurged[tenantId]) {
        inMemoryStories[tenantId] = [...MOCK_STORIES];
        return inMemoryStories[tenantId];
      }

      return [];
    } catch (err) {
      if (isDemoMode() && !inMemoryStoriesPurged[tenantId]) {
        return MOCK_STORIES;
      }
      return [];
    }
  }

  /**
   * Saves or updates a story in Firestore and memory.
   */
  static async saveTenantStory(tenantId: string, story: Story): Promise<Story> {
    if (!inMemoryStories[tenantId]) {
      inMemoryStories[tenantId] = [];
    }
    const existingIndex = inMemoryStories[tenantId].findIndex((s) => s.id === story.id);
    if (existingIndex >= 0) {
      inMemoryStories[tenantId][existingIndex] = { ...inMemoryStories[tenantId][existingIndex], ...story };
    } else {
      inMemoryStories[tenantId].push(story);
    }
    inMemoryStoriesPurged[tenantId] = false;

    const db = getFirestoreDb();
    if (db) {
      try {
        await db
          .collection('tenants')
          .doc(tenantId)
          .collection('stories')
          .doc(story.id)
          .set(story, { merge: true });
      } catch (err) {
        console.error(`[Firestore Admin] Failed to save story:`, err);
      }
    }
    return story;
  }

  /**
   * Deletes a story from Firestore and memory.
   */
  static async deleteTenantStory(tenantId: string, storyId: string): Promise<boolean> {
    if (inMemoryStories[tenantId]) {
      inMemoryStories[tenantId] = inMemoryStories[tenantId].filter((s) => s.id !== storyId);
    }

    const db = getFirestoreDb();
    if (db) {
      try {
        await db
          .collection('tenants')
          .doc(tenantId)
          .collection('stories')
          .doc(storyId)
          .delete();
      } catch (err) {
        console.error(`[Firestore Admin] Failed to delete story:`, err);
      }
    }
    return true;
  }

  /**
   * Purges all stories for a tenant (both mock and saved).
   */
  static async purgeTenantStories(tenantId: string = 'brand-alpha'): Promise<boolean> {
    inMemoryStories[tenantId] = [];
    inMemoryStoriesPurged[tenantId] = true;

    const db = getFirestoreDb();
    if (db) {
      try {
        const snap = await db.collection('tenants').doc(tenantId).collection('stories').get();
        const batch = db.batch();
        snap.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
      } catch (err) {
        console.error(`[Firestore Admin] Failed to purge stories from Firestore:`, err);
      }
    }
    return true;
  }

  /**
   * Retrieves promotional hero banners for a tenant from Firestore, disk, or memory.
   */
  static async getTenantHeroBanners(tenantId: string = 'brand-alpha'): Promise<CategoryPromoBanner[]> {
    if (inMemoryHeroBanners[tenantId]) {
      return inMemoryHeroBanners[tenantId];
    }
    if (inMemoryHeroBannersPurged[tenantId]) {
      return [];
    }

    // Check disk persistence
    const diskMap = loadPersistedHeroBanners();
    if (diskMap[tenantId] && Array.isArray(diskMap[tenantId]) && diskMap[tenantId].length > 0) {
      inMemoryHeroBanners[tenantId] = diskMap[tenantId];
    }

    const db = getFirestoreDb();
    if (db) {
      try {
        const snap = await db.collection('tenants').doc(tenantId).collection('heroBanners').get();
        if (!snap.empty) {
          const banners: CategoryPromoBanner[] = [];
          snap.forEach((d) => banners.push(d.data() as CategoryPromoBanner));
          inMemoryHeroBanners[tenantId] = banners;
          diskMap[tenantId] = banners;
          savePersistedHeroBanners(diskMap);
          return banners;
        }
      } catch (err) {
        console.warn(`[Firestore Admin] Error fetching hero banners for tenant ${tenantId}:`, err);
      }
    }

    if (inMemoryHeroBanners[tenantId]) {
      return inMemoryHeroBanners[tenantId];
    }

    if (!isDemoMode()) {
      return [];
    }

    // Fallback to defaults in demo mode only
    const defaults = DEFAULT_PROMO_BANNERS.map((b) => ({ ...b }));
    inMemoryHeroBanners[tenantId] = defaults;
    return defaults;
  }

  /**
   * Saves or updates a promotional hero banner in Firestore, disk, and memory per tenant.
   */
  static async saveTenantHeroBanner(tenantId: string, banner: CategoryPromoBanner): Promise<CategoryPromoBanner> {
    if (!inMemoryHeroBanners[tenantId]) {
      inMemoryHeroBanners[tenantId] = (await this.getTenantHeroBanners(tenantId)) || [];
    }
    const existingIndex = inMemoryHeroBanners[tenantId].findIndex((b) => b.id === banner.id);
    if (existingIndex >= 0) {
      inMemoryHeroBanners[tenantId][existingIndex] = { ...inMemoryHeroBanners[tenantId][existingIndex], ...banner };
    } else {
      inMemoryHeroBanners[tenantId].push(banner);
    }
    inMemoryHeroBannersPurged[tenantId] = false;

    // Persist to disk
    const diskMap = loadPersistedHeroBanners();
    diskMap[tenantId] = inMemoryHeroBanners[tenantId];
    savePersistedHeroBanners(diskMap);

    // Persist to Firestore
    const db = getFirestoreDb();
    if (db) {
      try {
        await db
          .collection('tenants')
          .doc(tenantId)
          .collection('heroBanners')
          .doc(banner.id)
          .set(cleanUndefined(banner), { merge: true });
      } catch (err) {
        console.error(`[Firestore Admin] Failed to save hero banner:`, err);
      }
    }
    return banner;
  }

  /**
   * Saves / reorders a batch of promotional hero banners for a tenant.
   */
  static async saveTenantHeroBannersBatch(tenantId: string, banners: CategoryPromoBanner[]): Promise<CategoryPromoBanner[]> {
    inMemoryHeroBanners[tenantId] = [...banners];
    inMemoryHeroBannersPurged[tenantId] = false;

    // Persist to disk
    const diskMap = loadPersistedHeroBanners();
    diskMap[tenantId] = banners;
    savePersistedHeroBanners(diskMap);

    // Persist to Firestore
    const db = getFirestoreDb();
    if (db) {
      try {
        const batch = db.batch();
        const collRef = db.collection('tenants').doc(tenantId).collection('heroBanners');
        const existingDocs = await collRef.get();
        const newIds = new Set(banners.map((b) => b.id));
        existingDocs.forEach((doc) => {
          if (!newIds.has(doc.id)) {
            batch.delete(doc.ref);
          }
        });
        for (const banner of banners) {
          batch.set(collRef.doc(banner.id), cleanUndefined(banner), { merge: true });
        }
        await batch.commit();
      } catch (err) {
        console.error(`[Firestore Admin] Failed to save hero banners batch:`, err);
      }
    }
    return banners;
  }

  /**
   * Deletes a promotional hero banner for a tenant.
   */
  static async deleteTenantHeroBanner(tenantId: string, bannerId: string): Promise<boolean> {
    if (inMemoryHeroBanners[tenantId]) {
      inMemoryHeroBanners[tenantId] = inMemoryHeroBanners[tenantId].filter((b) => b.id !== bannerId);
    }

    const diskMap = loadPersistedHeroBanners();
    if (diskMap[tenantId]) {
      diskMap[tenantId] = diskMap[tenantId].filter((b) => b.id !== bannerId);
      savePersistedHeroBanners(diskMap);
    }

    const db = getFirestoreDb();
    if (db) {
      try {
        await db
          .collection('tenants')
          .doc(tenantId)
          .collection('heroBanners')
          .doc(bannerId)
          .delete();
      } catch (err) {
        console.error(`[Firestore Admin] Failed to delete hero banner:`, err);
      }
    }
    return true;
  }

  /**
   * Resets promotional hero banners for a tenant back to system defaults.
   */
  static async resetTenantHeroBanners(tenantId: string): Promise<CategoryPromoBanner[]> {
    const defaults = DEFAULT_PROMO_BANNERS.map((b) => ({ ...b }));
    inMemoryHeroBanners[tenantId] = defaults;
    inMemoryHeroBannersPurged[tenantId] = false;

    const diskMap = loadPersistedHeroBanners();
    diskMap[tenantId] = defaults;
    savePersistedHeroBanners(diskMap);

    const db = getFirestoreDb();
    if (db) {
      try {
        const snap = await db.collection('tenants').doc(tenantId).collection('heroBanners').get();
        const batch = db.batch();
        snap.forEach((doc) => batch.delete(doc.ref));
        for (const banner of defaults) {
          batch.set(db.collection('tenants').doc(tenantId).collection('heroBanners').doc(banner.id), cleanUndefined(banner));
        }
        await batch.commit();
      } catch (err) {
        console.error(`[Firestore Admin] Failed to reset hero banners in Firestore:`, err);
      }
    }
    return defaults;
  }

  /**
   * Retrieves fee policy for tenant.
   */
  static async getTenantFeePolicy(tenantId: string = 'brand-alpha'): Promise<TenantFeePolicy> {
    const db = getFirestoreDb();
    const fallback = MOCK_FEE_POLICIES[tenantId] || MOCK_FEE_POLICIES['brand-alpha'];
    if (!db) {
      if (isDemoMode()) return fallback;
      throw new BFFError('DATABASE_UNAVAILABLE', 'Database connection unavailable.', 503);
    }

    try {
      const snap = await db.collection('tenants').doc(tenantId).collection('feePolicies').doc('default').get();
      if (snap.exists) {
        return snap.data() as TenantFeePolicy;
      }
      if (isDemoMode()) {
        await db.collection('tenants').doc(tenantId).collection('feePolicies').doc('default').set(fallback);
        return fallback;
      }
      throw new BFFError('POLICY_NOT_FOUND', `Fee policy not found for tenant "${tenantId}". Status: UNCONFIGURED.`, 404);
    } catch (err) {
      if (isDemoMode()) return fallback;
      throw err;
    }
  }

  /**
   * Updates fee policy for tenant.
   */
  static async updateTenantFeePolicy(tenantId: string, policy: Partial<TenantFeePolicy>): Promise<TenantFeePolicy> {
    const current = await this.getTenantFeePolicy(tenantId);
    const updated = { ...current, ...policy };
    const db = getFirestoreDb();
    if (!db) {
      if (!isDemoMode()) {
        throw new Error(`Database persistence is unavailable. Updating fee policy is rejected outside demo mode.`);
      }
      return updated;
    }

    try {
      await db
        .collection('tenants')
        .doc(tenantId)
        .collection('feePolicies')
        .doc('default')
        .set(updated, { merge: true });
    } catch (err) {
      console.error('[Firestore Admin] Failed to update fee policy:', err);
      throw err;
    }
    return updated;
  }

  /**
   * Retrieves the ASAP/pre-order scheduling policy for tenant. Falls back to
   * DEFAULT_TENANT_SCHEDULING_POLICY (which preserves today's behavior) rather than
   * throwing when unconfigured, since an unconfigured tenant should keep working.
   */
  static async getTenantSchedulingPolicy(tenantId: string = 'brand-alpha'): Promise<TenantSchedulingPolicy> {
    const db = getFirestoreDb();
    if (!db) {
      if (isDemoMode()) return DEFAULT_TENANT_SCHEDULING_POLICY;
      throw new BFFError('DATABASE_UNAVAILABLE', 'Database connection unavailable.', 503);
    }

    try {
      const snap = await db.collection('tenants').doc(tenantId).collection('schedulingPolicies').doc('default').get();
      if (snap.exists) {
        return { ...DEFAULT_TENANT_SCHEDULING_POLICY, ...(snap.data() as Partial<TenantSchedulingPolicy>) };
      }
      return DEFAULT_TENANT_SCHEDULING_POLICY;
    } catch (err) {
      if (isDemoMode()) return DEFAULT_TENANT_SCHEDULING_POLICY;
      throw err;
    }
  }

  /**
   * Updates the scheduling policy for tenant.
   */
  static async updateTenantSchedulingPolicy(
    tenantId: string,
    policy: Partial<TenantSchedulingPolicy>
  ): Promise<TenantSchedulingPolicy> {
    const current = await this.getTenantSchedulingPolicy(tenantId);
    const updated = { ...current, ...policy };
    const db = getFirestoreDb();
    if (!db) {
      if (!isDemoMode()) {
        throw new Error(`Database persistence is unavailable. Updating scheduling policy is rejected outside demo mode.`);
      }
      return updated;
    }

    try {
      await db
        .collection('tenants')
        .doc(tenantId)
        .collection('schedulingPolicies')
        .doc('default')
        .set(updated, { merge: true });
    } catch (err) {
      console.error('[Firestore Admin] Failed to update scheduling policy:', err);
      throw err;
    }
    return updated;
  }

  /**
   * Retrieves audit logs for tenant.
   */
  static async getAuditLogs(tenantId: string = 'brand-alpha'): Promise<AuditLogEntry[]> {
    const db = getFirestoreDb();
    if (!db) {
      if (isDemoMode() || process.env.NODE_ENV === 'test' || isTestMode()) {
        if (inMemoryAuditLogs[tenantId]?.length) {
          return inMemoryAuditLogs[tenantId];
        }
        return MOCK_AUDIT_LOGS;
      }
      throw new BFFError('DATABASE_UNAVAILABLE', 'Firestore database is not available.', 503);
    }

    try {
      const snap = await db
        .collection('tenants')
        .doc(tenantId)
        .collection('auditLogs')
        .orderBy('timestamp', 'desc')
        .limit(100)
        .get();

      if (snap.empty) {
        if (inMemoryAuditLogs[tenantId]?.length) {
          return inMemoryAuditLogs[tenantId];
        }
        if (isDemoMode()) return MOCK_AUDIT_LOGS;
        return [];
      }
      const logs: AuditLogEntry[] = [];
      snap.forEach((d) => logs.push(d.data() as AuditLogEntry));
      return logs;
    } catch (err: any) {
      handleFirestoreError(err, OperationType.LIST, `tenants/${tenantId}/auditLogs`);
      if (isDemoMode() || process.env.NODE_ENV === 'test' || isTestMode()) {
        if (inMemoryAuditLogs[tenantId]?.length) {
          return inMemoryAuditLogs[tenantId];
        }
        return MOCK_AUDIT_LOGS;
      }
      // Propagate database error in live mode rather than pretending empty
      throw err;
    }
  }

  /**
   * Adds an audit log entry in Firestore.
   */
  static async addAuditLog(tenantId: string, entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<AuditLogEntry> {
    const fullEntry: AuditLogEntry = {
      ...entry,
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
    };

    if (!inMemoryAuditLogs[tenantId]) {
      inMemoryAuditLogs[tenantId] = [];
    }
    inMemoryAuditLogs[tenantId].unshift(fullEntry);

    const db = getFirestoreDb();
    if (db) {
      try {
        await db
          .collection('tenants')
          .doc(tenantId)
          .collection('auditLogs')
          .doc(fullEntry.id)
          .set(cleanUndefined(fullEntry));
      } catch (err: any) {
        const isPerm =
          err?.message?.includes('PERMISSION_DENIED') ||
          err?.code === 7 ||
          err?.message?.includes('Missing or insufficient permissions');
        if (isPerm) {
          markFirestorePermissionDenied(err);
        } else {
          console.error('[Firestore Admin] Failed to write audit log:', err);
        }
      }
    }
    return fullEntry;
  }

  /**
   * Retrieves integration config (Deliverect channel mapping).
   */
  static async getIntegrationConfig(tenantId: string = 'brand-alpha'): Promise<IntegrationConfig> {
    if (inMemoryIntegrations[tenantId]) {
      return inMemoryIntegrations[tenantId];
    }

    const defaultIntegration: IntegrationConfig = {
      tenantId,
      environment: (process.env.DELIVERECT_ENV as 'staging' | 'production') || 'staging',
      status: isDemoMode() ? 'connected' : 'UNCONFIGURED',
      connectionState: isDemoMode() ? 'CONNECTED' : 'DISCONNECTED',
      bffProxyUrl: '/api/v1',
      lastSyncAt: new Date().toISOString(),
    };
    if (process.env.DELIVERECT_ACCOUNT_ID && process.env.DELIVERECT_ACCOUNT_ID.trim() !== '') {
      defaultIntegration.deliverectAccountId = process.env.DELIVERECT_ACCOUNT_ID;
    }

    const db = getFirestoreDb();
    if (!db) {
      if (isDemoMode() || process.env.NODE_ENV === 'test' || isTestMode()) {
        inMemoryIntegrations[tenantId] = defaultIntegration;
        return defaultIntegration;
      }
      throw new BFFError('DATABASE_UNAVAILABLE', 'Firestore database connection unavailable.', 503);
    }

    try {
      const snap = await db.collection('integrations').doc(tenantId).get();

      if (snap.exists) {
        const data = snap.data() as IntegrationConfig;
        inMemoryIntegrations[tenantId] = data;
        return data;
      }

      if (isDemoMode() || process.env.NODE_ENV === 'test' || isTestMode()) {
        await db.collection('integrations').doc(tenantId).set(cleanUndefined(defaultIntegration));
        inMemoryIntegrations[tenantId] = defaultIntegration;
        return defaultIntegration;
      }

      throw new BFFError(
        'INTEGRATION_NOT_CONFIGURED',
        `Deliverect integration not configured for tenant "${tenantId}".`,
        404
      );
    } catch (err: any) {
      const isPerm =
        err?.message?.includes('PERMISSION_DENIED') ||
        err?.code === 7 ||
        err?.message?.includes('Missing or insufficient permissions');
      if (isPerm) {
        markFirestorePermissionDenied(err);
      }
      if (isDemoMode() || process.env.NODE_ENV === 'test' || isTestMode() || isPerm) {
        if (!isPerm) {
          console.warn(`[Firestore Admin] Error fetching integration for ${tenantId}:`, err);
        }
        inMemoryIntegrations[tenantId] = defaultIntegration;
        return defaultIntegration;
      }
      throw err;
    }
  }

  static async getTenantIntegration(tenantId: string = 'brand-alpha'): Promise<IntegrationConfig> {
    return this.getIntegrationConfig(tenantId);
  }

  /**
   * Updates integration config in Firestore.
   */
  static async updateIntegrationConfig(tenantId: string, updates: Partial<IntegrationConfig>): Promise<IntegrationConfig> {
    const current = await this.getIntegrationConfig(tenantId);
    const merged: any = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // When no Deliverect account has yet been selected, omit deliverectAccountId entirely. Do not invent an account ID.
    if (!merged.deliverectAccountId || typeof merged.deliverectAccountId !== 'string' || merged.deliverectAccountId.trim() === '') {
      delete merged.deliverectAccountId;
    }
    if (!merged.channelLinkId || typeof merged.channelLinkId !== 'string' || merged.channelLinkId.trim() === '') {
      delete merged.channelLinkId;
    }

    const updated: IntegrationConfig = cleanUndefined(merged);
    inMemoryIntegrations[tenantId] = updated;
    savePersistedIntegrations(inMemoryIntegrations);

    const db = getFirestoreDb();
    if (!db || isFirestorePermissionDenied()) {
      return updated;
    }

    try {
      const payloadToWrite = cleanUndefined(updated);
      await db.collection('integrations').doc(tenantId).set(payloadToWrite, { merge: true });
    } catch (err: any) {
      const isPerm =
        err?.message?.includes('PERMISSION_DENIED') ||
        err?.code === 7 ||
        err?.message?.includes('Missing or insufficient permissions');
      if (isPerm) {
        markFirestorePermissionDenied(err);
      } else {
        console.error(`[Firestore Admin] Failed to update integration for ${tenantId}:`, err);
      }
      if (isDemoMode() || process.env.NODE_ENV === 'test' || isTestMode() || isPerm) {
        return updated;
      }
      throw err;
    }
    return updated;
  }

  /**
   * Stores a customer's per-item substitution choice outside Deliverect Commerce.
   * Deliverect baskets do not carry this Retail/Quest-specific metadata, so it must
   * survive independently across basket refresh/reconcile and server restarts.
   */
  static async saveBasketItemSubstitutionPreference(
    tenantId: string,
    basketId: string,
    plu: string,
    input: Omit<BasketItemSubstitutionPreferenceRecord, 'updatedAt'>
  ): Promise<BasketItemSubstitutionPreferenceRecord> {
    if (!tenantId || !basketId || !plu) {
      throw new Error('tenantId, basketId and plu are required to persist a substitution preference.');
    }

    const currentItems = await this.getBasketSubstitutionPreferences(tenantId, basketId);
    const updatedAt = new Date().toISOString();
    const record: BasketItemSubstitutionPreferenceRecord = cleanUndefined({
      ...input,
      updatedAt,
    });
    const document: BasketSubstitutionPreferencesDocument = {
      tenantId,
      basketId,
      items: { ...currentItems, [plu]: record },
      updatedAt,
    };

    const key = `${tenantId}:${basketId}`;
    const documentId = `${encodeURIComponent(tenantId)}__${encodeURIComponent(basketId)}`;
    const db = getFirestoreDb();

    if (!db) {
      if (!isDemoMode() && process.env.NODE_ENV !== 'test' && !isTestMode()) {
        throw new Error(
          'Database persistence is unavailable. Substitution preference saving rejected outside demo/test mode.'
        );
      }
      inMemoryBasketSubstitutionPreferences[key] = document;
      return record;
    }

    try {
      await db.collection('basketSubstitutionPreferences').doc(documentId).set(cleanUndefined(document), { merge: true });
      inMemoryBasketSubstitutionPreferences[key] = document;
      return record;
    } catch (err) {
      console.warn('[Firestore Admin] Could not save basket substitution preference:', err);
      if (!isDemoMode() && process.env.NODE_ENV !== 'test' && !isTestMode()) throw err;
      inMemoryBasketSubstitutionPreferences[key] = document;
      return record;
    }
  }

  static async getBasketSubstitutionPreferences(
    tenantId: string,
    basketId: string
  ): Promise<Record<string, BasketItemSubstitutionPreferenceRecord>> {
    if (!tenantId || !basketId) return {};

    const key = `${tenantId}:${basketId}`;
    const cached = inMemoryBasketSubstitutionPreferences[key];
    if (cached) return { ...cached.items };

    const db = getFirestoreDb();
    if (!db) {
      if (!isDemoMode() && process.env.NODE_ENV !== 'test' && !isTestMode()) {
        throw new Error(
          'Database persistence is unavailable. Substitution preference lookup rejected outside demo/test mode.'
        );
      }
      return {};
    }

    const documentId = `${encodeURIComponent(tenantId)}__${encodeURIComponent(basketId)}`;
    try {
      const snap = await db.collection('basketSubstitutionPreferences').doc(documentId).get();
      if (!snap.exists) return {};
      const document = snap.data() as BasketSubstitutionPreferencesDocument;
      if (document.tenantId !== tenantId || document.basketId !== basketId) {
        throw new Error('Basket substitution preference tenant/basket scope mismatch.');
      }
      inMemoryBasketSubstitutionPreferences[key] = document;
      return { ...(document.items || {}) };
    } catch (err) {
      console.warn('[Firestore Admin] Could not read basket substitution preferences:', err);
      if (!isDemoMode() && process.env.NODE_ENV !== 'test' && !isTestMode()) throw err;
      return {};
    }
  }

  /**
   * Persists the pricing ledger for one merchandising bundle instance. The
   * Deliverect basket itself contains normal standalone product lines; this ledger
   * is what preserves the customer's protected bundle allocation through Quest.
   */
  static async saveBasketBundleAllocation(
    tenantId: string,
    basketId: string,
    record: BasketBundleAllocationRecord
  ): Promise<BasketBundleAllocationRecord> {
    if (!tenantId || !basketId || !record?.bundleInstanceId) {
      throw new Error('tenantId, basketId and bundleInstanceId are required for bundle allocation persistence.');
    }

    const current = await this.getBasketBundleAllocations(tenantId, basketId);
    if (current.some((entry) => entry.bundleInstanceId === record.bundleInstanceId)) {
      return record;
    }

    const updatedAt = new Date().toISOString();
    const document: BasketBundleAllocationsDocument = cleanUndefined({
      tenantId,
      basketId,
      instances: [...current, record],
      updatedAt,
    });
    const key = `${tenantId}:${basketId}`;
    const documentId = `${encodeURIComponent(tenantId)}__${encodeURIComponent(basketId)}`;
    const db = getFirestoreDb();

    if (!db) {
      if (!isDemoMode() && process.env.NODE_ENV !== 'test' && !isTestMode()) {
        throw new Error(
          'Database persistence is unavailable. Bundle allocation saving rejected outside demo/test mode.'
        );
      }
      inMemoryBasketBundleAllocations[key] = document;
      return record;
    }

    try {
      await db
        .collection('basketBundleAllocations')
        .doc(documentId)
        .set(cleanUndefined(document), { merge: false });
      inMemoryBasketBundleAllocations[key] = document;
      return record;
    } catch (err) {
      console.warn('[Firestore Admin] Could not save basket bundle allocation:', err);
      if (!isDemoMode() && process.env.NODE_ENV !== 'test' && !isTestMode()) throw err;
      inMemoryBasketBundleAllocations[key] = document;
      return record;
    }
  }

  static async getBasketBundleAllocations(
    tenantId: string,
    basketId: string
  ): Promise<BasketBundleAllocationRecord[]> {
    if (!tenantId || !basketId) return [];

    const key = `${tenantId}:${basketId}`;
    const cached = inMemoryBasketBundleAllocations[key];
    if (cached) return [...cached.instances];

    const db = getFirestoreDb();
    if (!db) {
      if (!isDemoMode() && process.env.NODE_ENV !== 'test' && !isTestMode()) {
        throw new Error(
          'Database persistence is unavailable. Bundle allocation lookup rejected outside demo/test mode.'
        );
      }
      return [];
    }

    const documentId = `${encodeURIComponent(tenantId)}__${encodeURIComponent(basketId)}`;
    try {
      const snap = await db.collection('basketBundleAllocations').doc(documentId).get();
      if (!snap.exists) return [];
      const document = snap.data() as BasketBundleAllocationsDocument;
      if (document.tenantId !== tenantId || document.basketId !== basketId) {
        throw new Error('Basket bundle allocation tenant/basket scope mismatch.');
      }
      inMemoryBasketBundleAllocations[key] = document;
      return [...(document.instances || [])];
    } catch (err) {
      console.warn('[Firestore Admin] Could not read basket bundle allocations:', err);
      if (!isDemoMode() && process.env.NODE_ENV !== 'test' && !isTestMode()) throw err;
      return [];
    }
  }

  /**
   * Saves a GDPR-safe order projection in Firestore for customer status tracking.
   */
  static async saveOrderProjection(rawOrderInput: Order | any, tenantId: string = 'brand-alpha', checkoutId?: string): Promise<OrderProjection> {
    const order = DeliverectOrderMapper.normalizeOrder(rawOrderInput);
    const resolvedOrderId = (order as any).id || (order as any).orderId || (order as any).externalOrderId;
    const checkoutProjection = checkoutId ? await this.getCheckoutProjection(checkoutId) : null;
    const basketId =
      (order as any).basketId ||
      (order as any).basket?.id ||
      (order as any).originalBasket?.id ||
      checkoutProjection?.basketId;
    const persistedSubstitutionPreferences = basketId
      ? await this.getBasketSubstitutionPreferences(tenantId, basketId)
      : {};
    const persistedBundleAllocations = basketId
      ? await this.getBasketBundleAllocations(tenantId, basketId)
      : [];

    // Build a per-PLU pool of frozen protected bundle unit prices. The basket may
    // aggregate bundle and ordinary units of the same PLU into one line, so the
    // pool is consumed across picking lines rather than duplicating metadata.
    const protectedBundlePricePools = new Map<
      string,
      Array<{ price: Money; bundleInstanceId: string }>
    >();
    for (const allocation of persistedBundleAllocations) {
      for (const component of allocation.components || []) {
        const pool = protectedBundlePricePools.get(component.componentPlu) || [];
        for (const protectedPriceMinor of component.protectedUnitPricesMinor || []) {
          pool.push({
            price: {
              amount: Math.round(protectedPriceMinor),
              currency: allocation.currency || 'GBP',
            },
            bundleInstanceId: allocation.bundleInstanceId,
          });
        }
        protectedBundlePricePools.set(component.componentPlu, pool);
      }
    }
    for (const pool of protectedBundlePricePools.values()) {
      pool.sort((a, b) => a.price.amount - b.price.amount);
    }

    const attachBundlePricing = (
      item: PickingItem,
      quantity: number
    ): PickingItem => {
      const pool = protectedBundlePricePools.get(item.plu);
      if (!pool?.length || quantity <= 0) return item;

      const protectedUnits = pool.splice(0, Math.min(quantity, pool.length));
      if (protectedUnits.length === 0) return item;

      return cleanUndefined({
        ...item,
        bundlePricing: {
          protectedUnitPrices: protectedUnits.map((unit) => unit.price),
          bundleInstanceIds: Array.from(
            new Set(protectedUnits.map((unit) => unit.bundleInstanceId))
          ),
        },
      });
    };

    const fullAddress = order.fulfillment?.address?.formattedAddress || '';
    const postcodeMatch = fullAddress.match(/[A-Z]{1,2}[0-9][A-Z0-9]?/i);
    const destinationArea = postcodeMatch ? postcodeMatch[0].toUpperCase() : 'Local Area';

    let picking: PickingState | undefined = order.picking ? cleanUndefined(order.picking) : undefined;
    if (!picking && order.originalBasket?.items?.length) {
      const currency = order.originalBasket.currency || 'GBP';
      picking = {
        status: 'NOT_STARTED',
        totalItems: order.originalBasket.items.length,
        itemsPicked: 0,
        hasChanges: false,
        items: order.originalBasket.items.map((item, idx) => {
          // Deliverect sends integer MINOR UNITS. VIC1011 price 210 = £2.10;
          // DLV1016 price 1615 x qty 3 = payment.amount 4845. Multiplying by
          // 100 here previously turned £2.10 into £210.00.
          const rawPrice = item.price;
          let priceObj: { amount: number; currency: string };
          if (typeof rawPrice === 'object' && rawPrice !== null && 'amount' in rawPrice) {
            priceObj = rawPrice as { amount: number; currency: string };
          } else if (Number.isInteger(rawPrice)) {
            priceObj = { amount: rawPrice as unknown as number, currency };
          } else {
            throw new Error(
              `Order projection money mapping failed for plu "${item.plu}": expected integer minor units ` +
                `or a Money object, received ${JSON.stringify(rawPrice)}. Refusing to guess a currency scale.`
            );
          }

          return attachBundlePricing(
            {
              id: item.id || `item_${item.plu || idx}`,
              plu: item.plu,
              name: item.name,
              originalQuantity: item.quantity,
              pickedQuantity: 0,
              originalPrice: priceObj,
              finalPrice: priceObj,
              state: 'PENDING',
              substitutionPreference: item.substitutionPreference || 'BEST_MATCH',
              preferredSubstitutePlu: (item as any).substituteCandidates?.[0]?.plu || (item as any).preferredSubstitutePlu,
              preferredSubstituteName: (item as any).substituteCandidates?.[0]?.name || (item as any).preferredSubstituteName,
              preferredSubstitutePrice: (item as any).preferredSubstitutePrice,
            },
            item.quantity
          );
        }),
      };
    }

    if (picking?.items?.length && persistedBundleAllocations.length > 0) {
      picking = {
        ...picking,
        items: picking.items.map((item) =>
          item.bundlePricing
            ? item
            : attachBundlePricing(item, item.originalQuantity || 0)
        ),
      };
    }

    if (picking?.items?.length && Object.keys(persistedSubstitutionPreferences).length > 0) {
      picking = {
        ...picking,
        items: picking.items.map((item) => {
          const persisted = persistedSubstitutionPreferences[item.plu];
          if (!persisted) return item;
          return cleanUndefined({
            ...item,
            substitutionPreference: persisted.preference,
            preferredSubstitutePlu: persisted.preferredSubstitutePlu,
            preferredSubstituteName: persisted.preferredSubstituteName,
            preferredSubstitutePrice: persisted.preferredSubstitutePrice,
          });
        }),
      };
    }

    const channelOrderId =
      (order as any).channelOrderId ||
      (order as any).channelOrderReference ||
      order.orderReference ||
      (order as any).displayId ||
      (order as any).channelOrderDisplayId;
    const channelOrderDisplayId =
      (order as any).channelOrderDisplayId || (order as any).displayId || order.orderReference;
    const channelOrderRawId =
      (order as any).channelOrderRawId || (order as any).rawId || (order as any).externalId || (order as any)._id;
    const deliverectAccountId = (order as any).deliverectAccountId || (order as any).accountId || (order as any).account;
    const deliverectLocationId = (order as any).deliverectLocationId || (order as any).locationId || (order as any).location;

    const projection: OrderProjection = {
      orderId: resolvedOrderId,
      tenantId,
      customerUid:
        (order as any).customerUid ||
        (order as any).metadata?.customerUid ||
        undefined,
      status: order.status,
      itemsCount: order.currentOrder?.itemCount || order.originalBasket?.items?.length || (order as any).itemsCount || 0,
      total: order.currentOrder ? order.currentOrder.total.amount : (order.originalBasket?.total?.amount ?? (order as any).total ?? 0),
      // DeliverectOrderMapper already canonicalizes fulfillment. Unknown values fail
      // closed there rather than silently turning a pickup order into delivery.
      fulfillmentType: order.fulfillment.type,
      destinationArea,
      estimatedDeliveryTime: order.delivery?.deliveryOption?.deliveryEta || '',
      checkoutId,
      basketId,
      channelOrderId,
      channelOrderDisplayId,
      channelOrderRawId,
      deliverectAccountId,
      deliverectLocationId,
      orderReference: order.orderReference || (order as any).displayId,
      channelOrderReference: order.orderReference || channelOrderId,
      picking,
      paymentState: order.payment?.state || (order as any).paymentState,
      paymentId: order.payment?.paymentId || (order as any).paymentId || checkoutProjection?.paymentId,
      authorizedMaximum: order.payment?.authorizationMaximum?.amount || (order as any).authorizedMaximum,
      finalAmount: (order as any).finalAmount !== undefined ? (order as any).finalAmount : undefined,
      capturedAmount: (order as any).capturedAmount !== undefined ? (order as any).capturedAmount : undefined,
      residualHoldReleased: (order as any).residualHoldReleased !== undefined ? (order as any).residualHoldReleased : undefined,
      settlementDetails: (order as any).settlementDetails || undefined,
      metadata: cleanUndefined({
        ...((order as any).metadata || {}),
        ...(persistedBundleAllocations.length > 0
          ? {
              bundlePricingVersion: 1,
              bundleAllocations: persistedBundleAllocations,
            }
          : {}),
      }),
      createdAt: order.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    inMemoryOrderProjections[resolvedOrderId] = projection;

    const db = getFirestoreDb();
    if (!db) {
      if (!isDemoMode() && process.env.NODE_ENV !== 'test') {
        throw new Error(`Database persistence is unavailable. Order projection saving rejected outside demo mode.`);
      }
    } else {
      try {
        await db.collection('orderProjections').doc(resolvedOrderId).set(cleanUndefined(projection), { merge: true });
        console.log(`[Firestore Admin] Saved GDPR-safe order projection for order ${resolvedOrderId}`);
      } catch (err) {
        console.warn(`[Firestore Admin] Could not save order projection:`, err);
        if (!isDemoMode() && process.env.NODE_ENV !== 'test') {
          throw err;
        }
      }
    }

    return projection;
  }

  /**
   * Customer account data lives under the tenant document, separate from the
   * GDPR-safe order projection. Only server-authenticated callers should invoke
   * these methods.
   */
  static async getCustomerAccountProfile(
    tenantId: string,
    customerUid: string
  ): Promise<CustomerAccountProfile> {
    const key = `${tenantId}:${customerUid}`;
    if (inMemoryCustomerProfiles[key]) {
      return inMemoryCustomerProfiles[key];
    }

    const db = getFirestoreDb();
    if (db) {
      try {
        const snap = await db
          .collection('tenants')
          .doc(tenantId)
          .collection('customers')
          .doc(customerUid)
          .get();
        if (snap.exists) {
          const profile = snap.data() as CustomerAccountProfile;
          inMemoryCustomerProfiles[key] = profile;
          return profile;
        }
      } catch (err) {
        console.warn('[Firestore Admin] Could not load customer account profile:', err);
        if (!isDemoMode() && !isTestMode()) throw err;
      }
    } else if (!isDemoMode() && !isTestMode()) {
      throw new Error(
        'Customer account persistence is unavailable: Firestore is required outside demo/test mode.'
      );
    }

    const now = new Date().toISOString();
    const profile: CustomerAccountProfile = {
      tenantId,
      customerUid,
      addresses: [],
      notifications: {
        orderUpdates: true,
        deliveryUpdates: true,
        marketing: false,
      },
      createdAt: now,
      updatedAt: now,
    };
    inMemoryCustomerProfiles[key] = profile;
    return profile;
  }

  static async saveCustomerAccountProfile(
    tenantId: string,
    customerUid: string,
    patch: Partial<CustomerAccountProfile>
  ): Promise<CustomerAccountProfile> {
    const existing = await this.getCustomerAccountProfile(tenantId, customerUid);
    const now = new Date().toISOString();
    const profile: CustomerAccountProfile = cleanUndefined({
      ...existing,
      ...patch,
      tenantId,
      customerUid,
      addresses: Array.isArray(patch.addresses)
        ? patch.addresses
        : existing.addresses,
      notifications: {
        ...existing.notifications,
        ...(patch.notifications || {}),
      },
      createdAt: existing.createdAt || now,
      updatedAt: now,
    });

    const key = `${tenantId}:${customerUid}`;
    inMemoryCustomerProfiles[key] = profile;

    const db = getFirestoreDb();
    if (db) {
      await db
        .collection('tenants')
        .doc(tenantId)
        .collection('customers')
        .doc(customerUid)
        .set(cleanUndefined(profile), { merge: false });
    } else if (!isDemoMode() && !isTestMode()) {
      throw new Error(
        'Customer account persistence is unavailable: Firestore is required outside demo/test mode.'
      );
    }

    return profile;
  }

  /**
   * Finds an OrderProjection by paymentId.
   */
  static async findOrderProjectionByPaymentId(paymentId: string): Promise<OrderProjection | null> {
    for (const order of Object.values(inMemoryOrderProjections)) {
      if (order.paymentId === paymentId) {
        return order;
      }
    }
    const db = getFirestoreDb();
    if (!db) return null;
    try {
      const snap = await db.collection('orderProjections').where('paymentId', '==', paymentId).limit(1).get();
      if (!snap.empty) {
        const order = snap.docs[0].data() as OrderProjection;
        inMemoryOrderProjections[order.orderId] = order;
        return order;
      }
    } catch (err) {
      console.warn('[Firestore Admin] Could not find order by paymentId:', err);
    }
    return null;
  }

  /**
   * Finds an existing payment projection by the stable customer order reference.
   * Used to make DPay pre-authorisation retry-safe when Retail order submission
   * fails after the PSP has already authorised the card.
   */
  static async getPaymentProjectionByOrderReference(
    orderReference: string,
    tenantId?: string
  ): Promise<DomainPaymentProjection | null> {
    if (!orderReference) return null;

    for (const payment of Object.values(inMemoryPaymentProjections)) {
      if (
        payment.orderReference === orderReference &&
        (!tenantId || payment.tenantId === tenantId)
      ) {
        return payment;
      }
    }

    const db = getFirestoreDb();
    if (!db) return null;
    try {
      let query: any = db
        .collection('paymentProjections')
        .where('orderReference', '==', orderReference);
      if (tenantId) {
        query = query.where('tenantId', '==', tenantId);
      }
      const snap = await query.limit(1).get();
      if (!snap.empty) {
        const payment = snap.docs[0].data() as DomainPaymentProjection;
        inMemoryPaymentProjections[payment.paymentId] = payment;
        return payment;
      }
    } catch (err) {
      console.warn('[Firestore Admin] Could not find payment by orderReference:', err);
    }
    return null;
  }

  /**
   * Saves or updates a CheckoutProjection (CHECK-01, CHECK-02).
   */
  static async saveCheckoutProjection(checkout: CheckoutResult): Promise<void> {
    inMemoryCheckouts[checkout.checkoutId] = checkout;
    const db = getFirestoreDb();
    if (!db) {
      if (!isDemoMode() && process.env.NODE_ENV !== 'test') {
        throw new Error('Database persistence is unavailable. Saving checkout projection rejected outside demo mode.');
      }
      return;
    }
    try {
      await db.collection('checkouts').doc(checkout.checkoutId).set(cleanUndefined(checkout), { merge: true });
    } catch (err) {
      console.warn('[Firestore Admin] Could not save checkout to Firestore:', err);
      if (!isDemoMode() && process.env.NODE_ENV !== 'test') {
        throw err;
      }
    }
  }

  /**
   * Retrieves a Checkout by checkoutId.
   */
  static async getCheckoutProjection(checkoutId: string): Promise<CheckoutResult | null> {
    if (inMemoryCheckouts[checkoutId]) {
      return inMemoryCheckouts[checkoutId];
    }
    const db = getFirestoreDb();
    if (!db) return null;
    try {
      const snap = await db.collection('checkouts').doc(checkoutId).get();
      if (snap.exists) {
        const data = snap.data() as CheckoutResult;
        inMemoryCheckouts[checkoutId] = data;
        return data;
      }
    } catch (err) {
      console.warn('[Firestore Admin] Could not get checkout from Firestore:', err);
    }
    return null;
  }

  /**
   * Finds an existing checkout for a basket.
   *
   * Deliverect permits a basket to create one checkout session. This lookup is
   * therefore the primary retry/idempotency boundary for checkout: a browser
   * retry, lost HTTP response, or reopened modal must recover the existing
   * checkout instead of POSTing a second checkout for the same basket.
   */
  static async getCheckoutByBasketId(
    basketId: string,
    tenantId?: string
  ): Promise<CheckoutResult | null> {
    if (!basketId) return null;

    for (const checkout of Object.values(inMemoryCheckouts)) {
      if (
        checkout.basketId === basketId &&
        (!tenantId || checkout.tenantId === tenantId)
      ) {
        return checkout;
      }
    }

    const db = getFirestoreDb();
    if (!db) return null;

    try {
      let query: any = db
        .collection('checkouts')
        .where('basketId', '==', basketId);

      if (tenantId) {
        query = query.where('tenantId', '==', tenantId);
      }

      const snap = await query.limit(1).get();
      if (!snap.empty) {
        const data = snap.docs[0].data() as CheckoutResult;
        inMemoryCheckouts[data.checkoutId] = data;
        return data;
      }
    } catch (err) {
      console.warn('[Firestore Admin] Could not query checkout by basketId:', err);
    }

    return null;
  }

  /**
   * Finds existing checkout by idempotency key (CHECK-02: idempotent checkout).
   */
  static async getCheckoutByIdempotencyKey(idempotencyKey: string): Promise<CheckoutResult | null> {
    if (!idempotencyKey) return null;
    for (const c of Object.values(inMemoryCheckouts)) {
      if (c.idempotencyKey === idempotencyKey) return c;
    }
    const db = getFirestoreDb();
    if (!db) return null;
    try {
      const snap = await db.collection('checkouts').where('idempotencyKey', '==', idempotencyKey).limit(1).get();
      if (!snap.empty) {
        const data = snap.docs[0].data() as CheckoutResult;
        inMemoryCheckouts[data.checkoutId] = data;
        return data;
      }
    } catch (err) {
      console.warn('[Firestore Admin] Could not query checkout by idempotencyKey:', err);
    }
    return null;
  }

  /**
   * Finds checkout by channelOrderReference.
   */
  static async getCheckoutByReference(channelOrderReference: string): Promise<CheckoutResult | null> {
    if (!channelOrderReference) return null;
    for (const c of Object.values(inMemoryCheckouts)) {
      if (c.channelOrderReference === channelOrderReference) return c;
    }
    const db = getFirestoreDb();
    if (!db) return null;
    try {
      const snap = await db.collection('checkouts').where('channelOrderReference', '==', channelOrderReference).limit(1).get();
      if (!snap.empty) {
        const data = snap.docs[0].data() as CheckoutResult;
        inMemoryCheckouts[data.checkoutId] = data;
        return data;
      }
    } catch (err) {
      console.warn('[Firestore Admin] Could not query checkout by channelOrderReference:', err);
    }
    return null;
  }

  /**
   * Updates checkout status and optional order reference.
   */
  static async updateCheckoutStatus(
    checkoutId: string,
    status: CheckoutStatus,
    details?: { orderId?: string; failureReason?: string }
  ): Promise<CheckoutResult | null> {
    const existing = await this.getCheckoutProjection(checkoutId);
    if (!existing) return null;

    const updated: CheckoutResult = {
      ...existing,
      status,
      orderId: details?.orderId || existing.orderId,
      failureReason: details?.failureReason || existing.failureReason,
      updatedAt: new Date().toISOString(),
    };

    inMemoryCheckouts[checkoutId] = updated;

    const db = getFirestoreDb();
    if (db) {
      try {
        await db.collection('checkouts').doc(checkoutId).set(cleanUndefined(updated), { merge: true });
      } catch (err) {
        console.warn('[Firestore Admin] Failed to update checkout in Firestore:', err);
      }
    }

    return updated;
  }

  /**
   * Updates picking state for an order projection.
   */
  static async updateOrderPickingState(
    orderId: string,
    pickingUpdate: Partial<PickingState>
  ): Promise<OrderProjection | null> {
    const existing = await this.getOrderProjection(orderId);
    if (!existing) return null;

    const currentPicking: PickingState = existing.picking || {
      status: 'NOT_STARTED',
      totalItems: 0,
      itemsPicked: 0,
      hasChanges: false,
      items: [],
    };

    const updatedPicking: PickingState = {
      ...currentPicking,
      ...pickingUpdate,
      items: pickingUpdate.items || currentPicking.items,
    };

    existing.picking = updatedPicking;
    existing.updatedAt = new Date().toISOString();

    inMemoryOrderProjections[orderId] = existing;
    const db = getFirestoreDb();
    if (db) {
      try {
        await db.collection('orderProjections').doc(orderId).set(cleanUndefined(existing), { merge: true });
      } catch (err) {
        console.warn('[Firestore Admin] Failed to update picking state:', err);
      }
    }
    return existing;
  }

  /**
   * Updates a specific picking item inside an order projection.
   */
  static async updateOrderPickingItem(
    orderId: string,
    plu: string,
    itemUpdate: Partial<PickingItem>
  ): Promise<OrderProjection | null> {
    const existing = await this.getOrderProjection(orderId);
    if (!existing) return null;

    if (!existing.picking) {
      existing.picking = {
        status: 'IN_PROGRESS',
        totalItems: 0,
        itemsPicked: 0,
        hasChanges: false,
        items: [],
      };
    }

    let item = existing.picking.items.find((i) => i.plu === plu);
    if (!item) {
      item = {
        id: `item_${plu}`,
        plu,
        name: (itemUpdate as any).name || plu,
        originalQuantity: itemUpdate.originalQuantity || 1,
        pickedQuantity: itemUpdate.pickedQuantity || 0,
        originalPrice: itemUpdate.originalPrice || { amount: 0, currency: 'GBP' },
        finalPrice: itemUpdate.finalPrice || { amount: 0, currency: 'GBP' },
        state: itemUpdate.state || 'PENDING',
        ...itemUpdate,
      };
      existing.picking.items.push(item);
      existing.picking.totalItems = existing.picking.items.length;
    } else {
      Object.assign(item, itemUpdate);
    }

    existing.picking.itemsPicked = existing.picking.items.filter((i) => i.state !== 'PENDING').length;
    if (item.state === 'SUBSTITUTED' || item.state === 'QUANTITY_AMENDED' || item.state === 'REMOVED') {
      existing.picking.hasChanges = true;
    }

    // Note: Do not overwrite existing.total (original placed order total) or fabricate
    // finalAmount here. Final financial calculations are canonically owned by
    // PaymentService.calculateAuthoritativeFinalAmount(order).
    existing.updatedAt = new Date().toISOString();

    inMemoryOrderProjections[orderId] = existing;
    const db = getFirestoreDb();
    if (db) {
      try {
        await db.collection('orderProjections').doc(orderId).set(cleanUndefined(existing), { merge: true });
      } catch (err) {
        console.warn('[Firestore Admin] Failed to update picking item:', err);
      }
    }
    return existing;
  }

  /**
   * Retrieves a line item from order projection by PLU.
   */
  static async getOrderLineItem(orderId: string, plu: string): Promise<PickingItem | null> {
    const existing = await this.getOrderProjection(orderId);
    if (!existing || !existing.picking?.items) return null;
    return existing.picking.items.find((i) => i.plu === plu) || null;
  }

  /**
   * Retrieves an order projection by order ID.
   */
  static async getOrderProjection(orderId: string): Promise<OrderProjection | null> {
    if (inMemoryOrderProjections[orderId]) {
      return inMemoryOrderProjections[orderId];
    }
    const db = getFirestoreDb();
    if (!db) return null;
    try {
      const snap = await db.collection('orderProjections').doc(orderId).get();
      if (snap.exists) {
        const data = snap.data() as OrderProjection;
        inMemoryOrderProjections[orderId] = data;
        return data;
      }
    } catch (err) {
      console.warn('[Firestore Admin] Could not fetch order projection:', err);
    }
    return null;
  }

  /**
   * Retrieves an order projection by checkout ID.
   */
  static async getOrderProjectionByCheckoutId(checkoutId: string): Promise<OrderProjection | null> {
    for (const p of Object.values(inMemoryOrderProjections)) {
      if (p.checkoutId === checkoutId) return p;
    }
    const db = getFirestoreDb();
    if (!db) return null;
    try {
      const snap = await db.collection('orderProjections').where('checkoutId', '==', checkoutId).limit(1).get();
      if (!snap.empty) {
        const data = snap.docs[0].data() as OrderProjection;
        inMemoryOrderProjections[data.orderId] = data;
        return data;
      }
    } catch (err) {
      console.warn('[Firestore Admin] Could not query order by checkoutId:', err);
    }
    return null;
  }

  /**
   * Universal resolver for finding an order projection by any external or internal correlation identifier.
   */
  static async getOrderProjectionByExternalIdentifier(value: string): Promise<OrderProjection | null> {
    if (!value) return null;

    const direct = await this.getOrderProjection(value);
    if (direct) return direct;

    const byCheckout = await this.getOrderProjectionByCheckoutId(value);
    if (byCheckout) return byCheckout;

    const byReference = await this.getOrderProjectionByReference(value);
    if (byReference) return byReference;

    for (const p of Object.values(inMemoryOrderProjections)) {
      if (
        p.basketId === value ||
        p.channelOrderId === value ||
        p.channelOrderDisplayId === value ||
        p.channelOrderRawId === value
      ) {
        return p;
      }
    }

    const db = getFirestoreDb();
    if (!db) return null;

    const fields = ['basketId', 'channelOrderId', 'channelOrderDisplayId', 'channelOrderRawId'];
    for (const field of fields) {
      try {
        const snap = await db.collection('orderProjections').where(field, '==', value).limit(1).get();
        if (!snap.empty) {
          const data = snap.docs[0].data() as OrderProjection;
          inMemoryOrderProjections[data.orderId] = data;
          return data;
        }
      } catch (err) {
        console.warn(`[Firestore Admin] Could not query order by ${field}:`, err);
      }
    }

    return null;
  }

  /**
   * Retrieves an order projection by external order reference.
   */
  static async getOrderProjectionByReference(orderReference: string): Promise<OrderProjection | null> {
    for (const p of Object.values(inMemoryOrderProjections)) {
      if (p.orderReference === orderReference || p.channelOrderReference === orderReference) {
        return p;
      }
    }
    const db = getFirestoreDb();
    if (!db) return null;
    try {
      const snap = await db.collection('orderProjections').where('orderReference', '==', orderReference).limit(1).get();
      if (!snap.empty) {
        const data = snap.docs[0].data() as OrderProjection;
        inMemoryOrderProjections[data.orderId] = data;
        return data;
      }
    } catch (err) {
      console.warn('[Firestore Admin] Could not query order by orderReference:', err);
    }
    return null;
  }

  /**
   * Lists order projections, optionally filtered by tenantId.
   */
  static async listOrderProjections(tenantId?: string, limit = 100): Promise<OrderProjection[]> {
    const memoryOrders = Object.values(inMemoryOrderProjections)
      .filter((p) => !tenantId || p.tenantId === tenantId)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    const db = getFirestoreDb();
    if (!db) return memoryOrders.slice(0, limit);

    try {
      let query: any = db.collection('orderProjections');
      if (tenantId) {
        query = query.where('tenantId', '==', tenantId);
      }
      query = query.orderBy('createdAt', 'desc').limit(limit);
      const snap = await query.get();
      if (!snap.empty) {
        const results: OrderProjection[] = [];
        snap.forEach((doc: any) => results.push(doc.data() as OrderProjection));
        return results;
      }
    } catch (err) {
      console.warn('[Firestore Admin] Could not list order projections from DB:', err);
    }
    return memoryOrders.slice(0, limit);
  }

  /**
   * Lists orders owned by one authenticated customer within one tenant.
   * Sorting happens in-process so this query does not depend on a composite
   * Firestore index. Cross-tenant results are always discarded.
   */
  static async listCustomerOrderProjections(
    tenantId: string,
    customerUid: string,
    limit = 50
  ): Promise<OrderProjection[]> {
    if (!tenantId || !customerUid) return [];

    const fromMemory = Object.values(inMemoryOrderProjections)
      .filter(
        (order) =>
          order.tenantId === tenantId &&
          order.customerUid === customerUid
      );

    const db = getFirestoreDb();
    let results = fromMemory;

    if (db) {
      try {
        const snap = await db
          .collection('orderProjections')
          .where('customerUid', '==', customerUid)
          .limit(Math.max(limit * 2, 50))
          .get();

        results = snap.docs
          .map((doc) => doc.data() as OrderProjection)
          .filter((order) => order.tenantId === tenantId);

        for (const order of results) {
          inMemoryOrderProjections[order.orderId] = order;
        }
      } catch (err) {
        console.warn(
          '[Firestore Admin] Could not list customer order projections:',
          err
        );
      }
    }

    return results
      .sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
      )
      .slice(0, limit);
  }

  /**
   * Updates state on an existing order projection.
   */
  static async updateOrderProjectionState(
    orderId: string,
    newState: string,
    metadata?: Record<string, any>
  ): Promise<OrderProjection | null> {
    const existing = await this.getOrderProjection(orderId);
    if (!existing) return null;

    const finalAmount =
      metadata?.finalAmount !== undefined
        ? metadata.finalAmount
        : existing.finalAmount;

    const updated: OrderProjection = {
      ...existing,
      status: newState,
      paymentState: metadata?.paymentState || existing.paymentState,
      finalAmount,
      capturedAmount: metadata?.capturedAmount !== undefined ? metadata.capturedAmount : existing.capturedAmount,
      residualHoldReleased: metadata?.residualHoldReleased !== undefined ? metadata.residualHoldReleased : existing.residualHoldReleased,
      settlementDetails: metadata?.settlementDetails || existing.settlementDetails,
      paymentId: metadata?.paymentId || existing.paymentId,
      channelOrderId: metadata?.channelOrderId || existing.channelOrderId,
      channelOrderDisplayId: metadata?.channelOrderDisplayId || existing.channelOrderDisplayId,
      channelOrderRawId: metadata?.channelOrderRawId || existing.channelOrderRawId,
      orderReference: metadata?.orderReference || existing.orderReference,
      channelOrderReference: metadata?.channelOrderReference || existing.channelOrderReference,
      metadata: {
        ...(existing.metadata || {}),
        ...(metadata || {}),
      },
      updatedAt: new Date().toISOString(),
    };

    inMemoryOrderProjections[orderId] = updated;

    const db = getFirestoreDb();
    if (db) {
      try {
        await db.collection('orderProjections').doc(orderId).set(cleanUndefined(updated), { merge: true });
      } catch (err) {
        console.warn('[Firestore Admin] Failed to update order projection state:', err);
      }
    }

    return updated;
  }

  /**
   * Updates dispatch state record on an existing order projection.
   */
  static async updateOrderDispatchState(
    orderId: string,
    dispatch: DispatchStateRecord
  ): Promise<OrderProjection | null> {
    const existing = await this.getOrderProjection(orderId);
    if (!existing) return null;

    const updated: OrderProjection = {
      ...existing,
      dispatch,
      updatedAt: new Date().toISOString(),
    };

    inMemoryOrderProjections[orderId] = updated;

    const db = getFirestoreDb();
    if (db) {
      try {
        await db.collection('orderProjections').doc(orderId).set(cleanUndefined(updated), { merge: true });
      } catch (err) {
        console.warn('[Firestore Admin] Failed to update order dispatch state:', err);
      }
    }

    return updated;
  }

  /**
   * Inbound webhook event journaling (WH-01, WH-02).
   */
  static async recordWebhookEvent(event: WebhookEvent): Promise<void> {
    inMemoryWebhookEvents[event.externalEventKey] = event;
    const db = getFirestoreDb();
    if (!db) return;
    try {
      await db.collection('webhookEvents').doc(event.webhookEventId).set(cleanUndefined(event), { merge: true });
    } catch (err) {
      console.warn('[Firestore Admin] Failed to journal webhook event to Firestore:', err);
    }
  }

  /**
   * Webhook deduplication lookup by external event key.
   */
  static async getWebhookEvent(externalEventKey: string): Promise<WebhookEvent | null> {
    if (inMemoryWebhookEvents[externalEventKey]) {
      return inMemoryWebhookEvents[externalEventKey];
    }
    const db = getFirestoreDb();
    if (!db) return null;
    try {
      const snap = await db.collection('webhookEvents').where('externalEventKey', '==', externalEventKey).limit(1).get();
      if (!snap.empty) {
        const data = snap.docs[0].data() as WebhookEvent;
        inMemoryWebhookEvents[externalEventKey] = data;
        return data;
      }
    } catch (err) {
      console.warn('[Firestore Admin] Failed to query webhook event from Firestore:', err);
    }
    return null;
  }

  /**
   * Atomic idempotency claim using a dedicated claim document:
   * webhookIdempotency/{provider}_{externalEventKey}
   * Prevents race conditions from concurrent duplicate webhook deliveries.
   */
  static async claimWebhookIdempotency(
    provider: string,
    externalEventKey: string,
    webhookEventId: string
  ): Promise<{ claimed: boolean; existingEventId?: string }> {
    const claimKey = `${provider}_${externalEventKey}`.replace(/[^a-zA-Z0-9_-]/g, '_');

    if (inMemoryWebhookClaims[claimKey]) {
      return { claimed: false, existingEventId: inMemoryWebhookClaims[claimKey] };
    }

    const db = getFirestoreDb();
    if (!db) {
      inMemoryWebhookClaims[claimKey] = webhookEventId;
      return { claimed: true };
    }

    try {
      const claimRef = db.collection('webhookIdempotency').doc(claimKey);
      return await db.runTransaction(async (tx) => {
        const doc = await tx.get(claimRef);
        if (doc.exists) {
          const data = doc.data();
          const existingId = data?.webhookEventId || webhookEventId;
          inMemoryWebhookClaims[claimKey] = existingId;
          return { claimed: false, existingEventId: existingId };
        }
        tx.set(claimRef, {
          provider,
          externalEventKey,
          webhookEventId,
          claimedAt: new Date().toISOString(),
        });
        inMemoryWebhookClaims[claimKey] = webhookEventId;
        return { claimed: true };
      });
    } catch (err: any) {
      if (err?.code === 6 || String(err).includes('ALREADY_EXISTS')) {
        return { claimed: false, existingEventId: inMemoryWebhookClaims[claimKey] || webhookEventId };
      }
      console.warn('[Firestore Admin] Webhook idempotency claim warning, falling back to memory:', err);
      if (inMemoryWebhookClaims[claimKey] && inMemoryWebhookClaims[claimKey] !== webhookEventId) {
        return { claimed: false, existingEventId: inMemoryWebhookClaims[claimKey] };
      }
      inMemoryWebhookClaims[claimKey] = webhookEventId;
      return { claimed: true };
    }
  }

  /**
   * Updates processing status of a journaled webhook event.
   */
  static async updateWebhookEventStatus(
    webhookEventId: string,
    status: 'PENDING' | 'PROCESSED' | 'FAILED',
    errorCode?: string
  ): Promise<void> {
    for (const evt of Object.values(inMemoryWebhookEvents)) {
      if (evt.webhookEventId === webhookEventId) {
        evt.processingStatus = status;
        evt.processedAt = new Date().toISOString();
        if (errorCode) evt.errorCode = errorCode;
      }
    }
    const db = getFirestoreDb();
    if (!db) return;
    try {
      await db.collection('webhookEvents').doc(webhookEventId).set(
        {
          processingStatus: status,
          processedAt: new Date().toISOString(),
          ...(errorCode ? { errorCode } : {}),
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('[Firestore Admin] Failed to update webhook event status in Firestore:', err);
    }
  }

  /**
   * Saves or updates a payment projection in Firestore and in-memory cache.
   */
  static async savePaymentProjection(projection: DomainPaymentProjection): Promise<DomainPaymentProjection> {
    inMemoryPaymentProjections[projection.paymentId] = projection;
    const db = getFirestoreDb();
    if (db) {
      try {
        await db.collection('paymentProjections').doc(projection.paymentId).set(cleanUndefined(projection), { merge: true });
      } catch (err) {
        console.warn('[Firestore Admin] Failed to save payment projection to Firestore:', err);
      }
    }
    return projection;
  }

  /**
   * Retrieves a payment projection by paymentId.
   */
  static async getPaymentProjection(paymentId: string): Promise<DomainPaymentProjection | null> {
    if (inMemoryPaymentProjections[paymentId]) {
      return inMemoryPaymentProjections[paymentId];
    }
    const db = getFirestoreDb();
    if (!db) return null;
    try {
      const doc = await db.collection('paymentProjections').doc(paymentId).get();
      if (doc.exists) {
        const data = doc.data() as DomainPaymentProjection;
        inMemoryPaymentProjections[paymentId] = data;
        return data;
      }
    } catch (err) {
      console.warn('[Firestore Admin] Failed to get payment projection from Firestore:', err);
    }
    return null;
  }

  /**
   * Updates fields of an existing payment projection.
   */
  static async updatePaymentProjection(
    paymentId: string,
    updates: Partial<DomainPaymentProjection>
  ): Promise<DomainPaymentProjection | null> {
    const existing = await this.getPaymentProjection(paymentId);
    if (!existing) return null;

    const updated: DomainPaymentProjection = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    inMemoryPaymentProjections[paymentId] = updated;

    const db = getFirestoreDb();
    if (db) {
      try {
        await db.collection('paymentProjections').doc(paymentId).set(cleanUndefined(updated), { merge: true });
      } catch (err) {
        console.warn('[Firestore Admin] Failed to update payment projection in Firestore:', err);
      }
    }
    return updated;
  }

  // ==========================================
  // ANALYTICS EVENTS (Phase 14 & Phase 17 Scale)
  // ==========================================
  static async saveAnalyticsEvent(event: AnalyticsEvent): Promise<AnalyticsEvent> {
    return (await this.saveAnalyticsEventsBatch([event]))[0] || event;
  }

  static async saveAnalyticsEventsBatch(events: AnalyticsEvent[]): Promise<AnalyticsEvent[]> {
    if (!events || events.length === 0) return [];

    const MAX_IN_MEMORY_EVENTS_PER_TENANT = 5000;

    for (const event of events) {
      if (!inMemoryAnalyticsEvents[event.tenantId]) {
        inMemoryAnalyticsEvents[event.tenantId] = [];
      }
      inMemoryAnalyticsEvents[event.tenantId].push(event);

      // Memory bound check per Section 45
      if (inMemoryAnalyticsEvents[event.tenantId].length > MAX_IN_MEMORY_EVENTS_PER_TENANT) {
        inMemoryAnalyticsEvents[event.tenantId].splice(0, inMemoryAnalyticsEvents[event.tenantId].length - MAX_IN_MEMORY_EVENTS_PER_TENANT);
      }
    }

    const db = getFirestoreDb();
    if (db) {
      try {
        // Chunk by 500 (Firestore maximum batch size limit)
        const CHUNK_SIZE = 500;
        for (let i = 0; i < events.length; i += CHUNK_SIZE) {
          const chunk = events.slice(i, i + CHUNK_SIZE);
          const batch = db.batch();
          for (const ev of chunk) {
            const ref = db.collection('analyticsEvents').doc(ev.id);
            batch.set(ref, cleanUndefined(ev));
          }
          await batch.commit();
        }
      } catch (err) {
        console.warn('[Firestore Admin] Failed to save analytics events batch to Firestore:', err);
      }
    }
    return events;
  }

  static async getAnalyticsEvents(tenantId: string, limit = 1000): Promise<AnalyticsEvent[]> {
    const memEvents = inMemoryAnalyticsEvents[tenantId] || [];
    if (isFirestorePermissionDenied()) {
      return [...memEvents].slice(-limit);
    }
    const db = getFirestoreDb();
    if (!db) {
      return [...memEvents].slice(-limit);
    }
    try {
      const snap = await db.collection('analyticsEvents')
        .where('tenantId', '==', tenantId)
        .limit(limit)
        .get();
      if (!snap.empty) {
        const events: AnalyticsEvent[] = [];
        snap.forEach(doc => events.push(doc.data() as AnalyticsEvent));
        return events;
      }
    } catch (err: any) {
      if (isFirestorePermissionDeniedError(err)) {
        markFirestorePermissionDenied(err);
      } else {
        console.warn('[Firestore Admin] Failed to query analytics events from Firestore:', err);
      }
    }
    return [...memEvents].slice(-limit);
  }

  // ==========================================
  // NOTIFICATION SUBSCRIPTIONS & INBOX (Phase 14)
  // ==========================================
  static async saveNotificationSubscription(sub: NotificationSubscription): Promise<NotificationSubscription> {
    inMemoryNotificationSubscriptions[sub.subscriptionId] = sub;
    const db = getFirestoreDb();
    if (db) {
      try {
        await db.collection('notificationSubscriptions').doc(sub.subscriptionId).set(cleanUndefined(sub), { merge: true });
      } catch (err) {
        console.warn('[Firestore Admin] Failed to save notification subscription to Firestore:', err);
      }
    }
    return sub;
  }

  static async getNotificationSubscriptions(tenantId: string, customerUid?: string, sessionId?: string): Promise<NotificationSubscription[]> {
    const list = Object.values(inMemoryNotificationSubscriptions).filter(s => {
      if (s.tenantId !== tenantId) return false;
      if (customerUid && s.customerUid === customerUid) return true;
      if (sessionId && s.sessionId === sessionId) return true;
      return !customerUid && !sessionId;
    });

    const db = getFirestoreDb();
    if (!db) return list;
    try {
      let query: any = db.collection('notificationSubscriptions').where('tenantId', '==', tenantId);
      if (customerUid) {
        query = query.where('customerUid', '==', customerUid);
      }
      const snap = await query.get();
      if (!snap.empty) {
        const result: NotificationSubscription[] = [];
        snap.forEach((doc: any) => result.push(doc.data() as NotificationSubscription));
        return result;
      }
    } catch (err) {
      console.warn('[Firestore Admin] Failed to query notification subscriptions from Firestore:', err);
    }
    return list;
  }

  static async createNotification(notification: DomainNotification): Promise<DomainNotification> {
    inMemoryNotifications[notification.notificationId] = notification;
    const db = getFirestoreDb();
    if (db) {
      try {
        await db.collection('notifications').doc(notification.notificationId).set(cleanUndefined(notification));
      } catch (err) {
        console.warn('[Firestore Admin] Failed to save notification to Firestore:', err);
      }
    }
    return notification;
  }

  static async getCustomerNotifications(tenantId: string, customerUid?: string, sessionId?: string): Promise<DomainNotification[]> {
    const list = Object.values(inMemoryNotifications).filter(n => {
      if (n.tenantId !== tenantId) return false;
      if (customerUid && n.recipientUid === customerUid) return true;
      if (sessionId && n.recipientSessionId === sessionId) return true;
      return false;
    });

    const db = getFirestoreDb();
    if (!db) return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    try {
      let query: any = db.collection('notifications').where('tenantId', '==', tenantId);
      if (customerUid) {
        query = query.where('recipientUid', '==', customerUid);
      }
      const snap = await query.get();
      if (!snap.empty) {
        const result: DomainNotification[] = [];
        snap.forEach((doc: any) => result.push(doc.data() as DomainNotification));
        return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      }
    } catch (err) {
      console.warn('[Firestore Admin] Failed to query notifications from Firestore:', err);
    }
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  static async markNotificationAsRead(notificationId: string): Promise<boolean> {
    if (inMemoryNotifications[notificationId]) {
      inMemoryNotifications[notificationId].read = true;
    }
    const db = getFirestoreDb();
    if (db) {
      try {
        await db.collection('notifications').doc(notificationId).set({ read: true }, { merge: true });
        return true;
      } catch (err) {
        console.warn('[Firestore Admin] Failed to mark notification as read in Firestore:', err);
      }
    }
    return inMemoryNotifications[notificationId] !== undefined;
  }

  static async getTenantStores(tenantId: string = 'brand-alpha'): Promise<any[]> {
    const db = getFirestoreDb();
    if (db) {
      try {
        // Primary location: tenants/{tenantId}/commerceStores/{channelLinkId}
        const snap = await db.collection('tenants').doc(tenantId).collection('commerceStores').get();
        if (!snap.empty) {
          const stores: any[] = [];
          snap.forEach((doc: any) => {
            const data = doc.data();
            stores.push({
              ...data,
              id: data.channelLinkId || data.commerceStoreId || doc.id,
              channelLinkId: data.channelLinkId || doc.id,
            });
          });
          return stores;
        }

        // Migration fallback: legacy root collection commerceStores
        const legacySnap = await db.collection('commerceStores').where('tenantId', '==', tenantId).get();
        if (!legacySnap.empty) {
          const stores: any[] = [];
          legacySnap.forEach((doc: any) => {
            const data = doc.data();
            stores.push({
              ...data,
              id: data.channelLinkId || data.commerceStoreId || doc.id,
              channelLinkId: data.channelLinkId || doc.id,
            });
          });
          return stores;
        }
      } catch (err) {
        console.warn('[Firestore Admin] Failed to query commerceStores from Firestore:', err);
      }
    }
    // Return empty array for unconfigured/unmapped stores - no mock fallback in live/production
    return [];
  }

  static async saveTenantStore(tenantId: string, store: any): Promise<any> {
    const channelLinkId = store.channelLinkId || store.id || store.commerceStoreId;
    if (!channelLinkId) {
      throw new Error('Cannot save commerceStore without channelLinkId or store id');
    }
    const item = {
      ...store,
      tenantId,
      channelLinkId,
      updatedAt: new Date().toISOString(),
    };
    const db = getFirestoreDb();
    if (!db && !isDemoMode()) {
      throw new Error('Location changes were not saved: durable storage is unavailable.');
    }
    if (db) {
      try {
        // Unified location: tenants/{tenantId}/commerceStores/{channelLinkId}
        await db.collection('tenants').doc(tenantId).collection('commerceStores').doc(channelLinkId).set(item, { merge: true });
      } catch (err) {
        console.warn('[Firestore Admin] Failed to save commerceStore to Firestore:', err);
        if (!isDemoMode()) throw new Error('Location changes were not saved: Firestore rejected the write. Check runtime storage access.');
      }
    }
    return item;
  }

  static async getTenantRules(tenantId: string = 'brand-alpha'): Promise<any[]> {
    const db = getFirestoreDb();
    if (db) {
      try {
        const snap = await db.collection('searchRules').where('tenantId', '==', tenantId).get();
        if (!snap.empty) {
          const rules: any[] = [];
          snap.forEach((doc: any) => rules.push(doc.data()));
          return rules;
        }
      } catch (err) {
        console.warn('[Firestore Admin] Failed to query searchRules from Firestore:', err);
      }
    }
    return [];
  }

  static async saveTenantRule(tenantId: string, rule: any): Promise<any> {
    const ruleId = rule.id || `rule_${Date.now()}`;
    const item = { ...rule, id: ruleId, tenantId, updatedAt: new Date().toISOString() };
    const db = getFirestoreDb();
    if (db) {
      try {
        await db.collection('searchRules').doc(ruleId).set(item, { merge: true });
      } catch (err) {
        console.warn('[Firestore Admin] Failed to save rule to Firestore:', err);
      }
    }
    return item;
  }

  static async deleteTenantRule(tenantId: string, ruleId: string): Promise<boolean> {
    const db = getFirestoreDb();
    if (db) {
      try {
        await db.collection('searchRules').doc(ruleId).delete();
        return true;
      } catch (err) {
        console.warn('[Firestore Admin] Failed to delete rule from Firestore:', err);
      }
    }
    return true;
  }

  static async getTenantSearchConfig(tenantId: string = 'brand-alpha'): Promise<any> {
    if (inMemorySearchConfigs[tenantId]) {
      return inMemorySearchConfigs[tenantId];
    }
    const db = getFirestoreDb();
    if (db) {
      try {
        const doc = await db.collection('tenants').doc(tenantId).collection('searchConfig').doc('default').get();
        if (doc.exists) {
          const data = doc.data();
          inMemorySearchConfigs[tenantId] = data;
          return data;
        }
      } catch (err) {
        console.warn('[Firestore Admin] Failed to get search config from Firestore:', err);
      }
    }
    return inMemorySearchConfigs[tenantId] || null;
  }

  static async saveTenantSearchConfig(tenantId: string, config: any): Promise<any> {
    const item = {
      ...config,
      tenantId,
      updatedAt: new Date().toISOString(),
    };
    inMemorySearchConfigs[tenantId] = item;
    const db = getFirestoreDb();
    if (db) {
      try {
        await db.collection('tenants').doc(tenantId).collection('searchConfig').doc('default').set(item, { merge: true });
      } catch (err) {
        console.warn('[Firestore Admin] Failed to save search config to Firestore:', err);
      }
    }
    return item;
  }

  static async getTenantDispatchRules(tenantId: string = 'brand-alpha'): Promise<TenantDispatchRules> {
    if (inMemoryDispatchRules[tenantId]) {
      return inMemoryDispatchRules[tenantId];
    }
    const db = getFirestoreDb();
    if (db) {
      try {
        const doc = await db.collection('tenants').doc(tenantId).collection('dispatchRules').doc('default').get();
        if (doc.exists) {
          const data = doc.data() as TenantDispatchRules;
          inMemoryDispatchRules[tenantId] = { ...DEFAULT_DISPATCH_RULES, ...data };
          return inMemoryDispatchRules[tenantId];
        }
      } catch (err) {
        console.warn('[Firestore Admin] Failed to get tenant dispatch rules from Firestore:', err);
      }
    }
    return { ...DEFAULT_DISPATCH_RULES };
  }

  static async saveTenantDispatchRules(
    tenantId: string = 'brand-alpha',
    rules: Partial<TenantDispatchRules>
  ): Promise<TenantDispatchRules> {
    const existing = await this.getTenantDispatchRules(tenantId);
    const updated: TenantDispatchRules = {
      ...existing,
      ...rules,
    };
    inMemoryDispatchRules[tenantId] = updated;
    const db = getFirestoreDb();
    if (db) {
      try {
        await db.collection('tenants').doc(tenantId).collection('dispatchRules').doc('default').set(cleanUndefined(updated), { merge: true });
      } catch (err) {
        console.warn('[Firestore Admin] Failed to save tenant dispatch rules to Firestore:', err);
      }
    }
    return updated;
  }
}

export const FirestorePlatformService = FirestoreService;
