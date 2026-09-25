import { beforeEach, describe, expect, it } from 'vitest';
import { buildDeliverectChannelEndpoints, DELIVERECT_CHANNEL_SETUP_STEPS, resolveDeliverectCallbackOrigin } from '../commerce/deliverectChannelSetup';
import { detectDeliveryMarketplace, marketplaceForStore } from '../commerce/deliveryMarketplace';
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
    expect(byKey.channelRegistration.url).toBe(
      'https://example.test/api/v1/webhooks/deliverect/channel/register'
    );
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

  it('uses the trusted configured callback origin instead of the browser runtime', () => {
    expect(resolveDeliverectCallbackOrigin(undefined, 'https://tenant.example')).toBe('https://ltx.wtf');
    expect(resolveDeliverectCallbackOrigin('https://custom.example/', 'https://tenant.example')).toBe('https://custom.example');
    expect(resolveDeliverectCallbackOrigin('https://custom.example/')).toBe('https://custom.example');
  });

  it('recognises display-only marketplaces without confusing them with LT channels', () => {
    expect(detectDeliveryMarketplace('Deliveroo').key).toBe('deliveroo');
    expect(detectDeliveryMarketplace('Uber Eats').isThirdPartyMarketplace).toBe(true);
    expect(detectDeliveryMarketplace('JustEat').key).toBe('just-eat');
    expect(detectDeliveryMarketplace('Leitch Technology').isLeitchTech).toBe(true);
    expect(marketplaceForStore({
      channelLinkId: 'channel-deliveroo',
      services: [{ id: 'channel-deliveroo', name: 'Deliveroo', source: 'DELIVERECT' }],
    }).key).toBe('deliveroo');
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
  it('tracks Deliverect register, activate and disable lifecycle events without losing tenant ownership', async () => {
    const tenantId = `tenant-channel-lifecycle-${Date.now()}`;
    const channelLinkId = 'channel-life-123';

    const registered = await ChannelProvisioningService.process(
      tenantId,
      'CHANNEL_REGISTRATION',
      {
        accountId: 'account-123',
        channelLinkId,
        locationId: 'location-456',
        channelLocationId: 'external-789',
        status: 'register',
      }
    );
    expect(registered.channelStatus).toBe('REGISTERED');

    let stores = await FirestorePlatformService.getTenantStores(tenantId);
    expect(stores.find((store) => store.channelLinkId === channelLinkId)).toMatchObject({
      lifecycleStatus: 'INACTIVE',
      provisioningState: 'REGISTERED',
      externalLocationId: 'external-789',
      assigned: true,
    });

    await ChannelProvisioningService.process(
      tenantId,
      'CHANNEL_REGISTRATION',
      {
        channelLinkId,
        locationId: 'location-456',
        channelLocationId: 'external-789',
        status: 'active',
      }
    );
    stores = await FirestorePlatformService.getTenantStores(tenantId);
    expect(stores.find((store) => store.channelLinkId === channelLinkId)).toMatchObject({
      lifecycleStatus: 'ACTIVE',
      provisioningState: 'ACTIVE',
      assigned: true,
    });

    await ChannelProvisioningService.process(
      tenantId,
      'CHANNEL_REGISTRATION',
      {
        channelLinkId,
        locationId: 'location-456',
        channelLocationId: 'external-789',
        status: 'inactive',
      }
    );
    stores = await FirestorePlatformService.getTenantStores(tenantId);
    expect(stores.find((store) => store.channelLinkId === channelLinkId)).toMatchObject({
      lifecycleStatus: 'INACTIVE',
      provisioningState: 'INACTIVE',
      assigned: true,
    });
  });

});
