import { describe, expect, it } from 'vitest';
import { assertCheckoutTenantScope } from '../../server/checkoutOwnership';

describe('checkout tenant ownership fence', () => {
  it('allows a checkout owned by the resolved tenant', () => {
    expect(() =>
      assertCheckoutTenantScope({ tenantId: 'tenant-a' }, 'tenant-a')
    ).not.toThrow();
  });

  it('uses not-found semantics for a checkout owned by another tenant', () => {
    expect(() =>
      assertCheckoutTenantScope({ tenantId: 'tenant-b' }, 'tenant-a')
    ).toThrowError(expect.objectContaining({
      code: 'CHECKOUT_NOT_FOUND',
      statusCode: 404,
    }));
  });

  it('fails closed when a persisted checkout has no tenant ownership', () => {
    expect(() =>
      assertCheckoutTenantScope({}, 'tenant-a')
    ).toThrowError(expect.objectContaining({
      code: 'CHECKOUT_NOT_FOUND',
      statusCode: 404,
    }));
  });
});
