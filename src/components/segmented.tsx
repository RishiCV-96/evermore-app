import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Colors } from '@/theme/colors';
import { Elevation } from '@/theme/elevation';
import { COMPACT_TAP, RADIUS, Space } from '@/theme/layout';

type SegmentedProps<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** What the choice is about, for screen readers. */
  label: string;
  testID?: string;
  /** The track and the chosen option's words in another color, as on Insights' pinks. */
  accent?: { track: string; text: string };
};

/** Two or three views of the same thing, side by side on a soft track: the chosen one sits on white. */
export function Segmented<T extends string>({ options, value, onChange, label, testID, accent }: SegmentedProps<T>) {
  return (
    <View testID={testID} accessibilityRole="tablist" accessibilityLabel={label} style={[styles.track, accent && { backgroundColor: accent.track }]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            testID={testID ? `${testID}-${option.value}` : undefined}
            accessibilityRole="tab"
            aria-selected={selected}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [styles.option, selected && styles.selected, pressed && !selected && styles.pressed]}>
            <AppText fit center bold={selected} size="caption" color={selected ? (accent?.text ?? Colors.text) : Colors.textMuted}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: Space.xs,
    gap: Space.xs,
    borderRadius: RADIUS,
    backgroundColor: Colors.surface,
  },
  option: {
    flex: 1,
    minHeight: COMPACT_TAP,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Space.s,
    borderRadius: RADIUS - Space.xs,
  },
  // Concentric: the track's 16 less its 4pt padding. A hairline edge marks it as a shape, not only a color.
  selected: {
    backgroundColor: Colors.background,
    ...Elevation.edge,
  },
  pressed: {
    backgroundColor: Colors.skySoft,
  },
});
