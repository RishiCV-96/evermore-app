// The score ring's geometry: the arc for a score out of 100, its ticks at the band cutoffs and the
// chance mark. Pure and import-free, so scripts/check-logic.mjs checks the arc for 0, 1, 50, 99 and
// 100, the ticks and the empty ring. Drawn by src/components/insight-ring.tsx, the same ring wherever
// the Memory score appears.

export type RingPoint = { x: number; y: number };
export type RingTick = { value: number; inner: RingPoint; outer: RingPoint };
export type RingGeometry = {
  /** The box the ring is drawn in, with room round it for the ticks and the chance label. */
  width: number;
  height: number;
  /** The ring's middle, and the radius of the stroke's centre line. */
  cx: number;
  cy: number;
  radius: number;
  circumference: number;
  /** Nothing to draw over the track: no score (the empty ring), or a score of 0. */
  empty: boolean;
  /** A full circle, drawn without a gap or caps. */
  full: boolean;
  /** The stroke's dash: the arc's length, then the rest. Round caps add half the stroke at each end, which the length allows for. */
  dash: [number, number];
  /** Degrees to turn the circle so the arc's first cap starts exactly at the top. */
  rotation: number;
  /** How much of the ring the arc covers as drawn, caps included, 0 to 1. */
  share: number;
  /** A short mark just outside the ring at each band's lower edge (the first band, from 0, has none). */
  ticks: RingTick[];
  /** Where random guessing would score: a longer mark, and where its tiny label goes. */
  chance?: RingTick & { label: RingPoint; anchor: 'start' | 'end' | 'middle' };
};

/** Room round the ring: across, for the chance label beside it; up and down, for the ticks. */
export const RING_PAD = { x: 44, y: 14, small: 8 };

/** A point `value` out of 100 round a circle, clockwise from the top. */
export function ringPoint(value: number, r: number, cx: number, cy: number): RingPoint {
  const angle = (Math.min(Math.max(value, 0), 100) / 100) * 2 * Math.PI - Math.PI / 2;
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

/**
 * The ring for a score out of 100, `size` across (the stroke included): a rounded arc from the top,
 * clockwise, over a track. The caps are allowed for, so the arc as drawn ends where the score says:
 * 99 leaves a gap, 100 closes the circle, 1 is a dot, and 0 or no score draws nothing. `labelled`
 * leaves room beside it for the chance label; a small ring has only its marks.
 */
export function ringGeometry(score: number | undefined, size: number, stroke: number, cutoffs: readonly number[], chance?: number, labelled = true): RingGeometry {
  const padX = labelled ? RING_PAD.x : RING_PAD.small;
  const padY = labelled ? RING_PAD.y : RING_PAD.small;
  const width = size + 2 * padX;
  const height = size + 2 * padY;
  const cx = width / 2;
  const cy = height / 2;
  const radius = size / 2 - stroke / 2;
  const circumference = 2 * Math.PI * radius;
  const value = score === undefined || !Number.isFinite(score) ? undefined : Math.min(Math.max(score, 0), 100);
  const empty = value === undefined || value === 0;
  const full = value === 100;
  const length = empty ? 0 : full ? circumference : Math.max(0.01, (value! / 100) * circumference - stroke);
  const capDegrees = empty || full ? 0 : (stroke / 2 / radius) * (180 / Math.PI);
  const outside = size / 2;
  const tickAt = (at: number, from: number, to: number): RingTick => ({ value: at, inner: ringPoint(at, from, cx, cy), outer: ringPoint(at, to, cx, cy) });
  const ticks = cutoffs.filter((cut) => cut > 0 && cut < 100).map((cut) => tickAt(cut, outside + 1.5, outside + Math.min(6, padY - 2)));
  let chanceMark: RingGeometry['chance'];
  if (chance !== undefined && chance > 0 && chance < 100) {
    const point = ringPoint(chance, outside + 10, cx, cy);
    const anchor = Math.abs(point.x - cx) < size * 0.15 ? 'middle' : point.x < cx ? 'end' : 'start';
    // Kept inside the box, whatever the angle.
    const label = { x: point.x, y: Math.min(Math.max(point.y + 4, 11), height - 2) };
    chanceMark = { ...tickAt(chance, outside + 1.5, outside + Math.min(8, padY - 1)), label, anchor };
  }
  return {
    width,
    height,
    cx,
    cy,
    radius,
    circumference,
    empty,
    full,
    dash: [length, circumference],
    rotation: -90 + capDegrees,
    share: empty ? 0 : full ? 1 : (length + stroke) / circumference,
    ticks,
    chance: chanceMark,
  };
}

/**
 * The hero ring's size for a screen: 150 to 180 across, smaller on the narrowest phones so nothing
 * clips, and 150 on phones shorter than 700pt so the whole hero card fits above the tab bar.
 */
export function heroRingSize(screenWidth: number, screenHeight = 900) {
  const byWidth = Math.round(Math.min(180, Math.max(150, (screenWidth - 48) * 0.5)));
  return screenHeight < 700 ? 150 : byWidth;
}
