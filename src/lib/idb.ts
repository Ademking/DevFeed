// A tiny IndexedDB key-value store. RSS feeds with full articles are too big
// for localStorage's ~5MB, and IndexedDB has room for them.

// Kept from the old name so existing caches and uploads survive the rename.
const DB_NAME = "better-daily-dev";
const STORE = "kv";

let dbPromise: Promise<IDBDatabase> | null = null;

const open = () => {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
};

const run = async <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest) => {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
};

export const idbGet = <T>(key: string) =>
  run<T | undefined>("readonly", (s) => s.get(key)).catch(() => undefined);

export const idbSet = (key: string, value: unknown) =>
  run<void>("readwrite", (s) => s.put(value, key)).catch(() => {
    // caching is best-effort
  });

export const idbDelete = (key: string) =>
  run<void>("readwrite", (s) => s.delete(key)).catch(() => {});
