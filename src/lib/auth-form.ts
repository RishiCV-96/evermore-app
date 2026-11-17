// The words and rules of the sign-in forms (screen 1, Settings), pure so scripts/check-auth.mjs can
// check them: what each field needs, the password's strength hint, the resend wait, and what every
// answer from Supabase Auth means in calm, plain words. Nothing here says "wrong", "error", "invalid"
// or "failed", and no message confirms whether an account exists where Supabase doesn't.

import { APP_NAME } from '@/config/brand';
import { agreementProblems, type Agreement } from '@/lib/consent';

/** Every new password: at least this long. Longer is encouraged, never required. */
export const MIN_PASSWORD = 8;

/** Supabase lets an address be sent one email a minute; the form waits as long before "Send again". */
export const RESEND_SECONDS = 60;

/** A field's note, or nothing when it is fine. */
export type Problem = string | undefined;

const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[^\s@.]{2,}$/;

export function emailProblem(email: string): Problem {
  const value = email.trim();
  if (!value) return 'Please type your email address.';
  if (!EMAIL.test(value)) return 'Please check the email address. It looks like name@example.com.';
  return undefined;
}

/** A password being chosen: long enough, nothing more is required. */
export function newPasswordProblem(password: string): Problem {
  if (!password) return 'Please choose a password.';
  if (password.length < MIN_PASSWORD) return `Please use at least ${MIN_PASSWORD} characters.`;
  return undefined;
}

export function confirmProblem(password: string, confirm: string): Problem {
  if (!confirm) return 'Please type the password again.';
  if (confirm !== password) return 'The two passwords aren’t the same yet. Please type them again.';
  return undefined;
}

/** The fields, and the two agreements no account is made without (src/lib/consent.ts). Research is optional. */
export type SignUpForm = { email: string; password: string; confirm: string } & Agreement;
export type SignUpProblems = { email?: string; password?: string; confirm?: string; policy?: string; responsibility?: string };

export function signUpProblems({ email, password, confirm, ...agreement }: SignUpForm): SignUpProblems {
  return clean({
    email: emailProblem(email),
    password: newPasswordProblem(password),
    confirm: confirmProblem(password, confirm),
    ...agreementProblems(agreement),
  });
}

export function signInProblems({ email, password }: { email: string; password: string }) {
  return clean({ email: emailProblem(email), password: password ? undefined : 'Please type your password.' });
}

/** The person's sign-in: only that something is typed. Their User ID's shape is the caregiver's business. */
export function personProblems({ userId, password }: { userId: string; password: string }) {
  return clean({
    userId: userId.trim() ? undefined : 'Please type your User ID.',
    password: password ? undefined : 'Please type your password.',
  });
}

/** A new password with its confirmation, for a reset and for Change password. */
export function newPasswordProblems({ password, confirm }: { password: string; confirm: string }) {
  return clean({ password: newPasswordProblem(password), confirm: confirmProblem(password, confirm) });
}

function clean<T extends Record<string, string | undefined>>(problems: T): Partial<T> {
  return Object.fromEntries(Object.entries(problems).filter(([, problem]) => problem)) as Partial<T>;
}

/** True when a form has nothing left to fix. */
export const isClear = (problems: Record<string, string | undefined>) => Object.values(problems).every((problem) => !problem);

// ---------------------------------------------------------------------------------------
// The strength hint: calm words and a level from 0 to 3, mostly about length
// ---------------------------------------------------------------------------------------

export type Strength = { level: 0 | 1 | 2 | 3; words: string };

/** Passwords anyone would try first. Lowercased, and compared without spaces. */
const EASY = new Set([
  'password',
  'password1',
  'password123',
  'passw0rd',
  '12345678',
  '123456789',
  '1234567890',
  '87654321',
  'qwertyui',
  'qwerty123',
  'iloveyou',
  'iloveyou1',
  'letmein1',
  'welcome1',
  'abcdefgh',
  'abc12345',
  'evermore',
  'evermore1',
  'sunshine',
  'princess',
  'football',
  'baseball',
]);

function easyToGuess(password: string, email?: string) {
  const plain = password.toLowerCase().replace(/\s+/g, '');
  if (EASY.has(plain)) return true;
  if (/^(.)\1+$/.test(plain)) return true;
  if ('0123456789012345678901234567890'.includes(plain) || 'abcdefghijklmnopqrstuvwxyz'.includes(plain)) return true;
  const name = email?.trim().toLowerCase().split('@')[0] ?? '';
  return name.length >= 4 && plain.includes(name);
}

export function passwordStrength(password: string, email?: string): Strength {
  if (password.length < MIN_PASSWORD) return { level: 0, words: `At least ${MIN_PASSWORD} characters. A few words together are easy to remember.` };
  if (easyToGuess(password, email)) return { level: 1, words: 'Easy to guess. A few words together are stronger.' };
  if (password.length < 12) return { level: 1, words: 'Long enough. Longer is stronger.' };
  if (password.length < 16) return { level: 2, words: 'Good. A little longer is stronger still.' };
  return { level: 3, words: 'Strong.' };
}

// ---------------------------------------------------------------------------------------
// Waiting before sending another email
// ---------------------------------------------------------------------------------------

/** Whole seconds until another email may be asked for. */
export function secondsLeft(sentAt: number | undefined, now: number, seconds = RESEND_SECONDS) {
  if (sentAt === undefined) return 0;
  return Math.max(0, Math.ceil((sentAt + seconds * 1000 - now) / 1000));
}

export function resendLabel(left: number) {
  return left > 0 ? `Send again in ${left} s` : 'Send the email again';
}

// ---------------------------------------------------------------------------------------
// What an answer from Supabase Auth means, in calm words
// ---------------------------------------------------------------------------------------

/** What the form was doing. */
export type AuthContext = 'sign-in' | 'person' | 'sign-up' | 'email' | 'code' | 'new-password' | 'current-password';

/** Why it didn't work, for the screens that act on it (an unconfirmed email opens "Check your email"). */
export type AuthReason = 'offline' | 'busy' | 'unconfirmed' | 'credentials' | 'exists' | 'weak' | 'address' | 'code' | 'other';

/** The shape of supabase-js's AuthError, and of a thrown network error. */
export type AuthFailure = { name?: string; code?: string; status?: number; message?: string };

export const OFFLINE = `We couldn’t reach ${APP_NAME}. Please check the internet connection and try again.`;
export const LOCKED_OUT = 'Let’s take a short break. Please try again in a minute.';
export const TOO_MANY = 'There have been a lot of tries. Please wait a few minutes, then try again.';
export const TOO_MANY_EMAILS = 'We’ve sent a few emails already. Please wait a few minutes before asking for another.';
export const PERSON_NOT_MATCHED = 'That did not work. Please check the ID and password, or ask your caregiver.';
export const CAREGIVER_NOT_MATCHED = 'That email and password didn’t match. Please try again, or reset your password.';
export const ALREADY_THERE = 'We couldn’t make an account with that email. If you already have one, sign in or reset your password.';
export const NOT_CONFIRMED = 'Please confirm your email first. Open the link in the email we sent, then try again.';
/** After "Send code", whatever happened: never says whether the address has an account. */
export const RESET_SENT = 'If that email has an account, we have sent a code.';
export const RESET_SENT_MORE = 'It can take a few minutes. If it isn’t there, look in the spam folder.';
/** The code was accepted but Supabase refused the password: the code is used up, so only a new password is asked. */
export const RESET_CODE_ACCEPTED = 'Your code worked.';

/** A code from the email: 6 digits (Supabase allows up to 10 if its setting is changed). Spaces and dashes typed with it are dropped. */
export const codeDigits = (typed: string) => typed.replace(/\D/g, '').slice(0, 10);
export const codeProblem = (code: string): Problem => (code.length < 6 ? 'Please type the 6-digit code from the email.' : undefined);

/** Asked before Their login gets a new password (Settings): it signs the person's phone out, and changes nothing else. */
export const RESET_LOGIN_TITLE = 'Give their login a new password?';
export const RESET_LOGIN_WORDS =
  'Their phone will be signed out and will ask for the new password the next time it connects, within the hour. Only your family’s login changes. Their practice and your people are kept.';

export const CODE_NOT_MATCHED = 'That code didn’t match, or it has expired. Please check the newest email and try again.';
export const SOMETHING = 'Something didn’t work. Please try again.';

/** A request that never got an answer, or a server that couldn't give one: worth trying again. */
export function unreachable(failure: AuthFailure) {
  return failure.name === 'AuthRetryableFetchError' || !failure.status || failure.status >= 500;
}

export function authProblem(failure: AuthFailure, context: AuthContext): { message: string; reason: AuthReason } {
  const code = failure.code ?? '';
  if (unreachable(failure)) return { message: OFFLINE, reason: 'offline' };
  if (failure.status === 429 || code.startsWith('over_')) {
    return { message: context === 'email' || code === 'over_email_send_rate_limit' ? TOO_MANY_EMAILS : TOO_MANY, reason: 'busy' };
  }
  if (code === 'email_not_confirmed') return { message: NOT_CONFIRMED, reason: 'unconfirmed' };
  if (code === 'invalid_credentials' || (context === 'person' && failure.status === 400)) {
    if (context === 'person') return { message: PERSON_NOT_MATCHED, reason: 'credentials' };
    if (context === 'current-password') return { message: 'That isn’t your current password. Please try again.', reason: 'credentials' };
    return { message: CAREGIVER_NOT_MATCHED, reason: 'credentials' };
  }
  if (code === 'user_already_exists' || code === 'email_exists') return { message: ALREADY_THERE, reason: 'exists' };
  if (code === 'weak_password') return { message: 'Please choose a longer password that’s harder to guess.', reason: 'weak' };
  if (code === 'same_password') return { message: 'That’s the password you have now. Please choose a new one.', reason: 'weak' };
  if (code === 'email_address_invalid') return { message: 'Please check the email address, or use another one.', reason: 'address' };
  if (code === 'email_address_not_authorized') return { message: `${APP_NAME} can’t send email to that address yet. Please use another one.`, reason: 'address' };
  if (code === 'signup_disabled') return { message: 'New accounts can’t be made right now. Please try again later.', reason: 'other' };
  if (code === 'reauthentication_needed') return { message: 'Please sign out, sign in again, then change your password.', reason: 'other' };
  if (context === 'code' || code === 'otp_expired') return { message: CODE_NOT_MATCHED, reason: 'code' };
  return { message: SOMETHING, reason: 'other' };
}
