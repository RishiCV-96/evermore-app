// pair-phone: pairs the person's phone with the caregiver's family, from the caregiver's email and a
// 6-digit PIN the caregiver creates in the app. It runs on Supabase, never in the app, and is the only
// code that holds the PIN pepper. Three actions:
//   redeem         the person's phone, signed out: the caregiver's email and the PIN. On success a new
//                  login for that phone, linked to the family; the phone keeps its credential in secure
//                  storage. Every failure gets the same answer after the same time.
//   create-pin     a signed-in caregiver: a new PIN for 15 minutes, replacing the one still waiting.
//   revoke-device  a signed-in caregiver: "Remove phone". Its access ends at once (the database rules),
//                  its login is banned so its session can't refresh (within the hour at most), and its
//                  credential stops working.
//
// "Verify JWT" is off for this function only because redeem is the public way in, from a phone with
// nobody signed in; the caregiver's actions check the caller's own session here, as manage-family does.
// It logs only the kind of a failure: never a PIN, an email, an IP address, a token or a credential.
//
// Secrets set in Supabase (Edge Functions -> Secrets): PAIRING_PEPPER, a long random value (at least 32
// characters), and the secret key as EVERMORE_SECRET_KEY (falling back to the SUPABASE_SERVICE_ROLE_KEY
// Supabase provides). Without the pepper it refuses everything. The limits and the kill switch are in
// public.pairing_settings (supabase/schema.sql).
import { createClient } from 'npm:@supabase/supabase-js@2';

/** Every failed redeem, whatever the reason, gets exactly this, with this status. */
const NOT_PAIRED = { error: 'not-paired' };
const NOT_PAIRED_STATUS = 400;
/** And no answer to redeem, success or not, comes back sooner than this after the request. */
export const REDEEM_FLOOR_MS = 1500;
/** A paired phone's login is on a reserved domain that can never receive mail. Keep in step with the app. */
const PHONE_DOMAIN = 'phone.evermore.invalid';
const PIN = /^\d{6}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Compared against when no PIN is waiting, so that path does the same work as a real comparison. */
const STAND_IN_ID = '00000000-0000-4000-8000-000000000000';
const STAND_IN_HASH = '0'.repeat(64);

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

/** A failure's kind, for the function's log. Never anything the caller sent. */
function note(kind: string) {
  console.error(`pair-phone: ${kind}`);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return reply(405, { error: 'post-only' });
  const started = Date.now();

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    body = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    body = {};
  }

  const secret = Deno.env.get('EVERMORE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const url = Deno.env.get('SUPABASE_URL');
  const pepper = Deno.env.get('PAIRING_PEPPER') ?? '';
  const configured = Boolean(secret && url && pepper.length >= 32);
  const admin = configured ? createClient(url!, secret!, { auth: { persistSession: false, autoRefreshToken: false } }) : null;

  switch (body.action) {
    case 'redeem': {
      const answer = admin ? await redeem(admin, pepper, request, body).catch(() => (note('unexpected'), failed())) : (note('not-configured'), failed());
      // The same wait for every answer, so how long it took says nothing about why.
      const wait = started + REDEEM_FLOOR_MS - Date.now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      return answer;
    }
    case 'create-pin':
    case 'revoke-device': {
      if (!admin) {
        note('not-configured');
        return reply(503, { error: 'not-configured' });
      }
      const caregiver = await caller(admin, request);
      if (caregiver instanceof Response) return caregiver;
      return body.action === 'create-pin' ? createPin(admin, pepper, caregiver) : revokeDevice(admin, caregiver, body);
    }
    default:
      return reply(400, { error: 'unknown-action' });
  }
});

const failed = () => reply(NOT_PAIRED_STATUS, NOT_PAIRED);

type Admin = ReturnType<typeof createClient>;

// ---------------------------------------------------------------------------------------
// Redeem: the person's phone
// ---------------------------------------------------------------------------------------

async function redeem(admin: Admin, pepper: string, request: Request, body: Record<string, unknown>) {
  const email = normalizedEmail(body.email);
  const pin = typeof body.pin === 'string' ? body.pin : '';
  // Keyed hashes, so the limits never store an address. The IP address is the first one forwarded:
  // a caller can make that up, which only spends their own tries; the per-email limit, the per-PIN
  // limit and the global ceiling hold whatever it says.
  const emailKey = await keyed(pepper, `email:${email}`);
  const ipKey = await keyed(pepper, `ip:${clientAddress(request)}`);

  const { data, error } = await admin.rpc('pairing_lookup', { p_email: email, p_email_key: emailKey, p_ip_key: ipKey });
  if (error) {
    note('lookup');
    return failed();
  }
  const row = (Array.isArray(data) ? data[0] : data) as { outcome?: string; pairing_id?: string | null; pin_hash?: string | null } | undefined;
  if (row?.outcome !== 'try') return failed();

  // Always one keyed hash and one full comparison, whether or not a PIN is waiting for that email.
  const waiting = typeof row.pairing_id === 'string' && typeof row.pin_hash === 'string';
  const candidate = await keyed(pepper, `pin:${waiting ? row.pairing_id : STAND_IN_ID}:${pin}`);
  const same = sameHash(candidate, waiting ? row.pin_hash! : STAND_IN_HASH);
  if (!(same && waiting && PIN.test(pin))) {
    // Counts against the waiting PIN, which is spent after a few; a no-op when nothing was waiting.
    await admin.rpc('pairing_fail', { p_pairing: waiting ? row.pairing_id : null });
    return failed();
  }

  // The right PIN: use it up first, so two phones racing with it can't both pair.
  const used = await admin.rpc('pairing_consume', { p_pairing: row.pairing_id });
  const family = typeof used.data === 'string' && UUID.test(used.data) ? used.data : null;
  if (used.error || !family) return failed();

  const login = `${crypto.randomUUID()}@${PHONE_DOMAIN}`;
  const credential = newCredential();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: login,
    password: credential,
    email_confirm: true,
    // Tells the sign-up trigger not to make a caregiver profile. Not trusted for anything.
    user_metadata: { evermore_person: true },
    app_metadata: { role: 'person' },
  });
  if (createError || !created.user) {
    note('create-user');
    return failed();
  }
  const linked = await admin.rpc('pairing_link', { p_user: created.user.id, p_family: family, p_name: deviceName(body.deviceName) });
  if (linked.error) {
    // Don't leave a login behind that belongs to nobody.
    await admin.auth.admin.deleteUser(created.user.id);
    note('link');
    return failed();
  }
  return reply(200, { login, credential });
}

/** The caregiver's email as Supabase keeps it: trimmed, lowercase. Anything that isn't one is ''. */
export function normalizedEmail(value: unknown) {
  if (typeof value !== 'string') return '';
  const email = value.normalize('NFKC').trim().toLowerCase();
  return email.length <= 254 ? email : '';
}

/** The phone's own name ("Rose's iPhone"), plain and short, or '' for "Phone 2". */
export function deviceName(value: unknown) {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFKC')
    .replace(/[\p{Cc}\p{Cf}]+/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
}

function clientAddress(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

// ---------------------------------------------------------------------------------------
// The caregiver's actions
// ---------------------------------------------------------------------------------------

/** The signed-in caregiver making the call, or the answer to give instead. */
async function caller(admin: Admin, request: Request): Promise<string | Response> {
  // Without a token, stop here: getUser() with none waits on the client's own (empty) session.
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!token) return reply(401, { error: 'signed-out' });
  const { data } = await admin.auth.getUser(token);
  return data.user?.id ?? reply(401, { error: 'signed-out' });
}

async function createPin(admin: Admin, pepper: string, caregiver: string) {
  const id = crypto.randomUUID();
  const pin = newPin();
  const { data, error } = await admin.rpc('pairing_create', { p_caregiver: caregiver, p_id: id, p_hash: await keyed(pepper, `pin:${id}:${pin}`) });
  const row = (Array.isArray(data) ? data[0] : data) as { outcome?: string; expires_at?: string } | undefined;
  if (error || !row) {
    note('create-pin');
    return reply(500, { error: 'not-created' });
  }
  if (row.outcome === 'ok') return reply(200, { pin, expiresAt: new Date(row.expires_at!).toISOString() });
  if (row.outcome === 'caregivers-only') return reply(403, { error: 'caregivers-only' });
  if (row.outcome === 'busy') return reply(429, { error: 'busy' });
  return reply(503, { error: 'off' });
}

async function revokeDevice(admin: Admin, caregiver: string, body: Record<string, unknown>) {
  const device = typeof body.deviceId === 'string' && UUID.test(body.deviceId) ? body.deviceId : null;
  if (!device) return reply(400, { error: 'bad-request' });
  // Marked removed first: from this moment its login reads and writes nothing (my_caregiver).
  const { data, error } = await admin.rpc('pairing_revoke', { p_caregiver: caregiver, p_device: device });
  if (error) {
    note('revoke');
    return reply(500, { error: 'not-removed' });
  }
  const login = typeof data === 'string' && UUID.test(data) ? data : null;
  if (!login) return reply(404, { error: 'no-device' });
  // Then its session: banned logins can't refresh or sign in, and the credential it keeps stops matching.
  const { error: banError } = await admin.auth.admin.updateUserById(login, { ban_duration: '876000h', password: newCredential() });
  if (banError) note('ban');
  return reply(200, { removed: true });
}

// ---------------------------------------------------------------------------------------
// Keyed hashes, comparisons and random values
// ---------------------------------------------------------------------------------------

const encoder = new TextEncoder();

/** HMAC-SHA256 of the message, keyed with the pepper, as 64 hex characters. */
async function keyed(pepper: string, message: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(pepper), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
  return Array.from(signature, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Every character compared, whatever the first difference, so the time says nothing. */
export function sameHash(a: string, b: string) {
  let difference = a.length ^ b.length;
  for (let i = 0; i < 64; i++) difference |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return difference === 0;
}

/** Six digits, each equally likely. */
function newPin() {
  // The largest multiple of a million under 2^32, so the remainder isn't biased.
  const limit = 4_294_000_000;
  const value = new Uint32Array(1);
  do crypto.getRandomValues(value);
  while (value[0] >= limit);
  return String(value[0] % 1_000_000).padStart(6, '0');
}

/**
 * The phone's credential: 256 random bits. The fixed ending gives it every kind of character, so it
 * passes any password rule the project sets.
 */
function newCredential() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const text = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${text}-Aa1`;
}
