import { beforeEach, describe, expect, it } from 'vitest';
import { FirestorePlatformService } from '../../server/firestoreService';
import { SubstitutionCallbackService } from '../../server/deliverect/SubstitutionCallbackService';
import { setServerRuntimeMode } from '../../server/runtimeMode';

describe('Basket substitution preference persistence', () => {
  beforeEach(() => {
    setServerRuntimeMode('demo');
  });

  it('survives into the order projection and Quest candidate callback with approved minor-unit price', async () => {
    const suffix = Date.now().toString();
    const tenantId = 'brand-alpha';
    const basketId = `basket-pref-${suffix}`;
    const orderId = `order-pref-${suffix}`;
    const plu = 'ORIGINAL-1';

    await FirestorePlatformService.saveBasketItemSubstitutionPreference(
      tenantId,
      basketId,
      plu,
      {
        preference: 'CUSTOMER_SELECTED',
        preferredSubstitutePlu: 'SUB-1',
        preferredSubstituteName: 'Approved Substitute',
        preferredSubstitutePrice: { amount: 250, currency: 'GBP' },
      }
    );

    const stored = await FirestorePlatformService.getBasketSubstitutionPreferences(
      tenantId,
      basketId
    );
    expect(stored[plu]).toEqual(
      expect.objectContaining({
        preference: 'CUSTOMER_SELECTED',
        preferredSubstitutePlu: 'SUB-1',
        preferredSubstitutePrice: { amount: 250, currency: 'GBP' },
      })
    );

    const projection = await FirestorePlatformService.saveOrderProjection(
      {
        id: orderId,
        status: 'ACCEPTED',
        fulfillmentType: 'pickup',
        originalBasket: {
          id: basketId,
          fulfillmentType: 'pickup',
          currency: 'GBP',
          total: { amount: 200, currency: 'GBP' },
          items: [
            {
              id: 'line-1',
              plu,
              name: 'Original Item',
              quantity: 1,
              price: { amount: 200, currency: 'GBP' },
            },
          ],
        },
        currentOrder: {
          itemCount: 1,
          total: { amount: 200, currency: 'GBP' },
        },
      },
      tenantId
    );

    const pickingItem = projection.picking?.items.find((item) => item.plu === plu);
    expect(pickingItem).toEqual(
      expect.objectContaining({
        substitutionPreference: 'CUSTOMER_SELECTED',
        preferredSubstitutePlu: 'SUB-1',
        preferredSubstituteName: 'Approved Substitute',
        preferredSubstitutePrice: { amount: 250, currency: 'GBP' },
      })
    );

    const policy = await SubstitutionCallbackService.getSubstitutionForPlu(
      orderId,
      plu,
      tenantId
    );
    expect(policy).toEqual(
      expect.objectContaining({
        preference: 'CUSTOMER_SELECTED',
        action: 'SUBSTITUTE',
        candidates: [
          expect.objectContaining({
            plu: 'SUB-1',
            approvedPrice: { amount: 250, currency: 'GBP' },
          }),
        ],
      })
    );

    const questCandidates = await SubstitutionCallbackService.getQuestSubstituteCandidates(
      orderId,
      plu,
      tenantId
    );
    expect(questCandidates).toEqual([
      {
        plu: 'SUB-1',
        quantity: 1,
        name: 'Approved Substitute',
        price: 250,
      },
    ]);
  });
});
