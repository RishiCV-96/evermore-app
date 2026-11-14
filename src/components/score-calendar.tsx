import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { QuietLink } from '@/components/caregiver-ui';
import { Note } from '@/components/dashboard';
import { BAND_PINK, ScoreKey } from '@/components/score-key';
import { Segmented } from '@/components/segmented';
import { Sheet } from '@/components/sheet';
import { MEMORY_SCORE, type BandName } from '@/config/insights';
import { levelFor, type DayCompletion, type Level } from '@/lib/activity';
import {
  bandsSentence,
  cellKind,
  cellLabel,
  chanceScore,
  earliestMonth,
  monthDay,
  monthName,
  monthWeeks,
  scoreSentence,
  shiftMonth,
  type CellKind,
  type DayInsight,
  type InsightsView,
} from '@/lib/insights';
import { Colors } from '@/theme/colors';
import { COMPACT_TAP, ICON, RADIUS, Space } from '@/theme/layout';
import { Fonts } from '@/theme/type';

// The score calendar on Trends → Insights: a month at a time, each day shaded by its Memory score
// band from light to deep pink, with the completion calendar a tap away. Every figure comes from
// src/lib/insights.ts. Practice activity, not a medical measure.

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Band shading, light to deep, and the text each can carry. */
const SCORE_FILL: Record<CellKind, { fill?: string; text: string }> = {
  none: { text: Colors.textMuted },
  few: { text: Colors.text },
  ...(Object.fromEntries(Object.entries(BAND_PINK).map(([band, fill]) => [band, { fill, text: Colors.text }])) as Record<BandName, { fill: string; text: string }>),
};

/** The completion calendar's own three levels, as on Trends → Activity. */
const LEVEL_FILL: Record<Level, { fill: string; text: string }> = {
  none: { fill: Colors.surface, text: Colors.text },
  partial: { fill: Colors.sky, text: Colors.text },
  met: { fill: Colors.primary, text: Colors.onPrimary },
};
const LEVEL_WORDS: Record<Level, string> = { none: 'No practice', partial: 'Some practice', met: 'Goal met' };

type Mode = 'score' | 'completion';

type ScoreCalendarProps = {
  view: InsightsView;
  /** Completion by day, as Trends → Activity has it. */
  completion: DayCompletion[];
  today: string;
  /** The day open in the day sheet, or last opened: highlighted, and its month shown. */
  selected?: string;
  onOpenDay: (key: string) => void;
  onExplain: () => void;
};

export function ScoreCalendar({ view, completion, today, selected, onOpenDay, onExplain }: ScoreCalendarProps) {
  const [mode, setMode] = useState<Mode>('score');
  const thisMonth = today.slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  // As the day sheet steps across a month's end, the calendar behind it turns to that month.
  const [followed, setFollowed] = useState(selected);
  if (selected !== followed) {
    setFollowed(selected);
    if (selected) setMonth(selected.slice(0, 7));
  }
  const earliest = earliestMonth(view, today);
  const done = new Map(completion.map((day) => [day.key, day]));

  return (
    <View style={styles.group}>
      <View style={styles.heading}>
        <AppText fit bold accessibilityRole="header" style={styles.monthName}>
          Calendar
        </AppText>
        <AppText fit size="caption" muted>
          Tap a day to open it
        </AppText>
      </View>
      <Segmented
        testID="calendar-mode"
        label="The calendar shows"
        options={[
          { value: 'score', label: 'Memory score' },
          { value: 'completion', label: 'Completion' },
        ]}
        value={mode}
        onChange={setMode}
        accent={{ track: Colors.pinkTint, text: Colors.pinkInk }}
      />
      <View style={styles.monthRow}>
        <MonthButton icon="chevron-back" label="Previous month" disabled={month <= earliest} onPress={() => setMonth(shiftMonth(month, -1))} />
        <AppText testID="calendar-month" fit center bold accessibilityRole="header" style={styles.monthName}>
          {monthName(month)}
        </AppText>
        <MonthButton icon="chevron-forward" label="Next month" disabled={month >= thisMonth} onPress={() => setMonth(shiftMonth(month, 1))} />
      </View>
      <View testID="score-calendar" style={styles.grid}>
        <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {WEEKDAYS.map((name) => (
            <AppText key={name} fit center size="caption" muted style={styles.head}>
              {name}
            </AppText>
          ))}
        </View>
        {monthWeeks(month).map((week, row) => (
          <View key={row} style={styles.row}>
            {week.map((key, column) =>
              key ? (
                <DayCell key={key} dayKey={key} mode={mode} day={view.days.get(key)} completion={done.get(key)} today={today} selected={key === selected} onOpen={onOpenDay} />
              ) : (
                <View key={`blank-${column}`} style={styles.slot} />
              ),
            )}
          </View>
        ))}
      </View>
      <Legend mode={mode} />
      {/* The shading's key: the band pinks, light to deep, folded into one slim bar with its ranges a tap away. */}
      {mode === 'score' ? <ScoreKey testID="calendar-key" chance={view.chanceScore} folded /> : null}
      <View style={styles.keyToggle}>
        <QuietLink testID="explain-score" label="What is this score?" onPress={onExplain} />
      </View>
      <Note />
    </View>
  );
}

function MonthButton({ icon, label, disabled, onPress }: { icon: 'chevron-back' | 'chevron-forward'; label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.monthButton, pressed && styles.pressed, disabled && styles.disabled]}>
      <Ionicons name={icon} size={ICON} color={Colors.primaryDark} aria-hidden />
    </Pressable>
  );
}

type DayCellProps = {
  dayKey: string;
  mode: Mode;
  day?: DayInsight;
  completion?: DayCompletion;
  today: string;
  selected: boolean;
  onOpen: (key: string) => void;
};

function DayCell({ dayKey, mode, day, completion, today, selected, onOpen }: DayCellProps) {
  const number = String(Number(dayKey.slice(8)));
  const future = dayKey > today;
  const kind = cellKind(day);
  const level = completion && !future ? levelFor(completion) : undefined;
  const look = mode === 'score' ? SCORE_FILL[future ? 'none' : kind] : level ? LEVEL_FILL[level] : { text: Colors.textMuted };
  const label = mode === 'score' ? cellLabel(dayKey, day) : `${monthDay(dayKey)}: ${level ? LEVEL_WORDS[level] : 'no practice recorded'}`;
  // On the score view a scored day shows its date small and its score below it, on its band's pink.
  const score = mode === 'score' && !future ? day?.score : undefined;
  const face = (
    <View style={[styles.ring, dayKey === today && styles.today, selected && styles.selected]}>
      <View style={[styles.cell, look.fill ? { backgroundColor: look.fill } : null, mode === 'score' && kind === 'few' && !future && styles.few]}>
        {score !== undefined ? (
          <>
            <Text allowFontScaling={false} style={[styles.date, { color: look.text }]}>
              {number}
            </Text>
            <Text testID={`score-${dayKey}`} maxFontSizeMultiplier={1.15} style={[styles.score, { color: look.text }]}>
              {String(score)}
            </Text>
          </>
        ) : (
          <AppText fit bold={mode === 'completion' || kind !== 'none'} size="caption" color={look.text} style={styles.number}>
            {number}
          </AppText>
        )}
      </View>
    </View>
  );
  // A day with records opens its detail; other days are only shown.
  if (!day || day.cards === 0 || future) {
    return (
      <View testID={`quiet-${dayKey}`} style={[styles.slot, selected && styles.pressedSlot]} accessible accessibilityLabel={label} aria-selected={selected}>
        {face}
      </View>
    );
  }
  return (
    <Pressable
      testID={`day-${dayKey}`}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Opens that day."
      aria-selected={selected}
      onPress={() => onOpen(dayKey)}
      style={({ pressed }) => [styles.slot, (pressed || selected) && styles.pressedSlot]}>
      {face}
    </Pressable>
  );
}

function Legend({ mode }: { mode: Mode }) {
  const items =
    mode === 'score'
      ? [
          { key: 'Too few cards for a score', style: styles.fewSwatch },
          { key: 'No practice', style: styles.emptySwatch },
        ]
      : (['none', 'partial', 'met'] as const).map((level) => ({ key: LEVEL_WORDS[level], style: { backgroundColor: LEVEL_FILL[level].fill } }));
  return (
    <View testID="calendar-legend" style={styles.legend}>
      {items.map((item) => (
        <View key={item.key} style={styles.legendItem}>
          <View style={[styles.swatch, item.style]} />
          <AppText fit size="caption" muted>
            {item.key}
          </AppText>
        </View>
      ))}
    </View>
  );
}

/** "What is this score?", in plain words. */
export function ScoreHelp({ chance, visible, onClose }: { chance: number; visible: boolean; onClose: () => void }) {
  return (
    <Sheet visible={visible} title="What is this score?" onClose={onClose}>
      <ScoreKey testID="help-key" chance={chance} />
      <View testID="score-help" style={styles.help}>
        <AppText>{`The Memory score summarizes one day of practice. ${scoreSentence()}`}</AppText>
        <AppText>{`A day needs at least ${MEMORY_SCORE.minCards} cards for a score. A day without practice has no score, and nothing counts against it.`}</AppText>
        <AppText>{`Every card ends on the right answer, so even choosing at random would score about ${chanceScore(3)} when three answers are offered. The bands start above that: ${bandsSentence()}.`}</AppText>
        <AppText>
          One day’s score is affected by sleep, mood and the time of day, and by how the questions were asked. Compare it only with the same person’s own history.
        </AppText>
        <AppText bold>It describes practice. It is not a medical measure.</AppText>
      </View>
      <Note />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Space.s,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.s,
  },
  monthName: {
    flex: 1,
  },
  monthButton: {
    width: COMPACT_TAP,
    height: COMPACT_TAP,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS,
  },
  pressed: {
    backgroundColor: Colors.surface,
  },
  disabled: {
    opacity: 0.35,
  },
  grid: {
    gap: 0,
  },
  row: {
    flexDirection: 'row',
  },
  head: {
    flex: 1,
  },
  slot: {
    flex: 1,
    height: COMPACT_TAP + Space.s,
    alignItems: 'stretch',
    justifyContent: 'center',
    borderRadius: RADIUS,
  },
  pressedSlot: {
    backgroundColor: Colors.surface,
  },
  ring: {
    flex: 1,
    margin: 1,
    padding: 2,
    borderRadius: RADIUS,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  today: {
    borderColor: Colors.primaryDark,
  },
  // The day open in the sheet, or last opened: a soft tile behind a ring in the text color, so it reads apart from today's.
  selected: {
    borderColor: Colors.text,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS,
  },
  few: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.textMuted,
  },
  number: {
    fontVariant: ['tabular-nums'],
  },
  // A scored day: the date small at the top, the score bold beneath it.
  date: {
    fontFamily: Fonts.regular,
    fontSize: 10,
    lineHeight: 12,
    fontVariant: ['tabular-nums'],
  },
  score: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    lineHeight: 17,
    fontVariant: ['tabular-nums'],
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Space.s,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: Space.l,
    rowGap: Space.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.s,
  },
  swatch: {
    width: 14,
    height: 14,
    borderRadius: RADIUS,
  },
  fewSwatch: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.textMuted,
  },
  emptySwatch: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.divider,
  },
  hero: {
    gap: Space.xs,
  },
  people: {
    gap: Space.xs,
  },
  help: {
    gap: Space.m,
  },
  keyToggle: {
    alignItems: 'flex-start',
    marginLeft: -Space.xs,
  },
});
