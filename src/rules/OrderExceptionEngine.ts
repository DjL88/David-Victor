import type { OrderExceptionPolicy, OrderOperationalException } from './types';

export interface ExceptionObservation {
  exceptionId: string;
  tenantId: string;
  orderId: string;
  storeId?: string;
  type: OrderOperationalException['type'];
  reasonCode: string;
  sourceSystem?: string;
  correlationId?: string;
  observedAt: string;
}

export function observeOrderException(
  policy: OrderExceptionPolicy,
  observation: ExceptionObservation,
  existing?: OrderOperationalException
): OrderOperationalException {
  if (policy.tenantId !== observation.tenantId) throw new Error('Order exception policy belongs to another tenant.');
  if (existing && (existing.tenantId !== observation.tenantId || existing.orderId !== observation.orderId)) {
    throw new Error('Existing exception belongs to another tenant or order.');
  }

  const attemptCount = (existing?.attemptCount ?? 0) + 1;
  const exhausted = attemptCount >= policy.maximumRetryAttempts;
  const status: OrderOperationalException['status'] = exhausted
    ? policy.onRetriesExhausted === 'MANUAL_REVIEW' ? 'MANUAL_REVIEW'
      : policy.onRetriesExhausted === 'CANCEL' ? 'CANCELLED'
      : 'OPEN'
    : 'RETRY_SCHEDULED';

  const observed = new Date(observation.observedAt).getTime();
  const nextRetryAt = status === 'RETRY_SCHEDULED'
    ? new Date(observed + policy.retryDelaySeconds * 1000).toISOString()
    : undefined;

  return {
    exceptionId: existing?.exceptionId ?? observation.exceptionId,
    tenantId: observation.tenantId,
    orderId: observation.orderId,
    storeId: observation.storeId ?? existing?.storeId,
    type: observation.type,
    status,
    reasonCode: observation.reasonCode,
    correlationId: observation.correlationId ?? existing?.correlationId,
    sourceSystem: observation.sourceSystem ?? existing?.sourceSystem,
    attemptCount,
    firstObservedAt: existing?.firstObservedAt ?? observation.observedAt,
    lastObservedAt: observation.observedAt,
    nextRetryAt,
    metadata: existing?.metadata,
  };
}

export function recoverOrderException(
  exception: OrderOperationalException,
  recoveredAt: string
): OrderOperationalException {
  if (exception.status === 'RESOLVED' || exception.status === 'RECOVERED') return exception;
  return { ...exception, status: 'RECOVERED', nextRetryAt: undefined, resolvedAt: recoveredAt };
}
