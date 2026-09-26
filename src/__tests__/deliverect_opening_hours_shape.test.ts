import { describe, expect, it } from 'vitest';
import {
  computeNextOpeningTime,
  evaluateStoreOpenNow,
  normalizeOpeningHours,
  resolveOpeningHoursForDate,
} from '../services/storeOpeningHoursService';
import type { Store } from '../commerce/models';

describe('Deliverect Commerce opening-hours shape', () => {
  const openingHours = {
    timezone: 'Europe/London',
    dayTimeRanges: [
      { dayOfWeek: 1, startTime: '00:00:00', endTime: '23:59:00' },
      { dayOfWeek: 2, startTime: '00:00:00', endTime: '23:59:00' },
      { dayOfWeek: 3, startTime: '00:00:00', endTime: '23:59:00' },
      { dayOfWeek: 4, startTime: '00:00:00', endTime: '23:59:00' },
      { dayOfWeek: 5, startTime: '00:00:00', endTime: '23:59:00' },
      { dayOfWeek: 6, startTime: '00:00:00', endTime: '23:59:00' },
      { dayOfWeek: 7, startTime: '00:00:00', endTime: '23:59:00' },
    ],
    specialHours: [],
  };

  it('normalizes dayTimeRanges and removes seconds', () => {
    expect(normalizeOpeningHours(openingHours)).toEqual({
      monday: { open: '00:00', close: '23:59' },
      tuesday: { open: '00:00', close: '23:59' },
      wednesday: { open: '00:00', close: '23:59' },
      thursday: { open: '00:00', close: '23:59' },
      friday: { open: '00:00', close: '23:59' },
      saturday: { open: '00:00', close: '23:59' },
      sunday: { open: '00:00', close: '23:59' },
    });
  });

  it('keeps an all-day Deliverect store open before the legacy 08:00 fallback', () => {
    const store = {
      id: 'store-1',
      name: 'Dave',
      status: 'open',
      timezone: openingHours.timezone,
      openingHours,
    } as unknown as Store;

    expect(evaluateStoreOpenNow(store, new Date('2026-09-26T05:30:00.000Z'))).toMatchObject({
      isOpen: true,
      badgeText: 'Open until 23:59',
    });
  });

  it('overlays weekly hours with shortened special hours for the matching date', () => {
    const withSpecialHours = {
      ...openingHours,
      specialHours: [{
        name: 'Christmas Eve',
        start: '2026-12-24',
        end: '2026-12-24',
        days: [{
          date: '2026-12-24',
          holiday: false,
          openingHours: [{ begin: '09:00:00', end: '14:00:00' }],
        }],
      }],
    };
    const store = {
      id: 'store-special', name: 'Dave', status: 'open',
      timezone: 'Europe/London', openingHours: withSpecialHours,
    } as unknown as Store;

    expect(resolveOpeningHoursForDate(store.openingHours, '2026-12-24')).toEqual({
      open: '09:00', close: '14:00',
    });
    expect(evaluateStoreOpenNow(store, new Date('2026-12-24T15:00:00.000Z')).isOpen).toBe(false);
  });

  it('treats a holiday as closed and finds the next weekly opening', () => {
    const withHoliday = {
      ...openingHours,
      specialHours: [{
        name: 'Christmas Day',
        start: '2026-12-25',
        end: '2026-12-25',
        days: [{ date: '2026-12-25', holiday: true, openingHours: [] }],
      }],
    };
    const store = {
      id: 'store-holiday', name: 'Dave', status: 'open',
      timezone: 'Europe/London', openingHours: withHoliday,
    } as unknown as Store;

    expect(resolveOpeningHoursForDate(store.openingHours, '2026-12-25')).toBeNull();
    expect(evaluateStoreOpenNow(store, new Date('2026-12-25T12:00:00.000Z')).isOpen).toBe(false);
    expect(computeNextOpeningTime(store, new Date('2026-12-25T12:00:00.000Z'))?.toISOString())
      .toBe('2026-12-26T00:00:00.000Z');
  });
});
