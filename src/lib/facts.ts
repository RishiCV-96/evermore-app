import { tidyMemory, tidyRelationship, type Fact } from '@/lib/stories';

// Facts about a person, as the caregiver gives and approves them. Each fact is one card: it
// is practiced, scheduled and approved on its own. Pure, so scripts/check-logic.mjs can
// check it; both family stores (server and on the phone) follow these rules.

export type CardStatus = 'pending' | 'approved' | 'skipped';

/** Who gave a fact. Only the caregiver for now; relatives can contribute later. */
export const CAREGIVER_SOURCE = 'caregiver';

/** A photo just picked from the library. */
export type PickedPhoto = { uri: string; mimeType?: string };

/** One fact as a family store keeps it. Only approved ones ever reach practice. */
export type SavedCard = Fact & {
  id: string;
  personId: string;
  status: CardStatus;
  /** When the caregiver confirmed a time-sensitive fact is true. */
  confirmedAt?: string;
  source: string;
  /** Phrasings (src/lib/stories.ts) the caregiver turned off for this fact. */
  phrasingsOff: string[];
  /** False when the caregiver doesn't want this fact used as a hint. */
  hintOk?: boolean;
  /** A shared memory's photo: path in the private bucket and its signed URL. */
  photoPath?: string;
  photoUrl?: string;
  /** The same with sign-in off: a photo kept in the app's folder on the phone. */
  photoUri?: string;
  /** Made up for testing (src/data/test-data.ts). It stays on the phone, and goes in one tap. */
  testData?: boolean;
};

/** Approved, and for a fact that may change, confirmed by the caregiver. Row Level Security applies the same rule. */
export function inPractice(card: Pick<SavedCard, 'status' | 'timeSensitive' | 'confirmedAt'>) {
  return card.status === 'approved' && (!card.timeSensitive || Boolean(card.confirmedAt));
}

/**
 * What a status change writes. Approving a fact that may change is the caregiver confirming
 * it is true now, so it records when, and dates the fact this month if it had no date.
 */
export function statusChange(card: Pick<SavedCard, 'timeSensitive' | 'asOf'>, status: CardStatus, now: Date) {
  const confirms = status === 'approved' && card.timeSensitive;
  return {
    status,
    confirmedAt: confirms ? now.toISOString() : undefined,
    asOf: card.timeSensitive ? (card.asOf ?? monthOf(now)) : undefined,
  };
}

/** Every sentence holds the relationship, so changing it sends the person's facts back for approval. */
export function relationshipChanged(before: string | undefined, after: string | undefined) {
  return tidyRelationship(before ?? '') !== tidyRelationship(after ?? '');
}

// ---------------------------------------------------------------------------------------
// The add-a-person form
// ---------------------------------------------------------------------------------------

/**
 * A fact in the add-a-person form. id is set for one that is already saved. photo: leave it
 * out to keep a memory's picture, a picked photo to replace it, null to remove it.
 */
export type DraftFact = Fact & { id?: string; hintOk?: boolean; photo?: PickedPhoto | null; testData?: boolean };

/** Test facts' ids start with this, so anything naming one can be recognized. */
const TEST_ID = 'test-';

export const testCardId = (personId: string, index: number) => `${TEST_ID}${personId}-${index}`;

/** A fictional sample person's made-up facts are ordinary facts, with ids of their own. */
const SAMPLE_ID = 'sample-';

export const sampleCardId = (personId: string, index: number) => `${SAMPLE_ID}${personId}-${index}`;

/** The id a sample person's fact has now, for one saved when it was test data. Any other id stays. */
export function sampleIdFrom(cardId: string, samplePeople: string[]) {
  const theirs = samplePeople.some((personId) => cardId.startsWith(`${TEST_ID}${personId}-`));
  return theirs ? `${SAMPLE_ID}${cardId.slice(TEST_ID.length)}` : cardId;
}

/** What may go to the server: test data never does. */
export function withoutTestData<T extends { testData?: boolean }>(items: T[]) {
  return items.filter((item) => !item.testData);
}

/** Whether a queued practice change may be sent: never one about a test fact. */
export function sendable(change: { row: Record<string, unknown> }) {
  return !String(change.row.card_id ?? '').startsWith(TEST_ID);
}

function sameFact(a: Fact, b: Fact) {
  return (
    a.type === b.type &&
    a.text === b.text &&
    a.timeSensitive === b.timeSensitive &&
    (!a.timeSensitive || a.asOf === b.asOf) &&
    a.year === b.year
  );
}

/** A draft as it will be saved: tidied, and dated only if it may change. */
export function tidyDraft<T extends Fact>(draft: T): T {
  const text = tidyMemory(draft.text);
  return draft.timeSensitive ? { ...draft, text } : { ...draft, text, asOf: undefined };
}

/**
 * What saving part of the form changes for one person: new facts, changed facts (which wait
 * for approval again) and facts that were emptied, which are removed. A saved fact the drafts
 * don't mention is left alone, so each step of the form can be saved by itself.
 */
export function planFacts<T extends Fact & { id?: string }>(saved: SavedCard[], drafts: T[]) {
  const kept = drafts.map(tidyDraft).filter((draft) => draft.text);
  const byId = new Map(saved.map((card) => [card.id, card]));
  const add = kept.filter((draft) => !draft.id || !byId.has(draft.id));
  const change = kept.filter((draft) => {
    const before = draft.id ? byId.get(draft.id) : undefined;
    return before !== undefined && !sameFact(before, draft);
  });
  const keptIds = new Set(kept.flatMap((draft) => (draft.id ? [draft.id] : [])));
  const named = new Set(drafts.flatMap((draft) => (draft.id ? [draft.id] : [])));
  const remove = saved.filter((card) => named.has(card.id) && !keptIds.has(card.id)).map((card) => card.id);
  return { add, change, remove };
}

// ---------------------------------------------------------------------------------------
// As-of months
// ---------------------------------------------------------------------------------------

/** The first of the date's month, YYYY-MM-01, in local time. */
export function monthOf(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

/** An as-of month moved by some months. */
export function addMonths(asOf: string, months: number) {
  const [year, month] = asOf.split('-').map(Number);
  return monthOf(new Date(year, month - 1 + months, 1));
}
