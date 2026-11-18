// How the caregiver's Family board tab draws its cards (docs/FAMILY-BOARD-TAB-PLAN.md): a pastel per
// card and a very slight tilt. Pure, so scripts/check-board.mjs checks both. The caregiver's side only:
// the person's board is straight, in Mist and the Sky tint, and never imports this file.

/** The three pastels: the warm sun tint for the pinned note, then rose and sky for the others, in turn. */
export type CardTone = 'sun' | 'rose' | 'sky';

/** Each card's tone, in the order the board shows them (the pinned one first). */
export function cardTones(notes: { pinned: boolean }[]): CardTone[] {
  let others = 0;
  return notes.map((note) => (note.pinned ? 'sun' : others++ % 2 === 0 ? 'rose' : 'sky'));
}

/** The largest tilt, in degrees either way, and the smallest, so no card looks accidentally straight. */
export const TILT_MOST = 1;
export const TILT_LEAST = 0.4;

/**
 * A card's tilt in degrees, from its id alone, so it never changes between renders or launches:
 * between 0.4 and 1 degree, either way.
 */
export function noteTilt(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const amount = TILT_LEAST + ((hash % 1000) / 999) * (TILT_MOST - TILT_LEAST);
  const tilt = (hash & 1 ? -1 : 1) * amount;
  return Math.round(tilt * 100) / 100;
}
