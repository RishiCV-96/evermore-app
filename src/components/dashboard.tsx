import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { G, Line, Path, Text as SvgText } from 'react-native-svg';

import { AppText } from '@/components/app-text';
import { calendarKey, levelFor, type DayCompletion, type Level } from '@/lib/activity';
import { studyDayKey } from '@/lib/study-day';
import { Colors } from '@/theme/colors';
import { RADIUS, Space } from '@/theme/layout';
import { Fonts, useType } from '@/theme/type';

// Pieces of the caregiver dashboard. Everything here shows completion (cards finished
// against the daily goal), never how answers went.

export const NOT_MEDICAL = 'Practice activity, not a medical measure.';

/** The note under every chart and at the foot of every dashboard page. `start` lines it up with a figure it sits under. */
export function Note({ testID, start = false }: { testID?: string; start?: boolean }) {
  return (
    <AppText testID={testID} fit center={!start} size="caption" muted>
      {NOT_MEDICAL}
    </AppText>
  );
}

type HeroProps = { value: string; label: string; note?: string; testID?: string };

/** The one hero figure, today's completion, with its label underneath and a calm line under that. */
export function Hero({ value, label, note, testID }: HeroProps) {
  return (
    <View testID={testID} accessible accessibilityLabel={`${label}: ${value}${note ? `. ${note}` : ''}`} style={styles.hero}>
      <AppText fit bold size="display" tabular color={Colors.primaryDark}>
        {value}
      </AppText>
      <AppText fit muted>
        {label}
      </AppText>
      {note ? (
        <AppText testID="today-estimate" fit size="caption" muted>
          {note}
        </AppText>
      ) : null}
    </View>
  );
}

/** A supporting figure as one list row: the label, then the figure at the end. */
export function Stat({ value, label, testID }: { value: string; label: string; testID?: string }) {
  return (
    <View testID={testID} accessible accessibilityLabel={`${label}: ${value}`} style={styles.stat}>
      <AppText fit style={styles.statLabel}>
        {label}
      </AppText>
      <AppText fit bold tabular color={Colors.primaryDark}>
        {value}
      </AppText>
    </View>
  );
}

export type StatItem = { label: string; value: string; /** A line under the figure. */ sub?: string; /** What screen readers hear for the value. */ spoken?: string; testID?: string };

/**
 * A few supporting figures in one quiet row, hairlines between them: each figure bold over its label.
 * Labels wrap rather than shrink, so the row holds at the phone's largest text.
 */
export function StatRow({ items, color = Colors.primaryDark, testID }: { items: StatItem[]; /** The figures' color. */ color?: string; testID?: string }) {
  return (
    <View testID={testID} style={styles.statRow}>
      {items.map((item, index) => (
        <View key={item.label} style={[styles.statCell, index > 0 ? styles.statDivided : styles.statFirst]}>
          <View testID={item.testID} accessible accessibilityLabel={`${item.label}: ${item.spoken ?? item.value}`} style={styles.statInner}>
            <AppText fit bold size="headline" tabular color={color}>
              {item.value}
            </AppText>
            <AppText size="caption" muted>
              {item.label}
            </AppText>
            {item.sub ? (
              <AppText size="caption" muted>
                {item.sub}
              </AppText>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

/** A day's label on the chart: "Today" for today's study day, else its weekday. `date` is when the study day began. */
function weekday(date: Date, today: Date) {
  return calendarKey(date) === studyDayKey(today) ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' });
}

/** A bar with a rounded top, standing on the baseline. */
function barPath(x: number, base: number, width: number, height: number) {
  const r = Math.min(RADIUS, width / 2, height);
  const top = base - height;
  return `M${x},${base} L${x},${top + r} Q${x},${top} ${x + r},${top} L${x + width - r},${top} Q${x + width},${top} ${x + width},${top + r} L${x + width},${base} Z`;
}

/** Daily completion for the last 7 days, up to the goal line (100%), each bar labelled. */
export function WeekBars({ days, today }: { days: DayCompletion[]; today: Date }) {
  const type = useType();
  const [width, setWidth] = useState(0);
  const slot = width / days.length;
  // Labels follow the text size, but never outgrow their bar's slot ("Today" must fit).
  const label = Math.min(type.caption.fontSize, slot / 2.8);
  // Two rows above the goal line, the "Goal" label and then the labels of bars that reach
  // it, so the two never overlap.
  const top = label * 2 + Space.m;
  const bottom = label + Space.m;
  const plot = 100;
  const height = top + plot + bottom;
  const barWidth = Math.min(32, slot * 0.56);
  const summary = days.map((day) => `${weekday(day.date, today)}: ${day.percent}%`).join(', ');

  return (
    <View
      testID="week-chart"
      accessible
      accessibilityLabel={`Daily completion, last 7 days. ${summary}`}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Line x1={0} x2={width} y1={top} y2={top} stroke={Colors.textMuted} strokeWidth={1} strokeDasharray="4 6" />
          <Line x1={0} x2={width} y1={top + plot} y2={top + plot} stroke={Colors.divider} strokeWidth={1} />
          <SvgText x={width} y={top - label - Space.s} fontSize={label} fontFamily={Fonts.regular} fill={Colors.textMuted} textAnchor="end">
            Goal
          </SvgText>
          {days.map((day, index) => {
            const barHeight = (plot * day.percent) / 100;
            const center = index * slot + slot / 2;
            return (
              <G key={day.key}>
                {barHeight > 0 ? <Path d={barPath(center - barWidth / 2, top + plot, barWidth, barHeight)} fill={Colors.primary} /> : null}
                <SvgText
                  x={center}
                  y={top + plot - barHeight - Space.s}
                  fontSize={label}
                  fontFamily={Fonts.bold}
                  fill={Colors.text}
                  textAnchor="middle">
                  {String(day.percent)}
                </SvgText>
                <SvgText x={center} y={height - Space.xs} fontSize={label} fontFamily={Fonts.regular} fill={Colors.textMuted} textAnchor="middle">
                  {weekday(day.date, today)}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      ) : (
        <View style={{ height }} />
      )}
    </View>
  );
}

const LEVEL_TEXT: Record<Level, string> = { none: 'No practice', partial: 'Some practice', met: 'Goal met' };
// Shorter, so the legend stays on one line.
const LEGEND_TEXT: Record<Level, string> = { none: 'No practice', partial: 'Some', met: 'Goal met' };
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** The last 30 days as a calendar, Monday first. Three neutral levels; an empty day is just empty. */
export function MonthGrid({ days }: { days: DayCompletion[] }) {
  // Blank cells before the first day so each column is one weekday.
  const leading = (days[0].date.getDay() + 6) % 7;
  const cells: (DayCompletion | null)[] = [...Array(leading).fill(null), ...days];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, index) => cells.slice(index * 7, index * 7 + 7));

  return (
    <View testID="month-grid" style={styles.grid}>
      <View style={styles.gridRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {WEEKDAYS.map((name) => (
          <AppText key={name} fit center size="caption" muted style={styles.gridHead}>
            {name}
          </AppText>
        ))}
      </View>
      {weeks.map((week, row) => (
        <View key={row} style={styles.gridRow}>
          {week.map((day, column) =>
            day ? <DayCell key={day.key} day={day} /> : <View key={`blank-${column}`} style={styles.cellSlot} />,
          )}
        </View>
      ))}
      <View style={styles.legend}>
        {(['none', 'partial', 'met'] as const).map((level) => (
          <View key={level} style={styles.legendItem}>
            <View style={[styles.swatch, levelStyles[level]]} />
            <AppText fit size="caption" muted>
              {LEGEND_TEXT[level]}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

function DayCell({ day }: { day: DayCompletion }) {
  const level = levelFor(day);
  const label = day.date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  return (
    <View style={styles.cellSlot}>
      <View accessible accessibilityLabel={`${label}: ${LEVEL_TEXT[level]}`} style={[styles.cell, levelStyles[level]]}>
        <AppText fit bold size="caption" tabular color={level === 'met' ? Colors.onPrimary : Colors.text}>
          {String(day.date.getDate())}
        </AppText>
      </View>
    </View>
  );
}

/** How many times each person's cards were practiced this week, three to a row. Engagement only. */
export function PeopleCounts({ rows }: { rows: { name: string; count: number }[] }) {
  return (
    <View testID="people-counts" style={styles.people}>
      {rows.map((row) => (
        <View key={row.name} accessible accessibilityLabel={`${row.name}: ${row.count} times`} style={styles.personCell}>
          <AppText fit style={styles.personName}>
            {row.name}
          </AppText>
          <AppText bold tabular color={Colors.primaryDark}>
            {String(row.count)}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const levelStyles = StyleSheet.create({
  none: { backgroundColor: Colors.surface },
  partial: { backgroundColor: Colors.sky },
  met: { backgroundColor: Colors.primary },
});

const styles = StyleSheet.create({
  hero: {
    gap: Space.xs,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.m,
    minHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  statLabel: {
    flex: 1,
  },
  statRow: {
    flexDirection: 'row',
    paddingVertical: Space.s,
  },
  statCell: {
    flex: 1,
    paddingLeft: Space.m,
    paddingRight: Space.s,
  },
  // The first figure lines up with the page's edge; the rest sit after a hairline.
  statDivided: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: Colors.divider,
  },
  statFirst: {
    paddingLeft: 0,
  },
  statInner: {
    gap: 2,
  },
  grid: {
    gap: Space.xs,
  },
  gridRow: {
    flexDirection: 'row',
  },
  gridHead: {
    flex: 1,
  },
  cellSlot: {
    flex: 1,
    padding: 2,
  },
  cell: {
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: Space.l,
    rowGap: Space.xs,
    marginTop: Space.xs,
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
  people: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: Space.xs,
  },
  personCell: {
    width: '33.3%',
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Space.s,
    paddingRight: Space.l,
  },
  personName: {
    flexShrink: 1,
  },
});
