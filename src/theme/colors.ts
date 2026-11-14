// Evermore's palette, from the logo (assets/images/logo-wordmark.png). Every color in the app
// comes from here. No red anywhere, and no tan, beige or cream. The logo's sky, yellow and
// sage are too light for text, so they only ever fill a shape behind dark text.
// scripts/check-logic.mjs checks every pairing in TEXT_PAIRS is at least 4.5:1.
export const Colors = {
  /** Logo blue (the letters and the claw): filled buttons, progress, chart bars. */
  primary: '#3E6FB0',
  /** The logo blue, darker: pressed buttons, figures and links. */
  primaryDark: '#2B5791',
  /** Logo orb yellow. A fill behind the filled-in name, never text. */
  accent: '#FFD93B',
  background: '#FFFFFF',
  /** Logo sky at a quarter: answer buttons, quiet buttons, fields, notices. */
  surface: '#EAF5FC',
  /** The logo blue, near black. */
  text: '#1C2F4D',
  textMuted: '#4D5D76',
  /** Logo orb halo (sage): the success banner. */
  softSuccess: '#D8E6CA',

  // Derived from the eight above.
  onPrimary: '#FFFFFF',
  /** Logo sky: "some practice" days. */
  sky: '#A9D8F5',
  /** Logo sky at half: progress tracks and pressed surfaces. */
  skySoft: '#D3E9F8',
  /** The logo's orb squiggle: the hint panel. */
  accentSoft: '#FFEEA7',
  /** Deep sage, for text on the success banner. */
  onSoftSuccess: '#2F5A2A',
  divider: '#D3E0EC',
  /** A soft blue-gray: "with help" in how answers were found, apart from both pinks in lightness and hue. */
  blueGray: '#8A9FB9',

  // The Insights pinks, from the logo's brain (its outline #FFB8D2 and folds #F192B6), light to deep,
  // all rose (hue 330 to 340), never red. Since 2026-11-10 the caregiver's Insights brand accent as well
  // as the Memory score's color: the tab and its brain, the page header and segmented controls, chart
  // colors, card accents and the soft tint behind the hero. Lower scores are lighter, so a low day never
  // looks like a warning. Never on a person's screen (scripts/check-logic.mjs follows every import from
  // the person's screens and fails if any reaches them).
  /** The palest: the score chart's Building band. */
  pinkTint: '#FFF0F5',
  /** Getting started on the calendar and the key; the chart's Steady band. */
  pink1: '#FFE1EC',
  /** Building; the chart's Strong band. The brain's outline. */
  pink2: '#FFB8D2',
  /** Steady. The brain's folds. */
  pink3: '#F192B6',
  /** Strong. */
  pink4: '#E07AA5',
  /** Between Strong's pink and the ink: the score ring's arc on a Steady day. */
  pinkDeep: '#C4578A',
  /** The deep rose of the score's figure, its line over time and the badge's star. */
  pinkInk: '#A3416F',
};

type Color = keyof typeof Colors;

/** Every text color and the colors it is drawn on. */
export const TEXT_PAIRS: [text: Color, on: Color][] = [
  ['text', 'background'],
  ['text', 'surface'],
  ['text', 'skySoft'],
  ['text', 'sky'],
  ['text', 'accent'],
  ['text', 'accentSoft'],
  ['text', 'softSuccess'],
  ['textMuted', 'background'],
  ['textMuted', 'surface'],
  ['textMuted', 'skySoft'],
  ['textMuted', 'divider'],
  ['primaryDark', 'background'],
  ['primaryDark', 'surface'],
  ['primaryDark', 'skySoft'],
  ['onPrimary', 'primary'],
  ['onPrimary', 'primaryDark'],
  ['onSoftSuccess', 'softSuccess'],
  ['text', 'pinkTint'],
  ['text', 'pink1'],
  ['text', 'pink2'],
  ['text', 'pink3'],
  ['text', 'pink4'],
  ['textMuted', 'pinkTint'],
  ['textMuted', 'pink1'],
  ['pinkInk', 'background'],
  ['pinkInk', 'surface'],
  ['pinkInk', 'pinkTint'],
  ['pinkInk', 'pink1'],
  ['onPrimary', 'pinkInk'],
];

/** Marks that carry meaning without words (a line, a point, a marker), and what they sit on: at least 3:1. */
export const MARK_PAIRS: [mark: Color, on: Color][] = [
  // The score line and its points, over each band of the score chart.
  ['pinkInk', 'background'],
  ['pinkInk', 'pinkTint'],
  ['pinkInk', 'pink1'],
  ['pinkInk', 'pink2'],
  // The key's chance marker, over any band.
  ['text', 'pink1'],
  ['text', 'pink2'],
  ['text', 'pink3'],
  ['text', 'pink4'],
];
