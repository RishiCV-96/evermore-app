// The private denylist: real names (and anything else real) that must never appear in a tracked file or
// a release bundle. It lives in scripts/private-denylist.local.txt, which is gitignored and which you
// fill in yourself (scripts/private-denylist.example.txt shows the format). Shared by
// scripts/check-no-real-data.mjs and scripts/check-release.mjs.
//
// NEVER print an entry. Findings name an entry only by its line number in the denylist, and a file and
// line where it was found, never the words.
//
// Format, one entry per line:
//   Name            matched as a whole word in any capitalization: also catches ids such as name-0
//   =Word           matched only with exactly this capitalization (for a name that is also an
//                   ordinary word, so code such as a lowercase variable doesn't trip it)
//   ~Word           also an ordinary word that libraries use in their own strings: checked in the
//                   repository's files, but not in release bundles, where it can't be told apart from
//                   a library's text. Combine as ~=Word. (The local deck's cards are still looked for
//                   in bundles by scripts/check-release.mjs.)
//   two words       a phrase, matched whole, in any capitalization
//   # a comment     ignored, as are blank lines
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const DEFAULT_DENYLIST = fileURLToPath(new URL('./private-denylist.local.txt', import.meta.url));

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The entries, as patterns. `EVERMORE_DENYLIST` names another file (the self-test uses it). Missing
 * file: `{ missing: true }`, and the checks that need it are skipped with a warning.
 */
export function loadDenylist(path = process.env.EVERMORE_DENYLIST || DEFAULT_DENYLIST) {
  if (!existsSync(path)) return { path, missing: true, entries: [] };
  const entries = [];
  readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .forEach((raw, i) => {
      const line = raw.trim();
      if (!line || line.startsWith('#')) return;
      const flags = /^[=~]+/.exec(line)?.[0] ?? '';
      const exact = flags.includes('=');
      const filesOnly = flags.includes('~');
      const words = line.slice(flags.length).trim();
      if (words.length < 2) return;
      // A whole word: no letter or digit just before or after, so "name-0" matches and "names" doesn't.
      const pattern = `(?<![\\p{L}\\p{N}])${escape(words).replace(/\s+/g, '\\s+')}(?![\\p{L}\\p{N}])`;
      entries.push({ number: i + 1, filesOnly, regex: new RegExp(pattern, exact ? 'u' : 'iu') });
    });
  return { path, missing: false, entries };
}

/** Where entries appear in a text: [{ number, line }], with no words. */
export function findIn(text, entries) {
  const found = [];
  const lines = text.split('\n');
  for (const entry of entries) {
    lines.forEach((line, i) => {
      if (entry.regex.test(line)) found.push({ number: entry.number, line: i + 1 });
    });
  }
  return found;
}

/** Whether a bundle (JavaScript or Hermes bytecode) holds an entry, as UTF-8 or UTF-16, as Hermes may keep strings. */
export function bundleHolds(buffer, entries) {
  // UTF-16 at both byte alignments: a string can start at an odd offset in bytecode.
  const texts = [buffer.toString('latin1'), buffer.toString('utf8'), buffer.toString('utf16le'), buffer.subarray(1).toString('utf16le')];
  return entries.filter((entry) => !entry.filesOnly && texts.some((text) => entry.regex.test(text))).map((entry) => entry.number);
}

/** A file that is text, not an image or font: no NUL byte in its first 8 KB. */
export const isText = (buffer) => !buffer.subarray(0, 8192).includes(0);
