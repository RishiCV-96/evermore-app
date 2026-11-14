import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import type { BandName } from '@/config/insights';
import { CHANCE_LINE, scoreKey } from '@/lib/insights';
import { Colors } from '@/theme/colors';
import { COMPACT_TAP, RADIUS, Space } from '@/theme/layout';

// The key to the Memory score's ranges: a bar of the bands' pinks, light to deep, with each cutoff
// labelled, a marker where random guessing would score, and each band's name and range, which a tap
// explains. Every number comes from scoreKey (src/lib/insights.ts), which reads SCORE_BANDS: none is
// written here. Caregiver-only, under the hero, on the calendar and in "What is this score?".

const BAR = 12;

/** Each band's pink, light to deep: the calendar's shading and the key's. Every one carries `text` at 4.5:1. */
export const BAND_PINK: Record<BandName, string> = {
  'Getting started': Colors.pink1,
  Building: Colors.pink2,
  Steady: Colors.pink3,
  Strong: Colors.pink4,
};

type ScoreKeyProps = {
  chance: number;
  testID?: string;
  /** Folded into one slim bar with a "Ranges" button, as under the hero; opened, the whole key. */
  folded?: boolean;
};

export function ScoreKey({ chance, testID = 'score-key', folded = false }: ScoreKeyProps) {
  const key = scoreKey(chance);
  const [open, setOpen] = useState<string>();
  const [shown, setShown] = useState(!folded);

  // The bar is one element for screen readers: its colors in words.
  const bar = (
    <View accessible accessibilityRole="image" accessibilityLabel={key.summary}>
      <View style={styles.barArea}>
        <View style={styles.bar}>
          {key.bands.map((band) => (
            <View key={band.name} style={{ width: `${band.width}%`, backgroundColor: BAND_PINK[band.name] }} />
          ))}
        </View>
        <View testID="key-chance" style={[styles.chance, { left: `${key.chance.at}%` }]} />
      </View>
      {shown ? (
        <View style={styles.breaks}>
          {key.breaks.map((one) => (
            <AppText key={one.value} size="caption" muted center style={[styles.breakLabel, { left: `${one.at}%` }]}>
              {String(one.value)}
            </AppText>
          ))}
        </View>
      ) : null}
    </View>
  );

  return (
    <View testID={testID} style={styles.key}>
      {folded ? (
        <View style={styles.slim}>
          <View style={styles.flex}>{bar}</View>
          <Pressable
            testID={`${testID}-toggle`}
            accessibilityRole="button"
            accessibilityLabel="Memory score ranges"
            aria-expanded={shown}
            onPress={() => setShown(!shown)}
            style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}>
            <AppText fit bold size="caption" color={Colors.pinkInk}>
              Ranges
            </AppText>
            <Ionicons name={shown ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.pinkInk} aria-hidden />
          </Pressable>
        </View>
      ) : (
        <>
          <AppText fit bold size="caption">
            Memory score ranges
          </AppText>
          {bar}
        </>
      )}
      {shown ? (
        <>
          <View style={styles.chanceRow}>
            <View style={styles.chanceMark} />
            <AppText size="caption" muted style={styles.flex}>
              {`About ${key.chance.value}. ${CHANCE_LINE}`}
            </AppText>
          </View>
          <View>
            {key.bands.map((band) => (
              <View key={band.name}>
                <Pressable
                  testID={`key-band-${band.from}`}
                  accessibilityRole="button"
                  accessibilityLabel={band.spoken}
                  accessibilityHint="Shows what this range means."
                  aria-expanded={open === band.name}
                  onPress={() => setOpen(open === band.name ? undefined : band.name)}
                  style={({ pressed }) => [styles.band, pressed && styles.pressed]}>
                  <View style={[styles.swatch, { backgroundColor: BAND_PINK[band.name] }]} />
                  <AppText style={styles.flex}>{band.name}</AppText>
                  <AppText muted>{band.range}</AppText>
                </Pressable>
                {open === band.name ? (
                  <AppText testID="key-meaning" size="caption" style={styles.meaning}>
                    {band.meaning}
                  </AppText>
                ) : null}
              </View>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  key: {
    gap: Space.s,
  },
  barArea: {
    height: BAR + Space.s,
    justifyContent: 'center',
  },
  bar: {
    flexDirection: 'row',
    height: BAR,
    borderRadius: BAR / 2,
    overflow: 'hidden',
    gap: 2,
  },
  // Where random guessing would score: a mark in the text color, 4.8:1 or more on every pink.
  chance: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 3,
    marginLeft: -1.5,
    borderRadius: 1.5,
    backgroundColor: Colors.text,
  },
  breaks: {
    height: 18,
  },
  breakLabel: {
    position: 'absolute',
    width: 32,
    marginLeft: -16,
  },
  chanceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Space.s,
  },
  chanceMark: {
    width: 3,
    height: 14,
    marginTop: 2,
    borderRadius: 1.5,
    backgroundColor: Colors.text,
  },
  flex: {
    flex: 1,
  },
  // Folded: the bar and its "Ranges" button on one slim row.
  slim: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Space.m,
  },
  toggle: {
    minHeight: COMPACT_TAP,
    marginTop: -(COMPACT_TAP - 20) / 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
    paddingHorizontal: Space.s,
    borderRadius: RADIUS,
  },
  band: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.m,
    minHeight: COMPACT_TAP,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  pressed: {
    backgroundColor: Colors.surface,
  },
  swatch: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  meaning: {
    paddingVertical: Space.s,
  },
});
