import { Directory, File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

// Hands a file the app made to the phone's share sheet, so the caregiver can save it to Files, mail it
// or keep it anywhere they like. Nothing is uploaded by the app. Every file is written to the app's
// temporary folder (cache/exports) and deleted as soon as the share sheet closes; anything left by an
// export the app didn't finish (closed mid-share) goes at the start of the next one and at sign-out.

export type FileKind = 'json' | 'zip';

const TYPES: Record<FileKind | 'pdf', { mimeType: string; UTI: string }> = {
  json: { mimeType: 'application/json', UTI: 'public.json' },
  zip: { mimeType: 'application/zip', UTI: 'public.zip-archive' },
  pdf: { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' },
};

const folder = () => new Directory(Paths.cache, 'exports');

/** Deletes every export file still in the temporary folder. */
export function clearExports() {
  try {
    const exports = folder();
    if (exports.exists) exports.delete();
  } catch {
    // Nothing to delete, or the system already cleared its cache.
  }
}

async function share(file: File, kind: FileKind | 'pdf') {
  try {
    await Sharing.shareAsync(file.uri, { ...TYPES[kind], dialogTitle: 'Save your Evermore export' });
  } finally {
    if (file.exists) file.delete();
  }
}

/** Writes the file and opens the share sheet. False if the phone can't share. */
export async function shareFile(name: string, content: string | Uint8Array, kind: FileKind) {
  if (!(await Sharing.isAvailableAsync())) return false;
  clearExports();
  const exports = folder();
  exports.create({ intermediates: true, idempotent: true });
  const file = new File(exports, name);
  file.create();
  await file.write(content);
  await share(file, kind);
  return true;
}

/** Prints the report's HTML to a PDF, names it, and opens the share sheet. False if the phone can't share. */
export async function sharePdf(name: string, html: string) {
  if (!(await Sharing.isAvailableAsync())) return false;
  clearExports();
  const printed = new File((await Print.printToFileAsync({ html, margins: { left: 36, right: 36, top: 36, bottom: 36 } })).uri);
  const exports = folder();
  exports.create({ intermediates: true, idempotent: true });
  const file = new File(exports, name);
  try {
    await printed.move(file);
  } finally {
    if (printed.exists) printed.delete();
  }
  await share(file, 'pdf');
  return true;
}

/** Downloads a photo from a short-lived signed link into the temporary folder, reads it, and deletes it. */
export async function downloadBytes(url: string) {
  const exports = folder();
  exports.create({ intermediates: true, idempotent: true });
  const file = await File.downloadFileAsync(url, new File(exports, `photo-${Date.now()}-${Math.random().toString(36).slice(2)}`), { idempotent: true });
  try {
    return await file.bytes();
  } finally {
    if (file.exists) file.delete();
  }
}

/** Reads a photo kept on this phone (sign-in off). */
export const readBytes = (uri: string) => new File(uri).bytes();
