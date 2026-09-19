import { DispatchAdapter, DispatchValidateParams, DispatchValidationResult } from './DispatchAdapter';
import { BFFError } from '../errors';

export class IntegrationUnavailableDispatchAdapter implements DispatchAdapter {
  readonly adapterName = 'IntegrationUnavailableDispatchAdapter';
  readonly isConnected = false;

  constructor(
    public readonly environment: 'staging' | 'production' = 'staging',
    public readonly reason: string = 'missing_credentials'
  ) {}

  async validateAvailability(_params: DispatchValidateParams): Promise<DispatchValidationResult> {
    throw new BFFError(
      'INTEGRATION_NOT_CONFIGURED',
      'Deliverect Dispatch integration is not configured. Missing DELIVERECT_CLIENT_ID or DELIVERECT_CLIENT_SECRET credentials in staging/production mode.',
      503,
      false
    );
  }
}
