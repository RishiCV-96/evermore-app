// expo-secure-store on a phone, in memory, for scripts/check-auth.mjs. Like some iOS releases, it
// refuses a value over 2048 bytes, so a session has to be stored in chunks. It can also be "locked"
// (unreadable, as before the first unlock after a restart).
export const AFTER_FIRST_UNLOCK = 'AFTER_FIRST_UNLOCK';
export const AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY = 'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY';
export const WHEN_UNLOCKED = 'WHEN_UNLOCKED';
export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 'WHEN_UNLOCKED_THIS_DEVICE_ONLY';

/** What is stored, by key: { value, options }. Outlives a relaunch, as the Keychain does. */
export const vault = new Map();
export const secure = { locked: false, limit: 2048 };

const KEY = /^[\w.-]+$/;

export async function getItemAsync(key) {
  if (!KEY.test(key)) throw new Error(`Invalid key: ${key}`);
  if (secure.locked) throw new Error('User interaction is not allowed.');
  return vault.get(key)?.value ?? null;
}

export async function setItemAsync(key, value, options = {}) {
  if (!KEY.test(key)) throw new Error(`Invalid key: ${key}`);
  if (typeof value !== 'string') throw new Error('Values must be strings');
  if (Buffer.byteLength(value) > secure.limit) throw new Error(`Value is ${Buffer.byteLength(value)} bytes, over ${secure.limit}`);
  vault.set(key, { value, options });
}

export async function deleteItemAsync(key) {
  vault.delete(key);
}
