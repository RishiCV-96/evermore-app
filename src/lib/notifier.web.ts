import type { Notifier, Permission } from '@/lib/reminders';

// The web build is only for checking screens, and has no notifications. This stand-in keeps the
// permission and what is scheduled in localStorage, so a walk can see the person's Reminders and
// read what would be waiting. A walk may seed `permission: 'denied'` to see the calm line.
const KEY = 'evermore.reminderStandIn.v1';

type StandIn = { permission: Permission; scheduled: { id: string; at: string; body: string }[] };

function read(): StandIn {
  try {
    const saved = JSON.parse(globalThis.localStorage?.getItem(KEY) ?? 'null');
    if (saved && Array.isArray(saved.scheduled)) return saved;
  } catch {}
  return { permission: 'undetermined', scheduled: [] };
}

function write(standIn: StandIn) {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(standIn));
  } catch {}
}

export const REMINDERS_AVAILABLE = true;

export const deviceNotifier: Notifier = {
  async permission() {
    return read().permission;
  },
  async request() {
    const standIn = read();
    if (standIn.permission === 'undetermined') write({ ...standIn, permission: 'granted' });
    return read().permission;
  },
  async scheduledIds() {
    return read().scheduled.map((one) => one.id);
  },
  async schedule(id, at, body) {
    const standIn = read();
    write({ ...standIn, scheduled: [...standIn.scheduled.filter((one) => one.id !== id), { id, at: at.toISOString(), body }] });
  },
  async cancel(id) {
    const standIn = read();
    write({ ...standIn, scheduled: standIn.scheduled.filter((one) => one.id !== id) });
  },
  async presentedIds() {
    return [];
  },
  async dismiss() {},
};

export async function openNotificationSettings() {}
