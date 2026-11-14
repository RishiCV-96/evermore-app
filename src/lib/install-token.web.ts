import * as Crypto from 'expo-crypto';

// The web build is only for checking screens, and has no secure storage.
const KEY = 'evermore.installToken.v1';

export async function installToken() {
  const saved = localStorage.getItem(KEY);
  if (saved) return saved;
  const token = [...Crypto.getRandomBytes(32)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  localStorage.setItem(KEY, token);
  return token;
}
