import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import { ATTEMPTS_KEPT_DAYS } from '@/config/insights';
import { currentProfile } from '@/data/account';
import type { Activity } from '@/data/activity-store';
import { queuedRecords } from '@/data/attempt-sync';
import type { Family, SavedCard, SavedPerson } from '@/data/family-store';
import { lastDays } from '@/lib/activity';
import { studyToday } from '@/data/study-clock';
import { problemOf, type LoadProblem } from '@/lib/load-problem';
import { fromRow, mergeRecords, type ServerRow } from '@/lib/attempt-records';
import { keptAttempts, monthOf, type CardAttempt } from '@/lib/attempts';
import { memoLast, type InsightsData } from '@/lib/insights';
import { supabase } from '@/lib/supabase';

// The caregiver's device, signed in as the caregiver, with sign-in on: the family's card records for
// Insights. They come from the server's attempt_records table, which the caregiver's login can read
// but never write, for the last ATTEMPTS_KEPT_DAYS, a page at a time; any records still queued on
// this same phone for the person's login join them. They go through the same src/lib/insights.ts as
// with sign-in off, so every figure works the same way. A copy is kept on this phone, so Insights
// open at once and offline, with when they were last updated, along with what the Trends views need
// to show them (TrendsCopy); it goes when the caregiver signs out or deletes the account here. The
// person's phone writes the records (src/data/attempt-sync.ts).

/** Records a request: Supabase's own most rows per request. Keep at or below the project's row limit per request (its API settings). */
const PAGE = 1000;
/** Records the server took this long before the newest one fetched are fetched again, in case one landed late. */
const OVERLAP_MS = 5 * 60_000;

const cacheKey = (caregiverId: string) => `evermore.insightsCache.v1.${caregiverId}`;
const monthKey = (caregiverId: string, month: string) => `${cacheKey(caregiverId)}.${month}`;

/** When Insights were last fetched from the server, and a way to fetch them again. */
export type InsightsSync = {
  /** When the server's records were last fetched on this phone; null before the first time. */
  updatedAt: string | null;
  /** Fetching now. */
  loading: boolean;
  /** Why the last fetch couldn't finish, if it couldn't. */
  problem?: LoadProblem;
  /** Fetches what the server took since the last time, as Insights open. */
  update: () => Promise<void>;
  /** Fetches every record in the window again: pull to refresh. */
  refresh: () => Promise<void>;
};

/** The family as the Trends views read it: who each person is, what is approved, and the settings. No facts' words. */
export type TrendsFamily = Pick<Family, 'goal' | 'revealCards' | 'sessionLength'> & {
  people: Pick<SavedPerson, 'id' | 'name' | 'archivedAt' | 'includeInPractice'>[];
  cards: Pick<SavedCard, 'id' | 'personId' | 'status'>[];
};

/** Trends as last seen on this phone, for when the family or practice can't load (offline, after a restart). */
export type TrendsCopy = { family: TrendsFamily; activity: Activity };

type State = {
  caregiverId: string;
  /** The server's records, from this phone's copy and each fetch. */
  records: CardAttempt[];
  /** Records still queued on this phone, not yet on the server. */
  queued: CardAttempt[];
  updatedAt: string | null;
  /** The newest upload fetched, so the next fetch asks only for what is newer. */
  seen: string | null;
  loading: boolean;
  /** Why the last fetch couldn't finish, if it couldn't. */
  problem?: LoadProblem;
  /** This phone's copy has been read. */
  loaded: boolean;
  trends: TrendsCopy | null;
};

let state: State | null = null;
let fetching: { promise: Promise<void>; all: boolean } | null = null;
let writing = Promise.resolve();
const listeners = new Set<() => void>();

function set(next: State) {
  state = next;
  listeners.forEach((listener) => listener());
}

/** Starts with the signed-in caregiver's copy, then fetches what is new. */
export function subscribeInsights(listener: () => void) {
  listeners.add(listener);
  const caregiverId = currentProfile().id;
  if (state?.caregiverId !== caregiverId) {
    state = { caregiverId, records: [], queued: [], updatedAt: null, seen: null, loading: true, loaded: false, trends: null };
    void open(caregiverId);
  }
  return () => {
    listeners.delete(listener);
  };
}

export const insightsState = () => state;

async function open(caregiverId: string) {
  const [cached, queued] = await Promise.all([readCopy(caregiverId), queuedRecords(caregiverId)]);
  if (state?.caregiverId !== caregiverId) return;
  set({ ...state, ...cached, queued, loaded: true });
  await updateInsights();
}

/** Fetches what the server took since the last fetch: as Insights open, and as the dashboard comes back. */
export const updateInsights = () => fetchRecords(false);

/** Fetches every record in the window again, replacing this phone's copy: pull to refresh. */
export const refreshInsights = () => fetchRecords(true);

function fetchRecords(all: boolean): Promise<void> {
  if (fetching && (fetching.all || !all)) return fetching.promise;
  // A full fetch asked for during a smaller one runs once that one ends.
  const before = fetching?.promise ?? Promise.resolve();
  const promise = before.then(() => fetchNow(all)).finally(() => {
    if (fetching?.promise === promise) fetching = null;
  });
  fetching = { promise, all };
  return promise;
}

async function fetchNow(all: boolean) {
  const current = state;
  if (!current?.loaded) return;
  const { caregiverId } = current;
  set({ ...current, loading: true });
  const since = all || !current.seen ? null : new Date(new Date(current.seen).getTime() - OVERLAP_MS).toISOString();
  try {
    const rows = await fetchRows(caregiverId, lastDays(new Date(), ATTEMPTS_KEPT_DAYS)[0], since);
    const queued = await queuedRecords(caregiverId);
    const latest = state;
    if (latest?.caregiverId !== caregiverId) return;
    const fetched = rows.flatMap(readRow);
    const records = keptAttempts(all ? mergeRecords(fetched) : mergeRecords(latest.records, fetched), new Date());
    const newest = rows.reduce<string | null>((most, row) => {
      const at = new Date(row.uploaded_at).toISOString();
      return !most || at > most ? at : most;
    }, all ? null : latest.seen);
    const updatedAt = new Date().toISOString();
    set({ ...latest, records, queued, seen: newest, updatedAt, loading: false, problem: undefined });
    await saveCopy(caregiverId, records, all ? null : new Set(fetched.map(monthOf)));
  } catch (error) {
    // Offline, signed out, a server not yet updated, or the server away: the copy on this phone stays,
    // with when it was last updated, and the reason, so Insights say the right thing.
    if (state?.caregiverId === caregiverId) set({ ...state, loading: false, problem: problemOf(error) });
  }
}

/** The family's records in the window, oldest upload first, a page at a time; only those newer than `since`, if given. */
async function fetchRows(caregiverId: string, from: Date, since: string | null) {
  const rows: ServerRow[] = [];
  for (let offset = 0; ; offset += PAGE) {
    // Every column, so a server whose schema is behind the app (no study_day yet) still answers.
    let query = supabase.from('attempt_records').select('*').eq('caregiver_id', caregiverId).gte('shown_at', from.toISOString());
    if (since) query = query.gt('uploaded_at', since);
    const { data, error } = await query.order('uploaded_at').order('id').range(offset, offset + PAGE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as ServerRow[]));
    if ((data?.length ?? 0) < PAGE) return rows;
  }
}

/** A row as the record the phone made. One that can't be read is left out of the view, not the server. */
function readRow(row: ServerRow): CardAttempt[] {
  try {
    return [fromRow(row)];
  } catch {
    return [];
  }
}

type Meta = Pick<State, 'updatedAt' | 'seen' | 'trends'>;

const metaOf = (from: State): Meta => ({ updatedAt: from.updatedAt, seen: from.seen, trends: from.trends });

/** This phone's copy: the records by month, when they were fetched, and Trends as last seen. */
async function readCopy(caregiverId: string): Promise<Pick<State, 'records' | 'updatedAt' | 'seen' | 'trends'>> {
  try {
    const prefix = cacheKey(caregiverId);
    const keys = (await AsyncStorage.getAllKeys()).filter((key) => key === prefix || key.startsWith(`${prefix}.`));
    let meta: Meta = { updatedAt: null, seen: null, trends: null };
    const records: CardAttempt[] = [];
    for (const [key, raw] of await AsyncStorage.multiGet(keys)) {
      const value = raw ? JSON.parse(raw) : undefined;
      if (key === prefix) meta = { updatedAt: value?.updatedAt ?? null, seen: value?.seen ?? null, trends: value?.trends ?? null };
      else if (Array.isArray(value)) records.push(...value);
    }
    return { records: keptAttempts(mergeRecords(records), new Date()), ...meta };
  } catch {
    // Unreadable: Insights fetch everything again.
    return { records: [], updatedAt: null, seen: null, trends: null };
  }
}

/**
 * Writes the months that changed (all of them after a full fetch, none for `[]`) with when and
 * Trends as last seen, in one go, and drops months that are gone.
 */
function saveCopy(caregiverId: string, records: CardAttempt[], changed: Set<string> | null) {
  writing = writing
    .then(async () => {
      if (state?.caregiverId !== caregiverId) return;
      const byMonth = new Map<string, CardAttempt[]>();
      for (const record of records) byMonth.set(monthOf(record), [...(byMonth.get(monthOf(record)) ?? []), record]);
      const writes: [string, string][] = [...byMonth].filter(([month]) => !changed || changed.has(month)).map(([month, list]) => [monthKey(caregiverId, month), JSON.stringify(list)]);
      const prefix = `${cacheKey(caregiverId)}.`;
      const gone = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(prefix) && !byMonth.has(key.slice(prefix.length)));
      await AsyncStorage.multiSet([...writes, [cacheKey(caregiverId), JSON.stringify(metaOf(state))]]);
      if (gone.length) await AsyncStorage.multiRemove(gone);
    })
    .catch(() => undefined);
  return writing;
}

/**
 * Keeps what the Trends views need with the records, so Trends and Insights open offline too: each
 * person's name, whether they are archived or in practice, which facts are approved, the day's target,
 * the settings and the last 30 days of sessions. No facts' words. Saved only when it changed.
 */
export function rememberTrends(family: Family, activity: Activity) {
  const current = state;
  if (!current?.loaded) return;
  const trends: TrendsCopy = {
    family: {
      people: family.people.map(({ id, name, archivedAt, includeInPractice }) => ({ id, name, includeInPractice, ...(archivedAt ? { archivedAt } : {}) })),
      cards: family.cards.map(({ id, personId, status }) => ({ id, personId, status })),
      goal: family.goal,
      revealCards: family.revealCards,
      sessionLength: family.sessionLength,
    },
    activity,
  };
  if (JSON.stringify(trends) === JSON.stringify(current.trends)) return;
  set({ ...current, trends });
  void saveCopy(current.caregiverId, current.records, new Set());
}

/**
 * This phone's copy, for Export my data offline: the card records it keeps (and any still queued here
 * for the person's login), and Trends as last seen. Nothing is fetched.
 */
export async function phoneCopy(caregiverId: string) {
  const [saved, queued] = await Promise.all([readCopy(caregiverId), queuedRecords(caregiverId)]);
  const inMemory = state?.caregiverId === caregiverId && state.loaded ? state.records : [];
  return { records: mergeRecords(saved.records, inMemory, queued), trends: state?.caregiverId === caregiverId && state.trends ? state.trends : saved.trends };
}

/** Signing out or deleting the account here: this phone's copy goes, and nothing is kept in memory. */
export async function forgetInsights(caregiverId = state?.caregiverId) {
  state = null;
  fetching = null;
  listeners.forEach((listener) => listener());
  if (!caregiverId) return;
  await writing;
  const prefix = cacheKey(caregiverId);
  const keys = (await AsyncStorage.getAllKeys().catch(() => [] as string[])).filter((key) => key === prefix || key.startsWith(`${prefix}.`));
  if (keys.length) await AsyncStorage.multiRemove(keys).catch(() => undefined);
}

/**
 * What Insights read: the server's records and this phone's queued ones, each once, kept (the last
 * ATTEMPTS_KEPT_DAYS), about someone still in the family. Someone deleted for good leaves with their
 * records; archived people stay, for "Include archived people". The same records give the same
 * object, so the figures are worked out once per change.
 */
export const insightsData = memoLast((records: CardAttempt[], queued: CardAttempt[], people: { id: string }[], today: string): InsightsData => {
  const family = new Set(people.map((person) => person.id));
  const [year, month, day] = today.split('-').map(Number);
  const attempts = keptAttempts(mergeRecords(records, queued), new Date(year, month - 1, day, 12)).filter((record) => family.has(record.personId));
  return { attempts, demo: false };
});

/**
 * The family's records for Insights, their freshness, and Trends as last seen on this phone.
 * `people`: the family, once it has loaded; until then (offline), the people last seen.
 */
export function useServerInsights(people: { id: string }[] | undefined): { data?: InsightsData; sync: InsightsSync; trends: TrendsCopy | null; ready: boolean } {
  const view = useSyncExternalStore(subscribeInsights, insightsState, () => null);
  const who = people ?? view?.trends?.family.people;
  return {
    data: view?.loaded && who ? insightsData(view.records, view.queued, who, studyToday()) : undefined,
    sync: { updatedAt: view?.updatedAt ?? null, loading: view?.loading ?? false, problem: view?.problem, update: updateInsights, refresh: refreshInsights },
    trends: view?.trends ?? null,
    /** This phone's copy has been read, so Trends can be kept with it. */
    ready: Boolean(view?.loaded),
  };
}
