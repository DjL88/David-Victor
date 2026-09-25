import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assertProductionFirebaseIsolation,
  resolveFirebaseRuntimeTarget,
} from '../../server/firebaseTarget';
import {
  assertTenantEnvironmentAllowed,
  integrationProfileId,
  integrationSecretPrefix,
  validateIntegrationProfile,
  type TenantIntegrationProfile,
} from '../../server/integrationProfile';
import { resolveClientFirebaseConfig } from '../firebaseClientConfig';
import { DeliverectDPayAdapter } from '../../server/deliverect/DeliverectDPayAdapter';
import { FirestorePlatformService } from '../../server/firestoreService';

describe('WP-10/11 production isolation foundations', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.INTEGRATION_PROFILE_REQUIRED;
  });
  it('prefers deployment Firebase targets over the legacy AI Studio file', () => {
    const target = resolveFirebaseRuntimeTarget(
      {
        projectId: 'hi-domino-d0abb',
        storageBucket: 'hi-domino-d0abb.firebasestorage.app',
        firestoreDatabaseId: 'legacy-db',
      },
      {
        FIREBASE_PROJECT_ID: 'lt-prod',
        FIREBASE_STORAGE_BUCKET: 'lt-prod.firebasestorage.app',
        FIRESTORE_DATABASE_ID: '(default)',
      }
    );

    expect(target).toMatchObject({
      projectId: 'lt-prod',
      storageBucket: 'lt-prod.firebasestorage.app',
      firestoreDatabaseId: '(default)',
      source: 'environment',
    });
  });

  it('rejects a partially configured deployment target instead of mixing it with the applet file', () => {
    expect(() =>
      resolveFirebaseRuntimeTarget(
        {
          projectId: 'hi-domino-d0abb',
          storageBucket: 'hi-domino-d0abb.firebasestorage.app',
          firestoreDatabaseId: 'legacy-db',
        },
        { FIREBASE_PROJECT_ID: 'lt-prod' }
      )
    ).toThrow(/target is incomplete/i);
  });

  it('fails closed if production still resolves to the legacy personal Firebase project', () => {
    const target = resolveFirebaseRuntimeTarget(
      { projectId: 'hi-domino-d0abb' },
      { APP_MODE: 'production' }
    );

    expect(() =>
      assertProductionFirebaseIsolation(target, { APP_MODE: 'production' })
    ).toThrow(/refuses legacy Firebase project/i);

    expect(() =>
      assertProductionFirebaseIsolation(target, { APP_MODE: 'staging' })
    ).not.toThrow();
  });

  it('allows deployment-specific browser Firebase config to override the checked-in preview fallback', () => {
    const config = resolveClientFirebaseConfig({
      VITE_FIREBASE_PROJECT_ID: 'lt-prod',
      VITE_FIREBASE_AUTH_DOMAIN: 'auth.leitch.tech',
      VITE_FIREBASE_STORAGE_BUCKET: 'lt-prod.firebasestorage.app',
      VITE_FIREBASE_API_KEY: 'public-web-key',
      VITE_FIREBASE_APP_ID: 'prod-app-id',
      VITE_FIREBASE_MESSAGING_SENDER_ID: '123',
    });

    expect(config).toMatchObject({
      projectId: 'lt-prod',
      authDomain: 'auth.leitch.tech',
      storageBucket: 'lt-prod.firebasestorage.app',
      apiKey: 'public-web-key',
      appId: 'prod-app-id',
      messagingSenderId: '123',
    });
  });

  it('fails closed when a production browser build would fall back to preview Firebase', () => {
    expect(() =>
      resolveClientFirebaseConfig({
        VITE_APP_MODE: 'production',
      })
    ).toThrow(/must be supplied by deployment configuration/i);

    expect(() =>
      resolveClientFirebaseConfig({
        VITE_APP_MODE: 'production',
        VITE_FIREBASE_PROJECT_ID: 'hi-domino-d0abb',
      })
    ).toThrow(/refuses legacy Firebase project/i);
  });

  it('production deployment config requires MFA and App Check against the dedicated client project', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const yaml = fs.readFileSync(
      path.resolve(process.cwd(), 'apphosting.production.yaml'),
      'utf8'
    );

    expect(yaml).toContain('variable: ADMIN_REQUIRE_MFA');
    expect(yaml).toContain('variable: ADMIN_REQUIRE_APP_CHECK');
    expect(yaml).toContain('variable: CHECKOUT_REQUIRE_APP_CHECK');
    expect(yaml).toContain('variable: VITE_FIREBASE_APPCHECK_SITE_KEY');
    expect(yaml).toContain('secret: firebase_appcheck_site_key');
    expect(yaml).toContain('variable: VITE_FIREBASE_PROJECT_ID');
    expect(yaml).toContain('secret: firebase_project_id');
    expect(yaml).toContain('variable: TRUSTED_EDGE_SECRET');
    expect(yaml).toContain('secret: trusted_edge_secret');
  });

  it('uses tenant plus environment as the integration profile identity and deployment guard', () => {
    expect(integrationProfileId('brand-alpha', 'staging')).toBe(
      'brand-alpha__staging'
    );
    expect(integrationSecretPrefix('Brand Alpha', 'production')).toBe(
      'lt--brand-alpha--production--'
    );
    expect(() =>
      assertTenantEnvironmentAllowed('production', 'staging')
    ).toThrow(/not allowed/i);
    expect(() =>
      assertTenantEnvironmentAllowed('production', 'staging,production')
    ).not.toThrow();
  });

  it('validates active profiles without allowing tenant or environment drift', () => {
    const profile: TenantIntegrationProfile = {
      id: 'brand-alpha__production',
      tenantId: 'brand-alpha',
      environment: 'production',
      status: 'ACTIVE',
      version: 1,
      publicBaseUrl: 'https://integrations.leitch.tech',
      credentialMode: 'dedicated',
      allowedChannelLinkIds: ['channel-a', 'channel-a', 'channel-b'],
      deliverect: {
        accountId: 'account-a',
        channelName: 'leitchtech',
        orderRoute: 'retail_quest',
      },
      dpay: {
        enabled: false,
        environment: 'production',
      },
      secretRefs: {
        deliverectClientId: 'lt--brand-alpha--production--deliverect-client-id',
        deliverectClientSecret:
          'lt--brand-alpha--production--deliverect-client-secret',
        deliverectWebhookSecret:
          'lt--brand-alpha--production--deliverect-webhook-secret',
      },
    };

    const validated = validateIntegrationProfile(
      profile,
      'brand-alpha',
      'production'
    );
    expect(validated.allowedChannelLinkIds).toEqual(['channel-a', 'channel-b']);

    expect(() =>
      validateIntegrationProfile(profile, 'other-tenant', 'production')
    ).toThrow(/tenant/i);
    expect(() =>
      validateIntegrationProfile(profile, 'brand-alpha', 'staging')
    ).toThrow(/environment/i);
  });

  it('rejects cross-environment secret references and DPay environment drift', () => {
    const base: TenantIntegrationProfile = {
      id: 'brand-alpha__production',
      tenantId: 'brand-alpha',
      environment: 'production',
      status: 'ACTIVE',
      version: 1,
      credentialMode: 'dedicated',
      allowedChannelLinkIds: [],
      deliverect: {},
      secretRefs: {
        deliverectClientId: 'lt--brand-alpha--production--client-id',
      },
    };

    expect(() =>
      validateIntegrationProfile({
        ...base,
        secretRefs: {
          deliverectClientId: 'lt--brand-alpha--staging--client-id',
        },
      })
    ).toThrow(/must be scoped/i);

    expect(() =>
      validateIntegrationProfile({
        ...base,
        dpay: {
          enabled: true,
          environment: 'staging',
          baseUrl: 'https://api.staging.deliverect.com',
        },
      })
    ).toThrow(/DPay environment must match/i);
  });

  it('resolves DPay host from the active tenant profile instead of APP_MODE', async () => {
    vi.spyOn(FirestorePlatformService, 'getIntegrationConfig').mockResolvedValue({
      tenantId: 'brand-alpha',
      environment: 'production',
      activeEnv: 'production',
      status: 'CONNECTED',
    } as any);
    vi.spyOn(FirestorePlatformService, 'getIntegrationProfile').mockResolvedValue({
      id: 'brand-alpha__production',
      tenantId: 'brand-alpha',
      environment: 'production',
      status: 'ACTIVE',
      version: 1,
      credentialMode: 'dedicated',
      allowedChannelLinkIds: [],
      deliverect: {},
      dpay: {
        enabled: true,
        environment: 'production',
        baseUrl: 'https://pay.example.test/custom',
      },
      secretRefs: {},
    } as any);

    const adapter = new DeliverectDPayAdapter('brand-alpha', 'staging');
    await expect((adapter as any).getBaseUrl()).resolves.toBe(
      'https://pay.example.test/custom'
    );
  });

  it('fails DPay closed when production requires an active tenant profile', async () => {
    process.env.INTEGRATION_PROFILE_REQUIRED = 'true';
    vi.spyOn(FirestorePlatformService, 'getIntegrationConfig').mockResolvedValue({
      tenantId: 'brand-alpha',
      environment: 'production',
      activeEnv: 'production',
      status: 'CONNECTED',
    } as any);
    vi.spyOn(FirestorePlatformService, 'getIntegrationProfile').mockResolvedValue(null);

    const adapter = new DeliverectDPayAdapter('brand-alpha', 'production');
    await expect((adapter as any).getBaseUrl()).rejects.toMatchObject({
      code: 'INTEGRATION_NOT_CONFIGURED',
      statusCode: 503,
    });
  });
});
