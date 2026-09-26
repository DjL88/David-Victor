import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DPAY_IMPLEMENTED_CAPABILITIES,
} from '../../server/deliverect/DPayAdapter';
import {
  assertPaymentProviderCapability,
  resolvePaymentProviderContext,
} from '../../server/deliverect/PaymentProviderRegistry';
import { DeliverectDPayAdapter } from '../../server/deliverect/DeliverectDPayAdapter';
import { FirestorePlatformService } from '../../server/firestoreService';
import { IntegrationContext } from '../../server/deliverect/IntegrationContext';
import { setServerRuntimeMode } from '../../server/runtimeMode';

describe('Round 2 payment provider framework', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalRequired = process.env.INTEGRATION_PROFILE_REQUIRED;

  beforeEach(() => {
    vi.restoreAllMocks();
    setServerRuntimeMode('staging');
    process.env.DELIVERECT_ENV = 'staging';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setServerRuntimeMode(null);
    process.env.NODE_ENV = originalNodeEnv;
    if (originalRequired === undefined) delete process.env.INTEGRATION_PROFILE_REQUIRED;
    else process.env.INTEGRATION_PROFILE_REQUIRED = originalRequired;
    delete process.env.DELIVERECT_ENV;
  });

  it('publishes immutable verified capabilities and rejects unsupported operations', () => {
    expect(DPAY_IMPLEMENTED_CAPABILITIES.gatewayDiscovery).toBe(true);
    expect(DPAY_IMPLEMENTED_CAPABILITIES.tokenizedAuthorization).toBe(true);
    expect(DPAY_IMPLEMENTED_CAPABILITIES.paymentStatus).toBe(true);
    expect(DPAY_IMPLEMENTED_CAPABILITIES.refunds).toBe(true);
    expect(DPAY_IMPLEMENTED_CAPABILITIES.manualCapture).toBe(false);
    expect(DPAY_IMPLEMENTED_CAPABILITIES.voidAuthorization).toBe(false);
    expect(DPAY_IMPLEMENTED_CAPABILITIES.reauthorization).toBe(false);
    expect(DPAY_IMPLEMENTED_CAPABILITIES.webhookStatusUpdates).toBe(false);
    expect(DPAY_IMPLEMENTED_CAPABILITIES.idempotentAuthorization).toBe(false);
    expect(Object.isFrozen(DPAY_IMPLEMENTED_CAPABILITIES)).toBe(true);

    expect(() =>
      assertPaymentProviderCapability(
        { capabilities: DPAY_IMPLEMENTED_CAPABILITIES },
        'manualCapture'
      )
    ).toThrow(/not verified by LTx/i);
  });

  it('resolves the provider only from the active tenant environment profile', async () => {
    vi.spyOn(FirestorePlatformService, 'getIntegrationConfig').mockResolvedValue({
      tenantId: 'tenant-a',
      environment: 'staging',
      activeEnv: 'staging',
    } as any);
    vi.spyOn(FirestorePlatformService, 'getIntegrationProfile').mockResolvedValue({
      id: 'tenant-a__staging',
      tenantId: 'tenant-a',
      environment: 'staging',
      status: 'ACTIVE',
      version: 1,
      publicBaseUrl: 'https://tenant.example.test',
      credentialMode: 'platform',
      allowedChannelLinkIds: ['channel-a'],
      deliverect: {},
      dpay: { enabled: true, environment: 'staging' },
      secretRefs: {},
    });

    const resolved = await resolvePaymentProviderContext('tenant-a');

    expect(resolved.providerId).toBe('deliverect_dpay');
    expect(resolved.environment).toBe('staging');
    expect(resolved.profileConfigured).toBe(true);
    expect(resolved.returnOrigins).toEqual(['https://tenant.example.test']);
  });

  it('fails closed when a live tenant has no enabled provider in a required profile', async () => {
    process.env.NODE_ENV = 'production';
    process.env.INTEGRATION_PROFILE_REQUIRED = 'true';

    vi.spyOn(FirestorePlatformService, 'getIntegrationConfig').mockResolvedValue({
      tenantId: 'tenant-a',
      environment: 'staging',
      activeEnv: 'staging',
    } as any);
    vi.spyOn(FirestorePlatformService, 'getIntegrationProfile').mockResolvedValue({
      id: 'tenant-a__staging',
      tenantId: 'tenant-a',
      environment: 'staging',
      status: 'ACTIVE',
      version: 1,
      credentialMode: 'platform',
      allowedChannelLinkIds: [],
      deliverect: {},
      dpay: { enabled: false, environment: 'staging' },
      secretRefs: {},
    });

    await expect(resolvePaymentProviderContext('tenant-a')).rejects.toThrow(
      /No supported payment provider is enabled/i
    );
  });

  it('wires the real DPay adapter through tenant provider resolution before outbound discovery', async () => {
    process.env.NODE_ENV = 'production';
    process.env.INTEGRATION_PROFILE_REQUIRED = 'true';

    const profile = {
      id: 'tenant-a__staging',
      tenantId: 'tenant-a',
      environment: 'staging' as const,
      status: 'ACTIVE' as const,
      version: 1,
      credentialMode: 'platform' as const,
      allowedChannelLinkIds: ['channel-a'],
      deliverect: {},
      dpay: { enabled: true, environment: 'staging' as const },
      secretRefs: {},
    };
    const profileSpy = vi
      .spyOn(FirestorePlatformService, 'getIntegrationProfile')
      .mockResolvedValue(profile);
    vi.spyOn(FirestorePlatformService, 'getIntegrationConfig').mockResolvedValue({
      tenantId: 'tenant-a',
      environment: 'staging',
      activeEnv: 'staging',
    } as any);
    vi.spyOn(IntegrationContext, 'assertConfigured').mockResolvedValue({
      tokenManager: {
        getAuthorizationHeader: vi.fn().mockResolvedValue('Bearer test'),
        invalidateCache: vi.fn(),
      },
    } as any);

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify([{ id: 'gw-1', paymentType: 'online' }]),
    } as Response);

    const adapter = new DeliverectDPayAdapter('tenant-a', 'staging');
    const gateways = await adapter.getPaymentGateways('channel-a');

    expect(profileSpy).toHaveBeenCalledWith('tenant-a', 'staging');
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.staging.deliverect.com/pay/channel/channel-a/gatewayProfiles',
      expect.any(Object)
    );
    expect(gateways[0]?.id).toBe('gw-1');
  });
});
