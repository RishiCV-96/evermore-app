// Web is only for checking the screens in a browser; the picker gives a blob or data URL.
// Exports match photo-files.ts.
export async function readPhoto(uri: string): Promise<ArrayBuffer> {
  return (await fetch(uri)).arrayBuffer();
}

/** The browser has no app folder: the picker's URL is kept as it is. */
export async function keepPhoto(uri: string, _personId: string): Promise<string> {
  return uri;
}

export function dropPhoto(_uri: string) {}
