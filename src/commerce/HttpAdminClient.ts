import type { AdminClient } from './AdminClient';
import {
  TenantConfig,
  Story,
  CategoryPromoBanner,
  TenantFeePolicy,
  VisualRule,
  Store,
  AuditLogEntry,
  AdminUser,
  TenantFeatureFlags,
} from './models';
import { DEFAULT_SCHEDULING_POLICY } from './slotEngine';
import { DEFAULT_SUBSTITUTION_POLICY } from './substitutionPricing';
import { auth } from '../firebase';
import { getRuntimeMode } from '../domain/runtime';

let cachedRealToken: string | null = null;

/**
 * Single source of truth for Admin client Authorization headers.
 * Resolves authentication dynamically at request time:
 * 1. If Firebase user exists or cachedRealToken is present, returns real Bearer token.
 * 2. Else if runtime mode is DEMO, returns dev_token_<role>_<userId>.
 * 3. In STAGING or PRODUCTION, never generates a dev token (returns undefined if unauthenticated).
 */
export async function getAdminAuthorizationHeader(activeUser?: AdminUser | null): Promise<string | undefined> {
  const currentMode = getRuntimeMode();
  console.log('ADMIN_RUNTIME_MODE:', currentMode);

  let token = '';
  let authSource = 'none';

  const fbUser = auth.currentUser;
  if (fbUser) {
    try {
      const rawToken = await fbUser.getIdToken();
      if (rawToken && typeof rawToken === 'string' && rawToken.trim().length > 0) {
        token = rawToken.trim();
        cachedRealToken = token;
        authSource = 'firebase_token';
      }
    } catch (err) {
      console.warn('[HttpAdminClient] Could not refresh Firebase token:', err);
    }
  }

  if (!token && cachedRealToken) {
    token = cachedRealToken;
    authSource = 'cached_firebase_token';
  }

  // Authentication priority:
  // 1. real Firebase ID token (live or cached)
  // 2. ONLY IF runtime mode === DEMO: dev_token_<role>_<userId>
  // 3. otherwise: no Authorization header (never generate dev_token in STAGING or PRODUCTION)
  if (!token && currentMode === 'DEMO') {
    const role = activeUser?.role || 'platformSuperAdmin';
    const userId = activeUser?.id || 'usr-alpha-super';
    token = `dev_token_${role}_${userId}`;
    authSource = 'demo_token';
  }

  console.log('ADMIN_AUTH_SOURCE:', authSource);

  if (token) {
    return `Bearer ${token}`;
  }
  return undefined;
}

export class HttpAdminClient implements AdminClient {
  private activeUser: AdminUser | null = null;
  private currentTenantId: string;
  private baseUrl: string = '/api/v1';

  constructor(initialTenantId: string = 'brand-alpha') {
    this.currentTenantId = initialTenantId;
  }

  public isDemoMode(): boolean {
    return getRuntimeMode() === 'DEMO';
  }

  async getHeadersAsync(): Promise<Record<string, string>> {
    const authHeader = await getAdminAuthorizationHeader(this.activeUser);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Tenant-ID': this.currentTenantId,
    };

    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    return headers;
  }

  setCachedRealToken(token: string | null) {
    if (!token || typeof token !== 'string' || !token.trim() || token === 'null' || token === 'undefined') {
      cachedRealToken = null;
    } else {
      cachedRealToken = token.trim();
    }
  }

  setActiveAdminUser(user: AdminUser | null) {
    this.activeUser = user;
    if (user?.tenantId) {
      this.currentTenantId = user.tenantId;
    }
  }

  async getCurrentAdminUser(_tenantId?: string): Promise<AdminUser> {
    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/auth/me`, { headers });
    if (!res.ok) {
      let errorData: any = {};
      try {
        errorData = await res.json();
      } catch (_) {}
      const err: any = new Error(
        errorData.error || `Admin authentication required (HTTP ${res.status}): Please sign in via Firebase.`
      );
      err.status = res.status;
      err.code = errorData.code || (res.status === 403 ? 'AUTHENTICATED_NOT_AUTHORIZED' : 'AUTH_REQUIRED');
      err.email = errorData.email;
      throw err;
    }
    const user = await res.json();
    if (user && !user.id && (user.uid || user.user?.id || user.user?.uid)) {
      user.id = user.uid || user.user?.id || user.user?.uid;
    }
    this.activeUser = user;
    return user;
  }

  async listMemberships(tenantId?: string): Promise<any[]> {
    const headers = await this.getHeadersAsync();
    const query = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
    const res = await fetch(`${this.baseUrl}/admin/memberships${query}`, { headers });
    if (!res.ok) {
      throw new Error(`Failed to list memberships (HTTP ${res.status})`);
    }
    return res.json();
  }

  async createMembership(data: { email: string; role: string; tenantId?: string; name?: string }): Promise<any> {
    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/memberships`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to create membership (HTTP ${res.status})`);
    }
    return res.json();
  }

  async deleteMembership(membershipId: string): Promise<void> {
    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/memberships/${encodeURIComponent(membershipId)}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to delete membership (HTTP ${res.status})`);
    }
  }

  setMockRole(role: AdminUser['role']): void {
    if (this.activeUser) {
      this.activeUser.role = role;
    }
  }

  async switchTenantAsSuperAdmin(targetTenantId: string): Promise<void> {
    if (this.activeUser && this.activeUser.role !== 'platformSuperAdmin') {
      throw new Error(
        `RBAC Violation: Role '${this.activeUser.role}' is not authorized to switch tenant contexts.`
      );
    }
    this.currentTenantId = targetTenantId;
  }

  // ==========================================
  // BRAND PROVISIONING & TENANTS
  // ==========================================
  async listAllTenants(): Promise<TenantConfig[]> {
    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/tenants`, { headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || res.statusText || `Failed to list tenants (HTTP ${res.status})`);
    }
    return res.json();
  }

  async provisionBrand(brandData: {
    tenantId: string;
    brandName: string;
    primaryColour?: string;
    secondaryColour?: string;
    fontFamily?: string;
    headingFontFamily?: string;
    adminEmail?: string;
    adminName?: string;
  } | Partial<TenantConfig>): Promise<TenantConfig> {
    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/tenants`, {
      method: 'POST',
      headers,
      body: JSON.stringify(brandData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to provision brand: ${res.statusText}`);
    }
    const result = await res.json();
    return result.tenant || result;
  }

  // ==========================================
  // INTEGRATIONS (DELIVERECT & CHANNELS)
  // ==========================================
  async getIntegration(tenantId?: string): Promise<any> {
    const tId = tenantId || this.currentTenantId;
    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/integrations/${tId}`, { headers });
    if (!res.ok) {
      throw new Error(`Failed to fetch integration for tenant ${tId}`);
    }
    return res.json();
  }

  async updateIntegration(tenantId: string, updates: any): Promise<any> {
    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/integrations/${tenantId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to update integration: ${res.statusText}`);
    }
    return res.json();
  }

  // ==========================================
  // ASSET SERVICE (LOGOS, FONTS, HEROES, STORIES)
  // ==========================================
  async uploadAsset(payload: {
    tenantId?: string;
    type: string;
    fileName: string;
    fileData: string;
    contentType?: string;
    byteSize?: number;
  }): Promise<any> {
    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/assets/upload`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        tenantId: payload.tenantId || this.currentTenantId,
        type: payload.type,
        fileName: payload.fileName,
        fileData: payload.fileData,
        contentType: payload.contentType,
        byteSize: payload.byteSize,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to upload asset: ${res.statusText}`);
    }
    const data = await res.json();
    return data.asset;
  }

  async uploadAssetFile(file: File, type: string, tenantId?: string): Promise<any> {
    const tId = tenantId || this.currentTenantId;
    const headers = await this.getHeadersAsync();

    // 1. Request short-lived signed upload URL from BFF (Section 31: Storage/Assets Architecture)
    try {
      const urlRes = await fetch(`${this.baseUrl}/admin/assets/upload-url`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          tenantId: tId,
          type,
          fileName: file.name,
          contentType: file.type || 'application/octet-stream',
          byteSize: file.size,
        }),
      });

      if (urlRes.ok) {
        const { uploadUrl, assetId } = await urlRes.json();
        const targetUrl = uploadUrl.startsWith('http')
          ? uploadUrl
          : `${this.baseUrl.replace(/\/api\/v1$/, '')}${uploadUrl.startsWith('/') ? '' : '/'}${uploadUrl}`;

        // 2. Direct upload to Cloud Storage via signed URL
        const uploadHeaders: Record<string, string> = {
          'Content-Type': file.type || 'application/octet-stream',
        };

        const uploadRes = await fetch(targetUrl, {
          method: 'PUT',
          headers: uploadHeaders,
          body: file,
        });

        if (uploadRes.ok) {
          // 3. Finalize asset metadata
          const finalizeRes = await fetch(`${this.baseUrl}/admin/assets/finalize`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              tenantId: tId,
              assetId,
            }),
          });

          if (finalizeRes.ok) {
            const finalizeData = await finalizeRes.json();
            return finalizeData.asset;
          } else {
            const errData = await finalizeRes.json().catch(() => ({}));
            throw new Error(errData.error || 'Failed to finalize uploaded asset');
          }
        } else {
          throw new Error(`Direct upload failed with status ${uploadRes.status}`);
        }
      } else {
        const errData = await urlRes.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to generate signed upload URL');
      }
    } catch (directErr) {
      if (!this.isDemoMode()) {
        throw directErr;
      }
      console.warn('[HttpAdminClient] Direct signed upload attempt failed, using demo fallback:', directErr);
    }

    // 4. Fallback to buffered base64 upload for offline demo ONLY
    if (!this.isDemoMode()) {
      throw new Error('Direct signed upload is required in staging/production environments.');
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const fileData = reader.result as string;
          const asset = await this.uploadAsset({
            tenantId: tId,
            type,
            fileName: file.name,
            fileData,
            contentType: file.type || 'application/octet-stream',
            byteSize: file.size,
          });
          resolve(asset);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  // ==========================================
  // BRANDING & TENANT CONFIG
  // ==========================================
  async getBranding(tenantId?: string): Promise<TenantConfig & { id?: string }> {
    const tId = tenantId || this.currentTenantId;
    const res = await fetch(`${this.baseUrl}/admin/tenants/${tId}`, {
      headers: await this.getHeadersAsync(),
    });
    if (!res.ok) {
      throw new Error(`Failed to load branding for tenant ${tId}: ${res.statusText}`);
    }
    const data = await res.json();
    return { ...data, id: data.tenantId };
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

    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/tenants/${tId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(updates),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Update failed' }));
      throw new Error(err.error || 'Failed to update tenant branding');
    }

    const updated = await res.json();
    return { ...updated, id: updated.tenantId };
  }

  async listAssets(tenantId?: string, type?: string): Promise<any[]> {
    const tId = tenantId || this.currentTenantId;
    const url = type
      ? `${this.baseUrl}/admin/assets/${tId}?type=${type}`
      : `${this.baseUrl}/admin/assets/${tId}`;
    const headers = await this.getHeadersAsync();
    const res = await fetch(url, { headers });
    if (!res.ok) return [];
    return res.json();
  }

  // ==========================================
  // FEE POLICIES
  // ==========================================
  async getFeePolicy(tenantId?: string): Promise<TenantFeePolicy> {
    const tId = tenantId || this.currentTenantId;
    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/tenants/${tId}/fee-policy`, {
      headers,
    });
    if (!res.ok) {
      throw new Error(`Failed to retrieve fee policy for tenant ${tId}: ${res.statusText}`);
    }
    return res.json();
  }

  async updateFeePolicy(
    tenantIdOrPolicy: string | Partial<TenantFeePolicy>,
    policyOrUser?: Partial<TenantFeePolicy> | AdminUser,
    _user?: AdminUser
  ): Promise<TenantFeePolicy> {
    const tId = typeof tenantIdOrPolicy === 'string' ? tenantIdOrPolicy : this.currentTenantId;
    const policy = typeof tenantIdOrPolicy === 'string' ? (policyOrUser as Partial<TenantFeePolicy>) : tenantIdOrPolicy;

    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/tenants/${tId}/fee-policy`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(policy),
    });

    if (!res.ok) throw new Error('Failed to update fee policy');
    return res.json();
  }

  // ==========================================
  // STORIES
  // ==========================================
  async getStories(tenantId?: string): Promise<Story[]> {
    const tId = tenantId || this.currentTenantId;
    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/tenants/${tId}/stories`, {
      headers,
    });
    if (res.ok) return res.json();
    return [];
  }

  async saveStory(
    tenantIdOrStory: string | Story,
    storyOrUser?: Story | AdminUser,
    _user?: AdminUser
  ): Promise<Story> {
    const tId = typeof tenantIdOrStory === 'string' ? tenantIdOrStory : this.currentTenantId;
    const story = typeof tenantIdOrStory === 'string' ? (storyOrUser as Story) : tenantIdOrStory;

    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/tenants/${tId}/stories`, {
      method: 'POST',
      headers,
      body: JSON.stringify(story),
    });
    if (!res.ok) throw new Error('Failed to save story');
    return res.json();
  }

  async deleteStory(
    tenantIdOrStoryId: string,
    storyIdOrUser?: string | AdminUser,
    _user?: AdminUser
  ): Promise<boolean> {
    const tId = typeof storyIdOrUser === 'string' ? tenantIdOrStoryId : this.currentTenantId;
    const sId = typeof storyIdOrUser === 'string' ? storyIdOrUser : tenantIdOrStoryId;

    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/tenants/${tId}/stories/${sId}`, {
      method: 'DELETE',
      headers,
    });
    return res.ok;
  }

  async purgeStories(tenantId?: string): Promise<boolean> {
    const tId = tenantId || this.currentTenantId;
    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/tenants/${tId}/stories/purge`, {
      method: 'POST',
      headers,
    });
    return res.ok;
  }

  // ==========================================
  // HERO BANNERS
  // ==========================================
  async getHeroBanners(tenantId?: string): Promise<CategoryPromoBanner[]> {
    const tId = tenantId || this.currentTenantId;
    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/tenants/${tId}/hero-banners`, {
      headers,
    });
    if (res.ok) return res.json();
    return [];
  }

  async saveHeroBanner(banner: CategoryPromoBanner, tenantId?: string): Promise<CategoryPromoBanner> {
    const tId = tenantId || this.currentTenantId;
    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/tenants/${tId}/hero-banners`, {
      method: 'POST',
      headers,
      body: JSON.stringify(banner),
    });
    if (!res.ok) throw new Error('Failed to save hero banner');
    return res.json();
  }

  async reorderHeroBanners(banners: CategoryPromoBanner[], tenantId?: string): Promise<CategoryPromoBanner[]> {
    const tId = tenantId || this.currentTenantId;
    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/tenants/${tId}/hero-banners/reorder`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ banners }),
    });
    if (!res.ok) throw new Error('Failed to reorder hero banners');
    return res.json();
  }

  async deleteHeroBanner(bannerId: string, tenantId?: string): Promise<boolean> {
    const tId = tenantId || this.currentTenantId;
    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/tenants/${tId}/hero-banners/${bannerId}`, {
      method: 'DELETE',
      headers,
    });
    return res.ok;
  }

  async resetHeroBanners(tenantId?: string): Promise<CategoryPromoBanner[]> {
    const tId = tenantId || this.currentTenantId;
    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/tenants/${tId}/hero-banners/reset`, {
      method: 'POST',
      headers,
    });
    if (res.ok) return res.json();
    return [];
  }

  // ==========================================
  // FEATURE FLAGS & STORES
  // ==========================================
  async getFeatureFlags(tenantId?: string): Promise<TenantFeatureFlags> {
    const branding = await this.getBranding(tenantId);
    return branding.featureFlags || {
      enableStories: false,
      enableRootCatalogBrowse: true,
      enableCollection: true,
      allowStoreSwitchingWithBasket: false,
      enableNutritionalInfo: false,
      enableDeposits: false,
      enableAgeVerification: false,
      enableSearchSuggestions: false,
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

  async getStores(tenantId?: string): Promise<Store[]> {
    const tId = tenantId || this.currentTenantId;
    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/tenants/${tId}/stores`, { headers });
    if (res.ok) return res.json();
    return [];
  }

  async updateStore(
    arg1: string,
    arg2: string | Partial<Store> | Store,
    arg3?: Partial<Store> | Store | AdminUser,
    _arg4?: AdminUser
  ): Promise<Store> {
    let tenantId = this.currentTenantId;
    let storeId: string;
    let updateData: Partial<Store>;

    if (typeof arg2 === 'string') {
      tenantId = arg1 || this.currentTenantId;
      storeId = arg2;
      updateData = (arg3 as Partial<Store>) || {};
    } else {
      tenantId = arg1 || this.currentTenantId;
      storeId = (arg2 as Store).id;
      updateData = arg2 as Partial<Store>;
    }

    const headers = await this.getHeadersAsync();
    const res = await fetch(
      `${this.baseUrl}/admin/tenants/${encodeURIComponent(tenantId)}/stores/${encodeURIComponent(storeId)}`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({ store: updateData }),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to update store (HTTP ${res.status})`);
    }

    return res.json();
  }

  // ==========================================
  // AUDIT LOGS
  // ==========================================
  async getAuditLogs(tenantId?: string): Promise<AuditLogEntry[]> {
    const tId = tenantId || this.currentTenantId;
    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/tenants/${tId}/audit-logs`, {
      headers,
    });
    if (res.ok) return res.json();
    return [];
  }

  // ==========================================
  // DATA EXPORTS (CSV / JSON)
  // ==========================================
  async exportData(
    type: 'audit-logs' | 'orders' | 'analytics' | 'stores',
    format: 'csv' | 'json' = 'csv',
    tenantId?: string
  ): Promise<{ data: string | any; filename: string; contentType: string }> {
    const tId = tenantId || this.currentTenantId;
    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/tenants/${tId}/export/${type}?format=${format}`, {
      headers,
    });
    if (!res.ok) {
      throw new Error(`Export failed with status ${res.status}`);
    }

    const contentType = res.headers.get('content-type') || (format === 'csv' ? 'text/csv' : 'application/json');
    const disposition = res.headers.get('content-disposition');
    let filename = `${tId}-${type}.${format}`;
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) filename = match[1];
    }

    if (format === 'csv') {
      const text = await res.text();
      return { data: text, filename, contentType };
    } else {
      const json = await res.json();
      return { data: json, filename, contentType };
    }
  }

  async triggerBrowserDownload(
    type: 'audit-logs' | 'orders' | 'analytics' | 'stores',
    format: 'csv' | 'json' = 'csv',
    tenantId?: string
  ): Promise<void> {
    const result = await this.exportData(type, format, tenantId);
    const blob = new Blob([typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2)], {
      type: result.contentType,
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Product rules & policies
  async getProductRules(tenantId?: string): Promise<VisualRule[]> {
    const tId = tenantId || this.currentTenantId;
    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/tenants/${tId}/rules`, { headers });
    if (res.ok) return res.json();
    return [];
  }

  async saveProductRule(tenantId: string, rule: VisualRule, _user?: AdminUser): Promise<VisualRule[]> {
    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/tenants/${tenantId}/rules`, {
      method: 'POST',
      headers,
      body: JSON.stringify(rule),
    });
    if (!res.ok) throw new Error('Failed to save rule');
    return this.getProductRules(tenantId);
  }

  async deleteProductRule(tenantId: string, ruleId: string, _user?: AdminUser): Promise<boolean> {
    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/tenants/${tenantId}/rules/${ruleId}`, {
      method: 'DELETE',
      headers,
    });
    return res.ok;
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

  async testDeliverectOAuth(
    tenantId?: string,
    options?: { environment?: string; clientId?: string; clientSecret?: string }
  ): Promise<any> {
    const tId = tenantId || this.currentTenantId;
    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/tenants/${tId}/integration/test-oauth`, {
      method: 'POST',
      headers,
      body: JSON.stringify(options || {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok && !data.status) {
      throw new Error(data.message || data.error || `OAuth test failed: ${res.statusText}`);
    }
    return data;
  }

  async testPlatformDeliverectOAuth(
    options?: { environment?: string; clientId?: string; clientSecret?: string }
  ): Promise<any> {
    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/platform/integrations/deliverect/test-oauth`, {
      method: 'POST',
      headers,
      body: JSON.stringify(options || {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok && !data.status) {
      throw new Error(data.message || data.error || `Platform OAuth test failed: ${res.statusText}`);
    }
    return data;
  }

  async syncLinkedAccounts(tenantId?: string): Promise<any> {
    const tId = tenantId || this.currentTenantId;
    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/tenants/${tId}/integration/sync`, {
      method: 'POST',
      headers,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.error || `Linked accounts sync failed: ${res.statusText}`);
    }
    return res.json();
  }

  async getLinkedAccounts(tenantId?: string): Promise<any> {
    const tId = tenantId || this.currentTenantId;
    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/tenants/${tId}/integration/accounts`, {
      headers,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.error || `Failed to fetch accounts: ${res.statusText}`);
    }
    return res.json();
  }

  async selectAccount(tenantId: string, accountId: string): Promise<any> {
    const tId = tenantId || this.currentTenantId;
    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/tenants/${tId}/integration/select-account`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ accountId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.error || `Failed to select account: ${res.statusText}`);
    }
    return res.json();
  }

  async discoverStores(tenantId?: string, accountId?: string): Promise<any> {
    const tId = tenantId || this.currentTenantId;
    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/tenants/${tId}/integration/discover-stores`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ accountId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.error || `Store discovery failed: ${res.statusText}`);
    }
    return res.json();
  }

  async getCommerceDiagnostics(tenantId?: string): Promise<any> {
    const tId = tenantId || this.currentTenantId;
    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/tenants/${tId}/integration/commerce-diagnostics`, {
      method: 'GET',
      headers,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.error || `Commerce diagnostics failed: ${res.statusText}`);
    }
    return res.json();
  }

  // ==========================================
  // DOMAIN MAPPINGS
  // ==========================================
  async listAllDomains(): Promise<any[]> {
    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/domains`, { headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to fetch domains: ${res.statusText}`);
    }
    return res.json();
  }

  async addOrUpdateDomain(data: { hostname: string; tenantId: string; isPrimary?: boolean }): Promise<any> {
    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/domains`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to save domain mapping: ${res.statusText}`);
    }
    return res.json();
  }

  async deleteDomain(domainId: string): Promise<any> {
    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/domains/${encodeURIComponent(domainId)}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to delete domain: ${res.statusText}`);
    }
    return res.json();
  }
}

export const defaultHttpAdminClient = new HttpAdminClient();
export const defaultAdminClient: AdminClient = defaultHttpAdminClient;
