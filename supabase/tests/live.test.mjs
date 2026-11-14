// Live checks against the real Supabase project in .env, using only the publishable key,
// the way the app does. It makes clearly labelled test accounts (evermore-test-…), checks
// sign-up, the manage-family Edge Function, Row Level Security, photos and deletion, and then
// deletes every account it made. It prints PASS/FAIL lines only, never keys or tokens.
// Needs "Confirm email" turned off, so sign-up returns a session without an email.
//
//   node supabase/tests/live.test.mjs
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crc32, deflateSync } from 'node:zlib';

import { MANAGE_FAMILY_FUNCTION } from '../../src/config/functions.ts';

const env = Object.fromEntries(
  readFileSync(new URL('../../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter((line) => /^[A-Z_]+=/.test(line))
    .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1).trim()]),
);
const SUPABASE_URL = env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !KEY) {
  console.error('Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env first.');
  process.exit(1);
}

const RUN = Date.now().toString(36); // keeps this run's test accounts apart from any other
const PASSWORD = `Test-${randomUUID()}`; // random per run, never printed
const PERSON_DOMAIN = 'person.evermore.invalid';
// Test caregivers get addresses on a reserved domain that can never receive mail.
const CAREGIVER_DOMAIN = 'caregiver.evermore.invalid';
const SEED_NAMES = ['June', 'Leo', 'Ruth', 'Omar', 'Mae'];
const TABLES = ['people', 'cards', 'sessions', 'attempts', 'card_schedule', 'daily_goal', 'attempt_records'];

let failures = 0;
function check(label, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !detail ? '' : `  (${detail})`}`);
  if (!ok) failures++;
}
function section(title) {
  console.log(`\n# ${title}`);
}

const client = () =>
  createClient(SUPABASE_URL, KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });

/** Calls the Edge Function as whoever `c` is signed in as. */
async function manage(c, body) {
  const { data, error } = await c.functions.invoke(MANAGE_FAMILY_FUNCTION, { body });
  if (!error) return { status: 200, data };
  const status = error.context?.status;
  const reply = typeof error.context?.json === 'function' ? await error.context.json().catch(() => ({})) : {};
  return { status, error: reply.error ?? error.message };
}

async function signIn(email, password) {
  const c = client();
  const { error } = await c.auth.signInWithPassword({ email, password });
  return error ? null : c;
}

/** A 64×64 checkerboard PNG: an obviously fake test photo. */
function testPng(size = 64) {
  const row = size * 3 + 1;
  const raw = Buffer.alloc(row * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dark = ((x >> 3) ^ (y >> 3)) & 1;
      raw.set(dark ? [0x1d, 0x3a, 0x6e] : [0xe3, 0xea, 0xf6], y * row + 1 + x * 3);
    }
  }
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Every caregiver made, kept in a private temp file (outside the repo) until it is deleted,
// so a run that stops early is cleaned up by the next one.
const LEFTOVERS = join(tmpdir(), 'evermore-live-test-accounts.json');
const caregivers = existsSync(LEFTOVERS) ? JSON.parse(readFileSync(LEFTOVERS, 'utf8')) : [];
function remember() {
  if (caregivers.length) writeFileSync(LEFTOVERS, JSON.stringify(caregivers), { mode: 0o600 });
  else rmSync(LEFTOVERS, { force: true });
}

async function signUpCaregiver(label) {
  const c = client();
  const email = `evermore-test-${label}-${RUN}@${CAREGIVER_DOMAIN}`;
  const { data, error } = await c.auth.signUp({
    email,
    password: PASSWORD,
    options: { data: { display_name: `TEST ${label}`, policy_version: '2026-11-13', agreed_policy: true, agreed_responsibility: true, consented_at: new Date().toISOString() } },
  });
  if (error || !data.session) throw new Error(`sign-up ${label}: ${error?.message ?? 'no session; is Confirm email off?'}`);
  caregivers.push({ email, password: PASSWORD });
  remember();
  return { c, id: data.user.id, email };
}

try {
  // -------------------------------------------------------------------------------------
  section('Publishable key alone (signed out)');
  const anon = client();
  for (const table of [...TABLES, 'profiles']) {
    const { data, error } = await anon.from(table).select('caregiver_id').limit(1);
    check(`signed out reads nothing from ${table}`, !!error || data.length === 0, error?.message);
  }
  const anonCorrectness = await anon.from('attempts').select('tries, first_try_correct, hints_used').limit(1);
  check('signed out cannot read correctness columns', !!anonCorrectness.error || anonCorrectness.data.length === 0);
  const anonList = await anon.storage.from('photos').list('', { limit: 100 });
  check('signed out cannot list the photo bucket', !!anonList.error || anonList.data.length === 0, anonList.error?.message);
  const anonBuckets = await anon.storage.listBuckets();
  check('signed out cannot see the bucket list', !!anonBuckets.error || !anonBuckets.data.some((b) => b.id === 'photos'));
  const anonFunction = await manage(anon, { action: 'delete-family' });
  check('Edge Function refuses a caller with no session', anonFunction.status === 401, `${anonFunction.status} ${anonFunction.error}`);

  // -------------------------------------------------------------------------------------
  section('Caregiver sign-up');
  const noConsent = await client().auth.signUp({
    email: `evermore-test-noconsent-${RUN}@${CAREGIVER_DOMAIN}`,
    password: PASSWORD,
    options: { data: { display_name: 'TEST no consent' } },
  });
  // The database refuses it (the consent check), not the email check.
  check(
    'sign-up without consent is refused by the database',
    /database error/i.test(noConsent.error?.message ?? ''),
    noConsent.error?.message ?? 'an account was created; delete it in the dashboard',
  );
  if (!noConsent.error) caregivers.push({ email: `evermore-test-noconsent-${RUN}@${CAREGIVER_DOMAIN}`, password: PASSWORD });
  // The old consent time alone, without both agreements (since 2026-11-13), is refused too.
  const oldConsent = await client().auth.signUp({
    email: `evermore-test-oldconsent-${RUN}@${CAREGIVER_DOMAIN}`,
    password: PASSWORD,
    options: { data: { display_name: 'TEST old consent', consented_at: new Date().toISOString(), policy_version: '2026-11-13', agreed_policy: true } },
  });
  check('sign-up without the responsibility agreement is refused by the database', /database error/i.test(oldConsent.error?.message ?? ''), oldConsent.error?.message ?? 'an account was created');
  if (!oldConsent.error) caregivers.push({ email: `evermore-test-oldconsent-${RUN}@${CAREGIVER_DOMAIN}`, password: PASSWORD });

  const A = await signUpCaregiver('a');
  const B = await signUpCaregiver('b');
  check('sign-up with consent returns a session', true);
  const profileA = await A.c.from('profiles').select('role, display_name, consented_at').eq('id', A.id).single();
  check('caregiver profile made with consent time', profileA.data?.role === 'caregiver' && !!profileA.data?.consented_at, profileA.error?.message);
  const agreedA = await A.c.from('consents').select('kind, policy_version, choice').order('kind');
  check(
    'sign-up recorded both agreements and the research choice, off',
    JSON.stringify(agreedA.data?.map((row) => [row.kind, row.policy_version, row.choice])) === JSON.stringify([['policy', '2026-11-13', true], ['research', '2026-11-13', false], ['responsibility', '2026-11-13', true]]),
    agreedA.error?.message ?? JSON.stringify(agreedA.data),
  );
  const crossConsent = await B.c.from('consents').select('id').eq('caregiver_id', A.id);
  check("B reads none of A's agreements", !crossConsent.error && crossConsent.data.length === 0, crossConsent.error?.message);
  const changeConsent = await A.c.from('consents').update({ choice: true }).eq('kind', 'research').select('id');
  check('nobody changes an agreement record', !!changeConsent.error || changeConsent.data.length === 0, JSON.stringify(changeConsent.data));
  const seedPeople = await A.c.from('people').select('id, name, relationship, sample_portrait, photo_path').order('created_at');
  check(
    'new family has exactly the 5 fictional sample people',
    JSON.stringify(seedPeople.data?.map((p) => p.name).sort()) === JSON.stringify([...SEED_NAMES].sort()) &&
      seedPeople.data.every((p) => p.sample_portrait && !p.photo_path),
    seedPeople.error?.message ?? JSON.stringify(seedPeople.data?.map((p) => p.name)),
  );
  const seedCards = await A.c.from('cards').select('id, sentence, status');
  check(
    'each sample person has one approved story in the template',
    seedCards.data?.length === 5 && seedCards.data.every((c) => c.status === 'approved' && /^My [a-z]+, \{name\}, .+\.$/.test(c.sentence)),
    JSON.stringify(seedCards.data?.map((c) => c.sentence)),
  );
  const goalA = await A.c.from('daily_goal').select('goal').single();
  check('daily goal defaults to 5', goalA.data?.goal === 5, goalA.error?.message);

  // -------------------------------------------------------------------------------------
  section('Photos: private bucket, signed URLs');
  const photoPersonId = randomUUID();
  const photoPath = `${A.id}/${photoPersonId}.png`;
  // As the app uploads (src/data/family-store.ts): max-age=0, so the CDN never serves a deleted photo.
  const upload = await A.c.storage.from('photos').upload(photoPath, testPng(), { contentType: 'image/png', cacheControl: '0' });
  check('caregiver uploads a photo into their folder', !upload.error, upload.error?.message);
  const addPerson = await A.c.from('people').insert({ id: photoPersonId, caregiver_id: A.id, name: 'Testa', relationship: 'test friend', photo_path: photoPath });
  check('caregiver adds a person with that photo', !addPerson.error, addPerson.error?.message);
  const addCard = await A.c
    .from('cards')
    .insert({ caregiver_id: A.id, person_id: photoPersonId, memory_text: 'is only a test card', sentence: 'My test friend, {name}, is only a test card.' })
    .select('id')
    .single();
  check('caregiver adds a story (waiting for approval)', !addCard.error, addCard.error?.message);
  const signed = await A.c.storage.from('photos').createSignedUrl(photoPath, 3600);
  const signedFetch = signed.data ? await fetch(signed.data.signedUrl) : null;
  check(
    'a signed URL shows the photo',
    signedFetch?.status === 200 && signedFetch.headers.get('content-type')?.startsWith('image/png'),
    signed.error?.message ?? `${signedFetch?.status}`,
  );
  const publicFetch = await fetch(`${SUPABASE_URL}/storage/v1/object/public/photos/${photoPath}`);
  check('no public URL for photos', publicFetch.status !== 200, `${publicFetch.status}`);
  const anonDownload = await anon.storage.from('photos').download(photoPath);
  check('signed out cannot download the photo', !!anonDownload.error);
  const anonSign = await anon.storage.from('photos').createSignedUrl(photoPath, 60);
  check('signed out cannot sign a URL for it', !!anonSign.error);
  const anonFolder = await anon.storage.from('photos').list(A.id);
  check("signed out cannot list a family's folder", !!anonFolder.error || anonFolder.data.length === 0);

  // -------------------------------------------------------------------------------------
  section('Edge Function: the person’s login');
  const username = `test.person.${RUN}`;
  const badName = await manage(A.c, { action: 'create-person', username: 'Not Valid!', password: PASSWORD });
  check('refuses a User ID with spaces or capitals', badName.error === 'bad-username', `${badName.status} ${badName.error}`);
  const shortPassword = await manage(A.c, { action: 'create-person', username, password: 'short' });
  check('refuses a short password', shortPassword.error === 'short-password', `${shortPassword.status} ${shortPassword.error}`);
  const create = await manage(A.c, { action: 'create-person', username, password: PASSWORD, displayName: 'TEST Person' });
  check('creates the person’s login', create.status === 200, `${create.status} ${create.error}`);
  const again = await manage(A.c, { action: 'create-person', username: `${username}x`, password: PASSWORD });
  check('only one User ID login per caregiver', again.error === 'already-has-person', `${again.status} ${again.error}`);
  const taken = await manage(B.c, { action: 'create-person', username, password: PASSWORD });
  check('another caregiver cannot take the same User ID', taken.error === 'username-taken', `${taken.status} ${taken.error}`);

  const P = await signIn(`${username}@${PERSON_DOMAIN}`, PASSWORD);
  check('the person signs in with a person.evermore.invalid login', !!P);
  if (!P) throw new Error('the person could not sign in; later checks need them');
  const { data: personUser } = await P.auth.getUser();
  const personId = personUser.user.id;
  const personProfile = await P.from('profiles').select('role, caregiver_id, username, display_name').eq('id', personId).single();
  check(
    'person profile belongs to caregiver A',
    personProfile.data?.role === 'person' && personProfile.data.caregiver_id === A.id && personProfile.data.username === username,
    personProfile.error?.message,
  );
  const personCalls = await manage(P, { action: 'delete-family' });
  check('the person cannot use the Edge Function', personCalls.status === 403, `${personCalls.status} ${personCalls.error}`);

  // -------------------------------------------------------------------------------------
  section('Person: reads approved cards, writes their own practice');
  const draftCards = await P.from('cards').select('id');
  check('person sees no card while everyone is a draft', draftCards.data?.length === 0, JSON.stringify(draftCards.data?.length));
  await A.c.from('people').update({ in_deck: true }).eq('caregiver_id', A.id);
  const pCards = await P.from('cards').select('id, sentence, status');
  check('person sees only the 5 approved cards', pCards.data?.length === 5 && pCards.data.every((c) => c.status === 'approved'), JSON.stringify(pCards.data?.length));
  const pPeople = await P.from('people').select('id');
  check('person sees only people with approved stories (5)', pPeople.data?.length === 5, JSON.stringify(pPeople.data?.length));
  await A.c.from('cards').update({ status: 'approved' }).eq('id', addCard.data.id);
  const pCardsAfter = await P.from('cards').select('id');
  const pPeopleAfter = await P.from('people').select('id, photo_path');
  check('after approval the person sees the new card and person', pCardsAfter.data?.length === 6 && pPeopleAfter.data?.length === 6);
  const pSign = await P.storage.from('photos').createSignedUrl(photoPath, 600);
  check('person can show their family’s photo', !!pSign.data?.signedUrl, pSign.error?.message);
  // Archived: the person's login can't read them, their cards or their photo, then gets them back on restore.
  const archive = await A.c.from('people').update({ archived_at: new Date().toISOString(), in_deck: false }).eq('id', photoPersonId);
  check('caregiver archives a person', !archive.error, archive.error?.message);
  const pArchivedPeople = await P.from('people').select('id').eq('id', photoPersonId);
  const pArchivedCards = await P.from('cards').select('id').eq('person_id', photoPersonId);
  check('person cannot read an archived person or their cards', pArchivedPeople.data?.length === 0 && pArchivedCards.data?.length === 0);
  const pArchivedSign = await P.storage.from('photos').createSignedUrl(photoPath, 60);
  check('person cannot sign a URL for an archived person’s photo', !!pArchivedSign.error || !pArchivedSign.data?.signedUrl);
  const pArchivedList = await P.storage.from('photos').list(A.id);
  check('person cannot list it either', !!pArchivedList.error || !pArchivedList.data.some((file) => photoPath.endsWith(file.name)));
  const aArchived = await A.c.from('people').select('archived_at').eq('id', photoPersonId).single();
  check('caregiver still reads them', !!aArchived.data?.archived_at, aArchived.error?.message);
  await A.c.from('people').update({ archived_at: null, in_deck: true }).eq('id', photoPersonId);
  const pRestored = await P.from('people').select('id').eq('id', photoPersonId);
  const pRestoredSign = await P.storage.from('photos').createSignedUrl(photoPath, 60);
  check('restoring brings them and their photo back', pRestored.data?.length === 1 && !!pRestoredSign.data?.signedUrl, pRestoredSign.error?.message);
  const pUpload = await P.storage.from('photos').upload(`${A.id}/person-upload.png`, testPng(), { contentType: 'image/png' });
  check('person cannot upload photos', !!pUpload.error);
  const pGoal = await P.from('daily_goal').select('goal').maybeSingle();
  check('person reads the daily goal', pGoal.data?.goal === 5, pGoal.error?.message);

  // Exactly the calls the app's outbox makes (src/data/practice-store.ts).
  const sessionId = randomUUID();
  const now = new Date().toISOString();
  const sessionRow = { id: sessionId, caregiver_id: A.id, person_user_id: personId, started_at: now, completed_at: null, cards_completed: 0, daily_goal: 5 };
  const s1 = await P.from('sessions').upsert(sessionRow);
  check('person saves a session', !s1.error, s1.error?.message);
  const cardId = pCards.data[0].id;
  const attemptId = randomUUID();
  const attemptRow = { id: attemptId, caregiver_id: A.id, card_id: cardId, person_user_id: personId, session_id: sessionId, attempted_at: now, tries: 2, first_try_correct: false, hints_used: 1 };
  const a1 = await P.from('attempts').upsert(attemptRow, { ignoreDuplicates: true });
  check('person saves an attempt without reading correctness columns', !a1.error, a1.error?.message);
  const a2 = await P.from('attempts').upsert(attemptRow, { ignoreDuplicates: true });
  check('re-sending the same attempt is harmless', !a2.error, a2.error?.message);
  const sched = await P.from('card_schedule').upsert({ card_id: cardId, person_user_id: personId, caregiver_id: A.id, step: 0, due_at: now, updated_at: now });
  check('person saves a schedule row', !sched.error, sched.error?.message);
  const s2 = await P.from('sessions').upsert({ ...sessionRow, cards_completed: 1, completed_at: new Date().toISOString() });
  check('person updates the session when re-sent', !s2.error, s2.error?.message);
  const aSees = await A.c.from('attempts').select('id, card_id').eq('id', attemptId);
  check('caregiver sees that the card was practiced', aSees.data?.length === 1, aSees.error?.message);
  for (const column of ['tries', 'first_try_correct', 'hints_used', '*']) {
    const asCaregiver = await A.c.from('attempts').select(column).limit(1);
    const asPerson = await P.from('attempts').select(column).limit(1);
    check(`neither caregiver nor person can read attempts.${column}`, !!asCaregiver.error && !!asPerson.error);
  }
  const pConsents = await P.from('consents').select('id');
  check("the person's login reads none of the caregiver's agreements", !!pConsents.error || pConsents.data.length === 0, JSON.stringify(pConsents.data));
  const pAgrees = await P.from('consents').insert({ caregiver_id: A.id, kind: 'research', policy_version: '2026-11-13', choice: true });
  check("nor adds one in the caregiver's name", !!pAgrees.error);
  const pSample = await P.from('sessions').insert({ ...sessionRow, id: randomUUID(), is_sample: true });
  check('person cannot write sample activity', !!pSample.error);
  const pOther = await P.from('sessions').insert({ ...sessionRow, id: randomUUID(), caregiver_id: B.id });
  check("person cannot write into another family", !!pOther.error);
  const pEdit = await P.from('cards').update({ status: 'skipped' }).eq('id', cardId).select('id');
  check('person cannot change cards', (pEdit.data ?? []).length === 0);
  const pRole = await P.from('profiles').update({ role: 'caregiver' }).eq('id', personId);
  check('person cannot change their role', !!pRole.error);
  const aRole = await A.c.from('profiles').update({ role: 'person' }).eq('id', A.id);
  check('caregiver cannot change their role', !!aRole.error);

  // -------------------------------------------------------------------------------------
  section('Card records for insights: the person writes them, only the caregiver reads them');
  // Exactly the upload the person's phone makes (src/data/attempt-sync.ts): a plain insert, with
  // nothing read back, since the person's login can't read records.
  const shownAt = new Date(Date.now() - 60_000).toISOString();
  const recordRow = (changes = {}) => ({
    id: randomUUID(), caregiver_id: A.id, person_user_id: personId, person_id: pPeopleAfter.data[0].id, card_id: cardId,
    phrasing_id: 'who', shape: 'who', fact_type: 'memory', source: 'template', session_id: sessionId, shown_at: shownAt,
    selected_at: [shownAt, shownAt], selected_right: [false, true], choices: 3, hints: ['letter'], success: true,
    active_ms: 9000, first_selection_ms: 3000, goal: 5, extra: false, ...changes,
  });
  const records = [recordRow(), recordRow({ success: false, selected_at: [], selected_right: [], hints: [], first_selection_ms: null })];
  const r1 = await P.from('attempt_records').insert(records);
  check('person uploads card records', !r1.error, r1.error?.message);
  const r2 = await P.from('attempt_records').insert(records.slice(0, 1));
  check('sending one again is refused as a duplicate, which the app counts as sent', r2.error?.code === '23505', r2.error?.code);
  const pRecords = await P.from('attempt_records').select('id');
  check('person reads no card record, not even their own', !pRecords.error && pRecords.data.length === 0, pRecords.error?.message);
  const pRecordEdit = await P.from('attempt_records').update({ success: false }).eq('id', records[0].id);
  check('person cannot change a record', !!pRecordEdit.error);
  const pRecordDelete = await P.from('attempt_records').delete().eq('id', records[0].id).select('id');
  check('person cannot delete a record', (pRecordDelete.data ?? []).length === 0);
  const pRecordOther = await P.from('attempt_records').insert(recordRow({ caregiver_id: B.id }));
  check('person cannot write a record into another family', !!pRecordOther.error);
  const pRecordWords = await P.from('attempt_records').insert(recordRow({ phrasing_id: 'Grandma loves tea' }));
  check('a record cannot carry words', !!pRecordWords.error);
  const aRecords = await A.c.from('attempt_records').select('id, selected_right, hints, uploaded_at').in('id', records.map((record) => record.id));
  check('caregiver reads the family’s records', aRecords.data?.length === 2 && aRecords.data.every((record) => record.uploaded_at), aRecords.error?.message);
  const aRecordWrite = await A.c.from('attempt_records').insert(recordRow());
  check('caregiver cannot write a record', !!aRecordWrite.error);
  const passing = await A.c.from('people').insert({ caregiver_id: A.id, name: 'TEST passing', relationship: 'friend' }).select('id').single();
  const pRecordPassing = await P.from('attempt_records').insert(recordRow({ person_id: passing.data?.id }));
  check('person writes a record about someone not in the deck', !pRecordPassing.error, pRecordPassing.error?.message);
  await A.c.from('people').update({ archived_at: new Date().toISOString() }).eq('id', passing.data?.id);
  const keptArchived = await A.c.from('attempt_records').select('id').eq('person_id', passing.data?.id);
  check('archiving them keeps their record', keptArchived.data?.length === 1, keptArchived.error?.message);
  await A.c.from('people').delete().eq('id', passing.data?.id);
  const goneRecords = await A.c.from('attempt_records').select('id').eq('person_id', passing.data?.id);
  check('deleting them for good deletes their records', goneRecords.data?.length === 0, goneRecords.error?.message);

  // -------------------------------------------------------------------------------------
  section('A second caregiver cannot see or change the first family');
  for (const table of TABLES) {
    const all = await B.c.from(table).select('caregiver_id');
    check(`B reads only B's ${table}`, !all.error && all.data.every((row) => row.caregiver_id === B.id), all.error?.message);
    const theirs = await B.c.from(table).select('caregiver_id').eq('caregiver_id', A.id);
    check(`B reads none of A's ${table}`, !theirs.error && theirs.data.length === 0, theirs.error?.message);
  }
  const bProfiles = await B.c.from('profiles').select('id').in('id', [A.id, personId]);
  check("B cannot read A's or A's person's profile", bProfiles.data?.length === 0);
  const bList = await B.c.storage.from('photos').list(A.id);
  check("B cannot list A's photos", !!bList.error || bList.data.length === 0);
  const bSign = await B.c.storage.from('photos').createSignedUrl(photoPath, 60);
  check("B cannot sign a URL for A's photo", !!bSign.error);
  const bDownload = await B.c.storage.from('photos').download(photoPath);
  check("B cannot download A's photo", !!bDownload.error);
  const bUpload = await B.c.storage.from('photos').upload(`${A.id}/intruder.png`, testPng(), { contentType: 'image/png' });
  check("B cannot upload into A's folder", !!bUpload.error);
  await B.c.storage.from('photos').remove([photoPath]);
  const stillThere = await A.c.storage.from('photos').download(photoPath);
  check("B cannot delete A's photo", !stillThere.error);
  const bEdit = await B.c.from('cards').update({ status: 'skipped' }).eq('caregiver_id', A.id).select('id');
  const bDelete = await B.c.from('people').delete().eq('caregiver_id', A.id).select('id');
  const aCount = await A.c.from('people').select('id');
  check("B cannot change or delete A's rows", (bEdit.data ?? []).length === 0 && (bDelete.data ?? []).length === 0 && aCount.data?.length === 6);
  const bInsert = await B.c.from('people').insert({ caregiver_id: A.id, name: 'Intruder' });
  check("B cannot add a person to A's family", !!bInsert.error);
  const bSession = await B.c.from('sessions').insert({ ...sessionRow, id: randomUUID() });
  check("B cannot write sessions for A's person", !!bSession.error);
  const bReset = await manage(B.c, { action: 'reset-person', username, password: PASSWORD });
  check("B cannot reset A's person's login", bReset.error === 'no-person', `${bReset.status} ${bReset.error}`);

  // -------------------------------------------------------------------------------------
  section('Dashboard sample data (development button)');
  const sampleId = randomUUID();
  const sampleSession = await A.c.from('sessions').insert({ ...sessionRow, id: sampleId, person_user_id: personId, is_sample: true, cards_completed: 3 });
  const sampleAttempt = await A.c.from('attempts').insert({ ...attemptRow, id: randomUUID(), session_id: sampleId, tries: 1, first_try_correct: true, hints_used: 0 });
  check('caregiver writes sample sessions and attempts', !sampleSession.error && !sampleAttempt.error, (sampleSession.error ?? sampleAttempt.error)?.message);
  const clear = await A.c.from('sessions').delete().eq('is_sample', true);
  const leftover = await A.c.from('attempts').select('id').eq('session_id', sampleId);
  check('clearing sample sessions removes their attempts', !clear.error && leftover.data?.length === 0);

  // -------------------------------------------------------------------------------------
  section('Reset the person’s login');
  const newUsername = `test.person2.${RUN}`;
  const newPassword = `${PASSWORD}-2`;
  const reset = await manage(A.c, { action: 'reset-person', username: newUsername, password: newPassword });
  check('caregiver resets the login with a new User ID', reset.status === 200, `${reset.status} ${reset.error}`);
  check('the old password stops working', !(await signIn(`${username}@${PERSON_DOMAIN}`, PASSWORD)));
  const P2 = await signIn(`${newUsername}@${PERSON_DOMAIN}`, newPassword);
  check('the new User ID and password work', !!P2);
  const oldSession = await P.auth.refreshSession();
  console.log(`INFO  after a reset, the person's existing session ${oldSession.error ? 'ends' : 'keeps working'}`);

  // -------------------------------------------------------------------------------------
  section('Delete account removes every row, photo and login');
  const before = {
    people: (await A.c.from('people').select('id')).data.map((r) => r.id),
    cards: (await A.c.from('cards').select('id')).data.map((r) => r.id),
    sessions: (await A.c.from('sessions').select('id')).data.map((r) => r.id),
    attempts: (await A.c.from('attempts').select('id')).data.map((r) => r.id),
  };
  const photoUrl = (await A.c.storage.from('photos').createSignedUrl(photoPath, 3600)).data.signedUrl;
  // A second link, a few seconds newer (so a different token and CDN entry), opened before
  // deletion: shows whether the CDN still serves an already-opened link afterwards.
  await new Promise((resolve) => setTimeout(resolve, 2100));
  const openedUrl = (await A.c.storage.from('photos').createSignedUrl(photoPath, 3600)).data.signedUrl;
  await fetch(openedUrl);
  const remove = await manage(A.c, { action: 'delete-family' });
  check('caregiver deletes the family', remove.status === 200, `${remove.status} ${remove.error}`);
  check('the caregiver login is gone', !(await signIn(A.email, PASSWORD)));
  check('the person login is gone', !(await signIn(`${newUsername}@${PERSON_DOMAIN}`, newPassword)));
  const photoAfter = await fetch(photoUrl);
  check('the photo file is gone (its signed URL now fails)', photoAfter.status !== 200, `${photoAfter.status}`);
  const openedAfter = await fetch(openedUrl);
  console.log(`INFO  a link opened before deletion now gets ${openedAfter.status} (${openedAfter.headers.get('cf-cache-status')})`);

  // Rows can't be read across families, but their ids can be reused only if they're gone:
  // B writes rows with A's old ids, and each insert succeeds only if A's row was deleted.
  const bPeople = (await B.c.from('people').select('id').limit(1)).data;
  const bSessionId = randomUUID();
  await B.c.from('sessions').insert({ id: bSessionId, caregiver_id: B.id, started_at: now, daily_goal: 5, is_sample: true });
  const reuse = {
    people: await B.c.from('people').insert(before.people.map((id) => ({ id, caregiver_id: B.id, name: 'TEST reuse' }))),
    cards: await B.c.from('cards').insert(before.cards.map((id) => ({ id, caregiver_id: B.id, person_id: bPeople[0].id, memory_text: 'x', sentence: '{name} x.' }))),
    sessions: await B.c.from('sessions').insert(before.sessions.map((id) => ({ id, caregiver_id: B.id, started_at: now, daily_goal: 5, is_sample: true }))),
  };
  const bCard = (await B.c.from('cards').select('id').limit(1)).data[0].id;
  reuse.attempts = await B.c.from('attempts').insert(
    before.attempts.map((id) => ({ id, caregiver_id: B.id, card_id: bCard, session_id: bSessionId, attempted_at: now, tries: 1, first_try_correct: true, hints_used: 0 })),
  );
  for (const [table, result] of Object.entries(reuse)) {
    check(`all of A's ${table} rows are gone (${before[table].length})`, !result.error, result.error?.message);
  }
  const usernameFree = await manage(B.c, { action: 'create-person', username: newUsername, password: PASSWORD });
  check("A's person profile is gone (its User ID is free again)", usernameFree.status === 200, `${usernameFree.status} ${usernameFree.error}`);
} catch (error) {
  failures++;
  console.log(`FAIL  stopped early: ${error.message}`);
} finally {
  // -------------------------------------------------------------------------------------
  section('Clean-up');
  for (const account of [...caregivers]) {
    const label = account.email.replace(/-[a-z0-9]+@/, '-…@');
    const c = await signIn(account.email, account.password);
    const result = c ? await manage(c, { action: 'delete-family' }) : null;
    if (!c || result.status === 200) {
      caregivers.splice(caregivers.indexOf(account), 1);
      console.log(`PASS  test account ${label} ${c ? 'deleted' : 'already gone'}`);
    } else {
      check(`deleted test account ${label}`, false, `${result.status} ${result.error}`);
    }
  }
  remember();
  console.log(failures ? `\n${failures} failed` : '\nAll live checks passed');
  process.exit(failures ? 1 : 0);
}
