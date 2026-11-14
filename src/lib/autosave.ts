import { warnKind } from '@/lib/log';

// Saving a draft as the caregiver types. Pure, so scripts/check-logic.mjs can check it with a
// fake clock; src/components/use-autosave.ts ties it to a screen and to the app going to the
// background.

/** How long after the last keystroke a draft is saved. */
export const AUTOSAVE_MS = 500;

type Timers = { set: (run: () => void, ms: number) => unknown; clear: (timer: unknown) => void };

const REAL_TIMERS: Timers = { set: (run, ms) => setTimeout(run, ms), clear: (timer) => clearTimeout(timer as ReturnType<typeof setTimeout>) };

/**
 * Saves after a quiet moment. touch() says something changed; flush() saves now, for a blur, the
 * app going to the background or a change of step. Saves run one at a time, in order, and a
 * failed save stays owing, so the words are tried again on the next touch or flush.
 */
export function createAutosaver(save: () => Promise<void>, delay = AUTOSAVE_MS, timers = REAL_TIMERS) {
  let timer: unknown;
  let owing = false;
  let last: Promise<void> = Promise.resolve();
  let current = save;

  function run() {
    if (timer !== undefined) timers.clear(timer);
    timer = undefined;
    if (owing) {
      owing = false;
      last = last
        .catch(() => {})
        .then(() => current())
        .catch((error) => {
          owing = true;
          throw error;
        });
    }
    return last;
  }

  return {
    /** The screen rendered: saves from now on use its latest answers. */
    use(next: () => Promise<void>) {
      current = next;
    },
    touch() {
      owing = true;
      if (timer !== undefined) timers.clear(timer);
      timer = timers.set(() => {
        run().catch((error) => warnKind('Could not save the draft', error));
      }, delay);
    },
    flush: run,
  };
}

export type Autosaver = ReturnType<typeof createAutosaver>;
