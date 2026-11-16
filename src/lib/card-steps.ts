import type { CardResult } from '@/lib/queue';
import { NOT_SURE, answerOf, hintAt, hintLadder, hintStep, type HintRung, type HintStep, type Round } from '@/lib/stories';

// One practice card's way to its answer: every other name chosen (the same one again included), and
// each "I'm not sure" tap, moves the hint exactly one step along the same ladder (hintAt in
// src/lib/stories.ts), never two, never back, and never past the answer. A name once chosen is
// dimmed and can't be chosen again, so a mistake can't loop; once the hint says the answer, only
// that name is live. A help tap is not a wrong answer: it chooses nothing, records no selection, and
// the person still ends the card by tapping the right name. docs/HINT-LADDER.md has the reasons.
// Pure, so scripts/check-logic.mjs can walk it.

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
  /** Every other name chosen, once each, in order: dimmed and no longer offered as a live choice. */
  tried: string[];
  /** The newest step came from "I'm not sure", so the first hint opens with the calm line. */
  fromHelp: boolean;
  /** The right name was chosen. */
  answered: boolean;
};

export const startSteps = (): CardSteps => ({ misses: 0, wrong: 0, hints: [], help: [], tried: [], fromHelp: false, answered: false });

/** The hint has said the answer: the last step, so nothing moves it further. */
export const answerShown = (round: Round, state: CardSteps) => hintAt(round, state.misses).show;

/**
 * One step further along the ladder: the rung it shows (as the card always recorded it), and a name
 * set aside at "fewer names". At the answer it stays put: there is no step after it.
 */
function stepOn(round: Round, state: CardSteps, other: string | undefined): CardSteps {
  if (answerShown(round, state)) return state;
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

/**
 * A name was chosen: the right one ends the card; any other moves the hint one step, even one chosen
 * before (a second tap that lands before it dims still counts, and still brings the next hint). Each
 * is counted as a name chosen, as the card always counted it.
 */
export function chooseName(round: Round, state: CardSteps, name: string): CardSteps {
  if (state.answered) return state;
  if (name === answerOf(round)) return { ...state, answered: true };
  const tried = state.tried.includes(name) ? state.tried : [...state.tried, name];
  return { ...stepOn(round, state, name), wrong: state.wrong + 1, lastOther: name, tried, fromHelp: false };
}

/**
 * Whether a name's button is live. Dimmed (and disabled) once chosen, so the same mistake can't loop,
 * and every other name once the hint has said the answer, so the right one is the way on. The answer
 * is always live. A calm dim, never red.
 */
export function nameLive(round: Round, state: CardSteps, name: string) {
  if (name === answerOf(round)) return true;
  return !state.tried.includes(name) && !answerShown(round, state);
}

/** "I'm not sure": the next hint step at once, as if it had been earned, with nothing chosen. Nothing once the answer is shown. */
export function askForHelp(round: Round, state: CardSteps): CardSteps {
  if (!notSureShown(round, state)) return state;
  const next = stepOn(round, state, undefined);
  return { ...next, help: [...state.help, hintStep(round, next.misses)], fromHelp: true };
}

/** Whether the control shows: never once the answer is chosen or the hint has said it. */
export const notSureShown = (round: Round, state: CardSteps) => !state.answered && !answerShown(round, state);

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
