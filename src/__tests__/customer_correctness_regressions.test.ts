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
});
