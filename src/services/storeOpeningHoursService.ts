/**
 * Store Opening Hours & Address Validation Service
 *
 * Implements per-day, per-location opening hours logic as originated by Deliverect API,
 * as well as address presence validation to ensure stores without valid addresses
 * are never surfaced on the customer storefront.
 */

import { Store, Address } from '../commerce/models';
import {
  addDaysToDateString,
  getZonedDateParts,
  resolveStoreTimeZone,
  weekdayIndexForDateString,
  zonedLocalDateTimeToUtc,
} from '../utils/zonedTime';

export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export interface DailyHours {
  open: string;  // e.g. "07:00" or "08:30" (HH:MM 24h)
  close: string; // e.g. "23:00" or "22:00" (HH:MM 24h)
}

interface DeliverectDayTimeRange {
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
}

interface DeliverectSpecialHoursDay {
  date?: string;
  holiday?: boolean;
  openingHours?: Array<{ begin?: string; end?: string }>;
}

interface DeliverectOpeningHours {
  timezone?: string;
  dayTimeRanges?: DeliverectDayTimeRange[];
  specialHours?: Array<{
    name?: string;
    start?: string;
    end?: string;
    days?: DeliverectSpecialHoursDay[];
  }>;
}

const DAY_NAMES: DayOfWeek[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

/**
 * Validates whether a store has a legitimate physical address.
 * Per specification: "If a location has no address we should not surface it on the storefront."
 */
export function hasValidStoreAddress(store: { address?: Address | null } | null | undefined): boolean {
  if (!store || !store.address) return false;
  const { line1, formattedAddress, postalCode, city } = store.address;
  const hasLine1 = typeof line1 === 'string' && line1.trim().length > 0;
  const hasFormatted = typeof formattedAddress === 'string' && formattedAddress.trim().length > 0;
  const hasPostal = typeof postalCode === 'string' && postalCode.trim().length > 0;
  const hasCity = typeof city === 'string' && city.trim().length > 0;

  return hasLine1 || hasFormatted || (hasPostal && hasCity);
}

/**
 * Normalizes any incoming openingHours representation (Deliverect per-day map,
 * string summary, or schedule object) into a standardized per-day map.
 */
// ISO 8601 weekday numbering used by Deliverect's openingHours array (1=Monday..7=Sunday) —
// confirmed against src/features/stores/StorePickerModal.tsx's own day-label lookup, which is
// a different convention from this file's DAY_NAMES (indexed 0=Sunday to match Date.getDay()).
const ISO_DAY_OF_WEEK: Record<number, DayOfWeek> = {
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
  7: 'sunday',
};

function normalizeClockTime(value: unknown): string | null {
  const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function applyDeliverectRanges(
  result: Record<DayOfWeek, DailyHours | null>,
  ranges: DeliverectDayTimeRange[]
): boolean {
  let matchedAny = false;
  for (const entry of ranges) {
    const dayName = ISO_DAY_OF_WEEK[Number(entry?.dayOfWeek)];
    const open = normalizeClockTime(entry?.startTime);
    const close = normalizeClockTime(entry?.endTime);
    if (!dayName || !open || !close) continue;

    const existing = result[dayName];
    result[dayName] = existing
      ? {
          open: open < existing.open ? open : existing.open,
          close: close > existing.close ? close : existing.close,
        }
      : { open, close };
    matchedAny = true;
  }
  return matchedAny;
}

export function normalizeOpeningHours(
  rawHours?:
    | Record<string, { open: string; close: string }>
    | Array<{ dayOfWeek: number; startTime: string; endTime: string }>
    | string
    | any
): Record<DayOfWeek, DailyHours | null> {
  const result: Record<DayOfWeek, DailyHours | null> = {
    monday: null,
    tuesday: null,
    wednesday: null,
    thursday: null,
    friday: null,
    saturday: null,
    sunday: null,
  };

  if (!rawHours) {
    // Default fallback hours for demo stores if unspecified: 07:00 - 23:00
    for (const d of DAY_NAMES) {
      result[d] = { open: '07:00', close: '23:00' };
    }
    return result;
  }

  if (Array.isArray(rawHours)) {
    // Deliverect's real per-location shape: [{ dayOfWeek: 1-7 (ISO, Mon-Sun), startTime, endTime }]
    if (applyDeliverectRanges(result, rawHours)) return result;
  }

  if (typeof rawHours === 'object') {
    // Current Commerce Get Store response:
    // { timezone, dayTimeRanges: [{ dayOfWeek, startTime, endTime }], specialHours }
    const deliverectHours = rawHours as DeliverectOpeningHours;
    if (
      Array.isArray(deliverectHours.dayTimeRanges) &&
      applyDeliverectRanges(result, deliverectHours.dayTimeRanges)
    ) {
      return result;
    }

    // Deliverect per-day map, e.g. { monday: { open: "08:00", close: "22:00" } }
    for (const d of DAY_NAMES) {
      const match = rawHours[d] || rawHours[d.substring(0, 3)] || rawHours[d.toUpperCase()];
      if (match && typeof match.open === 'string' && typeof match.close === 'string') {
        const open = normalizeClockTime(match.open);
        const close = normalizeClockTime(match.close);
        if (open && close) result[d] = { open, close };
      }
    }

    // If day slots were parsed, return
    if (Object.values(result).some(Boolean)) {
      return result;
    }
  }

  if (typeof rawHours === 'string') {
    // String like "Mon - Sun: 07:00 - 23:00" or "Everyday 08:00 - 22:00"
    const timeMatch = rawHours.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);
    if (timeMatch) {
      const open = timeMatch[1].padStart(5, '0');
      const close = timeMatch[2].padStart(5, '0');
      for (const d of DAY_NAMES) {
        result[d] = { open, close };
      }
      return result;
    }
  }

  // Fallback if unparseable
  for (const d of DAY_NAMES) {
    result[d] = { open: '08:00', close: '22:00' };
  }
  return result;
}

/**
 * Resolves the effective hours for one store-local calendar date. Deliverect's
 * specialHours are exceptions, so an entry for the date replaces the weekly
 * schedule instead of being combined with it.
 */
export function resolveOpeningHoursForDate(
  rawHours: Store['openingHours'] | undefined,
  dateString: string
): DailyHours | null {
  const deliverectHours = rawHours && typeof rawHours === 'object' && !Array.isArray(rawHours)
    ? rawHours as DeliverectOpeningHours
    : undefined;

  for (const period of deliverectHours?.specialHours || []) {
    const specialDay = Array.isArray(period?.days)
      ? period.days.find((day) => day?.date === dateString)
      : undefined;
    if (!specialDay) continue;

    if (specialDay.holiday === true) return null;

    let effective: DailyHours | null = null;
    for (const range of specialDay.openingHours || []) {
      const open = normalizeClockTime(range?.begin);
      const close = normalizeClockTime(range?.end);
      if (!open || !close) continue;
      effective = effective
        ? {
            open: open < effective.open ? open : effective.open,
            close: close > effective.close ? close : effective.close,
          }
        : { open, close };
    }

    // A declared exception without usable intervals is closed for that date.
    return effective;
  }

  const dayOfWeek = DAY_NAMES[weekdayIndexForDateString(dateString)];
  return normalizeOpeningHours(rawHours)[dayOfWeek];
}

export interface StoreOpenEvaluation {
  isOpen: boolean;
  todayHoursText: string;
  badgeText: string;
  nextChangeText?: string;
}

/**
 * Evaluates whether a store is currently open based on current day and time.
 * Evaluates Deliverect opening hours per day, per location.
 */
export function evaluateStoreOpenNow(
  store: Store | null | undefined,
  targetDate: Date = new Date()
): StoreOpenEvaluation {
  if (!store) {
    return {
      isOpen: false,
      todayHoursText: 'Closed',
      badgeText: 'Closed',
    };
  }

  // If store status is explicitly 'closed', check if status overrides
  const statusUpper = String(store.status || '').toUpperCase();
  if (statusUpper === 'CLOSED') {
    return {
      isOpen: false,
      todayHoursText: 'Closed today',
      badgeText: 'Closed',
    };
  }

  const timeZone = resolveStoreTimeZone(store);
  const zonedNow = getZonedDateParts(targetDate, timeZone);
  const todayHours = resolveOpeningHoursForDate(store.openingHours, zonedNow.dateString);

  if (!todayHours) {
    return {
      isOpen: false,
      todayHoursText: 'Closed today',
      badgeText: 'Closed',
    };
  }

  const currentHoursMinutes = zonedNow.timeString;

  const { open, close } = todayHours;

  // Check if current time is within open and close bounds
  let isOpenNow = false;
  if (open <= close) {
    // Standard daytime shift (e.g. 07:00 - 23:00)
    isOpenNow = currentHoursMinutes >= open && currentHoursMinutes < close;
  } else {
    // Overnight shift (e.g. 18:00 - 02:00)
    isOpenNow = currentHoursMinutes >= open || currentHoursMinutes < close;
  }

  if (isOpenNow) {
    return {
      isOpen: true,
      todayHoursText: `Open today ${open} – ${close}`,
      badgeText: `Open until ${close}`,
      nextChangeText: `Closes at ${close}`,
    };
  } else {
    // Determine if it opens later today or tomorrow
    const opensLaterToday = currentHoursMinutes < open;
    const badgeText = opensLaterToday ? `Opens at ${open}` : 'Closed now';
    return {
      isOpen: false,
      todayHoursText: `Today: ${open} – ${close}`,
      badgeText,
      nextChangeText: opensLaterToday ? `Opens today at ${open}` : `Opens tomorrow`,
    };
  }
}

/**
 * Computes the next real datetime the store opens, based on its actual Deliverect
 * opening hours (never a fabricated/guessed time). Looks up to 7 days ahead; returns
 * null if the store has no parseable hours in that window rather than inventing one.
 * Used to let a customer's basket target a genuine future opening instead of "now"
 * when the store is currently closed.
 */
export function computeNextOpeningTime(
  store: Store | null | undefined,
  fromDate: Date = new Date()
): Date | null {
  if (!store) return null;

  const timeZone = resolveStoreTimeZone(store);
  const current = getZonedDateParts(fromDate, timeZone);

  for (let offset = 0; offset <= 7; offset++) {
    const candidateDateString = addDaysToDateString(current.dateString, offset);
    const hours = resolveOpeningHoursForDate(store.openingHours, candidateDateString);
    if (!hours) continue;

    // On the current store-local day, only a still-upcoming opening counts.
    if (offset === 0 && current.timeString >= hours.open) continue;

    const opening = zonedLocalDateTimeToUtc(
      candidateDateString,
      hours.open,
      timeZone
    );
    if (opening && opening.getTime() > fromDate.getTime()) {
      return opening;
    }
  }

  return null;
}
