import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

describe('customer correctness regressions', () => {
  const checkoutSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/features/checkout/CheckoutModal.tsx'),
    'utf8'
  );
  const clientSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/commerce/HttpCommerceClient.ts'),
    'utf8'
  );
  const routerSource = fs.readFileSync(
    path.resolve(process.cwd(), 'server/api/v1Router.ts'),
    'utf8'
  ).replace(/\r\n/g, '\n');
  const firestoreSource = fs.readFileSync(
    path.resolve(process.cwd(), 'server/firestoreService.ts'),
    'utf8'
  );
  const favouritesSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/features/account/FavouritesAndBuyAgain.tsx'),
    'utf8'
  );
  const customerAccountSource = fs.readFileSync(
    path.resolve(process.cwd(), 'server/customerAccountService.ts'),
    'utf8'
  );

  it('uses the supported basket item removal API in checkout', () => {
    expect(checkoutSource).not.toContain('removeFromBasket(basket.id, plu)');
    expect(checkoutSource).toContain('removeBasketItem(basket.id, plu)');
  });

  it('does not expose promo and tip controls as live features before they are implemented', () => {
    expect(checkoutSource).toContain('{isDemo && !isCollectionBasket && (');
    expect(checkoutSource).toContain('{isDemo && <div className="p-3 rounded-2xl');
  });

  it('links signed-in checkout identity to order history', () => {
    expect(clientSource).toContain('const token = await getCurrentIdToken()');
    expect(clientSource).toContain('Authorization: `Bearer ${token}`');
    expect(routerSource).toContain('const callerUid = await getCallerUid(req)');
    expect(routerSource).toContain('callerUid,\n        guestOrderAccessTokenHash\n      );');
    expect(firestoreSource).toContain('customerUid: customerUid || (rawOrderInput as any)?.customerUid || undefined');
    expect(firestoreSource).toContain('attachCustomerUidToOrderProjection');
  });

  it('persists signed-in favourites through the tenant-scoped BFF boundary', () => {
    expect(routerSource).toContain("v1Router.get('/account/favourites'");
    expect(routerSource).toContain("'/account/favourites',");
    expect(routerSource).toContain('CustomerAccountService.saveFavourites');
    expect(customerAccountSource).toContain(".collection('tenants')");
    expect(customerAccountSource).toContain(".collection('customerProfiles')");
    expect(favouritesSource).toContain("fetch('/api/v1/account/favourites'");
    expect(favouritesSource).toContain('Authorization: `Bearer ${token}`');
  });

  it('uses real order history and product refresh for Buy Again instead of timed simulation', () => {
    expect(favouritesSource).toContain('.getOrderHistory()');
    expect(favouritesSource).toContain('.getProduct(');
    expect(favouritesSource).not.toContain('Simulate authoritative BFF re-validation');
    expect(favouritesSource).not.toContain('setTimeout(r, 450)');
  });
  it('authenticates signed-in single-order tracking just like order history', () => {
    expect(clientSource).toContain('async getOrder(orderId: string)');
    expect(clientSource).toContain('const token = await getCurrentIdToken().catch(() => null)');
    expect(clientSource).toContain('Authorization: `Bearer ${token}`');
  });

  it('does not let a signed-in user claim an existing guest checkout', () => {
    expect(routerSource).toContain('assertCheckoutRecoveryOwnership(existingBasketCheckout, callerUid)');
    expect(routerSource).toContain('An existing guest checkout cannot be attached to a signed-in account.');
    expect(routerSource).not.toContain('attachCustomerUidToOrderProjection(\n          existingBasketCheckout.orderId');
    expect(routerSource).toContain('customerUid: callerUid || checkoutResult.customerUid');
  });

  it('keeps checkout order route and existing payment amount server-authoritative', () => {
    expect(routerSource).toContain('const configuredOrderRoute');
    expect(routerSource).toContain('isDemoMode() && checkoutOptions.orderRoute');
    expect(routerSource).toContain('Payment authorization does not match the current server-authoritative basket total.');
    expect(routerSource).toContain("code: 'PAYMENT_AMOUNT_MISMATCH'");
  });
});
