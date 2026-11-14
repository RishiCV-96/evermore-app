// A stand-in for src/lib/save-file.ts: what the app would hand the share sheet, and the temporary
// folder it writes to, for scripts/check-export.mjs and scripts/check-auth.mjs.
export const shared = [];
export const folder = { files: 0, cleared: 0 };
/** Photos by signed link or file: what downloadBytes and readBytes hand back. */
export const photoBytes = new Map();

export function clearExports() {
  folder.files = 0;
  folder.cleared += 1;
}
export async function shareFile(name, content, kind) {
  shared.push({ name, content, kind });
  return true;
}
export async function sharePdf(name, html) {
  shared.push({ name, content: html, kind: 'pdf' });
  return true;
}
export async function downloadBytes(url) {
  if (!photoBytes.has(url)) throw Object.assign(new Error('download'), { code: 'not-found' });
  return photoBytes.get(url);
}
export async function readBytes(uri) {
  return downloadBytes(uri);
}
