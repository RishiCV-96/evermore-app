// AsyncStorage on a phone's disk, in memory, for scripts/check-sync.mjs. What is written here
// outlives the app: a restart in the check imports the code again, and finds the same disk.

export const disk = new Map();

/**
 * Makes reads (or writes) wait until `release()`, to check what happens while the saved state is
 * still loading, or while a write hasn't reached the disk yet.
 */
export const slow = { reads: false, writes: false, waiting: [] };
export function release() {
  slow.reads = false;
  slow.writes = false;
  slow.waiting.splice(0).forEach((resolve) => resolve());
}

const read = () => (slow.reads ? new Promise((resolve) => slow.waiting.push(resolve)) : Promise.resolve());
const write = () => (slow.writes ? new Promise((resolve) => slow.waiting.push(resolve)) : Promise.resolve());

const AsyncStorage = {
  async getItem(key) {
    await read();
    return disk.has(key) ? disk.get(key) : null;
  },
  async setItem(key, value) {
    await write();
    disk.set(key, String(value));
  },
  async removeItem(key) {
    await write();
    disk.delete(key);
  },
  async getAllKeys() {
    await read();
    return [...disk.keys()];
  },
  async multiGet(keys) {
    await read();
    return keys.map((key) => [key, disk.has(key) ? disk.get(key) : null]);
  },
  async multiSet(pairs) {
    await write();
    for (const [key, value] of pairs) disk.set(key, String(value));
  },
  async multiRemove(keys) {
    await write();
    for (const key of keys) disk.delete(key);
  },
};

export default AsyncStorage;
