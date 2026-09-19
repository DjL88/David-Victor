import type { AdminClient } from './AdminClient';
import { defaultHttpAdminClient } from './HttpAdminClient';
import {
  TenantConfig,
  Story,
  TenantFeePolicy,
  VisualRule,
  Store,
  AuditLogEntry,
  AdminUser,
  TenantFeatureFlags,
} from './models';
import { ALL_MOCK_ADMIN_USERS, MOCK_STORES, MOCK_VISUAL_RULES, MOCK_TENANTS } from './mockData';
import { DEFAULT_SCHEDULING_POLICY } from './slotEngine';
import { DEFAULT_SUBSTITUTION_POLICY } from './substitutionPricing';

export class DemoAdminClient implements AdminClient {
  private activeUser: AdminUser;
  private currentTenantId: string;
  private stories: Story[] = [];
  private rules: VisualRule[] = [...MOCK_VISUAL_RULES];
  private feePolicies: Record<string, TenantFeePolicy> = {};
  private tenants: Record<string, TenantConfig> = { ...MOCK_TENANTS };
  private cachedRealToken: string | null = null;

  setCachedRealToken(token: string | null): void {
    this.cachedRealToken = token;
  }

  async getHeadersAsync(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-tenant-id': this.currentTenantId,
    };
    if (this.cachedRealToken) {
      headers['Authorization'] = `Bearer ${this.cachedRealToken}`;
    } else {
      headers['Authorization'] = `Bearer dev_token_${this.activeUser?.role || 'tenantAdmin'}_${this.activeUser?.id || 'demo-admin'}`;
    }
    return headers;
  }

  constructor(initialTenantId: string = 'brand-alpha') {
    this.currentTenantId = initialTenantId;
    this.activeUser = ALL_MOCK_ADMIN_USERS[1] || ALL_MOCK_ADMIN_USERS[0];
  }

  setActiveAdminUser(user: AdminUser) {
    this.activeUser = user;
    this.currentTenantId = user.tenantId;
  }

  setMockRole(role: AdminUser['role']): void {
    const found = ALL_MOCK_ADMIN_USERS.find((u) => u.role === role);
    if (found) {
      this.activeUser = { ...found, tenantId: this.currentTenantId };
    } else {
      this.activeUser = { ...this.activeUser, role };
    }
  }

  async getCurrentAdminUser(_tenantId?: string): Promise<AdminUser> {
    return this.activeUser;
  }

  async switchTenantAsSuperAdmin(targetTenantId: string): Promise<void> {
    if (this.activeUser.role !== 'platformSuperAdmin') {
      throw new Error(`RBAC Violation: Role '${this.activeUser.role}' is not authorized to switch tenant contexts.`);
    }
    this.currentTenantId = targetTenantId;
  }

  async listAllTenants(): Promise<TenantConfig[]> {
    return Object.values(this.tenants);
  }

  async provisionBrand(brandData: Partial<TenantConfig> & { tenantId: string; brandName: string }): Promise<TenantConfig> {
    const newTenant: TenantConfig = {
      tenantId: brandData.tenantId,
      brandName: brandData.brandName,
      tagline: brandData.tagline || 'Fresh groceries delivered fast',
      logoUrl: brandData.logoUrl || '',
      iconUrl: brandData.iconUrl || '',
      faviconUrl: brandData.faviconUrl || '',
      status: brandData.status || 'ACTIVE',
      defaultDomain: brandData.defaultDomain || `${brandData.tenantId}.platform.local`,
      primaryColour: brandData.primaryColour || '#059669',
      secondaryColour: brandData.secondaryColour || '#f59e0b',
      backgroundColour: brandData.backgroundColour || '#f8fafc',
      textColour: brandData.textColour || '#0f172a',
      fontFamily: brandData.fontFamily || "'Plus Jakarta Sans', system-ui, sans-serif",
      borderRadius: brandData.borderRadius || '16px',
      currency: brandData.currency || 'GBP',
      currencySymbol: brandData.currencySymbol || '£',
      country: brandData.country || 'GB',
      locale: brandData.locale || 'en-GB',
      supportDetails: brandData.supportDetails || {
        email: 'support@brand.com',
        phone: '+44 800 123 4567',
        openingHours: 'Mon-Sun: 08:00 - 22:00',
        helpCenterUrl: '',
      },
      featureFlags: brandData.featureFlags || {
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
    this.tenants[brandData.tenantId] = newTenant;
    return newTenant;
  }

  async getIntegration(tenantId?: string): Promise<any> {
    const tId = tenantId || this.currentTenantId;
    return {
      tenantId: tId,
      environment: 'DEMO',
      status: 'DEMO_MODE',
      connectionState: 'CONNECTED_DEMO',
      lastCheckedAt: new Date().toISOString(),
      accountLinks: [
        {
          accountLinkId: `demo-link-${tId}`,
          deliverectAccountId: `demo-del-${tId}`,
          status: 'ACTIVE',
          displayName: `Demo Deliverect Account (${tId})`,
        },
      ],
    };
  }

  async updateIntegration(tenantId: string, updates: any): Promise<any> {
    return { tenantId, ...updates, updatedAt: new Date().toISOString() };
  }

  async uploadAsset(payload: {
    tenantId?: string;
    type: string;
    fileName: string;
    fileData: string;
    contentType?: string;
    byteSize?: number;
  }): Promise<any> {
    return {
      assetId: `demo_asset_${Date.now()}`,
      tenantId: payload.tenantId || this.currentTenantId,
      type: payload.type,
      fileName: payload.fileName,
      publicUrl: payload.fileData.startsWith('data:') ? payload.fileData : `https://images.unsplash.com/photo-1542838132-92c53300491e?w=800`,
      status: 'READY',
      createdAt: new Date().toISOString(),
    };
  }

  async uploadAssetFile(file: File, type: string, tenantId?: string): Promise<any> {
    return this.uploadAsset({
      tenantId: tenantId || this.currentTenantId,
      type,
      fileName: file.name,
      fileData: URL.createObjectURL(file),
      contentType: file.type,
      byteSize: file.size,
    });
  }

  async listAssets(_tenantId?: string, _type?: string): Promise<any[]> {
    return [];
  }

  async getBranding(tenantId?: string): Promise<TenantConfig & { id?: string }> {
    const tId = tenantId || this.currentTenantId;
    const config: TenantConfig = this.tenants[tId] || {
      tenantId: tId,
      brandName: 'Demo Store',
      tagline: 'Demo groceries in minutes',
      logoUrl: '',
      iconUrl: '',
      faviconUrl: '',
      status: 'ACTIVE',
      defaultDomain: `${tId}.platform.local`,
      primaryColour: '#059669',
      secondaryColour: '#f59e0b',
      backgroundColour: '#f8fafc',
      textColour: '#0f172a',
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      borderRadius: '16px',
      currency: 'GBP',
      currencySymbol: '£',
      country: 'GB',
      locale: 'en-GB',
      supportDetails: {
        email: 'support@demo.com',
        phone: '+44 800 123 4567',
        openingHours: 'Mon-Sun: 08:00 - 22:00',
        helpCenterUrl: '',
      },
      featureFlags: {
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
    return { ...config, id: tId };
  }

  async updateBranding(
    tenantIdOrBranding: string | Partial<TenantConfig>,
    brandingOrUser?: Partial<TenantConfig> | AdminUser,
    _user?: AdminUser
  ): Promise<TenantConfig & { id?: string }> {
    let tId = this.currentTenantId;
    let updates: Partial<TenantConfig> = {};

    if (typeof tenantIdOrBranding === 'string') {
      tId = tenantIdOrBranding;
      if (brandingOrUser && typeof brandingOrUser === 'object' && !('role' in brandingOrUser)) {
        updates = brandingOrUser;
      }
    } else {
      updates = tenantIdOrBranding;
    }

    const current = await this.getBranding(tId);
    const merged = { ...current, ...updates, id: tId };
    this.tenants[tId] = merged;
    return merged;
  }

  async getFeePolicy(tenantId?: string): Promise<TenantFeePolicy> {
    const tId = tenantId || this.currentTenantId;
    if (this.feePolicies[tId]) return this.feePolicies[tId];
    return {
      deliveryFeeMode: 'FIXED',
      fixedDeliveryFee: { amount: 250, currency: 'GBP' },
      dispatchFixedSurcharge: { amount: 50, currency: 'GBP' },
      dispatchPercentSurcharge: 0,
      serviceFeeMode: 'FIXED',
      serviceFeeAmount: 99,
      serviceFeeEnabled: true,
      bagFee: { amount: 25, currency: 'GBP' },
      freeDeliveryThreshold: { amount: 4000, currency: 'GBP' },
      minimumBasketThreshold: { amount: 1200, currency: 'GBP' },
      smallOrderFee: { amount: 150, currency: 'GBP' },
      smallOrderFeeEnabled: true,
      reauthorizationTolerancePercent: 5,
    };
  }

  async updateFeePolicy(
    tenantIdOrPolicy: string | Partial<TenantFeePolicy>,
    policyOrUser?: Partial<TenantFeePolicy> | AdminUser,
    _user?: AdminUser
  ): Promise<TenantFeePolicy> {
    const tId = typeof tenantIdOrPolicy === 'string' ? tenantIdOrPolicy : this.currentTenantId;
    const policy = typeof tenantIdOrPolicy === 'string' ? (policyOrUser as Partial<TenantFeePolicy>) : tenantIdOrPolicy;
    const current = await this.getFeePolicy(tId);
    const updated: TenantFeePolicy = { ...current, ...policy };
    this.feePolicies[tId] = updated;
    return updated;
  }

  async getStories(_tenantId?: string): Promise<Story[]> {
    return this.stories;
  }

  async saveStory(
    _tenantIdOrStory: string | Story,
    storyOrUser?: Story | AdminUser,
    _user?: AdminUser
  ): Promise<Story> {
    const story = typeof _tenantIdOrStory === 'string' ? (storyOrUser as Story) : _tenantIdOrStory;
    const idx = this.stories.findIndex((s) => s.id === story.id);
    if (idx >= 0) {
      this.stories[idx] = story;
    } else {
      this.stories.push(story);
    }
    return story;
  }

  async deleteStory(
    tenantIdOrStoryId: string,
    storyIdOrUser?: string | AdminUser,
    _user?: AdminUser
  ): Promise<boolean> {
    const sId = typeof storyIdOrUser === 'string' ? storyIdOrUser : tenantIdOrStoryId;
    this.stories = this.stories.filter((s) => s.id !== sId);
    return true;
  }

  async purgeStories(_tenantId?: string): Promise<boolean> {
    this.stories = [];
    return true;
  }

  async getFeatureFlags(tenantId?: string): Promise<TenantFeatureFlags> {
    const branding = await this.getBranding(tenantId);
    return branding.featureFlags || {
      enableStories: true,
      enableRootCatalogBrowse: true,
      enableCollection: true,
      allowStoreSwitchingWithBasket: true,
      enableNutritionalInfo: true,
      enableDeposits: true,
      enableAgeVerification: true,
      enableSearchSuggestions: true,
    };
  }

  async updateFeatureFlags(
    tenantIdOrFlags: string | Partial<TenantFeatureFlags>,
    flagsOrUser?: Partial<TenantFeatureFlags> | AdminUser,
    _user?: AdminUser
  ): Promise<TenantFeatureFlags> {
    const tId = typeof tenantIdOrFlags === 'string' ? tenantIdOrFlags : this.currentTenantId;
    const flags = typeof tenantIdOrFlags === 'string' ? (flagsOrUser as Partial<TenantFeatureFlags>) : tenantIdOrFlags;
    await this.updateBranding(tId, { featureFlags: flags as any });
    return this.getFeatureFlags(tId);
  }

  async getStores(_tenantId?: string): Promise<Store[]> {
    return MOCK_STORES;
  }

  async updateStore(
    _arg1: string,
    arg2: string | Partial<Store> | Store,
    _arg3?: Partial<Store> | Store | AdminUser,
    _arg4?: AdminUser
  ): Promise<Store> {
    const storeObj = typeof arg2 === 'object' ? arg2 : MOCK_STORES[0];
    return storeObj as Store;
  }

  async getAuditLogs(_tenantId?: string): Promise<AuditLogEntry[]> {
    return [];
  }

  async getProductRules(_tenantId?: string): Promise<VisualRule[]> {
    return this.rules;
  }

  async saveProductRule(_tenantId: string, rule: VisualRule, _user?: AdminUser): Promise<VisualRule[]> {
    const idx = this.rules.findIndex((r) => r.id === rule.id);
    if (idx >= 0) {
      this.rules[idx] = rule;
    } else {
      this.rules.push(rule);
    }
    return this.rules;
  }

  async deleteProductRule(_tenantId: string, ruleId: string, _user?: AdminUser): Promise<boolean> {
    this.rules = this.rules.filter((r) => r.id !== ruleId);
    return true;
  }

  async getCountryRules(_tenantId: string, _country: string): Promise<any[]> {
    return [];
  }

  async updateCountryRules(
    _tenantId: string,
    _country: string,
    rules: any[],
    _user?: AdminUser
  ): Promise<any[]> {
    return rules;
  }

  async getSchedulingConfig(_tenantId?: string, _scope?: any): Promise<any> {
    return DEFAULT_SCHEDULING_POLICY;
  }

  async getSubstitutionConfig(_tenantId?: string, _country?: string): Promise<any> {
    return DEFAULT_SUBSTITUTION_POLICY;
  }

  async updateSubstitutionConfig(
    _tenantId: string,
    config: any,
    _country?: string,
    _user?: AdminUser
  ): Promise<any> {
    return config;
  }

  async testDeliverectOAuth(tenantId: string, options?: any): Promise<any> {
    try {
      return await defaultHttpAdminClient.testDeliverectOAuth(tenantId, options);
    } catch {
      return {
        success: false,
        status: 'UNCONFIGURED',
        connectionState: 'DISCONNECTED',
        message: 'Deliverect OAuth requires server-side verification. Ensure backend BFF is running and DELIVERECT_CLIENT_ID / DELIVERECT_CLIENT_SECRET are configured.',
        latencyMs: 0,
        environment: options?.environment || 'staging',
        tokenAcquired: false,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async testPlatformDeliverectOAuth(options?: any): Promise<any> {
    try {
      const res = await fetch('/api/v1/admin/platform/integrations/deliverect/test-oauth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer dev_token_platformSuperAdmin_usr-alpha-super',
        },
        body: JSON.stringify(options || {}),
      });
      return await res.json();
    } catch {
      return {
        success: false,
        status: 'UNCONFIGURED',
        connectionState: 'DISCONNECTED',
        message: 'Deliverect OAuth requires server-side verification. Ensure backend BFF is running and DELIVERECT_CLIENT_ID / DELIVERECT_CLIENT_SECRET are configured.',
        latencyMs: 0,
        environment: options?.environment || 'staging',
        tokenAcquired: false,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async syncLinkedAccounts(tenantId: string): Promise<any> {
    return {
      tenantId,
      accounts: [
        {
          accountLinkId: `acclink_${tenantId}_demo`,
          integrationId: `int_${tenantId}`,
          deliverectAccountId: `acc_${tenantId}_demo`,
          displayName: `${tenantId.toUpperCase()} Demo Retail Group`,
          status: 'ACTIVE',
        },
      ],
      locations: [
        {
          physicalLocationId: `loc_${tenantId}_demo`,
          accountLinkId: `acclink_${tenantId}_demo`,
          deliverectLocationId: `loc_deliv_${tenantId}`,
          name: `${tenantId.toUpperCase()} Flagship Store`,
          statusProjection: 'ACTIVE',
          addressProjection: { street: '124 High St', city: 'London', postcode: 'W1D 1LL', country: 'GB' },
          coordinates: { latitude: 51.515, longitude: -0.138 },
        },
      ],
      stores: [
        {
          commerceStoreId: `cstore_${tenantId}_demo`,
          accountLinkId: `acclink_${tenantId}_demo`,
          physicalLocationId: `loc_${tenantId}_demo`,
          channelLinkId: `chl_${tenantId}_demo`,
          name: `${tenantId.toUpperCase()} Flagship Commerce Store`,
          stateProjection: 'open',
          fulfillmentCapabilitiesProjection: { delivery: true, pickup: true, scheduling: true },
          lastSeenAt: new Date().toISOString(),
        },
      ],
      syncedAt: new Date().toISOString(),
    };
  }

  async getLinkedAccounts(tenantId: string): Promise<any> {
    return this.syncLinkedAccounts(tenantId);
  }

  async selectAccount(tenantId: string, accountId: string): Promise<any> {
    return {
      success: true,
      tenantId,
      deliverectAccountId: accountId,
      status: 'ACCOUNT_MAPPED',
    };
  }

  async discoverStores(tenantId: string, _accountId?: string): Promise<any> {
    const sync = await this.syncLinkedAccounts(tenantId);
    return {
      success: true,
      status: 'COMMERCE_VERIFIED',
      stores: sync.stores,
      count: sync.stores.length,
    };
  }
}
