import { FirestorePlatformService } from '../firestoreService';
import { CommerceError, ErrorCode } from '../errors';
import { getServerRuntimeMode } from '../runtimeMode';
import { normalizeIntegrationEnvironment, type IntegrationEnvironment, type TenantIntegrationProfile } from '../integrationProfile';
import { DPAY_IMPLEMENTED_CAPABILITIES, type PaymentGatewayCapabilities, type PaymentProviderId, type PaymentProviderOperation } from './DPayAdapter';

const TEST_CAPABILITIES: Readonly<PaymentGatewayCapabilities> = Object.freeze({
  gatewayDiscovery: true,
  tokenizedAuthorization: true,
  hostedCheckout: false,
  paymentStatus: true,
  manualCapture: true,
  voidAuthorization: true,
  refunds: true,
  reauthorization: true,
  webhookStatusUpdates: false,
  idempotentAuthorization: false,
});

export interface PaymentProviderContext {
  tenantId: string;
  providerId: PaymentProviderId;
  environment: IntegrationEnvironment;
  capabilities: Readonly<PaymentGatewayCapabilities>;
  returnOrigins: readonly string[];
  profileConfigured: boolean;
  selectionSource: 'tenant_profile' | 'legacy_dpay_default' | 'test_demo';
}

const OPERATION_CAPABILITY: Record<PaymentProviderOperation, keyof PaymentGatewayCapabilities> = {
  gatewayDiscovery: 'gatewayDiscovery',
  tokenizedAuthorization: 'tokenizedAuthorization',
  paymentStatus: 'paymentStatus',
  manualCapture: 'manualCapture',
  voidAuthorization: 'voidAuthorization',
  refunds: 'refunds',
  reauthorization: 'reauthorization',
  webhookStatusUpdates: 'webhookStatusUpdates',
};

function providerSelection(profile: TenantIntegrationProfile | null): {
  providerId: PaymentProviderId | null;
  source: PaymentProviderContext['selectionSource'];
} {
  if (profile?.dpay?.enabled === false) {
    return { providerId: null, source: 'tenant_profile' };
  }
  if (profile?.dpay?.enabled === true) {
    return { providerId: 'deliverect_dpay', source: 'tenant_profile' };
  }
  if (profile?.status === 'ACTIVE') {
    return { providerId: 'deliverect_dpay', source: 'legacy_dpay_default' };
  }
  return { providerId: null, source: 'legacy_dpay_default' };
}

function resolveReturnOrigins(profile: TenantIntegrationProfile | null): readonly string[] {
  if (!profile?.publicBaseUrl) return Object.freeze([]);
  const parsed = new URL(profile.publicBaseUrl);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    throw new CommerceError(ErrorCode.INTEGRATION_NOT_CONFIGURED, 'Payment return origin is not a trusted HTTPS origin.', 503);
  }
  return Object.freeze([parsed.origin]);
}

export async function resolvePaymentProviderContext(tenantId: string, requestedEnvironment?: string): Promise<PaymentProviderContext> {
  const cleanTenantId = String(tenantId || '').trim();
  if (!cleanTenantId || cleanTenantId === 'default') {
    throw new CommerceError(ErrorCode.INVALID_INPUT, 'An explicit tenantId is required to resolve a payment provider.', 400);
  }

  const integration = await FirestorePlatformService.getIntegrationConfig(cleanTenantId).catch(() => null);
  const environment = normalizeIntegrationEnvironment(
    requestedEnvironment ||
      integration?.activeEnv ||
      integration?.environment ||
      process.env.DELIVERECT_ENV ||
      'staging'
  );

  const profile = await FirestorePlatformService.getIntegrationProfile(cleanTenantId, environment).catch((error) => {
    if (process.env.NODE_ENV === 'test' || getServerRuntimeMode() === 'demo') return null;
    throw error;
  });

  const testOrDemo = process.env.NODE_ENV === 'test' || getServerRuntimeMode() === 'demo';
  if (profile && profile.status !== 'ACTIVE' && !testOrDemo) {
    throw new CommerceError(ErrorCode.INTEGRATION_NOT_CONFIGURED, 'Payment integration profile is not active.', 503);
  }

  const selection = providerSelection(profile);
  if (!selection.providerId) {
    if (!testOrDemo && process.env.INTEGRATION_PROFILE_REQUIRED === 'true') {
      throw new CommerceError(ErrorCode.INTEGRATION_NOT_CONFIGURED, 'No supported payment provider is enabled for this tenant environment.', 503);
    }
    return {
      tenantId: cleanTenantId,
      providerId: 'deliverect_dpay',
      environment,
      capabilities: testOrDemo ? TEST_CAPABILITIES : DPAY_IMPLEMENTED_CAPABILITIES,
      returnOrigins: Object.freeze([]),
      profileConfigured: false,
      selectionSource: testOrDemo ? 'test_demo' : 'legacy_dpay_default',
    };
  }

  return {
    tenantId: cleanTenantId,
    providerId: selection.providerId,
    environment,
    capabilities: DPAY_IMPLEMENTED_CAPABILITIES,
    returnOrigins: resolveReturnOrigins(profile),
    profileConfigured: true,
    selectionSource: selection.source,
  };
}

export function assertPaymentProviderCapability(
  context: Pick<PaymentProviderContext, 'capabilities'>,
  operation: PaymentProviderOperation
): void {
  const capability = OPERATION_CAPABILITY[operation];
  if (!context.capabilities[capability]) {
    throw new CommerceError(
      ErrorCode.INTEGRATION_CAPABILITY_NOT_IMPLEMENTED,
      'Configured payment provider operation is not verified by LTx.',
      501
    );
  }
}
