// Runs supabase/schema.sql in PGlite (Postgres in WebAssembly) and checks the Row Level
// Security rules, above all that one caregiver can never read or change another family's
// data. Small stand-ins replace Supabase's auth and storage schemas, so this checks our SQL,
// not Supabase itself; supabase/tests/rls-check.sql repeats the key checks on the real project.
//
//   node supabase/tests/rls.test.mjs
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

import { SUPABASE_STANDIN } from './standin.mjs';

const schema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');

const db = new PGlite();
await db.exec(SUPABASE_STANDIN);
await db.exec(schema);

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const P = '00000000-0000-4000-8000-0000000000aa'; // A's person
const S = '00000000-0000-4000-8000-0000000000f1'; // a session id
const consent = JSON.stringify({ policy_version: '2026-11-13', agreed_policy: true, agreed_responsibility: true, consented_at: new Date().toISOString(), display_name: 'Pat' });

await db.query(`insert into auth.users (id, raw_user_meta_data) values ($1, $3), ($2, $3)`, [A, B, consent]);
// What the manage-family Edge Function does: a login with no profile, then the profile.
await db.query(`insert into auth.users (id, raw_user_meta_data) values ($1, '{"evermore_person": true}')`, [P]);
check('a person login gets no profile from the trigger', (await db.query(`select 1 from public.profiles where id = $1`, [P])).rows.length === 0);
await db.query(`insert into public.profiles (id, role, display_name, caregiver_id, username) values ($1, 'person', 'Rose', $2, 'grandma.rose')`, [P, A]);
await db.exec(`insert into storage.objects (bucket_id, name) values ('photos', '${A}/a.jpg'), ('photos', '${B}/b.jpg')`);

let failures = 0;
function check(label, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  ${detail}`}`);
  if (!ok) failures++;
}

// Postgres has no IF NOT EXISTS for these, so the file would stop there in the SQL Editor:
// create policy, trigger, constraint trigger, type, rule, domain or publication, and add constraint.
// (create table, create index and add column if not exists are fine.) The rerunnable form is
// drop ... if exists, then create, or a do $$ ... $$ block. Comments are ignored.
const NO_IF_NOT_EXISTS = /\b(?:create\s+(?:or\s+replace\s+)?(?:constraint\s+)?(?:policy|trigger|type|rule|domain|publication)|add\s+constraint)\s+if\s+not\s+exists\b/i;
function unsupportedIfNotExists(sql) {
  return sql
    .split('\n')
    .map((line, index) => [index + 1, line.replace(/--.*$/, '')])
    .filter(([, line]) => NO_IF_NOT_EXISTS.test(line))
    .map(([number]) => number);
}
check('schema.sql uses no IF NOT EXISTS that Postgres lacks (create policy, trigger, type …)', unsupportedIfNotExists(schema).length === 0, `lines ${unsupportedIfNotExists(schema).join(', ')}`);
check(
  'the check fails on a planted create policy, trigger or type if not exists, and ignores comments',
  unsupportedIfNotExists(`${schema}\ncreate policy if not exists "x" on public.people for select using (true);`).length === 1 &&
    unsupportedIfNotExists('create trigger if not exists t before insert on t for each row execute function f();').length === 1 &&
    unsupportedIfNotExists("create type if not exists mood as enum ('calm');").length === 1 &&
    unsupportedIfNotExists('alter table t add constraint if not exists c check (true);').length === 1 &&
    unsupportedIfNotExists('-- create policy if not exists in a comment\ncreate table if not exists t (id int);\nalter table t add column if not exists x int;').length === 0,
);

/** Runs sql as a signed-in user (RLS applies) and returns rows, or the error message. */
async function as(user, sql, params = [], on = db) {
  await on.exec('begin');
  try {
    await on.exec(`set local role authenticated`);
    await on.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: user })]);
    // exec runs several statements; query takes parameters.
    const result = params.length ? await on.query(sql, params) : (await on.exec(sql)).at(-1);
    return { rows: result.rows, affected: result.affectedRows };
  } catch (error) {
    return { error: error.message };
  } finally {
    await on.exec('rollback');
  }
}
const count = async (user, table, on = db) => (await as(user, `select count(*)::int as n from ${table}`, [], on)).rows?.[0].n;

// The AI limits: only the generate-questions function reaches them
const asService = async (sql, params = []) => {
  await db.exec('begin');
  try {
    await db.exec('set local role service_role');
    return await db.query(sql, params);
  } finally {
    await db.exec('commit');
  }
};
const hashOf = (char) => char.repeat(64);
const take = async (char) => (await asService(`select public.ai_take_request($1) as answer`, [hashOf(char)])).rows[0].answer;
for (const table of ['ai_settings', 'ai_usage_installs', 'ai_usage_days']) {
  const anonRead = await db.exec('begin').then(() => db.exec('set local role anon')).then(() => db.query(`select * from public.${table}`)).then(() => 'read', (error) => error.message).finally(() => db.exec('rollback'));
  check(`signed-out visitors cannot read ${table}`, anonRead !== 'read', anonRead);
  check(`a signed-in user cannot read ${table}`, !!(await as(A, `select * from public.${table}`)).error);
  check(`a signed-in user cannot change ${table}`, !!(await as(A, `delete from public.${table}`)).error);
}
check('the app cannot take a request itself', !!(await as(A, `select public.ai_take_request($1)`, [hashOf('a')])).error);
check('nor can signed-out visitors', await db.exec('begin').then(() => db.exec('set local role anon')).then(() => db.query(`select public.ai_take_request($1)`, [hashOf('a')])).then(() => false, () => true).finally(() => db.exec('rollback')));
check('AI is off until someone turns it on', (await take('a')) === 'off');
check('and being off counts nothing', (await db.query(`select count(*)::int as n from public.ai_usage_days`)).rows[0].n === 0);
check('the daily cap starts at 20, for testing', (await db.query(`select global_day from public.ai_settings`)).rows[0].global_day === 20);
await db.exec(`update public.ai_settings set enabled = true, per_install_hour = 3, per_install_day = 4, global_day = 6`);
check('turned on, a request goes through', (await take('a')) === 'ok');
check('only a well-formed hash is taken', (await asService(`select public.ai_take_request($1) as answer`, ['raw-token'])).rows[0].answer === 'off');
await take('a');
await take('a');
check('the hourly limit stops an install', (await take('a')) === 'hour');
check('a refused request is not counted', (await db.query(`select requests from public.ai_usage_installs where token_hash = $1`, [hashOf('a')])).rows[0].requests === 3);
check('another install still gets through', (await take('b')) === 'ok');
await db.query(`update public.ai_usage_installs set hour_start = date_trunc('hour', now()) - interval '1 hour', requests = 4 where token_hash = $1 and date_trunc('day', now() at time zone 'utc') <= (date_trunc('hour', now()) - interval '1 hour') at time zone 'utc'`, [hashOf('a')]);
const movedWithinDay = (await db.query(`select requests from public.ai_usage_installs where token_hash = $1`, [hashOf('a')])).rows[0].requests === 4;
if (!movedWithinDay) await db.query(`update public.ai_usage_installs set requests = 4 where token_hash = $1`, [hashOf('a')]);
await db.exec(`update public.ai_settings set per_install_hour = 10`);
check('the daily limit stops an install', (await take('a')) === 'day');
await db.exec(`update public.ai_settings set per_install_day = 100`);
await take('c');
await take('c');
await take('c');
check('the global cap stops everyone, whatever their own count', (await take('d')) === 'global' && (await take('e')) === 'global');
await db.exec(`update public.ai_settings set enabled = false`);
check('the kill switch stops everything at once', (await take('f')) === 'off');
await db.exec(`update public.ai_settings set enabled = true, global_day = 1000, per_install_day = 1000`);
await db.query(`insert into public.ai_usage_installs (token_hash, hour_start, requests) values ($1, now() - interval '3 days', 2)`, [hashOf('9')]);
await db.exec(`insert into public.ai_usage_days (day, requests) values (current_date - 30, 2)`);
await take('f');
check('old counters go by themselves', (await db.query(`select count(*)::int as n from public.ai_usage_installs where token_hash = $1`, [hashOf('9')])).rows[0].n === 0 && (await db.query(`select count(*)::int as n from public.ai_usage_days where day < current_date - 7`)).rows[0].n === 0);
const usageColumns = (await db.query(`select table_name, column_name from information_schema.columns where table_schema = 'public' and table_name like 'ai_usage%' order by 1, 2`)).rows.map((row) => row.column_name);
check('the counters hold no content: a hash, a time and a count', usageColumns.join() === 'day,requests,hour_start,requests,token_hash', usageColumns.join());
await db.exec(`delete from public.ai_usage_installs; delete from public.ai_usage_days; update public.ai_settings set enabled = false, per_install_hour = 5, per_install_day = 20, global_day = 100`);

// Seeding
const seeded = await db.query(`select caregiver_id, count(*)::int as n from public.people group by 1 order by 1`);
check('each new caregiver gets 5 fictional sample people', seeded.rows.length === 2 && seeded.rows.every((r) => r.n === 5));
const noConsent = await db
  .query(`insert into auth.users (id) values ('00000000-0000-4000-8000-0000000000cc')`)
  .then(() => 'created', (error) => error.message);
check('a caregiver cannot be created without consent', noConsent !== 'created', noConsent);

// Agreements (2026-11-13): versioned records, the caregiver's own, never changed; no account without both
const VERSION = '2026-11-13';
const signUp = (id, data) => db.query(`insert into auth.users (id, raw_user_meta_data) values ($1, $2)`, [id, JSON.stringify(data)]).then(() => 'created', (error) => error.message);
const onlyTime = await signUp('00000000-0000-4000-8000-0000000000c1', { consented_at: new Date().toISOString() });
check('the old consent time alone makes no account', onlyTime !== 'created', onlyTime);
const onlyPolicy = await signUp('00000000-0000-4000-8000-0000000000c2', { consented_at: new Date().toISOString(), policy_version: VERSION, agreed_policy: true });
check('nor the policy without the responsibility agreement', onlyPolicy !== 'created', onlyPolicy);
const onlyResponsibility = await signUp('00000000-0000-4000-8000-0000000000c3', { consented_at: new Date().toISOString(), policy_version: VERSION, agreed_responsibility: true });
check('nor the responsibility agreement without the policy', onlyResponsibility !== 'created', onlyResponsibility);
const noVersion = await signUp('00000000-0000-4000-8000-0000000000c4', { consented_at: new Date().toISOString(), agreed_policy: true, agreed_responsibility: true });
check('nor both without a policy version', noVersion !== 'created', noVersion);
const asStrings = await signUp('00000000-0000-4000-8000-0000000000c5', { consented_at: new Date().toISOString(), policy_version: VERSION, agreed_policy: 'yes', agreed_responsibility: 'yes' });
check('nor anything but true', asStrings !== 'created', asStrings);
check('a refused sign-up leaves no login, profile or record behind', (await db.query(`select (select count(*)::int from auth.users where id::text like '00000000-0000-4000-8000-0000000000c%') + (select count(*)::int from public.profiles where id::text like '00000000-0000-4000-8000-0000000000c%') + (select count(*)::int from public.consents where caregiver_id::text like '00000000-0000-4000-8000-0000000000c%') as n`)).rows[0].n === 0);
const agreedA = (await as(A, `select kind, policy_version, choice, caregiver_id from public.consents order by kind`)).rows;
check(
  'sign-up recorded the policy, the responsibility agreement and the research choice, off by default',
  JSON.stringify(agreedA.map((row) => [row.kind, row.policy_version, row.choice])) === JSON.stringify([['policy', VERSION, true], ['research', VERSION, false], ['responsibility', VERSION, true]]) && agreedA.every((row) => row.caregiver_id === A),
  JSON.stringify(agreedA),
);
const R = '00000000-0000-4000-8000-0000c0e5e7c9';
check('research on at sign-up is recorded as on', (await signUp(R, { consented_at: new Date().toISOString(), policy_version: VERSION, agreed_policy: true, agreed_responsibility: true, research: true })) === 'created' && (await as(R, `select choice from public.consents where kind = 'research'`)).rows[0]?.choice === true);
check('the record times are the server’s', (await db.query(`select bool_and(agreed_at > now() - interval '1 minute') as fresh from public.consents where caregiver_id = $1`, [A])).rows[0].fresh === true);
check("B reads only B's agreements", (await as(B, `select caregiver_id from public.consents`)).rows.every((row) => row.caregiver_id === B) && (await count(B, 'public.consents')) === 3);
check("B reads none of A's, even naming A", (await as(B, `select id from public.consents where caregiver_id = $1`, [A])).rows.length === 0);
check("B cannot add an agreement in A's name", !!(await as(B, `insert into public.consents (caregiver_id, kind, policy_version, choice) values ($1, 'research', $2, true)`, [A, VERSION])).error);
check("the person's login reads no agreement", (await count(P, 'public.consents')) === 0);
check("nor adds one in the caregiver's name", !!(await as(P, `insert into public.consents (caregiver_id, kind, policy_version, choice) values ($1, 'policy', $2, true)`, [A, VERSION])).error);
check('signed-out visitors read none', await db.exec('begin').then(() => db.exec('set local role anon')).then(() => db.query('select * from public.consents')).then(() => false, () => true).finally(() => db.exec('rollback')));
check('A adds agreements to a new version', !(await as(A, `insert into public.consents (caregiver_id, kind, policy_version, choice) values ($1, 'policy', '2027-01-01', true), ($1, 'responsibility', '2027-01-01', true)`, [A])).error);
check('and changes the research choice, as a new record', !(await as(A, `insert into public.consents (caregiver_id, kind, policy_version, choice) values ($1, 'research', $2, true)`, [A, VERSION])).error);
check('an agreement is only recorded as given', !!(await as(A, `insert into public.consents (caregiver_id, kind, policy_version, choice) values ($1, 'policy', $2, false)`, [A, VERSION])).error);
check('only known kinds and versions', !!(await as(A, `insert into public.consents (caregiver_id, kind, policy_version, choice) values ($1, 'marketing', $2, true)`, [A, VERSION])).error && !!(await as(A, `insert into public.consents (caregiver_id, kind, policy_version, choice) values ($1, 'policy', 'v2', true)`, [A])).error);
check('nobody sets the time', !!(await as(A, `insert into public.consents (caregiver_id, kind, policy_version, choice, agreed_at) values ($1, 'research', $2, true, '2020-01-01')`, [A, VERSION])).error);
const editAgreement = await as(A, `update public.consents set choice = true where caregiver_id = $1`, [A]);
check('nobody changes an agreement', !!editAgreement.error || editAgreement.affected === 0, JSON.stringify(editAgreement));
const removeAgreement = await as(A, `delete from public.consents where caregiver_id = $1`, [A]);
check('or removes one', !!removeAgreement.error || removeAgreement.affected === 0, JSON.stringify(removeAgreement));
await db.query(`insert into public.consents (caregiver_id, kind, policy_version, choice) values ($1, 'research', $2, true)`, [A, VERSION]);
check('every research change is kept, newest last', JSON.stringify((await db.query(`select choice from public.consents where caregiver_id = $1 and kind = 'research' order by agreed_at, id`, [A])).rows.map((row) => row.choice)).startsWith('[false'));
const agreementColumns = (await db.query(`select column_name from information_schema.columns where table_schema = 'public' and table_name = 'consents' order by 1`)).rows.map((row) => row.column_name);
check('a record holds a kind, a version, a choice and a time: no words, email or device', agreementColumns.join() === 'agreed_at,caregiver_id,choice,id,kind,policy_version', agreementColumns.join());
await db.query(`delete from public.consents where caregiver_id = $1 and policy_version <> $2`, [A, VERSION]);
await db.query(`delete from public.consents where caregiver_id = $1 and kind = 'research' and choice`, [A]);

// Caregiver B cannot see or touch caregiver A's family
for (const table of ['people', 'cards', 'sessions', 'attempts', 'card_schedule', 'daily_goal']) {
  const rows = await as(B, `select caregiver_id from public.${table}`);
  check(`B reads only B's ${table}`, !rows.error && rows.rows.every((r) => r.caregiver_id === B), rows.error);
}
check("B cannot read A's profile or A's person", (await as(B, `select id from public.profiles where id in ($1, $2)`, [A, P])).rows.length === 0);
const bIntoA = await as(B, `insert into public.people (caregiver_id, name) values ($1, 'Intruder')`, [A]);
check("B cannot add a person to A's family", !!bIntoA.error, 'insert succeeded');
const aPerson = (await db.query(`select id from public.people where caregiver_id = $1 limit 1`, [A])).rows[0].id;
const crossCard = await as(B, `insert into public.cards (caregiver_id, person_id, memory_text, sentence) values ($1, $2, 'x', 'My x, {name}, x.')`, [B, aPerson]);
check("B cannot attach a card to A's person", !!crossCard.error, 'insert succeeded');
const bEdits = await as(B, `update public.cards set status = 'skipped' where caregiver_id = $1`, [A]);
check("B cannot change A's cards", bEdits.affected === 0, JSON.stringify(bEdits));
const bDeletes = await as(B, `delete from public.people where caregiver_id = $1`, [A]);
check("B cannot delete A's people", bDeletes.affected === 0, JSON.stringify(bDeletes));
check("B cannot see A's photos", (await as(B, `select name from storage.objects where name like $1`, [`${A}/%`])).rows.length === 0);
check("B cannot upload into A's folder", !!(await as(B, `insert into storage.objects (bucket_id, name) values ('photos', $1)`, [`${A}/x.jpg`])).error);
check('anon reads nothing', !!(await db.exec('begin').then(() => db.exec('set local role anon')).then(() => db.query('select * from public.people')).then(() => null, (e) => e.message).finally(() => db.exec('rollback'))));

// The 100% gate: a draft never reaches the person, however approved their cards are
check('every new person starts as a draft', (await db.query(`select bool_and(not in_deck and not_applicable = '{}') as drafts from public.people`)).rows[0].drafts === true);
check('person reads no card of a draft', (await count(P, 'public.cards')) === 0);
check('person reads no draft', (await count(P, 'public.people')) === 0);
check('person cannot put a draft in the deck', (await as(P, `update public.people set in_deck = true`)).affected === 0);
const deckFirst = (await db.query(`select id from public.people where caregiver_id = $1 order by created_at limit 1`, [A])).rows[0].id;
check('caregiver can add a person to the deck', !(await as(A, `update public.people set in_deck = true where id = $1`, [deckFirst])).error);
await db.query(`update public.people set in_deck = true where id = $1`, [deckFirst]);
check('person then reads that person and their card', (await count(P, 'public.cards')) === 1 && (await count(P, 'public.people')) === 1);
check("B cannot change A's deck", (await as(B, `update public.people set in_deck = false where id = $1`, [deckFirst])).affected === 0);
check('caregiver can mark what does not apply', !(await as(A, `update public.people set not_applicable = '{photo}' where id = $1`, [deckFirst])).error);
const deckRule = (await as(P, `select public.person_in_deck($1) as yes`, [deckFirst])).rows?.[0]?.yes;
check('the deck check works for the person', deckRule === true, String(deckRule));
check('signed-out visitors cannot call the deck check', await db.exec('begin').then(() => db.exec('set local role anon')).then(() => db.query(`select public.person_in_deck($1)`, [deckFirst])).then(() => false, () => true).finally(() => db.exec('rollback')));
// The day's target is worked out from the deck, and the session length is the caregiver's
check('a new family starts on Standard', (await db.query(`select bool_and(session_length = 'standard') as yes from public.daily_goal`)).rows[0].yes === true);
check('caregiver can change the session length', !(await as(A, `update public.daily_goal set session_length = 'long' where caregiver_id = $1`, [A])).error);
check('only the three lengths', !!(await as(A, `update public.daily_goal set session_length = 'marathon' where caregiver_id = $1`, [A])).error);
check('person can read the session length', (await as(P, `select session_length from public.daily_goal`)).rows?.length === 1);
check('person cannot change it', (await as(P, `update public.daily_goal set session_length = 'short'`)).affected === 0);
check("B cannot change A's session length", (await as(B, `update public.daily_goal set session_length = 'short' where caregiver_id = $1`, [A])).affected === 0);
check('reveal cards start on Sometimes', (await db.query(`select bool_and(reveal_cards = 'sometimes') as yes from public.daily_goal`)).rows[0].yes === true);
check('only the three reveal settings', !!(await as(A, `update public.daily_goal set reveal_cards = 'always' where caregiver_id = $1`, [A])).error);
check('person can read the reveal setting', (await as(P, `select reveal_cards from public.daily_goal`)).rows?.length === 1);
check('person cannot change it', (await as(P, `update public.daily_goal set reveal_cards = 'off'`)).affected === 0);
check('person cannot opt anyone out of reveal cards', (await as(P, `update public.people set reveal_ok = false`)).affected === 0);
check("B cannot opt A's people out", (await as(B, `update public.people set reveal_ok = false where id = $1`, [deckFirst])).affected === 0);
check('caregiver can opt a person out', !(await as(A, `update public.people set reveal_ok = false where id = $1`, [deckFirst])).error);
check('nothing on the server stores who is unlocked', (await db.query(`select count(*)::int as n from information_schema.columns where table_schema = 'public' and (column_name like '%unlock%' or column_name like '%eligible%')`)).rows[0].n === 0);
const targetSession = '00000000-0000-4000-8000-0000000000f7';
check('a session can record a large target', !(await as(P, `insert into public.sessions (id, caregiver_id, person_user_id, started_at, daily_goal) values ($1, $2, $3, now(), 36)`, [targetSession, A, P])).error);
check('and a small one', !(await as(P, `insert into public.sessions (id, caregiver_id, person_user_id, started_at, daily_goal) values ($1, $2, $3, now(), 1)`, [targetSession, A, P])).error);
check('but not a nonsense one', !!(await as(P, `insert into public.sessions (id, caregiver_id, person_user_id, started_at, daily_goal) values ($1, $2, $3, now(), 0)`, [targetSession, A, P])).error);

// Deselected: their profile stays, and the person's login can't see them, even if in_deck lagged behind
check('everyone starts included in practice', (await db.query(`select bool_and(include_in_practice) as yes from public.people`)).rows[0].yes === true);
check('person cannot deselect anyone', (await as(P, `update public.people set include_in_practice = false`)).affected === 0);
check("B cannot change A's toggle", (await as(B, `update public.people set include_in_practice = false where id = $1`, [deckFirst])).affected === 0);
check('caregiver can deselect a person', !(await as(A, `update public.people set include_in_practice = false where id = $1`, [deckFirst])).error);
await db.query(`update public.people set include_in_practice = false where id = $1`, [deckFirst]);
check('person reads no deselected person, however in_deck stands', (await count(P, 'public.people')) === 0);
check('person reads no card of a deselected person', (await count(P, 'public.cards')) === 0);
check('the deck check agrees', (await as(P, `select public.person_in_deck($1) as yes`, [deckFirst])).rows?.[0]?.yes === false);
check('caregiver still reads their profile', (await count(A, 'public.people')) === 5);
await db.query(`update public.people set include_in_practice = true where id = $1`, [deckFirst]);
check('selecting them again brings them back', (await count(P, 'public.people')) === 1);
await db.query(`update public.people set in_deck = true where caregiver_id = $1`, [A]);

// Archived: kept whole for the caregiver, and invisible to the person's login, photos included,
// whatever in_deck says
check('everyone starts active', (await db.query(`select bool_and(archived_at is null) as yes from public.people`)).rows[0].yes === true);
// Someone whose card stays approved below, so their photos stay readable there too.
const firstCardOwner = (await db.query(`select person_id from public.cards where caregiver_id = $1 order by created_at limit 1`, [A])).rows[0].person_id;
const archivee = (await db.query(`select id from public.people where caregiver_id = $1 and id <> $2 and id <> $3 order by name limit 1`, [A, deckFirst, firstCardOwner])).rows[0].id;
const archiveeCard = (await db.query(`select id from public.cards where person_id = $1`, [archivee])).rows[0].id;
const archiveePhotos = [`${A}/${archivee}.jpg`, `${A}/${archiveeCard}.jpg`];
await db.query(`update public.people set photo_path = $2 where id = $1`, [archivee, archiveePhotos[0]]);
await db.query(`update public.cards set photo_path = $2 where id = $1`, [archiveeCard, archiveePhotos[1]]);
await db.query(`insert into storage.objects (bucket_id, name) values ('photos', $1), ('photos', $2)`, archiveePhotos);
const personSeesPhotos = async () => (await as(P, `select name from storage.objects where name = any($1) order by name`, [archiveePhotos])).rows?.length;
check('person sees the photo and memory photo of someone in the deck', (await personSeesPhotos()) === 2);
check('person cannot archive anyone', (await as(P, `update public.people set archived_at = now()`)).affected === 0);
check("B cannot archive A's people", (await as(B, `update public.people set archived_at = now() where id = $1`, [archivee])).affected === 0);
const aArchives = await as(A, `update public.people set archived_at = now() where id = $1`, [archivee]);
check('caregiver can archive their own person', !aArchives.error && aArchives.affected === 1, JSON.stringify(aArchives));
// in_deck stays true on purpose: archiving must hold even if it lags behind.
await db.query(`update public.people set archived_at = now() where id = $1`, [archivee]);
check('person reads no archived person, however in_deck stands', (await as(P, `select id from public.people where id = $1`, [archivee])).rows.length === 0 && (await count(P, 'public.people')) === 4);
check('person reads no card of an archived person', (await as(P, `select id from public.cards where person_id = $1`, [archivee])).rows.length === 0 && (await count(P, 'public.cards')) === 4);
check('the deck check says they are out', (await as(P, `select public.person_in_deck($1) as yes`, [archivee])).rows?.[0]?.yes === false);
check('person cannot see or list their photos', (await personSeesPhotos()) === 0);
check('person cannot bring them back', (await as(P, `update public.people set archived_at = null where id = $1`, [archivee])).affected === 0);
check('caregiver still reads them, their card and their photos', (await count(A, 'public.people')) === 5 && (await as(A, `select id from public.cards where id = $1`, [archiveeCard])).rows.length === 1 && (await as(A, `select name from storage.objects where name = any($1)`, [archiveePhotos])).rows.length === 2);
check('signed-out visitors cannot call the photo check', await db.exec('begin').then(() => db.exec('set local role anon')).then(() => db.query(`select public.person_sees_photo($1)`, [archiveePhotos[0]])).then(() => false, () => true).finally(() => db.exec('rollback')));
await db.query(`update public.people set archived_at = null where id = $1`, [archivee]);
check('restoring brings them, their card and their photos back', (await count(P, 'public.people')) === 5 && (await count(P, 'public.cards')) === 5 && (await personSeesPhotos()) === 2);
await db.query(`update public.people set include_in_practice = false where id = $1`, [archivee]);
check('a deselected person’s photos stay hidden too', (await personSeesPhotos()) === 0);
await db.query(`update public.people set include_in_practice = true where id = $1`, [archivee]);

// The person
await db.query(`update public.cards set status = 'pending' where id = (select id from public.cards where caregiver_id = $1 order by created_at limit 1)`, [A]);
check('person reads only approved cards (4 of 5)', (await count(P, 'public.cards')) === 4);
check('person reads only people on approved cards (4 of 5)', (await count(P, 'public.people')) === 4);
check('person reads the daily goal', (await count(P, 'public.daily_goal')) === 1);
check("person cannot read caregiver B's cards", (await as(P, `select 1 from public.cards where caregiver_id = $1`, [B])).rows.length === 0);
check('person cannot change cards', (await as(P, `update public.cards set status = 'approved'`)).affected === 0);
check('person cannot add people', !!(await as(P, `insert into public.people (caregiver_id, name) values ($1, 'X')`, [A])).error);
check('person cannot change the daily goal', (await as(P, `update public.daily_goal set goal = 10`)).affected === 0);
const seenPhotos = (await as(P, `select name from storage.objects order by name`)).rows.map((row) => row.name);
check('person sees the photos practice shows them, and no stray file in the folder', JSON.stringify(seenPhotos) === JSON.stringify([...archiveePhotos].sort()), JSON.stringify(seenPhotos));
check('person cannot upload photos', !!(await as(P, `insert into storage.objects (bucket_id, name) values ('photos', $1)`, [`${A}/p.jpg`])).error);

// Facts that may change reach the person only once the caregiver confirms them
const nia = (await db.query(`insert into public.people (caregiver_id, name, relationship, in_deck) values ($1, 'Nia', 'granddaughter', true) returning id`, [A])).rows[0].id;
const niaCard = (
  await db.query(
    `insert into public.cards (caregiver_id, person_id, memory_text, sentence, status, fact_type, time_sensitive, as_of)
     values ($1, $2, 'going to become a nurse', 'As of May 2026, my granddaughter, {name}, is going to become a nurse.', 'approved', 'work', true, '2026-05-01')
     returning id`,
    [A, nia],
  )
).rows[0].id;
check('person cannot read an approved fact that may change before it is confirmed', (await count(P, 'public.cards')) === 4);
check('person cannot see someone whose only fact waits for confirmation', (await count(P, 'public.people')) === 4);
const aConfirms = await as(A, `update public.cards set confirmed_at = now() where id = $1`, [niaCard]);
check('caregiver can confirm their own facts', !aConfirms.error && aConfirms.affected === 1, JSON.stringify(aConfirms));
const pConfirms = await as(P, `update public.cards set confirmed_at = now() where id = $1`, [niaCard]);
check('person cannot confirm a fact', !!pConfirms.error || pConfirms.affected === 0, JSON.stringify(pConfirms));
await db.query(`update public.cards set confirmed_at = now() where id = $1`, [niaCard]);
check('person reads the fact once it is confirmed', (await count(P, 'public.cards')) === 5);
check('person sees them once it is confirmed', (await count(P, 'public.people')) === 5);
const niaRow = (await as(P, `select fact_type, time_sensitive, as_of::text as as_of, source from public.cards where id = $1`, [niaCard])).rows?.[0];
check('person reads the kind, date and source', niaRow?.fact_type === 'work' && niaRow?.as_of === '2026-05-01' && niaRow?.source === 'caregiver', JSON.stringify(niaRow));
const undated = await as(A, `insert into public.cards (caregiver_id, person_id, memory_text, sentence, time_sensitive) values ($1, $2, 'x', '{name} x.', true)`, [A, nia]);
check('a fact that may change needs its month', !!undated.error, 'insert succeeded');
const badKind = await as(A, `insert into public.cards (caregiver_id, person_id, memory_text, sentence, fact_type) values ($1, $2, 'x', '{name} x.', 'horoscope')`, [A, nia]);
check('only the known kinds of fact', !!badKind.error, 'insert succeeded');
const bConfirms = await as(B, `update public.cards set confirmed_at = now() where caregiver_id = $1`, [A]);
check("B cannot confirm A's facts", bConfirms.affected === 0, JSON.stringify(bConfirms));

// Hint settings: the person reads them, only the caregiver changes them
const aHints = await as(A, `update public.people set hint_fewer = false, hint_fact = false where id = $1`, [nia]);
check('caregiver can turn hints off for a person', !aHints.error && aHints.affected === 1, JSON.stringify(aHints));
await db.query(`update public.people set hint_fewer = false where id = $1`, [nia]);
const pHintRow = (await as(P, `select hint_letter, hint_fact, hint_relationship, hint_fewer from public.people where id = $1`, [nia])).rows?.[0];
check('person reads the hint settings', pHintRow?.hint_letter === true && pHintRow?.hint_fewer === false, JSON.stringify(pHintRow));
const pHints = await as(P, `update public.people set hint_fewer = true where id = $1`, [nia]);
check('person cannot change hint settings', !!pHints.error || pHints.affected === 0, JSON.stringify(pHints));
const bHints = await as(B, `update public.people set hint_letter = false where caregiver_id = $1`, [A]);
check("B cannot change A's hint settings", bHints.affected === 0, JSON.stringify(bHints));

// Phrasings the caregiver turned off: the person reads them, only the caregiver changes them
const aWays = await as(A, `update public.cards set phrasings_off = '{photo,ask}' where id = $1`, [niaCard]);
check('caregiver can turn phrasings off', !aWays.error && aWays.affected === 1, JSON.stringify(aWays));
await db.query(`update public.cards set phrasings_off = '{photo}' where id = $1`, [niaCard]);
const pWays = (await as(P, `select phrasings_off from public.cards where id = $1`, [niaCard])).rows?.[0]?.phrasings_off;
check('person reads which phrasings are off', JSON.stringify(pWays) === '["photo"]', JSON.stringify(pWays));
const pTurnsOn = await as(P, `update public.cards set phrasings_off = '{}' where id = $1`, [niaCard]);
check('person cannot change phrasings', !!pTurnsOn.error || pTurnsOn.affected === 0, JSON.stringify(pTurnsOn));

// The profile questionnaire: the new kinds of fact, the year and photo of a memory, the step
const newKinds = await as(A, `insert into public.cards (caregiver_id, person_id, memory_text, sentence, fact_type, memory_year, photo_path, hint_ok)
  values ($1, $2, 'got lost in Rome', '{name} and I got lost in Rome.', 'regular', 1987, 'a/b.jpg', false) returning memory_year, hint_ok`, [A, nia]);
check('caregiver can save a memory with a year, a photo and no hint', newKinds.rows?.[0]?.memory_year === 1987 && newKinds.rows?.[0]?.hint_ok === false, newKinds.error);
const allKinds = ['memory', 'work', 'pastwork', 'field', 'workplace', 'plans', 'interest', 'team', 'show', 'movie', 'food', 'music', 'place', 'habit', 'shared', 'regular', 'holiday', 'met', 'birthday', 'nickname', 'calls', 'known', 'home', 'lives_with', 'partner', 'child', 'pet', 'marital', 'situation'];
const kindErrors = [];
for (const kind of allKinds) {
  const saved = await as(A, `insert into public.cards (caregiver_id, person_id, memory_text, sentence, fact_type) values ($1, $2, 'x', '{name} x.', $3)`, [A, nia, kind]);
  if (saved.error) kindErrors.push(kind);
}
check('every kind of fact can be saved', kindErrors.length === 0, kindErrors.join());
check('a year must be a real year', !!(await as(A, `update public.cards set memory_year = 87 where id = $1`, [niaCard])).error);
const aStep = await as(A, `update public.people set profile_step = 4, best_clue = 'laugh' where id = $1`, [nia]);
check('caregiver can save the profile step and best clue', !aStep.error && aStep.affected === 1, JSON.stringify(aStep));
check('a step must be on the form', !!(await as(A, `update public.people set profile_step = 8 where id = $1`, [nia])).error);
check('a best clue must be one of the choices', !!(await as(A, `update public.people set best_clue = 'smell' where id = $1`, [nia])).error);
await db.query(`update public.people set best_clue = 'voice' where id = $1`, [nia]);
await db.query(`update public.cards set memory_year = 1987, photo_path = 'x.jpg', hint_ok = false where id = $1`, [niaCard]);
const pProfile = (await as(P, `select p.best_clue, c.memory_year, c.photo_path, c.hint_ok from public.people p join public.cards c on c.person_id = p.id where p.id = $1`, [nia])).rows?.[0];
check('person reads the best clue, year, photo and hint choice', pProfile?.best_clue === 'voice' && pProfile?.memory_year === 1987 && pProfile?.hint_ok === false, JSON.stringify(pProfile));
const pStep = await as(P, `update public.people set profile_step = 7, best_clue = null where id = $1`, [nia]);
check('person cannot change the profile', !!pStep.error || pStep.affected === 0, JSON.stringify(pStep));
const bStep = await as(B, `update public.people set best_clue = 'laugh' where caregiver_id = $1`, [A]);
check("B cannot change A's profiles", bStep.affected === 0, JSON.stringify(bStep));
await db.query(`update public.cards set memory_year = null, photo_path = null, hint_ok = true where id = $1`, [niaCard]);

// Running the schema again changes nothing
const rowsBefore = (await db.query(`select count(*)::int as n from public.cards`)).rows[0].n;
const rerun = await db.exec(schema).then(() => null, (error) => error.message);
check('the schema runs again without errors', rerun === null, rerun);
check('running it again keeps every card', (await db.query(`select count(*)::int as n from public.cards`)).rows[0].n === rowsBefore);
check('running it again keeps the person rules', (await count(P, 'public.cards')) === 5);
await db.query(`update public.people set archived_at = '2026-11-01T10:00:00Z' where id = $1`, [archivee]);
const rerunArchived = await db.exec(schema).then(() => null, (error) => error.message);
check('running it again keeps who is archived', rerunArchived === null && (await db.query(`select archived_at is not null as yes from public.people where id = $1`, [archivee])).rows[0].yes === true, rerunArchived);
await db.query(`update public.people set archived_at = null where id = $1`, [archivee]);

const card = (await db.query(`select id from public.cards where caregiver_id = $1 and status = 'approved' limit 1`, [A])).rows[0].id;
const practice = await as(
  P,
  `insert into public.sessions (id, caregiver_id, person_user_id, started_at, daily_goal) values ($1, $2, $3, now(), 5);
   insert into public.attempts (id, caregiver_id, card_id, person_user_id, session_id, attempted_at, tries, first_try_correct, hints_used)
     values (gen_random_uuid(), $2, $4, $3, $1, now(), 2, false, 1);
   insert into public.card_schedule (card_id, person_user_id, caregiver_id, step, due_at) values ($4, $3, $2, 0, now());`.replace(/\$(\d)/g, (_, n) => `'${[S, A, P, card][n - 1]}'`),
);
check('person writes their own session, attempt and schedule', !practice.error, practice.error);
// The offline queue may send the same rows again after a dropped connection.
const resend = await as(
  P,
  `insert into public.sessions (id, caregiver_id, person_user_id, started_at, daily_goal) values ($1, $2, $3, now(), 5);
   insert into public.sessions (id, caregiver_id, person_user_id, started_at, daily_goal, cards_completed) values ($1, $2, $3, now(), 5, 3)
     on conflict (id) do update set cards_completed = excluded.cards_completed;
   insert into public.attempts (id, caregiver_id, card_id, person_user_id, session_id, attempted_at, tries, first_try_correct, hints_used)
     values ('00000000-0000-4000-8000-0000000000e1', $2, $4, $3, $1, now(), 1, true, 0);
   insert into public.attempts (id, caregiver_id, card_id, person_user_id, session_id, attempted_at, tries, first_try_correct, hints_used)
     values ('00000000-0000-4000-8000-0000000000e1', $2, $4, $3, $1, now(), 1, true, 0) on conflict (id) do nothing;
   select cards_completed from public.sessions where id = $1;`.replace(/\$(\d)/g, (_, n) => `'${[S, A, P, card][n - 1]}'`),
);
check('person can re-send a session and an attempt', !resend.error && resend.rows[0]?.cards_completed === 3, resend.error ?? JSON.stringify(resend.rows));
const otherSession = await as(P, `insert into public.sessions (id, caregiver_id, person_user_id, started_at, daily_goal) values (gen_random_uuid(), $1, $2, now(), 5)`, [A, B]);
check('person cannot write a session for someone else', !!otherSession.error, 'insert succeeded');
const sampleByPerson = await as(P, `insert into public.sessions (id, caregiver_id, person_user_id, started_at, daily_goal, is_sample) values (gen_random_uuid(), $1, $2, now(), 5, true)`, [A, P]);
check('person cannot write sample activity', !!sampleByPerson.error, 'insert succeeded');
const roleChange = await as(P, `update public.profiles set role = 'caregiver', caregiver_id = null where id = $1`, [P]);
check('person cannot change their role', !!roleChange.error, JSON.stringify(roleChange));

// Correctness is write-only through the API
await db.exec(`
  insert into public.sessions (id, caregiver_id, person_user_id, started_at, daily_goal) values ('${S}', '${A}', '${P}', now(), 5);
  insert into public.attempts (id, caregiver_id, card_id, person_user_id, session_id, attempted_at, tries, first_try_correct, hints_used)
    values (gen_random_uuid(), '${A}', '${card}', '${P}', '${S}', now(), 2, false, 1);`);
check('caregiver can count practiced cards', (await as(A, `select card_id, attempted_at from public.attempts`)).rows?.length === 1);
for (const column of ['tries', 'first_try_correct', 'hints_used']) {
  const read = await as(A, `select ${column} from public.attempts`);
  check(`caregiver cannot read attempts.${column}`, !!read.error, 'read succeeded');
  check(`person cannot read attempts.${column}`, !!(await as(P, `select ${column} from public.attempts`)).error, 'read succeeded');
}

// Card records for insights: the person's login only writes its own family's, the caregiver only
// reads and deletes them, and nobody else reaches them at all.
const RECORD_COLUMNS = 'id, caregiver_id, person_user_id, person_id, card_id, phrasing_id, shape, fact_type, source, session_id, shown_at, selected_at, selected_right, choices, hints, success, active_ms, first_selection_ms, goal, extra, study_day, extra_practice, help_at, help_steps';
// What an app from before help requests sends (2026-11-13), which must still be taken.
const OLDER_RECORD_COLUMNS = RECORD_COLUMNS.replace(', help_at, help_steps', '');
const PB = '00000000-0000-4000-8000-0000000000bb'; // B's person
await db.query(`insert into auth.users (id, raw_user_meta_data) values ($1, '{"evermore_person": true}')`, [PB]);
await db.query(`insert into public.profiles (id, role, display_name, caregiver_id, username) values ($1, 'person', 'Joe', $2, 'grandpa.joe')`, [PB, B]);
const [aWhose, aOther] = (await db.query(`select id from public.people where caregiver_id = $1 and id <> (select person_id from public.cards where id = $2) order by name limit 2`, [A, card])).rows.map((row) => row.id);
const bWhose = (await db.query(`select id from public.people where caregiver_id = $1 limit 1`, [B])).rows[0].id;
const recordId = (n) => `cccccccc-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ago = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
const recordRow = (n, changes = {}) => ({
  id: recordId(n), caregiver_id: A, person_user_id: P, person_id: aWhose, card_id: card, phrasing_id: 'who', shape: 'who',
  fact_type: 'interest', source: 'template', session_id: S, shown_at: ago(1), selected_at: [ago(1), ago(1)], selected_right: [false, true],
  choices: 3, hints: ['letter'], success: true, active_ms: 9000, first_selection_ms: 3000, goal: 36, extra: false, study_day: null, extra_practice: false, help_at: [], help_steps: [], ...changes,
});
// As the app's upload goes: rows read from JSON, returning nothing to read back.
const UPLOAD = `insert into public.attempt_records (${RECORD_COLUMNS}) select ${RECORD_COLUMNS} from json_populate_recordset(null::public.attempt_records, $1::json) returning 1`;
const insertRecords = (user, rows) => as(user, UPLOAD, [JSON.stringify(rows)]);
/** The same, kept: as the person, committed. */
async function uploadRecords(user, rows) {
  await db.exec('begin');
  await db.exec('set local role authenticated');
  await db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: user })]);
  await db.query(UPLOAD, [JSON.stringify(rows)]);
  await db.exec('commit');
}
const keepRecords = (rows) => db.query(UPLOAD.replace(' returning 1', ''), [JSON.stringify(rows)]);
const recordCount = async (where = 'true', params = []) => (await db.query(`select count(*)::int as n from public.attempt_records where ${where}`, params)).rows[0].n;

const written = await insertRecords(P, [recordRow(1), recordRow(2, { person_id: aOther, phrasing_id: 'my-rel', shape: 'blank' })]);
check('the person writes card records for their own family, in a batch', !written.error && written.affected === 2, written.error ?? JSON.stringify(written));
check('a card left before answering is a record too, with no choice and no first time', !(await insertRecords(P, [recordRow(3, { selected_at: [], selected_right: [], hints: [], success: false, first_selection_ms: null })])).error);
check('a card from before facts may have no kind', !(await insertRecords(P, [recordRow(3, { fact_type: null })])).error);
check('a card where the person asked for help keeps each tap and the step it reached', !(await insertRecords(P, [recordRow(3, { selected_at: [ago(1)], selected_right: [true], hints: ['fact', 'relationship'], help_at: [ago(1), ago(1)], help_steps: ['fact', 'relationship'] })])).error);
check('every step a help tap can reach is taken', !(await insertRecords(P, [recordRow(3, { help_at: Array(6).fill(ago(1)), help_steps: ['fact', 'relationship', 'letter', 'fewer', 'wait', 'answer'] })])).error);
check('a help step outside the fixed set is refused, so no words fit', !!(await insertRecords(P, [recordRow(3, { help_at: [ago(1)], help_steps: ['June'] })])).error);
check('and a help time without its step', !!(await insertRecords(P, [recordRow(3, { help_at: [ago(1), ago(1)], help_steps: ['fact'] })])).error);
{
  const older = await as(P, `insert into public.attempt_records (${OLDER_RECORD_COLUMNS}) select ${OLDER_RECORD_COLUMNS} from json_populate_recordset(null::public.attempt_records, $1::json) returning 1`, [JSON.stringify([recordRow(3)])]);
  check('an older app’s record, without the help columns, is still taken', !older.error, older.error);
  await db.query(`insert into public.attempt_records (${OLDER_RECORD_COLUMNS}) select ${OLDER_RECORD_COLUMNS} from json_populate_recordset(null::public.attempt_records, $1::json)`, [JSON.stringify([recordRow(90)])]);
  const kept = (await db.query(`select help_at, help_steps from public.attempt_records where id = $1`, [recordId(90)])).rows[0];
  check('with no help requests', kept.help_at.length === 0 && kept.help_steps.length === 0, JSON.stringify(kept));
  await db.query(`delete from public.attempt_records where id = $1`, [recordId(90)]);
}
check('an approved AI sentence is recorded by its id', !(await insertRecords(P, [recordRow(3, { phrasing_id: 'ai-3f2a9c1e-5b7d-4e8f-9a0b-1c2d3e4f5a6b', source: 'ai' })])).error);
await uploadRecords(P, [recordRow(1), recordRow(2, { person_id: aOther, phrasing_id: 'my-rel', shape: 'blank' })]);
const resent = await insertRecords(P, [recordRow(1)]);
check('a record sent again is refused as a duplicate, so it is kept once', /duplicate key/.test(resent.error ?? '') && (await recordCount('id = $1', [recordId(1)])) === 1, resent.error);
check('the person reads no card record, not even their own', (await count(P, 'public.attempt_records')) === 0);
check('the person cannot change a record', !!(await as(P, `update public.attempt_records set success = false`)).error);
check('the person cannot delete a record', (await as(P, `delete from public.attempt_records`)).affected === 0 && (await recordCount()) === 2);
check('the person cannot write a record into another family', !!(await insertRecords(P, [recordRow(4, { caregiver_id: B })])).error);
check('nor as another login', !!(await insertRecords(P, [recordRow(4, { person_user_id: PB })])).error);
check("nor about someone in another family's deck", !!(await insertRecords(P, [recordRow(4, { person_id: bWhose })])).error);
check('nor say when the server took it', !!(await as(P, `insert into public.attempt_records (${RECORD_COLUMNS}, uploaded_at) select ${RECORD_COLUMNS}, now() - interval '1 year' from json_populate_record(null::public.attempt_records, $1::json)`, [JSON.stringify(recordRow(4))])).error);
check("B's person cannot write into A's family", !!(await insertRecords(PB, [recordRow(4, { person_user_id: PB })])).error && !!(await insertRecords(PB, [recordRow(4, { caregiver_id: B, person_user_id: PB })])).error);
const aReads = await as(A, `select id, selected_at, selected_right, hints, active_ms, goal from public.attempt_records order by id`);
check('the caregiver reads their family’s records, every choice and hint as written', aReads.rows?.length === 2 && aReads.rows[0].selected_right.join() === 'false,true' && aReads.rows[0].hints.join() === 'letter' && aReads.rows[0].selected_at.length === 2, aReads.error ?? JSON.stringify(aReads.rows));
check('the caregiver cannot write a record', !!(await insertRecords(A, [recordRow(4)])).error);
check('nor change one', !!(await as(A, `update public.attempt_records set success = false`)).error);
const aDeletesRecord = await as(A, `delete from public.attempt_records where id = $1`, [recordId(1)]);
check('the caregiver can delete their family’s records', !aDeletesRecord.error && aDeletesRecord.affected === 1, JSON.stringify(aDeletesRecord));
check("B reads none of A's records", (await count(B, 'public.attempt_records')) === 0 && (await as(B, `select id from public.attempt_records where caregiver_id = $1`, [A])).rows.length === 0);
check("B cannot delete A's records", (await as(B, `delete from public.attempt_records where caregiver_id = $1`, [A])).affected === 0);
check("B's person reads none either", (await count(PB, 'public.attempt_records')) === 0);
const asAnon = (sql, params = []) => db.exec('begin').then(() => db.exec('set local role anon')).then(() => db.query(sql, params)).then(() => 'done', (error) => error.message).finally(() => db.exec('rollback'));
const anonRecords = await asAnon('select * from public.attempt_records');
check('signed-out visitors cannot read records', anonRecords !== 'done', anonRecords);
const anonWrite = await asAnon(UPLOAD, [JSON.stringify([recordRow(5)])]);
check('or write them', anonWrite !== 'done', anonWrite);
// No free text: every field is an id, a fixed word, a number, a time or a yes or no
check('the way a card was asked must be a fixed shape or an AI sentence’s id, never words', !!(await insertRecords(P, [recordRow(5, { phrasing_id: 'Grandma loves tea' })])).error && !!(await insertRecords(P, [recordRow(5, { phrasing_id: 'ai-not-an-id' })])).error);
check('only the known shapes', !!(await insertRecords(P, [recordRow(5, { shape: 'riddle' })])).error);
check('only the known kinds of fact', !!(await insertRecords(P, [recordRow(5, { fact_type: 'horoscope' })])).error);
check('only template or AI', !!(await insertRecords(P, [recordRow(5, { source: 'friend' })])).error);
check('only the four hint rungs', !!(await insertRecords(P, [recordRow(5, { hints: ['shout'] })])).error);
check('each choice has its time and whether it was right', !!(await insertRecords(P, [recordRow(5, { selected_right: [true] })])).error);
check('times and counts stay in range', !!(await insertRecords(P, [recordRow(5, { active_ms: -1 })])).error && !!(await insertRecords(P, [recordRow(5, { goal: 500 })])).error && !!(await insertRecords(P, [recordRow(5, { choices: 50 })])).error);
// The study day and extra practice (2026-11-12) go up with the record and come back to the caregiver as sent.
{
  const dayed = await uploadRecords(P, [recordRow(40, { study_day: '2026-11-12', extra_practice: true })]);
  const back = (await as(A, `select study_day::text as day, extra_practice from public.attempt_records where id = $1`, [recordId(40)])).rows[0];
  check('a record keeps its study day and extra practice', !dayed?.error && back?.day === '2026-11-12' && back?.extra_practice === true, JSON.stringify(back));
  await db.query(`delete from public.attempt_records where id = $1`, [recordId(40)]);
}
// Every table the app can reach has Row Level Security on (a new one without it fails here).
{
  const open = (await db.query(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`)).rows.map((row) => row.relname);
  check('every table in public has Row Level Security on', open.length === 0, open.join(', '));
}
const recordColumns = (await db.query(`select column_name from information_schema.columns where table_schema = 'public' and table_name = 'attempt_records' order by ordinal_position`)).rows.map((row) => row.column_name);
// study_day and extra_practice were added later (2026-11-12), so they come after uploaded_at in the table.
check('a record has no column for a name, words, a photo or the "?"', [...recordColumns].sort().join() === `${RECORD_COLUMNS.replaceAll(' ', '')},uploaded_at`.split(',').sort().join() && !recordColumns.some((column) => /name|text|sentence|photo|reveal|unlock/.test(column)), recordColumns.join());
// Kept 120 days and a day more, each family's by itself
await keepRecords([recordRow(6, { shown_at: ago(130) }), recordRow(7, { shown_at: ago(119) }), recordRow(8, { caregiver_id: B, person_user_id: PB, person_id: bWhose, shown_at: ago(130) })]);
await uploadRecords(P, [recordRow(9)]);
check('an upload clears the family’s records past 121 days and keeps the rest', (await recordCount('id = $1', [recordId(6)])) === 0 && (await recordCount('id = $1', [recordId(7)])) === 1 && (await recordCount('id = $1', [recordId(9)])) === 1);
check("another family's old records are theirs to clear", (await recordCount('id = $1', [recordId(8)])) === 1);
await db.query(`delete from public.attempt_records where id = $1`, [recordId(8)]);
check('the app cannot run the clearing itself', !!(await as(P, `select public.attempt_records_prune()`)).error);
const recordIndexes = (await db.query(`select indexdef from pg_indexes where tablename = 'attempt_records'`)).rows.map((row) => row.indexdef).join('\n');
check('records are indexed by family and time, and by what is new', /\(caregiver_id, shown_at\)/.test(recordIndexes) && /\(caregiver_id, uploaded_at, id\)/.test(recordIndexes), recordIndexes);
check('the server key reaches records', (await db.query(`select has_table_privilege('service_role', 'public.attempt_records', 'select, insert, update, delete') as yes`)).rows[0].yes === true);
// Archiving keeps a person's records; deleting them for good takes their records, and only theirs
await db.query(`update public.people set archived_at = now() where id = $1`, [aOther]);
check('archiving a person keeps their records', (await recordCount('person_id = $1', [aOther])) === 1);
check('the caregiver still reads them, for "Include archived people"', (await as(A, `select id from public.attempt_records where person_id = $1`, [aOther])).rows?.length === 1);
check('the person can still send a record about them that waited offline', !(await insertRecords(P, [recordRow(11, { person_id: aOther })])).error);
const removedFact = (await db.query(`select id from public.cards where person_id = $1 limit 1`, [aOther])).rows[0].id;
await keepRecords([recordRow(12, { person_id: aOther, card_id: removedFact })]);
await db.query(`delete from public.cards where id = $1`, [removedFact]);
check('a fact the caregiver removes keeps its records, as on the phone', (await recordCount('card_id = $1', [removedFact])) === 1);
const othersBefore = await recordCount('person_id <> $1', [aOther]);
await db.query(`delete from public.people where id = $1`, [aOther]);
check('deleting a person for good deletes their records', (await recordCount('person_id = $1', [aOther])) === 0);
check('and nobody else’s', othersBefore > 0 && (await recordCount('person_id <> $1', [aOther])) === othersBefore);
check('a record about them that waited offline is then refused, so it goes too', /foreign key/.test((await insertRecords(P, [recordRow(13, { person_id: aOther })])).error ?? ''));
const recordsBefore = await recordCount();
const rerunRecords = await db.exec(schema).then(() => null, (error) => error.message);
check('running the schema again keeps every card record and its rules', rerunRecords === null && (await recordCount()) === recordsBefore && (await count(P, 'public.attempt_records')) === 0 && (await count(A, 'public.attempt_records')) === recordsBefore, rerunRecords);

// Archiving keeps practice history. Deleting a person takes their facts, schedule and attempts with
// them, and leaves the day totals (sessions) as they were.
const historyOwner = (await db.query(`select person_id from public.cards where id = $1`, [card])).rows[0].person_id;
const historyOf = async () => (await db.query(`select (select count(*) from public.attempts where card_id = $1)::int as attempts, (select count(*) from public.card_schedule where card_id = $1)::int as schedule, (select count(*) from public.cards where person_id = $2)::int as cards`, [card, historyOwner])).rows[0];
await db.query(`insert into public.card_schedule (card_id, person_user_id, caregiver_id, step, due_at) values ($1, $2, $3, 3, now())`, [card, P, A]);
await db.query(`update public.people set archived_at = now() where id = $1`, [historyOwner]);
const keptHistory = await historyOf();
check('archiving keeps their facts, attempts and schedule', keptHistory.attempts === 1 && keptHistory.schedule === 1 && keptHistory.cards >= 1, JSON.stringify(keptHistory));
check('the caregiver still counts their practiced cards', (await as(A, `select card_id from public.attempts where card_id = $1`, [card])).rows?.length === 1);
const sessionsBefore = (await db.query(`select count(*)::int as n from public.sessions where caregiver_id = $1`, [A])).rows[0].n;
const aDeletes = await as(A, `delete from public.people where id = $1`, [historyOwner]);
check('caregiver can delete their archived person', !aDeletes.error && aDeletes.affected === 1, JSON.stringify(aDeletes));
check('the person cannot delete anyone', (await as(P, `delete from public.people where id = $1`, [historyOwner])).affected === 0);
await db.query(`delete from public.people where id = $1`, [historyOwner]);
const goneHistory = await historyOf();
check('deleting them removes their facts, attempts and schedule', goneHistory.attempts === 0 && goneHistory.schedule === 0 && goneHistory.cards === 0, JSON.stringify(goneHistory));
check('and keeps the day totals', (await db.query(`select count(*)::int as n from public.sessions where caregiver_id = $1`, [A])).rows[0].n === sessionsBefore);

// The tables and functions PIN pairing used (2026-11-11). The app and its Edge Function were removed on
// 2026-11-16 (docs/PIN-REMOVAL-PLAN.md), but these stay in supabase/schema.sql until dropped by hand, so
// their rules are still checked here: only the service role reaches the PINs and limits; the caregiver
// reads their own phones; the person's login reads none of it; a phone marked removed reads nothing.
{
  const tables = ['public.pairings', 'public.devices', 'public.pairing_events', 'public.pairing_settings'];
  const PA1 = '00000000-0000-4000-8000-0000000000c1'; // A's first paired phone
  const PA2 = '00000000-0000-4000-8000-0000000000c2'; // A's second
  const PB1 = '00000000-0000-4000-8000-0000000000c3'; // B's phone
  const hex = (char) => char.repeat(64);
  const pin = (n) => `dddddddd-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const service = async (sql, params = []) => (await asService(sql, params)).rows;
  const create = async (caregiver, id, hash) => (await service(`select * from public.pairing_create($1, $2, $3)`, [caregiver, id, hash]))[0];
  const lookup = async (email, emailKey = hex('e'), ipKey = hex('1')) => (await service(`select * from public.pairing_lookup($1, $2, $3)`, [email, emailKey, ipKey]))[0];
  const consume = async (id) => (await service(`select public.pairing_consume($1) as family`, [id]))[0].family;
  const link = (user, family, name) => service(`select public.pairing_link($1, $2, $3) as device`, [user, family, name]).then((rows) => rows[0].device, (error) => error.message);
  const clearLimits = () => db.exec(`delete from public.pairing_events`);
  const settings = (changes) => db.exec(`update public.pairing_settings set ${changes}`);
  const readsBefore = {};
  for (const table of ['public.people', 'public.cards', 'public.daily_goal', 'public.sessions', 'public.card_schedule', 'public.profiles', 'public.attempt_records']) readsBefore[table] = await count(P, table);

  await db.query(`update auth.users set email = $2 where id = $1`, [A, 'pat@caregiver.test']);
  await db.query(`update auth.users set email = $2 where id = $1`, [B, 'sam@caregiver.test']);

  // Closed to everyone but the function
  for (const table of tables) {
    check(`signed-out visitors cannot read ${table}`, (await asAnon(`select * from ${table}`)) !== 'done');
    const personRead = await as(P, `select * from ${table}`);
    check(`the person's login reads nothing of ${table}`, !!personRead.error || personRead.rows.length === 0, JSON.stringify(personRead));
    check(`nor can it change ${table}`, !!(await as(P, `delete from ${table}`)).error || (await as(P, `delete from ${table}`)).affected === 0);
    check(`the server key reaches ${table}`, (await db.query(`select has_table_privilege('service_role', $1, 'select, insert, update, delete') as yes`, [table])).rows[0].yes === true);
  }
  for (const table of ['public.pairings', 'public.pairing_events', 'public.pairing_settings']) {
    check(`the caregiver cannot read ${table}`, !!(await as(A, `select * from ${table}`)).error);
  }
  const calls = [
    [`select * from public.pairing_create($1, $2, $3)`, [A, pin(1), hex('a')]],
    [`select * from public.pairing_lookup($1, $2, $3)`, ['pat@caregiver.test', hex('e'), hex('1')]],
    [`select public.pairing_fail($1)`, [pin(1)]],
    [`select public.pairing_consume($1)`, [pin(1)]],
    [`select public.pairing_link($1, $2, $3)`, [PA1, A, 'x']],
    [`select public.pairing_revoke($1, $2)`, [A, pin(1)]],
  ];
  for (const [sql, params] of calls) {
    const name = sql.match(/pairing_\w+/)[0];
    check(`only the function can run ${name}: not the caregiver`, !!(await as(A, sql, params)).error);
    check(`not the person`, !!(await as(P, sql, params)).error);
    check(`not a signed-out visitor`, (await asAnon(sql, params)) !== 'done');
  }

  // Creating a PIN
  const first = await create(A, pin(1), hex('a'));
  const minutes = (new Date(first.expires_at).getTime() - Date.now()) / 60000;
  check('a PIN is created for the caregiver’s family and expires in 15 minutes', first.outcome === 'ok' && minutes > 14.9 && minutes <= 15, JSON.stringify(first));
  check('only a keyed hash is stored, never a PIN', (await db.query(`select column_name from information_schema.columns where table_name = 'pairings' order by 1`)).rows.map((row) => row.column_name).join() === 'caregiver_id,created_at,created_by,expires_at,failures,id,pin_hash,used_at');
  check('and only a hash fits', (await create(A, pin(9), '123456')).outcome === 'off');
  check('only a caregiver can have a PIN', (await create(P, pin(9), hex('a'))).outcome === 'caregivers-only');
  await create(A, pin(2), hex('b'));
  const waiting = (await db.query(`select id from public.pairings where caregiver_id = $1 and used_at is null`, [A])).rows.map((row) => row.id);
  check('a new PIN replaces the one still waiting', waiting.join() === pin(2), waiting.join());
  await create(B, pin(3), hex('c'));
  check("and leaves another family's PIN alone", (await db.query(`select count(*)::int as n from public.pairings where caregiver_id = $1 and used_at is null`, [A])).rows[0].n === 1 && (await db.query(`select id from public.pairings where caregiver_id = $1`, [B])).rows[0].id === pin(3));
  await settings('creates_per_hour = 3');
  await create(A, pin(4), hex('d'));
  check('creating PINs is limited per family per hour', (await create(A, pin(5), hex('d'))).outcome === 'busy');
  await settings('creates_per_hour = 10');
  await create(A, pin(2), hex('b'));

  // Looking up a try, and its limits
  await clearLimits();
  const found = await lookup(' PAT@Caregiver.TEST ');
  check('the email is matched however it was typed', found.outcome === 'try' && found.pairing_id === pin(2) && found.pin_hash === hex('b'), JSON.stringify(found));
  const unknown = await lookup('nobody@caregiver.test', hex('f'));
  check('an unknown email is a try with nothing to compare, so it can be answered the same way', unknown.outcome === 'try' && unknown.pairing_id === null && unknown.pin_hash === null, JSON.stringify(unknown));
  check("a person's login has no PIN to find", (await lookup('grandma.rose@person.evermore.invalid', hex('9'))).pairing_id === null);
  const eventKeys = (await db.query(`select key from public.pairing_events`)).rows.map((row) => row.key);
  check('a try counts against keyed hashes of the email and the IP address, never the address itself', eventKeys.length === 9 && eventKeys.every((key) => /^(email|ip|global):[0-9a-f]{0,64}$/.test(key)), eventKeys.join());
  check('no email can be stored as a limit key', /check constraint/.test(await db.query(`insert into public.pairing_events (key) values ('email:pat@caregiver.test')`).then(() => 'saved', (error) => error.message)));
  await clearLimits();
  for (let i = 0; i < 5; i++) await lookup('pat@caregiver.test', hex('e'), hex(String(i)));
  check('five tries for one email in 15 minutes, then it is blocked', (await lookup('pat@caregiver.test', hex('e'), hex('6'))).outcome === 'blocked');
  check('even from other addresses', (await lookup('pat@caregiver.test', hex('e'), hex('7'))).outcome === 'blocked');
  check('a blocked try is not counted, so the window opens again by itself', (await db.query(`select count(*)::int as n from public.pairing_events where key = $1`, [`email:${hex('e')}`])).rows[0].n === 5);
  check('another email still gets a try', (await lookup('sam@caregiver.test', hex('5'), hex('8'))).outcome === 'try');
  await db.exec(`update public.pairing_events set at = now() - interval '16 minutes'`);
  check('after 15 minutes the email has its tries again', (await lookup('pat@caregiver.test', hex('e'), hex('6'))).outcome === 'try');
  await clearLimits();
  await settings('per_ip = 3');
  for (let i = 0; i < 3; i++) await lookup(`someone${i}@caregiver.test`, hex(String(i)), hex('a'));
  check('one IP address gets a limited number of tries, across emails', (await lookup('pat@caregiver.test', hex('e'), hex('a'))).outcome === 'blocked');
  check('another IP address still gets a try', (await lookup('pat@caregiver.test', hex('e'), hex('b'))).outcome === 'try');
  await clearLimits();
  await settings('per_ip = 20, global_tries = 4');
  for (let i = 0; i < 4; i++) await lookup(`someone${i}@caregiver.test`, hex(String(i)), hex(String(i)));
  check('a ceiling across everyone stops a spread-out attack', (await lookup('pat@caregiver.test', hex('e'), hex('e'))).outcome === 'blocked');
  await settings('global_tries = 500');
  await clearLimits();
  await db.exec(`insert into public.pairing_events (key, at) values ('global:', now() - interval '2 days')`);
  await lookup('pat@caregiver.test');
  check('old counts go by themselves', (await db.query(`select count(*)::int as n from public.pairing_events where at < now() - interval '1 day'`)).rows[0].n === 0);
  check('a malformed key is blocked', (await lookup('pat@caregiver.test', 'raw-email')).outcome === 'blocked');
  await settings('enabled = false');
  check('the kill switch blocks every try', (await lookup('pat@caregiver.test', hex('4'), hex('4'))).outcome === 'blocked');
  check('and every new PIN', (await create(A, pin(6), hex('e'))).outcome === 'off');
  check('and using one', (await consume(pin(2))) === null);
  await settings('enabled = true');
  await clearLimits();

  // Wrong PINs, single use, expiry
  for (let i = 0; i < 4; i++) await service(`select public.pairing_fail($1)`, [pin(2)]);
  check('four wrong PINs leave it waiting', (await lookup('pat@caregiver.test')).pairing_id === pin(2));
  await service(`select public.pairing_fail($1)`, [pin(2)]);
  check('the fifth spends it: nothing to find', (await lookup('pat@caregiver.test', hex('3'))).pairing_id === null);
  check('and it can no longer be used, even with the right PIN', (await consume(pin(2))) === null);
  check('a wrong PIN with nothing matched does nothing', !(await asService(`select public.pairing_fail(null)`).then(() => null, (error) => error.message)));
  await create(A, pin(7), hex('7'));
  check('the right PIN uses it once and names the family', (await consume(pin(7))) === A);
  check('a second use finds nothing', (await consume(pin(7))) === null && (await lookup('pat@caregiver.test', hex('2'))).pairing_id === null);
  await create(B, pin(8), hex('8'));
  await db.query(`update public.pairings set expires_at = now() - interval '1 second' where id = $1`, [pin(8)]);
  check('an expired PIN is not found', (await lookup('sam@caregiver.test', hex('1'))).pairing_id === null);
  check('and cannot be used', (await consume(pin(8))) === null);
  await clearLimits();

  // The new phone joins the family
  const scheduleCard = (await db.query(`select card_id from public.card_schedule where person_user_id = $1 limit 1`, [P])).rows[0]?.card_id;
  await db.query(`update public.card_schedule set step = 4, due_at = now() + interval '3 days', updated_at = now() where person_user_id = $1 and card_id = $2`, [P, scheduleCard]);
  for (const user of [PA1, PA2, PB1]) await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, '{"evermore_person": true}')`, [user, `${user}@phone.evermore.invalid`]);
  const device1 = await link(PA1, A, 'Rose’s iPhone');
  check('a paired phone gets a person profile in the family, with no User ID', /^[0-9a-f-]{36}$/.test(device1) && JSON.stringify((await db.query(`select role, caregiver_id, username, display_name from public.profiles where id = $1`, [PA1])).rows[0]) === JSON.stringify({ role: 'person', caregiver_id: A, username: null, display_name: 'Rose' }), device1);
  const scheduleOf = async (user) => (await db.query(`select step, due_at from public.card_schedule where person_user_id = $1 and card_id = $2`, [user, scheduleCard])).rows[0];
  check('and carries on with the schedule the family’s other phone reached', JSON.stringify(await scheduleOf(PA1)) === JSON.stringify(await scheduleOf(P)));
  const device2 = await link(PA2, A, '  \u0007 ');
  check('a family may pair several phones', /^[0-9a-f-]{36}$/.test(device2), device2);
  const names = (await db.query(`select name from public.devices where caregiver_id = $1 order by paired_at, name`, [A])).rows.map((row) => row.name);
  check('each phone has its name, or "Phone 2" when it gave none', names.join('|') === 'Rose’s iPhone|Phone 2', names.join('|'));
  check('there is still one User ID login per family', /unique|duplicate/.test(await db.query(`insert into public.profiles (id, role, caregiver_id, username) values ($1, 'person', $2, 'second.login')`, [PA1, A]).then(() => 'saved', (error) => error.message)));
  await link(PB1, B, 'x'.repeat(60));
  check('a long name is cut to 40 characters', (await db.query(`select char_length(name) as n from public.devices where person_user_id = $1`, [PB1])).rows[0].n === 40);
  const orphan = '00000000-0000-4000-8000-0000000000c9';
  await db.query(`insert into auth.users (id, raw_user_meta_data) values ($1, '{"evermore_person": true}')`, [orphan]);
  check('a phone cannot join a family that isn’t one', /no such family/.test(await link(orphan, P, 'x')) && (await db.query(`select count(*)::int as n from public.profiles where id = $1`, [orphan])).rows[0].n === 0);

  // What each login reads
  check('the paired phone reads the deck, as the User ID login does', (await count(PA1, 'public.people')) === (await count(P, 'public.people')) && (await count(PA1, 'public.cards')) === (await count(P, 'public.cards')) && (await count(PA1, 'public.cards')) > 0);
  check('and the practice settings', (await count(PA1, 'public.daily_goal')) === 1);
  check('its own schedule only', (await as(PA1, `select person_user_id from public.card_schedule`)).rows.every((row) => row.person_user_id === PA1));
  // Since 2026-11-12 a person's login reads the family's sessions (never writes them), so a day finished on one phone shows on the other.
  const familySessions = (await as(PA1, `select caregiver_id, is_sample from public.sessions`)).rows;
  check("it reads only its family's real sessions, and no other login's profile", familySessions.every((row) => row.caregiver_id === A && !row.is_sample) && (await as(PA1, `select id from public.profiles where id <> $1`, [PA1])).rows.length === 0);
  const paired = await as(PA1, `insert into public.sessions (id, caregiver_id, person_user_id, started_at, daily_goal) values ($1, $2, $3, now(), 5)`, ['00000000-0000-4000-8000-0000000000f9', A, PA1]);
  check('it writes its own sessions', !paired.error, paired.error);
  await db.query(`insert into public.sessions (id, caregiver_id, person_user_id, started_at, daily_goal, cards_completed) values ($1, $2, $3, now(), 5, 4)`, ['00000000-0000-4000-8000-0000000000f9', A, PA1]);
  check('and its card records', !(await insertRecords(PA1, [recordRow(30, { person_user_id: PA1 })])).error);
  await uploadRecords(PA1, [recordRow(30, { person_user_id: PA1 })]);
  check('but not as the other phone', !!(await insertRecords(PA1, [recordRow(31, { person_user_id: PA2 })])).error);
  check('the paired phone reads no phones and no PINs', (await as(PA1, `select * from public.devices`)).rows.length === 0 && !!(await as(PA1, `select * from public.pairings`)).error);
  const aPhones = await as(A, `select name, revoked_at from public.devices order by paired_at, name`);
  check('the caregiver reads their own phones', aPhones.rows?.length === 2 && aPhones.rows.every((row) => row.revoked_at === null), JSON.stringify(aPhones));
  check("and none of another family's", (await as(A, `select id from public.devices where caregiver_id = $1`, [B])).rows.length === 0 && (await as(B, `select id from public.devices where caregiver_id = $1`, [A])).rows.length === 0 && (await count(B, 'public.devices')) === 1);
  check('the caregiver cannot add, change or delete a phone row themselves', !!(await as(A, `insert into public.devices (caregiver_id, person_user_id, name) values ($1, $2, 'x')`, [A, P])).error && !!(await as(A, `update public.devices set revoked_at = now()`)).error && !!(await as(A, `delete from public.devices`)).error);
  const seen = async (user) => (await as(user, `select public.device_seen() as state`)).rows?.[0]?.state;
  check('a paired phone that checks in is active', (await seen(PA1)) === 'active');
  const lastSeen = async (user) => (await db.query(`select last_seen_at from public.devices where person_user_id = $1`, [user])).rows[0].last_seen_at;
  await db.query(`update public.devices set last_seen_at = now() - interval '2 days' where person_user_id in ($1, $2)`, [PA1, PA2]);
  await asService(`select 1`);
  await db.exec('begin');
  await db.exec('set local role authenticated');
  await db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: PA1 })]);
  await db.query(`select public.device_seen()`);
  await db.exec('commit');
  check('and is seen now; another phone is not touched', Date.now() - new Date(await lastSeen(PA1)).getTime() < 60000 && Date.now() - new Date(await lastSeen(PA2)).getTime() > 86400000);
  check('the User ID login and the caregiver are not paired phones', (await seen(P)) === 'none' && (await seen(A)) === 'none');
  check('signed-out visitors cannot check in', (await asAnon(`select public.device_seen()`)) !== 'done');

  // Removing a phone ends its access at once, and only its own
  const revoke = async (caregiver, device) => (await service(`select public.pairing_revoke($1, $2) as login`, [caregiver, device]))[0].login;
  check("another caregiver cannot remove A's phone", (await revoke(B, device1)) === null);
  check('nor a person', (await revoke(PA2, device1)) === null && (await revoke(P, device1)) === null);
  check('removing it names its login, for the function to sign out', (await revoke(A, device1)) === PA1);
  for (const table of ['public.people', 'public.cards', 'public.daily_goal', 'public.sessions', 'public.card_schedule']) {
    check(`the removed phone reads nothing of ${table}`, (await count(PA1, table)) === 0);
  }
  check('and writes nothing', !!(await insertRecords(PA1, [recordRow(32, { person_user_id: PA1 })])).error && !!(await as(PA1, `insert into public.sessions (id, caregiver_id, person_user_id, started_at, daily_goal) values (gen_random_uuid(), $1, $2, now(), 5)`, [A, PA1])).error);
  check('and sees no photo', (await as(PA1, `select name from storage.objects`)).rows.length === 0);
  check('and learns it was removed when it checks in', (await seen(PA1)) === 'removed');
  check('the other phone and the User ID login carry on', (await seen(PA2)) === 'active' && (await count(PA2, 'public.cards')) > 0 && (await count(P, 'public.cards')) > 0);
  const firstRemoved = (await db.query(`select revoked_at from public.devices where id = $1`, [device1])).rows[0].revoked_at;
  await revoke(A, device1);
  check('removing it again changes nothing', String((await db.query(`select revoked_at from public.devices where id = $1`, [device1])).rows[0].revoked_at) === String(firstRemoved));
  check('its practice stays for the caregiver', (await as(A, `select cards_completed from public.sessions where person_user_id = $1`, [PA1])).rows?.[0]?.cards_completed === 4 && (await recordCount('person_user_id = $1', [PA1])) === 1);
  check('and the caregiver sees it was removed', (await as(A, `select revoked_at from public.devices where id = $1`, [device1])).rows[0].revoked_at !== null);
  for (const [table, before] of Object.entries(readsBefore)) {
    // Sessions: the family's, so the paired phone's session is read too (2026-11-12).
    const expected = table === 'public.sessions' ? (await db.query(`select count(*)::int as n from public.sessions where caregiver_id = $1 and not is_sample`, [A])).rows[0].n : before;
    check(`the User ID login still reads exactly what it should of ${table}`, (await count(P, table)) === expected, `${await count(P, table)} vs ${expected}`);
  }
  const othersSession = await as(P, `update public.sessions set cards_completed = 99 where person_user_id = $1 returning id`, [PA1]);
  check("and can't change another phone's session", (othersSession.rows ?? []).length === 0 && (await db.query(`select cards_completed from public.sessions where person_user_id = $1`, [PA1])).rows.every((row) => row.cards_completed !== 99));

  // Running the schema again keeps the phones, the PINs and a switched-off setting
  await settings('enabled = false');
  const phonesBefore = (await db.query(`select count(*)::int as n from public.devices`)).rows[0].n;
  const rerunPairing = await db.exec(schema).then(() => null, (error) => error.message);
  check('running the schema again keeps every phone and the settings as they were', rerunPairing === null && (await db.query(`select count(*)::int as n from public.devices`)).rows[0].n === phonesBefore && (await db.query(`select enabled from public.pairing_settings`)).rows[0].enabled === false, rerunPairing);
  check('and a removed phone stays removed', (await count(PA1, 'public.cards')) === 0 && (await count(PA2, 'public.cards')) > 0);
  await settings('enabled = true');
}

// Export my data (2026-11-13): the export reads every table with the caregiver's own session, so these
// rules decide what it can read. Its exact reads, taken from src/data/export-store.ts, read all of A's
// family as A, and nothing of A's as B, even when B names A's family; the person's login reads no card
// record and no phone. PINs and the pairing limits are out of every login's reach.
{
  const store = readFileSync(new URL('../../src/data/export-store.ts', import.meta.url), 'utf8');
  const reads = [...store.matchAll(/allRows<[^(]*\(\s*'(\w+)',\s*'([^']+)'/g)].map(([, table, columns]) => ({ table, columns }));
  reads.push({ table: 'daily_goal', columns: store.match(/from\('daily_goal'\)\.select\('([^']+)'\)/)[1] });
  check('the check reads the export’s own queries (phones no longer among them)', ['people', 'cards', 'sessions', 'attempt_records', 'card_schedule', 'daily_goal'].every((table) => reads.some((read) => read.table === table)), reads.map((read) => read.table).join());
  for (const { table, columns } of reads) {
    const sql = `select ${columns} from public.${table} where caregiver_id = $1`;
    const all = (await db.query(`select count(*)::int as n from public.${table} where caregiver_id = $1`, [A])).rows[0].n;
    const mine = await as(A, sql, [A]);
    check(`the export reads all of A's ${table} as A (${all})`, !mine.error && mine.rows.length === all, mine.error);
    const theirs = await as(B, sql, [A]);
    check(`and none of A's ${table} as B, even naming A's family`, !theirs.error && theirs.rows.length === 0, theirs.error ?? `${theirs.rows?.length} rows`);
  }
  check('A has card records and a phone to export', (await recordCount('caregiver_id = $1', [A])) > 0 && (await db.query(`select count(*)::int as n from public.devices where caregiver_id = $1`, [A])).rows[0].n > 0);
  check("the person's login reads no card record and no phone, so it can't export them", (await count(P, 'public.attempt_records')) === 0 && (await count(P, 'public.devices')) === 0);
  for (const table of ['pairings', 'pairing_events', 'pairing_settings']) check(`no login reads ${table}: no PIN hash can be exported`, !!(await as(A, `select * from public.${table}`)).error);
  check("the caregiver can't read the scheduling log's correctness columns either", !!(await as(A, `select tries, first_try_correct, hints_used from public.attempts`)).error);
}

// Deleting the family removes every row
check('A still has card records before the family goes', (await recordCount('caregiver_id = $1', [A])) > 0);
await keepRecords([recordRow(14, { caregiver_id: B, person_user_id: PB, person_id: bWhose })]);
await db.query(`delete from auth.users where id in ($1, $2)`, [P, A]);
const left = await db.query(
  `select (select count(*) from public.profiles where id in ($1, $2))
        + (select count(*) from public.people where caregiver_id = $1)
        + (select count(*) from public.cards where caregiver_id = $1)
        + (select count(*) from public.sessions where caregiver_id = $1)
        + (select count(*) from public.attempts where caregiver_id = $1)
        + (select count(*) from public.card_schedule where caregiver_id = $1)
        + (select count(*) from public.daily_goal where caregiver_id = $1)
        + (select count(*) from public.attempt_records where caregiver_id = $1)
        + (select count(*) from public.pairings where caregiver_id = $1)
        + (select count(*) from public.devices where caregiver_id = $1)
        + (select count(*) from public.profiles where caregiver_id = $1) as n`,
  [A, P],
);
check("deleting A's account removes all of A's rows, card records, PINs and phones included", Number(left.rows[0].n) === 0, `${left.rows[0].n} left`);
check("B's card records are untouched", (await recordCount('caregiver_id = $1', [B])) === 1);
check("B's family is untouched", (await db.query(`select count(*)::int as n from public.people where caregiver_id = $1`, [B])).rows[0].n === 5);

// Upgrading a project made before facts keeps every row: the schema as it was then, a family
// with practice history, then today's schema over it.
// ---- The Family board (docs/PERSON-HOME-PLAN.md): only the caregiver writes; the person only reads ----
{
  // Two families of its own (earlier checks delete A's account), and the first one's person login.
  const [A, B, P] = ['00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-0000000000d9'];
  await db.query(`insert into auth.users (id, raw_user_meta_data) values ($1, $2), ($3, $2)`, [A, consent, B]);
  await db.query(`insert into auth.users (id, raw_user_meta_data) values ($1, '{"evermore_person": true}')`, [P]);
  await db.query(`insert into public.profiles (id, role, display_name, caregiver_id, username) values ($1, 'person', 'Rose', $2, 'board.rose')`, [P, A]);
  const note = (family, body, extra = '') => db.query(`insert into public.family_notes (caregiver_id, body${extra ? ', pinned' : ''}) values ($1, $2${extra ? ', true' : ''}) returning id`, [family, body]);
  await db.query(`delete from public.family_notes`);
  const first = (await note(A, 'Dinner at my place Sunday at 5.', 'pinned')).rows[0].id;
  await note(A, 'Lake photos this weekend?');
  await note(B, 'A note in another family.');
  check('board: the caregiver reads only their family’s notes', (await count(A, 'public.family_notes')) === 2);
  check('board: the person’s login reads only its family’s notes', (await count(P, 'public.family_notes')) === 2);
  check('board: another family reads none of them', (await as(B, `select count(*)::int as n from public.family_notes where caregiver_id = '${A}'`)).rows[0].n === 0);
  const anon = async (sql) => {
    await db.exec('begin');
    try {
      await db.exec('set local role anon');
      return { rows: (await db.exec(sql)).at(-1).rows };
    } catch (error) {
      return { error: error.message };
    } finally {
      await db.exec('rollback');
    }
  };
  const signedOut = await anon(`select count(*)::int as n from public.family_notes`);
  check('board: a signed-out user reads nothing', Boolean(signedOut.error) || signedOut.rows[0].n === 0, JSON.stringify(signedOut));
  check('board: a signed-out user writes nothing', Boolean((await anon(`insert into public.family_notes (caregiver_id, body) values ('${A}', 'x')`)).error));
  const personWrites = await as(P, `insert into public.family_notes (caregiver_id, body) values ('${A}', 'From the person') returning id`);
  check('board: the person’s login can’t add a note', Boolean(personWrites.error), JSON.stringify(personWrites));
  const personEdits = await as(P, `update public.family_notes set body = 'changed' where caregiver_id = '${A}'`);
  const personDeletes = await as(P, `delete from public.family_notes where caregiver_id = '${A}'`);
  check('board: or change or delete one', (personEdits.affected ?? 0) === 0 && (personDeletes.affected ?? 0) === 0 && (await db.query(`select count(*)::int as n from public.family_notes where caregiver_id = $1 and body <> 'changed'`, [A])).rows[0].n === 2);
  const otherWrites = await as(B, `insert into public.family_notes (caregiver_id, body) values ('${A}', 'Into the wrong family')`);
  const otherEdits = await as(B, `update public.family_notes set body = 'x' where caregiver_id = '${A}'`);
  check('board: another family can’t add to, change or delete them', Boolean(otherWrites.error) && (otherEdits.affected ?? 0) === 0);
  const own = await as(A, `insert into public.family_notes (caregiver_id, body, from_name, from_relationship) values ('${A}', 'Proud of you.', 'Lucy', 'Wife') returning id`);
  check('board: the caregiver adds a third note', !own.error, own.error);
  await note(A, 'A third, kept.');
  const fourth = await as(A, `insert into public.family_notes (caregiver_id, body) values ('${A}', 'A fourth note')`);
  check('board: a fourth note is refused by the database', /at most 3/.test(fourth.error ?? ''), JSON.stringify(fourth));
  const ownerFourth = await note(A, 'Even as the owner').then(() => null, (error) => error.message);
  check('board: even past row-level security', /at most 3/.test(ownerFourth ?? ''), ownerFourth);
  const secondPin = await as(A, `update public.family_notes set pinned = true where caregiver_id = '${A}' and id <> '${first}'`);
  check('board: only one note can be pinned', Boolean(secondPin.error), JSON.stringify(secondPin));
  const tooLong = await as(A, `update public.family_notes set body = repeat('a', 201) where id = '${first}'`);
  const blank = await as(A, `update public.family_notes set body = '   ' where id = '${first}'`);
  check('board: 200 characters at most, and never empty', Boolean(tooLong.error) && Boolean(blank.error));
  const edits = await as(A, `update public.family_notes set body = 'Dinner Sunday at 6.', pinned = false where id = '${first}'`);
  check('board: the caregiver edits and unpins their note', edits.affected === 1);
  const moved = await as(A, `update public.family_notes set caregiver_id = '${B}' where id = '${first}'`);
  check('board: a note can’t be moved to another family', Boolean(moved.error) || (moved.affected ?? 0) === 0);
  const rerunBoard = await db.exec(schema).then(() => null, (error) => error.message);
  check('board: running the schema again keeps every note', rerunBoard === null && (await db.query(`select count(*)::int as n from public.family_notes`)).rows[0].n === 4, rerunBoard);
  // Delete account: the notes go with the caregiver.
  const C = '00000000-0000-4000-8000-00000000000c';
  await db.query(`insert into auth.users (id, raw_user_meta_data) values ($1, $2)`, [C, consent]);
  await note(C, 'Soon to be deleted.');
  await db.query(`delete from auth.users where id = $1`, [C]);
  check('board: deleting the account deletes its notes', (await db.query(`select count(*)::int as n from public.family_notes where caregiver_id = $1`, [C])).rows[0].n === 0);
  await db.query(`delete from public.family_notes`);
}

const old = new PGlite();
await old.exec(SUPABASE_STANDIN);
await old.exec(readFileSync(new URL('./schema-before-facts.sql', import.meta.url), 'utf8'));
await old.query(`insert into auth.users (id, raw_user_meta_data) values ($1, $2)`, [A, consent]);
await old.query(`insert into auth.users (id, raw_user_meta_data) values ($1, '{"evermore_person": true}')`, [P]);
await old.query(`insert into public.profiles (id, role, display_name, caregiver_id, username) values ($1, 'person', 'Rose', $2, 'grandma.rose')`, [P, A]);
const oldCard = (await old.query(`select id from public.cards where caregiver_id = $1 order by created_at limit 1`, [A])).rows[0].id;
await old.exec(`
  insert into public.sessions (id, caregiver_id, person_user_id, started_at, daily_goal) values ('${S}', '${A}', '${P}', now(), 5);
  insert into public.attempts (id, caregiver_id, card_id, person_user_id, session_id, attempted_at, tries, first_try_correct, hints_used)
    values (gen_random_uuid(), '${A}', '${oldCard}', '${P}', '${S}', now(), 1, true, 0);
  insert into public.card_schedule (card_id, person_user_id, caregiver_id, step, due_at) values ('${oldCard}', '${P}', '${A}', 2, now());`);
const wordsBefore = (await old.query(`select id, person_id, memory_text, sentence, status from public.cards order by id`)).rows;
const upgrade = await old.exec(schema).then(() => null, (error) => error.message);
check('the schema upgrades a project made before facts', upgrade === null, upgrade);
const legacy = (await old.query(`select kind, policy_version, choice from public.consents where caregiver_id = $1`, [A])).rows;
check('a caregiver from before versions gets one legacy record, so the app asks them to agree again', JSON.stringify(legacy) === JSON.stringify([{ kind: 'responsibility', policy_version: 'legacy', choice: true }]), JSON.stringify(legacy));
check('dated when they ticked the old statement', (await old.query(`select c.agreed_at = p.consented_at as same from public.consents c join public.profiles p on p.id = c.caregiver_id where c.caregiver_id = $1`, [A])).rows[0].same === true);
await old.exec(schema);
check('and running the schema again adds no second one', (await old.query(`select count(*)::int as n from public.consents where caregiver_id = $1`, [A])).rows[0].n === 1);
const upgraded = (
  await old.query(`select id, person_id, memory_text, sentence, status, fact_type, time_sensitive, as_of, confirmed_at, source, phrasings_off from public.cards order by id`)
).rows;
check('the sample people\'s approved cards keep wording 1 after the upgrade', (await old.query(`select bool_and(wording = 1) as one from public.cards`)).rows[0].one === true);
check(
  'upgrade keeps every card word for word',
  JSON.stringify(upgraded.map(({ id, person_id, memory_text, sentence, status }) => ({ id, person_id, memory_text, sentence, status }))) ===
    JSON.stringify(wordsBefore),
);
check('after the upgrade every phrasing is on', upgraded.every((r) => Array.isArray(r.phrasings_off) && r.phrasings_off.length === 0));
const oldHints = (await old.query(`select bool_and(hint_letter and hint_fact and hint_relationship and hint_fewer) as on from public.people`)).rows[0].on;
check('after the upgrade every hint is on', oldHints === true);
check(
  'each earlier card becomes a memory fact from the caregiver',
  upgraded.length === 5 &&
    upgraded.every((r) => r.fact_type === 'memory' && r.source === 'caregiver' && r.time_sensitive === false && r.as_of === null && r.confirmed_at === null),
  JSON.stringify(upgraded[0]),
);
const history = (
  await old.query(`select (select count(*) from public.sessions) + (select count(*) from public.attempts) + (select count(*) from public.card_schedule) as n`)
).rows[0].n;
check('upgrade keeps practice history', Number(history) === 3, String(history));
check('after the upgrade nobody is grandfathered: everyone is a draft', (await count(P, 'public.cards', old)) === 0);
await old.query(`update public.people set in_deck = true`);
check('once added to the deck the person reads every approved card', (await count(P, 'public.cards', old)) === 5);
const oldProfile = (await old.query(`select bool_and(profile_step = 0 and best_clue is null) as empty from public.people`)).rows[0].empty;
check('after the upgrade every profile starts empty', oldProfile === true);
check('and nothing is marked "Doesn\'t apply"', (await old.query(`select bool_and(not_applicable = '{}') as empty from public.people`)).rows[0].empty === true);
check('and nobody is archived', (await old.query(`select bool_and(archived_at is null) as active from public.people`)).rows[0].active === true);
check('and card records have their table, empty and closed to the person', (await old.query(`select count(*)::int as n from public.attempt_records`)).rows[0].n === 0 && (await count(P, 'public.attempt_records', old)) === 0);

// A project that already has the facts schema: same upgrade, and the wider list of kinds
const recent = new PGlite();
await recent.exec(SUPABASE_STANDIN);
await recent.exec(readFileSync(new URL('./schema-before-profiles.sql', import.meta.url), 'utf8'));
await recent.query(`insert into auth.users (id, raw_user_meta_data) values ($1, $2)`, [A, consent]);
const recentPerson = (await recent.query(`select id from public.people limit 1`)).rows[0].id;
await recent.query(`insert into public.cards (caregiver_id, person_id, memory_text, sentence, fact_type, time_sensitive, as_of, status, confirmed_at, phrasings_off)
  values ($1, $2, 'a nurse', '{name} is a nurse.', 'work', true, '2026-05-01', 'approved', now(), '{photo}')`, [A, recentPerson]);
const waiting = (await recent.query(`insert into public.cards (caregiver_id, person_id, memory_text, sentence, fact_type, status)
  values ($1, $2, 'got lost in Rome', '{name} and I got lost in Rome.', 'shared', 'pending') returning id`, [A, recentPerson])).rows[0].id;
const recentBefore = (await recent.query(`select id, memory_text, sentence, status, fact_type, time_sensitive, as_of, confirmed_at, source, phrasings_off from public.cards order by id`)).rows;
const recentUpgrade = await recent.exec(schema).then(() => null, (error) => error.message);
check('the schema upgrades a project that already has facts', recentUpgrade === null, recentUpgrade);
const recentAfter = (await recent.query(`select id, memory_text, sentence, status, fact_type, time_sensitive, as_of, confirmed_at, source, phrasings_off from public.cards order by id`)).rows;
check('that upgrade keeps every fact as it was', JSON.stringify(recentAfter) === JSON.stringify(recentBefore));
check('and leaves everyone active', (await recent.query(`select bool_and(archived_at is null) as active from public.people`)).rows[0].active === true);
// Wording (2026-11-18): approved and skipped cards keep version 1; once, the drafts waiting move to 2.
const wordings = (await recent.query(`select status, wording from public.cards order by id`)).rows;
check('every approved card keeps wording 1', wordings.filter((row) => row.status !== 'pending').every((row) => row.wording === 1), JSON.stringify(wordings));
check('and the draft waiting for approval moves to wording 2, once', (await recent.query(`select wording from public.cards where id = $1`, [waiting])).rows[0].wording === 2);
const laterDraft = (await recent.query(`insert into public.cards (caregiver_id, person_id, memory_text, sentence, fact_type, status) values ($1, $2, 'y', '{name} y.', 'memory', 'pending') returning id, wording`, [A, recentPerson])).rows[0];
check('a card written without a wording is version 1 (the app always says which)', laterDraft.wording === 1);
await recent.exec(schema);
check('running the schema again moves nothing: the move happens only when the column first appears', (await recent.query(`select wording from public.cards where id = $1`, [laterDraft.id])).rows[0].wording === 1 && (await recent.query(`select wording from public.cards where id = $1`, [waiting])).rows[0].wording === 2);
const badWording = await recent.query(`update public.cards set wording = 3 where id = $1`, [waiting]).then(() => 'saved', () => 'refused');
check('and only wordings 1 and 2 are allowed', badWording === 'refused');
const newKind = await recent.query(`insert into public.cards (caregiver_id, person_id, memory_text, sentence, fact_type) values ($1, $2, 'x', '{name} x.', 'nickname')`, [A, recentPerson]).then(() => null, (error) => error.message);
check('and takes the new kinds of fact', newKind === null, newKind);
const stillRefused = await recent.query(`insert into public.cards (caregiver_id, person_id, memory_text, sentence, fact_type) values ($1, $2, 'x', '{name} x.', 'horoscope')`, [A, recentPerson]).then(() => 'saved', () => 'refused');
check('and still refuses unknown kinds', stillRefused === 'refused');
const rerunRecent = await recent.exec(schema).then(() => null, (error) => error.message);
check('and it runs again without errors', rerunRecent === null, rerunRecent);
check('and has the card records table', (await recent.query(`select to_regclass('public.attempt_records') is not null as yes`)).rows[0].yes === true);

console.log(failures ? `\n${failures} failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
