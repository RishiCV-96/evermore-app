// Checks archiving, restoring and deleting a person with sign-in on (src/data/family-store.ts),
// against an in-memory stand-in for Supabase (scripts/fakes/), since the live project can't be
// used for it:
//   node scripts/check-server-family.mjs
// supabase/tests/rls.test.mjs checks the same rules in the database: the person's login can't see
// an archived person, and deleting a person's row takes their facts, schedule and attempts with it.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const src = fileURLToPath(new URL('../src/', import.meta.url));
const fake = (file) => new URL(`./fakes/${file}`, import.meta.url).href;
const FAKES = {
  '@/lib/supabase': fake('supabase.mjs'),
  '@/data/account': fake('account.mjs'),
  '@/lib/photo-files': fake('native.mjs'),
  '@/lib/photo-urls': fake('native.mjs'),
  'expo-crypto': fake('native.mjs'),
  // Only profileOf is used, and the component file holds React Native views.
  '@/components/person-photo': pathToFileURL(`${src}lib/photo-fields.ts`).href,
};
registerHooks({
  resolve(specifier, context, next) {
    if (FAKES[specifier]) return next(FAKES[specifier], context);
    if (specifier.startsWith('@/')) return next(pathToFileURL(`${src}${specifier.slice(2)}.ts`).href, context);
    if (specifier.startsWith('.') && context.parentURL?.endsWith('.ts')) {
      const candidate = new URL(`${specifier}.ts`, context.parentURL);
      if (existsSync(candidate)) return next(candidate.href, context);
    }
    return next(specifier, context);
  },
});

const { server } = await import('./fakes/supabase.mjs');
const { CAREGIVER } = await import('./fakes/account.mjs');
const store = await import('@/data/family-store');

// A family on the server: three complete people in the deck, and the person's login. June has
// seven facts, all scheduled and overdue, a photo, a memory photo, and a file an earlier photo
// replacement left behind.
const DAY = 24 * 60 * 60 * 1000;
const iso = (days) => new Date(Date.now() + days * DAY).toISOString();
const PERSON_LOGIN = '00000000-0000-4000-8000-0000000000aa';
const [JUNE, LEO, MAE] = ['june', 'leo', 'mae'].map((name) => `${name}-0000-4000-8000-000000000000`);
const photoOf = (id) => `${CAREGIVER}/${id}.jpg`;
const KINDS = ['memory', 'interest', 'shared', 'work', 'food', 'music', 'team'];

function personRow(id, name, order) {
  return {
    id, caregiver_id: CAREGIVER, name, relationship: 'friend', photo_path: photoOf(id), sample_portrait: null,
    hint_letter: true, hint_fact: true, hint_relationship: true, hint_fewer: false, profile_step: 7, best_clue: 'laugh',
    not_applicable: [], in_deck: true, include_in_practice: true, reveal_ok: false, archived_at: null, created_at: `2026-01-0${order}`,
  };
}
function cardRows(personId, count) {
  return KINDS.slice(0, count).map((kind, index) => ({
    id: `${personId}-card-${index}`, caregiver_id: CAREGIVER, person_id: personId, memory_text: `${kind} words ${index}`,
    sentence: '{name} x.', status: 'approved', fact_type: kind, time_sensitive: false, as_of: null, memory_year: null,
    confirmed_at: null, source: 'caregiver', phrasings_off: index === 0 ? ['photo'] : [], hint_ok: index !== 1,
    photo_path: kind === 'shared' ? photoOf(`${personId}-card-${index}`) : null, created_at: `2026-01-01T00:0${index}`,
  }));
}
server.tables.people = [personRow(JUNE, 'June', 1), personRow(LEO, 'Leo', 2), personRow(MAE, 'Mae', 3)];
server.tables.cards = [...cardRows(JUNE, 7), ...cardRows(LEO, 3), ...cardRows(MAE, 3)];
const juneCards = server.tables.cards.filter((card) => card.person_id === JUNE).map((card) => card.id);
server.tables.card_schedule = server.tables.cards.map((card, index) => ({
  card_id: card.id, person_user_id: PERSON_LOGIN, caregiver_id: CAREGIVER, step: 1 + (index % 5), due_at: iso(-1 - (index % 7)), updated_at: iso(-8),
}));
server.tables.sessions = [{ id: 'session-1', caregiver_id: CAREGIVER, person_user_id: PERSON_LOGIN, started_at: iso(-2), completed_at: iso(-2), cards_completed: 13, daily_goal: 36 }];
server.tables.attempts = server.tables.cards.map((card) => ({ id: `attempt-${card.id}`, caregiver_id: CAREGIVER, card_id: card.id, person_user_id: PERSON_LOGIN, session_id: 'session-1', attempted_at: iso(-2) }));
server.tables.daily_goal = [{ caregiver_id: CAREGIVER, session_length: 'standard', reveal_cards: 'sometimes' }];
server.tables.profiles = [{ id: PERSON_LOGIN, role: 'person', username: 'grandma.rose', display_name: 'Rose' }];
const leftover = `${CAREGIVER}/${JUNE}-1767225600000.jpg`;
const juneFiles = [photoOf(JUNE), photoOf(`${JUNE}-card-2`), leftover];
const othersFiles = [photoOf(LEO), photoOf(`${LEO}-card-2`), photoOf(MAE), photoOf(`${MAE}-card-2`), `${CAREGIVER}/unrelated.jpg`];
server.objects = [...juneFiles, ...othersFiles];

const row = (id) => server.tables.people.find((person) => person.id === id);
const snapshot = () => structuredClone({ cards: server.tables.cards, schedule: server.tables.card_schedule, attempts: server.tables.attempts, objects: server.objects });
const removals = () => server.log.filter((entry) => entry.storage === 'remove');

await store.refreshFamily();

// Archiving: out of the deck at once, everything kept
const before = snapshot();
const juneBefore = structuredClone(row(JUNE));
await store.archivePerson(JUNE);
assert.ok(row(JUNE).archived_at, 'archiving saves when');
assert.equal(row(JUNE).in_deck, false, 'and takes them out of the deck at once');
assert.deepEqual(snapshot(), before, 'archiving keeps their facts, schedule, practice history and photos');
const { archived_at: _archivedAt, in_deck: _inDeck, ...juneKept } = row(JUNE);
const { archived_at: _wasArchived, in_deck: _wasInDeck, ...juneWas } = juneBefore;
assert.deepEqual(juneKept, juneWas, 'and every setting: hints, best clue, reveal opt-out, include in practice');
assert.equal(removals().length, 0, 'archiving deletes no photo');

// Restoring: back in the deck, as they were
await store.restorePerson(JUNE);
assert.equal(row(JUNE).archived_at, null, 'restoring clears it');
assert.equal(row(JUNE).in_deck, true, 'and the deck takes them back, since their profile is complete');
assert.deepEqual(snapshot(), before, 'with everything as it was');
await store.restorePerson(LEO);
assert.equal(server.log.filter((entry) => entry.table === 'people' && entry.action === 'update').length, 3, 'restoring someone active does nothing');

// Restoring after days away: their overdue cards come back a few a day, and nothing else moves
await store.archivePerson(JUNE);
row(JUNE).archived_at = iso(-5);
await store.refreshFamily();
const scheduleBefore = structuredClone(server.tables.card_schedule);
const restoreStart = server.log.length;
await store.restorePerson(JUNE);
// When a study day begins (05:30 local), `days` study days from today's.
const { addStudyDays, studyDayKey, studyDayStart } = await import('@/lib/study-day');
const startOfDay = (days) => studyDayStart(addStudyDays(studyDayKey(new Date()), days)).toISOString();
const juneRows = server.tables.card_schedule.filter((entry) => juneCards.includes(entry.card_id));
assert.equal(juneRows.filter((entry) => new Date(entry.due_at) <= new Date()).length, 3, 'three of their seven overdue cards are due today');
assert.equal(juneRows.filter((entry) => entry.due_at === startOfDay(1)).length, 3, 'three tomorrow');
assert.equal(juneRows.filter((entry) => entry.due_at === startOfDay(2)).length, 1, 'and the last the day after');
assert.ok(juneRows.every((entry) => entry.step === scheduleBefore.find((was) => was.card_id === entry.card_id).step), 'each keeps its step');
assert.ok(juneRows.filter((entry) => new Date(entry.due_at) > new Date()).every((entry) => entry.updated_at > iso(-1)), 'and is newer than the person’s phone’s copy, so that phone takes it');
assert.deepEqual(server.tables.card_schedule.filter((entry) => !juneCards.includes(entry.card_id)), scheduleBefore.filter((entry) => !juneCards.includes(entry.card_id)), 'nobody else’s schedule moves');
const restoring = server.log.slice(restoreStart);
assert.ok(restoring.findIndex((entry) => entry.table === 'card_schedule' && entry.action === 'upsert') < restoring.findIndex((entry) => entry.table === 'people' && entry.action === 'update'), 'the schedule moves before they are back in the deck');
assert.deepEqual([row(JUNE).archived_at, row(JUNE).in_deck], [null, true], 'and they are back');

// Deleting: only an archived person, photos first, then every row
await assert.rejects(store.deletePerson(LEO), /archived/, 'an active person cannot be deleted');
assert.ok(row(LEO) && removals().length === 0, 'and nothing of theirs is touched');

await store.archivePerson(JUNE);
const logStart = server.log.length;
await store.deletePerson(JUNE);
const deleting = server.log.slice(logStart);
const removed = deleting.find((entry) => entry.storage === 'remove');
assert.deepEqual([...removed.paths].sort(), [...juneFiles].sort(), 'every photo of theirs goes, a leftover from an earlier replacement too, and nobody else’s');
assert.ok(deleting.indexOf(removed) < deleting.findIndex((entry) => entry.table === 'people' && entry.action === 'delete'), 'photos go before the rows that point to them');
assert.equal(row(JUNE), undefined, 'their row goes');
assert.ok(!server.tables.cards.some((card) => card.person_id === JUNE), 'so do their facts');
assert.ok(!server.tables.card_schedule.some((entry) => juneCards.includes(entry.card_id)), 'their schedule');
assert.ok(!server.tables.attempts.some((attempt) => juneCards.includes(attempt.card_id)), 'and their practice rows');
assert.deepEqual(server.objects, othersFiles, 'everyone else’s photos stay');
assert.equal(server.tables.sessions.length, 1, 'past day totals stay');
assert.equal(server.tables.cards.length, 6, 'and so does everyone else');

// A photo that can't be deleted stops the delete, so nothing is left unreachable
await store.archivePerson(MAE);
server.failRemove = true;
await assert.rejects(store.deletePerson(MAE), /storage/, 'a failed photo delete is reported');
assert.ok(row(MAE) && server.tables.cards.some((card) => card.person_id === MAE), 'and the person and their facts are still there to try again');
assert.ok(server.objects.includes(photoOf(MAE)));
server.failRemove = false;
await store.deletePerson(MAE);
assert.equal(row(MAE), undefined, 'trying again works');

// Approve all with sign-in on: one write for the waiting, undated stories; Undo puts them back
{
  const leoCards = server.tables.cards.filter((card) => card.person_id === LEO);
  const [plain, dated, other] = leoCards;
  plain.status = 'pending';
  other.status = 'pending';
  Object.assign(dated, { status: 'pending', time_sensitive: true, as_of: '2026-05-01' });
  await store.refreshFamily();
  const statusOf = (id) => server.tables.cards.find((card) => card.id === id).status;
  const writesBefore = server.log.filter((entry) => entry.table === 'cards' && entry.action === 'update').length;
  // A screen could pass more ids than are eligible: the dated fact and someone else's are never approved.
  const result = await store.approveAll(LEO, { stories: [plain.id, dated.id, other.id, `${MAE}-card-0`], questions: ['ai-x'] });
  assert.equal(result.approved, 2, 'the two waiting, undated stories');
  assert.deepEqual([statusOf(plain.id), statusOf(other.id), statusOf(dated.id)], ['approved', 'approved', 'pending'], 'a fact that may change still waits for its own Confirm');
  assert.equal(server.tables.cards.find((card) => card.id === dated.id).confirmed_at, null, 'and is never confirmed');
  assert.equal(server.log.filter((entry) => entry.table === 'cards' && entry.action === 'update').length - writesBefore, 1, 'in one write');
  await store.undoApproveAll(result.undo);
  assert.deepEqual([statusOf(plain.id), statusOf(other.id), statusOf(dated.id)], ['pending', 'pending', 'pending'], 'Undo puts them back to waiting');
  await store.archivePerson(LEO);
  assert.equal((await store.approveAll(LEO, { stories: [plain.id], questions: [] })).approved, 0, 'someone archived has nothing to approve');
  assert.equal(statusOf(plain.id), 'pending');
  await store.restorePerson(LEO);
}

console.log('All server family checks passed');
