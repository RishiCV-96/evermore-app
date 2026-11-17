import { createContext, type ReactNode, useContext } from 'react';

import { Colors } from '@/theme/colors';

// The color of links and small accents. The caregiver layout (src/app/caregiver/_layout.tsx) gives its
// screens Deep Rose; everywhere else, the person's screens and the shared sign-in screen included, it is
// the ink-blue. Shared components read it here, so none of them names a pink: a person's screen can
// never show one (scripts/check-logic.mjs follows every import from the person's screens).
const AccentContext = createContext<string>(Colors.primaryDark);

/** Gives the screens inside it their link and accent color. */
export function AccentProvider({ color, children }: { color: string; children: ReactNode }) {
  return <AccentContext.Provider value={color}>{children}</AccentContext.Provider>;
}

/** Links and small accents: Deep Rose on the caregiver's screens, the ink-blue everywhere else. */
export function useAccent() {
  return useContext(AccentContext);
}
