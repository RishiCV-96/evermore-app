import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { useSyncExternalStore } from 'react';

import { profileOf, type PhotoFields } from '@/components/person-photo';
import { AI_AVAILABLE } from '@/config/features';
import { DEFAULT_REVEAL_CARDS, DEFAULT_SESSION_LENGTH, type RevealSetting, type SessionLength } from '@/config/schedule';
import type { Activity } from '@/data/activity-store';
import { fetchSentences, type AiFailure } from '@/data/ai-client';
import { exampleDeck, localDeck } from '@/data/example-deck';
import type { Family, NewPerson, PersonChanges, SavedPerson } from '@/data/family-store';
import { photoFor, placeholderPhoto } from '@/data/photos';
import { doneToday, type Asked, type Practice } from '@/data/practice-store';
import { onNewStudyDay, studyToday } from '@/data/study-clock';
import { TEST_DATA } from '@/data/test-data';
import { sessionDay } from '@/lib/activity';
import { acceptSentences, buildRequest, sendableFacts } from '@/lib/ai-request';
import { applyApproval, undoApproval, type ApprovalUndo } from '@/lib/approve-all';
import { addSentences, approveAllValid, approveSentence, editSentence, queueRoom, rejectSentence, sentencesInUse, settleSentences } from '@/lib/ai-sentences';
import { ATTEMPTS_KEY, attemptOf, keptAttempts, monthOf, type CardAttempt, type CardTiming } from '@/lib/attempts';
import type { InsightsData } from '@/lib/insights';
import { collectPhotos, photoEntries, photoZip, settleRead, type Cancel, type ExportProgress, type ExportRead, type ExportSource } from '@/lib/export';
import { sampleIdFrom, type CardStatus, type DraftFact, type SavedCard } from '@/lib/facts';
import * as notes from '@/lib/family-notes';
import * as families from '@/lib/local-family';
import { emptyPractice, endSession, finishCard, forgetPerson, localActivity, pruned, renameCards, startSession, type LocalPractice } from '@/lib/local-practice';
import { dropPhoto, keepPhoto } from '@/lib/photo-files';
import { readBytes } from '@/lib/save-file';
import { profileCompletion } from '@/lib/profile';
import { spreadOnReturn, type CardResult } from '@/lib/queue';
import { cardsOf, goalToday, logAsked, practiceFrom } from '@/lib/session';
import { ALL_HINTS, BLANK, phrasingsFor, type Fact, type Hints, type Round } from '@/lib/stories';
import { approvedVariants, isAiPhrasing } from '@/lib/variants';
import { warnKind } from '@/lib/log';

// Sign-in off (src/config/features.ts): no accounts, and nothing leaves the phone. The family
// starts as a copy of the example deck (src/data/example-deck.ts: the fictional sample people, and in
// development your real cards from the gitignored src/data/deck.local.ts with photos from assets/photos/,
// all approved); the caregiver can add, change and approve from there. The family and practice
// are saved here in AsyncStorage. Holding Caregiver on the home screen opens the dashboard.
// Screens read this through src/data/app-data.ts.

const KEY = 'evermore.local.v1';
const FAMILY_KEY = 'evermore.family.v1';
/** Each card's record for insights, one key per month (ATTEMPTS_KEY), so a card writes only its own month. */
const attemptsKey = (month: string) => `${ATTEMPTS_KEY}.${month}`;

/** The real people from the local deck (development only). Their facts never leave the phone, flagged or not. */
const HELD_BACK_FROM_AI = new Set(localDeck.map((person) => person.id));

let saved: LocalPractice | null = null;
let family: families.LocalFamily | null = null;
/** Every card's record kept for the caregiver's insights, oldest first. */
let attempts: CardAttempt[] = [];
// What screens read, rebuilt only when practice or the family changes.
let practice: Practice | null = null;
let dashboard: { family: Family; activity: Activity; since: Date; insights: InsightsData } | null = null;
let role: 'person' | 'caregiver' = 'person';
/** A person the caregiver chose to practice when handing the phone back. */
let handoff: string | null = null;
let started = false;
let writing = Promise.resolve();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!started) {
    started = true;
    load();
  }
  return () => {
    listeners.delete(listener);
  };
}

function read<T>(raw: string | null, fallback: T, what: string): T {
  try {
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch (error) {
    // Unreadable: start again rather than leave the person without practice.
    warnKind(`Could not read the saved ${what}`, error);
    return fallback;
  }
}

/** Every month of card records, dropping those past ATTEMPTS_KEPT_DAYS for good. */
async function loadAttempts(now: Date) {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(`${ATTEMPTS_KEY}.`));
    const months = await AsyncStorage.multiGet(keys);
    const all = months.flatMap(([, raw]) => {
      try {
        return raw ? (JSON.parse(raw) as CardAttempt[]) : [];
      } catch {
        return [];
      }
    });
    const kept = keptAttempts(all, now).sort((a, b) => a.shownAt.localeCompare(b.shownAt));
    const keptMonths = new Set(kept.map(monthOf));
    const stale = keys.filter((key) => !keptMonths.has(key.slice(ATTEMPTS_KEY.length + 1)));
    if (stale.length) AsyncStorage.multiRemove(stale).catch(() => undefined);
    return kept;
  } catch (error) {
    // Insights are a nice-to-have: practice goes on without them.
    warnKind('Could not read the card records', error);
    return [];
  }
}

async function load() {
  const now = new Date();
  const [rawPractice, rawFamily] = await Promise.all(
    [KEY, FAMILY_KEY].map((key) => AsyncStorage.getItem(key).catch(() => null)),
  );
  attempts = await loadAttempts(now);
  const state = read(rawPractice, emptyPractice(now), 'practice');
  // The first time, and whenever the example deck gains someone, copy them in.
  const stored = read(rawFamily, families.EMPTY_FAMILY, 'family');
  const copied = families.seedFamily(
    { ...stored, cards: stored.cards.map((card) => ({ ...card, phrasingsOff: card.phrasingsOff ?? [] })) },
    exampleDeck,
  );
  const samplePeople = TEST_DATA.samples.map((sample) => sample.id);
  const kept = families.releaseSampleFacts(families.seedTestData(copied, TEST_DATA), samplePeople);
  // Together: a schedule entry whose card is gone is dropped.
  commit({ practice: renameCards(pruned(state, now, studyToday(now)), (id) => sampleIdFrom(id, samplePeople)), family: kept });
  // Development only, never a control in the app: start with EXPO_PUBLIC_CLEAR_TEST_DATA=1 to remove
  // the made-up answers about the real example people, and any demo records. Stripped from release builds.
  if (__DEV__ && process.env.EXPO_PUBLIC_CLEAR_TEST_DATA === '1') await clearLocalTestData();
}

/** A person as screens show them, with their picture. */
function shown(person: families.LocalPerson): SavedPerson & PhotoFields {
  const deck = person.deckPhoto ? photoFor(person.id) : undefined;
  return {
    id: person.id,
    name: person.name,
    relationship: person.relationship,
    photoUri: person.photoUri,
    bundledPhoto: deck && deck !== placeholderPhoto ? deck : undefined,
    samplePortrait: person.samplePortrait,
    hints: person.hints ?? ALL_HINTS,
    profileStep: person.profileStep ?? 0,
    bestClue: person.bestClue,
    notApplicable: person.notApplicable ?? [],
    testMarks: person.testMarks,
    inDeck: Boolean(person.inDeck),
    includeInPractice: person.includeInPractice !== false,
    revealOk: person.revealOk !== false,
    aiOk: person.aiOk !== false,
    aiHeldBack: HELD_BACK_FROM_AI.has(person.id),
    archivedAt: person.archivedAt,
  };
}

const about = (person: families.LocalPerson) => profileOf(shown(person));

/** Saves what changed and rebuilds what screens read. */
function commit(next: { practice?: LocalPractice; family?: families.LocalFamily; attempts?: CardAttempt[]; months?: string[] }) {
  // Card records: `months` are the months among them that changed, so only those are written.
  attempts = next.attempts ?? attempts;
  if (next.family) {
    next.family = families.settleDeck(next.family, about);
    // A sentence whose facts changed leaves practice, whichever way they changed.
    if (next.family.sentences?.length) next.family = { ...next.family, sentences: settleSentences(next.family.sentences, next.family.people, next.family.cards) };
    // A removed fact takes its schedule with it.
    const ids = new Set(next.family.cards.map((card) => card.id));
    const base = next.practice ?? saved;
    if (base && Object.keys(base.schedule).some((id) => !ids.has(id))) {
      next.practice = { ...base, schedule: Object.fromEntries(Object.entries(base.schedule).filter(([id]) => ids.has(id))) };
    }
  }
  saved = next.practice ?? saved;
  family = next.family ?? family;
  if (!saved || !family) return;

  const people = family.people.map(shown);
  const ai = AI_AVAILABLE ? { on: saved.aiOn !== false, consented: Boolean(saved.aiConsentAt), sentences: family.sentences ?? [] } : undefined;
  const deck = practiceFrom(people, family.cards, profileOf, (card, person) => approvedVariants(sentencesInUse(ai, person), card.id, person, card));
  const sessionLength = saved.sessionLength ?? DEFAULT_SESSION_LENGTH;
  const revealCards = saved.revealCards ?? DEFAULT_REVEAL_CARDS;
  // Someone archived mid-day keeps what they finished in the day, and loses the rest of it. Today's
  // log remembers the deck and the target, so a change is noticed even after the app restarts.
  const today = goalToday(cardsOf(deck.people, deck.cards), sessionLength, saved.today, studyToday());
  const goal = today.goal;
  if (JSON.stringify(today.log) !== JSON.stringify(saved.today)) {
    saved = { ...saved, today: today.log };
    next.practice = saved;
  }
  practice = {
    people: deck.people,
    cards: deck.cards,
    goal,
    sessionLength,
    revealCards,
    schedule: saved.schedule,
    sessions: saved.sessions,
    outbox: [],
    lastPhrasing: saved.lastPhrasing,
    lastChoices: saved.lastChoices,
    today: saved.today,
  };
  dashboard = {
    family: { people, cards: family.cards, goal, sessionLength, revealCards, ai, person: null },
    activity: localActivity(saved, new Date()),
    since: new Date(saved.since),
    insights: { attempts, demo: Boolean(saved.insightsDemo) },
  };
  notify();

  // Chained so an older save can never land after a newer one.
  const writes: [string, string][] = [];
  if (next.practice) writes.push([KEY, JSON.stringify(next.practice)]);
  if (next.family) writes.push([FAMILY_KEY, JSON.stringify(next.family)]);
  for (const month of next.months ?? []) writes.push([attemptsKey(month), JSON.stringify(attempts.filter((attempt) => monthOf(attempt) === month))]);
  if (writes.length === 0) return;
  writing = writing
    .then(() => AsyncStorage.multiSet(writes))
    .catch((error) => warnKind('Could not save on this phone', error));
}

function current() {
  if (!saved) throw new Error('Practice has not loaded yet.');
  return saved;
}

function currentFamily() {
  if (!family) throw new Error('The family has not loaded yet.');
  return family;
}

export function useLocalPractice() {
  return useSyncExternalStore(subscribe, () => practice, () => null);
}

export function useLocalReady() {
  return useSyncExternalStore(subscribe, () => practice !== null, () => false);
}

export function useLocalRole() {
  return useSyncExternalStore(subscribe, () => role, () => role);
}

// ---- The Family board with sign-in off: the notes live in the family kept on this phone ----

const NO_NOTES: notes.FamilyNote[] = [];

/** The family's notes, or null until the phone's family has loaded. */
export function useLocalNotes() {
  return useSyncExternalStore(subscribe, () => (family ? (family.notes ?? NO_NOTES) : null), () => null);
}

function saveNotes(result: { notes: notes.FamilyNote[]; problem?: string }) {
  if (result.problem) return result.problem;
  commit({ family: { ...currentFamily(), notes: result.notes } });
  return undefined;
}

export async function addLocalNote(draft: notes.NoteDraft) {
  return saveNotes(notes.addNote(currentFamily().notes ?? [], draft, Crypto.randomUUID(), new Date()));
}

export async function editLocalNote(id: string, draft: notes.NoteDraft) {
  return saveNotes(notes.editNote(currentFamily().notes ?? [], id, draft, new Date()));
}

export async function deleteLocalNote(id: string) {
  return saveNotes({ notes: notes.deleteNote(currentFamily().notes ?? [], id) });
}

export async function pinLocalNote(id: string | null) {
  return saveNotes({ notes: notes.pinNote(currentFamily().notes ?? [], id, new Date()) });
}

/** Holding Caregiver on the person's home. */
export function openCaregiver() {
  role = 'caregiver';
  notify();
}

/** Back to the person's home from the dashboard. */
export function closeCaregiver() {
  role = 'person';
  notify();
}

/** Back to the person's home, straight into one person's cards. */
export function practiceWith(personId: string) {
  role = 'person';
  handoff = personId;
  notify();
}

export function useHandoff() {
  return useSyncExternalStore(subscribe, () => handoff, () => null);
}

/** The person's home has opened the practice the caregiver chose. */
export function takeHandoff() {
  handoff = null;
  notify();
}

/** A new day may have started: recount, and drop what nothing shows any more. */
export function refreshLocal() {
  if (saved) commit({ practice: pruned(saved, new Date(), studyToday()) });
}

// A new study day began while the app was open (05:30, or on coming back to the front).
onNewStudyDay(() => refreshLocal());

export function newLocalSessionId() {
  return Crypto.randomUUID();
}

/** Starts a session in today's study day, which it keeps however long it runs. One begun once the day's session is complete is extra practice. */
export function startLocalSession(id: string) {
  const extraPractice = practice ? doneToday(practice) : false;
  commit({ practice: startSession(current(), id, new Date(), practice?.goal ?? 0, { studyDay: studyToday(), extraPractice }) });
}

/** One card finished. Returns the card's new schedule step. */
export function recordLocalCard(sessionId: string, cardId: string, result: CardResult, asked?: Asked) {
  const now = new Date();
  const { state, step } = finishCard(current(), sessionId, cardId, result, now, asked?.extra);
  commit({
    practice: asked
      ? {
          ...state,
          lastPhrasing: { ...state.lastPhrasing, [asked.personId]: asked.phrasing },
          lastChoices: { ...state.lastChoices, [asked.personId]: asked.choices },
          // Logged in the study day the round began in, so a round running past 05:30 leaves the new day alone.
          today: logAsked(state.today, roundDay(state, sessionId, now), { personId: asked.personId, cardId, key: asked.key, kind: asked.kind, extra: asked.extra }),
        }
      : state,
  });
  return step;
}

/** The study day a round belongs to: the one it began in. */
function roundDay(state: LocalPractice, sessionId: string, now: Date) {
  const round = state.sessions.find((one) => one.id === sessionId);
  return round ? sessionDay(round) : studyToday(now);
}

export function finishLocalSession(sessionId: string) {
  commit({ practice: endSession(current(), sessionId, new Date()) });
}

/**
 * The record of one card, for the caregiver's insights: kept on the phone, never shown to the
 * person, and marked as test data when the card is.
 */
export function recordLocalAttempt(sessionId: string, card: Round, timing: CardTiming) {
  const session = saved?.sessions.find((one) => one.id === sessionId);
  const attempt = attemptOf(card, timing, {
    id: Crypto.randomUUID(),
    sessionId,
    goal: session?.dailyGoal ?? practice?.goal ?? 0,
    source: isAiPhrasing(card.phrasing) ? 'ai' : 'template',
    studyDay: session?.studyDay ?? studyToday(),
    extraPractice: Boolean(session?.extraPractice),
  });
  const testData = currentFamily().cards.find((one) => one.id === card.id)?.testData;
  commit({ attempts: [...attempts, testData ? { ...attempt, testData } : attempt], months: [monthOf(attempt)] });
}

/** The months these records are kept under. */
const monthsOf = (records: CardAttempt[]) => [...new Set(records.map(monthOf))];

export async function setLocalSessionLength(sessionLength: SessionLength) {
  commit({ practice: { ...current(), sessionLength } });
}

export async function setLocalRevealCards(revealCards: RevealSetting) {
  commit({ practice: { ...current(), revealCards } });
}

/** The dashboard's data. It is all on the phone, so nothing can fail to load. */
export function useLocalDashboard() {
  const view = useSyncExternalStore(subscribe, () => dashboard, () => null);
  return {
    family: view?.family ?? null,
    activity: view?.activity ?? null,
    since: view?.since ?? null,
    failed: false,
    reload: refreshLocal,
    insights: view?.insights,
  };
}

/**
 * Export my data with sign-in off: everything is on this phone, so this is the whole copy. Sessions are
 * kept here for about a month, and card records for ATTEMPTS_KEPT_DAYS.
 */
export async function localExportSource(): Promise<ExportRead<ExportSource>> {
  return settleRead(async () => {
    const practice = current();
    const kept = currentFamily();
    return {
      origin: { from: 'phone-only' },
      people: kept.people.map(shown),
      cards: kept.cards,
      sessionLength: practice.sessionLength ?? DEFAULT_SESSION_LENGTH,
      revealCards: practice.revealCards ?? DEFAULT_REVEAL_CARDS,
      ai: AI_AVAILABLE ? { on: practice.aiOn !== false, consented: Boolean(practice.aiConsentAt), sentences: kept.sentences ?? [] } : undefined,
      sessions: practice.sessions,
      records: attempts,
      schedule: Object.entries(practice.schedule).map(([cardId, entry]) => ({ cardId, step: entry.step, dueAt: entry.dueAt, updatedAt: entry.updatedAt })),
      notes: kept.notes ?? [],
    };
  });
}

/** The photos the caregiver picked on this phone, as a zip. Never the example deck's own photos. */
export function readLocalPhotos(onProgress: (progress: ExportProgress) => void, cancel: Cancel): Promise<ExportRead<{ zip: Uint8Array; count: number }>> {
  return settleRead(async () => {
    const kept = currentFamily();
    const people = kept.people.map(shown);
    const entries = photoEntries(people, kept.cards);
    const files = await collectPhotos(entries, (entry) => readBytes(entry.uri!), onProgress, cancel);
    return { zip: photoZip(entries, files, { people, cards: kept.cards }, new Date()), count: entries.length };
  });
}

// ---------------------------------------------------------------------------------------
// The family, as add a person and story approval change it. Same shapes as
// src/data/family-store.ts, so screens work either way.
// ---------------------------------------------------------------------------------------

export function useLocalFamily() {
  return useSyncExternalStore(subscribe, () => dashboard?.family ?? null, () => null);
}

/** Copies each draft's picked photo into the app's folder. */
async function keptDrafts(drafts: DraftFact[]): Promise<families.LocalDraft[]> {
  return Promise.all(
    drafts.map(async ({ photo, ...draft }) => ({
      ...draft,
      photoUri: photo ? await keepPhoto(photo.uri, draft.id ?? Crypto.randomUUID()) : photo,
    })),
  );
}

/** Deletes the memory photos a change left behind. */
function dropUnused(before: SavedCard[], after: SavedCard[]) {
  const kept = new Set(after.map((card) => card.photoUri));
  for (const card of before) if (card.photoUri && !kept.has(card.photoUri)) dropPhoto(card.photoUri);
}

export async function addLocalPerson({ id, name, relationship, facts, pickedPhoto }: NewPerson) {
  // A draft can save twice before the first save has come back.
  if (currentFamily().people.some((person) => person.id === id)) {
    await updateLocalPerson(id, { name, relationship, photo: pickedPhoto });
    return id;
  }
  const photoUri = pickedPhoto ? await keepPhoto(pickedPhoto.uri, id) : undefined;
  const drafts = await keptDrafts(facts);
  commit({ family: families.addPerson(currentFamily(), { id, name, relationship, photoUri }, drafts, () => Crypto.randomUUID()) });
  return id;
}

export async function updateLocalPerson(personId: string, { name, relationship, photo }: PersonChanges) {
  const before = currentFamily().people.find((person) => person.id === personId);
  if (!before) return;
  let next: families.LocalPerson = { ...before, name, relationship: relationship || undefined };
  if (photo !== undefined) {
    next = { ...next, photoUri: photo ? await keepPhoto(photo.uri, personId) : undefined, deckPhoto: false, samplePortrait: undefined };
    if (before.photoUri) dropPhoto(before.photoUri);
  }
  commit({ family: families.updatePerson(currentFamily(), next) });
}

export async function saveLocalFacts(personId: string, drafts: DraftFact[]) {
  const kept = await keptDrafts(drafts);
  const before = currentFamily();
  const next = families.saveFacts(before, personId, kept, () => Crypto.randomUUID());
  dropUnused(before.cards, next.cards);
  commit({ family: next });
}

export async function setLocalCardStatus(cardId: string, status: CardStatus) {
  commit({ family: families.setStatus(currentFamily(), cardId, status, new Date()) });
}

export async function editLocalCard(cardId: string, fact: Fact) {
  commit({ family: families.editCard(currentFamily(), cardId, fact) });
}

export async function setLocalPhrasingsOff(cardId: string, off: string[]) {
  commit({ family: families.setPhrasingsOff(currentFamily(), cardId, off) });
}

export async function setLocalProfile(personId: string, profile: families.ProfileChanges) {
  commit({ family: families.setProfile(currentFamily(), personId, profile) });
}

/** Includes a person whose profile is complete in the practice deck. */
export async function addLocalToPractice(personId: string) {
  commit({ family: families.addToDeck(currentFamily(), personId, about) });
}

export async function setLocalIncluded(personId: string, included: boolean) {
  commit({ family: families.setIncluded(currentFamily(), personId, included) });
}

export async function setLocalAiOk(personId: string, aiOk: boolean) {
  commit({ family: families.setAiOk(currentFamily(), personId, aiOk) });
}

export async function setLocalRevealOk(personId: string, revealOk: boolean) {
  commit({ family: families.setRevealOk(currentFamily(), personId, revealOk) });
}

/** Removes every test fact and mark, and with them each person's place in the deck if they drop below 100%. */
export async function clearLocalTestData() {
  // Demo insights are test data too: they go, and demo mode with them.
  const made = attempts.filter((attempt) => attempt.testData);
  commit({
    family: families.clearTestData(currentFamily()),
    practice: { ...current(), insightsDemo: false },
    attempts: attempts.filter((attempt) => !attempt.testData),
    months: monthsOf(made),
  });
}


export async function setLocalFactHints(personId: string, off: string[]) {
  commit({ family: families.setFactHints(currentFamily(), personId, off) });
}

export async function setLocalHints(personId: string, hints: Hints) {
  commit({ family: families.setHints(currentFamily(), personId, hints) });
}

/** Takes a person out of practice and off the People grid, keeping everything about them. */
export async function archiveLocalPerson(personId: string) {
  commit({ family: families.archivePerson(currentFamily(), personId, new Date()) });
}

/** Brings an archived person back as they were. After a day or more away, their overdue cards come back a few a day. */
export async function restoreLocalPerson(personId: string) {
  const before = currentFamily();
  const archivedAt = before.people.find((candidate) => candidate.id === personId)?.archivedAt;
  if (!archivedAt) return;
  const now = new Date();
  const state = current();
  const theirs = before.cards.filter((card) => card.personId === personId).map((card) => card.id);
  const moved = Object.entries(spreadOnReturn(state.schedule, theirs, archivedAt, now)).map(([id, entry]) => [id, { ...entry, updatedAt: now.toISOString() }]);
  commit({
    family: families.restorePerson(before, personId),
    practice: moved.length ? { ...state, schedule: { ...state.schedule, ...Object.fromEntries(moved) } } : undefined,
  });
}

/**
 * Deletes an archived person for good: their facts, a photo picked for them and their memory photos,
 * their approved sentences (settleSentences drops them), their schedule and what this phone kept of
 * their practice. The example deck's photos are never touched, and a deck person stays gone.
 */
export async function deleteLocalPerson(personId: string) {
  const before = currentFamily();
  const person = before.people.find((candidate) => candidate.id === personId);
  if (!person) return;
  if (!person.archivedAt) throw new Error('Only an archived person can be deleted.');
  if (person.photoUri) dropPhoto(person.photoUri);
  const next = families.removePerson(before, personId);
  dropUnused(before.cards, next.cards);
  const theirs = before.cards.filter((card) => card.personId === personId).map((card) => card.id);
  const records = attempts.filter((attempt) => attempt.personId === personId);
  commit({
    family: next,
    practice: forgetPerson(current(), person, theirs, next.people.map((other) => other.name)),
    attempts: attempts.filter((attempt) => attempt.personId !== personId),
    months: monthsOf(records),
  });
}

// ---------------------------------------------------------------------------------------
// AI questions. Generating is the one thing that leaves the phone with sign-in off, and only
// because the caregiver tapped it. See src/lib/ai-request.ts for what is sent.
// ---------------------------------------------------------------------------------------

export function setLocalAiOn(on: boolean) {
  commit({ practice: { ...current(), aiOn: on } });
}

/** The caregiver agreed, once, to facts being sent. */
export function agreeToLocalAi() {
  commit({ practice: { ...current(), aiConsentAt: new Date().toISOString() } });
}

/** The caregiver took the agreement back (Settings → Privacy and data): nothing is sent until they agree again. */
export function withdrawLocalAi() {
  commit({ practice: { ...current(), aiConsentAt: undefined } });
}

function aboutSentence(personId: string) {
  const now = currentFamily();
  return { person: now.people.find((one) => one.id === personId), cards: now.cards.filter((card) => card.personId === personId), sentences: now.sentences ?? [] };
}

export type GenerateResult = { added: number } | { error: AiFailure };

export async function generateLocalQuestions(personId: string): Promise<GenerateResult> {
  const { person, cards, sentences } = aboutSentence(personId);
  const settings = current();
  const allowed = AI_AVAILABLE && settings.aiOn !== false && settings.aiConsentAt && person && person.aiOk !== false && !HELD_BACK_FROM_AI.has(personId);
  if (!allowed || profileCompletion(about(person), cards) < 100) return { error: 'disabled' };

  const others = currentFamily().people.filter((one) => one.id !== personId).map((one) => one.name);
  const { body, restore } = buildRequest(person, sendableFacts(cards), others, queueRoom(sentences, personId));
  if (body.facts.length === 0) return { added: 0 };
  const reply = await fetchSentences(body);
  if ('error' in reply) return reply;

  // The family may have changed while this was out, so everything is judged against it as it is now.
  const latest = aboutSentence(personId);
  if (!latest.person) return { added: 0 };
  const accepted = acceptSentences(reply.sentences, body, restore, latest.person, latest.cards);
  const fixed = sendableFacts(latest.cards).flatMap((card) => phrasingsFor({ relationship: latest.person?.relationship, hasPhoto: true }, card).map((way) => way.ask.replace(BLANK, '____')));
  const next = addSentences(latest.sentences, accepted, latest.person, latest.cards, fixed, () => Crypto.randomUUID());
  commit({ family: { ...currentFamily(), sentences: next } });
  return { added: next.length - latest.sentences.length };
}

function changeSentence(id: string, change: (all: ReturnType<typeof aboutSentence>['sentences'], person: families.LocalPerson, cards: SavedCard[]) => { all: ReturnType<typeof aboutSentence>['sentences']; reason?: string }) {
  const sentence = currentFamily().sentences?.find((one) => one.id === id);
  const { person, cards, sentences } = aboutSentence(sentence?.personId ?? '');
  if (!person) return undefined;
  const { all, reason } = change(sentences, person, cards);
  if (!reason) commit({ family: { ...currentFamily(), sentences: all } });
  return reason;
}

/** Returns why not, if the sentence no longer passes. */
export function approveLocalSentence(id: string) {
  return changeSentence(id, (all, person, cards) => approveSentence(all, id, person, cards));
}

export function rejectLocalSentence(id: string) {
  changeSentence(id, (all) => ({ all: rejectSentence(all, id) }));
}

/** Returns why not, if the new words don't pass. */
export function editLocalSentence(id: string, text: string) {
  return changeSentence(id, (all, person, cards) => editSentence(all, id, text, person, cards));
}

/** Approve all for one person: what the plan names that is still eligible, in one change. Returns what Undo puts back. */
export async function approveAllLocal(personId: string, ids: { stories: string[]; questions: string[] }) {
  const now = currentFamily();
  const person = now.people.find((one) => one.id === personId);
  if (!person) return { approved: 0, undo: { cards: [], sentences: [] } as ApprovalUndo };
  const result = applyApproval({ cards: now.cards, sentences: now.sentences ?? [] }, person, ids, new Date());
  if (result.approved) commit({ family: { ...now, cards: result.cards, ...(now.sentences ? { sentences: result.sentences } : {}) } });
  return { approved: result.approved, undo: result.undo };
}

/** Undo for Approve all: each story and sentence back as it was, if nothing has changed it since. */
export async function undoApproveAllLocal(undo: ApprovalUndo) {
  const now = currentFamily();
  const back = undoApproval({ cards: now.cards, sentences: now.sentences ?? [] }, undo);
  commit({ family: { ...now, cards: back.cards, ...(now.sentences ? { sentences: back.sentences } : {}) } });
}

export function approveAllLocalSentences(personId: string) {
  const { person, cards, sentences } = aboutSentence(personId);
  if (person) commit({ family: { ...currentFamily(), sentences: approveAllValid(sentences, person, cards) } });
}
