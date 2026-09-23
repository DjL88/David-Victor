import express, { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { getDeliverectAdapterAsync, getDispatchAdapter, PaymentService, DispatchOrchestrationService } from '../deliverect';
import type { DeliverectAdapter } from '../deliverect/DeliverectAdapter';
import { setStoreOverride } from '../deliverect/DeliverectApiClient';
import { CommerceDiscoveryService } from '../deliverect/CommerceDiscoveryService';
import { ConnectionDiagnostics } from '../deliverect/ConnectionDiagnostics';
import { connectionHealthService } from '../deliverect/ConnectionHealthService';
import { LinkedAccountsAdapter } from '../deliverect/LinkedAccountsAdapter';
import { IntegrationContext } from '../deliverect/IntegrationContext';
import { FirestorePlatformService, FirestoreService, OrderProjection } from '../firestoreService';
import {
  getFirestoreDb,
  getFirebaseStorage,
  getFirebaseAuth,
  getFirebaseAdminAuth,
  getFirebaseConfig,
  getFirestorePermissionStatus,
  verifyAdminSession,
  verifyAdminSessionWithStatus,
  AuthenticatedAdmin,
} from '../firebase';
import { AssetService, AssetType, normalizeAssetType } from '../assetService';
import { BrandProfileService } from '../brandProfileService';
import { MediaHealthService } from '../mediaHealthService';
import { LocationService } from '../locationService';
import { WebhookService, WebhookProcessingResult } from '../deliverect/WebhookService';
import {
  DeliverectOperationalWebhookService,
  type DeliverectOperationalWebhookType,
} from '../deliverect/DeliverectOperationalWebhookService';
import { SubstitutionCallbackService } from '../deliverect/SubstitutionCallbackService';
import { AnalyticsService } from '../analyticsService';
import { NotificationService } from '../notificationService';
import { CustomerAccountService } from '../customerAccountService';
import { AsyncWorkerService, verifyCloudTasksOidcToken } from '../asyncWorkerService';
import { MetricsService } from '../metricsService';
import { circuitBreakers } from '../circuitBreaker';
import { checkoutAndPaymentRateLimiter } from '../rateLimiter';
import { CheckoutResult } from '../../src/domain/models';
import { TenantConfig, Product } from '../../src/commerce/models';
import { MOCK_TENANTS } from '../../src/commerce/mockData';
import { GOOGLE_FONTS_CATALOG } from '../../src/commerce/googleFonts';
import { BFFError, CommerceError } from '../errors';
import { assertProductAddAllowed, assertBasketCheckoutAllowed } from '../ruleEnforcementService';
import { SecretManager } from '../secrets';
import { CmsService } from '../cmsService';
import { isMarketingContentVisible } from '../marketingSchedule';
import { getServerRuntimeMode, isDemoMode, isStagingMode, isProductionMode, isLiveMode, isTestMode } from '../runtimeMode';
import { DemoDiscoveryDataProvider } from '../deliverect/DemoDiscoveryDataProvider';
import { DeliverectCommerceBasketApi } from '../deliverect/DeliverectCommerceBasketApi';
import { mergeCheckoutProjection } from '../deliverect/CheckoutProjectionMerge';
import {
  isConfirmedOrderLifecycleStatus,
  isFailedOrderLifecycleStatus,
  isPendingCheckoutStatus,
  mapCheckoutPublicStatus,
} from '../checkoutState';
import { inspectDeliverectMenu, selectRawMenu } from '../deliverect/DeliverectMenuInspector';
import { OAuthTokenManager } from '../deliverect/OAuthTokenManager';
import { validateBody } from './validation';
import { listAssistantActionsForRole, assertAssistantActionAllowed, buildReadOnlyActionPlan, hasServerAdminCapability, type ServerAdminCapability } from '../admin/adminActionRegistry';
import { AdminAssistantActionService } from '../admin/adminAssistantActionService';
import { AdminAssistantChatService } from '../admin/adminAssistantChatService';
import { AdminChangeSetService } from '../admin/adminChangeSetService';
import { AdminResourceAdapterRegistry } from '../admin/adminResourceAdapters';
import {
  createDomainVerificationToken,
  domainVerificationRecordName,
  domainVerificationRecordValue,
  verifyDomainOwnershipTxt,
} from '../domainVerificationService';

if (isDemoMode()) {
  CommerceDiscoveryService.setDataProvider(new DemoDiscoveryDataProvider());
}
import {
  ResolveLocationSchema,
  SearchStoresSchema,
  SearchCatalogSchema,
  CreateBasketSchema,
  UpdateBasketItemSchema,
  UpdateBasketItemsSchema,
  AddBasketBundleSchema,
  UpdateBasketItemSubstitutionSchema,
  UpdateBasketCustomerSchema,
  CustomerFavouritesSchema,
  CustomerAddressesSchema,
  UpdateBasketFulfillmentSchema,
  UpdateBasketStoreSchema,
  UpdateBasketDiscountsSchema,
  UpdateBasketChargesSchema,
  UpdateBasketTipSchema,
  ValidateBasketSchema,
  ReconcileBasketSchema,
  DeliveryOptionsSchema,
  DeliverySlotsSchema,
  PaymentSessionSchema,
  PaymentGatewaysQuerySchema,
  DPayRequestPaymentSchema,
  CapturePaymentSchema,
  RefundPaymentSchema,
  ReauthorizePaymentSchema,
  CalculateCeilingSchema,
  CheckoutBasketSchema,
  ValidateDispatchSchema,
  GetDispatchQuotesSchema,
  AssignDispatchSchema,
  CancelDispatchSchema,
  UpdateTenantDispatchRulesSchema,
  SaveVisualRuleSchema,
  CreateTenantSchema,
  UpdateTenantConfigSchema,
  UpdateFeePolicySchema,
  UpdateSchedulingPolicySchema,
  SaveStorySchema,
  SaveHeroBannerSchema,
  ReorderHeroBannersSchema,
  UpdateIntegrationSchema,
  TestConnectionSchema,
  UpdateIntegrationCredentialsSchema,
  AssetUploadSchema,
  AssetUploadUrlSchema,
  AssetFinalizeSchema,
  BrandProfileAnalyseSchema,
  AdminAssistantChatSchema,
  AdminAssistantPlanSchema,
  AdminAssistantExecuteSchema,
  AdminAssistantChangeSetSchema,
} from './schemas';

export const v1Router = Router();

/**
 * Standardized error handler for storefront commerce routes.
 * Ensures 503 INTEGRATION_NOT_CONFIGURED and 501 INTEGRATION_CAPABILITY_NOT_IMPLEMENTED
 * are cleanly surfaced to the client without falling back to mock fixtures in non-demo mode.
 */
function handleCommerceError(res: Response, err: any, defaultMessage: string = 'Commerce operation failed') {
  const statusCode = err.status || err.statusCode || 500;
  const code =
    err.code ||
    (statusCode === 503
      ? 'INTEGRATION_NOT_CONFIGURED'
      : statusCode === 501
      ? 'INTEGRATION_CAPABILITY_NOT_IMPLEMENTED'
      : 'COMMERCE_ERROR');

  res.status(statusCode).json({
    error: err.message || defaultMessage,
    code,
  });
}

// Extend Request type to carry admin identity & resolved tenant
interface AuthenticatedRequest extends Request {
  adminUser?: AuthenticatedAdmin;
  resolvedTenantId?: string;
}

/**
 * Section 8 & Item 11: Hostname / Subdomain Tenant Resolver
 * Production tenant selection MUST NOT trust ?tenant=foo or arbitrary request-body tenant IDs.
 * Resolve tenant primarily using hostname/domain:
 * hostname -> Domain record in Firestore -> Tenant
 * For development/demo only, an explicit development override is permitted.
 */
export function resolveTenant(req: Request): string {
  if ((req as any).resolvedTenantId) {
    return (req as any).resolvedTenantId;
  }
  const authAdmin = (req as any).adminUser;
  const isSuperAdmin = authAdmin?.role === 'platformSuperAdmin';
  const requestedOverride = (req.headers['x-tenant-id'] as string) || (req.query.tenantId as string);
  const authorizedPreviewToken = req.headers['x-preview-auth-token'] as string;
  const isAuthorizedPreview =
    Boolean(authorizedPreviewToken && process.env.PREVIEW_AUTH_TOKEN && authorizedPreviewToken === process.env.PREVIEW_AUTH_TOKEN);

  // 1. Authenticated tenant admin is strictly locked to their assigned tenant (Tenant A cannot access Tenant B)
  if (authAdmin && !isSuperAdmin && authAdmin.tenantId) {
    return authAdmin.tenantId;
  }

  // 2. Authorized mechanism: Platform Super Admin or Authorized Preview Token
  if ((isSuperAdmin || isAuthorizedPreview) && requestedOverride) {
    return requestedOverride;
  }

  // 3. In test mode, allow test suites to target specific tenants (unless simulating public request)
  if (isTestMode() && requestedOverride && !(req as any).simulatePublicRequest) {
    return requestedOverride;
  }

  // 4. Admin routes fallback
  if (req.path?.startsWith('/admin')) {
    if (requestedOverride) return requestedOverride;
    if (authAdmin?.tenantId) return authAdmin.tenantId;
    return 'brand-alpha';
  }

  // 5. Container / preview hosts fallback
  const host = ((req.headers['x-forwarded-host'] as string) || req.hostname || '').toLowerCase().split(':')[0];
  const isContainerOrPreviewHost =
    host.endsWith('.run.app') ||
    host.endsWith('.google.com') ||
    host.endsWith('.googleusercontent.com') ||
    host.endsWith('.ai.studio') ||
    host.includes('aistudio') ||
    host === 'localhost' ||
    host === '127.0.0.1';
  if (isContainerOrPreviewHost) {
    return requestedOverride || process.env.PREVIEW_TENANT_ID || 'brand-alpha';
  }

  throw new BFFError('TENANT_NOT_FOUND', `Tenant not found for domain "${host}".`, 404);
}

async function getCallerUid(req: Request): Promise<string | undefined> {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const rawToken = authHeader.substring(7).trim();
    if (!rawToken) return undefined;

    if (rawToken.startsWith('dev_token_')) {
      if (isDemoMode()) {
        return `usr_${rawToken}`;
      }
      return undefined;
    }

    const parts = rawToken.split('.');
    if (parts.length !== 3 || parts.some((p) => !p.trim())) {
      return undefined;
    }

    try {
      const auth = getFirebaseAuth();
      if (auth) {
        const decoded = await auth.verifyIdToken(rawToken);
        return decoded.uid;
      }
    } catch {
      // invalid or expired token
    }
  }
  return undefined;
}

// Global v1Router tenant resolution middleware
v1Router.use(async (req: Request, res: Response, next) => {
  try {
    // 0. Exempt routes: probes, platform mode, webhooks (verified by HMAC), async tasks (verified by OIDC), and admin routes (verified by auth & tenant headers)
    const tenantResolutionExempt =
      req.path === '/platform/mode' ||
      req.path.startsWith('/platform') ||
      req.path.startsWith('/admin') ||
      req.path === '/health' ||
      req.path === '/ready' ||
      req.path.startsWith('/webhooks') ||
      req.path.startsWith('/tasks') ||
      req.path.startsWith('/internal/tasks');

    if (tenantResolutionExempt) {
      const override = (req.headers['x-tenant-id'] as string) || (req.query.tenantId as string);
      if (override) {
        (req as any).resolvedTenantId = override;
      }
      return next();
    }

    const authAdmin = (req as any).adminUser;
    const isSuperAdmin = authAdmin?.role === 'platformSuperAdmin';
    const requestedOverride = (req.headers['x-tenant-id'] as string) || (req.query.tenantId as string);
    const authorizedPreviewToken = req.headers['x-preview-auth-token'] as string;
    const isAuthorizedPreview =
      Boolean(authorizedPreviewToken && process.env.PREVIEW_AUTH_TOKEN && authorizedPreviewToken === process.env.PREVIEW_AUTH_TOKEN);

    // 0. Authenticated tenant admin is strictly locked to their assigned tenant (Tenant A cannot access Tenant B)
    if (authAdmin && !isSuperAdmin && authAdmin.tenantId) {
      (req as any).resolvedTenantId = authAdmin.tenantId;
      return next();
    }

    // 1. Authorized mechanism: Platform Super Admin or Authorized Preview Token
    if ((isSuperAdmin || isAuthorizedPreview) && requestedOverride) {
      (req as any).resolvedTenantId = requestedOverride;
      return next();
    }

    // 2. In test mode, allow tests to specify target tenant via header/query (unless simulating public caller)
    if (isTestMode() && requestedOverride && !(req as any).simulatePublicRequest) {
      (req as any).resolvedTenantId = requestedOverride;
      return next();
    }

    // 3. Admin routes fallback
    if (req.path?.startsWith('/admin')) {
      if (requestedOverride && isSuperAdmin) {
        (req as any).resolvedTenantId = requestedOverride;
        return next();
      }
      if (authAdmin?.tenantId) {
        (req as any).resolvedTenantId = authAdmin.tenantId;
        return next();
      }
    }

    // 3. Resolve via hostname/domains in Firestore and Persistent Registry
    const forwardedHost = (req.headers['x-forwarded-host'] as string) || '';
    const rawHost = (forwardedHost.split(',')[0] || (req.headers.host as string) || req.hostname || '').toLowerCase().trim();
    const host = rawHost.split(':')[0];
    const resolvedFromDb = await FirestorePlatformService.resolveTenantByHostname(host);

    if (resolvedFromDb) {
      (req as any).resolvedTenantId = resolvedFromDb;
      return next();
    }

    // 4. Server-authorized preview tenant for container/preview hosts
    const isContainerOrPreviewHost =
      host.endsWith('.run.app') ||
      host.endsWith('.google.com') ||
      host.endsWith('.googleusercontent.com') ||
      host.endsWith('.ai.studio') ||
      host.includes('aistudio') ||
      host === 'localhost' ||
      host === '127.0.0.1';

    if (isContainerOrPreviewHost) {
      const previewTenantId =
        requestedOverride ||
        process.env.PREVIEW_TENANT_ID ||
        (isDemoMode() || isTestMode() ? 'brand-alpha' : undefined);
      if (!previewTenantId) {
        return res.status(503).json({
          code: 'PREVIEW_TENANT_NOT_CONFIGURED',
          message: 'This preview host has no configured tenant.',
        });
      }
      (req as any).resolvedTenantId = previewTenantId;
      return next();
    }

    // Explicitly reject unknown domains without fallback
    return res.status(404).json({
      code: 'TENANT_NOT_FOUND',
      message: `Tenant not found for domain "${host}".`,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Section 45: HTTP Conditional Caching & ETag Helper
 * Automatically handles ETag generation, Cache-Control headers, and 304 Not Modified
 */
function sendConditionalJson(
  req: Request,
  res: Response,
  data: any,
  cacheControl: string = 'public, max-age=60, stale-while-revalidate=300'
) {
  const jsonString = JSON.stringify(data);
  const hash = crypto.createHash('md5').update(jsonString).digest('hex');
  const etag = `"${hash}"`;

  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', cacheControl);

  const ifNoneMatch = req.headers['if-none-match'];
  if (ifNoneMatch === etag || ifNoneMatch === hash || ifNoneMatch === `W/${etag}`) {
    return res.status(304).end();
  }

  return res.type('application/json').send(jsonString);
}

export function resolveAdminRequestedTenant(req: AuthenticatedRequest): string | undefined {
  // Route-bound tenant IDs are authoritative. Never let a caller-selected
  // x-tenant-id header override a different tenant encoded in the URL.
  if (req.params?.tenantId) return String(req.params.tenantId);

  if (req.path?.startsWith('/admin/tenants/') && req.params?.id) {
    return String(req.params.id);
  }

  const headerTenant = req.headers['x-tenant-id'];
  if (typeof headerTenant === 'string' && headerTenant.trim()) {
    return headerTenant.trim();
  }

  const resolved = (req as any).resolvedTenantId;
  return typeof resolved === 'string' && resolved.trim() ? resolved.trim() : undefined;
}

/**
 * RBAC Middleware to protect Admin endpoints
 */
function requireAdminAuth(requiredRole?: 'platformSuperAdmin' | 'tenantAdmin' | 'marketingEditor' | 'operationsEditor') {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const requestedTenant = resolveAdminRequestedTenant(req);
    let tenantId = requestedTenant;
    if (!tenantId) {
      try {
        tenantId = resolveTenant(req);
      } catch (err) {
        if (isDemoMode() || isTestMode()) {
          tenantId = 'brand-alpha';
        } else {
          return res.status(400).json({
            error: 'A tenant scope is required for this admin request.',
            code: 'TENANT_SCOPE_REQUIRED',
          });
        }
      }
    }

    const authResult = await verifyAdminSessionWithStatus(authHeader, tenantId);
    if (!authResult.authenticated) {
      return res.status(401).json({
        error: authResult.message || 'Unauthorized: Admin authentication required.',
        code: authResult.code || 'AUTH_REQUIRED',
      });
    }

    if (!authResult.authorized || !authResult.user) {
      return res.status(403).json({
        error: authResult.message || 'Forbidden: User authenticated but not authorized for this resource.',
        code: authResult.code || 'AUTHENTICATED_NOT_AUTHORIZED',
        email: authResult.email,
      });
    }

    const admin = authResult.user;
    req.adminUser = admin;
    (req as any).adminUser = admin;
    (req as any).resolvedTenantId = admin.isSuperAdmin ? tenantId : (admin.tenantId || tenantId);

    // Role-based authorization
    if (requiredRole && admin.role !== 'platformSuperAdmin' && !admin.isSuperAdmin) {
      if (requiredRole === 'platformSuperAdmin') {
        return res.status(403).json({
          error: 'Forbidden: Platform SuperAdmin privilege required.',
          code: 'FORBIDDEN_SUPERADMIN_ONLY',
        });
      }
      if (admin.role !== requiredRole && admin.role !== 'tenantAdmin') {
        return res.status(403).json({
          error: `Forbidden: Requires role ${requiredRole}, but user has ${admin.role}.`,
          code: 'INSUFFICIENT_PERMISSIONS',
        });
      }
    }

    // Tenant isolation verification: non-superadmin cannot access other tenants
    if (!admin.isSuperAdmin && admin.role !== 'platformSuperAdmin' && tenantId && admin.tenantId !== tenantId) {
      return res.status(403).json({
        error: `Tenant Isolation Violation: User belonging to ${admin.tenantId} cannot access tenant ${tenantId}.`,
        code: 'TENANT_ISOLATION_ERROR',
      });
    }

    next();
  };
}

/**
 * Middleware requiring Platform SuperAdmin privileges (Section 8, 27)
 */
function requireAdminCapability(capability: ServerAdminCapability) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const admin = req.adminUser || (req as any).adminUser;
    if (!admin) {
      return res.status(401).json({
        error: 'Unauthorized: Admin authentication required before capability checks.',
        code: 'AUTH_REQUIRED',
      });
    }
    if (admin.isSuperAdmin || admin.role === 'platformSuperAdmin' || hasServerAdminCapability(admin.role, capability)) {
      return next();
    }
    return res.status(403).json({
      error: `Forbidden: Missing admin capability ${capability}.`,
      code: 'ADMIN_CAPABILITY_REQUIRED',
      capability,
    });
  };
}

/**
 * Middleware requiring Platform SuperAdmin privileges (Section 8, 27)
 */
function requirePlatformSuperAdmin() {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const authResult = await verifyAdminSessionWithStatus(authHeader, 'platform');
    if (!authResult.authenticated) {
      return res.status(401).json({
        error: authResult.message || 'Unauthorized: Admin authentication required.',
        code: authResult.code || 'AUTH_REQUIRED',
      });
    }

    if (!authResult.authorized || !authResult.user) {
      return res.status(403).json({
        error: authResult.message || 'Forbidden: User authenticated but not authorized as Platform SuperAdmin.',
        code: authResult.code || 'AUTHENTICATED_NOT_AUTHORIZED',
        email: authResult.email,
      });
    }

    const admin = authResult.user;
    if (!admin.isSuperAdmin && admin.role !== 'platformSuperAdmin') {
      return res.status(403).json({
        error: 'Forbidden: Platform SuperAdmin privilege required.',
        code: 'FORBIDDEN_SUPERADMIN_ONLY',
      });
    }

    req.adminUser = admin;
    next();
  };
}

// ==========================================
// 0. PLATFORM ENVIRONMENT & MODE
// ==========================================
v1Router.get('/platform/mode', (_req: Request, res: Response) => {
  const mode = getServerRuntimeMode();
  const firestorePermission = getFirestorePermissionStatus();
  const firebaseConfig = getFirebaseConfig();

  res.json({
    appMode: mode,
    isDemo: mode === 'demo',
    isStaging: mode === 'staging',
    isProduction: mode === 'production',
    allowMockFallback: mode === 'demo',
    firestore: {
      access: firestorePermission.denied ? 'permission_denied' : 'unknown_or_available',
      retryInMs: firestorePermission.retryInMs,
      projectId: firebaseConfig?.projectId || process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || null,
      databaseId: firebaseConfig?.firestoreDatabaseId || process.env.FIRESTORE_DATABASE_ID || '(default)',
    },
    timestamp: new Date().toISOString(),
  });
});

// ==========================================
// 1. BOOTSTRAP (Storefront public entry)
// ==========================================
v1Router.get('/bootstrap', async (req: Request, res: Response) => {
  try {
    const tenantId = resolveTenant(req);
    let tenant: TenantConfig;
    try {
      tenant = await FirestorePlatformService.getTenantConfig(tenantId);
    } catch (err: any) {
      const statusCode = err?.statusCode || 404;
      return res.status(statusCode).json({
        code: err?.code || 'TENANT_NOT_FOUND',
        message: err?.message || `Tenant "${tenantId}" not found or unconfigured.`,
      });
    }

    const storeConfig = {
      defaultCountry: tenant.country || 'GB',
      defaultCurrency: tenant.currency || 'GBP',
      defaultCurrencySymbol: tenant.currencySymbol || '£',
      defaultLocale: tenant.locale || 'en-GB',
    };

    const searchConfig = await FirestorePlatformService.getTenantSearchConfig(tenantId);

    return sendConditionalJson(
      req,
      res,
      {
        tenant,
        featureFlags: tenant.featureFlags || {},
        theme: {
          primary: tenant.primaryColour,
          secondary: tenant.secondaryColour,
          background: tenant.backgroundColour,
          text: tenant.textColour,
          fontFamily: tenant.fontFamily,
          borderRadius: tenant.borderRadius,
        },
        storeConfig,
        searchConfig,
      },
      'public, max-age=30, stale-while-revalidate=120'
    );
  } catch (err: any) {
    console.error('[API] /bootstrap error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch bootstrap configuration' });
  }
});

// ==========================================
// 2. LOCATION & GEOCODING
// ==========================================
v1Router.post('/location/resolve', validateBody(ResolveLocationSchema), async (req: Request, res: Response) => {
  try {
    const { query } = req.body;
    const appMode = getServerRuntimeMode();
    const result = await LocationService.resolveLocation(query, appMode);
    res.json(result);
  } catch (err: any) {
    console.error('[API] /location/resolve error:', err);
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ error: err.message || 'Failed to resolve location', code: err.code });
  }
});

// ==========================================
// 3. STORES & ELIGIBILITY
// ==========================================
v1Router.post('/stores/search', validateBody(SearchStoresSchema), async (req: Request, res: Response) => {
  try {
    const { coordinates, address, preferredFulfillment } = req.body;
    const normalizedAddress = typeof address === 'string'
      ? { city: '', country: '', formattedAddress: address }
      : address;
    const tenantId = resolveTenant(req);
    const adapter = await getDeliverectAdapterAsync(tenantId);
    const result = await adapter.getEligibleStores(coordinates, normalizedAddress, preferredFulfillment);
    res.json(result);
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to search eligible stores');
  }
});

v1Router.get('/stores', async (req: Request, res: Response) => {
  try {
    const tenantId = resolveTenant(req);
    const adapter = await getDeliverectAdapterAsync(tenantId);
    const stores = await adapter.getStores();
    res.json(stores);
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to fetch stores');
  }
});

v1Router.get('/stores/:storeId', async (req: Request, res: Response) => {
  try {
    const tenantId = resolveTenant(req);
    const adapter = await getDeliverectAdapterAsync(tenantId);
    const store = await adapter.getStore(req.params.storeId);
    if (!store) {
      return res.status(404).json({ error: `Store ${req.params.storeId} not found` });
    }
    res.json(store);
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to retrieve store');
  }
});

v1Router.get('/config/maps', (_req: Request, res: Response) => {
  const apiKey =
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY;
  const mapId = process.env.VITE_GOOGLE_MAPS_MAP_ID;

  // Never make staging/production look configured by returning demo/sample
  // credentials. Missing runtime configuration is an operational error.
  if ((!apiKey || !mapId) && !isDemoMode() && !isTestMode()) {
    return res.status(503).json({
      code: 'INTEGRATION_NOT_CONFIGURED',
      message: 'Google Maps is not configured for this runtime.',
    });
  }

  res.json({
    apiKey: apiKey || '',
    mapId: mapId || '',
  });
});

// ==========================================
// CACHE MANAGEMENT & RESET
// ==========================================
v1Router.post('/cache/reset', requireAdminAuth('platformSuperAdmin'), async (req: Request, res: Response) => {
  try {
    CommerceDiscoveryService.getInstance().clearCache();
    console.info('[BFF Cache Reset] Cleared candidate stores, root catalog, and store catalog memory caches.');
    return res.status(200).json({
      success: true,
      message: 'All commerce, store, and catalog caches successfully reset.',
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to reset cache',
    });
  }
});

// ==========================================
// 4. CATALOGS & PRODUCTS
// ==========================================
v1Router.get('/product-tags', async (req: Request, res: Response) => {
  try {
    const tenantId = resolveTenant(req);
    const adapter = await getDeliverectAdapterAsync(tenantId);
    const tagAdapter = adapter as any;
    if (typeof tagAdapter.getProductTagDefinitions !== 'function') {
      return res.status(501).json({ code: 'TAG_DEFINITIONS_NOT_SUPPORTED', message: 'The active commerce adapter does not expose product tag definitions.' });
    }
    const definitions = await tagAdapter.getProductTagDefinitions(req.query.refresh === 'true');
    return res.json({ definitions, count: definitions.length, source: 'DELIVERECT_ALL_ALLERGENS' });
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to retrieve Deliverect product tag definitions');
  }
});

v1Router.get('/catalog', async (req: Request, res: Response) => {
  try {
    const isForceRefresh = req.query.refresh === 'true' || req.headers['cache-control'] === 'no-cache';
    if (isForceRefresh) {
      CommerceDiscoveryService.getInstance().clearCache();
    }
    const tenantId = resolveTenant(req);
    const adapter = await getDeliverectAdapterAsync(tenantId);
    const catalog = await adapter.getRootCatalog();
    const candidateStoreIdsParam = req.query.candidateStoreIds as string | undefined;

    const cacheHeader = isForceRefresh
      ? 'no-cache, no-store, must-revalidate'
      : 'public, max-age=60, stale-while-revalidate=300';

    if (candidateStoreIdsParam) {
      const candidateStoreIds = candidateStoreIdsParam.split(',').map((s) => s.trim()).filter(Boolean);
      const { summaries } = await CommerceDiscoveryService.getInstance().getRootCatalogWithNearbyProjection({
        tenantId,
        candidateStoreIds,
        appMode: getServerRuntimeMode(),
      });
      return sendConditionalJson(
        req,
        res,
        {
          ...catalog,
          availabilitySummaries: summaries,
        },
        cacheHeader
      );
    }

    sendConditionalJson(req, res, catalog, cacheHeader);
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to fetch catalog');
  }
});

v1Router.get('/stores/:storeId/catalog', async (req: Request, res: Response) => {
  try {
    const isForceRefresh = req.query.refresh === 'true' || req.headers['cache-control'] === 'no-cache';
    if (isForceRefresh) {
      CommerceDiscoveryService.getInstance().clearCache();
    }
    const tenantId = resolveTenant(req);
    const adapter = await getDeliverectAdapterAsync(tenantId);
    const fulfillment = req.query.fulfillment as 'delivery' | 'pickup' | undefined;
    const menuId = req.query.menuId as string | undefined;
    const catalog = await adapter.getStoreCatalog(req.params.storeId, fulfillment, menuId);

    console.info(
      `[BFF Store Catalog] storeId=${req.params.storeId} fulfillment=${fulfillment || 'any'} menuId=${menuId || 'auto'} totalProducts=${catalog.products?.length || 0}`,
      catalog.diagnostics ? JSON.stringify(catalog.diagnostics) : '(no diagnostics)'
    );

    const cacheHeader = isForceRefresh
      ? 'no-cache, no-store, must-revalidate'
      : 'public, max-age=120, stale-while-revalidate=300';

    sendConditionalJson(req, res, catalog, cacheHeader);
  } catch (err: any) {
    handleCommerceError(res, err, `Failed to fetch store catalog for store ${req.params.storeId}`);
  }
});

v1Router.get('/bundles', async (req: Request, res: Response) => {
  try {
    const isForceRefresh = req.query.refresh === 'true' || req.headers['cache-control'] === 'no-cache';
    if (isForceRefresh) {
      CommerceDiscoveryService.getInstance().clearCache();
    }
    const tenantId = resolveTenant(req);
    const adapter = await getDeliverectAdapterAsync(tenantId);
    const cacheHeader = isForceRefresh
      ? 'no-cache, no-store, must-revalidate'
      : 'public, max-age=60, stale-while-revalidate=300';

    if (typeof adapter.getBundleCatalog === 'function') {
      const bundleCatalog = await adapter.getBundleCatalog();
      return sendConditionalJson(req, res, bundleCatalog, cacheHeader);
    }
    const catalog = await adapter.getRootCatalog();
    const bundleCatalog = catalog.bundleCatalog || {
      id: 'bundle_catalog_root',
      bundles: [],
      totalBundles: 0,
      updatedAt: new Date().toISOString(),
    };
    sendConditionalJson(req, res, bundleCatalog, cacheHeader);
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to fetch bundle catalog');
  }
});

v1Router.get('/stores/:storeId/bundles', async (req: Request, res: Response) => {
  try {
    const isForceRefresh = req.query.refresh === 'true' || req.headers['cache-control'] === 'no-cache';
    if (isForceRefresh) {
      CommerceDiscoveryService.getInstance().clearCache();
    }
    const tenantId = resolveTenant(req);
    const adapter = await getDeliverectAdapterAsync(tenantId);
    const fulfillment = req.query.fulfillment as 'delivery' | 'pickup' | undefined;
    const menuId = req.query.menuId as string | undefined;
    const cacheHeader = isForceRefresh
      ? 'no-cache, no-store, must-revalidate'
      : 'public, max-age=120, stale-while-revalidate=300';

    if (typeof adapter.getBundleCatalog === 'function') {
      const bundleCatalog = await adapter.getBundleCatalog(req.params.storeId, fulfillment, menuId);
      return sendConditionalJson(req, res, bundleCatalog, cacheHeader);
    }
    const catalog = await adapter.getStoreCatalog(req.params.storeId, fulfillment, menuId);
    const bundleCatalog = catalog.bundleCatalog || {
      id: `bundle_catalog_${req.params.storeId}`,
      storeId: req.params.storeId,
      bundles: [],
      totalBundles: 0,
      updatedAt: new Date().toISOString(),
    };
    sendConditionalJson(req, res, bundleCatalog, cacheHeader);
  } catch (err: any) {
    handleCommerceError(res, err, `Failed to fetch bundles for store ${req.params.storeId}`);
  }
});

v1Router.post('/search', validateBody(SearchCatalogSchema), async (req: Request, res: Response) => {
  try {
    const { query, storeId, categoryId, limit } = req.body;
    const tenantId = resolveTenant(req);
    const adapter = await getDeliverectAdapterAsync(tenantId);
    // Directive 5: Never silently fall back to root search if store catalog fails.
    // Return honest error so true cause is visible and diagnosed.
    const results = await adapter.searchProducts(query || '', storeId, { categoryId, limit });
    res.json(results);
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to execute search');
  }
});

/**
 * Storefront-facing merchandising/visual rules (hide product, age gates,
 * quantity limits, badges, warnings, etc.). Previously only exposed via the
 * admin-authenticated /admin/tenants/:id/rules route, so the storefront had
 * no way to read them at all — the client-side RuleEngine that actually
 * enforces these was permanently empty regardless of what was configured in
 * admin. Public like catalog/store data: these rules govern what every
 * customer sees, not sensitive per-user data.
 */
v1Router.get('/rules', async (req: Request, res: Response) => {
  try {
    const tenantId = resolveTenant(req);
    const rules = await FirestorePlatformService.getTenantRules(tenantId);
    res.json((rules || []).filter((r: any) => r?.enabled !== false));
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to retrieve active rules');
  }
});

v1Router.get('/products/:plu', async (req: Request, res: Response) => {
  try {
    const { plu } = req.params;
    const storeId = req.query.storeId as string | undefined;
    const tenantId = resolveTenant(req);
    const adapter = await getDeliverectAdapterAsync(tenantId);
    const result = await adapter.getProduct(plu, storeId);
    if (!result || !result.product) {
      return res.status(404).json({ error: `Product ${plu} not found` });
    }
    sendConditionalJson(req, res, result, 'public, max-age=60, stale-while-revalidate=300');
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to retrieve product');
  }
});

// ==========================================
// 5. STORIES & HERO BANNERS
// ==========================================
v1Router.get('/stories', async (req: Request, res: Response) => {
  try {
    const tenantId = resolveTenant(req);
    const stories = await FirestorePlatformService.getTenantStories(tenantId);
    sendConditionalJson(req, res, stories.filter((story) => isMarketingContentVisible(story)), 'public, max-age=60, stale-while-revalidate=300');
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

v1Router.get('/hero-banners', async (req: Request, res: Response) => {
  try {
    const tenantId = resolveTenant(req);
    const banners = await FirestorePlatformService.getTenantHeroBanners(tenantId);
    sendConditionalJson(req, res, banners.filter((banner) => isMarketingContentVisible(banner)), 'public, max-age=60, stale-while-revalidate=300');
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

v1Router.get('/tenants/:id/hero-banners', async (req: Request, res: Response) => {
  try {
    const banners = await FirestorePlatformService.getTenantHeroBanners(req.params.id);
    sendConditionalJson(req, res, banners, 'no-cache, must-revalidate');
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 6. BASKETS
// ==========================================
v1Router.post('/baskets', validateBody(CreateBasketSchema), async (req: Request, res: Response) => {
  try {
    const { storeId, fulfillmentType } = req.body;
    const tenantId = resolveTenant(req);
    const adapter = await getDeliverectAdapterAsync(tenantId);

    // Fail with a clean, typed error before ever calling Deliverect if this store
    // genuinely doesn't support the requested fulfillment type — mirrors the same
    // check already used by the Admin "Place Pickup Test Order" tool (see
    // POST /admin/.../place-test-order), which was never applied to the real
    // customer-facing basket route.
    const store = await adapter.getStore(storeId).catch(() => null);
    if (store) {
      const supportsRequested = fulfillmentType === 'delivery' ? store.supportsDelivery : store.supportsPickup;
      if (supportsRequested === false) {
        return res.status(400).json({
          error: `${fulfillmentType === 'delivery' ? 'Delivery' : 'Collection'} is not enabled for this store.`,
          code: 'FULFILLMENT_NOT_SUPPORTED',
        });
      }
    }

    const basket = await adapter.createBasket(storeId, fulfillmentType);
    res.json(basket);
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to create basket');
  }
});

v1Router.get('/baskets/:basketId', async (req: Request, res: Response) => {
  try {
    const tenantId = resolveTenant(req);
    const adapter = await getDeliverectAdapterAsync(tenantId);
    const basket = await adapter.getBasket(req.params.basketId);
    if (!basket) {
      return res.status(404).json({ error: 'Basket not found' });
    }
    res.json(basket);
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to retrieve basket');
  }
});

/**
 * Server-side Product Rules gate for basket-add/update calls. Fetches the
 * target store's catalogue once and checks each requested (plu, quantity)
 * against the tenant's rules before the mutation is allowed through — this
 * is what closes the "bypass the storefront UI entirely" gap, since the
 * client-side RuleEngine (AppLayout.tsx) obviously can't stop a direct API
 * call. Resolves silently (no-op) if the basket/catalogue can't be loaded,
 * so a transient lookup failure here never blocks a legitimate request that
 * the underlying adapter call would itself handle/reject on its own terms.
 */
async function enforceRulesForBasketAdd(
  tenantId: string,
  adapter: DeliverectAdapter,
  basketId: string,
  itemsToCheck: Array<{ plu: string; quantity: number }>
): Promise<void> {
  let basket;
  try {
    basket = await adapter.getBasket(basketId);
  } catch {
    return;
  }
  if (!basket) return;

  let catalog;
  try {
    catalog = await adapter.getStoreCatalog(basket.storeId, basket.fulfillmentType);
  } catch {
    return;
  }

  const productsByPlu = new Map<string, Product>(((catalog.products || []) as Product[]).map((p) => [p.plu, p]));
  const context = { storeId: basket.storeId, fulfillmentType: basket.fulfillmentType };

  for (const { plu, quantity } of itemsToCheck) {
    if (!quantity || quantity <= 0) continue; // a removal never needs a rule check
    const product = productsByPlu.get(plu);
    if (!product) continue; // let the adapter's own "product not found" handling apply
    await assertProductAddAllowed(tenantId, product, context, basket.items, quantity);
  }
}

v1Router.patch('/baskets/:basketId', validateBody(UpdateBasketItemSchema), async (req: Request, res: Response) => {
  try {
    const { productId, quantity } = req.body;
    const tenantId = resolveTenant(req);
    const adapter = await getDeliverectAdapterAsync(tenantId);
    await enforceRulesForBasketAdd(tenantId, adapter, req.params.basketId, [{ plu: productId, quantity }]);
    const basket = await adapter.updateBasketItem(req.params.basketId, productId, quantity);
    res.json(basket);
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to update basket item');
  }
});

v1Router.patch('/baskets/:basketId/items', validateBody(UpdateBasketItemsSchema), async (req: Request, res: Response) => {
  try {
    const { items } = req.body;
    const tenantId = resolveTenant(req);
    const adapter = await getDeliverectAdapterAsync(tenantId);
    await enforceRulesForBasketAdd(
      tenantId,
      adapter,
      req.params.basketId,
      (items || []).map((i: any) => ({ plu: i.plu, quantity: i.quantity }))
    );
    const basket = await adapter.updateBasketItems(req.params.basketId, items);
    res.json(basket);
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to update basket items');
  }
});

v1Router.post(
  '/baskets/:basketId/bundles',
  validateBody(AddBasketBundleSchema),
  async (req: Request, res: Response) => {
    try {
      const tenantId = resolveTenant(req);
      const adapter = await getDeliverectAdapterAsync(tenantId);
      if (!adapter.addBundleToBasket) {
        return res.status(501).json({
          error: 'Individual-line bundle basket writes are not implemented by the current commerce adapter.',
          code: 'INTEGRATION_CAPABILITY_NOT_IMPLEMENTED',
        });
      }

      const basket = await adapter.addBundleToBasket(
        req.params.basketId,
        req.body
      );
      res.json(basket);
    } catch (err: any) {
      handleCommerceError(res, err, 'Failed to add bundle to basket');
    }
  }
);

v1Router.patch(
  '/baskets/:basketId/items/:plu/substitution',
  validateBody(UpdateBasketItemSubstitutionSchema),
  async (req: Request, res: Response) => {
    try {
      const tenantId = resolveTenant(req);
      const adapter = await getDeliverectAdapterAsync(tenantId);
      const basket = await adapter.getBasket(req.params.basketId);
      if (!basket) {
        return res.status(404).json({ error: 'Basket not found', code: 'BASKET_NOT_FOUND' });
      }

      const item = basket.items.find((candidate) => candidate.plu === req.params.plu);
      if (!item) {
        return res.status(404).json({
          error: `Item ${req.params.plu} was not found in this basket.`,
          code: 'BASKET_ITEM_NOT_FOUND',
        });
      }

      const {
        preference,
        substituteCandidatePlus,
        preferredSubstitutePlu,
        preferredSubstituteName,
        preferredSubstitutePrice,
      } = req.body;

      await FirestorePlatformService.saveBasketItemSubstitutionPreference(
        tenantId,
        req.params.basketId,
        req.params.plu,
        {
          preference,
          substituteCandidatePlus,
          preferredSubstitutePlu,
          preferredSubstituteName,
          preferredSubstitutePrice,
        }
      );

      res.json({
        ...basket,
        items: basket.items.map((candidate) =>
          candidate.plu === req.params.plu
            ? {
                ...candidate,
                substitutionPreference: preference,
                substituteCandidatePlus,
                preferredSubstitutePlu,
                preferredSubstituteName,
                preferredSubstitutePrice,
              }
            : candidate
        ),
        updatedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      handleCommerceError(res, err, 'Failed to update basket substitution preference');
    }
  }
);

v1Router.patch('/baskets/:basketId/customer', validateBody(UpdateBasketCustomerSchema), async (req: Request, res: Response) => {
  try {
    const tenantId = resolveTenant(req);
    const adapter = await getDeliverectAdapterAsync(tenantId);
    const basket = await adapter.updateBasketCustomer(req.params.basketId, req.body);
    res.json(basket);
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to update basket customer details');
  }
});

v1Router.patch('/baskets/:basketId/fulfillment', validateBody(UpdateBasketFulfillmentSchema), async (req: Request, res: Response) => {
  try {
    const tenantId = resolveTenant(req);
    const adapter = await getDeliverectAdapterAsync(tenantId);
    const basket = await adapter.updateBasketFulfillment(req.params.basketId, req.body);
    res.json(basket);
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to update basket fulfillment');
  }
});

v1Router.patch('/baskets/:basketId/store', validateBody(UpdateBasketStoreSchema), async (req: Request, res: Response) => {
  try {
    const { storeId, confirmMigration } = req.body;
    const tenantId = resolveTenant(req);
    const adapter = await getDeliverectAdapterAsync(tenantId);
    const result = await adapter.updateBasketStore(req.params.basketId, storeId, { confirmMigration });
    res.json(result);
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to switch basket store');
  }
});

v1Router.patch('/baskets/:basketId/discounts', validateBody(UpdateBasketDiscountsSchema), async (req: Request, res: Response) => {
  try {
    const tenantId = resolveTenant(req);
    const adapter = await getDeliverectAdapterAsync(tenantId);
    const basket = await adapter.updateDiscounts(req.params.basketId, req.body);
    res.json(basket);
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to update basket discounts');
  }
});

v1Router.patch('/baskets/:basketId/charges', validateBody(UpdateBasketChargesSchema), async (req: Request, res: Response) => {
  try {
    const { charges } = req.body;
    const tenantId = resolveTenant(req);
    const adapter = await getDeliverectAdapterAsync(tenantId);
    const basket = await adapter.updateCharges(req.params.basketId, charges);
    res.json(basket);
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to update basket charges');
  }
});

v1Router.patch('/baskets/:basketId/tip', validateBody(UpdateBasketTipSchema), async (req: Request, res: Response) => {
  try {
    const { tip } = req.body;
    const tenantId = resolveTenant(req);
    const adapter = await getDeliverectAdapterAsync(tenantId);
    const basket = await adapter.updateTip(req.params.basketId, tip);
    res.json(basket);
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to update basket tip');
  }
});

v1Router.post('/baskets/:basketId/validate', validateBody(ValidateBasketSchema), async (req: Request, res: Response) => {
  try {
    const tenantId = resolveTenant(req);
    const adapter = await getDeliverectAdapterAsync(tenantId);
    const validation = await adapter.validateBasket(req.params.basketId);

    // Merge Product Rules issues (hidden/prevented items, over-limit
    // quantities, cross-SKU group caps) into the same validation report,
    // rather than hard-failing the HTTP call — this endpoint's job is to
    // surface problems before checkout, not to reject the request itself.
    try {
      const basket = await adapter.getBasket(req.params.basketId);
      if (basket) {
        const catalog = await adapter.getStoreCatalog(basket.storeId, basket.fulfillmentType);
        const productsByPlu = new Map((catalog.products || []).map((p) => [p.plu, p]));
        await assertBasketCheckoutAllowed(tenantId, basket, productsByPlu, {
          storeId: basket.storeId,
          fulfillmentType: basket.fulfillmentType,
        });
      }
    } catch (ruleErr: any) {
      const ruleIssues: string[] = ruleErr?.details?.blockingIssues || [ruleErr?.message || 'Basket violates a store policy.'];
      validation.valid = false;
      validation.issues = [...(validation.issues || []), ...ruleIssues];
    }

    res.json(validation);
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to validate basket');
  }
});

v1Router.post('/baskets/:basketId/reconcile', validateBody(ReconcileBasketSchema), async (req: Request, res: Response) => {
  try {
    const { destinationStoreId } = req.body;
    const tenantId = resolveTenant(req);
    const adapter = await getDeliverectAdapterAsync(tenantId);
    const result = await adapter.reconcileBasket(req.params.basketId, destinationStoreId);
    res.json(result);
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to reconcile basket');
  }
});

// ==========================================
// 7. DELIVERY & SCHEDULING
// ==========================================
v1Router.post('/delivery/options', validateBody(DeliveryOptionsSchema), async (req: Request, res: Response) => {
  try {
    const { basketId, address, fulfillmentType } = req.body;
    const tenantId = resolveTenant(req);
    const adapter = await getDeliverectAdapterAsync(tenantId);
    const options = await adapter.getDeliveryOptions(basketId, address, fulfillmentType);
    res.json(options);
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to get delivery options');
  }
});

v1Router.post('/delivery/slots', validateBody(DeliverySlotsSchema), async (req: Request, res: Response) => {
  try {
    const { storeId, fulfillmentType } = req.body;
    const tenantId = resolveTenant(req);
    const adapter = await getDeliverectAdapterAsync(tenantId);
    const slots = await adapter.getAvailableSlots(storeId, fulfillmentType);
    res.json(slots);
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to get delivery slots');
  }
});

// ==========================================
// 7.1 DISPATCH ORCHESTRATION & VALIDATION
// ==========================================
v1Router.post('/dispatch/validate', validateBody(ValidateDispatchSchema), async (req: Request, res: Response) => {
  try {
    const tenantId = resolveTenant(req);
    const dispatchAdapter = getDispatchAdapter(tenantId);
    const result = await dispatchAdapter.validateAvailability({
      channelLinkId: req.body.channelLinkId,
      storeId: req.body.storeId,
      deliveryAddress: req.body.deliveryAddress,
      pickupTime: req.body.pickupTime,
      deliveryTime: req.body.deliveryTime,
      orderValueMinorUnits: req.body.orderValueMinorUnits,
      currency: req.body.currency,
      itemsCount: req.body.itemsCount,
    });
    res.json(result);
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to validate courier dispatch');
  }
});

v1Router.post('/dispatch/quotes', validateBody(GetDispatchQuotesSchema), async (req: Request, res: Response) => {
  try {
    const tenantId = resolveTenant(req);
    const dispatchAdapter = getDispatchAdapter(tenantId);
    const tenantRules = await FirestorePlatformService.getTenantDispatchRules(tenantId);

    const result = await DispatchOrchestrationService.getQuotesForBasket(
      dispatchAdapter,
      {
        storeId: req.body.storeId,
        channelLinkId: req.body.channelLinkId,
        deliveryAddress: req.body.deliveryAddress,
        itemsCount: req.body.itemsCount,
        orderValueMinorUnits: req.body.orderValueMinorUnits,
        currency: req.body.currency,
        requiresAgeCheck: req.body.requiresAgeCheck,
        minimumAge: req.body.minimumAge,
        policy: req.body.policy,
        allowedProviders: req.body.allowedProviders,
      },
      tenantRules
    );

    res.json(result);
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to fetch courier dispatch quotes');
  }
});

v1Router.post('/dispatch/assign', validateBody(AssignDispatchSchema), async (req: Request, res: Response) => {
  try {
    const tenantId = resolveTenant(req);
    const dispatchAdapter = getDispatchAdapter(tenantId);
    const { orderId, idempotencyKey, force } = req.body;

    const record = await DispatchOrchestrationService.assignCourierForOrder(
      orderId,
      tenantId,
      dispatchAdapter,
      {
        idempotencyKey: idempotencyKey || `assign_${orderId}_${Date.now()}`,
        force: Boolean(force),
      }
    );

    res.json({ success: true, dispatch: record });
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to assign courier');
  }
});

v1Router.post('/dispatch/cancel', validateBody(CancelDispatchSchema), async (req: Request, res: Response) => {
  try {
    const tenantId = resolveTenant(req);
    const dispatchAdapter = getDispatchAdapter(tenantId);
    const { orderId, reason } = req.body;

    const result = await DispatchOrchestrationService.handleOrderCancelled(
      orderId,
      tenantId,
      dispatchAdapter,
      reason
    );

    res.json({ success: true, result });
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to cancel dispatch');
  }
});

v1Router.post('/dispatch/webhooks', async (req: Request, res: Response) => {
  try {
    const tenantId = resolveTenant(req);
    const rawBody = (req as any).rawBody || Buffer.from(JSON.stringify(req.body), 'utf8');
    await WebhookService.verifyDispatchWebhookAuth(rawBody, req.headers, tenantId);

    const eventId =
      (req.headers['x-dispatch-event-id'] as string) ||
      req.body.eventId ||
      `wh_dsp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const updated = await DispatchOrchestrationService.handleDispatchWebhook(req.body, eventId);
    res.json({ success: true, eventId, dispatch: updated });
  } catch (err: any) {
    if (err.statusCode === 401) {
      console.error(`[Dispatch Webhook Auth Error] (${err.code}):`, err.message);
      return res.status(401).json({ error: err.message, code: err.code });
    }
    handleCommerceError(res, err, 'Failed to process dispatch webhook');
  }
});

// ==========================================
// 8. PAYMENTS & CHECKOUT
// ==========================================
v1Router.get('/payments/gateways', async (req: Request, res: Response) => {
  try {
    const channelLinkId = req.query.channelLinkId as string;
    if (!channelLinkId) {
      return res.status(400).json({
        error: 'Query parameter channelLinkId is required',
        code: 'INVALID_INPUT',
      });
    }
    const resolvedTenant = resolveTenant(req);
    const gateways = await PaymentService.getPaymentGateways(channelLinkId, resolvedTenant);
    res.json(gateways);
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to fetch payment gateways');
  }
});

v1Router.post('/payments/calculate-ceiling', validateBody(CalculateCeilingSchema), async (req: Request, res: Response) => {
  try {
    const {
      reconciledBasketTotal,
      approvedSubstituteUplift,
      approvedCatchWeightTolerance,
      explicitAgreedCharges,
      arbitraryBufferPercentage,
      safetyBufferPercentage,
    } = req.body;

    const ceiling = PaymentService.calculateApprovedAuthorizationCeiling(reconciledBasketTotal, {
      approvedSubstituteUplift,
      approvedCatchWeightTolerance,
      explicitAgreedCharges,
      arbitraryBufferPercentage,
      safetyBufferPercentage,
    });

    res.json({ authorizedCeiling: ceiling });
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to calculate authorization ceiling');
  }
});

v1Router.post(
  '/payments/request',
  checkoutAndPaymentRateLimiter.middleware(),
  validateBody(DPayRequestPaymentSchema),
  async (req: Request, res: Response) => {
  try {
    const resolvedTenant = resolveTenant(req);
    const payment = await PaymentService.requestPayment(req.body, resolvedTenant);
    res.status(201).json(payment);
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to request payment authorization');
  }
});

v1Router.get('/payments/:paymentId', async (req: Request, res: Response) => {
  try {
    const resolvedTenant = resolveTenant(req);
    const payment = await PaymentService.getPayment(req.params.paymentId, resolvedTenant);
    if (!payment) {
      return res.status(404).json({
        error: `Payment with ID ${req.params.paymentId} was not found.`,
        code: 'PAYMENT_NOT_FOUND',
      });
    }

    // Privacy boundary: verify caller identity against payment owner
    const paymentCustomerUid = (payment as any).customerUid || (payment as any).metadata?.customerUid;
    if (paymentCustomerUid && !isDemoMode() && process.env.NODE_ENV !== 'test') {
      const callerUid = await getCallerUid(req);
      const adminUser = (req as AuthenticatedRequest).adminUser;
      if (!adminUser && callerUid !== paymentCustomerUid) {
        return res.status(403).json({
          error: 'Access denied: Payment record does not belong to caller.',
          code: 'FORBIDDEN',
        });
      }
    }

    res.json(payment);
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to fetch payment details');
  }
});

v1Router.post('/payments/:paymentId/capture', requireAdminAuth('operationsEditor'), validateBody(CapturePaymentSchema), async (req: Request, res: Response) => {
  try {
    const resolvedTenant = (req as AuthenticatedRequest).adminUser?.tenantId || resolveTenant(req);
    const payment = await PaymentService.capture(
      req.params.paymentId,
      req.body.finalAmountMinor,
      resolvedTenant
    );

    // Sync linked order projection if one exists
    const linkedOrder = await FirestorePlatformService.findOrderProjectionByPaymentId(req.params.paymentId);
    if (linkedOrder) {
      await FirestorePlatformService.updateOrderProjectionState(linkedOrder.orderId, linkedOrder.status, {
        paymentState: 'CAPTURED',
        finalAmount: req.body.finalAmountMinor,
        capturedAmount: req.body.finalAmountMinor,
        residualHoldReleased: payment.residualHoldAmount,
      });
    }

    res.json(payment);
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to capture payment');
  }
});

v1Router.post('/payments/:paymentId/refund', requireAdminAuth('operationsEditor'), validateBody(RefundPaymentSchema), async (req: Request, res: Response) => {
  try {
    const resolvedTenant = (req as AuthenticatedRequest).adminUser?.tenantId || resolveTenant(req);
    const payment = await PaymentService.refund(
      req.params.paymentId,
      req.body.refundAmountMinor,
      req.body.reason,
      resolvedTenant
    );

    // Sync linked order projection if one exists
    const linkedOrder = await FirestorePlatformService.findOrderProjectionByPaymentId(req.params.paymentId);
    if (linkedOrder) {
      await FirestorePlatformService.updateOrderProjectionState(linkedOrder.orderId, linkedOrder.status, {
        paymentState: 'REFUNDED',
      });
    }

    res.json(payment);
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to refund payment');
  }
});

v1Router.post('/payments/:paymentId/reauthorize', requireAdminAuth('operationsEditor'), validateBody(ReauthorizePaymentSchema), async (req: Request, res: Response) => {
  try {
    const resolvedTenant = (req as AuthenticatedRequest).adminUser?.tenantId || resolveTenant(req);
    const payment = await PaymentService.reauthorize(
      req.params.paymentId,
      req.body.additionalAmountMinor,
      resolvedTenant
    );

    // Sync linked order projection if one exists
    const linkedOrder = await FirestorePlatformService.findOrderProjectionByPaymentId(req.params.paymentId);
    if (linkedOrder) {
      await FirestorePlatformService.updateOrderProjectionState(linkedOrder.orderId, linkedOrder.status, {
        authorizedMaximum: payment.authorizedAmount,
      });
    }

    res.json(payment);
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to reauthorize payment');
  }
});

v1Router.post('/payments/sessions', validateBody(PaymentSessionSchema), async (req: Request, res: Response) => {
  try {
    const { basketId } = req.body;
    const tenantId = resolveTenant(req);
    const adapter = await getDeliverectAdapterAsync(tenantId);
    const session = await adapter.createPaymentSession(basketId);
    res.json(session);
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to create payment session');
  }
});

async function recoverCheckoutFromOrderProjection(
  checkout: CheckoutResult,
  checkoutId: string
): Promise<CheckoutResult> {
  if (!isPendingCheckoutStatus(checkout.status)) return checkout;

  let orderProjection = checkout.orderId
    ? await FirestorePlatformService.getOrderProjectionByExternalIdentifier(checkout.orderId)
    : null;

  if (!orderProjection) {
    orderProjection = await FirestorePlatformService.getOrderProjectionByCheckoutId(checkoutId);
  }

  if (!orderProjection) return checkout;

  const resolvedOrderId = String(
    orderProjection.channelOrderRawId ||
      orderProjection.orderId ||
      checkout.orderId ||
      ''
  ).trim() || undefined;

  if (isFailedOrderLifecycleStatus(orderProjection.status)) {
    return (
      (await FirestorePlatformService.updateCheckoutStatus(
        checkoutId,
        'ORDER_FAILED',
        {
          orderId: resolvedOrderId,
          failureReason:
            (orderProjection.metadata as any)?.failureReason ||
            checkout.failureReason,
        }
      )) || checkout
    );
  }

  if (isConfirmedOrderLifecycleStatus(orderProjection.status)) {
    return (
      (await FirestorePlatformService.updateCheckoutStatus(
        checkoutId,
        'ORDER_CONFIRMED',
        { orderId: resolvedOrderId }
      )) || checkout
    );
  }

  return checkout;
}

async function persistRefreshedCheckout(
  existingCheckout: CheckoutResult | null,
  upstream: CheckoutResult,
  resolvedTenant: string,
  checkoutId: string
): Promise<CheckoutResult> {
  const merged = mergeCheckoutProjection(existingCheckout, upstream);
  await FirestorePlatformService.saveCheckoutProjection(merged);

  const existingOrder = await FirestorePlatformService.getOrderProjectionByCheckoutId(checkoutId);
  const rawOrder: any = upstream.order;
  const upstreamOrderId = String(
    upstream.orderId ||
    rawOrder?.id ||
    rawOrder?._id ||
    rawOrder?.orderId ||
    ''
  ).trim() || undefined;
  const upstreamChannelOrderId = String(
    rawOrder?.channelOrderId ||
    upstream.channelOrderReference ||
    ''
  ).trim() || undefined;
  const upstreamDisplayId = String(
    rawOrder?.channelOrderDisplayId ||
    rawOrder?.displayId ||
    ''
  ).trim() || undefined;

  if (existingOrder) {
    let nextState = existingOrder.status;
    if (upstream.status === 'ORDER_CONFIRMED') nextState = 'ORDER_CONFIRMED';
    else if (upstream.status === 'ORDER_FAILED') nextState = 'ORDER_FAILED';
    else if (upstream.status === 'CANCELLED') nextState = 'CANCELLED';

    await FirestorePlatformService.updateOrderProjectionState(existingOrder.orderId, nextState, {
      channelOrderRawId: upstreamOrderId,
      channelOrderId: upstreamChannelOrderId,
      channelOrderDisplayId: upstreamDisplayId,
    });
  } else if (rawOrder) {
    // Legacy recovery: old pending checkouts may pre-date provisional order
    // persistence. Enrich only with values already known from the checkout; never
    // invent delivery or payment state.
    await FirestorePlatformService.saveOrderProjection(
      {
        ...rawOrder,
        basketId: rawOrder.basketId || merged.basketId,
        channelOrderId: rawOrder.channelOrderId || merged.channelOrderReference,
        channelOrderRawId: upstreamOrderId,
        fulfillmentType:
          rawOrder.fulfillment?.type ||
          rawOrder.fulfillmentType ||
          merged.fulfillmentType,
        originalBasket: rawOrder.originalBasket || {
          id: merged.basketId,
          fulfillmentType: merged.fulfillmentType,
          items: [],
          total: merged.total,
          currency: merged.total.currency,
        },
      },
      resolvedTenant,
      checkoutId
    );
  }

  return merged;
}

v1Router.post(
  '/checkouts',
  checkoutAndPaymentRateLimiter.middleware(),
  validateBody(CheckoutBasketSchema),
  async (req: Request, res: Response) => {
  try {
    const { basketId, options } = req.body;
    const resolvedTenant = resolveTenant(req);
    const callerUid = await getCallerUid(req);
    const integrationContext = await IntegrationContext.getContext(resolvedTenant);
    const checkoutOptions: any = {
      ...(options || {}),
      // One Deliverect basket can create one checkout session. Use a stable
      // basket-scoped key so browser retries/reopened modals recover the same
      // checkout even when the client did not supply its own key.
      idempotencyKey:
        options?.idempotencyKey ||
        `checkout:${resolvedTenant}:${basketId}`,
    };
    const orderRoute: 'retail_quest' | 'commerce_checkout' =
      checkoutOptions.orderRoute === 'commerce_checkout' ||
      integrationContext.orderRoute === 'commerce_checkout'
        ? 'commerce_checkout'
        : 'retail_quest';

    // Retail/Quest uses one deterministic customer order reference across DPay,
    // Channel API submission, Firestore projections and retry recovery.
    if (orderRoute === 'retail_quest' && !checkoutOptions.channelOrderReference) {
      const digest = crypto
        .createHash('sha256')
        .update(`${resolvedTenant}:${basketId}`)
        .digest('hex')
        .slice(0, 16)
        .toUpperCase();
      checkoutOptions.channelOrderReference = `BWYDI-${digest}`;
    }

    // Basket identity is the strongest checkout idempotency boundary. If this
    // basket already produced a checkout, return it rather than POSTing another
    // session to Deliverect.
    const existingBasketCheckout =
      await FirestorePlatformService.getCheckoutByBasketId(
        basketId,
        resolvedTenant
      );
    if (existingBasketCheckout) {
      if (callerUid && existingBasketCheckout.orderId) {
        await FirestorePlatformService.attachCustomerUidToOrderProjection(
          existingBasketCheckout.orderId,
          resolvedTenant,
          callerUid
        );
      }
      console.log(
        `[v1Router] Recovering existing checkout ${existingBasketCheckout.checkoutId} for basket ${basketId}`
      );
      return res.status(200).json(existingBasketCheckout);
    }

    // Final server-side Product Rules gate before an order is actually
    // submitted — this is the true "can't skip the UI" backstop; the
    // basket-add-time check can't catch a rule that started matching after
    // the item was added (e.g. a store went out of stock, or an admin
    // enabled a new restriction mid-session).
    {
      const checkoutAdapter = await getDeliverectAdapterAsync(resolvedTenant);
      const checkoutBasket = await checkoutAdapter.getBasket(basketId).catch(() => null);
      if (checkoutBasket) {
        const checkoutCatalog = await checkoutAdapter
          .getStoreCatalog(checkoutBasket.storeId, checkoutBasket.fulfillmentType)
          .catch(() => null);
        if (checkoutCatalog) {
          const productsByPlu = new Map<string, Product>(((checkoutCatalog.products || []) as Product[]).map((p) => [p.plu, p]));
          await assertBasketCheckoutAllowed(resolvedTenant, checkoutBasket, productsByPlu, {
            storeId: checkoutBasket.storeId,
            fulfillmentType: checkoutBasket.fulfillmentType,
          });
        }
      }
    }

    // Quest-first online payment: pre-authorise through DPay before the Retail
    // order is submitted. A payment token is optional so unpaid/COD operational
    // flows remain possible; when supplied, Commerce Checkout is not involved.
    if (
      orderRoute === 'retail_quest' &&
      !checkoutOptions.paymentId &&
      checkoutOptions.paymentTokenRef
    ) {
      const existingPayment =
        await FirestorePlatformService.getPaymentProjectionByOrderReference(
          checkoutOptions.channelOrderReference,
          resolvedTenant
        );

      if (
        existingPayment &&
        (existingPayment.status === 'authorized' || existingPayment.status === 'captured')
      ) {
        checkoutOptions.paymentId = existingPayment.paymentId;
        checkoutOptions.authorizedMaximum = existingPayment.authorizedAmount;
      } else {
        const basket = await (await getDeliverectAdapterAsync(resolvedTenant)).getBasket(basketId);
        if (!basket) {
          return res.status(404).json({
            error: `Basket ${basketId} not found.`,
            code: 'BASKET_NOT_FOUND',
          });
        }

        const channelLinkId = String((basket as any).channelLinkId || basket.storeId || '').trim();
        if (!channelLinkId) {
          return res.status(422).json({
            error: 'Basket is missing the channelLinkId required for DPay authorisation.',
            code: 'VALIDATION_ERROR',
          });
        }

        // Security boundary: the browser cannot choose the amount we authorise.
        // Until substitute/catch-weight uplifts are derived from server-side consent records,
        // the reconciled server basket total is the only approved ceiling.
        const approvedMaximum = PaymentService.calculateApprovedAuthorizationCeiling(basket.total);
        const payment = await PaymentService.requestPayment(
          {
            channelLinkId,
            mode: { type: 'token', tokenId: checkoutOptions.paymentTokenRef },
            captureMode: 'manual',
            amount: approvedMaximum.amount,
            currency: approvedMaximum.currency || basket.currency || 'GBP',
            payer: basket.customer
              ? {
                  name: basket.customer.name,
                  email: basket.customer.email,
                  phone: basket.customer.phone,
                }
              : undefined,
            orderReference: checkoutOptions.channelOrderReference,
            basketId,
            customerApprovedMaxAmount: approvedMaximum,
            metadata: {
              basketId,
              orderRoute: 'retail_quest',
            },
          },
          resolvedTenant
        );

        if (payment.status !== 'authorized' && payment.status !== 'captured') {
          return res.status(422).json({
            error: `DPay returned status '${payment.status}'. The Retail order was not submitted.`,
            code: 'PAYMENT_NOT_AUTHORISED',
          });
        }

        checkoutOptions.paymentId = payment.paymentId;
        checkoutOptions.authorizedMaximum = {
          amount: payment.authorizedAmount,
          currency: payment.currency,
        };
      }
    }

    // Verify an existing DPay payment before creating the live order. Prefer the
    // locally persisted payment projection from /payments/request so Retail order
    // creation does not depend on Commerce Checkout or a second payment lookup.
    if (checkoutOptions?.paymentId) {
      try {
        const localPayment = await FirestorePlatformService.getPaymentProjection(
          checkoutOptions.paymentId
        );

        if (!localPayment && !isDemoMode() && process.env.NODE_ENV !== 'test') {
          return res.status(422).json({
            error: 'Payment cannot be attached because its tenant/basket binding is unavailable.',
            code: 'PAYMENT_BINDING_REQUIRED',
          });
        }

        if (localPayment) {
          if (localPayment.tenantId !== resolvedTenant) {
            return res.status(403).json({
              error: 'Payment belongs to a different tenant.',
              code: 'TENANT_ISOLATION_ERROR',
            });
          }
          if (!localPayment.basketId || localPayment.basketId !== basketId) {
            return res.status(409).json({
              error: 'Payment is not bound to this basket.',
              code: 'PAYMENT_BASKET_MISMATCH',
            });
          }
          if (
            checkoutOptions.channelOrderReference &&
            localPayment.orderReference &&
            localPayment.orderReference !== checkoutOptions.channelOrderReference
          ) {
            return res.status(409).json({
              error: 'Payment is bound to a different order reference.',
              code: 'PAYMENT_ORDER_REFERENCE_MISMATCH',
            });
          }
        }

        const payment =
          localPayment ||
          (await PaymentService.getPayment(checkoutOptions.paymentId, resolvedTenant));
        if (!payment) {
          return res.status(404).json({
            error: `Payment ${checkoutOptions.paymentId} not found.`,
            code: 'PAYMENT_NOT_FOUND',
          });
        }
        if (payment.status !== 'authorized' && payment.status !== 'captured') {
          return res.status(422).json({
            error: `Payment ${checkoutOptions.paymentId} is in status '${payment.status}', but must be authorized before order submission.`,
            code: 'PAYMENT_NOT_AUTHORISED',
          });
        }
      } catch (paymentErr: any) {
        return handleCommerceError(res, paymentErr, 'Payment validation failed');
      }
    }

    // CHECK-02: Idempotency check via idempotencyKey
    if (checkoutOptions.idempotencyKey) {
      const existing = await FirestorePlatformService.getCheckoutByIdempotencyKey(
        checkoutOptions.idempotencyKey
      );
      if (existing) {
        console.log(
          `[v1Router] Returning existing checkout for idempotencyKey ${checkoutOptions.idempotencyKey}`
        );
        return res.status(200).json(existing);
      }
    }

    // CHECK-02: Duplicate check via channelOrderReference
    if (checkoutOptions?.channelOrderReference) {
      const existing = await FirestorePlatformService.getCheckoutByReference(
        checkoutOptions.channelOrderReference
      );
      if (existing) {
        console.log(
          `[v1Router] Returning existing checkout for channelOrderReference ${checkoutOptions.channelOrderReference}`
        );
        return res.status(200).json(existing);
      }
    }

    const isExplicitCollection =
      checkoutOptions?.fulfillmentType === 'collection' ||
      checkoutOptions?.fulfillmentType === 'pickup';
    const isDelivery =
      checkoutOptions?.fulfillmentType === 'delivery' ||
      (!checkoutOptions?.fulfillmentType &&
        Boolean(checkoutOptions?.deliveryAddress));

    // DSP-03 & Dispatch Orchestration: Authoritative dispatch quote/availability check
    if (isDelivery && !isExplicitCollection) {
      if (options?.dispatchValidationExpiresAt) {
        const expiry = new Date(options.dispatchValidationExpiresAt).getTime();
        if (Number.isFinite(expiry) && Date.now() > expiry) {
          return res.status(422).json({
            error: 'Courier quote has expired. Please re-check delivery quotes before placing your order.',
            code: 'DISPATCH_VALIDATION_EXPIRED',
          });
        }
      }

      // Authoritative check if no validation id or selected quote id provided
      const dispatchAdapter = getDispatchAdapter(resolvedTenant);
      if (!options?.dispatchValidationId && !options?.selectedQuoteId) {
        try {
          const avail = await dispatchAdapter.validateAvailability({
            channelLinkId: options?.storeId,
            storeId: options?.storeId,
            deliveryAddress: options?.deliveryAddress,
            orderValueMinorUnits: (options as any)?.orderValueMinorUnits,
            currency: (options as any)?.currency || 'GBP',
            itemsCount: (options as any)?.itemsCount || 1,
          });
          if (!avail.available) {
            return res.status(422).json({
              error: avail.rejectionReason || 'No courier available for this delivery address and time window. Please try again or switch to collection.',
              code: 'DISPATCH_UNAVAILABLE',
            });
          }
        } catch (dispatchCheckErr: any) {
          return res.status(422).json({
            error: `Unable to verify courier availability: ${dispatchCheckErr.message || 'Courier service unavailable'}. Please retry.`,
            code: 'DISPATCH_CHECK_FAILED',
          });
        }
      }
    }

    const adapter = await getDeliverectAdapterAsync(resolvedTenant);
    let checkoutResult: CheckoutResult;

    if (orderRoute === 'retail_quest') {
      if (!adapter.submitRetailOrder) {
        throw new BFFError(
          'INTEGRATION_CAPABILITY_NOT_IMPLEMENTED',
          'The active Deliverect adapter cannot submit Retail/Quest orders.',
          501
        );
      }
      checkoutResult = await adapter.submitRetailOrder(basketId, {
        ...checkoutOptions,
        tenantId: resolvedTenant,
      });
    } else if (adapter.checkout) {
      try {
        checkoutResult = await adapter.checkout(basketId, {
          ...checkoutOptions,
          tenantId: resolvedTenant,
        });
      } catch (checkoutErr: any) {
        const statusCode =
          checkoutErr?.statusCode || checkoutErr?.status;
        const message = String(checkoutErr?.message || '');
        const isExistingCheckout =
          statusCode === 422 &&
          /checkout session already exists for basket/i.test(message);

        if (!isExistingCheckout) throw checkoutErr;

        // A concurrent request may have created/persisted the checkout between
        // our initial lookup and the upstream 422. Retry the local lookup briefly.
        for (let attempt = 0; attempt < 5; attempt += 1) {
          const existing =
            await FirestorePlatformService.getCheckoutByBasketId(
              basketId,
              resolvedTenant
            );
          if (existing) {
            console.log(
              `[v1Router] Recovered checkout ${existing.checkoutId} after Deliverect duplicate-session response.`
            );
            return res.status(200).json(existing);
          }
          await new Promise((resolve) =>
            setTimeout(resolve, 100 * (attempt + 1))
          );
        }

        // Some Deliverect error responses include the already-created checkout
        // identifier. If present, hydrate/persist it rather than failing the user.
        const responseBody =
          checkoutErr?.responseBody ||
          checkoutErr?.upstreamBody ||
          {};
        const existingCheckoutId = String(
          responseBody?.checkoutId ||
          responseBody?.existingCheckoutId ||
          responseBody?.checkout?.id ||
          responseBody?.id ||
          ''
        ).trim();

        if (existingCheckoutId && adapter.getCheckout) {
          const upstream = await adapter.getCheckout(existingCheckoutId);
          if (upstream) {
            const recovered = await persistRefreshedCheckout(
              null,
              upstream,
              resolvedTenant,
              existingCheckoutId
            );
            console.log(
              `[v1Router] Recovered upstream checkout ${existingCheckoutId} after duplicate-session response.`
            );
            return res.status(200).json(recovered);
          }
        }

        const recoveryError: any = new Error(
          'This basket already has a checkout session, but its local checkout record could not be recovered yet. Refresh order status instead of creating another checkout.'
        );
        recoveryError.code = 'CHECKOUT_ALREADY_EXISTS';
        recoveryError.statusCode = 409;
        throw recoveryError;
      }
    } else {
      const order = await adapter.checkoutBasket(basketId, options);
      const checkoutId = `chk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const channelOrderReference = checkoutOptions?.channelOrderReference || order.orderReference || `ORD-${Date.now().toString().slice(-6)}`;
      const now = new Date().toISOString();

      const fallbackFulfillmentType = order.fulfillment?.type;
      if (fallbackFulfillmentType !== 'pickup' && fallbackFulfillmentType !== 'delivery') {
        throw new Error(
          'Checkout order is missing a supported fulfillment type. Refusing to default it to delivery.'
        );
      }

      checkoutResult = {
        checkoutId,
        channelOrderReference,
        orderId: order.id,
        tenantId: resolvedTenant,
        storeId: order.storeId,
        channelLinkId: order.storeId,
        status: 'CHECKOUT_PENDING_CONFIRMATION',
        basketId,
        fulfillmentType: fallbackFulfillmentType,
        total: order.originalBasket?.total || { amount: 0, currency: 'GBP' },
        idempotencyKey: checkoutOptions?.idempotencyKey,
        dispatchValidationId: checkoutOptions?.dispatchValidationId,
        paymentId: checkoutOptions?.paymentId,
        order,
        createdAt: now,
        updatedAt: now,
      };
    }

    checkoutResult = {
      ...checkoutResult,
      orderRoute,
      idempotencyKey:
        checkoutResult.idempotencyKey ||
        checkoutOptions.idempotencyKey,
    };

    // Persist CheckoutProjection in Firestore / in-memory
    await FirestorePlatformService.saveCheckoutProjection(checkoutResult);

    // Save GDPR-safe order projection in Firestore
    if (checkoutResult.order) {
      if (!checkoutResult.order.payment && (options?.paymentId || checkoutResult.paymentId)) {
        (checkoutResult.order as any).paymentId = options?.paymentId || checkoutResult.paymentId;
      }
      const savedOrderProjection = await FirestorePlatformService.saveOrderProjection(
        checkoutResult.order,
        resolvedTenant,
        checkoutResult.checkoutId,
        callerUid
      );

      // Initialize dispatch lifecycle from the canonical CheckoutResult fulfillment.
      // Never infer delivery from a missing raw order field.
      const dispatchAdapter = getDispatchAdapter(resolvedTenant);
      await DispatchOrchestrationService.handleCheckoutCreated(
        savedOrderProjection.orderId,
        resolvedTenant,
        dispatchAdapter,
        {
          fulfillmentType: checkoutResult.fulfillmentType,
          selectedQuote: (options as any)?.selectedQuote,
          quoteId: options?.selectedQuoteId || options?.dispatchValidationId,
          providerId: options?.selectedProviderId,
          providerDisplayName: options?.selectedProviderDisplayName,
          deliveryAddress: options?.deliveryAddress || checkoutResult.order.fulfillment?.address,
          itemsCount: checkoutResult.order.originalBasket?.items?.reduce((acc: number, it: any) => acc + (it.quantity || 1), 0) || 1,
          orderCreatedAt: checkoutResult.order.createdAt || new Date().toISOString(),
          requiresAgeCheck: Boolean(options?.requiresAgeCheck || (checkoutResult.order as any).requiresAgeCheck),
          minimumAge: options?.minimumAge || (checkoutResult.order as any).minimumAge || 18,
          requiresPin: Boolean(options?.requiresPin),
          idempotencyKey: options?.idempotencyKey || checkoutResult.checkoutId,
        }
      ).catch((dispatchErr) => {
        console.warn('[v1Router] Failed to initialize dispatch for order:', dispatchErr);
      });
    }

    // Retail Channel API creation is immediately acknowledged by Deliverect (201).
    // Commerce Checkout remains asynchronous and returns 202 pending confirmation.
    res.status(orderRoute === 'retail_quest' ? 201 : 202).json(checkoutResult);
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to checkout basket');
  }
});

v1Router.get('/checkouts/:checkoutId', async (req: Request, res: Response) => {
  try {
    const { checkoutId } = req.params;
    let checkout = await FirestorePlatformService.getCheckoutProjection(checkoutId);

    const shouldRefreshFromDeliverect =
      !checkout ||
      checkout.status === 'CHECKOUT_PENDING_CONFIRMATION' ||
      checkout.status === 'CHECKOUT_SUBMITTING';

    if (shouldRefreshFromDeliverect) {
      const resolvedTenant = resolveTenant(req);
      const adapter = await getDeliverectAdapterAsync(resolvedTenant);
      if (adapter.getCheckout) {
        try {
          const upstream = await adapter.getCheckout(checkoutId);
          if (upstream) {
            checkout = await persistRefreshedCheckout(
              checkout,
              upstream,
              resolvedTenant,
              checkoutId
            );
          }
        } catch (error) {
          if (!checkout) throw error;
          console.warn('[Checkout Poll] Upstream refresh failed:', error);
        }
      }
    }

    if (!checkout) {
      return res.status(404).json({ error: 'Checkout not found', code: 'CHECKOUT_NOT_FOUND' });
    }

    // Privacy boundary: verify caller identity against checkout owner
    const checkoutCustomerUid = (checkout as any).customerUid || (checkout as any).metadata?.customerUid;
    if (checkoutCustomerUid && !isDemoMode() && process.env.NODE_ENV !== 'test') {
      const callerUid = await getCallerUid(req);
      const adminUser = (req as AuthenticatedRequest).adminUser;
      if (!adminUser && callerUid !== checkoutCustomerUid) {
        return res.status(403).json({
          error: 'Access denied: Checkout does not belong to caller.',
          code: 'FORBIDDEN',
        });
      }
    }

    // CHECK-03: Recover confirmation from the linked order projection even when
    // Deliverect's checkout object never exposes a real orderId. Any downstream
    // lifecycle state such as ACCEPTED/PICKING/READY proves checkout succeeded.
    checkout = await recoverCheckoutFromOrderProjection(checkout, checkoutId);

    res.json(checkout);
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to retrieve checkout');
  }
});

v1Router.get('/checkouts/:checkoutId/status', async (req: Request, res: Response) => {
  try {
    const { checkoutId } = req.params;
    let checkout = await FirestorePlatformService.getCheckoutProjection(checkoutId);

    const shouldRefreshFromDeliverect =
      !checkout ||
      checkout.status === 'CHECKOUT_PENDING_CONFIRMATION' ||
      checkout.status === 'CHECKOUT_SUBMITTING';

    if (shouldRefreshFromDeliverect) {
      const resolvedTenant = resolveTenant(req);
      const adapter = await getDeliverectAdapterAsync(resolvedTenant);
      if (adapter.getCheckout) {
        try {
          const upstream = await adapter.getCheckout(checkoutId);
          if (upstream) {
            checkout = await persistRefreshedCheckout(
              checkout,
              upstream,
              resolvedTenant,
              checkoutId
            );
          }
        } catch (error) {
          if (!checkout) throw error;
          console.warn('[Checkout Status Poll] Upstream refresh failed:', error);
        }
      }
    }

    if (!checkout) {
      return res.status(404).json({ error: 'Checkout not found', code: 'CHECKOUT_NOT_FOUND' });
    }

    // CHECK-03: Same recovery path as the full checkout endpoint. This also
    // catches Quest picking states that arrive before the checkout webhook.
    checkout = await recoverCheckoutFromOrderProjection(checkout, checkoutId);

    const mappedStatus = mapCheckoutPublicStatus(checkout.status);

    res.json({
      checkoutId: checkout.checkoutId,
      status: mappedStatus,
      orderId: checkout.orderId,
      failureReason: checkout.failureReason,
    });
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to retrieve checkout status');
  }
});

v1Router.post('/checkouts/:checkoutId/confirm-demo', requireAdminAuth('tenantAdmin'), async (req: Request, res: Response) => {
  try {
    if (getServerRuntimeMode() !== 'demo') {
      return res.status(403).json({
        error: 'Demo checkout confirmation is strictly forbidden in staging/production environments.',
        code: 'FEATURE_DISABLED_IN_ENVIRONMENT',
      });
    }

    const { checkoutId } = req.params;
    const checkout = await FirestorePlatformService.getCheckoutProjection(checkoutId);
    if (!checkout) {
      return res.status(404).json({ error: 'Checkout not found' });
    }

    const updated = await FirestorePlatformService.updateCheckoutStatus(checkoutId, 'STORE_ACCEPTED', {
      orderId: checkout.orderId,
    });

    if (checkout.orderId) {
      await FirestorePlatformService.updateOrderProjectionState(checkout.orderId, 'ACCEPTED');
    }

    res.json(updated || checkout);
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to confirm checkout');
  }
});

/**
 * Resolve an inbound Deliverect callback to a provisioned tenant. Retail Quest
 * callbacks use the same integration identifier as the normal Channel webhook.
 */
async function resolveDeliverectWebhookTenant(
  req: Request
): Promise<string> {
  const identifier = req.params.identifier;
  let tenantId: string | undefined;

  if (identifier) {
    const resolved =
      await FirestorePlatformService.resolveTenantByIntegrationId(identifier);
    if (resolved) {
      tenantId = resolved;
    } else {
      // Provisioning UI may expose the tenant id directly (e.g. brand-alpha)
      // rather than the opaque integrationId. This is safe because routing only
      // selects the candidate tenant; the callback must still pass HMAC
      // verification before any order state is mutated.
      const directIntegration =
        await FirestorePlatformService.getIntegrationConfig(identifier);
      if (directIntegration?.tenantId === identifier) {
        tenantId = identifier;
      } else if (isDemoMode() || process.env.NODE_ENV === 'test') {
        tenantId = identifier;
      } else {
        throw new BFFError(
          'INTEGRATION_NOT_CONFIGURED',
          `No registered integration found for identifier "${identifier}".`,
          404
        );
      }
    }
  }

  if (!tenantId) {
    if (isDemoMode() || process.env.NODE_ENV === 'test') {
      return (
        (req.query.tenantId as string) ||
        (req.headers['x-tenant-id'] as string) ||
        'brand-alpha'
      );
    }

    const host = (
      (req.headers['x-forwarded-host'] as string) ||
      req.hostname ||
      ''
    )
      .toLowerCase()
      .split(':')[0];
    const resolvedFromDb =
      await FirestorePlatformService.resolveTenantByHostname(host);
    if (resolvedFromDb) return resolvedFromDb;

    throw new BFFError(
      'INVALID_INPUT',
      'Inbound webhook cannot be routed: integrationId or registered domain required.',
      400
    );
  }

  return tenantId;
}

function normalizeQuestPickingStatusPayload(payload: any): any {
  const rawStatus =
    payload?.pickingStatus ??
    payload?.status ??
    payload?.event ??
    payload?.eventType ??
    payload?.type ??
    payload?.data?.status;

  const value = String(rawStatus ?? '').trim().toUpperCase();
  let status = value;

  if (
    ['STARTED', 'PICKING_STARTED', 'PICKING', 'IN_PROGRESS'].includes(
      value
    )
  ) {
    status = 'PICKING_STARTED';
  } else if (
    ['COMPLETED', 'COMPLETE', 'PICKED', 'PICKING_COMPLETE'].includes(
      value
    )
  ) {
    status = 'PICKING_COMPLETE';
  } else if (['ACCEPTED', 'ORDER_ACCEPTED'].includes(value) || value === '20') {
    status = 'ORDER_ACCEPTED';
  } else if (['CANCELLED', 'CANCELED', 'ORDER_CANCELLED'].includes(value) || value === '110') {
    status = 'ORDER_CANCELLED';
  } else if (['READY', 'PICKUP_READY'].includes(value) || value === '70') {
    status = 'READY';
  } else if (['FAILED', 'ORDER_FAILED'].includes(value) || value === '120') {
    status = 'ORDER_FAILED';
  } else if (!status) {
    // This endpoint itself proves the event belongs to the picking lifecycle.
    // Preserve the raw payload while advancing only to PICKING.
    status = 'PICKING';
  }

  return {
    ...payload,
    status,
    pickingStatus: status,
    rawPickingStatus: rawStatus,
    channelOrderId:
      payload?.channelOrderId ||
      payload?.order?.channelOrderId ||
      payload?.data?.channelOrderId,
    orderId:
      payload?.orderId ||
      payload?.order?.id ||
      payload?.data?.orderId,
  };
}

/**
 * Deliverect does not publish a discriminator-field schema for the Retail/Quest
 * "Picking Amendments" POST callback (confirmed against developers.deliverect.com —
 * no field lists a substitution vs. quantity-change vs. removal vs. cancellation
 * type). This checks every alias Deliverect is known to use elsewhere for event
 * typing, then falls back to inferring the amendment type from which fields are
 * actually populated on the item, rather than guessing a single status for
 * everything (which silently dropped substitutions/removals/cancellations).
 */
function classifyQuestAmendment(item: any): string {
  const explicit = String(
    item?.type ??
      item?.event ??
      item?.eventType ??
      item?.action ??
      item?.status ??
      item?.amendmentType ??
      ''
  )
    .trim()
    .toUpperCase();

  if (
    ['ITEM_SUBSTITUTED', 'BEST_MATCH_SUBSTITUTION', 'ITEM_SUBSTITUTION', 'ITEM_SUBSTITUTION_CATALOG', 'SUBSTITUTION'].includes(
      explicit
    )
  ) {
    return 'BEST_MATCH_SUBSTITUTION';
  }
  if (['CUSTOMER_SELECTED_SUBSTITUTION', 'ITEM_SUBSTITUTION_CUSTOMER'].includes(explicit)) {
    return 'CUSTOMER_SELECTED_SUBSTITUTION';
  }
  if (['ITEM_QUANTITY_AMENDED', 'QUANTITY_REDUCED', 'ITEM_AMENDMENT'].includes(explicit)) {
    return 'ITEM_QUANTITY_AMENDED';
  }
  if (['ITEM_REMOVED', 'REMOVE_IF_UNAVAILABLE', 'ITEM_REMOVE'].includes(explicit)) {
    return 'ITEM_REMOVED';
  }
  if (['ORDER_CANCELLED_UNAVAILABLE_ITEM', 'ORDER_CANCELLED', 'CANCELLED'].includes(explicit)) {
    return 'ORDER_CANCELLED_UNAVAILABLE_ITEM';
  }

  // No explicit type field present — infer structurally.
  if (item?.substitutePlu || item?.substitute?.plu || item?.newPlu) {
    return item?.type === 'CUSTOMER_SELECTED' || item?.substitutionType === 'CUSTOMER_SELECTED'
      ? 'CUSTOMER_SELECTED_SUBSTITUTION'
      : 'BEST_MATCH_SUBSTITUTION';
  }
  if (item?.cancelled === true || item?.orderCancelled === true) {
    return 'ORDER_CANCELLED_UNAVAILABLE_ITEM';
  }
  const suppliedQuantity =
    item?.amendedQuantity ?? item?.suppliedQuantity ?? item?.newQuantity ?? item?.quantity;
  if (item?.removed === true || item?.unavailable === true || suppliedQuantity === 0) {
    return 'ITEM_REMOVED';
  }
  if (suppliedQuantity !== undefined) {
    return 'ITEM_QUANTITY_AMENDED';
  }

  // Genuinely unclassifiable: preserve prior behavior rather than guessing wrong.
  return 'PICKING_WITH_CHANGES';
}

function extractQuestAmendmentItems(payload: any): any[] {
  const amendments =
    payload?.amendments ||
    payload?.itemAmendments ||
    payload?.items ||
    payload?.data?.amendments ||
    payload?.data?.items ||
    [];

  return Array.isArray(amendments) && amendments.length > 0 ? amendments : [payload];
}

/**
 * Deliverect's amendments callback can carry several amendments (substitution,
 * quantity change, removal, cancellation) in a single POST. Each one is a
 * distinct event and is processed as its own call into WebhookService so the
 * correct per-type branch (and per-item Firestore/payment update) actually
 * runs, instead of collapsing the whole batch into one generic status.
 */
async function processQuestAmendments(
  payload: any,
  rawBody: Buffer | string,
  headers: Record<string, string | string[] | undefined>,
  tenantId: string
): Promise<WebhookProcessingResult[]> {
  const items = extractQuestAmendmentItems(payload);
  const parentChannelOrderId =
    payload?.channelOrderId || payload?.order?.channelOrderId || payload?.data?.channelOrderId;
  const parentOrderId = payload?.orderId || payload?.order?.id || payload?.data?.orderId;
  const baseEventId =
    (headers['x-deliverect-event-id'] as string) || payload?.eventId || payload?.id || payload?._id;

  const results: WebhookProcessingResult[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const status = classifyQuestAmendment(item);
    const itemPayload = {
      ...item,
      status,
      eventType: status,
      channelOrderId: item?.channelOrderId || parentChannelOrderId,
      orderId: item?.orderId || parentOrderId,
    };

    // Every item in a batch must get its own idempotency key. WebhookService
    // derives dedup identity from the x-deliverect-event-id header (or the
    // shared rawBody's content hash) first — if left untouched, every item
    // after the first in a multi-item batch would be silently deduplicated
    // against the first item's key.
    const itemHeaders = { ...headers };
    if (items.length > 1) {
      const plu = item?.plu || item?.item?.plu || item?.originalPlu || i;
      itemHeaders['x-deliverect-event-id'] = `${baseEventId || 'evt'}_${i}_${plu}`;
    }

    results.push(await WebhookService.processWebhook(itemPayload, rawBody, itemHeaders, tenantId));
  }

  return results;
}

async function handleQuestRetailCallback(
  req: Request,
  res: Response,
  kind: 'status' | 'amendments'
) {
  try {
    const tenantId = await resolveDeliverectWebhookTenant(req);
    const rawBody =
      (req as any).rawBody ||
      Buffer.from(JSON.stringify(req.body), 'utf8');

    if (kind === 'status') {
      const payload = normalizeQuestPickingStatusPayload(req.body);
      const result = await WebhookService.processWebhook(payload, rawBody, req.headers, tenantId);
      return res.status(200).json({ ...result, callbackType: 'PICKING_STATUS' });
    }

    const results = await processQuestAmendments(req.body, rawBody, req.headers, tenantId);
    const last = results[results.length - 1];
    return res.status(200).json({
      ...last,
      results,
      callbackType: 'PICKING_AMENDMENTS',
    });
  } catch (err: any) {
    const status = err.status || err.statusCode || 500;
    const code = err.code || 'WEBHOOK_PROCESSING_ERROR';
    console.error(
      `[Deliverect Quest ${kind} Callback Error] (${status} ${code}):`,
      err.message
    );
    return res.status(status).json({
      error: err.message,
      code,
    });
  }
}

/**
 * Deliverect Retail/Quest callback URLs configured in Partner Integration >
 * Order info. Deliverect documents these as POST status, POST amendments and
 * GET substitutes.
 */
v1Router.post(
  '/webhooks/deliverect/:identifier/picking/status',
  (req: Request, res: Response) =>
    handleQuestRetailCallback(req, res, 'status')
);

v1Router.post(
  '/webhooks/deliverect/:identifier/picking/amendments',
  (req: Request, res: Response) =>
    handleQuestRetailCallback(req, res, 'amendments')
);

async function handleDeliverectOperationalWebhook(
  req: Request,
  res: Response,
  type: DeliverectOperationalWebhookType
): Promise<void> {
  try {
    const candidateTenantId = await resolveDeliverectWebhookTenant(req);
    const rawBody =
      (req as any).rawBody || Buffer.from(JSON.stringify(req.body), 'utf8');
    const signatureHeader =
      (req.headers['x-server-authorization-hmac-sha256'] as string) ||
      (req.headers['x-deliverect-signature'] as string) ||
      (req.headers['x-signature'] as string) ||
      (req.headers['x-deliverect-hmac-sha256'] as string);

    const { tenantId } = await WebhookService.resolveTenantForWebhook(
      rawBody,
      signatureHeader,
      candidateTenantId
    );

    const result = await DeliverectOperationalWebhookService.process(
      tenantId,
      type,
      req.body,
      rawBody
    );

    if (type === 'busy_mode') {
      res.status(200).json({ status: result.status });
      return;
    }

    res.status(200).json(result);
  } catch (err: any) {
    const status = err.status || err.statusCode || 500;
    const code = err.code || 'OPERATIONAL_WEBHOOK_PROCESSING_ERROR';
    console.error(
      `[Deliverect Operational Webhook Error] (${status} ${code}):`,
      err.message
    );
    res.status(status).json({ error: err.message, code });
  }
}

v1Router.post(
  [
    '/webhooks/deliverect/:identifier/channel/busy_mode',
    '/webhooks/deliverect/:identifier/channel/busy-mode',
    '/webhooks/deliverect/channel/busy_mode',
    '/webhooks/deliverect/channel/busy-mode',
  ],
  (req: Request, res: Response) =>
    void handleDeliverectOperationalWebhook(req, res, 'busy_mode')
);

v1Router.post(
  [
    '/webhooks/deliverect/:identifier/channel/store_status',
    '/webhooks/deliverect/:identifier/channel/store-status',
    '/webhooks/deliverect/channel/store_status',
    '/webhooks/deliverect/channel/store-status',
  ],
  (req: Request, res: Response) =>
    void handleDeliverectOperationalWebhook(req, res, 'store_status')
);

v1Router.post(
  [
    '/webhooks/deliverect/:identifier/channel/snooze',
    '/webhooks/deliverect/channel/snooze',
  ],
  (req: Request, res: Response) =>
    void handleDeliverectOperationalWebhook(req, res, 'snooze')
);

v1Router.post(
  [
    '/webhooks/deliverect/:identifier/channel/menu_update',
    '/webhooks/deliverect/:identifier/channel/menu-update',
    '/webhooks/deliverect/channel/menu_update',
    '/webhooks/deliverect/channel/menu-update',
  ],
  (req: Request, res: Response) =>
    void handleDeliverectOperationalWebhook(req, res, 'menu_update')
);

/**
 * Deliverect Inbound Webhook Ingestion (WH-01, WH-02, WH-03)
 * Supports integration-specific routes (/webhooks/deliverect/:identifier) and global route with host/query resolution.
 * Enforces HMAC validation, event journaling, deduplication, and monotonic state progression.
 */
v1Router.post(['/webhooks/deliverect', '/webhooks/deliverect/:identifier'], async (req: Request, res: Response) => {
  try {
    const tenantId = await resolveDeliverectWebhookTenant(req);
    const rawBody = (req as any).rawBody || Buffer.from(JSON.stringify(req.body), 'utf8');

    const result = await WebhookService.processWebhook(
      req.body,
      rawBody,
      req.headers,
      tenantId
    );

    res.status(200).json(result);
  } catch (err: any) {
    const status = err.status || err.statusCode || 500;
    const code = err.code || 'WEBHOOK_PROCESSING_ERROR';
    console.error(`[Deliverect Webhook Error] (${status} ${code}):`, err.message);
    res.status(status).json({
      error: err.message,
      code,
    });
  }
});

/**
 * Maps a Firestore order projection to the frontend Order shape. Shared by
 * the single-order fallback path and the customer order-history list so the
 * two never drift apart.
 */
function mapOrderProjectionToOrder(proj: OrderProjection, tenant?: { currency?: string } | null): any {
  const currency = proj.metadata?.currency || tenant?.currency;
  return {
    id: proj.orderId,
    displayId: proj.orderReference || proj.orderId,
    storeId: proj.channelLinkId || '',
    storeName: proj.metadata?.storeName,
    createdAt: proj.createdAt,
    status: proj.status as any,
    scheduledTime: proj.metadata?.scheduledTime || { type: 'ASAP' },
    fulfillment: { type: (proj.fulfillmentType as any) || 'delivery' },
    currentOrder: {
      itemCount: proj.itemsCount,
      subtotal: typeof proj.total === 'number' && currency ? { amount: proj.total, currency } : undefined,
      deliveryCharge: proj.metadata?.deliveryCharge !== undefined && proj.metadata?.deliveryCharge !== null && currency ? { amount: proj.metadata.deliveryCharge, currency } : undefined,
      bagFee: proj.metadata?.bagFee !== undefined && proj.metadata?.bagFee !== null && currency ? { amount: proj.metadata.bagFee, currency } : undefined,
      serviceCharge: proj.metadata?.serviceCharge !== undefined && proj.metadata?.serviceCharge !== null && currency ? { amount: proj.metadata.serviceCharge, currency } : undefined,
      total: typeof proj.total === 'number' && currency ? { amount: proj.total, currency } : undefined,
    },
    picking: proj.picking,
    payment: proj.paymentId && currency ? {
      paymentId: proj.paymentId,
      state: (proj.paymentState as any) || 'AUTHORIZED',
      currency,
      authorizedAmount: proj.authorizedMaximum !== undefined && proj.authorizedMaximum !== null ? { amount: proj.authorizedMaximum, currency } : undefined,
      authorizationMaximum: proj.authorizedMaximum !== undefined && proj.authorizedMaximum !== null ? { amount: proj.authorizedMaximum, currency } : undefined,
      finalAmount: proj.finalAmount !== undefined && proj.finalAmount !== null ? { amount: proj.finalAmount, currency } : undefined,
      capturedAmount: proj.paymentState === 'CAPTURED' && proj.finalAmount !== undefined && proj.finalAmount !== null ? { amount: proj.finalAmount, currency } : undefined,
      history: [],
    } : undefined,
  };
}

/**
 * Customer account favourites.
 *
 * The active storefront host resolves the tenant; the Firebase ID token
 * resolves the customer. Neither tenant nor customer identity is accepted
 * from the request body, keeping the persistence boundary tenant-safe.
 */
v1Router.get('/account/favourites', async (req: Request, res: Response) => {
  try {
    const tenantId = resolveTenant(req);
    const customerUid = await getCallerUid(req);
    if (!customerUid) {
      return res.status(401).json({
        error: 'Sign in to view your favourites.',
        code: 'AUTH_REQUIRED',
      });
    }

    const profile = await CustomerAccountService.getProfile(tenantId, customerUid);
    res.json({ favouritePlus: profile.favouritePlus });
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to retrieve customer favourites');
  }
});

v1Router.put(
  '/account/favourites',
  validateBody(CustomerFavouritesSchema),
  async (req: Request, res: Response) => {
    try {
      const tenantId = resolveTenant(req);
      const customerUid = await getCallerUid(req);
      if (!customerUid) {
        return res.status(401).json({
          error: 'Sign in to save your favourites.',
          code: 'AUTH_REQUIRED',
        });
      }

      const profile = await CustomerAccountService.saveFavourites(
        tenantId,
        customerUid,
        req.body.favouritePlus
      );
      res.json({ favouritePlus: profile.favouritePlus, updatedAt: profile.updatedAt });
    } catch (err: any) {
      handleCommerceError(res, err, 'Failed to save customer favourites');
    }
  }
);

/**
 * Customer saved delivery addresses.
 *
 * Addresses are customer PII, so both tenant and UID are server-resolved.
 * The browser never reads or writes the Firestore customer profile directly.
 */
v1Router.get('/account/addresses', async (req: Request, res: Response) => {
  try {
    const tenantId = resolveTenant(req);
    const customerUid = await getCallerUid(req);
    if (!customerUid) {
      return res.status(401).json({
        error: 'Sign in to view saved addresses.',
        code: 'AUTH_REQUIRED',
      });
    }

    const profile = await CustomerAccountService.getProfile(tenantId, customerUid);
    res.json({ savedAddresses: profile.savedAddresses });
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to retrieve saved addresses');
  }
});

v1Router.put(
  '/account/addresses',
  validateBody(CustomerAddressesSchema),
  async (req: Request, res: Response) => {
    try {
      const tenantId = resolveTenant(req);
      const customerUid = await getCallerUid(req);
      if (!customerUid) {
        return res.status(401).json({
          error: 'Sign in to save delivery addresses.',
          code: 'AUTH_REQUIRED',
        });
      }

      const profile = await CustomerAccountService.saveAddresses(
        tenantId,
        customerUid,
        req.body.savedAddresses
      );
      res.json({ savedAddresses: profile.savedAddresses, updatedAt: profile.updatedAt });
    } catch (err: any) {
      handleCommerceError(res, err, 'Failed to save delivery addresses');
    }
  }
);

/**
 * Customer's own order history — the frontend's OrdersScreen ("Orders"
 * account page) calls this via HttpCommerceClient.getOrderHistory(). It was
 * previously wired to nothing (see git history / getUserOrders), so every
 * real customer's order history silently rendered empty.
 */
v1Router.get('/orders', async (req: Request, res: Response) => {
  try {
    const tenantId = resolveTenant(req);
    let customerUid: string | undefined;

    if (isDemoMode() || process.env.NODE_ENV === 'test') {
      customerUid = (req.query.customerUid as string) || undefined;
    } else {
      customerUid = await getCallerUid(req);
      if (!customerUid) {
        return res.status(401).json({
          error: 'Sign in to view your order history.',
          code: 'AUTH_REQUIRED',
        });
      }
    }

    if (!customerUid) {
      return res.json([]);
    }

    const [projections, tenant] = await Promise.all([
      FirestorePlatformService.listOrderProjectionsByCustomer(customerUid, tenantId),
      FirestorePlatformService.getTenantConfig(tenantId),
    ]);

    res.json(projections.map((proj) => mapOrderProjectionToOrder(proj, tenant)));
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to retrieve order history');
  }
});

v1Router.get('/orders/:orderId', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const tenantId = resolveTenant(req);
    const adapter = await getDeliverectAdapterAsync(tenantId);
    let order = await adapter.getOrder(orderId);

    // Merge or fall back to Firestore order projection for authoritative picking updates
    const proj = await FirestorePlatformService.getOrderProjectionByExternalIdentifier(orderId);

    // Section 26 & Item 18: Customer Access Control
    if (proj?.customerUid && !isDemoMode() && process.env.NODE_ENV !== 'test') {
      const callerUid = await getCallerUid(req);
      const adminUser = (req as AuthenticatedRequest).adminUser;
      const isAuthorized = adminUser || (callerUid && callerUid === proj.customerUid);
      if (!isAuthorized) {
        return res.status(403).json({
          error: 'Access denied: Customer order does not belong to caller.',
          code: 'FORBIDDEN',
        });
      }
    }

    if (!order && proj) {
      const tenant = await FirestorePlatformService.getTenantConfig(proj.tenantId || 'brand-alpha');
      order = mapOrderProjectionToOrder(proj, tenant) as any;
    } else if (order && proj?.picking) {
      // Overwrite in-memory order picking state with authoritative Firestore projection
      order.picking = proj.picking;
      order.status = (proj.status as any) || order.status;
      if (proj.paymentState && order.payment) {
        order.payment.state = proj.paymentState as any;
      }
    }

    if (!order) {
      return res.status(404).json({ error: 'Order not found', code: 'ORDER_NOT_FOUND' });
    }
    res.json(order);
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to retrieve order');
  }
});

/**
 * Phase 13 Final Payment Settlement (PAY-07, PAY-08):
 * Explicitly reconcile final order totals against authorized ceiling, capturing funds and releasing residual holds.
 */
v1Router.post('/orders/:orderId/settle', requireAdminAuth('operationsEditor'), async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const admin = (req as AuthenticatedRequest).adminUser;
    const tenantId = admin?.tenantId || (req.body?.tenantId as string) || resolveTenant(req);
    const reauthorizeIfNeeded = Boolean(req.body?.reauthorizeIfNeeded);
    const result = await PaymentService.settleOrderPayment(orderId, tenantId, {
      reauthorizeIfNeeded,
      actor: admin,
    });
    res.json(result);
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to settle order payment');
  }
});

/**
 * Phase 13 Order Cancellation & Payment Reversal:
 * Voids pending authorization holds or issues full refunds for captured orders.
 */
v1Router.post('/orders/:orderId/cancel', requireAdminAuth('operationsEditor'), async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const admin = (req as AuthenticatedRequest).adminUser;
    const tenantId = admin?.tenantId || (req.body?.tenantId as string) || resolveTenant(req);
    const reason = req.body?.reason || 'Order cancelled';
    const result = await PaymentService.handleOrderCancellation(orderId, tenantId, reason, admin);
    res.json(result);
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to cancel order');
  }
});

/**
 * Phase 13 Order Settlement Details:
 * Retrieves the full breakdown of authorization ceiling, picked items, amendments, capture amount, and released holds.
 */
v1Router.get('/orders/:orderId/settlement', requireAdminAuth('operationsEditor'), async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const order = await FirestorePlatformService.getOrderProjection(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found', code: 'ORDER_NOT_FOUND' });
    }
    const finalAmount = PaymentService.calculateAuthoritativeFinalAmount(order);
    const authorizedAmount = order.authorizedMaximum || order.total;
    const residualHold = order.residualHoldReleased !== undefined
      ? order.residualHoldReleased
      : Math.max(0, authorizedAmount - finalAmount);

    res.json({
      orderId,
      paymentId: order.paymentId,
      paymentState: order.paymentState || 'AUTHORIZED',
      authorizedAmount,
      finalAmount,
      capturedAmount: order.capturedAmount || (order.paymentState === 'CAPTURED' ? finalAmount : 0),
      residualHoldReleased: residualHold,
      settlementDetails: order.settlementDetails || null,
    });
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to retrieve order settlement');
  }
});

/**
 * Deliverect Quest Substitute Callback Service (WH-04, QST-04, QST-05)
 * Called by Deliverect Quest or internal channel when an item is unavailable.
 * Verifies optional signature and returns customer substitution preferences & candidates.
 */
const handleSubstituteCallback = async (req: Request, res: Response) => {
  try {
    const { orderId, plu } = req.params;
    let tenantId: string | undefined;

    // Resolve tenant authoritatively through stored order projection
    const orderProj = await FirestorePlatformService.getOrderProjectionByExternalIdentifier(orderId);
    if (orderProj?.tenantId) {
      tenantId = orderProj.tenantId;
    } else if (isDemoMode() || process.env.NODE_ENV === 'test') {
      tenantId = (req.query.tenantId as string) || (req.headers['x-tenant-id'] as string) || 'brand-alpha';
    } else {
      return res.status(404).json({
        error: `Order '${orderId}' not found for substitute callback.`,
        code: 'ORDER_NOT_FOUND',
      });
    }

    // WH-04: Verify GET signature. Deliverect staging uses channelLinkId as
    // the temporary HMAC secret until a dedicated partner HMAC secret is set.
    const integration =
      await FirestorePlatformService.getIntegrationConfig(tenantId);
    const isStaging =
      integration?.environment !== 'production' &&
      process.env.DELIVERECT_ENV !== 'production';
    const configuredSignatureValid =
      SubstitutionCallbackService.verifyGetSignature(
        req.path,
        req.query,
        req.headers,
        tenantId
      );
    const stagingChannelLinkSignatureValid =
      Boolean(isStaging && orderProj?.channelLinkId) &&
      SubstitutionCallbackService.verifyGetSignature(
        req.path,
        req.query,
        req.headers,
        tenantId,
        orderProj?.channelLinkId
      );
    const isSignatureValid =
      configuredSignatureValid ||
      stagingChannelLinkSignatureValid;

    if (!isSignatureValid) {
      return res.status(401).json({
        error:
          'Invalid webhook signature for substitute callback. In staging, Deliverect should sign this GET using the order channelLinkId when no dedicated HMAC secret is configured.',
        code: 'INVALID_SIGNATURE',
      });
    }

    const candidates = await SubstitutionCallbackService.getQuestSubstituteCandidates(orderId, plu, tenantId);
    res.status(200).json(candidates);
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to resolve substitution callback');
  }
};

v1Router.get('/orders/:orderId/substitute/:plu', handleSubstituteCallback);
v1Router.get('/integrations/deliverect/orders/:orderId/substitute/:plu', handleSubstituteCallback);

v1Router.post('/orders/:orderId/simulate-picking', async (req: Request, res: Response) => {
  try {
    if (!isDemoMode()) {
      return res.status(403).json({ error: 'Order picking simulation is only available in demo mode.' });
    }
    const tenantId = resolveTenant(req);
    const adapter = await getDeliverectAdapterAsync(tenantId);
    const order = adapter.advancePickingDemo
      ? await adapter.advancePickingDemo(req.params.orderId)
      : null;
    if (order) {
      await FirestorePlatformService.saveOrderProjection(order);
    }
    res.json(order);
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ error: err.message, code: err.code });
  }
});

// ==========================================
// 9. ADMIN & SUPER ADMIN PLATFORM APIS
// ==========================================

// 9.0 Current Admin Identity Check
v1Router.get('/admin/auth/me', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const tenantId = (req.headers['x-tenant-id'] as string) || (req.query.tenantId as string) || 'brand-alpha';
  const result = await verifyAdminSessionWithStatus(authHeader, tenantId);

  if (!result.authenticated) {
    return res.status(401).json({
      error: result.message || 'Unauthenticated',
      code: result.code || 'AUTH_REQUIRED',
    });
  }

  if (!result.authorized || !result.user) {
    return res.status(403).json({
      error: result.message || 'Authenticated but not authorized',
      code: result.code || 'AUTHENTICATED_NOT_AUTHORIZED',
      email: result.email,
    });
  }

  const userWithId = {
    ...result.user,
    id: result.user.uid,
  };

  res.json({
    ...userWithId,
    user: userWithId,
  });
});

// 9.0.0 Conversational assistant.
// Conversation has no direct tool, credential, Firestore or arbitrary network access.
// Operational actions continue to use the separate typed Action Registry / ChangeSet endpoints.
v1Router.post(
  '/admin/assistant/chat',
  requireAdminAuth(),
  requireAdminCapability('assistant.use'),
  validateBody(AdminAssistantChatSchema),
  async (req: Request, res: Response) => {
    try {
      const authAdmin = (req as AuthenticatedRequest).adminUser!;
      const tenantId = (req as AuthenticatedRequest).resolvedTenantId || authAdmin.tenantId;
      const response = await AdminAssistantChatService.chat({
        tenantId,
        actorId: authAdmin.uid,
        actorRole: authAdmin.role,
        actorName: authAdmin.name || authAdmin.email,
        message: req.body.message,
        history: req.body.history,
        attachments: req.body.attachments,
        context: req.body.context,
      });

      if (response.readAction) {
        await FirestorePlatformService.addAuditLog(tenantId, {
          userId: authAdmin.uid,
          userName: authAdmin.name || authAdmin.email || 'Admin',
          userRole: authAdmin.role,
          tenantId,
          category: 'Integration',
          action: `Assistant automatic read: ${response.readAction}`,
          details: JSON.stringify({
            context: req.body.context || null,
            source: 'assistant.chat',
          }),
          actorType: 'assistant',
          actionRisk: 'READ',
          reversible: false,
        });
      }

      res.json({
        ...response,
        mode: 'CONVERSATION',
        safety: {
          tenantBoundByServer: true,
          directWriteAccess: false,
          credentialsExposed: false,
          autonomousExecutionEnabled: false,
        },
      });
    } catch (err: any) {
      res.status(err?.statusCode || 503).json({
        error: err?.message || 'Admin AI could not answer right now.',
        code: err?.code || 'ADMIN_ASSISTANT_CHAT_FAILED',
      });
    }
  }
);

// 9.0.0 Assistant capability discovery
// This endpoint intentionally exposes metadata only. It does not execute actions.
v1Router.get('/admin/assistant/actions', requireAdminAuth(), async (req: Request, res: Response) => {
  const authAdmin = (req as AuthenticatedRequest).adminUser!;
  const actions = listAssistantActionsForRole(authAdmin.role);
  res.json({
    mode: 'READ_AND_PROPOSE_FOUNDATION',
    tenantId: authAdmin.tenantId,
    actions,
  });
});

// 9.0.0a Create a deterministic assistant action plan.
// Tenant scope always comes from authenticated server context, never from the model payload.
v1Router.post('/admin/assistant/plan', requireAdminAuth(), requireAdminCapability('assistant.use'), validateBody(AdminAssistantPlanSchema), async (req: Request, res: Response) => {
  try {
    const authAdmin = (req as AuthenticatedRequest).adminUser!;
    const tenantId = (req as AuthenticatedRequest).resolvedTenantId || authAdmin.tenantId;
    const action = assertAssistantActionAllowed(authAdmin.role, req.body.actionName);
    const plan = buildReadOnlyActionPlan({
      action,
      tenantId,
      actorId: authAdmin.uid,
      input: req.body.input,
    });

    res.json({
      plan,
      context: req.body.context || null,
      safety: {
        tenantBoundByServer: true,
        credentialsExposed: false,
        arbitraryNetworkAccess: false,
      },
    });
  } catch (err: any) {
    res.status(err?.statusCode || 400).json({
      error: err?.message || 'Unable to create admin action plan.',
      code: err?.code || 'ADMIN_ACTION_PLAN_FAILED',
    });
  }
});

// 9.0.0b Execute deterministic READ actions only.
// Write actions remain fail-closed until change-set approval and rollback persistence are connected.
v1Router.post('/admin/assistant/execute', requireAdminAuth(), requireAdminCapability('assistant.use'), validateBody(AdminAssistantExecuteSchema), async (req: Request, res: Response) => {
  res.status(400).json({
    error: 'Plan-ID execution is not enabled. Use /admin/assistant/run for deterministic read-only actions.',
    code: 'ADMIN_ACTION_PLAN_EXECUTION_DISABLED',
    mode: 'READ_ONLY',
  });
});

v1Router.post('/admin/assistant/run', requireAdminAuth(), requireAdminCapability('assistant.use'), validateBody(AdminAssistantPlanSchema), async (req: Request, res: Response) => {
  try {
    const authAdmin = (req as AuthenticatedRequest).adminUser!;
    const tenantId = (req as AuthenticatedRequest).resolvedTenantId || authAdmin.tenantId;
    const execution = await AdminAssistantActionService.executeReadOnly({
      actor: { uid: authAdmin.uid, role: authAdmin.role, tenantId: authAdmin.tenantId },
      tenantId,
      actionName: req.body.actionName,
      input: req.body.input,
    });

    await FirestorePlatformService.addAuditLog(tenantId, {
      userId: authAdmin.uid,
      userName: authAdmin.name || authAdmin.email || 'Admin',
      userRole: authAdmin.role,
      tenantId,
      category: 'Integration',
      action: `Assistant read: ${req.body.actionName}`,
      details: JSON.stringify({
        planId: execution.plan.planId,
        evidence: execution.evidence,
        context: req.body.context || null,
      }),
      actorType: 'assistant',
      changeSetId: execution.plan.planId,
      actionRisk: 'READ',
      reversible: false,
    });

    res.json(execution);
  } catch (err: any) {
    res.status(err?.statusCode || 400).json({
      error: err?.message || 'Assistant action failed.',
      code: err?.code || 'ADMIN_ACTION_FAILED',
    });
  }
});

// 9.0.0c Persist previewable assistant write proposals as durable change sets.
// This endpoint NEVER applies the proposed mutation. Tenant and actor identity come from server auth.
v1Router.post(
  '/admin/assistant/change-sets',
  requireAdminAuth(),
  requireAdminCapability('assistant.use'),
  validateBody(AdminAssistantChangeSetSchema),
  async (req: Request, res: Response) => {
    try {
      const authAdmin = (req as AuthenticatedRequest).adminUser!;
      const tenantId = (req as AuthenticatedRequest).resolvedTenantId || authAdmin.tenantId;

      if (req.body.actions.filter((action: any) => action.actionName === 'branding.proposeUpdate').length > 1) {
        return res.status(400).json({
          error: 'A change set can contain only one tenant branding action.',
          code: 'ADMIN_CHANGESET_DUPLICATE_RESOURCE_ACTION',
        });
      }

      const preparedActions = [];
      for (let index = 0; index < req.body.actions.length; index += 1) {
        const requestedAction = req.body.actions[index];
        preparedActions.push(
          await AdminResourceAdapterRegistry.prepareProposal({
            tenantId,
            actorId: authAdmin.uid,
            actionName: requestedAction.actionName,
            input: requestedAction.input,
            idempotencyKey: req.body.idempotencyKey
              ? `${req.body.idempotencyKey}:${index}`
              : undefined,
          })
        );
      }

      const affectedResourceMap = new Map<string, { type: string; id: string; label?: string }>();
      for (const prepared of preparedActions) {
        for (const resource of prepared.affectedResources) {
          affectedResourceMap.set(`${resource.type}:${resource.id}`, resource);
        }
      }

      const evidenceFor = (key: 'beforeSnapshot' | 'afterSnapshot' | 'diff') => {
        const populated = preparedActions
          .filter((prepared) => prepared[key] !== undefined)
          .map((prepared) => ({ actionName: prepared.actionName, value: prepared[key] }));
        if (populated.length === 0) return undefined;
        return populated.length === 1 ? populated[0].value : populated;
      };

      const changeSet = await AdminChangeSetService.createProposedChangeSet({
        tenantId,
        actorId: authAdmin.uid,
        actorRole: authAdmin.role,
        prompt: req.body.prompt,
        actions: preparedActions.map((prepared) => ({
          actionName: prepared.actionName,
          input: prepared.input,
        })),
        affectedResources: Array.from(affectedResourceMap.values()),
        beforeSnapshot: evidenceFor('beforeSnapshot'),
        afterSnapshot: evidenceFor('afterSnapshot'),
        diff: evidenceFor('diff'),
        warnings: preparedActions.flatMap((prepared) => prepared.warnings),
        revisionIds: preparedActions.flatMap((prepared) => prepared.revisionIds),
        idempotencyKey: req.body.idempotencyKey,
        conversationId: req.body.conversationId,
      });

      await FirestorePlatformService.addAuditLog(tenantId, {
        userId: authAdmin.uid,
        userName: authAdmin.name || authAdmin.email || 'Admin',
        userRole: authAdmin.role,
        tenantId,
        category: 'Integration',
        action: 'Assistant change set proposed',
        details: JSON.stringify({
          changeSetId: changeSet.id,
          actions: changeSet.actions.map((action) => action.actionName),
          affectedResources: changeSet.affectedResources,
        }),
        actorType: 'assistant',
        changeSetId: changeSet.id,
        sourcePrompt: changeSet.prompt,
        actionRisk: changeSet.actions.some((action) => action.risk === 'HIGH_WRITE' || action.risk === 'RESTRICTED')
          ? 'HIGH_WRITE'
          : 'LOW_WRITE',
        beforeState: changeSet.beforeSnapshot,
        afterState: changeSet.afterSnapshot,
        reversible: changeSet.reversible,
      });

      res.status(201).json({
        changeSet,
        mode: 'PROPOSAL_ONLY',
        autonomousExecutionEnabled: false,
        safety: {
          tenantBoundByServer: true,
          approvalRequired: true,
          credentialsExposed: false,
          arbitraryNetworkAccess: false,
        },
      });
    } catch (err: any) {
      res.status(err?.statusCode || 400).json({
        error: err?.message || 'Unable to create assistant change set.',
        code: err?.code || 'ADMIN_CHANGESET_CREATE_FAILED',
      });
    }
  }
);

v1Router.get('/admin/assistant/change-sets/:changeSetId', requireAdminAuth(), async (req: Request, res: Response) => {
  try {
    const authAdmin = (req as AuthenticatedRequest).adminUser!;
    if (!hasServerAdminCapability(authAdmin.role, 'assistant.use')) {
      return res.status(403).json({ error: 'Assistant access is not permitted.', code: 'ADMIN_CAPABILITY_REQUIRED' });
    }
    const tenantId = (req as AuthenticatedRequest).resolvedTenantId || authAdmin.tenantId;
    const changeSet = await AdminChangeSetService.getChangeSet(tenantId, req.params.changeSetId);
    res.json({ changeSet, autonomousExecutionEnabled: false });
  } catch (err: any) {
    res.status(err?.statusCode || 400).json({
      error: err?.message || 'Unable to load assistant change set.',
      code: err?.code || 'ADMIN_CHANGESET_READ_FAILED',
    });
  }
});

// Approval is a recorded human decision only. Applying approved changes remains fail-closed.
v1Router.post(
  '/admin/assistant/change-sets/:changeSetId/approve',
  requireAdminAuth(),
  requireAdminCapability('assistant.use'),
  async (req: Request, res: Response) => {
    try {
      const authAdmin = (req as AuthenticatedRequest).adminUser!;
      const tenantId = (req as AuthenticatedRequest).resolvedTenantId || authAdmin.tenantId;
      const changeSet = await AdminChangeSetService.approveChangeSet({
        tenantId,
        changeSetId: req.params.changeSetId,
        actorId: authAdmin.uid,
        actorRole: authAdmin.role,
      });

      await FirestorePlatformService.addAuditLog(tenantId, {
        userId: authAdmin.uid,
        userName: authAdmin.name || authAdmin.email || 'Admin',
        userRole: authAdmin.role,
        tenantId,
        category: 'Integration',
        action: 'Assistant change set approved',
        details: JSON.stringify({
          changeSetId: changeSet.id,
          actions: changeSet.actions.map((action) => action.actionName),
        }),
        actorType: 'human',
        changeSetId: changeSet.id,
        actionRisk: changeSet.actions.some((action) => action.risk === 'HIGH_WRITE' || action.risk === 'RESTRICTED')
          ? 'HIGH_WRITE'
          : 'LOW_WRITE',
        reversible: changeSet.reversible,
      });

      res.json({
        changeSet,
        autonomousExecutionEnabled: false,
        applyAvailable: changeSet.applyAvailable,
        message: changeSet.applyAvailable
          ? 'Approved and recorded. This Branding change can now be applied explicitly.'
          : 'Approved and recorded. Apply remains disabled until a versioned resource adapter is connected.',
      });
    } catch (err: any) {
      res.status(err?.statusCode || 400).json({
        error: err?.message || 'Unable to approve assistant change set.',
        code: err?.code || 'ADMIN_CHANGESET_APPROVAL_FAILED',
      });
    }
  }
);

// 9.0.0d Apply an approved LOW_WRITE change set through its typed resource adapter.
// Branding is the only executable adapter in this foundation. All other write actions remain fail-closed.
v1Router.post(
  '/admin/assistant/change-sets/:changeSetId/apply',
  requireAdminAuth(),
  requireAdminCapability('assistant.executeLowRisk'),
  requireAdminCapability('branding.write'),
  async (req: Request, res: Response) => {
    const authAdmin = (req as AuthenticatedRequest).adminUser!;
    const tenantId = (req as AuthenticatedRequest).resolvedTenantId || authAdmin.tenantId;
    let changeSet;
    try {
      changeSet = await AdminChangeSetService.getChangeSet(tenantId, req.params.changeSetId);
      if (!['APPROVED', 'APPLYING'].includes(changeSet.status)) {
        return res.status(409).json({
          error: `Change set cannot be applied from state ${changeSet.status}.`,
          code: 'ADMIN_CHANGESET_INVALID_STATE',
        });
      }
      if (
        changeSet.actions.length !== 1 ||
        changeSet.actions[0].actionName !== 'branding.proposeUpdate' ||
        changeSet.actions[0].risk !== 'LOW_WRITE' ||
        changeSet.revisionIds.length !== 1
      ) {
        return res.status(409).json({
          error: 'This change set does not have an executable Branding adapter.',
          code: 'ADMIN_CHANGESET_APPLY_NOT_CONNECTED',
        });
      }

      if (changeSet.status === 'APPROVED') {
        changeSet = await AdminChangeSetService.transitionChangeSet({
          tenantId,
          changeSetId: changeSet.id,
          actorId: authAdmin.uid,
          status: 'APPLYING',
        });
      }

      const execution = await AdminResourceAdapterRegistry.applyRevision({
        tenantId,
        actorId: authAdmin.uid,
        actionName: changeSet.actions[0].actionName,
        revisionId: changeSet.revisionIds[0],
      });

      const applied = await AdminChangeSetService.transitionChangeSet({
        tenantId,
        changeSetId: changeSet.id,
        actorId: authAdmin.uid,
        status: 'APPLIED',
        afterSnapshot: execution.result,
      });

      await FirestorePlatformService.addAuditLog(tenantId, {
        userId: authAdmin.uid,
        userName: authAdmin.name || authAdmin.email || 'Admin',
        userRole: authAdmin.role,
        tenantId,
        category: 'Branding',
        action: 'Assistant branding change applied',
        details: JSON.stringify({
          changeSetId: applied.id,
          revisionId: execution.revisionId,
        }),
        actorType: 'human',
        changeSetId: applied.id,
        actionRisk: 'LOW_WRITE',
        beforeState: applied.beforeSnapshot,
        afterState: applied.afterSnapshot,
        reversible: applied.reversible,
      });

      res.json({
        changeSet: applied,
        revisionId: execution.revisionId,
        result: execution.result,
        autonomousExecutionEnabled: false,
      });
    } catch (err: any) {
      const definitelyNotApplied = new Set([
        'ADMIN_REVISION_RESOURCE_MISMATCH',
        'ADMIN_REVISION_NOT_VALIDATED',
        'ADMIN_REVISION_LIVE_STATE_CONFLICT',
        'ADMIN_CHANGESET_APPLY_NOT_CONNECTED',
      ]);
      if (changeSet?.status === 'APPLYING' && definitelyNotApplied.has(err?.code)) {
        try {
          await AdminChangeSetService.transitionChangeSet({
            tenantId,
            changeSetId: changeSet.id,
            actorId: authAdmin.uid,
            status: 'FAILED',
            warning: err?.message || 'Branding apply failed before any write.',
          });
        } catch {}
      }
      res.status(err?.statusCode || 400).json({
        error: err?.message || 'Unable to apply assistant change set.',
        code: err?.code || 'ADMIN_CHANGESET_APPLY_FAILED',
        retrySafe: changeSet?.status === 'APPLYING' && !definitelyNotApplied.has(err?.code),
      });
    }
  }
);

// 9.0.0e Undo an applied Branding change set by publishing a new revision.
// Rollback refuses to proceed if Branding has changed again since this change set was applied.
v1Router.post(
  '/admin/assistant/change-sets/:changeSetId/rollback',
  requireAdminAuth(),
  requireAdminCapability('assistant.executeLowRisk'),
  requireAdminCapability('branding.write'),
  async (req: Request, res: Response) => {
    try {
      const authAdmin = (req as AuthenticatedRequest).adminUser!;
      const tenantId = (req as AuthenticatedRequest).resolvedTenantId || authAdmin.tenantId;
      const changeSet = await AdminChangeSetService.getChangeSet(tenantId, req.params.changeSetId);
      if (changeSet.status !== 'APPLIED') {
        return res.status(409).json({
          error: `Change set cannot be rolled back from state ${changeSet.status}.`,
          code: 'ADMIN_CHANGESET_INVALID_STATE',
        });
      }
      if (
        changeSet.actions.length !== 1 ||
        changeSet.actions[0].actionName !== 'branding.proposeUpdate' ||
        changeSet.revisionIds.length !== 1
      ) {
        return res.status(409).json({
          error: 'This change set does not have a reversible Branding adapter.',
          code: 'ADMIN_CHANGESET_ROLLBACK_NOT_CONNECTED',
        });
      }

      const rollback = await AdminResourceAdapterRegistry.rollbackRevision({
        tenantId,
        actorId: authAdmin.uid,
        actionName: changeSet.actions[0].actionName,
        revisionId: changeSet.revisionIds[0],
      });

      const rolledBack = await AdminChangeSetService.transitionChangeSet({
        tenantId,
        changeSetId: changeSet.id,
        actorId: authAdmin.uid,
        status: 'ROLLED_BACK',
        afterSnapshot: rollback.result,
        rollbackRevisionIds: [rollback.revisionId],
      });

      await FirestorePlatformService.addAuditLog(tenantId, {
        userId: authAdmin.uid,
        userName: authAdmin.name || authAdmin.email || 'Admin',
        userRole: authAdmin.role,
        tenantId,
        category: 'Branding',
        action: 'Assistant branding change rolled back',
        details: JSON.stringify({
          changeSetId: rolledBack.id,
          rollbackRevisionId: rollback.revisionId,
        }),
        actorType: 'human',
        changeSetId: rolledBack.id,
        actionRisk: 'LOW_WRITE',
        afterState: rolledBack.afterSnapshot,
        reversible: false,
        reversedAt: rolledBack.rolledBackAt,
      });

      res.json({
        changeSet: rolledBack,
        rollbackRevisionId: rollback.revisionId,
        result: rollback.result,
      });
    } catch (err: any) {
      res.status(err?.statusCode || 400).json({
        error: err?.message || 'Unable to roll back assistant change set.',
        code: err?.code || 'ADMIN_CHANGESET_ROLLBACK_FAILED',
      });
    }
  }
);

// 9.0.1 Admin Memberships Management (Section 7, 27)
// List memberships: platformSuperAdmin can list all or filter by tenantId; tenantAdmin can list their tenant's memberships.
v1Router.get('/admin/memberships', requireAdminAuth(), async (req: Request, res: Response) => {
  try {
    const authAdmin = (req as AuthenticatedRequest).adminUser!;
    const filterTenant = req.query.tenantId as string | undefined;
    const targetTenant = authAdmin.isSuperAdmin ? filterTenant : authAdmin.tenantId;

    const db = getFirestoreDb();
    if (!db) {
      return res.json([]);
    }

    let query: any = db.collection('tenantMemberships');
    if (targetTenant && targetTenant !== 'platform') {
      query = query.where('tenantId', '==', targetTenant);
    }

    const snap = await query.get();
    const memberships = snap.docs.map((d: any) => ({
      membershipId: d.id,
      ...d.data(),
    }));

    res.json(memberships);
  } catch (err: any) {
    res.status(500).json({ error: err.message, code: 'MEMBERSHIP_QUERY_FAILED' });
  }
});

// Create/Invite membership:
// platformSuperAdmin can create any role (including platformSuperAdmin or tenant roles).
// tenant roles can only grant roles at or below their own authority, within their tenant.
v1Router.post('/admin/memberships', requireAdminAuth(), requireAdminCapability('memberships.manage'), async (req: Request, res: Response) => {
  try {
    const authAdmin = (req as AuthenticatedRequest).adminUser!;
    const { email, role, tenantId: requestedTenantId, name } = req.body || {};

    if (!email || !role) {
      return res.status(400).json({ error: 'Email and role are required', code: 'VALIDATION_FAILED' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const requestedRole = String(role);
    const canonicalRoles = ['platformSuperAdmin', 'tenantAdmin', 'operationsEditor', 'marketingEditor', 'viewer'] as const;
    const assignableRoles: Record<string, readonly string[]> = {
      platformSuperAdmin: canonicalRoles,
      tenantAdmin: ['tenantAdmin', 'operationsEditor', 'marketingEditor', 'viewer'],
      operationsEditor: ['operationsEditor', 'viewer'],
      marketingEditor: ['marketingEditor', 'viewer'],
      viewer: [],
    };

    if (!canonicalRoles.includes(requestedRole as any)) {
      return res.status(400).json({
        error: `Unsupported role: ${requestedRole}`,
        code: 'INVALID_ADMIN_ROLE',
        allowedRoles: canonicalRoles,
      });
    }

    const actorRole = authAdmin.isSuperAdmin ? 'platformSuperAdmin' : authAdmin.role;
    if (!(assignableRoles[actorRole] || []).includes(requestedRole)) {
      return res.status(403).json({
        error: `Your ${actorRole} role cannot assign ${requestedRole}.`,
        code: 'ROLE_GRANT_NOT_ALLOWED',
      });
    }

    const isAssigningSuperAdmin = requestedRole === 'platformSuperAdmin';

    if (isAssigningSuperAdmin && !authAdmin.isSuperAdmin) {
      return res.status(403).json({
        error: 'Forbidden: Only Platform SuperAdmins can assign platformSuperAdmin memberships.',
        code: 'FORBIDDEN_SUPERADMIN_ONLY',
      });
    }

    const targetTenant = isAssigningSuperAdmin
      ? 'platform'
      : (authAdmin.isSuperAdmin ? (requestedTenantId || authAdmin.tenantId) : authAdmin.tenantId);

    const docId = isAssigningSuperAdmin ? `${normalizedEmail}_platform` : `${normalizedEmail}_${targetTenant}`;
    const membershipData = {
      email: normalizedEmail,
      role: requestedRole,
      tenantId: targetTenant,
      name: name || normalizedEmail.split('@')[0],
      status: 'active',
      assignedBy: authAdmin.email,
      assignedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const db = getFirestoreDb();
    if (db) {
      await db.collection('tenantMemberships').doc(docId).set(membershipData, { merge: true });
    }

    // Attempt to set custom claims if user already exists in Firebase Auth
    const adminAuth = getFirebaseAdminAuth();
    if (adminAuth) {
      try {
        const userRecord = await adminAuth.getUserByEmail(normalizedEmail);
        if (userRecord) {
          if (isAssigningSuperAdmin) {
            await adminAuth.setCustomUserClaims(userRecord.uid, { role: 'platformSuperAdmin', platformSuperAdmin: true });
          } else {
            await adminAuth.setCustomUserClaims(userRecord.uid, { role: requestedRole, tenantId: targetTenant });
          }
          if (db) {
            const uidDocId = isAssigningSuperAdmin ? `${userRecord.uid}_platform` : `${userRecord.uid}_${targetTenant}`;
            await db.collection('tenantMemberships').doc(uidDocId).set({
              ...membershipData,
              uid: userRecord.uid,
            }, { merge: true });
          }
        }
      } catch (_) {}
    }

    await FirestorePlatformService.addAuditLog(targetTenant, {
      userId: authAdmin.uid,
      userName: authAdmin.name,
      userRole: authAdmin.role,
      tenantId: targetTenant,
      category: 'Tenant',
      action: 'ASSIGN_MEMBERSHIP',
      details: `Assigned role ${requestedRole} to ${normalizedEmail} for tenant ${targetTenant}`,
    });

    res.status(201).json({
      success: true,
      membershipId: docId,
      membership: membershipData,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message, code: 'MEMBERSHIP_CREATE_FAILED' });
  }
});

// Delete/Revoke membership
v1Router.delete('/admin/memberships/:id', requireAdminAuth(), requireAdminCapability('memberships.manage'), async (req: Request, res: Response) => {
  try {
    const authAdmin = (req as AuthenticatedRequest).adminUser!;
    const membershipId = req.params.id;

    const db = getFirestoreDb();
    if (!db) {
      return res.json({ success: true });
    }

    const doc = await db.collection('tenantMemberships').doc(membershipId).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Membership not found', code: 'NOT_FOUND' });
    }

    const data = doc.data();
    const targetRole = String(data?.role || '');
    const isTargetSuperAdmin = targetRole === 'platformSuperAdmin' || targetRole === 'PLATFORM_SUPER_ADMIN';

    if (!authAdmin.isSuperAdmin) {
      if (isTargetSuperAdmin) {
        return res.status(403).json({
          error: 'Forbidden: Only Platform SuperAdmins can delete platformSuperAdmin memberships.',
          code: 'FORBIDDEN_SUPERADMIN_ONLY',
        });
      }
      if (data?.tenantId !== authAdmin.tenantId) {
        return res.status(403).json({
          error: 'Forbidden: You cannot remove memberships for other tenants.',
          code: 'TENANT_ISOLATION_ERROR',
        });
      }
      if (authAdmin.role === 'viewer') {
        return res.status(403).json({
          error: 'Forbidden: Viewers cannot revoke memberships.',
          code: 'ROLE_REVOKE_NOT_ALLOWED',
        });
      }
      if ((targetRole === 'tenantAdmin' || targetRole === 'TENANT_ADMIN') && authAdmin.role !== 'tenantAdmin') {
        return res.status(403).json({
          error: 'Forbidden: Only tenantAdmin or superAdmin can revoke tenantAdmin memberships.',
          code: 'ROLE_REVOKE_NOT_ALLOWED',
        });
      }
    }

    await db.collection('tenantMemberships').doc(membershipId).delete();

    await FirestorePlatformService.addAuditLog(data?.tenantId || 'platform', {
      userId: authAdmin.uid,
      userName: authAdmin.name,
      userRole: authAdmin.role,
      tenantId: data?.tenantId || 'platform',
      category: 'Tenant',
      action: 'REVOKE_MEMBERSHIP',
      details: `Revoked membership ${membershipId} (${data?.email})`,
    });

    res.json({ success: true, message: `Membership ${membershipId} revoked.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message, code: 'MEMBERSHIP_DELETE_FAILED' });
  }
});

// 9.1 Super Admin: List All Platform Tenants (Strictly Platform Super Admin)
v1Router.get('/admin/tenants', requireAdminAuth('platformSuperAdmin'), async (_req: Request, res: Response) => {
  try {
    const tenants = await FirestorePlatformService.listAllTenants();
    res.json(tenants);
  } catch (err: any) {
    console.warn('[v1Router] Error in listAllTenants, returning fallback tenant list:', err?.message || err);
    try {
      const fallbackTenants = await FirestoreService.listAllTenants();
      res.json(fallbackTenants);
    } catch {
      res.status(500).json({ error: err?.message || 'Failed to list tenants' });
    }
  }
});

// 9.2 Super Admin: Provision New Brand/Tenant (No Deployment Needed!)
v1Router.post('/admin/tenants', requireAdminAuth('platformSuperAdmin'), validateBody(CreateTenantSchema), async (req: Request, res: Response) => {
  try {
    const newTenant = req.body;
    let provisioned = await FirestorePlatformService.createTenant(newTenant);
    if (newTenant.domain) {
      provisioned = await FirestorePlatformService.updateTenantConfig(provisioned.tenantId, {
        defaultDomain: newTenant.domain,
      });
    }

    // Audit log
    await FirestorePlatformService.addAuditLog(provisioned.tenantId, {
      userId: (req as AuthenticatedRequest).adminUser?.uid || 'superadmin',
      userName: (req as AuthenticatedRequest).adminUser?.name || 'Platform SuperAdmin',
      userRole: 'platformSuperAdmin',
      tenantId: provisioned.tenantId,
      category: 'Branding',
      action: 'PROVISION_TENANT',
      details: `Provisioned new multi-tenant brand: ${provisioned.brandName} (${provisioned.tenantId})`,
    });

    res.status(201).json({
      success: true,
      message: `Tenant ${provisioned.brandName} provisioned successfully in Firestore.`,
      tenant: provisioned,
    });
  } catch (err: any) {
    const statusCode = err.statusCode || (err.name === 'BFFError' ? 400 : 500);
    res.status(statusCode).json({ error: err.message, code: err.code || 'PROVISIONING_FAILED' });
  }
});

// 9.3 Get Tenant Branding
v1Router.get('/admin/tenants/:id', requireAdminAuth(), async (req: Request, res: Response) => {
  try {
    const config = await FirestorePlatformService.getTenantConfig(req.params.id);
    res.json(config);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9.4 Update Tenant Branding
v1Router.patch('/admin/tenants/:id', requireAdminAuth(), requireAdminCapability('branding.write'), validateBody(UpdateTenantConfigSchema), async (req: Request, res: Response) => {
  try {
    const updated = await FirestorePlatformService.updateTenantConfig(req.params.id, req.body);

    await FirestorePlatformService.addAuditLog(req.params.id, {
      userId: (req as AuthenticatedRequest).adminUser?.uid || 'admin',
      userName: (req as AuthenticatedRequest).adminUser?.name || 'Admin',
      userRole: (req as AuthenticatedRequest).adminUser?.role || 'tenantAdmin',
      tenantId: req.params.id,
      category: 'Branding',
      action: 'UPDATE_BRANDING',
      details: `Updated brand config: ${Object.keys(req.body).join(', ')}`,
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9.4a Delete Tenant
v1Router.delete('/admin/tenants/:id', requireAdminAuth('platformSuperAdmin'), async (req: Request, res: Response) => {
  try {
    await FirestorePlatformService.deleteTenantConfig(req.params.id);
    await FirestorePlatformService.addAuditLog(req.params.id, {
      userId: (req as AuthenticatedRequest).adminUser?.uid || 'admin',
      userName: (req as AuthenticatedRequest).adminUser?.name || 'Admin',
      userRole: (req as AuthenticatedRequest).adminUser?.role || 'platformSuperAdmin',
      tenantId: req.params.id,
      category: 'Tenant',
      action: 'DELETE_TENANT',
      details: `Deleted tenant config: ${req.params.id}`,
    });
    res.json({ success: true, tenantId: req.params.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9.4b List all configured domain mappings
v1Router.get('/admin/domains', requireAdminAuth(), async (req: Request, res: Response) => {
  try {
    const authAdmin = (req as AuthenticatedRequest).adminUser!;
    const domains =
      authAdmin.isSuperAdmin || authAdmin.role === 'platformSuperAdmin'
        ? await FirestorePlatformService.listAllDomains()
        : await FirestorePlatformService.getDomainsForTenant(authAdmin.tenantId);
    res.json(domains);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9.4c Add or update a domain mapping
v1Router.post('/admin/domains', requireAdminAuth('tenantAdmin'), async (req: Request, res: Response) => {
  try {
    const authAdmin = (req as AuthenticatedRequest).adminUser!;
    const { hostname, tenantId: requestedTenantId, isPrimary } = req.body || {};
    const tenantId =
      authAdmin.isSuperAdmin || authAdmin.role === 'platformSuperAdmin'
        ? String(requestedTenantId || authAdmin.tenantId || '').trim()
        : String(authAdmin.tenantId || '').trim();

    if (!hostname || !tenantId) {
      return res.status(400).json({ error: 'hostname and tenantId are required' });
    }

    if (
      !authAdmin.isSuperAdmin &&
      authAdmin.role !== 'platformSuperAdmin' &&
      requestedTenantId &&
      String(requestedTenantId).trim() !== tenantId
    ) {
      return res.status(403).json({
        error: 'Tenant administrators may only manage domains for their own tenant.',
        code: 'TENANT_ISOLATION_ERROR',
      });
    }

    const cleanHost = String(hostname).toLowerCase().trim().split(':')[0];
    const existing = (await FirestorePlatformService.listAllDomains())
      .find((domain) => domain.hostname === cleanHost);

    if (existing && existing.tenantId !== tenantId) {
      return res.status(409).json({
        error: 'This hostname is already claimed by another tenant.',
        code: 'DOMAIN_ALREADY_CLAIMED',
      });
    }

    // Custom domains never become live on creation. Generate a tenant-bound TXT
    // challenge so ownership can be proven without a support/admin console step.
    const verificationToken =
      existing?.tenantId === tenantId && existing.verificationToken
        ? existing.verificationToken
        : createDomainVerificationToken();
    const verificationRecordName = domainVerificationRecordName(cleanHost);
    const verificationRecordValue = domainVerificationRecordValue(verificationToken);

    const created = existing
      ? await FirestorePlatformService.addOrUpdateDomain({
          hostname: cleanHost,
          tenantId,
          isPrimary: Boolean(isPrimary),
          status: existing.status || 'pending',
          verificationToken,
          verificationRecordName,
          verificationRecordValue,
          tlsStatus: existing.tlsStatus || 'pending',
          ownershipVerifiedAt: existing.ownershipVerifiedAt,
        })
      : await FirestorePlatformService.addOrUpdateDomain({
          hostname: cleanHost,
          tenantId,
          isPrimary: Boolean(isPrimary),
          status: 'pending',
          verificationToken,
          verificationRecordName,
          verificationRecordValue,
          tlsStatus: 'pending',
        });

    await FirestorePlatformService.addAuditLog(tenantId, {
      userId: authAdmin.uid || 'admin',
      userName: authAdmin.name || 'Admin',
      userRole: authAdmin.role || 'tenantAdmin',
      tenantId,
      category: 'Tenant',
      action: 'MAP_DOMAIN_PENDING',
      details: `Claimed domain "${cleanHost}" for tenant "${tenantId}" pending ownership verification`,
    });

    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9.4d Verify DNS ownership for a pending custom domain
v1Router.post('/admin/domains/:domainId/verify', requireAdminAuth('tenantAdmin'), async (req: Request, res: Response) => {
  try {
    const authAdmin = (req as AuthenticatedRequest).adminUser!;
    const domainId = String(req.params.domainId || '').trim();
    const existing = (await FirestorePlatformService.listAllDomains())
      .find((domain) => domain.domainId === domainId || domain.hostname === domainId.toLowerCase());

    if (!existing) {
      return res.status(404).json({ error: 'Domain mapping not found.', code: 'DOMAIN_NOT_FOUND' });
    }

    if (
      !authAdmin.isSuperAdmin &&
      authAdmin.role !== 'platformSuperAdmin' &&
      existing.tenantId !== authAdmin.tenantId
    ) {
      return res.status(403).json({
        error: 'Tenant administrators may only verify domains owned by their own tenant.',
        code: 'TENANT_ISOLATION_ERROR',
      });
    }

    if (!existing.verificationToken) {
      return res.status(409).json({
        error: 'This domain claim has no verification challenge. Re-save the domain to generate one.',
        code: 'DOMAIN_VERIFICATION_CHALLENGE_MISSING',
      });
    }

    const check = await verifyDomainOwnershipTxt(existing.hostname, existing.verificationToken);

    if (!check.verified) {
      return res.status(409).json({
        error: 'DNS ownership has not been verified yet. Add the required TXT record and try again after DNS propagation.',
        code: 'DOMAIN_OWNERSHIP_NOT_VERIFIED',
        verification: check,
      });
    }

    const verifiedAt = new Date().toISOString();
    const updated = await FirestorePlatformService.addOrUpdateDomain({
      hostname: existing.hostname,
      tenantId: existing.tenantId,
      isPrimary: existing.isPrimary,
      status: existing.status === 'active' ? 'active' : 'verified',
      verificationToken: existing.verificationToken,
      verificationRecordName: existing.verificationRecordName || check.recordName,
      verificationRecordValue: existing.verificationRecordValue || check.expectedValue,
      ownershipVerifiedAt: existing.ownershipVerifiedAt || verifiedAt,
      tlsStatus: existing.tlsStatus || 'pending',
    });

    await FirestorePlatformService.addAuditLog(existing.tenantId, {
      userId: authAdmin.uid || 'admin',
      userName: authAdmin.name || 'Admin',
      userRole: authAdmin.role || 'tenantAdmin',
      tenantId: existing.tenantId,
      category: 'Tenant',
      action: 'VERIFY_DOMAIN_OWNERSHIP',
      details: `Verified DNS ownership of "${existing.hostname}" via TXT challenge`,
    });

    return res.json({
      success: true,
      domain: updated,
      verification: check,
      nextStep:
        updated.status === 'active'
          ? 'Domain is already active.'
          : 'Ownership verified. TLS/serving activation is still pending.',
    });
  } catch (err: any) {
    const status = err.statusCode || err.status || 500;
    res.status(status).json({
      error: err.message || 'Domain verification failed.',
      code: err.code || 'DOMAIN_VERIFICATION_FAILED',
    });
  }
});

// 9.4e Delete a domain mapping
v1Router.delete('/admin/domains/:domainId', requireAdminAuth('tenantAdmin'), async (req: Request, res: Response) => {
  try {
    const authAdmin = (req as AuthenticatedRequest).adminUser!;
    const domainId = req.params.domainId;
    const existing = (await FirestorePlatformService.listAllDomains())
      .find((domain) => domain.domainId === domainId || domain.hostname === String(domainId).toLowerCase());

    if (!existing) {
      return res.status(404).json({ error: 'Domain mapping not found.', code: 'DOMAIN_NOT_FOUND' });
    }

    if (
      !authAdmin.isSuperAdmin &&
      authAdmin.role !== 'platformSuperAdmin' &&
      existing.tenantId !== authAdmin.tenantId
    ) {
      return res.status(403).json({
        error: 'Tenant administrators may only delete domains owned by their own tenant.',
        code: 'TENANT_ISOLATION_ERROR',
      });
    }

    await FirestorePlatformService.deleteDomain(domainId);

    await FirestorePlatformService.addAuditLog(existing.tenantId, {
      userId: authAdmin.uid || 'admin',
      userName: authAdmin.name || 'Admin',
      userRole: authAdmin.role || 'tenantAdmin',
      tenantId: existing.tenantId,
      category: 'Tenant',
      action: 'UNMAP_DOMAIN',
      details: `Deleted domain mapping "${existing.hostname}"`,
    });

    res.json({ success: true, message: `Domain ${existing.hostname} deleted.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9.5 Fee Policies
v1Router.get('/admin/tenants/:id/fee-policy', requireAdminAuth(), async (req: Request, res: Response) => {
  try {
    const policy = await FirestorePlatformService.getTenantFeePolicy(req.params.id);
    res.json(policy);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

v1Router.patch('/admin/tenants/:id/fee-policy', requireAdminAuth('tenantAdmin'), validateBody(UpdateFeePolicySchema), async (req: Request, res: Response) => {
  try {
    const updated = await FirestorePlatformService.updateTenantFeePolicy(req.params.id, req.body);

    await FirestorePlatformService.addAuditLog(req.params.id, {
      userId: (req as AuthenticatedRequest).adminUser?.uid || 'admin',
      userName: (req as AuthenticatedRequest).adminUser?.name || 'Admin',
      userRole: (req as AuthenticatedRequest).adminUser?.role || 'tenantAdmin',
      tenantId: req.params.id,
      category: 'Compliance',
      action: 'UPDATE_FEE_POLICY',
      details: `Updated fee policy: smallOrderFeeEnabled=${updated.smallOrderFeeEnabled}, serviceFeeEnabled=${updated.serviceFeeEnabled}`,
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9.5.1 Scheduling Policy (ASAP-only / next-opening pre-order / same-day scheduled pre-order)
v1Router.get('/admin/tenants/:id/scheduling-policy', requireAdminAuth(), async (req: Request, res: Response) => {
  try {
    const policy = await FirestorePlatformService.getTenantSchedulingPolicy(req.params.id);
    res.json(policy);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

v1Router.patch('/admin/tenants/:id/scheduling-policy', requireAdminAuth('tenantAdmin'), validateBody(UpdateSchedulingPolicySchema), async (req: Request, res: Response) => {
  try {
    const updated = await FirestorePlatformService.updateTenantSchedulingPolicy(req.params.id, req.body);

    await FirestorePlatformService.addAuditLog(req.params.id, {
      userId: (req as AuthenticatedRequest).adminUser?.uid || 'admin',
      userName: (req as AuthenticatedRequest).adminUser?.name || 'Admin',
      userRole: (req as AuthenticatedRequest).adminUser?.role || 'tenantAdmin',
      tenantId: req.params.id,
      category: 'Compliance',
      action: 'UPDATE_SCHEDULING_POLICY',
      details: `Updated scheduling policy: acceptAsapOrdersOnly=${updated.acceptAsapOrdersOnly}, allowNextOpeningPreOrder=${updated.allowNextOpeningPreOrder}, allowSameDayScheduledPreOrder=${updated.allowSameDayScheduledPreOrder}`,
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9.6 Stories Admin
v1Router.get('/admin/tenants/:id/stories', requireAdminAuth(), async (req: Request, res: Response) => {
  try {
    const stories = await FirestorePlatformService.getTenantStories(req.params.id);
    res.json(stories);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

v1Router.post('/admin/tenants/:id/stories', requireAdminAuth('marketingEditor'), validateBody(SaveStorySchema), async (req: Request, res: Response) => {
  try {
    const story = await FirestorePlatformService.saveTenantStory(req.params.id, req.body);

    await FirestorePlatformService.addAuditLog(req.params.id, {
      userId: (req as AuthenticatedRequest).adminUser?.uid || 'admin',
      userName: (req as AuthenticatedRequest).adminUser?.name || 'Admin',
      userRole: (req as AuthenticatedRequest).adminUser?.role || 'marketingEditor',
      tenantId: req.params.id,
      category: 'Stories',
      action: 'SAVE_STORY',
      details: `Saved story ${story.id}: "${story.title}"`,
    });

    res.json(story);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

v1Router.delete('/admin/tenants/:id/stories/:storyId', requireAdminAuth('marketingEditor'), async (req: Request, res: Response) => {
  try {
    const success = await FirestorePlatformService.deleteTenantStory(req.params.id, req.params.storyId);

    await FirestorePlatformService.addAuditLog(req.params.id, {
      userId: (req as AuthenticatedRequest).adminUser?.uid || 'admin',
      userName: (req as AuthenticatedRequest).adminUser?.name || 'Admin',
      userRole: (req as AuthenticatedRequest).adminUser?.role || 'marketingEditor',
      tenantId: req.params.id,
      category: 'Stories',
      action: 'DELETE_STORY',
      details: `Deleted story ${req.params.storyId}`,
    });

    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

v1Router.post('/admin/tenants/:id/stories/purge', requireAdminAuth('marketingEditor'), async (req: Request, res: Response) => {
  try {
    const success = await FirestorePlatformService.purgeTenantStories(req.params.id);

    await FirestorePlatformService.addAuditLog(req.params.id, {
      userId: (req as AuthenticatedRequest).adminUser?.uid || 'admin',
      userName: (req as AuthenticatedRequest).adminUser?.name || 'Admin',
      userRole: (req as AuthenticatedRequest).adminUser?.role || 'marketingEditor',
      tenantId: req.params.id,
      category: 'Stories',
      action: 'PURGE_STORIES',
      details: `Purged all stories and fake offers for tenant ${req.params.id}`,
    });

    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9.7 Hero Banners Admin
v1Router.get('/admin/tenants/:id/hero-banners', requireAdminAuth(), async (req: Request, res: Response) => {
  try {
    const banners = await FirestorePlatformService.getTenantHeroBanners(req.params.id);
    res.json(banners);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

v1Router.post('/admin/tenants/:id/hero-banners', requireAdminAuth('marketingEditor'), validateBody(SaveHeroBannerSchema), async (req: Request, res: Response) => {
  try {
    const banner = await FirestorePlatformService.saveTenantHeroBanner(req.params.id, req.body);

    await FirestorePlatformService.addAuditLog(req.params.id, {
      userId: (req as AuthenticatedRequest).adminUser?.uid || 'admin',
      userName: (req as AuthenticatedRequest).adminUser?.name || 'Admin',
      userRole: (req as AuthenticatedRequest).adminUser?.role || 'marketingEditor',
      tenantId: req.params.id,
      category: 'Branding',
      action: 'SAVE_HERO_BANNER',
      details: `Saved hero banner ${banner.id}: "${banner.title}"`,
    });

    res.json(banner);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

v1Router.put('/admin/tenants/:id/hero-banners/reorder', requireAdminAuth('marketingEditor'), validateBody(ReorderHeroBannersSchema), async (req: Request, res: Response) => {
  try {
    const banners = await FirestorePlatformService.saveTenantHeroBannersBatch(req.params.id, req.body.banners);

    await FirestorePlatformService.addAuditLog(req.params.id, {
      userId: (req as AuthenticatedRequest).adminUser?.uid || 'admin',
      userName: (req as AuthenticatedRequest).adminUser?.name || 'Admin',
      userRole: (req as AuthenticatedRequest).adminUser?.role || 'marketingEditor',
      tenantId: req.params.id,
      category: 'Branding',
      action: 'REORDER_HERO_BANNERS',
      details: `Reordered ${banners.length} hero banners for tenant ${req.params.id}`,
    });

    res.json(banners);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

v1Router.delete('/admin/tenants/:id/hero-banners/:bannerId', requireAdminAuth('marketingEditor'), async (req: Request, res: Response) => {
  try {
    const success = await FirestorePlatformService.deleteTenantHeroBanner(req.params.id, req.params.bannerId);

    await FirestorePlatformService.addAuditLog(req.params.id, {
      userId: (req as AuthenticatedRequest).adminUser?.uid || 'admin',
      userName: (req as AuthenticatedRequest).adminUser?.name || 'Admin',
      userRole: (req as AuthenticatedRequest).adminUser?.role || 'marketingEditor',
      tenantId: req.params.id,
      category: 'Branding',
      action: 'DELETE_HERO_BANNER',
      details: `Deleted hero banner ${req.params.bannerId}`,
    });

    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

v1Router.post('/admin/tenants/:id/hero-banners/reset', requireAdminAuth('marketingEditor'), async (req: Request, res: Response) => {
  try {
    const banners = await FirestorePlatformService.resetTenantHeroBanners(req.params.id);

    await FirestorePlatformService.addAuditLog(req.params.id, {
      userId: (req as AuthenticatedRequest).adminUser?.uid || 'admin',
      userName: (req as AuthenticatedRequest).adminUser?.name || 'Admin',
      userRole: (req as AuthenticatedRequest).adminUser?.role || 'marketingEditor',
      tenantId: req.params.id,
      category: 'Branding',
      action: 'RESET_HERO_BANNERS',
      details: `Reset hero banners to defaults for tenant ${req.params.id}`,
    });

    res.json(banners);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9.8 Audit Logs
v1Router.get('/admin/tenants/:id/audit-logs', requireAdminAuth(), async (req: Request, res: Response) => {
  try {
    const logs = await FirestorePlatformService.getAuditLogs(req.params.id);
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Helper to safely format rows as standard CSV with escaping
function serializeToCsv(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const escapeCell = (val: any): string => {
    if (val === null || val === undefined) return '';
    const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = headers.map(escapeCell).join(',');
  const rowLines = rows.map((r) => r.map(escapeCell).join(','));
  return [headerLine, ...rowLines].join('\r\n');
}

// 9.7.0 Data Export Endpoints (CSV / JSON)
v1Router.get('/admin/tenants/:id/export/audit-logs', requireAdminAuth(), async (req: Request, res: Response) => {
  try {
    const tenantId = req.params.id;
    const format = (req.query.format as string)?.toLowerCase() === 'csv' ? 'csv' : 'json';
    const logs = await FirestorePlatformService.getAuditLogs(tenantId);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${tenantId}-audit-logs-${timestamp}`;

    if (format === 'csv') {
      const headers = ['ID', 'Timestamp', 'Tenant ID', 'Actor', 'Action', 'Category', 'Entity Type', 'Entity ID', 'Details'];
      const rows = logs.map((log: any) => [
        log.id || '',
        log.timestamp || '',
        log.tenantId || tenantId,
        log.user?.email || log.actor || '',
        log.action || '',
        log.category || '',
        log.entityType || '',
        log.entityId || '',
        log.details || log.description || '',
      ]);
      const csv = serializeToCsv(headers, rows);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      return res.send(csv);
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
    return res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

v1Router.get('/admin/tenants/:id/export/orders', requireAdminAuth(), async (req: Request, res: Response) => {
  try {
    const tenantId = req.params.id;
    const format = (req.query.format as string)?.toLowerCase() === 'csv' ? 'csv' : 'json';
    const limit = Math.min(1000, parseInt(req.query.limit as string) || 500);
    const orders = await FirestorePlatformService.listOrderProjections(tenantId, limit);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${tenantId}-orders-${timestamp}`;

    if (format === 'csv') {
      const headers = [
        'Order ID',
        'Created At',
        'Tenant ID',
        'Channel Link ID',
        'Status',
        'Payment State',
        'Currency',
        'Total (Minor Units)',
        'Final/Captured (Minor Units)',
        'Fulfillment Type',
        'Item Count',
        'Customer Name',
        'Customer Email',
      ];
      const rows = orders.map((o: any) => [
        o.orderId || '',
        o.createdAt || '',
        o.tenantId || tenantId,
        o.channelLinkId || '',
        o.status || '',
        o.paymentState || '',
        o.currency || o.totalAmount?.currency || 'GBP',
        typeof o.totalAmount === 'object' ? o.totalAmount?.amount : o.totalAmount || 0,
        typeof o.finalAmount === 'object' ? o.finalAmount?.amount : (o.capturedAmount || o.finalAmount || 0),
        o.fulfillmentType || '',
        o.items?.length || o.picking?.items?.length || 0,
        o.customer?.name || '',
        o.customer?.email || '',
      ]);
      const csv = serializeToCsv(headers, rows);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      return res.send(csv);
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
    return res.json(orders);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

v1Router.get('/admin/tenants/:id/export/analytics', requireAdminAuth(), async (req: Request, res: Response) => {
  try {
    const tenantId = req.params.id;
    const format = (req.query.format as string)?.toLowerCase() === 'csv' ? 'csv' : 'json';
    const limit = Math.min(2000, parseInt(req.query.limit as string) || 1000);
    const events = await FirestorePlatformService.getAnalyticsEvents(tenantId, limit);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${tenantId}-analytics-${timestamp}`;

    if (format === 'csv') {
      const headers = [
        'Event ID',
        'Timestamp',
        'Tenant ID',
        'Type',
        'Session ID',
        'Store ID',
        'Product PLU',
        'Category ID',
        'Story ID',
        'Search Term',
        'Coarse Region',
        'Platform',
        'Locale',
      ];
      const rows = events.map((e: any) => [
        e.id || '',
        e.timestamp || '',
        e.tenantId || tenantId,
        e.type || '',
        e.sessionId || '',
        e.storeId || '',
        e.productPlu || '',
        e.categoryId || '',
        e.storyId || '',
        e.searchTerm || '',
        e.coarseRegion || '',
        e.platform || '',
        e.locale || '',
      ]);
      const csv = serializeToCsv(headers, rows);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      return res.send(csv);
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
    return res.json(events);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

v1Router.get('/admin/tenants/:id/export/stores', requireAdminAuth(), async (req: Request, res: Response) => {
  try {
    const tenantId = req.params.id;
    const format = (req.query.format as string)?.toLowerCase() === 'csv' ? 'csv' : 'json';

    let stores: any[] = [];
    try {
      stores = await FirestorePlatformService.getTenantStores(tenantId);
    } catch {
      // ignore
    }
    if (!stores || stores.length === 0) {
      const adapter = await getDeliverectAdapterAsync(tenantId);
      stores = await adapter.getStores();
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${tenantId}-stores-${timestamp}`;

    if (format === 'csv') {
      const headers = [
        'Store ID',
        'Name',
        'Channel Link ID',
        'Status',
        'Street Address',
        'City',
        'Postal Code',
        'Delivery Enabled',
        'Pickup Enabled',
        'Latitude',
        'Longitude',
      ];
      const rows = stores.map((s: any) => [
        s.id || '',
        s.name || '',
        s.channelLinkId || '',
        s.status || '',
        s.address?.street || s.address || '',
        s.address?.city || '',
        s.address?.postalCode || s.address?.postcode || '',
        s.capabilities?.delivery ?? true,
        s.capabilities?.pickup ?? true,
        s.coordinates?.latitude || s.lat || '',
        s.coordinates?.longitude || s.lng || '',
      ]);
      const csv = serializeToCsv(headers, rows);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      return res.send(csv);
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
    return res.json(stores);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9.7.1 Tenant Stores
v1Router.get('/admin/tenants/:id/stores', requireAdminAuth(), async (req: Request, res: Response) => {
  try {
    let stores: any[] = [];
    try {
      stores = await FirestorePlatformService.getTenantStores(req.params.id);
    } catch (fsErr: any) {
      console.warn(`[Admin API] Firestore getTenantStores failed, falling back to Deliverect adapter:`, fsErr.message);
    }

    if (!stores || stores.length === 0) {
      const adapter = await getDeliverectAdapterAsync(req.params.id);
      stores = await adapter.getStores();
    }
    res.json(stores);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

v1Router.put('/admin/tenants/:id/stores/:storeId', requireAdminAuth(), requireAdminCapability('stores.write'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.params.id;
    const storeId = req.params.storeId;
    const updatedData = req.body.store || req.body;

    // Persist first. A failed durable write must not become a successful temporary override.
    await FirestorePlatformService.saveTenantStore(tenantId, { ...updatedData, id: storeId });
    setStoreOverride(storeId, updatedData);

    const adapter = await getDeliverectAdapterAsync(tenantId);
    const store = await adapter.getStore(storeId);
    res.json(store || { id: storeId, ...updatedData });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9.7.2 Visual & Merchandising Rules
v1Router.get('/admin/tenants/:id/rules', requireAdminAuth(), async (req: Request, res: Response) => {
  try {
    const rules = await FirestorePlatformService.getTenantRules(req.params.id);
    res.json(rules);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

v1Router.post('/admin/tenants/:id/rules', requireAdminAuth('marketingEditor'), validateBody(SaveVisualRuleSchema), async (req: Request, res: Response) => {
  try {
    const rule = await FirestorePlatformService.saveTenantRule(req.params.id, req.body);
    await FirestorePlatformService.addAuditLog(req.params.id, {
      userId: (req as AuthenticatedRequest).adminUser?.uid || 'admin',
      userName: (req as AuthenticatedRequest).adminUser?.name || 'Admin',
      userRole: (req as AuthenticatedRequest).adminUser?.role || 'marketingEditor',
      tenantId: req.params.id,
      category: 'Compliance',
      action: 'SAVE_RULE',
      details: `Saved merchandising/visual rule: ${rule.id || req.body?.name || ''}`,
    });
    res.status(201).json(rule);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

v1Router.put('/admin/tenants/:id/rules/:ruleId', requireAdminAuth('marketingEditor'), validateBody(SaveVisualRuleSchema), async (req: Request, res: Response) => {
  try {
    if (req.body.id !== req.params.ruleId) {
      return res.status(400).json({ error: 'Rule ID in the payload must match the rule being edited.' });
    }
    const existingRules = await FirestorePlatformService.getTenantRules(req.params.id);
    if (!existingRules.some((rule: any) => rule?.id === req.params.ruleId)) {
      return res.status(404).json({ error: 'Rule not found.' });
    }
    const rule = await FirestorePlatformService.saveTenantRule(req.params.id, req.body);
    await FirestorePlatformService.addAuditLog(req.params.id, {
      userId: (req as AuthenticatedRequest).adminUser?.uid || 'admin',
      userName: (req as AuthenticatedRequest).adminUser?.name || 'Admin',
      userRole: (req as AuthenticatedRequest).adminUser?.role || 'marketingEditor',
      tenantId: req.params.id,
      category: 'Compliance',
      action: 'UPDATE_RULE',
      details: `Updated merchandising/visual rule: ${rule.id}`,
    });
    res.json(rule);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

v1Router.delete('/admin/tenants/:id/rules/:ruleId', requireAdminAuth('marketingEditor'), async (req: Request, res: Response) => {
  try {
    const success = await FirestorePlatformService.deleteTenantRule(req.params.id, req.params.ruleId);
    await FirestorePlatformService.addAuditLog(req.params.id, {
      userId: (req as AuthenticatedRequest).adminUser?.uid || 'admin',
      userName: (req as AuthenticatedRequest).adminUser?.name || 'Admin',
      userRole: (req as AuthenticatedRequest).adminUser?.role || 'marketingEditor',
      tenantId: req.params.id,
      category: 'Compliance',
      action: 'DELETE_RULE',
      details: `Deleted rule: ${req.params.ruleId}`,
    });
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9.7.3 Search Merchandising & Synonyms
v1Router.get('/admin/tenants/:id/search-config', requireAdminAuth(), async (req: Request, res: Response) => {
  try {
    const config = await FirestorePlatformService.getTenantSearchConfig(req.params.id);
    res.json(config);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

v1Router.put('/admin/tenants/:id/search-config', requireAdminAuth('marketingEditor'), async (req: Request, res: Response) => {
  try {
    const updated = await FirestorePlatformService.saveTenantSearchConfig(req.params.id, req.body);
    await FirestorePlatformService.addAuditLog(req.params.id, {
      userId: (req as AuthenticatedRequest).adminUser?.uid || 'admin',
      userName: (req as AuthenticatedRequest).adminUser?.name || 'Admin',
      userRole: (req as AuthenticatedRequest).adminUser?.role || 'marketingEditor',
      tenantId: req.params.id,
      category: 'Compliance',
      action: 'UPDATE_SEARCH_CONFIG',
      details: 'Updated search merchandising and synonym configuration',
    });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9.7.4 Tenant Dispatch Rules (Orchestration & Timing)
v1Router.get('/admin/tenants/:id/dispatch-rules', requireAdminAuth(), async (req: Request, res: Response) => {
  try {
    const rules = await FirestorePlatformService.getTenantDispatchRules(req.params.id);
    res.json(rules);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

v1Router.post(
  '/admin/tenants/:id/dispatch-rules',
  requireAdminAuth('tenantAdmin'),
  validateBody(UpdateTenantDispatchRulesSchema),
  async (req: Request, res: Response) => {
    try {
      const updated = await FirestorePlatformService.saveTenantDispatchRules(req.params.id, req.body);
      await FirestorePlatformService.addAuditLog(req.params.id, {
        userId: (req as AuthenticatedRequest).adminUser?.uid || 'admin',
        userName: (req as AuthenticatedRequest).adminUser?.name || 'Admin',
        userRole: (req as AuthenticatedRequest).adminUser?.role || 'tenantAdmin',
        tenantId: req.params.id,
        category: 'Compliance',
        action: 'UPDATE_DISPATCH_RULES',
        details: `Updated dispatch orchestration rules: assignmentEvent=${updated.assignmentEvent}, dynamicTiming=${updated.dynamicTiming}`,
      });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// 9.8 Integrations & Deliverect Channel Mapping
v1Router.get('/admin/integrations/:id', requireAdminAuth('tenantAdmin'), async (req: Request, res: Response) => {
  try {
    const config = await FirestorePlatformService.getIntegrationConfig(req.params.id);
    res.json(config);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

v1Router.patch('/admin/integrations/:id', requireAdminAuth('tenantAdmin'), validateBody(UpdateIntegrationSchema), async (req: Request, res: Response) => {
  try {
    const updated = await FirestorePlatformService.updateIntegrationConfig(req.params.id, req.body);

    await FirestorePlatformService.addAuditLog(req.params.id, {
      userId: (req as AuthenticatedRequest).adminUser?.uid || 'admin',
      userName: (req as AuthenticatedRequest).adminUser?.name || 'Admin',
      userRole: (req as AuthenticatedRequest).adminUser?.role || 'tenantAdmin',
      tenantId: req.params.id,
      category: 'Integration',
      action: 'UPDATE_INTEGRATION',
      details: `Updated integration config: ${Object.keys(req.body).join(', ')}`,
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9.9 Real AssetService: Uploads for Logos, Favicons, Fonts & Stories
v1Router.post('/admin/assets/upload', requireAdminAuth(), requireAdminCapability('assets.write'), validateBody(AssetUploadSchema), async (req: Request, res: Response) => {
  try {
    if (!isDemoMode() && process.env.NODE_ENV !== 'test') {
      return res.status(403).json({
        error: 'Direct base64 asset upload is restricted to demo/test mode. Use signed URL upload (/admin/assets/upload-url) for staging and production.',
        code: 'DIRECT_UPLOAD_NOT_PERMITTED',
      });
    }

    const authAdmin = (req as AuthenticatedRequest).adminUser!;
    let { tenantId, type, fileName, fileData, contentType, byteSize, width, height } = req.body;

    // RBAC: Non-superadmin cannot upload into other tenant boundaries
    if (authAdmin.role !== 'platformSuperAdmin') {
      tenantId = authAdmin.tenantId; // Authoritative assignment from verified session
    } else if (!tenantId) {
      tenantId = authAdmin.tenantId || 'brand-alpha';
    }

    const assetType = normalizeAssetType(type);

    const savedAsset = await AssetService.saveAsset({
      tenantId,
      type: assetType,
      fileName,
      fileData,
      contentType: contentType || 'application/octet-stream',
      byteSize,
      width,
      height,
    });

    await FirestorePlatformService.addAuditLog(tenantId, {
      userId: authAdmin.uid,
      userName: authAdmin.name,
      userRole: authAdmin.role,
      tenantId,
      category: 'Assets',
      action: 'UPLOAD_ASSET',
      details: `Uploaded asset: ${fileName} (${assetType}, ${savedAsset.id})`,
    });

    res.json({
      success: true,
      asset: savedAsset,
    });
  } catch (err: any) {
    const statusCode = err.statusCode || (err.name === 'BFFError' ? 400 : 500);
    res.status(statusCode).json({ error: err.message, code: err.code || 'ASSET_ERROR' });
  }
});

v1Router.post('/admin/assets/upload-url', requireAdminAuth(), requireAdminCapability('assets.write'), validateBody(AssetUploadUrlSchema), async (req: Request, res: Response) => {
  try {
    const authAdmin = (req as AuthenticatedRequest).adminUser!;
    let { tenantId, type, fileName, contentType, byteSize } = req.body;

    if (authAdmin.role !== 'platformSuperAdmin') {
      tenantId = authAdmin.tenantId;
    } else if (!tenantId) {
      tenantId = authAdmin.tenantId || 'brand-alpha';
    }

    const assetType = normalizeAssetType(type);

    const result = await AssetService.createUploadUrl({
      tenantId,
      type: assetType,
      fileName,
      contentType: contentType || 'application/octet-stream',
      byteSize,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    const statusCode = err.statusCode || (err.name === 'BFFError' ? 400 : 500);
    res.status(statusCode).json({ error: err.message, code: err.code || 'ASSET_ERROR' });
  }
});

v1Router.put('/admin/assets/direct-upload/:assetId', requireAdminAuth(), requireAdminCapability('assets.write'), express.raw({ type: '*/*', limit: '100mb' }), async (req: Request, res: Response) => {
  try {
    const { assetId } = req.params;
    const contentType = (req.headers['content-type'] as string) || 'application/octet-stream';
    const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
    await AssetService.saveDirectBinary(assetId, buffer, contentType);
    res.status(200).json({ success: true });
  } catch (err: any) {
    const statusCode = err.statusCode || (err.name === 'BFFError' ? 400 : 500);
    res.status(statusCode).json({ error: err.message, code: err.code || 'ASSET_ERROR' });
  }
});

v1Router.post('/admin/assets/finalize', requireAdminAuth(), requireAdminCapability('assets.write'), validateBody(AssetFinalizeSchema), async (req: Request, res: Response) => {
  try {
    const authAdmin = (req as AuthenticatedRequest).adminUser!;
    let { tenantId, assetId } = req.body;

    if (authAdmin.role !== 'platformSuperAdmin') {
      tenantId = authAdmin.tenantId;
    } else if (!tenantId) {
      tenantId = authAdmin.tenantId || 'brand-alpha';
    }

    const finalized = await AssetService.finalizeAsset(tenantId, assetId);

    await FirestorePlatformService.addAuditLog(tenantId, {
      userId: authAdmin.uid,
      userName: authAdmin.name,
      userRole: authAdmin.role,
      tenantId,
      category: 'Assets',
      action: 'FINALIZE_ASSET',
      details: `Finalized asset: ${assetId}`,
    });

    res.json({
      success: true,
      asset: finalized,
    });
  } catch (err: any) {
    const statusCode = err.statusCode || (err.name === 'BFFError' ? 400 : 500);
    res.status(statusCode).json({ error: err.message, code: err.code || 'ASSET_ERROR' });
  }
});

v1Router.post(
  '/admin/brand-profile/analyse',
  requireAdminAuth(),
  requireAdminCapability('branding.write'),
  validateBody(BrandProfileAnalyseSchema),
  async (req: Request, res: Response) => {
    try {
      const authAdmin = (req as AuthenticatedRequest).adminUser!;
      let { tenantId, assetId } = req.body;

      if (authAdmin.role !== 'platformSuperAdmin') {
        tenantId = authAdmin.tenantId;
      } else if (!tenantId) {
        tenantId = authAdmin.tenantId || 'brand-alpha';
      }

      const analysis = await BrandProfileService.analyse(tenantId, assetId);

      await FirestorePlatformService.addAuditLog(tenantId, {
        userId: authAdmin.uid,
        userName: authAdmin.name,
        userRole: authAdmin.role,
        tenantId,
        category: 'Branding',
        action: 'ANALYSE_BRAND_PROFILE',
        details: `Analysed brand material: ${analysis.assetName} (${analysis.analysisMode})`,
      });

      res.json({ success: true, analysis });
    } catch (err: any) {
      const statusCode = err.statusCode || err.status || 500;
      res.status(statusCode).json({
        error: err.message || 'Brand profile analysis failed.',
        code: err.code || 'BRAND_PROFILE_ANALYSIS_FAILED',
      });
    }
  }
);

v1Router.get('/admin/assets/:tenantId', requireAdminAuth(), async (req: Request, res: Response) => {
  try {
    const type = req.query.type as AssetType | undefined;
    const assets = await AssetService.listAssets(req.params.tenantId, type);
    res.json(assets);
  } catch (err: any) {
    const statusCode = err.statusCode || (err.name === 'BFFError' ? 400 : 500);
    res.status(statusCode).json({ error: err.message, code: err.code || 'ASSET_ERROR' });
  }
});

v1Router.get('/assets/:tenantId/:assetId', async (req: Request, res: Response) => {
  try {
    const { tenantId, assetId } = req.params;
    const asset = await AssetService.getAsset(assetId);
    if (!asset || asset.tenantId !== tenantId || asset.status !== 'READY') {
      return res.status(404).json({ error: 'Asset not found or not ready', code: 'ASSET_NOT_FOUND' });
    }
    if (asset.publicUrl) {
      return res.redirect(302, asset.publicUrl);
    }
    const storage = getFirebaseStorage();
    if (storage && asset.storagePath) {
      const file = storage.bucket().file(asset.storagePath);
      res.setHeader('Content-Type', asset.contentType || 'application/octet-stream');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return file.createReadStream().pipe(res);
    }
    res.status(404).json({ error: 'Asset file not available', code: 'ASSET_NOT_FOUND' });
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to retrieve asset');
  }
});

v1Router.delete('/admin/assets/:tenantId/:assetId', requireAdminAuth(), requireAdminCapability('assets.write'), async (req: Request, res: Response) => {
  try {
    const authAdmin = (req as AuthenticatedRequest).adminUser!;
    let tenantId = req.params.tenantId;

    if (authAdmin.role !== 'platformSuperAdmin' && authAdmin.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Forbidden: You cannot delete assets for another tenant.', code: 'FORBIDDEN' });
    }

    const success = await AssetService.deleteAsset(tenantId, req.params.assetId);

    await FirestorePlatformService.addAuditLog(tenantId, {
      userId: authAdmin.uid,
      userName: authAdmin.name,
      userRole: authAdmin.role,
      tenantId,
      category: 'Assets',
      action: 'DELETE_ASSET',
      details: `Deleted asset: ${req.params.assetId}`,
    });

    res.json({ success });
  } catch (err: any) {
    const statusCode = err.statusCode || (err.name === 'BFFError' ? 400 : 500);
    res.status(statusCode).json({ error: err.message, code: err.code || 'ASSET_ERROR' });
  }
});

// 9.9.1 Media Health Audit API
v1Router.get('/admin/tenants/:id/media-health', requireAdminAuth(), async (req: Request, res: Response) => {
  try {
    const authAdmin = (req as AuthenticatedRequest).adminUser!;
    const tenantId = req.params.id;

    if (authAdmin.role !== 'platformSuperAdmin' && authAdmin.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Forbidden: Cannot inspect media health for another tenant.', code: 'FORBIDDEN' });
    }

    const recheck = req.query.recheck === 'true';
    const health = await MediaHealthService.scanTenantMediaHealth(tenantId, recheck);
    res.json(health);
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to inspect media health');
  }
});

v1Router.post('/admin/tenants/:id/media-health/check', requireAdminAuth(), requireAdminCapability('catalog.diagnostics'), async (req: Request, res: Response) => {
  try {
    const authAdmin = (req as AuthenticatedRequest).adminUser!;
    const tenantId = req.params.id;

    if (authAdmin.role !== 'platformSuperAdmin' && authAdmin.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Forbidden: Cannot inspect media health for another tenant.', code: 'FORBIDDEN' });
    }

    const health = await MediaHealthService.scanTenantMediaHealth(tenantId, true);
    res.json(health);
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to probe media health');
  }
});

// 9.10 Google Fonts Catalogue API
v1Router.get('/cms/pages', async (req: Request, res: Response) => {
  try {
    res.json({ pages: await CmsService.list(resolveTenant(req), true) });
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to load CMS pages');
  }
});
v1Router.get('/admin/tenants/:id/pages', requireAdminAuth(), requireAdminCapability('content.read'), async (req: Request, res: Response) => {
  try {
    const admin = (req as AuthenticatedRequest).adminUser;
    if (admin?.role !== 'platformSuperAdmin' && admin?.tenantId !== req.params.id) return res.status(403).json({ error: 'Tenant access denied' });
    res.json({ pages: await CmsService.list(req.params.id) });
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to load CMS pages');
  }
});
v1Router.put('/admin/tenants/:id/pages/:pageId', requireAdminAuth(), requireAdminCapability('content.write'), async (req: Request, res: Response) => {
  try {
    const admin = (req as AuthenticatedRequest).adminUser;
    if (admin?.role !== 'platformSuperAdmin' && admin?.tenantId !== req.params.id) return res.status(403).json({ error: 'Tenant access denied' });
    if (!req.body || req.body.id !== req.params.pageId) return res.status(400).json({ error: 'Page identity mismatch' });
    res.json(await CmsService.save(req.params.id, req.body));
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to save CMS page');
  }
});
v1Router.delete('/admin/tenants/:id/pages/:pageId', requireAdminAuth(), requireAdminCapability('content.write'), async (req: Request, res: Response) => {
  try {
    const admin = (req as AuthenticatedRequest).adminUser;
    if (admin?.role !== 'platformSuperAdmin' && admin?.tenantId !== req.params.id) return res.status(403).json({ error: 'Tenant access denied' });
    const deleted = await CmsService.delete(req.params.id, req.params.pageId);
    res.status(deleted ? 200 : 404).json({ success: deleted });
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to delete CMS page');
  }
});

let googleFontsCache: { expiresAt: number; fonts: any[] } | null = null;
v1Router.get('/admin/fonts/catalog', async (_req: Request, res: Response) => {
  const apiKey = process.env.GOOGLE_FONTS_API_KEY;
  if (googleFontsCache && googleFontsCache.expiresAt > Date.now()) {
    return res.json({ fonts: googleFontsCache.fonts, count: googleFontsCache.fonts.length, source: 'google-cache' });
  }
  if (apiKey) {
    try {
      const response = await fetch(`https://www.googleapis.com/webfonts/v1/webfonts?sort=alpha&capability=WOFF2&key=${encodeURIComponent(apiKey)}`);
      if (!response.ok) throw new Error(`Google Fonts returned HTTP ${response.status}`);
      const payload = await response.json() as { items?: any[] };
      const fonts = (payload.items || []).map((font) => ({
        family: font.family,
        category: font.category,
        weights: (font.variants || []).map((v: string) => v === 'regular' ? '400' : v.replace('italic', '')).filter((v: string) => /^\d+$/.test(v)),
        popularPairing: '',
        previewText: 'The quick brown fox jumps over the lazy dog',
        recommendedFor: 'both',
      }));
      googleFontsCache = { fonts, expiresAt: Date.now() + 24 * 60 * 60 * 1000 };
      return res.json({ fonts, count: fonts.length, source: 'google-fonts-api' });
    } catch (error) {
      console.warn('[Google Fonts] Live catalogue unavailable; using curated fallback.', error);
    }
  }
  try {
    const response = await fetch('https://fonts.google.com/metadata/fonts');
    if (!response.ok) throw new Error(`Google Fonts metadata returned HTTP ${response.status}`);
    const raw = await response.text();
    const payload = JSON.parse(raw.replace(/^\)\]\}'\s*/, '')) as { familyMetadataList?: any[] };
    const fonts = (payload.familyMetadataList || []).map((font) => ({
      family: font.family,
      category: String(font.category || 'sans-serif').toLowerCase().replace('_', '-'),
      weights: Object.keys(font.fonts || {}).map((key) => key.split('i')[0]).filter((v) => /^\d+$/.test(v)),
      popularPairing: '', previewText: 'The quick brown fox jumps over the lazy dog', recommendedFor: 'both',
    }));
    if (fonts.length) {
      googleFontsCache = { fonts, expiresAt: Date.now() + 24 * 60 * 60 * 1000 };
      return res.json({ fonts, count: fonts.length, source: 'google-fonts-metadata' });
    }
  } catch (error) {
    console.warn('[Google Fonts] Metadata catalogue unavailable; using curated fallback.', error);
  }
  return res.json({ fonts: GOOGLE_FONTS_CATALOG, count: GOOGLE_FONTS_CATALOG.length, source: 'curated-fallback', requiresApiKey: !apiKey });
});

// 9.11 Health & Diagnostics Handshake
v1Router.get('/admin/health', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const db = getFirestoreDb();
  let firestoreWorking = false;

  try {
    if (db) {
      await FirestorePlatformService.getTenantConfig('brand-alpha');
      firestoreWorking = true;
    }
  } catch (e) {
    console.warn('[Admin Health] Firestore check failed:', e);
  }

  const tenantId = resolveTenant(req);
  const adapter = await getDeliverectAdapterAsync(tenantId);
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    latencyMs: Date.now() - startTime,
    appMode: getServerRuntimeMode(),
    firestore: {
      connected: firestoreWorking,
      mode: db ? 'Live Cloud Firestore' : 'Memory Simulator',
    },
    deliverect: {
      adapter: adapter.adapterName,
      hasCredentials: Boolean(process.env.DELIVERECT_CLIENT_ID),
      env: process.env.DELIVERECT_ENV || 'staging',
    },
  });
});

v1Router.post('/admin/test-oauth', requireAdminAuth(), requireAdminCapability('integrations.diagnostics'), async (req: Request, res: Response) => {
  const authAdmin = (req as AuthenticatedRequest).adminUser!;
  const { environment, tenantId: requestedTenantId, clientId, clientSecret } = req.body || {};

  const targetTenantId =
    authAdmin.role === 'platformSuperAdmin'
      ? requestedTenantId || authAdmin.tenantId || 'brand-alpha'
      : authAdmin.tenantId;

  console.log(`[Deliverect OAuth] POST /admin/test-oauth received for tenant "${targetTenantId}" (env: ${environment || 'staging'}) from admin ${authAdmin.email}`);

  const result = await ConnectionDiagnostics.testOAuthOnly(targetTenantId, {
    environment,
    clientId,
    clientSecret,
    actor: { uid: authAdmin.uid, name: authAdmin.name, role: authAdmin.role },
  });

  console.log(`[Deliverect OAuth] /admin/test-oauth completed for "${targetTenantId}": status=${result.status}, success=${result.success}, latency=${result.latencyMs}ms`);
  res.status(result.success ? 200 : (result.status === 'UNCONFIGURED' ? 400 : 401)).json(result);
});

/**
 * Platform-scoped Partner Deliverect OAuth Diagnostic (Section 6, 42)
 * Tests only the documented Commerce staging OAuth contract:
 * https://api.staging.deliverect.com/oauth/token with audience https://api.staging.deliverect.com
 * Protected by platformSuperAdmin.
 * Does NOT mark any tenant as connected.
 * Redacts all credentials and secrets.
 */
v1Router.post(
  '/admin/platform/integrations/deliverect/test-oauth',
  requirePlatformSuperAdmin(),
  async (req: Request, res: Response) => {
    const authAdmin = (req as AuthenticatedRequest).adminUser!;
    const { environment, clientId, clientSecret } = req.body || {};

    console.log(
      `[Platform OAuth] POST /admin/platform/integrations/deliverect/test-oauth received (env: ${environment || 'staging'}) from platform superadmin ${authAdmin.email}`
    );

    const result = await ConnectionDiagnostics.testPlatformOAuth({
      environment,
      clientId,
      clientSecret,
      actor: { uid: authAdmin.uid, name: authAdmin.name, role: authAdmin.role },
    });

    console.log(
      `[Platform OAuth] Test completed: status=${result.status}, success=${result.success}, latency=${result.latencyMs}ms, httpStatus=${result.httpStatus || 200}`
    );

    const statusCode = result.success ? 200 : (result.httpStatus || (result.status === 'UNCONFIGURED' ? 400 : 401));
    res.status(statusCode).json(result);
  }
);

v1Router.post('/admin/tenants/:id/integration/test-oauth', requireAdminAuth(), requireAdminCapability('integrations.diagnostics'), async (req: Request, res: Response) => {
  const authAdmin = (req as AuthenticatedRequest).adminUser!;
  const tenantId = req.params.id;
  const { environment, clientId, clientSecret } = req.body || {};

  console.log(`[Deliverect OAuth] POST /admin/tenants/${tenantId}/integration/test-oauth received (env: ${environment || 'staging'}) from admin ${authAdmin.email}`);

  const result = await ConnectionDiagnostics.testOAuthOnly(tenantId, {
    environment,
    clientId,
    clientSecret,
    actor: { uid: authAdmin.uid, name: authAdmin.name, role: authAdmin.role },
  });

  console.log(`[Deliverect OAuth] Test OAuth completed for "${tenantId}": status=${result.status}, success=${result.success}, latency=${result.latencyMs}ms`);
  res.status(result.success ? 200 : (result.status === 'UNCONFIGURED' ? 400 : 401)).json(result);
});

v1Router.post('/admin/test-connection', requireAdminAuth(), requireAdminCapability('integrations.diagnostics'), validateBody(TestConnectionSchema), async (req: Request, res: Response) => {
  const authAdmin = (req as AuthenticatedRequest).adminUser!;
  const { deliverectAccountId, environment, tenantId: requestedTenantId, clientId, clientSecret, channelLinkId, testType, oauthOnly } = req.body;

  // Multi-tenant resolution: respect verified admin user's tenant boundary unless platformSuperAdmin
  const targetTenantId =
    authAdmin.role === 'platformSuperAdmin'
      ? requestedTenantId || authAdmin.tenantId || 'brand-alpha'
      : authAdmin.tenantId;

  // If explicitly requested testType === 'oauth' or oauthOnly === true:
  if (testType === 'oauth' || oauthOnly === true) {
    const oauthResult = await ConnectionDiagnostics.testOAuthOnly(targetTenantId, {
      environment,
      clientId,
      clientSecret,
      actor: { uid: authAdmin.uid, name: authAdmin.name, role: authAdmin.role },
    });
    return res.status(oauthResult.success ? 200 : 400).json(oauthResult);
  }

  const db = getFirestoreDb();
  let firestoreWorking = false;
  try {
    await FirestorePlatformService.getTenantConfig(targetTenantId);
    firestoreWorking = true;
  } catch (err) {
    console.warn(`[Admin] Firestore roundtrip check failed for tenant ${targetTenantId}:`, err);
  }

  // Run authentic 5-step ConnectionDiagnostics
  const diagnostic = await ConnectionDiagnostics.runDiagnostic(targetTenantId, {
    environment,
    clientId,
    clientSecret,
    deliverectAccountId,
    channelLinkId,
    actor: { uid: authAdmin.uid, name: authAdmin.name, role: authAdmin.role },
  });

  const adapter = await getDeliverectAdapterAsync(targetTenantId);

  res.status(diagnostic.success ? 200 : 400).json({
    success: diagnostic.success,
    status: diagnostic.status,
    connectionState: diagnostic.connectionState,
    message: diagnostic.message,
    latencyMs: diagnostic.latencyMs,
    environment: diagnostic.environment,
    accountsCount: diagnostic.accountsCount,
    locationsCount: diagnostic.locationsCount,
    storesCount: diagnostic.storesCount,
    firestore: {
      connected: firestoreWorking,
      database: db ? 'Active Cloud Firestore' : 'Local Fallback',
    },
    deliverect: {
      adapter: adapter.adapterName,
      status: diagnostic.status,
      environment: diagnostic.environment,
    },
  });
});

/**
 * Tenant-scoped Connection Test Endpoint
 */
v1Router.post('/admin/tenants/:id/integration/test', requireAdminAuth(), requireAdminCapability('integrations.diagnostics'), async (req: Request, res: Response) => {
  const authAdmin = (req as AuthenticatedRequest).adminUser!;
  const tenantId = req.params.id;

  const diagnostic = await ConnectionDiagnostics.runDiagnostic(tenantId, {
    actor: { uid: authAdmin.uid, name: authAdmin.name, role: authAdmin.role },
  });

  res.status(diagnostic.success ? 200 : 400).json(diagnostic);
});

/**
 * Get Tenant Deliverect Integration Details
 */
v1Router.get('/admin/tenants/:id/integration', requireAdminAuth(), async (req: Request, res: Response) => {
  try {
    const tenantId = req.params.id;
    const integration = await FirestorePlatformService.getTenantIntegration(tenantId);
    const clientId = (await SecretManager.getSecret(`DELIVERECT_CLIENT_ID_${tenantId}`)) || process.env.DELIVERECT_CLIENT_ID || '';
    const hasSecret = Boolean(
      (await SecretManager.getSecret(`DELIVERECT_CLIENT_SECRET_${tenantId}`)) || process.env.DELIVERECT_CLIENT_SECRET
    );

    res.json({
      integration,
      credentials: {
        configured: Boolean(clientId && hasSecret),
        maskedClientId: clientId ? `${clientId.slice(0, 4)}...${clientId.slice(-4)}` : null,
        hasClientSecret: hasSecret,
        environment: integration.environment || 'staging',
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Save Tenant Integration Credentials (stored server-side only in SecretManager)
 */
v1Router.post(
  '/admin/tenants/:id/integration/credentials',
  requireAdminAuth('tenantAdmin'),
  validateBody(UpdateIntegrationCredentialsSchema),
  async (req: Request, res: Response) => {
    const authAdmin = (req as AuthenticatedRequest).adminUser!;
    const tenantId = req.params.id;
    const { clientId, clientSecret, environment, deliverectAccountId, channelLinkId } = req.body;

    // Securely persist credentials in server-side SecretManager
    const savedId = await SecretManager.setSecret(`DELIVERECT_CLIENT_ID_${tenantId}`, clientId, true);
    const savedSecret = await SecretManager.setSecret(`DELIVERECT_CLIENT_SECRET_${tenantId}`, clientSecret, true);
    if ((!savedId || !savedSecret) && isLiveMode()) {
      return res.status(500).json({
        error: 'Failed to persist credentials in Google Cloud Secret Manager.',
        code: 'SECRET_PERSISTENCE_FAILED',
      });
    }

    // Update integration metadata in Firestore/memory without fabricating prefixes
    await FirestorePlatformService.updateIntegrationConfig(tenantId, {
      environment: environment || 'staging',
      deliverectAccountId: deliverectAccountId || undefined,
      channelLinkId: channelLinkId || undefined,
      status: 'standalone',
      lastSyncAt: new Date().toISOString(),
    });

    await FirestorePlatformService.addAuditLog(tenantId, {
      userId: authAdmin.uid,
      userName: authAdmin.name,
      userRole: authAdmin.role,
      tenantId,
      category: 'Integration',
      action: 'UPDATE_INTEGRATION_CREDENTIALS',
      details: `Updated Deliverect OAuth client credentials for environment ${environment || 'staging'} (Client ID: ${clientId.slice(0, 4)}...).`,
    });

    res.json({
      success: true,
      message: `Credentials updated for tenant ${tenantId}. Run connection test to verify.`,
    });
  }
);

/**
 * Get Linked Accounts, Physical Locations, and Commerce Stores
 */
v1Router.get('/admin/tenants/:id/integration/accounts', requireAdminAuth(), async (req: Request, res: Response) => {
  try {
    const tenantId = req.params.id;
    const adapter = new LinkedAccountsAdapter();
    const mappings = await adapter.getTenantMappings(tenantId);
    res.json(mappings);
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to retrieve linked accounts');
  }
});

/**
 * Force Upstream Sync of Linked Accounts, Locations, and Channel Links
 */
v1Router.post('/admin/tenants/:id/integration/sync', requireAdminAuth('tenantAdmin'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.params.id;
    const adapter = new LinkedAccountsAdapter();
    const syncResult = await adapter.fetchFromUpstream(tenantId, `int_${tenantId}`);

    if (syncResult.status === 'NO_ACCOUNTS_FOUND' || syncResult.accounts.length === 0) {
      res.json({
        success: true,
        status: 'NO_ACCOUNTS_FOUND',
        accountsDiscovered: false,
        message: 'No linked accounts were returned by Deliverect.',
        ...syncResult,
      });
      return;
    }

    if (syncResult.persistenceStatus === 'FAILED' || syncResult.status === 'DISCOVERY_SUCCEEDED_PERSISTENCE_FAILED') {
      res.status(207).json({
        success: true,
        accountsDiscovered: true,
        status: 'DISCOVERY_SUCCEEDED_PERSISTENCE_FAILED',
        code: 'DISCOVERY_SUCCEEDED_PERSISTENCE_FAILED',
        error: 'Deliverect accounts discovered successfully, but Firestore persistence failed due to missing IAM permissions (roles/datastore.user).',
        message: 'Deliverect discovery succeeded, but database persistence failed (PERMISSION_DENIED). Discovered accounts are held in memory cache.',
        ...syncResult,
      });
      return;
    }

    res.json({
      success: true,
      accountsDiscovered: true,
      status: 'SUCCESS',
      ...syncResult,
    });
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to synchronize linked accounts from Deliverect');
  }
});

/**
 * Select a discovered Deliverect Account to map to this tenant
 */
v1Router.post('/admin/tenants/:id/integration/select-account', requireAdminAuth('platformSuperAdmin'), async (req: Request, res: Response) => {
  try {
    const authAdmin = (req as AuthenticatedRequest).adminUser!;
    const tenantId = req.params.id;
    const { accountId, channelLinkIds } = req.body;
    if (!accountId) {
      return res.status(400).json({ error: 'accountId is required', code: 'INVALID_REQUEST' });
    }
    if (channelLinkIds !== undefined && !Array.isArray(channelLinkIds)) {
      return res.status(400).json({ error: 'channelLinkIds must be an array', code: 'INVALID_REQUEST' });
    }

    const adapter = new LinkedAccountsAdapter();
    let mappings: any = null;
    try {
      mappings = await adapter.getTenantMappings(tenantId);
    } catch (mappingErr: any) {
      console.warn(`[Select Account] Live tenant mappings unavailable for ${tenantId}:`, mappingErr?.message || mappingErr);
      if (!isDemoMode()) {
        return res.status(503).json({
          error: `Live Deliverect account discovery failed: ${mappingErr?.message || 'Upstream unavailable'}`,
          code: 'DELIVERECT_DISCOVERY_FAILED',
        });
      }
    }

    if (!mappings || !Array.isArray(mappings.accounts) || (mappings.accounts.length === 0 && !isDemoMode())) {
      if (!isDemoMode()) {
        return res.status(503).json({
          error: 'No live Deliverect accounts were discovered for this tenant. Cannot map account.',
          code: 'DELIVERECT_DISCOVERY_FAILED',
        });
      }
    }

    const discoveredAccounts = mappings?.accounts || [];
    const accountExists = discoveredAccounts.some((a: any) =>
      a.deliverectAccountId === accountId ||
      a.accountLinkId === accountId ||
      a.accountLinkId === `acclink_${accountId}`
    );

    if (!accountExists && !isDemoMode()) {
      return res.status(400).json({
        error: `Deliverect account "${accountId}" was not found in discovered accounts for tenant "${tenantId}".`,
        code: 'UNKNOWN_DELIVERECT_ACCOUNT',
      });
    }

    const matchingStores = (mappings?.stores || []).filter((s: any) => s.accountLinkId === `acclink_${accountId}` || s.accountLinkId === accountId);
    const availableChannelLinkIds = new Set(matchingStores.map((s: any) => String(s.channelLinkId)));
    // Store assignment is explicit. Missing or empty input never expands a tenant to every store.
    const requestedChannelLinkIds: string[] = channelLinkIds === undefined
      ? []
      : [...new Set((channelLinkIds as any[]).map(id => String(id)))];
    
    // Every requested channelLinkId must belong to the selected account
    const invalidChannelLinkIds = requestedChannelLinkIds.filter((id: string) => !availableChannelLinkIds.has(id));
    if (invalidChannelLinkIds.length > 0) {
      return res.status(400).json({
        error: 'One or more channel links do not belong to the selected Deliverect account.',
        code: 'INVALID_CHANNEL_ASSIGNMENT',
        invalidChannelLinkIds,
      });
    }

    const newStatus = requestedChannelLinkIds.length > 0 ? 'COMMERCE_VERIFIED' : 'ACCOUNT_MAPPED';

    await FirestorePlatformService.updateIntegrationConfig(tenantId, {
      deliverectAccountId: accountId,
      allowedChannelLinkIds: requestedChannelLinkIds,
      status: newStatus as any,
      lastSyncAt: new Date().toISOString(),
    });
    IntegrationContext.invalidate(tenantId);

    await FirestorePlatformService.addAuditLog(tenantId, {
      userId: authAdmin.uid,
      userName: authAdmin.name,
      userRole: authAdmin.role,
      tenantId,
      category: 'Integration',
      action: 'SELECT_DELIVERECT_ACCOUNT',
      details: `Selected Deliverect Account "${accountId}" with ${requestedChannelLinkIds.length} channel link(s). Status transitioned to ${newStatus}.`,
    });

    res.json({
      success: true,
      tenantId,
      deliverectAccountId: accountId,
      allowedChannelLinkIds: requestedChannelLinkIds,
      status: newStatus,
      storesCount: requestedChannelLinkIds.length,
      assignedStores: matchingStores
        .filter(store => requestedChannelLinkIds.includes(String(store.channelLinkId)))
        .map(store => ({
          channelLinkId: store.channelLinkId,
          name: store.name,
          physicalLocationId: store.physicalLocationId,
        })),
    });
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to select Deliverect account');
  }
});

/**
 * Place a test pickup order using the isolated Deliverect Commerce Basket API
 */
v1Router.post('/admin/tenants/:id/integration/test-order', requireAdminAuth('platformSuperAdmin'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.params.id;
    const {
      channelLinkId,
      menuId,
      plu,
      quantity,
      items,
      customer,
      pickupNotes,
      orderNote,
      performCheckout,
    } = req.body;

    const integration = await FirestorePlatformService.getIntegrationConfig(tenantId);
    const deliverectAccountId = integration?.deliverectAccountId;
    if (!deliverectAccountId) {
      return res.status(400).json({
        error: 'Tenant does not have a mapped Deliverect Account ID. Please select or map an account in Step 3 first.',
        code: 'ACCOUNT_REQUIRED',
      });
    }

    const environment = integration?.environment || 'staging';
    const tokenManager = OAuthTokenManager.getInstance({
      environment: environment === 'production' ? 'production' : 'staging',
    });
    const basketApi = new DeliverectCommerceBasketApi(tokenManager, deliverectAccountId);

    // Deliverect Commerce uses channelLinkId as the store-channel identifier. In the
    // basket API this same value may be supplied as storeId.
    let targetChannelLinkId = typeof channelLinkId === 'string' ? channelLinkId.trim() : '';
    const assignedChannelLinks = Array.isArray(integration?.allowedChannelLinkIds)
      ? integration.allowedChannelLinkIds.map(String).filter(Boolean)
      : [];

    if (!targetChannelLinkId) {
      targetChannelLinkId = assignedChannelLinks[0] || '';
    }

    if (!targetChannelLinkId) {
      const linkedAccounts = new LinkedAccountsAdapter({ environment });
      const storesRes = await linkedAccounts.getCommerceStores(deliverectAccountId, tenantId);
      targetChannelLinkId = String(storesRes?.stores?.[0]?.channelLinkId || '');
    }

    if (!targetChannelLinkId) {
      return res.status(400).json({
        error: 'No channelLinkId found or selected for placing a test order.',
        code: 'CHANNEL_LINK_REQUIRED',
      });
    }

    // Fail closed when the tenant has an explicit provisioning boundary.
    if (assignedChannelLinks.length > 0 && !assignedChannelLinks.includes(targetChannelLinkId)) {
      return res.status(403).json({
        error: `Channel link "${targetChannelLinkId}" is not assigned to tenant "${tenantId}".`,
        code: 'CHANNEL_LINK_NOT_ASSIGNED',
      });
    }

    // Inspect the selected store's authoritative fulfillment capabilities BEFORE posting the basket.
    const linkedAccountsAdapter = new LinkedAccountsAdapter({ environment });
    const storesRes = await linkedAccountsAdapter.getCommerceStores(deliverectAccountId, tenantId);
    const selectedStore = storesRes?.stores?.find((s: any) => String(s.channelLinkId) === String(targetChannelLinkId));

    if (selectedStore && selectedStore.fulfillmentCapabilitiesProjection) {
      const supportsPickup = Boolean(selectedStore.fulfillmentCapabilitiesProjection.pickup);
      if (!supportsPickup) {
        return res.status(400).json({
          error: 'Collection is not enabled for this Deliverect Commerce store.',
          code: 'FULFILLMENT_NOT_SUPPORTED',
        });
      }
    }

    let targetMenuId = typeof menuId === 'string' ? menuId.trim() : '';
    let targetPlu = typeof plu === 'string' ? plu.trim() : '';

    // IMPORTANT: use the tenant-scoped live Deliverect adapter here. The generic
    // CommerceDiscoveryService store-catalog helper only has a concrete data provider
    // in demo mode; using it in staging caused valid channelLinkIds to fail with
    // `Store not found: <channelLinkId>` before Deliverect was ever called.
    if (!targetMenuId || !targetPlu) {
      const liveAdapter = await getDeliverectAdapterAsync(tenantId);
      const catalog = await liveAdapter.getStoreCatalog(
        targetChannelLinkId,
        'pickup',
        targetMenuId || undefined
      );

      if (!targetMenuId) {
        targetMenuId = String(
          catalog.activeMenuId ||
          catalog.menus?.find((menu: any) => Number(menu.menuType) === 2 || Number(menu.menuType) === 0)?.menuId ||
          catalog.menus?.[0]?.menuId ||
          ''
        );
      }

      if (!targetPlu) {
        const candidate = (catalog.products || []).find((product: any) => {
          const candidatePlu = String(product?.plu || '').trim();
          if (!candidatePlu || candidatePlu.includes('#')) return false;
          if (product?.active === false) return false;
          if (product?.snoozed === true || product?.isSnoozed === true) return false;
          if (String(product?.stockStatus || '').toUpperCase() === 'OUT_OF_STOCK') return false;
          return true;
        });
        targetPlu = String(candidate?.plu || '');
      }
    }

    let parsedItems: Array<{ menuId: string; plu: string; quantity: number }> | undefined = undefined;

    if (Array.isArray(items) && items.length > 0) {
      parsedItems = [];
      for (const rawItem of items) {
        const qty = Number(rawItem.quantity);
        if (!Number.isInteger(qty) || qty <= 0) {
          return res.status(400).json({
            error: 'quantity must be a positive integer.',
            code: 'INVALID_QUANTITY',
          });
        }
        const itemMenuId = rawItem.menuId ? String(rawItem.menuId).trim() : targetMenuId;
        const itemPlu = rawItem.plu ? String(rawItem.plu).trim() : targetPlu;
        if (!itemMenuId || !itemPlu) {
          return res.status(400).json({
            error: 'Each item must have a valid menuId and plu.',
            code: 'PRODUCT_REQUIRED',
          });
        }
        parsedItems.push({
          menuId: itemMenuId,
          plu: itemPlu,
          quantity: qty,
        });
      }
    } else {
      if (!targetMenuId || !targetPlu) {
        return res.status(400).json({
          error: 'Could not resolve a pickup-compatible menuId and orderable PLU from the live Deliverect store menu. Specify menuId and plu explicitly or verify that a pickup menu is published.',
          code: 'PRODUCT_REQUIRED',
        });
      }

      const parsedQuantity = quantity == null ? 1 : Number(quantity);
      if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
        return res.status(400).json({
          error: 'quantity must be a positive integer.',
          code: 'INVALID_QUANTITY',
        });
      }

      parsedItems = [{ menuId: targetMenuId, plu: targetPlu, quantity: parsedQuantity }];
    }

    const testOrderResult = await basketApi.createPickupTestOrder({
      channelLinkId: targetChannelLinkId,
      items: parsedItems,
      customer: customer || {
        name: 'Staging Test Customer',
        email: 'test@bwydi.com',
        phoneNumber: '+447700900123',
      },
      pickupNotes: pickupNotes || 'Test order via Admin UI',
      orderNote: orderNote || 'Deliverect Commerce Staging Test',
      // Checkout is destructive (it injects an order), so only run it when explicitly true.
      performCheckout: performCheckout === true,
    });

    res.json({
      success: true,
      tenantId,
      resolved: {
        accountId: deliverectAccountId,
        channelLinkId: targetChannelLinkId,
        items: parsedItems,
        menuId: targetMenuId,
        plu: targetPlu,
        performedCheckout: performCheckout === true,
      },
      result: testOrderResult,
    });
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to place test pickup order');
  }
});
v1Router.post('/admin/tenants/:id/integration/discover-stores', requireAdminAuth('tenantAdmin'), async (req: Request, res: Response) => {
  try {
    const authAdmin = (req as AuthenticatedRequest).adminUser!;
    const tenantId = req.params.id;
    const { accountId } = req.body;

    let targetAccountId = accountId;
    if (!targetAccountId) {
      const config = await FirestorePlatformService.getIntegrationConfig(tenantId);
      targetAccountId = config?.deliverectAccountId;
    }

    if (!targetAccountId) {
      return res.status(400).json({
        success: false,
        code: 'ACCOUNT_REQUIRED',
        error: 'A Deliverect Account ID is required to discover Commerce stores. Please select or map an account in Step 3 first.',
      });
    }

    const adapter = new LinkedAccountsAdapter();
    const discoveryResult = await adapter.getCommerceStores(targetAccountId, tenantId);

    const status = discoveryResult.stores.length > 0 ? 'COMMERCE_VERIFIED' : 'ACCOUNT_MAPPED';

    await FirestorePlatformService.updateIntegrationConfig(tenantId, {
      status: status as any,
      lastSyncAt: new Date().toISOString(),
    });

    await FirestorePlatformService.addAuditLog(tenantId, {
      userId: authAdmin.uid,
      userName: authAdmin.name,
      userRole: authAdmin.role,
      tenantId,
      category: 'Integration',
      action: 'DISCOVER_COMMERCE_STORES',
      details: `Discovered ${discoveryResult.stores.length} commerce store(s) from Deliverect Commerce API for account "${targetAccountId}". Status: ${status}`,
    });

    res.json({
      success: true,
      status,
      stores: discoveryResult.stores,
      count: discoveryResult.stores.length,
      persistenceStatus: discoveryResult.persistenceStatus,
      message: discoveryResult.message,
    });
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to discover commerce stores');
  }
});

/**
 * Live Commerce Diagnostics for Integrations Admin Screen
 * Surfaces Account, Stores, Root Menus, Store Menus, and Products counts from authoritative Deliverect
 */
v1Router.get('/admin/tenants/:id/integration/commerce-diagnostics', requireAdminAuth('tenantAdmin'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.params.id || 'brand-alpha';
    const adapter = await getDeliverectAdapterAsync(tenantId);

    // 1. Stores
    const stores = await adapter.getStores().catch(() => []);

    // 2. Root Catalog
    const rootCatalog = await adapter.getRootCatalog().catch((e: any) => {
      console.warn('[Diagnostics] Root Catalog fetch warning:', e.message);
      return null;
    });

    // 3. Store Catalogs
    let storeCatalog: any = null;
    if (stores.length > 0) {
      storeCatalog = await adapter.getStoreCatalog(stores[0].id).catch((e: any) => {
        console.warn('[Diagnostics] Store Catalog fetch warning:', e.message);
        return null;
      });
    }

    const linkedAdapter = new LinkedAccountsAdapter();
    const mappings = await linkedAdapter.getTenantMappings(tenantId).catch(() => null);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      account: {
        count: mappings?.accounts?.length || 0,
        primary: mappings?.accounts?.[0] || null,
      },
      stores: {
        count: stores.length,
        items: stores.map((s) => ({
          id: s.id,
          name: s.name,
          channelLinkId: s.channelLinkId,
          channelLocationId: s.channelLocationId,
          physicalLocationId: s.physicalLocationId,
          deliverectLocationId: s.deliverectLocationId,
          brandStoreId: s.brandStoreId,
          isOpen: s.isOpen,
        })),
      },
      rootCatalog: {
        id: rootCatalog?.id,
        menusCount: rootCatalog?.menus?.length || (rootCatalog ? 1 : 0),
        categoriesCount: rootCatalog?.categories?.length || 0,
        productsCount: rootCatalog?.products?.length || 0,
        menus: rootCatalog?.menus || [],
      },
      storeCatalog: storeCatalog
        ? {
            id: storeCatalog.id,
            storeId: storeCatalog.storeId,
            activeMenuId: storeCatalog.activeMenuId,
            diagnostics: storeCatalog.diagnostics,
            menusCount: storeCatalog.menus?.length || 1,
            categoriesCount: storeCatalog.categories?.length || 0,
            productsCount: storeCatalog.products?.length || 0,
            menus: storeCatalog.menus || [],
          }
        : null,
      totalProductsCount: storeCatalog?.products?.length || rootCatalog?.products?.length || 0,
    });
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to generate commerce diagnostics');
  }
});

v1Router.get('/admin/tenants/:id/integration/raw-menu/:storeId', requireAdminAuth('tenantAdmin'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.params.id;
    const adapter = await getDeliverectAdapterAsync(tenantId) as any;
    if (typeof adapter.getRawStoreMenus !== 'function') {
      return res.status(501).json({ error: 'Raw menu download is unavailable for this integration.', code: 'RAW_MENU_NOT_SUPPORTED' });
    }
    const result = await adapter.getRawStoreMenus(req.params.storeId);
    const safeName = String(req.params.storeId).replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader('Content-Disposition', `attachment; filename="deliverect-menu-${safeName}.json"`);
    res.setHeader('Cache-Control', 'no-store');
    res.json(result);
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to download the Deliverect menu');
  }
});

/**
 * Validates the exact published Deliverect menu received for a tenant/store.
 * This is diagnostic only: it never infers a merchandising flag that Deliverect
 * did not actually expose in the payload.
 */
v1Router.get('/admin/tenants/:id/integration/menu-inspector/:storeId', requireAdminAuth('tenantAdmin'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.params.id;
    const requestedMenuId = typeof req.query.menuId === 'string' ? req.query.menuId : undefined;
    const adapter = await getDeliverectAdapterAsync(tenantId) as any;
    if (typeof adapter.getRawStoreMenus !== 'function') {
      return res.status(501).json({ error: 'Menu inspection is unavailable for this integration.', code: 'MENU_INSPECTION_NOT_SUPPORTED' });
    }

    const rawResult = await adapter.getRawStoreMenus(req.params.storeId);
    const selectedMenu = selectRawMenu(rawResult?.payload, requestedMenuId);
    if (!selectedMenu) {
      return res.status(404).json({
        error: requestedMenuId
          ? `Menu ${requestedMenuId} was not found for assigned store ${req.params.storeId}.`
          : `No published menu was returned for assigned store ${req.params.storeId}.`,
        code: 'MENU_NOT_FOUND',
      });
    }

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      accountId: rawResult.accountId,
      channelLinkId: rawResult.channelLinkId,
      storeId: rawResult.storeId,
      receivedAt: rawResult.receivedAt,
      inspection: inspectDeliverectMenu(selectedMenu),
    });
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to inspect the Deliverect menu');
  }
});

// ==========================================
// CONNECTION HEALTH & 5-STAGE REQUEST TRACE
// ==========================================

/**
 * Compact, admin-only Connection Health reporting.
 * Reports actual runtime mode, resolved tenant/hostname, Deliverect env/account,
 * physical location and store counts, chosen root/store menu, raw/parsed/renderable product counts,
 * last successful sync, and exact failure stage/error code without exposing secrets.
 */
v1Router.get('/admin/connection/health', requireAdminAuth(), async (req: Request, res: Response) => {
  try {
    const authAdmin = (req as AuthenticatedRequest).adminUser!;
    const requestedTenantId = (req.headers['x-tenant-id'] as string) || (req.query.tenantId as string);
    const tenantId =
      authAdmin.role === 'platformSuperAdmin'
        ? requestedTenantId || authAdmin.tenantId || 'brand-alpha'
        : authAdmin.tenantId || 'brand-alpha';

    const health = await connectionHealthService.getConnectionHealth(tenantId, req.hostname);
    res.json(health);
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to retrieve connection health');
  }
});

/**
 * Traces a real request through Upstream -> BFF -> HTTP Client -> Hook -> Visible Cards.
 * Supports demonstrating both successful traces and forced failure scenarios:
 * NOT_CONFIGURED, PERMISSION_DENIED, UPSTREAM_ERROR, EMPTY_VALID_RESPONSE, UNMAPPED_LOCATION, RENDER_FILTERED.
 */
v1Router.post('/admin/connection/trace', requireAdminAuth(), requireAdminCapability('integrations.diagnostics'), async (req: Request, res: Response) => {
  try {
    const authAdmin = (req as AuthenticatedRequest).adminUser!;
    const requestedTenantId = (req.headers['x-tenant-id'] as string) || req.body?.tenantId;
    const tenantId =
      authAdmin.role === 'platformSuperAdmin'
        ? requestedTenantId || authAdmin.tenantId || 'brand-alpha'
        : authAdmin.tenantId || 'brand-alpha';

    const trace = await connectionHealthService.traceRequest(tenantId, {
      storeId: req.body?.storeId,
      fulfillmentType: req.body?.fulfillmentType || 'delivery',
      forceFailureType: req.body?.forceFailureType,
    });

    res.json(trace);
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to execute connection trace');
  }
});

// ==========================================
// PHASE 14: ANALYTICS & NOTIFICATIONS ROUTES
// ==========================================

/**
 * Ingest de-identified analytics event (Section 38 & 39)
 * Privacy-scrubbed at boundary; no raw PII or cardholder data.
 */
v1Router.post('/analytics/events', async (req: Request, res: Response) => {
  try {
    const tenantId = resolveTenant(req);
    const event = await AnalyticsService.trackEvent(tenantId, req.body);
    res.status(201).json({ success: true, event });
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to record analytics event');
  }
});

/**
 * Ingest batch of de-identified analytics events (Phase 17 Scale: Batch ingestion)
 */
v1Router.post('/analytics/events/batch', async (req: Request, res: Response) => {
  try {
    const tenantId = resolveTenant(req);
    const events = Array.isArray(req.body?.events) ? req.body.events : [];
    const recorded = await AnalyticsService.trackEventsBatch(tenantId, events);
    res.status(201).json({ success: true, count: recorded.length });
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to record analytics event batch');
  }
});

/**
 * Get genuine analytics insights from actual ingested events (Protected by Admin RBAC - Item 18)
 */
v1Router.get('/analytics/insights', requireAdminAuth('operationsEditor'), async (req: Request, res: Response) => {
  try {
    const tenantId = resolveTenant(req);
    const timeframe = (req.query.timeframe as '7d' | '30d' | '90d') || '30d';
    const insights = await AnalyticsService.getInsights(tenantId, timeframe);
    res.json(insights);
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to retrieve analytics insights');
  }
});

/**
 * Get raw de-identified analytics events log (Protected by Admin RBAC - Item 18)
 */
v1Router.get('/analytics/events', requireAdminAuth('operationsEditor'), async (req: Request, res: Response) => {
  try {
    const tenantId = resolveTenant(req);
    const limit = Math.min(200, parseInt(req.query.limit as string) || 50);
    const events = await FirestorePlatformService.getAnalyticsEvents(tenantId, limit);
    res.json(events);
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to retrieve analytics events');
  }
});

/**
 * Subscribe to Web Push / In-App notifications.
 *
 * Live customer identity is derived from the verified Firebase token. A caller
 * cannot bind a push endpoint to another customer's UID by posting one.
 */
v1Router.post('/notifications/subscribe', async (req: Request, res: Response) => {
  try {
    const tenantId = resolveTenant(req);
    const { endpoint, keys, customerUid: claimedCustomerUid, sessionId, channel } = req.body;
    if (!endpoint) {
      return res.status(400).json({ error: 'Subscription endpoint is required', code: 'INVALID_SUBSCRIPTION' });
    }

    const callerUid = await getCallerUid(req);
    let customerUid = callerUid || undefined;

    if (!isDemoMode() && process.env.NODE_ENV !== 'test') {
      if (claimedCustomerUid && claimedCustomerUid !== callerUid) {
        return res.status(403).json({
          error: 'Access denied: Cannot register notifications for another customer.',
          code: 'FORBIDDEN',
        });
      }
      if (!callerUid && !sessionId) {
        return res.status(401).json({
          error: 'Sign in or provide a guest session to register notifications.',
          code: 'AUTH_REQUIRED',
        });
      }
    } else if (!customerUid && claimedCustomerUid) {
      customerUid = claimedCustomerUid;
    }

    const subscription = await NotificationService.subscribe(tenantId, {
      endpoint,
      keys,
      customerUid,
      sessionId: customerUid ? undefined : sessionId,
      channel,
    });
    res.status(201).json({ success: true, subscription });
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to register notification subscription');
  }
});

/**
 * Get the current customer's notification inbox.
 *
 * Signed-in users are always scoped to the UID from their ID token. Guests
 * must present their opaque session ID; a tenant-only query is never allowed.
 */
v1Router.get('/notifications', async (req: Request, res: Response) => {
  try {
    const tenantId = resolveTenant(req);
    const claimedCustomerUid = req.query.customerUid as string | undefined;
    const sessionId = req.query.sessionId as string | undefined;
    const callerUid = await getCallerUid(req);
    let customerUid = callerUid || undefined;

    if (!isDemoMode() && process.env.NODE_ENV !== 'test') {
      if (claimedCustomerUid && claimedCustomerUid !== callerUid) {
        return res.status(403).json({
          error: 'Access denied: Cannot access notification stream for another customer.',
          code: 'FORBIDDEN',
        });
      }
      if (!callerUid && !sessionId) {
        return res.status(401).json({
          error: 'Sign in or provide a guest session to view notifications.',
          code: 'AUTH_REQUIRED',
        });
      }
    } else if (!customerUid && claimedCustomerUid) {
      customerUid = claimedCustomerUid;
    }

    const notifications = await NotificationService.getCustomerNotifications(
      tenantId,
      customerUid,
      customerUid ? undefined : sessionId
    );
    res.json({ success: true, notifications });
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to retrieve notifications');
  }
});

/**
 * Mark one owned notification as read.
 */
v1Router.patch('/notifications/:id/read', async (req: Request, res: Response) => {
  try {
    const tenantId = resolveTenant(req);
    const notificationId = req.params.id;
    const sessionId = (req.body?.sessionId || req.query.sessionId) as string | undefined;
    const callerUid = await getCallerUid(req);
    const notification = await FirestorePlatformService.getNotificationById(notificationId);

    if (!notification || notification.tenantId !== tenantId) {
      return res.status(404).json({ error: 'Notification not found', code: 'NOTIFICATION_NOT_FOUND' });
    }

    if (!isDemoMode() && process.env.NODE_ENV !== 'test') {
      const ownsNotification = callerUid
        ? notification.recipientUid === callerUid
        : Boolean(sessionId && notification.recipientSessionId === sessionId);

      if (!ownsNotification) {
        return res.status(403).json({
          error: 'Access denied: Notification does not belong to caller.',
          code: 'FORBIDDEN',
        });
      }
    }

    const updated = await NotificationService.markAsRead(notificationId);
    res.json({ success: true, updated });
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to update notification status');
  }
});

/**
 * Admin Operational Observability & Resilience Metrics (Section 48)
 */
v1Router.get('/admin/metrics', requireAdminAuth(), async (_req: Request, res: Response) => {
  try {
    const cbStats = {
      commerce: circuitBreakers.commerce.getStats(),
      dispatch: circuitBreakers.dispatch.getStats(),
      dpay: circuitBreakers.dpay.getStats(),
    };
    const snapshot = MetricsService.getMetricsSnapshot(cbStats);
    res.json(snapshot);
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to collect operational metrics');
  }
});

/**
 * Admin Reset Metrics (Testing & Maintenance)
 */
v1Router.post('/admin/metrics/reset', requireAdminAuth('platformSuperAdmin'), async (_req: Request, res: Response) => {
  try {
    MetricsService.reset();
    circuitBreakers.commerce.reset();
    circuitBreakers.dispatch.reset();
    circuitBreakers.dpay.reset();
    res.json({ success: true, message: 'Operational metrics and circuit breakers reset successfully.' });
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to reset metrics');
  }
});

/**
 * Cloud Tasks Durable Worker Endpoints (Section 20/23/24)
 * Matches URLs generated by CloudTasksQueueClient:
 * /api/v1/internal/tasks/settlement and /api/v1/internal/tasks/cancellation
 * Cryptographically protected via verifyCloudTasksOidcToken.
 */
v1Router.post('/internal/tasks/settlement', async (req: Request, res: Response) => {
  try {
    await verifyCloudTasksOidcToken(req);
    const result = await AsyncWorkerService.handleCloudTaskJob('SETTLEMENT', req.body);
    res.status(200).json(result);
  } catch (err: any) {
    console.error('[CloudTasks Worker Error - Settlement]:', err.message);
    const statusCode = err.statusCode || (err.code?.startsWith('OIDC_') ? 401 : 500);
    res.status(statusCode).json({ error: err.message, code: err.code || 'TASK_EXECUTION_FAILED' });
  }
});

v1Router.post('/internal/tasks/cancellation', async (req: Request, res: Response) => {
  try {
    await verifyCloudTasksOidcToken(req);
    const result = await AsyncWorkerService.handleCloudTaskJob('CANCELLATION', req.body);
    res.status(200).json(result);
  } catch (err: any) {
    console.error('[CloudTasks Worker Error - Cancellation]:', err.message);
    const statusCode = err.statusCode || (err.code?.startsWith('OIDC_') ? 401 : 500);
    res.status(statusCode).json({ error: err.message, code: err.code || 'TASK_EXECUTION_FAILED' });
  }
});
