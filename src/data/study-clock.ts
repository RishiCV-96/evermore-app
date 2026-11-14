import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { isStudyDay, laterDay, nextStudyDayStart, studyDayKey } from '@/lib/study-day';
import { warnKind } from '@/lib/log';

// This device's study-day clock: which study day it is here (src/lib/study-day.ts), remembered so it
// only ever moves forward. A clock set back, or travel west, leaves it where it was, so no daily
// session is handed out twice. It looks again when the app comes back to the front and on a timer
// set to the next 05:30, and tells whoever shows the day, so the app moves into a new day without a
// reload. It never limits practice: it only says which day practice counts toward.

const KEY = 'evermore.studyDay.v1';

/** Looks again at least this often while open, so a sleeping timer or a changed clock can't leave the day stale. */
const RECHECK_MOST_MS = 60 * 60_000;

/** The last study day this device has seen. */
let seen: string | undefined;
let loaded = false;
let loading: Promise<void> | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
const dayListeners = new Set<(day: string) => void>();

/** Today's study day on this device, never earlier than the last one seen. */
export function studyToday(now = new Date()) {
  return laterDay(seen, studyDayKey(now));
}

/** Moves the clock on if a new study day has begun here, saves it, and tells whoever shows the day. */
export function checkStudyDay(now = new Date()) {
  const day = studyToday(now);
  if (day !== seen) {
    const changed = seen !== undefined;
    seen = day;
    AsyncStorage.setItem(KEY, day).catch((error) => warnKind('Could not save the study day', error));
    listeners.forEach((listener) => listener());
    if (changed) dayListeners.forEach((listener) => listener(day));
  }
  if (timer) clearTimeout(timer);
  const untilNext = nextStudyDayStart(now).getTime() - now.getTime() + 1000;
  timer = setTimeout(() => checkStudyDay(), Math.max(1000, Math.min(untilNext, RECHECK_MOST_MS)));
  // Where timers can hold a process open (Node, for the checks), this one never does. A no-op on phones.
  (timer as unknown as { unref?: () => void }).unref?.();
  return day;
}

function load() {
  loading ??= AsyncStorage.getItem(KEY)
    .then((saved) => {
      if (isStudyDay(saved)) seen = laterDay(seen, saved);
    })
    .catch(() => undefined)
    .finally(() => {
      loaded = true;
      checkStudyDay();
      listeners.forEach((listener) => listener());
      AppState.addEventListener('change', (state) => {
        if (state === 'active') checkStudyDay();
      });
    });
  return loading;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  void load();
  return () => {
    listeners.delete(listener);
  };
}

/** Today's study day, for a screen to show: undefined until the saved clock has been read. It changes at 05:30 while the app is open. */
export function useStudyDay() {
  return useSyncExternalStore(subscribe, () => (loaded ? seen : undefined), () => undefined);
}

/** Runs whenever a new study day begins while the app is in use, after the first. */
export function onNewStudyDay(listener: (day: string) => void) {
  dayListeners.add(listener);
  void load();
  return () => {
    dayListeners.delete(listener);
  };
}
