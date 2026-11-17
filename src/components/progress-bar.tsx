import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { useProgressColor } from '@/theme/accent';
import { RADIUS, Space } from '@/theme/layout';
import { useCompact } from '@/theme/type';

type ProgressBarProps = {
  completed: number;
  goal: number;
  /** Without the words, for the top of a practice card. */
  bare?: boolean;
  /** What it counts, when it isn't cards finished today. */
  label?: string;
};

/** Cards finished today against the day's target. It counts finished cards only, never how they went. */
export function ProgressBar({ completed, goal, bare = false, label: ownLabel }: ProgressBarProps) {
  const shown = Math.min(completed, goal);
  const label = ownLabel ?? (completed > goal ? `${completed} cards today` : `${shown} of ${goal} cards today`);
  const fraction = goal > 0 ? shown / goal : 0;
  // Eases to its new length when a card is finished.
  const fill = useSharedValue(fraction);
  useEffect(() => {
    fill.set(withTiming(fraction, { duration: 400, easing: Easing.out(Easing.cubic) }));
  }, [fill, fraction]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.get() * 100}%` }));
  const compact = useCompact();
  const color = useProgressColor();

  return (
    <View
      testID="progress"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: goal, now: shown }}
      style={styles.wrap}>
      <View style={[styles.track, compact && styles.trackCompact, { borderColor: color }]}>
        <Animated.View style={[styles.fill, fillStyle, { backgroundColor: color }]} />
      </View>
      {bare ? null : (
        <AppText fit center size="caption" bold muted>
          {label}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Space.s,
  },
  // The empty track is an outline in the bar's color, the filled part solid: both are at least 3:1 on the
  // white behind them (Ink 13.9:1 on the person's screens, Deep Rose 5.2:1 on the caregiver's).
  track: {
    height: 12,
    borderRadius: RADIUS,
    borderWidth: 2,
    overflow: 'hidden',
  },
  trackCompact: {
    height: Space.s,
    borderWidth: 1.5,
  },
  fill: {
    height: '100%',
  },
});
