import AsyncStorage from '@react-native-async-storage/async-storage';

import { AUTH_ENABLED } from '@/config/features';
import { currentProfile } from '@/data/account';
import { FROM_LETTERS, type NoteDraft } from '@/lib/family-notes';

// The last From name and relationship the caregiver saved on a note, so Add note can fill them in
// (docs/FAMILY-BOARD-TAB-PLAN.md). On this phone only, per caregiver login (`local` with sign-in off):
// never sent, and forgotten at sign-out (src/data/forget.ts). docs/DATA-INVENTORY.md names the key.

export type Author = Pick<NoteDraft, 'fromName' | 'fromRelationship'>;

const storageKey = (id: string) => `tandem.boardAuthor.v1.${id}`;
const whose = () => (AUTH_ENABLED ? currentProfile().id : 'local');

const clean = (text: unknown) => (typeof text === 'string' && text.trim() ? text.trim().slice(0, FROM_LETTERS) : undefined);

/** The author last saved, or nothing. A missing or unreadable copy is simply nothing. */
export async function lastAuthor(): Promise<Author> {
  try {
    const saved = JSON.parse((await AsyncStorage.getItem(storageKey(whose()))) ?? 'null');
    const fromName = clean(saved?.fromName);
    const fromRelationship = clean(saved?.fromRelationship);
    return { ...(fromName ? { fromName } : {}), ...(fromRelationship ? { fromRelationship } : {}) };
  } catch {
    return {};
  }
}

/** Keeps the author of a note just saved. An empty From and Relationship is kept too, as nothing. */
export async function rememberAuthor(author: Author) {
  const fromName = clean(author.fromName);
  const fromRelationship = clean(author.fromRelationship);
  await AsyncStorage.setItem(storageKey(whose()), JSON.stringify({ fromName, fromRelationship })).catch(() => undefined);
}

/** Every sign-out: this login's remembered author goes. */
export async function forgetAuthor(userId: string) {
  await AsyncStorage.removeItem(storageKey(userId)).catch(() => undefined);
}
