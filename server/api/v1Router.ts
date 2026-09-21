import express, { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { getDeliverectAdapterAsync, getDispatchAdapter, PaymentService, DispatchOrchestrationService } from '../deliverect';
import { setStoreOverride } from '../deliverect/DeliverectApiClient';
import { CommerceDiscoveryService } from '../deliverect/CommerceDiscoveryService';
import { ConnectionDiagnostics } from '../deliverect/ConnectionDiagnostics';
import { connectionHealthService } from '../deliverect/ConnectionHealthService';
import { LinkedAccountsAdapter } from '../deliverect/LinkedAccountsAdapter';
import { IntegrationContext } from '../deliverect/IntegrationContext';
import { FirestorePlatformService, FirestoreService } from '../firestoreService';
import { getFirestoreDb, getFirebaseStorage, getFirebaseAuth, getFirebaseAdminAuth, verifyAdminSession, verifyAdminSessionWithStatus, AuthenticatedAdmin } from '../firebase';
import { AssetService, AssetType, normalizeAssetType } from '../assetService';
import { MediaHealthService } from '../mediaHealthService';
import { LocationService } from '../locationService';
import { WebhookService } from '../deliverect/WebhookService';
import { SubstitutionCallbackService } from '../deliverect/SubstitutionCallbackService';
import { AnalyticsService } from '../analyticsService';
import { NotificationService } from '../notificationService';
import { AsyncWorkerService, verifyCloudTasksOidcToken } from '../asyncWorkerService';
import { MetricsService } from '../metricsService';
import { circuitBreakers } from '../circuitBreaker';
import { checkoutAndPaymentRateLimiter } from '../rateLimiter';
import { CheckoutResult } from '../../src/domain/models';
import { TenantConfig } from '../../src/commerce/models';
import { MOCK_TENANTS } from '../../src/commerce/mockData';
import { GOOGLE_FONTS_CATALOG } from '../../src/commerce/googleFonts';
import { BFFError } from '../errors';
import { SecretManager } from '../secrets';
import { CmsService } from '../cmsService';
import { isMarketingContentVisible } from '../marketingSchedule';
import { getServerRuntimeMode, isDemoMode, isStagingMode, isProductionMode, isLiveMode, isTestMode } from '../runtimeMode';
import { DemoDiscoveryDataProvider } from '../deliverect/DemoDiscoveryDataProvider';
import { validateBody } from './validation';

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
  UpdateBasketCustomerSchema,
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
  CreateTenantSchema,
  UpdateTenantConfigSchema,
  UpdateFeePolicySchema,
  SaveStorySchema,
  SaveHeroBannerSchema,
  ReorderHeroBannersSchema,
  UpdateIntegrationSchema,
  TestConnectionSchema,
  UpdateIntegrationCredentialsSchema,
  AssetUploadSchema,
  AssetUploadUrlSchema,
  AssetFinalizeSchema,
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
      (req as any).resolvedTenantId = requestedOverride || process.env.PREVIEW_TENANT_ID || 'brand-alpha';
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

/**
 * RBAC Middleware to protect Admin endpoints
 */
function requireAdminAuth(requiredRole?: 'platformSuperAdmin' | 'tenantAdmin' | 'marketingEditor' | 'operationsEditor') {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const requestedTenant = (req.headers['x-tenant-id'] as string) || req.params.tenantId || req.params.id || (req as any).resolvedTenantId;
    let tenantId = requestedTenant;
    if (!tenantId) {
      try {
        tenantId = resolveTenant(req);
      } catch {
        tenantId = 'brand-alpha';
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
  res.json({
    appMode: mode,
    isDemo: mode === 'demo',
    isStaging: mode === 'staging',
    isProduction: mode === 'production',
    allowMockFallback: mode === 'demo',
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
    process.env.GOOGLE_MAPS_API_KEY ||
    'xDh0vIFs-lfpjyGqlg9KJnrAMqQ=';
  const mapId = process.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';
  res.json({ apiKey, mapId });
});

// ==========================================
// CACHE MANAGEMENT & RESET
// ==========================================
v1Router.all('/cache/reset', async (req: Request, res: Response) => {
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

v1Router.patch('/baskets/:basketId', validateBody(UpdateBasketItemSchema), async (req: Request, res: Response) => {
  try {
    const { productId, quantity } = req.body;
    const tenantId = resolveTenant(req);
    const adapter = await getDeliverectAdapterAsync(tenantId);
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
    const basket = await adapter.updateBasketItems(req.params.basketId, items);
    res.json(basket);
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to update basket items');
  }
});

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
    const eventId =
      (req.headers['x-dispatch-event-id'] as string) ||
      req.body.eventId ||
      `wh_dsp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const updated = await DispatchOrchestrationService.handleDispatchWebhook(req.body, eventId);
    res.json({ success: true, eventId, dispatch: updated });
  } catch (err: any) {
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

v1Router.post(
  '/checkouts',
  checkoutAndPaymentRateLimiter.middleware(),
  validateBody(CheckoutBasketSchema),
  async (req: Request, res: Response) => {
  try {
    const { basketId, options } = req.body;
    const resolvedTenant = resolveTenant(req);

    // PAY-10: Verify checkout references a valid authorized DPay payment when paymentId provided
    if (options?.paymentId) {
      try {
        const payment = await PaymentService.getPayment(options.paymentId, resolvedTenant);
        if (!payment) {
          return res.status(404).json({
            error: `Payment ${options.paymentId} not found.`,
            code: 'PAYMENT_NOT_FOUND',
          });
        }
        if (payment.status !== 'authorized' && payment.status !== 'captured') {
          return res.status(422).json({
            error: `Payment ${options.paymentId} is in status '${payment.status}', but must be authorized before checkout.`,
            code: 'PAYMENT_NOT_AUTHORISED',
          });
        }
      } catch (paymentErr: any) {
        return handleCommerceError(res, paymentErr, 'Payment validation failed');
      }
    }

    // CHECK-02: Idempotency check via idempotencyKey
    if (options?.idempotencyKey) {
      const existing = await FirestorePlatformService.getCheckoutByIdempotencyKey(options.idempotencyKey);
      if (existing) {
        console.log(`[v1Router] Returning existing checkout for idempotencyKey ${options.idempotencyKey}`);
        return res.status(200).json(existing);
      }
    }

    // CHECK-02: Duplicate check via channelOrderReference
    if (options?.channelOrderReference) {
      const existing = await FirestorePlatformService.getCheckoutByReference(options.channelOrderReference);
      if (existing) {
        console.log(`[v1Router] Returning existing checkout for channelOrderReference ${options.channelOrderReference}`);
        return res.status(200).json(existing);
      }
    }

    // DSP-03 & Dispatch Orchestration: Authoritative dispatch quote/availability check
    if (options?.fulfillmentType === 'delivery' || !options?.fulfillmentType) {
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

    if (adapter.checkout) {
      checkoutResult = await adapter.checkout(basketId, {
        ...options,
        tenantId: resolvedTenant,
      });
    } else {
      const order = await adapter.checkoutBasket(basketId, options);
      const checkoutId = `chk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const channelOrderReference = options?.channelOrderReference || order.orderReference || `ORD-${Date.now().toString().slice(-6)}`;
      const now = new Date().toISOString();

      checkoutResult = {
        checkoutId,
        channelOrderReference,
        orderId: order.id,
        tenantId: resolvedTenant,
        storeId: order.storeId,
        channelLinkId: order.storeId,
        status: 'CHECKOUT_PENDING_CONFIRMATION',
        basketId,
        fulfillmentType: (order.fulfillment?.type as any) || 'delivery',
        total: order.originalBasket?.total || { amount: 0, currency: 'GBP' },
        idempotencyKey: options?.idempotencyKey,
        dispatchValidationId: options?.dispatchValidationId,
        paymentId: options?.paymentId,
        order,
        createdAt: now,
        updatedAt: now,
      };
    }

    // Persist CheckoutProjection in Firestore / in-memory
    await FirestorePlatformService.saveCheckoutProjection(checkoutResult);

    // Save GDPR-safe order projection in Firestore
    if (checkoutResult.order) {
      if (!checkoutResult.order.payment && (options?.paymentId || checkoutResult.paymentId)) {
        (checkoutResult.order as any).paymentId = options?.paymentId || checkoutResult.paymentId;
      }
      await FirestorePlatformService.saveOrderProjection(checkoutResult.order, resolvedTenant, checkoutResult.checkoutId);

      // Initialize dispatch lifecycle
      const dispatchAdapter = getDispatchAdapter(resolvedTenant);
      await DispatchOrchestrationService.handleCheckoutCreated(
        checkoutResult.order.id,
        resolvedTenant,
        dispatchAdapter,
        {
          fulfillmentType: (checkoutResult.order.fulfillment?.type as any) || 'delivery',
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

    // Return 202 Accepted with pending checkout state (CHECK-01)
    res.status(202).json(checkoutResult);
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to checkout basket');
  }
});

v1Router.get('/checkouts/:checkoutId', async (req: Request, res: Response) => {
  try {
    const { checkoutId } = req.params;
    let checkout = await FirestorePlatformService.getCheckoutProjection(checkoutId);

    if (!checkout) {
      const resolvedTenant = resolveTenant(req);
      const adapter = await getDeliverectAdapterAsync(resolvedTenant);
      if (adapter.getCheckout) {
        checkout = await adapter.getCheckout(checkoutId);
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

    // CHECK-03: Webhook recovery check
    // If order was confirmed via external order projection but checkout projection hadn't synced
    if (checkout.orderId && (checkout.status === 'CHECKOUT_PENDING_CONFIRMATION' || checkout.status === 'CHECKOUT_SUBMITTING')) {
      const orderProj = await FirestorePlatformService.getOrderProjection(checkout.orderId);
      if (orderProj && orderProj.status !== 'CHECKOUT_PENDING_CONFIRMATION' && orderProj.status !== 'SUBMITTED') {
        checkout = (await FirestorePlatformService.updateCheckoutStatus(
          checkoutId,
          orderProj.status as any,
          { orderId: checkout.orderId }
        )) || checkout;
      }
    }

    res.json(checkout);
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to retrieve checkout');
  }
});

v1Router.post('/checkouts/:checkoutId/confirm-demo', async (req: Request, res: Response) => {
  try {
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
 * Deliverect Inbound Webhook Ingestion (WH-01, WH-02, WH-03)
 * Supports integration-specific routes (/webhooks/deliverect/:identifier) and global route with host/query resolution.
 * Enforces HMAC validation, event journaling, deduplication, and monotonic state progression.
 */
v1Router.post(['/webhooks/deliverect', '/webhooks/deliverect/:identifier'], async (req: Request, res: Response) => {
  try {
    const identifier = req.params.identifier;
    let tenantId: string | undefined;

    if (identifier) {
      // In staging/production: identifier MUST be resolved through stored Integration records.
      // Tenant slug acceptance is strictly prohibited in live mode.
      const resolved = await FirestorePlatformService.resolveTenantByIntegrationId(identifier);
      if (resolved) {
        tenantId = resolved;
      } else if (isDemoMode() || process.env.NODE_ENV === 'test') {
        tenantId = identifier;
      } else {
        return res.status(404).json({
          error: `No registered integration found for identifier "${identifier}".`,
          code: 'INTEGRATION_NOT_FOUND',
        });
      }
    }

    if (!tenantId) {
      if (isDemoMode() || process.env.NODE_ENV === 'test') {
        tenantId = (req.query.tenantId as string) || (req.headers['x-tenant-id'] as string) || 'brand-alpha';
      } else {
        // In staging/production, query/header tenantId cannot be spoofed! Must have a valid integration identifier or host-resolved domain
        const host = ((req.headers['x-forwarded-host'] as string) || req.hostname || '').toLowerCase().split(':')[0];
        const resolvedFromDb = await FirestorePlatformService.resolveTenantByHostname(host);
        if (resolvedFromDb) {
          tenantId = resolvedFromDb;
        } else {
          return res.status(400).json({
            error: 'Inbound webhook cannot be routed: integrationId or registered domain required.',
            code: 'WEBHOOK_UNROUTABLE',
          });
        }
      }
    }

    const rawBody = (req as any).rawBody || Buffer.from(JSON.stringify(req.body), 'utf8');

    const result = await WebhookService.processWebhook(
      req.body,
      rawBody,
      req.headers,
      tenantId
    );

    res.status(200).json(result);
  } catch (err: any) {
    const status = err.statusCode || 500;
    const code = err.code || 'WEBHOOK_PROCESSING_ERROR';
    console.error(`[Deliverect Webhook Error] (${status} ${code}):`, err.message);
    res.status(status).json({
      error: err.message,
      code,
    });
  }
});

v1Router.get('/orders/:orderId', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const tenantId = resolveTenant(req);
    const adapter = await getDeliverectAdapterAsync(tenantId);
    let order = await adapter.getOrder(orderId);

    // Merge or fall back to Firestore order projection for authoritative picking updates
    const proj = await FirestorePlatformService.getOrderProjection(orderId);

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
      const currency = proj.metadata?.currency || tenant?.currency;
      order = {
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
      } as any;
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
    const orderProj = await FirestorePlatformService.getOrderProjection(orderId);
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

    // WH-04: Verify GET signature if present
    const isSignatureValid = SubstitutionCallbackService.verifyGetSignature(
      req.path,
      req.query,
      req.headers,
      tenantId
    );

    if (!isSignatureValid) {
      return res.status(401).json({
        error: 'Invalid webhook signature for substitute callback.',
        code: 'INVALID_SIGNATURE',
      });
    }

    const result = await SubstitutionCallbackService.getSubstitutionForPlu(orderId, plu, tenantId);

    if (!result) {
      return res.status(404).json({
        error: `Item with PLU '${plu}' or order '${orderId}' not found.`,
        code: 'ITEM_NOT_FOUND',
      });
    }

    res.json(result);
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
v1Router.post('/admin/memberships', requireAdminAuth(), async (req: Request, res: Response) => {
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
v1Router.delete('/admin/memberships/:id', requireAdminAuth(), async (req: Request, res: Response) => {
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
    const provisioned = await FirestorePlatformService.createTenant(newTenant);

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
v1Router.patch('/admin/tenants/:id', requireAdminAuth('marketingEditor'), validateBody(UpdateTenantConfigSchema), async (req: Request, res: Response) => {
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
    const domains = await FirestorePlatformService.listAllDomains();
    res.json(domains);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9.4c Add or update a domain mapping
v1Router.post('/admin/domains', requireAdminAuth('tenantAdmin'), async (req: Request, res: Response) => {
  try {
    const { hostname, tenantId, isPrimary } = req.body;
    if (!hostname || !tenantId) {
      return res.status(400).json({ error: 'hostname and tenantId are required' });
    }
    const created = await FirestorePlatformService.addOrUpdateDomain({
      hostname,
      tenantId,
      isPrimary: Boolean(isPrimary),
      status: 'active',
    });

    await FirestorePlatformService.addAuditLog(tenantId, {
      userId: (req as AuthenticatedRequest).adminUser?.uid || 'admin',
      userName: (req as AuthenticatedRequest).adminUser?.name || 'Admin',
      userRole: (req as AuthenticatedRequest).adminUser?.role || 'tenantAdmin',
      tenantId,
      category: 'Tenant',
      action: 'MAP_DOMAIN',
      details: `Mapped domain "${hostname}" to tenant "${tenantId}"`,
    });

    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9.4d Delete a domain mapping
v1Router.delete('/admin/domains/:domainId', requireAdminAuth('tenantAdmin'), async (req: Request, res: Response) => {
  try {
    const domainId = req.params.domainId;
    await FirestorePlatformService.deleteDomain(domainId);

    await FirestorePlatformService.addAuditLog('platform', {
      userId: (req as AuthenticatedRequest).adminUser?.uid || 'admin',
      userName: (req as AuthenticatedRequest).adminUser?.name || 'Admin',
      userRole: (req as AuthenticatedRequest).adminUser?.role || 'tenantAdmin',
      tenantId: 'platform',
      category: 'Tenant',
      action: 'UNMAP_DOMAIN',
      details: `Deleted domain mapping "${domainId}"`,
    });

    res.json({ success: true, message: `Domain ${domainId} deleted.` });
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

v1Router.put('/admin/tenants/:id/stores/:storeId', requireAdminAuth(), async (req: Request, res: Response) => {
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

v1Router.post('/admin/tenants/:id/rules', requireAdminAuth('marketingEditor'), async (req: Request, res: Response) => {
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
v1Router.post('/admin/assets/upload', requireAdminAuth(), validateBody(AssetUploadSchema), async (req: Request, res: Response) => {
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

v1Router.post('/admin/assets/upload-url', requireAdminAuth(), validateBody(AssetUploadUrlSchema), async (req: Request, res: Response) => {
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

v1Router.put('/admin/assets/direct-upload/:assetId', express.raw({ type: '*/*', limit: '100mb' }), async (req: Request, res: Response) => {
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

v1Router.post('/admin/assets/finalize', requireAdminAuth(), validateBody(AssetFinalizeSchema), async (req: Request, res: Response) => {
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

v1Router.delete('/admin/assets/:tenantId/:assetId', requireAdminAuth(), async (req: Request, res: Response) => {
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

v1Router.post('/admin/tenants/:id/media-health/check', requireAdminAuth(), async (req: Request, res: Response) => {
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
v1Router.get('/cms/pages', (req: Request, res: Response) => res.json({ pages: CmsService.list(resolveTenant(req), true) }));
v1Router.get('/admin/tenants/:id/pages', requireAdminAuth(), (req: Request, res: Response) => {
  const admin = (req as AuthenticatedRequest).adminUser;
  if (admin?.role !== 'platformSuperAdmin' && admin?.tenantId !== req.params.id) return res.status(403).json({ error: 'Tenant access denied' });
  res.json({ pages: CmsService.list(req.params.id) });
});
v1Router.put('/admin/tenants/:id/pages/:pageId', requireAdminAuth('marketingEditor'), (req: Request, res: Response) => {
  const admin = (req as AuthenticatedRequest).adminUser;
  if (admin?.role !== 'platformSuperAdmin' && admin?.tenantId !== req.params.id) return res.status(403).json({ error: 'Tenant access denied' });
  if (!req.body || req.body.id !== req.params.pageId) return res.status(400).json({ error: 'Page identity mismatch' });
  res.json(CmsService.save(req.params.id, req.body));
});
v1Router.delete('/admin/tenants/:id/pages/:pageId', requireAdminAuth('marketingEditor'), (req: Request, res: Response) => {
  const admin = (req as AuthenticatedRequest).adminUser;
  if (admin?.role !== 'platformSuperAdmin' && admin?.tenantId !== req.params.id) return res.status(403).json({ error: 'Tenant access denied' });
  const deleted = CmsService.delete(req.params.id, req.params.pageId);
  res.status(deleted ? 200 : 404).json({ success: deleted });
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

v1Router.post('/admin/test-oauth', requireAdminAuth(), async (req: Request, res: Response) => {
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

v1Router.post('/admin/tenants/:id/integration/test-oauth', requireAdminAuth(), async (req: Request, res: Response) => {
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

v1Router.post('/admin/test-connection', requireAdminAuth(), validateBody(TestConnectionSchema), async (req: Request, res: Response) => {
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
v1Router.post('/admin/tenants/:id/integration/test', requireAdminAuth(), async (req: Request, res: Response) => {
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
v1Router.post('/admin/tenants/:id/integration/select-account', requireAdminAuth('tenantAdmin'), async (req: Request, res: Response) => {
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
    let mappings: any = { accounts: [], stores: [] };
    try {
      mappings = await adapter.getTenantMappings(tenantId);
    } catch (mappingErr: any) {
      console.warn(`[Select Account] Live tenant mappings unavailable for ${tenantId}:`, mappingErr?.message || mappingErr);
    }

    const matchingStores = (mappings?.stores || []).filter((s: any) => s.accountLinkId === `acclink_${accountId}` || s.accountLinkId === accountId);
    const availableChannelLinkIds = new Set(matchingStores.map((s: any) => String(s.channelLinkId)));
    // Store assignment is explicit. Missing or empty input never expands a tenant to every store.
    const requestedChannelLinkIds: string[] = channelLinkIds === undefined
      ? []
      : [...new Set((channelLinkIds as any[]).map(id => String(id)))];
    
    if (availableChannelLinkIds.size > 0) {
      const invalidChannelLinkIds = requestedChannelLinkIds.filter((id: string) => !availableChannelLinkIds.has(id));
      if (invalidChannelLinkIds.length > 0) {
        return res.status(400).json({
          error: 'One or more channel links do not belong to the selected Deliverect account.',
          code: 'INVALID_CHANNEL_ASSIGNMENT',
          invalidChannelLinkIds,
        });
      }
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
 * Discover and map Commerce Stores for selected account
 * Queries GET /commerce/{accountId}/stores directly from official Deliverect Commerce API
 */
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
v1Router.post('/admin/connection/trace', requireAdminAuth(), async (req: Request, res: Response) => {
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
 * Subscribe to Web Push / In-App notifications
 */
v1Router.post('/notifications/subscribe', async (req: Request, res: Response) => {
  try {
    const tenantId = resolveTenant(req);
    const { endpoint, keys, customerUid, sessionId, channel } = req.body;
    if (!endpoint) {
      return res.status(400).json({ error: 'Subscription endpoint is required', code: 'INVALID_SUBSCRIPTION' });
    }
    const subscription = await NotificationService.subscribe(tenantId, {
      endpoint,
      keys,
      customerUid,
      sessionId,
      channel,
    });
    res.status(201).json({ success: true, subscription });
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to register notification subscription');
  }
});

/**
 * Get customer notifications
 */
v1Router.get('/notifications', async (req: Request, res: Response) => {
  try {
    const tenantId = resolveTenant(req);
    const customerUid = req.query.customerUid as string | undefined;
    const sessionId = req.query.sessionId as string | undefined;

    // Privacy boundary: ensure customerUid query matches caller identity
    if (customerUid && !isDemoMode() && process.env.NODE_ENV !== 'test') {
      const callerUid = await getCallerUid(req);
      const adminUser = (req as AuthenticatedRequest).adminUser;
      if (!adminUser && callerUid !== customerUid) {
        return res.status(403).json({
          error: 'Access denied: Cannot access notification stream for another customer.',
          code: 'FORBIDDEN',
        });
      }
    }

    const notifications = await NotificationService.getCustomerNotifications(tenantId, customerUid, sessionId);
    res.json({ success: true, notifications });
  } catch (err: any) {
    handleCommerceError(res, err, 'Failed to retrieve notifications');
  }
});

/**
 * Mark notification as read
 */
v1Router.patch('/notifications/:id/read', async (req: Request, res: Response) => {
  try {
    const notificationId = req.params.id;
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
