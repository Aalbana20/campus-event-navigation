import { DEFAULT_AVATAR_URL, sanitizeAvatarUrl } from "./profileMedia"
import { supabase } from "./supabaseClient"

const POST_MEDIA_BUCKET = "stories"
const POST_MEDIA_FOLDER = "posts"
const MAX_POST_FILE_BYTES = 120 * 1024 * 1024

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

const normalizePostRecord = ({ row, profile }) => ({
  id: String(row.id),
  authorId: String(row.author_id),
  mediaUrl: resolveDiscoverPostMediaUrl(row.media_url),
  mediaType: row.media_type === "video" ? "video" : "image",
  caption: toTrimmedString(row.caption),
  createdAt: row.created_at || new Date().toISOString(),
  authorName:
    toTrimmedString(profile?.name) ||
    toTrimmedString(profile?.username) ||
    "Campus User",
  authorUsername: toTrimmedString(profile?.username) || "",
  authorAvatar: sanitizeAvatarUrl(profile?.avatar_url, DEFAULT_AVATAR_URL),
})

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

export const loadDiscoverPosts = async () => {
  const { data: postRows, error } = await supabase
    .from("discover_posts")
    .select("id, author_id, media_url, media_type, caption, created_at")
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

  return (postRows || []).map((row) =>
    normalizePostRecord({ row, profile: profileLookup.get(String(row.author_id || "")) })
  )
}

export const loadDiscoverPostsForAuthor = async (authorId) => {
  if (!authorId) return []

  const { data: postRows, error } = await supabase
    .from("discover_posts")
    .select("id, author_id, media_url, media_type, caption, created_at")
    .eq("author_id", authorId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Unable to load author discover posts:", error)
    return []
  }

  const profileLookup = await loadAuthorProfiles([authorId])

  return (postRows || []).map((row) =>
    normalizePostRecord({ row, profile: profileLookup.get(String(authorId)) })
  )
}

export const uploadDiscoverPost = async ({ authorId, file, caption }) => {
  if (!authorId || !file) {
    throw new Error("Choose media before you post.")
  }

  if (file.size && file.size > MAX_POST_FILE_BYTES) {
    throw new Error("Choose media smaller than 120 MB for posts.")
  }

  const isVideo = (file.type || "").startsWith("video/")
  const extension = getFileExtension(file.name, file.type || "")
  const filePath = `${POST_MEDIA_FOLDER}/${authorId}/${Date.now()}.${extension}`

  const { error: uploadError } = await supabase.storage
    .from(POST_MEDIA_BUCKET)
    .upload(filePath, file, {
      cacheControl: "3600",
      contentType: file.type || (isVideo ? "video/mp4" : "image/jpeg"),
      upsert: false,
    })

  if (uploadError) {
    console.error("Unable to upload post media:", uploadError)
    throw new Error("Could not upload your post right now. Please try again.")
  }

  const { data, error } = await supabase
    .from("discover_posts")
    .insert({
      author_id: authorId,
      media_url: filePath,
      media_type: isVideo ? "video" : "image",
      caption: toTrimmedString(caption) || null,
    })
    .select("id, author_id, media_url, media_type, caption, created_at")
    .single()

  if (error) {
    console.error("Unable to insert discover post row:", error)
    throw new Error("Could not publish your post right now. Please try again.")
  }

  return data
}
