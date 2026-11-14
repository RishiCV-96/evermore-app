import { useState, type ReactNode } from 'react';
import { StyleSheet, View, type GestureResponderEvent } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { AppText } from '@/components/app-text';
import { QuietLink } from '@/components/caregiver-ui';
import { calloutLeft, labelIndexes, linear, slotAt, slotCenter, textWidth } from '@/lib/insight-scale';
import { Colors } from '@/theme/colors';
import { RADIUS, Space } from '@/theme/layout';
import { Fonts } from '@/theme/type';

// The one way an Insights chart is drawn, so every chart looks and behaves the same: the same
// margins, thin light gridlines, a y-axis from zero for bars, a few dates under the plot (the first,
// the last and evenly between), reference lines labelled in the right margin and bands named in the
// left margin (never on the data), a tap that highlights a day with a small callout above the plot
// (the latest by default), and the same values as a list a tap away for anyone who can't see the
// chart. The geometry is in src/lib/insight-scale.ts, which scripts/check-logic.mjs checks.

/** The chart system's sizes and colors, in one place. */
export const CHART = {
  /** The plot's height, without the callout row above it and the dates below. */
  plot: 140,
  /** The row above the plot that holds the callout, so it never covers the data. */
  calloutRow: 26,
  /** Axis and edge labels: small but never tiny. */
  label: 12,
  /** The smallest margin either side, so the last point's ring never touches the edge. */
  edge: 8,
  grid: Colors.divider,
  axisText: Colors.textMuted,
  /** The callout: the Insights ink behind white words (5.9:1). */
  calloutFill: Colors.pinkInk,
  calloutText: Colors.onPrimary,
  /** The main series in the Insights pink, its lighter partner, and blue for a second series beside it. */
  primary: Colors.pinkInk,
  secondary: Colors.pink2,
  blue: Colors.primary,
};

export type Tick = { value: number; label: string };
export type Band = { from: number; to: number; fill: string; label: string; labelColor?: string };
export type Reference = { value: number; label: string; detail?: string };

export type Scale = {
  /** The middle of day `index`'s slot. */
  x: (index: number) => number;
  y: (value: number) => number;
  slot: number;
  /** A bar's width in this chart: rounded, never wider than 16. */
  bar: number;
  top: number;
  bottom: number;
  left: number;
  right: number;
  /** The day highlighted, if any. */
  selected?: number;
};

type ChartFrameProps = {
  testID: string;
  /** What the chart shows, in words, for screen readers. */
  summary: string;
  /** How many days across. */
  count: number;
  /** The label under day `index`: a short date, or "Today". */
  dateLabel: (index: number) => string;
  /** Ticks on the y-axis, lowest first; the domain runs from the first to the last. Leave out with bands. */
  ticks?: Tick[];
  /** The domain, when it isn't the ticks' (as with bands). */
  domain?: [number, number];
  /** Soft bands behind the data, named in the left margin. */
  bands?: Band[];
  /** Dashed reference lines, named in the right margin. */
  references?: Reference[];
  /** The callout's words for day `index`, and the value it points at; none for a day without a value. */
  callout: (index: number) => { text: string; value: number } | undefined;
  /** The marks: bars, lines, points. */
  children: (scale: Scale) => ReactNode;
  /** What a chart without a single value says, in a short calm box in place of an empty plot. */
  empty?: string;
};

/** Splits a label at its middle space if it is too wide for `max`, so "Getting started" stacks. */
function lines(label: string, size: number, max: number) {
  if (textWidth(label, size) <= max || !label.includes(' ')) return [label];
  const words = label.split(' ');
  const half = Math.ceil(words.length / 2);
  return [words.slice(0, half).join(' '), words.slice(half).join(' ')];
}

const BAND_LABEL_MAX = 58;
/** Tabular numerals, so figures line up. */
const TNUM = "'tnum'";

export function ChartFrame({ testID, summary, count, dateLabel, ticks, domain, bands, references = [], callout, children, empty = 'Not enough cards yet' }: ChartFrameProps) {
  const [width, setWidth] = useState(0);
  // The latest day with a value is highlighted until another is tapped.
  const latest = [...Array(count).keys()].reverse().find((index) => callout(index) !== undefined);
  const [picked, setPicked] = useState<number>();
  const selected = picked !== undefined && callout(picked) ? picked : latest;

  const size = CHART.label;
  const bandLines = (bands ?? []).map((band) => lines(band.label, size, BAND_LABEL_MAX));
  const left = bands
    ? Math.ceil(Math.max(...bandLines.flat().map((line) => textWidth(line, size)))) + Space.s
    : Math.ceil(Math.max(0, ...(ticks ?? []).map((tick) => textWidth(tick.label, size)))) + Space.s;
  const right = Math.max(CHART.edge, ...references.map((ref) => Math.ceil(Math.max(textWidth(ref.label, size), textWidth(ref.detail ?? '', size))) + Space.s));
  const top = CHART.calloutRow;
  const bottom = top + CHART.plot;
  const height = bottom + Space.s + size + Space.xs;
  const plotWidth = Math.max(0, width - left - right);
  const [d0, d1] = domain ?? [ticks?.[0]?.value ?? 0, ticks?.[ticks.length - 1]?.value ?? 1];
  const y = linear([d0, d1], [bottom, top]);
  const slot = plotWidth / Math.max(count, 1);
  const scale: Scale = { x: (index) => slotCenter(index, count, left, plotWidth), y, slot, bar: Math.max(3, Math.min(16, slot * 0.62)), top, bottom, left, right: left + plotWidth, selected };

  // Dates: as many as fit without crowding, the first and last always.
  const widest = Math.max(...[0, count - 1].map((index) => textWidth(dateLabel(index), size)));
  const dates = labelIndexes(count, plotWidth / (widest + Space.l));
  const shown = selected === undefined ? undefined : callout(selected);

  if (latest === undefined) {
    return (
      <View testID={testID} accessible accessibilityLabel={summary} style={styles.empty}>
        <AppText size="caption" muted center>
          {empty}
        </AppText>
      </View>
    );
  }

  function onTap(event: GestureResponderEvent) {
    const index = slotAt(event.nativeEvent.locationX, count, left, plotWidth);
    if (index === undefined || !callout(index)) return;
    setPicked(index === picked ? undefined : index);
  }

  return (
    <View testID={testID} accessible accessibilityRole="image" accessibilityLabel={summary} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 ? (
        <View>
          <Svg width={width} height={height}>
            {bands?.map((band, index) => (
              <G key={band.label}>
                <Rect x={left} y={y(band.to)} width={plotWidth} height={Math.max(0, y(band.from) - y(band.to))} fill={band.fill} />
                {bandLines[index].map((line, row) => (
                  <SvgText
                    key={line}
                    x={left - Space.s}
                    y={(y(band.from) + y(band.to)) / 2 + size * 0.35 + (row - (bandLines[index].length - 1) / 2) * (size + 1)}
                    fontSize={size}
                    fontFamily={Fonts.regular}
                    fill={band.labelColor ?? CHART.axisText}
                    textAnchor="end">
                    {line}
                  </SvgText>
                ))}
              </G>
            ))}
            {/* Thin light gridlines at each tick or band edge, the baseline among them. */}
            {(ticks ?? []).map((tick) => (
              <G key={tick.value}>
                <Line x1={left} x2={left + plotWidth} y1={y(tick.value)} y2={y(tick.value)} stroke={CHART.grid} strokeWidth={1} />
                <SvgText x={left - Space.s} y={y(tick.value) + size * 0.35} fontSize={size} fontFamily={Fonts.regular} fontFeatureSettings={TNUM} fill={CHART.axisText} textAnchor="end">
                  {tick.label}
                </SvgText>
              </G>
            ))}
            {bands?.slice(1).map((band) => <Line key={band.label} x1={left} x2={left + plotWidth} y1={y(band.from)} y2={y(band.from)} stroke={Colors.background} strokeWidth={1.5} />)}
            {bands ? <Line x1={left} x2={left + plotWidth} y1={bottom} y2={bottom} stroke={CHART.grid} strokeWidth={1} /> : null}
            {children(scale)}
            {references.map((ref) => (
              <G key={ref.label}>
                <Line x1={left} x2={left + plotWidth} y1={y(ref.value)} y2={y(ref.value)} stroke={Colors.text} strokeWidth={1.25} strokeDasharray="5 4" />
                <SvgText x={left + plotWidth + Space.s} y={y(ref.value) + (ref.detail ? -1 : size * 0.35)} fontSize={size} fontFamily={Fonts.bold} fill={Colors.text}>
                  {ref.label}
                </SvgText>
                {ref.detail ? (
                  <SvgText x={left + plotWidth + Space.s} y={y(ref.value) + size} fontSize={size} fontFamily={Fonts.regular} fill={CHART.axisText}>
                    {ref.detail}
                  </SvgText>
                ) : null}
              </G>
            ))}
            {dates.map((index) => {
              const first = index === 0 && count > 1;
              const last = index === count - 1;
              return (
                <SvgText
                  key={index}
                  x={first ? left : last ? left + plotWidth : scale.x(index)}
                  y={height - Space.xs}
                  fontSize={size}
                  fontFamily={Fonts.regular}
                  fill={CHART.axisText}
                  textAnchor={first ? 'start' : last ? 'end' : 'middle'}>
                  {dateLabel(index)}
                </SvgText>
              );
            })}
            {shown && selected !== undefined ? <Callout x={scale.x(selected)} pointY={y(shown.value)} text={shown.text} width={width} /> : null}
          </Svg>
          {/* The whole chart takes a tap: the nearest day is highlighted. A scroll that starts here still scrolls. */}
          <View
            style={StyleSheet.absoluteFill}
            onStartShouldSetResponder={() => true}
            onResponderTerminationRequest={() => true}
            onResponderRelease={onTap}
          />
        </View>
      ) : (
        <View style={{ height }} />
      )}
    </View>
  );
}

/** A small rounded callout in the row above the plot, with a thin line down to the day it names. */
function Callout({ x, pointY, text, width }: { x: number; pointY: number; text: string; width: number }) {
  const size = CHART.label;
  const wide = textWidth(text, size) + Space.m * 2;
  const height = size + Space.s + 2;
  const boxLeft = calloutLeft(x, wide, 0, width);
  const boxTop = (CHART.calloutRow - height) / 2 - 1;
  return (
    <G>
      <Line x1={x} x2={x} y1={boxTop + height} y2={pointY} stroke={CHART.calloutFill} strokeWidth={1} strokeDasharray="2 3" />
      <Rect x={boxLeft} y={boxTop} width={wide} height={height} rx={height / 2} fill={CHART.calloutFill} />
      <SvgText x={boxLeft + wide / 2} y={boxTop + height / 2 + size * 0.36} fontSize={size} fontFamily={Fonts.bold} fontFeatureSettings={TNUM} fill={CHART.calloutText} textAnchor="middle">
        {text}
      </SvgText>
    </G>
  );
}

/** A bar standing on the baseline, its top corners rounded. */
export function barPath(x: number, base: number, width: number, height: number) {
  if (height <= 0) return '';
  const r = Math.min(4, width / 2, height);
  const top = base - height;
  return `M${x},${base} L${x},${top + r} Q${x},${top} ${x + r},${top} L${x + width - r},${top} Q${x + width},${top} ${x + width},${top + r} L${x + width},${base} Z`;
}

/** Straight segments between neighboring days that both have a value: a gap stays a gap, and nothing is smoothed. */
export function segments(points: ({ x: number; y: number } | undefined)[]) {
  let path = '';
  points.forEach((point, index) => {
    if (!point) return;
    path += points[index - 1] ? ` L${point.x},${point.y}` : ` M${point.x},${point.y}`;
  });
  return path.trim();
}

/** A line with a point on each day, the highlighted one larger with a white ring. */
export function LineMarks({ scale, values, color }: { scale: Scale; values: (number | undefined)[]; color: string }) {
  const points = values.map((value, index) => (value === undefined ? undefined : { x: scale.x(index), y: scale.y(value) }));
  return (
    <G>
      <Path d={segments(points)} stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" fill="none" />
      {points.map((point, index) =>
        point ? (
          index === scale.selected ? (
            <Circle key={index} cx={point.x} cy={point.y} r={5.5} fill={color} stroke={Colors.background} strokeWidth={2} />
          ) : (
            <Circle key={index} cx={point.x} cy={point.y} r={2.75} fill={color} />
          )
        ) : null,
      )}
    </G>
  );
}

/** A legend that stays on one line: a swatch and a short label per item. Direct labels are preferred where they fit. */
export function ChartLegend({ items }: { items: { label: string; swatch: ReactNode }[] }) {
  return (
    <View style={styles.legend} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {items.map((item) => (
        <View key={item.label} style={styles.legendItem}>
          {item.swatch}
          <AppText fit size="caption" muted>
            {item.label}
          </AppText>
        </View>
      ))}
    </View>
  );
}

/** A filled legend swatch; `outline` draws the dashed edge a partial bar has. */
export function Swatch({ fill, outline }: { fill: string; outline?: string }) {
  return <View style={[styles.swatch, { backgroundColor: fill }, outline ? { borderWidth: 1.5, borderStyle: 'dashed', borderColor: outline } : null]} />;
}

/** The chart's values as a list, folded away: the text alternative to tapping each day. */
export function ChartValues({ rows, testID }: { rows: { label: string; value: string }[]; testID?: string }) {
  const [open, setOpen] = useState(false);
  if (rows.length === 0) return null;
  return (
    <View>
      <View style={styles.toggle}>
        <QuietLink testID={testID} label={open ? 'Hide the numbers' : 'Show the numbers'} expanded={open} onPress={() => setOpen(!open)} />
      </View>
      {open ? (
        <View style={styles.values}>
          {rows.map((row) => (
            <View key={row.label} style={styles.valueRow} accessible accessibilityLabel={`${row.label}: ${row.value}`}>
              <AppText size="caption" muted style={styles.valueLabel}>
                {row.label}
              </AppText>
              <AppText size="caption" bold style={styles.figure}>
                {row.value}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Space.l,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.divider,
  },
  legend: {
    flexDirection: 'row',
    columnGap: Space.l,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.s,
    flexShrink: 1,
  },
  swatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  toggle: {
    alignItems: 'flex-start',
    marginLeft: -Space.xs,
  },
  values: {
    paddingTop: Space.xs,
  },
  valueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Space.m,
    paddingVertical: Space.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  valueLabel: {
    flex: 1,
  },
  figure: {
    fontVariant: ['tabular-nums'],
  },
});
