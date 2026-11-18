import * as Crypto from 'expo-crypto';
import { useSyncExternalStore } from 'react';

import { profileOf, type PhotoFields } from '@/components/person-photo';
import { DEFAULT_REVEAL_CARDS, DEFAULT_SESSION_LENGTH, type RevealSetting, type SessionLength } from '@/config/schedule';
import { currentProfile } from '@/data/account';
import {
  CAREGIVER_SOURCE,
  planFacts,
  relationshipChanged,
  statusChange,
  withoutTestData,
  type CardStatus,
  type DraftFact,
  type PickedPhoto,
  type SavedCard,
} from '@/lib/facts';
import { applyApproval, undoApproval, type ApprovalUndo } from '@/lib/approve-all';
import { problemOf, type LoadProblem } from '@/lib/load-problem';
import type { AiSentence } from '@/lib/ai-sentences';
import { readPhoto } from '@/lib/photo-files';
import { signedUrls } from '@/lib/photo-urls';
import { deckChanges, profileCompletion } from '@/lib/profile';
import { spreadOnReturn } from '@/lib/queue';
import { cardsOf, dailyTarget, practiceFrom } from '@/lib/session';
import { sentenceFor, type BestClue, type Fact, type Hints } from '@/lib/stories';
import { WORDING_LATEST } from '@/lib/wording';
import { supabase } from '@/lib/supabase';
import { warnKind } from '@/lib/log';

// The caregiver's family on the server: people, the facts about them, the daily goal and the
// person's login. Screens read it with useFamily() and change it with the actions below;
// every change goes to Supabase first, then the family reloads.

export type { CardStatus, PickedPhoto, SavedCard } from '@/lib/facts';

export type SavedPerson = {
  id: string;
  name: string;
  relationship?: string;
  /** Path in the private photo bucket. */
  photoPath?: string;
  /** A short-lived signed URL for photoPath. */
  photoUrl?: string;
  /** A fictional sample person's bundled illustration. */
  samplePortrait?: string;
  /** Which hints practice may give for them. */
  hints: Hints;
  /** The furthest step of the profile questionnaire the caregiver reached. */
  profileStep: number;
  /** What helps most in recognizing them. */
  bestClue?: BestClue;
  /** The ids of questions marked "Not applicable". */
  notApplicable: string[];
  /** The marks among them that are test data. Only ever on the phone, with sign-in off. */
  testMarks?: string[];
  /** In the practice deck: complete, and not deselected. Practice never shows anyone else. */
  inDeck: boolean;
  /** The caregiver's "Include in practice", on unless they turned it off. */
  includeInPractice: boolean;
  /** Their cards may start behind the "?", unless the caregiver opted them out. */
  revealOk: boolean;
  /** The caregiver's per-person switch for AI questions. Only ever set with sign-in off. */
  aiOk?: boolean;
  /** One of the real people from the example deck: their facts are never sent. */
  aiHeldBack?: boolean;
  /** When the caregiver archived them: out of practice and off the People grid, everything kept. Missing while active. */
  archivedAt?: string;
};

/** AI questions, for the caregiver. Only ever set with sign-in off: see AI_AVAILABLE. */
export type FamilyAi = { on: boolean; consented: boolean; sentences: AiSentence[] };

export type PersonLogin = { id: string; username: string; displayName: string };

export type Family = {
  people: SavedPerson[];
  /** Every fact, each one a card, in the order they were added. */
  cards: SavedCard[];
  /** The day's target, worked out from the deck and the session length. */
  goal: number;
  sessionLength: SessionLength;
  revealCards: RevealSetting;
  ai?: FamilyAi;
  /** The person's login, once the caregiver has made it. */
  person: PersonLogin | null;
};

export type NewPerson = {
  /** Made by the form, so each autosave of a new person is the same person. */
  id: string;
  name: string;
  relationship: string;
  facts: DraftFact[];
  pickedPhoto?: PickedPhoto;
};

/** photo: leave it out to keep the picture, a picked photo to replace it, null to remove it. */
export type PersonChanges = { name: string; relationship: string; photo?: PickedPhoto | null };

let family: Family | null = null;
let failed = false;
/** Why the last load failed, so the dashboard says the right thing. */
let problem: LoadProblem | undefined;
/** The caregiver the family belongs to, so another sign-in never sees it. */
let loadedFor: string | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const profile = currentProfile();
  if (loadedFor !== profile.id) {
    loadedFor = profile.id;
    family = null;
    failed = false;
    refreshFamily();
  }
  return () => {
    listeners.delete(listener);
  };
}

export function useFamily() {
  return useSyncExternalStore(subscribe, () => family, () => null);
}

/** True when the last load failed, for example offline. */
export function useFamilyFailed() {
  return useSyncExternalStore(subscribe, () => failed, () => false);
}

/** Why the last load failed: offline, sign-in ended, the server not yet updated, or the server away. */
export function useFamilyProblem() {
  return useSyncExternalStore(subscribe, () => (failed ? problem : undefined), () => undefined);
}

/** The family as last loaded in this session, for Export my data offline. Null before it has loaded. */
export const latestFamily = () => (loadedFor && family ? family : null);

/** Signing out: this login's family leaves memory, so the next sign-in loads afresh. */
export function forgetFamily() {
  family = null;
  failed = false;
  loadedFor = null;
  notify();
}

export function refreshFamily() {
  loading ??= load()
    .then(settleDeck)
    .catch((error) => warnKind('Could not settle the deck', error))
    .finally(() => {
      loading = null;
    });
  return loading;
}

/** Loads again after a change. A load that started before the change may hold old rows, so it is not reused. */
async function reload() {
  await loading;
  await refreshFamily();
}

/**
 * `in_deck` follows the rule, because a database rule can't see the percent: everyone complete
 * joins unless deselected, and anyone who dropped below 100% goes back to being a draft.
 */
async function settleDeck() {
  if (!family) return;
  const { join, leave } = deckChanges(family.people, family.cards, profileOf);
  if (join.length === 0 && leave.length === 0) return;
  if (join.length) check(await supabase.from('people').update({ in_deck: true }).in('id', join));
  if (leave.length) check(await supabase.from('people').update({ in_deck: false }).in('id', leave));
  await load();
}

async function load() {
  const forId = loadedFor;
  const [people, cards, goal, person] = await Promise.all([
    supabase
      .from('people')
      .select('id, name, relationship, photo_path, sample_portrait, hint_letter, hint_fact, hint_relationship, hint_fewer, profile_step, best_clue, not_applicable, in_deck, include_in_practice, reveal_ok, archived_at')
      .order('created_at'),
    supabase
      // Every column, so this works whether or not the server has the wording column yet (2026-11-18).
      .from('cards')
      .select('*')
      .order('created_at'),
    supabase.from('daily_goal').select('session_length, reveal_cards').maybeSingle(),
    // The family's person logins: the one with a User ID is "Their login". A login without one was made
    // by an earlier release for a phone of the person's, and is left alone.
    supabase.from('profiles').select('id, username, display_name').eq('role', 'person'),
  ]);
  const error = people.error ?? cards.error ?? goal.error ?? person.error;
  const named = (person.data ?? []).find((row) => row.username);
  // A row read with every column says whether the server has the wording column (an empty family can't say).
  if (cards.data?.length) serverHasWording = 'wording' in cards.data[0];
  if (loadedFor !== forId) return;
  if (error) {
    warnKind('Could not load the family', error);
    failed = true;
    problem = problemOf(error);
    notify();
    return;
  }

  const urls = await signedUrls([...(people.data ?? []), ...(cards.data ?? [])].map((row) => row.photo_path).filter(Boolean));
  family = withGoal({
    people: (people.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      relationship: row.relationship || undefined,
      photoPath: row.photo_path ?? undefined,
      photoUrl: row.photo_path ? urls[row.photo_path] : undefined,
      samplePortrait: row.sample_portrait ?? undefined,
      hints: hintsOf(row),
      profileStep: row.profile_step,
      bestClue: row.best_clue ?? undefined,
      notApplicable: row.not_applicable ?? [],
      inDeck: row.in_deck,
      includeInPractice: row.include_in_practice,
      revealOk: row.reveal_ok,
      archivedAt: row.archived_at ?? undefined,
    })),
    cards: (cards.data ?? []).map((row) => ({
      id: row.id,
      personId: row.person_id,
      type: row.fact_type,
      text: row.memory_text,
      status: row.status,
      timeSensitive: row.time_sensitive,
      asOf: row.as_of ?? undefined,
      year: row.memory_year ?? undefined,
      confirmedAt: row.confirmed_at ?? undefined,
      source: row.source,
      phrasingsOff: row.phrasings_off ?? [],
      hintOk: row.hint_ok,
      photoPath: row.photo_path ?? undefined,
      photoUrl: row.photo_path ? urls[row.photo_path] : undefined,
      // Which wording its sentences use: missing (a server not yet upgraded) is version 1.
      wording: row.wording ?? 1,
    })),
    goal: 0,
    sessionLength: goal.data?.session_length ?? DEFAULT_SESSION_LENGTH,
    revealCards: goal.data?.reveal_cards ?? DEFAULT_REVEAL_CARDS,
    person: named ? { id: named.id, username: named.username, displayName: named.display_name } : null,
  });
  failed = false;
  notify();
}

/** The day's target follows the deck and the session length. */
function withGoal(next: Family): Family {
  const deck = practiceFrom(next.people, next.cards, profileOf);
  return { ...next, goal: dailyTarget(cardsOf(deck.people, deck.cards), next.sessionLength) };
}

/** A people row's hint columns. */
export function hintsOf(row: Record<string, unknown>): Hints {
  return {
    letter: row.hint_letter !== false,
    fact: row.hint_fact !== false,
    relationship: row.hint_relationship !== false,
    fewer: row.hint_fewer !== false,
  };
}

function current() {
  if (!family) throw new Error('The family has not loaded yet.');
  return family;
}

function check<T extends { error: { message: string } | null }>(result: T) {
  if (result.error) throw new Error(result.error.message);
  return result;
}

/**
 * Whether the server has `cards.wording` (added 2026-11-18 in supabase/schema.sql). Until the schema is
 * rerun it doesn't: PostgREST refuses any write that names the column (PGRST204), so no fact could be
 * saved, and every card reads as version 1. Without it, cards are written in version 1 and without the
 * column, so saving still works; "Refresh wording" says the update is needed (WORDING_UNAVAILABLE).
 */
let serverHasWording = true;
export const wordingOnServer = () => serverHasWording;

/** The words "Refresh wording" gives when the server can't keep the new wording yet. */
export const WORDING_UNAVAILABLE = 'The new wording needs the latest database update first. Your stories keep their wording until then.';

/** Whether a refusal is the server not knowing the wording column. */
export const missingWording = (error: { code?: string; message?: string } | null) =>
  Boolean(error && /\bwording\b/.test(error.message ?? '') && (error.code === 'PGRST204' || error.code === '42703' || /column/i.test(error.message ?? '')));

/** Runs a card write; if the server lacks the wording column, notes it and runs the write again without it. */
async function writeCards<T extends { error: { code?: string; message: string } | null }>(run: () => PromiseLike<T>) {
  let result = await run();
  if (serverHasWording && missingWording(result.error)) {
    serverHasWording = false;
    warnKind('The server has no wording column yet', result.error);
    result = await run();
  }
  return check(result);
}

/**
 * The columns a fact fills. The sentence is the one story approval shows. Every new or edited fact is a
 * draft in the newest wording (docs/SENTENCE-AUDIT.md): an approved card keeps its own until edited. On a
 * server without the wording column, version 1, which is how that server's cards read back.
 */
function factColumns(person: { relationship?: string; name?: string }, fact: Fact) {
  const wording = serverHasWording ? WORDING_LATEST : 1;
  return {
    memory_text: fact.text,
    sentence: sentenceFor(person, { ...fact, wording }),
    ...(serverHasWording ? { wording } : {}),
    fact_type: fact.type,
    time_sensitive: fact.timeSensitive,
    as_of: fact.asOf ?? null,
    memory_year: fact.year ?? null,
  };
}

/** Deletes photos from the private bucket. A leftover file isn't worth failing a save for. */
async function removePhotos(paths: string[]) {
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from('photos').remove(paths);
  if (error) warnKind('Could not remove a photo', error);
}

/** Uploads a photo to <caregiver id>/<name>.<ext> and returns the path. */
async function uploadPhoto(caregiverId: string, name: string, photo: PickedPhoto) {
  const contentType = photo.mimeType ?? 'image/jpeg';
  const extension = contentType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
  const path = `${caregiverId}/${name}.${extension}`;
  // max-age=0 makes Supabase's CDN check with storage on every request, so a deleted photo
  // stops loading at once, even through a link that was already opened. (The default, an
  // hour, kept serving deleted photos from the CDN.) The phone caches photos itself.
  const { error } = await supabase.storage
    .from('photos')
    .upload(path, await readPhoto(photo.uri), { contentType, upsert: true, cacheControl: '0' });
  if (error) throw new Error(error.message);
  return path;
}

/**
 * Saves a person with every fact waiting for approval, and returns their id. Saving the same
 * id again updates them, because a draft can save twice before the first save has come back.
 */
export async function addPerson({ id, name, relationship, facts, pickedPhoto }: NewPerson) {
  if (current().people.some((person) => person.id === id)) {
    await updatePerson(id, { name, relationship, photo: pickedPhoto });
    return id;
  }
  const caregiverId = currentProfile().id;
  const photoPath = pickedPhoto ? await uploadPhoto(caregiverId, id, pickedPhoto) : null;

  const person = { relationship };
  check(await supabase.from('people').insert({ id, caregiver_id: caregiverId, name, relationship, photo_path: photoPath }));
  await insertFacts(caregiverId, id, person, planFacts([], withoutTestData(facts)).add);
  await reload();
  return id;
}

/** New facts, waiting for approval, each with its memory photo if it has one. */
async function insertFacts(caregiverId: string, personId: string, person: { relationship?: string }, facts: DraftFact[]) {
  if (facts.length === 0) return;
  const rows: { fact: DraftFact; row: Record<string, unknown> }[] = [];
  for (const fact of facts) {
    const id = fact.id ?? Crypto.randomUUID();
    rows.push({
      fact,
      row: {
        id,
        caregiver_id: caregiverId,
        person_id: personId,
        status: 'pending',
        source: CAREGIVER_SOURCE,
        hint_ok: fact.hintOk ?? true,
        photo_path: fact.photo ? await uploadPhoto(caregiverId, id, fact.photo) : null,
      },
    });
  }
  // The fact's own columns are worked out on each try, so a retry without the wording column writes version 1.
  await writeCards(() => supabase.from('cards').insert(rows.map(({ fact, row }) => ({ ...row, ...factColumns(person, fact) }))));
}

/**
 * A new name, relationship or photo. Every sentence holds the relationship, so a new one
 * rewrites them and sends approved ones back for approval.
 */
export async function updatePerson(personId: string, { name, relationship, photo }: PersonChanges) {
  const caregiverId = currentProfile().id;
  const { people, cards } = current();
  const before = people.find((candidate) => candidate.id === personId);
  if (!before) return;

  const columns: Record<string, string | null> = { name, relationship };
  if (photo !== undefined) {
    // A new file name each time: the phone caches photos by path, so reusing one would keep
    // showing the old picture.
    columns.photo_path = photo ? await uploadPhoto(caregiverId, `${personId}-${Date.now()}`, photo) : null;
    if (photo === null) columns.sample_portrait = null;
  }
  check(await supabase.from('people').update(columns).eq('id', personId));
  if (photo !== undefined && before.photoPath) {
    const { error } = await supabase.storage.from('photos').remove([before.photoPath]);
    if (error) warnKind('Could not remove the old photo', error);
  }

  if (relationshipChanged(before.relationship, relationship)) {
    const now = new Date().toISOString();
    for (const card of cards.filter((candidate) => candidate.personId === personId)) {
      const reapprove = card.status === 'approved' ? { status: 'pending', confirmed_at: null } : {};
      // Every sentence is written again and waits for approval anyway, so it is written in the newest wording.
      await writeCards(() => {
        const wording = serverHasWording ? WORDING_LATEST : (card.wording ?? 1);
        return supabase
          .from('cards')
          .update({ sentence: sentenceFor({ relationship, name: name ?? before.name }, { ...card, wording }), ...(serverHasWording ? { wording } : {}), ...reapprove, updated_at: now })
          .eq('id', card.id);
      });
    }
  }
  await reload();
}

/**
 * Saves part of the form for one person: new and changed facts wait for approval, emptied ones
 * are removed, and facts the drafts don't mention stay as they are. A new picture alone needs
 * no approval.
 */
export async function saveFacts(personId: string, allDrafts: DraftFact[]) {
  const caregiverId = currentProfile().id;
  const { people, cards } = current();
  const person = people.find((candidate) => candidate.id === personId);
  if (!person) return;
  const drafts = withoutTestData(allDrafts);
  const { add, change, remove } = planFacts(
    cards.filter((card) => card.personId === personId),
    drafts,
  );
  const now = new Date().toISOString();

  await insertFacts(caregiverId, personId, person, add);
  for (const fact of change) {
    await writeCards(() =>
      supabase
        .from('cards')
        .update({ ...factColumns(person, fact), status: 'pending', confirmed_at: null, updated_at: now })
        .eq('id', fact.id!),
    );
  }
  for (const fact of drafts) {
    const before = cards.find((card) => card.id === fact.id);
    if (fact.photo === undefined || !before || remove.includes(before.id)) continue;
    // A new file name each time, as with a person's photo: the phone caches photos by path.
    const path = fact.photo ? await uploadPhoto(caregiverId, `${before.id}-${Date.now()}`, fact.photo) : null;
    check(await supabase.from('cards').update({ photo_path: path, updated_at: now }).eq('id', before.id));
    await removePhotos(before.photoPath ? [before.photoPath] : []);
  }
  // Removing a fact removes its schedule and practice rows with it (foreign keys).
  if (remove.length) {
    await removePhotos(cards.flatMap((card) => (remove.includes(card.id) && card.photoPath ? [card.photoPath] : [])));
    check(await supabase.from('cards').delete().in('id', remove));
  }
  await reload();
}

/** Approve or skip. Approving a fact that may change confirms it is true now. */
export async function setCardStatus(cardId: string, status: CardStatus) {
  const before = current();
  const card = before.cards.find((candidate) => candidate.id === cardId);
  const person = before.people.find((candidate) => candidate.id === card?.personId);
  if (!card || !person) return;
  const change = statusChange(card, status, new Date());
  family = { ...before, cards: before.cards.map((other) => (other.id === cardId ? { ...other, ...change } : other)) };
  notify();
  try {
    check(
      await supabase
        .from('cards')
        .update({
          status,
          confirmed_at: change.confirmedAt ?? null,
          as_of: change.asOf ?? null,
          sentence: sentenceFor(person, { ...card, asOf: change.asOf }),
          updated_at: new Date().toISOString(),
        })
        .eq('id', cardId),
    );
  } finally {
    await reload();
  }
}

/**
 * Approve all for one person (with sign-in on there are no AI sentences): every waiting story that
 * isn't a fact that may change, in one write. The server's own filter repeats that rule.
 */
export async function approveAll(personId: string, ids: { stories: string[]; questions: string[] }) {
  const before = current();
  const person = before.people.find((candidate) => candidate.id === personId);
  const nothing = { approved: 0, undo: { cards: [], sentences: [] } as ApprovalUndo };
  if (!person) return nothing;
  const result = applyApproval({ cards: before.cards, sentences: [] }, person, { stories: ids.stories, questions: [] }, new Date());
  if (result.approved === 0) return nothing;
  family = { ...before, cards: result.cards };
  notify();
  try {
    check(
      await supabase
        .from('cards')
        .update({ status: 'approved', confirmed_at: null, as_of: null, updated_at: new Date().toISOString() })
        .in('id', result.undo.cards.map((card) => card.id))
        .eq('status', 'pending')
        .eq('time_sensitive', false),
    );
  } finally {
    await reload();
  }
  return { approved: result.approved, undo: result.undo };
}

/** Undo for Approve all: the same stories back to waiting, if they are still approved. */
export async function undoApproveAll(undo: ApprovalUndo) {
  const ids = undo.cards.map((card) => card.id);
  if (ids.length === 0) return;
  const before = current();
  family = { ...before, cards: undoApproval({ cards: before.cards, sentences: [] }, undo).cards };
  notify();
  try {
    check(await supabase.from('cards').update({ status: 'pending', confirmed_at: null, as_of: null, updated_at: new Date().toISOString() }).in('id', ids).eq('status', 'approved'));
  } finally {
    await reload();
  }
}

/**
 * Moves one person's cards to the newest wording, on purpose (their sheet's "Use the new wording"). Each
 * card in an older wording goes back to story approval, so the caregiver reads the new sentence before
 * it reaches practice; a skipped card stays skipped. Nothing else about a card changes.
 */
export async function moveToNewWording(personId: string) {
  const { people, cards } = current();
  const person = people.find((candidate) => candidate.id === personId);
  if (!person) return 0;
  const older = cards.filter((card) => card.personId === personId && card.status !== 'skipped' && (card.wording ?? 1) < WORDING_LATEST);
  if (older.length === 0) return 0;
  // Without the wording column the server can't keep the new wording: nothing changes, and the caregiver is told.
  if (!serverHasWording) throw new Error(WORDING_UNAVAILABLE);
  const now = new Date().toISOString();
  for (const card of older) {
    await writeCards(() =>
      supabase
        .from('cards')
        .update({
          wording: WORDING_LATEST,
          sentence: sentenceFor(person, { ...card, wording: WORDING_LATEST }),
          ...(card.status === 'approved' ? { status: 'pending', confirmed_at: null } : {}),
          updated_at: now,
        })
        .eq('id', card.id),
    );
    if (!serverHasWording) throw new Error(WORDING_UNAVAILABLE);
  }
  await reload();
  return older.length;
}

/** A changed fact makes a new sentence, so it waits for approval again. */
export async function editCard(cardId: string, fact: Fact) {
  const { people, cards } = current();
  const card = cards.find((candidate) => candidate.id === cardId);
  const person = people.find((candidate) => candidate.id === card?.personId);
  if (!card || !person) return;
  await writeCards(() =>
    supabase
      .from('cards')
      .update({ ...factColumns(person, fact), status: 'pending', confirmed_at: null, updated_at: new Date().toISOString() })
      .eq('id', cardId),
  );
  await reload();
}

/** The phrasings the caregiver turned off for one fact. Shown at once, then saved. */
export async function setPhrasingsOff(cardId: string, off: string[]) {
  const before = current();
  family = { ...before, cards: before.cards.map((card) => (card.id === cardId ? { ...card, phrasingsOff: off } : card)) };
  notify();
  try {
    check(await supabase.from('cards').update({ phrasings_off: off, updated_at: new Date().toISOString() }).eq('id', cardId));
  } finally {
    await reload();
  }
}

/** Which hints practice may give for a person. Shown at once, then saved. */
export async function setHints(personId: string, hints: Hints) {
  const before = current();
  family = { ...before, people: before.people.map((person) => (person.id === personId ? { ...person, hints } : person)) };
  notify();
  try {
    check(
      await supabase
        .from('people')
        .update({ hint_letter: hints.letter, hint_fact: hints.fact, hint_relationship: hints.relationship, hint_fewer: hints.fewer })
        .eq('id', personId),
    );
  } finally {
    await reload();
  }
}

/** How far the caregiver got in the profile questionnaire, their best clue (null clears it), and what is not applicable. */
export async function setProfile(personId: string, profile: { step?: number; bestClue?: BestClue | null; notApplicable?: string[] }) {
  check(
    await supabase
      .from('people')
      .update({
        ...(profile.step === undefined ? {} : { profile_step: profile.step }),
        ...(profile.bestClue === undefined ? {} : { best_clue: profile.bestClue }),
        ...(profile.notApplicable === undefined ? {} : { not_applicable: profile.notApplicable }),
      })
      .eq('id', personId),
  );
  await reload();
}

/** Includes a person again. Below 100% it does nothing: they stay a draft. */
export async function addToPractice(personId: string) {
  const { people, cards } = current();
  const person = people.find((candidate) => candidate.id === personId) as (SavedPerson & PhotoFields) | undefined;
  if (!person || profileCompletion(profileOf(person), cards.filter((card) => card.personId === personId)) < 100) return;
  check(await supabase.from('people').update({ in_deck: true, include_in_practice: true }).eq('id', personId));
  await reload();
}

/** The caregiver's "Include in practice". Deselecting takes them out at once; their profile stays. */
export async function setIncludeInPractice(personId: string, included: boolean) {
  check(await supabase.from('people').update(included ? { include_in_practice: true } : { include_in_practice: false, in_deck: false }).eq('id', personId));
  await reload();
}

/** Which of a person's facts may be used as hints. With none left, the fact hint turns off for them. */
export async function setFactHints(personId: string, off: string[]) {
  const theirs = current().cards.filter((card) => card.personId === personId);
  const on = theirs.filter((card) => !off.includes(card.id)).map((card) => card.id);
  if (on.length) check(await supabase.from('cards').update({ hint_ok: true }).in('id', on));
  if (off.length) check(await supabase.from('cards').update({ hint_ok: false }).in('id', off));
  check(await supabase.from('people').update({ hint_fact: on.length > 0 }).eq('id', personId));
  await reload();
}

/** Takes a person out of practice and off the People grid, keeping everything about them. Shown at once, then saved. */
export async function archivePerson(personId: string) {
  const before = current();
  const archivedAt = new Date().toISOString();
  family = withGoal({ ...before, people: before.people.map((person) => (person.id === personId ? { ...person, archivedAt, inDeck: false } : person)) });
  notify();
  try {
    check(await supabase.from('people').update({ archived_at: archivedAt, in_deck: false }).eq('id', personId));
  } finally {
    await reload();
  }
}

/**
 * Brings an archived person back as they were; `in_deck` follows on the reload, as for everyone.
 * After a day or more away, their overdue cards come back a few a day: the schedule rows move first,
 * newer than the person's phone's copy, so that phone takes them on its next refresh.
 */
export async function restorePerson(personId: string) {
  const { people, cards } = current();
  const archivedAt = people.find((candidate) => candidate.id === personId)?.archivedAt;
  if (!archivedAt) return;
  const theirs = cards.filter((card) => card.personId === personId).map((card) => card.id);
  if (theirs.length) {
    const rows = check(await supabase.from('card_schedule').select('card_id, person_user_id, step, due_at').in('card_id', theirs)).data ?? [];
    const now = new Date();
    for (const login of new Set(rows.map((row) => row.person_user_id))) {
      const mine = rows.filter((row) => row.person_user_id === login);
      const moved = spreadOnReturn(Object.fromEntries(mine.map((row) => [row.card_id, { step: row.step, dueAt: row.due_at }])), theirs, archivedAt, now);
      const updates = Object.entries(moved).map(([cardId, entry]) => ({
        card_id: cardId,
        person_user_id: login,
        caregiver_id: currentProfile().id,
        step: entry.step,
        due_at: entry.dueAt,
        updated_at: now.toISOString(),
      }));
      if (updates.length) check(await supabase.from('card_schedule').upsert(updates));
    }
  }
  check(await supabase.from('people').update({ archived_at: null }).eq('id', personId));
  await reload();
}

/**
 * Deletes an archived person for good: every stored photo of theirs first, then their row, which
 * takes their facts, schedule and attempts with it (foreign keys). A photo that can't be deleted
 * stops it, so nothing is left in the bucket that no row points to any more.
 */
export async function deletePerson(personId: string) {
  const caregiverId = currentProfile().id;
  const { people, cards } = current();
  const person = people.find((candidate) => candidate.id === personId);
  if (!person) return;
  if (!person.archivedAt) throw new Error('Only an archived person can be deleted.');
  const theirs = cards.filter((card) => card.personId === personId);
  const named = [person.photoPath, ...theirs.map((card) => card.photoPath)].filter((path): path is string => Boolean(path));
  // Files are named after the person or the fact, so an earlier photo that a failed replacement left behind goes too.
  const prefixes = [personId, ...theirs.map((card) => card.id)];
  const listed = await supabase.storage.from('photos').list(caregiverId, { limit: 1000 });
  const leftovers = (listed.data ?? []).filter((file) => prefixes.some((prefix) => file.name.startsWith(prefix))).map((file) => `${caregiverId}/${file.name}`);
  const paths = [...new Set([...named, ...leftovers])];
  if (paths.length) {
    const { error } = await supabase.storage.from('photos').remove(paths);
    if (error) throw new Error(error.message);
  }
  check(await supabase.from('people').delete().eq('id', personId));
  await reload();
}

/** Whether this person's cards may start behind the "?". */
export async function setRevealOk(personId: string, revealOk: boolean) {
  check(await supabase.from('people').update({ reveal_ok: revealOk }).eq('id', personId));
  await reload();
}

/** How often cards start behind the "?". Shown at once, then saved. */
export async function setRevealCards(revealCards: RevealSetting) {
  const caregiverId = currentProfile().id;
  family = { ...current(), revealCards };
  notify();
  try {
    check(await supabase.from('daily_goal').upsert({ caregiver_id: caregiverId, reveal_cards: revealCards, updated_at: new Date().toISOString() }));
  } finally {
    await reload();
  }
}

/** How long a day of practice is. Shown at once, then saved. */
export async function setSessionLength(sessionLength: SessionLength) {
  const caregiverId = currentProfile().id;
  family = withGoal({ ...current(), sessionLength });
  notify();
  try {
    check(
      await supabase
        .from('daily_goal')
        .upsert({ caregiver_id: caregiverId, session_length: sessionLength, updated_at: new Date().toISOString() }),
    );
  } finally {
    await reload();
  }
}
