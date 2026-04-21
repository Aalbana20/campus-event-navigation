import { supabase } from "./supabaseClient"

const toId = (value) => (value == null ? null : String(value))

const normalizeContentTagRow = (row) => ({
  id: toId(row.id),
  postId: toId(row.post_id),
  taggedUserId: toId(row.tagged_user_id),
  taggerId: toId(row.tagger_id),
  createdAt: row.created_at || new Date().toISOString(),
})

export const addContentTag = async ({ postId, taggedUserId, taggerId }) => {
  if (!postId || !taggedUserId || !taggerId) {
    throw new Error("Missing post, tagged user, or tagger for content tag.")
  }

  const { data, error } = await supabase
    .from("content_tags")
    .insert({
      post_id: postId,
      tagged_user_id: taggedUserId,
      tagger_id: taggerId,
    })
    .select("id, post_id, tagged_user_id, tagger_id, created_at")
    .single()

  if (error && error.code !== "23505") {
    console.error("Unable to add content tag:", error)
    throw new Error("Could not tag this user. Please try again.")
  }

  return data ? normalizeContentTagRow(data) : null
}

export const removeContentTag = async ({ postId, taggedUserId }) => {
  if (!postId || !taggedUserId) {
    throw new Error("Missing post or tagged user for content tag removal.")
  }

  const { error } = await supabase
    .from("content_tags")
    .delete()
    .eq("post_id", postId)
    .eq("tagged_user_id", taggedUserId)

  if (error) {
    console.error("Unable to remove content tag:", error)
    throw new Error("Could not remove the tag. Please try again.")
  }
}

export const loadTagsForPost = async (postId) => {
  if (!postId) return []

  const { data, error } = await supabase
    .from("content_tags")
    .select("id, post_id, tagged_user_id, tagger_id, created_at")
    .eq("post_id", postId)

  if (error) {
    console.error("Unable to load content tags for post:", error)
    return []
  }

  return (data || []).map(normalizeContentTagRow)
}

export const loadPostsTaggingUser = async (userId) => {
  if (!userId) return []

  const { data, error } = await supabase
    .from("content_tags")
    .select(
      "id, post_id, tagged_user_id, tagger_id, created_at, discover_posts:post_id ( id, author_id, media_url, media_type, caption, created_at, on_grid, event_id )"
    )
    .eq("tagged_user_id", userId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Unable to load tagged posts for user:", error)
    return []
  }

  return (data || []).map((row) => ({
    tag: normalizeContentTagRow(row),
    post: row.discover_posts
      ? {
          id: String(row.discover_posts.id),
          authorId: String(row.discover_posts.author_id),
          mediaUrl: row.discover_posts.media_url,
          mediaType:
            row.discover_posts.media_type === "video" ? "video" : "image",
          caption: row.discover_posts.caption || "",
          createdAt:
            row.discover_posts.created_at || new Date().toISOString(),
          onGrid: row.discover_posts.on_grid !== false,
          eventId: row.discover_posts.event_id
            ? String(row.discover_posts.event_id)
            : null,
        }
      : null,
  }))
}
