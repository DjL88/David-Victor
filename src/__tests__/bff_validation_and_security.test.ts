import { describe, it, expect, beforeEach } from 'vitest';
import { BFFError } from '../../server/errors';
import { SecretManager } from '../../server/secrets';
import {
  ResolveLocationSchema,
  SearchStoresSchema,
  CreateBasketSchema,
  UpdateBasketItemSchema,
  CheckoutBasketSchema,
  CreateTenantSchema,
  UpdateFeePolicySchema,
  TestConnectionSchema,
} from '../../server/api/schemas';
import { verifyAdminSession } from '../../server/firebase';
import { FirestorePlatformService } from '../../server/firestoreService';

describe('BFF Request Validation & Schemas (Phase 2)', () => {
  it('validates ResolveLocationSchema correctly', () => {
    const valid = ResolveLocationSchema.safeParse({ query: 'SW1A 1AA' });
    expect(valid.success).toBe(true);

    const invalidEmpty = ResolveLocationSchema.safeParse({ query: '' });
    expect(invalidEmpty.success).toBe(false);

    const missingQuery = ResolveLocationSchema.safeParse({});
    expect(missingQuery.success).toBe(false);
  });

  it('validates SearchStoresSchema coordinates and fulfillment requirements', () => {
    const valid = SearchStoresSchema.safeParse({
      coordinates: { latitude: 51.5074, longitude: -0.1278 },
      preferredFulfillment: 'delivery',
    });
    expect(valid.success).toBe(true);

    const invalidCoords = SearchStoresSchema.safeParse({
      coordinates: { latitude: 'invalid', longitude: -0.1278 },
    });
    expect(invalidCoords.success).toBe(false);

    const invalidFulfillment = SearchStoresSchema.safeParse({
      coordinates: { latitude: 51.5, longitude: -0.1 },
      preferredFulfillment: 'teleport',
    });
    expect(invalidFulfillment.success).toBe(false);
  });

  it('validates CreateBasketSchema requiring storeId', () => {
    const valid = CreateBasketSchema.safeParse({
      storeId: 'store-covent-garden',
      fulfillmentType: 'delivery',
    });
    expect(valid.success).toBe(true);

    const missingStore = CreateBasketSchema.safeParse({
      fulfillmentType: 'collection',
    });
    expect(missingStore.success).toBe(false);
  });

  it('validates UpdateBasketItemSchema for quantity constraints', () => {
    const valid = UpdateBasketItemSchema.safeParse({
      productId: 'PROD-MILK',
      quantity: 3,
    });
    expect(valid.success).toBe(true);

    const negativeQty = UpdateBasketItemSchema.safeParse({
      productId: 'PROD-MILK',
      quantity: -1,
    });
    expect(negativeQty.success).toBe(false);
  });

  it('validates CheckoutBasketSchema requiring basketId and options', () => {
    const valid = CheckoutBasketSchema.safeParse({
      basketId: 'b-12345',
      options: {
        customerName: 'Jane Doe',
        customerEmail: 'jane@example.com',
        fulfillmentType: 'delivery',
      },
    });
    expect(valid.success).toBe(true);

    const invalidEmail = CheckoutBasketSchema.safeParse({
      basketId: 'b-12345',
      options: {
        customerName: 'Jane Doe',
        customerEmail: 'not-an-email',
      },
    });
    expect(invalidEmail.success).toBe(false);
  });

  it('validates CreateTenantSchema for provisioning new multi-tenant brands', () => {
    const valid = CreateTenantSchema.safeParse({
      tenantId: 'brand-gamma',
      brandName: 'Gamma Retail',
      primaryColor: '#10b981',
      country: 'GB',
    });
    expect(valid.success).toBe(true);

    const missingName = CreateTenantSchema.safeParse({
      tenantId: 'brand-gamma',
    });
    expect(missingName.success).toBe(false);
  });

  it('validates UpdateFeePolicySchema ensuring non-negative amounts', () => {
    const valid = UpdateFeePolicySchema.safeParse({
      deliveryFee: 299,
      freeDeliveryThreshold: 4000,
      smallOrderFeeEnabled: true,
      smallOrderThreshold: 1500,
      smallOrderFee: 199,
    });
    expect(valid.success).toBe(true);

    const negativeFee = UpdateFeePolicySchema.safeParse({
      deliveryFee: -50,
    });
    expect(negativeFee.success).toBe(false);
  });

  it('validates TestConnectionSchema requiring accountId', () => {
    const valid = TestConnectionSchema.safeParse({
      deliverectAccountId: 'acc-dlv-9988',
      environment: 'staging',
    });
    expect(valid.success).toBe(true);

    const missingAccountId = TestConnectionSchema.safeParse({
      environment: 'staging',
    });
    expect(missingAccountId.success).toBe(false);
  });
});

describe('Typed Errors and Secret Manager (Phase 2)', () => {
  it('constructs typed BFFError with code, status and correlation requestId', () => {
    const err = new BFFError(
      'INTEGRATION_NOT_CONFIGURED',
      'Deliverect integration credentials are not configured for this environment.',
      503,
      false,
      { environment: 'staging' },
      'req-abc-123'
    );

    expect(err.statusCode).toBe(503);
    expect(err.code).toBe('INTEGRATION_NOT_CONFIGURED');
    expect(err.safeMessage).toBe('Deliverect integration credentials are not configured for this environment.');
    expect(err.retryable).toBe(false);
    expect(err.requestId).toBe('req-abc-123');

    const payload = err.toPayload();
    expect(payload.code).toBe('INTEGRATION_NOT_CONFIGURED');
    expect(payload.requestId).toBe('req-abc-123');
    expect(payload.details).toEqual({ environment: 'staging' });
  });

  it('SecretManager handles present secrets and throws typed BFFError for missing required secrets', async () => {
    process.env.TEST_EXISTING_SECRET = 'super-secret-key-123';
    SecretManager.clearCache();
    const val = await SecretManager.getSecret('TEST_EXISTING_SECRET');
    expect(val).toBe('super-secret-key-123');

    await expect(
      SecretManager.getRequiredSecret('DEFINITELY_MISSING_SECRET_XYZ')
    ).rejects.toThrow(BFFError);
  });
});

describe('Firebase Auth & Tenant RBAC (Phase 3)', () => {
  it('rejects unauthenticated requests without authorization header', async () => {
    const user = await verifyAdminSession(undefined, 'brand-alpha');
    expect(user).toBeNull();
  });

  it('rejects invalid or forged authorization tokens', async () => {
    const user = await verifyAdminSession('Bearer invalid-forged-token-xyz', 'brand-alpha');
    expect(user).toBeNull();
  });

  it('authorizes platformSuperAdmin across any requested tenant', async () => {
    const superAdmin = await verifyAdminSession('Bearer dev_token_superadmin', 'brand-alpha');
    expect(superAdmin).not.toBeNull();
    expect(superAdmin?.role).toBe('platformSuperAdmin');
    expect(superAdmin?.isSuperAdmin).toBe(true);
  });

  it('correctly maps tenantAdmin to their authoritative tenant boundary', async () => {
    const tenantAdmin = await verifyAdminSession('Bearer dev_token_admin', 'brand-alpha');
    expect(tenantAdmin).not.toBeNull();
    expect(tenantAdmin?.role).toBe('tenantAdmin');
    expect(tenantAdmin?.tenantId).toBe('brand-alpha');
  });

  it('records structured audit logs with actor and category', async () => {
    const tenantId = 'brand-alpha';
    const auditRecord = await FirestorePlatformService.addAuditLog(tenantId, {
      userId: 'test-admin-uid',
      userName: 'Test Admin',
      userRole: 'tenantAdmin',
      tenantId,
      category: 'Branding',
      action: 'UPDATE_BRANDING_TEST',
      details: 'Updated test primary color',
    });

    expect(auditRecord).toBeDefined();
    expect(auditRecord.action).toBe('UPDATE_BRANDING_TEST');
    expect(auditRecord.tenantId).toBe(tenantId);

    const logs = await FirestorePlatformService.getAuditLogs(tenantId);
    const found = logs.find((l) => l.action === 'UPDATE_BRANDING_TEST');
    expect(found).toBeDefined();
  });
});
