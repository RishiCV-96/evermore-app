import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { useSyncExternalStore } from 'react';

import { currentProfile } from '@/data/account';
import { BOARD_FULL, canAddNote, noteFromRow, noteProblem, tidyNote, type FamilyNote, type NoteDraft } from '@/lib/family-notes';
import { warnKind } from '@/lib/log';
import { supabase } from '@/lib/supabase';

// The Family board with sign-in on (docs/PERSON-HOME-PLAN.md): the family's notes in public.family_notes,
// for both roles. The caregiver writes; the person's login only reads (Row Level Security). A copy on
// the phone opens the board at once and offline, and a failed fetch (offline, or a server not yet
// upgraded) keeps the last notes and touches nothing else. Every sign-out deletes the copy (forget.ts).

export type Board = { notes: FamilyNote[] };

const storageKey = (id: string) => `tandem.board.v1.${id}`;
const COLUMNS = 'id, body, from_name, from_relationship, pinned, created_at, updated_at';

let board: Board | null = null;
let forId: string | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const id = currentProfile().id;
  if (forId !== id) {
    forId = id;
    board = null;
    void open(id);
  }
  return () => {
    listeners.delete(listener);
  };
}

/** The family's notes, as last seen: from the phone's copy first, then the server. Null until either answers. */
export function useBoard() {
  return useSyncExternalStore(subscribe, () => board, () => null);
}

function set(id: string, next: Board) {
  if (forId !== id) return;
  board = next;
  notify();
  AsyncStorage.setItem(storageKey(id), JSON.stringify(next)).catch((error) => warnKind('Could not keep the board', error));
}

async function open(id: string) {
  const saved = await AsyncStorage.getItem(storageKey(id)).catch(() => null);
  if (forId !== id) return;
  try {
    board = saved ? { notes: (JSON.parse(saved) as Board).notes ?? [] } : null;
  } catch {
    board = null;
  }
  notify();
  await refreshBoard();
}

/** Fetches the family's notes. Offline (or before the server is upgraded) the last notes stay. */
export async function refreshBoard() {
  const id = forId ?? currentProfile().id;
  forId = id;
  const { data, error } = await supabase.from('family_notes').select(COLUMNS).order('created_at');
  if (forId !== id) return;
  if (error) {
    warnKind('Could not load the board', error);
    if (!board) {
      board = { notes: [] };
      notify();
    }
    return;
  }
  set(id, { notes: (data ?? []).map(noteFromRow) });
}

// ---- The caregiver's changes. Each answers with calm words when it couldn't be done. ----

const OFFLINE = 'That note couldn’t be saved. Please check the internet connection.';
const OTHER = 'That note couldn’t be saved. Please try again.';

function caregiver() {
  const profile = currentProfile();
  if (profile.role !== 'caregiver') throw new Error('Only the caregiver writes notes.');
  return profile.id;
}

function problemOf(error: { code?: string; message?: string } | null) {
  if (!error) return undefined;
  warnKind('Could not save a note', error);
  if (error.code === '23514' || /at most 3/.test(error.message ?? '')) return BOARD_FULL;
  return /network|fetch/i.test(error.message ?? '') ? OFFLINE : OTHER;
}

const fromColumns = (draft: NoteDraft) => {
  const note = tidyNote(draft);
  return { body: note.body, from_name: note.fromName ?? null, from_relationship: note.fromRelationship ?? null };
};

/** Adds a note. The app refuses a fourth itself; the database refuses one too. */
export async function addNote(draft: NoteDraft): Promise<string | undefined> {
  const family = caregiver();
  if (board && !canAddNote(board.notes)) return BOARD_FULL;
  const problem = noteProblem(draft);
  if (problem) return problem;
  const { error } = await supabase.from('family_notes').insert({ id: Crypto.randomUUID(), caregiver_id: family, ...fromColumns(draft) });
  await refreshBoard();
  return problemOf(error);
}

export async function editNote(id: string, draft: NoteDraft): Promise<string | undefined> {
  caregiver();
  const problem = noteProblem(draft);
  if (problem) return problem;
  const { error } = await supabase.from('family_notes').update({ ...fromColumns(draft), updated_at: new Date().toISOString() }).eq('id', id);
  await refreshBoard();
  return problemOf(error);
}

export async function deleteNote(id: string): Promise<string | undefined> {
  caregiver();
  const { error } = await supabase.from('family_notes').delete().eq('id', id);
  await refreshBoard();
  return problemOf(error);
}

/** Pins one note on top (the one pinned before is unpinned first), or unpins with null. */
export async function pinNote(id: string | null): Promise<string | undefined> {
  const family = caregiver();
  const now = new Date().toISOString();
  const unpin = await supabase.from('family_notes').update({ pinned: false, updated_at: now }).eq('caregiver_id', family).eq('pinned', true);
  const pin = id && !unpin.error ? await supabase.from('family_notes').update({ pinned: true, updated_at: now }).eq('id', id) : { error: null };
  await refreshBoard();
  return problemOf(unpin.error ?? pin.error);
}

/** The notes this phone has now, for Export my data's phone copy: undefined if the board hasn't loaded. */
export const boardNotesNow = () => board?.notes;

/** Every sign-out: this login's copy goes, and the board in memory if it was theirs. */
export async function forgetBoard(userId: string) {
  await AsyncStorage.removeItem(storageKey(userId)).catch(() => undefined);
  if (forId === userId) {
    forId = null;
    board = null;
    notify();
  }
}
