import { createContext, type ReactNode, useContext } from 'react';

import { Colors } from '@/theme/colors';

// The color of links and small accents, and of the progress bar. The caregiver layout
// (src/app/caregiver/_layout.tsx) gives its screens Deep Rose for both; everywhere else, the person's
// screens and the shared sign-in screen included, links are the ink-blue and the progress bar is Ink.
// Shared components read them here, so none of them names a pink: a person's screen can never show one
// (scripts/check-logic.mjs follows every import from the person's screens).
type Accent = { link: string; progress: string };

const AccentContext = createContext<Accent>({ link: Colors.primaryDark, progress: Colors.text });

/** Gives the screens inside it one color for links, small accents and the progress bar. */
export function AccentProvider({ color, children }: { color: string; children: ReactNode }) {
  return <AccentContext.Provider value={{ link: color, progress: color }}>{children}</AccentContext.Provider>;
}

/** Links and small accents: Deep Rose on the caregiver's screens, the ink-blue everywhere else. */
export function useAccent() {
  return useContext(AccentContext).link;
}

/** The progress bar's fill and outline: Deep Rose on the caregiver's screens, Ink everywhere else. */
export function useProgressColor() {
  return useContext(AccentContext).progress;
}
