import { DEFAULT_REVEAL_CARDS, DEFAULT_SESSION_LENGTH } from '@/config/schedule';
import { currentProfile } from '@/data/account';
import { hintsOf, latestFamily } from '@/data/family-store';
import { boardNotesNow } from '@/data/board-store';
import { phoneCopy } from '@/data/insights-store';
import { fromRow, type ServerRow } from '@/lib/attempt-records';
import type { CardAttempt } from '@/lib/attempts';
import {
  Cancelled,
  collectPhotos,
  photoEntries,
  photoZip,
  settleRead,
  type Cancel,
  type ExportCard,
  type ExportPerson,
  type ExportProgress,
  type ExportRead,
  type ExportSchedule,
  type ExportSection,
  type ExportSession,
  type ExportSource,
  type ExportStep,
} from '@/lib/export';
import { noteFromRow } from '@/lib/family-notes';
import { warnKind } from '@/lib/log';
import { downloadBytes } from '@/lib/save-file';
import { supabase } from '@/lib/supabase';

// Export my data with sign-in on: the caregiver's own family, read from the server with the
// caregiver's own session, so Row Level Security decides what can be read (supabase/schema.sql), and
// every query also names the family, as a second guard. Only a caregiver's login reads anything: the
// person's login is refused before a single request. Every table is read a page at
// a time, so a long history works, with progress and a way to cancel. Any page that fails fails the
// whole read: the app never writes a partial file without saying so. Offline, the caregiver may choose
// this phone's copy instead (phoneCopySource), which the file and the report label as such.
// Logs say only what failed and its kind (warnKind).

/** Rows per request: Supabase's own most rows per request. Keep at or below the project's row limit per request (its API settings). */
export const EXPORT_PAGE = 1000;

/** The signed-in caregiver's id, or nothing for anyone else (signed out, or the person's login). */
function caregiverId() {
  try {
    const profile = currentProfile();
    return profile.role === 'caregiver' ? profile.id : undefined;
  } catch {
    return undefined;
  }
}

/** Every row of one of the family's tables, a page at a time, in a stable order. */
async function allRows<T>(table: string, columns: string, order: string[], family: string, cancel: Cancel, onPage: (count: number) => void, filter?: (query: any) => any): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += EXPORT_PAGE) {
    if (cancel.cancelled) throw new Cancelled();
    let query = supabase.from(table).select(columns).eq('caregiver_id', family);
    if (filter) query = filter(query);
    for (const column of order) query = query.order(column);
    const { data, error } = await query.range(offset, offset + EXPORT_PAGE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as T[]));
    onPage(rows.length);
    if ((data?.length ?? 0) < EXPORT_PAGE) return rows;
  }
}

/** People and their facts: the first part of every export, and all the photos export needs. */
async function readPeopleAndCards(family: string, cancel: Cancel, onPage: (count: number) => void) {
  const people = await allRows<Record<string, any>>(
    'people',
    'id, name, relationship, photo_path, sample_portrait, hint_letter, hint_fact, hint_relationship, hint_fewer, profile_step, best_clue, not_applicable, in_deck, include_in_practice, reveal_ok, archived_at, created_at',
    ['created_at', 'id'],
    family,
    cancel,
    onPage,
  );
  const cards = await allRows<Record<string, any>>(
    'cards',
    'id, person_id, memory_text, status, fact_type, time_sensitive, as_of, memory_year, confirmed_at, source, phrasings_off, hint_ok, photo_path, created_at, updated_at',
    ['created_at', 'id'],
    family,
    cancel,
    (count) => onPage(people.length + count),
  );
  return { people, cards };
}

/** The whole family from the server, for the data file and the report. */
export function readServerExport(onProgress: (progress: ExportProgress) => void, cancel: Cancel): Promise<ExportRead<ExportSource>> {
  const family = caregiverId();
  if (!family) return Promise.resolve({ ok: false, problem: 'caregivers-only' });
  return settleRead(async () => {
    const step = (name: ExportStep) => (done: number) => onProgress({ step: name, done });
    const { people, cards } = await readPeopleAndCards(family, cancel, step('family'));
    if (cancel.cancelled) throw new Cancelled();
    const settings = await supabase.from('daily_goal').select('session_length, reveal_cards').eq('caregiver_id', family).maybeSingle();
    if (settings.error) throw settings.error;
    // Every column, so a server whose schema is behind the app (no study_day yet) still answers.
    const sessions = await allRows<Record<string, any>>('sessions', '*', ['started_at', 'id'], family, cancel, step('sessions'), (query) => query.eq('is_sample', false));
    const records = await allRows<ServerRow>('attempt_records', '*', ['uploaded_at', 'id'], family, cancel, step('records'));
    const schedule = await allRows<Record<string, any>>('card_schedule', 'card_id, person_user_id, step, due_at, updated_at', ['card_id', 'person_user_id'], family, cancel, step('schedule'));
    const notes = await boardRows(family, cancel);
    return serverSource({ people, cards, settings: settings.data, sessions, records, schedule, notes });
  });
}

/**
 * The Family board's notes. A server that hasn't been upgraded yet has no table: then there is no board to
 * export and the section is left out. Any other failure fails the export, as every other table does.
 */
async function boardRows(family: string, cancel: Cancel) {
  try {
    return await allRows<NoteRow>('family_notes', 'id, body, from_name, from_relationship, pinned, created_at, updated_at', ['created_at', 'id'], family, cancel, () => undefined);
  } catch (error) {
    const { code, message } = (error ?? {}) as { code?: string; message?: string };
    if (code === '42P01' || code === 'PGRST205' || /family_notes.*(does not exist|schema cache)/i.test(message ?? '')) return undefined;
    throw error;
  }
}

type NoteRow = Parameters<typeof noteFromRow>[0];

type Rows = {
  notes?: NoteRow[];
  people: Record<string, any>[];
  cards: Record<string, any>[];
  settings: Record<string, any> | null;
  sessions: Record<string, any>[];
  records: ServerRow[];
  schedule: Record<string, any>[];
};

/** The server's rows as the export reads them. */
export function serverSource(rows: Rows): ExportSource {
  const people: ExportPerson[] = rows.people.map((row) => ({
    id: row.id,
    name: row.name,
    relationship: row.relationship || undefined,
    photoPath: row.photo_path ?? undefined,
    samplePortrait: row.sample_portrait ?? undefined,
    hints: hintsOf(row),
    profileStep: row.profile_step ?? 0,
    bestClue: row.best_clue ?? undefined,
    notApplicable: row.not_applicable ?? [],
    inDeck: Boolean(row.in_deck),
    includeInPractice: row.include_in_practice !== false,
    revealOk: row.reveal_ok !== false,
    archivedAt: row.archived_at ?? undefined,
    createdAt: row.created_at ?? undefined,
  }));
  const cards: ExportCard[] = rows.cards.map((row) => ({
    id: row.id,
    personId: row.person_id,
    type: row.fact_type,
    text: row.memory_text,
    status: row.status,
    timeSensitive: Boolean(row.time_sensitive),
    asOf: row.as_of ?? undefined,
    year: row.memory_year ?? undefined,
    confirmedAt: row.confirmed_at ?? undefined,
    source: row.source ?? 'caregiver',
    phrasingsOff: row.phrasings_off ?? [],
    hintOk: row.hint_ok,
    photoPath: row.photo_path ?? undefined,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  }));
  const sessions: ExportSession[] = rows.sessions.map((row) => ({
    id: row.id,
    startedAt: row.started_at,
    completedAt: row.completed_at ?? null,
    cardsCompleted: row.cards_completed,
    dailyGoal: row.daily_goal,
    studyDay: row.study_day ?? null,
  }));
  // A card's schedule for each login that practiced it: the family's is the one changed last.
  const latest = new Map<string, ExportSchedule>();
  for (const row of rows.schedule) {
    const entry = { cardId: row.card_id, step: row.step, dueAt: row.due_at, updatedAt: row.updated_at ?? undefined };
    const seen = latest.get(row.card_id);
    if (!seen || (entry.updatedAt ?? '') > (seen.updatedAt ?? '')) latest.set(row.card_id, entry);
  }
  return {
    origin: { from: 'server' },
    people,
    cards,
    sessionLength: rows.settings?.session_length ?? DEFAULT_SESSION_LENGTH,
    revealCards: rows.settings?.reveal_cards ?? DEFAULT_REVEAL_CARDS,
    sessions,
    records: rows.records.flatMap(readRecord),
    schedule: [...latest.values()],
    ...(rows.notes ? { notes: rows.notes.map(noteFromRow) } : {}),
  };
}

/** A row the server's own checks let in reads; one that somehow can't is not invented into a record. */
function readRecord(row: ServerRow): CardAttempt[] {
  try {
    return [fromRow(row)];
  } catch (error) {
    warnKind('Could not read a card record for the export', error);
    return [];
  }
}

/**
 * Offline: what this phone has, chosen by the caregiver. The family as last loaded in this session (or,
 * after a restart, the names Trends keep), Insights' copy of the card records and those still queued
 * here, and the last 30 days of sessions. Labelled as a phone copy, with what it can't include.
 */
export async function phoneCopySource(): Promise<ExportRead<ExportSource>> {
  const family = caregiverId();
  if (!family) return { ok: false, problem: 'caregivers-only' };
  const loaded = latestFamily();
  const copy = await phoneCopy(family);
  const missing: ExportSection[] = ['sessions', 'schedule'];
  const known = loaded ?? copy.trends?.family;
  // The Family board as this phone last saw it, if it has opened the board this session.
  const notes = boardNotesNow();
  if (!notes) missing.push('familyBoard');
  if (!loaded) missing.unshift('people');
  return {
    ok: true,
    value: {
      origin: { from: 'phone-copy', missing },
      people: (known?.people ?? []).map((person) => ({
        hints: { letter: true, fact: true, relationship: true, fewer: true },
        notApplicable: [],
        revealOk: true,
        ...person,
        includeInPractice: person.includeInPractice !== false,
      })),
      cards: loaded?.cards ?? [],
      sessionLength: known?.sessionLength ?? DEFAULT_SESSION_LENGTH,
      revealCards: known?.revealCards ?? DEFAULT_REVEAL_CARDS,
      sessions: copy.trends?.activity.sessions ?? [],
      records: copy.records,
      schedule: [],
      ...(notes ? { notes } : {}),
    },
  };
}

// ---------------------------------------------------------------------------------------
// Photos: a separate, optional export
// ---------------------------------------------------------------------------------------

/** The family's photos from the private bucket, through short-lived signed links, with the caregiver's own session. */
export function readServerPhotos(onProgress: (progress: ExportProgress) => void, cancel: Cancel): Promise<ExportRead<{ zip: Uint8Array; count: number }>> {
  const family = caregiverId();
  if (!family) return Promise.resolve({ ok: false, problem: 'caregivers-only' });
  return settleRead(async () => {
    const rows = await readPeopleAndCards(family, cancel, (done) => onProgress({ step: 'family', done }));
    const source = serverSource({ ...rows, settings: null, sessions: [], records: [], schedule: [] });
    // Only photos in this family's own folder.
    const entries = photoEntries(source.people, source.cards, family);
    const urls = new Map<string, string>();
    if (entries.length) {
      const { data, error } = await supabase.storage.from('photos').createSignedUrls(entries.map((entry) => entry.path!), PHOTO_LINK_SECONDS);
      if (error) throw error;
      for (const item of data ?? []) if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
    }
    const files = await collectPhotos(
      entries,
      async (entry) => {
        const url = urls.get(entry.path!);
        // A photo the bucket no longer has: the whole zip stops, rather than leave it out silently.
        if (!url) throw Object.assign(new Error('photo'), { code: 'photo-missing' });
        return downloadBytes(url);
      },
      onProgress,
      cancel,
    );
    return { zip: photoZip(entries, files, source, new Date()), count: entries.length };
  });
}

/** Signed links for the photos export last only as long as the download needs. */
const PHOTO_LINK_SECONDS = 10 * 60;
