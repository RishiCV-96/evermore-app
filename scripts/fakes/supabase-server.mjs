// An in-memory stand-in for a Supabase project, answering HTTP the way Supabase does, for the real
// supabase-js client: scripts/check-auth.mjs passes `standin.fetch` as the global fetch, and the
// browser walks serve it on localhost (`node scripts/fakes/supabase-server.mjs 54321`).
//
// What it covers, and only that much:
// - Auth (GoTrue): sign-up with or without "Confirm email", password sign-in, refresh with rotation,
//   sign-out, the user, a new password, reset and confirmation emails (kept in `emails`, with the code
//   and a link to "click"), resend, codes, its settings, and Supabase's limits: one email a minute to
//   an address, and a cap on sign-in tries. Errors come as GoTrue sends them (API version 2024-01-01).
//   An existing address signing up again is answered as Supabase does: an error with Confirm email
//   off, and an ordinary-looking reply that sends nothing with it on.
// - The REST API for the tables the app reads and writes, with the schema's sign-up trigger (both
//   agreements required and recorded in consents, profile, practice settings, the 5 sample people) and Row Level Security in miniature, after
//   supabase/schema.sql: a caregiver reaches their own family, the person only approved cards of
//   people in the deck, and their own practice rows; card records are insert-only for the person.
//   supabase/tests/rls.test.mjs checks the real rules.
// - Storage (signed photo links, upload, list, remove) and the manage-family function.
// Passwords are kept only as salted hashes, as Supabase does.
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

const PERSON_DOMAIN = 'person.evermore.invalid';
const USERNAME = /^[a-z0-9._-]{3,30}$/;
const SAMPLE_PEOPLE = [
  ['June', 'aunt', 'grows tomatoes and shares them every summer', 'june'],
  ['Leo', 'neighbor', 'walks his dog past the house every morning', 'leo'],
  ['Ruth', 'cousin', 'knits warm scarves for the whole family', 'ruth'],
  ['Omar', 'friend', 'plays chess at the library on Tuesdays', 'omar'],
  ['Mae', 'granddaughter', 'loves to bake banana bread', 'mae'],
];
/** A 1x1 neutral pixel, for every photo. */
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN4sOrcfwAIOwOOI6MjCQAAAABJRU5ErkJggg==', 'base64');

const b64url = (value) => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');
const hash = (salt, password) => createHash('sha256').update(`${salt}:${password}`).digest('hex');
const nowIso = () => new Date().toISOString();

const TABLE_KEYS = { card_schedule: ['card_id', 'person_user_id'], daily_goal: ['caregiver_id'] };

/** Defaults the schema gives a new row. */
const DEFAULTS = {
  people: () => ({
    relationship: '',
    photo_path: null,
    sample_portrait: null,
    hint_letter: true,
    hint_fact: true,
    hint_relationship: true,
    hint_fewer: true,
    profile_step: 0,
    best_clue: null,
    not_applicable: [],
    in_deck: false,
    include_in_practice: true,
    reveal_ok: true,
    archived_at: null,
  }),
  cards: () => ({
    status: 'pending',
    fact_type: 'memory',
    time_sensitive: false,
    as_of: null,
    memory_year: null,
    confirmed_at: null,
    source: 'caregiver',
    phrasings_off: [],
    hint_ok: true,
    photo_path: null,
    sentence: '',
  }),
  daily_goal: () => ({ goal: 5, session_length: 'standard', reveal_cards: 'sometimes' }),
  sessions: () => ({ completed_at: null, cards_completed: 0, is_sample: false }),
};

export function createStandin({ url = 'http://standin.test', functionSlug = 'dynamic-api' } = {}) {
  const settings = {
    /** "Confirm email" off in Supabase: a sign-up is signed in at once. */
    autoconfirm: false,
    /** No connection: every request fails before reaching the server. */
    offline: false,
    /** Seconds an access token lasts (Supabase: 3600). */
    accessSeconds: 3600,
    /** Seconds before an address may be sent another email (Supabase: 60). */
    emailSeconds: 60,
    /** Sign-in tries allowed before the server answers 429, or Infinity. */
    signInLimit: Infinity,
    /** Supabase's own minimum password length (its default is 6). */
    minPassword: 6,
    /** Seconds a code from an email works (Supabase's "Email OTP Expiration": 3600). */
    otpSeconds: 3600,
    /** Code checks (/verify) allowed in five minutes before the server answers 429 (Supabase: 30 per IP). */
    verifyLimit: 30,
  };
  /** When each code check came in, for verifyLimit. */
  const verifyTries = [];
  const users = []; // { id, email, salt, hash, confirmed_at, user_metadata, app_metadata, created_at }
  const sessions = new Map(); // refresh token -> { userId, sessionId, revoked }
  const emails = []; // { to, kind: 'signup' | 'recovery', code, link, at }
  const objects = new Map(); // storage path -> bytes
  const tables = { profiles: [], people: [], cards: [], daily_goal: [], sessions: [], attempts: [], card_schedule: [], attempt_records: [], consents: [] };
  /** Every request, in order: method, path and, for auth, the endpoint. Bodies are never kept. */
  const log = [];
  let signInTries = 0;
  /** Seconds the server's clock runs ahead, to expire access tokens without waiting. */
  let skew = 0;
  const now = () => Date.now() + skew * 1000;

  // ---------------------------------------------------------------------------------------
  // Auth
  // ---------------------------------------------------------------------------------------

  const userJson = (user) => ({
    id: user.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: user.email,
    email_confirmed_at: user.confirmed_at,
    confirmed_at: user.confirmed_at,
    phone: '',
    app_metadata: { provider: 'email', providers: ['email'], ...user.app_metadata },
    user_metadata: user.user_metadata,
    identities: [
      {
        identity_id: user.id,
        id: user.id,
        user_id: user.id,
        identity_data: { email: user.email, email_verified: Boolean(user.confirmed_at), phone_verified: false, sub: user.id },
        provider: 'email',
        last_sign_in_at: user.created_at,
        created_at: user.created_at,
        updated_at: user.created_at,
        email: user.email,
      },
    ],
    last_sign_in_at: user.created_at,
    created_at: user.created_at,
    updated_at: user.updated_at ?? user.created_at,
    is_anonymous: false,
  });

  function issueSession(user) {
    const sessionId = randomUUID();
    const iat = Math.floor(now() / 1000);
    const exp = iat + settings.accessSeconds;
    // The claims Supabase puts in an access token, so a session is as big as a real one (over 2 KB).
    const payload = {
      iss: `${url}/auth/v1`,
      sub: user.id,
      aud: 'authenticated',
      exp,
      iat,
      email: user.email,
      phone: '',
      app_metadata: { provider: 'email', providers: ['email'], ...user.app_metadata },
      user_metadata: { email: user.email, email_verified: Boolean(user.confirmed_at), phone_verified: false, sub: user.id, ...user.user_metadata },
      role: 'authenticated',
      aal: 'aal1',
      amr: [{ method: 'password', timestamp: iat }],
      session_id: sessionId,
      is_anonymous: false,
    };
    const access = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.${b64url('standin-signature')}`;
    const refresh = randomBytes(12).toString('hex');
    sessions.set(refresh, { userId: user.id, sessionId, revoked: false });
    return { access_token: access, token_type: 'bearer', expires_in: settings.accessSeconds, expires_at: exp, refresh_token: refresh, user: userJson(user) };
  }

  /** The user an access token belongs to, if it is still good. */
  function userOfToken(token) {
    if (!token || token.split('.').length !== 3) return null;
    let payload;
    try {
      payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    } catch {
      return null;
    }
    if (payload.exp * 1000 <= now()) return null;
    const live = [...sessions.values()].some((one) => one.sessionId === payload.session_id && !one.revoked);
    if (!live) return null;
    return users.find((user) => user.id === payload.sub) ?? null;
  }

  function authError(status, code, msg, extra = {}) {
    return json(status, { code, error_code: code, msg, ...extra }, { 'x-supabase-api-version': '2024-01-01' });
  }

  function sendEmail(to, kind) {
    const last = [...emails].reverse().find((one) => one.to === to);
    if (last && now() - last.at < settings.emailSeconds * 1000) {
      const wait = Math.ceil((last.at + settings.emailSeconds * 1000 - now()) / 1000);
      return authError(429, 'over_email_send_rate_limit', `For security purposes, you can only request this after ${wait} seconds.`);
    }
    const code = String(100000 + (randomBytes(3).readUIntBE(0, 3) % 900000));
    emails.push({ to, kind, code, link: randomBytes(10).toString('hex'), at: now() });
    return null;
  }

  /** The schema's trigger: a caregiver's profile (with consent), practice settings and sample people. */
  function signUpTrigger(user) {
    if (user.user_metadata.evermore_person) return null;
    const meta = user.user_metadata;
    if (!meta.consented_at || meta.agreed_policy !== true || meta.agreed_responsibility !== true || !/^\d{4}-\d\d-\d\d$/.test(String(meta.policy_version ?? ''))) return 'consent';
    for (const [kind, choice] of [['policy', true], ['responsibility', true], ['research', meta.research === true]]) {
      tables.consents.push({ id: randomUUID(), caregiver_id: user.id, kind, policy_version: meta.policy_version, choice, agreed_at: nowIso() });
    }
    tables.profiles.push({ id: user.id, role: 'caregiver', display_name: String(user.user_metadata.display_name ?? '').slice(0, 60), caregiver_id: null, username: null, consented_at: user.user_metadata.consented_at, created_at: user.created_at });
    tables.daily_goal.push({ caregiver_id: user.id, ...DEFAULTS.daily_goal(), updated_at: nowIso() });
    for (const [name, relationship, memory, portrait] of SAMPLE_PEOPLE) {
      const person = { id: randomUUID(), caregiver_id: user.id, name, ...DEFAULTS.people(), relationship, sample_portrait: portrait, created_at: nowIso() };
      tables.people.push(person);
      tables.cards.push({ id: randomUUID(), caregiver_id: user.id, person_id: person.id, ...DEFAULTS.cards(), memory_text: memory, sentence: `My ${relationship}, {name}, ${memory}.`, status: 'approved', created_at: nowIso() });
    }
    return null;
  }

  function createUser({ email, password, metadata = {}, confirmed = false, appMetadata = {} }) {
    const salt = randomBytes(8).toString('hex');
    const user = { id: randomUUID(), email, salt, hash: hash(salt, password), confirmed_at: confirmed ? nowIso() : null, user_metadata: metadata, app_metadata: appMetadata, created_at: nowIso() };
    users.push(user);
    return user;
  }

  function deleteUser(id) {
    const at = users.findIndex((user) => user.id === id);
    if (at >= 0) users.splice(at, 1);
    for (const session of sessions.values()) if (session.userId === id) session.revoked = true;
    const profile = tables.profiles.find((one) => one.id === id);
    if (profile?.role === 'caregiver') {
      for (const table of Object.keys(tables)) {
        tables[table] = tables[table].filter((row) => row.caregiver_id !== id && !(table === 'profiles' && row.id === id));
      }
    }
    tables.profiles = tables.profiles.filter((row) => row.id !== id);
    for (const table of ['sessions', 'attempts', 'card_schedule']) tables[table] = tables[table].filter((row) => row.person_user_id !== id);
  }

  async function auth(request, path, body) {
    const query = new URL(request.url).searchParams;
    const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (path === '/settings' && request.method === 'GET') {
      return json(200, { external: { email: true }, disable_signup: false, mailer_autoconfirm: settings.autoconfirm });
    }
    if (path === '/signup' && request.method === 'POST') {
      const email = String(body.email ?? '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return authError(400, 'validation_failed', 'Unable to validate email address: invalid format');
      if (!settings.autoconfirm && /@(example\.(com|org|net)|[^@]+\.invalid)$/.test(email)) return authError(400, 'email_address_invalid', `Email address "${email}" is invalid`);
      if (String(body.password ?? '').length < settings.minPassword) {
        return authError(422, 'weak_password', `Password should be at least ${settings.minPassword} characters.`, { weak_password: { reasons: ['length'] } });
      }
      const existing = users.find((user) => user.email === email);
      if (existing) {
        if (settings.autoconfirm) return authError(422, 'user_already_exists', 'User already registered');
        if (!existing.confirmed_at) {
          const limited = sendEmail(email, 'signup');
          if (limited) return limited;
        }
        // An address already confirmed gets an ordinary-looking reply and no email, so a sign-up can't tell.
        return json(200, { ...userJson({ ...existing, id: randomUUID(), user_metadata: {}, created_at: nowIso() }), identities: [] });
      }
      const user = createUser({ email, password: body.password, metadata: body.data ?? {}, confirmed: settings.autoconfirm });
      if (signUpTrigger(user)) {
        users.pop();
        return authError(500, 'unexpected_failure', 'Database error saving new user');
      }
      if (settings.autoconfirm) return json(200, issueSession(user));
      const limited = sendEmail(email, 'signup');
      if (limited) return limited;
      return json(200, userJson(user));
    }
    if (path === '/token' && request.method === 'POST' && query.get('grant_type') === 'password') {
      signInTries += 1;
      if (signInTries > settings.signInLimit) return authError(429, 'over_request_rate_limit', 'Request rate limit reached');
      const email = String(body.email ?? '').trim().toLowerCase();
      const user = users.find((one) => one.email === email);
      if (!user || user.hash !== hash(user.salt, String(body.password ?? ''))) return authError(400, 'invalid_credentials', 'Invalid login credentials');
      if (user.banned) return authError(400, 'user_banned', 'User is banned');
      if (!user.confirmed_at) return authError(400, 'email_not_confirmed', 'Email not confirmed');
      return json(200, issueSession(user));
    }
    if (path === '/token' && request.method === 'POST' && query.get('grant_type') === 'refresh_token') {
      const session = sessions.get(body.refresh_token);
      const user = session && !session.revoked && users.find((one) => one.id === session.userId);
      if (!user) return authError(400, 'refresh_token_not_found', 'Invalid Refresh Token: Refresh Token Not Found');
      if (user.banned) return authError(400, 'user_banned', 'Invalid Refresh Token: User Banned');
      session.revoked = true;
      const next = issueSession(user);
      sessions.get(next.refresh_token).sessionId = session.sessionId;
      const payload = JSON.parse(Buffer.from(next.access_token.split('.')[1], 'base64url').toString());
      payload.session_id = session.sessionId;
      next.access_token = `${next.access_token.split('.')[0]}.${b64url(payload)}.${next.access_token.split('.')[2]}`;
      return json(200, next);
    }
    if (path === '/logout' && request.method === 'POST') {
      let payload = {};
      try {
        payload = JSON.parse(Buffer.from(String(bearer).split('.')[1], 'base64url').toString());
      } catch {
        return authError(401, 'bad_jwt', 'invalid JWT');
      }
      for (const session of sessions.values()) if (session.sessionId === payload.session_id) session.revoked = true;
      return new Response(null, { status: 204, headers: CORS });
    }
    if (path === '/user') {
      const user = userOfToken(bearer);
      if (!user) return authError(403, 'bad_jwt', 'invalid JWT: unable to parse or verify signature, token has invalid claims: token is expired');
      if (request.method === 'GET') return json(200, userJson(user));
      if (request.method === 'PUT') {
        if (body.password !== undefined) {
          if (String(body.password).length < settings.minPassword) return authError(422, 'weak_password', `Password should be at least ${settings.minPassword} characters.`, { weak_password: { reasons: ['length'] } });
          if (user.hash === hash(user.salt, body.password)) return authError(422, 'same_password', 'New password should be different from the old password.');
          user.salt = randomBytes(8).toString('hex');
          user.hash = hash(user.salt, body.password);
          user.updated_at = nowIso();
        }
        return json(200, userJson(user));
      }
    }
    if (path === '/recover' && request.method === 'POST') {
      const email = String(body.email ?? '').trim().toLowerCase();
      if (users.some((user) => user.email === email)) {
        const limited = sendEmail(email, 'recovery');
        if (limited) return limited;
      }
      return json(200, {});
    }
    if (path === '/resend' && request.method === 'POST') {
      const email = String(body.email ?? '').trim().toLowerCase();
      const user = users.find((one) => one.email === email);
      if (user && !user.confirmed_at) {
        const limited = sendEmail(email, 'signup');
        if (limited) return limited;
      }
      return json(200, { message_id: null });
    }
    if (path === '/verify' && request.method === 'POST') {
      const email = String(body.email ?? '').trim().toLowerCase();
      const kind = body.type === 'recovery' ? 'recovery' : 'signup';
      const sent = [...emails].reverse().find((one) => one.to === email && one.kind === kind);
      const user = users.find((one) => one.email === email);
      verifyTries.push(now());
      if (verifyTries.filter((at) => at > now() - 5 * 60_000).length > settings.verifyLimit) return authError(429, 'over_request_rate_limit', 'Request rate limit reached');
      // Only the newest email's code works, once, until it expires; the same answer for an unknown address.
      const expired = sent && now() - sent.at > settings.otpSeconds * 1000;
      if (!sent || !user || sent.code !== String(body.token ?? '').trim() || sent.used || expired) return authError(403, 'otp_expired', 'Token has expired or is invalid');
      sent.used = true;
      user.confirmed_at ??= nowIso();
      return json(200, issueSession(user));
    }
    return authError(404, 'not_found', 'Not found');
  }

  // ---------------------------------------------------------------------------------------
  // The REST API, with the schema's rules in miniature
  // ---------------------------------------------------------------------------------------

  const profileOf = (userId) => tables.profiles.find((one) => one.id === userId);
  /** The profile the rules see. */
  const ruledProfile = profileOf;
  const personVisible = (person, family) =>
    person.caregiver_id === family && person.in_deck && person.include_in_practice && !person.archived_at;

  /** Whether `who` may read `row` of `table`. */
  function canRead(table, row, who) {
    if (!who) return false;
    if (who.role === 'caregiver') {
      if (table === 'profiles') return row.id === who.id || row.caregiver_id === who.id;
      return row.caregiver_id === who.id;
    }
    const family = who.caregiver_id;
    switch (table) {
      case 'profiles':
        return row.id === who.id;
      case 'people':
        return personVisible(row, family);
      case 'cards': {
        const person = tables.people.find((one) => one.id === row.person_id);
        return row.caregiver_id === family && row.status === 'approved' && (!row.time_sensitive || Boolean(row.confirmed_at)) && Boolean(person) && personVisible(person, family);
      }
      case 'daily_goal':
        return Boolean(family) && row.caregiver_id === family;
      // A person's login reads the family's sessions (since 2026-11-12, as supabase/schema.sql), never writes them.
      case 'sessions':
        return Boolean(family) && row.caregiver_id === family && !row.is_sample;
      case 'attempts':
      case 'card_schedule':
        return Boolean(family) && row.person_user_id === who.id;
      default:
        return false;
    }
  }

  /** Whether `who` may write `row` to `table` (insert or update). */
  function canWrite(table, row, who) {
    if (!who) return false;
    if (who.role === 'caregiver' && table === 'consents') return row.caregiver_id === who.id && ['policy', 'responsibility', 'research'].includes(row.kind) && (row.kind === 'research' || row.choice === true) && /^(legacy|\d{4}-\d\d-\d\d)$/.test(String(row.policy_version ?? '')) && row.agreed_at === undefined;
    if (who.role === 'caregiver') return !['profiles', 'attempt_records'].includes(table) && row.caregiver_id === who.id;
    if (['sessions', 'attempts', 'card_schedule', 'attempt_records'].includes(table)) return Boolean(who.caregiver_id) && row.person_user_id === who.id && row.caregiver_id === who.caregiver_id;
    return false;
  }

  function parseFilters(params) {
    const filters = [];
    for (const [column, raw] of params) {
      if (['select', 'order', 'offset', 'limit', 'on_conflict', 'columns'].includes(column)) continue;
      const [op, ...rest] = raw.split('.');
      const value = rest.join('.');
      filters.push((row) => compare(row[column], op, value));
    }
    return filters;
  }

  function compare(actual, op, value) {
    if (op === 'is') return value === 'null' ? actual === null || actual === undefined : String(actual) === value;
    if (op === 'in') {
      const list = value.replace(/^\(|\)$/g, '').split(',').map((one) => one.replace(/^"|"$/g, ''));
      return list.includes(String(actual));
    }
    const asTime = (one) => (typeof one === 'string' && /^\d{4}-\d\d-\d\dT/.test(one) ? new Date(one).getTime() : undefined);
    const left = asTime(actual) ?? (typeof actual === 'number' ? actual : String(actual));
    const right = asTime(value) ?? (typeof actual === 'number' ? Number(value) : value);
    switch (op) {
      case 'eq':
        return String(actual) === value;
      case 'neq':
        return String(actual) !== value;
      case 'gt':
        return left > right;
      case 'gte':
        return left >= right;
      case 'lt':
        return left < right;
      case 'lte':
        return left <= right;
      default:
        throw new Error(`The stand-in has no filter "${op}"`);
    }
  }

  const keyOf = (table, row) => (TABLE_KEYS[table] ?? ['id']).map((column) => row[column]).join('|');

  function removeRows(table, match) {
    const gone = tables[table].filter(match);
    tables[table] = tables[table].filter((row) => !match(row));
    const ids = new Set(gone.map((row) => row.id));
    if (table === 'people') {
      removeRows('cards', (row) => ids.has(row.person_id));
      removeRows('attempt_records', (row) => ids.has(row.person_id));
    }
    if (table === 'cards') {
      removeRows('card_schedule', (row) => ids.has(row.card_id));
      removeRows('attempts', (row) => ids.has(row.card_id));
    }
  }

  function rest(request, table, body) {
    if (!tables[table]) return json(404, { code: '42P01', message: `relation "public.${table}" does not exist` });
    const params = new URL(request.url).searchParams;
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const user = userOfToken(token);
    if (token && token.split('.').length === 3 && !user && token !== 'anon') return json(401, { code: 'PGRST301', message: 'JWT expired' });
    const who = user ? ruledProfile(user.id) : null;
    const filters = parseFilters(params);
    const match = (row) => filters.every((filter) => filter(row));
    const prefer = request.headers.get('prefer') ?? '';

    if (request.method === 'GET' || request.method === 'HEAD') {
      let rows = tables[table].filter((row) => canRead(table, row, who) && match(row));
      const order = params.get('order');
      if (order) {
        const keys = order.split(',').map((one) => one.split('.'));
        rows = [...rows].sort((a, b) => {
          for (const [column, direction] of keys) {
            const result = String(a[column] ?? '').localeCompare(String(b[column] ?? ''));
            if (result) return direction === 'desc' ? -result : result;
          }
          return 0;
        });
      }
      const offset = Number(params.get('offset') ?? 0);
      const limit = params.has('limit') ? Number(params.get('limit')) : Infinity;
      rows = rows.slice(offset, offset + limit);
      const columns = (params.get('select') ?? '*').split(',').map((one) => one.trim());
      const shown = columns.includes('*') ? rows : rows.map((row) => Object.fromEntries(columns.map((column) => [column, row[column] ?? null])));
      return json(200, structuredClone(shown));
    }
    if (request.method === 'POST') {
      const rows = [body].flat().map((row) => ({ ...(DEFAULTS[table]?.() ?? {}), id: row.id ?? (TABLE_KEYS[table] ? undefined : randomUUID()), created_at: nowIso(), ...row }));
      if (rows.some((row) => !canWrite(table, row, who))) return json(403, { code: '42501', message: `new row violates row-level security policy for table "${table}"` });
      const upsert = /resolution=(merge|ignore)-duplicates/.exec(prefer)?.[1];
      for (const row of rows) {
        if (table === 'attempt_records' && !tables.people.some((person) => person.id === row.person_id && person.caregiver_id === row.caregiver_id)) {
          return json(409, { code: '23503', message: 'insert or update on table "attempt_records" violates foreign key constraint' });
        }
        const at = tables[table].findIndex((existing) => keyOf(table, existing) === keyOf(table, row));
        if (at >= 0 && !upsert) return json(409, { code: '23505', message: `duplicate key value violates unique constraint "${table}_pkey"` });
      }
      for (const row of rows) {
        const at = tables[table].findIndex((existing) => keyOf(table, existing) === keyOf(table, row));
        if (at >= 0 && upsert === 'ignore') continue;
        if (at >= 0) tables[table][at] = { ...tables[table][at], ...structuredClone(row), created_at: tables[table][at].created_at };
        else tables[table].push({ ...structuredClone(row), ...(table === 'attempt_records' ? { uploaded_at: nowIso() } : {}), ...(table === 'consents' ? { agreed_at: nowIso() } : {}) });
      }
      return new Response(null, { status: 201, headers: CORS });
    }
    // Agreements are added, never changed or removed (supabase/schema.sql grants no update or delete).
    if (table === 'consents' && (request.method === 'PATCH' || request.method === 'DELETE')) return json(403, { code: '42501', message: 'permission denied for table consents' });
    if (request.method === 'PATCH') {
      for (const row of tables[table].filter((one) => canRead(table, one, who) && match(one))) {
        const next = { ...row, ...structuredClone(body) };
        if (canWrite(table, next, who)) Object.assign(row, next);
      }
      return new Response(null, { status: 204, headers: CORS });
    }
    if (request.method === 'DELETE') {
      const writable = (row) => canRead(table, row, who) && (who?.role === 'caregiver' && row.caregiver_id === who.id) && match(row);
      removeRows(table, writable);
      return new Response(null, { status: 204, headers: CORS });
    }
    return json(405, { message: 'Method not allowed' });
  }

  // ---------------------------------------------------------------------------------------
  // Storage and the manage-family function
  // ---------------------------------------------------------------------------------------

  function storage(request, path, body) {
    const user = userOfToken(request.headers.get('authorization')?.replace(/^Bearer\s+/i, ''));
    const ruled = user ? ruledProfile(user.id) : null;
    const mine = (one) => user && (ruled?.role !== 'person' || ruled.caregiver_id) && one.startsWith(`${ruled?.role === 'person' ? ruled.caregiver_id : user.id}/`);
    if (path === '/object/sign/photos' && request.method === 'POST') {
      return json(200, (body.paths ?? []).map((one) => (objects.has(one) && mine(one) ? { path: one, signedURL: `/object/sign/photos/${one}?token=standin`, error: null } : { path: one, signedURL: null, error: 'Object not found' })));
    }
    if (path.startsWith('/object/sign/photos/') && request.method === 'GET') {
      const one = decodeURIComponent(path.slice('/object/sign/photos/'.length));
      return objects.has(one) ? new Response(PIXEL, { status: 200, headers: { ...CORS, 'content-type': 'image/png' } }) : json(400, { error: 'not_found' });
    }
    if (path.startsWith('/object/photos/') && request.method === 'POST') {
      const one = decodeURIComponent(path.slice('/object/photos/'.length));
      if (!mine(one)) return json(403, { error: 'Unauthorized', message: 'new row violates row-level security policy' });
      objects.set(one, PIXEL);
      return json(200, { Key: `photos/${one}` });
    }
    if (path === '/object/photos' && request.method === 'DELETE') {
      const removed = (body.prefixes ?? []).filter((one) => objects.has(one) && mine(one));
      removed.forEach((one) => objects.delete(one));
      return json(200, removed.map((name) => ({ name })));
    }
    if (path === '/object/list/photos' && request.method === 'POST') {
      const prefix = `${body.prefix}/`;
      return json(200, [...objects.keys()].filter((one) => one.startsWith(prefix) && mine(one)).map((one) => ({ name: one.slice(prefix.length) })));
    }
    return json(404, { error: 'not_found' });
  }

  function manageFamily(request, body) {
    const user = userOfToken(request.headers.get('authorization')?.replace(/^Bearer\s+/i, ''));
    if (!user) return json(401, { error: 'signed-out' });
    if (profileOf(user.id)?.role !== 'caregiver') return json(403, { error: 'caregivers-only' });
    // The family's User ID login ("Their login").
    const person = tables.profiles.find((one) => one.caregiver_id === user.id && one.role === 'person' && one.username);
    const username = body.username?.trim().toLowerCase();
    const password = body.password ?? '';
    const taken = (name) => tables.profiles.some((one) => one.username === name) || users.some((one) => one.email === `${name}@${PERSON_DOMAIN}`);
    switch (body.action) {
      case 'create-person': {
        if (person) return json(409, { error: 'already-has-person' });
        if (!username || !USERNAME.test(username)) return json(400, { error: 'bad-username' });
        if (password.length < 8) return json(400, { error: 'short-password' });
        if (taken(username)) return json(409, { error: 'username-taken' });
        const created = createUser({ email: `${username}@${PERSON_DOMAIN}`, password, metadata: { evermore_person: true }, confirmed: true, appMetadata: { role: 'person' } });
        tables.profiles.push({ id: created.id, role: 'person', caregiver_id: user.id, username, display_name: String(body.displayName ?? '').trim().slice(0, 60), consented_at: null, created_at: nowIso() });
        return json(200, { username });
      }
      case 'reset-person': {
        if (!person) return json(404, { error: 'no-person' });
        if (password.length < 8) return json(400, { error: 'short-password' });
        const next = username && username !== person.username ? username : null;
        if (next && !USERNAME.test(next)) return json(400, { error: 'bad-username' });
        if (next && taken(next)) return json(409, { error: 'username-taken' });
        const login = users.find((one) => one.id === person.id);
        login.salt = randomBytes(8).toString('hex');
        login.hash = hash(login.salt, password);
        if (next) {
          login.email = `${next}@${PERSON_DOMAIN}`;
          person.username = next;
        }
        // As Supabase does on a new password from the admin API: every refresh token of theirs goes.
        for (const session of sessions.values()) if (session.userId === person.id) session.revoked = true;
        return json(200, { username: next ?? person.username });
      }
      case 'delete-family': {
        for (const one of [...objects.keys()]) if (one.startsWith(`${user.id}/`)) objects.delete(one);
        for (const login of tables.profiles.filter((one) => one.caregiver_id === user.id && one.role === 'person')) deleteUser(login.id);
        deleteUser(user.id);
        return json(200, { deleted: true });
      }
      default:
        return json(400, { error: 'unknown-action' });
    }
  }

  // ---------------------------------------------------------------------------------------
  // The handler
  // ---------------------------------------------------------------------------------------

  async function handle(request) {
    const { pathname, searchParams } = new URL(request.url);
    log.push({ method: request.method, path: pathname, ...(searchParams.get('grant_type') ? { grant: searchParams.get('grant_type') } : {}) });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const text = ['GET', 'HEAD'].includes(request.method) ? '' : await request.text();
    let body = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = {};
    }
    if (pathname.startsWith('/auth/v1')) return auth(request, pathname.slice('/auth/v1'.length), body);
    if (pathname.startsWith('/rest/v1/')) return rest(request, pathname.slice('/rest/v1/'.length), body);
    if (pathname.startsWith('/storage/v1')) return storage(request, pathname.slice('/storage/v1'.length), body);
    if (pathname === `/functions/v1/${functionSlug}` && request.method === 'POST') return manageFamily(request, body);
    if (pathname.startsWith('/__standin/')) return control(pathname.slice('/__standin/'.length), body);
    return json(404, { message: 'Not found' });
  }

  /** The test's own controls, over HTTP for the browser walks. */
  function control(what, body) {
    if (what === 'settings') {
      Object.assign(settings, body);
      return json(200, settings);
    }
    if (what === 'emails') return json(200, emails.map(({ to, kind, code, at }) => ({ to, kind, code, at })));
    if (what === 'click-link') return json(200, { confirmed: confirmByLink(body.email) });
    if (what === 'ready-deck') return json(200, readyDeck(body.email, body.count));
    if (what === 'legacy-consent') return json(200, { changed: legacyConsent(body.email) });
    if (what === 'expire') {
      skew += Number(body.seconds ?? settings.accessSeconds + 60);
      return json(200, { skew });
    }
    return json(404, { message: 'no such control' });
  }

  /** A caregiver as if they signed up before agreements were versioned: one 'legacy' record, so the app asks again. */
  function legacyConsent(email) {
    const caregiver = users.find((one) => one.email === email.trim().toLowerCase());
    if (!caregiver) return false;
    tables.consents = tables.consents.filter((row) => row.caregiver_id !== caregiver.id);
    tables.consents.push({ id: randomUUID(), caregiver_id: caregiver.id, kind: 'responsibility', policy_version: 'legacy', choice: true, agreed_at: nowIso() });
    return true;
  }

  /** "Clicking" the newest confirmation link sent to an address. */
  function confirmByLink(email) {
    const user = users.find((one) => one.email === email.trim().toLowerCase());
    const sent = emails.some((one) => one.to === user?.email && one.kind === 'signup');
    if (!user || !sent) return false;
    user.confirmed_at ??= nowIso();
    return true;
  }

  /**
   * Makes `count` of a caregiver's sample people complete and in the deck, as finishing their profiles
   * in the app would: an interest and a shared memory each, approved, so the person can practice.
   */
  function readyDeck(email, count = 3) {
    const caregiver = users.find((one) => one.email === email.trim().toLowerCase());
    if (!caregiver) return [];
    const people = tables.people.filter((one) => one.caregiver_id === caregiver.id).slice(0, count);
    for (const person of people) {
      person.in_deck = true;
      person.profile_step = 7;
      for (const [type, text] of [
        ['interest', 'gardening'],
        ['shared', 'went to the lake together every summer'],
      ]) {
        tables.cards.push({ id: randomUUID(), caregiver_id: caregiver.id, person_id: person.id, ...DEFAULTS.cards(), fact_type: type, memory_text: `${text}`, sentence: `My ${person.relationship}, {name}, ${type === 'interest' ? 'enjoys' : 'and I'} ${text}.`, status: 'approved', created_at: nowIso() });
      }
    }
    return people.map((one) => one.name);
  }

  async function standinFetch(input, init) {
    if (settings.offline) throw new TypeError('Network request failed');
    const request = input instanceof Request ? new Request(input, init) : new Request(String(input), init);
    return handle(request);
  }

  return {
    url,
    settings,
    users,
    emails,
    tables,
    objects,
    sessions,
    log,
    handle,
    fetch: standinFetch,
    confirmByLink,
    readyDeck,
    legacyConsent,
    /** Moves the server's clock on, so every access token issued so far has expired. */
    expireAccessTokens: (seconds = settings.accessSeconds + 60) => {
      skew += seconds;
    },
    /** Revokes every refresh token of a user, as a new password from the admin API does. */
    revokeSessions: (userId) => {
      for (const session of sessions.values()) if (session.userId === userId) session.revoked = true;
    },
    resetSignInTries: () => {
      signInTries = 0;
    },
  };
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD',
  'Access-Control-Expose-Headers': 'content-range, x-supabase-api-version',
};

function json(status, body, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json', ...headers } });
}

// Run as a server for the browser walks: node scripts/fakes/supabase-server.mjs <port>
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const port = Number(process.argv[2] ?? 54321);
  const standin = createStandin({ url: `http://localhost:${port}` });
  createServer(async (incoming, outgoing) => {
    const chunks = [];
    for await (const chunk of incoming) chunks.push(chunk);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const request = new Request(`http://localhost:${port}${incoming.url}`, { method: incoming.method, headers: incoming.headers, body: ['GET', 'HEAD'].includes(incoming.method) ? undefined : body });
    const response = await standin.handle(request);
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  }).listen(port, () => console.log(`Supabase stand-in on http://localhost:${port}`));
}
