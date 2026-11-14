import * as Notifications from 'expo-notifications';
import { AndroidImportance, IosAuthorizationStatus } from 'expo-notifications';
import { Linking, Platform } from 'react-native';

import type { Notifier, Permission } from '@/lib/reminders';

// The phone's local notifications, for the person's daily reminder (src/lib/reminders.ts holds the
// rules). Local only: nothing is registered with a push service and nothing leaves the phone. Works
// in Expo Go on iOS and Android (only push needs a development build); the web build for checking
// screens uses notifier.web.ts.

/** Android shows reminders in their own channel, which the person can also turn off in the phone's settings. */
const CHANNEL = 'practice-reminder';

let prepared: Promise<void> | undefined;

/** Once: the Android channel (Android 13 shows the permission prompt only once a channel exists), and quiet in the app. */
function prepare() {
  prepared ??= (async () => {
    // A reminder that comes while the app is open shows nothing: the person is already here.
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false }),
    });
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: 'Practice reminder',
        importance: AndroidImportance.DEFAULT,
      });
    }
  })();
  return prepared;
}

function permissionOf(response: Notifications.NotificationPermissionsStatus): Permission {
  const ios = response.ios?.status;
  if (ios !== undefined) {
    if (ios === IosAuthorizationStatus.NOT_DETERMINED) return 'undetermined';
    return ios === IosAuthorizationStatus.DENIED ? 'denied' : 'granted';
  }
  if (response.granted) return 'granted';
  return response.status === 'undetermined' ? 'undetermined' : 'denied';
}

export const REMINDERS_AVAILABLE = Platform.OS === 'ios' || Platform.OS === 'android';

export const deviceNotifier: Notifier = {
  async permission() {
    return permissionOf(await Notifications.getPermissionsAsync());
  },
  async request() {
    await prepare();
    return permissionOf(await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } }));
  },
  async scheduledIds() {
    return (await Notifications.getAllScheduledNotificationsAsync()).map((request) => request.identifier);
  },
  async schedule(id, at, body) {
    await prepare();
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: { body, sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
    });
  },
  async cancel(id) {
    await Notifications.cancelScheduledNotificationAsync(id);
  },
  async presentedIds() {
    return (await Notifications.getPresentedNotificationsAsync()).map((notification) => notification.request.identifier);
  },
  async dismiss(id) {
    await Notifications.dismissNotificationAsync(id);
  },
};

/** Opens this app's page in the phone's Settings, where notifications can be turned back on. */
export function openNotificationSettings() {
  return Linking.openSettings();
}
