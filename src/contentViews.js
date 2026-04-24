import { supabase } from "./supabaseClient"

// Deterministic pseudo-random view count keyed by the content id. Replaces the
// network round-trip until the real aggregate query is wired up. Keeps the
// number stable per refresh so tiles don't jitter.
const hashString = (value) => {
  const str = String(value || "")
  let hash = 0
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

export const getPlaceholderViewCount = (contentId) => {
  const hash = hashString(contentId)
  // 1.2k .. 4.2M, weighted toward smaller numbers.
  const tier = hash % 100
  if (tier < 55) return 1200 + (hash % 48000) // 1.2k - 49.2k
  if (tier < 85) return 50000 + (hash % 450000) // 50k - 500k
  return 500000 + (hash % 4000000) // 500k - 4.5M
}

export const formatViewCount = (value) => {
  const n = Number(value) || 0
  if (n < 1000) return String(n)
  if (n < 1_000_000) {
    const k = n / 1000
    return `${k >= 100 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, "")}K`
  }
  const m = n / 1_000_000
  return `${m >= 100 ? Math.round(m) : m.toFixed(1).replace(/\.0$/, "")}M`
}

export const recordContentView = async ({
  contentType,
  contentId,
  userId,
}) => {
  if (!supabase || !contentId) return
  if (!["post", "video", "event"].includes(contentType)) return

  const payload = {
    content_type: contentType,
    content_id: contentId,
    user_id: userId || null,
  }

  const { error } = await supabase.from("content_views").insert(payload)
  if (error && error.code !== "23505") {
    // Don't spam the console on a stale schema cache — this feature is best
    // effort and shouldn't block the UI.
    if (!/content_views|schema cache/i.test(error.message || "")) {
      console.warn("[content_views] insert failed:", error)
    }
  }
}

export const loadContentViewCounts = async ({ contentIds } = {}) => {
  const counts = new Map()
  if (!supabase || !Array.isArray(contentIds) || contentIds.length === 0) {
    return counts
  }

  const { data, error } = await supabase
    .from("content_views")
    .select("content_id")
    .in("content_id", contentIds)

  if (error) {
    if (!/content_views|schema cache/i.test(error.message || "")) {
      console.warn("[content_views] select failed:", error)
    }
    return counts
  }

  for (const row of data || []) {
    const key = String(row.content_id)
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  return counts
}
