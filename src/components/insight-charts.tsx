import { G, Circle, Line, Path } from 'react-native-svg';

import { CHART, ChartFrame, ChartLegend, ChartValues, LineMarks, Swatch, barPath, type Reference, type Scale } from '@/components/insight-chart-kit';
import { SCORE_BANDS } from '@/config/insights';
import { niceTicks, scoreDomain } from '@/lib/insight-scale';
import { foundSummary, monthDay, percentText, scoreFloor, scoreSummary, secondsText, shortDate, speedSummary, timeSummary, type ChartDay, type InsightsView } from '@/lib/insights';
import { Colors } from '@/theme/colors';

// The insights charts, drawn from what src/lib/insights.ts worked out: nothing is counted here, and
// every one is drawn by the same frame (src/components/insight-chart-kit.tsx), so they share margins,
// gridlines, axes, edge labels, the tap to highlight a day and the list of values.

/** Every card ends on the right answer, so no day can score below this. */
const SCORE_FLOOR = scoreFloor();
/** The band fills, the Memory score's palest pinks, lightest first. The score line is at least 3.7:1 on each. */
const BAND_FILL = [Colors.background, Colors.pinkTint, Colors.pink1, Colors.pink2];

/** "Nov 4" under a day, or "Today". */
const dateLabelOf = (days: ChartDay[], today: string) => (index: number) => (days[index].key === today ? 'Today' : shortDate(days[index].key));

/** The daily Memory score over the last 30 days, on soft bands named in the margin. Days without a score are gaps. */
export function ScoreChart({ days, today }: { days: ChartDay[]; today: string }) {
  const values = days.map((one) => one.day?.score);
  const domain = scoreDomain(values.filter((value): value is number => value !== undefined), SCORE_FLOOR);
  const bands = SCORE_BANDS.map((band, index) => ({ from: Math.max(band.from, domain[0]), to: SCORE_BANDS[index + 1]?.from ?? 100, fill: BAND_FILL[index], label: band.name })).filter((band) => band.to > domain[0]);
  return (
    <>
      <ChartFrame
        testID="score-chart"
        summary={scoreSummary(days, today)}
        count={days.length}
        dateLabel={dateLabelOf(days, today)}
        domain={domain}
        bands={bands}
        callout={(index) => (values[index] === undefined ? undefined : { text: `${values[index]} · ${dateLabelOf(days, today)(index)}`, value: values[index]! })}>
        {(scale) => <LineMarks scale={scale} values={values} color={Colors.pinkInk} />}
      </ChartFrame>
      <ChartValues testID="score-values" rows={days.flatMap((one) => (one.day?.score !== undefined ? [{ label: monthDay(one.key), value: `${one.day.score}, ${one.day.band}` }] : []))} />
    </>
  );
}

/** How answers were found, light to deep: with help a soft blue-gray, on a second try a light pink, right away the deep pink. */
export const FOUND_FILL: Record<1 | 2 | 3, string> = { 1: Colors.pinkInk, 2: Colors.pink2, 3: Colors.blueGray };

/** How each day's answers were found, as a stack out of 100%, right away at the bottom, with the chance line named in the margin. Days with fewer than 5 cards get a small dot. */
export function FoundChart({ days, recent, today }: { days: ChartDay[]; recent: InsightsView['recent']; today: string }) {
  const fills = [FOUND_FILL[1], FOUND_FILL[2], FOUND_FILL[3]];
  const chance = recent.chance;
  const references: Reference[] = chance === undefined ? [] : [{ value: chance, label: 'Chance' }];
  return (
    <>
      <ChartFrame
        testID="found-chart"
        summary={foundSummary(recent)}
        count={days.length}
        dateLabel={dateLabelOf(days, today)}
        ticks={[0, 0.5, 1].map((value) => ({ value, label: percentText(value) }))}
        references={references}
        callout={(index) => {
          const shares = days[index].day?.shares;
          return shares ? { text: `${percentText(shares[1])} right away · ${dateLabelOf(days, today)(index)}`, value: shares[1] } : undefined;
        }}>
        {(scale) =>
          days.map((one, index) => {
            const x = scale.x(index) - scale.bar / 2;
            const shares = one.day?.shares;
            if (!shares) return one.day ? <Circle key={one.key} cx={scale.x(index)} cy={scale.bottom - 3} r={2.5} fill={Colors.textMuted} /> : null;
            let from = 0;
            return (
              <G key={one.key}>
                {[shares[1], shares[2], shares[3]].map((share, part) => {
                  const y0 = scale.y(from);
                  from += share;
                  const y1 = scale.y(from);
                  // A 1pt white gap between parts keeps neighbors apart.
                  return share > 0 ? <Path key={part} d={part === 2 || from >= 0.999 ? barPath(x, y0, scale.bar, y0 - y1) : `M${x},${y0} H${x + scale.bar} V${y1 + 1} H${x} Z`} fill={fills[part]} /> : null;
                })}
              </G>
            );
          })
        }
      </ChartFrame>
    </>
  );
}

/** The middle time to the first choice each day, on an axis in seconds from zero. */
export function SpeedChart({ days, today }: { days: ChartDay[]; today: string }) {
  const values = days.map((one) => (one.day?.medianFirstMs === undefined ? undefined : one.day.medianFirstMs / 1000));
  const ticks = niceTicks(Math.max(0, ...values.filter((value): value is number => value !== undefined)), { least: 5 }).map((value) => ({ value, label: `${value} s` }));
  return (
    <>
      <ChartFrame
        testID="speed-chart"
        summary={speedSummary(days)}
        count={days.length}
        dateLabel={dateLabelOf(days, today)}
        ticks={ticks}
        callout={(index) => (values[index] === undefined ? undefined : { text: `${secondsText(values[index]! * 1000)} · ${dateLabelOf(days, today)(index)}`, value: values[index]! })}>
        {(scale) => <LineMarks scale={scale} values={values} color={CHART.primary} />}
      </ChartFrame>
      <ChartValues testID="speed-values" rows={days.flatMap((one) => (one.day?.medianFirstMs !== undefined ? [{ label: monthDay(one.key), value: secondsText(one.day.medianFirstMs) }] : []))} />
    </>
  );
}

/** Each day's active practice time in minutes, against the standard for its target. A partial day's bar is light with a dashed edge. */
export function TimeChart({ days, today }: { days: ChartDay[]; today: string }) {
  const minutes = days.map((one) => (one.day?.standard ? one.day.standard.activeMs / 60_000 : undefined));
  const standards = days.map((one) => (one.day?.standard ? one.day.standard.expectedMs / 60_000 : undefined));
  const shown = standards.filter((value): value is number => value !== undefined);
  const ticks = niceTicks(Math.max(0, ...minutes.map((value) => value ?? 0), ...shown), { least: 5 }).map((value) => ({ value, label: `${value} min` }));
  // One standard for every day: a line named at the edge. Different standards: a short dash on each day instead.
  const one = shown.length > 0 && shown.every((value) => Math.abs(value - shown[0]) < 0.01);
  const references: Reference[] = one ? [{ value: shown[0], label: 'Standard', detail: `${Math.round(shown[0])} min` }] : [];
  const partialOf = (index: number) => days[index].day?.standard?.status === 'partial';
  return (
    <>
      <ChartFrame
        testID="time-chart"
        summary={timeSummary(days)}
        count={days.length}
        dateLabel={dateLabelOf(days, today)}
        ticks={ticks}
        references={references}
        callout={(index) => (minutes[index] === undefined ? undefined : { text: `${Math.round(minutes[index]!)} min${partialOf(index) ? ', partial' : ''} · ${dateLabelOf(days, today)(index)}`, value: minutes[index]! })}>
        {(scale: Scale) =>
          days.map((day, index) => {
            const value = minutes[index];
            if (value === undefined) return null;
            const x = scale.x(index) - scale.bar / 2;
            const d = barPath(x, scale.bottom, scale.bar, scale.bottom - scale.y(value));
            return (
              <G key={day.key}>
                {partialOf(index) ? <Path d={d} fill={CHART.secondary} stroke={CHART.primary} strokeWidth={1.25} strokeDasharray="3 2" /> : <Path d={d} fill={CHART.primary} />}
                {!one && standards[index] !== undefined ? (
                  <Line x1={x - 2} x2={x + scale.bar + 2} y1={scale.y(standards[index]!)} y2={scale.y(standards[index]!)} stroke={Colors.text} strokeWidth={1.5} />
                ) : null}
              </G>
            );
          })
        }
      </ChartFrame>
      {minutes.some((value) => value !== undefined) ? <ChartLegend
        items={[
          { label: 'Day finished', swatch: <Swatch fill={CHART.primary} /> },
          { label: 'Partial day', swatch: <Swatch fill={CHART.secondary} outline={CHART.primary} /> },
        ]}
      /> : null}
    </>
  );
}
