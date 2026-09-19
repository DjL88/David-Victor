/**
 * Store Opening Hours & Address Validation Service
 *
 * Implements per-day, per-location opening hours logic as originated by Deliverect API,
 * as well as address presence validation to ensure stores without valid addresses
 * are never surfaced on the customer storefront.
 */

import { Store, Address } from '../commerce/models';

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
export function normalizeOpeningHours(
  rawHours?: Record<string, { open: string; close: string }> | string | any
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

  if (typeof rawHours === 'object') {
    // Deliverect per-day map, e.g. { monday: { open: "08:00", close: "22:00" } }
    for (const d of DAY_NAMES) {
      const match = rawHours[d] || rawHours[d.substring(0, 3)] || rawHours[d.toUpperCase()];
      if (match && typeof match.open === 'string' && typeof match.close === 'string') {
        result[d] = { open: match.open.trim(), close: match.close.trim() };
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

  const dayOfWeek = DAY_NAMES[targetDate.getDay()];
  const normalizedMap = normalizeOpeningHours(store.openingHours);
  const todayHours = normalizedMap[dayOfWeek];

  if (!todayHours) {
    return {
      isOpen: false,
      todayHoursText: 'Closed today',
      badgeText: 'Closed',
    };
  }

  const currentHoursMinutes =
    targetDate.getHours().toString().padStart(2, '0') +
    ':' +
    targetDate.getMinutes().toString().padStart(2, '0');

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
