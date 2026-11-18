// The palette, from the Tandem brand (brand-kit/tandem-brand-guide.png). Every color in the app comes
// from here. No red anywhere, and no tan, beige or cream. Sky, Mist and Sun are never text; Rose is for
// shapes and big text only; Deep Rose is the text pink. The pinks (Rose, Deep Rose and the Insights
// family) stay on the caregiver's side: never on a person's screen (scripts/check-logic.mjs).
// scripts/check-logic.mjs checks every text and background combination in TEXT_PAIRS is at least 4.5:1.

/** The six brand colors (draft v1, approximate until the brand is final). Screens use `Colors`, below. */
export const Brand = {
  /** Shapes, buttons and big text only: 3.2:1 on white, too light for small text. Caregiver side only. */
  rose: '#E8629C',
  /** The text and link pink: 5.2:1 on white. Caregiver side only. */
  deepRose: '#B0467F',
  /** Shapes and illustration, never text. */
  sky: '#8EC5F2',
  /** Cards and soft backgrounds, never text. */
  mist: '#EAF3FB',
  /** The spark: fills only, never text. */
  sun: '#F7C948',
  /** Headlines and body text, and the filled buttons. */
  ink: '#1F2B4D',
} as const;

export const Colors = {
  /** Ink: filled buttons, selected fills, progress figures and chart bars. */
  primary: Brand.ink,
  /** Ink lifted toward Sky: pressed filled buttons, and links and figures on the person's side. */
  primaryDark: '#2F4A7A',
  /** Sun. A fill behind the filled-in name, never text. */
  accent: Brand.sun,
  background: '#FFFFFF',
  /** Mist: answer buttons, quiet buttons, fields, notices. */
  surface: Brand.mist,
  /** Ink. */
  text: Brand.ink,
  textMuted: '#4D5D76',
  /** Sky, softened: the success banner. */
  softSuccess: '#D2E8FA',

  // Derived from the eight above.
  onPrimary: '#FFFFFF',
  /** Sky: progress, "some practice" days. */
  sky: Brand.sky,
  /** Sky at half: progress tracks and pressed surfaces. */
  skySoft: '#C6E2F9',
  /** Sun at 40%: the hint panel, and the pinned note on the caregiver's Family board tab (never the person's). */
  accentSoft: '#FCE9B6',
  /** Ink, for text on the success banner. */
  onSoftSuccess: Brand.ink,
  divider: '#D3E0EC',
  /** A soft blue-gray: "with help" in how answers were found, apart from both pinks in lightness and hue. */
  blueGray: '#8A9FB9',

  /** Deep Rose: links and small accents on the caregiver's screens, given by the caregiver layout
   *  (src/theme/accent.tsx). Never on a person's screen, like the pinks below. */
  deepRose: Brand.deepRose,

  // The Insights pinks, light to deep, all rose (hue 325 to 345), never red. The caregiver's Insights
  // accent as well as the Memory score's color: the tab and its brain, the page header and segmented
  // controls, chart colors, card accents and the soft tint behind the hero. Lower scores are lighter, so
  // a low day never looks like a warning. Never on a person's screen (scripts/check-logic.mjs follows
  // every import from the person's screens and fails if any reaches them). Rose is the arc pink; Strong
  // and the score's ink stay a little lighter and deeper than Rose and Deep Rose, because Ink text on
  // Rose is 4.4:1 and Deep Rose on pink1 is 4.3:1, both under 4.5:1.
  /** The palest: the score chart's Building band. */
  pinkTint: '#FFF0F5',
  /** Getting started on the calendar and the key; the chart's Steady band. */
  pink1: '#FFE1EC',
  /** Building; the chart's Strong band. */
  pink2: '#FFB8D2',
  /** Steady. */
  pink3: '#F192B6',
  /** Strong. Lighter than Rose, so Ink text on it stays 4.5:1. */
  pink4: '#E07AA5',
  /** Rose: the score ring's arc on a Steady day. */
  pinkDeep: Brand.rose,
  /** The deep rose of the score's figure, its line over time and the badge's star. Deeper than Deep Rose, so it stays 4.5:1 on pink1. */
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
  ['deepRose', 'background'],
  ['deepRose', 'surface'],
  // The caregiver's Family board tab (since 2026-11-18): the Caregiver chip, and the relationship on its pastels.
  ['deepRose', 'pinkTint'],
  ['textMuted', 'accentSoft'],
  ['textMuted', 'softSuccess'],
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
  // The progress bar's outline and fill: Ink on the person's screens, Deep Rose on the caregiver's.
  ['text', 'background'],
  ['deepRose', 'background'],
];
