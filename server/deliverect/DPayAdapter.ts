import {
  DPayPaymentRequest,
  DPayPaymentResponse,
  PaymentGatewayProfile,
} from '../../src/domain/models';

export type PaymentProviderId = 'deliverect_dpay';

export type PaymentProviderOperation =
  | 'gatewayDiscovery'
  | 'tokenizedAuthorization'
  | 'paymentStatus'
  | 'manualCapture'
  | 'voidAuthorization'
  | 'refunds'
  | 'reauthorization'
  | 'webhookStatusUpdates';

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

export interface DPayAdapter extends PaymentGatewayAdapter {}
