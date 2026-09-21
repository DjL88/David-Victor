import type { CheckoutResult } from '../../src/domain/models';

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Merge an authoritative upstream checkout refresh into the locally persisted
 * checkout without erasing correlation fields that Deliverect may omit on GET.
 *
 * Upstream owns lifecycle status and any newly learned real order id. Local state
 * retains channel/idempotency/payment correlation when the upstream field is empty.
 */
export function mergeCheckoutProjection(
  existing: CheckoutResult | null,
  upstream: CheckoutResult
): CheckoutResult {
  if (!existing) return upstream;

  return {
    ...existing,
    ...upstream,
    checkoutId: nonEmpty(upstream.checkoutId) ? upstream.checkoutId : existing.checkoutId,
    channelOrderReference: nonEmpty(upstream.channelOrderReference)
      ? upstream.channelOrderReference
      : existing.channelOrderReference,
    orderId: nonEmpty(upstream.orderId) ? upstream.orderId : existing.orderId,
    tenantId: nonEmpty(upstream.tenantId) ? upstream.tenantId : existing.tenantId,
    storeId: nonEmpty(upstream.storeId) ? upstream.storeId : existing.storeId,
    channelLinkId: nonEmpty(upstream.channelLinkId)
      ? upstream.channelLinkId
      : existing.channelLinkId,
    basketId: nonEmpty(upstream.basketId) ? upstream.basketId : existing.basketId,
    fulfillmentType:
      upstream.fulfillmentType === 'pickup' || upstream.fulfillmentType === 'delivery'
        ? upstream.fulfillmentType
        : existing.fulfillmentType,
    total: upstream.total || existing.total,
    paymentId: nonEmpty(upstream.paymentId) ? upstream.paymentId : existing.paymentId,
    idempotencyKey: nonEmpty(upstream.idempotencyKey)
      ? upstream.idempotencyKey
      : existing.idempotencyKey,
    dispatchValidationId: nonEmpty(upstream.dispatchValidationId)
      ? upstream.dispatchValidationId
      : existing.dispatchValidationId,
    order: upstream.order || existing.order,
    failureReason: upstream.failureReason || existing.failureReason,
    createdAt: existing.createdAt || upstream.createdAt,
    updatedAt: upstream.updatedAt || new Date().toISOString(),
  };
}
