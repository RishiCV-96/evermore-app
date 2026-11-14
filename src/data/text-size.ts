import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { warnKind } from '@/lib/log';

// The Text size setting, saved on this device. The type scale (src/theme/type.ts) follows it,
// so every screen changes at once.

export type TextSize = 'small' | 'medium' | 'large' | 'xlarge';

export const TEXT_SIZES: { size: TextSize; label: string }[] = [
  { size: 'small', label: 'Small' },
  { size: 'medium', label: 'Medium' },
  { size: 'large', label: 'Large' },
  { size: 'xlarge', label: 'Extra large' },
];

const KEY = 'evermore.textSize.v1';

let size: TextSize = 'medium';
let loaded = false;
let started = false;
let chosen = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!started) {
    started = true;
    AsyncStorage.getItem(KEY)
      .then((saved) => {
        const match = TEXT_SIZES.find((option) => option.size === saved);
        if (match && !chosen) size = match.size;
      })
      .catch(() => {})
      .finally(() => {
        loaded = true;
        notify();
      });
  }
  return () => {
    listeners.delete(listener);
  };
}

export function useTextSize() {
  return useSyncExternalStore(subscribe, () => size, () => size);
}

/** False until the saved size is read, so the first screen doesn't change size as it opens. */
export function useTextSizeLoaded() {
  return useSyncExternalStore(subscribe, () => loaded, () => loaded);
}

export function setTextSize(next: TextSize) {
  chosen = true;
  size = next;
  notify();
  AsyncStorage.setItem(KEY, next).catch((error) => warnKind('Could not save the text size', error));
}

export function textSizeLabel(value: TextSize) {
  return TEXT_SIZES.find((option) => option.size === value)?.label ?? 'Medium';
}
