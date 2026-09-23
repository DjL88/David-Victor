export interface ZonedDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekdayIndex: number;
  dateString: string;
  timeString: string;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function normaliseTimeZone(timeZone?: string | null): string {
  const candidate = String(timeZone || '').trim();
  if (!candidate) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: candidate }).format(new Date(0));
    return candidate;
  } catch {
    return 'UTC';
  }
}

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const safeZone = normaliseTimeZone(timeZone);
  const cached = formatterCache.get(safeZone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: safeZone,
    calendar: 'gregory',
    numberingSystem: 'latn',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  formatterCache.set(safeZone, formatter);
  return formatter;
}

export function getZonedDateParts(
  date: Date,
  timeZone: string
): ZonedDateParts {
  const parts = formatterFor(timeZone).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((part) => part.type === type)?.value;
    return Number(value || 0);
  };

  const year = read('year');
  const month = read('month');
  const day = read('day');
  const hour = read('hour');
  const minute = read('minute');
  const second = read('second');
  const weekdayIndex = new Date(Date.UTC(year, month - 1, day)).getUTCDay();

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    weekdayIndex,
    dateString:
      String(year).padStart(4, '0') + '-' +
      String(month).padStart(2, '0') + '-' +
      String(day).padStart(2, '0'),
    timeString:
      String(hour).padStart(2, '0') + ':' +
      String(minute).padStart(2, '0'),
  };
}

export function addDaysToDateString(dateString: string, days: number): string {
  const match = String(dateString || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error('Invalid date string: ' + dateString);
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function weekdayIndexForDateString(dateString: string): number {
  const match = String(dateString || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error('Invalid date string: ' + dateString);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).getUTCDay();
}

/**
 * Converts a store-local wall-clock date/time into a real UTC instant.
 *
 * Constructing a Date from a timezone-less string uses the server process
 * timezone, which is UTC in Cloud Run and therefore shifts British Summer
 * Time orders by an hour. This formatter-based conversion honours the
 * supplied IANA timezone without adding a heavyweight date library.
 */
export function zonedLocalDateTimeToUtc(
  dateString: string,
  timeString: string,
  timeZone: string
): Date | null {
  const dateMatch = String(dateString || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = String(timeString || '').match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!dateMatch || !timeMatch) return null;

  const desired = {
    year: Number(dateMatch[1]),
    month: Number(dateMatch[2]),
    day: Number(dateMatch[3]),
    hour: Number(timeMatch[1]),
    minute: Number(timeMatch[2]),
    second: Number(timeMatch[3] || 0),
  };

  if (
    desired.month < 1 || desired.month > 12 ||
    desired.day < 1 || desired.day > 31 ||
    desired.hour < 0 || desired.hour > 23 ||
    desired.minute < 0 || desired.minute > 59 ||
    desired.second < 0 || desired.second > 59
  ) {
    return null;
  }

  const desiredWallEpoch = Date.UTC(
    desired.year,
    desired.month - 1,
    desired.day,
    desired.hour,
    desired.minute,
    desired.second
  );

  let candidateEpoch = desiredWallEpoch;
  const safeZone = normaliseTimeZone(timeZone);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const observed = getZonedDateParts(new Date(candidateEpoch), safeZone);
    const observedWallEpoch = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute,
      observed.second
    );
    const adjustment = desiredWallEpoch - observedWallEpoch;
    candidateEpoch += adjustment;
    if (adjustment === 0) break;
  }

  const result = new Date(candidateEpoch);
  const verified = getZonedDateParts(result, safeZone);
  if (
    verified.year !== desired.year ||
    verified.month !== desired.month ||
    verified.day !== desired.day ||
    verified.hour !== desired.hour ||
    verified.minute !== desired.minute ||
    verified.second !== desired.second
  ) {
    return null;
  }

  return result;
}

export function resolveStoreTimeZone(store: {
  timezone?: string | null;
  address?: { country?: string | null } | null;
} | null | undefined): string {
  const explicit = String(store?.timezone || '').trim();
  if (explicit) return normaliseTimeZone(explicit);

  const country = String(store?.address?.country || '').trim().toUpperCase();
  const countryFallbacks: Record<string, string> = {
    GB: 'Europe/London',
    UK: 'Europe/London',
    IE: 'Europe/Dublin',
    NL: 'Europe/Amsterdam',
    BE: 'Europe/Brussels',
    FR: 'Europe/Paris',
    DE: 'Europe/Berlin',
    ES: 'Europe/Madrid',
    IT: 'Europe/Rome',
    PT: 'Europe/Lisbon',
  };

  return countryFallbacks[country] || 'UTC';
}
