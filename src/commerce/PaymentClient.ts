/**
 * PaymentClient / PaymentService abstraction.
 *
 * Decoupled from CommerceClient to support Deliverect Pay (DPay)
 * as well as pluggable third-party PSPs, gift cards, and split payments.
 */

export interface PaymentToken {
  token: string;
  tokenId?: string;
  type: string;
  brand?: string;
  last4?: string;
  cardholderName?: string;
  expiryMonth?: number;
  expiryYear?: number;
  reference?: string;
}

export interface DPayMode {
  type: 'token' | 'card' | 'hosted';
  tokenId?: string;
}

export interface DPayPayer {
  name?: string;
  email?: string;
  phone?: string;
}

export interface DPayPaymentRequest {
  channelLinkId: string;
  gatewayProfileId?: string;
  mode: DPayMode;
  captureMode: 'manual' | 'automatic';
  amount: number; // in minor units (pence/cents)
  currency: string;
  payer?: DPayPayer;
  orderReference?: string;
  metadata?: Record<string, any>;
}

export type DPayPaymentStatus =
  | 'pending'
  | 'authorized'
  | 'captured'
  | 'partially_captured'
  | 'canceled'
  | 'failed'
  | 'refunded';

export interface DPayPaymentResponse {
  paymentId: string;
  channelLinkId: string;
  status: DPayPaymentStatus;
  amount: number;
  authorizedAmount: number;
  capturedAmount: number;
  currency: string;
  captureMode: 'manual' | 'automatic';
  createdAt: string;
}

export interface PaymentGatewayProfile {
  id: string;
  name: string;
  supportedMethods: string[];
  isDefault: boolean;
}

/**
 * Domain PaymentClient interface.
 * Handles card tokenization, payment request, reauthorization,
 * and capture through Deliverect Pay or configured PSP adapter.
 */
export interface PaymentClient {
  createToken(cardDetails?: {
    cardNumberMasked?: string;
    expiry?: string;
    brand?: string;
    type?: string;
    cardholderName?: string;
    last4?: string;
  }): Promise<PaymentToken>;

  getPaymentGateways(channelLinkId: string): Promise<PaymentGatewayProfile[]>;

  requestPayment(request: DPayPaymentRequest): Promise<DPayPaymentResponse>;

  getPaymentStatus(paymentId: string): Promise<DPayPaymentResponse>;

  reauthorize(paymentId: string, additionalAmountMinor: number): Promise<DPayPaymentResponse>;

  capture(paymentId: string, finalAmountMinor: number): Promise<DPayPaymentResponse>;

  refund(paymentId: string, refundAmountMinor: number, reason?: string): Promise<DPayPaymentResponse>;
}

/**
 * Demo implementation of PaymentClient for development and preview sandboxes.
 */
export class DemoPaymentClient implements PaymentClient {
  private payments = new Map<string, DPayPaymentResponse>();

  async createToken(cardDetails?: {
    cardNumberMasked?: string;
    expiry?: string;
    brand?: string;
    type?: string;
    cardholderName?: string;
    last4?: string;
  }): Promise<PaymentToken> {
    const last4 = cardDetails?.last4 || '4242';
    const tokenId = `dpay_tok_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    return {
      token: tokenId,
      tokenId,
      type: cardDetails?.type || 'CARD',
      brand: cardDetails?.brand || 'Visa',
      last4,
      cardholderName: cardDetails?.cardholderName || 'Valued Customer',
      reference: `ref_${Date.now()}`,
    };
  }

  async getPaymentGateways(channelLinkId: string): Promise<PaymentGatewayProfile[]> {
    return [
      {
        id: `gw_profile_${channelLinkId}`,
        name: 'Deliverect Pay Primary Gateway (Demo)',
        supportedMethods: ['CARD', 'APPLE_PAY', 'GOOGLE_PAY'],
        isDefault: true,
      },
    ];
  }

  async requestPayment(request: DPayPaymentRequest): Promise<DPayPaymentResponse> {
    const paymentId = `dpay_pmt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const response: DPayPaymentResponse = {
      paymentId,
      channelLinkId: request.channelLinkId,
      status: 'authorized',
      amount: request.amount,
      authorizedAmount: request.amount,
      capturedAmount: 0,
      currency: request.currency,
      captureMode: request.captureMode,
      createdAt: new Date().toISOString(),
    };
    this.payments.set(paymentId, response);
    return response;
  }

  async getPaymentStatus(paymentId: string): Promise<DPayPaymentResponse> {
    const existing = this.payments.get(paymentId);
    if (!existing) {
      throw new Error(`Payment with ID ${paymentId} not found.`);
    }
    return { ...existing };
  }

  async reauthorize(paymentId: string, additionalAmountMinor: number): Promise<DPayPaymentResponse> {
    const existing = await this.getPaymentStatus(paymentId);
    existing.authorizedAmount += additionalAmountMinor;
    existing.amount += additionalAmountMinor;
    this.payments.set(paymentId, existing);
    return { ...existing };
  }

  async capture(paymentId: string, finalAmountMinor: number): Promise<DPayPaymentResponse> {
    const existing = await this.getPaymentStatus(paymentId);
    if (finalAmountMinor > existing.authorizedAmount) {
      throw new Error(
        `Cannot capture ${finalAmountMinor} minor units; exceeds authorized limit ${existing.authorizedAmount}. Reauthorization required.`
      );
    }
    existing.capturedAmount = finalAmountMinor;
    existing.status = 'captured';
    this.payments.set(paymentId, existing);
    return { ...existing };
  }

  async refund(paymentId: string, refundAmountMinor: number, _reason?: string): Promise<DPayPaymentResponse> {
    const existing = await this.getPaymentStatus(paymentId);
    existing.status = 'refunded';
    this.payments.set(paymentId, existing);
    return { ...existing };
  }
}

/**
 * Production / Staging HTTP Payment Client communicating through BFF
 */
export class HttpPaymentClient implements PaymentClient {
  private baseUrl: string;

  constructor(baseUrl: string = '/api/v1') {
    this.baseUrl = baseUrl;
  }

  async createToken(cardDetails?: {
    cardNumberMasked?: string;
    expiry?: string;
    brand?: string;
    type?: string;
    cardholderName?: string;
    last4?: string;
  }): Promise<PaymentToken> {
    const res = await fetch(`${this.baseUrl}/payments/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardDetails }),
    });

    if (!res.ok) {
      if (res.status === 501 || res.status === 503) {
        throw new Error('Deliverect Pay is not configured for this staging/production environment.');
      }
      throw new Error(`Payment tokenization failed: ${res.statusText}`);
    }
    return res.json();
  }

  async getPaymentGateways(channelLinkId: string): Promise<PaymentGatewayProfile[]> {
    const res = await fetch(`${this.baseUrl}/payments/gateways?channelLinkId=${encodeURIComponent(channelLinkId)}`);
    if (!res.ok) return [];
    return res.json();
  }

  async requestPayment(request: DPayPaymentRequest): Promise<DPayPaymentResponse> {
    const res = await fetch(`${this.baseUrl}/payments/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Payment request failed on upstream gateway');
    }
    return res.json();
  }

  async getPaymentStatus(paymentId: string): Promise<DPayPaymentResponse> {
    const res = await fetch(`${this.baseUrl}/payments/${encodeURIComponent(paymentId)}`);
    if (!res.ok) throw new Error(`Could not fetch payment status: ${res.statusText}`);
    return res.json();
  }

  async reauthorize(paymentId: string, additionalAmountMinor: number): Promise<DPayPaymentResponse> {
    const res = await fetch(`${this.baseUrl}/payments/${encodeURIComponent(paymentId)}/reauthorize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ additionalAmountMinor }),
    });
    if (!res.ok) throw new Error(`Reauthorization failed: ${res.statusText}`);
    return res.json();
  }

  async capture(paymentId: string, finalAmountMinor: number): Promise<DPayPaymentResponse> {
    const res = await fetch(`${this.baseUrl}/payments/${encodeURIComponent(paymentId)}/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ finalAmountMinor }),
    });
    if (!res.ok) throw new Error(`Capture failed: ${res.statusText}`);
    return res.json();
  }

  async refund(paymentId: string, refundAmountMinor: number, reason?: string): Promise<DPayPaymentResponse> {
    const res = await fetch(`${this.baseUrl}/payments/${encodeURIComponent(paymentId)}/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refundAmountMinor, reason }),
    });
    if (!res.ok) throw new Error(`Refund failed: ${res.statusText}`);
    return res.json();
  }
}

// Backwards-compatible alias for existing imports
export const MockPaymentClient = DemoPaymentClient;

export function getPaymentClient(mode: string = 'unknown'): PaymentClient {
  if (mode === 'demo') {
    return new DemoPaymentClient();
  }
  return new HttpPaymentClient();
}

export class DynamicPaymentClient implements PaymentClient {
  private activeMode: string = 'unknown';

  setMode(mode: string) {
    this.activeMode = mode;
  }

  get mode(): string {
    return this.activeMode;
  }

  private resolveClient(): PaymentClient {
    if (this.activeMode === 'demo') {
      return new DemoPaymentClient();
    }
    return new HttpPaymentClient();
  }

  async createToken(cardDetails?: {
    cardNumberMasked?: string;
    expiry?: string;
    brand?: string;
    type?: string;
    cardholderName?: string;
    last4?: string;
  }): Promise<PaymentToken> {
    return this.resolveClient().createToken(cardDetails);
  }

  async getPaymentGateways(channelLinkId: string): Promise<PaymentGatewayProfile[]> {
    return this.resolveClient().getPaymentGateways(channelLinkId);
  }

  async requestPayment(request: DPayPaymentRequest): Promise<DPayPaymentResponse> {
    return this.resolveClient().requestPayment(request);
  }

  async getPaymentStatus(paymentId: string): Promise<DPayPaymentResponse> {
    return this.resolveClient().getPaymentStatus(paymentId);
  }

  async reauthorize(paymentId: string, additionalAmountMinor: number): Promise<DPayPaymentResponse> {
    return this.resolveClient().reauthorize(paymentId, additionalAmountMinor);
  }

  async capture(paymentId: string, finalAmountMinor: number): Promise<DPayPaymentResponse> {
    return this.resolveClient().capture(paymentId, finalAmountMinor);
  }

  async refund(paymentId: string, refundAmountMinor: number, reason?: string): Promise<DPayPaymentResponse> {
    return this.resolveClient().refund(paymentId, refundAmountMinor, reason);
  }
}

export const defaultPaymentClient = new DynamicPaymentClient();

