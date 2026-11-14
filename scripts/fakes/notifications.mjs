// expo-notifications on a phone, in memory, for scripts/check-auth.mjs: the permission, what is
// scheduled and what is shown, so a check can see that signing out leaves no reminder behind.

export const notifications = { permission: 'granted', scheduled: new Map(), presented: new Set() };

export const AndroidImportance = { DEFAULT: 3 };
export const IosAuthorizationStatus = { NOT_DETERMINED: 0, DENIED: 1, AUTHORIZED: 2, PROVISIONAL: 3, EPHEMERAL: 4 };
export const SchedulableTriggerInputTypes = { DATE: 'date' };

const status = () => ({
  status: notifications.permission,
  granted: notifications.permission === 'granted',
  ios: { status: { granted: 2, denied: 1, undetermined: 0 }[notifications.permission] },
});

export function setNotificationHandler() {}
export async function setNotificationChannelAsync() {}
export async function getPermissionsAsync() {
  return status();
}
export async function requestPermissionsAsync() {
  if (notifications.permission === 'undetermined') notifications.permission = 'granted';
  return status();
}
export async function getAllScheduledNotificationsAsync() {
  return [...notifications.scheduled.keys()].map((identifier) => ({ identifier }));
}
export async function scheduleNotificationAsync({ identifier, content, trigger }) {
  notifications.scheduled.set(identifier, { content, trigger });
  return identifier;
}
export async function cancelScheduledNotificationAsync(identifier) {
  notifications.scheduled.delete(identifier);
}
export async function getPresentedNotificationsAsync() {
  return [...notifications.presented].map((identifier) => ({ request: { identifier } }));
}
export async function dismissNotificationAsync(identifier) {
  notifications.presented.delete(identifier);
}
