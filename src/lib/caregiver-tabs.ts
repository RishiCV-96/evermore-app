// The caregiver's six tabs, and whether their labels fit side by side. Pure, so
// scripts/check-logic.mjs checks the bar at every iPhone width and text scale.

export type CaregiverTab = 'today' | 'trends' | 'insights' | 'people' | 'board' | 'settings';

/**
 * Short labels, each under an icon. Insights is its own tab since 2026-11-10, and the Family board
 * since 2026-11-18 (docs/FAMILY-BOARD-TAB-PLAN.md): "Board" in the bar, "Family board" on its page,
 * because "Family board" can't fit a sixth of a 375pt screen.
 */
export const CAREGIVER_TABS: { id: CaregiverTab; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'trends', label: 'Trends' },
  { id: 'insights', label: 'Insights' },
  { id: 'people', label: 'People' },
  { id: 'board', label: 'Board' },
  { id: 'settings', label: 'Settings' },
];

/**
 * The bar's sizes: each tab's label size and the room either side of it. 11pt, the size of iOS's own
 * tab labels, and no side padding, so six labels fit: "Settings" at full size from 375pt, and above
 * 70% at the largest caregiver text scale even at 320pt.
 */
export const TAB_BAR = { label: 11, side: 0, bar: 0, icon: 24 };

/** About how wide a bold label is: Atkinson Hyperlegible Bold runs to about two thirds of its size a character. */
const boldWidth = (text: string, size: number) => text.length * size * 0.66;

/**
 * How far the widest label must shrink to fit its sixth of the screen at a text scale (1 at the
 * phone's default, up to the caregiver's cap of 1.3): 1 when it fits as it is. A label that would
 * need to shrink below the app's 70% would wrap or cut off instead, which the check refuses.
 */
export function tabShrink(screenWidth: number, scale = 1, tabs = CAREGIVER_TABS) {
  const room = (screenWidth - 2 * TAB_BAR.bar) / tabs.length - 2 * TAB_BAR.side;
  const widest = Math.max(...tabs.map((tab) => boldWidth(tab.label, TAB_BAR.label * scale)));
  return Math.min(1, room / widest);
}
