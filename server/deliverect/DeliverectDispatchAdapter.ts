import {
  DispatchAdapter,
  DispatchValidateParams,
  DispatchValidationResult,
  DispatchQuoteParams,
  DispatchQuoteResult,
  CourierQuote,
  DispatchAssignParams,
  DispatchAssignmentResult,
  DispatchCancelParams,
  DispatchCancelResult,
} from './DispatchAdapter';
import { OAuthTokenManager } from './OAuthTokenManager';
import { Money } from '../../src/commerce/models';
import { BFFError } from '../errors';

/**
 * Deliverect Dispatch Adapter (Server-side)
 *
 * Implements courier fulfillment validation via Deliverect Dispatch API (/fulfillment/validate).
 * Requires OAuth client credentials.
 * Tokens are cached server-side and never exposed to the client.
 *
 * Open Contract to verify in staging (DELIVERECT_VERIFICATION.md):
 * - Exact schema of /fulfillment/validate request & response
 * - Validation token expiration duration
 * - Delivery quote and ETA field names
 * - Live courier assignment endpoint and payload (DV-02, DV-08)
 */
export class DeliverectDispatchAdapter implements DispatchAdapter {
  readonly adapterName = 'DeliverectDispatchAdapter';
  private tokenManager: OAuthTokenManager;
  private fetchFn: typeof fetch;

  constructor(
    tenantIdOrTokenManager?: string | OAuthTokenManager,
    customFetch?: typeof fetch
  ) {
    if (typeof tenantIdOrTokenManager === 'object' && tenantIdOrTokenManager !== null) {
      this.tokenManager = tenantIdOrTokenManager as OAuthTokenManager;
    } else {
      this.tokenManager = OAuthTokenManager.getInstance(tenantIdOrTokenManager as string | undefined);
    }
    this.fetchFn = customFetch || fetch;
  }

  get isConnected(): boolean {
    return this.tokenManager.isConfigured;
  }

  async validateAvailability(
    params: DispatchValidateParams,
    isRetry = false
  ): Promise<DispatchValidationResult> {
    if (this.tokenManager.isConfigured === false) {
      const error: any = new Error(
        'Deliverect Dispatch integration is not configured. Missing DELIVERECT_CLIENT_ID or DELIVERECT_CLIENT_SECRET.'
      );
      error.status = 503;
      error.code = 'INTEGRATION_NOT_CONFIGURED';
      throw error;
    }

    const accessToken = await this.tokenManager.getAccessToken();
    const baseUrl =
      typeof (this.tokenManager as any).getBaseUrl === 'function'
        ? (this.tokenManager as any).getBaseUrl()
        : this.tokenManager.config?.baseUrl || 'https://api.staging.deliverect.com';
    const endpoint = `${baseUrl}/fulfillment/validate`;

    try {
      const response = await this.fetchFn(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          channelLinkId: params.channelLinkId || params.storeId,
          deliveryAddress: params.deliveryAddress,
          pickupTime: params.pickupTime,
          deliveryTime: params.deliveryTime,
          orderValue: {
            amount: params.orderValueMinorUnits ?? 0,
            currency: params.currency,
          },
          itemsCount: params.itemsCount,
        }),
      });

      if (!response.ok) {
        if (response.status === 401 && !isRetry) {
          if (typeof (this.tokenManager as any).invalidateToken === 'function') {
            (this.tokenManager as any).invalidateToken();
          } else if (typeof this.tokenManager.invalidateCache === 'function') {
            this.tokenManager.invalidateCache();
          }
          return this.validateAvailability(params, true);
        }

        if (response.status === 404 || response.status === 400 || response.status === 422) {
          const errData: any = await response.json().catch(() => ({}));
          return {
            available: false,
            failureReason: errData.message || errData.reason || 'Address outside courier dispatch delivery zone',
          };
        }
        const errorText = await response.text().catch(() => 'Unknown upstream error');
        const error: any = new Error(`Deliverect Dispatch API failed (${response.status}): ${errorText}`);
        error.status = response.status;
        error.code = 'UPSTREAM_DISPATCH_ERROR';
        throw error;
      }

      const data: any = await response.json();

      // Normalize response according to Deliverect Dispatch contract
      // NEVER default to true when availability fields are missing
      const isAvailable = typeof data.available === 'boolean'
        ? data.available
        : typeof data.isAvailable === 'boolean'
          ? data.isAvailable
          : false;

      if (!isAvailable) {
        return {
          available: false,
          failureReason: data.reason || data.unavailabilityReason || 'Courier dispatch unserviceable for this location',
        };
      }

      let fee: Money | undefined = undefined;
      if (data.deliveryFee) {
        const feeCurrency = (typeof data.deliveryFee === 'object' ? data.deliveryFee.currency : undefined) || params.currency;
        const feeAmount = typeof data.deliveryFee === 'object' ? data.deliveryFee.amount : data.deliveryFee;
        if (typeof feeAmount === 'number' && feeCurrency) {
          fee = { amount: feeAmount, currency: feeCurrency };
        }
      } else if (typeof data.deliveryPrice === 'number' && params.currency) {
        fee = { amount: data.deliveryPrice, currency: params.currency };
      }

      return {
        available: true,
        validationId: data.validationId || data.dispatchValidationId || data.id,
        expiresAt: data.expiresAt || (data.validUntil ? new Date(data.validUntil).toISOString() : undefined),
        estimatedDeliveryTime: data.deliveryTime || (data.estimatedDurationMinutes ? `${data.estimatedDurationMinutes} mins` : undefined),
        estimatedPickupTime: data.pickupTime,
        fee,
        provider: data.provider || data.courierProvider,
      };
    } catch (err: any) {
      if (err.code === 'INTEGRATION_NOT_CONFIGURED' || err.status === 503) {
        throw err;
      }
      throw err;
    }
  }

  async getQuotes(params: DispatchQuoteParams): Promise<DispatchQuoteResult> {
    const valResult = await this.validateAvailability(params);
    if (!valResult.available) {
      return {
        available: false,
        quotes: [],
        failureReason: valResult.failureReason || 'Address outside courier dispatch delivery zone',
      };
    }

    const fee = valResult.fee || { amount: valResult.deliveryPrice || 0, currency: params.currency || 'GBP' };
    const expiresAt = valResult.expiresAt || new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const quote: CourierQuote = {
      quoteId: valResult.validationId || `quote_deliverect_${Date.now()}`,
      providerId: 'deliverect-dispatch',
      providerDisplayName: valResult.provider || 'Deliverect Dispatch',
      fee,
      pickupEtaMinutes: valResult.pickupEtaMinutes,
      deliveryEtaMinutes: valResult.deliveryEtaMinutes,
      estimatedPickupTime: valResult.estimatedPickupTime,
      estimatedDeliveryTime: valResult.estimatedDeliveryTime,
      expiresAt,
      supportsScheduledAssignment: false, // Live staging Deliverect contract pending verification (DV-02)
      supportsAgeVerification: false,
      supportsPin: false,
    };

    return {
      available: true,
      quotes: [quote],
      selectedQuote: quote,
      validationId: valResult.validationId,
      expiresAt,
    };
  }

  async assignCourier(_params: DispatchAssignParams): Promise<DispatchAssignmentResult> {
    // Deliverect staging live assignment contract is unverified (DELIVERECT_VERIFICATION.md DV-02/DV-08).
    // Explicitly reject rather than fabricating live success.
    throw new BFFError(
      'UPSTREAM_DISPATCH_OPERATION_UNSUPPORTED',
      'Deliverect live courier assignment is pending partner staging verification (DV-02). Use Demo mode for end-to-end simulated driver dispatch.',
      501,
      false
    );
  }

  async cancelDispatch(_params: DispatchCancelParams): Promise<DispatchCancelResult> {
    // Deliverect staging live cancellation contract is unverified.
    throw new BFFError(
      'UPSTREAM_DISPATCH_OPERATION_UNSUPPORTED',
      'Deliverect live courier cancellation is pending partner staging verification.',
      501,
      false
    );
  }
}
