// The caregiver's five tabs, and whether their labels fit side by side. Pure, so
// scripts/check-logic.mjs checks the bar at every iPhone width and text scale.

export type CaregiverTab = 'today' | 'trends' | 'insights' | 'people' | 'settings';

/** Short labels, each under an icon. Insights is its own tab since 2026-11-10. */
export const CAREGIVER_TABS: { id: CaregiverTab; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'trends', label: 'Trends' },
  { id: 'insights', label: 'Insights' },
  { id: 'people', label: 'People' },
  { id: 'settings', label: 'Settings' },
];

/** The bar's sizes: each tab's label size and the room either side of it. */
export const TAB_BAR = { label: 12, side: 2, bar: 4, icon: 24 };

/** About how wide a bold label is: Atkinson Hyperlegible Bold runs to about two thirds of its size a character. */
const boldWidth = (text: string, size: number) => text.length * size * 0.66;

/**
 * How far the widest label must shrink to fit its fifth of the screen at a text scale (1 at the
 * phone's default, up to the caregiver's cap of 1.3): 1 when it fits as it is. A label that would
 * need to shrink below the app's 70% would wrap or cut off instead, which the check refuses.
 */
export function tabShrink(screenWidth: number, scale = 1, tabs = CAREGIVER_TABS) {
  const room = (screenWidth - 2 * TAB_BAR.bar) / tabs.length - 2 * TAB_BAR.side;
  const widest = Math.max(...tabs.map((tab) => boldWidth(tab.label, TAB_BAR.label * scale)));
  return Math.min(1, room / widest);
}
