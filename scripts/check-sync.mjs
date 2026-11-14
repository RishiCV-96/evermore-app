// Checks how card records travel with sign-in on, against in-memory stand-ins (scripts/fakes/) for
// Supabase, the phone's storage, the connection and the app's state:
//   node scripts/check-sync.mjs
// The practice device (src/data/attempt-sync.ts): each record is saved, then sent in small batches;
// one sent twice is kept once; the queue outlives the app; with no connection it waits, then sends
// everything once; after an upload that can't go it waits longer each time; test data never goes; a
// person deleted for good takes their waiting records with them; and the one-time backfill can stop
// and start again without sending anything twice. supabase/tests/records.test.mjs runs the same rows
// through the real schema.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const src = fileURLToPath(new URL('../src/', import.meta.url));
const fake = (file) => new URL(`./fakes/${file}`, import.meta.url).href;
const FAKES = {
  '@/lib/supabase': fake('supabase.mjs'),
  '@/data/account': fake('account.mjs'),
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

// The phone's timers, in the check's hands: a wait passes only when the check says so.
const timers = new Map();
let timerId = 0;
globalThis.setTimeout = (run, ms) => {
  timers.set(++timerId, { run, ms });
  return timerId;
};
globalThis.clearTimeout = (id) => timers.delete(id);
const waits = () => [...timers.values()].map((timer) => timer.ms);
/** Lets every promise in flight settle. */
const settle = async () => {
  for (let i = 0; i < 60; i++) await new Promise((resolve) => setImmediate(resolve));
};
/** The wait is over: run what was waiting. */
async function passWait() {
  const due = [...timers.values()];
  timers.clear();
  due.forEach((timer) => timer.run());
  await settle();
}

const { server, supabase } = await import(fake('supabase.mjs'));
const { disk, slow, release } = await import(fake('storage.mjs'));
const { net } = await import(fake('netinfo.mjs'));
const { appState } = await import(fake('react-native.mjs'));
const { CAREGIVER } = await import(fake('account.mjs'));
const { attemptOf } = await import('@/lib/attempts');
const records = await import('@/lib/attempt-records');

/** The app, started fresh: what it held in memory is gone, and the disk and the server are as they were. */
const syncFile = pathToFileURL(`${src}data/attempt-sync.ts`).href;
let lives = 0;
async function launch() {
  timers.clear();
  net.reset();
  appState.reset();
  return import(`${syncFile}?life=${++lives}`);
}

// A family on the server: two people and the person's login.
const PERSON_LOGIN = '00000000-0000-4000-8000-0000000000aa';
const login = { personUserId: PERSON_LOGIN, caregiverId: CAREGIVER };
const [JUNE, LEO] = [randomUUID(), randomUUID()];
server.tables.people = [
  { id: JUNE, caregiver_id: CAREGIVER, name: 'June' },
  { id: LEO, caregiver_id: CAREGIVER, name: 'Leo' },
];
const SESSION = randomUUID();
const QUEUE = `evermore.recordQueue.v1.${PERSON_LOGIN}`;
const queued = () => JSON.parse(disk.get(QUEUE) ?? '[]');
const uploads = () => server.log.filter((entry) => entry.table === 'attempt_records' && entry.action === 'insert');
const stored = () => server.tables.attempt_records;
const storedOnce = () => new Set(stored().map((row) => row.id)).size === stored().length;

// Cards as practice asks them, and what the practice card measures
const cards = new Map();
const card = (personId, kind = 'who') => {
  const id = randomUUID();
  cards.set(id, personId);
  return { id, personId, phrasing: { id: kind === 'who' ? 'who' : 'my-rel', kind }, fact: { type: 'interest' }, choices: ['June', 'Leo', 'Mae'] };
};
let clock = Date.now() - 6 * 60 * 60 * 1000;
const timing = (misses = 0) => {
  const shownAt = (clock += 20_000);
  const picks = [...Array(misses).keys()].map((index) => ({ at: shownAt + 2_000 + index * 1_500, right: false }));
  return { shownAt, selections: [...picks, { at: shownAt + 2_000 + misses * 1_500, right: true }], away: [], leftAt: shownAt + 9_000 + misses * 1_500, hints: ['letter', 'fact', 'relationship'].slice(0, misses) };
};
/** The person practices `count` cards about someone: each card's record handed over as they leave it. */
function practice(sync, count, personId = JUNE, goal = 36) {
  const made = [];
  for (let index = 0; index < count; index++) {
    const asked = card(personId, index % 2 ? 'blank' : 'who');
    const measured = timing(index % 3);
    sync.recordCardAttempt(login, SESSION, asked, measured, goal);
    made.push({ asked, measured, goal });
  }
  return made;
}

// Online: each record is saved on the phone, then sent; the queue empties
let sync = await launch();
server.refuse = (row) => {
  assert.ok(queued().some((saved) => saved.id === row.id), 'a record is saved on the phone before it is sent');
  return null;
};
const before = uploads().length;
const made = practice(sync, 3);
assert.equal(uploads().length, before, 'leaving a card returns at once: nothing is sent while practice goes on');
await settle();
server.refuse = null;
assert.equal(stored().length, 3, 'three cards, three records on the server');
assert.ok(!disk.has(QUEUE), 'and nothing left waiting on the phone');
// What the server keeps is the record the phone made, field for field, and nothing more
for (const [index, row] of stored().entries()) {
  const { asked, measured, goal } = made[index];
  const record = attemptOf(asked, measured, { id: row.id, sessionId: SESSION, goal, source: 'template' });
  assert.deepEqual(records.fromRow(row), record, 'the server keeps exactly the record made with sign-in off');
  assert.deepEqual(records.toRow(record, login), Object.fromEntries(Object.entries(row).filter(([column]) => column !== 'uploaded_at')), 'and the row is that record, no more');
}
const columns = Object.keys(stored()[0]).sort();
assert.deepEqual(columns, [...records.RECORD_COLUMNS.split(', ')].sort(), 'ids, fixed words, numbers, times and yes or no: nothing else is uploaded');
assert.ok(!/June|Leo|Mae/.test(JSON.stringify(stored())), 'no name goes, not even the names offered');

// Saved first, even when the phone's storage is slow: nothing is sent until it is on the disk
slow.writes = true;
const slowFrom = uploads().length;
server.refuse = (row) => {
  assert.ok(queued().some((saved) => saved.id === row.id), 'a slow write still lands before the record is sent');
  return null;
};
practice(sync, 1);
await settle();
assert.equal(uploads().length, slowFrom, 'nothing goes while the record is still being saved');
release();
await settle();
server.refuse = null;
assert.equal(stored().length, 4, 'then it goes');

// A record sent twice is kept once
sync.queueRecord(login, records.fromRow(stored()[0]));
await settle();
assert.equal(stored().length, 4, 'a record the server already has is not kept again');
assert.ok(storedOnce() && !disk.has(QUEUE), 'and the phone counts it as sent');

// Offline: the queue waits, then sends everything once
net.set(false);
const offlineFrom = uploads().length;
practice(sync, 5, LEO);
await settle();
assert.equal(uploads().length, offlineFrom, 'with no connection nothing is tried');
assert.equal(queued().length, 5, 'and every record waits on the phone');
assert.equal(waits().length, 0, 'waiting for the connection, not on a timer');
net.set(true);
await settle();
assert.equal(stored().length, 9, 'the connection back: all five go');
assert.ok(storedOnce() && !disk.has(QUEUE), 'each once');

// The app closed while offline: the queue is still there when it opens again
net.set(false);
practice(sync, 3);
await settle();
assert.equal(queued().length, 3);
sync = await launch();
net.set(true);
await sync.syncRecords(login, true);
assert.equal(stored().length, 12, 'reopened and online, the three saved records go');
assert.ok(storedOnce() && !disk.has(QUEUE));

// The app closed mid-upload: the server kept the records, the reply never came. Sent again, kept once.
server.hang = true;
practice(sync, 2);
await settle();
assert.equal(stored().length, 14, 'the server took them');
assert.equal(queued().length, 2, 'but the phone never heard, so they still wait');
server.hang = false;
sync = await launch();
await sync.syncRecords(login, true);
assert.equal(stored().length, 14, 'sent again after the restart, they are not kept twice');
assert.ok(storedOnce() && !disk.has(QUEUE), 'and the queue is empty');

// A record made while the saved queue is still loading comes after it, and nothing saved is lost
net.set(false);
practice(sync, 2);
await settle();
slow.reads = true;
sync = await launch();
const [late] = practice(sync, 1);
await settle();
release();
await settle();
assert.deepEqual(queued().map((row) => row.card_id).slice(-1), [late.asked.id], 'the new record joins the end of the saved ones');
assert.equal(queued().length, 3, 'and all three are there');
net.set(true);
await settle();
const order = stored().slice(-3).map((row) => row.card_id);
assert.equal(order[2], late.asked.id, 'they go oldest first');
assert.equal(stored().length, 17);

// After an upload that can't go, the wait grows: 2 seconds, doubling, at most 5 minutes
server.busy = true;
const busyFrom = uploads().length;
practice(sync, 1);
await settle();
assert.equal(uploads().length, busyFrom + 1, 'one try');
const growing = [];
for (let round = 0; round < 10; round++) {
  growing.push(waits()[0]);
  await passWait();
}
assert.ok(growing[0] >= 1_600 && growing[0] <= 2_400, `then a wait of about 2 seconds (${growing[0]})`);
assert.ok(growing[1] >= 3_200 && growing[1] <= 4_800 && growing[2] >= 6_400 && growing[2] <= 9_600, `doubling (${growing.slice(1, 3)})`);
assert.ok(growing.every((ms) => ms <= 360_000) && growing.at(-1) >= 240_000, `and never past about 5 minutes (${growing.at(-1)})`);
const tries = uploads().length;
practice(sync, 1);
await settle();
assert.equal(uploads().length, tries, 'a new card while waiting doesn’t try sooner');
appState.set('background');
appState.set('active');
await settle();
assert.equal(uploads().length, tries + 1, 'the app coming back to the front tries at once');
server.busy = false;
await passWait();
assert.equal(stored().length, 19, 'once the server is back, both go');
assert.ok(storedOnce() && !disk.has(QUEUE) && waits().length === 0, 'and nothing waits any more');
server.busy = true;
practice(sync, 1);
await settle();
assert.ok(waits()[0] <= 2_400, 'the next wait starts small again');
server.busy = false;
await passWait();

// Test data and the demo never leave the phone, nor does anything from the family kept on the phone
const sample = records.fromRow(stored()[0]);
const neverSent = [
  { ...sample, id: randomUUID(), testData: true },
  { ...sample, id: `demo-2026-11-01-3`, demo: true, testData: true },
  { ...sample, id: randomUUID(), cardId: 'test-june-2' },
  { ...sample, id: randomUUID(), personId: 'nora', cardId: 'nora-0' },
  { ...sample, id: randomUUID(), personId: 'june', cardId: 'sample-june-1' },
];
const testFrom = uploads().length;
for (const record of neverSent) sync.queueRecord(login, record);
await settle();
assert.equal(uploads().length, testFrom, 'test data, the demo and the phone’s own family are never sent');
assert.ok(!disk.has(QUEUE), 'nor even queued');
assert.ok(neverSent.every((record) => !records.uploadable(record)) && records.uploadable(sample));

// Someone deleted for good takes the records still waiting about them
net.set(false);
practice(sync, 2, LEO);
practice(sync, 1, JUNE);
await settle();
await supabase.from('people').delete().eq('id', LEO);
const juneBefore = stored().length;
net.set(true);
await settle();
assert.ok(!stored().some((row) => row.person_id === LEO), 'nothing about them reaches the server');
assert.equal(stored().length, juneBefore + 1, 'and the rest still goes');
assert.ok(!disk.has(QUEUE), 'and the queue is empty');
server.tables.people.push({ id: LEO, caregiver_id: CAREGIVER, name: 'Leo' });

// A value the server won't take yet is kept, at the back, and goes once it will
server.refuse = (row) => (row.goal === 7 ? '23514' : null);
practice(sync, 1, JUNE, 36);
practice(sync, 1, JUNE, 7);
practice(sync, 1, JUNE, 36);
await settle();
assert.equal(queued().length, 1, 'the two it takes go, the third waits on the phone');
assert.equal(queued()[0].goal, 7);
assert.ok(waits().length === 1, 'to be tried again later');
server.refuse = null;
await passWait();
assert.ok(!disk.has(QUEUE) && stored().some((row) => row.goal === 7), 'then it goes too');

// Never in the way of practice
assert.doesNotThrow(() => sync.recordCardAttempt(login, SESSION, {}, timing(), 36), 'a card it can’t read is skipped quietly');
const realFrom = supabase.from;
supabase.from = () => {
  throw new Error('the client broke');
};
assert.doesNotThrow(() => practice(sync, 1), 'a broken client never reaches the person');
await settle();
assert.equal(queued().length, 1, 'the record waits');
supabase.from = realFrom;
await passWait();
assert.ok(!disk.has(QUEUE), 'and goes once it can');

// What waits on this phone, for the caregiver's insights when they sign in on it
net.set(false);
const waiting = practice(sync, 2);
await settle();
const seen = await sync.queuedRecords(CAREGIVER);
assert.deepEqual(
  seen,
  waiting.map(({ asked, measured, goal }, index) => attemptOf(asked, measured, { id: seen[index].id, sessionId: SESSION, goal, source: 'template' })),
  'the queued records read back as the records the phone made',
);
assert.deepEqual(await (await launch()).queuedRecords(CAREGIVER), seen, 'from the disk, too, after a restart');
assert.deepEqual(await sync.queuedRecords(randomUUID()), [], 'and only that family’s');
net.set(true);
sync = await launch();
await sync.syncRecords(login, true);

// The one-time backfill: this phone's earlier records about people in the signed-in family, once
const BACKFILL = `evermore.recordBackfill.v1.${PERSON_LOGIN}`;
const day = 24 * 60 * 60 * 1000;
const earlier = (changes = {}, daysAgo = 3) => {
  const shownAt = Date.now() - daysAgo * day + Math.round(Math.random() * 60_000);
  return { ...attemptOf(card(JUNE), { ...timing(1), shownAt, selections: [{ at: shownAt + 2_000, right: true }], leftAt: shownAt + 8_000 }, { id: randomUUID(), sessionId: randomUUID(), goal: 30, source: 'template' }), ...changes };
};
const OUTSIDER = randomUUID();
const eligible = [...Array(60).keys()].map((index) => earlier({ personId: index % 2 ? JUNE : LEO }, 1 + (index % 30)));
const ineligible = [
  earlier({ personId: 'nora', cardId: 'nora-0' }),
  earlier({ personId: 'june', cardId: 'sample-june-1' }),
  earlier({ testData: true }),
  earlier({ id: 'demo-2026-11-02-4', demo: true, testData: true }),
  earlier({ personId: OUTSIDER }),
  earlier({}, 130),
];
const byMonth = new Map();
for (const record of [...eligible, ...ineligible]) {
  const month = record.shownAt.slice(0, 7);
  byMonth.set(month, [...(byMonth.get(month) ?? []), record]);
}
for (const [month, list] of byMonth) disk.set(`evermore.attempts.v1.${month}`, JSON.stringify(list));
const phoneBefore = [...disk].filter(([key]) => key.startsWith('evermore.attempts.v1.'));
const storedBefore = stored().length;
let calls = 0;
server.onInsert = () => {
  calls += 1;
  if (calls === 2) server.busy = true;
};
await sync.backfillRecords(login, [JUNE, LEO]);
assert.equal(stored().length, storedBefore + 25, 'the first batch goes, then the server is busy');
assert.ok(JSON.parse(disk.get(BACKFILL) ?? '{}').after, 'and the phone remembers how far it got');
server.busy = false;
calls = 0;
server.onInsert = () => {
  calls += 1;
  server.loseReply = calls === 1;
};
await sync.backfillRecords(login, [JUNE, LEO]);
assert.equal(stored().length, storedBefore + 50, 'the next batch reaches the server, but its reply is lost');
assert.ok(!JSON.parse(disk.get(BACKFILL) ?? '{}').done, 'so it isn’t counted yet');
server.onInsert = null;
server.loseReply = false;
await sync.backfillRecords(login, [JUNE, LEO]);
const backfilled = stored().slice(storedBefore);
assert.equal(backfilled.length, 60, 'picking up again sends the rest, and nothing twice');
assert.deepEqual(new Set(backfilled.map((row) => row.id)), new Set(eligible.map((record) => record.id)), 'exactly the records about people in the family');
assert.ok(storedOnce(), 'each once');
assert.deepEqual(JSON.parse(disk.get(BACKFILL)), { done: true }, 'and it is done');
const afterDone = uploads().length;
await (await launch()).backfillRecords(login, [JUNE, LEO]);
assert.equal(uploads().length, afterDone, 'done means done, even after a restart');
assert.deepEqual([...disk].filter(([key]) => key.startsWith('evermore.attempts.v1.')), phoneBefore, 'the phone’s own records stay exactly as they were');
for (const record of eligible) assert.deepEqual(records.fromRow(stored().find((row) => row.id === record.id)), record, 'each arrives as it was kept');

// ---------------------------------------------------------------------------------------------
// The caregiver's phone, signed in as the caregiver (src/data/insights-store.ts): the family's
// records from the server, this phone's copy, and anything still queued on it
// ---------------------------------------------------------------------------------------------
const { insightsFor } = await import('@/lib/insights');
const { calendarKey } = await import('@/lib/activity');
const { studyDayKey } = await import('@/lib/study-day');
const storeFile = pathToFileURL(`${src}data/insights-store.ts`).href;
let caregiverLives = 0;
/** The caregiver opens the app: a fresh start, with this phone's disk as it was. */
const openCaregiver = () => import(`${storeFile}?life=${++caregiverLives}`);
const CACHE = `evermore.insightsCache.v1.${CAREGIVER}`;
const cached = () => [...disk.keys()].filter((key) => key === CACHE || key.startsWith(`${CACHE}.`));
const selects = () => server.log.filter((entry) => entry.table === 'attempt_records' && entry.action === 'select');
const today = studyDayKey(new Date());
const family = (people = server.tables.people) => ({ people: people.map(({ id, name, archivedAt }) => ({ id, name, ...(archivedAt ? { archivedAt } : {}) })), cards: [], revealCards: 'sometimes', sessionLength: 'standard' });
/** What the caregiver's Insights read right now. */
const caregiverSees = (store, people = server.tables.people) => {
  const view = store.insightsState();
  return store.insightsData(view.records, view.queued, people.map(({ id }) => ({ id })), today).attempts;
};

// The person practices on their own phone: a full day with hints and re-asks, all sent
server.tables.attempt_records = [];
sync = await launch();
net.set(true);
const fullDay = [...practice(sync, 24, JUNE), ...practice(sync, 12, LEO)];
await settle();
assert.equal(stored().length, 36);
// Taken by the server over the last three hours, four minutes apart, so a later fetch can show it
// asks only for what is new (and the few minutes before the newest it had, in case one landed late)
stored().forEach((row, index) => {
  row.uploaded_at = new Date(Date.now() - 3 * 60 * 60 * 1000 + index * 4 * 60 * 1000).toISOString();
});
const phoneMade = fullDay
  .map(({ asked, measured, goal }) => {
    const row = stored().find((one) => one.card_id === asked.id);
    return attemptOf(asked, measured, { id: row.id, sessionId: SESSION, goal, source: 'template' });
  })
  .sort((a, b) => a.shownAt.localeCompare(b.shownAt));

let store = await openCaregiver();
const watching = store.subscribeInsights(() => {});
await settle();
let view = store.insightsState();
assert.ok(view.loaded && view.updatedAt && !view.loading, 'the caregiver’s phone fetches the family’s records, and says when');
assert.deepEqual(caregiverSees(store), phoneMade, 'exactly the records the person’s phone made, field for field');
assert.deepEqual(insightsFor(caregiverSees(store), family(), false, false, today), insightsFor(phoneMade, family(), false, false, today), 'so every figure, the score and the calendar come out the same as with sign-in off');
const firstFetch = selects().at(-1).calls;
assert.ok(firstFetch.includes('eq caregiver_id') && firstFetch.includes('gte shown_at') && !firstFetch.includes('gt uploaded_at'), `the first time: the whole window, for this family (${firstFetch})`);
assert.ok(cached().length >= 2, 'and a copy is kept on this phone');

// Only what is new, after that
practice(sync, 4, JUNE);
await settle();
const newFrom = selects().length;
await store.updateInsights();
const asked = selects().slice(newFrom);
assert.equal(asked.length, 1, 'one request');
assert.ok(asked[0].calls.includes('gt uploaded_at'), 'asking only for what the server took since the last fetch');
assert.equal(asked[0].rows, 4 + 2, 'which brings the four new records and the last two again, out of forty');
assert.equal(caregiverSees(store).length, 40, 'and the four new cards join');

// What Trends need besides the records is kept with them, with no facts' words
const familyNow = {
  people: server.tables.people.map(({ id, name }) => ({ id, name, includeInPractice: true, relationship: 'aunt', hints: {}, notApplicable: [] })),
  cards: [{ id: randomUUID(), personId: JUNE, status: 'approved', text: 'grows tomatoes every summer', type: 'memory' }],
  goal: 36,
  revealCards: 'sometimes',
  sessionLength: 'standard',
  person: null,
};
const activityNow = { sessions: [{ startedAt: new Date().toISOString(), completedAt: null, cardsCompleted: 12, dailyGoal: 36 }], weekCardIds: [] };
store.rememberTrends(familyNow, activityNow);
await settle();
assert.deepEqual(store.insightsState().trends.family.people.map((person) => person.name).sort(), ['June', 'Leo'], 'each person’s name, to show Trends offline');
assert.ok(!/tomatoes|aunt/.test(disk.get(CACHE)), 'but no facts’ words, and nothing more about anyone');
const unchanged = store.insightsState();
store.rememberTrends(familyNow, activityNow);
assert.equal(store.insightsState(), unchanged, 'and nothing changes or is written again when nothing changed');

// Opening Insights again offline: the copy on this phone, at once, with when it was last updated
const lastUpdated = store.insightsState().updatedAt;
server.offline = true;
store = await openCaregiver();
store.subscribeInsights(() => {});
await settle();
view = store.insightsState();
assert.ok(view.loaded && !view.loading, 'it opens from the copy');
assert.equal(view.updatedAt, lastUpdated, 'saying when it was last updated');
assert.equal(caregiverSees(store).length, 40, 'with everything it had');
assert.deepEqual(store.insightsState().trends.activity, activityNow, 'and Trends as last seen, so they open even before the family can load');
server.offline = false;

// Records still queued on this phone (the person practiced on it, offline) count, once
net.set(false);
practice(sync, 3, LEO);
await settle();
await store.updateInsights();
assert.equal(store.insightsState().queued.length, 3, 'what is still queued here is read too');
assert.equal(caregiverSees(store).length, 43, 'and joins the view');
net.set(true);
await settle();
await store.updateInsights();
assert.equal(caregiverSees(store).length, 43, 'once it reaches the server it still counts once');
assert.equal(store.insightsState().queued.length, 0, 'and nothing waits here any more');

// Someone deleted for good leaves Insights, from the copy as well as the server
const leoCount = caregiverSees(store).filter((record) => record.personId === LEO).length;
assert.ok(leoCount > 0);
await supabase.from('people').delete().eq('id', LEO);
assert.equal(caregiverSees(store).length, 43 - leoCount, 'gone from the view at once, though the copy still has them');
await store.refreshInsights();
assert.ok(!store.insightsState().records.some((record) => record.personId === LEO), 'and gone from the copy after pulling to refresh');
server.tables.people.push({ id: LEO, caregiver_id: CAREGIVER, name: 'Leo' });

// Archived people stay, for "Include archived people"
const archived = server.tables.people.map((person) => (person.id === JUNE ? { ...person, archivedAt: new Date().toISOString() } : person));
const withArchived = caregiverSees(store, archived);
assert.equal(withArchived.length, caregiverSees(store).length, 'an archived person’s records are kept');
assert.equal(insightsFor(withArchived, family(archived), false, false, today).latest, undefined, 'left out of the figures by default');
assert.ok(insightsFor(withArchived, family(archived), true, false, today).latest.cards > 0, 'and brought back when included');

// Old records go: the server isn't asked for them, and the copy drops them
const old = { ...records.fromRow(stored()[0]), id: randomUUID(), shownAt: new Date(Date.now() - 130 * 24 * 60 * 60 * 1000).toISOString() };
disk.set(`${CACHE}.${calendarKey(new Date(old.shownAt)).slice(0, 7)}`, JSON.stringify([old]));
store = await openCaregiver();
store.subscribeInsights(() => {});
await settle();
assert.ok(!caregiverSees(store).some((record) => record.id === old.id), 'a record past 120 days isn’t shown');

// A big family: more than a page of records comes in pages, every one of them once
const many = [...Array(2_500).keys()].map((index) => ({
  ...records.toRow({ ...phoneMade[index % phoneMade.length], id: randomUUID(), shownAt: new Date(Date.now() - (index % 90) * 24 * 60 * 60 * 1000 - index * 1_000).toISOString() }, login),
  uploaded_at: new Date(Date.now() - 2 * 60 * 60 * 1000 + index).toISOString(),
}));
server.tables.attempt_records.push(...many);
const pagesFrom = selects().length;
await store.refreshInsights();
const pages = selects().slice(pagesFrom).map((entry) => entry.calls.find((call) => call.startsWith('range')));
assert.deepEqual(pages, ['range 0-999', 'range 1000-1999', 'range 2000-2999'], 'in pages of a thousand');
const everything = caregiverSees(store);
assert.equal(everything.length, stored().length, 'every record arrives');
assert.equal(new Set(everything.map((record) => record.id)).size, everything.length, 'each once');

// Signing out or deleting the account here takes this phone's copy with it
assert.ok(cached().length > 0);
await store.forgetInsights();
assert.deepEqual(cached(), [], 'this phone’s copy is gone');
assert.equal(store.insightsState(), null, 'and nothing is kept in memory');
watching();

console.log('All sync checks passed');
