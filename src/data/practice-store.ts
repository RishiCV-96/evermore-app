import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as Crypto from 'expo-crypto';
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { DEFAULT_REVEAL_CARDS, DEFAULT_SESSION_LENGTH, type RevealSetting, type SessionLength } from '@/config/schedule';
import { checkThisPhone, currentProfile } from '@/data/account';
import { backfillRecords, recordCardAttempt, syncRecords } from '@/data/attempt-sync';
import { hintsOf } from '@/data/family-store';
import { cardsOn, sessionDay } from '@/lib/activity';
import type { Login } from '@/lib/attempt-records';
import type { CardTiming } from '@/lib/attempts';
import { sendable } from '@/lib/facts';
import { signedUrls } from '@/lib/photo-urls';
import { firstTryCorrect, nextSchedule, type CardResult, type ScheduleEntry } from '@/lib/queue';
import {
  askedOn,
  cardsOf,
  goalToday,
  logAsked,
  planMore,
  planPerson,
  planToday,
  type AskedToday,
  type DeckCard,
  type PracticePerson,
  type TodayLog,
} from '@/lib/session';
import type { Card, Round, Seen } from '@/lib/stories';
import { addStudyDays, studyDayStart } from '@/lib/study-day';
import { supabase } from '@/lib/supabase';
import { onNewStudyDay, studyToday } from '@/data/study-clock';
import { warnKind } from '@/lib/log';

// The person's practice, kept on the phone so it works for a while without a connection:
// the approved deck, the schedule, today's sessions, and an outbox of changes for the server.
// The outbox is sent in order whenever the connection is back. Kept simple on purpose. Each
// card's record for the caregiver's insights has its own queue (src/data/attempt-sync.ts).

export type { PracticePerson };

type LocalSession = {
  id: string;
  startedAt: string;
  completedAt: string | null;
  cardsCompleted: number;
  dailyGoal: number;
  /** The study day it began in (src/lib/study-day.ts). Missing on older sessions, which use startedAt. */
  studyDay?: string | null;
  /** It began once the day's session was complete. Kept on this phone only, for the card records. */
  extraPractice?: boolean;
};

type Row = Record<string, string | number | boolean | null>;
type Change =
  | { kind: 'session'; id: string; row: Row }
  | { kind: 'attempt'; id: string; row: Row }
  | { kind: 'schedule'; id: string; row: Row };

export type Practice = {
  people: PracticePerson[];
  cards: DeckCard[];
  /** The day's target, worked out from the deck and the session length. */
  goal: number;
  sessionLength?: SessionLength;
  revealCards?: RevealSetting;
  schedule: Record<string, ScheduleEntry & { updatedAt: string }>;
  /** Sessions from this study day and the one before, from every phone in the family and the server. */
  sessions: LocalSession[];
  outbox: Change[];
  /** The phrasing each person was last asked with, so the next one differs. Kept on the phone only. */
  lastPhrasing?: Record<string, string>;
  /** The names each person's last card offered, in order, so the next differs. Kept on the phone only. */
  lastChoices?: Record<string, string[]>;
  /** What was asked today, so a stop and a resume repeats nothing. Kept on the phone only. */
  today?: TodayLog;
};

const EMPTY: Practice = { people: [], cards: [], goal: 0, schedule: {}, sessions: [], outbox: [] };

/** The day's target follows the deck and the session length. Someone who leaves the deck mid-day can't move it back (goalToday). */
function withGoal(state: Practice): Practice {
  const { goal, log } = goalToday(deckCards(state), state.sessionLength ?? DEFAULT_SESSION_LENGTH, state.today, studyToday());
  return { ...state, goal, today: log };
}

let practice: Practice | null = null;
let userId: string | null = null;
let writing = Promise.resolve();
const listeners = new Set<() => void>();

const storageKey = (id: string) => `evermore.practice.v1.${id}`;

function subscribe(listener: () => void) {
  listeners.add(listener);
  const profile = currentProfile();
  if (userId !== profile.id) {
    userId = profile.id;
    practice = null;
    open(profile.id);
  }
  return () => {
    listeners.delete(listener);
  };
}

export function usePractice() {
  return useSyncExternalStore(subscribe, () => practice, () => null);
}

function update(next: Practice) {
  practice = next;
  listeners.forEach((listener) => listener());
  const id = userId;
  if (!id) return;
  // Chained so an older save can never land after a newer one.
  writing = writing
    .then(() => AsyncStorage.setItem(storageKey(id), JSON.stringify(next)))
    .catch((error) => warnKind('Could not save practice', error));
}

function current() {
  if (!practice) throw new Error('Practice has not loaded yet.');
  return practice;
}

// The copy on the phone first, so the home screen opens at once (and offline), then the server.
async function open(id: string) {
  const saved = await AsyncStorage.getItem(storageKey(id)).catch(() => null);
  if (userId !== id) return;
  practice = saved ? withGoal({ ...EMPTY, ...JSON.parse(saved) }) : null;
  listeners.forEach((listener) => listener());
  await refreshPractice();
}

/** Loads the approved deck, goal, schedule and recent sessions, after sending the outbox. */
export async function refreshPractice() {
  const id = userId;
  if (!id) return;
  // A paired phone the caregiver removed returns to the welcome as soon as it is online.
  void checkThisPhone();
  await sync();
  // Each card's record for the caregiver's insights goes too, in the background.
  const person = recordsLogin();
  if (person) void syncRecords(person, true);

  // This study day and the one before; a day's margin more, for a phone in another time zone.
  const today = studyToday();
  const yesterday = addStudyDays(today, -1);
  const since = studyDayStart(addStudyDays(today, -2));
  // Row Level Security returns only approved cards, and only the people on them.
  const [people, cards, goal, schedule, sessions] = await Promise.all([
    supabase
      .from('people')
      .select('id, name, relationship, photo_path, sample_portrait, hint_letter, hint_fact, hint_relationship, hint_fewer, best_clue, reveal_ok')
      .order('created_at'),
    supabase
      .from('cards')
      .select('id, person_id, sentence, fact_type, memory_text, time_sensitive, as_of, memory_year, phrasings_off, hint_ok, photo_path')
      .order('created_at'),
    supabase.from('daily_goal').select('session_length, reveal_cards').maybeSingle(),
    supabase.from('card_schedule').select('card_id, step, due_at, updated_at').eq('person_user_id', id),
    // The family's sessions, so a day finished on one paired phone shows as finished on the other
    // (Row Level Security lets a person's login read them, never write them). Every column, so this
    // works whether or not the server has study_day yet.
    supabase.from('sessions').select('*').gte('started_at', since.toISOString()),
  ]);
  const error = people.error ?? cards.error ?? goal.error ?? schedule.error ?? sessions.error;
  if (userId !== id) return;
  if (error) {
    // Offline or signed out elsewhere: keep practicing from the copy on the phone.
    if (!practice) update(EMPTY);
    return;
  }

  const urls = await signedUrls([...(people.data ?? []), ...(cards.data ?? [])].map((row) => row.photo_path).filter(Boolean));
  const local = practice ?? EMPTY;

  // The newer of each schedule row wins; rows for removed cards go.
  const cardIds = new Set((cards.data ?? []).map((row) => row.id));
  const mergedSchedule: Practice['schedule'] = {};
  for (const row of schedule.data ?? []) {
    mergedSchedule[row.card_id] = { step: row.step, dueAt: row.due_at, updatedAt: row.updated_at };
  }
  for (const [cardId, entry] of Object.entries(local.schedule)) {
    const server = mergedSchedule[cardId];
    if (!server || new Date(entry.updatedAt) > new Date(server.updatedAt)) mergedSchedule[cardId] = entry;
  }
  for (const cardId of Object.keys(mergedSchedule)) if (!cardIds.has(cardId)) delete mergedSchedule[cardId];

  // Sessions: the server's, plus this phone's, keeping whichever has more done.
  const byId = new Map<string, LocalSession>();
  for (const row of (sessions.data ?? []) as SessionRow[]) {
    byId.set(row.id, {
      id: row.id,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      cardsCompleted: row.cards_completed,
      dailyGoal: row.daily_goal,
      studyDay: row.study_day ?? null,
    });
  }
  for (const session of local.sessions) {
    const server = byId.get(session.id);
    if (!server || session.cardsCompleted >= server.cardsCompleted) byId.set(session.id, session);
  }

  const next: Practice = {
    ...local,
    people: (people.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      relationship: row.relationship || undefined,
      photoPath: row.photo_path ?? undefined,
      // Keep the last URL if signing failed: the photo is cached by its path anyway.
      photoUrl: row.photo_path
        ? (urls[row.photo_path] ?? local.people.find((person) => person.id === row.id)?.photoUrl)
        : undefined,
      samplePortrait: row.sample_portrait ?? undefined,
      hints: hintsOf(row),
      bestClue: row.best_clue ?? undefined,
      revealOk: row.reveal_ok,
    })),
    cards: (cards.data ?? []).map((row) => ({
      id: row.id,
      personId: row.person_id,
      sentence: row.sentence,
      fact: {
        type: row.fact_type,
        text: row.memory_text,
        timeSensitive: row.time_sensitive,
        asOf: row.as_of ?? undefined,
        year: row.memory_year ?? undefined,
      },
      phrasingsOff: row.phrasings_off ?? [],
      hintOk: row.hint_ok,
      photoPath: row.photo_path ?? undefined,
      // Keep the last URL if signing failed, as for the people above.
      photoUrl: row.photo_path
        ? (urls[row.photo_path] ?? local.cards.find((card) => card.id === row.id)?.photoUrl)
        : undefined,
    })),
    sessionLength: goal.data?.session_length ?? DEFAULT_SESSION_LENGTH,
    revealCards: goal.data?.reveal_cards ?? DEFAULT_REVEAL_CARDS,
    schedule: mergedSchedule,
    sessions: [...byId.values()].filter((session) => sessionDay(session) >= yesterday),
  };
  update(withGoal(next));
  // Once per login: this phone's earlier records about people in this family, if any (DESIGN.md).
  if (person) void backfillRecords(person, next.people.map((one) => one.id));
}

/** The person's login and family, for the card records. Null for anyone else. */
function recordsLogin(): Login | null {
  try {
    const profile = currentProfile();
    return profile.role === 'person' && profile.caregiverId ? { personUserId: profile.id, caregiverId: profile.caregiverId } : null;
  } catch {
    return null;
  }
}

/**
 * Each card's record for the caregiver's insights, as the person leaves the card: made exactly as
 * with sign-in off, saved in this phone's queue and sent in the background. The person's login can
 * write records but never read them, and nothing about practice waits for it.
 */
export function recordAttempt(sessionId: string, card: Round, timing: CardTiming) {
  const person = recordsLogin();
  const session = practice?.sessions.find((one) => one.id === sessionId);
  const day = { studyDay: session?.studyDay ?? studyToday(), extraPractice: Boolean(session?.extraPractice) };
  if (person) recordCardAttempt(person, sessionId, card, timing, session?.dailyGoal ?? practice?.goal ?? 0, day);
}

// ---------------------------------------------------------------------------------------
// What practice reads
// ---------------------------------------------------------------------------------------

/** Cards finished on a study day (today's, unless another is named), from every session that began in it, on every phone. */
export function completedToday(state: Pick<Practice, 'sessions'>, day = studyToday()) {
  return cardsOn(state.sessions, day);
}

/** Every approved card as practice shows it, with the ways the caregiver lets it be asked. */
export function deckCards(state: Pick<Practice, 'people' | 'cards'>): Card[] {
  return cardsOf(state.people, state.cards);
}

/** What each person saw last, from the copy on the phone. */
export function lastSeen(state: Practice): Record<string, Seen> {
  const ids = new Set([...Object.keys(state.lastPhrasing ?? {}), ...Object.keys(state.lastChoices ?? {})]);
  return Object.fromEntries([...ids].map((id) => [id, { phrasing: state.lastPhrasing?.[id], choices: state.lastChoices?.[id] }]));
}

/**
 * What a session practices: "today", what's left of the day's target; "more", a mix of the cards
 * that need it most, once the day is done; or one person's cards.
 */
export type SessionKind = 'today' | 'more' | { person: string };

/** What was asked today, from the copy on the phone. */
export const askedToday = (state: Practice, day = studyToday()) => askedOn(state.today, day);

/** The cards for a session, in order, each narrowed to the way it will be asked. Every card finished counts toward today's target the same way. */
export function sessionCards(state: Practice, kind: SessionKind, now = new Date(), random = Math.random) {
  const day = studyToday(now);
  const plan = { deck: deckCards(state), schedule: state.schedule, now, asked: askedToday(state, day), last: lastSeen(state), random };
  if (kind === 'today') return planToday({ ...plan, goal: state.goal, completed: completedToday(state, day) });
  return kind === 'more' ? planMore(plan) : planPerson(kind.person, plan);
}

/**
 * The day's session is complete: its target reached, or nothing new left to ask. The first full
 * round of a study day completes it; what comes after is extra practice, never refused.
 */
export function doneToday(state: Practice, now = new Date()) {
  return completedToday(state, studyToday(now)) >= state.goal || sessionCards(state, 'today', now).length === 0;
}

// ---------------------------------------------------------------------------------------
// What practice writes. Each change is saved on the phone and queued for the server.
// ---------------------------------------------------------------------------------------

/** Queues a change, replacing an older queued change to the same row. */
function enqueue(outbox: Change[], change: Change) {
  if (!sendable(change)) return outbox;
  const index = outbox.findIndex((queued) => queued.kind === change.kind && queued.id === change.id);
  if (index === -1) return [...outbox, change];
  // Same place in the queue, so a session is still sent before its attempts.
  return outbox.map((queued, i) => (i === index ? change : queued));
}

function sessionRow(session: LocalSession, profileId: string, caregiverId: string): Row {
  return {
    id: session.id,
    caregiver_id: caregiverId,
    person_user_id: profileId,
    started_at: session.startedAt,
    completed_at: session.completedAt,
    cards_completed: session.cardsCompleted,
    daily_goal: session.dailyGoal,
    ...(session.studyDay ? { study_day: session.studyDay } : {}),
  };
}

/** A session as the server keeps it. study_day is missing until supabase/schema.sql is rerun, and null on older rows. */
type SessionRow = { id: string; started_at: string; completed_at: string | null; cards_completed: number; daily_goal: number; study_day?: string | null };

function ids() {
  const profile = currentProfile();
  return { profileId: profile.id, caregiverId: profile.caregiverId! };
}

/** A new session id. The session is saved by startSession. */
export function newSessionId() {
  return Crypto.randomUUID();
}

/** Saves a session as started. Safe to call twice with the same id. */
/** Starts a session in today's study day, which it keeps however long it runs. One begun once the day's session is complete is extra practice. */
export function startSession(id: string) {
  const state = current();
  if (state.sessions.some((session) => session.id === id)) return;
  const session: LocalSession = {
    id,
    startedAt: new Date().toISOString(),
    completedAt: null,
    cardsCompleted: 0,
    dailyGoal: state.goal,
    studyDay: studyToday(),
    ...(doneToday(state) ? { extraPractice: true } : {}),
  };
  const { profileId, caregiverId } = ids();
  update({
    ...state,
    sessions: [...state.sessions, session],
    outbox: enqueue(state.outbox, { kind: 'session', id: session.id, row: sessionRow(session, profileId, caregiverId) }),
  });
  sync();
}

/** How a finished card was asked and which names it offered, so that person's next card differs. */
export type Asked = Omit<AskedToday, 'cardId'> & { phrasing: string; choices: string[] };

/** One card finished: log the attempt, move the card's schedule, count it for today. Returns the new step. */
export function recordCard(sessionId: string, cardId: string, result: CardResult, asked?: Asked) {
  const state = current();
  const { profileId, caregiverId } = ids();
  const now = new Date();
  const nowIso = now.toISOString();
  const entry = { ...nextSchedule(state.schedule[cardId], result, now), updatedAt: nowIso };
  // A card that came back after a hint moves its schedule but doesn't count toward the day.
  const sessions = state.sessions.map((candidate) =>
    candidate.id === sessionId && !asked?.extra ? { ...candidate, cardsCompleted: candidate.cardsCompleted + 1 } : candidate,
  );
  const updated = sessions.find((candidate) => candidate.id === sessionId);

  let outbox = state.outbox;
  if (updated) {
    outbox = enqueue(outbox, { kind: 'session', id: sessionId, row: sessionRow(updated, profileId, caregiverId) });
  }
  const attemptId = Crypto.randomUUID();
  outbox = enqueue(outbox, {
    kind: 'attempt',
    id: attemptId,
    row: {
      id: attemptId,
      caregiver_id: caregiverId,
      card_id: cardId,
      person_user_id: profileId,
      session_id: sessionId,
      attempted_at: nowIso,
      tries: result.tries,
      first_try_correct: firstTryCorrect(result),
      hints_used: result.hintsUsed,
    },
  });
  outbox = enqueue(outbox, {
    kind: 'schedule',
    id: cardId,
    row: {
      card_id: cardId,
      person_user_id: profileId,
      caregiver_id: caregiverId,
      step: entry.step,
      due_at: entry.dueAt,
      updated_at: nowIso,
    },
  });

  const lastPhrasing = asked ? { ...state.lastPhrasing, [asked.personId]: asked.phrasing } : state.lastPhrasing;
  const lastChoices = asked ? { ...state.lastChoices, [asked.personId]: asked.choices } : state.lastChoices;
  // Logged in the study day the round began in, so a round running past 05:30 leaves the new day alone.
  const round = state.sessions.find((session) => session.id === sessionId);
  const day = round ? sessionDay(round) : studyToday(now);
  const today = asked ? logAsked(state.today, day, { personId: asked.personId, cardId, key: asked.key, kind: asked.kind, extra: asked.extra }) : state.today;
  // A session planned before someone left the deck can still finish one of their cards.
  update(withGoal({ ...state, sessions, schedule: { ...state.schedule, [cardId]: entry }, outbox, lastPhrasing, lastChoices, today }));
  sync();
  return entry.step;
}

export function finishSession(sessionId: string) {
  const state = current();
  const { profileId, caregiverId } = ids();
  const sessions = state.sessions.map((session) =>
    session.id === sessionId ? { ...session, completedAt: new Date().toISOString() } : session,
  );
  const finished = sessions.find((session) => session.id === sessionId);
  if (!finished) return;
  update({
    ...state,
    sessions,
    outbox: enqueue(state.outbox, { kind: 'session', id: sessionId, row: sessionRow(finished, profileId, caregiverId) }),
  });
  sync();
}

// ---------------------------------------------------------------------------------------
// Signing out on the person's phone
// ---------------------------------------------------------------------------------------

/** Before signing out: send what is waiting, while the session still works. */
export async function flushPractice() {
  if (practice?.outbox.length) await sync();
}

/**
 * Signing out: the copy of the deck (names, sentences, photo links), the schedule and today's log
 * leave this phone. Practice not yet sent stays, alone, and goes when the same login signs in again.
 */
export async function forgetPractice(id: string) {
  const unsent = userId === id && practice ? practice.outbox : await savedOutbox(id);
  if (userId === id) {
    userId = null;
    practice = null;
    listeners.forEach((listener) => listener());
  }
  await writing;
  if (unsent.length) await AsyncStorage.setItem(storageKey(id), JSON.stringify({ ...EMPTY, outbox: unsent })).catch(() => undefined);
  else await AsyncStorage.removeItem(storageKey(id)).catch(() => undefined);
}

async function savedOutbox(id: string): Promise<Change[]> {
  const saved = await AsyncStorage.getItem(storageKey(id)).catch(() => null);
  try {
    return saved ? (JSON.parse(saved).outbox ?? []) : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------------------
// Sending the outbox
// ---------------------------------------------------------------------------------------

let syncing: Promise<void> | null = null;

/** Sends queued changes in order. Stops at the first network problem and tries again later. */
export function sync() {
  syncing ??= send().finally(() => {
    syncing = null;
  });
  return syncing;
}

async function send() {
  while (practice?.outbox.length) {
    const change = practice.outbox[0];
    const table = { session: 'sessions', attempt: 'attempts', schedule: 'card_schedule' }[change.kind];
    let { error } =
      change.kind === 'attempt'
        ? await supabase.from(table).upsert(change.row, { ignoreDuplicates: true })
        : await supabase.from(table).upsert(change.row);
    // A server whose schema hasn't been rerun has no study_day yet: send the session without it
    // rather than lose it. Its day is then worked out from started_at, as for older sessions.
    if (error && change.kind === 'session' && 'study_day' in change.row && noSuchColumn(error.code)) {
      const { study_day: _day, ...older } = change.row;
      ({ error } = await supabase.from(table).upsert(older));
    }
    if (error && retryLater(error.code)) return;
    if (error) warnKind(`Dropped a ${change.kind} the server refused`, error);
    // Remove only the change that was sent: a newer one may have replaced it meanwhile.
    const latest = current();
    update({ ...latest, outbox: latest.outbox.filter((queued) => queued !== change) });
  }
}

/** The server doesn't know a column: its schema hasn't been rerun yet. */
const noSuchColumn = (code: string | undefined) => code === 'PGRST204' || code === '42703';

// No code: the request never reached the server. PGRST3xx: the session needs refreshing.
// Anything else is a refusal (for example the card was removed), which retrying won't fix.
function retryLater(code: string | undefined) {
  return !code || code.startsWith('PGRST3');
}

// Send as soon as the connection comes back, and catch up whenever the app returns to the
// front (a new day may have started).
NetInfo.addEventListener((state) => {
  if (state.isConnected && practice?.outbox.length) sync();
  if (state.isConnected && practice) void checkThisPhone();
});
AppState.addEventListener('change', (state) => {
  if (state === 'active' && practice) refreshPractice();
});

// A new study day began while the app was open (05:30, or on coming back to the front): the day's
// target and log start fresh at once, on the copy on the phone, and then from the server.
onNewStudyDay(() => {
  if (!practice) return;
  update(withGoal(practice));
  void refreshPractice();
});

