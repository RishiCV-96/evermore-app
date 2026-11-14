// Checks Export my data (src/lib/export.ts, src/lib/insight-report.ts, src/data/export-store.ts)
// against in-memory stand-ins (scripts/fakes/) for Supabase, the phone's storage and the share sheet:
//   node scripts/check-export.mjs
// The full history, far past 30 days, read a page at a time with more rows than one page; archived
// people in it; nothing secret in the file; a failed page, a cancel or no connection never giving a
// file; this phone's copy offline, labelled as such; the person's login refused before any request;
// the report's figures the same as Insights for the same days; study days split at 05:30; the photos
// zip; and how large a long history's file gets. supabase/tests/rls.test.mjs runs the export's own
// queries through the real schema: one family can never read another's.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

// A phone in New York, so study days and their 05:30 start are local time, with daylight saving.
process.env.TZ = 'America/New_York';

const src = fileURLToPath(new URL('../src/', import.meta.url));
const fake = (file) => new URL(`./fakes/${file}`, import.meta.url).href;
const FAKES = {
  '@/lib/supabase': fake('supabase.mjs'),
  '@/data/account': fake('account.mjs'),
  '@/lib/photo-files': fake('native.mjs'),
  '@/lib/photo-urls': fake('native.mjs'),
  '@/lib/save-file': fake('save-file.mjs'),
  '@/components/person-photo': pathToFileURL(`${src}lib/photo-fields.ts`).href,
  'expo-crypto': fake('native.mjs'),
  '@react-native-async-storage/async-storage': fake('storage.mjs'),
  '@react-native-community/netinfo': fake('netinfo.mjs'),
  'react-native': fake('react-native.mjs'),
};
registerHooks({
  resolve(specifier, context, next) {
    if (FAKES[specifier]) return next(FAKES[specifier], context);
    if (specifier.startsWith('@/')) return next(pathToFileURL(`${src}${specifier.slice(2)}.ts`).href, context);
    if (specifier.startsWith('.') && context.parentURL?.includes('.ts')) {
      const candidate = new URL(`${specifier}.ts`, context.parentURL);
      if (existsSync(candidate)) return next(candidate.href, context);
    }
    return next(specifier, context);
  },
});

let checks = 0;
async function check(label, run) {
  await run();
  checks += 1;
  console.log(`PASS  ${label}`);
}

const { server } = await import(fake('supabase.mjs'));
const { disk } = await import(fake('storage.mjs'));
const { CAREGIVER, PERSON, who } = await import(fake('account.mjs'));
const { photoBytes } = await import(fake('save-file.mjs'));
const { unzipSync, strFromU8 } = await import('fflate');
const store = await import('@/data/export-store');
const { familyExport, exportText, exportFileName, photoEntries, EXPORT_FORMAT, EXPORT_PROBLEM, SECTION_WORDS } = await import('@/lib/export');
const { reportOf, reportHtml, REPORT_NOTES } = await import('@/lib/insight-report');
const { insightsFor, attemptsInView, resolutionsOf, helpRequestsOf } = await import('@/lib/insights');
const { toRow } = await import('@/lib/attempt-records');
const { studyDayKey, studyDayStart, addStudyDays } = await import('@/lib/study-day');
const { sessionDay } = await import('@/lib/activity');
const { sentenceFor, BLANK } = await import('@/lib/stories');

const OTHER = '00000000-0000-4000-8000-00000000000b';
const now = new Date();
const today = studyDayKey(now);

// ---------------------------------------------------------------------------------------
// A family with a long history on the server, and another family beside it
// ---------------------------------------------------------------------------------------

const [JUNE, LEO, MAE] = [randomUUID(), randomUUID(), randomUUID()];
const person = (id, name, more = {}) => ({
  id,
  caregiver_id: CAREGIVER,
  name,
  relationship: 'sister',
  photo_path: null,
  sample_portrait: null,
  hint_letter: true,
  hint_fact: true,
  hint_relationship: false,
  hint_fewer: true,
  profile_step: 7,
  best_clue: 'laugh',
  not_applicable: [],
  in_deck: true,
  include_in_practice: true,
  reveal_ok: true,
  archived_at: null,
  created_at: '2025-01-0%T10:00:00.000Z'.replace('%', String(1 + ['June', 'Leo', 'Mae'].indexOf(name))),
  ...more,
});
server.tables.people = [
  person(JUNE, 'June', { photo_path: `${CAREGIVER}/june.jpg` }),
  person(LEO, 'Leo', { relationship: 'brother', archived_at: '2026-10-01T12:00:00.000Z', in_deck: false }),
  // A photo path outside the family's folder is never fetched.
  person(MAE, 'Mae', { relationship: 'friend', photo_path: `${OTHER}/mae.jpg` }),
  { ...person(randomUUID(), 'Stranger'), caregiver_id: OTHER },
];
const cardIds = { [JUNE]: [], [LEO]: [], [MAE]: [] };
let added = Date.parse('2025-02-01T10:00:00.000Z');
const card = (personId, text, type = 'interest', more = {}) => {
  const id = randomUUID();
  cardIds[personId]?.push(id);
  return {
    id,
    caregiver_id: CAREGIVER,
    person_id: personId,
    memory_text: text,
    sentence: 'x {name}',
    status: 'approved',
    fact_type: type,
    time_sensitive: false,
    as_of: null,
    memory_year: null,
    confirmed_at: null,
    source: 'caregiver',
    phrasings_off: [],
    hint_ok: true,
    photo_path: null,
    created_at: new Date((added += 60_000)).toISOString(),
    updated_at: new Date(added).toISOString(),
    ...more,
  };
};
server.tables.cards = [
  card(JUNE, 'loves golf'),
  card(JUNE, 'went to Santa’s Village every December', 'shared', { memory_year: 1988, photo_path: `${CAREGIVER}/june-memory.jpg` }),
  card(JUNE, 'a nurse', 'work', { time_sensitive: true, as_of: '2026-05-01', confirmed_at: '2026-05-02T10:00:00.000Z' }),
  card(LEO, 'fixes old radios'),
  card(LEO, 'grew up in Erie', 'place', { status: 'skipped' }),
  card(MAE, 'bakes bread'),
  card(MAE, 'plays chess', 'interest', { status: 'pending' }),
  { ...card(randomUUID(), 'the stranger’s secret'), caregiver_id: OTHER },
];
server.tables.daily_goal = [{ caregiver_id: CAREGIVER, session_length: 'long', reveal_cards: 'often' }, { caregiver_id: OTHER, session_length: 'short', reveal_cards: 'off' }];
// What the export must never carry: the person's login, its user name and email, a PIN's hash, a device credential
const PIN_HASH = 'a'.repeat(64);
server.tables.profiles = [{ id: PERSON, caregiver_id: CAREGIVER, role: 'person', username: 'grandma.rose', display_name: 'Rose', email: 'rose@person.evermore.invalid' }];
server.tables.pairings = [{ id: randomUUID(), caregiver_id: CAREGIVER, pin_hash: PIN_HASH }];
server.tables.devices = [
  { id: randomUUID(), caregiver_id: CAREGIVER, person_user_id: PERSON, name: 'Rose’s iPhone', paired_at: '2026-11-11T15:00:00.000Z', last_seen_at: '2026-11-13T12:00:00.000Z', revoked_at: null, credential: 'device-secret-xyz' },
  { id: randomUUID(), caregiver_id: CAREGIVER, person_user_id: randomUUID(), name: 'Old tablet', paired_at: '2026-06-01T15:00:00.000Z', last_seen_at: '2026-07-01T12:00:00.000Z', revoked_at: '2026-07-02T09:00:00.000Z' },
  { id: randomUUID(), caregiver_id: OTHER, person_user_id: randomUUID(), name: 'Stranger’s phone', paired_at: '2026-01-01T00:00:00.000Z', last_seen_at: null, revoked_at: null },
];

// Sessions: two a day for 550 study days, far past 30 days, and more than one page
const SESSION_DAYS = 550;
for (let back = SESSION_DAYS - 1; back >= 0; back--) {
  const key = addStudyDays(today, -back);
  for (const [index, minutes] of [30, 600].entries()) {
    const startedAt = new Date(studyDayStart(key).getTime() + minutes * 60_000).toISOString();
    server.tables.sessions.push({ id: randomUUID(), caregiver_id: CAREGIVER, person_user_id: PERSON, started_at: startedAt, completed_at: index ? null : startedAt, cards_completed: 24, daily_goal: 24, is_sample: false, study_day: back % 3 ? key : null });
  }
}
server.tables.sessions.push({ id: randomUUID(), caregiver_id: CAREGIVER, person_user_id: null, started_at: new Date().toISOString(), completed_at: null, cards_completed: 99, daily_goal: 99, is_sample: true, study_day: today });
server.tables.sessions.push({ id: randomUUID(), caregiver_id: OTHER, person_user_id: randomUUID(), started_at: new Date().toISOString(), completed_at: null, cards_completed: 7, daily_goal: 7, is_sample: false, study_day: today });

// Card records: 24 a day for the 110 days the server keeps, about everyone (Leo before he was archived too)
const RECORD_DAYS = 110;
const people = [JUNE, LEO, MAE];
const records = [];
for (let back = RECORD_DAYS - 1; back >= 0; back--) {
  const key = addStudyDays(today, -back);
  const sessionId = randomUUID();
  const extraSession = randomUUID();
  for (let index = 0; index < 24; index++) {
    const personId = people[(index + back) % 3];
    const shown = studyDayStart(key).getTime() + 40 * 60_000 + index * 25_000;
    const misses = (index + back) % 5 === 0 ? 1 : (index * back) % 7 === 0 ? 2 : 0;
    const extraPractice = back % 4 === 0 && index >= 20;
    // Now and then the person asks for help ("I'm not sure") before choosing the right name first.
    const helped = misses === 0 && index % 11 === 3;
    const selections = [...Array(misses).keys()].map((at) => ({ at: new Date(shown + 2_000 + at * 1_500).toISOString(), right: false }));
    selections.push({ at: new Date(shown + 2_000 + misses * 1_500).toISOString(), right: true });
    records.push({
      id: randomUUID(),
      sessionId: extraPractice ? extraSession : sessionId,
      personId,
      cardId: cardIds[personId][index % 2],
      phrasingId: index % 2 ? 'who' : 'my-rel',
      shape: index % 2 ? 'who' : 'blank',
      factType: 'interest',
      source: 'template',
      shownAt: new Date(shown).toISOString(),
      selections,
      choices: 3,
      hints: helped ? ['fact'] : ['letter', 'fact'].slice(0, misses),
      ...(helped ? { help: [{ at: new Date(shown + 1_000).toISOString(), step: 'fact' }] } : {}),
      success: true,
      activeMs: 6_000 + misses * 3_000,
      firstSelectionMs: 2_000,
      goal: 20,
      ...(index === 13 ? { extra: true } : {}),
      // Older rows have no study day: their day is worked out from when they were shown.
      ...(back % 5 ? { studyDay: key } : {}),
      ...(extraPractice ? { extraPractice: true } : {}),
    });
  }
}
let uploaded = Date.now() - RECORD_DAYS * 86_400_000;
server.tables.attempt_records = records.map((record) => ({ ...toRow(record, { personUserId: PERSON, caregiverId: CAREGIVER }), uploaded_at: new Date((uploaded += 1_000)).toISOString() }));
server.tables.attempt_records.push({ ...toRow({ ...records[0], id: randomUUID() }, { personUserId: randomUUID(), caregiverId: OTHER }), uploaded_at: new Date().toISOString() });
server.tables.card_schedule = [
  { card_id: cardIds[JUNE][0], person_user_id: PERSON, caregiver_id: CAREGIVER, step: 3, due_at: '2026-11-20T10:30:00.000Z', updated_at: '2026-11-10T10:00:00.000Z' },
  { card_id: cardIds[JUNE][0], person_user_id: randomUUID(), caregiver_id: CAREGIVER, step: 1, due_at: '2026-11-14T10:30:00.000Z', updated_at: '2026-09-10T10:00:00.000Z' },
];

const rangesOf = (table, from = 0) => server.log.slice(from).filter((entry) => entry.table === table && entry.action === 'select').flatMap((entry) => entry.calls.filter((call) => call.startsWith('range')));
const quietly = async (run) => {
  const said = [];
  const original = console.warn;
  console.warn = (...args) => said.push(args.join(' '));
  try {
    return { result: await run(), said };
  } finally {
    console.warn = original;
  }
};

// ---------------------------------------------------------------------------------------
// The data file
// ---------------------------------------------------------------------------------------

let source;
let copy;
let text;
await check('the full history is read from the server, a page at a time, with progress', async () => {
  const progress = [];
  const read = await store.readServerExport((step) => progress.push(step), { cancelled: false });
  assert.ok(read.ok, JSON.stringify(read));
  source = read.value;
  assert.equal(source.sessions.length, SESSION_DAYS * 2, 'every session, the made-up sample one and the other family’s left out');
  assert.equal(source.records.length, records.length, 'every card record');
  assert.ok(rangesOf('sessions').includes('range 1000-1999') && rangesOf('attempt_records').includes('range 2000-2999'), 'more rows than one page: read in pages');
  assert.ok(server.log.filter((entry) => entry.table && entry.action === 'select').every((entry) => entry.calls?.includes('eq caregiver_id')), 'every read names the family, beside Row Level Security');
  assert.deepEqual([...new Set(progress.map((step) => step.step))], ['family', 'sessions', 'records', 'schedule', 'phones'], 'progress through each part');
  assert.ok(progress.some((step) => step.step === 'records' && step.done === 2000), 'with the rows read so far');
});

await check('the file holds everything: people with every answer, archived people, stories, sessions, card records, schedule, phones', async () => {
  copy = familyExport(source, now, '1.2.3');
  text = exportText(copy);
  assert.deepEqual(JSON.parse(text), JSON.parse(JSON.stringify(copy)), 'the text is the copy, exactly');
  assert.equal(copy.about.format, EXPORT_FORMAT);
  assert.equal(copy.about.appVersion, '1.2.3');
  assert.equal(copy.about.exportedAt, now.toISOString());
  assert.equal(copy.about.complete, true);
  assert.deepEqual(Object.keys(copy.about.sections), ['settings', 'people', 'sessions', 'cardRecords', 'schedule', 'linkedPhones'], 'a plain description of each section at the top');
  assert.ok(Object.values(copy.about.sections).every((words) => words.length > 40));
  assert.deepEqual(copy.settings, { sessionLength: 'long', revealCards: 'often' });
  assert.deepEqual(copy.people.map((one) => [one.name, one.status]), [['June', 'in practice'], ['Leo', 'archived'], ['Mae', 'in practice']], 'everyone in the family, the archived person marked so');
  const leo = copy.people[1];
  assert.equal(leo.archivedAt, '2026-10-01T12:00:00.000Z');
  const story = (type, words) => sentenceFor({ relationship: 'brother' }, { type, text: words }).replace(BLANK, 'Leo');
  assert.deepEqual(leo.facts.map((fact) => [fact.words, fact.status, fact.story]), [['fixes old radios', 'approved', story('interest', 'fixes old radios')], ['grew up in Erie', 'skipped', story('place', 'grew up in Erie')]], 'approved and skipped stories, as practice says them');
  assert.ok(leo.facts[0].story.startsWith('My brother, Leo, '));
  const june = copy.people[0];
  assert.deepEqual(june.hints, { letter: true, fact: true, relationship: false, fewer: true });
  assert.equal(june.bestClue, 'laugh');
  assert.ok(june.facts.some((fact) => fact.mayChange && fact.asOf === '2026-05-01' && fact.confirmedAt) && june.facts.some((fact) => fact.year === 1988 && fact.hasPhoto));
  assert.ok(june.facts.every((fact) => fact.question && fact.id), 'each answer with its question and id');
  assert.equal(copy.people[2].facts[1].status, 'waiting for approval');
  assert.equal(copy.sessions.length, SESSION_DAYS * 2);
  assert.equal(copy.sessions[0].studyDay, addStudyDays(today, -(SESSION_DAYS - 1)), 'the oldest session, a year and a half back');
  assert.ok(copy.sessions.every((session) => /^\d{4}-\d\d-\d\d$/.test(session.studyDay)), 'every session with its study day');
  assert.equal(copy.cardRecords.length, records.length);
  assert.ok(copy.cardRecords.some((record) => record.extraPractice) && copy.cardRecords.some((record) => !record.extraPractice), 'with extra practice marked');
  assert.ok(copy.cardRecords.some((record) => record.hintsShown.length === 2 && record.answersChosen.length === 3), 'and the hints shown');
  const asked = copy.cardRecords.filter((record) => record.askedForHelp.length);
  assert.ok(asked.length > 0 && asked.every((record) => record.askedForHelp.every((request) => request.hintReached === 'fact' && request.at) && record.answersChosen.every((answer) => answer.right)), 'and each help request with the hint it reached, never as an answer chosen');
  assert.ok(copy.cardRecords.every((record) => Array.isArray(record.askedForHelp)), 'every record says, an empty list when none');
  assert.ok(copy.cardRecords.filter((record) => record.personId === LEO).length > 0, 'the archived person’s practice too');
  assert.deepEqual(copy.schedule, [{ cardId: cardIds[JUNE][0], step: 3, dueAt: '2026-11-20T10:30:00.000Z', updatedAt: '2026-11-10T10:00:00.000Z' }], 'the family’s schedule: the one changed last');
  assert.deepEqual(copy.linkedPhones, [
    { name: 'Old tablet', pairedAt: '2026-06-01T15:00:00.000Z', lastSeenAt: '2026-07-01T12:00:00.000Z', removedAt: '2026-07-02T09:00:00.000Z' },
    { name: 'Rose’s iPhone', pairedAt: '2026-11-11T15:00:00.000Z', lastSeenAt: '2026-11-13T12:00:00.000Z' },
  ], 'linked phones: names and dates only');
});

await check('nothing secret, no login, no other family, and no photo in the data file', async () => {
  for (const secret of [PIN_HASH, 'grandma.rose', 'rose@person.evermore.invalid', 'device-secret-xyz', PERSON, CAREGIVER, OTHER, 'Stranger', 'the stranger’s secret', 'signed.invalid', '.jpg']) {
    assert.ok(!text.includes(secret), `the file never holds ${secret}`);
  }
  const keys = new Set();
  const walk = (value) => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') for (const [key, inner] of Object.entries(value)) keys.add(key) && walk(inner);
  };
  walk(copy);
  for (const key of keys) assert.ok(!/password|token|email|secret|pin|hash|credential|user_?id|login|caregiver|photo_?path|photo_?uri|url|test/i.test(key), `no field like "${key}"`);
  assert.ok(!/[0-9a-f]{64}/.test(text), 'nothing that looks like a hash');
});

await check('test data, the demo and a test fact’s records never go in the file', async () => {
  const testCard = { id: 'test-1', personId: JUNE, type: 'food', text: 'pie', status: 'approved', timeSensitive: false, source: 'caregiver', phrasingsOff: [], testData: true };
  const base = source.records[0];
  const local = familyExport(
    {
      ...source,
      origin: { from: 'phone-only' },
      people: source.people.map((one) => (one.id === JUNE ? { ...one, notApplicable: ['photo', 'memory'], testMarks: ['memory'] } : one)),
      cards: [...source.cards, testCard],
      records: [...source.records, { ...base, id: 'demo-1', demo: true, testData: true }, { ...base, id: 'invented-7', testData: true }, { ...base, id: 'about-test', cardId: 'test-1' }],
      ai: {
        on: true,
        consented: true,
        sentences: [
          { id: 'ai-1', personId: JUNE, shape: 'blank', text: 'Every December, ____ went to Santa’s Village.', facts: [{ id: cardIds[JUNE][1], type: 'shared', text: 'went to Santa’s Village every December' }], status: 'approved' },
          { id: 'ai-2', personId: JUNE, shape: 'ask', text: 'Who loves golf?', facts: [{ id: cardIds[JUNE][0], type: 'interest', text: 'loves golf' }], status: 'rejected', edited: true },
        ],
      },
      phones: undefined,
    },
    now,
    '1.2.3',
  );
  const words = JSON.stringify(local);
  assert.ok(!/\bpie\b|demo-1|invented-7|about-test/.test(words), 'no made-up fact or record');
  assert.deepEqual(local.people[0].notApplicable, ['photo'], 'nor a test mark');
  assert.equal(local.cardRecords.length, records.length);
  assert.deepEqual(local.aiSentences.map((one) => [one.status, one.fromFacts[0].words]), [['approved', 'went to Santa’s Village every December'], ['rejected', 'loves golf']], 'approved and rejected AI sentences, with the facts they came from');
  assert.ok(!('linkedPhones' in local) && 'aiSentences' in local.about.sections);
});

await check('a page that fails gives no file, says what kind failed, and logs no row or name', async () => {
  server.failSelect = (table, window) => (table === 'attempt_records' && window?.[0] === 1000 ? { code: 'XX000', message: 'failing row: June loves golf' } : null);
  const { result, said } = await quietly(() => store.readServerExport(() => {}, { cancelled: false }));
  server.failSelect = null;
  assert.deepEqual(result, { ok: false, problem: 'server' }, 'nothing partial: the whole read fails');
  assert.deepEqual(said, ['Could not read the export (XX000)']);
  assert.ok(!/error|fail|\d{3}|PGRST|schema/i.test(EXPORT_PROBLEM.server), 'calm words for it');
});

await check('Cancel stops at the next page, with nothing kept', async () => {
  const cancel = { cancelled: false };
  const from = server.log.length;
  const read = await store.readServerExport((step) => {
    if (step.step === 'records' && step.done >= 1000) cancel.cancelled = true;
  }, cancel);
  assert.deepEqual(read, { ok: false, cancelled: true });
  assert.deepEqual(rangesOf('attempt_records', from), ['range 0-999'], 'no page read after Cancel');
  assert.equal(rangesOf('card_schedule', from).length + rangesOf('devices', from).length, 0);
});

// ---------------------------------------------------------------------------------------
// The person's login, offline, and this phone's copy
// ---------------------------------------------------------------------------------------

await check('the person’s login (any paired phone) can’t export: refused before a single request', async () => {
  who.role = 'person';
  const from = server.log.length;
  assert.deepEqual(await store.readServerExport(() => {}, { cancelled: false }), { ok: false, problem: 'caregivers-only' });
  assert.deepEqual(await store.readServerPhotos(() => {}, { cancelled: false }), { ok: false, problem: 'caregivers-only' });
  assert.deepEqual(await store.phoneCopySource(), { ok: false, problem: 'caregivers-only' });
  who.role = 'caregiver';
  who.signedIn = false;
  assert.deepEqual(await store.readServerExport(() => {}, { cancelled: false }), { ok: false, problem: 'caregivers-only' }, 'nor anyone signed out');
  who.signedIn = true;
  assert.equal(server.log.length, from, 'nothing was asked of the server');
});

await check('offline: no file from the server, then this phone’s copy, which says what it may be missing', async () => {
  server.offline = true;
  const { result } = await quietly(() => store.readServerExport(() => {}, { cancelled: false }));
  assert.deepEqual(result, { ok: false, problem: 'offline' });
  // What Insights kept on this phone: records by month, and Trends as last seen
  const kept = source.records.slice(-300);
  const byMonth = new Map();
  for (const record of kept) {
    const month = record.shownAt.slice(0, 7);
    byMonth.set(month, [...(byMonth.get(month) ?? []), record]);
  }
  const prefix = `evermore.insightsCache.v1.${CAREGIVER}`;
  disk.set(prefix, JSON.stringify({ updatedAt: now.toISOString(), seen: null, trends: { family: { people: [{ id: JUNE, name: 'June', includeInPractice: true }, { id: LEO, name: 'Leo', includeInPractice: true, archivedAt: '2026-10-01T12:00:00.000Z' }, { id: MAE, name: 'Mae', includeInPractice: true }], cards: [], goal: 24, revealCards: 'often', sessionLength: 'long' }, activity: { sessions: source.sessions.slice(-60), weekCardIds: [] } } }));
  for (const [month, list] of byMonth) disk.set(`${prefix}.${month}`, JSON.stringify(list));
  const fallback = await store.phoneCopySource();
  server.offline = false;
  assert.ok(fallback.ok);
  const offline = fallback.value;
  assert.deepEqual(offline.origin, { from: 'phone-copy', missing: ['people', 'sessions', 'schedule', 'linkedPhones'] });
  assert.equal(offline.records.length, 300);
  const file = familyExport(offline, now, '1.2.3');
  assert.equal(file.about.complete, false, 'the file says it is not complete');
  assert.match(file.about.madeFrom, /this phone’s copy/);
  assert.match(file.about.madeFrom, /may be missing newer data/);
  assert.deepEqual(file.about.notIncluded, ['people', 'sessions', 'schedule', 'linkedPhones'].map((section) => SECTION_WORDS[section]), 'and what it may lack');
  assert.equal(file.people[1].status, 'archived', 'archived people stay marked');
  const html = reportHtml(reportOf(offline, today));
  assert.ok(html.includes(REPORT_NOTES.phoneCopy.replace(/’/g, '&#39;').replace(/'/g, '&#39;')) || html.includes(REPORT_NOTES.phoneCopy), 'and so does the report');
});

// ---------------------------------------------------------------------------------------
// The report
// ---------------------------------------------------------------------------------------

await check('the report’s figures are the Insights figures for the same days', async () => {
  const report = reportOf(source, today);
  const family = { people: source.people, cards: source.cards, revealCards: source.revealCards, sessionLength: source.sessionLength };
  const view = insightsFor(source.records, family, true, false, today);
  assert.equal(report.days.length, view.days.size, 'every study day Insights has');
  for (const day of report.days) {
    const insight = view.days.get(day.key);
    for (const field of ['cards', 'score', 'band', 'activeMs', 'medianFirstMs']) assert.deepEqual(day[field], insight[field], `${day.key} ${field}`);
    assert.deepEqual(day.resolutions, insight.resolutions);
    assert.deepEqual(day.extraPractice, insight.extraPractice);
  }
  const all = resolutionsOf(attemptsInView(source.records, source.people, { includeArchived: true, demo: false }));
  assert.equal(report.cards, all.cards);
  assert.deepEqual(report.found.map((group) => group.count), [all.counts[1], all.counts[2], all.counts[3]], 'how answers were found: the same counts');
  assert.ok(report.askedForHelp > 0 && report.askedForHelp === [...view.days.values()].reduce((sum, day) => sum + day.askedForHelp, 0), 'asked for help: the same count as Insights’ days');
  assert.equal(report.askedForHelp, helpRequestsOf(attemptsInView(source.records, source.people, { includeArchived: true, demo: false })));
  assert.equal(report.cards, [...view.days.values()].reduce((sum, day) => sum + day.cards, 0));
  assert.equal(report.daysPracticed, RECORD_DAYS);
  assert.equal(report.weeks.reduce((sum, week) => sum + week.cards, 0), report.cards, 'the weeks add up to the whole');
  assert.ok(report.weeks.every((week) => new Date(`${week.from}T12:00:00`).getDay() === 1 && week.to === addStudyDays(week.from, 6)), 'weeks of study days, Monday to Sunday');
  assert.equal(report.sessions + report.extraRounds, new Set(source.records.map((record) => record.sessionId)).size);
  assert.ok(report.extraRounds > 0 && report.extraCards > 0);
  assert.equal(report.people.length, 3);
  assert.ok(report.people.find((one) => one.id === LEO).archived, 'the archived person, labelled');
  assert.ok(report.mostReadily && report.mostSupport && report.mostReadily.score >= report.mostSupport.score);
  // Only within the one family's own practice, and the scores there are personScore's
  const html = reportHtml(report);
  for (const words of [REPORT_NOTES.medical, 'Memory score over time', 'How answers were found', 'Week by week', 'Right away', 'On a second try', 'With help', 'Asked for help: ', 'Leo <span class="muted">(archived)</span>']) assert.ok(html.includes(words.replace(/’/g, '&#39;')) || html.includes(words), `the report shows "${words}"`);
  assert.ok(html.includes('This report contains personal information'), 'with the note on personal information at the top');
  assert.ok(html.indexOf('personal information') < html.indexOf('Memory score over time'));
  assert.ok(html.includes('5:30 AM'), 'and the study day’s start');
  assert.ok(html.includes('placeholders, still to be reviewed by a speech-language pathologist'), 'and that the intervals are placeholders');
  assert.ok(!/<script|https?:\/\/(?!www\.w3)/i.test(html), 'nothing loaded from anywhere');
  const names = reportHtml(reportOf({ ...source, people: source.people.map((one) => (one.id === JUNE ? { ...one, name: '<b>June & "Co"</b>' } : one)) }, today));
  assert.ok(names.includes('&lt;b&gt;June &amp; &quot;Co&quot;&lt;/b&gt;') && !names.includes('<b>June'), 'names are written as text, never as markup');
});

await check('study days split at 05:30: grouped by the day each round began in', async () => {
  const day = '2026-11-10';
  const at = (hour, minute) => new Date(2026, 10, 10, hour, minute).toISOString();
  const base = { sessionId: 's', personId: JUNE, cardId: cardIds[JUNE][0], phrasingId: 'who', shape: 'who', factType: 'interest', source: 'template', choices: 3, hints: [], success: true, activeMs: 5_000, firstSelectionMs: 2_000, goal: 10 };
  const right = (when) => [{ at: when, right: true }];
  const boundary = [
    { ...base, id: 'r1', shownAt: at(5, 29), selections: right(at(5, 29)) }, // an older row with no study day: before 05:30 is the day before
    { ...base, id: 'r2', shownAt: at(5, 31), selections: right(at(5, 31)) }, // after 05:30: its own day
    { ...base, id: 'r3', shownAt: at(5, 45), selections: right(at(5, 45)), studyDay: '2026-11-09' }, // a round begun at 05:20 keeps its day
    { ...base, id: 'r4', shownAt: at(2, 0), selections: right(at(2, 0)), extraPractice: true }, // 02:00 is still the day before
  ];
  const small = { origin: { from: 'server' }, people: source.people, cards: source.cards, records: boundary };
  const report = reportOf(small, day);
  assert.deepEqual(report.days.map((one) => [one.key, one.cards]), [['2026-11-09', 3], [day, 1]]);
  assert.deepEqual(report.days[0].extraPractice.cards, 1, 'extra practice at 02:00 counts toward the day before');
  const file = familyExport({ ...source, records: boundary, sessions: [{ id: 'x', startedAt: at(5, 20), completedAt: null, cardsCompleted: 3, dailyGoal: 10, studyDay: null }, { id: 'y', startedAt: at(5, 35), completedAt: null, cardsCompleted: 1, dailyGoal: 10 }] }, now, '1');
  assert.deepEqual(file.cardRecords.map((one) => [one.id, one.studyDay]), [['r4', '2026-11-09'], ['r1', '2026-11-09'], ['r2', day], ['r3', '2026-11-09']]);
  assert.deepEqual(file.sessions.map((one) => one.studyDay), ['2026-11-09', day], 'sessions too');
  assert.equal(sessionDay({ startedAt: at(5, 20), studyDay: null }), '2026-11-09');
  // A week runs Monday to Sunday by study day: 02:00 on Monday, November 9 is still Sunday's, so Sunday's week
  const sundayNight = new Date(2026, 10, 9, 2, 0).toISOString();
  assert.deepEqual(reportOf({ ...small, records: [{ ...base, id: 'w1', shownAt: sundayNight, selections: right(sundayNight) }] }, day).weeks.map((week) => [week.from, week.to]), [['2026-11-02', '2026-11-08']]);
  const mondayMorning = new Date(2026, 10, 9, 5, 31).toISOString();
  assert.deepEqual(reportOf({ ...small, records: [{ ...base, id: 'w2', shownAt: mondayMorning, selections: right(mondayMorning) }] }, day).weeks.map((week) => [week.from, week.to]), [['2026-11-09', '2026-11-15']]);
});

await check('no practice yet: a calm report, with every note', async () => {
  const html = reportHtml(reportOf({ origin: { from: 'server' }, people: [], cards: [], records: [] }, today));
  assert.ok(html.includes('No practice has been recorded yet.') && html.includes(REPORT_NOTES.medical) && html.includes('This report contains personal information'));
});

// ---------------------------------------------------------------------------------------
// Photos: a separate, optional export
// ---------------------------------------------------------------------------------------

await check('photos: the ones the caregiver added, as stored, in a zip with an index; never another folder’s', async () => {
  server.objects = [`${CAREGIVER}/june.jpg`, `${CAREGIVER}/june-memory.jpg`, `${OTHER}/mae.jpg`];
  const bytes = { june: new Uint8Array([255, 216, 1, 2, 3]), memory: new Uint8Array([255, 216, 9, 9]) };
  photoBytes.set(`https://signed.invalid/${CAREGIVER}/june.jpg`, bytes.june);
  photoBytes.set(`https://signed.invalid/${CAREGIVER}/june-memory.jpg`, bytes.memory);
  const progress = [];
  const read = await store.readServerPhotos((step) => progress.push(step), { cancelled: false });
  assert.ok(read.ok, JSON.stringify(read));
  assert.equal(read.value.count, 2);
  const files = unzipSync(read.value.zip);
  assert.deepEqual(Object.keys(files).filter((name) => !name.endsWith('/')).sort(), ['photos.json', 'photos/June - memory 1.jpg', 'photos/June.jpg']);
  assert.deepEqual(files['photos/June.jpg'], bytes.june, 'the photo as stored, byte for byte');
  assert.deepEqual(files['photos/June - memory 1.jpg'], bytes.memory);
  const index = JSON.parse(strFromU8(files['photos.json']));
  assert.deepEqual(index.photos.map((one) => [one.file, one.person, one.memory ?? null]), [['photos/June.jpg', 'June', null], ['photos/June - memory 1.jpg', 'June', 'went to Santa’s Village every December']]);
  assert.ok(!JSON.stringify(index).includes(CAREGIVER) && !JSON.stringify(index).includes('signed.invalid'), 'no folder, path or link in the index');
  assert.ok(!server.log.some((entry) => entry.storage === 'sign' && entry.paths.some((path) => path.startsWith(OTHER))), 'another family’s folder is never asked for');
  assert.deepEqual(progress.filter((step) => step.step === 'photos').map((step) => step.done), [0, 1, 2]);
});

await check('photos: one that can’t be read stops the zip, rather than leave it out silently', async () => {
  server.objects = [`${CAREGIVER}/june.jpg`];
  const { result } = await quietly(() => store.readServerPhotos(() => {}, { cancelled: false }));
  assert.deepEqual(result, { ok: false, problem: 'server' });
});

await check('photo names are safe on any system and never collide', async () => {
  const entries = photoEntries(
    [
      { id: '1', name: 'Ann/Marie: "Nana"', hints: {}, notApplicable: [], includeInPractice: true, revealOk: true, photoUri: 'file:///a.png' },
      { id: '2', name: 'ann/marie: nana', hints: {}, notApplicable: [], includeInPractice: true, revealOk: true, photoUri: 'file:///b.jpeg' },
      { id: '3', name: 'Sample', hints: {}, notApplicable: [], includeInPractice: true, revealOk: true, samplePortrait: 'june', bundledPhoto: 1 },
    ],
    [],
  );
  assert.deepEqual(entries.map((entry) => entry.file), ['AnnMarie Nana.png', 'annmarie nana.jpg'], 'no illustration or bundled photo, which the caregiver didn’t add');
  assert.equal(exportFileName('photos', new Date('2026-11-13T12:00:00Z')), 'evermore-photos-2026-11-13.zip');
  assert.equal(exportFileName('report', new Date('2026-11-13T12:00:00Z')), 'evermore-report-2026-11-13.pdf');
  assert.equal(exportFileName('data', new Date('2026-11-13T12:00:00Z')), 'evermore-data-2026-11-13.json');
});

// ---------------------------------------------------------------------------------------
// How large a long history gets
// ---------------------------------------------------------------------------------------

await check('a long history stays a modest file', async () => {
  // The most the server keeps: 120 days of card records at 40 cards a day, and two years of sessions
  const long = [];
  for (let back = 0; back < 120; back++) for (let index = 0; index < 40; index++) long.push({ ...records[index % records.length], id: randomUUID(), sessionId: randomUUID(), studyDay: addStudyDays(today, -back) });
  const sessions = Array.from({ length: 730 * 2 }, (_, index) => ({ ...source.sessions[0], id: randomUUID(), startedAt: new Date(now.getTime() - index * 43_200_000).toISOString() }));
  const big = exportText(familyExport({ ...source, records: long, sessions }, now, '1.2.3'));
  const megabytes = Buffer.byteLength(big) / 1_000_000;
  console.log(`      ${long.length.toLocaleString()} card records and ${sessions.length.toLocaleString()} sessions: ${megabytes.toFixed(1)} MB`);
  assert.ok(megabytes < 6, `${megabytes} MB`);
  assert.equal(JSON.parse(big).cardRecords.length, long.length);
});

console.log(`All ${checks} export checks passed`);
