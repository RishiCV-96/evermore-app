import { Easing } from 'react-native-reanimated';

// Motion on the caregiver's screens. Every animated value is a Reanimated shared value driven by
// withTiming, which starts from wherever the value is, so a quick press and release, or a toggle tapped
// twice, turns around smoothly instead of jumping. With Reduce Motion: no movement, only tone changes,
// and entrances simply appear. The person's screens get no new motion.

export const Motion = {
  /** A press: a little smaller and a tone darker. */
  press: { duration: 120, scale: 0.97 },
  /** A toggle, a segment or a pill moving. */
  toggle: { duration: 180 },
  /** A caregiver screen's first appearance: groups slide up 8pt and fade in, one after another. */
  enter: { duration: 300, stagger: 70, distance: 8, most: 5 },
} as const;

/** Ease out: quick to answer, gentle to settle. */
export const EASE_OUT = Easing.out(Easing.cubic);

/** The enter curve (an ease-out quad, from "Details that make interfaces feel better"). */
export const EASE_ENTER = Easing.bezier(0.25, 0.46, 0.45, 0.94);
