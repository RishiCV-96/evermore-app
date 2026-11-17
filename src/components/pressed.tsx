import type { ReactNode } from 'react';
import { Pressable, type GestureResponderEvent, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { EASE_OUT, Motion } from '@/theme/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type PressedProps = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  /** The surface at rest and pressed, crossfaded. Leave out to keep the surface as it is. */
  tone?: [rest: string, pressed: string];
  /** Shrinks a little while held. Off for rows that run the full width, where it would read as a jolt. */
  shrink?: boolean;
  children: ReactNode;
};

/**
 * The caregiver's pressed state: a touch smaller (0.97) and a tone darker, in 120ms. It follows the
 * finger from wherever it is, so a quick tap or a press that slides off turns around smoothly. With
 * Reduce Motion it only changes tone. Not for the person's screens, which keep their own press.
 */
export function Pressed({ style, tone, shrink = true, onPressIn, onPressOut, children, ...props }: PressedProps) {
  const reduced = useReducedMotion();
  const held = useSharedValue(0);
  const timing = { duration: Motion.press.duration, easing: EASE_OUT };

  const look = useAnimatedStyle(() => ({
    ...(shrink && !reduced ? { transform: [{ scale: 1 - (1 - Motion.press.scale) * held.get() }] } : null),
    ...(tone ? { backgroundColor: interpolateColor(held.get(), [0, 1], tone) } : null),
  }));

  return (
    <AnimatedPressable
      {...props}
      onPressIn={(event: GestureResponderEvent) => {
        held.set(withTiming(1, timing));
        onPressIn?.(event);
      }}
      onPressOut={(event: GestureResponderEvent) => {
        held.set(withTiming(0, timing));
        onPressOut?.(event);
      }}
      style={[style, look]}>
      {children}
    </AnimatedPressable>
  );
}
