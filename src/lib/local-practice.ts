import type { RevealSetting, SessionLength } from '@/config/schedule';
import { lastDays, sessionDay } from '@/lib/activity';
import { lastStudyDays, studyDayKey } from '@/lib/study-day';
import { nextSchedule, type CardResult, type ScheduleEntry } from '@/lib/queue';
import type { TodayLog } from '@/lib/session';

// Practice kept on the phone when sign-in is off (src/data/local-store.ts). Pure, so
// scripts/check-logic.mjs can check it. Completion only: how a card went moves its schedule
// and is not kept.

export type LocalSession = {
  id: string;
  startedAt: string;
  completedAt: string | null;
  cardsCompleted: number;
  /** The day's target when the session started. */
  dailyGoal: number;
  /** The study day it began in, from this device's clock: every card in it counts toward that day. */
  studyDay?: string;
  /** It began once the day's session was complete: extra practice. */
  extraPractice?: boolean;
};

export type LocalPractice = {
  /** When this phone first opened the app, for the 4-week average. */
  since: string;
  /** The caregiver's choices. Missing means the default. */
  sessionLength?: SessionLength;
  revealCards?: RevealSetting;
  /** Settings' AI questions switch. Missing means on, once the caregiver has agreed. */
  aiOn?: boolean;
  /** When the caregiver agreed to their facts being sent for AI questions. */
  aiConsentAt?: string;
  /** Demo insights are loaded (development only), so insights count made-up attempts. */
  insightsDemo?: boolean;
  schedule: Record<string, ScheduleEntry & { updatedAt: string }>;
  /** Sessions from the last 31 days. */
  sessions: LocalSession[];
  /** Each card finished in the last 8 days, for "People practiced this week". */
  finished: { cardId: string; at: string }[];
  /** The phrasing each person was last asked with, so the next one differs. */
  lastPhrasing?: Record<string, string>;
  /** The names each person's last card offered, in order, so the next differs. */
  lastChoices?: Record<string, string[]>;
  /** What was asked today, so a stop and a resume repeats nothing. */
  today?: TodayLog;
};

export function emptyPractice(now: Date): LocalPractice {
  return { since: now.toISOString(), schedule: {}, sessions: [], finished: [] };
}

/** Cards with new ids keep their place in the schedule and in the week's count. */
export function renameCards(state: LocalPractice, rename: (cardId: string) => string): LocalPractice {
  return {
    ...state,
    schedule: Object.fromEntries(Object.entries(state.schedule).map(([id, entry]) => [rename(id), entry])),
    finished: state.finished.map((card) => ({ ...card, cardId: rename(card.cardId) })),
  };
}

/**
 * Forgets someone deleted for good: their cards' schedule and week, today's questions about them,
 * how they were last asked, and other people's last names offered if those showed their name.
 * Sessions are day totals with no names in them, so past days stay as they were.
 */
export function forgetPerson(state: LocalPractice, person: { id: string; name: string }, cardIds: string[], namesLeft: string[]): LocalPractice {
  const gone = new Set(cardIds);
  const nameGone = !namesLeft.includes(person.name);
  const notTheirs = <T>(record: Record<string, T> | undefined, keep: (value: T) => boolean = () => true) =>
    record && Object.fromEntries(Object.entries(record).filter(([id, value]) => id !== person.id && keep(value)));
  return {
    ...state,
    schedule: Object.fromEntries(Object.entries(state.schedule).filter(([id]) => !gone.has(id))),
    finished: state.finished.filter((card) => !gone.has(card.cardId)),
    today: state.today && { ...state.today, asked: state.today.asked.filter((one) => one.personId !== person.id) },
    lastPhrasing: notTheirs(state.lastPhrasing),
    lastChoices: notTheirs(state.lastChoices, (names) => !(nameGone && names.includes(person.name))),
  };
}

/**
 * Saves a session as started, with the day's target and the study day it begins in, which it keeps
 * however long it runs. Starting the same id twice changes nothing.
 */
export function startSession(state: LocalPractice, id: string, now: Date, goal: number, day: { studyDay: string; extraPractice: boolean } = { studyDay: studyDayKey(now), extraPractice: false }): LocalPractice {
  if (state.sessions.some((session) => session.id === id)) return state;
  const session: LocalSession = { id, startedAt: now.toISOString(), completedAt: null, cardsCompleted: 0, dailyGoal: goal, studyDay: day.studyDay, ...(day.extraPractice ? { extraPractice: true } : {}) };
  return { ...state, sessions: [...state.sessions, session] };
}

/**
 * One card finished: count it for its session, note it for the week, and move its schedule. A card
 * that came back after a hint moves its schedule but doesn't count, so a day's total never depends
 * on how answers went.
 */
export function finishCard(state: LocalPractice, sessionId: string, cardId: string, result: CardResult, now: Date, extra = false) {
  const at = now.toISOString();
  const entry = { ...nextSchedule(state.schedule[cardId], result, now), updatedAt: at };
  const next: LocalPractice = {
    ...state,
    schedule: { ...state.schedule, [cardId]: entry },
    sessions: state.sessions.map((session) =>
      session.id === sessionId && !extra ? { ...session, cardsCompleted: session.cardsCompleted + 1 } : session,
    ),
    finished: [...state.finished, { cardId, at }],
  };
  return { state: next, step: entry.step };
}

export function endSession(state: LocalPractice, sessionId: string, now: Date): LocalPractice {
  return {
    ...state,
    sessions: state.sessions.map((session) => (session.id === sessionId ? { ...session, completedAt: now.toISOString() } : session)),
  };
}

/** Drops what nothing shows any more: sessions before the last 31 study days, finished cards before the last 8, an earlier day's log. */
export function pruned(state: LocalPractice, now: Date, today = studyDayKey(now)): LocalPractice {
  const month = new Set(lastStudyDays(today, 31));
  const weekStart = lastDays(now, 8)[0].getTime();
  return {
    ...state,
    sessions: state.sessions.filter((session) => month.has(sessionDay(session)) || sessionDay(session) > today),
    finished: state.finished.filter((card) => new Date(card.at).getTime() >= weekStart),
    today: state.today?.day === today ? state.today : undefined,
  };
}

/** What the dashboard reads: sessions from the last 30 study days, and the cards finished in the last 7. */
export function localActivity(state: LocalPractice, now: Date) {
  const month = new Set(lastStudyDays(studyDayKey(now), 30));
  const weekStart = lastDays(now, 7)[0].getTime();
  return {
    sessions: state.sessions.filter((session) => month.has(sessionDay(session))),
    weekCardIds: state.finished.filter((card) => new Date(card.at).getTime() >= weekStart).map((card) => card.cardId),
  };
}
