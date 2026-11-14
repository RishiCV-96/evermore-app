import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { QuietLink } from '@/components/caregiver-ui';
import { Note } from '@/components/dashboard';
import { FOUND_FILL, FoundChart } from '@/components/insight-charts';
import { Sheet } from '@/components/sheet';
import { MIN_CARDS_SHOWN } from '@/config/insights';
import { ASKED_FOR_HELP_MEANING, chanceText, foundGroups, foundHeadline, foundSummary, helpCountText, wholePercents, type FoundGroup, type InsightsView, type Shares } from '@/lib/insights';
import { Colors } from '@/theme/colors';
import { Space } from '@/theme/layout';

// "How answers were found", in plain words: right away, on a second try, or with help. One sentence
// on top, one bar for the last two weeks with each part labelled by its percentage and count, the
// chance level in words, then each day as its own bar. Every figure comes from src/lib/insights.ts.
// Never "wrong" or "failed": every card ends on the right answer, and this says only how.

const BAR = 20;

export function FoundSection({ view, today }: { view: InsightsView; today: string }) {
  const [help, setHelp] = useState(false);
  const groups = foundGroups(view.recent.resolutions);
  const shares = view.recent.shares;
  const percents = shares ? wholePercents([shares[1], shares[2], shares[3]]) : undefined;
  const chance = chanceText(view.recent.chance);

  return (
    <View testID="found-section" style={styles.section}>
      <View style={styles.heading}>
        <AppText fit bold accessibilityRole="header" style={styles.flex}>
          How answers were found
        </AppText>
        <AppText fit size="caption" muted>
          Last 14 days
        </AppText>
      </View>
      <AppText testID="found-headline">{foundHeadline(shares)}</AppText>
      {shares && percents ? (
        <>
          <SummaryBar groups={groups} percents={percents} chance={view.recent.chance} summary={foundSummary(view.recent)} />
          <FoundRows groups={groups} percents={percents} />
        </>
      ) : null}
      {view.recent.askedForHelp > 0 ? (
        // A plain count, part of "With help" above.
        <AppText testID="found-asked-for-help" size="caption" muted>
          {`${helpCountText(view.recent.askedForHelp)}, counted in With help`}
        </AppText>
      ) : null}
      {chance ? (
        <View testID="found-chance" style={styles.chanceRow}>
          <View style={styles.chanceMark} />
          <AppText size="caption" muted style={styles.flex}>
            {chance}
          </AppText>
        </View>
      ) : null}
      <AppText fit bold size="caption" style={styles.subhead}>
        Each day
      </AppText>
      <FoundChart days={view.fortnight} recent={view.recent} today={today} />
      <AppText size="caption" muted>
        {`Each bar is a day, out of 100%. A dot is a day with fewer than ${MIN_CARDS_SHOWN} cards.`}
      </AppText>
      <View style={styles.link}>
        <QuietLink testID="found-help" label="How to read this" onPress={() => setHelp(true)} />
      </View>
      <Note />
      <FoundHelp chance={chance} visible={help} onClose={() => setHelp(false)} />
    </View>
  );
}

const cardsText = (count: number) => `${count} ${count === 1 ? 'card' : 'cards'}`;

/** The three ways, each a row: its swatch, its words, its percentage and its count. The chart's direct labels, and a person's page. */
export function FoundRows({ groups, percents }: { groups: FoundGroup[]; percents: number[] }) {
  return (
    <View>
      {groups.map((group, index) => (
        <View key={group.on} testID={`found-row-${group.on}`} style={styles.row} accessible accessibilityLabel={`${group.label}: ${percents[index]}%, ${cardsText(group.count)}`}>
          <View style={[styles.swatch, { backgroundColor: FOUND_FILL[group.on] }]} />
          <AppText fit style={styles.flex}>
            {group.label}
          </AppText>
          <AppText fit bold style={styles.figure}>{`${percents[index]}%`}</AppText>
          <AppText fit size="caption" muted style={styles.count}>
            {cardsText(group.count)}
          </AppText>
        </View>
      ))}
    </View>
  );
}

/** A slim bar of the three ways, out of 100%, for a person's row. Decorative: the row says it in words. */
export function MiniBar({ shares }: { shares: Shares }) {
  const percents = wholePercents([shares[1], shares[2], shares[3]]);
  return (
    <View style={styles.mini} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {([1, 2, 3] as const).map((on, index) => (percents[index] > 0 ? <View key={on} style={{ width: `${percents[index]}%`, backgroundColor: FOUND_FILL[on] }} /> : null))}
    </View>
  );
}

/** The last two weeks as one bar out of 100%: right away from the left, a mark where choosing at random would reach, labelled under the bar. */
function SummaryBar({ groups, percents, chance, summary }: { groups: FoundGroup[]; percents: number[]; chance?: number; summary: string }) {
  return (
    <View testID="found-bar" accessible accessibilityRole="image" accessibilityLabel={summary}>
      <View style={styles.bar}>
        {groups.map((group, index) => (percents[index] > 0 ? <View key={group.on} style={{ width: `${percents[index]}%`, backgroundColor: FOUND_FILL[group.on] }} /> : null))}
      </View>
      {chance !== undefined && chanceText(chance) ? (
        <View style={styles.chanceLane}>
          <View style={[styles.chanceTick, { left: `${chance * 100}%` }]} />
          <AppText size="caption" muted style={[styles.chanceLabel, chance > 0.5 ? { right: `${100 - chance * 100}%` } : { left: `${chance * 100}%` }]}>
            chance
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

/** "How to read this": a short explainer. */
function FoundHelp({ chance, visible, onClose }: { chance?: string; visible: boolean; onClose: () => void }) {
  return (
    <Sheet visible={visible} title="How answers were found" onClose={onClose}>
      <View testID="found-explainer" style={styles.help}>
        <AppText>Every card ends on the right answer. This shows how each answer was found.</AppText>
        <AppText>
          <AppText bold>Right away:</AppText> the first name chosen was the one.
        </AppText>
        <AppText>
          <AppText bold>On a second try:</AppText> another name came first, and a hint followed.
        </AppText>
        <AppText>
          <AppText bold>With help:</AppText> it took a third try or more, with more hints, or the person asked for a hint.
        </AppText>
        <AppText>{ASKED_FOR_HELP_MEANING}</AppText>
        {chance ? <AppText>{`${chance} So the share found right away is best read against the same person’s other days.`}</AppText> : null}
        <AppText>{`A share shows once there are at least ${MIN_CARDS_SHOWN} cards.`}</AppText>
      </View>
      <Note />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Space.s,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Space.s,
  },
  flex: {
    flex: 1,
  },
  bar: {
    flexDirection: 'row',
    height: BAR,
    gap: 2,
    borderRadius: BAR / 2,
    overflow: 'hidden',
    backgroundColor: Colors.background,
  },
  mini: {
    flexDirection: 'row',
    height: 8,
    gap: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  chanceLane: {
    height: 20,
  },
  chanceTick: {
    position: 'absolute',
    top: 2,
    width: 2,
    height: 7,
    marginLeft: -1,
    borderRadius: 1,
    backgroundColor: Colors.text,
  },
  chanceLabel: {
    position: 'absolute',
    top: 4,
    marginHorizontal: Space.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.m,
    minHeight: 36,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  swatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  figure: {
    fontVariant: ['tabular-nums'],
  },
  count: {
    minWidth: 64,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  chanceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Space.s,
  },
  chanceMark: {
    width: 2,
    height: 12,
    marginTop: 3,
    borderRadius: 1,
    backgroundColor: Colors.text,
  },
  subhead: {
    marginTop: Space.s,
  },
  link: {
    alignItems: 'flex-start',
    marginLeft: -Space.xs,
  },
  help: {
    gap: Space.m,
  },
});
