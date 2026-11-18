// The Family board's rules (docs/PERSON-HOME-PLAN.md): a few short notes the caregiver writes for the
// person's home screen. Pure, so both stores (src/data/board-store.ts with sign-in on, the phone's family
// with sign-in off) follow the same rules, and scripts/check-board.mjs checks them. supabase/schema.sql
// repeats the limits in the database.

/** At most this many notes per family, pinned one included. */
export const NOTES_MOST = 3;
/** A note's words, at most. */
export const NOTE_LETTERS = 200;
/** The From name and relationship, at most each. */
export const FROM_LETTERS = 40;

export type FamilyNote = {
  id: string;
  body: string;
  /** Who it is from, as the caregiver typed it ("Mikayla"). Optional. */
  fromName?: string;
  /** Their relationship to the person ("Daughter"). Optional. */
  fromRelationship?: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
};

/** What the caregiver types in the form. */
export type NoteDraft = { body: string; fromName?: string; fromRelationship?: string };

const tidy = (text: string | undefined) => (text ?? '').replace(/\s+/g, ' ').trim();

/** A draft as it is saved: one space between words, empty From parts left out. */
export function tidyNote(draft: NoteDraft): NoteDraft {
  const fromName = tidy(draft.fromName);
  const fromRelationship = tidy(draft.fromRelationship);
  return { body: draft.body.trim().replace(/[ \t]+/g, ' '), ...(fromName ? { fromName } : {}), ...(fromRelationship ? { fromRelationship } : {}) };
}

/** Calm words for what's wrong with a draft, or undefined when it can be saved. */
export function noteProblem(draft: NoteDraft): string | undefined {
  const note = tidyNote(draft);
  if (!note.body) return 'Write a few words first.';
  if (note.body.length > NOTE_LETTERS) return `A little shorter, please: ${NOTE_LETTERS} letters at most.`;
  if ((note.fromName?.length ?? 0) > FROM_LETTERS || (note.fromRelationship?.length ?? 0) > FROM_LETTERS) return `From and Relationship are ${FROM_LETTERS} letters at most.`;
  return undefined;
}

/** Whether another note fits on the board. */
export const canAddNote = (notes: FamilyNote[]) => notes.length < NOTES_MOST;

/** The words the editor shows when the board is full. */
export const BOARD_FULL = `${NOTES_MOST} of ${NOTES_MOST} notes. Delete one to add another.`;

/** The pinned note first, then the newest first. Editing a note doesn't move it. */
export function orderNotes(notes: FamilyNote[]) {
  return [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt));
}

/** Two letters for the avatar: the first letters of the first two words ("Mary Kate" → "MK"), or a single word's first two ("Lucy" → "LU"). */
export function initialsOf(name: string | undefined) {
  const words = tidy(name).split(' ').filter(Boolean);
  if (words.length === 0) return '';
  const letters = words.length > 1 ? `${words[0][0]}${words[1][0]}` : words[0].slice(0, 2);
  return letters.toUpperCase();
}

/** "Mikayla · Daughter", "Mikayla", "Daughter", or nothing. */
export function fromLine(note: Pick<FamilyNote, 'fromName' | 'fromRelationship'>) {
  return [note.fromName, note.fromRelationship].filter(Boolean).join(' · ');
}

/** What Read aloud says: the note, then who it is from. */
export function spokenNote(note: Pick<FamilyNote, 'body' | 'fromName' | 'fromRelationship'>) {
  const from = [note.fromName, note.fromRelationship?.toLowerCase()].filter(Boolean).join(', ');
  const body = /[.!?]$/.test(note.body.trim()) ? note.body.trim() : `${note.body.trim()}.`;
  return from ? `${body} From ${from}.` : body;
}

// ---- The changes, as pure steps (the phone's family uses them; the server repeats the rules) ----

/** A new note, or the reason it can't be added. */
export function addNote(notes: FamilyNote[], draft: NoteDraft, id: string, now: Date): { notes: FamilyNote[]; problem?: string } {
  if (!canAddNote(notes)) return { notes, problem: BOARD_FULL };
  const problem = noteProblem(draft);
  if (problem) return { notes, problem };
  const at = now.toISOString();
  return { notes: [...notes, { id, ...tidyNote(draft), pinned: false, createdAt: at, updatedAt: at }] };
}

export function editNote(notes: FamilyNote[], id: string, draft: NoteDraft, now: Date): { notes: FamilyNote[]; problem?: string } {
  const problem = noteProblem(draft);
  if (problem) return { notes, problem };
  const { body, fromName, fromRelationship } = tidyNote(draft);
  return { notes: notes.map((note) => (note.id === id ? { ...note, body, fromName, fromRelationship, updatedAt: now.toISOString() } : note)) };
}

export const deleteNote = (notes: FamilyNote[], id: string) => notes.filter((note) => note.id !== id);

/** Pins one note (the one pinned before is unpinned), or unpins with null. */
export function pinNote(notes: FamilyNote[], id: string | null, now: Date) {
  const at = now.toISOString();
  return notes.map((note) => {
    const pinned = note.id === id;
    return note.pinned === pinned ? note : { ...note, pinned, updatedAt: at };
  });
}

/** A row of public.family_notes as the app keeps it. */
export function noteFromRow(row: { id: string; body: string; from_name: string | null; from_relationship: string | null; pinned: boolean; created_at: string; updated_at: string }): FamilyNote {
  return {
    id: row.id,
    body: row.body,
    ...(row.from_name ? { fromName: row.from_name } : {}),
    ...(row.from_relationship ? { fromRelationship: row.from_relationship } : {}),
    pinned: row.pinned,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
