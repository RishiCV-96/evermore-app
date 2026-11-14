// Card records through the real schema, in PGlite: the rows the person's phone uploads
// (src/lib/attempt-records.ts) go in as the person's login, come back as the caregiver's phone reads
// them (a page at a time, written as PostgREST writes JSON), and must give exactly the same Insights
// as the same records kept on a phone with sign-in off: every figure, the Memory score, the bands
// and the calendar, in several time zones. Also the caregiver's paging and "only what is new"
// against the server's own timestamps.
//
//   node supabase/tests/records.test.mjs
import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { SUPABASE_STANDIN } from './standin.mjs';

const src = fileURLToPath(new URL('../../src/', import.meta.url));
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('@/')) return next(pathToFileURL(`${src}${specifier.slice(2)}.ts`).href, context);
    if (specifier.startsWith('.') && context.parentURL?.endsWith('.ts')) {
      const candidate = new URL(`${specifier}.ts`, context.parentURL);
      if (existsSync(candidate)) return next(candidate.href, context);
    }
    return next(specifier, context);
  },
});

const { toRow, fromRow, mergeRecords, RECORD_BATCH, RECORD_COLUMNS } = await import('@/lib/attempt-records');
const { insightsFor, cellKind, monthWeeks, shiftMonth } = await import('@/lib/insights');
const { demoAttempts } = await import('@/lib/demo-insights');
const { lastDays } = await import('@/lib/activity');
const { studyDayKey } = await import('@/lib/study-day');
const { ATTEMPTS_KEPT_DAYS } = await import('@/config/insights');

const schema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
const db = new PGlite();
await db.exec(SUPABASE_STANDIN);
await db.exec(schema);
await db.exec(`set timezone = 'UTC'`);

let checks = 0;
const check = (label, run) => {
  run();
  checks += 1;
  console.log(`PASS  ${label}`);
};

const A = '00000000-0000-4000-8000-00000000000a';
const P = '00000000-0000-4000-8000-0000000000aa';
const consent = JSON.stringify({ policy_version: '2026-11-13', agreed_policy: true, agreed_responsibility: true, consented_at: new Date().toISOString(), display_name: 'Pat' });
await db.query(`insert into auth.users (id, raw_user_meta_data) values ($1, $2)`, [A, consent]);
await db.query(`insert into auth.users (id, raw_user_meta_data) values ($1, '{"evermore_person": true}')`, [P]);
await db.query(`insert into public.profiles (id, role, display_name, caregiver_id, username) values ($1, 'person', 'Rose', $2, 'grandma.rose')`, [P, A]);
const login = { personUserId: P, caregiverId: A };

/** Runs sql signed in as `user`, Row Level Security applying, and commits. */
async function as(user, sql, params = [], timezone = 'UTC') {
  await db.exec('begin');
  try {
    await db.exec(`set local role authenticated; set local timezone = '${timezone}'`);
    await db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: user })]);
    const result = await db.query(sql, params);
    await db.exec('commit');
    return result.rows;
  } catch (error) {
    await db.exec('rollback');
    throw error;
  }
}

// The family the server seeded: five sample people, each with the server's own id
const people = (await db.query(`select id, name from public.people where caregiver_id = $1 order by name`, [A])).rows;
const idOf = new Map(people.map((person) => [person.name.toLowerCase(), person.id]));

// Eight weeks of everyday practice, from the demo's patterns (improving, steady, needing support;
// full, partial and short days; hints, re-asks), as real records with the server's ids, plus the
// unusual ones: a card left before answering, one from before facts, and an approved AI sentence.
const FIXED = { blank: 'my-rel', ask: 'ask', who: 'who', photo: 'photo' };
const stable = (map, key) => map.get(key) ?? map.set(key, randomUUID()).get(key);
const cards = new Map();
const sessions = new Map();
const everyday = demoAttempts([...idOf.keys()], new Date()).map(({ testData: _testData, demo: _demo, ...record }) => ({
  ...record,
  id: randomUUID(),
  personId: idOf.get(record.personId),
  cardId: stable(cards, record.cardId),
  sessionId: stable(sessions, record.sessionId),
  phrasingId: FIXED[record.shape],
}));
const base = everyday[everyday.length - 1];
const later = (seconds) => new Date(new Date(base.shownAt).getTime() + seconds * 1000).toISOString();
const unusual = [
  { ...base, id: randomUUID(), shownAt: later(30), selections: [], hints: [], success: false, activeMs: 4_000, firstSelectionMs: undefined },
  { ...base, id: randomUUID(), shownAt: later(60), factType: undefined, selections: [{ at: later(63), right: true }] },
  { ...base, id: randomUUID(), shownAt: later(90), source: 'ai', shape: 'reverse', phrasingId: `ai-${randomUUID()}`, selections: [{ at: later(92), right: false }, { at: later(95), right: true }], hints: ['letter'] },
].map((record) => Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined)));
/** The records as a phone with sign-in off keeps them: oldest first. */
const onPhone = [...everyday, ...unusual].sort((a, b) => a.shownAt.localeCompare(b.shownAt));

// Uploaded exactly as the person's phone does: batches of 25 rows, as the person's login
const UPLOAD = `insert into public.attempt_records (${RECORD_COLUMNS.replace(', uploaded_at', '')}) select ${RECORD_COLUMNS.replace(', uploaded_at', '')} from json_populate_recordset(null::public.attempt_records, $1::json) returning 1`;
for (let start = 0; start < onPhone.length; start += RECORD_BATCH) {
  await as(P, UPLOAD, [JSON.stringify(onPhone.slice(start, start + RECORD_BATCH).map((record) => toRow(record, login)))]);
}
const personReads = (await as(P, `select count(*)::int as n from public.attempt_records`))[0].n;
const kept = (await db.query(`select count(*)::int as n from public.attempt_records`)).rows[0].n;
check(`the person's login uploads ${onPhone.length} records, and reads none back`, () => {
  assert.equal(kept, onPhone.length);
  assert.equal(personReads, 0);
});

/** The caregiver's phone reading the window as src/data/insights-store.ts asks: a page at a time, oldest upload first, as PostgREST writes JSON. */
async function caregiverReads({ since = null, timezone = 'UTC', page = 1000 } = {}) {
  const from = lastDays(new Date(), ATTEMPTS_KEPT_DAYS)[0].toISOString();
  const rows = [];
  for (let offset = 0; ; offset += page) {
    const [{ body }] = await as(
      A,
      `select coalesce(json_agg(r), '[]') as body from (
         select ${RECORD_COLUMNS} from public.attempt_records
         where caregiver_id = $1 and shown_at >= $2 and ($3::timestamptz is null or uploaded_at > $3::timestamptz)
         order by uploaded_at, id limit $4 offset $5) r`,
      [A, from, since, page, offset],
      timezone,
    );
    rows.push(...body);
    if (body.length < page) return rows;
  }
}

const read = await caregiverReads();
const fromServer = mergeRecords(read.map(fromRow));
check('the caregiver reads every record back, written the way Postgres writes times', () => {
  assert.equal(read.length, onPhone.length);
  assert.match(read[0].shown_at, /\+00:00$/);
});
check('and each comes back as exactly the record the phone made, field for field', () => assert.deepEqual(fromServer, onPhone));
const inNewYork = await caregiverReads({ timezone: 'America/New_York' });
const inKolkata = await caregiverReads({ timezone: 'Asia/Kolkata' });
check('in other time zones too: Postgres writes other offsets, and they read back the same', () => {
  assert.match(inKolkata[0].shown_at, /\+05:30$/);
  assert.deepEqual(mergeRecords(inNewYork.map(fromRow)), onPhone);
  assert.deepEqual(mergeRecords(inKolkata.map(fromRow)), onPhone);
});

// The same Insights either way: sign-in on (from the server) and sign-in off (on the phone)
const family = (archived) => ({
  people: people.map((person) => ({ id: person.id, name: person.name, ...(person.id === archived ? { archivedAt: new Date().toISOString() } : {}) })),
  cards: [],
  revealCards: 'off',
  sessionLength: 'standard',
});
for (const zone of ['UTC', 'America/Los_Angeles', 'Asia/Kolkata', 'Pacific/Auckland']) {
  process.env.TZ = zone;
  const today = studyDayKey(new Date());
  for (const [archived, includeArchived] of [[undefined, false], [idOf.get('mae'), false], [idOf.get('mae'), true]]) {
    const onServer = insightsFor(fromServer, family(archived), includeArchived, false, today);
    const sameOnPhone = insightsFor([...onPhone], family(archived), includeArchived, false, today);
    assert.deepEqual(onServer, sameOnPhone, `${zone}: identical insights`);
    assert.ok(onServer.latest && onServer.days.size > 30, `${zone}: and there is plenty to compare`);
    // The calendar, month by month, as far back as it goes
    for (let month = today.slice(0, 7), steps = 0; steps < 4; month = shiftMonth(month, -1), steps++) {
      const cells = (view) => monthWeeks(month).flat().map((key) => (key ? cellKind(view.days.get(key)) : null));
      assert.deepEqual(cells(onServer), cells(sameOnPhone), `${zone} ${month}: the same calendar`);
    }
  }
  check(`${zone}: every figure, the Memory score, the bands and the calendar match, with archived people left out and included`, () => undefined);
}
process.env.TZ = 'UTC';

// Paging: more than a page comes back in pages, each record once
const extra = [...Array(2_600).keys()].map((index) => ({ ...base, id: randomUUID(), shownAt: new Date(Date.now() - (index % 100) * 86_400_000 - index * 1_000).toISOString(), selections: [{ at: new Date(Date.now() - (index % 100) * 86_400_000 - index * 1_000 + 2_000).toISOString(), right: true }] }));
for (let start = 0; start < extra.length; start += RECORD_BATCH) {
  await as(P, UPLOAD, [JSON.stringify(extra.slice(start, start + RECORD_BATCH).map((record) => toRow(record, login)))]);
}
const paged = await caregiverReads();
check('more than a thousand records come back in pages, every one, each once', () => {
  assert.equal(paged.length, onPhone.length + extra.length);
  assert.equal(new Set(paged.map((row) => row.id)).size, paged.length);
});

// Only what is new: the server stamps each upload, and the caregiver's phone asks for what came
// after the newest it has, less a few minutes in case an upload landed late. Uploads two hours ago,
// then a last batch an hour ago, then five new records now.
await db.exec(`update public.attempt_records set uploaded_at = now() - interval '2 hours'`);
const lastBatch = onPhone.slice(-RECORD_BATCH).map((record) => record.id);
await db.query(`update public.attempt_records set uploaded_at = now() - interval '1 hour' where id = any($1)`, [lastBatch]);
const seen = (await caregiverReads()).reduce((most, row) => (new Date(row.uploaded_at) > new Date(most) ? row.uploaded_at : most), '1970-01-01T00:00:00+00:00');
const fresh = [...Array(5).keys()].map((index) => ({ ...base, id: randomUUID(), shownAt: later(200 + index * 20), selections: [{ at: later(203 + index * 20), right: true }] }));
await as(P, UPLOAD, [JSON.stringify(fresh.map((record) => toRow(record, login)))]);
const since = new Date(new Date(seen).getTime() - 5 * 60_000).toISOString();
const newer = await caregiverReads({ since });
check('after a fetch, asking for what the server took since brings the new records and the last few minutes again, nothing older', () => {
  assert.deepEqual(new Set(newer.map((row) => row.id)), new Set([...lastBatch, ...fresh.map((record) => record.id)]));
});

console.log(`\nAll ${checks} record checks passed`);
