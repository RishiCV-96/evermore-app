import { Image } from 'expo-image';
import { StyleSheet, useWindowDimensions } from 'react-native';

import { useKeyboardOpen } from '@/components/use-keyboard-open';
import { GUTTER, Space } from '@/theme/layout';

// The landscape Evermore logo, the one way every screen shows it: the file as it is (never
// recolored, cropped or stretched), contained in a box of its own shape.

/** The file's own shape, width over height (1200 x 396). scripts/check-logic.mjs reads the file and keeps this in step. */
export const LOGO_ASPECT = 1200 / 396;

/** Below this height (in points) a phone counts as small, and every logo takes its smaller width. */
export const SHORT_SCREEN = 700;

/** Each place's width in points, and the width on a small phone. */
export const LOGO_SIZES = {
  /** The welcome. */
  hero: { width: 260, short: 200 },
  /** The person's home, above Start. */
  home: { width: 220, short: 160 },
  /** The sign-in steps and forms, above their fields. */
  form: { width: 168, short: 128 },
} as const;

export type LogoSize = keyof typeof LOGO_SIZES;

type LogoProps = {
  size: LogoSize;
  testID?: string;
  /** Folds away while the keyboard is up, so the fields below it keep the room. */
  foldWithKeyboard?: boolean;
};

/** The logo at one of its sizes, never wider than the screen allows. */
export function Logo({ size, testID = 'logo', foldWithKeyboard = false }: LogoProps) {
  const window = useWindowDimensions();
  const keyboardOpen = useKeyboardOpen();
  if (foldWithKeyboard && keyboardOpen) return null;
  const { width, short } = LOGO_SIZES[size];
  const shown = Math.min(window.height < SHORT_SCREEN ? short : width, window.width - 2 * GUTTER);
  return (
    <Image
      testID={testID}
      source={require('@/assets/images/logo-wordmark.png')}
      contentFit="contain"
      accessible
      accessibilityRole="image"
      accessibilityLabel="Evermore"
      style={[styles.logo, { width: shown, height: shown / LOGO_ASPECT }, size === 'form' ? styles.form : styles.large]}
    />
  );
}

const styles = StyleSheet.create({
  logo: {
    alignSelf: 'center',
  },
  large: {
    marginBottom: Space.l,
  },
  form: {
    marginVertical: Space.s,
  },
});
