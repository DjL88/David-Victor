import { DPayAdapter } from './DPayAdapter';
import {
  DPayPaymentRequest,
  DPayPaymentResponse,
  PaymentGatewayProfile,
} from '../../src/domain/models';
import { CommerceError, ErrorCode } from '../errors';

export class IntegrationUnavailableDPayAdapter implements DPayAdapter {
  readonly adapterName = 'IntegrationUnavailableDPayAdapter';

  async getPaymentGateways(_channelLinkId: string): Promise<PaymentGatewayProfile[]> {
    throw new CommerceError(
      ErrorCode.INTEGRATION_NOT_CONFIGURED,
      'Deliverect Pay integration is not configured for this staging/production environment.',
      503
    );
  }

  async requestPayment(_request: DPayPaymentRequest): Promise<DPayPaymentResponse> {
    throw new CommerceError(
      ErrorCode.INTEGRATION_NOT_CONFIGURED,
      'Deliverect Pay integration is not configured for this staging/production environment.',
      503
    );
  }

  async getPayment(_paymentId: string): Promise<DPayPaymentResponse> {
    throw new CommerceError(
      ErrorCode.INTEGRATION_NOT_CONFIGURED,
      'Deliverect Pay integration is not configured for this staging/production environment.',
      503
    );
  }

  async capture(_paymentId: string, _finalAmountMinor: number): Promise<DPayPaymentResponse> {
    throw new CommerceError(
      ErrorCode.INTEGRATION_NOT_CONFIGURED,
      'Deliverect Pay integration is not configured for this staging/production environment.',
      503
    );
  }

  async refund(_paymentId: string, _refundAmountMinor: number, _reason?: string): Promise<DPayPaymentResponse> {
    throw new CommerceError(
      ErrorCode.INTEGRATION_NOT_CONFIGURED,
      'Deliverect Pay integration is not configured for this staging/production environment.',
      503
    );
  }

  async reauthorize(_paymentId: string, _additionalAmountMinor: number): Promise<DPayPaymentResponse> {
    throw new CommerceError(
      ErrorCode.INTEGRATION_NOT_CONFIGURED,
      'Deliverect Pay integration is not configured for this staging/production environment.',
      503
    );
  }
}
