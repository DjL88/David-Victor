/**
 * Fulfillment Scheduling & Slot Generation Engine.
 *
 * Computes available delivery and collection slots from:
 * - Store regular opening hours & special/holiday hours
 * - Tenant & store scheduling policies
 * - Fulfillment type (Delivery vs Pickup)
 * - Minimum lead times and maximum advance booking periods
 * - Slot length and capacity constraints
 */

import { Store } from './models';
import { SchedulingPolicy, DeliverySlot } from './postCheckoutModels';

export const DEFAULT_SCHEDULING_POLICY: SchedulingPolicy = {
  enabled: true,
  acceptsAsapOrders: true,
  acceptsPreOrders: true,
  acceptsSameDayPreOrders: true,
  minimumLeadTimeMinutes: 45,
  maximumDaysInAdvance: 3,
  slotLengthMinutes: 30,
  capacityPerSlot: 15,
  allowOrderingWhileClosed: true,
};

export interface StoreHours {
  openHour: number; // 0 - 23 (e.g., 7 for 07:00)
  openMinute: number;
  closeHour: number; // 0 - 23 (e.g., 22 for 22:00)
  closeMinute: number;
  isClosed?: boolean;
}

export interface SpecialHoursRule {
  dateString: string; // 'YYYY-MM-DD'
  name: string; // e.g. 'Bank Holiday', 'Christmas Eve'
  openHour: number;
  closeHour: number;
  isClosedAllDay?: boolean;
}

// Special holiday schedule rules
export const SPECIAL_STORE_HOURS: Record<string, SpecialHoursRule[]> = {
  default: [
    {
      dateString: '2026-12-25',
      name: 'Christmas Day',
      openHour: 0,
      closeHour: 0,
      isClosedAllDay: true,
    },
    {
      dateString: '2026-12-26',
      name: 'Boxing Day',
      openHour: 10,
      closeHour: 18,
    },
    {
      dateString: '2026-01-01',
      name: "New Year's Day",
      openHour: 9,
      closeHour: 19,
    },
  ],
};

/**
 * Parses store opening hours or defaults to 07:00 – 23:00.
 */
export function getStoreOpeningHours(
  store: Store,
  date: Date,
  specialHoursList: SpecialHoursRule[] = SPECIAL_STORE_HOURS.default
): StoreHours {
  const dateString = date.toISOString().split('T')[0];
  const holiday = specialHoursList.find((h) => h.dateString === dateString);

  if (holiday) {
    if (holiday.isClosedAllDay) {
      return { openHour: 0, openMinute: 0, closeHour: 0, closeMinute: 0, isClosed: true };
    }
    return {
      openHour: holiday.openHour,
      openMinute: 0,
      closeHour: holiday.closeHour,
      closeMinute: 0,
      isClosed: false,
    };
  }

  // Default grocery hours (Store-specific or standard 07:00 - 22:00)
  if (store.id === 'store-wickford-bypass') {
    // Wickford depot opens 07:00 - 22:00
    return { openHour: 7, openMinute: 0, closeHour: 22, closeMinute: 0, isClosed: false };
  }

  return { openHour: 7, openMinute: 0, closeHour: 23, closeMinute: 0, isClosed: false };
}

/**
 * Evaluates whether a store is currently open at a given moment.
 */
export function isStoreCurrentlyOpen(
  store: Store,
  referenceDate: Date = new Date()
): { isOpen: boolean; nextOpeningTime?: string } {
  if (store.status === 'closed') {
    return { isOpen: false, nextOpeningTime: '07:00' };
  }

  const hours = getStoreOpeningHours(store, referenceDate);
  if (hours.isClosed) {
    return { isOpen: false, nextOpeningTime: '07:00 tomorrow' };
  }

  const currentMinutes = referenceDate.getHours() * 60 + referenceDate.getMinutes();
  const openMinutes = hours.openHour * 60 + hours.openMinute;
  const closeMinutes = hours.closeHour * 60 + hours.closeMinute;

  const isOpen = currentMinutes >= openMinutes && currentMinutes < closeMinutes;
  const nextOpeningTime = `${String(hours.openHour).padStart(2, '0')}:${String(hours.openMinute).padStart(2, '0')}`;

  return { isOpen, nextOpeningTime };
}

/**
 * Generates slots for a specific day intersecting store hours, lead times, and scheduling policy.
 */
export function generateDaySlots(
  store: Store,
  targetDate: Date,
  policy: SchedulingPolicy,
  referenceDate: Date = new Date(),
  fulfillmentType: 'delivery' | 'pickup' = 'delivery'
): DeliverySlot[] {
  if (!policy.enabled || !policy.acceptsPreOrders) {
    return [];
  }

  const hours = getStoreOpeningHours(store, targetDate);
  if (hours.isClosed) return [];

  const isToday =
    targetDate.toISOString().split('T')[0] === referenceDate.toISOString().split('T')[0];

  if (isToday && !policy.acceptsSameDayPreOrders) {
    return [];
  }

  const slots: DeliverySlot[] = [];
  const dateString = targetDate.toISOString().split('T')[0];

  const nowMinutes = referenceDate.getHours() * 60 + referenceDate.getMinutes();
  const leadTime = policy.minimumLeadTimeMinutes;
  const earliestAllowedMinuteToday = nowMinutes + leadTime;

  const openMinutes = hours.openHour * 60 + hours.openMinute;
  const closeMinutes = hours.closeHour * 60 + hours.closeMinute;
  const slotLength = policy.slotLengthMinutes;

  // Day label formatting
  const todayDateStr = referenceDate.toISOString().split('T')[0];
  const tomorrow = new Date(referenceDate);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDateStr = tomorrow.toISOString().split('T')[0];

  let dayLabel = targetDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  if (dateString === todayDateStr) dayLabel = 'Today';
  else if (dateString === tomorrowDateStr) dayLabel = 'Tomorrow';

  let slotStart = openMinutes;
  let firstAvailableHighlighted = false;

  while (slotStart + slotLength <= closeMinutes) {
    const slotEnd = slotStart + slotLength;
    const isPastOrInsideLead = isToday && slotStart < earliestAllowedMinuteToday;

    const startH = Math.floor(slotStart / 60);
    const startM = slotStart % 60;
    const endH = Math.floor(slotEnd / 60);
    const endM = slotEnd % 60;

    const formattedStart = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;
    const formattedEnd = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
    const slotId = `slot-${dateString}-${formattedStart.replace(':', '')}`;

    const isAvailable = !isPastOrInsideLead;
    let isEmphasized = false;

    if (isAvailable && !firstAvailableHighlighted) {
      isEmphasized = true;
      firstAvailableHighlighted = true;
    }

    slots.push({
      id: slotId,
      dayLabel,
      dateString,
      startTime: formattedStart,
      endTime: formattedEnd,
      formatted: `${formattedStart} – ${formattedEnd}`,
      isAvailable,
      availableCapacity: isAvailable ? policy.capacityPerSlot || 10 : 0,
      isEmphasized,
    });

    slotStart += slotLength;
  }

  return slots;
}

/**
 * Generates available multi-day slots according to policy.
 */
export function generateAvailableSlots(
  store: Store,
  policy: SchedulingPolicy,
  referenceDate: Date = new Date(),
  fulfillmentType: 'delivery' | 'pickup' = 'delivery'
): {
  asapAvailable: boolean;
  asapEtaMinutes?: number;
  days: Array<{
    dayLabel: string;
    dateString: string;
    slots: DeliverySlot[];
  }>;
  nextAvailableSlot?: DeliverySlot;
} {
  const storeOpenCheck = isStoreCurrentlyOpen(store, referenceDate);
  const asapAvailable = policy.acceptsAsapOrders && storeOpenCheck.isOpen;
  const asapEtaMinutes = asapAvailable ? (fulfillmentType === 'pickup' ? 15 : 30) : undefined;

  const days: Array<{ dayLabel: string; dateString: string; slots: DeliverySlot[] }> = [];
  let nextAvailableSlot: DeliverySlot | undefined = undefined;

  for (let d = 0; d < policy.maximumDaysInAdvance; d++) {
    const targetDate = new Date(referenceDate);
    targetDate.setDate(targetDate.getDate() + d);

    const slots = generateDaySlots(store, targetDate, policy, referenceDate, fulfillmentType);
    if (slots.length > 0) {
      const dayLabel = slots[0]?.dayLabel || 'Upcoming';
      days.push({
        dayLabel,
        dateString: targetDate.toISOString().split('T')[0],
        slots,
      });

      if (!nextAvailableSlot) {
        const found = slots.find((s) => s.isAvailable);
        if (found) nextAvailableSlot = found;
      }
    }
  }

  return {
    asapAvailable,
    asapEtaMinutes,
    days,
    nextAvailableSlot,
  };
}
