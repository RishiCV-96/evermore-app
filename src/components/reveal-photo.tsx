import { type ImageProps } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { FittedPhoto } from '@/components/person-photo';
import { Colors } from '@/theme/colors';
import { RADIUS, Space } from '@/theme/layout';

const FLIP_MS = 450;
const FADE_MS = 250;
/** Under this height the "?" and its label sit side by side. */
const SHORT_TILE = 150;

type RevealPhotoProps = {
  source: ImageProps['source'];
  /** The tile has been tapped, or the card answered. */
  shown: boolean;
  onReveal: () => void;
  style?: ViewStyle;
};

/**
 * A reveal card's picture: a large grayed-out "?" that flips over to the photo, or crossfades with
 * Reduce Motion on. The photo is there from the start, turned away, so the flip never waits for it.
 */
export function RevealPhoto({ source, shown, onReveal, style }: RevealPhotoProps) {
  const reduced = useReducedMotion();
  const [short, setShort] = useState(false);
  const turned = useSharedValue(shown ? 1 : 0);

  useEffect(() => {
    // Left to itself, Reduce Motion would skip this too. A crossfade doesn't move, so it stays.
    turned.set(withTiming(shown ? 1 : 0, { duration: reduced ? FADE_MS : FLIP_MS, easing: Easing.inOut(Easing.cubic), reduceMotion: ReduceMotion.Never }));
  }, [turned, shown, reduced]);

  const front = useAnimatedStyle(() =>
    reduced
      ? { opacity: 1 - turned.get() }
      : { opacity: turned.get() < 0.5 ? 1 : 0, transform: [{ perspective: 1200 }, { rotateY: `${turned.get() * 180}deg` }] },
  );
  const back = useAnimatedStyle(() =>
    reduced
      ? { opacity: turned.get() }
      : { opacity: turned.get() < 0.5 ? 0 : 1, transform: [{ perspective: 1200 }, { rotateY: `${turned.get() * 180 - 180}deg` }] },
  );

  return (
    <View style={[styles.area, style]} onLayout={(event) => setShort(event.nativeEvent.layout.height < SHORT_TILE)}>
      <Animated.View
        testID="reveal-back"
        pointerEvents="none"
        accessibilityElementsHidden={!shown}
        importantForAccessibility={shown ? 'auto' : 'no-hide-descendants'}
        style={[styles.face, back]}>
        <FittedPhoto source={source} style={styles.fill} />
      </Animated.View>
      <Animated.View
        testID="reveal-front"
        pointerEvents={shown ? 'none' : 'auto'}
        accessibilityElementsHidden={shown}
        importantForAccessibility={shown ? 'no-hide-descendants' : 'auto'}
        style={[styles.face, front]}>
        <Pressable
          testID="reveal-tile"
          accessibilityRole="button"
          accessibilityLabel="Hidden photo. Tap to reveal."
          disabled={shown}
          onPress={onReveal}
          style={({ pressed }) => [styles.tile, short && styles.tileShort, pressed && styles.pressed]}>
          <AppText bold muted style={short ? styles.markShort : styles.mark} accessibilityElementsHidden importantForAccessibility="no">
            ?
          </AppText>
          <AppText fit bold muted size="caption">
            Tap to reveal
          </AppText>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  area: {
    minHeight: 0,
  },
  face: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'center',
    backfaceVisibility: 'hidden',
  },
  fill: {
    flex: 1,
  },
  tile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.s,
    borderRadius: RADIUS,
    backgroundColor: Colors.divider,
  },
  tileShort: {
    flexDirection: 'row',
    gap: Space.m,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  mark: {
    fontSize: 96,
    lineHeight: 112,
  },
  markShort: {
    fontSize: 40,
    lineHeight: 48,
  },
});
