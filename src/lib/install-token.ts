import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

// A random token for this install, made the first time AI is used and kept in the phone's secure
// storage. It isn't an account and says nothing about anyone: the server only ever keeps a hash
// of it, to count requests.
const KEY = 'evermore.installToken.v1';

export async function installToken() {
  const saved = await SecureStore.getItemAsync(KEY);
  if (saved) return saved;
  const token = [...Crypto.getRandomBytes(32)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  await SecureStore.setItemAsync(KEY, token);
  return token;
}
