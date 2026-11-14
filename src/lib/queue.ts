import { RETURN_DUE_PER_DAY, STEP_INTERVALS, TOP_STEP } from '@/config/schedule';
import { addStudyDays, studyDayKey, studyDayStart } from '@/lib/study-day';

// Spaced retrieval for the person's practice: which cards to show today, and when each comes
// back. Pure functions; the intervals are in src/config/schedule.ts. No machine learning.

export type ScheduleEntry = {
  step: number;
  /** ISO time the card is next due. */
  dueAt: string;
};

export type Schedule = Record<string, ScheduleEntry>;

/** How one card went. A hint appears after each other name, so tries - 1 = hints. */
export type CardResult = { tries: number; hintsUsed: number };

export function firstTryCorrect(result: CardResult) {
  return result.tries === 1 && result.hintsUsed === 0;
}

/**
 * Where a card goes after practice: up a step after a first-try answer with no hint, back
 * a step (never below 0) otherwise. A card practiced before it was due (to make up the
 * daily goal) can still move back, but doesn't jump ahead.
 */
export function nextSchedule(entry: ScheduleEntry | undefined, result: CardResult, now: Date): ScheduleEntry {
  const step = entry?.step ?? 0;
  const early = entry !== undefined && new Date(entry.dueAt) > now;
  if (firstTryCorrect(result)) {
    if (early) return entry;
    const next = Math.min(step + 1, TOP_STEP);
    return { step: next, dueAt: dueAtFor(next, now).toISOString() };
  }
  const next = Math.max(step - 1, 0);
  return { step: next, dueAt: dueAtFor(next, now).toISOString() };
}

// Minute steps count from now. Day steps count in study days (src/lib/study-day.ts), not hours:
// a card due "in 1 day" falls due when the next study day begins, at 05:30, so it is ready whenever
// the person practices in it. A card finished at 02:00 belongs to the study day before, so its next
// day begins at 05:30 that same morning. The start is by the wall clock, right across daylight saving.
function dueAtFor(step: number, now: Date) {
  const interval = STEP_INTERVALS[step];
  if ('days' in interval) return studyDayStart(addStudyDays(studyDayKey(now), interval.days));
  return new Date(now.getTime() + interval.minutes * 60_000);
}

/**
 * Today's cards, up to count: due cards first (longest overdue first), then new cards in
 * the order they were added. If that's fewer than count, the cards due soonest make up the
 * rest, so the person can always reach the daily goal.
 */
export function buildQueue(cardIds: string[], schedule: Schedule, now: Date, count: number) {
  const dueTime = (id: string) => new Date(schedule[id].dueAt).getTime();
  const scheduled = cardIds.filter((id) => schedule[id]).sort((a, b) => dueTime(a) - dueTime(b));
  const due = scheduled.filter((id) => dueTime(id) <= now.getTime());
  const fresh = cardIds.filter((id) => !schedule[id]);
  const later = scheduled.filter((id) => dueTime(id) > now.getTime());
  return [...due, ...fresh, ...later].slice(0, Math.max(count, 0));
}

/**
 * Extra practice ("Practice more"): the cards that need it most first. A lower step means
 * the card needed a hint more recently; a new card counts as just above step 0. Ties go to
 * the one due soonest. Scheduling only: nothing about this order is ever shown.
 */
export function needMostFirst(cardIds: string[], schedule: Schedule, count: number) {
  const step = (id: string) => schedule[id]?.step ?? 0.5;
  const due = (id: string) => (schedule[id] ? new Date(schedule[id].dueAt).getTime() : 0);
  return [...cardIds].sort((a, b) => step(a) - step(b) || due(a) - due(b)).slice(0, Math.max(count, 0));
}

/**
 * One person's cards for a session: the ones that need it most first, then round again until
 * there are at least `least`, never more than `most`. Each comes back asked another way.
 */
export function personQueue(cardIds: string[], schedule: Schedule, least: number, most: number) {
  if (cardIds.length === 0) return [];
  const ordered = needMostFirst(cardIds, schedule, cardIds.length);
  const count = Math.min(Math.max(least, ordered.length), most);
  return Array.from({ length: count }, (_, i) => ordered[i % ordered.length]);
}

/**
 * A person restored from the archive after a day or more: their overdue cards come back a few a
 * day (RETURN_DUE_PER_DAY), longest overdue first, each keeping its step, so the first day back
 * isn't all catch-up. Returns only the entries that move. Archived and restored the same day, as
 * with Undo, nothing moves.
 */
export function spreadOnReturn<E extends ScheduleEntry>(schedule: Record<string, E>, cardIds: string[], archivedAt: string, now: Date): Record<string, E> {
  const today = studyDayKey(now);
  if (studyDayKey(new Date(archivedAt)) >= today) return {};
  const dueTime = (id: string) => new Date(schedule[id].dueAt).getTime();
  const overdue = cardIds.filter((id) => schedule[id] && dueTime(id) <= now.getTime()).sort((a, b) => dueTime(a) - dueTime(b));
  return Object.fromEntries(
    overdue.slice(RETURN_DUE_PER_DAY).map((id, index) => {
      const due = studyDayStart(addStudyDays(today, 1 + Math.floor(index / RETURN_DUE_PER_DAY)));
      return [id, { ...schedule[id], dueAt: due.toISOString() }];
    }),
  );
}
