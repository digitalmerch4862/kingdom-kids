// Offline cache for weak-signal scenarios.
// Reads try the network first; on failure they fall back to the most recent cached copy
// so users can still browse the app when connectivity is poor.

const PREFIX = 'kk_cache_';
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24h

type CacheEntry<T> = {
  savedAt: number;
  data: T;
};

function readCache<T>(key: string): CacheEntry<T> | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEntry<T>;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, data: T): void {
  try {
    const entry: CacheEntry<T> = { savedAt: Date.now(), data };
    localStorage.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {
    // Storage quota exceeded or disabled — ignore silently.
  }
}

// Fetch with offline fallback. Runs the network function; on failure
// (or if browser is offline) returns the cached value when present.
export async function withOfflineCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  opts: { ttlMs?: number } = {}
): Promise<T> {
  const ttl = opts.ttlMs ?? DEFAULT_TTL_MS;

  // If the browser reports offline, skip the network attempt entirely.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    const cached = readCache<T>(key);
    if (cached && Date.now() - cached.savedAt < ttl) return cached.data;
    // No usable cache — bubble up a clear error.
    throw new Error('You are offline and no cached data is available for this view.');
  }

  try {
    const fresh = await fetcher();
    writeCache(key, fresh);
    return fresh;
  } catch (err) {
    const cached = readCache<T>(key);
    if (cached) {
      console.warn(`Network failed for "${key}", serving cached copy from ${new Date(cached.savedAt).toLocaleString()}`);
      return cached.data;
    }
    throw err;
  }
}

export function clearOfflineCache(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
  } catch { /* ignore */ }
}
