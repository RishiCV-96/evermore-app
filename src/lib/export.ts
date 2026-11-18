import { strToU8, zipSync, type Zippable } from 'fflate';

import { APP_NAME, APP_NAME_LOWER } from '@/config/brand';
import type { RevealSetting, SessionLength } from '@/config/schedule';
import { ATTEMPTS_KEPT_DAYS } from '@/config/insights';
import { questionFor } from '@/data/questionnaire';
import { orderNotes, type FamilyNote } from '@/lib/family-notes';
import { sessionDay } from '@/lib/activity';
import type { AiSentence } from '@/lib/ai-sentences';
import { recordDay } from '@/lib/insights';
import { problemOf, type LoadProblem } from '@/lib/load-problem';
import { warnKind } from '@/lib/log';
import type { CardAttempt } from '@/lib/attempts';
import type { SavedCard } from '@/lib/facts';
import { BLANK, sentenceFor, type Hints } from '@/lib/stories';

// "Export my data": the caregiver's own family, complete, as a file to keep: a safety net after an
// accidental loss. Pure, so scripts/check-logic.mjs and scripts/check-export.mjs can check exactly
// what it holds. Made only on the caregiver's request (Settings → Privacy and data), only from the
// caregiver's own login (src/data/export-store.ts), and never read back by the app: restoring from
// it is a manual job for the developer.
//
// It holds: every person (drafts and archived people too) with every profile answer, every story
// with its approval, AI sentences with the facts they came from, the settings, every practice
// session, every card record kept (study day, extra practice, how each answer was found and the
// hints shown), and the schedule.
// Never: photos (a separate, optional export), logins, user ids of logins, emails, passwords,
// tokens or other secrets, made-up test data, or the demo.

/** The file's format. 1 was the first export (the last 30 days of practice only). */
export const EXPORT_FORMAT = 2;

export type ExportPerson = {
  id: string;
  name: string;
  relationship?: string;
  hints: Hints;
  profileStep?: number;
  bestClue?: string;
  notApplicable: string[];
  /** Marks that are test data (sign-in off only): never exported. */
  testMarks?: string[];
  inDeck?: boolean;
  includeInPractice: boolean;
  revealOk: boolean;
  aiOk?: boolean;
  archivedAt?: string;
  createdAt?: string;
  // Only whether there is a photo is exported, never where it is.
  photoPath?: string;
  photoUri?: string;
  samplePortrait?: string;
  bundledPhoto?: unknown;
};

export type ExportCard = SavedCard & { createdAt?: string; updatedAt?: string };

export type ExportSession = {
  id?: string;
  startedAt: string;
  completedAt: string | null;
  cardsCompleted: number;
  dailyGoal: number;
  studyDay?: string | null;
  extraPractice?: boolean;
};

export type ExportSchedule = { cardId: string; step: number; dueAt: string; updatedAt?: string };

/** Where the data came from, and whether every section was read in full. */
export type ExportOrigin =
  /** Read from the account on the server, every section in full. */
  | { from: 'server' }
  /** Sign-in off: everything lives on this phone, so this phone's copy is all there is. */
  | { from: 'phone-only' }
  /** Sign-in on but offline: this phone's copy, which may be missing newer data from the server. */
  | { from: 'phone-copy'; missing: ExportSection[] };

export type ExportSource = {
  origin: ExportOrigin;
  people: ExportPerson[];
  cards: ExportCard[];
  sessionLength: SessionLength;
  revealCards: RevealSetting;
  /** With sign-in off only. */
  ai?: { on: boolean; consented: boolean; sentences: AiSentence[] };
  sessions: ExportSession[];
  records: CardAttempt[];
  schedule: ExportSchedule[];
  /** The Family board's notes (docs/PERSON-HOME-PLAN.md). Left out where the source has none to give (a server not yet upgraded). */
  notes?: FamilyNote[];
};

export type ExportSection = 'people' | 'aiSentences' | 'settings' | 'sessions' | 'cardRecords' | 'schedule' | 'familyBoard';

/** What each section holds, in plain words, at the top of the file. */
export const SECTION_WORDS: Record<ExportSection, string> = {
  settings: 'Practice settings for the family: session length and how often reveal cards appear.',
  people:
    'Every person, archived people and unfinished profiles too: their name, relationship, which hints practice may give, which questions were marked "Not applicable", whether they are in practice, and every answer you gave about them. Each answer is a fact, with the story practice shows, whether you approved it, skipped it or it is still waiting, and its dates.',
  aiSentences: 'AI sentences (only when they were turned on, with sign-in off): each sentence, whether you approved, rejected or edited it, or it is waiting, and the facts it came from.',
  sessions: 'Every practice session: the study day it counts toward, when it started and ended, how many of the day’s cards were finished, and the day’s target.',
  cardRecords: `Each card practiced, kept for ${ATTEMPTS_KEPT_DAYS} days: the study day, whether it was extra practice, who was in the photo, the fact and how it was asked, each answer chosen and when, the hints shown, each time the person asked for help with “I’m not sure” and the hint it reached (asking for help is not an answer), and time on screen. Practice activity, not a medical measure.`,
  schedule: 'When each fact comes back in practice, and its step.',
  familyBoard: 'The Family board: the short notes you wrote for the person’s home screen, who each is from, whether it is pinned (shownFirst), and when it was written and last changed.',
};

const ORIGIN_WORDS: Record<ExportOrigin['from'], string> = {
  server: 'Read in full from your account on the server.',
  'phone-only': 'Read from this phone, where everything is kept (sign-in is off). Sessions are kept on this phone for about a month.',
  'phone-copy':
    'Made from this phone’s copy while the server couldn’t be reached. It may be missing newer data from the server. Make it again once you are online for a complete copy.',
};

export const PRIVACY_WORDS =
  'This file holds personal information: names, stories about your family and how practice went. It was made only because you asked. Keep it somewhere safe and share it carefully.';

export const RESTORE_WORDS = `${APP_NAME} can’t read this file back. Restoring from it is done by hand by the app’s developer, not in the app.`;

/** The file's name, after the app (src/config/brand.ts): tandem-data-2026-11-12.json, tandem-report-2026-11-12.pdf, tandem-photos-2026-11-12.zip. */
export const exportFileName = (kind: 'data' | 'report' | 'photos', now: Date) =>
  `${APP_NAME_LOWER}-${kind}-${now.toISOString().slice(0, 10)}.${kind === 'data' ? 'json' : kind === 'report' ? 'pdf' : 'zip'}`;

/** The cards and records that are real: never test data, the demo, or a test fact's records. */
export function realOnly(source: Pick<ExportSource, 'cards' | 'records'>) {
  const cards = source.cards.filter((card) => !card.testData);
  const test = new Set(source.cards.filter((card) => card.testData).map((card) => card.id));
  const records = source.records.filter((record) => !record.testData && !record.demo && !test.has(record.cardId));
  return { cards, records };
}

/** A story as the caregiver approved it, with the name filled in. */
const storyOf = (person: ExportPerson, card: SavedCard) => sentenceFor(person, card).split(BLANK).join(person.name);

const statusWords = { approved: 'approved', pending: 'waiting for approval', skipped: 'skipped' } as const;

function personStatus(person: ExportPerson) {
  if (person.archivedAt) return 'archived';
  if (person.includeInPractice === false) return 'not in practice';
  if (person.inDeck === false) return 'draft';
  return 'in practice';
}

/** The copy, ready to write. Keys appear in the file in this order. */
export function familyExport(source: ExportSource, now: Date, appVersion: string) {
  const { cards, records } = realOnly(source);
  const people = [...source.people].sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));
  const personIds = new Set(people.map((person) => person.id));
  const cardIds = new Set(cards.map((card) => card.id));
  const sections: ExportSection[] = ['settings', 'people', ...(source.ai ? (['aiSentences'] as const) : []), 'sessions', 'cardRecords', 'schedule', ...(source.notes ? (['familyBoard'] as const) : [])];
  const missing = source.origin.from === 'phone-copy' ? source.origin.missing : [];
  return {
    about: {
      app: APP_NAME,
      format: EXPORT_FORMAT,
      exportedAt: now.toISOString(),
      appVersion,
      madeFrom: ORIGIN_WORDS[source.origin.from],
      complete: source.origin.from !== 'phone-copy',
      ...(missing.length ? { notIncluded: missing.map((section) => SECTION_WORDS[section]) } : {}),
      privacy: PRIVACY_WORDS,
      restoring: RESTORE_WORDS,
      notIncludedEver: 'Photos (a separate, optional export), logins, emails, passwords, secrets, and made-up test data.',
      studyDays: 'Days are study days: each runs from 5:30 in the morning to 5:29 the next morning, on the phone that practiced, and is named by the date it began.',
      sections: Object.fromEntries(sections.map((section) => [section, SECTION_WORDS[section]])),
      counts: {
        people: people.length,
        archivedPeople: people.filter((person) => person.archivedAt).length,
        facts: cards.filter((card) => personIds.has(card.personId)).length,
        sessions: source.sessions.length,
        cardRecords: records.length,
        ...(source.notes ? { familyBoardNotes: source.notes.length } : {}),
      },
    },
    settings: {
      sessionLength: source.sessionLength,
      revealCards: source.revealCards,
      ...(source.ai ? { aiQuestions: { on: source.ai.on, agreed: source.ai.consented } } : {}),
    },
    people: people.map((person) => ({
      id: person.id,
      name: person.name,
      ...(person.relationship ? { relationship: person.relationship } : {}),
      status: personStatus(person),
      ...(person.archivedAt ? { archivedAt: person.archivedAt } : {}),
      ...(person.createdAt ? { addedAt: person.createdAt } : {}),
      hasPhoto: Boolean(person.photoPath || person.photoUri || person.samplePortrait || person.bundledPhoto),
      includeInPractice: person.includeInPractice !== false,
      revealCards: person.revealOk !== false,
      ...(person.aiOk === false ? { aiQuestions: false } : {}),
      hints: person.hints,
      ...(person.profileStep !== undefined ? { profileStep: person.profileStep + 1 } : {}),
      ...(person.bestClue ? { bestClue: person.bestClue } : {}),
      notApplicable: (person.notApplicable ?? []).filter((id) => !person.testMarks?.includes(id)),
      facts: cards
        .filter((card) => card.personId === person.id)
        .map((card) => ({
          id: card.id,
          kind: card.type,
          question: questionFor(card.type)?.label,
          words: card.text,
          story: storyOf(person, card),
          status: statusWords[card.status] ?? card.status,
          ...(card.timeSensitive ? { mayChange: true, asOf: card.asOf ?? null, confirmedAt: card.confirmedAt ?? null } : {}),
          ...(card.year ? { year: card.year } : {}),
          ...(card.hintOk === false ? { usedAsHint: false } : {}),
          ...(card.phrasingsOff?.length ? { phrasingsOff: card.phrasingsOff } : {}),
          ...(card.photoPath || card.photoUri ? { hasPhoto: true } : {}),
          ...(card.source && card.source !== 'caregiver' ? { source: card.source } : {}),
          ...(card.createdAt ? { addedAt: card.createdAt } : {}),
          ...(card.updatedAt ? { changedAt: card.updatedAt } : {}),
        })),
    })),
    ...(source.ai
      ? {
          aiSentences: source.ai.sentences
            .filter((sentence) => personIds.has(sentence.personId))
            .map((sentence) => ({
              id: sentence.id,
              personId: sentence.personId,
              shape: sentence.shape,
              text: sentence.text,
              status: sentence.status,
              ...(sentence.edited ? { edited: true } : {}),
              ...(sentence.answer ? { answer: sentence.answer } : {}),
              ...(sentence.relationship ? { relationship: sentence.relationship } : {}),
              fromFacts: sentence.facts.map((fact) => ({ id: fact.id, kind: fact.type, words: fact.text })),
            })),
        }
      : {}),
    sessions: [...source.sessions]
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
      .map((session) => ({
        ...(session.id ? { id: session.id } : {}),
        studyDay: sessionDay(session),
        startedAt: session.startedAt,
        completedAt: session.completedAt,
        cardsCompleted: session.cardsCompleted,
        dailyGoal: session.dailyGoal,
        ...(session.extraPractice ? { extraPractice: true } : {}),
      })),
    cardRecords: [...records]
      .sort((a, b) => a.shownAt.localeCompare(b.shownAt) || a.id.localeCompare(b.id))
      .map((record) => ({
        id: record.id,
        studyDay: recordDay(record),
        extraPractice: Boolean(record.extraPractice),
        sessionId: record.sessionId,
        personId: record.personId,
        cardId: record.cardId,
        ...(cardIds.has(record.cardId) ? {} : { factRemoved: true }),
        ...(record.factType ? { kind: record.factType } : {}),
        askedAs: record.phrasingId,
        shape: record.shape,
        source: record.source,
        shownAt: record.shownAt,
        choicesOffered: record.choices,
        answersChosen: record.selections.map((selection) => ({ at: selection.at, right: selection.right })),
        hintsShown: record.hints,
        askedForHelp: (record.help ?? []).map((request) => ({ at: request.at, hintReached: request.step })),
        endedOnTheAnswer: record.success,
        askedAgainAfterHint: Boolean(record.extra),
        activeMs: record.activeMs,
        ...(record.firstSelectionMs !== undefined ? { firstChoiceMs: record.firstSelectionMs } : {}),
        dailyGoal: record.goal,
      })),
    schedule: source.schedule
      .filter((entry) => cardIds.has(entry.cardId))
      .sort((a, b) => a.cardId.localeCompare(b.cardId))
      .map((entry) => ({ cardId: entry.cardId, step: entry.step, dueAt: entry.dueAt, ...(entry.updatedAt ? { updatedAt: entry.updatedAt } : {}) })),
    ...(source.notes
      ? {
          familyBoard: orderNotes(source.notes).map((note) => ({
            words: note.body,
            ...(note.fromName ? { from: note.fromName } : {}),
            ...(note.fromRelationship ? { relationship: note.fromRelationship } : {}),
            shownFirst: note.pinned,
            writtenAt: note.createdAt,
            changedAt: note.updatedAt,
          })),
        }
      : {}),
  };
}

export type FamilyExport = ReturnType<typeof familyExport>;

/** Lists of many small rows: one row a line, so a long history stays readable and small. */
const ONE_A_LINE = new Set(['sessions', 'cardRecords', 'schedule']);

/** The file's text: indented JSON, with sessions, card records and the schedule one to a line. */
export function exportText(copy: FamilyExport) {
  const lines = ['{'];
  const entries = Object.entries(copy);
  entries.forEach(([key, value], index) => {
    const comma = index < entries.length - 1 ? ',' : '';
    if (ONE_A_LINE.has(key) && Array.isArray(value)) {
      if (value.length === 0) lines.push(`  ${JSON.stringify(key)}: []${comma}`);
      else lines.push(`  ${JSON.stringify(key)}: [`, value.map((row) => `    ${JSON.stringify(row)}`).join(',\n'), `  ]${comma}`);
    } else {
      lines.push(`  ${JSON.stringify(key)}: ${JSON.stringify(value, null, 2).replace(/\n/g, '\n  ')}${comma}`);
    }
  });
  lines.push('}');
  return `${lines.join('\n')}\n`;
}

// ---------------------------------------------------------------------------------------
// Photos: a separate, optional export
// ---------------------------------------------------------------------------------------

/** One photo in the zip: its name there, and where it is kept (a path in the private bucket, or a file on the phone). */
export type PhotoEntry = { file: string; personId: string; cardId?: string; path?: string; uri?: string };

/** A name safe for a file on any system: letters, digits, spaces, dots, dashes and apostrophes. */
export const safeFileName = (text: string) =>
  text
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N} .'’-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60) || 'Photo';

/**
 * The photos the caregiver added, as stored (already no bigger than 1280 px): each person's photo and
 * each memory's. Never the bundled example deck's photos or a sample person's illustration, and
 * never a photo outside this family's own folder.
 */
export function photoEntries(people: ExportPerson[], cards: ExportCard[], familyFolder?: string): PhotoEntry[] {
  const taken = new Set<string>();
  const nameOnce = (base: string, extension: string) => {
    let file = `${base}.${extension}`;
    for (let n = 2; taken.has(file.toLowerCase()); n++) file = `${base} ${n}.${extension}`;
    taken.add(file.toLowerCase());
    return file;
  };
  const extensionOf = (where: string) => where.split('?')[0].match(/\.(jpe?g|png|heic|webp)$/i)?.[1]?.toLowerCase().replace('jpeg', 'jpg') ?? 'jpg';
  const allowed = (path?: string) => !path || !familyFolder || path.startsWith(`${familyFolder}/`);
  const entries: PhotoEntry[] = [];
  const real = cards.filter((card) => !card.testData);
  for (const person of people) {
    const where = person.photoPath ?? person.photoUri;
    if (where && allowed(person.photoPath)) entries.push({ file: nameOnce(safeFileName(person.name), extensionOf(where)), personId: person.id, path: person.photoPath, uri: person.photoUri });
    real
      .filter((card) => card.personId === person.id && (card.photoPath || card.photoUri) && allowed(card.photoPath))
      .forEach((card, index) => {
        const at = (card.photoPath ?? card.photoUri)!;
        entries.push({ file: nameOnce(`${safeFileName(person.name)} - memory ${index + 1}`, extensionOf(at)), personId: person.id, cardId: card.id, path: card.photoPath, uri: card.photoUri });
      });
  }
  return entries;
}

/** The index in the zip: which photo is whose, so the developer can put each one back. */
export function photoIndex(entries: PhotoEntry[], people: ExportPerson[], cards: ExportCard[], now: Date) {
  const names = new Map(people.map((person) => [person.id, person.name]));
  const words = new Map(cards.map((card) => [card.id, card.text]));
  return {
    about: {
      app: APP_NAME,
      format: EXPORT_FORMAT,
      exportedAt: now.toISOString(),
      privacy: 'These are photos of your family. Share them only with people you trust.',
      restoring: RESTORE_WORDS,
    },
    photos: entries.map((entry) => ({
      file: `photos/${entry.file}`,
      personId: entry.personId,
      person: names.get(entry.personId),
      ...(entry.cardId ? { factId: entry.cardId, memory: words.get(entry.cardId) } : {}),
    })),
  };
}

/** Downloads (or reads) each photo's bytes, one at a time, with progress. Any that can't be read fails the whole zip. */
export async function collectPhotos(entries: PhotoEntry[], read: (entry: PhotoEntry) => Promise<Uint8Array>, onProgress: (progress: ExportProgress) => void, cancel: Cancel) {
  const files: Record<string, Uint8Array> = {};
  onProgress({ step: 'photos', done: 0, total: entries.length });
  for (const [index, entry] of entries.entries()) {
    if (cancel.cancelled) throw new Cancelled();
    files[entry.file] = await read(entry);
    onProgress({ step: 'photos', done: index + 1, total: entries.length });
  }
  return files;
}

/** The zip: the photos as stored (no recompression), and an index of whose each one is. */
export function photoZip(entries: PhotoEntry[], files: Record<string, Uint8Array>, source: Pick<ExportSource, 'people' | 'cards'>, now: Date) {
  const zippable: Zippable = {
    'photos.json': strToU8(JSON.stringify(photoIndex(entries, source.people, source.cards, now), null, 2)),
    photos: Object.fromEntries(entries.map((entry) => [entry.file, [files[entry.file], { level: 0 }]])),
  };
  return zipSync(zippable);
}

// ---------------------------------------------------------------------------------------
// Reading for an export: progress, cancel, and calm failure
// ---------------------------------------------------------------------------------------

export type ExportStep = 'family' | 'sessions' | 'records' | 'schedule' | 'photos';
export type ExportProgress = { step: ExportStep; done: number; total?: number };
/** Set `cancelled` to stop at the next page; the read then ends with nothing. */
export type Cancel = { cancelled: boolean };
/** Why an export couldn't be made: the connection, the sign-in, the server, or a login that isn't the caregiver's. */
export type ExportProblem = LoadProblem | 'caregivers-only';
export type ExportRead<T> = { ok: true; value: T } | { ok: false; problem: ExportProblem } | { ok: false; cancelled: true };

/** Thrown to stop a read the caregiver cancelled. */
export class Cancelled extends Error {}

/** Runs a read: its value, cancelled, or why it failed. Never a partial value. Logs only the kind of failure. */
export const settleRead = <T>(run: () => Promise<T>) =>
  run().then(
    (value): ExportRead<T> => ({ ok: true, value }),
    (error): ExportRead<T> => {
      if (error instanceof Cancelled) return { ok: false, cancelled: true };
      warnKind('Could not read the export', error);
      return { ok: false, problem: problemOf(error) };
    },
  );

/** What the caregiver is told when an export couldn't be made. Calm, and nothing about the server's insides. */
export const EXPORT_PROBLEM: Record<ExportProblem, string> = {
  offline: 'Your account couldn’t be reached, so nothing was saved. Please check the internet connection and try again.',
  'signed-out': 'Your sign-in needs renewing, so nothing was saved. Please sign out in Settings, then sign in again.',
  'server-update': `This can’t be made until ${APP_NAME}’s server is updated, so nothing was saved. Please try again later.`,
  server: 'Part of your data couldn’t be read just now, so nothing was saved. Please try again in a moment.',
  'caregivers-only': 'Only the caregiver’s account can export the family’s data.',
};
