// The spacing scale (a 4 and 8 base), the corner radii, and the smallest tap targets.
export const Space = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32, xxxl: 48 };

/**
 * The person's screens: one corner radius for everything. A bar thinner than twice this comes out
 * fully round. The caregiver's screens use `Radius` below.
 */
export const RADIUS = 16;

/**
 * The caregiver's radius scale, with the concentric rule: a corner that sits inside another, inset by
 * some padding, uses the outer radius less that padding. `card` holds content inset by 16, so what hugs
 * its corner uses `inner` (24 = 8 + 16). Never on a person's screen (scripts/check-logic.mjs).
 */
export const Radius = {
  /** Slim bars, tags and chart marks. */
  xs: 4,
  /** Inside a card, at its 16pt padding: a photo or tile near its corner. */
  inner: 8,
  /** Standalone controls: buttons, fields, notices, the toast. The same as the person's one radius. */
  control: RADIUS,
  /** Cards and grouped lists that hold inset content. */
  card: 24,
  /** Chips, the chosen tab, pill buttons: fully round at any height. */
  pill: 999,
} as const;

/** Side margins on the person's screens. */
export const GUTTER = Space.xl;

/** Side margins on the caregiver's screens: a little narrower, so two short fields fit side by side at 375pt. */
export const CAREGIVER_GUTTER = 20;

/** The smallest tap target on the person's screens, at every text size, as drawn. */
export const TAP = 48;

/** The person's touch area: `hitSlop` grows a 48pt control to this without drawing it bigger. */
export const PERSON_TOUCH = 56;

/** `hitSlop` that grows a control of `size` points to the person's 56pt touch area. */
export const touchSlop = (size = TAP) => Math.max(0, Math.ceil((PERSON_TOUCH - size) / 2));

/** The smallest tap target on the caregiver's compact screens. */
export const COMPACT_TAP = 44;

/** Every icon is Ionicons outline at this size. */
export const ICON = 24;

/** A leading icon in a caregiver's list row. */
export const ROW_ICON = 20;
