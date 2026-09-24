import { DPayAdapter } from './DPayAdapter';
import {
  DPayPaymentRequest,
  DPayPaymentResponse,
  PaymentGatewayProfile,
  DPayPaymentStatus,
} from '../../src/domain/models';
import { CommerceError, ErrorCode } from '../errors';
import { OAuthTokenManager } from './OAuthTokenManager';
import { FirestorePlatformService } from '../firestoreService';
import {
  normalizeIntegrationEnvironment,
  type IntegrationEnvironment,
} from '../integrationProfile';

export class DeliverectDPayAdapter implements DPayAdapter {
  readonly adapterName = 'DeliverectDPayAdapter';
  private tokenManager: OAuthTokenManager;
  private tenantId?: string;
  private environment?: IntegrationEnvironment;

  constructor(
    tenantIdOrTokenManager?: string | OAuthTokenManager,
    environment?: string
  ) {
    this.environment = environment
      ? normalizeIntegrationEnvironment(environment)
      : undefined;

    if (tenantIdOrTokenManager instanceof OAuthTokenManager) {
      this.tokenManager = tenantIdOrTokenManager;
    } else {
      this.tenantId =
        typeof tenantIdOrTokenManager === 'string'
          ? tenantIdOrTokenManager
          : undefined;
      this.tokenManager = OAuthTokenManager.getInstance(this.tenantId);
    }
  }

  private async getBaseUrl(): Promise<string> {
    let environment =
      this.environment ||
      normalizeIntegrationEnvironment(process.env.DELIVERECT_ENV || 'staging');

    if (this.tenantId) {
      const integration = await FirestorePlatformService.getIntegrationConfig(
        this.tenantId
      ).catch(() => null);
      environment = normalizeIntegrationEnvironment(
        integration?.activeEnv ||
          integration?.environment ||
          environment
      );

      const profile = await FirestorePlatformService.getIntegrationProfile(
        this.tenantId,
        environment
      ).catch(() => null);

      if (process.env.INTEGRATION_PROFILE_REQUIRED === 'true') {
        if (!profile || profile.status !== 'ACTIVE') {
          throw new CommerceError(
            ErrorCode.INTEGRATION_NOT_CONFIGURED,
            `Active integration profile "${this.tenantId}__${environment}" is required for Deliverect Pay.`,
            503
          );
        }
      }

      if (profile?.status === 'ACTIVE' && profile.dpay) {
        if (!profile.dpay.enabled) {
          throw new CommerceError(
            ErrorCode.INTEGRATION_NOT_CONFIGURED,
            'Deliverect Pay is disabled for this tenant environment.',
            503
          );
        }
        environment = normalizeIntegrationEnvironment(profile.dpay.environment);
        if (profile.dpay.baseUrl) {
          return profile.dpay.baseUrl.replace(/\/+$/, '');
        }
      }
    }

    return environment === 'production'
      ? 'https://api.deliverect.com'
      : 'https://api.staging.deliverect.com';
  }

  private normalizeStatus(rawStatus: unknown): DPayPaymentStatus {
    const status = String(rawStatus || '').trim().toLowerCase();
    switch (status) {
      case 'authorized':
      case 'authorised':
        return 'authorized';
      case 'captured':
      case 'succeeded':
      case 'paid':
        return 'captured';
      case 'partially_captured':
        return 'partially_captured';
      case 'refunded':
      case 'partially_refunded':
        return 'refunded';
      case 'canceled':
      case 'cancelled':
      case 'expired':
        return 'canceled';
      case 'refused':
      case 'failed':
        return 'failed';
      case 'pending':
      default:
        return 'pending';
    }
  }

  private async requestJson(
    url: string,
    init: RequestInit = {}
  ): Promise<any> {
    const send = async () => {
      const authorization = await this.tokenManager.getAuthorizationHeader();
      return fetch(url, {
        ...init,
        headers: {
          Authorization: authorization,
          Accept: 'application/json',
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          ...(init.headers || {}),
        },
      });
    };

    let response = await send();
    if (response.status === 401) {
      this.tokenManager.invalidateCache();
      response = await send();
    }

    const text = await response.text();
    let body: any = {};
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = { raw: text };
      }
    }

    if (!response.ok) {
      throw new CommerceError(
        response.status === 401
          ? ErrorCode.INTEGRATION_AUTH_FAILED
          : ErrorCode.UPSTREAM_UNAVAILABLE,
        `Deliverect Pay request failed (HTTP ${response.status}): ${text || response.statusText}`,
        response.status
      );
    }

    return body;
  }

  private async getStoredPayment(paymentId: string) {
    const payment =
      await FirestorePlatformService.getPaymentProjection(paymentId);
    if (!payment) {
      throw new CommerceError(
        ErrorCode.ORDER_NOT_FOUND,
        `Payment '${paymentId}' is not known locally, so its Deliverect channelLinkId cannot be resolved safely.`,
        404
      );
    }
    return payment;
  }

  /**
   * Public Deliverect Pay contract:
   * GET /pay/channel/{channelLinkId}/gatewayProfiles
   */
  async getPaymentGateways(
    channelLinkId: string
  ): Promise<PaymentGatewayProfile[]> {
    const baseUrl = await this.getBaseUrl();
    const raw = await this.requestJson(
      `${baseUrl}/pay/channel/${encodeURIComponent(
        channelLinkId
      )}/gatewayProfiles`
    );
    const gateways = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.items)
        ? raw.items
        : [];

    return gateways.map((gateway: any, index: number) => {
      const type = String(
        gateway?.paymentType || gateway?.type || 'online'
      ).toLowerCase();
      return {
        id: String(gateway?.id || gateway?._id || ''),
        name: String(
          gateway?.name ||
            gateway?.displayName ||
            `Deliverect Pay ${type}`
        ),
        supportedMethods: [type],
        isDefault: gateway?.isDefault === true || index === 0,
      };
    }).filter((gateway: PaymentGatewayProfile) => Boolean(gateway.id));
  }

  /**
   * Public Deliverect Pay contract:
   * POST /pay/channel/{channelLinkId}/payments/request
   *
   * For grocery / Quest the caller uses captureMode='manual', leaving the
   * payment authorised while picking changes the final payable amount.
   */
  async requestPayment(
    request: DPayPaymentRequest
  ): Promise<DPayPaymentResponse> {
    if (request.mode?.type !== 'token' || !request.mode.tokenId) {
      throw new CommerceError(
        ErrorCode.INVALID_INPUT,
        'The current DPay adapter only sends verified token payments. Redirect payment UI is handled separately.',
        422
      );
    }

    let gatewayProfileId = request.gatewayProfileId;
    if (!gatewayProfileId) {
      const gateways = await this.getPaymentGateways(
        request.channelLinkId
      );
      const online =
        gateways.find((gateway) =>
          gateway.supportedMethods.some(
            (method) => method.toLowerCase() === 'online'
          )
        ) || gateways[0];
      gatewayProfileId = online?.id;
    }

    if (!gatewayProfileId) {
      throw new CommerceError(
        ErrorCode.PAYMENT_NOT_AUTHORISED,
        'No Deliverect Pay gateway is configured for this store.',
        422
      );
    }

    const orderReference =
      request.orderReference ||
      request.basketId ||
      `payment-${Date.now()}`;
    const payerReference = String(
      request.metadata?.customerReference ||
        request.metadata?.customerUid ||
        orderReference
    );

    const payload = {
      gatewayProfileId,
      mode: {
        type: 'token',
        tokenId: request.mode.tokenId,
      },
      captureMode: request.captureMode || 'manual',
      amount: request.amount,
      currency: request.currency,
      payer: {
        name: request.payer?.name || 'Customer',
        email: request.payer?.email,
        reference: payerReference,
      },
      payable: {
        id: orderReference,
      },
    };

    const baseUrl = await this.getBaseUrl();
    const raw = await this.requestJson(
      `${baseUrl}/pay/channel/${encodeURIComponent(
        request.channelLinkId
      )}/payments/request`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );

    const status = this.normalizeStatus(
      raw?.paymentStatus || raw?.status
    );
    const amount = Number.isFinite(raw?.amount)
      ? Math.round(raw.amount)
      : request.amount;
    const authorizedAmount =
      typeof raw?.authorizedAmount === 'number'
        ? Math.round(raw.authorizedAmount)
        : status === 'authorized' || status === 'captured'
          ? amount
          : 0;
    const capturedAmount =
      typeof raw?.capturedAmount === 'number'
        ? Math.round(raw.capturedAmount)
        : status === 'captured'
          ? amount
          : 0;

    return {
      paymentId: String(raw?.paymentId || raw?.id || ''),
      channelLinkId: request.channelLinkId,
      status,
      amount,
      authorizedAmount,
      capturedAmount,
      currency: raw?.currency || request.currency,
      captureMode: request.captureMode || 'manual',
      orderReference,
      createdAt: raw?.createdAt || new Date().toISOString(),
      updatedAt: raw?.updatedAt || new Date().toISOString(),
    };
  }

  /**
   * Public Deliverect Pay contract:
   * GET /pay/channel/{channelLinkId}/payments/{paymentId}
   */
  async getPayment(paymentId: string): Promise<DPayPaymentResponse> {
    const stored = await this.getStoredPayment(paymentId);
    const baseUrl = await this.getBaseUrl();
    const raw = await this.requestJson(
      `${baseUrl}/pay/channel/${encodeURIComponent(
        stored.channelLinkId
      )}/payments/${encodeURIComponent(paymentId)}`
    );

    const status = this.normalizeStatus(
      raw?.paymentStatus || raw?.status
    );
    const amount =
      typeof raw?.amount === 'number'
        ? Math.round(raw.amount)
        : stored.amount.amount;
    const authorizedAmount =
      typeof raw?.authorizedAmount === 'number'
        ? Math.round(raw.authorizedAmount)
        : status === 'authorized' || status === 'captured'
          ? Math.max(amount, stored.authorizedAmount.amount)
          : stored.authorizedAmount.amount;
    const capturedAmount =
      typeof raw?.capturedAmount === 'number'
        ? Math.round(raw.capturedAmount)
        : status === 'captured'
          ? amount
          : stored.capturedAmount.amount;

    return {
      paymentId: String(raw?.paymentId || raw?.id || paymentId),
      channelLinkId: stored.channelLinkId,
      status,
      amount,
      authorizedAmount,
      capturedAmount,
      currency: raw?.currency || stored.currency,
      captureMode: stored.captureMode,
      residualHoldAmount: stored.residualHoldAmount?.amount,
      orderReference:
        raw?.payableReference ||
        stored.orderReference,
      createdAt: raw?.createdAt || stored.createdAt,
      updatedAt: raw?.updatedAt || new Date().toISOString(),
    };
  }

  /**
   * Deliverect documents manual pre-authorisation, but its current public Pay
   * endpoint index does not expose a capture operation. Keep this guard rather
   * than inventing a URL. Quest settlement will surface PAYMENT_ACTION_REQUIRED
   * until the enabled partner contract supplies the capture operation.
   */
  async capture(
    _paymentId: string,
    _finalAmountMinor: number
  ): Promise<DPayPaymentResponse> {
    throw new CommerceError(
      ErrorCode.INTEGRATION_CAPABILITY_NOT_IMPLEMENTED,
      'DPay manual capture is required for final Quest settlement, but the current public Deliverect Pay endpoint index does not document a capture operation. Configure the partner-specific capture contract before enabling live capture.',
      501
    );
  }

  /**
   * Provider-side release of an uncaptured authorization.
   *
   * The current verified Deliverect contract in this repository does not expose
   * a partner-safe void/release URL. Fail closed rather than pretending the
   * authorization was released locally.
   */
  async voidAuthorization(
    _paymentId: string,
    _reason?: string
  ): Promise<DPayPaymentResponse> {
    throw new CommerceError(
      ErrorCode.INTEGRATION_CAPABILITY_NOT_IMPLEMENTED,
      'DPay authorization release/void is not configured for this partner contract. Local payment state was not changed.',
      501
    );
  }

  /**
   * Public Deliverect Pay contract:
   * POST /pay/channel/{channelLinkId}/payments/{paymentId}/refund
   */
  async refund(
    paymentId: string,
    refundAmountMinor: number,
    _reason?: string
  ): Promise<DPayPaymentResponse> {
    const stored = await this.getStoredPayment(paymentId);
    const baseUrl = await this.getBaseUrl();
    await this.requestJson(
      `${baseUrl}/pay/channel/${encodeURIComponent(
        stored.channelLinkId
      )}/payments/${encodeURIComponent(paymentId)}/refund`,
      {
        method: 'POST',
        body: JSON.stringify({ amount: refundAmountMinor }),
      }
    );

    return {
      paymentId,
      channelLinkId: stored.channelLinkId,
      status: 'refunded',
      amount: stored.amount.amount,
      authorizedAmount: stored.authorizedAmount.amount,
      capturedAmount: Math.max(
        0,
        stored.capturedAmount.amount - refundAmountMinor
      ),
      currency: stored.currency,
      captureMode: stored.captureMode,
      residualHoldAmount: stored.residualHoldAmount?.amount,
      orderReference: stored.orderReference,
      createdAt: stored.createdAt,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Deliverect now documents a re-authorisation URL, but the public description
   * does not state unambiguously whether 'amount' is the additional increment or
   * the new total authorisation. Keep the operation guarded until that semantic
   * is confirmed for this partner account.
   */
  async reauthorize(
    _paymentId: string,
    _additionalAmountMinor: number
  ): Promise<DPayPaymentResponse> {
    throw new CommerceError(
      ErrorCode.INTEGRATION_CAPABILITY_NOT_IMPLEMENTED,
      'DPay re-authorisation endpoint is documented, but amount semantics must be confirmed for this partner contract before live use.',
      501
    );
  }
}
