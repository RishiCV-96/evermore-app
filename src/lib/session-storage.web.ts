// The web build is only for checking screens, and has no secure storage: the session is kept in
// localStorage under supabase-js's own key (sb-<project>-auth-token), as supabase-js does in a
// browser. Phones use session-storage.ts, the iOS Keychain or Android's Keystore.

export const CHUNK_BYTES = 1800;

export function chunksOf(value: string) {
  return [value];
}

export const sessionStorage = {
  async getItem(key: string): Promise<string | null> {
    return globalThis.localStorage?.getItem(key) ?? null;
  },
  async setItem(key: string, value: string) {
    globalThis.localStorage?.setItem(key, value);
  },
  async removeItem(key: string) {
    globalThis.localStorage?.removeItem(key);
  },
};

export async function storedSessionUser(key: string): Promise<string | null | undefined> {
  const saved = await sessionStorage.getItem(key);
  if (!saved) return null;
  try {
    const session = JSON.parse(saved);
    return typeof session?.user?.id === 'string' && typeof session.refresh_token === 'string' ? session.user.id : null;
  } catch {
    return null;
  }
}

// An earlier release's credential, in localStorage for the test build only (session-storage.ts on phones).
const OLDER_CREDENTIAL_KEY = 'evermore.device.v1';

export async function forgetOlderCredential() {
  globalThis.localStorage?.removeItem(OLDER_CREDENTIAL_KEY);
}
