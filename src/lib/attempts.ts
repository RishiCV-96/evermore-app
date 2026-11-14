import { ACTIVE_TIME, ATTEMPTS_KEPT_DAYS } from '@/config/insights';
import { calendarKey, lastDays } from '@/lib/activity';
import type { FactType, HintRung, PhrasingKind } from '@/lib/stories';

// One card as it was practiced: what it asked, each answer chosen and when, the hints it took, and
// how long it was on screen while the app was in use. Kept on the phone with sign-in off; with
// sign-in on, uploaded from the person's phone (src/lib/attempt-records.ts says what goes). Read only
// by the caregiver's insights (src/lib/insights.ts), and never shown on the person's screens.
// Pure, so scripts/check-logic.mjs can check it.
//
// Not recorded, on purpose: whether a card started behind the "?" and whether the "?" was tapped.
// The hard rules make that tap a free hint that nothing records, and keep who is unlocked unsaved.

export type Selection = {
  /** When it was chosen. */
  at: string;
  /** The right answer. A card ends on its first right one. */
  right: boolean;
};

export type CardAttempt = {
  id: string;
  sessionId: string;
  /** Whose card: the person in the photo. */
  personId: string;
  cardId: string;
  /** The question: this card, asked this way (`ai-` for an approved AI sentence). */
  phrasingId: string;
  shape: PhrasingKind;
  /** Missing on a card saved before facts. */
  factType?: FactType;
  source: 'template' | 'ai';
  /** When the card came up. */
  shownAt: string;
  /** Every name (or fact, on a reverse card) chosen, in order. */
  selections: Selection[];
  /** How many were offered at the start. */
  choices: number;
  /** The hint rungs shown, one for each other answer chosen, in order. */
  hints: HintRung[];
  /** Ended on the right answer. False only when the person left the card first. */
  success: boolean;
  /** On screen while the app was in use (ACTIVE_TIME). */
  activeMs: number;
  /** The same, up to the first choice. Missing when nothing was chosen. */
  firstSelectionMs?: number;
  /** The day's target when the card was practiced. */
  goal: number;
  /** Came back after a hint (a re-ask or the review pass), so not one of the day's cards. */
  extra?: boolean;
  /**
   * The study day it counts toward: the one its round began in, worked out on the device when the
   * round started (src/lib/study-day.ts). Missing on older records, which use shownAt instead.
   */
  studyDay?: string;
  /** Its round began once the day's session was complete: extra practice. Counted, and labelled so. */
  extraPractice?: boolean;
  /** Made up: demo insights, or a card that is test data. Left out of insights unless demo mode is on. */
  testData?: boolean;
  /** Made by the demo, removed with it. */
  demo?: boolean;
};

/**
 * Active milliseconds across a run of moments (shown, each choice, leaving): time in the background
 * (`away`, as [from, to] spans) never counts, and no stretch between two moments counts beyond
 * `idleGap`.
 */
export function activeBetween(moments: number[], away: [number, number][], idleGap = ACTIVE_TIME.idleGapMs) {
  let total = 0;
  for (let i = 1; i < moments.length; i++) {
    const from = moments[i - 1];
    const to = moments[i];
    const background = away.reduce((sum, [start, end]) => sum + Math.max(0, Math.min(end, to) - Math.max(start, from)), 0);
    total += Math.min(Math.max(to - from - background, 0), idleGap);
  }
  return total;
}

/** For averages, one card counts for at most ACTIVE_TIME.cardCapMs. */
export const cappedMs = (ms: number) => Math.min(ms, ACTIVE_TIME.cardCapMs);

export type Resolution = 1 | 2 | 3;

/** On which choice a card was resolved: 1, 2, or 3 for the third or later. None if it never was. */
export function resolvedOn(attempt: Pick<CardAttempt, 'selections' | 'success'>): Resolution | undefined {
  if (!attempt.success) return undefined;
  const at = attempt.selections.findIndex((selection) => selection.right);
  return at < 0 ? undefined : (Math.min(at + 1, 3) as Resolution);
}

/** One of the day's cards, resolved: what every insight counts. Re-asks and the review pass don't count, as for completion. */
export const counted = (attempt: CardAttempt) => !attempt.extra && resolvedOn(attempt) !== undefined;

type CardAsked = {
  id: string;
  personId: string;
  phrasing: { id: string; kind: PhrasingKind };
  fact?: { type: FactType };
  choices: unknown[];
  again?: unknown;
};

/** What the practice card measured, in milliseconds since the epoch. */
export type CardTiming = {
  shownAt: number;
  selections: { at: number; right: boolean }[];
  /** Spans the app spent in the background. */
  away: [number, number][];
  leftAt: number;
  hints: HintRung[];
};

/** The record of one card, from the card as asked and what the practice card measured. */
export function attemptOf(
  card: CardAsked,
  timing: CardTiming,
  context: { id: string; sessionId: string; goal: number; source: CardAttempt['source']; studyDay?: string; extraPractice?: boolean },
): CardAttempt {
  const picks = timing.selections;
  const success = picks.some((pick) => pick.right);
  return {
    id: context.id,
    sessionId: context.sessionId,
    personId: card.personId,
    cardId: card.id,
    phrasingId: card.phrasing.id,
    shape: card.phrasing.kind,
    ...(card.fact ? { factType: card.fact.type } : {}),
    source: context.source,
    shownAt: new Date(timing.shownAt).toISOString(),
    selections: picks.map((pick) => ({ at: new Date(pick.at).toISOString(), right: pick.right })),
    choices: card.choices.length,
    hints: timing.hints,
    success,
    activeMs: activeBetween([timing.shownAt, ...picks.map((pick) => pick.at), timing.leftAt], timing.away),
    ...(picks.length ? { firstSelectionMs: activeBetween([timing.shownAt, picks[0].at], timing.away) } : {}),
    goal: context.goal,
    ...(card.again ? { extra: true } : {}),
    ...(context.studyDay ? { studyDay: context.studyDay } : {}),
    ...(context.extraPractice ? { extraPractice: true } : {}),
  };
}

/** Where the phone keeps the records with sign-in off: one key per month, `evermore.attempts.v1.<YYYY-MM>`. */
export const ATTEMPTS_KEY = 'evermore.attempts.v1';

/** The month an attempt is kept under on the phone: its calendar month, YYYY-MM. Storage only, not a study day. */
export const monthOf = (attempt: Pick<CardAttempt, 'shownAt'>) => calendarKey(new Date(attempt.shownAt)).slice(0, 7);

/** The attempts still kept: those from the last ATTEMPTS_KEPT_DAYS days. */
export function keptAttempts(attempts: CardAttempt[], now: Date) {
  const start = lastDays(now, ATTEMPTS_KEPT_DAYS)[0].getTime();
  return attempts.filter((attempt) => new Date(attempt.shownAt).getTime() >= start);
}
