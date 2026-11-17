import { useId } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Path } from 'react-native-svg';

import { LAYOUTS, LOBE_RADIUS, MARK, PALETTES } from '@/components/tandem-logo-data';
import { useKeyboardOpen } from '@/components/use-keyboard-open';
import { APP_NAME } from '@/config/brand';
import { GUTTER, Space } from '@/theme/layout';

// The logo, the one way every screen shows it, drawn from the brand kit's own shapes and colors
// (src/components/tandem-logo-data.ts, generated from brand-kit/ by scripts/make-brand-assets.mjs).
// Its box is the drawing plus one lobe radius of clear space on every side, and it keeps the kit's
// proportions: never stretched, recolored, outlined or shadowed. Never on a practice card.

export type LogoVariant = keyof typeof LAYOUTS;

/** The guide's minimum widths, in points, of the drawing itself (clear space not counted). */
export const LOGO_MINIMUM = { mark: 24, lockup: 140 } as const;

/** Below this height (in points) a phone counts as small, and every logo takes its smaller width. */
export const SHORT_SCREEN = 700;

/** Each place's version and width in points (clear space included), and the width on a small phone. */
export const LOGO_SIZES = {
  /** The welcome. */
  hero: { variant: 'stacked', width: 220, short: 170 },
  /** The person's home, above Start. */
  home: { variant: 'horizontal', width: 220, short: 170 },
  /** The sign-in steps and forms, above their fields. */
  form: { variant: 'horizontal', width: 168, short: 152 },
  /** Settings → About. */
  about: { variant: 'horizontal', width: 168, short: 168 },
  /** The caregiver dashboard's compact header. */
  header: { variant: 'mark', width: 40, short: 40 },
  /** The session wrap-up, above "All done". */
  wrapUp: { variant: 'mark', width: 120, short: 96 },
} as const satisfies Record<string, { variant: LogoVariant; width: number; short: number }>;

export type LogoSize = keyof typeof LOGO_SIZES;

/** The narrowest box (clear space included) that keeps a version's drawing at its minimum width. */
export function minimumWidth(variant: LogoVariant) {
  const [, , width] = LAYOUTS[variant].viewBox;
  const drawing = width - 2 * LOBE_RADIUS;
  return ((variant === 'mark' ? LOGO_MINIMUM.mark : LOGO_MINIMUM.lockup) * width) / drawing;
}

/** A version's box at a width, never under its minimum: the height follows the kit's proportions. */
export function logoBox(variant: LogoVariant, width: number) {
  const [, , boxWidth, boxHeight] = LAYOUTS[variant].viewBox;
  const shown = Math.max(width, minimumWidth(variant));
  return { width: shown, height: (shown * boxHeight) / boxWidth };
}

type TandemLogoProps = {
  size: LogoSize;
  /** For a dark background (Ink): the kit's reversed colors. */
  reversed?: boolean;
  testID?: string;
  /** Folds away while the keyboard is up, so the fields below it keep the room. */
  foldWithKeyboard?: boolean;
  /** Hidden from screen readers where the screen already says the name. */
  decorative?: boolean;
};

/** The logo at one of its places, never wider than the screen allows nor smaller than the guide's minimum. */
export function TandemLogo({ size, reversed = false, testID = 'logo', foldWithKeyboard = false, decorative = false }: TandemLogoProps) {
  const window = useWindowDimensions();
  const keyboardOpen = useKeyboardOpen();
  const clip = `tandem-lens-${useId().replace(/[^A-Za-z0-9]/g, '')}`;
  if (foldWithKeyboard && keyboardOpen) return null;
  const place = LOGO_SIZES[size];
  const layout = LAYOUTS[place.variant];
  const palette = PALETTES[reversed ? 'reversed' : 'normal'];
  const box = logoBox(place.variant, Math.min(window.height < SHORT_SCREEN ? place.short : place.width, window.width - 2 * GUTTER));
  const circle = ([cx, cy, r]: readonly number[], fill?: string) => <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill={fill} />;
  return (
    <View
      testID={testID}
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : 'image'}
      accessibilityLabel={decorative ? undefined : APP_NAME}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'yes'}
      style={[box, styles[size]]}>
      <Svg width={box.width} height={box.height} viewBox={layout.viewBox.join(' ')} preserveAspectRatio="xMidYMid meet" aria-hidden>
        <G transform={`translate(${layout.mark[0]}, ${layout.mark[1]})`}>
          <Defs>
            <ClipPath id={clip}>{MARK.left.map((one) => circle(one))}</ClipPath>
          </Defs>
          {MARK.left.map((one) => circle(one, palette.rose))}
          {MARK.right.map((one) => circle(one, palette.sky))}
          <G clipPath={`url(#${clip})`}>{MARK.right.map((one) => circle(one, palette.sun))}</G>
        </G>
        {'word' in layout ? <Path transform={`translate(${layout.word.at[0]}, ${layout.word.at[1]})`} d={layout.word.d} fill={palette.word} /> : null}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignSelf: 'center', marginBottom: Space.l },
  home: { alignSelf: 'center', marginBottom: Space.l },
  form: { alignSelf: 'center', marginVertical: Space.s },
  about: { alignSelf: 'center', marginVertical: Space.s },
  header: {},
  wrapUp: { alignSelf: 'center', marginBottom: Space.s },
});
