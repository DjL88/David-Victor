import { DPayAdapter } from './DPayAdapter';
import {
  DPayPaymentRequest,
  DPayPaymentResponse,
  PaymentGatewayProfile,
} from '../../src/domain/models';
import { CommerceError, ErrorCode } from '../errors';
import { OAuthTokenManager } from './OAuthTokenManager';
import { isProductionMode } from '../runtimeMode';

export class DeliverectDPayAdapter implements DPayAdapter {
  readonly adapterName = 'DeliverectDPayAdapter';
  private tokenManager: OAuthTokenManager;
  private tenantId?: string;

  constructor(tenantIdOrTokenManager?: string | OAuthTokenManager) {
    if (tenantIdOrTokenManager instanceof OAuthTokenManager) {
      this.tokenManager = tenantIdOrTokenManager;
    } else {
      this.tenantId = typeof tenantIdOrTokenManager === 'string' ? tenantIdOrTokenManager : undefined;
      this.tokenManager = OAuthTokenManager.getInstance(this.tenantId);
    }
  }

  private async getBaseUrl(): Promise<string> {
    const isProd = isProductionMode();
    return isProd ? 'https://api.deliverect.com' : 'https://api.staging.deliverect.com';
  }

  /**
   * Section 20 & Section 65 mandate:
   * Do not invent raw payment routes.
   * Freeze guessed routes (/pay/channels/.../gateways, /payments, /pay/payments/...)
   * behind verification pending confirmation from Deliverect Pay team.
   */
  async getPaymentGateways(_channelLinkId: string): Promise<PaymentGatewayProfile[]> {
    throw new CommerceError(
      ErrorCode.INTEGRATION_CAPABILITY_NOT_IMPLEMENTED,
      'TODO_DELIVERECT_VERIFY: DPay getPaymentGateways endpoint pending confirmation from Deliverect Pay team (see DV-05 in docs/DELIVERECT_VERIFICATION.md)',
      501
    );
  }

  async requestPayment(_request: DPayPaymentRequest): Promise<DPayPaymentResponse> {
    throw new CommerceError(
      ErrorCode.INTEGRATION_CAPABILITY_NOT_IMPLEMENTED,
      'TODO_DELIVERECT_VERIFY: DPay requestPayment endpoint pending confirmation from Deliverect Pay team (see DV-05 in docs/DELIVERECT_VERIFICATION.md)',
      501
    );
  }

  async getPayment(_paymentId: string): Promise<DPayPaymentResponse> {
    throw new CommerceError(
      ErrorCode.INTEGRATION_CAPABILITY_NOT_IMPLEMENTED,
      'TODO_DELIVERECT_VERIFY: DPay getPayment endpoint pending confirmation from Deliverect Pay team (see DV-05 in docs/DELIVERECT_VERIFICATION.md)',
      501
    );
  }

  /**
   * Section 20 & Section 65 mandate:
   * Do not invent raw capture, refund or reauthorization endpoints.
   * Mark raw implementations blocked until verified with staging.
   */
  async capture(_paymentId: string, _finalAmountMinor: number): Promise<DPayPaymentResponse> {
    throw new CommerceError(
      ErrorCode.INTEGRATION_CAPABILITY_NOT_IMPLEMENTED,
      'TODO_DELIVERECT_VERIFY: DPay manual capture endpoint pending confirmation from Deliverect Pay team (see DV-05 in docs/DELIVERECT_VERIFICATION.md)',
      501
    );
  }

  async refund(_paymentId: string, _refundAmountMinor: number, _reason?: string): Promise<DPayPaymentResponse> {
    throw new CommerceError(
      ErrorCode.INTEGRATION_CAPABILITY_NOT_IMPLEMENTED,
      'TODO_DELIVERECT_VERIFY: DPay refund endpoint pending confirmation from Deliverect Pay team (see DV-06 in docs/DELIVERECT_VERIFICATION.md)',
      501
    );
  }

  async reauthorize(_paymentId: string, _additionalAmountMinor: number): Promise<DPayPaymentResponse> {
    throw new CommerceError(
      ErrorCode.INTEGRATION_CAPABILITY_NOT_IMPLEMENTED,
      'TODO_DELIVERECT_VERIFY: DPay reauthorization / additional authorization endpoint pending confirmation from Deliverect Pay team (see DV-06 in docs/DELIVERECT_VERIFICATION.md)',
      501
    );
  }
}
