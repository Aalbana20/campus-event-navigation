const DEFAULT_TTL_MS = 60_000

const store = new Map()
const inFlight = new Map()
const subscribers = new Map()

const nowMs = () => Date.now()

const getEntry = (key) => store.get(key)

const isFresh = (entry, ttlMs) =>
  Boolean(entry) && entry.expiresAt > nowMs() && entry.expiresAt - nowMs() <= ttlMs + 5_000

const notify = (key, value) => {
  const listeners = subscribers.get(key)
  if (!listeners) return
  listeners.forEach((listener) => {
    try {
      listener(value)
    } catch (error) {
      console.warn(`[feedCache] subscriber error for ${key}:`, error)
    }
  })
}

export const getCached = (key) => {
  const entry = getEntry(key)
  return entry ? entry.value : undefined
}

export const setCached = (key, value, ttlMs = DEFAULT_TTL_MS) => {
  store.set(key, { value, expiresAt: nowMs() + ttlMs })
  notify(key, value)
}

export const invalidate = (key) => {
  if (typeof key === "function") {
    for (const existing of Array.from(store.keys())) {
      if (key(existing)) store.delete(existing)
    }
    return
  }
  store.delete(key)
}

export const subscribe = (key, listener) => {
  if (!subscribers.has(key)) subscribers.set(key, new Set())
  const listeners = subscribers.get(key)
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (!listeners.size) subscribers.delete(key)
  }
}

/**
 * Load value through cache.
 * - Returns cached value immediately if fresh.
 * - Deduplicates concurrent loads on the same key.
 * - On `forceRefresh`, bypasses cache but still dedupes.
 *
 * `onFresh` fires whenever a fresh value arrives (cache hit, in-flight resolve,
 * or background refresh) so callers can update state silently.
 */
export const loadThroughCache = async (
  key,
  loader,
  { ttlMs = DEFAULT_TTL_MS, forceRefresh = false, onFresh } = {}
) => {
  const entry = getEntry(key)

  if (!forceRefresh && entry && entry.expiresAt > nowMs()) {
    onFresh?.(entry.value)
    return entry.value
  }

  if (inFlight.has(key)) {
    const pending = inFlight.get(key)
    const value = await pending
    onFresh?.(value)
    return value
  }

  const pending = (async () => {
    try {
      const value = await loader()
      setCached(key, value, ttlMs)
      return value
    } finally {
      inFlight.delete(key)
    }
  })()

  inFlight.set(key, pending)
  const value = await pending
  onFresh?.(value)
  return value
}

/**
 * Cache-then-refresh pattern for feed screens.
 * - Calls `onData` once immediately with cached data (if present).
 * - Then loads fresh data in the background and calls `onData` again.
 * - Dedupes concurrent callers via loadThroughCache.
 */
export const loadWithBackgroundRefresh = async (
  key,
  loader,
  {
    ttlMs = DEFAULT_TTL_MS,
    onData,
    onError,
    forceRefresh = false,
    refreshFresh = false,
  } = {}
) => {
  const cached = getCached(key)
  const cacheWasFresh = isFresh(getEntry(key), ttlMs)

  if (cached !== undefined) {
    onData?.(cached, { fromCache: true })
  }

  if (cached !== undefined && cacheWasFresh && !forceRefresh) {
    if (refreshFresh) {
      void loadThroughCache(key, loader, { ttlMs, forceRefresh: true })
        .then((fresh) => onData?.(fresh, { fromCache: false }))
        .catch((error) => onError?.(error))
    }
    return cached
  }

  try {
    const fresh = await loadThroughCache(key, loader, { ttlMs, forceRefresh })
    onData?.(fresh, { fromCache: false })
    return fresh
  } catch (error) {
    onError?.(error)
    throw error
  }
}

export const __resetFeedCacheForTests = () => {
  store.clear()
  inFlight.clear()
  subscribers.clear()
}
