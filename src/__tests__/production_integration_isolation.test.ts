import { describe, expect, it } from 'vitest';
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

describe('WP-10/11 production isolation foundations', () => {
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
});
