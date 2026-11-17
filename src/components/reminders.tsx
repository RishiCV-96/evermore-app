import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { AppState, Platform, Pressable, StyleSheet, View } from 'react-native';

import { APP_NAME } from '@/config/brand';
import { AppText } from '@/components/app-text';
import { BigButton } from '@/components/big-button';
import { Sheet } from '@/components/sheet';
import { deckCards, doneToday, type Practice } from '@/data/app-data';
import {
  answerReminderQuestion,
  openNotificationSettings,
  recheckReminders,
  setRemindersOn,
  stepReminderTime,
  syncReminders,
  useReminders,
} from '@/data/reminders';
import { useStudyDay } from '@/data/study-clock';
import { canStep, timeLabel } from '@/lib/reminders';
import { enoughPeople } from '@/lib/session';
import { Colors } from '@/theme/colors';
import { ICON, RADIUS, Space } from '@/theme/layout';

// The person's daily reminder, on their own screens only: the one gentle question, asked once, and
// the Reminders view in their settings (the Aa sheet). Large type, big targets, no red, nothing to
// hurry. The reminder is on this phone only; the caregiver never sees or sets it.

/**
 * Keeps this phone's reminders right: when the home opens, when a new study day begins, when whether
 * today's session is complete changes, and whenever the app comes back to the front (the clock, the
 * time zone or the permission may have changed meanwhile).
 */
export function useReminderSync(practice: Practice | null | undefined) {
  const day = useStudyDay();
  useEffect(() => {
    if (!practice) return;
    const sync = () => syncReminders(doneToday(practice), enoughPeople(deckCards(practice)));
    void sync();
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void sync();
    });
    return () => subscription.remove();
  }, [practice, day]);
}

/** The one gentle question, after the person's first completed session. Either answer is final. */
export function ReminderQuestion({ visible }: { visible: boolean }) {
  return (
    <Sheet visible={visible} title="A daily reminder" onClose={() => answerReminderQuestion(false)}>
      <AppText testID="reminder-question">Would you like a gentle reminder on this phone each day to practice?</AppText>
      <View style={styles.buttons}>
        <BigButton testID="reminder-yes" label="Yes, remind me" primary onPress={() => answerReminderQuestion(true)} />
        <BigButton testID="reminder-not-now" label="Not now" onPress={() => answerReminderQuestion(false)} />
      </View>
    </Sheet>
  );
}

/** The Reminders row in the person's settings: what it is now, and a tap to change it. */
export function ReminderRow({ onPress }: { onPress: () => void }) {
  const reminders = useReminders();
  const on = reminders?.settings.on ?? false;
  return (
    <Pressable
      testID="reminders-row"
      accessibilityRole="button"
      accessibilityLabel={on ? `Reminders, on, ${timeLabel(reminders!.settings.time)}` : 'Reminders, off'}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <AppText bold style={styles.grow}>
        Reminders
      </AppText>
      <AppText muted>{on ? timeLabel(reminders!.settings.time) : 'Off'}</AppText>
      <Ionicons name="chevron-forward" size={ICON} color={Colors.textMuted} aria-hidden />
    </Pressable>
  );
}

/** Choosing On or Off, and the time. Every change is saved on this phone at once. */
export function ReminderSettings() {
  const reminders = useReminders();
  // The permission may have changed in the phone's Settings since this was last read.
  useEffect(() => {
    void recheckReminders();
  }, []);
  if (!reminders) return null;
  const { settings, permission } = reminders;
  const blocked = settings.on && permission === 'denied';
  return (
    <View style={styles.view}>
      <AppText muted>One gentle reminder a day, on this phone only.</AppText>
      <View accessibilityRole="radiogroup" style={styles.options}>
        {[
          { on: true, label: 'Remind me each day', testID: 'reminders-on' },
          { on: false, label: 'No reminders', testID: 'reminders-off' },
        ].map((option) => {
          const chosen = option.on === settings.on;
          return (
            <Pressable
              key={option.testID}
              testID={option.testID}
              accessibilityRole="radio"
              aria-checked={chosen}
              onPress={() => setRemindersOn(option.on)}
              style={({ pressed }) => [styles.option, chosen && styles.chosen, pressed && styles.pressed]}>
              <AppText bold={chosen} style={styles.grow}>
                {option.label}
              </AppText>
              {chosen ? <Ionicons name="checkmark-circle-outline" size={ICON} color={Colors.primaryDark} aria-hidden /> : null}
            </Pressable>
          );
        })}
      </View>
      {settings.on ? (
        <View style={styles.time}>
          <AppText testID="reminder-time" center bold size="title" accessibilityLiveRegion="polite">
            {`At ${timeLabel(settings.time)}`}
          </AppText>
          <View style={styles.steps}>
            <View style={styles.grow}>
              <BigButton testID="reminder-earlier" label="Earlier" disabled={!canStep(settings.time, -1)} onPress={() => stepReminderTime(-1)} />
            </View>
            <View style={styles.grow}>
              <BigButton testID="reminder-later" label="Later" disabled={!canStep(settings.time, 1)} onPress={() => stepReminderTime(1)} />
            </View>
          </View>
        </View>
      ) : null}
      {blocked ? (
        <View testID="reminders-blocked" style={styles.notice}>
          <AppText>
            {Platform.OS === 'ios'
              ? `Reminders are turned off in this iPhone’s settings. To turn them on, open Settings, then Notifications, then ${APP_NAME}.`
              : `Reminders are turned off in this phone’s settings. To turn them on, open the settings for ${APP_NAME}, then Notifications.`}
          </AppText>
          <BigButton testID="reminders-open-settings" label="Open settings" onPress={() => void openNotificationSettings()} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  buttons: {
    gap: Space.m,
  },
  view: {
    gap: Space.l,
  },
  options: {
    gap: Space.s,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.m,
    minHeight: 64,
    paddingHorizontal: Space.l,
    borderRadius: RADIUS,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.m,
    minHeight: 64,
    paddingHorizontal: Space.l,
    borderRadius: RADIUS,
    backgroundColor: Colors.surface,
  },
  chosen: {
    backgroundColor: Colors.surface,
  },
  pressed: {
    backgroundColor: Colors.skySoft,
  },
  grow: {
    flex: 1,
  },
  time: {
    gap: Space.m,
  },
  steps: {
    flexDirection: 'row',
    gap: Space.m,
  },
  notice: {
    gap: Space.m,
  },
});
