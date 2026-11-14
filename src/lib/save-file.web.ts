// The web build (for checking screens): the browser downloads the file. The report downloads as its
// HTML page, since the web has no PDF printer; the phone's version prints it to a PDF.
export type FileKind = 'json' | 'zip';

const TYPES = { json: 'application/json', zip: 'application/zip', html: 'text/html' } as const;

function download(name: string, content: string | Uint8Array, type: string) {
  const url = URL.createObjectURL(new Blob([content as BlobPart], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function clearExports() {}

export async function shareFile(name: string, content: string | Uint8Array, kind: FileKind) {
  download(name, content, TYPES[kind]);
  return true;
}

export async function sharePdf(name: string, html: string) {
  download(name.replace(/\.pdf$/, '.html'), html, TYPES.html);
  return true;
}

export async function downloadBytes(url: string) {
  return new Uint8Array(await (await fetch(url)).arrayBuffer());
}

export async function readBytes(uri: string) {
  return new Uint8Array(await (await fetch(uri)).arrayBuffer());
}
