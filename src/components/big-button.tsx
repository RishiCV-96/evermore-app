import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Colors } from '@/theme/colors';
import { COMPACT_TAP, RADIUS, Space, TAP } from '@/theme/layout';
import { useCompact } from '@/theme/type';

type BigButtonProps = {
  label: string;
  onPress: () => void;
  /** The one main action on a screen: filled blue. */
  primary?: boolean;
  /** Label only, for actions that should stay in the background. */
  quiet?: boolean;
  /** 56 tall with a body-size label. The caregiver's screens have their own slim size. */
  small?: boolean;
  /** Taller, for the one button that starts something (Start). */
  large?: boolean;
  /** A choice that is in effect, such as "Approve". */
  selected?: boolean;
  disabled?: boolean;
  /** Echoes a percent with a thin strip along the bottom edge. */
  progress?: number;
  /** For screen readers: what it does, or why it isn't available yet. */
  accessibilityHint?: string;
  /** For screen readers, when the words on the button say less than it does. */
  accessibilityLabel?: string;
  testID?: string;
};

/** Full width and rounded. Unfilled buttons sit on the soft surface color, never in an outline. */
export function BigButton({
  label,
  onPress,
  primary = false,
  quiet = false,
  small = false,
  large = false,
  selected = false,
  disabled,
  progress,
  accessibilityHint,
  accessibilityLabel,
  testID,
}: BigButtonProps) {
  const filled = primary || selected;
  const compact = useCompact();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        small && styles.small,
        large && styles.large,
        quiet && styles.quiet,
        compact && styles.compact,
        filled ? styles.filled : quiet ? null : styles.soft,
        pressed && (filled ? styles.filledPressed : styles.softPressed),
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}>
      <AppText
        fit
        bold={!compact || filled}
        center
        size={small || quiet || compact ? 'body' : 'title'}
        color={filled ? Colors.onPrimary : quiet ? Colors.primaryDark : Colors.text}>
        {label}
      </AppText>
      {progress === undefined ? null : (
        <View testID="button-progress" aria-hidden style={[styles.strip, { width: `${Math.min(progress, 100)}%` }]} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 64,
    paddingHorizontal: Space.xl,
    paddingVertical: Space.m,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS,
    overflow: 'hidden',
  },
  strip: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    height: Space.xs,
    backgroundColor: Colors.sky,
  },
  // Narrow padding, so three fit in a row ("Approve", "Edit", "Skip").
  small: {
    minHeight: 56,
    paddingHorizontal: Space.s,
  },
  large: {
    minHeight: 72,
  },
  quiet: {
    minHeight: TAP,
    paddingVertical: Space.s,
  },
  compact: {
    minHeight: COMPACT_TAP,
    paddingHorizontal: Space.m,
    paddingVertical: Space.s,
  },
  filled: {
    backgroundColor: Colors.primary,
  },
  filledPressed: {
    backgroundColor: Colors.primaryDark,
  },
  soft: {
    backgroundColor: Colors.surface,
  },
  softPressed: {
    backgroundColor: Colors.skySoft,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.5,
  },
});
