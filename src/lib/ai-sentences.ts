import { checkSentence, maskName, sentenceWords, type AiShape, type CheckContext, type Proposed } from '@/lib/ai-check';
import { AI_LIMITS, isSendable, realContext } from '@/lib/ai-request';
import type { SavedCard } from '@/lib/facts';
import type { FactType } from '@/lib/stories';

// The caregiver's queue of AI sentences. Nothing reaches the person unless it is approved here,
// and anything whose facts have changed since leaves practice by itself and waits to be looked at
// again. Pure, so scripts/check-logic.mjs can check it. Sentences stay on the phone.

export type SentenceStatus = 'pending' | 'approved' | 'rejected' | 'flagged';

export type AiSentence = {
  /** "ai-" and a random id: it is a phrasing id too, so rotation and the per-phrasing switches work. */
  id: string;
  personId: string;
  shape: AiShape;
  /** Real words, with ____ for the blank, and [NAME] on a reverse card. The person's name is filled in when shown. */
  text: string;
  /** The facts it used, as they stood. The first is the card it joins. */
  facts: { id: string; type: FactType; text: string }[];
  /** The relationship it was written with. */
  relationship?: string;
  /** On a reverse card, the fact that is the answer. */
  answer?: string;
  status: SentenceStatus;
  /** The caregiver changed its words. */
  edited?: boolean;
};

const REJECTED_KEPT = 50;

type Person = { id: string; name: string; relationship?: string };

/** The sentences practice may use: AI on, the caregiver agreed, and this person not opted out. */
export function sentencesInUse(ai: { on: boolean; consented: boolean; sentences: AiSentence[] } | undefined, person: { aiOk?: boolean }) {
  return ai?.on && ai.consented && person.aiOk !== false ? ai.sentences : [];
}

/** Waiting for the caregiver: new, or pulled because a fact changed. */
export const inQueue = (sentence: AiSentence) => sentence.status === 'pending' || sentence.status === 'flagged';

export const queueOf = (sentences: AiSentence[], personId: string) => sentences.filter((sentence) => sentence.personId === personId && inQueue(sentence));

/** How many more the queue can take for this person. */
export const queueRoom = (sentences: AiSentence[], personId: string) => Math.max(AI_LIMITS.pendingPerPerson - queueOf(sentences, personId).length, 0);

export function asProposed(sentence: Pick<AiSentence, 'text' | 'shape' | 'facts' | 'answer'>): Proposed {
  return {
    sentence: sentence.text,
    shape: sentence.shape,
    fact_ids_used: sentence.facts.map((fact) => fact.id),
    blank_answer_placeholder: sentence.answer ? `[FACT:${sentence.answer}]` : '[NAME]',
  };
}

/**
 * New sentences join the queue: never one already known, even a rejected one, and never the same
 * words as a fixed phrasing. `templates` are those phrasings, with their blank as ____.
 */
export function addSentences(all: AiSentence[], items: Proposed[], person: Person, cards: SavedCard[], templates: string[], newId: () => string) {
  const known = new Set([...all.filter((one) => one.personId === person.id).map((one) => sentenceWords(one.text)), ...templates.map(sentenceWords)]);
  const added: AiSentence[] = [];
  for (const item of items) {
    const key = sentenceWords(item.sentence);
    if (known.has(key) || added.length >= queueRoom(all, person.id)) continue;
    known.add(key);
    const facts = item.fact_ids_used.flatMap((id) => cards.filter((card) => card.id === id).map(({ type, text }) => ({ id, type, text })));
    added.push({
      id: `ai-${newId()}`,
      personId: person.id,
      shape: item.shape as AiShape,
      text: item.sentence,
      facts,
      relationship: person.relationship,
      answer: /^\[FACT:(.+)\]$/.exec(item.blank_answer_placeholder)?.[1],
      status: 'pending',
    });
  }
  return [...all, ...added];
}

function factsNow(sentence: AiSentence, context: CheckContext) {
  return sentence.facts.flatMap((fact) => context.facts.filter((one) => one.id === fact.id).map((one) => ({ ...fact, text: one.text })));
}

/** Approving checks it once more, against the facts as they are now. Returns why not, if it can't be. */
export function approveSentence(all: AiSentence[], id: string, person: Person, cards: SavedCard[]): { all: AiSentence[]; reason?: string } {
  const sentence = all.find((one) => one.id === id);
  if (!sentence) return { all };
  const context = realContext(person, cards);
  const reason = checkSentence(asProposed(sentence), context);
  if (reason) return { all, reason };
  const approved = { ...sentence, facts: factsNow(sentence, context), relationship: person.relationship, status: 'approved' as const };
  return { all: all.map((one) => (one.id === id ? approved : one)) };
}

/** "Approve all valid": whatever waits for this person and still passes. Anything else stays in the queue. */
export function approveAllValid(all: AiSentence[], person: Person, cards: SavedCard[]) {
  return queueOf(all, person.id).reduce((next, sentence) => approveSentence(next, sentence.id, person, cards).all, all);
}

/** A rejected sentence is kept, so it isn't suggested again, but only so many. */
export function rejectSentence(all: AiSentence[], id: string) {
  const next = all.map((one) => (one.id === id ? { ...one, status: 'rejected' as const } : one));
  const rejected = next.filter((one) => one.status === 'rejected');
  const dropped = new Set(rejected.slice(0, Math.max(rejected.length - REJECTED_KEPT, 0)).map((one) => one.id));
  return next.filter((one) => !dropped.has(one.id));
}

/** The caregiver's own words pass the same checks. It then waits in the queue, to be approved. */
export function editSentence(all: AiSentence[], id: string, text: string, person: Person, cards: SavedCard[]): { all: AiSentence[]; reason?: string } {
  const sentence = all.find((one) => one.id === id);
  if (!sentence) return { all };
  const tidied = text.trim().replace(/\s+/g, ' ');
  const reason = checkSentence(asProposed({ ...sentence, text: tidied }), realContext(person, cards));
  if (reason) return { all, reason };
  return { all: all.map((one) => (one.id === id ? { ...one, text: maskReverseName(sentence, tidied, person), edited: true, status: 'pending' as const } : one)) };
}

/** On a reverse card the name stays a token, so it follows the person if it changes. */
const maskReverseName = (sentence: AiSentence, text: string, person: Person) => (sentence.shape === 'reverse' ? maskName(text, person.name) : text);

function stillTrue(sentence: AiSentence, person: Person, byId: Map<string, SavedCard>) {
  const sameRelationship = (sentence.relationship ?? '') === (person.relationship ?? '');
  return (
    sameRelationship &&
    sentence.facts.length > 0 &&
    sentence.facts.every((fact) => {
      const card = byId.get(fact.id);
      return card !== undefined && card.text === fact.text && card.type === fact.type && isSendable(card);
    })
  );
}

/**
 * Runs on every change. A sentence whose person is gone goes too. One that used a fact since
 * changed or removed leaves practice and is flagged for the caregiver, and stays flagged until
 * they look at it, even if the fact changes back.
 */
export function settleSentences(all: AiSentence[], people: Person[], cards: SavedCard[]) {
  const byPerson = new Map(people.map((person) => [person.id, person]));
  const byId = new Map(cards.map((card) => [card.id, card]));
  const settled = all.flatMap((sentence) => {
    const person = byPerson.get(sentence.personId);
    if (!person) return [];
    if (sentence.status === 'rejected' || sentence.status === 'flagged' || stillTrue(sentence, person, byId)) return [sentence];
    return [{ ...sentence, status: 'flagged' as const }];
  });
  return settled.length === all.length && settled.every((one, index) => one === all[index]) ? all : settled;
}
