import { DPayAdapter } from './DPayAdapter';
import {
  DPayPaymentRequest,
  DPayPaymentResponse,
  PaymentGatewayProfile,
} from '../../src/domain/models';
import { CommerceError, ErrorCode } from '../errors';

export class DemoPaymentAdapter implements DPayAdapter {
  readonly adapterName = 'DemoPaymentAdapter';
  private payments = new Map<string, DPayPaymentResponse>();

  // Known valid demo store channel links
  private validChannelLinks = new Set([
    'demo-channel-chelsea',
    'demo-channel-soho',
    'demo-channel-camden',
    'demo-channel-shoreditch',
    'channel-chelsea-01',
    'channel-soho-02',
    'channel-camden-03',
    'channel-kensington-04',
    'cl_test_chelsea',
    'test_channel_01',
  ]);

  async createToken(cardDetails?: {
    cardNumberMasked?: string;
    expiry?: string;
    brand?: string;
    type?: string;
    cardholderName?: string;
    last4?: string;
  }): Promise<{
    token: string;
    tokenId: string;
    type: string;
    brand: string;
    last4: string;
    cardholderName?: string;
  }> {
    const last4 = cardDetails?.last4 || cardDetails?.cardNumberMasked?.slice(-4) || '';
    const brand = cardDetails?.brand || 'Visa';
    const tokenId = `tok_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    return {
      token: tokenId,
      tokenId,
      type: 'card',
      brand,
      last4,
      cardholderName: cardDetails?.cardholderName || 'Demo Customer',
    };
  }

  async getPaymentGateways(channelLinkId: string): Promise<PaymentGatewayProfile[]> {
    if (!channelLinkId) {
      throw new CommerceError(ErrorCode.STORE_NOT_FOUND, 'channelLinkId is required', 400);
    }
    return [
      {
        id: `gw_profile_${channelLinkId}`,
        name: 'Deliverect Pay Primary Gateway (Demo)',
        supportedMethods: ['card', 'CARD', 'apple_pay', 'APPLE_PAY', 'google_pay', 'GOOGLE_PAY'],
        isDefault: true,
      },
    ];
  }

  async requestPayment(request: DPayPaymentRequest): Promise<DPayPaymentResponse> {
    // PAY-03: Validate channel link
    if (!request.channelLinkId || (request.channelLinkId.startsWith('invalid-') && !this.validChannelLinks.has(request.channelLinkId))) {
      throw new CommerceError(
        ErrorCode.STORE_NOT_FOUND,
        `Channel link '${request.channelLinkId}' is invalid or does not belong to this tenant`,
        404
      );
    }

    // PAY-05: Enforce integer minor units
    if (!Number.isInteger(request.amount) || request.amount <= 0) {
      throw new CommerceError(
        ErrorCode.INVALID_INPUT,
        `Payment amount must be a positive integer in minor units (received: ${request.amount})`,
        422
      );
    }

    // PAY-02: Enforce tokenization, reject raw card data
    if (!request.mode || request.mode.type !== 'token' || !request.mode.tokenId) {
      throw new CommerceError(
        ErrorCode.PAYMENT_NOT_AUTHORISED,
        'Payment method must be tokenized via Deliverect Pay / Basis Theory token proxy. Raw card details are forbidden.',
        422
      );
    }

    // Check for accidental raw PAN / CVC in any metadata or payer info
    const serialized = JSON.stringify(request);
    if (/\b(?:\d[ -]*?){13,16}\b/.test(serialized) && serialized.includes('pan')) {
      throw new CommerceError(
        ErrorCode.INVALID_INPUT,
        'Raw card PAN/CVC detected in request payload. Raw card information must never touch the BFF.',
        400
      );
    }

    // PAY-06: Explicit customer approved max amount ceiling check
    if (request.customerApprovedMaxAmount) {
      if (request.customerApprovedMaxAmount.currency !== request.currency) {
        throw new CommerceError(
          ErrorCode.INVALID_INPUT,
          `Currency mismatch: request currency (${request.currency}) does not match approved ceiling currency (${request.customerApprovedMaxAmount.currency})`,
          422
        );
      }
      if (request.amount > request.customerApprovedMaxAmount.amount) {
        throw new CommerceError(
          ErrorCode.PAYMENT_NOT_AUTHORISED,
          `Requested payment amount (${request.amount}) exceeds customer-approved maximum authorized amount (${request.customerApprovedMaxAmount.amount})`,
          422
        );
      }
    }

    // PAY-04: Manual authorization (held for picking/substitutions)
    const paymentId = `dpay_pmt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const response: DPayPaymentResponse = {
      paymentId,
      channelLinkId: request.channelLinkId,
      status: 'authorized',
      amount: request.amount,
      authorizedAmount: request.amount,
      capturedAmount: 0,
      currency: request.currency,
      captureMode: request.captureMode || 'manual',
      orderReference: request.orderReference,
      createdAt: new Date().toISOString(),
    };

    this.payments.set(paymentId, response);
    return response;
  }

  async getPayment(paymentId: string): Promise<DPayPaymentResponse> {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      throw new CommerceError(ErrorCode.ORDER_NOT_FOUND, `Payment '${paymentId}' not found`, 404);
    }
    return { ...payment };
  }

  /**
   * PAY-07: Capture lower than auth (calculates residual hold)
   * PAY-08: Capture above auth fails without reauthorization
   */
  async capture(paymentId: string, finalAmountMinor: number): Promise<DPayPaymentResponse> {
    const payment = await this.getPayment(paymentId);

    if (!Number.isInteger(finalAmountMinor) || finalAmountMinor < 0) {
      throw new CommerceError(
        ErrorCode.INVALID_INPUT,
        `Final capture amount must be a non-negative integer minor unit (received: ${finalAmountMinor})`,
        422
      );
    }

    if (finalAmountMinor > payment.authorizedAmount) {
      throw new CommerceError(
        ErrorCode.PAYMENT_NOT_AUTHORISED,
        `Cannot capture ${finalAmountMinor} minor units; exceeds authorized ceiling of ${payment.authorizedAmount}. Reauthorization required.`,
        422
      );
    }

    // PAY-07: Calculate residual hold amount released
    const residualHold = payment.authorizedAmount - finalAmountMinor;
    const updated: DPayPaymentResponse = {
      ...payment,
      capturedAmount: finalAmountMinor,
      residualHoldAmount: residualHold,
      status: 'captured',
      state: 'CAPTURED',
      updatedAt: new Date().toISOString(),
    } as any;

    this.payments.set(paymentId, updated);
    return updated;
  }

  async voidAuthorization(paymentId: string, _reason?: string): Promise<DPayPaymentResponse> {
    const payment = await this.getPayment(paymentId);
    if (payment.status === 'captured' || payment.capturedAmount > 0) {
      throw new CommerceError(
        ErrorCode.INVALID_INPUT,
        'Captured payments must be refunded rather than voided.',
        409
      );
    }
    const updated: DPayPaymentResponse = {
      ...payment,
      status: 'canceled',
      residualHoldAmount: 0,
      updatedAt: new Date().toISOString(),
    };
    this.payments.set(paymentId, updated);
    return updated;
  }

  async refund(paymentId: string, refundAmountMinor: number, _reason?: string): Promise<DPayPaymentResponse> {
    const payment = await this.getPayment(paymentId);
    if (refundAmountMinor > payment.capturedAmount) {
      throw new CommerceError(
        ErrorCode.INVALID_INPUT,
        `Refund amount (${refundAmountMinor}) cannot exceed captured amount (${payment.capturedAmount})`,
        422
      );
    }

    const updated: DPayPaymentResponse = {
      ...payment,
      status: 'refunded',
      state: 'REFUNDED',
      updatedAt: new Date().toISOString(),
    } as any;
    this.payments.set(paymentId, updated);
    return updated;
  }

  async reauthorize(paymentId: string, additionalAmountMinor: number): Promise<DPayPaymentResponse> {
    const payment = await this.getPayment(paymentId);
    if (!Number.isInteger(additionalAmountMinor) || additionalAmountMinor <= 0) {
      throw new CommerceError(
        ErrorCode.INVALID_INPUT,
        `Additional reauthorization amount must be positive integer (received: ${additionalAmountMinor})`,
        422
      );
    }

    const updated: DPayPaymentResponse = {
      ...payment,
      authorizedAmount: payment.authorizedAmount + additionalAmountMinor,
      amount: payment.amount + additionalAmountMinor,
      updatedAt: new Date().toISOString(),
    };
    this.payments.set(paymentId, updated);
    return updated;
  }
}
