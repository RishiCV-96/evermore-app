import { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Colors } from '@/theme/colors';
import { Elevation } from '@/theme/elevation';
import { COMPACT_TAP, GUTTER, RADIUS, Space } from '@/theme/layout';

/** How long a toast stays: time to reach its action, and longer with a screen reader, which has to find it first. */
const TOAST_MS = { usual: 6000, screenReader: 15000 };

export type ToastContent = {
  message: string;
  /** One action, such as Undo. The toast goes once it is tapped. */
  action?: { label: string; onPress: () => void };
};

/** A calm note pinned to the bottom of a caregiver screen for a few seconds, with one optional action. Never red. */
export function Toast({ message, action, onHide, lift }: ToastContent & { onHide: () => void; /** Sits this far above the bottom edge instead, over a tab bar. */ lift?: number }) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [screenReader, setScreenReader] = useState<boolean>();

  useEffect(() => {
    AccessibilityInfo.isScreenReaderEnabled().then(setScreenReader, () => setScreenReader(false));
    // iOS has no live regions, so the note is read out as it appears.
    AccessibilityInfo.announceForAccessibility(action ? `${message} ${action.label} is available.` : message);
  }, [message, action]);

  useEffect(() => {
    if (screenReader === undefined) return;
    const timer = setTimeout(onHide, screenReader ? TOAST_MS.screenReader : TOAST_MS.usual);
    return () => clearTimeout(timer);
  }, [screenReader, onHide]);

  return (
    <Animated.View
      entering={reduced ? undefined : FadeInDown.duration(250)}
      exiting={reduced ? undefined : FadeOut.duration(150)}
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: lift !== undefined ? lift + Space.s : insets.bottom + Space.l }]}>
      <View testID="toast" accessibilityLiveRegion="polite" style={styles.toast}>
        <AppText color={Colors.onPrimary} style={styles.message}>
          {message}
        </AppText>
        {action ? (
          <Pressable
            testID="toast-action"
            accessibilityRole="button"
            onPress={() => {
              action.onPress();
              onHide();
            }}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
            <AppText fit bold color={Colors.onPrimary}>
              {action.label}
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: GUTTER,
  },
  toast: {
    width: '100%',
    maxWidth: 640 - 2 * GUTTER,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.s,
    minHeight: COMPACT_TAP + Space.s,
    paddingVertical: Space.xs,
    paddingLeft: Space.l,
    paddingRight: Space.xs,
    borderRadius: RADIUS,
    backgroundColor: Colors.primaryDark,
    ...Elevation.lifted,
  },
  message: {
    flex: 1,
  },
  action: {
    minWidth: COMPACT_TAP,
    minHeight: COMPACT_TAP,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Space.m,
    borderRadius: RADIUS,
  },
  pressed: {
    backgroundColor: Colors.primary,
  },
});
