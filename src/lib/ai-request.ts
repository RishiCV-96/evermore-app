import { NAME_TOKEN, checkSentence, isFactType, maskName, supportedShapes, validSentences, type CheckContext, type CheckFact, type Proposed } from '@/lib/ai-check';
import { inPractice, withoutTestData, type SavedCard } from '@/lib/facts';

// What may leave the phone when the caregiver taps Generate, and how it comes back. This file is
// the privacy line: only text, only one person's approved facts, and no name.
//
// Their name becomes [NAME], every other name or proper noun becomes [PERSON_1] and so on, and
// card ids become f1, f2 (an id like "nora-0" holds a name). Only the phone can turn them back.
// A place can't be told from a person in free text, so every proper noun goes, not only people.
// Writing with no capitals, such as Chinese or Arabic, can't be read for names, so it stays here.

/** How much one request asks for. The function refuses more. */
export const AI_LIMITS = { factsPerRequest: 12, sentencesPerRequest: 8, pendingPerPerson: 20, factLetters: 120, relationshipLetters: 40 };

/** Facts whose whole answer is a name, however it was typed. */
const WHOLE_NAME_TYPES = ['partner', 'child', 'nickname', 'calls'];

/** Capitalized, but nobody's name. */
const NOT_NAMES = new Set(
  'I January February March April May June July August September October November December Monday Tuesday Wednesday Thursday Friday Saturday Sunday'.split(' '),
);

const LEADING_WORD = /^(?:The|A|An|My|Our)\s+/;
const PROPER_WORD = "\\p{Lu}[\\p{L}\\p{N}'’.-]*";
const PROPER_RUN = new RegExp(`\\[[^\\]]*\\]|${PROPER_WORD}(?:\\s+(?:(?:of|the|de|van|von|&)\\s+)?${PROPER_WORD})*`, 'gu');
const AFTER_NAMED = /\b(named|called)\s+(?!\[)([\p{L}][\p{L}'’-]*)/giu;
const NO_CAPITALS = /\p{Lo}/u;

/** A fact that may be sent: approved, not test data, never one that may change, and in a shape the checks know. */
export function isSendable(card: SavedCard) {
  return (
    inPractice(card) &&
    !card.testData &&
    !card.timeSensitive &&
    isFactType(card.type) &&
    card.text.length <= AI_LIMITS.factLetters &&
    !/[[\]]|__/.test(card.text) &&
    !NO_CAPITALS.test(card.text)
  );
}

export function sendableFacts(cards: SavedCard[]) {
  return withoutTestData(cards).filter(isSendable);
}

export type AiRequest = {
  placeholders: string[];
  relationship: string;
  facts: CheckFact[];
  shape_requests: { shape: string; count: number }[];
};

/** How to turn a response back into real words. It never leaves the phone. */
export type Restore = { tokens: Record<string, string>; factIds: Record<string, string> };

type AboutPerson = { name: string; relationship?: string };

function masker(person: AboutPerson, otherNames: string[]) {
  const tokens = new Map<string, string>();
  const tokenFor = (real: string) => {
    if (!tokens.has(real)) tokens.set(real, `[PERSON_${tokens.size + 1}]`);
    return tokens.get(real)!;
  };
  const others = [...otherNames].filter((name) => name.trim().length > 1).sort((a, b) => b.length - a.length);

  function mask(text: string, type?: string) {
    if (type && WHOLE_NAME_TYPES.includes(type)) return tokenFor(text);
    let out = maskName(text, person.name);
    for (const name of others) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      out = out.replace(new RegExp(`(?<![\\p{L}\\p{N}\\[])${escaped}(?![\\p{L}\\p{N}\\]])`, 'giu'), tokenFor);
    }
    out = out.replace(AFTER_NAMED, (_, word: string, name: string) => `${word} ${tokenFor(name)}`);
    return out.replace(PROPER_RUN, (run, offset: number) => {
      if (run.startsWith('[')) return run;
      const leading = offset === 0 ? (LEADING_WORD.exec(run)?.[0] ?? '') : '';
      const rest = run.slice(leading.length);
      return !rest || NOT_NAMES.has(rest) ? run : `${leading}${tokenFor(rest)}`;
    });
  }
  return { mask, tokens };
}

/** Shares `total` sentences out across the shapes these facts can support, the plain ones first. */
function shapeRequests(facts: CheckFact[], total: number) {
  const shapes = supportedShapes(facts);
  return shapes.flatMap((shape, index) => {
    const count = Math.floor(total / shapes.length) + (index < total % shapes.length ? 1 : 0);
    return count > 0 ? [{ shape, count }] : [];
  });
}

/** The request body, and what's needed to read its answer. `room` is how many sentences the queue can take. */
export function buildRequest(person: AboutPerson, facts: SavedCard[], otherNames: string[], room: number) {
  const { mask, tokens } = masker(person, otherNames);
  // A placeholder can be longer than the name it hides, and one fact over the limit would get the
  // whole request refused, so the limits are applied to what is actually sent.
  const chosen = facts
    .map((card) => ({ card, text: mask(card.text, card.type) }))
    .filter(({ text }) => text.length <= AI_LIMITS.factLetters)
    .slice(0, AI_LIMITS.factsPerRequest);
  const sent = chosen.map(({ card, text }, index) => ({ id: `f${index + 1}`, type: card.type as string, text }));
  const said = mask(person.relationship ?? '');
  const relationship = said.length <= AI_LIMITS.relationshipLetters && !NO_CAPITALS.test(said) ? said : '';
  const body: AiRequest = {
    placeholders: [NAME_TOKEN, ...[...tokens.values()].filter((token) => relationship.includes(token) || sent.some((fact) => fact.text.includes(token)))],
    relationship,
    facts: sent,
    shape_requests: shapeRequests(sent, Math.min(room, AI_LIMITS.sentencesPerRequest)),
  };
  const restore: Restore = {
    tokens: Object.fromEntries([...tokens].map(([real, token]) => [token, real])),
    factIds: Object.fromEntries(sent.map((fact, index) => [fact.id, chosen[index].card.id])),
  };
  return { body, restore };
}

/** A sentence back in real words. [NAME] stays: practice fills it in. */
export function restoreSentence(item: Proposed, restore: Restore): Proposed {
  const factId = (id: string) => restore.factIds[id] ?? id;
  const answer = /^\[FACT:(.+)\]$/.exec(item.blank_answer_placeholder)?.[1];
  return {
    ...item,
    sentence: item.sentence.replace(/\[PERSON_\d{1,2}\]/g, (token) => restore.tokens[token] ?? token),
    blank_answer_placeholder: answer ? `[FACT:${factId(answer)}]` : item.blank_answer_placeholder,
    fact_ids_used: item.fact_ids_used.map(factId),
  };
}

/** What a sentence is checked against on the phone: the person's real, sendable facts. */
export function realContext(person: AboutPerson, cards: SavedCard[]): CheckContext {
  return {
    facts: sendableFacts(cards).map(({ id, type, text }) => ({ id, type, text })),
    relationship: person.relationship,
    name: person.name,
  };
}

/**
 * The second check. Whatever came back is checked as it was sent, then again in real words, so a
 * bad response can't slip through even if the server let it by. Rejected sentences just go.
 */
export function acceptSentences(items: unknown, body: AiRequest, restore: Restore, person: AboutPerson, cards: SavedCard[]) {
  if (!Array.isArray(items)) return [];
  const shapes = body.shape_requests.map((request) => request.shape);
  const context = realContext(person, cards);
  return validSentences(items, { facts: body.facts, relationship: body.relationship }, shapes)
    .map((item) => restoreSentence(item, restore))
    .filter((item) => checkSentence(item, context) === null);
}
