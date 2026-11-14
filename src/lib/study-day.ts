import { DAY_START_HOUR, DAY_START_MINUTE } from '@/config/schedule';

// The study day: from DAY_START_HOUR:DAY_START_MINUTE (05:30) local time to just before it the next
// morning, named for the date it began on (YYYY-MM-DD). studyDayKey is the only place the boundary is
// worked out: no other code decides what "today" is. It decides which day a card or a session counts
// toward and when a new daily session begins, and never limits practice. Pure, so
// scripts/check-logic.mjs can check it, daylight saving and time zones included.

type Parts = { year: number; month: number; day: number; minutes: number };

/** The wall-clock date and time of an instant: on this device, or in a named time zone. */
function wallClock(date: Date, timeZone?: string): Parts {
  if (!timeZone) return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate(), minutes: date.getHours() * 60 + date.getMinutes() };
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((one) => one.type === type)!.value);
  return { year: part('year'), month: part('month'), day: part('day'), minutes: (part('hour') % 24) * 60 + part('minute') };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** When a study day starts, in words for the caregiver's report: "5:30 AM". */
export const DAY_START_TEXT = `${DAY_START_HOUR % 12 || 12}:${pad(DAY_START_MINUTE)} ${DAY_START_HOUR < 12 ? 'AM' : 'PM'}`;

/** A key some whole days on (or back), by the calendar, so daylight saving can't shift it. */
export function addStudyDays(key: string, days: number) {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/**
 * The study day an instant belongs to, as YYYY-MM-DD: the date the day began on. Before 05:30 on
 * the wall clock it is still the day before. In the device's own time zone unless one is named.
 */
export function studyDayKey(date: Date, timeZone?: string) {
  const { year, month, day, minutes } = wallClock(date, timeZone);
  const key = `${year}-${pad(month)}-${pad(day)}`;
  return minutes < DAY_START_HOUR * 60 + DAY_START_MINUTE ? addStudyDays(key, -1) : key;
}

/** When a study day begins on this device: 05:30 local on its date. */
export function studyDayStart(key: string) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, DAY_START_HOUR, DAY_START_MINUTE);
}

/** When the next study day begins on this device, after `now`. */
export const nextStudyDayStart = (now: Date) => studyDayStart(addStudyDays(studyDayKey(now), 1));

/** The last `count` study days, oldest first, ending with `today`. */
export const lastStudyDays = (today: string, count: number) => Array.from({ length: count }, (_, index) => addStudyDays(today, index - (count - 1)));

/**
 * The day a device should treat as today: the study day of `now`, but never earlier than the last
 * one it has seen. A clock set back, or travel west, can't hand out the same day's session twice.
 */
export const laterDay = (seen: string | undefined, key: string) => (seen && seen > key ? seen : key);

/** Whether a string is a study day key. */
export const isStudyDay = (key: unknown): key is string => typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key);

/**
 * The study day something counts toward: the one saved with it when it was made, or for anything
 * saved before study days were kept, the study day of its time on this device.
 */
export const dayOf = (item: { studyDay?: string | null }, at: string) => (isStudyDay(item.studyDay) ? item.studyDay : studyDayKey(new Date(at)));
