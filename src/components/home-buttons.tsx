import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/app-text';
import { HOME_BOARD_BUTTON } from '@/config/brand';
import { Colors } from '@/theme/colors';
import { RADIUS, Space } from '@/theme/layout';

// The two main buttons on the person's home (docs/FAMILY-BOARD-TAB-PLAN.md): equal in size, both full
// width and 72pt tall, with the same corner and the same words' size, and told apart by lightness, icon
// and words, never by color alone. Start practice: Ink with white words (13.90:1). View dashboard: Sky
// with Ink words (7.56:1) and an Ink outline (Sky alone is 1.84:1 on white). Their backgrounds differ by
// 7.6:1. scripts/check-board.mjs checks, in grayscale and three kinds of color blindness too.

/** Both buttons' height: large for older fingers, and the same, so neither looks like the lesser choice. */
export const HOME_BUTTON_HEIGHT = 72;

export function StartPracticeButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      testID="start"
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.button, styles.start, pressed && styles.startPressed]}>
      <Ionicons name="play" size={28} color={Colors.onPrimary} aria-hidden />
      <AppText fit bold size="title" color={Colors.onPrimary}>
        {label}
      </AppText>
    </Pressable>
  );
}

/**
 * Opens the person's Family board (src/app/board.tsx): the notes their family left, read only. On every
 * phone, signed in or not, because it never leads to the caregiver's screens.
 */
export function ViewDashboardButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      testID="view-dashboard"
      accessibilityRole="button"
      accessibilityLabel={HOME_BOARD_BUTTON}
      accessibilityHint="Opens your Family board, with notes from your family."
      onPress={onPress}
      style={({ pressed }) => [styles.button, styles.dashboard, pressed && styles.dashboardPressed]}>
      <Ionicons name="grid-outline" size={28} color={Colors.text} aria-hidden />
      <AppText fit bold size="title">
        {HOME_BOARD_BUTTON}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.m,
    minHeight: HOME_BUTTON_HEIGHT,
    // Room for "View dashboard" at Extra large text on a 375pt phone.
    paddingHorizontal: Space.m,
    borderRadius: RADIUS,
  },
  start: {
    backgroundColor: Colors.primary,
  },
  startPressed: {
    backgroundColor: Colors.primaryDark,
  },
  dashboard: {
    borderWidth: 2,
    borderColor: Colors.text,
    backgroundColor: Colors.sky,
  },
  dashboardPressed: {
    backgroundColor: Colors.skySoft,
  },
});
