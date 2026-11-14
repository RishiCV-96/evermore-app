// The sign-in switch. On by default: caregivers and the person sign in, and the family lives in
// Supabase (README "Sign-in"). The app opens on the welcome screen until someone signs in, and a
// phone that has signed in once stays signed in.
//
// Local-only, for development: start the app with EXPO_PUBLIC_LOCAL_ONLY=1, which is what
//   npm run start:local
// does (the same as `EXPO_PUBLIC_LOCAL_ONLY=1 npx expo start --clear`). Then there is no sign-in and
// no server: the app opens on the person's home, practices the family kept on this phone (copied once
// from the example deck, src/data/example-deck.ts), and holding Caregiver opens the dashboard. No Supabase
// client is even created. Go back with `npx expo start --clear`: Metro caches the inlined value.
//
// Read as process.env.EXPO_PUBLIC_LOCAL_ONLY exactly, so Expo inlines it when it bundles the app;
// scripts/check-auth.mjs checks both ways.
export const AUTH_ENABLED = process.env.EXPO_PUBLIC_LOCAL_ONLY !== '1';

// AI sentences: new questions an AI writes from a person's approved facts, which the caregiver
// approves one by one. Off by default. Turning this on, and the caregiver agreeing once on the
// person's sheet, is all it takes on the phone; the function has to be set up first (README).
//
// With this false nothing about AI appears, and sentences approved earlier stay out of practice.
// See the first hard rule in CLAUDE.md for its bounds.
export const AI_VARIANTS_ENABLED = false;

// Local-first: AI needs no sign-in. With sign-in on the caregiver and the person are on two
// phones, and approved sentences would have to live on the server, which isn't built. So AI
// questions show only in the local-only mode.
export const AI_AVAILABLE = AI_VARIANTS_ENABLED && !AUTH_ENABLED;
