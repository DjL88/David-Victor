import { beforeEach, describe, expect, it } from 'vitest';
import { FirestorePlatformService, OrderProjection } from '../../server/firestoreService';
import { PaymentService } from '../../server/deliverect/PaymentService';
import { setServerRuntimeMode } from '../../server/runtimeMode';

describe('bundle protected pricing through Quest settlement', () => {
  const tenantId = 'brand-alpha';

  beforeEach(() => {
    setServerRuntimeMode('demo');
  });

  async function createProtectedBundleOrder(suffix: string) {
    const basketId = `basket-bundle-settlement-${suffix}`;
    const orderId = `order-bundle-settlement-${suffix}`;

    await FirestorePlatformService.saveBasketBundleAllocation(
      tenantId,
      basketId,
      {
        bundleInstanceId: `bundle-instance-${suffix}`,
        bundleId: 'bundle-1',
        bundlePlu: 'MEAL-DEAL',
        bundleName: 'Meal Deal',
        currency: 'GBP',
        bundleQuantity: 1,
        baseBundlePriceMinor: 500,
        upliftTotalMinor: 0,
        targetBundleTotalMinor: 500,
        standaloneTotalMinor: 600,
        discountTotalMinor: 100,
        components: [
          {
            modifierId: 'a-mod',
            componentPlu: 'A',
            componentName: 'Main',
            sectionId: 'main',
            sectionName: 'Choose a main',
            quantity: 1,
            standaloneUnitPriceMinor: 300,
            upliftUnitPriceMinor: 0,
            protectedUnitPricesMinor: [250],
            standaloneLineTotalMinor: 300,
            protectedLineTotalMinor: 250,
            discountLineMinor: 50,
          },
          {
            modifierId: 'b-mod',
            componentPlu: 'B',
            componentName: 'Drink',
            sectionId: 'drink',
            sectionName: 'Choose a drink',
            quantity: 1,
            standaloneUnitPriceMinor: 200,
            upliftUnitPriceMinor: 0,
            protectedUnitPricesMinor: [167],
            standaloneLineTotalMinor: 200,
            protectedLineTotalMinor: 167,
            discountLineMinor: 33,
          },
          {
            modifierId: 'c-mod',
            componentPlu: 'C',
            componentName: 'Snack',
            sectionId: 'snack',
            sectionName: 'Choose a snack',
            quantity: 1,
            standaloneUnitPriceMinor: 100,
            upliftUnitPriceMinor: 0,
            protectedUnitPricesMinor: [83],
            standaloneLineTotalMinor: 100,
            protectedLineTotalMinor: 83,
            discountLineMinor: 17,
          },
        ],
        createdAt: new Date().toISOString(),
      }
    );

    const projection = await FirestorePlatformService.saveOrderProjection(
      {
        id: orderId,
        orderReference: `REF-${suffix}`,
        basketId,
        channelLinkId: 'store-1',
        status: 'PICKING',
        fulfillmentType: 'pickup',
        fulfillment: { type: 'pickup' },
        originalBasket: {
          id: basketId,
          fulfillmentType: 'pickup',
          currency: 'GBP',
          total: { amount: 500, currency: 'GBP' },
          items: [
            {
              id: 'line-a',
              plu: 'A',
              name: 'Main',
              quantity: 1,
              price: { amount: 300, currency: 'GBP' },
            },
            {
              id: 'line-b',
              plu: 'B',
              name: 'Drink',
              quantity: 1,
              price: { amount: 200, currency: 'GBP' },
            },
            {
              id: 'line-c',
              plu: 'C',
              name: 'Snack',
              quantity: 1,
              price: { amount: 100, currency: 'GBP' },
            },
          ],
        },
        currentOrder: {
          itemCount: 3,
          total: { amount: 500, currency: 'GBP' },
        },
        paymentState: 'AUTHORIZED',
        createdAt: new Date().toISOString(),
      } as any,
      tenantId
    );

    for (const item of projection.picking?.items || []) {
      await FirestorePlatformService.updateOrderPickingItem(orderId, item.plu, {
        state: 'PICKED',
        pickedQuantity: item.originalQuantity,
      });
    }

    return {
      basketId,
      orderId,
      projection: await FirestorePlatformService.getOrderProjection(orderId),
    };
  }

  it('snapshots protected bundle unit values into the Quest picking projection', async () => {
    const { projection } = await createProtectedBundleOrder(`snapshot-${Date.now()}`);

    expect(projection?.metadata?.bundlePricingVersion).toBe(1);
    expect(projection?.metadata?.bundleAllocations).toHaveLength(1);

    const byPlu = Object.fromEntries(
      (projection?.picking?.items || []).map((item) => [
        item.plu,
        item.bundlePricing?.protectedUnitPrices.map((price) => price.amount),
      ])
    );

    expect(byPlu).toEqual({
      A: [250],
      B: [167],
      C: [83],
    });
    expect(PaymentService.calculateAuthoritativeFinalAmount(projection as OrderProjection))
      .toBe(500);
  });

  it('removes only the missing component protected value and never reprices survivors upward', async () => {
    const { orderId } = await createProtectedBundleOrder(`remove-${Date.now()}`);

    await FirestorePlatformService.updateOrderPickingItem(orderId, 'B', {
      state: 'REMOVED',
      pickedQuantity: 0,
      finalPrice: { amount: 0, currency: 'GBP' },
    });

    const updated = await FirestorePlatformService.getOrderProjection(orderId);

    // £5.00 original bundle less B's protected £1.67 = £3.33.
    expect(PaymentService.calculateAuthoritativeFinalAmount(updated as OrderProjection))
      .toBe(333);
  });

  it('keeps a Best Match substitution capped by the component protected value', async () => {
    const { orderId } = await createProtectedBundleOrder(`best-match-${Date.now()}`);

    await FirestorePlatformService.updateOrderPickingItem(orderId, 'C', {
      state: 'SUBSTITUTED',
      pickedQuantity: 1,
      finalPrice: { amount: 100, currency: 'GBP' },
      substitution: {
        type: 'BEST_MATCH',
        originalPlu: 'C',
        originalName: 'Snack',
        originalPrice: { amount: 100, currency: 'GBP' },
        substitutePlu: 'C-ALT',
        substituteName: 'Alternative Snack',
        substitutePrice: { amount: 150, currency: 'GBP' },
        chargedPrice: { amount: 100, currency: 'GBP' },
      },
    });

    const updated = await FirestorePlatformService.getOrderProjection(orderId);

    // C remains protected at 83p even though the replacement is £1.50.
    expect(PaymentService.calculateAuthoritativeFinalAmount(updated as OrderProjection))
      .toBe(500);
  });

  it('never lets a customer-selected higher substitute exceed the protected original component line value', async () => {
    const { orderId } = await createProtectedBundleOrder(`approved-${Date.now()}`);

    await FirestorePlatformService.updateOrderPickingItem(orderId, 'B', {
      state: 'SUBSTITUTED',
      pickedQuantity: 1,
      preferredSubstitutePrice: { amount: 300, currency: 'GBP' },
      finalPrice: { amount: 300, currency: 'GBP' },
      substitution: {
        type: 'CUSTOMER_SELECTED',
        originalPlu: 'B',
        originalName: 'Drink',
        originalPrice: { amount: 200, currency: 'GBP' },
        substitutePlu: 'B-PREMIUM',
        substituteName: 'Premium Drink',
        substitutePrice: { amount: 300, currency: 'GBP' },
        chargedPrice: { amount: 300, currency: 'GBP' },
      },
    });

    const updated = await FirestorePlatformService.getOrderProjection(orderId);

    // Legacy/imported fields may still contain a higher per-unit value, but
    // authoritative settlement remains A 250 + protected B 167 + C 83 = 500.
    expect(PaymentService.calculateAuthoritativeFinalAmount(updated as OrderProjection))
      .toBe(500);
  });

  it('uses the cheapest protected units first when the same PLU has bundle and standalone quantity', () => {
    const order: OrderProjection = {
      orderId: 'mixed-bundle-and-standalone',
      tenantId,
      status: 'PICKING',
      total: 550,
      fulfillmentType: 'pickup',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      picking: {
        status: 'IN_PROGRESS',
        totalItems: 1,
        itemsPicked: 1,
        hasChanges: true,
        items: [
          {
            id: 'line-a',
            plu: 'A',
            name: 'Main',
            originalQuantity: 2,
            pickedQuantity: 1,
            originalPrice: { amount: 300, currency: 'GBP' },
            finalPrice: { amount: 300, currency: 'GBP' },
            state: 'QUANTITY_AMENDED',
            bundlePricing: {
              protectedUnitPrices: [{ amount: 250, currency: 'GBP' }],
              bundleInstanceIds: ['bundle-instance-1'],
            },
          },
        ],
      },
    };

    // One A belonged to the bundle at £2.50 and one was standalone at £3.00.
    // If Quest supplies only one, the customer keeps the protected £2.50 unit.
    expect(PaymentService.calculateAuthoritativeFinalAmount(order)).toBe(250);
  });
});
