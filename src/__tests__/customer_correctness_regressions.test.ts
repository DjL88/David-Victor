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
  );
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
  const customerAccountClientSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/features/account/customerAccountClient.ts'),
    'utf8'
  );
  const appLayoutSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/app/AppLayout.tsx'),
    'utf8'
  );
  const locationPickerSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/features/location/LocationPickerModal.tsx'),
    'utf8'
  );
  const firestoreRulesSource = fs.readFileSync(
    path.resolve(process.cwd(), 'firestore.rules'),
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
    expect(routerSource).toContain('callerUid\n      );');
    expect(firestoreSource).toContain('customerUid: customerUid || (rawOrderInput as any)?.customerUid || undefined');
    expect(firestoreSource).toContain('attachCustomerUidToOrderProjection');
  });

  it('persists signed-in favourites through the tenant-scoped BFF boundary', () => {
    expect(routerSource).toContain("v1Router.get('/account/favourites'");
    expect(routerSource).toContain("'/account/favourites',");
    expect(routerSource).toContain('CustomerAccountService.saveFavourites');
    expect(customerAccountSource).toContain(".collection('tenants')");
    expect(customerAccountSource).toContain(".collection('customerProfiles')");
    expect(favouritesSource).toContain('getCustomerFavourites(tenant?.tenantId)');
    expect(favouritesSource).toContain('saveCustomerFavourites(next, tenant?.tenantId)');
    expect(customerAccountClientSource).toContain("fetch('/api/v1/account/favourites'");
    expect(customerAccountClientSource).toContain('Authorization: `Bearer ${token}`');
    expect(customerAccountClientSource).toContain("'x-tenant-id': tenantId");
  });

  it('uses real order history and product refresh for Buy Again instead of timed simulation', () => {
    expect(favouritesSource).toContain('.getOrderHistory()');
    expect(favouritesSource).toContain('.getProduct(');
    expect(favouritesSource).not.toContain('Simulate authoritative BFF re-validation');
    expect(favouritesSource).not.toContain('setTimeout(r, 450)');
  });

  it('persists saved addresses through the customer profile and exposes them to the location picker', () => {
    expect(routerSource).toContain("v1Router.get('/account/addresses'");
    expect(routerSource).toContain("'/account/addresses',");
    expect(routerSource).toContain('CustomerAccountService.saveAddresses');
    expect(customerAccountSource).toContain('savedAddresses: normalizeSavedAddresses(raw.savedAddresses)');
    expect(customerAccountClientSource).toContain("fetch('/api/v1/account/addresses'");
    expect(appLayoutSource).toContain('savedAddresses={savedAddresses}');
    expect(appLayoutSource).toContain('onSavedAddressesChange={setSavedAddresses}');
  });

  it('keeps saved address PII BFF-only and never fabricates saved-address coordinates', () => {
    expect(firestoreRulesSource).toContain('match /customerProfiles/{customerUid}');
    expect(firestoreRulesSource).toContain('allow read, write: if false;');
    expect(locationPickerSource).toContain('await onSelectAddress(query)');
    expect(locationPickerSource).not.toContain("stores[0]?.coordinates || { latitude: 51.5074, longitude: -0.1278 }");
  });
});
