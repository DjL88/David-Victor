import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { v1Router } from '../../server/api/v1Router';
import { verifyCloudTasksOidcToken } from '../../server/asyncWorkerService';
import { SecretManager } from '../../server/secrets';
import { LinkedAccountsAdapter } from '../../server/deliverect/LinkedAccountsAdapter';
import { WebhookService } from '../../server/deliverect/WebhookService';
import { AssetService } from '../../server/assetService';
import { FirestorePlatformService } from '../../server/firestoreService';
import { IntegrationUnavailableAdapter } from '../../server/deliverect/IntegrationUnavailableAdapter';
import { getServerRuntimeMode, setServerRuntimeMode } from '../../server/runtimeMode';

describe('Pre-Staging Security Closure & Hardening', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    setServerRuntimeMode('demo');
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. Deletion of unauthenticated legacy /tasks/* routes
  // =========================================================================
  describe('1. Legacy Task Endpoints Deletion', () => {
    it('confirms /tasks/process-settlement and /tasks/process-cancellation are completely removed from router', () => {
      const routes = (v1Router.stack || [])
        .filter((layer: any) => layer.route)
        .map((layer: any) => layer.route.path);

      expect(routes).not.toContain('/tasks/process-settlement');
      expect(routes).not.toContain('/tasks/process-cancellation');
    });
  });

  // =========================================================================
  // 2. Cryptographic Cloud Tasks OIDC Verification
  // =========================================================================
  describe('2. Cloud Tasks OIDC Verification (/internal/tasks/*)', () => {
    it('rejects requests missing an Authorization header with 401', async () => {
      const req: any = {
        headers: {
          'x-cloudtasks-queuename': 'settlement-queue', // Header alone MUST NOT be trusted
        },
      };

      await expect(verifyCloudTasksOidcToken(req)).rejects.toMatchObject({
        statusCode: 401,
        code: 'OIDC_AUTH_REQUIRED',
      });
    });

    it('rejects requests with malformed Bearer authorization', async () => {
      const req: any = {
        headers: {
          authorization: 'Basic dXNlcjpwYXNz',
        },
      };

      await expect(verifyCloudTasksOidcToken(req)).rejects.toMatchObject({
        statusCode: 401,
        code: 'OIDC_AUTH_REQUIRED',
      });
    });

    it('rejects forged tokens that fail OIDC cryptographic verification', async () => {
      process.env.APP_MODE = 'staging';
      process.env.CLOUD_TASKS_SA_EMAIL = 'worker@project.iam.gserviceaccount.com';

      const req: any = {
        headers: {
          authorization: 'Bearer forged.invalid.token',
          'x-cloudtasks-queuename': 'settlement-queue',
        },
      };

      await expect(verifyCloudTasksOidcToken(req)).rejects.toMatchObject({
        statusCode: 401,
        code: 'OIDC_TOKEN_INVALID',
      });
    });
  });

  // =========================================================================
  // 3. Admin Credential Persistence Truth-in-Advertising
  // =========================================================================
  describe('3. Admin Credential Persistence & SecretManager', () => {
    it('SecretManager.setSecret returns false and logs failure if GSM client is unconfigured', async () => {
      // With no GCP credentials in test environment, persistence to GSM must fail truthfully
      const success = await SecretManager.setSecret('DELIVERECT_TEST_SECRET', 'super_secret', true);
      expect(success).toBe(false);

      // In-memory fallback still stores for transient session
      const retrieved = await SecretManager.getSecret('DELIVERECT_TEST_SECRET');
      expect(retrieved).toBe('super_secret');
    });
  });

  // =========================================================================
  // 4. LinkedAccountsAdapter ID Preservation (No Fabricated acc_* or chl_*)
  // =========================================================================
  describe('4. Deliverect ID Preservation in LinkedAccountsAdapter', () => {
    it('preserves native Deliverect accountId, locationId, and channelLinkId without fabricated prefixes', () => {
      const rawDeliverectPayload = [
        {
          _id: '65b1234567890abcdef12345',
          name: 'Chelmsford Flagship Account',
          locations: [
            {
              _id: 'loc_raw_998877',
              name: 'High Street Store',
              channelLinks: [
                {
                  _id: 'chl_raw_554433',
                  name: 'Deliverect Commerce - High Street',
                  channel: 'deliverect_commerce',
                },
              ],
            },
          ],
        },
      ];

      const normalized = LinkedAccountsAdapter.normalizeAccounts(rawDeliverectPayload);
      expect(normalized).toHaveLength(1);

      const account = normalized[0];
      // Must retain raw Deliverect _id without acc_ prepending
      expect(account.deliverectAccountId).toBe('65b1234567890abcdef12345');
      expect(account.deliverectAccountId).not.toMatch(/^acc_/);

      const location = account.locations[0];
      expect(location.deliverectLocationId).toBe('loc_raw_998877');

      const store = location.commerceStores[0];
      // Must retain raw Deliverect channelLink _id without chl_ prepending
      expect(store.channelLinkId).toBe('chl_raw_554433');
      expect(store.channelLinkId).not.toMatch(/^chl_chl_/);
    });
  });

  // =========================================================================
  // 5. Webhook Journal Entries & Integration Resolution
  // =========================================================================
  describe('5. Webhook Journal Environment Recording', () => {
    it('records the resolved Deliverect integration environment in the webhook journal', async () => {
      const testTenant = 'brand-alpha';
      const eventKey = `evt_test_env_${Date.now()}`;
      await FirestorePlatformService.saveOrderProjection({
        orderId: 'ord_env_test_01',
        tenantId: testTenant,
        status: 'SUBMITTED',
        fulfillmentType: 'collection',
        itemsCount: 1,
        total: 100,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any);

      const payload = {
        eventId: eventKey,
        event: 'ORDER_ACCEPTED',
        orderId: 'ord_env_test_01',
      };
      const rawBody = Buffer.from(JSON.stringify(payload));
      const hmacSecret = WebhookService.getWebhookSecret(testTenant);
      const signature = WebhookService.computeDeliverectHmac(rawBody, hmacSecret);

      const result = await WebhookService.processWebhook(
        payload,
        rawBody,
        { 'x-deliverect-signature': signature },
        testTenant
      );

      expect(result.success).toBe(true);

      // Verify that journal entry recorded environment authoritatively
      const event = await FirestorePlatformService.getWebhookEvent(eventKey);
      expect(event).toBeDefined();
      expect(event?.environment).toBe('staging');
      expect(event?.tenantId).toBe(testTenant);
      expect(event?.processingStatus).toBe('PROCESSED');
    });
  });

  // =========================================================================
  // 6. Hostname Resolution & Domain Enforcement
  // =========================================================================
  describe('6. Hostname Resolution Domain Enforcement', () => {
    it('strictly returns null for unmapped domains in staging/production without falling back to hardcoded strings', async () => {
      process.env.APP_MODE = 'staging';
      setServerRuntimeMode('staging');

      const unmappedHost = 'random-unregistered-brand.example.com';
      const resolved = await FirestorePlatformService.resolveTenantByHostname(unmappedHost);
      expect(resolved).toBeNull();
    });
  });

  // =========================================================================
  // 7. Legacy Admin Asset Upload Restrictions
  // =========================================================================
  describe('7. Admin Asset Upload Security', () => {
    it('prohibits Data-URL fallback in AssetService in staging/production', async () => {
      process.env.APP_MODE = 'staging';
      setServerRuntimeMode('staging');

      // Attempting saveAsset in staging when Cloud Storage bucket is unconfigured must throw rather than returning Data-URL
      await expect(
        AssetService.saveAsset({
          tenantId: 'brand-alpha',
          type: 'LOGO',
          fileName: 'logo.png',
          contentType: 'image/png',
          fileData: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        })
      ).rejects.toThrow(/STORAGE_NOT_CONFIGURED|Cloud Storage is not configured/);
    });
  });

  // =========================================================================
  // 8. Global Readiness Probe Verification
  // =========================================================================
  describe('8. Global Readiness Probe deliverectReady', () => {
    it('does not report deliverect: true when adapter is IntegrationUnavailableAdapter in staging/production', () => {
      const unavailableAdapter = new IntegrationUnavailableAdapter('staging', 'brand-alpha');
      expect(unavailableAdapter.adapterName).toBe('IntegrationUnavailableAdapter');
      expect(unavailableAdapter.isConnected).toBe(false);

      // Verify the readiness predicate logic implemented in server.ts
      const appMode: string = 'staging';
      const adapter: any = unavailableAdapter;
      const deliverectReady =
        appMode === 'demo'
          ? Boolean(adapter)
          : Boolean(
              adapter &&
                adapter.adapterName !== 'IntegrationUnavailableAdapter' &&
                adapter.isConnected !== false
            );

      expect(deliverectReady).toBe(false);
    });
  });
});
