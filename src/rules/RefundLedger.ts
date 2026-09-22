import type { OrderRefundLedger, RefundRequest } from './types';

export class RefundLedgerConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RefundLedgerConflictError';
  }
}

export interface RefundValidationResult {
  nextLedger: OrderRefundLedger;
  refundedAmountMinor: number;
}

/**
 * Pure refund-ledger transition. Persistence must wrap this in a transaction and enforce
 * the expected version/idempotency key before executing any external payment refund.
 */
export function applyRefundRequest(
  ledger: OrderRefundLedger,
  request: RefundRequest,
  now: string = new Date().toISOString()
): RefundValidationResult {
  if (ledger.tenantId !== request.tenantId || ledger.orderId !== request.orderId) {
    throw new RefundLedgerConflictError('Refund request does not belong to this order ledger.');
  }
  if (request.expectedLedgerVersion !== ledger.version) {
    throw new RefundLedgerConflictError('Refund ledger version is stale.');
  }
  if (!request.lines.length) throw new RefundLedgerConflictError('Refund request has no lines.');

  const seen = new Set<string>();
  let total = 0;
  const requested = new Map(request.lines.map(line => {
    if (seen.has(line.lineId)) throw new RefundLedgerConflictError('A refund line may only appear once per request.');
    seen.add(line.lineId);
    if (!Number.isInteger(line.amountMinor) || line.amountMinor <= 0) {
      throw new RefundLedgerConflictError('Refund amount must be a positive integer in minor currency units.');
    }
    if (line.quantity !== undefined && (!Number.isInteger(line.quantity) || line.quantity <= 0)) {
      throw new RefundLedgerConflictError('Refund quantity must be a positive integer.');
    }
    total += line.amountMinor;
    return [line.lineId, line] as const;
  }));

  if (total > ledger.remainingRefundableAmountMinor) {
    throw new RefundLedgerConflictError('Refund exceeds the remaining order balance.');
  }

  let matched = 0;
  const lines = ledger.lines.map(line => {
    const refund = requested.get(line.lineId);
    if (!refund) return { ...line };
    matched += 1;

    if (refund.amountMinor > line.remainingRefundableAmountMinor) {
      throw new RefundLedgerConflictError('Refund exceeds the remaining balance for a line.');
    }

    const isItem = line.type === 'ITEM';
    const remainingQuantity = (line.originalQuantity ?? 0) - line.refundedQuantity;
    if (isItem) {
      if (refund.quantity === undefined) throw new RefundLedgerConflictError('Item refunds require a quantity.');
      if (refund.quantity > remainingQuantity) {
        throw new RefundLedgerConflictError('Refund exceeds the remaining item quantity.');
      }
    } else if (refund.quantity !== undefined) {
      throw new RefundLedgerConflictError('Fee refunds do not accept item quantity.');
    }

    return {
      ...line,
      refundedQuantity: line.refundedQuantity + (refund.quantity ?? 0),
      refundedAmountMinor: line.refundedAmountMinor + refund.amountMinor,
      remainingRefundableAmountMinor: line.remainingRefundableAmountMinor - refund.amountMinor,
    };
  });

  if (matched !== requested.size) throw new RefundLedgerConflictError('Refund references an unknown order line.');

  return {
    refundedAmountMinor: total,
    nextLedger: {
      ...ledger,
      totalRefundedAmountMinor: ledger.totalRefundedAmountMinor + total,
      remainingRefundableAmountMinor: ledger.remainingRefundableAmountMinor - total,
      lines,
      version: ledger.version + 1,
      updatedAt: now,
    },
  };
}
