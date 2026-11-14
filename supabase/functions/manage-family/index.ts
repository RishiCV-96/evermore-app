// manage-family: the only Evermore code that uses the secret (service-role) key. It runs on
// Supabase, never in the app. A signed-in caregiver calls it to:
//   create-person   make the login for the person they practice with
//   reset-person    give that login a new password (and optionally a new User ID)
//   delete-family   delete every photo, row and login in their family group, paired phones included
//
// The key comes from the EVERMORE_SECRET_KEY secret you set in Supabase (falling back to the
// SUPABASE_SERVICE_ROLE_KEY Supabase provides). Deploy steps are in README.md.
import { createClient } from 'npm:@supabase/supabase-js@2';

// A person signs in with a User ID, not an email. Their login email is derived from it on a
// reserved domain that can never receive mail. Keep in step with src/data/account.ts.
const PERSON_EMAIL_DOMAIN = 'person.evermore.invalid';
const USERNAME = /^[a-z0-9._-]{3,30}$/;
const MIN_PASSWORD = 8;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const secret = Deno.env.get('EVERMORE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!secret) return reply(500, { error: 'not-configured' });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Who is asking: the caller's own access token, checked with Supabase Auth. Without one,
  // stop here: getUser() with no token waits on the client's own (empty) session instead.
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!token) return reply(401, { error: 'signed-out' });
  const { data: auth } = await admin.auth.getUser(token);
  const caregiverId = auth.user?.id;
  if (!caregiverId) return reply(401, { error: 'signed-out' });
  const { data: me, error: meError } = await admin.from('profiles').select('role').eq('id', caregiverId).maybeSingle();
  // A read error here means the function's own key or grants are wrong, not the caller.
  if (meError) return reply(500, { error: 'server-cannot-read' });
  if (me?.role !== 'caregiver') return reply(403, { error: 'caregivers-only' });

  let body: { action?: string; username?: string; password?: string; displayName?: string };
  try {
    body = await request.json();
  } catch {
    return reply(400, { error: 'bad-request' });
  }

  // The family's User ID login ("Their login"). Phones paired with a PIN (the pair-phone function) are
  // person logins too, with no User ID, so a family may have several person logins but one of these.
  const { data: person } = await admin
    .from('profiles')
    .select('id, username')
    .eq('caregiver_id', caregiverId)
    .eq('role', 'person')
    .not('username', 'is', null)
    .maybeSingle();

  const username = body.username?.trim().toLowerCase();
  const password = body.password ?? '';

  switch (body.action) {
    case 'create-person': {
      if (person) return reply(409, { error: 'already-has-person' });
      if (!username || !USERNAME.test(username)) return reply(400, { error: 'bad-username' });
      if (password.length < MIN_PASSWORD) return reply(400, { error: 'short-password' });
      if (await usernameTaken(admin, username)) return reply(409, { error: 'username-taken' });

      const { data: created, error } = await admin.auth.admin.createUser({
        email: `${username}@${PERSON_EMAIL_DOMAIN}`,
        password,
        email_confirm: true,
        // Tells the sign-up trigger not to make a caregiver profile. Not trusted for anything.
        user_metadata: { evermore_person: true },
        app_metadata: { role: 'person' },
      });
      if (error || !created.user) {
        return reply(409, { error: /already|exists|registered/i.test(error?.message ?? '') ? 'username-taken' : 'create-failed' });
      }
      const { error: profileError } = await admin.from('profiles').insert({
        id: created.user.id,
        role: 'person',
        caregiver_id: caregiverId,
        username,
        display_name: (body.displayName ?? '').trim().slice(0, 60),
      });
      if (profileError) {
        // Don't leave a login behind that has no profile.
        await admin.auth.admin.deleteUser(created.user.id);
        return reply(409, { error: profileError.code === '23505' ? 'username-taken' : 'create-failed' });
      }
      return reply(200, { username });
    }

    case 'reset-person': {
      if (!person) return reply(404, { error: 'no-person' });
      if (password.length < MIN_PASSWORD) return reply(400, { error: 'short-password' });
      const newUsername = username && username !== person.username ? username : null;
      if (newUsername && !USERNAME.test(newUsername)) return reply(400, { error: 'bad-username' });
      if (newUsername && (await usernameTaken(admin, newUsername))) return reply(409, { error: 'username-taken' });

      const { error } = await admin.auth.admin.updateUserById(person.id, {
        password,
        ...(newUsername ? { email: `${newUsername}@${PERSON_EMAIL_DOMAIN}`, email_confirm: true } : {}),
      });
      if (error) return reply(500, { error: 'reset-failed' });
      if (newUsername) await admin.from('profiles').update({ username: newUsername }).eq('id', person.id);
      // Supabase revokes the person's refresh tokens when the password changes, so a phone
      // that is signed in keeps working until its access token expires (up to an hour), then
      // returns to the sign-in screen for the new password.
      return reply(200, { username: newUsername ?? person.username });
    }

    case 'delete-family': {
      // Photos first: the storage API is the only way to remove the files themselves.
      const folder = caregiverId;
      for (;;) {
        const { data: files, error } = await admin.storage.from('photos').list(folder, { limit: 1000 });
        if (error) return reply(500, { error: 'photos-not-deleted' });
        if (!files.length) break;
        const { error: removeError } = await admin.storage.from('photos').remove(files.map((file) => `${folder}/${file.name}`));
        if (removeError) return reply(500, { error: 'photos-not-deleted' });
      }
      // Deleting the logins removes every row: all family tables cascade from profiles. Every person
      // login goes: the User ID login and each paired phone's, removed or not.
      const { data: logins, error: loginsError } = await admin.from('profiles').select('id').eq('caregiver_id', caregiverId).eq('role', 'person');
      if (loginsError) return reply(500, { error: 'not-deleted' });
      for (const login of logins ?? []) {
        const { error } = await admin.auth.admin.deleteUser(login.id);
        if (error) return reply(500, { error: 'not-deleted' });
      }
      const { error } = await admin.auth.admin.deleteUser(caregiverId);
      if (error) return reply(500, { error: 'not-deleted' });
      return reply(200, { deleted: true });
    }

    default:
      return reply(400, { error: 'unknown-action' });
  }
});

async function usernameTaken(admin: ReturnType<typeof createClient>, username: string) {
  const { data } = await admin.from('profiles').select('id').eq('username', username).maybeSingle();
  return Boolean(data);
}
