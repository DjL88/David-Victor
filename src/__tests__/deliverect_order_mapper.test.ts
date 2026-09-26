import { describe, expect, it } from 'vitest';
import {
  DeliverectOrderMapper,
  normalizeDeliverectFulfillmentType,
  normalizeDeliverectOrderProjectionStatus,
} from '../../server/deliverect/DeliverectOrderMapper';

describe('DeliverectOrderMapper order/POS status normalization', () => {
  it('keeps documented preparation and ready/finalized codes out of delivered state', () => {
    expect(normalizeDeliverectOrderProjectionStatus(20)).toBe('ACCEPTED');
    expect(normalizeDeliverectOrderProjectionStatus(50)).toBe('PREPARING');
    expect(normalizeDeliverectOrderProjectionStatus(70)).toBe('READY');
    expect(normalizeDeliverectOrderProjectionStatus(90)).toBe('READY');
    expect(normalizeDeliverectOrderProjectionStatus(95)).toBe('READY');
  });

  it('does not revive the legacy numeric 5 => delivered conflation', () => {
    expect(normalizeDeliverectOrderProjectionStatus(5)).toBe('5');
    expect(normalizeDeliverectOrderProjectionStatus('5')).toBe('5');
  });

  it('keeps explicit courier-independent terminal order states conservative', () => {
    expect(normalizeDeliverectOrderProjectionStatus(110)).toBe('CANCELLED');
    expect(normalizeDeliverectOrderProjectionStatus(121)).toBe('ORDER_FAILED');
    expect(normalizeDeliverectOrderProjectionStatus('FINALIZED')).toBe('READY');
  });
});


describe('DeliverectOrderMapper fulfillment normalization', () => {
  it('maps the observed staging orderType=1 order to Bwydi pickup/Collection', () => {
    const order = DeliverectOrderMapper.normalizeOrder({
      id: 'deliverect-order-1',
      channelOrderId: 'BWYDI-STG-1789971843742-F2FF5F539E',
      channelOrderDisplayId: 'BW-5F539E',
      channelLinkId: '6aae58da8596ac8a7730c048',
      basketId: 'basket-real-1',
      orderType: 1,
      items: [
        {
          id: '6ab0cd83ce0c6601a789379a',
          plu: 'VIC1011',
          name: "Victor's Butter 250g",
          price: 210,
          quantity: 1,
        },
      ],
      total: 210,
      currency: 'GBP',
      orderIsAlreadyPaid: false,
    });

    expect(order.fulfillment.type).toBe('pickup');
    expect(order.originalBasket.fulfillmentType).toBe('pickup');
    expect(order.originalBasket.total.amount).toBe(210);
    expect(order.payment.state).toBe('NO_CAPTURE_REQUIRED');
    expect(order.orderReference).toBe('BWYDI-STG-1789971843742-F2FF5F539E');
  });

  it('maps Deliverect orderType=2 to delivery', () => {
    expect(normalizeDeliverectFulfillmentType({ orderType: 2 })).toBe('delivery');
  });

  it('normalizes explicit collection/pickup wording to pickup', () => {
    expect(normalizeDeliverectFulfillmentType({ fulfillmentType: 'collection' })).toBe('pickup');
    expect(normalizeDeliverectFulfillmentType({ fulfillment: { type: 'pickup' } })).toBe('pickup');
  });

  it('lets an explicit fulfillment type win over a conflicting legacy orderType', () => {
    expect(normalizeDeliverectFulfillmentType({ fulfillment: { type: 'pickup' }, orderType: 2 })).toBe('pickup');
  });

  it('preserves canonical fulfillment stored on an internal original basket projection', () => {
    expect(
      normalizeDeliverectFulfillmentType({
        originalBasket: { fulfillmentType: 'pickup' },
      })
    ).toBe('pickup');
  });

  it('fails closed for unsupported modes rather than defaulting to delivery', () => {
    expect(() => normalizeDeliverectFulfillmentType({ orderType: 3 })).toThrow(
      'Unsupported Deliverect fulfilment type'
    );
    expect(() => normalizeDeliverectFulfillmentType({})).toThrow(
      'Unsupported Deliverect fulfilment type'
    );
  });
});
