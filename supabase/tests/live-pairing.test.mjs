// Live checks of pairing the person's phone, against the real Supabase project in .env, with only the
// publishable key, the way the app does. Run it after rerunning supabase/schema.sql, setting the
// PAIRING_PEPPER secret and deploying the pair-phone function (HANDOFF.md has the steps). It makes
// clearly labelled test accounts (evermore-test-…, on reserved domains that can never receive mail),
// checks creating a PIN, redeeming it, what the paired phone can read, the limits, removing a phone and
// deleting the family, then deletes every account it made. It prints PASS/FAIL lines only, never keys,
// PINs, credentials or tokens. Needs "Confirm email" off, so sign-up returns a session.
//
//   node supabase/tests/live-pairing.test.mjs
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { MANAGE_FAMILY_FUNCTION, PAIR_PHONE_FUNCTION } from '../../src/config/functions.ts';

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

const RUN = Date.now().toString(36);
const PASSWORD = `Test-${randomUUID()}`; // random per run, never printed
const CAREGIVER_DOMAIN = 'caregiver.evermore.invalid';
const FLOOR_MS = 1500;

let failures = 0;
function check(label, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !detail ? '' : `  (${detail})`}`);
  if (!ok) failures++;
}
const section = (title) => console.log(`\n# ${title}`);
const client = () => createClient(SUPABASE_URL, KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });

async function call(c, slug, body) {
  const started = Date.now();
  const { data, error } = await c.functions.invoke(slug, { body });
  const ms = Date.now() - started;
  if (!error) return { status: 200, data, ms };
  const status = error.context?.status;
  const reply = typeof error.context?.json === 'function' ? await error.context.json().catch(() => ({})) : {};
  return { status, error: reply.error ?? error.name, ms };
}
const pair = (c, body) => call(c, PAIR_PHONE_FUNCTION, body);
const manage = (c, body) => call(c, MANAGE_FAMILY_FUNCTION, body);
const redeem = (email, pin) => pair(client(), { action: 'redeem', email, pin, deviceName: 'TEST phone' });

async function signIn(email, password) {
  const c = client();
  const { error } = await c.auth.signInWithPassword({ email, password });
  return error ? null : c;
}

const LEFTOVERS = join(tmpdir(), 'evermore-live-pairing-accounts.json');
const caregivers = existsSync(LEFTOVERS) ? JSON.parse(readFileSync(LEFTOVERS, 'utf8')) : [];
const remember = () => (caregivers.length ? writeFileSync(LEFTOVERS, JSON.stringify(caregivers), { mode: 0o600 }) : rmSync(LEFTOVERS, { force: true }));

async function signUpCaregiver(label) {
  const c = client();
  const email = `evermore-test-pair-${label}-${RUN}@${CAREGIVER_DOMAIN}`;
  const { data, error } = await c.auth.signUp({ email, password: PASSWORD, options: { data: { policy_version: '2026-11-13', agreed_policy: true, agreed_responsibility: true, consented_at: new Date().toISOString() } } });
  if (error || !data.session) throw new Error(`sign-up ${label}: ${error?.message ?? 'no session; is Confirm email off?'}`);
  caregivers.push({ email, password: PASSWORD });
  remember();
  return { c, id: data.user.id, email };
}

try {
  section('The function is there, and refuses what it should');
  const junk = await redeem('nobody@caregiver.evermore.invalid', '123456');
  if (junk.status === 404) throw new Error(`no function at /functions/v1/${PAIR_PHONE_FUNCTION}: deploy pair-phone (its slug is hyper-function), or set its slug in src/config/functions.ts`);
  check('an unknown email gets the one calm failure', junk.status === 400 && junk.error === 'not-paired', `${junk.status} ${junk.error}`);
  check('and not before the floor', junk.ms >= FLOOR_MS, `${junk.ms} ms`);
  const signedOut = await pair(client(), { action: 'create-pin' });
  check('creating a PIN needs a signed-in caregiver', signedOut.status === 401, `${signedOut.status} ${signedOut.error}`);
  if (junk.error === 'not-paired' && signedOut.status === 503) console.log('INFO  503 not-configured: set the PAIRING_PEPPER secret, then redeploy');

  const A = await signUpCaregiver('a');
  const B = await signUpCaregiver('b');

  section('Creating a PIN');
  const first = await pair(A.c, { action: 'create-pin' });
  check('the caregiver gets a 6-digit PIN for 15 minutes', first.status === 200 && /^\d{6}$/.test(first.data?.pin) && Math.abs(new Date(first.data.expiresAt).getTime() - Date.now() - 15 * 60000) < 60000, `${first.status} ${first.error}`);
  const second = await pair(A.c, { action: 'create-pin' });
  const stale = await redeem(A.email, first.data.pin);
  check('a new PIN invalidates the first', stale.status === 400 && stale.error === 'not-paired', `${stale.status} ${stale.error}`);

  section('Redeeming it on the person’s phone');
  const wrong = await redeem(A.email, String((Number(second.data.pin) + 1) % 1e6).padStart(6, '0'));
  check('a wrong PIN gets the same calm failure', wrong.status === 400 && wrong.error === 'not-paired' && wrong.ms >= FLOOR_MS, `${wrong.status} ${wrong.error} ${wrong.ms}`);
  const paired = await redeem(`  ${A.email.toUpperCase()} `, second.data.pin);
  check('the right PIN, with the email typed any way, pairs the phone', paired.status === 200 && /@phone\.evermore\.invalid$/.test(paired.data?.login ?? '') && paired.data?.credential?.length >= 40, `${paired.status} ${paired.error}`);
  const again = await redeem(A.email, second.data.pin);
  check('the PIN works once', again.status === 400 && again.error === 'not-paired');
  const phone = paired.data ? await signIn(paired.data.login, paired.data.credential) : null;
  check('the phone signs in with its credential', !!phone);

  section('What the paired phone reads');
  const ready = await A.c.from('people').select('id').limit(2);
  await A.c.from('people').update({ in_deck: true }).in('id', ready.data.map((row) => row.id));
  const deck = await phone.from('cards').select('id');
  check('the deck the caregiver approved', deck.data?.length === 2, deck.error?.message ?? String(deck.data?.length));
  const profile = await phone.from('profiles').select('role, username');
  check('its own person profile, with no User ID', profile.data?.length === 1 && profile.data[0].role === 'person' && profile.data[0].username === null, JSON.stringify(profile.data));
  for (const table of ['devices', 'pairings', 'pairing_events', 'pairing_settings']) {
    const read = await phone.from(table).select('*').limit(1);
    check(`it reads nothing of ${table}`, !!read.error || read.data.length === 0, read.error?.message);
  }
  const seen = await phone.rpc('device_seen');
  check('it checks in as active', seen.data === 'active', seen.error?.message ?? String(seen.data));
  const phones = await A.c.from('devices').select('id, name, paired_at, last_seen_at, revoked_at');
  check('the caregiver sees it under Linked phones', phones.data?.length === 1 && phones.data[0].name === 'TEST phone' && phones.data[0].last_seen_at && !phones.data[0].revoked_at, JSON.stringify(phones.data));
  const others = await B.c.from('devices').select('id');
  check('another caregiver sees none of it', !others.error && others.data.length === 0);
  for (const fn of ['pairing_lookup', 'pairing_consume', 'pairing_create']) {
    const direct = await A.c.rpc(fn, {});
    check(`the app cannot call ${fn} itself`, !!direct.error);
  }

  section('The limits');
  const bPin = await pair(B.c, { action: 'create-pin' });
  for (let i = 0; i < 5; i++) await redeem(B.email, '000000');
  const locked = await redeem(B.email, bPin.data.pin);
  check('after five tries for an email, even the right PIN is refused for 15 minutes', locked.status === 400 && locked.error === 'not-paired');

  section('Their login still works beside it');
  const username = `test.pair.${RUN}`;
  const made = await manage(A.c, { action: 'create-person', username, password: PASSWORD, displayName: 'TEST' });
  check('the caregiver can still make the User ID login', made.status === 200, `${made.status} ${made.error}`);
  const named = await signIn(`${username}@person.evermore.invalid`, PASSWORD);
  check('which signs in and reads the same deck', (await named?.from('cards').select('id'))?.data?.length === 2);
  const reset = await manage(A.c, { action: 'reset-person', username, password: `${PASSWORD}-2` });
  check('and can be reset, with a paired phone in the family too', reset.status === 200, `${reset.status} ${reset.error}`);

  section('Remove phone');
  const removed = await pair(A.c, { action: 'revoke-device', deviceId: phones.data[0].id });
  check('the caregiver removes the phone', removed.status === 200, `${removed.status} ${removed.error}`);
  const after = await phone.from('cards').select('id');
  check('its access ends at once, though its token hasn’t expired', !after.error && after.data.length === 0, after.error?.message ?? String(after.data.length));
  check('it learns it was removed when it checks in', (await phone.rpc('device_seen')).data === 'removed');
  const refresh = await phone.auth.refreshSession();
  check('its session can’t be refreshed', !!refresh.error, 'refreshed');
  check('its credential no longer signs in', !(await signIn(paired.data.login, paired.data.credential)));
  const notB = await pair(B.c, { action: 'revoke-device', deviceId: phones.data[0].id });
  check("another caregiver can't remove A's phone", notB.status === 404, `${notB.status} ${notB.error}`);

  section('Delete account takes every paired phone too');
  const pin3 = await pair(A.c, { action: 'create-pin' });
  const paired3 = await redeem(A.email, pin3.data.pin);
  const removedFamily = await manage(A.c, { action: 'delete-family' });
  check('the family is deleted', removedFamily.status === 200, `${removedFamily.status} ${removedFamily.error}`);
  check('and the paired phone’s login with it', !!paired3.data && !(await signIn(paired3.data.login, paired3.data.credential)));
} catch (error) {
  failures++;
  console.log(`FAIL  stopped early: ${error.message}`);
} finally {
  section('Clean-up');
  for (const account of [...caregivers]) {
    const c = await signIn(account.email, account.password);
    const result = c ? await manage(c, { action: 'delete-family' }) : null;
    if (!c || result.status === 200) {
      caregivers.splice(caregivers.indexOf(account), 1);
      console.log(`PASS  test account ${account.email.replace(/-[a-z0-9]+@/, '-…@')} ${c ? 'deleted' : 'already gone'}`);
    } else {
      check('deleted a test account', false, `${result.status} ${result.error}`);
    }
  }
  remember();
  console.log(failures ? `\n${failures} failed` : '\nAll live pairing checks passed');
  process.exit(failures ? 1 : 0);
}
