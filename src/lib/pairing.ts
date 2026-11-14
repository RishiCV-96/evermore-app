// The words and rules of pairing the person's phone, pure so scripts/check-auth.mjs can check them: the
// caregiver's PIN and its countdown (Settings, "Pair the person's phone"), the Linked phones list, and
// the person's two steps of "Create my account" (screen 1). Nothing here says whether an email has an
// account, a PIN was wrong or it expired: every failure reads the same.

/** A PIN is six digits. */
export const PIN_LENGTH = 6;

/** The one answer to every failed pairing, whatever the reason, on the person's phone. */
export const PAIR_NOT_MATCHED = 'That did not work. Please check with your caregiver.';

/** "482 913": the PIN in two halves, easier to read out and to type. */
export function pinForDisplay(pin: string) {
  return `${pin.slice(0, 3)} ${pin.slice(3)}`;
}

/** "4 8 2 9 1 3", so a screen reader says each digit. */
export function pinForScreenReader(pin: string) {
  return pin.split('').join(' ');
}

/** "Expires in 14:59", counting down on the caregiver's screen, or null once it has expired. */
export function expiresIn(expiresAt: number, now: number) {
  const left = Math.ceil((expiresAt - now) / 1000);
  if (left <= 0) return null;
  return `Expires in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
}

/** The same for a screen reader, in whole minutes, so it isn't read out every second. */
export function expiresInWords(expiresAt: number, now: number) {
  const minutes = Math.ceil((expiresAt - now) / 60000);
  if (minutes <= 0) return 'Expired';
  return minutes === 1 ? 'Expires in less than a minute' : `Expires in ${minutes} minutes`;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function dayWords(date: Date, now: Date) {
  const start = (day: Date) => new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  const days = Math.round((start(now) - start(date)) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `on ${MONTHS[date.getMonth()]} ${date.getDate()}${date.getFullYear() === now.getFullYear() ? '' : `, ${date.getFullYear()}`}`;
}

function timeWords(date: Date) {
  const hours = date.getHours();
  return `${hours % 12 || 12}:${String(date.getMinutes()).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`;
}

/** "Paired today", "Paired yesterday", "Paired on November 4". */
export function pairedWords(pairedAt: string, now = new Date()) {
  return `Paired ${dayWords(new Date(pairedAt), now)}`;
}

/** "Last seen today at 3:42 PM", or "Not seen since it was paired". */
export function lastSeenWords(lastSeenAt: string | null, now = new Date()) {
  if (!lastSeenAt) return 'Not seen since it was paired';
  const date = new Date(lastSeenAt);
  return `Last seen ${dayWords(date, now)} at ${timeWords(date)}`;
}

/** "1 phone", "2 phones", "None yet": the Settings row's value. */
export function phonesCount(count: number) {
  if (count === 0) return 'None yet';
  return count === 1 ? '1 phone' : `${count} phones`;
}

// ---------------------------------------------------------------------------------------
// The person's two steps: only that something sensible is typed, in gentle words
// ---------------------------------------------------------------------------------------

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function pairEmailProblem(email: string): string | undefined {
  const value = email.trim();
  if (!value) return 'Please type your caregiver’s email.';
  if (!EMAIL.test(value)) return 'Please check the email. It looks like name@example.com.';
  return undefined;
}

/** Only the digits, at most six: what the PIN box keeps, however it was typed or pasted. */
export function pinDigits(typed: string) {
  return typed.replace(/\D/g, '').slice(0, PIN_LENGTH);
}

export function pinProblem(pin: string): string | undefined {
  if (!pin) return 'Please type the PIN.';
  if (pin.length !== PIN_LENGTH) return `The PIN has ${PIN_LENGTH} numbers.`;
  return undefined;
}

/** The phone's own name for the caregiver's list ("Rose’s iPhone"), plain and short, or '' for "Phone 2". */
export function phoneName(raw: string | null | undefined) {
  return (raw ?? '')
    .normalize('NFKC')
    .replace(/[\p{Cc}\p{Cf}]+/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
}
