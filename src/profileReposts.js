import { supabase } from "./supabaseClient"

const toId = (value) => (value == null ? null : String(value))

const normalizeRepostRow = (row) => ({
  id: toId(row.id),
  userId: toId(row.user_id),
  targetType: row.target_type === "post" ? "post" : "event",
  eventId: toId(row.event_id),
  postId: toId(row.post_id),
  createdAt: row.created_at || new Date().toISOString(),
})

export const loadRepostsForUser = async (userId) => {
  if (!userId) return []

  const { data, error } = await supabase
    .from("reposts")
    .select("id, user_id, target_type, event_id, post_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Unable to load user reposts:", error)
    return []
  }

  return (data || []).map(normalizeRepostRow)
}

export const loadRepostedPostsForUser = async (userId) => {
  const reposts = await loadRepostsForUser(userId)
  return reposts.filter((row) => row.targetType === "post")
}

export const loadRepostedEventsForUser = async (userId) => {
  const reposts = await loadRepostsForUser(userId)
  return reposts.filter((row) => row.targetType === "event")
}

export const repostPost = async ({ userId, postId }) => {
  if (!userId || !postId) throw new Error("Missing user or post for repost.")

  const { data, error } = await supabase
    .from("reposts")
    .insert({
      user_id: userId,
      post_id: postId,
      target_type: "post",
    })
    .select("id, user_id, target_type, event_id, post_id, created_at")
    .single()

  if (error && error.code !== "23505") {
    console.error("Unable to repost post:", error)
    throw new Error("Could not repost right now. Please try again.")
  }

  return data ? normalizeRepostRow(data) : null
}

export const unrepostPost = async ({ userId, postId }) => {
  if (!userId || !postId) throw new Error("Missing user or post for unrepost.")

  const { error } = await supabase
    .from("reposts")
    .delete()
    .eq("user_id", userId)
    .eq("target_type", "post")
    .eq("post_id", postId)

  if (error) {
    console.error("Unable to remove post repost:", error)
    throw new Error("Could not remove the repost. Please try again.")
  }
}

export const hasUserRepostedPost = async ({ userId, postId }) => {
  if (!userId || !postId) return false

  const { data, error } = await supabase
    .from("reposts")
    .select("id")
    .eq("user_id", userId)
    .eq("target_type", "post")
    .eq("post_id", postId)
    .limit(1)

  if (error) {
    console.error("Unable to check post repost state:", error)
    return false
  }

  return (data || []).length > 0
}
