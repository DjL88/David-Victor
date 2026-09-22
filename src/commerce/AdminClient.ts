import {
  TenantConfig,
  TenantFeePolicy,
  TenantSchedulingPolicy,
  Story,
  CategoryPromoBanner,
  VisualRule,
  AdminUser,
  AuditLogEntry,
  Store,
  TenantFeatureFlags,
} from './models';
import { MediaHealth, MediaHealthSummary } from './mediaHealthModels';
import { TenantDispatchRules } from '../rules/types';

export interface AdminClient {
  /** Configures client base API URL */
  setBaseUrl?(baseUrl: string): void;

  /**
   * Returns current authenticated admin user and their tenant context.
   * Server-controlled: tenantId is determined by server authentication.
   */
  getCurrentAdminUser(tenantId?: string): Promise<AdminUser>;

  /**
   * Retrieves full tenant branding and configuration.
   */
  getBranding(tenantId?: string): Promise<TenantConfig & { id?: string }>;

  /**
   * Updates branding details (requires marketingEditor, tenantAdmin, or platformSuperAdmin).
   */
  updateBranding(
    tenantIdOrBranding: string | Partial<TenantConfig>,
    brandingOrUser?: Partial<TenantConfig> | AdminUser,
    user?: AdminUser
  ): Promise<TenantConfig & { id?: string }>;

  /**
   * Retrieves fee policy defined for this tenant.
   */
  getFeePolicy(tenantId?: string): Promise<TenantFeePolicy>;

  /**
   * Updates fee policy (requires operationsEditor, tenantAdmin, or platformSuperAdmin).
   */
  updateFeePolicy(
    tenantIdOrPolicy: string | Partial<TenantFeePolicy>,
    policyOrUser?: Partial<TenantFeePolicy> | AdminUser,
    user?: AdminUser
  ): Promise<TenantFeePolicy>;

  /**
   * Retrieves the ASAP-only / pre-order scheduling policy for this tenant.
   */
  getSchedulingPolicy?(tenantId?: string): Promise<TenantSchedulingPolicy>;

  /**
   * Updates the scheduling policy (requires tenantAdmin or platformSuperAdmin).
   */
  updateSchedulingPolicy?(
    tenantId: string,
    policy: Partial<TenantSchedulingPolicy>
  ): Promise<TenantSchedulingPolicy>;

  /**
   * Retrieves all stories configured for this tenant.
   */
  getStories(tenantId?: string): Promise<Story[]>;

  /**
   * Creates or updates a story.
   */
  saveStory(
    tenantIdOrStory: string | Story,
    storyOrUser?: Story | AdminUser,
    user?: AdminUser
  ): Promise<Story>;

  /**
   * Deletes a story.
   */
  deleteStory(
    tenantIdOrStoryId: string,
    storyIdOrUser?: string | AdminUser,
    user?: AdminUser
  ): Promise<void | boolean>;

  /**
   * Purges all stories and fake offers for a tenant.
   */
  purgeStories?(tenantId?: string): Promise<boolean>;

  /**
   * Retrieves all promotional hero banners for this tenant.
   */
  getHeroBanners?(tenantId?: string): Promise<CategoryPromoBanner[]>;

  /**
   * Creates or updates a promotional hero banner.
   */
  saveHeroBanner?(banner: CategoryPromoBanner, tenantId?: string): Promise<CategoryPromoBanner>;

  /**
   * Reorders / updates a batch of promotional hero banners.
   */
  reorderHeroBanners?(banners: CategoryPromoBanner[], tenantId?: string): Promise<CategoryPromoBanner[]>;

  /**
   * Deletes a promotional hero banner.
   */
  deleteHeroBanner?(bannerId: string, tenantId?: string): Promise<boolean>;

  /**
   * Resets promotional hero banners to system defaults.
   */
  resetHeroBanners?(tenantId?: string): Promise<CategoryPromoBanner[]>;

  /**
   * Retrieves visual country and product rules.
   */
  getRules?(tenantId?: string): Promise<VisualRule[]>;

  /**
   * Saves a visual rule.
   */
  saveRule?(rule: VisualRule): Promise<VisualRule>;

  /**
   * Deletes a visual rule.
   */
  deleteRule?(ruleId: string): Promise<void>;

  getProductRules?(tenantId?: string): Promise<VisualRule[]>;
  saveProductRule?(tenantId: string, rule: VisualRule, user?: AdminUser): Promise<VisualRule[]>;
  deleteProductRule?(tenantId: string, ruleId: string, user?: AdminUser): Promise<boolean>;

  /**
   * Search merchandising and ranking optimization configuration.
   */
  getSearchConfig?(tenantId?: string): Promise<any>;
  updateSearchConfig?(tenantId: string, config: any): Promise<any>;

  /**
   * Retrieves tenant feature flags.
   */
  getFeatureFlags(tenantId?: string): Promise<TenantFeatureFlags>;

  /**
   * Updates tenant feature flags.
   */
  updateFeatureFlags(
    tenantIdOrFlags: string | Partial<TenantFeatureFlags>,
    flagsOrUser?: Partial<TenantFeatureFlags> | AdminUser,
    user?: AdminUser
  ): Promise<TenantFeatureFlags>;

  /**
   * Retrieves stores belonging to the tenant.
   */
  getStores(tenantId?: string): Promise<Store[]>;

  /**
   * Updates store status / settings.
   */
  updateStore(
    arg1: string,
    arg2: string | Partial<Store> | Store,
    arg3?: Partial<Store> | Store | AdminUser,
    arg4?: AdminUser
  ): Promise<Store>;

  /**
   * Retrieves audit log entries for policy & config changes.
   */
  getAuditLogs(tenantId?: string): Promise<AuditLogEntry[]>;

  /**
   * List all registered tenants.
   */
  listAllTenants?(): Promise<TenantConfig[]>;

  /**
   * Provision a brand/tenant.
   */
  provisionBrand?(brandData: any): Promise<TenantConfig>;

  /**
   * Delete a brand/tenant.
   */
  deleteBrand?(tenantId: string): Promise<boolean>;

  /**
   * Upload asset file.
   */
  uploadAssetFile?(file: File, type: string, tenantId?: string): Promise<any>;

  /**
   * List assets for a tenant, optionally filtered by asset type.
   */
  listAssets?(tenantId?: string, type?: string): Promise<any[]>;

  /**
   * Trigger direct browser file download for exports.
   */
  triggerBrowserDownload?(
    type: 'audit-logs' | 'orders' | 'analytics' | 'stores',
    format?: 'csv' | 'json',
    tenantId?: string
  ): Promise<void>;

  /**
   * Get integration configuration for tenant.
   */
  getIntegration?(tenantId?: string): Promise<any>;

  /**
   * Update integration configuration for tenant.
   */
  updateIntegration?(tenantId: string, updates: any): Promise<any>;

  /**
   * Retrieves async headers with bearer token.
   */
  getHeadersAsync?(): Promise<Record<string, string>>;

  /**
   * Set cached real token from Firebase auth.
   */
  setCachedRealToken?(token: string | null): void;

  /**
   * Updates country regulatory rules.
   */
  updateCountryRules?(
    tenantId: string,
    country: string,
    rules: any[],
    user?: AdminUser
  ): Promise<any[]>;

  /**
   * Internal test/platform helper: switch tenant ONLY if platformSuperAdmin.
   * Throws authorization error if non-superadmin attempts to switch tenant!
   */
  switchTenantAsSuperAdmin?(targetTenantId: string): Promise<void>;

  /**
   * Switch the active mocked user role for permission testing.
   */
  setMockRole?(role: AdminUser['role']): void;

  /**
   * Retrieves scheduling rules and policy for the tenant and optional scope (Country, Store Group, Store).
   */
  getSchedulingConfig?(
    tenantId?: string,
    scope?: { country?: string; storeGroupId?: string; storeId?: string }
  ): Promise<any>;

  /**
   * Updates scheduling configuration with audit logging.
   */
  updateSchedulingConfig?(
    tenantId: string,
    config: any,
    scope?: { country?: string; storeGroupId?: string; storeId?: string },
    user?: AdminUser
  ): Promise<any>;

  /**
   * Retrieves substitution policy for the tenant and optional country.
   */
  getSubstitutionConfig?(tenantId?: string, country?: string): Promise<any>;

  /**
   * Updates substitution policy with audit logging.
   */
  updateSubstitutionConfig?(
    tenantId: string,
    config: any,
    country?: string,
    user?: AdminUser
  ): Promise<any>;

  /**
   * Tests Deliverect OAuth token acquisition against configured credentials.
   */
  testDeliverectOAuth?(tenantId: string, options?: any): Promise<any>;

  /**
   * Tests platform-scoped Deliverect partner OAuth token acquisition.
   * Tests only https://api.staging.deliverect.com/oauth/token with audience https://api.staging.deliverect.com
   * Protected by Platform SuperAdmin privilege.
   */
  testPlatformDeliverectOAuth?(options?: { environment?: string; clientId?: string; clientSecret?: string }): Promise<any>;

  /**
   * Synchronizes linked accounts, locations, and stores from Deliverect.
   */
  syncLinkedAccounts?(tenantId: string): Promise<any>;

  /**
   * Retrieves linked accounts, locations, and stores for the tenant.
   */
  getLinkedAccounts?(tenantId: string): Promise<any>;

  /**
   * Selects an account to map to the tenant.
   */
  selectAccount?(tenantId: string, accountId: string, channelLinkIds?: string[]): Promise<any>;

  /**
   * Discovers and maps commerce stores for an account.
   */
  discoverStores?(tenantId: string, accountId?: string): Promise<any>;

  /**
   * Retrieves live commerce catalog diagnostics (Root Menu, Store Menu, and Products counts).
   */
  getCommerceDiagnostics?(tenantId: string): Promise<any>;
  getRawStoreMenu?(tenantId: string, storeId: string): Promise<any>;
  inspectStoreMenu?(tenantId: string, storeId: string, menuId?: string): Promise<any>;

  /**
   * Registers the active admin user with the client for header/tenant derivation.
   */
  setActiveAdminUser?(user: AdminUser | null): void;

  /**
   * Sets or clears the cached real Firebase ID token.
   */
  setCachedRealToken?(token: string | null): void;

  /**
   * Retrieves team memberships (optionally filtered by tenant).
   */
  listMemberships?(tenantId?: string): Promise<any[]>;

  /**
   * Creates or updates a team membership.
   */
  createMembership?(data: { email: string; role: string; tenantId?: string; name?: string; status?: string }): Promise<any>;

  /**
   * Deletes or revokes a team membership.
   */
  deleteMembership?(membershipId: string): Promise<any>;

  /**
   * Retrieves all domain mappings.
   */
  listAllDomains?(): Promise<any[]>;

  /**
   * Adds or updates a domain mapping.
   */
  addOrUpdateDomain?(data: { hostname: string; tenantId: string; isPrimary?: boolean }): Promise<any>;

  /**
   * Deletes a domain mapping.
   */
  deleteDomain?(domainId: string): Promise<any>;

  /**
   * Compact, admin-only Connection Health reporting.
   */
  getConnectionHealth?(tenantId?: string): Promise<any>;

  /**
   * Retrieves tenant dispatch orchestration rules.
   */
  getDispatchRules?(tenantId?: string): Promise<TenantDispatchRules>;

  /**
   * Saves tenant dispatch orchestration rules.
   */
  saveDispatchRules?(tenantId: string, rules: TenantDispatchRules, user?: AdminUser): Promise<TenantDispatchRules>;

  /**
   * Traces a real request through Upstream -> BFF -> HTTP Client -> Hook -> Visible Cards.
   */
  traceRequest?(params: {
    tenantId?: string;
    storeId?: string;
    fulfillmentType?: 'delivery' | 'pickup';
    forceFailureType?: any;
  }): Promise<any>;

  /**
   * Probes and returns Media Health report for tenant assets.
   */
  getMediaHealth?(tenantId?: string, opts?: { recheck?: boolean }): Promise<{ assets: MediaHealth[]; summary: MediaHealthSummary }>;

  /**
   * Places an isolated test pickup order via Deliverect Commerce Basket API
   */
  runAssistantAction?(tenantId: string, actionName: string, input?: Record<string, unknown>, context?: { section?: string; resourceType?: string; resourceId?: string; organizationId?: string; market?: string; region?: string; locationGroupId?: string; locationId?: string }): Promise<any>;

  /** Lists server-authorized assistant actions, including proposal-only write actions. */
  getAssistantActions?(tenantId?: string): Promise<any>;

  /** Creates a durable, reviewable proposal. This never applies the mutation. */
  createAssistantChangeSet?(tenantId: string, proposal: {
    prompt?: string;
    actions: Array<{ actionName: string; input?: Record<string, unknown> }>;
    affectedResources?: Array<{ type: string; id: string; label?: string }>;
    beforeSnapshot?: unknown;
    afterSnapshot?: unknown;
    diff?: unknown;
    warnings?: string[];
    idempotencyKey?: string;
    conversationId?: string;
  }): Promise<any>;

  /** Retrieves one tenant-bound assistant change set. */
  getAssistantChangeSet?(tenantId: string, changeSetId: string): Promise<any>;

  /** Records human approval only; execution remains disabled server-side. */
  approveAssistantChangeSet?(tenantId: string, changeSetId: string): Promise<any>;

  placePickupTestOrder?(
    tenantId: string,
    options?: {
      channelLinkId?: string;
      menuId?: string;
      plu?: string;
      quantity?: number;
      items?: Array<{
        menuId?: string;
        plu?: string;
        quantity?: number;
      }>;
      customer?: {
        name?: string;
        email?: string;
        phoneNumber?: string;
      };
      pickupNotes?: string;
      orderNote?: string;
      performCheckout?: boolean;
    }
  ): Promise<any>;
}

import { defaultHttpAdminClient } from './HttpAdminClient';
export { defaultHttpAdminClient, defaultAdminClient } from './HttpAdminClient';

/**
 * Single source of truth for Admin Client.
 * All admin operations route through the server BFF (HttpAdminClient).
 * In DEMO mode, HttpAdminClient authenticates with dev_token_* and the BFF routes to demo/in-memory data.
 * In STAGING/PRODUCTION mode, HttpAdminClient authenticates with Firebase ID tokens.
 */
export function getAdminClient(): AdminClient {
  return defaultHttpAdminClient;
}
