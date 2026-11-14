import type { Person } from '@/lib/stories';

// The committed deck: FICTIONAL SAMPLE PEOPLE ONLY. Invented names, relationships and facts, each shown
// with an illustration of nobody real (src/data/portraits.ts). The same five people every new family
// starts with on the server (seed_sample_people in supabase/schema.sql). Their facts are ordinary facts,
// not test data, so AI questions can be tested on them (CLAUDE.md, "No invented facts").
//
// Never add a real person here, or anywhere in the repository. Real people are added through the app
// on a device, or, for personal testing in development builds only, in the gitignored
// src/data/deck.local.ts (CLAUDE.md, "Real data stays off git"). scripts/check-no-real-data.mjs checks.
export const sampleDeck: Person[] = [
  { id: 'june', name: 'June', relationship: 'aunt', memories: ['grows tomatoes and shares them every summer'] },
  { id: 'leo', name: 'Leo', relationship: 'neighbor', memories: ['walks his dog past the house every morning'] },
  { id: 'ruth', name: 'Ruth', relationship: 'cousin', memories: ['knits warm scarves for the whole family'] },
  { id: 'omar', name: 'Omar', relationship: 'friend', memories: ['plays chess at the library on Tuesdays'] },
  { id: 'mae', name: 'Mae', relationship: 'granddaughter', memories: ['loves to bake banana bread'] },
];

/** The sample people's ids: never real, never held back from AI. */
export const SAMPLE_IDS = sampleDeck.map((person) => person.id);
