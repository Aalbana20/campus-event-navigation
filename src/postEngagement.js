import { DEFAULT_AVATAR_URL, sanitizeAvatarUrl } from "./profileMedia"
import { supabase } from "./supabaseClient"

const toId = (value) => (value == null ? "" : String(value))

const logSupabaseError = (scope, error, details = {}) => {
  console.error(`[post-engagement] ${scope}`, {
    code: error?.code || null,
    message: error?.message || String(error || ""),
    details: error?.details || null,
    hint: error?.hint || null,
    ...details,
  })
}

const getFriendlySupabaseMessage = (error, fallback) => {
  const message = String(error?.message || "")
  const lowerMessage = message.toLowerCase()

  if (error?.code === "42P01" || lowerMessage.includes("does not exist")) {
    return "Post engagement is not set up yet. Apply the latest database migration."
  }

  if (error?.code === "42501" || lowerMessage.includes("row-level security")) {
    return "Your session is not authorized for this action. Sign in again and retry."
  }

  if (error?.code === "23503") {
    return "Could not find the matching post or profile. Refresh and try again."
  }

  return fallback
}

export const getPostActionUserId = async (fallbackUserId = "") => {
  const { data, error } = await supabase.auth.getUser()
  const sessionUserId = toId(data?.user?.id)

  if (error || !sessionUserId) {
    if (error) {
      logSupabaseError("Unable to resolve authenticated user", error)
    }
    throw new Error("Sign in again to continue.")
  }

  const fallbackId = toId(fallbackUserId)
  if (fallbackId && fallbackId !== sessionUserId) {
    console.warn("[post-engagement] Stored user id did not match Supabase session.", {
      storedUserId: fallbackId,
      sessionUserId,
    })
  }

  return sessionUserId
}

const getViewerUserId = async (fallbackUserId = "") => {
  const { data, error } = await supabase.auth.getUser()
  const sessionUserId = toId(data?.user?.id)

  if (error || !sessionUserId) {
    return ""
  }

  const fallbackId = toId(fallbackUserId)
  if (fallbackId && fallbackId !== sessionUserId) {
    console.warn("[post-engagement] Stored user id did not match Supabase session.", {
      storedUserId: fallbackId,
      sessionUserId,
    })
  }

  return sessionUserId
}

const emptySummary = () => ({
  likeCount: 0,
  commentCount: 0,
  repostCount: 0,
  shareCount: 0,
  isLikedByCurrentUser: false,
  isRepostedByCurrentUser: false,
})

const ensureSummary = (summaryByPostId, postId) => {
  const key = toId(postId)
  if (!summaryByPostId.has(key)) {
    summaryByPostId.set(key, emptySummary())
  }
  return summaryByPostId.get(key)
}

export const loadPostEngagementSummary = async ({
  postIds = [],
  currentUserId = "",
} = {}) => {
  const ids = [...new Set(postIds.map(toId).filter(Boolean))]
  const summaryByPostId = new Map(ids.map((id) => [id, emptySummary()]))
  if (!ids.length) return summaryByPostId

  const viewerId = await getViewerUserId(currentUserId)

  const [likesResult, commentsResult, repostsResult, sharesResult] =
    await Promise.all([
      supabase
        .from("discover_post_likes")
        .select("post_id, user_id")
        .in("post_id", ids),
      supabase
        .from("discover_post_comments")
        .select("id, post_id")
        .in("post_id", ids),
      supabase
        .from("reposts")
        .select("post_id, user_id")
        .eq("target_type", "post")
        .in("post_id", ids),
      supabase
        .from("discover_post_shares")
        .select("post_id")
        .in("post_id", ids),
    ])

  if (likesResult.error) {
    logSupabaseError("Unable to load post likes", likesResult.error)
  } else {
    ;(likesResult.data || []).forEach((row) => {
      const postId = toId(row.post_id)
      const summary = ensureSummary(summaryByPostId, postId)
      summary.likeCount += 1
      if (viewerId && toId(row.user_id) === viewerId) {
        summary.isLikedByCurrentUser = true
      }
    })
  }

  if (commentsResult.error) {
    logSupabaseError("Unable to load post comment counts", commentsResult.error)
  } else {
    ;(commentsResult.data || []).forEach((row) => {
      ensureSummary(summaryByPostId, row.post_id).commentCount += 1
    })
  }

  if (repostsResult.error) {
    logSupabaseError("Unable to load post repost counts", repostsResult.error)
  } else {
    ;(repostsResult.data || []).forEach((row) => {
      const postId = toId(row.post_id)
      const summary = ensureSummary(summaryByPostId, postId)
      summary.repostCount += 1
      if (viewerId && toId(row.user_id) === viewerId) {
        summary.isRepostedByCurrentUser = true
      }
    })
  }

  if (sharesResult.error) {
    logSupabaseError("Unable to load post share counts", sharesResult.error)
  } else {
    ;(sharesResult.data || []).forEach((row) => {
      ensureSummary(summaryByPostId, row.post_id).shareCount += 1
    })
  }

  return summaryByPostId
}

export const setPostLike = async ({ postId, userId, liked }) => {
  if (!postId) throw new Error("Missing post.")
  const authenticatedUserId = await getPostActionUserId(userId)

  const request = liked
    ? supabase.from("discover_post_likes").insert({
        post_id: postId,
        user_id: authenticatedUserId,
      })
    : supabase
        .from("discover_post_likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", authenticatedUserId)

  const { error } = await request
  if (error && error.code !== "23505") {
    logSupabaseError("Unable to update post like", error, { postId, liked })
    throw new Error(getFriendlySupabaseMessage(error, "Could not update like right now."))
  }

  return { userId: authenticatedUserId }
}

export const loadPostComments = async ({ postId, currentUserId = "" }) => {
  if (!postId) return []

  const { data: rows, error } = await supabase
    .from("discover_post_comments")
    .select("id, body, created_at, user_id, parent_id")
    .eq("post_id", postId)
    .order("created_at", { ascending: true })

  if (error) {
    logSupabaseError("Unable to load post comments", error, { postId })
    throw new Error(getFriendlySupabaseMessage(error, "Could not load comments. Please try again."))
  }

  const commentRows = rows || []
  const commentIds = commentRows.map((row) => toId(row.id)).filter(Boolean)
  const authorIds = [
    ...new Set(commentRows.map((row) => toId(row.user_id)).filter(Boolean)),
  ]
  const viewerId = await getViewerUserId(currentUserId)

  const profileById = new Map()
  if (authorIds.length > 0) {
    const { data: profileRows, error: profileError } = await supabase
      .from("profiles")
      .select("id, name, username, avatar_url")
      .in("id", authorIds)

    if (profileError) {
      logSupabaseError("Unable to load post comment profiles", profileError)
    } else {
      ;(profileRows || []).forEach((profile) => {
        profileById.set(toId(profile.id), profile)
      })
    }
  }

  const likeCountByComment = new Map()
  const likedByMe = new Set()
  if (commentIds.length > 0) {
    const { data: likeRows, error: likeError } = await supabase
      .from("discover_post_comment_likes")
      .select("comment_id, user_id")
      .in("comment_id", commentIds)

    if (likeError) {
      logSupabaseError("Unable to load post comment likes", likeError)
    } else {
      ;(likeRows || []).forEach((row) => {
        const commentId = toId(row.comment_id)
        likeCountByComment.set(
          commentId,
          (likeCountByComment.get(commentId) || 0) + 1
        )
        if (viewerId && toId(row.user_id) === viewerId) {
          likedByMe.add(commentId)
        }
      })
    }
  }

  return commentRows.map((row) => {
    const id = toId(row.id)
    const authorId = toId(row.user_id)
    const profile = profileById.get(authorId)
    return {
      id,
      authorName: profile?.name || profile?.username || "Campus User",
      authorUsername: profile?.username || "",
      authorAvatar: sanitizeAvatarUrl(profile?.avatar_url, DEFAULT_AVATAR_URL),
      authorId,
      body: row.body,
      createdAt: row.created_at,
      likeCount: likeCountByComment.get(id) || 0,
      likedByMe: likedByMe.has(id),
      parentId: row.parent_id ? toId(row.parent_id) : null,
    }
  })
}

export const addPostComment = async ({ postId, userId, body, parentId = null }) => {
  if (!postId) throw new Error("Missing post.")
  const authenticatedUserId = await getPostActionUserId(userId)
  const trimmedBody = typeof body === "string" ? body.trim() : ""
  if (!trimmedBody) throw new Error("Write a comment first.")

  const { data, error } = await supabase
    .from("discover_post_comments")
    .insert({
      post_id: postId,
      user_id: authenticatedUserId,
      body: trimmedBody,
      parent_id: parentId || null,
    })
    .select("id")
    .single()

  if (error) {
    logSupabaseError("Unable to add post comment", error, { postId, parentId })
    throw new Error(getFriendlySupabaseMessage(error, "Could not post comment. Please try again."))
  }

  return { id: toId(data.id), userId: authenticatedUserId }
}

export const deletePostComment = async ({ commentId, userId }) => {
  if (!commentId) throw new Error("Missing comment.")
  const authenticatedUserId = await getPostActionUserId(userId)

  const { error } = await supabase
    .from("discover_post_comments")
    .delete()
    .eq("id", commentId)
    .eq("user_id", authenticatedUserId)

  if (error) {
    logSupabaseError("Unable to delete post comment", error, { commentId })
    throw new Error(getFriendlySupabaseMessage(error, "Could not delete comment. Please try again."))
  }

  return { userId: authenticatedUserId }
}

export const setPostCommentLike = async ({ commentId, userId, liked }) => {
  if (!commentId) throw new Error("Missing comment.")
  const authenticatedUserId = await getPostActionUserId(userId)

  const request = liked
    ? supabase.from("discover_post_comment_likes").insert({
        comment_id: commentId,
        user_id: authenticatedUserId,
      })
    : supabase
        .from("discover_post_comment_likes")
        .delete()
        .eq("comment_id", commentId)
        .eq("user_id", authenticatedUserId)

  const { error } = await request
  if (error && error.code !== "23505") {
    logSupabaseError("Unable to update post comment like", error, { commentId, liked })
    throw new Error(getFriendlySupabaseMessage(error, "Could not update comment like."))
  }

  return { userId: authenticatedUserId }
}

export const recordPostShare = async ({
  postId,
  userId,
  method = "share",
}) => {
  if (!postId) return null
  let authenticatedUserId = ""
  try {
    authenticatedUserId = await getPostActionUserId(userId)
  } catch (error) {
    console.warn("[post-engagement] Share was not recorded because the user is not authenticated.", error)
    return null
  }

  const safeMethod = ["copy_link", "native_share", "message", "share"].includes(method)
    ? method
    : "share"

  const { error } = await supabase
    .from("discover_post_shares")
    .insert({
      post_id: postId,
      user_id: authenticatedUserId,
      method: safeMethod,
    })

  if (error) {
    logSupabaseError("Unable to record post share", error, { postId, method: safeMethod })
    return null
  }

  const { count, error: countError } = await supabase
    .from("discover_post_shares")
    .select("id", { count: "exact", head: true })
    .eq("post_id", postId)

  if (countError) {
    logSupabaseError("Unable to count post shares", countError, { postId })
    return null
  }

  return count ?? null
}
