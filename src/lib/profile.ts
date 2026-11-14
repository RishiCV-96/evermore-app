import {
  COMPLETION,
  NOT_APPLICABLE,
  REVIEW_STEP,
  SECTIONS,
  canNotApply,
  countsAsOptional,
  displayValue,
  questionFor,
  stepLabel,
  type Question,
  type Section,
} from '@/data/questionnaire';
import { inPractice, monthOf, tidyDraft, type DraftFact, type SavedCard } from '@/lib/facts';
import { asOfLabel } from '@/lib/stories';

// The guided profile: from saved facts to the form's answers and back, and how much of the
// form is filled in. Pure, so scripts/check-logic.mjs can check it. "Complete" only ever means
// the form: nothing here knows anything about practice or the person's memory.

/**
 * One answer on the form. Each has its fact's id from the start, even before it is saved, so
 * saving a draft again and again updates one fact instead of adding more.
 */
export type Entry = DraftFact & { id: string; question: string };

/** The person, as the form needs them. */
export type ProfilePerson = {
  name?: string;
  relationship?: string;
  bestClue?: string;
  hasPhoto: boolean;
  /** The ids of questions marked "Not applicable". */
  notApplicable?: string[];
  /** The marks among them that are test data (src/data/test-data.ts). */
  testMarks?: string[];
};

/** The fact from step 1: the first "something about them". */
export function firstFact(cards: SavedCard[]) {
  return cards.find((card) => card.type === 'memory');
}

export function entryFrom(question: Question, card: SavedCard): Entry {
  const { id, type, text, timeSensitive, asOf, year, hintOk, testData } = card;
  return { question: question.id, id, type, text, timeSensitive, asOf, year, hintOk, testData };
}

export function blankEntry(question: Question, id: string): Entry {
  return { id, question: question.id, type: question.factType!, text: '', timeSensitive: false, hintOk: question.hintOff ? false : undefined };
}

/** A section's answers: what is saved, and an empty field for each question that shows one. */
export function sectionEntries(section: Section, cards: SavedCard[], newId: () => string) {
  const first = firstFact(cards);
  return section.questions.flatMap((question) => {
    if (!question.factType) return [];
    if (question.sets === 'firstFact') return [first ? entryFrom(question, first) : blankEntry(question, newId())];
    const saved = cards.filter((card) => card.type === question.factType && card.id !== first?.id);
    if (saved.length) return saved.map((card) => entryFrom(question, card));
    return ['text', 'list', 'memory'].includes(question.input) ? [blankEntry(question, newId())] : [];
  });
}

/** A typed year, if it is one. */
export function validYear(year: number | undefined, now: Date) {
  return year && year >= 1900 && year <= now.getFullYear() ? year : undefined;
}

/**
 * Answers as facts to save. A fact that always can change is dated and marked, whatever the
 * form showed; emptied answers stay in, with their id, so a saved one is removed.
 */
export function toDrafts(entries: Entry[], now: Date): DraftFact[] {
  return entries.map(({ question: _question, ...fact }) => {
    const always = questionFor(fact.type).changes === 'always';
    const timeSensitive = always || fact.timeSensitive;
    return tidyDraft({
      ...fact,
      timeSensitive,
      asOf: timeSensitive ? (fact.asOf ?? monthOf(now)) : undefined,
      year: validYear(fact.year, now),
    });
  });
}

const REQUIRED = SECTIONS.flatMap((section) =>
  section.questions.filter((question) => question.required).map((question) => ({ question, step: section.step })),
);

const OPTIONAL = SECTIONS.flatMap((section) => section.questions.filter(countsAsOptional));

function answered(question: Question, person: ProfilePerson, cards: SavedCard[]) {
  if (question.sets === 'name') return Boolean(person.name);
  if (question.sets === 'photo') return person.hasPhoto;
  if (question.sets === 'relationship') return Boolean(person.relationship);
  if (question.sets === 'bestClue') return Boolean(person.bestClue);
  const kinds = [question.factType, ...(question.alsoAnsweredBy ?? [])];
  return cards.some((card) => kinds.includes(card.type));
}

/** A mark saved on a question that no longer offers it means nothing. */
const marked = (question: Question, person: ProfilePerson) => canNotApply(question) && (person.notApplicable ?? []).includes(question.id);

/** The required questions neither answered nor marked "Not applicable", and the step each is on. */
export function missingItems(person: ProfilePerson, cards: SavedCard[]) {
  const open = ({ question }: (typeof REQUIRED)[number]) => !answered(question, person, cards) && !marked(question, person);
  return REQUIRED.filter(open).map(({ question, step }) => ({
    id: question.id,
    label: question.missing!,
    step,
  }));
}

/** An optional question with at least one answer. A question counts once, however many answers it has. */
function optionalAnswered(question: Question, person: ProfilePerson, cards: SavedCard[], first?: SavedCard) {
  if (question.sets === 'bestClue') return Boolean(person.bestClue);
  if (question.sets === 'firstFact') return Boolean(first);
  return cards.some((card) => card.type === question.factType && card.id !== first?.id);
}

/**
 * How much of the form is done, 0 to 100. Each required question done (answered or "Not
 * applicable") is an equal share; each optional question answered adds a few points, capped below
 * one share, while something required is missing (COMPLETION in src/data/questionnaire.ts). So it
 * is 100 exactly when every required question is done: the 100% gate. It measures the data entry
 * and nothing else: it says nothing about the person's memory, and the person never sees it.
 */
export function profileCompletion(person: ProfilePerson, cards: SavedCard[]) {
  const missing = missingItems(person, cards).length;
  if (missing === 0) return 100;
  const first = firstFact(cards);
  const optional = OPTIONAL.filter((question) => optionalAnswered(question, person, cards, first)).length;
  const required = Math.floor((100 * (REQUIRED.length - missing)) / REQUIRED.length);
  return required + Math.min(optional * COMPLETION.optionalEach, COMPLETION.optionalMost);
}

/**
 * The saved facts with a step's answers in their place, as if the step were saved now: an emptied
 * answer is gone, a new one is there. The form's percent follows what is typed, before the autosave.
 */
export function withAnswers(cards: SavedCard[], entries: Entry[], personId: string): SavedCard[] {
  const typed = new Map(entries.map((entry) => [entry.id, entry]));
  const kept = cards.flatMap((card) => {
    const entry = typed.get(card.id);
    if (!entry) return [card];
    return entry.text.trim() ? [{ ...card, text: entry.text.trim() }] : [];
  });
  const added = entries
    .filter((entry) => entry.text.trim() && !cards.some((card) => card.id === entry.id))
    .map(({ question: _question, ...fact }): SavedCard => ({ ...fact, text: fact.text.trim(), personId, status: 'pending', source: 'caregiver', phrasingsOff: [] }));
  return [...kept, ...added];
}

export const NOT_IN_PRACTICE = 'Not in practice';

/** "Resume profile" is offered until every required question is done. */
export function needsFinishing(percent: number) {
  return percent < 100;
}

type Deckable = {
  id: string;
  inDeck?: boolean;
  /** The caregiver's say. Only false takes a complete person out: a phone from before this was added has nothing here. */
  includeInPractice?: boolean;
  /** Archived: out of everything practice shows, however complete or included. */
  archivedAt?: string;
};

const theirCards = (person: Deckable, cards: SavedCard[]) => cards.filter((card) => card.personId === person.id);

/** Everyone complete is in the deck, unless the caregiver deselected or archived them. */
function belongsInDeck<P extends Deckable>(person: P, cards: SavedCard[], about: (person: P) => ProfilePerson) {
  return !person.archivedAt && person.includeInPractice !== false && profileCompletion(about(person), theirCards(person, cards)) === 100;
}

/** Who should join and who should leave, so `inDeck` keeps following the rule above. */
export function deckChanges<P extends Deckable>(people: P[], cards: SavedCard[], about: (person: P) => ProfilePerson) {
  const belongs = people.filter((person) => belongsInDeck(person, cards, about));
  return {
    join: belongs.filter((person) => !person.inDeck).map((person) => person.id),
    leave: people.filter((person) => person.inDeck && !belongs.includes(person)).map((person) => person.id),
  };
}

/**
 * All that practice may show: facts in practice, of people who belong in the deck. Cards, hints,
 * the other names offered and the person's screens all come from this, so neither a draft nor
 * someone deselected has a way in.
 */
export function deckOf<P extends Deckable>(people: P[], cards: SavedCard[], about: (person: P) => ProfilePerson) {
  const deck = new Set(people.filter((person) => belongsInDeck(person, cards, about)).map((person) => person.id));
  const shown = cards.filter((card) => deck.has(card.personId) && inPractice(card));
  return { people: people.filter((person) => shown.some((card) => card.personId === person.id)), cards: shown };
}

/** What the People tab says of someone not in the deck: a draft, or complete and deselected. */
export function outOfDeckLabel(percent: number) {
  return percent < 100 ? `Draft, ${percent}% complete` : NOT_IN_PRACTICE;
}

/**
 * Where "Resume profile" picks up: the furthest step they reached or, once they have been
 * through the form, the first thing still missing.
 */
export function resumeStep(step: number, missing: { step: number }[]) {
  if (step >= REVIEW_STEP) return missing[0]?.step ?? REVIEW_STEP;
  return Math.max(step, 1);
}

/** Under "Resume profile": "Picks up at step 5 of 8, Interests." */
export function resumeLine(step: number) {
  const section = SECTIONS.find((candidate) => candidate.step === step) ?? SECTIONS[0];
  return `Picks up at ${stepLabel(section.step).toLowerCase()}, ${section.title}.`;
}

function answerText(card: SavedCard) {
  if (card.timeSensitive && card.asOf) return `${card.text} (as of ${asOfLabel(card.asOf)})`;
  return card.year ? `${card.text} (${card.year})` : card.text;
}

/** A line on the review step. Test data says so. */
const line = (label: string, text: string, test?: boolean) => (test ? { label, text, test } : { label, text });

/** A section's answers in plain words, for the review step, with the questions marked "Not applicable". */
export function sectionSummary(section: Section, person: ProfilePerson, cards: SavedCard[]) {
  const first = firstFact(cards);
  return section.questions.flatMap((question) => {
    const name = question.short ?? question.label;
    if (question.sets === 'name') return [];
    const words = answerWords(question, person, cards, first);
    if (words) return [line(question.sets === 'firstFact' ? (questionFor('memory').short ?? '') : name, words.text, words.test)];
    return marked(question, person) ? [line(name, NOT_APPLICABLE, person.testMarks?.includes(question.id))] : [];
  });
}

function answerWords(question: Question, person: ProfilePerson, cards: SavedCard[], first?: SavedCard) {
  if (question.sets === 'photo') return undefined;
  if (question.sets === 'firstFact') return first ? { text: answerText(first), test: first.testData } : undefined;
  if (question.sets === 'relationship') return person.relationship ? { text: displayValue(person.relationship) } : undefined;
  if (question.sets === 'bestClue') {
    const clue = question.options?.find((option) => option.value === person.bestClue);
    return clue ? { text: clue.label } : undefined;
  }
  const theirs = cards.filter((card) => card.type === question.factType && card.id !== first?.id);
  if (!question.factType || theirs.length === 0) return undefined;
  const worded = (card: SavedCard) => {
    if (!question.options) return answerText(card);
    return question.options.find((option) => option.value === card.text)?.label ?? displayValue(answerText(card));
  };
  return { text: theirs.map(worded).join(', '), test: theirs.some((card) => card.testData) };
}

/**
 * Review's way on, to story approval. Below 100% it waits, showing the percent ("Continue · 60%").
 * Someone the caregiver took out of practice is put back in by it, so it says so.
 */
export function reviewAction(percent: number, person: { name: string; inDeck?: boolean; includeInPractice?: boolean }) {
  if (percent < 100) return { label: `Continue · ${percent}%`, disabled: true };
  if (!person.inDeck && person.includeInPractice === false) return { label: `Add ${person.name} to practice`, disabled: false };
  return { label: 'Continue', disabled: false };
}
