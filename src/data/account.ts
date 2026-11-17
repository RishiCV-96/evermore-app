import AsyncStorage from '@react-native-async-storage/async-storage';
import { FunctionsHttpError, type Session } from '@supabase/supabase-js';
import { useSyncExternalStore } from 'react';

import { MANAGE_FAMILY_FUNCTION } from '@/config/functions';
import { LOCKED_OUT, MIN_PASSWORD, OFFLINE, SOMETHING, authProblem, unreachable, type AuthContext, type AuthFailure, type AuthReason } from '@/lib/auth-form';
import { NEED_POLICY, signUpData, type Agreement } from '@/lib/consent';
import { forgetOlderCredential } from '@/lib/session-storage';
import { forgetKeptSession, keptSessionUser, supabase } from '@/lib/supabase';

// Who is signed in, and every account action. Screens read useAccount() and re-render when
// someone signs in or out. The profile is cached on the phone so the person's home screen
// still opens without a connection.

export type Role = 'caregiver' | 'person';

export type Profile = {
  id: string;
  role: Role;
  displayName: string;
  /** For a person: their caregiver. */
  caregiverId: string | null;
  /** For a person: their User ID. */
  username: string | null;
  createdAt: string;
};

export type Account =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; profile: Profile; email: string | null };

// A person signs in with a User ID. Their login email is made from it on a reserved domain
// that can never receive mail. Keep in step with supabase/functions/manage-family.
const PERSON_EMAIL_DOMAIN = 'person.evermore.invalid';
export const USERNAME_PATTERN = /^[a-z0-9._-]{3,30}$/;
export { MIN_PASSWORD } from '@/lib/auth-form';

let account: Account = { status: 'loading' };
let started = false;
const listeners = new Set<() => void>();

function set(next: Account) {
  account = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!started) {
    started = true;
    void openFromPhone();
    supabase.auth.onAuthStateChange((event, session) => {
      // Supabase asks that no other auth calls run inside this callback.
      setTimeout(() => onSession(session), 0);
    });
  }
  return () => {
    listeners.delete(listener);
  };
}

export function useAccount() {
  return useSyncExternalStore(subscribe, () => account, () => account);
}

/** The same store outside React: who is signed in now, and a listener for changes. */
export const accountNow = () => account;
export const watchAccount = subscribe;

/** The signed-in profile, for code that only runs while signed in. */
export function currentProfile() {
  if (account.status !== 'signed-in') throw new Error('Nobody is signed in.');
  return account.profile;
}

const profileKey = (id: string) => `evermore.profile.${id}`;

/** The profile and email saved last time, so the app opens without a connection. */
async function savedProfile(id: string): Promise<{ profile: Profile; email: string | null } | null> {
  const saved = await AsyncStorage.getItem(profileKey(id)).catch(() => null);
  if (!saved) return null;
  try {
    const { email = null, ...profile } = JSON.parse(saved) as Profile & { email?: string | null };
    return profile.id === id ? { profile, email } : null;
  } catch {
    return null;
  }
}

/**
 * A phone that signed in opens straight to its home, from the session and profile it kept, without
 * waiting for supabase-js. With an expired token and no connection supabase-js keeps retrying the
 * refresh for about 25 seconds before it says anything, and the splash screen would wait that long.
 * What supabase-js decides afterwards still counts: a session the server refused signs out.
 */
async function openFromPhone() {
  const kept = await keptSessionUser();
  const saved = kept ? await savedProfile(kept) : null;
  if (saved && account.status === 'loading') set({ status: 'signed-in', ...saved });
}

async function onSession(session: Session | null) {
  // A password reset in progress keeps the caregiver on its step until the new password is saved.
  if (resetHold) {
    resetHold.session = session;
    return;
  }
  if (!session) {
    // supabase-js says there is no session when it couldn't refresh an expired one for want of a
    // connection, though it keeps it to try again. This phone is still signed in then: it opens on
    // the profile saved last time, and the session refreshes once the connection is back. A session
    // it removed (signed out here, or refused by the server) is gone, and so is the sign-in.
    const kept = await keptSessionUser();
    const saved = kept ? await savedProfile(kept) : null;
    if (saved) {
      if (account.status !== 'signed-in' || account.profile.id !== saved.profile.id) set({ status: 'signed-in', ...saved });
      return;
    }
    // Secure storage couldn't be read to tell (locked): the welcome for now, but nothing is cleared,
    // so the next launch finds the session and the copies as they were.
    if (kept === undefined) {
      set({ status: 'signed-out' });
      return;
    }
    await signedOut();
    return;
  }
  if (account.status === 'signed-in' && account.profile.id === session.user.id) return;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, display_name, caregiver_id, username, created_at')
    .eq('id', session.user.id)
    .maybeSingle();

  const email = session.user.email ?? null;
  if (data) {
    const profile: Profile = {
      id: data.id,
      role: data.role,
      displayName: data.display_name,
      caregiverId: data.caregiver_id,
      username: data.username,
      createdAt: data.created_at,
    };
    AsyncStorage.setItem(profileKey(profile.id), JSON.stringify({ ...profile, email })).catch(() => {});
    set({ status: 'signed-in', profile, email });
    return;
  }
  if (error) {
    // Probably offline: use the profile saved last time. With none saved, the welcome for now, and the
    // session stays for when the connection is back.
    const saved = await savedProfile(session.user.id);
    set(saved ? { status: 'signed-in', profile: saved.profile, email } : { status: 'signed-out' });
    return;
  }
  // A login with no profile (deleted, or not made through the app) can't do anything.
  await supabase.auth.signOut({ scope: 'local' });
  await signedOut();
}

// ---------------------------------------------------------------------------------------
// Signing out. Whatever this phone kept from the server for that login goes with it: the stores
// register what to clear (src/data/forget.ts), and the saved profile goes here.
// ---------------------------------------------------------------------------------------

type Cleanup = (profile: Profile) => Promise<unknown> | unknown;
const beforeSignOut: Cleanup[] = [];
const afterSignOut: Cleanup[] = [];

/** `before` runs while the session still works (sending what is waiting); `after` once it is gone. */
export function onSignOut({ before, after }: { before?: Cleanup; after?: Cleanup }) {
  if (before) beforeSignOut.push(before);
  if (after) afterSignOut.push(after);
}

/** The most a sign-out waits for anything still being sent before it goes ahead. */
export const SIGN_OUT_WAIT_MS = 4000;

/**
 * Signed out, however it happened: nothing kept from the server stays. That is the login signed in
 * just now and any other this phone kept a profile for (say, one whose session the server refused
 * before this run of the app saw it), so a signed-out phone holds no one's server data.
 */
async function signedOut() {
  const profiles = new Map<string, Profile>();
  if (account.status === 'signed-in') profiles.set(account.profile.id, account.profile);
  if (account.status !== 'signed-out') set({ status: 'signed-out' });
  // However it signed out, a credential an earlier release kept on this phone goes too.
  await forgetOlderCredential();
  const keys = (await AsyncStorage.getAllKeys().catch(() => [] as string[])).filter((key) => key.startsWith(profileKey('')));
  for (const key of keys) {
    const saved = await savedProfile(key.slice(profileKey('').length));
    if (saved) profiles.set(saved.profile.id, saved.profile);
  }
  if (keys.length) await AsyncStorage.multiRemove(keys).catch(() => undefined);
  for (const profile of profiles.values()) await Promise.allSettled(afterSignOut.map(async (cleanup) => cleanup(profile)));
}

/**
 * Signs this phone out: its session, and every copy of server data kept for that login. With no
 * connection the server can't be told, so the phone forgets the session by itself (it then simply
 * expires on the server, unused).
 */
export async function signOut() {
  const profile = account.status === 'signed-in' ? account.profile : null;
  if (profile) {
    const waited = Promise.allSettled(beforeSignOut.map(async (cleanup) => cleanup(profile)));
    await Promise.race([waited, new Promise((resolve) => setTimeout(resolve, SIGN_OUT_WAIT_MS))]);
  }
  const { error } = await supabase.auth.signOut({ scope: 'local' }).catch((thrown) => ({ error: thrown }));
  if (error) await forgetKeptSession();
  await signedOut();
}

// ---------------------------------------------------------------------------------------
// Signing in, with a short pause after repeated misses. Supabase has its own limits too, and
// its "too many" answers get the same calm words (src/lib/auth-form.ts).
// ---------------------------------------------------------------------------------------

const LOCKOUT_AFTER = 5;
const LOCKOUT_MS = 60_000;
let misses = 0;
let lockedUntil = 0;

export function isLockedOut() {
  return Date.now() < lockedUntil;
}

export function personEmail(username: string) {
  return `${username.trim().toLowerCase()}@${PERSON_EMAIL_DOMAIN}`;
}

/** What an account action came to. A reason says why it didn't work, for screens that act on it. */
export type Result = { ok: true } | { ok: false; message: string; reason: AuthReason };

const failed = (failure: AuthFailure, context: AuthContext): Result => ({ ok: false, ...authProblem(failure, context) });

export async function signIn(role: Role, userId: string, password: string): Promise<Result> {
  if (isLockedOut()) return { ok: false, message: LOCKED_OUT, reason: 'busy' };
  const email = role === 'person' ? personEmail(userId) : userId.trim();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (!error) {
    misses = 0;
    return { ok: true };
  }
  const result = failed(error, role === 'person' ? 'person' : 'sign-in');
  if (!result.ok && result.reason === 'credentials' && ++misses >= LOCKOUT_AFTER) {
    misses = 0;
    lockedUntil = Date.now() + LOCKOUT_MS;
    return { ok: false, message: LOCKED_OUT, reason: 'busy' };
  }
  return result;
}

// ---------------------------------------------------------------------------------------
// Caregiver accounts: sign-up with consent, the confirmation email, passwords.
// ---------------------------------------------------------------------------------------

/**
 * Signs up a caregiver, with both agreements the database requires (src/lib/consent.ts): the privacy
 * policy and the responsibility statement, at the policy's version, and the optional research choice. With "Confirm email" off in
 * Supabase the account is signed in at once; with it on, Supabase sends a confirmation email and
 * checkEmail is true. Which one comes from Supabase's answer, never from a setting here. An address
 * that already has an account gets the same "check your email" with Confirm email on (Supabase
 * sends nothing and says nothing), and neutral words with it off.
 */
export async function signUpCaregiver(email: string, password: string, agreement: Agreement): Promise<Result & { checkEmail?: boolean }> {
  // Both agreements, or nothing is sent: no account, and no email or password leaves the phone.
  const agreed = signUpData(agreement);
  if (!agreed) return { ok: false, reason: 'other', message: NEED_POLICY };
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: agreed },
  });
  if (error) return failed(error, 'sign-up');
  return { ok: true, checkEmail: !data.session };
}

/** Sends the confirmation email again. Supabase allows one a minute to an address. */
export async function resendConfirmation(email: string): Promise<Result> {
  const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim() });
  return error ? failed(error, 'email') : { ok: true };
}

/** Confirms a new caregiver's email with the code from the email, which signs them in. */
export async function confirmEmail(email: string, code: string): Promise<Result> {
  const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
  return error ? failed(error, 'code') : { ok: true };
}

/**
 * "Forgot password?": asks Supabase to email a code (the Reset password template must hold
 * {{ .Token }}: docs/FORGOT-PASSWORD.md). The same answer whether or not the address has an account,
 * so nobody can probe for accounts. That includes Supabase's "wait a minute" (429), which it gives
 * only for an address that has an account and was sent an email in the last minute: the reset step
 * keeps its own minute between sends instead. Only no connection reads differently, since it says
 * nothing about any account. Neither the email nor the code is ever logged.
 */
export async function sendPasswordReset(email: string): Promise<Result> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
  if (error && unreachable(error)) return failed(error, 'email');
  return { ok: true };
}

/**
 * A reset in progress: once the code is accepted the phone holds a session, but the caregiver stays
 * on the reset step (onSession waits) until the new password is saved, so a password Supabase refuses
 * is said there, with the chance to choose another, rather than lost behind their home.
 */
let resetHold: { session: Session | null; verified: boolean } | null = null;

/** The code was accepted and only the new password is still to be saved. */
export const resetAwaitingPassword = () => Boolean(resetHold?.verified);

/** Checks the code from the reset email, then saves the new password; saved, the caregiver is signed in. */
export async function resetPasswordWithCode(email: string, code: string, password: string): Promise<Result> {
  if (resetHold?.verified) return finishPasswordReset(password);
  const hold: NonNullable<typeof resetHold> = { session: null, verified: false };
  resetHold = hold;
  const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'recovery' });
  // The caregiver left the step while the code was being checked: nothing it brought stays.
  if (resetHold !== hold) {
    if (!error) await supabase.auth.signOut({ scope: 'local' }).catch(() => forgetKeptSession());
    return { ok: false, reason: 'other', message: SOMETHING };
  }
  if (error) {
    await releaseReset();
    return failed(error, 'code');
  }
  hold.verified = true;
  return finishPasswordReset(password);
}

/** After the code was accepted: the new password (again, if Supabase refused the last one). */
export async function finishPasswordReset(password: string): Promise<Result> {
  if (!resetHold?.verified) return { ok: false, reason: 'code', message: SOMETHING };
  const result = await setNewPassword(password);
  if (result.ok) await releaseReset();
  return result;
}

/** Leaving the reset step before the new password is saved: the session the code gave goes too. */
export async function cancelPasswordReset() {
  const held = resetHold;
  if (!held) return;
  resetHold = null;
  if (held.verified) await supabase.auth.signOut({ scope: 'local' }).catch(() => forgetKeptSession());
  else if (held.session) await onSession(held.session);
}

/** Lets the session the reset brought (or the lack of one) through, as onSession would have. */
async function releaseReset() {
  const held = resetHold;
  resetHold = null;
  if (!held) return;
  const { data } = await supabase.auth.getSession();
  const session = data.session ?? held.session;
  // A code that didn't match brought no session, and the phone stays as it was: signed out, on this step.
  if (session) await onSession(session);
}

async function setNewPassword(password: string): Promise<Result> {
  const { error } = await supabase.auth.updateUser({ password });
  return error ? failed(error, 'new-password') : { ok: true };
}

/**
 * Settings, Change password: the current password first, so a phone left unlocked can't change it,
 * then the new one. Checking it signs in again, which also counts as "recently signed in" where
 * Supabase's "Secure password change" asks for that.
 */
export async function changePassword(current: string, next: string): Promise<Result> {
  const email = account.status === 'signed-in' ? account.email : null;
  if (!email) return { ok: false, reason: 'other', message: SOMETHING };
  const { error } = await supabase.auth.signInWithPassword({ email, password: current });
  if (error) return failed(error, 'current-password');
  return setNewPassword(next);
}

// ---------------------------------------------------------------------------------------
// The person's login and deleting the family: done by the manage-family Edge Function,
// which holds the server key. The app only sends the caregiver's own session.
// ---------------------------------------------------------------------------------------

const FUNCTION_ERRORS: Record<string, string> = {
  'username-taken': 'That User ID is taken. Please choose another.',
  'bad-username': 'Use 3 to 30 lowercase letters, numbers, dots, dashes or underscores.',
  'short-password': `The password needs at least ${MIN_PASSWORD} characters.`,
  'already-has-person': 'There is already a login for the person. Open Their login to give it a new password.',
  'no-person': 'There is no login for the person yet.',
};

async function manageFamily(body: Record<string, string>): Promise<Result & { data?: Record<string, unknown> }> {
  const { data, error } = await supabase.functions.invoke(MANAGE_FAMILY_FUNCTION, { body });
  if (!error) return { ok: true, data };
  if (error instanceof FunctionsHttpError) {
    const reply = await error.context.json().catch(() => ({}));
    return { ok: false, reason: 'other', message: FUNCTION_ERRORS[reply.error] ?? 'Something didn’t work on the server. Please try again later.' };
  }
  return { ok: false, reason: 'offline', message: OFFLINE };
}

export function createPersonLogin(username: string, password: string, displayName: string) {
  return manageFamily({ action: 'create-person', username: username.trim().toLowerCase(), password, displayName });
}

export function resetPersonLogin(username: string, password: string) {
  return manageFamily({ action: 'reset-person', username: username.trim().toLowerCase(), password });
}

/** Deletes every photo, row and login in the family, then signs out here. */
export async function deleteFamily(): Promise<Result> {
  const result = await manageFamily({ action: 'delete-family' });
  if (result.ok) await signOut();
  return result;
}
