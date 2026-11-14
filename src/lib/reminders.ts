import {
  REMINDER_DAYS_AHEAD,
  REMINDER_EARLIEST,
  REMINDER_HOUR,
  REMINDER_LATEST,
  REMINDER_MINUTE,
  REMINDER_STEP_MINUTES,
} from '@/config/schedule';
import { warnKind } from '@/lib/log';
import { addStudyDays, isStudyDay, studyDayKey } from '@/lib/study-day';

// The person's daily practice reminder: a local notification on their own phone, configured there
// only. No server, no push service, nothing synced, nothing the caregiver sees. Pure apart from the
// notifier it is handed, so scripts/check-reminders.mjs can drive it with a fake clock and a fake
// notifier.
//
// A notification can't look at the app when it fires, so the app schedules only the next few days'
// reminders (REMINDER_DAYS_AHEAD) and rebuilds them on every event that could change them: opening,
// coming to the front, the day's session completed, a new study day at 05:30, a changed setting.
// Each study day has one fixed identifier, so a day can never hold two, and a day whose reminder
// has fired (it is no longer waiting) or whose time has passed counts as reminded, so a changed
// time, a changed clock or a new time zone can't remind twice in one study day. studyDayKey (src/lib/study-day.ts) is the only source of "today".

/** The one message. Generic and calm: no name, fact, photo, score, count, streak or urgency. */
export const REMINDER_TEXT = 'Your practice is ready whenever you are.';

/** Every reminder's identifier starts with this, then its study day. */
export const REMINDER_ID = 'evermore.reminder.';

export type Permission = 'granted' | 'denied' | 'undetermined';

/** What this phone keeps about reminders (AsyncStorage, this device only). */
export type ReminderSettings = {
  /** The person's choice. Off until they say yes. */
  on: boolean;
  /** Minutes after local midnight, within REMINDER_EARLIEST and REMINDER_LATEST. */
  time: number;
  /** Whether the one gentle question has been asked. Never asked again once it has. */
  asked: boolean;
  /** The last study day that has had its reminder (or whose reminder time has passed). */
  remindedThrough?: string;
  /** What was scheduled at the last rebuild: each study day and when. */
  planned?: { day: string; at: string }[];
};

export const DEFAULT_REMINDER_TIME = REMINDER_HOUR * 60 + REMINDER_MINUTE;

export const DEFAULT_REMINDERS: ReminderSettings = { on: false, time: DEFAULT_REMINDER_TIME, asked: false };

/** The device's notifications, handed in so the rules can be checked without a phone. */
export interface Notifier {
  permission(): Promise<Permission>;
  /** Asks the system, once it is allowed to; answers what the system says. */
  request(): Promise<Permission>;
  /** The identifiers of every notification waiting to fire. */
  scheduledIds(): Promise<string[]>;
  schedule(id: string, at: Date, body: string): Promise<void>;
  cancel(id: string): Promise<void>;
  /** The identifiers of notifications already shown and still in the notification list. */
  presentedIds(): Promise<string[]>;
  dismiss(id: string): Promise<void>;
}

const clampTime = (time: number) => Math.min(REMINDER_LATEST, Math.max(REMINDER_EARLIEST, Math.round(time)));

/** Saved settings, read defensively: anything missing or out of range falls back to the default. */
export function readSettings(saved: unknown): ReminderSettings {
  if (!saved || typeof saved !== 'object') return { ...DEFAULT_REMINDERS };
  const value = saved as Partial<ReminderSettings>;
  const planned = Array.isArray(value.planned)
    ? value.planned.filter((one) => isStudyDay(one?.day) && typeof one?.at === 'string' && !Number.isNaN(Date.parse(one.at)))
    : undefined;
  return {
    on: value.on === true,
    time: typeof value.time === 'number' && Number.isFinite(value.time) ? clampTime(value.time) : DEFAULT_REMINDER_TIME,
    asked: value.asked === true,
    ...(isStudyDay(value.remindedThrough) ? { remindedThrough: value.remindedThrough } : {}),
    ...(planned?.length ? { planned } : {}),
  };
}

/** Earlier or Later: the time one step on, kept within the range. */
export const stepTime = (time: number, steps: number) => clampTime(time + steps * REMINDER_STEP_MINUTES);

export const canStep = (time: number, steps: number) => stepTime(time, steps) !== time;

/** "9:00 AM", for the person's settings. */
export function timeLabel(time: number) {
  const hour = Math.floor(time / 60);
  const minute = time % 60;
  return `${hour % 12 === 0 ? 12 : hour % 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}

/** When a study day's reminder fires: that date at the chosen time, on this device's clock. */
export function reminderAt(day: string, time: number) {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date, Math.floor(time / 60), time % 60);
}

/** The later of two study days. */
const later = (a: string | undefined, b: string | undefined) => (!a ? b : !b ? a : a > b ? a : b);

/**
 * The last study day already reminded: the one saved, or any planned reminder that is no longer
 * waiting in the system (it has fired, whatever the clock says now) or whose time has come, whether
 * or not the system showed it. A day counted here never gets another.
 */
export function remindedBy(settings: ReminderSettings, now: Date, waiting?: string[]) {
  let through = settings.remindedThrough;
  for (const one of settings.planned ?? []) {
    const fired = waiting !== undefined && !waiting.includes(`${REMINDER_ID}${one.day}`);
    if (fired || Date.parse(one.at) <= now.getTime()) through = later(through, one.day);
  }
  return through;
}

type PlanInput = {
  now: Date;
  /** Today's study day on this device (src/data/study-clock.ts, never earlier than the last seen). */
  today: string;
  settings: ReminderSettings;
  /** Whether today's daily session is complete. Then today needs no reminder. */
  sessionDone: boolean;
  /** Whether there is anything to practice (two people in the deck). With nothing, no reminder at all. */
  practiceReady: boolean;
};

/**
 * The reminders to have waiting: at most one a study day, for at most REMINDER_DAYS_AHEAD days
 * from today, none at all while there is nothing to practice, none for today once the session is done, none for a day already reminded, none in
 * the past, and none whose moment would count toward another study day.
 */
export function planReminders({ now, today, settings, sessionDone, practiceReady }: PlanInput) {
  if (!settings.on || !practiceReady) return [];
  const reminded = remindedBy(settings, now);
  const plan: { day: string; at: Date }[] = [];
  for (let ahead = 0; ahead <= REMINDER_DAYS_AHEAD && plan.length < REMINDER_DAYS_AHEAD; ahead++) {
    const day = addStudyDays(today, ahead);
    if (ahead === 0 && sessionDone) continue;
    if (reminded && day <= reminded) continue;
    const at = reminderAt(day, settings.time);
    if (at.getTime() <= now.getTime()) continue;
    if (studyDayKey(at) !== day) continue;
    plan.push({ day, at });
  }
  return plan;
}

const ours = (ids: string[]) => ids.filter((id) => id.startsWith(REMINDER_ID));
const dayOfId = (id: string) => id.slice(REMINDER_ID.length);

/**
 * Cancels this phone's waiting reminders and schedules the plan, if reminders are on and allowed.
 * Never throws: a refused permission or a failing system call leaves the app working as before, and
 * logs only the kind of failure. Answers the settings to save and what the permission is now.
 */
export async function rebuildReminders(notifier: Notifier, settings: ReminderSettings, input: Omit<PlanInput, 'settings'>) {
  // What is still waiting, read first: a planned reminder that isn't has fired, even if the clock has since been set back.
  let waiting: string[] | undefined;
  try {
    waiting = ours(await notifier.scheduledIds());
  } catch (error) {
    warnKind('Could not read the reminders', error);
  }
  const remindedThrough = remindedBy(settings, input.now, waiting);
  const settled: ReminderSettings = { ...settings, ...(remindedThrough ? { remindedThrough } : {}), planned: undefined };
  let permission: Permission = 'undetermined';
  try {
    permission = await notifier.permission();
  } catch (error) {
    warnKind('Could not read the reminder permission', error);
  }
  const plan = permission === 'granted' ? planReminders({ ...input, settings: settled }) : [];
  try {
    for (const id of waiting ?? ours(await notifier.scheduledIds())) await notifier.cancel(id);
    // A reminder already in the notification list for a day that no longer needs one goes too.
    for (const id of ours(await notifier.presentedIds())) {
      const day = dayOfId(id);
      if (day < input.today || (day === input.today && input.sessionDone)) await notifier.dismiss(id);
    }
  } catch (error) {
    warnKind('Could not clear the reminders', error);
  }
  const scheduled: { day: string; at: string }[] = [];
  for (const { day, at } of plan) {
    try {
      await notifier.schedule(`${REMINDER_ID}${day}`, at, REMINDER_TEXT);
      scheduled.push({ day, at: at.toISOString() });
    } catch (error) {
      warnKind('Could not schedule a reminder', error);
    }
  }
  const next: ReminderSettings = { ...settled, ...(scheduled.length ? { planned: scheduled } : {}) };
  if (!next.planned) delete next.planned;
  return { settings: next, permission };
}

/** Cancels every waiting reminder and clears any still in the list: sign-out, a removed phone, or turned off. */
export async function cancelReminders(notifier: Notifier) {
  try {
    for (const id of ours(await notifier.scheduledIds())) await notifier.cancel(id);
    for (const id of ours(await notifier.presentedIds())) await notifier.dismiss(id);
  } catch (error) {
    warnKind('Could not cancel the reminders', error);
  }
}
