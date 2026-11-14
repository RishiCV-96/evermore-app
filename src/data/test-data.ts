import type { FactType } from '@/lib/stories';

// Made-up answers, so every person on the phone reaches 100% and the whole flow can be tested,
// copied in once with sign-in off (seedTestData in src/lib/local-family.ts).
//
// `everyone` is for the real people of the gitignored local deck (src/data/deck.local.ts), if any. It is
// the only exception to "no invented facts": each answer is flagged, shows a "Test data" tag on the
// caregiver's screens, stays on the phone, and goes with the EXPO_PUBLIC_CLEAR_TEST_DATA=1 launch flag.
// It is never sent to the server, never seeds it, and never goes into invites or AI input.
//
// `samples` are the fictional sample people of src/data/sample-deck.ts. Nobody real is described, so
// their answers are ordinary facts, not flagged, and stay when test data is cleared, so AI can be
// tested on them. Nothing here may describe a real person.

export type TestFact = { type: FactType; text: string };

type TestSample = {
  /** A person of src/data/sample-deck.ts. */
  id: string;
  facts: TestFact[];
};

export type TestData = {
  /** Anyone from the local deck (real people). Flagged, and generic on purpose. */
  everyone: TestFact[];
  /** The fictional sample people. Ordinary facts. */
  samples: TestSample[];
};

export const TEST_DATA: TestData = {
  everyone: [
    { type: 'interest', text: 'a sample hobby (test data)' },
    { type: 'shared', text: 'did a sample activity (test data)' },
  ],
  samples: [
    {
      id: 'june',
      facts: [
        { type: 'interest', text: 'gardening' },
        { type: 'shared', text: 'picked tomatoes together one summer' },
        { type: 'nickname', text: 'Junie' },
        { type: 'food', text: 'tomato soup' },
      ],
    },
    {
      id: 'leo',
      facts: [
        { type: 'interest', text: 'walking' },
        { type: 'shared', text: 'fixed the fence after a storm' },
        { type: 'pet', text: 'a dog named Biscuit' },
        { type: 'team', text: 'the local hockey team' },
      ],
    },
    {
      id: 'ruth',
      facts: [
        { type: 'interest', text: 'knitting' },
        { type: 'shared', text: 'shared a room at the lake house' },
        { type: 'home', text: 'Vermont' },
        { type: 'show', text: 'old quiz shows' },
      ],
    },
    {
      id: 'omar',
      facts: [
        { type: 'interest', text: 'card games' },
        { type: 'shared', text: 'played chess in the park' },
        { type: 'pastwork', text: 'a bus driver' },
        { type: 'music', text: 'jazz records' },
      ],
    },
    {
      id: 'mae',
      facts: [
        { type: 'interest', text: 'reading' },
        { type: 'shared', text: 'baked bread on Sunday mornings' },
        { type: 'place', text: 'the county fair' },
        { type: 'food', text: 'peach pie' },
      ],
    },
  ],
};
