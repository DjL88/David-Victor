import {
  DPayPaymentRequest,
  DPayPaymentResponse,
  PaymentGatewayProfile,
} from '../../src/domain/models';

export type PaymentProviderId = 'deliverect_dpay';

export interface PaymentGatewayCapabilities {
  gatewayDiscovery: boolean;
  tokenizedAuthorization: boolean;
  hostedCheckout: boolean;
  paymentStatus: boolean;
  manualCapture: boolean;
  voidAuthorization: boolean;
  refunds: boolean;
  reauthorization: boolean;
  webhookStatusUpdates: boolean;
  idempotentAuthorization: boolean;
}

/**
 * Capabilities describe operations LTx has actually implemented and verified.
 * They are platform-owned facts, not tenant-editable feature switches.
 */
export const DPAY_IMPLEMENTED_CAPABILITIES: Readonly<PaymentGatewayCapabilities> =
  Object.freeze({
    gatewayDiscovery: true,
    tokenizedAuthorization: true,
    hostedCheckout: false,
    paymentStatus: true,
    manualCapture: false,
    voidAuthorization: false,
    refunds: true,
    reauthorization: false,
    webhookStatusUpdates: false,
    idempotentAuthorization: false,
  });

/**
 * Provider-neutral lifecycle contract. Deliverect Pay is the first approved
 * implementation; unsupported capabilities must fail closed rather than being
 * inferred from provider marketing or undocumented endpoints.
 */
export interface PaymentGatewayAdapter {
  readonly adapterName: string;

  getPaymentGateways(channelLinkId: string): Promise<PaymentGatewayProfile[]>;
  requestPayment(request: DPayPaymentRequest): Promise<DPayPaymentResponse>;
  getPayment(paymentId: string): Promise<DPayPaymentResponse>;
  capture(paymentId: string, finalAmountMinor: number): Promise<DPayPaymentResponse>;
  voidAuthorization(paymentId: string, reason?: string): Promise<DPayPaymentResponse>;
  refund(paymentId: string, refundAmountMinor: number, reason?: string): Promise<DPayPaymentResponse>;
  reauthorize(paymentId: string, additionalAmountMinor: number): Promise<DPayPaymentResponse>;
}

/** @deprecated Prefer PaymentGatewayAdapter for provider-neutral code. */
export interface DPayAdapter extends PaymentGatewayAdapter {}
