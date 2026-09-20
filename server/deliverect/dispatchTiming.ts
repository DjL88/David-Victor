import { TenantDispatchRules } from '../../src/rules/types';

/**
 * Pure, testable dispatch timing calculation logic.
 *
 * Requirements:
 * - Estimated pick minutes = ceil(total item quantity / itemsPickedPerMinute)
 * - Defaults: itemsPickedPerMinute = 3, readyBufferMinutes = 1
 * - Target pickup time = startTime + (estimated pick minutes + readyBufferMinutes)
 * - If dynamic timing is enabled and target pickup time is sufficiently in the future,
 *   schedule assignment if provider supports scheduled assignment.
 * - If provider APIs do not support scheduled assignment, preserve the target time
 *   and execute/retry at the closest safe lifecycle event; do not fake support.
 */

export interface DispatchTimingInput {
  totalItemQuantity?: number;
  itemsCount?: number;
  rules?: TenantDispatchRules;
  itemsPickedPerMinute?: number;
  readyBufferMinutes?: number;
  courierTransitMinutes?: number;
  orderCreatedAt?: Date | string;
  referenceTime?: Date | string;
  baseTime?: Date | string;
  providerSupportsScheduled?: boolean;
}

export interface DispatchTimingResult {
  estimatedPickMinutes: number;
  calculatedPickMinutes: number;
  readyBufferMinutes: number;
  courierTransitMinutes: number;
  targetReadyTime: string; // ISO 8601
  targetPickupTime: string; // ISO 8601
  estimatedDeliveryTime: string; // ISO 8601
  targetPickupMinutesFromNow: number;
  estimatedDeliveryMinutesFromNow: number;
  shouldSchedule: boolean;
  scheduleFor?: string; // ISO 8601
  delayMinutes: number;
  preservesTargetTimeWithoutScheduling: boolean;
}

/**
 * Calculates estimated pick time in whole minutes.
 * Formula: ceil(total item quantity / itemsPickedPerMinute)
 *
 * Example: 6 items at 3/min => 2 minutes.
 * Example: 7 items at 3/min => 3 minutes.
 * Example: 0 items => 0 minutes.
 */
export function calculateEstimatedPickMinutes(
  totalItemQuantity: number,
  itemsPickedPerMinute = 3
): number {
  if (!totalItemQuantity || totalItemQuantity <= 0) {
    return 0;
  }
  const rate = typeof itemsPickedPerMinute === 'number' && itemsPickedPerMinute > 0
    ? itemsPickedPerMinute
    : 3;
  return Math.ceil(totalItemQuantity / rate);
}

/**
 * Calculates target pickup / courier ready time and scheduling feasibility.
 */
export function calculateDispatchTiming(
  input: DispatchTimingInput
): DispatchTimingResult {
  const rules = input.rules;
  const count = input.itemsCount ?? input.totalItemQuantity ?? 0;
  const isDynamic = rules ? rules.dynamicTiming !== false : true;

  const itemsPickedPerMinute = input.itemsPickedPerMinute ?? rules?.itemsPickedPerMinute ?? 3;
  const readyBufferMinutes = input.readyBufferMinutes ?? rules?.readyBufferMinutes ?? 1;
  const courierTransitMinutes = input.courierTransitMinutes ?? rules?.courierTransitMinutes ?? 15;
  const minLeadMinutes = rules?.minimumPickupLeadMinutes ?? 5;
  const defaultLeadMinutes = rules?.defaultLeadTimeMinutes ?? 20;

  const estimatedPickMinutes = calculateEstimatedPickMinutes(count, itemsPickedPerMinute);

  let targetPickupMinutesFromNow: number;
  if (isDynamic) {
    targetPickupMinutesFromNow = Math.max(minLeadMinutes, estimatedPickMinutes + readyBufferMinutes);
  } else {
    targetPickupMinutesFromNow = defaultLeadMinutes;
  }

  const estimatedDeliveryMinutesFromNow = targetPickupMinutesFromNow + courierTransitMinutes;

  const startTime = input.baseTime
    ? new Date(input.baseTime)
    : input.orderCreatedAt
    ? new Date(input.orderCreatedAt)
    : new Date();

  const refTime = input.referenceTime
    ? new Date(input.referenceTime)
    : input.baseTime
    ? new Date(input.baseTime)
    : new Date();

  const targetPickupDate = new Date(startTime.getTime() + targetPickupMinutesFromNow * 60 * 1000);
  const targetDeliveryDate = new Date(startTime.getTime() + estimatedDeliveryMinutesFromNow * 60 * 1000);

  const diffMs = targetPickupDate.getTime() - refTime.getTime();
  const delayMinutes = Math.max(0, Math.ceil(diffMs / (60 * 1000)));

  // If delay is > 2 minutes and provider supports scheduling:
  const shouldSchedule = delayMinutes > 2;
  const providerSupportsScheduled = Boolean(input.providerSupportsScheduled);

  return {
    estimatedPickMinutes,
    calculatedPickMinutes: estimatedPickMinutes,
    readyBufferMinutes,
    courierTransitMinutes,
    targetReadyTime: targetPickupDate.toISOString(),
    targetPickupTime: targetPickupDate.toISOString(),
    estimatedDeliveryTime: targetDeliveryDate.toISOString(),
    targetPickupMinutesFromNow,
    estimatedDeliveryMinutesFromNow,
    shouldSchedule: shouldSchedule && providerSupportsScheduled,
    scheduleFor: shouldSchedule && providerSupportsScheduled ? targetPickupDate.toISOString() : undefined,
    delayMinutes,
    preservesTargetTimeWithoutScheduling: shouldSchedule && !providerSupportsScheduled,
  };
}
