import { approveSentence, queueOf, type AiSentence } from '@/lib/ai-sentences';
import { statusChange, type SavedCard } from '@/lib/facts';

// "Approve all" on a person's sheet: everything waiting for that person that may be approved in one
// tap, and what has to wait for the caregiver one by one. Pure, so scripts/check-logic.mjs checks it;
// both family stores follow it. It approves exactly what the one-by-one buttons would, through the
// same rules (statusChange for a story, approveSentence and its checks for an AI sentence), and
// never anything they wouldn't.

/** Why something waits for the caregiver instead. */
export type HeldReason = 'dated' | 'edited' | 'flagged' | 'fails-checks';

export const HELD_WORDS: Record<HeldReason, string> = {
  dated: 'It may change, so it waits for you to confirm it on its own.',
  edited: 'You edited it, so it waits for you to approve it on its own.',
  flagged: 'A fact it used has changed, so it waits for you to review it.',
  'fails-checks': 'It no longer passes the checks, so it can’t be approved.',
};

export type Held = { kind: 'story'; card: SavedCard; reason: HeldReason } | { kind: 'question'; sentence: AiSentence; reason: HeldReason };

export type ApprovalPlan = {
  /** Stories (facts) that may be approved at once: waiting, and not a fact that may change. */
  stories: SavedCard[];
  /** AI sentences that may be approved at once: new, unedited, and passing the checks against the facts as they are now. */
  questions: AiSentence[];
  held: Held[];
};

type Person = { id: string; name: string; relationship?: string; archivedAt?: string };

/** People whose waiting list the caregiver has opened in this session. Memory only, never saved. */
const opened = new Set<string>();

/** Approve all is offered on the sheet only once its list has been opened in this session. */
export const listOpened = (personId: string) => opened.has(personId);
export const markListOpened = (personId: string) => void opened.add(personId);

/** "Approved 8. 2 need your confirmation." */
export function approvedText(approved: number, held: number) {
  const rest = held ? ` ${held} ${held === 1 ? 'needs' : 'need'} your confirmation.` : '';
  return `Approved ${approved}.${rest}`;
}

export const planSize = (plan: ApprovalPlan) => plan.stories.length + plan.questions.length;
export const waitingCount = (plan: ApprovalPlan) => planSize(plan) + plan.held.length;

/**
 * What Approve all would do for this person. `cards` are their facts; `sentences` the AI sentences,
 * or none where AI questions aren't shown. Someone archived has no approvals at all.
 */
export function approvalPlan(person: Person, cards: SavedCard[], sentences: AiSentence[]): ApprovalPlan {
  if (person.archivedAt) return { stories: [], questions: [], held: [] };
  const theirs = cards.filter((card) => card.personId === person.id);
  const pending = theirs.filter((card) => card.status === 'pending');
  const held: Held[] = pending.filter((card) => card.timeSensitive).map((card) => ({ kind: 'story', card, reason: 'dated' }));
  const questions: AiSentence[] = [];
  for (const sentence of queueOf(sentences, person.id)) {
    if (sentence.status === 'flagged') held.push({ kind: 'question', sentence, reason: 'flagged' });
    else if (sentence.edited) held.push({ kind: 'question', sentence, reason: 'edited' });
    else if (approveSentence(sentences, sentence.id, person, theirs).reason) held.push({ kind: 'question', sentence, reason: 'fails-checks' });
    else questions.push(sentence);
  }
  return { stories: pending.filter((card) => !card.timeSensitive), questions, held };
}

/** What to put back on Undo: each thing exactly as it was before. */
export type ApprovalUndo = { cards: SavedCard[]; sentences: AiSentence[] };

/**
 * Approves what the plan names that is still eligible now (the family may have changed since the
 * plan was shown): stories by statusChange, sentences through approveSentence, which checks them once
 * more. Returns the new family, how many were approved, and what Undo puts back.
 */
export function applyApproval(
  state: { cards: SavedCard[]; sentences: AiSentence[] },
  person: Person,
  ids: { stories: string[]; questions: string[] },
  now: Date,
) {
  const plan = approvalPlan(person, state.cards, state.sentences);
  const stories = plan.stories.filter((card) => ids.stories.includes(card.id));
  const storyIds = new Set(stories.map((card) => card.id));
  const cards = state.cards.map((card) => (storyIds.has(card.id) ? { ...card, ...statusChange(card, 'approved', now) } : card));
  const theirs = cards.filter((card) => card.personId === person.id);
  let sentences = state.sentences;
  const approvedSentences: AiSentence[] = [];
  for (const sentence of plan.questions.filter((one) => ids.questions.includes(one.id))) {
    const result = approveSentence(sentences, sentence.id, person, theirs);
    if (result.reason) continue;
    sentences = result.all;
    approvedSentences.push(sentence);
  }
  return { cards, sentences, approved: stories.length + approvedSentences.length, undo: { cards: stories, sentences: approvedSentences } satisfies ApprovalUndo };
}

/**
 * Undo: puts back each story and sentence as it was, but only while it is still as Approve all left
 * it. Anything the caregiver has changed since (edited, skipped, rejected, removed) stays as it is now.
 */
export function undoApproval(state: { cards: SavedCard[]; sentences: AiSentence[] }, undo: ApprovalUndo) {
  const cardsBefore = new Map(undo.cards.map((card) => [card.id, card]));
  const sentencesBefore = new Map(undo.sentences.map((sentence) => [sentence.id, sentence]));
  return {
    cards: state.cards.map((card) => {
      const before = cardsBefore.get(card.id);
      return before && card.status === 'approved' && card.text === before.text ? before : card;
    }),
    sentences: state.sentences.map((sentence) => {
      const before = sentencesBefore.get(sentence.id);
      return before && sentence.status === 'approved' && sentence.text === before.text ? before : sentence;
    }),
  };
}

/**
 * Approve all on story approval (screen 6), where every story is on screen: exactly the stories one
 * tap each would approve (approvalPlan's, without AI sentences, which that screen doesn't show), less
 * any the caregiver has open for editing, so an edit in progress is never approved under them. Facts
 * that may change are held, as everywhere. Skipped and approved stories aren't waiting, so they stay.
 */
export function storyApproval(person: Person, cards: SavedCard[], editing: string[] = []) {
  const plan = approvalPlan(person, cards, []);
  return { ids: plan.stories.filter((card) => !editing.includes(card.id)).map((card) => card.id), held: plan.held.length };
}

/** "Approve all 12", or a plain "Approve all", disabled, when nothing may be approved at once. */
export function approveAllButton(count: number) {
  return count > 0 ? { label: `Approve all ${count}`, disabled: false } : { label: 'Approve all', disabled: true };
}
