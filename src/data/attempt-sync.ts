import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as Crypto from 'expo-crypto';
import { AppState } from 'react-native';

import { backfillFrom, fromRow, mergeRecords, RECORD_BATCH, refusalOf, retryDelay, toRow, uploadable, type BackfillMark, type Login, type RecordRow } from '@/lib/attempt-records';
import { ATTEMPTS_KEY, attemptOf, type CardAttempt, type CardTiming } from '@/lib/attempts';
import type { Round } from '@/lib/stories';
import { supabase } from '@/lib/supabase';
import { isAiPhrasing } from '@/lib/variants';

// The practice device, signed in as the person, with sign-in on. Each card's record for the
// caregiver's insights is saved in a queue on this phone first, then uploaded in the background, in
// small batches, whenever the phone is signed in and online. An upload that can't go waits longer
// each time before trying again; with no connection the queue simply waits for one. The queue
// survives the app closing, and each record's id is made here, so one sent twice is kept once. The
// person's login can only write records (supabase/schema.sql): nothing is read back, nothing here
// shows anything, and practice never waits on it. The caregiver's phone reads the records
// (src/data/insights-store.ts). Records stay off the server only when they must: see uploadable.

/** The records still to send, per login, in the order they were made. */
const QUEUE_KEY = 'evermore.recordQueue.v1';
const queueKey = (personUserId: string) => `${QUEUE_KEY}.${personUserId}`;
/** How far the one-time upload of this phone's earlier records has got, per login. */
const backfillKey = (personUserId: string) => `evermore.recordBackfill.v1.${personUserId}`;

type Queue = {
  login: Login;
  rows: RecordRow[];
  /** The saved queue has been read. Nothing is written before then, so nothing saved is lost. */
  ready: Promise<void>;
  /** The saved queue couldn't be read: send from memory, and never write over it. */
  unreadable?: boolean;
};

let queue: Queue | null = null;
let writing = Promise.resolve();
let flight: Promise<void> | null = null;
/** Something asked to send while an upload was running: send again once it ends. */
let again: { now: boolean } | null = null;
let failures = 0;
let waitUntil = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let listening = false;
/** The connection as NetInfo last reported it. Unknown until it first does, and worth a try meanwhile. */
let connected: boolean | null = null;
let backfilling: Promise<void> | null = null;

function readJson(raw: string | null | undefined): unknown {
  try {
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

const readRows = (raw: string | null | undefined) => {
  const rows = readJson(raw);
  return Array.isArray(rows) ? (rows as RecordRow[]) : [];
};

/** The queue for this login, read from the phone the first time. */
function open(login: Login) {
  if (queue?.login.personUserId === login.personUserId) return queue;
  clearTimeout(timer);
  failures = 0;
  waitUntil = 0;
  const opened: Queue = { login, rows: [], ready: Promise.resolve() };
  opened.ready = AsyncStorage.getItem(queueKey(login.personUserId)).then(
    (raw) => {
      const saved = readRows(raw);
      const ids = new Set(saved.map((row) => row.id));
      // Records made while the saved ones were being read come after them.
      opened.rows = [...saved, ...opened.rows.filter((row) => !ids.has(row.id))];
    },
    () => {
      opened.unreadable = true;
    },
  );
  queue = opened;
  listen();
  return opened;
}

/** Writes the queue as it is now. Chained, so an older write can never land after a newer one. */
function save(opened: Queue) {
  writing = writing
    .then(() => opened.ready)
    .then(() => {
      if (opened.unreadable) return;
      const key = queueKey(opened.login.personUserId);
      return opened.rows.length ? AsyncStorage.setItem(key, JSON.stringify(opened.rows)) : AsyncStorage.removeItem(key);
    })
    .catch(() => undefined);
  return writing;
}

/**
 * A card the person just left: its record, saved in the queue, then sent in the background. It never
 * waits and never throws, so practice goes on exactly as before whatever happens here.
 */
export function recordCardAttempt(login: Login, sessionId: string, card: Round, timing: CardTiming, goal: number, day?: { studyDay: string; extraPractice: boolean }) {
  try {
    queueRecord(login, attemptOf(card, timing, { id: Crypto.randomUUID(), sessionId, goal, source: isAiPhrasing(card.phrasing) ? 'ai' : 'template', ...day }));
  } catch {
    // Insights are a nice-to-have; practice is not.
  }
}

/** Queues a record to upload, unless it must stay off the server (see uploadable). */
export function queueRecord(login: Login, record: CardAttempt) {
  if (!uploadable(record)) return;
  const opened = open(login);
  opened.rows = [...opened.rows, toRow(record, login)];
  save(opened);
  void syncRecords(login);
}

/**
 * Sends what is queued, a batch at a time, oldest first. `now` skips any wait, for when the connection
 * or the app has just come back. Resolves when this round is over, whether or not everything went.
 */
export function syncRecords(login: Login, now = false): Promise<void> {
  const opened = open(login);
  if (now) waitUntil = 0;
  if (flight) {
    again = { now: now || Boolean(again?.now) };
    return flight;
  }
  flight = upload(opened).finally(() => {
    flight = null;
    const next = again;
    again = null;
    // The queue asked about may belong to whoever signed in meanwhile.
    if (next && queue?.rows.length) void syncRecords(queue.login, next.now);
  });
  return flight;
}

async function upload(opened: Queue) {
  await opened.ready;
  // Every record is saved on the phone before it is sent.
  await writing;
  if (queue !== opened || !opened.rows.length || Date.now() < waitUntil || !online()) return;
  const held = new Set<string>();
  for (;;) {
    if (queue !== opened) return;
    const batch = opened.rows.filter((row) => !held.has(row.id)).slice(0, RECORD_BATCH);
    if (!batch.length) break;
    const sent = await send(batch);
    sent.held.forEach((id) => held.add(id));
    if (sent.done.length || sent.held.length) {
      const done = new Set(sent.done);
      const left = opened.rows.filter((row) => !done.has(row.id));
      // A record the server won't take yet goes to the back, so it doesn't hold up the rest.
      opened.rows = [...left.filter((row) => !held.has(row.id)), ...left.filter((row) => held.has(row.id))];
      // The round ends with the phone's copy as it is, so what is saved is never behind.
      await save(opened);
    }
    if (sent.retry) return later(opened);
  }
  if (held.size) return later(opened);
  failures = 0;
}

/** Tries again after a wait that grows each time, from 2 seconds up to 5 minutes. */
function later(opened: Queue) {
  failures += 1;
  const delay = retryDelay(failures);
  waitUntil = Date.now() + delay;
  clearTimeout(timer);
  timer = setTimeout(() => void syncRecords(opened.login, true), delay);
}

/** With no connection there is nothing to try: the queue waits for one (see listen). */
const online = () => connected !== false;

type Sent = { done: string[]; held: string[]; retry: boolean };

/**
 * One upload: a plain insert, since the person's login can't read back what it wrote. A record the
 * server already has (a resend after a lost reply) counts as sent, and so does one about someone
 * deleted for good, which goes with them. If one record refuses a batch, each is sent by itself.
 */
async function send(rows: RecordRow[]): Promise<Sent> {
  let error: { code?: string } | null;
  try {
    ({ error } = await supabase.from('attempt_records').insert(rows));
  } catch {
    return { done: [], held: [], retry: true };
  }
  if (!error) return { done: rows.map((row) => row.id), held: [], retry: false };
  const refusal = refusalOf(error.code);
  if (refusal === 'retry') return { done: [], held: [], retry: true };
  if (rows.length === 1) return refusal === 'held' ? { done: [], held: [rows[0].id], retry: false } : { done: [rows[0].id], held: [], retry: false };
  const sent: Sent = { done: [], held: [], retry: false };
  for (const row of rows) {
    const one = await send([row]);
    sent.done.push(...one.done);
    sent.held.push(...one.held);
    if (one.retry) return { ...sent, retry: true };
  }
  return sent;
}

/** Send as soon as the connection or the app comes back. Started with the first queue. */
function listen() {
  if (listening) return;
  listening = true;
  NetInfo.addEventListener((state) => {
    connected = state.isConnected;
    if (state.isConnected && queue?.rows.length) void syncRecords(queue.login, true);
  });
  AppState.addEventListener('change', (state) => {
    if (state === 'active' && queue?.rows.length) void syncRecords(queue.login, true);
  });
}

/**
 * The family's records still queued on this phone, from whichever login practiced here, for the
 * caregiver's insights when the caregiver signs in on the same phone. Only rows of that family, and
 * read only: the queues stay as they are.
 */
export async function queuedRecords(caregiverId: string): Promise<CardAttempt[]> {
  let rows: RecordRow[] = [];
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(`${QUEUE_KEY}.`));
    rows = (await AsyncStorage.multiGet(keys)).flatMap(([, raw]) => readRows(raw));
  } catch {
    // Unreadable: the server's records still show.
  }
  if (queue) {
    await queue.ready;
    rows = [...rows, ...queue.rows];
  }
  return mergeRecords(
    rows
      .filter((row) => row.caregiver_id === caregiverId)
      .flatMap((row) => {
        try {
          return [fromRow(row)];
        } catch {
          return [];
        }
      }),
  );
}

/**
 * Once per login on this phone: uploads the records kept here from practice with sign-in off that
 * belong to the signed-in family (`people`, by id) and may be uploaded, oldest first. It remembers
 * the last one sent, so it picks up where it stopped, and one sent twice is kept once. It only reads
 * those records: they stay on the phone as they were. The family kept on the phone with sign-in off
 * has ids of its own, so its records never qualify (see DESIGN.md).
 */
export function backfillRecords(login: Login, people: string[]) {
  backfilling ??= backfill(login, new Set(people)).finally(() => {
    backfilling = null;
  });
  return backfilling;
}

async function backfill(login: Login, family: Set<string>) {
  open(login);
  const key = backfillKey(login.personUserId);
  const progress = (readJson(await AsyncStorage.getItem(key).catch(() => null)) ?? {}) as { done?: boolean; after?: BackfillMark };
  if (progress.done || !online()) return;
  const left = backfillFrom(await keptOnPhone(), family, progress.after, new Date());
  for (let start = 0; start < left.length; start += RECORD_BATCH) {
    const batch = left.slice(start, start + RECORD_BATCH);
    const sent = await send(batch.map((record) => toRow(record, login)));
    // Next time, from here.
    if (sent.retry) return;
    const last = batch[batch.length - 1];
    await AsyncStorage.setItem(key, JSON.stringify({ after: { shownAt: last.shownAt, id: last.id } }));
  }
  await AsyncStorage.setItem(key, JSON.stringify({ done: true }));
}

/** The records this phone kept with sign-in off, every month of them, read and left as they are. */
async function keptOnPhone(): Promise<CardAttempt[]> {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(`${ATTEMPTS_KEY}.`));
    return (await AsyncStorage.multiGet(keys)).flatMap(([, raw]) => {
      const month = readJson(raw);
      return Array.isArray(month) ? (month as CardAttempt[]) : [];
    });
  } catch {
    return [];
  }
}
