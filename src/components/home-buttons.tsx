import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BigButton } from '@/components/big-button';
import { Sheet } from '@/components/sheet';
import { LOCAL_ONLY, openCaregiver } from '@/data/app-data';
import { confirm } from '@/lib/confirm';
import { Colors } from '@/theme/colors';
import { RADIUS, Space } from '@/theme/layout';

// The two main buttons on the person's home (docs/PERSON-HOME-PLAN.md), told apart by lightness, icon
// and words, never by color alone: Start practice, Ink with white words, the largest; View dashboard,
// Sky with Ink words and an Ink outline (Sky alone is 1.84:1 on white). Both pass 7:1 for their words,
// and their backgrounds differ by 7.6:1. scripts/check-board.mjs checks, in grayscale and three kinds of
// color blindness too.

/** The tallest button on the screen. */
export const START_HEIGHT = 72;
/** The second button: tall enough for older fingers, and smaller than Start. */
export const DASHBOARD_HEIGHT = 64;

export function StartPracticeButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      testID="start"
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.button, styles.start, pressed && styles.startPressed]}>
      <Ionicons name="play" size={30} color={Colors.onPrimary} aria-hidden />
      <AppText fit bold size="title" color={Colors.onPrimary}>
        {label}
      </AppText>
    </Pressable>
  );
}

/**
 * The way to the caregiver's dashboard, always with a second step. With sign-in off (one phone shared)
 * a confirmation opens it, as holding Caregiver does. With sign-in on, the dashboard is on the
 * caregiver's own phone: this only says so, and never signs this phone out.
 */
export function ViewDashboardButton() {
  const [explaining, setExplaining] = useState(false);

  async function press() {
    if (!LOCAL_ONLY) {
      setExplaining(true);
      return;
    }
    const sure = await confirm('Open the caregiver dashboard?', 'It’s for your caregiver.', 'Open dashboard');
    if (sure) openCaregiver();
  }

  return (
    <>
      <Pressable
        testID="view-dashboard"
        accessibilityRole="button"
        accessibilityLabel="View dashboard"
        accessibilityHint={LOCAL_ONLY ? 'Asks first, then opens the caregiver’s dashboard.' : 'Says where your caregiver’s dashboard is.'}
        onPress={press}
        style={({ pressed }) => [styles.button, styles.dashboard, pressed && styles.dashboardPressed]}>
        <Ionicons name="grid-outline" size={26} color={Colors.text} aria-hidden />
        <AppText fit bold size="body">
          View dashboard
        </AppText>
      </Pressable>
      <Sheet visible={explaining} title="Dashboard" onClose={() => setExplaining(false)}>
        <View style={styles.explain}>
          <AppText>Your caregiver’s dashboard is on their phone.</AppText>
          <BigButton testID="dashboard-done" label="Done" primary onPress={() => setExplaining(false)} />
        </View>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.m,
    paddingHorizontal: Space.xl,
    borderRadius: RADIUS,
  },
  start: {
    minHeight: START_HEIGHT,
    backgroundColor: Colors.primary,
  },
  startPressed: {
    backgroundColor: Colors.primaryDark,
  },
  dashboard: {
    minHeight: DASHBOARD_HEIGHT,
    borderWidth: 2,
    borderColor: Colors.text,
    backgroundColor: Colors.sky,
  },
  dashboardPressed: {
    backgroundColor: Colors.skySoft,
  },
  explain: {
    gap: Space.xl,
  },
});
