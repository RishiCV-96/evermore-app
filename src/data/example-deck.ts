import { sampleDeck } from '@/data/sample-deck';
import type { Person } from '@/lib/stories';

// The deck the local-only mode starts from: your real family cards from the gitignored
// src/data/deck.local.ts, if that file is on this computer and this is a development build, then the
// fictional sample people (src/data/sample-deck.ts). Without the local file, or in any release build,
// it is the sample people alone, with no error.
//
// DEVELOPMENT ONLY for the local file: in a release build __DEV__ is false, this branch is removed
// before the bundle is made, and neither the file nor any real photo is in it (scripts/check-release.mjs
// checks the bundle). require.context means a copy of the project without the file still builds.
// Nothing else may read deck.local.ts. Read nowhere else but src/data/local-store.ts.
const localFiles = __DEV__ ? require.context('./', false, /^\.\/deck\.local\.ts$/) : null;

function readLocal(): Person[] {
  if (!localFiles || !localFiles.keys().length) return [];
  const people = (localFiles(localFiles.keys()[0]) as { localDeck?: unknown }).localDeck;
  return Array.isArray(people) ? (people as Person[]) : [];
}

/** Your real people, from the local file: development builds only, and empty without it. */
export const localDeck: Person[] = readLocal();

export const exampleDeck: Person[] = [...localDeck, ...sampleDeck.filter((sample) => !localDeck.some((person) => person.id === sample.id))];
