import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

// iOS says ahead of time, so what depends on it moves with the keyboard.
const KEYBOARD_OPENS = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
const KEYBOARD_CLOSES = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

/** Whether the on-screen keyboard is up. On web, where there are no keyboard events, always false. */
export function useKeyboardOpen() {
  const [open, setOpen] = useState(() => Keyboard.isVisible?.() ?? false);
  useEffect(() => {
    const listening = [Keyboard.addListener(KEYBOARD_OPENS, () => setOpen(true)), Keyboard.addListener(KEYBOARD_CLOSES, () => setOpen(false))];
    return () => listening.forEach((listener) => listener.remove());
  }, []);
  return open;
}
