import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConnectionHealthService } from '../../server/deliverect/ConnectionHealthService';
import { linkedAccountsAdapter } from '../../server/deliverect/LinkedAccountsAdapter';
import { setServerRuntimeMode } from '../../server/runtimeMode';
import { resetDeliverectAdapter, setDeliverectAdapter } from '../../server/deliverect';

describe('Connection Health & 5-Stage Request Tracing', () => {
  let healthService: ConnectionHealthService;

  beforeEach(() => {
    vi.restoreAllMocks();
    resetDeliverectAdapter();
    // Success-path diagnostics must opt into demo explicitly. Missing APP_MODE is
    // intentionally fail-closed to "unknown" and must never acquire mock data.
    setServerRuntimeMode('demo');
    healthService = new ConnectionHealthService();
  });

  describe('Connection Health View Data', () => {
    it('accurately reports runtime mode, tenant, account, menu, and product counts', async () => {
      const health = await healthService.getConnectionHealth('brand-alpha', 'staging.bwydi.app');

      expect(health).toBeDefined();
      expect(health.tenantId).toBe('brand-alpha');
      expect(health.hostname).toBe('staging.bwydi.app');
      expect(['staging', 'production', 'demo']).toContain(health.runtimeMode);
      expect(health.deliverectEnvironment).toBeDefined();
      expect(health.deliverectAccountId).toBeDefined();

      // Counts inspectable
      expect(typeof health.physicalLocationsCount).toBe('number');
      expect(typeof health.commerceStoresCount).toBe('number');
      expect(typeof health.rawProductCount).toBe('number');
      expect(typeof health.parsedProductCount).toBe('number');
      expect(typeof health.renderableProductCount).toBe('number');

      // Security check: NO credentials, client secrets, or customer PII exposed
      const jsonString = JSON.stringify(health);
      expect(jsonString).not.toContain('DELIVERECT_CLIENT_SECRET');
      expect(jsonString).not.toContain('client_secret');
      expect(jsonString).not.toContain('customerUid');
      expect(jsonString).not.toContain('email');
      expect(jsonString).not.toContain('password');
      expect(jsonString).not.toContain('Bearer');
    });
  });

  describe('5-Stage Request Tracing: Successful Trace', () => {
    it('traces through Upstream -> BFF -> HTTP Client -> Hook -> Visible Cards with verified counts at each stage', async () => {
      vi.spyOn(linkedAccountsAdapter, 'getTenantMappings').mockResolvedValue({
        tenantId: 'brand-alpha',
        integration: {
          status: 'CONNECTED',
          deliverectAccountId: 'demo-account',
          environment: 'staging',
        },
        accounts: [
          {
            accountLinkId: 'demo-account-link',
            deliverectAccountId: 'demo-account',
          },
        ],
        locations: [],
        stores: [
          {
            id: 'store-01',
            commerceStoreId: 'store-01',
            channelLinkId: 'store-01',
            accountLinkId: 'demo-account-link',
            name: 'Demo Store',
          },
        ],
      } as any);
      setDeliverectAdapter(
        {
          adapterName: 'ConnectionTraceFixtureAdapter',
          isConnected: true,
          getStoreCatalog: vi.fn().mockResolvedValue({
            id: 'menu-demo-store-01',
            type: 'STORE',
            menus: [{ id: 'menu-demo-store-01', name: 'Demo Store Menu' }],
            categories: [{ id: 'cat-demo', name: 'Demo' }],
            products: [
              {
                id: 'prod-demo-1',
                plu: 'DEMO-1',
                name: 'Demo Product',
                active: true,
                stockStatus: 'IN_STOCK',
                price: { amount: 199, currency: 'GBP' },
                categoryIds: ['cat-demo'],
              },
            ],
            totalProducts: 1,
            updatedAt: new Date().toISOString(),
          }),
          getRootCatalog: vi.fn().mockResolvedValue({
            id: 'root-demo',
            type: 'ROOT',
            menus: [{ id: 'root-demo', name: 'Demo Root Menu' }],
            categories: [{ id: 'cat-demo', name: 'Demo' }],
            products: [
              {
                id: 'prod-demo-1',
                plu: 'DEMO-1',
                name: 'Demo Product',
                active: true,
                stockStatus: 'IN_STOCK',
                price: { amount: 199, currency: 'GBP' },
                categoryIds: ['cat-demo'],
              },
            ],
            totalProducts: 1,
            updatedAt: new Date().toISOString(),
          }),
        } as any,
        'brand-alpha',
        'staging',
        'demo-account'
      );

      const trace = await healthService.traceRequest({
        tenantId: 'brand-alpha',
        fulfillmentType: 'delivery',
      });

      expect(trace).toBeDefined();
      expect(trace.stages).toHaveLength(5);

      // Verify sequence of stages
      expect(trace.stages[0].stage).toBe('UPSTREAM');
      expect(trace.stages[1].stage).toBe('BFF_NORMALIZATION');
      expect(trace.stages[2].stage).toBe('HTTP_CLIENT');
      expect(trace.stages[3].stage).toBe('HOOK');
      expect(trace.stages[4].stage).toBe('VISIBLE_CARDS');

      // Check counts are inspectable at each stage
      expect(trace.stages[0].count).toBeGreaterThan(0);
      expect(trace.stages[1].count).toBeGreaterThan(0);
      expect(trace.stages[2].count).toBeGreaterThan(0);
      expect(trace.stages[3].count).toBeGreaterThan(0);
      expect(trace.stages[4].count).toBeGreaterThan(0);

      // Stage 1: Upstream response details
      expect(trace.stages[0].details.statusCode).toBe(200);
      expect(trace.stages[0].details.rawCategoriesCount).toBeDefined();

      // Stage 2: Normalization
      expect(trace.stages[1].details.normalizedProductsCount).toBe(trace.stages[1].count);

      // Stage 5: Visible cards
      expect(trace.stages[4].status).toBe('SUCCESS');
      expect(trace.totalDurationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('5-Stage Request Tracing: Forced Failures and Anomaly Detection', () => {
    it('demonstrates NOT_CONFIGURED forced failure at upstream stage', async () => {
      const trace = await healthService.traceRequest({
        tenantId: 'brand-alpha',
        forceFailureType: 'NOT_CONFIGURED',
      });

      expect(trace.status).toBe('FAILED');
      expect(trace.failedStage).toBe('UPSTREAM');
      expect(trace.errorCode).toBe('NOT_CONFIGURED');
      expect(trace.stages[0].status).toBe('ERROR');
      expect(trace.stages[0].error?.code).toBe('NOT_CONFIGURED');
      expect(trace.stages[1].status).toBe('SKIPPED');
    });

    it('demonstrates PERMISSION_DENIED forced failure', async () => {
      const trace = await healthService.traceRequest({
        tenantId: 'brand-alpha',
        forceFailureType: 'PERMISSION_DENIED',
      });

      expect(trace.status).toBe('FAILED');
      expect(trace.failedStage).toBe('UPSTREAM');
      expect(trace.errorCode).toBe('PERMISSION_DENIED');
      expect(trace.stages[0].details.statusCode).toBe(403);
    });

    it('demonstrates UPSTREAM_ERROR forced failure', async () => {
      const trace = await healthService.traceRequest({
        tenantId: 'brand-alpha',
        forceFailureType: 'UPSTREAM_ERROR',
      });

      expect(trace.status).toBe('FAILED');
      expect(trace.failedStage).toBe('UPSTREAM');
      expect(trace.errorCode).toBe('UPSTREAM_ERROR');
      expect(trace.stages[0].details.statusCode).toBe(502);
    });

    it('demonstrates EMPTY_VALID_RESPONSE (HTTP 200 with zero raw items)', async () => {
      const trace = await healthService.traceRequest({
        tenantId: 'brand-alpha',
        forceFailureType: 'EMPTY_VALID_RESPONSE',
      });

      expect(trace.status).toBe('FAILED');
      expect(trace.failedStage).toBe('UPSTREAM');
      expect(trace.errorCode).toBe('EMPTY_VALID_RESPONSE');
      expect(trace.stages[0].count).toBe(0);
      expect(trace.stages[0].details.statusCode).toBe(200);
      expect(trace.stages[0].details.note).toContain('zero items');
    });

    it('demonstrates UNMAPPED_LOCATION failure', async () => {
      const trace = await healthService.traceRequest({
        tenantId: 'brand-alpha',
        forceFailureType: 'UNMAPPED_LOCATION',
      });

      expect(trace.status).toBe('FAILED');
      expect(trace.failedStage).toBe('BFF_NORMALIZATION');
      expect(trace.errorCode).toBe('UNMAPPED_LOCATION');
      expect(trace.stages[1].status).toBe('ERROR');
    });

    it('demonstrates RENDER_FILTERED anomaly: HTTP 200 with raw items but 0 visible cards', async () => {
      const trace = await healthService.traceRequest({
        tenantId: 'brand-alpha',
        forceFailureType: 'RENDER_FILTERED',
      });

      // Crucial test requirement: Does NOT claim success merely because HTTP was 200
      expect(trace.status).toBe('FAILED');
      expect(trace.failedStage).toBe('VISIBLE_CARDS');
      expect(trace.errorCode).toBe('RENDER_FILTERED');
      expect(trace.stages[0].status).toBe('SUCCESS'); // Upstream was 200 OK
      expect(trace.stages[0].count).toBeGreaterThan(0);
      expect(trace.stages[4].status).toBe('ERROR');
      expect(trace.stages[4].count).toBe(0);
      expect(trace.stages[4].details.filterReason).toBeDefined();
    });
  });
});
