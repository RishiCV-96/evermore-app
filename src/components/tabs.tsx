import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TAB_BAR } from '@/lib/caregiver-tabs';
import { useAccent } from '@/theme/accent';
import { Colors } from '@/theme/colors';
import { COMPACT_MAX_SCALE, Fonts, MIN_FONT_SCALE } from '@/theme/type';
import { Elevation } from '@/theme/elevation';
import { COMPACT_TAP, RADIUS, Radius, Space } from '@/theme/layout';

export type TabItem<T extends string> = {
  id: T;
  label: string;
  /** The icon, drawn in `color`: filled when its tab is chosen. */
  icon: (selected: boolean, color: string) => ReactNode;
  /** The chosen tab's color and the soft pill behind its icon; the primary blues unless given (Insights is pink). */
  accent?: { color: string; soft: string };
};

type TabsProps<T extends string> = {
  tabs: TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
  onLayout?: (event: LayoutChangeEvent) => void;
};

/**
 * The caregiver's tab bar, pinned at the bottom: five tabs, each an icon over a short label, every one
 * a full fifth of the width and at least 44pt tall. The chosen tab's icon sits on a soft pill, in its
 * color. Labels stay on one line (src/lib/caregiver-tabs.ts checks they fit at every width).
 */
export function Tabs<T extends string>({ tabs, active, onChange, onLayout }: TabsProps<T>) {
  const accent = useAccent();
  const insets = useSafeAreaInsets();
  return (
    <View accessibilityRole="tablist" onLayout={onLayout} style={[styles.bar, { paddingBottom: Math.max(insets.bottom, Space.s) }]}>
      {tabs.map((tab) => {
        const selected = tab.id === active;
        const color = selected ? (tab.accent?.color ?? accent) : Colors.textMuted;
        return (
          <Pressable
            key={tab.id}
            testID={`tab-${tab.id}`}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            aria-selected={selected}
            onPress={() => onChange(tab.id)}
            style={({ pressed }) => [styles.tab, pressed && styles.pressed]}>
            <View style={[styles.pill, selected && styles.pillChosen, selected && { backgroundColor: tab.accent?.soft ?? Colors.surface }]}>{tab.icon(selected, color)}</View>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={MIN_FONT_SCALE}
              maxFontSizeMultiplier={COMPACT_MAX_SCALE}
              style={[styles.label, { color, fontFamily: selected ? Fonts.bold : Fonts.regular }]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    paddingTop: Space.xs,
    paddingHorizontal: TAB_BAR.bar,
    backgroundColor: Colors.background,
    ...Elevation.float,
  },
  tab: {
    flex: 1,
    minHeight: COMPACT_TAP + Space.s,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: TAB_BAR.side,
    borderRadius: RADIUS,
  },
  pressed: {
    backgroundColor: Colors.surface,
  },
  pill: {
    width: 52,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
  },
  // The chosen tab's soft pill, with a hairline edge so it reads as a shape, not only a color.
  pillChosen: {
    ...Elevation.edge,
  },
  label: {
    fontSize: TAB_BAR.label,
    lineHeight: Math.round(TAB_BAR.label * 1.3),
    textAlign: 'center',
    alignSelf: 'stretch',
  },
});
