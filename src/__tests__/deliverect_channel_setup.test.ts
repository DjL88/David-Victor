import { beforeEach, describe, expect, it } from 'vitest';
import { buildDeliverectChannelEndpoints, DELIVERECT_CHANNEL_SETUP_STEPS } from '../commerce/deliverectChannelSetup';
import { ChannelProvisioningService } from '../../server/deliverect/ChannelProvisioningService';
import { FirestorePlatformService } from '../../server/firestoreService';
import { setServerRuntimeMode } from '../../server/runtimeMode';

describe('Deliverect Channel setup', () => {
  beforeEach(() => {
    setServerRuntimeMode('demo');
  });
  it('generates tenant-scoped provisioning URLs in Deliverect setup order', () => {
    const endpoints = buildDeliverectChannelEndpoints('https://example.test/', 'brand alpha');
    const byKey = Object.fromEntries(endpoints.map((endpoint) => [endpoint.key, endpoint]));

    expect(byKey.storeProvisioning.url).toBe(
      'https://example.test/api/v1/webhooks/deliverect/brand%20alpha/channel/provision'
    );
    expect(byKey.channelRegistration.url).toContain('/brand%20alpha/channel/register');
    expect(byKey.snooze.readiness).toBe('READY');
    expect(byKey.busyMode.readiness).toBe('READY');
    expect(byKey.substitutions.url).toBe(
      'https://example.test/api/v1/webhooks/deliverect/brand%20alpha/picking/substitutions'
    );
    expect(byKey.substitutions.url).not.toMatch(/[{}]/);
    expect(() => new URL(byKey.substitutions.url)).not.toThrow();
    expect(byKey.promotions.readiness).toBe('PENDING_CONTRACT');
    expect(DELIVERECT_CHANNEL_SETUP_STEPS.at(-1)).toMatch(/Register, then Activate/);
  });

  it('provisions a store when stable identifiers are present', async () => {
    const tenantId = `tenant-channel-provision-${Date.now()}`;
    const result = await ChannelProvisioningService.process(
      tenantId,
      'STORE_PROVISION',
      {
        channelLinkId: 'channel-123',
        locationId: 'location-456',
        externalLocationId: 'external-789',
      }
    );

    expect(result).toMatchObject({
      accepted: true,
      quarantined: false,
      channelLinkId: 'channel-123',
      locationId: 'location-456',
    });

    const stores = await FirestorePlatformService.getTenantStores(tenantId);
    const store = stores.find((item) => item.channelLinkId === 'channel-123');
    expect(store).toMatchObject({
      lifecycleStatus: 'ACTIVE',
      provisioningState: 'PROVISIONED',
      deliverectLocationId: 'location-456',
      externalLocationId: 'external-789',
    });
  });

  it('acknowledges incomplete provisioning data into quarantine instead of crashing', async () => {
    const tenantId = `tenant-channel-quarantine-${Date.now()}`;
    const result = await ChannelProvisioningService.process(
      tenantId,
      'CHANNEL_REGISTRATION',
      { externalLocationId: 'known-external-only' }
    );

    expect(result.accepted).toBe(true);
    expect(result.quarantined).toBe(true);
    expect(result.warnings).toContain('CHANNEL_LINK_ID_MISSING');
    expect(result.warnings).toContain('LOCATION_ID_MISSING');
  });
});
