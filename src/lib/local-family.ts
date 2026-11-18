import type { TestData, TestFact } from '@/data/test-data';
import type { AiSentence } from '@/lib/ai-sentences';
import type { FamilyNote } from '@/lib/family-notes';
import {
  CAREGIVER_SOURCE,
  planFacts,
  relationshipChanged,
  sampleCardId,
  sampleIdFrom,
  statusChange,
  testCardId,
  tidyDraft,
  type CardStatus,
  type DraftFact,
  type SavedCard,
} from '@/lib/facts';
import { deckChanges, missingItems, profileCompletion, type ProfilePerson } from '@/lib/profile';
import { ALL_HINTS, type BestClue, type Fact, type Hints, type Person } from '@/lib/stories';
import { WORDING_LATEST } from '@/lib/wording';

// The family kept on the phone when sign-in is off (src/data/local-store.ts): the people,
// their facts and what the caregiver approved. It starts as a copy of the example deck and
// the caregiver can change it from there. Pure, so scripts/check-logic.mjs can check it.

export type LocalPerson = {
  id: string;
  name: string;
  relationship?: string;
  /** A photo the caregiver picked, copied into the app's own folder on the phone. */
  photoUri?: string;
  /** Uses the example deck's bundled photo (src/data/photos.ts). */
  deckPhoto?: boolean;
  /** A fictional sample person's bundled illustration (src/data/portraits.ts). */
  samplePortrait?: string;
  /** Which hints practice may give. Missing means all of them. */
  hints?: Hints;
  /** The furthest step of the profile questionnaire the caregiver reached. Missing means none. */
  profileStep?: number;
  /** What helps most in recognizing them. */
  bestClue?: BestClue;
  /** The ids of questions marked "Not applicable". */
  notApplicable?: string[];
  /** The marks among them that are test data. */
  testMarks?: string[];
  /** In the practice deck: complete, and not deselected. Everyone else is a draft or left out. */
  inDeck?: boolean;
  /** False when the caregiver deselected them. Missing means included. */
  includeInPractice?: boolean;
  /** False when the caregiver opted them out of reveal cards. Missing means allowed. */
  revealOk?: boolean;
  /** False when the caregiver opted them out of AI questions. Missing means allowed. */
  aiOk?: boolean;
  /** When the caregiver archived them: out of practice and off the People grid, everything kept. Missing means active. */
  archivedAt?: string;
};

/** A saved draft: its photo, by now in the app's folder, or null to remove the one it had. */
export type LocalDraft = Omit<DraftFact, 'photo'> & { photoUri?: string | null };

export type LocalFamily = {
  /** Example-deck people already copied in, so one the caregiver removed doesn't come back. */
  seeded: string[];
  people: LocalPerson[];
  /** In the order they were added. */
  cards: SavedCard[];
  /** The test data was copied in, so clearing it is for good. */
  testSeeded?: boolean;
  /** AI sentences, in the caregiver's queue or approved. They never leave the phone. */
  sentences?: AiSentence[];
  /** Drafts waiting for approval were moved to the newest wording, once (2026-11-18). */
  waitingReworded?: boolean;
  /** The Family board's notes (src/lib/family-notes.ts), written by the caregiver on this phone. */
  notes?: FamilyNote[];
};

/** How the rules read a person: only the phone's store knows who has a photo. */
type About = (person: LocalPerson) => ProfilePerson;

export const EMPTY_FAMILY: LocalFamily = { seeded: [], people: [], cards: [] };

/**
 * Copies in any example-deck person not copied before. Each memory becomes an approved fact
 * with the card id practice already used (`<person id>-<index>`), so no history is lost.
 */
export function seedFamily(family: LocalFamily, deck: Person[]): LocalFamily {
  // Someone already here (a sample person the test data added before they joined the deck) is noted
  // as seeded and left as they are, so nobody is copied twice.
  const present = deck.filter((person) => !family.seeded.includes(person.id) && family.people.some((one) => one.id === person.id));
  const fresh = deck.filter((person) => !family.seeded.includes(person.id) && !present.includes(person));
  if (fresh.length === 0 && present.length === 0) return family;
  return {
    ...family,
    seeded: [...family.seeded, ...present.map((person) => person.id), ...fresh.map((person) => person.id)],
    people: [
      ...family.people,
      ...fresh.map(({ id, name, relationship }) => ({ id, name, relationship, deckPhoto: true })),
    ],
    cards: [
      ...family.cards,
      ...fresh.flatMap((person) =>
        person.memories.map((text, index) => ({
          id: `${person.id}-${index}`,
          personId: person.id,
          type: 'memory' as const,
          text,
          timeSensitive: false,
          status: 'approved' as const,
          source: CAREGIVER_SOURCE,
          phrasingsOff: [],
        })),
      ),
    ],
  };
}

function newCard(personId: string, fact: Fact, id: string): SavedCard {
  return {
    id,
    personId,
    type: fact.type,
    text: fact.text,
    timeSensitive: fact.timeSensitive,
    asOf: fact.asOf,
    year: fact.year,
    status: 'pending',
    source: CAREGIVER_SOURCE,
    phrasingsOff: [],
    // A new draft is written in the newest wording (docs/SENTENCE-AUDIT.md).
    wording: WORDING_LATEST,
  };
}

/** A saved fact with new words: it keeps everything else, and waits for approval again. Words the caregiver typed are no test data. */
function reworded(card: SavedCard, fact: Fact): SavedCard {
  const { type, text, timeSensitive, asOf, year } = fact;
  return {
    ...card,
    type,
    text,
    timeSensitive,
    asOf,
    year,
    status: 'pending',
    confirmedAt: undefined,
    testData: card.testData && card.text === text ? true : undefined,
    // Edited words are a new draft, in the newest wording.
    wording: WORDING_LATEST,
  };
}

/**
 * Once (2026-11-18): drafts still waiting for approval move to the newest wording, so the caregiver reads
 * it before approving. Approved and skipped cards, the example deck's among them, keep theirs.
 */
export function rewordWaitingDrafts(family: LocalFamily): LocalFamily {
  if (family.waitingReworded) return family;
  return {
    ...family,
    waitingReworded: true,
    cards: family.cards.map((card) => (card.status === 'pending' && (card.wording ?? 1) < WORDING_LATEST ? { ...card, wording: WORDING_LATEST } : card)),
  };
}

/**
 * One person's cards in an older wording move to the newest, on purpose ("Use the new wording" on their
 * sheet). An approved card goes back to story approval, so the new sentence is read before practice uses
 * it; a skipped card stays skipped. The count is how many moved.
 */
export function moveToNewWording(family: LocalFamily, personId: string): { family: LocalFamily; moved: number } {
  const older = (card: SavedCard) => card.personId === personId && (card.wording ?? 1) < WORDING_LATEST;
  const moved = family.cards.filter(older).length;
  if (moved === 0) return { family, moved };
  return {
    family: {
      ...family,
      cards: family.cards.map((card) =>
        older(card) ? { ...card, wording: WORDING_LATEST, ...(card.status === 'approved' ? { status: 'pending' as const, confirmedAt: undefined } : {}) } : card,
      ),
    },
    moved,
  };
}

/** A new person, with every fact waiting for approval. */
export function addPerson(family: LocalFamily, person: LocalPerson, facts: LocalDraft[], newId: () => string): LocalFamily {
  return saveFacts({ ...family, people: [...family.people, person] }, person.id, facts, newId);
}

/** New name, relationship or photo. A new relationship changes every sentence, so they wait for approval again. */
export function updatePerson(family: LocalFamily, changed: LocalPerson): LocalFamily {
  const before = family.people.find((person) => person.id === changed.id);
  if (!before) return family;
  const reapprove = relationshipChanged(before.relationship, changed.relationship);
  return {
    ...family,
    people: family.people.map((person) => (person.id === changed.id ? changed : person)),
    cards: reapprove
      ? family.cards.map((card) =>
          card.personId === changed.id && card.status === 'approved'
            ? { ...card, status: 'pending' as const, confirmedAt: undefined }
            : card,
        )
      : family.cards,
  };
}

/**
 * Saves part of the form for one person: new and changed facts wait for approval, emptied ones
 * go, and facts the drafts don't mention stay as they are. A new picture alone needs no approval.
 */
export function saveFacts(family: LocalFamily, personId: string, drafts: LocalDraft[], newId: () => string): LocalFamily {
  const { add, change, remove } = planFacts(
    family.cards.filter((card) => card.personId === personId),
    drafts,
  );
  const changed = new Map(change.map((draft) => [draft.id!, draft]));
  const named = new Map(drafts.flatMap((draft) => (draft.id ? [[draft.id, draft] as const] : [])));
  return {
    ...family,
    cards: [
      ...family.cards
        .filter((card) => !remove.includes(card.id))
        .map((card) => {
          const draft = changed.get(card.id);
          const next = draft ? reworded(card, draft) : card;
          const photoUri = named.get(card.id)?.photoUri;
          return photoUri === undefined ? next : { ...next, photoUri: photoUri ?? undefined };
        }),
      ...add.map((draft) => ({
        ...newCard(personId, draft, draft.id ?? newId()),
        hintOk: draft.hintOk,
        photoUri: draft.photoUri ?? undefined,
      })),
    ],
  };
}

/** One fact edited on story approval. It waits for approval again. */
export function editCard(family: LocalFamily, cardId: string, fact: Fact): LocalFamily {
  return {
    ...family,
    cards: family.cards.map((card) =>
      card.id === cardId ? reworded(card, tidyDraft(fact)) : card,
    ),
  };
}

export function setStatus(family: LocalFamily, cardId: string, status: CardStatus, now: Date): LocalFamily {
  return {
    ...family,
    cards: family.cards.map((card) => (card.id === cardId ? { ...card, ...statusChange(card, status, now) } : card)),
  };
}

/** The phrasings the caregiver turned off for one fact. */
export function setPhrasingsOff(family: LocalFamily, cardId: string, off: string[]): LocalFamily {
  return { ...family, cards: family.cards.map((card) => (card.id === cardId ? { ...card, phrasingsOff: off } : card)) };
}

export function setHints(family: LocalFamily, personId: string, hints: Hints): LocalFamily {
  return { ...family, people: family.people.map((person) => (person.id === personId ? { ...person, hints } : person)) };
}

export type ProfileChanges = { step?: number; bestClue?: BestClue | null; notApplicable?: string[] };

/** How far the caregiver got in the profile questionnaire, their best clue, and what is not applicable. */
export function setProfile(family: LocalFamily, personId: string, profile: ProfileChanges): LocalFamily {
  return {
    ...family,
    people: family.people.map((person) =>
      person.id === personId
        ? {
            ...person,
            profileStep: profile.step ?? person.profileStep,
            bestClue: profile.bestClue === undefined ? person.bestClue : (profile.bestClue ?? undefined),
            notApplicable: profile.notApplicable ?? person.notApplicable,
            testMarks: profile.notApplicable ? person.testMarks?.filter((id) => profile.notApplicable?.includes(id)) : person.testMarks,
          }
        : person,
    ),
  };
}

/** Includes a person again. Below 100% it does nothing: they stay a draft. */
export function addToDeck(family: LocalFamily, personId: string, about: About): LocalFamily {
  const person = family.people.find((candidate) => candidate.id === personId);
  if (!person) return family;
  const theirs = family.cards.filter((card) => card.personId === personId);
  if (profileCompletion(about(person), theirs) < 100) return family;
  return { ...family, people: family.people.map((other) => (other.id === personId ? { ...other, inDeck: true, includeInPractice: true } : other)) };
}

/** The caregiver's "Include in practice". Their profile stays either way. */
export function setIncluded(family: LocalFamily, personId: string, included: boolean): LocalFamily {
  return { ...family, people: family.people.map((person) => (person.id === personId ? { ...person, includeInPractice: included } : person)) };
}

/** Whether this person's facts may be used for AI questions. */
export function setAiOk(family: LocalFamily, personId: string, aiOk: boolean): LocalFamily {
  return { ...family, people: family.people.map((person) => (person.id === personId ? { ...person, aiOk } : person)) };
}

/** Whether this person's cards may start behind the "?". */
export function setRevealOk(family: LocalFamily, personId: string, revealOk: boolean): LocalFamily {
  return { ...family, people: family.people.map((person) => (person.id === personId ? { ...person, revealOk } : person)) };
}

/** `inDeck` follows the rule: complete and not deselected. Runs on every change. */
export function settleDeck(family: LocalFamily, about: About): LocalFamily {
  const { join, leave } = deckChanges(family.people, family.cards, about);
  if (join.length === 0 && leave.length === 0) return family;
  return {
    ...family,
    people: family.people.map((person) => (join.includes(person.id) ? { ...person, inDeck: true } : leave.includes(person.id) ? { ...person, inDeck: false } : person)),
  };
}

/** Which of a person's facts may be used as hints. With none left, the fact hint turns off for them. */
export function setFactHints(family: LocalFamily, personId: string, off: string[]): LocalFamily {
  const cards = family.cards.map((card) => (card.personId === personId ? { ...card, hintOk: !off.includes(card.id) } : card));
  const fact = cards.some((card) => card.personId === personId && card.hintOk);
  return {
    ...family,
    cards,
    people: family.people.map((person) =>
      person.id === personId ? { ...person, hints: { ...(person.hints ?? ALL_HINTS), fact } } : person,
    ),
  };
}

/** Takes a person out of practice and off the People grid. Their facts, photo, settings and sentences all stay. */
export function archivePerson(family: LocalFamily, personId: string, now: Date): LocalFamily {
  return { ...family, people: family.people.map((person) => (person.id === personId ? { ...person, archivedAt: now.toISOString() } : person)) };
}

/** Brings an archived person back exactly as they were, with the include setting they had. */
export function restorePerson(family: LocalFamily, personId: string): LocalFamily {
  return {
    ...family,
    people: family.people.map((person) => {
      if (person.id !== personId) return person;
      const { archivedAt: _archivedAt, ...active } = person;
      return active;
    }),
  };
}

/** Removes the person and their facts. The caller removes their photo files and schedule. */
export function removePerson(family: LocalFamily, personId: string): LocalFamily {
  return {
    ...family,
    people: family.people.filter((person) => person.id !== personId),
    cards: family.cards.filter((card) => card.personId !== personId),
  };
}

function testCard(personId: string, fact: TestFact, index: number): SavedCard {
  return { ...newCard(personId, { ...fact, timeSensitive: false }, testCardId(personId, index)), testData: true };
}

function sampleCard(personId: string, fact: TestFact, index: number): SavedCard {
  return newCard(personId, { ...fact, timeSensitive: false }, sampleCardId(personId, index));
}

/**
 * Copies the test data in, once: each person from the example deck and each sample person gets
 * answers to whatever their profile still lacks, so all of them reach 100% and join the deck.
 * Answers for the real people are flagged; a sample person's are ordinary facts. All of them wait
 * for approval like any new fact. People the caregiver added are left alone, and someone they
 * removed doesn't come back.
 */
export function seedTestData(family: LocalFamily, test: TestData): LocalFamily {
  if (family.testSeeded) return family;
  // The sample people are in the deck itself (src/data/sample-deck.ts), so everyone here came from it.
  const { people, cards } = family;
  const ours = new Set(family.seeded);
  const extra: SavedCard[] = [];
  const seeded = people.map((person) => {
    if (!ours.has(person.id)) return person;
    const theirs = cards.filter((card) => card.personId === person.id);
    const missing = new Set(missingItems({ ...person, hasPhoto: true }, theirs).map((item) => item.id));
    const sample = test.samples.find(({ id }) => id === person.id);
    const toCard = sample ? sampleCard : testCard;
    const facts = sample?.facts ?? test.everyone;
    extra.push(...facts.filter((fact) => wanted(fact, missing, theirs)).map((fact, index) => toCard(person.id, fact, index)));
    // Someone with no relationship gets a flagged mark: an invented one would rewrite their sentence.
    const marks = missing.has('relationship') ? ['relationship'] : [];
    return { ...person, inDeck: true, notApplicable: [...(person.notApplicable ?? []), ...marks], testMarks: marks };
  });
  return { ...family, testSeeded: true, people: seeded, cards: [...cards, ...extra] };
}

/** On a phone seeded when sample people's facts were test data: they become ordinary facts. */
export function releaseSampleFacts(family: LocalFamily, samplePeople: string[]): LocalFamily {
  if (family.cards.every((card) => sampleIdFrom(card.id, samplePeople) === card.id)) return family;
  return {
    ...family,
    cards: family.cards.map((card) => {
      const id = sampleIdFrom(card.id, samplePeople);
      return id === card.id ? card : { ...card, id, testData: undefined };
    }),
  };
}

/** Test facts fill gaps: never a required question already done, nor a kind they already have. */
function wanted(fact: TestFact, missing: Set<string>, theirs: SavedCard[]) {
  if (fact.type === 'interest' || fact.type === 'shared') return missing.has(fact.type);
  return !theirs.some((card) => card.type === fact.type);
}

export function hasTestData(family: Pick<LocalFamily, 'people' | 'cards'>) {
  return family.cards.some((card) => card.testData) || family.people.some((person) => Boolean(person.testMarks?.length));
}

/** Removes every test fact and mark. Anyone left below 100% goes back to being a draft (settleDeck). */
export function clearTestData(family: LocalFamily): LocalFamily {
  return {
    ...family,
    cards: family.cards.filter((card) => !card.testData),
    people: family.people.map(({ testMarks = [], ...person }) => ({
      ...person,
      notApplicable: person.notApplicable?.filter((id) => !testMarks.includes(id)),
    })),
  };
}
