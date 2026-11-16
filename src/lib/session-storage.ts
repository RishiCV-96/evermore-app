import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// Where supabase-js keeps the sign-in session: the phone's secure storage (the iOS Keychain, or
// Android's Keystore-backed storage), never plain AsyncStorage. A session is a few kilobytes and some
// iOS releases refused secure values over about 2048 bytes, so it is stored in chunks well under that.
// It is readable once the phone has been unlocked after starting (so a session refresh can't find it
// missing while the app wakes behind a locked screen), and it never moves to another phone in a
// backup: a new phone signs in again. A session saved by an earlier release in AsyncStorage moves
// here the first time it is read. The session holds tokens, never a password.
//
// The web build, only for checking screens, keeps it in localStorage instead (session-storage.web.ts).

/** Bytes per secure value, comfortably under the 2048 some iOS releases allowed. */
export const CHUNK_BYTES = 1800;

const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

/** The value in pieces of at most `maxBytes` of UTF-8 each, never splitting a character. */
export function chunksOf(value: string, maxBytes = CHUNK_BYTES) {
  const chunks: string[] = [];
  let current = '';
  let bytes = 0;
  for (const character of value) {
    const size = utf8Bytes(character);
    if (bytes + size > maxBytes) {
      chunks.push(current);
      current = '';
      bytes = 0;
    }
    current += character;
    bytes += size;
  }
  if (current || chunks.length === 0) chunks.push(current);
  return chunks;
}

function utf8Bytes(character: string) {
  const code = character.codePointAt(0)!;
  return code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
}

const countKey = (key: string) => `${key}.n`;
const chunkKey = (key: string, index: number) => `${key}.${index}`;

// What this run of the app has read or written, so supabase-js's frequent reads don't each go to the
// Keychain, and a session still works for this run if the phone refuses to store it.
const memory = new Map<string, string | null>();
/** Keys whose last read failed (secure storage locked), as distinct from nothing being there. */
const unreadable = new Set<string>();

async function readSecure(key: string) {
  const count = Number(await SecureStore.getItemAsync(countKey(key), OPTIONS));
  if (!count) return null;
  const parts = await Promise.all(Array.from({ length: count }, (_, index) => SecureStore.getItemAsync(chunkKey(key, index), OPTIONS)));
  return parts.some((part) => part === null) ? null : parts.join('');
}

async function writeSecure(key: string, value: string) {
  const before = Number(await SecureStore.getItemAsync(countKey(key), OPTIONS)) || 0;
  const chunks = chunksOf(value);
  for (const [index, chunk] of chunks.entries()) await SecureStore.setItemAsync(chunkKey(key, index), chunk, OPTIONS);
  // The count last, so a half-written session is never read as whole.
  await SecureStore.setItemAsync(countKey(key), String(chunks.length), OPTIONS);
  for (let index = chunks.length; index < before; index++) await SecureStore.deleteItemAsync(chunkKey(key, index), OPTIONS);
}

async function removeSecure(key: string) {
  const before = Number(await SecureStore.getItemAsync(countKey(key), OPTIONS)) || 0;
  await SecureStore.deleteItemAsync(countKey(key), OPTIONS);
  for (let index = 0; index < before; index++) await SecureStore.deleteItemAsync(chunkKey(key, index), OPTIONS);
}

/** The storage supabase-js is given. */
export const sessionStorage = {
  async getItem(key: string): Promise<string | null> {
    if (memory.has(key)) return memory.get(key)!;
    let value: string | null;
    try {
      value = await readSecure(key);
      unreadable.delete(key);
    } catch {
      // Secure storage couldn't be read just now: say nothing is there, and remember nothing, so the
      // next read tries again rather than treating the phone as signed out.
      unreadable.add(key);
      return null;
    }
    if (value === null) {
      // Saved by an earlier release in AsyncStorage: move it into secure storage.
      const legacy = await AsyncStorage.getItem(key).catch(() => null);
      if (legacy !== null) {
        value = legacy;
        await writeSecure(key, legacy).catch(() => console.warn('The sign-in couldn’t be moved to secure storage'));
        await AsyncStorage.removeItem(key).catch(() => undefined);
      }
    }
    memory.set(key, value);
    return value;
  },
  async setItem(key: string, value: string) {
    memory.set(key, value);
    // Never the value in a message: it holds the session's tokens.
    await writeSecure(key, value).catch(() => console.warn('The sign-in couldn’t be saved in secure storage, so it lasts until the app closes'));
  },
  async removeItem(key: string) {
    memory.set(key, null);
    await removeSecure(key).catch(() => console.warn('The sign-in couldn’t be removed from secure storage'));
    await AsyncStorage.removeItem(key).catch(() => undefined);
  },
};

/**
 * The user whose session is kept on this phone, though supabase-js may not be able to use it right
 * now (offline): null when there is none, undefined when secure storage couldn't be read to tell.
 */
export async function storedSessionUser(key: string): Promise<string | null | undefined> {
  const saved = await sessionStorage.getItem(key);
  if (!saved) return unreadable.has(key) ? undefined : null;
  try {
    const session = JSON.parse(saved);
    return typeof session?.user?.id === 'string' && typeof session.refresh_token === 'string' ? session.user.id : null;
  } catch {
    return null;
  }
}

// A login and credential an earlier release kept here for a phone set up with the caregiver's email,
// a way in that no longer exists (docs/PIN-REMOVAL-PLAN.md, the one allowed mention). Nothing reads it now: it is only deleted
// when the phone signs out, so such a phone keeps no credential once signed out.
const OLDER_CREDENTIAL_KEY = 'evermore.device.v1';

export async function forgetOlderCredential() {
  await SecureStore.deleteItemAsync(OLDER_CREDENTIAL_KEY, OPTIONS).catch(() => console.warn('An older credential couldn’t be removed from secure storage'));
}
