import { dayOf, lastStudyDays, studyDayKey, studyDayStart } from '@/lib/study-day';

// Completion figures for the caregiver dashboard. Completion only: how many cards were
// finished against the daily goal. Nothing here reads or reports how answers went. Days are
// study days (src/lib/study-day.ts): from 05:30 to 05:29 the next morning.

export type SessionRecord = {
  startedAt: string;
  completedAt: string | null;
  cardsCompleted: number;
  /** The daily goal when the session started. */
  dailyGoal: number;
  /** The study day it began in, saved when it started. Missing on older sessions, which use startedAt. */
  studyDay?: string | null;
};

/** The study day a session counts toward: the one it began in. */
export const sessionDay = (session: Pick<SessionRecord, 'studyDay' | 'startedAt'>) => dayOf(session, session.startedAt);

/** Cards finished in sessions that began on this study day, from every phone. */
export function cardsOn(sessions: Pick<SessionRecord, 'studyDay' | 'startedAt' | 'cardsCompleted'>[], day: string) {
  return sessions.filter((session) => sessionDay(session) === day).reduce((sum, session) => sum + session.cardsCompleted, 0);
}

export type DayCompletion = {
  /** The study day, YYYY-MM-DD. */
  key: string;
  /** When it began: 05:30 on that date. */
  date: Date;
  completed: number;
  goal: number;
  /** completed / goal, 0 to 100. */
  percent: number;
};

/**
 * A date as written on a calendar, YYYY-MM-DD: for calendar cells, labels and storage. Never for
 * deciding which day something counts toward, or what today is: that is studyDayKey.
 */
export function calendarKey(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The last `count` study days, oldest first, ending with today's: when each began (05:30 local). */
export function lastDays(now: Date, count: number) {
  return lastStudyDays(studyDayKey(now), count).map(studyDayStart);
}

/**
 * Completion for each of the last `count` days. A day's goal is the one in effect when its
 * sessions started, so changing the goal doesn't rewrite the past; a day with no sessions
 * uses today's goal.
 */
export function dailyCompletion(sessions: SessionRecord[], currentGoal: number, now: Date, count: number): DayCompletion[] {
  const byDay = new Map<string, { completed: number; goal: number }>();
  for (const session of sessions) {
    const key = sessionDay(session);
    const day = byDay.get(key) ?? { completed: 0, goal: 0 };
    day.completed += session.cardsCompleted;
    day.goal = Math.max(day.goal, session.dailyGoal);
    byDay.set(key, day);
  }
  const todayKey = studyDayKey(now);
  return lastDays(now, count).map((date) => {
    const key = calendarKey(date);
    const day = byDay.get(key);
    const goal = key === todayKey || !day?.goal ? currentGoal : day.goal;
    const completed = day?.completed ?? 0;
    return { key, date, completed, goal, percent: goal > 0 ? Math.min(100, Math.round((completed / goal) * 100)) : 0 };
  });
}

export type Level = 'none' | 'partial' | 'met';

export function levelFor(day: DayCompletion): Level {
  if (day.completed === 0) return 'none';
  return day.completed >= day.goal ? 'met' : 'partial';
}

/**
 * Average daily completion over the last 4 weeks. Days before the family's account existed
 * aren't counted, so a new account isn't averaged against weeks it couldn't practice.
 */
export function fourWeekAverage(days: DayCompletion[], since: Date) {
  const start = studyDayStart(studyDayKey(new Date(since)));
  const counted = days.slice(-28).filter((day) => day.date >= start);
  if (counted.length === 0) return 0;
  return Math.round(counted.reduce((sum, day) => sum + day.percent, 0) / counted.length);
}

/** Finished sessions in the last 7 days, and their average length in minutes. */
export function weekSessions(sessions: SessionRecord[], now: Date) {
  const week = new Set(lastStudyDays(studyDayKey(now), 7));
  const finished = sessions.filter((session) => session.completedAt && week.has(sessionDay(session)));
  const minutes = finished.map(
    (session) => (new Date(session.completedAt!).getTime() - new Date(session.startedAt).getTime()) / 60_000,
  );
  const average = minutes.length ? minutes.reduce((sum, value) => sum + value, 0) / minutes.length : 0;
  return { count: finished.length, averageMinutes: average };
}

/** How many times each person's cards were practiced, most first. */
export function practiceCounts(personIds: string[]) {
  const counts = new Map<string, number>();
  for (const id of personIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}
