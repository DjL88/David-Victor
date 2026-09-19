import { CommerceClient } from './CommerceClient';
import { defaultHttpCommerceClient } from './HttpCommerceClient';

/**
 * Returns the tenant-configured CommerceClient.
 * Uses HttpCommerceClient with BFF API routes by default.
 */
export function getCommerceClient(tenantId?: string): CommerceClient {
  const client = defaultHttpCommerceClient;
  if (tenantId) {
    client.setTenant(tenantId);
  }
  return client;
}

export { defaultHttpCommerceClient };
