import { keptAttempts, type CardAttempt } from '@/lib/attempts';
import { sendable } from '@/lib/facts';
import { isStudyDay } from '@/lib/study-day';

// Each card's record as it travels with sign-in on, from the person's phone to the server's
// attempt_records table and on to the caregiver's phone. This file is the privacy line for records:
// toRow is everything that is uploaded, and uploadable says what never is. A row holds ids, fixed
// words, numbers, times and yes-or-no answers, never a name, a photo or anyone's words. Pure, so
// scripts/check-logic.mjs and scripts/check-sync.mjs can check it.

/** Who practiced: the person's login and their family (the caregiver's user id). */
export type Login = { personUserId: string; caregiverId: string };

/** A record as the server keeps it. Every column but uploaded_at, which only the server sets. */
export type RecordRow = {
  id: string;
  caregiver_id: string;
  person_user_id: string;
  person_id: string;
  card_id: string;
  phrasing_id: string;
  shape: CardAttempt['shape'];
  fact_type: NonNullable<CardAttempt['factType']> | null;
  source: CardAttempt['source'];
  session_id: string;
  shown_at: string;
  selected_at: string[];
  selected_right: boolean[];
  choices: number;
  hints: CardAttempt['hints'];
  success: boolean;
  active_ms: number;
  first_selection_ms: number | null;
  goal: number;
  extra: boolean;
  /** The study day it counts toward, from the device. Null on rows from before it was kept. */
  study_day: string | null;
  /** Its round began once the day's session was complete. */
  extra_practice: boolean;
  /** Each "I'm not sure" tap: when, and the hint step it reached. Empty when none, and on rows from before it was kept. */
  help_at: string[];
  help_steps: NonNullable<CardAttempt['help']>[number]['step'][];
};

/** What the caregiver's phone reads back: the same, and when the server took it. */
export type ServerRow = RecordRow & { uploaded_at: string };

/** The columns the caregiver's phone reads. */
export const RECORD_COLUMNS =
  'id, caregiver_id, person_user_id, person_id, card_id, phrasing_id, shape, fact_type, source, session_id, shown_at, selected_at, selected_right, choices, hints, success, active_ms, first_selection_ms, goal, extra, study_day, extra_practice, help_at, help_steps, uploaded_at';

/** Records sent in one upload. Small, so a slow connection still gets each batch through. */
export const RECORD_BATCH = 25;

/** Waiting after an upload that couldn't go: 2 seconds, doubling each time, at most 5 minutes. */
export const RETRY = { firstMs: 2_000, mostMs: 5 * 60_000 };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Whether a record may be uploaded: never test data or the demo (both stay on the phone), never a
 * test fact's, and only one whose ids are the server's. Records from the family kept on the phone
 * with sign-in off have ids of their own (`nora`, `june-0`), so they can't pass.
 */
export function uploadable(record: CardAttempt) {
  return (
    !record.testData &&
    !record.demo &&
    sendable({ row: { card_id: record.cardId } }) &&
    [record.id, record.personId, record.cardId, record.sessionId].every((id) => typeof id === 'string' && UUID.test(id)) &&
    Array.isArray(record.selections) &&
    Array.isArray(record.hints) &&
    (record.help === undefined || Array.isArray(record.help))
  );
}

/** The row uploaded for a record. Nothing else about the card, the person or the family goes. */
export function toRow(record: CardAttempt, login: Login): RecordRow {
  return {
    id: record.id,
    caregiver_id: login.caregiverId,
    person_user_id: login.personUserId,
    person_id: record.personId,
    card_id: record.cardId,
    phrasing_id: record.phrasingId,
    shape: record.shape,
    fact_type: record.factType ?? null,
    source: record.source,
    session_id: record.sessionId,
    shown_at: record.shownAt,
    selected_at: record.selections.map((selection) => selection.at),
    selected_right: record.selections.map((selection) => selection.right),
    choices: record.choices,
    hints: record.hints,
    success: record.success,
    active_ms: Math.round(record.activeMs),
    first_selection_ms: record.firstSelectionMs === undefined ? null : Math.round(record.firstSelectionMs),
    goal: record.goal,
    extra: Boolean(record.extra),
    study_day: isStudyDay(record.studyDay) ? record.studyDay : null,
    extra_practice: Boolean(record.extraPractice),
    help_at: (record.help ?? []).map((request) => request.at),
    help_steps: (record.help ?? []).map((request) => request.step),
  };
}

/** A time as the phone writes it. The server sends "+00:00" where the phone writes "Z". */
const isoTime = (time: string) => new Date(time).toISOString();

/**
 * A row back as the record the phone made, field for field, so insights read both the same way. A row
 * from before help requests were kept (or from a server whose schema is behind) has no help columns.
 */
export function fromRow(row: Omit<RecordRow, 'help_at' | 'help_steps'> & Partial<Pick<RecordRow, 'help_at' | 'help_steps'>>): CardAttempt {
  const helpAt = Array.isArray(row.help_at) ? row.help_at : [];
  const helpSteps = Array.isArray(row.help_steps) ? row.help_steps : [];
  return {
    id: row.id,
    sessionId: row.session_id,
    personId: row.person_id,
    cardId: row.card_id,
    phrasingId: row.phrasing_id,
    shape: row.shape,
    ...(row.fact_type ? { factType: row.fact_type } : {}),
    source: row.source,
    shownAt: isoTime(row.shown_at),
    selections: row.selected_at.map((at, index) => ({ at: isoTime(at), right: row.selected_right[index] })),
    choices: row.choices,
    hints: row.hints,
    ...(helpSteps.length ? { help: helpSteps.map((step, index) => ({ at: isoTime(helpAt[index] ?? row.shown_at), step })) } : {}),
    success: row.success,
    activeMs: row.active_ms,
    ...(row.first_selection_ms === null ? {} : { firstSelectionMs: row.first_selection_ms }),
    goal: row.goal,
    ...(row.extra ? { extra: true } : {}),
    // A row from before study days were kept has none: its day is worked out from shown_at.
    ...(isStudyDay(row.study_day) ? { studyDay: row.study_day } : {}),
    ...(row.extra_practice ? { extraPractice: true } : {}),
  };
}

const byTime = (a: CardAttempt, b: CardAttempt) => a.shownAt.localeCompare(b.shownAt) || a.id.localeCompare(b.id);

/** Records from several places as one list, each once, oldest first. A later list's copy wins. */
export function mergeRecords(...lists: CardAttempt[][]) {
  const byId = new Map<string, CardAttempt>();
  for (const list of lists) for (const record of list) byId.set(record.id, record);
  return [...byId.values()].sort(byTime);
}

/** How far the one-time upload of this phone's earlier records has got: the last one sent. */
export type BackfillMark = { shownAt: string; id: string };

/**
 * This phone's earlier records still to upload once: those that may be uploaded, about someone in
 * the signed-in family, kept (the last ATTEMPTS_KEPT_DAYS), after the last one sent, oldest first.
 */
export function backfillFrom(records: CardAttempt[], family: Set<string>, after: BackfillMark | undefined, now: Date) {
  return keptAttempts(records, now)
    .filter((record) => uploadable(record) && family.has(record.personId))
    .filter((record) => !after || record.shownAt > after.shownAt || (record.shownAt === after.shownAt && record.id > after.id))
    .sort(byTime);
}

/**
 * What a refused upload means for its records, from the server's error code:
 *   stored  already on the server (a resend after a lost reply), so it is done
 *   gone    whose card it was has been deleted for good, so the record goes with them
 *   held    a value the server doesn't take yet, kept and tried again later
 *   retry   offline, signed out, the server busy or not set up yet: kept, and tried again later
 */
export type Refusal = 'stored' | 'gone' | 'held' | 'retry';

export function refusalOf(code: string | undefined): Refusal {
  if (code === '23505') return 'stored';
  if (code === '23503') return 'gone';
  if (code && /^2[23]/.test(code)) return 'held';
  return 'retry';
}

/** How long to wait after `failures` uploads in a row couldn't go, give or take a fifth so phones don't retry in step. */
export function retryDelay(failures: number, random = Math.random) {
  const base = Math.min(RETRY.firstMs * 2 ** Math.max(0, failures - 1), RETRY.mostMs);
  return Math.round(base * (0.8 + 0.4 * random()));
}
