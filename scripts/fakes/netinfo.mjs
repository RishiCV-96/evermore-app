// @react-native-community/netinfo, for scripts/check-sync.mjs: the connection is whatever the check
// says, and listeners hear each change, as on a phone.

let connected = true;
let listeners = new Set();

export const net = {
  set(next) {
    connected = next;
    listeners.forEach((listener) => listener({ isConnected: connected }));
  },
  /** The app was closed: nobody is listening any more. */
  reset() {
    listeners = new Set();
  },
};

const NetInfo = {
  async fetch() {
    return { isConnected: connected };
  },
  addEventListener(listener) {
    listeners.add(listener);
    listener({ isConnected: connected });
    return () => listeners.delete(listener);
  },
};

export default NetInfo;
