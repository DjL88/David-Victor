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
 * Capabilities describe the operations implemented and verified by LTx, not
 * every feature an upstream payment provider may offer.
 */
export const DPAY_IMPLEMENTED_CAPABILITIES: PaymentGatewayCapabilities = {
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
};

/**
 * Provider-neutral lifecycle contract. DPay remains one implementation while
 * checkout and settlement can migrate away from provider-specific selection.
 */
export interface PaymentGatewayAdapter {
  readonly adapterName: string;

  /**
   * Retrieves configured payment gateway profiles for a given store/channel link (PAY-01).
   */
  getPaymentGateways(channelLinkId: string): Promise<PaymentGatewayProfile[]>;

  /**
   * Authorizes a payment using a tokenized payment method (PAY-02, PAY-04, PAY-06).
   * Browser must send token/tokenId; raw PAN/CVC is strictly forbidden.
   */
  requestPayment(request: DPayPaymentRequest): Promise<DPayPaymentResponse>;

  /**
   * Retrieves payment status and authorization/capture details.
   */
  getPayment(paymentId: string): Promise<DPayPaymentResponse>;

  /**
   * Captures an authorized payment (PAY-07, PAY-08).
   * In DeliverectDPayAdapter, raw implementation is blocked until verified with staging (DV-05).
   */
  capture(paymentId: string, finalAmountMinor: number): Promise<DPayPaymentResponse>;

  /**
   * Releases an uncaptured authorization. Implementations must confirm the
   * provider-side release before local payment/order state is changed.
   */
  voidAuthorization(paymentId: string, reason?: string): Promise<DPayPaymentResponse>;

  /**
   * Refunds a captured payment.
   * In DeliverectDPayAdapter, raw implementation is blocked until verified with staging (DV-06).
   */
  refund(paymentId: string, refundAmountMinor: number, reason?: string): Promise<DPayPaymentResponse>;

  /**
   * Reauthorizes or performs an additional authorization when final amount exceeds authorized ceiling (PAY-08).
   * In DeliverectDPayAdapter, raw implementation is blocked until verified with staging (DV-06).
   */
  reauthorize(paymentId: string, additionalAmountMinor: number): Promise<DPayPaymentResponse>;
}

/** @deprecated Prefer PaymentGatewayAdapter for provider-neutral code. */
export interface DPayAdapter extends PaymentGatewayAdapter {}
