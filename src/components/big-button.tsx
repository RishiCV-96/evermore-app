import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Pressed } from '@/components/pressed';
import { useAccent } from '@/theme/accent';
import { Colors } from '@/theme/colors';
import { COMPACT_TAP, RADIUS, Space, TAP, touchSlop } from '@/theme/layout';
import { useCompact } from '@/theme/type';

/** A light tap under the finger for the caregiver's main actions. Silent where the phone has none. */
function tapFeel() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

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
  /** An icon before the words, so two buttons side by side differ by more than their place ("Earlier", "Later"). */
  icon?: keyof typeof Ionicons.glyphMap;
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
  icon,
  accessibilityHint,
  accessibilityLabel,
  testID,
}: BigButtonProps) {
  const filled = primary || selected;
  const compact = useCompact();
  const accent = useAccent();
  const progressStrip =
    progress === undefined ? null : <View testID="button-progress" aria-hidden style={[styles.strip, { width: `${Math.min(progress, 100)}%` }]} />;

  if (compact) {
    // The caregiver's: an interruptible press, a light tap on the main action, and a waiting main
    // action shown as a soft button with muted words rather than a faded dark one.
    const waiting = Boolean(disabled) && primary;
    const fill = waiting ? Colors.surface : filled ? Colors.primary : quiet ? 'rgba(234, 243, 251, 0)' : Colors.surface;
    const fillPressed = filled ? Colors.primaryDark : quiet ? Colors.surface : Colors.skySoft;
    return (
      <Pressed
        testID={testID}
        accessibilityRole="button"
        accessibilityHint={accessibilityHint}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ selected, disabled }}
        disabled={disabled}
        tone={[fill, disabled ? fill : fillPressed]}
        shrink={!disabled}
        onPress={() => {
          if (primary) tapFeel();
          onPress();
        }}
        style={[styles.button, styles.compact, disabled && !waiting && styles.disabled, icon && styles.withIcon]}>
        {icon ? <Ionicons name={icon} size={20} color={waiting ? Colors.textMuted : filled ? Colors.onPrimary : quiet ? accent : Colors.text} aria-hidden /> : null}
        <AppText
          fit
          bold={filled}
          center
          size="body"
          color={waiting ? Colors.textMuted : filled ? Colors.onPrimary : quiet ? accent : Colors.text}>
          {label}
        </AppText>
        {progressStrip}
      </Pressed>
    );
  }

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      // The person's touch area is 56pt; only a quiet button is drawn smaller than that.
      hitSlop={quiet ? touchSlop(TAP) : undefined}
      style={({ pressed }) => [
        styles.button,
        small && styles.small,
        large && styles.large,
        quiet && styles.quiet,
        filled ? styles.filled : quiet ? null : styles.soft,
        pressed && (filled ? styles.filledPressed : styles.softPressed),
        pressed && styles.pressed,
        disabled && styles.disabled,
        icon && styles.withIcon,
      ]}>
      {icon ? <Ionicons name={icon} size={26} color={filled ? Colors.onPrimary : quiet ? Colors.primaryDark : Colors.text} aria-hidden /> : null}
      <AppText
        fit
        bold
        center
        size={small || quiet ? 'body' : 'title'}
        color={filled ? Colors.onPrimary : quiet ? Colors.primaryDark : Colors.text}>
        {label}
      </AppText>
      {progressStrip}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // An icon and the words side by side, centered together.
  withIcon: {
    flexDirection: 'row',
    gap: Space.s,
  },
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
