import { REVEAL_CHANCE, type RevealSetting } from '@/config/schedule';
import { firstTryCorrect, type CardResult } from '@/lib/queue';
import type { Round } from '@/lib/stories';

// Reveal cards: the photo starts behind a "?" and is shown when tapped or once answered. A person
// gets one only after answering a question about them on the first try that day, with no hint and
// without tapping the "?".
//
// That unlock is scheduling logic and nothing else. It lives here, in memory, for the day's deck:
// it is never saved, never sent, and no screen can read it. Keep it that way: nothing but
// src/components/practice-screen.tsx imports this file (scripts/check-logic.mjs checks).

/** Who may have a reveal card, for one day's deck. */
let dayDeck = { day: '', people: new Set<string>() };

/** A card was answered. A first try with no hint and no reveal unlocks that person for the rest of the day. */
export function noteAnswer(personId: string, result: CardResult, revealed: boolean, day: string) {
  if (dayDeck.day !== day) dayDeck = { day, people: new Set() };
  if (firstTryCorrect(result) && !revealed) dayDeck.people.add(personId);
}

/**
 * Whether this card starts behind the "?". Never for a card asked again after a hint, because that
 * person needs the photo; never for a photo-only card, which would have nothing to go on; never for
 * a reverse card, which already names them; never for someone without a photo or opted out; and
 * only for someone unlocked today.
 */
export function startsHidden(round: Round, setting: RevealSetting, day: string, random = Math.random) {
  if (round.again || round.phrasing.kind === 'photo' || round.phrasing.kind === 'reverse' || !round.revealOk) return false;
  if (dayDeck.day !== day || !dayDeck.people.has(round.personId)) return false;
  return random() < REVEAL_CHANCE[setting];
}

/** A reveal card shows the photo once it is tapped, and always by the time the card is answered. */
export function photoShown(card: { reveal?: boolean; tapped: boolean; answered: boolean }) {
  return !card.reveal || card.tapped || card.answered;
}
