import { describe, expect, it } from 'vitest';
import { projectRetailQuestOrder } from '../../server/deliverect/RetailQuestOrderContract';

describe('WP-03 Retail/Quest deterministic certification contract', () => {
  const base = {
    channelOrderId: 'LT-CERT-0001',
    channelOrderDisplayId: 'LT-0001',
    fulfillmentType: 'pickup' as const,
    totalMinor: 2205,
    hasOnlineAuthorization: true,
    items: [
      { plu: 'DAV1005', name: "Dave's Salted Potato Crisps 150g", quantity: 1, unitPriceMinor: 155, substitutionPreference: 'BEST_MATCH' },
      { plu: 'JOE1006', name: 'Joe Product', quantity: 1, unitPriceMinor: 2050, substitutionPreference: 'CUSTOMER_SELECTED', preferredSubstitutePlu: 'JOE-SUB', preferredSubstituteName: 'Joe Substitute', preferredSubstitutePriceMinor: 2100 },
    ],
  };

  it('freezes paid Quest semantics and unavailable-item actions', () => {
    const payload = projectRetailQuestOrder(base);
    expect(payload).toMatchObject({
      channelOrderId: 'LT-CERT-0001',
      channelOrderDisplayId: 'LT-0001',
      orderType: 1,
      deliveryIsAsap: true,
      decimalDigits: 2,
      payment: { amount: 2205, due: 0, rebate: 0, type: 0 },
      orderIsAlreadyPaid: true,
    });
    expect(payload).not.toHaveProperty('placedTime');
    expect(payload.items[0].itemUnavailableActions).toEqual([
      'ITEM_AMENDMENT', 'ITEM_REMOVE', 'ITEM_SUBSTITUTION', 'ITEM_SUBSTITUTION_CATALOG',
    ]);
    expect(payload.items[1]).toMatchObject({
      itemUnavailableActions: ['ITEM_AMENDMENT', 'ITEM_REMOVE', 'ITEM_SUBSTITUTION_CUSTOMER'],
      substituteCandidate: [{ plu: 'JOE-SUB', name: 'Joe Substitute', quantity: 1, price: 2100 }],
    });
  });

  it('keeps explicitly unpaid/COD semantics distinct instead of pretending payment succeeded', () => {
    const payload = projectRetailQuestOrder({ ...base, hasOnlineAuthorization: false });
    expect(payload.payment).toMatchObject({ amount: 2205, due: 2205 });
    expect(payload.orderIsAlreadyPaid).toBe(false);
  });

  it('freezes delivery address, scheduling and orderType semantics', () => {
    const payload = projectRetailQuestOrder({
      ...base,
      fulfillmentType: 'delivery',
      fulfillmentTime: '2026-09-24T20:00:00Z',
      deliveryAddress: { line1: '1 Test Road', postcode: 'B1 1AA', city: 'Birmingham', country: 'GB', latitude: 52.48, longitude: -1.9 },
    });
    expect(payload).toMatchObject({
      orderType: 2,
      deliveryIsAsap: false,
      deliveryTime: '2026-09-24T20:00:00.000Z',
      deliveryAddress: {
        street: '1 Test Road', postalCode: 'B1 1AA', city: 'Birmingham', country: 'GB',
        coordinates: [{ latitude: 52.48, longitude: -1.9 }],
      },
    });
  });

  it('fails closed on malformed money, quantity and missing delivery address', () => {
    expect(() => projectRetailQuestOrder({ ...base, totalMinor: 22.05 })).toThrow(/total/);
    expect(() => projectRetailQuestOrder({ ...base, items: [{ ...base.items[0], quantity: 0 }] })).toThrow(/quantity/);
    expect(() => projectRetailQuestOrder({ ...base, fulfillmentType: 'delivery' })).toThrow(/address/);
  });
});
