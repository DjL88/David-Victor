import { MarketingSchedule } from '../src/commerce/models';

export function isMarketingContentVisible(content: { startsAt?: string; endsAt?: string; schedule?: MarketingSchedule }, now = new Date()): boolean {
  const schedule = content.schedule || { startsAt: content.startsAt, endsAt: content.endsAt };
  if (schedule.startsAt && now < new Date(schedule.startsAt)) return false;
  if (schedule.endsAt && now > new Date(schedule.endsAt)) return false;
  if (!schedule.weekdays?.length && !schedule.dailyStartTime && !schedule.dailyEndTime) return true;
  const timezone = schedule.timezone || 'Europe/London';
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
    const weekdayName = parts.find((part) => part.type === 'weekday')?.value || '';
    const weekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(weekdayName) + 1;
    const time = `${parts.find((part) => part.type === 'hour')?.value || '00'}:${parts.find((part) => part.type === 'minute')?.value || '00'}`;
    if (schedule.weekdays?.length && !schedule.weekdays.includes(weekday)) return false;
    if (schedule.dailyStartTime && time < schedule.dailyStartTime) return false;
    if (schedule.dailyEndTime && time > schedule.dailyEndTime) return false;
    return true;
  } catch { return false; }
}
