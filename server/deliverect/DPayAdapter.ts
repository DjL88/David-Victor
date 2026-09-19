import {
  DPayPaymentRequest,
  DPayPaymentResponse,
  PaymentGatewayProfile,
} from '../../src/domain/models';

export interface DPayAdapter {
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
