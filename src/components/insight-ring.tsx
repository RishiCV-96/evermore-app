import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle, G, Line, Text as SvgText } from 'react-native-svg';

import { AppText } from '@/components/app-text';
import { BAND_PINK } from '@/components/score-key';
import { SCORE_BANDS, type BandName } from '@/config/insights';
import { ringGeometry } from '@/lib/insight-ring';
import { Colors } from '@/theme/colors';
import { RADIUS, Space } from '@/theme/layout';
import { Fonts } from '@/theme/type';

// The Memory score as a ring: a rounded arc from the top, clockwise, over a pale pink track, in a
// pink that deepens with the band (a low day is the lightest, never a warmer or louder color), with
// small ticks at the band cutoffs and a mark where random guessing would score. The same component
// at every size: the Insights hero, a day's sheet and a person's page. The geometry is
// src/lib/insight-ring.ts. Caregiver-only, never on a person's screen.

/** The arc's pink for each band, light to deep. Every one stands out from the pale track. */
export const ARC_PINK: Record<BandName, string> = {
  'Getting started': Colors.pink3,
  Building: Colors.pink4,
  Steady: Colors.pinkDeep,
  Strong: Colors.pinkInk,
};

const CUTOFFS = SCORE_BANDS.map((band) => band.from);
const FILL_MS = 700;

/** The arc's share as it fills on first view: an ease-out over FILL_MS, or at once with Reduce Motion. */
function useFill(animate: boolean) {
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(start);
  useEffect(() => {
    if (!animate) return;
    let frame = requestAnimationFrame(function step() {
      setNow(Date.now());
      if (Date.now() - start < FILL_MS) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [animate, start]);
  const t = animate ? Math.min(1, (now - start) / FILL_MS) : 1;
  return 1 - (1 - t) ** 3;
}

type ScoreRingProps = {
  /** The score, or none: fewer cards than a score needs, or no practice. */
  score?: number;
  band?: BandName;
  /** What random guessing would score: marked on the ring. */
  chance?: number;
  /** Across, the stroke included. */
  size: number;
  /** What a screen reader hears, such as "Memory score 87 out of 100, Steady, today". */
  spoken: string;
  /** Under an empty ring: "Needs 10 cards, 4 to go". */
  emptyLine?: string;
  /** A small ring (a day's sheet, a person's page): no chance label and no band pill. */
  small?: boolean;
  /** Inside something that already says it all to a screen reader, as on a day's sheet. */
  decorative?: boolean;
  testID?: string;
};

export function ScoreRing({ score, band, chance, size, spoken, emptyLine, small = false, decorative = false, testID = 'score-ring' }: ScoreRingProps) {
  const reduced = useReducedMotion();
  const fill = useFill(!reduced);
  const stroke = Math.max(8, Math.round(size * (small ? 0.1 : 0.085)));
  const scored = score !== undefined && band !== undefined;
  const ring = ringGeometry(scored ? score * fill : undefined, size, stroke, CUTOFFS, scored ? chance : undefined, !small);
  const number = scored ? Math.round(score * fill) : undefined;

  return (
    <View
      testID={testID}
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : 'image'}
      accessibilityLabel={decorative ? undefined : spoken}
      importantForAccessibility={decorative ? 'no-hide-descendants' : undefined}
      accessibilityElementsHidden={decorative}
      style={styles.ring}>
      <View style={{ width: ring.width, height: ring.height }}>
        <Svg width={ring.width} height={ring.height}>
          <Circle
            cx={ring.cx}
            cy={ring.cy}
            r={ring.radius}
            stroke={scored ? Colors.pink1 : Colors.pink2}
            strokeWidth={scored ? stroke : Math.max(2, stroke / 3)}
            strokeDasharray={scored ? undefined : '6 6'}
            fill="none"
          />
          {scored && !ring.empty ? (
            <Circle
              testID="ring-arc"
              cx={ring.cx}
              cy={ring.cy}
              r={ring.radius}
              stroke={ARC_PINK[band]}
              strokeWidth={stroke}
              strokeDasharray={`${ring.dash[0]} ${ring.dash[1]}`}
              strokeLinecap={ring.full ? 'butt' : 'round'}
              fill="none"
              transform={`rotate(${ring.rotation} ${ring.cx} ${ring.cy})`}
            />
          ) : null}
          {ring.ticks.map((tick) => (
            <Line key={tick.value} x1={tick.inner.x} y1={tick.inner.y} x2={tick.outer.x} y2={tick.outer.y} stroke={Colors.textMuted} strokeWidth={1.5} strokeLinecap="round" />
          ))}
          {ring.chance ? (
            <G testID="ring-chance">
              <Line x1={ring.chance.inner.x} y1={ring.chance.inner.y} x2={ring.chance.outer.x} y2={ring.chance.outer.y} stroke={Colors.text} strokeWidth={2.5} strokeLinecap="round" />
              {small ? null : (
                <SvgText x={ring.chance.label.x} y={ring.chance.label.y} fontSize={11} fontFamily={Fonts.regular} fill={Colors.textMuted} textAnchor={ring.chance.anchor}>
                  chance
                </SvgText>
              )}
            </G>
          ) : null}
        </Svg>
        {/* The number in the middle, at a size set by the ring, not the text size: the ring's label says it in words. */}
        <View style={[StyleSheet.absoluteFill, styles.middle]} pointerEvents="none">
          <Text allowFontScaling={false} style={[styles.number, { fontSize: Math.round(size * (small ? 0.32 : 0.3)), color: scored ? Colors.pinkInk : Colors.textMuted }]}>
            {number === undefined ? '–' : String(number)}
          </Text>
          {scored && !small ? (
            <Text allowFontScaling={false} style={styles.outOf}>
              out of 100
            </Text>
          ) : null}
        </View>
      </View>
      {scored && !small ? (
        <View testID="ring-band" style={[styles.pill, { backgroundColor: BAND_PINK[band] }]}>
          <AppText fit bold size="caption">
            {band}
          </AppText>
        </View>
      ) : null}
      {!scored && emptyLine ? (
        <AppText testID="ring-empty" size="caption" muted center>
          {emptyLine}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    alignItems: 'center',
    gap: Space.s,
  },
  middle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  number: {
    fontFamily: Fonts.bold,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
  outOf: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: -2,
  },
  pill: {
    paddingHorizontal: Space.m,
    paddingVertical: Space.xs,
    borderRadius: RADIUS,
  },
});
