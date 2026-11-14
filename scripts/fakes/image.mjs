// expo-image's caches, for scripts/check-auth.mjs: counts each time one is cleared.
export const cleared = { memory: 0, disk: 0 };
export const Image = {
  async clearMemoryCache() {
    cleared.memory += 1;
    return true;
  },
  async clearDiskCache() {
    cleared.disk += 1;
    return true;
  },
};
