import type { CardResult } from '@/lib/queue';
import { NOT_SURE, answerOf, hintAt, hintLadder, hintStep, type HintRung, type HintStep, type Round } from '@/lib/stories';

// One practice card's way to its answer: each other name chosen, and each "I'm not sure" tap, moves
// the hint one step along the same ladder (hintAt in src/lib/stories.ts). A help tap is not a wrong
// answer: it chooses nothing, records no selection, and the person still ends the card by tapping
// the right name. Pure, so scripts/check-logic.mjs can walk it.

export type CardSteps = {
  /** Hint steps taken, by either way. hintAt reads this. */
  misses: number;
  /** Other names chosen. A help tap never adds one. */
  wrong: number;
  /** The rungs shown, one for each step, as before help existed (src/lib/attempts.ts). */
  hints: HintRung[];
  /** The step each "I'm not sure" tap reached, in order. */
  help: HintStep[];
  /** The name the "fewer names" hint set aside. */
  setAside?: string;
  /** The last other name chosen, set aside first once the ladder reaches "fewer names". */
  lastOther?: string;
  /** The newest step came from "I'm not sure", so the first hint opens with the calm line. */
  fromHelp: boolean;
  /** The right name was chosen. */
  answered: boolean;
};

export const startSteps = (): CardSteps => ({ misses: 0, wrong: 0, hints: [], help: [], fromHelp: false, answered: false });

/** One step further along the ladder: the rung it shows (as the card always recorded it), and a name set aside at "fewer names". */
function stepOn(round: Round, state: CardSteps, other: string | undefined): CardSteps {
  const misses = state.misses + 1;
  const ladder = hintLadder(round);
  const rung = ladder[Math.min(misses, ladder.length) - 1];
  const target = answerOf(round);
  // Help chose no name, so "fewer names" sets aside the last other name chosen, or else the first one offered.
  const aside = other ?? state.lastOther ?? round.choices.find((name) => name !== target);
  return {
    ...state,
    misses,
    hints: rung ? [...state.hints, rung] : state.hints,
    setAside: hintAt(round, misses).fewer && !state.setAside ? aside : state.setAside,
  };
}

/** A name was chosen: the right one ends the card; another moves the hint one step. */
export function chooseName(round: Round, state: CardSteps, name: string): CardSteps {
  if (state.answered) return state;
  if (name === answerOf(round)) return { ...state, answered: true };
  return { ...stepOn(round, state, name), wrong: state.wrong + 1, lastOther: name, fromHelp: false };
}

/** "I'm not sure": the next hint step at once, as if it had been earned, with nothing chosen. Nothing once the answer is shown. */
export function askForHelp(round: Round, state: CardSteps): CardSteps {
  if (!notSureShown(round, state)) return state;
  const next = stepOn(round, state, undefined);
  return { ...next, help: [...state.help, hintStep(round, next.misses)], fromHelp: true };
}

/** Whether the control shows: never once the answer is chosen or the hint has said it. */
export const notSureShown = (round: Round, state: CardSteps) => !state.answered && !hintAt(round, state.misses).show;

/** The control's words: "I'm not sure", and "Show me" when the next tap shows the answer. None when it is hidden. */
export function notSureButton(round: Round, state: CardSteps) {
  if (!notSureShown(round, state)) return undefined;
  const last = hintAt(round, state.misses + 1).show;
  return last ? { label: NOT_SURE.last, spoken: NOT_SURE.lastSpoken } : { label: NOT_SURE.label, spoken: NOT_SURE.spoken };
}

/** The hint the card shows now. A first hint brought by "I'm not sure" opens with the calm line instead of "Take your time.". */
export function hintNow(round: Round, state: CardSteps) {
  const hint = hintAt(round, state.misses);
  const calm = state.fromHelp && state.misses > 0 && !hint.show && hint.lead === 'Take your time.';
  return calm ? { ...hint, lead: NOT_SURE.calm } : hint;
}

/**
 * How the card went, for the schedule: tries are the names chosen (the right one included), and
 * every hint step counts as a hint used, whichever way it came. A card that needed help moves back a
 * step like any card that needed a hint, and comes back later in the session the same way.
 */
export const cardResult = (state: CardSteps): CardResult => ({ tries: state.wrong + 1, hintsUsed: state.misses });
