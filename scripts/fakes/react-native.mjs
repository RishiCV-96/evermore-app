// The part of react-native the sync and sign-in code uses, for scripts/check-sync.mjs and
// scripts/check-auth.mjs: AppState, whose changes the checks make happen, Platform (a phone), and
// Linking's way to the phone's Settings.

let listeners = new Set();

export const AppState = {
  currentState: 'active',
  addEventListener(event, listener) {
    listeners.add(listener);
    return { remove: () => listeners.delete(listener) };
  },
};

export const appState = {
  set(state) {
    AppState.currentState = state;
    listeners.forEach((listener) => listener(state));
  },
  /** The app was closed: nobody is listening any more. */
  reset() {
    listeners = new Set();
  },
};

export const Platform = { OS: 'ios', select: (choices) => choices.ios ?? choices.native ?? choices.default };

export const Linking = { openSettings: async () => undefined };
