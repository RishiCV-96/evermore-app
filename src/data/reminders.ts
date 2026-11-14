import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import { studyToday } from '@/data/study-clock';
import { warnKind } from '@/lib/log';
import { deviceNotifier, openNotificationSettings, REMINDERS_AVAILABLE } from '@/lib/notifier';
import {
  cancelReminders,
  DEFAULT_REMINDERS,
  readSettings,
  rebuildReminders,
  stepTime,
  type Permission,
  type ReminderSettings,
} from '@/lib/reminders';

// The person's daily reminder on this phone (rules in src/lib/reminders.ts). Its settings live in
// AsyncStorage on this device only: never sent, never synced, never in an export, and never shown to
// the caregiver. Every change rebuilds the waiting reminders, one rebuild at a time. Signing out, or
// the phone being removed, cancels them and turns them off (src/data/forget.ts); only whether the
// gentle question was asked stays.

const KEY = 'evermore.reminders.v1';

export type Reminders = { settings: ReminderSettings; permission: Permission };

let state: Reminders | undefined;
let loading: Promise<void> | undefined;
let chain: Promise<unknown> = Promise.resolve();
/** Whether today's daily session is complete, and whether there is anything to practice, as the person's home last said. */
let sessionDone = false;
let practiceReady = false;
const listeners = new Set<() => void>();

function set(next: Reminders) {
  state = next;
  listeners.forEach((listener) => listener());
}

function load() {
  loading ??= (async () => {
    const saved = await AsyncStorage.getItem(KEY).catch(() => null);
    let settings = DEFAULT_REMINDERS;
    try {
      settings = readSettings(saved ? JSON.parse(saved) : null);
    } catch {}
    let permission: Permission = 'undetermined';
    if (REMINDERS_AVAILABLE) permission = await deviceNotifier.permission().catch(() => 'undetermined' as const);
    set({ settings, permission });
  })();
  return loading;
}

async function save(settings: ReminderSettings) {
  await AsyncStorage.setItem(KEY, JSON.stringify(settings)).catch((error) => warnKind('Could not save the reminder setting', error));
}

/** Runs one change after another, so two rebuilds never interleave. */
function queue<T>(work: () => Promise<T>) {
  const next = chain.then(work, work);
  chain = next.catch(() => undefined);
  return next;
}

/** Rebuilds the waiting reminders from the settings, today's study day and whether today is done. */
function rebuild(change?: (settings: ReminderSettings) => ReminderSettings) {
  return queue(async () => {
    if (!REMINDERS_AVAILABLE) return;
    await load();
    const settings = change ? change(state!.settings) : state!.settings;
    const now = new Date();
    const result = await rebuildReminders(deviceNotifier, settings, { now, today: studyToday(now), sessionDone, practiceReady });
    await save(result.settings);
    set(result);
  });
}

/**
 * Called by the person's home when it opens, comes to the front, moves into a new study day, and
 * whenever whether today's session is complete changes. Rebuilds only from the phone's own state.
 */
export function syncReminders(done: boolean, ready: boolean) {
  sessionDone = done;
  practiceReady = ready;
  return rebuild();
}

/** On or off. Turning on asks the system first if it hasn't been asked; refused, the choice is kept and Settings explains. */
export function setRemindersOn(on: boolean) {
  return queue(async () => {
    if (!REMINDERS_AVAILABLE) return;
    await load();
    if (on && state!.permission === 'undetermined') await deviceNotifier.request().catch(() => 'denied');
  }).then(() => rebuild((settings) => ({ ...settings, on, asked: true })));
}

/** Earlier (-1) or Later (+1), one step. */
export function stepReminderTime(steps: number) {
  return rebuild((settings) => ({ ...settings, time: stepTime(settings.time, steps) }));
}

/**
 * The one gentle question's answer. Yes asks the system; either way it is never asked again
 * automatically, and the app works the same.
 */
export function answerReminderQuestion(yes: boolean) {
  return queue(async () => {
    if (!yes || !REMINDERS_AVAILABLE) return 'denied' as Permission;
    return deviceNotifier.request().catch(() => 'denied' as Permission);
  }).then((permission) => rebuild((settings) => ({ ...settings, asked: true, on: yes && permission === 'granted' })));
}

/** Reads the permission again (it may have changed in the phone's Settings) and rebuilds. */
export const recheckReminders = () => rebuild();

/** Signed out, or the phone removed: cancels every reminder on this phone and forgets the settings, so it reminds nobody. */
export function forgetReminders() {
  return queue(async () => {
    if (!REMINDERS_AVAILABLE) return;
    await cancelReminders(deviceNotifier);
    // Only whether the gentle question was asked stays, so signing in again never asks it a second time.
    await load();
    const asked = state!.settings.asked;
    if (asked) await save({ ...DEFAULT_REMINDERS, asked });
    else await AsyncStorage.removeItem(KEY).catch(() => undefined);
    set({ settings: { ...DEFAULT_REMINDERS, asked }, permission: state!.permission });
  });
}

export { openNotificationSettings, REMINDERS_AVAILABLE };

function subscribe(listener: () => void) {
  listeners.add(listener);
  void load();
  return () => {
    listeners.delete(listener);
  };
}

/** The person's reminder settings and the permission, for their screens: undefined until read. */
export function useReminders() {
  return useSyncExternalStore(subscribe, () => state, () => undefined);
}

/** Whether the one gentle question may be shown: never asked, and the system hasn't been refused. */
export const mayAsk = (reminders: Reminders | undefined) =>
  REMINDERS_AVAILABLE && reminders !== undefined && !reminders.settings.asked && reminders.permission !== 'denied';
