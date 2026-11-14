import { Directory, File, Paths } from 'expo-file-system';

// Reads a photo picked from the library so it can be uploaded to the private photo bucket.
export async function readPhoto(uri: string): Promise<ArrayBuffer> {
  return new File(uri).arrayBuffer();
}

// With sign-in off, a picked photo stays on the phone: it is copied out of the picker's cache
// (which the system may clear) into the app's own folder.
const kept = () => new Directory(Paths.document, 'photos');

/** Copies a picked photo into the app's folder and returns its new uri. A new name each time, so no stale copy is shown. */
export async function keepPhoto(uri: string, personId: string): Promise<string> {
  const folder = kept();
  folder.create({ intermediates: true, idempotent: true });
  const extension = uri.split('?')[0].match(/\.(\w+)$/)?.[1] ?? 'jpg';
  const target = new File(folder, `${personId}-${Date.now()}.${extension}`);
  await new File(uri).copy(target);
  return target.uri;
}

/** Deletes a photo keepPhoto made. Anything else is left alone. */
export function dropPhoto(uri: string) {
  if (!uri.startsWith(kept().uri)) return;
  const file = new File(uri);
  if (file.exists) file.delete();
}
