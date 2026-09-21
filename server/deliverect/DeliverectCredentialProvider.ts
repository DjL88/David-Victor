/**
 * Tenant integration configuration provider.
 * Loads live staging/production secrets from SecretManager or environment variables.
 */

import { SecretManager } from '../secrets';
import { OAuthTokenManager, DeliverectEnvironmentName } from './OAuthTokenManager';

export interface DeliverectCredentials {
  environment: DeliverectEnvironmentName;
  clientId: string;
  clientSecret: string;
  webhookSecret: string;
  accountId: string;
  baseUrl: string;
  tokenManager: OAuthTokenManager;
}

export class DeliverectCredentialProvider {
  static async getCredentialsForTenant(tenantId: string): Promise<DeliverectCredentials> {
    const environment: DeliverectEnvironmentName =
      (process.env.DELIVERECT_ENVIRONMENT as DeliverectEnvironmentName) || 'staging';

    const clientId =
      (await SecretManager.getSecret(`DELIVERECT_${tenantId.toUpperCase()}_CLIENT_ID`)) ||
      process.env.DELIVERECT_CLIENT_ID ||
      '';

    const clientSecret =
      (await SecretManager.getSecret(`DELIVERECT_${tenantId.toUpperCase()}_CLIENT_SECRET`)) ||
      process.env.DELIVERECT_CLIENT_SECRET ||
      '';

    const webhookSecret =
      (await SecretManager.getSecret(`DELIVERECT_${tenantId.toUpperCase()}_WEBHOOK_SECRET`)) ||
      process.env.DELIVERECT_WEBHOOK_SECRET ||
      '';

    const accountId =
      (await SecretManager.getSecret(`DELIVERECT_${tenantId.toUpperCase()}_ACCOUNT_ID`)) ||
      process.env.DELIVERECT_ACCOUNT_ID ||
      '';

    const baseUrl =
      environment === 'production'
        ? 'https://api.deliverect.com'
        : 'https://api.staging.deliverect.com';

    const tokenManager = new OAuthTokenManager({
      environment,
      clientId,
      clientSecret,
    });

    return {
      environment,
      clientId,
      clientSecret,
      webhookSecret,
      accountId,
      baseUrl,
      tokenManager,
    };
  }
}
