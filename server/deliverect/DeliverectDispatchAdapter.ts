import {
  DispatchAdapter,
  DispatchValidateParams,
  DispatchValidationResult,
  DispatchQuoteParams,
  DispatchQuoteResult,
  DispatchAssignParams,
  DispatchAssignmentResult,
  DispatchCancelParams,
  DispatchCancelResult,
} from './DispatchAdapter';
import { OAuthTokenManager } from './OAuthTokenManager';
import { BFFError } from '../errors';

/**
 * Deliverect Dispatch Adapter (Server-side)
 *
 * Implements courier fulfillment validation via Deliverect Dispatch API (/fulfillment/validate).
 * Requires OAuth client credentials.
 * Tokens are cached server-side and never exposed to the client.
 *
 * Verified public contract:
 * - POST /fulfillment/validate accepts channelLinkId, pickupReadyTime and
 *   deliveryLocations; a successful response exposes validationId, expiresAt,
 *   deliveryTimeETA, pickupTimeEta and price.
 * - The validation token is short-lived provider evidence and is not a courier
 *   quote/provider identity.
 *
 * Still unverified for this channel-side integration:
 * - Live courier assignment endpoint/payload.
 * - Dispatch-job cancellation endpoint/cutoff.
 * Those operations fail closed below instead of being inferred from unrelated
 * Dispatch-partner webhook or Channel order-cancellation contracts.
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

    const channelLinkId = String(params.channelLinkId || params.storeId || '').trim();
    if (!channelLinkId) {
      throw new BFFError(
        'DISPATCH_CHANNEL_LINK_REQUIRED',
        'A verified channelLinkId is required for Deliverect dispatch validation.',
        400,
        false
      );
    }

    const address: any = params.deliveryAddress || {};
    const street = String(address.street || address.line1 || '').trim();
    const city = String(address.city || '').trim();
    const country = String(address.country || '').trim();
    const postalCode = String(address.postalCode || address.postcode || '').trim();
    if (!street || !city || !country || !postalCode) {
      throw new BFFError(
        'DISPATCH_ADDRESS_INCOMPLETE',
        'Street, city, country and postal code are required for Deliverect dispatch validation.',
        400,
        false
      );
    }

    const latitude =
      typeof address.coordinates?.latitude === 'number'
        ? address.coordinates.latitude
        : typeof address.latitude === 'number'
          ? address.latitude
          : undefined;
    const longitude =
      typeof address.coordinates?.longitude === 'number'
        ? address.coordinates.longitude
        : typeof address.longitude === 'number'
          ? address.longitude
          : undefined;

    const deliveryLocations: Record<string, unknown> = {
      street,
      city,
      country,
      postalCode,
      ...(params.deliveryTime ? { deliveryTime: params.deliveryTime } : {}),
      ...(Number.isFinite(latitude) && Number.isFinite(longitude)
        ? { coordinates: { latitude, longitude } }
        : {}),
    };

    const accessToken = await this.tokenManager.getAccessToken();
    const baseUrl =
      typeof (this.tokenManager as any).getBaseUrl === 'function'
        ? (this.tokenManager as any).getBaseUrl()
        : this.tokenManager.config?.baseUrl || 'https://api.staging.deliverect.com';
    const endpoint = `${baseUrl}/fulfillment/validate`;

    const response = await this.fetchFn(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        channelLinkId,
        ...(params.pickupTime ? { pickupTime: params.pickupTime } : {}),
        deliveryLocations,
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

      throw new BFFError(
        'UPSTREAM_DISPATCH_ERROR',
        `Deliverect dispatch validation failed with HTTP ${response.status}.`,
        response.status >= 400 && response.status < 600 ? response.status : 502,
        response.status >= 500
      );
    }

    const data: any = await response.json();
    if (typeof data?.available !== 'boolean') {
      throw new BFFError(
        'UPSTREAM_DISPATCH_CONTRACT_INVALID',
        'Deliverect dispatch validation returned no explicit availability result.',
        502,
        true
      );
    }

    if (!data.available) {
      return {
        available: false,
        failureReason:
          typeof data.errors === 'string' && data.errors.trim()
            ? data.errors.trim()
            : 'No valid dispatch offer is available for this delivery.',
      };
    }

    const validationId = typeof data.validationId === 'string' ? data.validationId.trim() : '';
    const expiresAt = typeof data.expiresAt === 'string' ? data.expiresAt.trim() : '';
    if (!validationId || !expiresAt || !Number.isFinite(Date.parse(expiresAt))) {
      throw new BFFError(
        'UPSTREAM_DISPATCH_CONTRACT_INVALID',
        'Deliverect reported dispatch availability without usable validationId/expiresAt evidence.',
        502,
        true
      );
    }

    const price = typeof data.price === 'number' && Number.isFinite(data.price)
      ? data.price
      : undefined;
    return {
      available: true,
      validationId,
      expiresAt,
      deliveryPrice: price,
      ...(price !== undefined && params.currency
        ? { fee: { amount: price, currency: params.currency } }
        : {}),
      estimatedDeliveryTime:
        typeof data.deliveryTimeETA === 'string' ? data.deliveryTimeETA : undefined,
      estimatedPickupTime:
        typeof data.pickupTimeEta === 'string' ? data.pickupTimeEta : undefined,
    };
  }

  async getQuotes(params: DispatchQuoteParams): Promise<DispatchQuoteResult> {
    const validation = await this.validateAvailability(params);
    if (!validation.available) {
      return {
        available: false,
        quotes: [],
        failureReason: validation.failureReason,
      };
    }

    // /fulfillment/validate proves serviceability and supplies a short-lived
    // validationId. It does not expose a courier/provider quote identity.
    // Keep that distinction explicit: consumers can use validationId/expiresAt
    // at checkout without us inventing quote/provider metadata.
    return {
      available: true,
      quotes: [],
      validationId: validation.validationId,
      expiresAt: validation.expiresAt,
      reason: 'Dispatch availability verified; courier quote/provider identity was not reported.',
    };
  }

  async assignCourier(_params: DispatchAssignParams): Promise<DispatchAssignmentResult> {
    // Deliverect staging live assignment contract is unverified (DELIVERECT_VERIFICATION.md DV-02/DV-08).
    // Explicitly reject rather than fabricating live success.
    throw new BFFError(
      'UPSTREAM_DISPATCH_OPERATION_UNSUPPORTED',
      'Deliverect live courier assignment is not enabled because the channel-side assignment contract has not been verified.',
      501,
      false
    );
  }

  async cancelDispatch(_params: DispatchCancelParams): Promise<DispatchCancelResult> {
    // No verified channel-side dispatch-job cancellation endpoint or cutoff is available here.
    throw new BFFError(
      'UPSTREAM_DISPATCH_OPERATION_UNSUPPORTED',
      'Deliverect dispatch-job cancellation is not enabled because its channel-side endpoint and cutoff semantics have not been verified.',
      501,
      false
    );
  }
}
