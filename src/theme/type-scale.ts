import type { TextSize } from '@/data/text-size';

export type TypeSize = 'display' | 'title' | 'body' | 'caption';

/** Two more sizes, for the caregiver's screens only: a card's or group's title, and a screen's header. */
export type CompactOnlySize = 'headline' | 'largeTitle';

/** Every size a piece of text can ask for. On the person's screens the compact-only sizes fall back (src/theme/type.ts). */
export type TextRole = TypeSize | CompactOnlySize;

// The one type scale: four sizes, at each Text size setting. Display grows least because it
// is already large; body text grows most. Kept apart from React Native so
// scripts/check-logic.mjs can check it.
export const TYPE_SCALE: Record<TextSize, Record<TypeSize, number>> = {
  small: { display: 34, title: 22, body: 18, caption: 15 },
  medium: { display: 40, title: 26, body: 21, caption: 17 },
  large: { display: 44, title: 29, body: 24, caption: 19 },
  xlarge: { display: 48, title: 32, body: 27, caption: 21 },
};

/**
 * The caregiver's screens: one slim scale of six sizes, whatever the Text size setting says. That
 * setting and the very large type are for the person practicing. From the top: hero figures, a screen's
 * header, step and sheet titles, a card's or group's title (bold), rows and fields, labels and help.
 */
export const COMPACT_SCALE: Record<TextRole, number> = { display: 30, largeTitle: 28, title: 21, headline: 17, body: 16, caption: 13 };

/** The phone's own accessibility text size can grow compact text this far, so layouts hold. */
export const COMPACT_MAX_SCALE = 1.3;

/** Labels on one line shrink to fit down to this, rather than wrap. */
export const MIN_FONT_SCALE = 0.7;
