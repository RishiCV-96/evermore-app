import { supabase } from '@/lib/supabase';
import { warnKind } from '@/lib/log';

// Photos live in a private bucket and are shown through short-lived signed URLs. Images are
// cached on the phone by their path (expo-image cacheKey), so a new URL for the same photo
// doesn't download it again, and a cached photo still shows offline.

/** Signed URLs last this long; screens reload well within it. */
export const SIGNED_URL_SECONDS = 60 * 60;

/** Signed URLs for private photos, by path. Missing ones are left out. */
export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await supabase.storage.from('photos').createSignedUrls(paths, SIGNED_URL_SECONDS);
  if (error) {
    warnKind('Could not sign photo URLs', error);
    return {};
  }
  return Object.fromEntries(data.flatMap((item) => (item.path && item.signedUrl ? [[item.path, item.signedUrl]] : [])));
}
