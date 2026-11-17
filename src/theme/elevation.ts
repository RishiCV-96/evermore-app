import type { ViewStyle } from 'react-native';

// Depth on the caregiver's screens: hairline, layered shadows tinted with Ink (never black), in place of
// hard borders. React Native's `boxShadow` style (the New Architecture, which SDK 58 always uses) draws
// them on iOS, Android and the web build alike. Most surfaces stay flat: Mist on white needs no edge.
// Never on a person's screen: shared components ask `useCompact()` first (scripts/check-logic.mjs).

const INK = '31, 43, 77';

export const Elevation = {
  /** A white thing on Mist or white that needs an edge: a chip, the chosen segment, a pill button, a card on white. */
  edge: {
    boxShadow: `0 0 0 1px rgba(${INK}, 0.06), 0 1px 2px -1px rgba(${INK}, 0.06), 0 2px 4px 0 rgba(${INK}, 0.04)`,
  } satisfies ViewStyle,
  /** Floating above the page: the pinned bar, the tab bar, the toast. The shadow rises from the bottom edge. */
  float: {
    boxShadow: `0 -1px 0 0 rgba(${INK}, 0.06), 0 -8px 24px 0 rgba(${INK}, 0.08)`,
  } satisfies ViewStyle,
  /** Floating, seen from above: the toast. */
  lifted: {
    boxShadow: `0 0 0 1px rgba(${INK}, 0.06), 0 8px 24px 0 rgba(${INK}, 0.14)`,
  } satisfies ViewStyle,
} as const;

/** A photo's inset outline, so a pale photo keeps its edge on white or Mist. Drawn by an overlay view. */
export const PHOTO_OUTLINE = `rgba(${INK}, 0.10)`;
