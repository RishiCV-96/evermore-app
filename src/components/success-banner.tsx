import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { Colors } from '@/theme/colors';
import { ICON, RADIUS, Space } from '@/theme/layout';

/** A soft, warm confirmation. Never red, never a score. */
export function SuccessBanner({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <Animated.View entering={FadeInDown.duration(250)} testID={testID} accessibilityLiveRegion="polite" style={styles.banner}>
      <Ionicons name="heart-outline" size={ICON} color={Colors.onSoftSuccess} aria-hidden />
      <AppText fit bold size="title" color={Colors.onSoftSuccess} style={styles.text}>
        {children}
      </AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.m,
    paddingHorizontal: Space.l,
    paddingVertical: Space.m,
    borderRadius: RADIUS,
    backgroundColor: Colors.softSuccess,
  },
  text: {
    flexShrink: 1,
  },
});
