import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { createAutosaver } from '@/lib/autosave';
import { warnKind } from '@/lib/log';

function warn(error: unknown) {
  warnKind('Could not save the draft', error);
}

/**
 * Autosaves a screen: call touch() on every change and flush() on blur or before moving on. It
 * also saves when the app goes to the background and when the screen goes away, however it
 * was left. `save` always runs with the screen's latest answers.
 */
export function useAutosave(save: () => Promise<void>) {
  const [saver] = useState(() => createAutosaver(save));
  useEffect(() => {
    saver.use(save);
  });

  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      if (state !== 'active') saver.flush().catch(warn);
    });
    return () => {
      listener.remove();
      saver.flush().catch(warn);
    };
  }, [saver]);

  return saver;
}
