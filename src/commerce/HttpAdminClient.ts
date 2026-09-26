import type { AdminClient } from './AdminClient';
import {
  TenantConfig,
  Story,
  CategoryPromoBanner,
  TenantFeePolicy,
  TenantSchedulingPolicy,
  VisualRule,
  Store,
  Catalog,
  AuditLogEntry,
  AdminUser,
  TenantFeatureFlags,
} from './models';
import { MediaHealth, MediaHealthSummary } from './mediaHealthModels';
import { DEFAULT_SCHEDULING_POLICY } from './slotEngine';
import { DEFAULT_SUBSTITUTION_POLICY } from './substitutionPricing';
import { auth, getCurrentAppCheckToken } from '../firebase';
import { getRuntimeMode, isDemoMode } from '../domain/runtime';
import { TenantDispatchRules, DEFAULT_DISPATCH_RULES } from '../rules/types';

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

  public setBaseUrl(url: string) {
    this.baseUrl = url;
  }

  public isDemoMode(): boolean {
    return getRuntimeMode() === 'DEMO';
  }

  async getHeadersAsync(): Promise<Record<string, string>> {
    const authHeader = await getAdminAuthorizationHeader(this.activeUser);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      // Keep one canonical casing across base and tenant-selectable requests.
      // A differently-cased override makes Fetch combine both tenant values.
      'X-Tenant-ID': this.currentTenantId,
    };

    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const appCheckToken = await getCurrentAppCheckToken().catch(() => null);
    if (appCheckToken) {
      headers['X-Firebase-AppCheck'] = appCheckToken;
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
    // Tenant-scoped users are locked to their own tenant. Platform SuperAdmins
    // keep the tenant they explicitly selected in the Admin workspace; otherwise
    // a legacy/default tenant on their identity can silently snap the UI back.
    if (user?.tenantId && user.role !== 'platformSuperAdmin') {
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

  private async safeJson(res: Response, defaultError: string): Promise<any> {
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok) {
      if (contentType.includes('application/json')) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || `${defaultError} (HTTP ${res.status})`);
      } else {
        const text = await res.text().catch(() => '');
        throw new Error(`${defaultError} (HTTP ${res.status}): ${text.slice(0, 120) || res.statusText}`);
      }
    }
    if (contentType.includes('application/json')) {
      return res.json().catch(() => ({}));
    }
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return { raw: text };
    }
  }

  async deleteMembership(membershipId: string): Promise<void> {
    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/memberships/${encodeURIComponent(membershipId)}`, {
      method: 'DELETE',
      headers,
    });
    await this.safeJson(res, 'Failed to delete membership');
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
    currency?: string;
    currencySymbol?: string;
    country?: string;
    domain?: string;
    adminEmail?: string;
    adminName?: string;
  } | Partial<TenantConfig>): Promise<TenantConfig> {
    const headers = await this.getHeadersAsync();
    const payload: Record<string, unknown> = { ...(brandData as any) };
    for (const key of ['domain', 'adminEmail', 'initialAdminEmail', 'adminName', 'tagline']) {
      if (typeof payload[key] === 'string') {
        const trimmed = String(payload[key]).trim();
        payload[key] = trimmed || undefined;
      }
    }

    const res = await fetch(`${this.baseUrl}/admin/tenants`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const message =
        err.safeMessage ||
        err.message ||
        err.error ||
        `Failed to provision brand: ${res.statusText || `HTTP ${res.status}`}`;
      const error: any = new Error(message);
      error.code = err.code;
      error.status = res.status;
      error.details = err.details;
      throw error;
    }
    const result = await res.json();
    return result.tenant || result;
  }

  async deleteBrand(tenantId: string): Promise<boolean> {
    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/tenants/${encodeURIComponent(tenantId)}`, {
      method: 'DELETE',
      headers,
    });
    await this.safeJson(res, 'Failed to delete brand');
    return true;
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

  async updateIntegrationCredentials(
    tenantId: string,
    credentials: {
      credentialMode: 'platform' | 'dedicated';
      clientId?: string;
      clientSecret?: string;
      webhookSecret?: string;
      environment?: 'staging' | 'production';
    }
  ): Promise<any> {
    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/tenants/${encodeURIComponent(tenantId)}/integration/credentials`, {
      method: 'POST',
      headers,
      body: JSON.stringify(credentials),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to update Deliverect credentials: ${res.statusText}`);
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
    const extension = file.name.split('.').pop()?.toLowerCase();
    const inferredContentType =
      extension === 'pdf' ? 'application/pdf' :
      extension === 'json' ? 'application/json' :
      extension === 'md' || extension === 'markdown' ? 'text/markdown' :
      extension === 'txt' ? 'text/plain' :
      extension === 'svg' ? 'image/svg+xml' :
      extension === 'png' ? 'image/png' :
      extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' :
      extension === 'webp' ? 'image/webp' :
      extension === 'woff2' ? 'font/woff2' :
      extension === 'woff' ? 'font/woff' :
      extension === 'ttf' ? 'font/ttf' :
      extension === 'otf' ? 'font/otf' :
      'application/octet-stream';
    const contentType = file.type || inferredContentType;

    // 1. Request short-lived signed upload URL from BFF (Section 31: Storage/Assets Architecture)
    try {
      const urlRes = await fetch(`${this.baseUrl}/admin/assets/upload-url`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          tenantId: tId,
          type,
          fileName: file.name,
          contentType: contentType,
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
          'Content-Type': contentType,
        };
        // The relative URL is the authenticated BFF fallback used when signed URL
        // generation is unavailable. Never forward Firebase auth to an external
        // Cloud Storage signed URL.
        if (!uploadUrl.startsWith('http')) {
          if (headers.Authorization) uploadHeaders.Authorization = headers.Authorization;
          if (headers['X-Tenant-ID']) uploadHeaders['X-Tenant-ID'] = headers['X-Tenant-ID'];
        }

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
            contentType: contentType,
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
      let errMsg = res.statusText || `HTTP ${res.status}`;
      try {
        const errJson = await res.json();
        if (errJson && (errJson.error || errJson.message || errJson.safeMessage)) {
          errMsg = errJson.error || errJson.message || errJson.safeMessage;
        }
      } catch (_) {}
      throw new Error(`Failed to load branding for tenant ${tId}: ${errMsg}`);
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

  async analyseBrandProfile(tenantId: string, assetId: string): Promise<any> {
    const tId = tenantId || this.currentTenantId;
    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/brand-profile/analyse`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ tenantId: tId, assetId }),
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      throw new Error(payload.error || `Brand profile analysis failed (HTTP ${res.status})`);
    }

    const payload = await res.json();
    return payload.analysis;
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
  // SCHEDULING POLICY (ASAP-only / pre-order toggles)
  // ==========================================
  async getSchedulingPolicy(tenantId?: string): Promise<TenantSchedulingPolicy> {
    const tId = tenantId || this.currentTenantId;
    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/tenants/${tId}/scheduling-policy`, {
      headers,
    });
    if (!res.ok) {
      throw new Error(`Failed to retrieve scheduling policy for tenant ${tId}: ${res.statusText}`);
    }
    return res.json();
  }

  async updateSchedulingPolicy(
    tenantId: string,
    policy: Partial<TenantSchedulingPolicy>
  ): Promise<TenantSchedulingPolicy> {
    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/tenants/${tenantId}/scheduling-policy`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(policy),
    });

    if (!res.ok) throw new Error('Failed to update scheduling policy');
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

  async getCommerceCatalog(tenantId: string, storeId?: string): Promise<{
    tenantId: string;
    stores: Store[];
    catalog: Catalog;
  }> {
    const headers = await this.getHeadersAsync();
    const query = storeId ? `?storeId=${encodeURIComponent(storeId)}` : '';
    const res = await fetch(
      `${this.baseUrl}/admin/tenants/${encodeURIComponent(tenantId)}/commerce/catalog${query}`,
      { headers }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || `Failed to load tenant catalogue (HTTP ${res.status})`);
    }
    return res.json();
  }

  async getSearchConfig(tenantId?: string): Promise<any> {
    const tId = tenantId || this.currentTenantId;
    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/tenants/${tId}/search-config`, { headers });
    if (res.ok) return res.json();
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.message || `Failed to load search config (HTTP ${res.status})`);
  }

  async updateSearchConfig(tenantId: string, config: any): Promise<any> {
    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/tenants/${tenantId}/search-config`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (res.ok) return res.json();
    throw new Error(`Failed to save search config: ${res.statusText}`);
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

  async deleteStore(tenantId: string, storeId: string): Promise<boolean> {
    const headers = await this.getHeadersAsync();
    const res = await fetch(
      `${this.baseUrl}/admin/tenants/${encodeURIComponent(tenantId)}/stores/${encodeURIComponent(storeId)}`,
      { method: 'DELETE', headers }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to hard-delete location (HTTP ${res.status})`);
    }
    return true;
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

  async getIntegrationApiLogs(tenantId: string, limit: number = 100, refreshOAuth: boolean = false): Promise<any> {
    const headers = await this.getHeadersAsync();
    const query = new URLSearchParams({
      limit: String(Math.min(200, Math.max(1, limit))),
      ...(refreshOAuth ? { refreshOAuth: 'true' } : {}),
    });
    const res = await fetch(
      `${this.baseUrl}/admin/tenants/${encodeURIComponent(tenantId)}/integration/api-logs?${query.toString()}`,
      { headers }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.error || `Failed to load API logs (HTTP ${res.status})`);
    }
    return res.json();
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

  async downloadSubstitutionEconomicsCsv(tenantId?: string): Promise<void> {
    const tId = String(tenantId || this.currentTenantId || '').trim();
    if (!tId) throw new Error('Tenant is required for substitution economics export.');

    const headers = {
      ...(await this.getHeadersAsync()),
      'X-Tenant-ID': tId,
    };
    const res = await fetch(`${this.baseUrl}/analytics/substitutions/export`, { headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.error || `Substitution export failed (HTTP ${res.status})`);
    }

    const csv = await res.text();
    const disposition = res.headers.get('content-disposition') || '';
    const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
    const filename = filenameMatch?.[1] || `substitution-economics-${tId}.csv`;
    const blob = new Blob([csv], { type: 'text/csv; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
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
    // PUT to the stable rule resource gives edits explicit update semantics.
    // The server remains backward compatible with POST for rule creation.
    const existing = await this.getProductRules(tenantId);
    const isUpdate = existing.some((candidate) => candidate.id === rule.id);
    const url = isUpdate
      ? `${this.baseUrl}/admin/tenants/${tenantId}/rules/${encodeURIComponent(rule.id)}`
      : `${this.baseUrl}/admin/tenants/${tenantId}/rules`;
    const res = await fetch(url, {
      method: isUpdate ? 'PUT' : 'POST',
      headers,
      body: JSON.stringify(rule),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to save rule (HTTP ${res.status})`);
    }
    return this.getProductRules(tenantId);
  }

  async deleteProductRule(tenantId: string, ruleId: string, _user?: AdminUser): Promise<boolean> {
    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/tenants/${tenantId}/rules/${ruleId}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to delete rule (HTTP ${res.status})`);
    }
    const result = await res.json().catch(() => ({ success: true }));
    return result.success !== false;
  }

  // NOT CONNECTED: no /admin/tenants/:id/country-rules BFF endpoint exists yet, so these
  // intentionally do not persist anything. CountryRulesScreen.tsx no longer calls them and
  // shows an explicit "Not Connected" banner instead of a false success state. Wire these up
  // (and the corresponding server/api/v1Router.ts route + storage) as part of building the
  // real rules-engine persistence backend, not by quietly making this return real-looking data.
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

  // Tenant Dispatch Rules (Orchestration & Timing)
  async getDispatchRules(tenantId?: string): Promise<TenantDispatchRules> {
    const tId = tenantId || this.currentTenantId;
    const headers = await this.getHeadersAsync();
    try {
      const res = await fetch(`${this.baseUrl}/admin/tenants/${tId}/dispatch-rules`, { headers });
      if (res.ok) return res.json();
    } catch (err) {
      console.warn('[HttpAdminClient] Failed to fetch dispatch rules:', err);
    }
    return { ...DEFAULT_DISPATCH_RULES };
  }

  async saveDispatchRules(
    tenantId: string,
    rules: Partial<TenantDispatchRules>,
    _user?: AdminUser
  ): Promise<TenantDispatchRules> {
    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/tenants/${tenantId}/dispatch-rules`, {
      method: 'POST',
      headers,
      body: JSON.stringify(rules),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to save dispatch rules');
    }
    return res.json();
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

  async selectAccount(tenantId: string, accountId: string, channelLinkIds: string[] = []): Promise<any> {
    const tId = tenantId || this.currentTenantId;
    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/tenants/${encodeURIComponent(tId)}/integration/select-account`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ accountId, channelLinkIds }),
    });
    return this.safeJson(res, 'Failed to select account');
  }

  async discoverStores(tenantId?: string, accountId?: string): Promise<any> {
    const tId = tenantId || this.currentTenantId;
    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/tenants/${encodeURIComponent(tId)}/integration/discover-stores`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ accountId }),
    });
    return this.safeJson(res, 'Store discovery failed');
  }

  async placePickupTestOrder(
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
  ): Promise<any> {
    const tId = tenantId || this.currentTenantId;
    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/tenants/${encodeURIComponent(tId)}/integration/test-order`, {
      method: 'POST',
      headers,
      body: JSON.stringify(options || {}),
    });
    return this.safeJson(res, 'Test pickup order failed');
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

  async getRawStoreMenu(tenantId: string, storeId: string): Promise<any> {
    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/tenants/${encodeURIComponent(tenantId)}/integration/raw-menu/${encodeURIComponent(storeId)}`, { headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.error || `Raw menu download failed (HTTP ${res.status})`);
    }
    return res.json();
  }

  async inspectStoreMenu(tenantId: string, storeId: string, menuId?: string): Promise<any> {
    const headers = await this.getHeadersAsync();
    const query = menuId ? `?menuId=${encodeURIComponent(menuId)}` : '';
    const res = await fetch(`${this.baseUrl}/admin/tenants/${encodeURIComponent(tenantId)}/integration/menu-inspector/${encodeURIComponent(storeId)}${query}`, { headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.error || `Menu inspection failed (HTTP ${res.status})`);
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

  async verifyDomainOwnership(domainId: string): Promise<any> {
    const headers = await this.getHeadersAsync();
    const res = await fetch(
      `${this.baseUrl}/admin/domains/${encodeURIComponent(domainId)}/verify`,
      { method: 'POST', headers }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const error: any = new Error(err.error || `Domain verification failed: ${res.statusText}`);
      error.code = err.code;
      error.verification = err.verification;
      throw error;
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

  // ==========================================
  // CONNECTION HEALTH & REQUEST TRACE
  // ==========================================
  async getConnectionHealth(tenantId?: string): Promise<any> {
    const tId = tenantId || this.currentTenantId;
    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/connection/health`, {
      method: 'GET',
      headers: {
        ...headers,
        'X-Tenant-ID': tId,
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.error || `Failed to fetch connection health: ${res.statusText}`);
    }
    return res.json();
  }

  async getOperationalReadiness(tenantId?: string): Promise<import('./models').OperationalReadinessSummary> {
    const tId = tenantId || this.currentTenantId;
    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/connection/readiness`, {
      method: 'GET',
      headers: { ...headers, 'X-Tenant-ID': tId },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.error || `Failed to fetch operational readiness: ${res.statusText}`);
    }
    return res.json();
  }

  async listHeldCatalogueReviews(tenantId?: string): Promise<{ reviews: any[]; issueCount: number }> {
    const tId = tenantId || this.currentTenantId;
    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/integrations/deliverect/menu-reviews`, {
      method: 'GET',
      headers: { ...headers, 'X-Tenant-ID': tId },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.error || `Failed to fetch catalogue reviews: ${res.statusText}`);
    }
    return res.json();
  }

  async approveHeldCatalogueReview(tenantId: string, eventId: string): Promise<any> {
    const headers = await this.getHeadersAsync();
    const res = await fetch(
      `${this.baseUrl}/admin/integrations/deliverect/menu-reviews/${encodeURIComponent(eventId)}/approve`,
      {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json', 'X-Tenant-ID': tenantId },
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.error || `Failed to approve catalogue review: ${res.statusText}`);
    }
    return res.json();
  }

  async traceRequest(params: {
    tenantId?: string;
    storeId?: string;
    fulfillmentType?: 'delivery' | 'pickup';
    forceFailureType?: any;
  }): Promise<any> {
    const tId = params.tenantId || this.currentTenantId;
    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/connection/trace`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        'X-Tenant-ID': tId,
      },
      body: JSON.stringify({
        storeId: params.storeId,
        fulfillmentType: params.fulfillmentType || 'delivery',
        forceFailureType: params.forceFailureType,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.error || `Trace request failed: ${res.statusText}`);
    }
    return res.json();
  }

  async getMediaHealth(tenantId?: string, opts?: { recheck?: boolean }): Promise<{ assets: MediaHealth[]; summary: MediaHealthSummary }> {
    const tId = tenantId || this.currentTenantId;
    const headers = await this.getHeadersAsync();
    const query = opts?.recheck ? `?recheck=true` : '';
    const res = await fetch(`${this.baseUrl}/admin/tenants/${encodeURIComponent(tId)}/media-health${query}`, {
      method: 'GET',
      headers: {
        ...headers,
        'X-Tenant-ID': tId,
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.error || `Failed to fetch media health (${res.status})`);
    }
    return res.json();
  }

  async getAssistantActions(tenantId?: string): Promise<any> {
    this.currentTenantId = tenantId || this.currentTenantId;
    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/assistant/actions`, { headers });
    return this.safeJson(res, 'Failed to load assistant actions');
  }

  async createAssistantChangeSet(
    tenantId: string,
    proposal: {
      prompt?: string;
      actions: Array<{ actionName: string; input?: Record<string, unknown> }>;
      affectedResources?: Array<{ type: string; id: string; label?: string }>;
      beforeSnapshot?: unknown;
      afterSnapshot?: unknown;
      diff?: unknown;
      warnings?: string[];
      idempotencyKey?: string;
      conversationId?: string;
    }
  ): Promise<any> {
    this.currentTenantId = tenantId || this.currentTenantId;
    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/assistant/change-sets`, {
      method: 'POST',
      headers,
      body: JSON.stringify(proposal),
    });
    return this.safeJson(res, 'Failed to create assistant change set');
  }

  async getAssistantChangeSet(tenantId: string, changeSetId: string): Promise<any> {
    this.currentTenantId = tenantId || this.currentTenantId;
    const headers = await this.getHeadersAsync();
    const res = await fetch(
      `${this.baseUrl}/admin/assistant/change-sets/${encodeURIComponent(changeSetId)}`,
      { headers }
    );
    return this.safeJson(res, 'Failed to load assistant change set');
  }

  async approveAssistantChangeSet(tenantId: string, changeSetId: string): Promise<any> {
    this.currentTenantId = tenantId || this.currentTenantId;
    const headers = await this.getHeadersAsync();
    const res = await fetch(
      `${this.baseUrl}/admin/assistant/change-sets/${encodeURIComponent(changeSetId)}/approve`,
      { method: 'POST', headers, body: JSON.stringify({}) }
    );
    return this.safeJson(res, 'Failed to approve assistant change set');
  }

  async applyAssistantChangeSet(tenantId: string, changeSetId: string): Promise<any> {
    this.currentTenantId = tenantId || this.currentTenantId;
    const headers = await this.getHeadersAsync();
    const res = await fetch(
      `${this.baseUrl}/admin/assistant/change-sets/${encodeURIComponent(changeSetId)}/apply`,
      { method: 'POST', headers, body: JSON.stringify({}) }
    );
    return this.safeJson(res, 'Failed to apply assistant change set');
  }

  async rollbackAssistantChangeSet(tenantId: string, changeSetId: string): Promise<any> {
    this.currentTenantId = tenantId || this.currentTenantId;
    const headers = await this.getHeadersAsync();
    const res = await fetch(
      `${this.baseUrl}/admin/assistant/change-sets/${encodeURIComponent(changeSetId)}/rollback`,
      { method: 'POST', headers, body: JSON.stringify({}) }
    );
    return this.safeJson(res, 'Failed to roll back assistant change set');
  }

  async chatWithAssistant(
    tenantId: string,
    request: {
      message: string;
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
      context?: { section?: string; resourceType?: string; resourceId?: string; organizationId?: string; market?: string; region?: string; locationGroupId?: string; locationId?: string };
    }
  ): Promise<any> {
    this.currentTenantId = tenantId || this.currentTenantId;
    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/assistant/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });
    return this.safeJson(res, 'Admin AI could not answer');
  }

  async runAssistantAction(
    tenantId: string,
    actionName: string,
    input: Record<string, unknown> = {},
    context?: { section?: string; resourceType?: string; resourceId?: string; organizationId?: string; market?: string; region?: string; locationGroupId?: string; locationId?: string }
  ): Promise<any> {
    this.currentTenantId = tenantId || this.currentTenantId;
    const headers = await this.getHeadersAsync();
    const res = await fetch(`${this.baseUrl}/admin/assistant/run`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ actionName, input, context }),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      const err: any = new Error(payload.error || `Assistant action failed (HTTP ${res.status})`);
      err.code = payload.code || 'ADMIN_ACTION_FAILED';
      err.status = res.status;
      throw err;
    }
    return res.json();
  }
}

export const defaultHttpAdminClient = new HttpAdminClient();
export const defaultAdminClient: AdminClient = defaultHttpAdminClient;
