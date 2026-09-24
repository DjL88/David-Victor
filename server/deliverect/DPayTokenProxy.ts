import { CommerceError, ErrorCode } from '../errors';
import { OAuthTokenManager } from './OAuthTokenManager';
import { isProductionMode } from '../runtimeMode';

export interface DPayTokenRequest {
  gatewayProfileId: string;
  channelLinkId: string;
  customerId: string;
  payment_method: {
    number: string;
    exp_month: number;
    exp_year: number;
    cvc: string;
    name?: string;
  };
}

export interface DPayTokenResult {
  token: string;
  tokenId: string;
  type: string;
  brand?: string;
  last4?: string;
  status?: string;
}

/**
 * Deliverect's Create Token endpoint is the PCI boundary: raw card data is sent
 * only to the DPay/Basis Theory token proxy and is never persisted by Bwydi.
 */
export class DPayTokenProxy {
  static async createToken(
    tenantId: string,
    request: DPayTokenRequest
  ): Promise<DPayTokenResult> {
    const configured = String(process.env.DPAY_TOKEN_PROXY_URL || '').trim();
    const endpoint = configured || (
      isProductionMode()
        ? ''
        : 'https://basistheory.staging.deliverect.com/'
    );

    if (!endpoint) {
      throw new CommerceError(
        ErrorCode.INTEGRATION_NOT_CONFIGURED,
        'DPAY_TOKEN_PROXY_URL must be configured for production tokenization.',
        503
      );
    }

    const authorization =
      await OAuthTokenManager.getInstance(tenantId).getAuthorizationHeader();

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      // Never log or persist this body.
      body: JSON.stringify(request),
    });

    const text = await response.text();
    let body: any = {};
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = {};
      }
    }

    if (!response.ok) {
      throw new CommerceError(
        response.status === 401
          ? ErrorCode.INTEGRATION_AUTH_FAILED
          : ErrorCode.PAYMENT_NOT_AUTHORISED,
        `DPay token proxy rejected tokenization (HTTP ${response.status}).`,
        response.status
      );
    }

    const tokenId = String(
      body?.id ||
      body?.tokenId ||
      body?.token?.id ||
      body?.token ||
      ''
    ).trim();
    const status = String(
      body?.status ||
      body?.verificationStatus ||
      body?.verification?.status ||
      ''
    ).trim();

    if (!tokenId || /fail|invalid|rejected/i.test(status)) {
      throw new CommerceError(
        ErrorCode.PAYMENT_NOT_AUTHORISED,
        'DPay token verification did not return a verified reusable token.',
        422
      );
    }

    const card = body?.payment_method || body?.paymentMethod || body?.card || {};
    const last4 =
      String(card?.last4 || body?.last4 || request.payment_method.number.slice(-4));

    return {
      token: tokenId,
      tokenId,
      type: String(card?.type || body?.type || 'card'),
      brand: card?.brand || body?.brand,
      last4,
      status: status || undefined,
    };
  }
}
