import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_TTL_MS = 60_000;
const STORAGE_PREFIX = 'feedCache:';

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const memoryStore = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();
const subscribers = new Map<string, Set<(value: unknown) => void>>();

const now = () => Date.now();

const notify = <T,>(key: string, value: T) => {
  const listeners = subscribers.get(key);
  if (!listeners) return;
  listeners.forEach((listener) => {
    try {
      listener(value);
    } catch (error) {
      console.warn(`[feed-cache] subscriber error for ${key}:`, error);
    }
  });
};

const getStorageKey = (key: string) => `${STORAGE_PREFIX}${key}`;

const persistEntry = async (key: string, entry: CacheEntry<unknown>) => {
  try {
    await AsyncStorage.setItem(getStorageKey(key), JSON.stringify(entry));
  } catch (error) {
    // Persistence is best-effort; memory cache still works.
    console.warn('[feed-cache] persist failed:', error);
  }
};

const loadPersistedEntry = async <T,>(key: string): Promise<CacheEntry<T> | null> => {
  try {
    const raw = await AsyncStorage.getItem(getStorageKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (!parsed || typeof parsed.expiresAt !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
};

export const getCached = <T,>(key: string): T | undefined => {
  const entry = memoryStore.get(key) as CacheEntry<T> | undefined;
  return entry?.value;
};

export const setCached = <T,>(key: string, value: T, ttlMs: number = DEFAULT_TTL_MS) => {
  const entry: CacheEntry<T> = { value, expiresAt: now() + ttlMs };
  memoryStore.set(key, entry);
  void persistEntry(key, entry);
  notify(key, value);
};

export const invalidate = (keyOrPredicate: string | ((key: string) => boolean)) => {
  if (typeof keyOrPredicate === 'function') {
    for (const key of Array.from(memoryStore.keys())) {
      if (keyOrPredicate(key)) {
        memoryStore.delete(key);
        void AsyncStorage.removeItem(getStorageKey(key));
      }
    }
    return;
  }
  memoryStore.delete(keyOrPredicate);
  void AsyncStorage.removeItem(getStorageKey(keyOrPredicate));
};

export const subscribe = <T,>(key: string, listener: (value: T) => void) => {
  if (!subscribers.has(key)) subscribers.set(key, new Set());
  const listeners = subscribers.get(key)!;
  const typedListener = listener as (value: unknown) => void;
  listeners.add(typedListener);
  return () => {
    listeners.delete(typedListener);
    if (!listeners.size) subscribers.delete(key);
  };
};

type LoadThroughCacheOptions<T> = {
  ttlMs?: number;
  forceRefresh?: boolean;
  onFresh?: (value: T) => void;
};

export const loadThroughCache = async <T,>(
  key: string,
  loader: () => Promise<T>,
  options: LoadThroughCacheOptions<T> = {}
): Promise<T> => {
  const { ttlMs = DEFAULT_TTL_MS, forceRefresh = false, onFresh } = options;
  const entry = memoryStore.get(key) as CacheEntry<T> | undefined;

  if (!forceRefresh && entry && entry.expiresAt > now()) {
    onFresh?.(entry.value);
    return entry.value;
  }

  if (inFlight.has(key)) {
    const pending = inFlight.get(key) as Promise<T>;
    const value = await pending;
    onFresh?.(value);
    return value;
  }

  const pending = (async () => {
    try {
      const value = await loader();
      setCached(key, value, ttlMs);
      return value;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, pending);
  const value = await pending;
  onFresh?.(value);
  return value;
};

type LoadWithBackgroundRefreshOptions<T> = {
  ttlMs?: number;
  forceRefresh?: boolean;
  refreshFresh?: boolean;
  onData?: (value: T, meta: { fromCache: boolean }) => void;
  onError?: (error: unknown) => void;
};

export const loadWithBackgroundRefresh = async <T,>(
  key: string,
  loader: () => Promise<T>,
  options: LoadWithBackgroundRefreshOptions<T> = {}
): Promise<T> => {
  const {
    ttlMs = DEFAULT_TTL_MS,
    forceRefresh = false,
    refreshFresh = false,
    onData,
    onError,
  } = options;

  // First try memory cache, then persisted cache for cold starts.
  let cached = getCached<T>(key);
  if (cached === undefined) {
    const persisted = await loadPersistedEntry<T>(key);
    if (persisted) {
      memoryStore.set(key, persisted);
      cached = persisted.value;
    }
  }

  const entry = memoryStore.get(key) as CacheEntry<T> | undefined;
  const cacheWasFresh = Boolean(entry && entry.expiresAt > now());

  if (cached !== undefined) {
    onData?.(cached, { fromCache: true });
  }

  if (cached !== undefined && cacheWasFresh && !forceRefresh) {
    if (refreshFresh) {
      void loadThroughCache(key, loader, { ttlMs, forceRefresh: true })
        .then((fresh) => onData?.(fresh, { fromCache: false }))
        .catch((error) => onError?.(error));
    }
    return cached;
  }

  try {
    const fresh = await loadThroughCache(key, loader, { ttlMs, forceRefresh });
    onData?.(fresh, { fromCache: false });
    return fresh;
  } catch (error) {
    onError?.(error);
    throw error;
  }
};
