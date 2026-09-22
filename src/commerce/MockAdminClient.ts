import type { AdminClient } from './AdminClient';
import {
  TenantConfig,
  Story,
  TenantFeePolicy,
  VisualRule,
  FeatureFlags,
  Store,
  AuditLogEntry,
  AdminUser,
} from './models';
import {
  MOCK_TENANTS,
  MOCK_STORIES,
  MOCK_STORES,
  MOCK_FEE_POLICIES,
  MOCK_VISUAL_RULES,
  MOCK_ADMIN_USERS,
  MOCK_AUDIT_LOGS,
} from './mockData';
import { DEFAULT_SCHEDULING_POLICY } from './slotEngine';
import { DEFAULT_SUBSTITUTION_POLICY } from './substitutionPricing';
import { SchedulingPolicy, TenantSubstitutionPolicy } from './postCheckoutModels';

const sharedTenants = new Map<string, any>();
const sharedStories = new Map<string, Story[]>();
export const sharedFeePolicies = new Map<string, TenantFeePolicy>();
export const sharedProductRules = new Map<string, VisualRule[]>();
const sharedCountryRules = new Map<string, Map<string, any[]>>();
const sharedAuditLogs = new Map<string, AuditLogEntry[]>();
const sharedAdminUsers = new Map<string, AdminUser[]>();
const sharedSchedulingPolicies = new Map<string, SchedulingPolicy>();
const sharedSubstitutionPolicies = new Map<string, TenantSubstitutionPolicy>();

export function initSharedData() {
  if (sharedTenants.size > 0) return;
  Object.entries(MOCK_TENANTS).forEach(([id, t]) => {
    sharedTenants.set(id, { ...t, id: t.tenantId });
  });

  Object.entries(MOCK_FEE_POLICIES).forEach(([id, p]) => {
    sharedFeePolicies.set(id, JSON.parse(JSON.stringify(p)));
  });

  Object.entries(MOCK_ADMIN_USERS).forEach(([id, users]) => {
    sharedAdminUsers.set(id, JSON.parse(JSON.stringify(users)));
  });

  sharedAuditLogs.set('brand-alpha', JSON.parse(JSON.stringify(MOCK_AUDIT_LOGS)));
  sharedAuditLogs.set('brand-beta', [
    {
      id: 'audit-beta-01',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      userId: 'usr-beta-admin',
      userName: 'Julian Montgomery',
      userRole: 'tenantAdmin',
      tenantId: 'brand-beta',
      category: 'Branding',
      action: 'UPDATE_THEME',
      details: 'Updated secondary luxury accent to Rose #ec4899',
    },
  ]);

  sharedStories.set('brand-alpha', JSON.parse(JSON.stringify(MOCK_STORIES)));
  sharedStories.set('brand-beta', JSON.parse(JSON.stringify(MOCK_STORIES)));

  sharedProductRules.set('brand-alpha', JSON.parse(JSON.stringify(MOCK_VISUAL_RULES)));
  sharedProductRules.set('brand-beta', JSON.parse(JSON.stringify(MOCK_VISUAL_RULES)));
}

export class MockAdminClient implements AdminClient {
  private tenants = sharedTenants;
  private stories = sharedStories;
  private feePolicies = sharedFeePolicies;
  private productRules = sharedProductRules;
  private countryRules = sharedCountryRules;
  private auditLogs = sharedAuditLogs;
  private adminUsers = sharedAdminUsers;

  constructor() {
    initSharedData();
  }

  private latency(ms = 120): Promise<void> {
    return new Promise((res) => setTimeout(res, ms));
  }

  private assertTenantAccess(tenantId: string, user?: AdminUser) {
    if (!user) return;
    if (user.role === 'platformSuperAdmin') return;
    if (user.tenantId !== tenantId) {
      throw new Error(
        `Unauthorized: User ${user.email} (${user.tenantId}) cannot access tenant ${tenantId}`
      );
    }
  }

  private assertRole(user: AdminUser, allowedRoles: Array<AdminUser['role']>) {
    if (user.role === 'platformSuperAdmin') return;
    if (!allowedRoles.includes(user.role)) {
      throw new Error(
        `Forbidden: User ${user.email} with role ${user.role} does not have required permissions`
      );
    }
  }

  private recordAudit(
    tenantId: string,
    user: AdminUser,
    category: AuditLogEntry['category'],
    action: string,
    details: string
  ) {
    const entry: AuditLogEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      tenantId,
      category,
      action,
      details,
    };
    const logs = this.auditLogs.get(tenantId) || [];
    logs.unshift(entry);
    this.auditLogs.set(tenantId, logs);
  }

  private getDefaultUser(tenantId: string): AdminUser {
    const users = this.adminUsers.get(tenantId) || [];
    return (
      users[0] || {
        id: 'usr-default-admin',
        name: 'Tenant Administrator',
        email: 'admin@tenant.internal',
        role: 'tenantAdmin',
        tenantId,
      }
    );
  }

  async getBranding(tenantId?: string): Promise<TenantConfig & { id: string }> {
    const tid = tenantId || 'brand-alpha';
    await this.latency();
    const t = this.tenants.get(tid);
    if (!t) throw new Error(`Tenant ${tid} not found`);
    const copy = JSON.parse(JSON.stringify(t));
    copy.id = copy.tenantId;
    return copy;
  }

  async updateBranding(
    tenantIdOrBranding: string | Partial<TenantConfig>,
    brandingOrUser?: Partial<TenantConfig> | AdminUser,
    userArg?: AdminUser
  ): Promise<TenantConfig & { id: string }> {
    let tenantId: string;
    let branding: Partial<TenantConfig>;
    let user: AdminUser;

    if (typeof tenantIdOrBranding === 'string') {
      tenantId = tenantIdOrBranding;
      branding = (brandingOrUser as Partial<TenantConfig>) || {};
      user = userArg || this.getDefaultUser(tenantId);
    } else {
      tenantId = 'brand-alpha';
      branding = tenantIdOrBranding;
      user = (brandingOrUser as AdminUser) || this.getDefaultUser(tenantId);
    }

    this.assertTenantAccess(tenantId, user);
    await this.latency(200);
    const existing = this.tenants.get(tenantId);
    if (!existing) throw new Error(`Tenant ${tenantId} not found`);

    const updated: TenantConfig & { id: string } = {
      ...existing,
      ...branding,
      tenantId, // Immutable
      id: tenantId,
    };
    this.tenants.set(tenantId, updated);

    this.recordAudit(
      tenantId,
      user,
      'Branding',
      'UPDATE_BRANDING',
      `Modified branding theme (primary: ${branding.primaryColour || existing.primaryColour}, radius: ${branding.borderRadius || existing.borderRadius})`
    );

    return JSON.parse(JSON.stringify(updated));
  }

  async getStories(tenantId?: string): Promise<Story[]> {
    const tid = tenantId || 'brand-alpha';
    await this.latency();
    return JSON.parse(JSON.stringify(this.stories.get(tid) || []));
  }

  async saveStory(
    tenantIdOrStory: string | Story,
    storyOrUser?: Story | AdminUser,
    userArg?: AdminUser
  ): Promise<Story> {
    let tenantId: string;
    let story: Story;
    let user: AdminUser;

    if (typeof tenantIdOrStory === 'string') {
      tenantId = tenantIdOrStory;
      story = storyOrUser as Story;
      user = userArg || this.getDefaultUser(tenantId);
    } else {
      tenantId = 'brand-alpha';
      story = tenantIdOrStory;
      user = (storyOrUser as AdminUser) || this.getDefaultUser(tenantId);
    }

    this.assertTenantAccess(tenantId, user);
    await this.latency(180);
    const list = this.stories.get(tenantId) || [];
    const index = list.findIndex((s) => s.id === story.id);
    const actionType = index >= 0 ? 'UPDATE_STORY' : 'CREATE_STORY';

    if (index >= 0) {
      list[index] = story;
    } else {
      list.push(story);
    }
    this.stories.set(tenantId, list);

    this.recordAudit(
      tenantId,
      user,
      'Stories',
      actionType,
      `${actionType === 'CREATE_STORY' ? 'Created' : 'Updated'} story "${story.title}" with ${story.items?.length || 0} items`
    );

    return JSON.parse(JSON.stringify(story));
  }

  async deleteStory(
    tenantIdOrStoryId: string,
    storyIdOrUser?: string | AdminUser,
    userArg?: AdminUser
  ): Promise<boolean> {
    let tenantId: string;
    let storyId: string;
    let user: AdminUser;

    if (storyIdOrUser && typeof storyIdOrUser === 'string') {
      tenantId = tenantIdOrStoryId;
      storyId = storyIdOrUser;
      user = userArg || this.getDefaultUser(tenantId);
    } else {
      tenantId = 'brand-alpha';
      storyId = tenantIdOrStoryId;
      user = (storyIdOrUser as AdminUser) || this.getDefaultUser(tenantId);
    }

    this.assertTenantAccess(tenantId, user);
    await this.latency(150);
    const list = this.stories.get(tenantId) || [];
    const story = list.find((s) => s.id === storyId);
    this.stories.set(
      tenantId,
      list.filter((s) => s.id !== storyId)
    );

    this.recordAudit(
      tenantId,
      user,
      'Stories',
      'DELETE_STORY',
      `Deleted story "${story?.title || storyId}"`
    );

    return true;
  }

  async purgeStories(tenantId?: string): Promise<boolean> {
    const tid = tenantId || 'brand-alpha';
    this.stories.set(tid, []);
    return true;
  }

  async getFeePolicy(tenantId?: string): Promise<TenantFeePolicy> {
    const tid = tenantId || 'brand-alpha';
    await this.latency();
    const policy = this.feePolicies.get(tid) || {
      deliveryFeeMode: 'FIXED',
      fixedDeliveryFee: 1.99,
      serviceFeeMode: 'FIXED',
      serviceFeeAmount: 0.49,
      bagFee: 0.35,
      freeDeliveryThreshold: 35.0,
      minimumBasketThreshold: 10.0,
      smallOrderFee: 1.50,
    };
    return JSON.parse(JSON.stringify(policy));
  }

  async updateFeePolicy(
    tenantIdOrPolicy: string | Partial<TenantFeePolicy>,
    policyOrUser?: Partial<TenantFeePolicy> | AdminUser,
    userArg?: AdminUser
  ): Promise<TenantFeePolicy> {
    let tenantId: string;
    let policy: Partial<TenantFeePolicy>;
    let user: AdminUser;

    if (typeof tenantIdOrPolicy === 'string') {
      tenantId = tenantIdOrPolicy;
      policy = (policyOrUser as Partial<TenantFeePolicy>) || {};
      user = userArg || this.getDefaultUser(tenantId);
    } else {
      tenantId = 'brand-alpha';
      policy = tenantIdOrPolicy;
      user = (policyOrUser as AdminUser) || this.getDefaultUser(tenantId);
    }

    this.assertTenantAccess(tenantId, user);
    await this.latency(200);
    const existing = await this.getFeePolicy(tenantId);
    const merged = { ...existing, ...policy } as TenantFeePolicy;
    this.feePolicies.set(tenantId, merged);

    const bagFeeMajor = typeof merged.bagFee === 'number' ? merged.bagFee : merged.bagFee.amount / 100;
    this.recordAudit(
      tenantId,
      user,
      'Fees',
      'UPDATE_FEE_POLICY',
      `Updated fee policy: Delivery mode ${merged.deliveryFeeMode}, Free threshold £${merged.freeDeliveryThreshold ?? 'none'}, Bag fee £${bagFeeMajor.toFixed(2)}`
    );

    return JSON.parse(JSON.stringify(merged));
  }

  async getRules(tenantId?: string): Promise<VisualRule[]> {
    return this.getProductRules(tenantId || 'brand-alpha');
  }

  async saveRule(rule: VisualRule): Promise<VisualRule> {
    await this.saveProductRule('brand-alpha', rule, this.getDefaultUser('brand-alpha'));
    return rule;
  }

  async deleteRule(ruleId: string): Promise<void> {
    await this.deleteProductRule('brand-alpha', ruleId, this.getDefaultUser('brand-alpha'));
  }

  async getCountryRules(tenantId: string, country: string): Promise<any[]> {
    await this.latency();
    const byTenant = this.countryRules.get(tenantId);
    return byTenant?.get(country) || [];
  }

  async updateCountryRules(
    tenantId: string,
    country: string,
    rules: any[],
    user: AdminUser
  ): Promise<any[]> {
    this.assertTenantAccess(tenantId, user);
    await this.latency(180);
    if (!this.countryRules.has(tenantId)) {
      this.countryRules.set(tenantId, new Map());
    }
    this.countryRules.get(tenantId)!.set(country, rules);

    this.recordAudit(
      tenantId,
      user,
      'Rules',
      'UPDATE_COUNTRY_RULES',
      `Updated country-specific statutory rules for ${country} (${rules.length} active rules)`
    );

    return rules;
  }

  async getProductRules(tenantId?: string): Promise<VisualRule[]> {
    const tid = tenantId || 'brand-alpha';
    await this.latency();
    return JSON.parse(JSON.stringify(this.productRules.get(tid) || []));
  }

  async saveProductRule(tenantId: string, rule: VisualRule, user: AdminUser): Promise<VisualRule[]> {
    this.assertTenantAccess(tenantId, user);
    await this.latency(180);
    const list = this.productRules.get(tenantId) || [];
    const index = list.findIndex((r) => r.id === rule.id);
    const action = index >= 0 ? 'UPDATE_PRODUCT_RULE' : 'CREATE_PRODUCT_RULE';

    if (index >= 0) {
      list[index] = rule;
    } else {
      list.push(rule);
    }
    this.productRules.set(tenantId, list);

    this.recordAudit(
      tenantId,
      user,
      'Rules',
      action,
      `Configured product compliance rule "${rule.name}" (${rule.actions.length} action types)`
    );

    return JSON.parse(JSON.stringify(list));
  }

  async deleteProductRule(tenantId: string, ruleId: string, user: AdminUser): Promise<boolean> {
    this.assertTenantAccess(tenantId, user);
    await this.latency(150);
    const list = this.productRules.get(tenantId) || [];
    const rule = list.find((r) => r.id === ruleId);
    this.productRules.set(
      tenantId,
      list.filter((r) => r.id !== ruleId)
    );

    this.recordAudit(
      tenantId,
      user,
      'Rules',
      'DELETE_PRODUCT_RULE',
      `Deleted compliance rule "${rule?.name || ruleId}"`
    );

    return true;
  }

  async getFeatureFlags(tenantId?: string): Promise<FeatureFlags> {
    const tid = tenantId || 'brand-alpha';
    await this.latency();
    const tenant = this.tenants.get(tid);
    return JSON.parse(JSON.stringify(tenant?.featureFlags || {}));
  }

  async updateFeatureFlags(
    tenantIdOrFlags: string | Partial<FeatureFlags>,
    flagsOrUser?: Partial<FeatureFlags> | AdminUser,
    userArg?: AdminUser
  ): Promise<FeatureFlags> {
    let tenantId: string;
    let flags: Partial<FeatureFlags>;
    let user: AdminUser;

    if (typeof tenantIdOrFlags === 'string') {
      tenantId = tenantIdOrFlags;
      flags = (flagsOrUser as Partial<FeatureFlags>) || {};
      user = userArg || this.getDefaultUser(tenantId);
    } else {
      tenantId = 'brand-alpha';
      flags = tenantIdOrFlags;
      user = (flagsOrUser as AdminUser) || this.getDefaultUser(tenantId);
    }

    this.assertTenantAccess(tenantId, user);
    await this.latency(180);
    const tenant = this.tenants.get(tenantId);
    if (!tenant) throw new Error('Tenant not found');

    tenant.featureFlags = { ...tenant.featureFlags, ...flags };
    this.tenants.set(tenantId, tenant);

    this.recordAudit(
      tenantId,
      user,
      'Features',
      'UPDATE_FEATURE_FLAGS',
      `Updated platform feature flags`
    );

    return JSON.parse(JSON.stringify(tenant.featureFlags));
  }

  async getStores(tenantId?: string): Promise<Store[]> {
    await this.latency();
    return JSON.parse(JSON.stringify(MOCK_STORES));
  }

  async updateStore(
    arg1: string,
    arg2: string | Partial<Store> | Store,
    arg3?: Partial<Store> | Store | AdminUser,
    arg4?: AdminUser
  ): Promise<Store> {
    let tenantId = 'brand-alpha';
    let storeId: string;
    let updates: Partial<Store>;
    let user: AdminUser;

    if (arg4) {
      tenantId = arg1;
      storeId = arg2 as string;
      updates = arg3 as Partial<Store>;
      user = arg4;
    } else if (arg3 && typeof arg3 === 'object' && 'role' in arg3) {
      tenantId = arg1;
      updates = arg2 as Store;
      storeId = (arg2 as Store).id;
      user = arg3 as AdminUser;
    } else if (typeof arg2 === 'object' && !('role' in (arg2 as any))) {
      storeId = arg1;
      updates = arg2 as Partial<Store>;
      user = this.getDefaultUser(tenantId);
    } else {
      tenantId = arg1;
      storeId = arg2 as string;
      updates = (arg3 as Partial<Store>) || {};
      user = this.getDefaultUser(tenantId);
    }

    this.assertTenantAccess(tenantId, user);
    await this.latency(180);
    const index = MOCK_STORES.findIndex((s) => s.id === storeId);
    if (index >= 0) {
      MOCK_STORES[index] = { ...MOCK_STORES[index], ...updates };
      return MOCK_STORES[index];
    }
    return updates as Store;
  }

  async getAuditHistory(tenantId?: string): Promise<AuditLogEntry[]> {
    const tid = tenantId || 'brand-alpha';
    await this.latency();
    return JSON.parse(JSON.stringify(this.auditLogs.get(tid) || []));
  }

  async getAuditLogs(tenantId?: string): Promise<AuditLogEntry[]> {
    return this.getAuditHistory(tenantId);
  }

  async getAdminUsers(tenantId?: string): Promise<AdminUser[]> {
    const tid = tenantId || 'brand-alpha';
    await this.latency();
    return JSON.parse(JSON.stringify(this.adminUsers.get(tid) || []));
  }

  async getCurrentAdminUser(tenantId?: string): Promise<AdminUser> {
    const tid = tenantId || 'brand-alpha';
    await this.latency();
    return this.getDefaultUser(tid);
  }

  async getSchedulingConfig(
    tenantId: string = 'brand-alpha',
    scope?: { country?: string; storeGroupId?: string; storeId?: string }
  ): Promise<SchedulingPolicy> {
    await this.latency();
    const key = `${tenantId}${scope?.storeId ? `:${scope.storeId}` : ''}`;
    const policy = sharedSchedulingPolicies.get(key) || sharedSchedulingPolicies.get(tenantId) || DEFAULT_SCHEDULING_POLICY;
    return JSON.parse(JSON.stringify(policy));
  }

  async updateSchedulingConfig(
    tenantId: string,
    config: Partial<SchedulingPolicy>,
    scope?: { country?: string; storeGroupId?: string; storeId?: string },
    user?: AdminUser
  ): Promise<SchedulingPolicy> {
    const activeUser = user || this.getDefaultUser(tenantId);
    this.assertTenantAccess(tenantId, activeUser);
    this.assertRole(activeUser, ['tenantAdmin', 'operationsEditor', 'platformSuperAdmin']);

    await this.latency(150);
    const key = `${tenantId}${scope?.storeId ? `:${scope.storeId}` : ''}`;
    const existing = sharedSchedulingPolicies.get(key) || sharedSchedulingPolicies.get(tenantId) || DEFAULT_SCHEDULING_POLICY;
    const updated: SchedulingPolicy = { ...existing, ...config };
    sharedSchedulingPolicies.set(key, updated);

    this.recordAudit(
      tenantId,
      activeUser,
      'Stores',
      'UPDATE_SCHEDULING_POLICY',
      `Updated fulfillment scheduling policy (ASAP: ${updated.acceptsAsapOrders}, Pre-orders: ${updated.acceptsPreOrders}, Lead time: ${updated.minimumLeadTimeMinutes}m)`
    );

    return JSON.parse(JSON.stringify(updated));
  }

  async getSubstitutionConfig(
    tenantId: string = 'brand-alpha',
    country?: string
  ): Promise<TenantSubstitutionPolicy> {
    await this.latency();
    const key = `${tenantId}${country ? `:${country}` : ''}`;
    const policy = sharedSubstitutionPolicies.get(key) || sharedSubstitutionPolicies.get(tenantId) || DEFAULT_SUBSTITUTION_POLICY;
    return JSON.parse(JSON.stringify(policy));
  }

  async updateSubstitutionConfig(
    tenantId: string,
    config: Partial<TenantSubstitutionPolicy>,
    country?: string,
    user?: AdminUser
  ): Promise<TenantSubstitutionPolicy> {
    const activeUser = user || this.getDefaultUser(tenantId);
    this.assertTenantAccess(tenantId, activeUser);
    this.assertRole(activeUser, ['tenantAdmin', 'operationsEditor', 'platformSuperAdmin']);

    await this.latency(150);
    const key = `${tenantId}${country ? `:${country}` : ''}`;
    const existing = sharedSubstitutionPolicies.get(key) || sharedSubstitutionPolicies.get(tenantId) || DEFAULT_SUBSTITUTION_POLICY;
    const updated: TenantSubstitutionPolicy = { ...existing, ...config };
    sharedSubstitutionPolicies.set(key, updated);

    this.recordAudit(
      tenantId,
      activeUser,
      'Rules',
      'UPDATE_SUBSTITUTION_POLICY',
      `Updated substitution policy (Best-match: ${updated.bestMatchPricePolicy}, Default: ${updated.defaultPreference})`
    );

    return JSON.parse(JSON.stringify(updated));
  }

  async getCommerceDiagnostics(tenantId: string): Promise<any> {
    return {
      success: true,
      timestamp: new Date().toISOString(),
      account: { count: 1, primary: { deliverectAccountId: 'mock-acc', displayName: 'Mock Account' } },
      stores: { count: 1, items: [{ id: 'mock-store', name: 'Mock Store', channelLinkId: 'mock-chan', isOpen: true }] },
      rootCatalog: { id: 'mock-root', menusCount: 1, categoriesCount: 5, productsCount: 20 },
      storeCatalog: { id: 'mock-store', storeId: 'mock-store', menusCount: 1, categoriesCount: 5, productsCount: 20 },
      totalProductsCount: 20,
    };
  }
}

export const defaultAdminClient = new MockAdminClient();
