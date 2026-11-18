import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Pressed } from '@/components/pressed';
import { TAB_BAR } from '@/lib/caregiver-tabs';
import { useAccent } from '@/theme/accent';
import { Colors } from '@/theme/colors';
import { COMPACT_MAX_SCALE, Fonts, MIN_FONT_SCALE } from '@/theme/type';
import { COMPACT_TAP, Radius, Space } from '@/theme/layout';

export type TabItem<T extends string> = {
  id: T;
  label: string;
  /** The icon, drawn in `color`: filled when its tab is chosen. */
  icon: (selected: boolean, color: string) => ReactNode;
  /** The chosen tab's icon and label color; the caregiver's Deep Rose unless given (Insights has its own pink). */
  accent?: string;
};

type TabsProps<T extends string> = {
  tabs: TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
  /** The short bar over the chosen tab: a shape, so Rose may draw it (never as text or an icon). */
  indicator: string;
  onLayout?: (event: LayoutChangeEvent) => void;
};

/**
 * The caregiver's tab bar, pinned at the bottom over a hairline: six tabs, each an icon over a short
 * label, every one a full sixth of the width and at least 44pt tall. The chosen tab has a short bar
 * along its top edge and its icon and label in the accent; the others are muted Ink, never pink.
 * Labels stay on one line (src/lib/caregiver-tabs.ts checks they fit at every width). A press is the
 * caregiver's interruptible one, with a light tap under the finger.
 */
export function Tabs<T extends string>({ tabs, active, onChange, indicator, onLayout }: TabsProps<T>) {
  const accent = useAccent();
  const insets = useSafeAreaInsets();
  return (
    <View accessibilityRole="tablist" onLayout={onLayout} style={[styles.bar, { paddingBottom: Math.max(insets.bottom, Space.s) }]}>
      {tabs.map((tab) => {
        const selected = tab.id === active;
        const color = selected ? (tab.accent ?? accent) : Colors.textMuted;
        return (
          <Pressed
            key={tab.id}
            testID={`tab-${tab.id}`}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            aria-selected={selected}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
              onChange(tab.id);
            }}
            tone={[Colors.background, Colors.surface]}
            style={styles.tab}>
            <View style={[styles.indicator, selected && { backgroundColor: indicator }]} />
            <View style={styles.icon}>{tab.icon(selected, color)}</View>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={MIN_FONT_SCALE}
              maxFontSizeMultiplier={COMPACT_MAX_SCALE}
              style={[styles.label, { color, fontFamily: selected ? Fonts.bold : Fonts.regular }]}>
              {tab.label}
            </Text>
          </Pressed>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    paddingHorizontal: TAB_BAR.bar,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.divider,
    backgroundColor: Colors.background,
  },
  tab: {
    flex: 1,
    minHeight: COMPACT_TAP + Space.s,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: TAB_BAR.side,
    paddingBottom: Space.xs,
    borderRadius: Radius.control,
  },
  // A short bar at the top edge of the chosen tab, over the hairline.
  indicator: {
    width: 28,
    height: 3,
    marginBottom: Space.xs,
    borderBottomLeftRadius: Radius.xs,
    borderBottomRightRadius: Radius.xs,
  },
  icon: {
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: TAB_BAR.label,
    lineHeight: Math.round(TAB_BAR.label * 1.3),
    textAlign: 'center',
    alignSelf: 'stretch',
  },
});
