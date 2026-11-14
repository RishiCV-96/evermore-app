// The caregiver's insights: every number they use, in one place. Caregiver-only, practice activity,
// never a medical measure, and never compared with anyone else (see "Insights" in CLAUDE.md). Each
// choice is explained in DESIGN.md, and scripts/check-logic.mjs checks them against worked figures.

/**
 * Active time on a card counts only while the app is in use: time in the background never counts,
 * and no stretch between one tap and the next counts for more than `idleGapMs`, so a phone put down
 * mid-card doesn't run up minutes. For averages and totals, one card counts for at most `cardCapMs`.
 */
export const ACTIVE_TIME = { idleGapMs: 60_000, cardCapMs: 90_000 };

/** How long the phone keeps each card's record for insights. */
export const ATTEMPTS_KEPT_DAYS = 120;

/**
 * The daily Memory score. Each of the day's cards earns points for the choice it was found on:
 * the first 1, the second 0.6, the third or later 0.3. The day's score is the average, out of 100,
 * rounded. Only a day with at least `minCards` such cards has a score; a day without practice has
 * none, and nothing counts against it. Choosing at random would score about 63 with three answers
 * offered, and 80 with two (`chanceScore`), which the bands and the explanation both allow for.
 */
export const MEMORY_SCORE = { points: { 1: 1, 2: 0.6, 3: 0.3 }, minCards: 10 } as const;

/**
 * Names for a day's score, lowest first, from each band's lower edge. They are soft backgrounds on
 * the charts, never a pass or a fail. "Getting started" covers what choosing at random would score
 * with three answers offered (about 63).
 */
export const SCORE_BANDS = [
  { name: 'Getting started', from: 0 },
  { name: 'Building', from: 65 },
  { name: 'Steady', from: 80 },
  { name: 'Strong', from: 90 },
] as const;

export type BandName = (typeof SCORE_BANDS)[number]['name'];

/** No share or median is shown from fewer cards than this. */
export const MIN_CARDS_SHOWN = 5;

/** Below this many cards, a figure carries an "early read" tag. */
export const EARLY_READ_CARDS = 30;

/**
 * Practice time against the standard: the day's target times SECONDS_PER_CARD. At least `met` of
 * it is "met", at least `about` is "about", less is "short of". A day whose target wasn't finished
 * is "partial", whatever its time.
 */
export const SESSION_STANDARD = { met: 0.8, about: 0.6 };

/**
 * How someone's practice is going, against their own earlier practice only: the last `windowDays`
 * against the `windowDays` before. Both windows need `minCards` of the day's cards, and the two
 * together `minDays` days of practice. A change counts only if it is at least `minChange` (as a
 * share of the most points) and at least twice its standard error; anything less is "steady".
 */
export const TREND = { windowDays: 14, minCards: 10, minDays: 7, minChange: 0.1 };
