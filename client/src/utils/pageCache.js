/** Simple in-memory page cache so sidebar navigation feels instant. */
const store = new Map();

export const pageCache = {
  get(key) {
    return store.get(key) ?? null;
  },
  set(key, value) {
    store.set(key, value);
  },
  /** Invalidate keys that start with prefix (e.g. "users:"). */
  invalidate(prefix) {
    for (const key of [...store.keys()]) {
      if (key.startsWith(prefix)) store.delete(key);
    }
  },
  clear() {
    store.clear();
  }
};
