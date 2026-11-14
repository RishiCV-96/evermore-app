// Stand-ins for the native modules src/data/family-store.ts reaches, for scripts/check-server-family.mjs.
import { randomUUID as uuid } from 'node:crypto';

// expo-crypto
export const randomUUID = () => uuid();

// src/lib/photo-files.ts
export async function readPhoto() {
  return new ArrayBuffer(0);
}

// src/lib/photo-urls.ts: every photo signs.
export async function signedUrls(paths) {
  return Object.fromEntries(paths.map((path) => [path, `https://signed.invalid/${path}`]));
}
