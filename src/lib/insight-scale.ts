// The geometry every Insights chart and the score ring share: scales, ticks, which dates get a
// label, where a callout goes, and the ring's arc. Pure and import-free, so scripts/check-logic.mjs
// checks it, and so every chart is laid out by the same rules. Nothing here counts practice: the
// figures come from src/lib/insights.ts.

/** A value mapped onto pixels, straight-line. A flat domain maps everything to the range's start. */
export function linear(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0;
  return (value: number) => (span === 0 ? r0 : r0 + ((value - d0) / span) * (r1 - r0));
}

/** The step of a round size at or above `rough`: 1, 2 or 5 (or the given steps) times a power of ten. */
export function niceStep(rough: number, steps: readonly number[] = [1, 2, 5]) {
  if (!(rough > 0) || !Number.isFinite(rough)) return steps[0];
  const power = 10 ** Math.floor(Math.log10(rough));
  const found = steps.find((step) => step * power >= rough - 1e-9);
  return (found ?? 10) * power;
}

/**
 * Ticks from zero to a round number at or above `max`, about `target` steps apart: bars always start
 * at zero. `least` keeps a near-empty chart from collapsing (a chart of 0.4 s still reads 0 to 1 s).
 */
export function niceTicks(max: number, { target = 3, least = 1, steps = [1, 2, 5] as readonly number[] } = {}) {
  const top = Math.max(max, least);
  const step = niceStep(top / target, steps);
  const count = Math.max(1, Math.ceil(top / step - 1e-9));
  return Array.from({ length: count + 1 }, (_, index) => Math.round(index * step * 1e9) / 1e9);
}

/** Where day `index` of `count` sits across a plot: the middle of its slot, so the first and last never touch an edge. */
export function slotCenter(index: number, count: number, left: number, width: number) {
  const slot = width / Math.max(count, 1);
  return left + slot * (index + 0.5);
}

/**
 * Which of `count` dates get a label, when at most `fit` fit side by side: always the first and the
 * last, then evenly between. Never more labels than fit, never two on one date.
 */
export function labelIndexes(count: number, fit: number) {
  if (count <= 0) return [];
  if (count === 1 || fit <= 1) return [count - 1];
  const shown = Math.min(count, Math.max(2, Math.floor(fit)));
  const step = (count - 1) / (shown - 1);
  return [...new Set(Array.from({ length: shown }, (_, index) => Math.round(index * step)))];
}

/** About how wide a label is drawn, in points: Atkinson Hyperlegible with tabular figures runs to about two thirds of its size per character. */
export function textWidth(text: string, size: number) {
  return text.length * size * 0.64;
}

/** Where a callout `wide` points across goes so its middle is over `x` when it can be, and it never runs past either edge. */
export function calloutLeft(x: number, wide: number, start: number, end: number) {
  if (wide >= end - start) return start;
  return Math.min(Math.max(x - wide / 2, start), end - wide);
}

/** Which day a tap at `x` means: the nearest slot, within the plot. */
export function slotAt(x: number, count: number, left: number, width: number) {
  if (count <= 0) return undefined;
  const index = Math.floor(((x - left) / Math.max(width, 1)) * count);
  return Math.min(Math.max(index, 0), count - 1);
}

/**
 * The score line's range: up to 100, and down to 50 or, when a day scored lower, the round ten
 * below it, never under `floor` (the lowest a day can score). The bands share the height sensibly,
 * and no day's point is ever cut off.
 */
export function scoreDomain(scores: number[], floor: number, low = 50): [number, number] {
  const least = scores.length ? Math.min(...scores) : 100;
  return [Math.max(floor, Math.min(low, Math.floor((least - 5) / 10) * 10)), 100];
}
