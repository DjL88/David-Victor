import { describe, expect, it } from 'vitest';
import { applyRefundRequest, RefundLedgerConflictError } from '../rules/RefundLedger';
import type { OrderRefundLedger, RefundRequest } from '../rules/types';

const ledger = (): OrderRefundLedger => ({
  tenantId: 'retailer-a',
  orderId: 'order-1',
  currency: 'GBP',
  originalOrderAmountMinor: 1500,
  totalRefundedAmountMinor: 0,
  remainingRefundableAmountMinor: 1500,
  version: 4,
  updatedAt: '2026-09-22T00:00:00.000Z',
  lines: [
    { lineId: 'item:ice', type: 'ITEM', plu: 'ICE', originalQuantity: 2, refundedQuantity: 0, originalAmountMinor: 1000, refundedAmountMinor: 0, remainingRefundableAmountMinor: 1000 },
    { lineId: 'fee:delivery', type: 'DELIVERY_FEE', refundedQuantity: 0, originalAmountMinor: 300, refundedAmountMinor: 0, remainingRefundableAmountMinor: 300 },
    { lineId: 'fee:service', type: 'SERVICE_FEE', refundedQuantity: 0, originalAmountMinor: 200, refundedAmountMinor: 0, remainingRefundableAmountMinor: 200 },
  ],
});

const request = (lines: RefundRequest['lines'], version = 4): RefundRequest => ({
  refundRequestId: 'refund-1',
  idempotencyKey: 'refund-key-1',
  tenantId: 'retailer-a',
  orderId: 'order-1',
  expectedLedgerVersion: version,
  lines,
  actorId: 'agent-1',
  reasonCode: 'CUSTOMER_CARE',
  createdAt: '2026-09-22T01:00:00.000Z',
});

describe('RefundLedger', () => {
  it('partially refunds item quantity and preserves remaining order balance', () => {
    const result = applyRefundRequest(ledger(), request([{ lineId: 'item:ice', quantity: 1, amountMinor: 500 }]), 'now');
    expect(result.nextLedger.remainingRefundableAmountMinor).toBe(1000);
    expect(result.nextLedger.version).toBe(5);
    expect(result.nextLedger.lines[0]).toMatchObject({ refundedQuantity: 1, refundedAmountMinor: 500, remainingRefundableAmountMinor: 500 });
  });

  it('allows delivery and service fees to be refunded independently', () => {
    const result = applyRefundRequest(ledger(), request([
      { lineId: 'fee:delivery', amountMinor: 300 },
      { lineId: 'fee:service', amountMinor: 200 },
    ]));
    expect(result.refundedAmountMinor).toBe(500);
    expect(result.nextLedger.remainingRefundableAmountMinor).toBe(1000);
  });

  it('rejects refunding more item quantity than remains', () => {
    const partiallyRefunded = ledger();
    partiallyRefunded.lines[0].refundedQuantity = 1;
    partiallyRefunded.lines[0].refundedAmountMinor = 500;
    partiallyRefunded.lines[0].remainingRefundableAmountMinor = 500;
    expect(() => applyRefundRequest(partiallyRefunded, request([{ lineId: 'item:ice', quantity: 2, amountMinor: 500 }])))
      .toThrow(RefundLedgerConflictError);
  });

  it('rejects stale concurrent refund writers', () => {
    expect(() => applyRefundRequest(ledger(), request([{ lineId: 'fee:delivery', amountMinor: 300 }], 3)))
      .toThrow(/stale/i);
  });

  it('rejects a second full refund of an already-refunded fee', () => {
    const used = ledger();
    used.lines[1].refundedAmountMinor = 300;
    used.lines[1].remainingRefundableAmountMinor = 0;
    used.totalRefundedAmountMinor = 300;
    used.remainingRefundableAmountMinor = 1200;
    expect(() => applyRefundRequest(used, request([{ lineId: 'fee:delivery', amountMinor: 300 }])))
      .toThrow(/remaining balance for a line/i);
  });

  it('rejects duplicate line IDs in one request', () => {
    expect(() => applyRefundRequest(ledger(), request([
      { lineId: 'fee:service', amountMinor: 100 },
      { lineId: 'fee:service', amountMinor: 100 },
    ]))).toThrow(/only appear once/i);
  });
});
