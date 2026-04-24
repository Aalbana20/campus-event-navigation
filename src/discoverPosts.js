import {
  invalidate as invalidateFeedCache,
  loadWithBackgroundRefresh,
} from "./lib/feedCache"
import {
  compressImageFile,
  extractVideoPoster,
  readImageDimensions,
} from "./lib/mediaCompression"
import { loadPostEngagementSummary } from "./postEngagement"
import { DEFAULT_AVATAR_URL, sanitizeAvatarUrl } from "./profileMedia"
import { supabase } from "./supabaseClient"

const POST_MEDIA_BUCKET = "stories"
const POST_MEDIA_FOLDER = "posts"
const POST_THUMBNAIL_FOLDER = "post-thumbs"
const MAX_POST_FILE_BYTES = 120 * 1024 * 1024
const DISCOVER_FEED_CACHE_KEY = "discover-posts:global"
const DISCOVER_FEED_CACHE_TTL_MS = 60_000

const MIME_EXTENSION_MAP = {
  "image/heic": "heic",
  "image/heif": "heif",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
}

const toTrimmedString = (value) =>
  typeof value === "string" ? value.trim() : ""

const getFileExtension = (fileName = "", contentType = "") => {
  const normalizedName = String(fileName || "").trim().toLowerCase()
  const nameMatch = normalizedName.match(/\.([a-z0-9]+)$/)

  if (nameMatch?.[1]) return nameMatch[1]
  if (contentType && MIME_EXTENSION_MAP[contentType]) return MIME_EXTENSION_MAP[contentType]

  return (contentType || "").startsWith("video/") ? "mp4" : "jpg"
}

const normalizePostStoragePath = (value) => {
  const trimmed = toTrimmedString(value)
  if (!trimmed) return ""
  if (trimmed.startsWith(`${POST_MEDIA_BUCKET}/`)) {
    return trimmed.slice(POST_MEDIA_BUCKET.length + 1)
  }
  return trimmed
}

export const resolveDiscoverPostMediaUrl = (value, fallback = "") => {
  const trimmed = toTrimmedString(value)
  if (!trimmed) return fallback

  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("data:")
  ) {
    return trimmed
  }

  const storagePath = normalizePostStoragePath(trimmed)
  const { data } = supabase.storage.from(POST_MEDIA_BUCKET).getPublicUrl(storagePath)
  return data?.publicUrl || fallback
}

const normalizePostRecord = ({ row, profile, engagement }) => ({
  id: String(row.id),
  authorId: String(row.author_id),
  mediaUrl: resolveDiscoverPostMediaUrl(row.media_url),
  mediaType: row.media_type === "video" ? "video" : "image",
  thumbnailUrl: resolveDiscoverPostMediaUrl(row.thumbnail_url, ""),
  durationSeconds:
    row.duration_seconds == null
      ? row.duration == null
        ? null
        : Number(row.duration) || null
      : Number(row.duration_seconds) || null,
  mediaWidth:
    row.media_width != null
      ? Number(row.media_width) || null
      : row.width
        ? Number(row.width) || null
        : null,
  mediaHeight:
    row.media_height != null
      ? Number(row.media_height) || null
      : row.height
        ? Number(row.height) || null
        : null,
  caption: toTrimmedString(row.caption),
  createdAt: row.created_at || new Date().toISOString(),
  onGrid: row.on_grid !== false,
  eventId: row.event_id ? String(row.event_id) : null,
  authorName:
    toTrimmedString(profile?.name) ||
    toTrimmedString(profile?.username) ||
    "Campus User",
  authorUsername: toTrimmedString(profile?.username) || "",
  authorAvatar: sanitizeAvatarUrl(profile?.avatar_url, DEFAULT_AVATAR_URL),
  likeCount: Number(engagement?.likeCount) || 0,
  commentCount: Number(engagement?.commentCount) || 0,
  repostCount: Number(engagement?.repostCount) || 0,
  shareCount: Number(engagement?.shareCount) || 0,
  isLikedByCurrentUser: Boolean(engagement?.isLikedByCurrentUser),
  isRepostedByCurrentUser: Boolean(engagement?.isRepostedByCurrentUser),
})

const POST_SELECT_COLUMNS =
  "id, author_id, media_url, media_type, caption, created_at, on_grid, event_id, thumbnail_url, duration, width, height, duration_seconds, media_width, media_height"

const loadAuthorProfiles = async (authorIds) => {
  if (!authorIds.length) return new Map()

  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, username, avatar_url")
    .in("id", authorIds)

  if (error) {
    console.error("Unable to load post authors:", error)
    return new Map()
  }

  return new Map((data || []).map((profile) => [String(profile.id), profile]))
}

const fetchDiscoverPostsFromNetwork = async ({ currentUserId = "" } = {}) => {
  const { data: postRows, error } = await supabase
    .from("discover_posts")
    .select(POST_SELECT_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) {
    console.error("Unable to load discover posts:", error)
    return []
  }

  const authorIds = [
    ...new Set((postRows || []).map((row) => String(row.author_id || "")).filter(Boolean)),
  ]
  const profileLookup = await loadAuthorProfiles(authorIds)
  const engagementLookup = await loadPostEngagementSummary({
    postIds: (postRows || []).map((row) => row.id),
    currentUserId,
  })

  return (postRows || []).map((row) =>
    normalizePostRecord({
      row,
      profile: profileLookup.get(String(row.author_id || "")),
      engagement: engagementLookup.get(String(row.id)),
    })
  )
}

/**
 * Load the discover feed.
 *
 * By default returns cached data instantly (if fresh) and refreshes silently in
 * the background. Pass `{ forceRefresh: true }` from pull-to-refresh to bypass
 * the cache. Pass `onData` to receive both the cached hit and the network
 * refresh without managing cache state yourself.
 */
export const loadDiscoverPosts = async ({
  forceRefresh = false,
  onData,
  currentUserId = "",
} = {}) => {
  try {
    const cacheKey = `${DISCOVER_FEED_CACHE_KEY}:${currentUserId || "anonymous"}`
    return await loadWithBackgroundRefresh(
      cacheKey,
      () => fetchDiscoverPostsFromNetwork({ currentUserId }),
      {
        ttlMs: DISCOVER_FEED_CACHE_TTL_MS,
        forceRefresh,
        refreshFresh: true,
        onData,
      }
    )
  } catch (error) {
    console.error("Unable to load discover posts:", error)
    return []
  }
}

export const invalidateDiscoverFeedCache = () => {
  invalidateFeedCache((key) => key.startsWith("discover-posts:"))
}

export const loadDiscoverPostsForAuthor = async (authorId, options = {}) => {
  if (!authorId) return []

  const { onlyGrid = false } = options

  let query = supabase
    .from("discover_posts")
    .select(POST_SELECT_COLUMNS)
    .eq("author_id", authorId)
    .order("created_at", { ascending: false })

  if (onlyGrid) {
    query = query.eq("on_grid", true)
  }

  const { data: postRows, error } = await query

  if (error) {
    console.error("Unable to load author discover posts:", error)
    return []
  }

  const profileLookup = await loadAuthorProfiles([authorId])
  const engagementLookup = await loadPostEngagementSummary({
    postIds: (postRows || []).map((row) => row.id),
    currentUserId: options.currentUserId || "",
  })

  return (postRows || []).map((row) =>
    normalizePostRecord({
      row,
      profile: profileLookup.get(String(authorId)),
      engagement: engagementLookup.get(String(row.id)),
    })
  )
}

export const loadGridPostsForAuthor = (authorId) =>
  loadDiscoverPostsForAuthor(authorId, { onlyGrid: true })

export const loadDiscoverPostsByIds = async (postIds = []) => {
  const ids = [...new Set((postIds || []).map((id) => String(id || "")).filter(Boolean))]
  if (!ids.length) return []

  const { data: postRows, error } = await supabase
    .from("discover_posts")
    .select(POST_SELECT_COLUMNS)
    .in("id", ids)

  if (error) {
    console.error("Unable to load discover posts by id:", error)
    return []
  }

  const authorIds = [
    ...new Set((postRows || []).map((row) => String(row.author_id || "")).filter(Boolean)),
  ]
  const profileLookup = await loadAuthorProfiles(authorIds)
  const engagementLookup = await loadPostEngagementSummary({
    postIds: (postRows || []).map((row) => row.id),
  })

  return (postRows || []).map((row) =>
    normalizePostRecord({
      row,
      profile: profileLookup.get(String(row.author_id || "")),
      engagement: engagementLookup.get(String(row.id)),
    })
  )
}

export const setDiscoverPostGridVisibility = async (postId, onGrid) => {
  if (!postId) throw new Error("Missing post id.")

  const { data, error } = await supabase
    .from("discover_posts")
    .update({ on_grid: Boolean(onGrid) })
    .eq("id", postId)
    .select(POST_SELECT_COLUMNS)
    .single()

  if (error) {
    console.error("Unable to update post grid visibility:", error)
    throw new Error("Could not update grid visibility. Please try again.")
  }

  invalidateDiscoverFeedCache()

  return data
}

export const deleteDiscoverPost = async (postId) => {
  if (!postId) throw new Error("Missing post id.")

  const { data: existing, error: fetchError } = await supabase
    .from("discover_posts")
    .select("id, media_url, thumbnail_url")
    .eq("id", postId)
    .maybeSingle()

  if (fetchError) {
    console.error("Unable to load post before delete:", fetchError)
    throw new Error("Could not delete this post right now. Please try again.")
  }

  const { error: deleteError } = await supabase
    .from("discover_posts")
    .delete()
    .eq("id", postId)

  if (deleteError) {
    console.error("Unable to delete discover post:", deleteError)
    throw new Error("Could not delete this post right now. Please try again.")
  }

  const storagePaths = [existing?.media_url, existing?.thumbnail_url]
    .map((value) => toTrimmedString(value))
    .filter(Boolean)
    .filter((value) => {
      return !(
        value.startsWith("http://") ||
        value.startsWith("https://") ||
        value.startsWith("blob:") ||
        value.startsWith("data:")
      )
    })
    .map(normalizePostStoragePath)
    .filter(Boolean)

  if (storagePaths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from(POST_MEDIA_BUCKET)
      .remove(storagePaths)

    if (storageError) {
      console.warn("Post row deleted but storage cleanup failed:", storageError)
    }
  }

  invalidateDiscoverFeedCache()

  return { id: String(postId) }
}

const uploadThumbnail = async ({ authorId, thumbnailFile, timestamp }) => {
  if (!thumbnailFile) return ""
  const extension = getFileExtension(thumbnailFile.name, thumbnailFile.type || "")
  const thumbPath = `${POST_THUMBNAIL_FOLDER}/${authorId}/${timestamp}-thumb.${extension}`

  const { error: thumbUploadError } = await supabase.storage
    .from(POST_MEDIA_BUCKET)
    .upload(thumbPath, thumbnailFile, {
      cacheControl: "3600",
      contentType: thumbnailFile.type || "image/jpeg",
      upsert: false,
    })

  if (thumbUploadError) {
    console.warn("Thumbnail upload failed, continuing without poster:", thumbUploadError)
    return ""
  }

  return thumbPath
}

export const uploadDiscoverPost = async ({
  authorId,
  file,
  caption,
  onGrid = true,
  eventId = null,
}) => {
  if (!authorId || !file) {
    throw new Error("Choose media before you post.")
  }

  if (file.size && file.size > MAX_POST_FILE_BYTES) {
    throw new Error("Choose media smaller than 120 MB for posts.")
  }

  const isVideo = (file.type || "").startsWith("video/")

  // Compress images before upload. Video compression on the web requires
  // ffmpeg.wasm (too heavy for our bundle); instead we extract a poster and
  // rely on preload="none" + viewport-based playback in the feed.
  const uploadFile = isVideo ? file : await compressImageFile(file)

  const timestamp = Date.now()
  const extension = getFileExtension(uploadFile.name, uploadFile.type || "")
  const filePath = `${POST_MEDIA_FOLDER}/${authorId}/${timestamp}.${extension}`

  const { error: uploadError } = await supabase.storage
    .from(POST_MEDIA_BUCKET)
    .upload(filePath, uploadFile, {
      cacheControl: "3600",
      contentType: uploadFile.type || (isVideo ? "video/mp4" : "image/jpeg"),
      upsert: false,
    })

  if (uploadError) {
    console.error("Unable to upload post media:", uploadError)
    throw new Error("Could not upload your post right now. Please try again.")
  }

  let thumbnailPath = ""
  let mediaWidth = null
  let mediaHeight = null
  let durationSeconds = null

  if (isVideo) {
    const poster = await extractVideoPoster(file)
    if (poster) {
      mediaWidth = poster.width
      mediaHeight = poster.height
      durationSeconds = poster.durationSeconds
      thumbnailPath = await uploadThumbnail({
        authorId,
        thumbnailFile: poster.file,
        timestamp,
      })
    }
  } else {
    const dims = await readImageDimensions(uploadFile)
    if (dims) {
      mediaWidth = dims.width
      mediaHeight = dims.height
    }
  }

  const { data, error } = await supabase
    .from("discover_posts")
    .insert({
      author_id: authorId,
      media_url: filePath,
      media_type: isVideo ? "video" : "image",
      caption: toTrimmedString(caption) || null,
      on_grid: Boolean(onGrid),
      event_id: eventId || null,
      thumbnail_url: thumbnailPath || null,
      duration_seconds: durationSeconds,
      media_width: mediaWidth,
      media_height: mediaHeight,
      duration: durationSeconds,
      width: mediaWidth,
      height: mediaHeight,
    })
    .select(POST_SELECT_COLUMNS)
    .single()

  if (error) {
    console.error("Unable to insert discover post row:", error)
    throw new Error("Could not publish your post right now. Please try again.")
  }

  invalidateDiscoverFeedCache()

  return data
}
