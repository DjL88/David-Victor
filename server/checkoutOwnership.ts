import { BFFError } from './errors';

export interface TenantScopedCheckoutProjection {
  tenantId?: string | null;
}

export function assertCheckoutTenantScope(
  checkout: TenantScopedCheckoutProjection,
  resolvedTenant: string
): void {
  const checkoutTenant = String(checkout?.tenantId || '').trim();
  const tenant = String(resolvedTenant || '').trim();

  if (!tenant || !checkoutTenant || checkoutTenant !== tenant) {
    // Use not-found semantics so a caller cannot distinguish another tenant's
    // checkout ID from a genuinely unknown checkout.
    throw new BFFError(
      'CHECKOUT_NOT_FOUND',
      'Checkout not found for the resolved tenant.',
      404
    );
  }
}
