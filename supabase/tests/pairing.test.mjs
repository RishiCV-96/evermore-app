// Runs the real pair-phone function file (supabase/functions/pair-phone/index.ts) with the real
// supabase-js, against supabase/schema.sql in PGlite: its database calls go to a small stand-in for
// PostgREST that runs each function as service_role, and Supabase Auth's admin endpoints are faked in
// memory. So this checks the function and the SQL together: PINs, hashing, expiry, single use, the
// limits and lockout, identical answers in identical time, the new phone's login, removing a phone,
// and what is logged.
//
//   node supabase/tests/pairing.test.mjs
import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';

import { SUPABASE_STANDIN } from './standin.mjs';

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'npm:@supabase/supabase-js@2') return next('@supabase/supabase-js', context);
    return next(specifier, context);
  },
});

const URL_BASE = 'https://example.supabase.co';
const PEPPER = 'test-pepper-not-a-real-one-0123456789abcdef';
const SECRETS = { SUPABASE_URL: URL_BASE, SUPABASE_SERVICE_ROLE_KEY: 'service-role-test', PAIRING_PEPPER: PEPPER };
let env = { ...SECRETS };
let handler;
globalThis.Deno = { env: { get: (key) => env[key] }, serve: (run) => (handler = run) };

// ---------------------------------------------------------------------------------------
// The database, and stand-ins for PostgREST and Supabase Auth
// ---------------------------------------------------------------------------------------

const db = new PGlite();
await db.exec(SUPABASE_STANDIN);
await db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const P = '00000000-0000-4000-8000-0000000000aa'; // A's User ID login
const consent = JSON.stringify({ policy_version: '2026-11-13', agreed_policy: true, agreed_responsibility: true, consented_at: new Date().toISOString() });
await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, 'pat@caregiver.test', $3), ($2, 'sam@caregiver.test', $3)`, [A, B, consent]);
await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, 'grandma.rose@person.evermore.invalid', '{"evermore_person": true}')`, [P]);
await db.query(`insert into public.profiles (id, role, display_name, caregiver_id, username) values ($1, 'person', 'Rose', $2, 'grandma.rose')`, [P, A]);
await db.query(`update public.people set in_deck = true where caregiver_id = $1`, [A]);
const TOKENS = { 'token-a': A, 'token-b': B, 'token-p': P };

/** Every database call the function made: its name and arguments. */
const rpcCalls = [];
/** The admin calls: what was created, changed and deleted. */
const admin = { created: [], updated: [], deleted: [], failCreate: false, failRpc: null };
/** Passwords the fake auth was given, by login, as Supabase would keep (hashed there). */
const credentials = new Map();
const TABLE_FUNCTIONS = new Set(['pairing_lookup', 'pairing_create']);

function json(status, body) {
  return new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

async function rpc(name, args) {
  rpcCalls.push({ name, args });
  if (admin.failRpc === name) return json(500, { code: 'XX000', message: 'injected' });
  const keys = Object.keys(args);
  const call = `public.${name}(${keys.map((key, i) => `${key} => $${i + 1}`).join(', ')})`;
  await db.exec('begin');
  try {
    await db.exec('set local role service_role');
    const result = await db.query(TABLE_FUNCTIONS.has(name) ? `select * from ${call}` : `select ${call} as value`, keys.map((key) => args[key]));
    await db.exec('commit');
    if (TABLE_FUNCTIONS.has(name)) return json(200, result.rows.map((row) => ({ ...row, expires_at: row.expires_at?.toISOString?.() ?? row.expires_at ?? undefined })));
    const value = result.rows[0]?.value;
    return value === null || value === undefined ? new Response(null, { status: 204 }) : json(200, value);
  } catch (error) {
    await db.exec('rollback');
    return json(400, { code: error.code ?? 'P0001', message: error.message });
  }
}

const userJson = (id, email, meta = {}) => ({ id, aud: 'authenticated', role: 'authenticated', email, user_metadata: meta, app_metadata: {}, created_at: new Date().toISOString() });

globalThis.fetch = async (input, init = {}) => {
  const request = input instanceof Request ? input : new Request(String(input), init);
  const { pathname } = new URL(request.url);
  const body = ['GET', 'HEAD', 'DELETE'].includes(request.method) ? {} : await request.json().catch(() => ({}));
  if (pathname.startsWith('/rest/v1/rpc/') && request.method === 'POST') return rpc(pathname.slice('/rest/v1/rpc/'.length), body);
  if (pathname === '/auth/v1/user' && request.method === 'GET') {
    const id = TOKENS[request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')];
    return id ? json(200, userJson(id, 'x')) : json(401, { code: 'bad_jwt', msg: 'invalid JWT' });
  }
  if (pathname === '/auth/v1/admin/users' && request.method === 'POST') {
    if (admin.failCreate) return json(500, { code: 'unexpected_failure', msg: 'Database error creating new user' });
    const id = randomUUID();
    await db.query(`insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values ($1, $2, $3, $4)`, [id, body.email, JSON.stringify(body.user_metadata ?? {}), JSON.stringify(body.app_metadata ?? {})]);
    admin.created.push({ id, email: body.email, confirmed: body.email_confirm, metadata: body.user_metadata });
    credentials.set(body.email, body.password);
    return json(200, userJson(id, body.email, body.user_metadata));
  }
  const user = pathname.match(/^\/auth\/v1\/admin\/users\/([0-9a-f-]{36})$/)?.[1];
  if (user && request.method === 'PUT') {
    admin.updated.push({ id: user, ...body });
    return json(200, userJson(user, 'x'));
  }
  if (user && request.method === 'DELETE') {
    admin.deleted.push(user);
    await db.query(`delete from auth.users where id = $1`, [user]);
    return json(200, {});
  }
  throw new Error(`Nothing else should be called: ${request.method} ${pathname}`);
};

const logged = [];
for (const method of ['log', 'info', 'warn', 'error', 'debug']) console[method] = (...args) => logged.push(args.map(String).join(' '));
const print = (line) => process.stdout.write(`${line}\n`);

// The wait before each answer, in "fast" mode: noted, then run at once, so the checks don't take minutes.
const realSetTimeout = globalThis.setTimeout;
let fast = true;
const waits = [];
globalThis.setTimeout = (run, ms = 0, ...rest) => {
  if (fast && ms >= 200) {
    waits.push(ms);
    return realSetTimeout(run, 0, ...rest);
  }
  return realSetTimeout(run, ms, ...rest);
};

const { REDEEM_FLOOR_MS } = await import('../functions/pair-phone/index.ts');
assert.ok(handler, 'the function starts');

// ---------------------------------------------------------------------------------------
// Calling it
// ---------------------------------------------------------------------------------------

const send = (body, headers = {}) =>
  handler(new Request(`${URL_BASE}/functions/v1/hyper-function`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) }));

async function asCaregiver(action, token = 'token-a', more = {}) {
  const response = await send({ action, ...more }, token ? { authorization: `Bearer ${token}` } : {});
  return { status: response.status, body: await response.json() };
}
const createPin = (token) => asCaregiver('create-pin', token);

/** Every failure seen, so they can be compared at the end. */
const failures = [];
let ipCounter = 0;
const freshIp = () => `198.51.100.${++ipCounter % 250}`;

async function redeem(email, pin, { ip = freshIp(), deviceName = 'Rose’s iPhone' } = {}) {
  const started = Date.now();
  const response = await send({ action: 'redeem', email, pin, deviceName }, { 'x-forwarded-for': `${ip}, 10.0.0.1` });
  const answer = { status: response.status, text: await response.text(), headers: JSON.stringify([...response.headers].sort()), ms: Date.now() - started };
  if (answer.status !== 200) failures.push(answer);
  return answer;
}
const NOT_PAIRED = JSON.stringify({ error: 'not-paired' });
const isNotPaired = (answer) => answer.status === 400 && answer.text === NOT_PAIRED;

const pinRow = async (pin) => {
  const rows = (await db.query(`select * from public.pairings`)).rows;
  return rows.find((row) => createHmac('sha256', PEPPER).update(`pin:${row.id}:${pin}`).digest('hex') === row.pin_hash);
};
const clearLimits = () => db.exec(`delete from public.pairing_events`);
const settings = (changes) => db.exec(`update public.pairing_settings set ${changes}`);
const reads = async (user, table) => {
  await db.exec('begin');
  try {
    await db.exec('set local role authenticated');
    await db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: user })]);
    return (await db.query(`select count(*)::int as n from ${table}`)).rows[0].n;
  } finally {
    await db.exec('rollback');
  }
};

let passes = 0;
async function check(label, run) {
  await run();
  passes++;
  print(`PASS  ${label}`);
}

// ---------------------------------------------------------------------------------------
// The checks
// ---------------------------------------------------------------------------------------

await check('only POST, and only its three actions', async () => {
  assert.equal((await handler(new Request(`${URL_BASE}/functions/v1/hyper-function`, { method: 'GET' }))).status, 405);
  assert.equal((await handler(new Request(`${URL_BASE}/functions/v1/hyper-function`, { method: 'OPTIONS' }))).status, 200);
  assert.equal((await send({ action: 'delete-everything' })).status, 400);
  assert.equal((await send('not json')).status, 400);
});

await check('without the pepper it refuses everything, with the same answer as any failure', async () => {
  for (const pepper of [undefined, 'too-short']) {
    env = { ...SECRETS, PAIRING_PEPPER: pepper };
    const answer = await redeem('pat@caregiver.test', '123456');
    assert.ok(isNotPaired(answer), answer.text);
    assert.deepEqual(await createPin(), { status: 503, body: { error: 'not-configured' } });
  }
  env = { ...SECRETS };
  assert.ok(logged.includes('pair-phone: not-configured'), 'logged as a kind');
});

await check('creating a PIN: the signed-in caregiver only', async () => {
  assert.deepEqual(await createPin(null), { status: 401, body: { error: 'signed-out' } });
  assert.deepEqual(await createPin('token-nobody'), { status: 401, body: { error: 'signed-out' } });
  assert.deepEqual(await createPin('token-p'), { status: 403, body: { error: 'caregivers-only' } }, 'not the person’s login');
});

let firstPin;
await check('a PIN is six digits, for 15 minutes, and only its keyed hash is kept', async () => {
  const made = await createPin();
  assert.equal(made.status, 200);
  assert.match(made.body.pin, /^\d{6}$/);
  const minutes = (new Date(made.body.expiresAt).getTime() - Date.now()) / 60000;
  assert.ok(minutes > 14.9 && minutes <= 15, `expires in ${minutes} minutes`);
  firstPin = made.body.pin;
  const row = await pinRow(firstPin);
  assert.ok(row, 'the stored hash is HMAC-SHA256 of the PIN keyed with the pepper');
  assert.equal(row.caregiver_id, A);
  assert.notEqual(row.pin_hash, createHmac('sha256', '').update(`pin:${row.id}:${firstPin}`).digest('hex'), 'and not without it');
  const everything = JSON.stringify((await db.query(`select * from public.pairings`)).rows) + JSON.stringify(rpcCalls);
  assert.ok(!everything.includes(firstPin), 'the PIN itself is in no row and no database call');
  assert.ok(!everything.includes(PEPPER), 'nor is the pepper');
  const pins = new Set();
  for (let i = 0; i < 6; i++) pins.add((await createPin('token-b')).body.pin);
  assert.ok(pins.size >= 5, 'PINs are random');
  await clearLimits();
});

await check('a second PIN invalidates the first', async () => {
  const second = (await createPin()).body.pin;
  assert.ok(isNotPaired(await redeem('pat@caregiver.test', firstPin)), 'the first no longer works');
  assert.equal((await db.query(`select count(*)::int as n from public.pairings where caregiver_id = $1 and used_at is null`, [A])).rows[0].n, 1, 'only one waits');
  firstPin = second;
});

let phone;
await check('the right email and PIN: a new login for this phone, linked to the family', async () => {
  rpcCalls.length = 0;
  const answer = await redeem('pat@caregiver.test', firstPin);
  assert.equal(answer.status, 200, answer.text);
  phone = JSON.parse(answer.text);
  assert.deepEqual(Object.keys(phone).sort(), ['credential', 'login'], 'what the phone needs to sign in, and nothing about the caregiver');
  assert.match(phone.login, /^[0-9a-f-]{36}@phone\.evermore\.invalid$/, 'a login on a reserved domain that can never receive mail');
  assert.ok(phone.credential.length >= 40 && /[a-z]/.test(phone.credential) && /[A-Z]/.test(phone.credential) && /\d/.test(phone.credential) && /[-_]/.test(phone.credential), 'a long random credential that meets any password rule');
  assert.equal(credentials.get(phone.login), phone.credential, 'given to Supabase Auth as the login’s password');
  const created = admin.created.at(-1);
  assert.deepEqual([created.email, created.confirmed, created.metadata], [phone.login, true, { evermore_person: true }]);
  const profile = (await db.query(`select role, caregiver_id, username, display_name from public.profiles where id = $1`, [created.id])).rows[0];
  assert.deepEqual(profile, { role: 'person', caregiver_id: A, username: null, display_name: 'Rose' });
  const device = (await db.query(`select caregiver_id, name, revoked_at from public.devices where person_user_id = $1`, [created.id])).rows[0];
  assert.deepEqual(device, { caregiver_id: A, name: 'Rose’s iPhone', revoked_at: null }, 'the phone, by its own name');
  assert.ok(/no-store/.test(answer.headers), 'never cached on the way');
  assert.ok((await reads(created.id, 'public.cards')) > 0, 'its login reads the deck');
  assert.equal(await reads(created.id, 'public.devices'), 0, 'and no phones');
  assert.ok(!JSON.stringify(rpcCalls).includes(firstPin), 'the PIN never went to the database');
  phone.id = created.id;
});

await check('a PIN works once', async () => {
  assert.ok(isNotPaired(await redeem('pat@caregiver.test', firstPin)));
  assert.equal(admin.created.length, 1, 'no second login');
});

await check('the email is matched however it was typed', async () => {
  const pin = (await createPin()).body.pin;
  const answer = await redeem('  PAT@Caregiver.Test ', pin, { deviceName: '' });
  assert.equal(answer.status, 200, answer.text);
  const id = admin.created.at(-1).id;
  assert.equal((await db.query(`select name from public.devices where person_user_id = $1`, [id])).rows[0].name, 'Phone 2', 'no name given: "Phone 2"');
});

await check('an expired PIN does not work, even typed right', async () => {
  const pin = (await createPin()).body.pin;
  await db.query(`update public.pairings set expires_at = now() - interval '1 second' where used_at is null`);
  assert.ok(isNotPaired(await redeem('pat@caregiver.test', pin)));
  assert.equal((await pinRow(pin)).used_at, null, 'and it isn’t used up');
});

await check('five wrong PINs spend it: then even the right one does not work', async () => {
  await clearLimits();
  const pin = (await createPin()).body.pin;
  const wrong = String((Number(pin) + 1) % 1_000_000).padStart(6, '0');
  for (let i = 0; i < 5; i++) assert.ok(isNotPaired(await redeem('pat@caregiver.test', wrong)));
  assert.equal((await pinRow(pin)).failures, 5, 'each wrong PIN counted against it');
  await clearLimits();
  assert.ok(isNotPaired(await redeem('pat@caregiver.test', pin)), 'spent');
});

await check('lockout: five tries for an email in 15 minutes, then nothing works for it, not even the right PIN', async () => {
  await clearLimits();
  // Five tries first (with nothing waiting, so no PIN is spent by them), then the caregiver's new PIN.
  for (let i = 0; i < 4; i++) await redeem('pat@caregiver.test', '000000');
  await redeem('PAT@caregiver.test', 'abcdef');
  const pin = (await createPin()).body.pin;
  const before = (await pinRow(pin)).failures;
  assert.ok(isNotPaired(await redeem('pat@caregiver.test', pin)), 'locked, and it reads the same');
  assert.equal((await pinRow(pin)).used_at, null, 'the PIN isn’t used by a blocked try');
  assert.equal((await pinRow(pin)).failures, before, 'and a blocked try isn’t counted against it');
  await db.exec(`update public.pairing_events set at = now() - interval '16 minutes'`);
  assert.equal((await redeem('pat@caregiver.test', pin)).status, 200, 'after 15 minutes it works');
});

await check('per IP address: a limited number of tries across emails, then blocked; another address still gets through', async () => {
  await clearLimits();
  const pin = (await createPin('token-b')).body.pin;
  for (let i = 0; i < 20; i++) await redeem(`someone${i}@caregiver.test`, '123456', { ip: '203.0.113.9' });
  assert.ok(isNotPaired(await redeem('sam@caregiver.test', pin, { ip: '203.0.113.9' })), 'that address is blocked, even for a right PIN');
  assert.equal((await redeem('sam@caregiver.test', pin, { ip: '203.0.113.10' })).status, 200, 'another address gets through');
});

await check('a ceiling across everyone, for an attack spread over many addresses', async () => {
  await clearLimits();
  await settings('global_tries = 3');
  const pin = (await createPin()).body.pin;
  for (let i = 0; i < 3; i++) await redeem(`spread${i}@caregiver.test`, '123456');
  assert.ok(isNotPaired(await redeem('pat@caregiver.test', pin)));
  await settings('global_tries = 500');
  await clearLimits();
});

await check('a burst of tries at once gets no more than five comparisons', async () => {
  await clearLimits();
  const pin = (await createPin()).body.pin;
  const answers = await Promise.all(Array.from({ length: 12 }, (_, i) => redeem('pat@caregiver.test', String(i).padStart(6, '9'))));
  assert.ok(answers.every(isNotPaired));
  assert.equal((await pinRow(pin)).failures, 5, 'one try at a time: five counted, the rest blocked');
  await clearLimits();
});

await check('the kill switch stops every PIN being redeemed or created', async () => {
  await clearLimits();
  const pin = (await createPin()).body.pin;
  await settings('enabled = false');
  assert.ok(isNotPaired(await redeem('pat@caregiver.test', pin)));
  assert.deepEqual(await createPin(), { status: 503, body: { error: 'off' } });
  await settings('enabled = true');
  assert.equal((await redeem('pat@caregiver.test', pin)).status, 200, 'and on again, the waiting PIN works');
});

await check('nonsense in, the same answer out', async () => {
  await clearLimits();
  const pin = (await createPin()).body.pin;
  for (const [email, typed] of [['pat@caregiver.test', pin.slice(0, 5)], ['pat@caregiver.test', `${pin}0`], ['pat@caregiver.test', 123456], [undefined, pin], [['pat@caregiver.test'], pin], ['x'.repeat(300), pin]]) {
    await clearLimits();
    assert.ok(isNotPaired(await redeem(email, typed)), `${JSON.stringify(email)?.slice(0, 20)} / ${typed}`);
  }
});

await check('when the login can’t be made or linked, the same answer, and nothing left behind', async () => {
  await clearLimits();
  let pin = (await createPin()).body.pin;
  admin.failCreate = true;
  assert.ok(isNotPaired(await redeem('pat@caregiver.test', pin)));
  admin.failCreate = false;
  await clearLimits();
  pin = (await createPin()).body.pin;
  const users = (await db.query(`select count(*)::int as n from auth.users`)).rows[0].n;
  admin.failRpc = 'pairing_link';
  assert.ok(isNotPaired(await redeem('pat@caregiver.test', pin)));
  admin.failRpc = null;
  assert.equal((await db.query(`select count(*)::int as n from auth.users`)).rows[0].n, users, 'the half-made login is deleted');
  assert.deepEqual(logged.filter((line) => /create-user|link/.test(line)), ['pair-phone: create-user', 'pair-phone: link']);
});

await check('every failure is the same answer: status, body and headers', async () => {
  assert.ok(failures.length > 40, `${failures.length} failures seen`);
  const kinds = new Set(failures.map(({ status, text, headers }) => JSON.stringify([status, text, headers])));
  assert.equal(kinds.size, 1, [...kinds].join('\n'));
});

await check('every answer waits for the same floor, so time says nothing either', async () => {
  // In fast mode each answer noted how long it still had to wait: never nothing, never past the floor.
  assert.ok(waits.length > 40 && waits.every((ms) => ms > REDEEM_FLOOR_MS - 400 && ms <= REDEEM_FLOOR_MS), waits.slice(0, 8).join());
  fast = false;
  await clearLimits();
  const pin = (await createPin()).body.pin;
  const timed = [];
  timed.push((await redeem('nobody@caregiver.test', '123456')).ms); // no such email
  timed.push((await redeem('sam@caregiver.test', '123456')).ms); // no PIN waiting
  timed.push((await redeem('pat@caregiver.test', '000001')).ms); // the wrong PIN
  for (let i = 0; i < 3; i++) await redeem('pat@caregiver.test', '000002');
  timed.push((await redeem('pat@caregiver.test', '000003')).ms); // the fifth: spent
  timed.push((await redeem('pat@caregiver.test', pin)).ms); // locked out
  await clearLimits();
  timed.push((await redeem('pat@caregiver.test', pin)).ms); // spent, typed right
  fast = true;
  assert.ok(timed.every((ms) => ms >= REDEEM_FLOOR_MS && ms < REDEEM_FLOOR_MS + 250), timed.join());
});

await check('removing a phone: the caregiver’s own only, its access ends, and its login is banned with a new credential', async () => {
  assert.deepEqual(await asCaregiver('revoke-device', null, { deviceId: randomUUID() }), { status: 401, body: { error: 'signed-out' } });
  const device = (await db.query(`select id from public.devices where person_user_id = $1`, [phone.id])).rows[0].id;
  assert.deepEqual(await asCaregiver('revoke-device', 'token-b', { deviceId: device }), { status: 404, body: { error: 'no-device' } }, 'not another family’s');
  assert.deepEqual(await asCaregiver('revoke-device', 'token-p', { deviceId: device }), { status: 404, body: { error: 'no-device' } }, 'not the person’s');
  assert.deepEqual(await asCaregiver('revoke-device', 'token-a', { deviceId: 'phone-1' }), { status: 400, body: { error: 'bad-request' } });
  assert.ok((await reads(phone.id, 'public.cards')) > 0, 'until now its login reads the deck');
  assert.deepEqual(await asCaregiver('revoke-device', 'token-a', { deviceId: device }), { status: 200, body: { removed: true } });
  for (const table of ['public.people', 'public.cards', 'public.daily_goal']) assert.equal(await reads(phone.id, table), 0, `now nothing of ${table}`);
  const ban = admin.updated.find((one) => one.id === phone.id);
  assert.equal(ban.ban_duration, '876000h', 'banned, so its session can’t refresh or sign in again');
  assert.ok(ban.password && ban.password !== phone.credential && ban.password.length >= 40, 'and the credential it keeps stops working');
  assert.ok((await reads(P, 'public.cards')) > 0, 'the User ID login carries on');
});

await check('the log holds only kinds of failure: never a PIN, an email, an address, a credential, a token or the pepper', async () => {
  // Node's own warning about the .ts file's module type isn't the function's.
  const mine = logged.filter((line) => !line.includes('MODULE_TYPELESS_PACKAGE_JSON'));
  assert.ok(mine.length > 0 && mine.every((line) => /^pair-phone: [a-z-]+$/.test(line)), mine.join('\n'));
  const secrets = [firstPin, 'pat@caregiver.test', 'caregiver.test', '198.51.100', '203.0.113', phone.credential, phone.login, 'token-a', PEPPER];
  assert.ok(!secrets.some((secret) => logged.some((line) => line.includes(secret))));
});

await check('what reaches the database: the email to look up, keyed hashes and ids, never a PIN or the pepper', async () => {
  const sent = JSON.stringify(rpcCalls);
  assert.ok(!sent.includes(PEPPER) && !sent.includes(phone.credential));
  for (const { name, args } of rpcCalls.filter((call) => call.name === 'pairing_lookup')) {
    assert.match(args.p_email_key, /^[0-9a-f]{64}$/, name);
    assert.match(args.p_ip_key, /^[0-9a-f]{64}$/);
  }
  assert.ok(!JSON.stringify((await db.query(`select * from public.pairing_events`)).rows).includes('@'), 'the limits keep no address');
});

print(`All ${passes} pairing function checks passed`);
