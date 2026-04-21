import { DEFAULT_AVATAR_URL, sanitizeAvatarUrl } from "./profileMedia"
import { supabase } from "./supabaseClient"

const MEMORY_BUCKET = "event-memories"
const MAX_MEMORY_FILE_BYTES = 120 * 1024 * 1024

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

const toId = (value) => (value == null ? null : String(value))

const getFileExtension = (fileName = "", contentType = "") => {
  const normalized = String(fileName || "").trim().toLowerCase()
  const match = normalized.match(/\.([a-z0-9]+)$/)
  if (match?.[1]) return match[1]
  if (contentType && MIME_EXTENSION_MAP[contentType]) {
    return MIME_EXTENSION_MAP[contentType]
  }
  return (contentType || "").startsWith("video/") ? "mp4" : "jpg"
}

const normalizeMemoryStoragePath = (value) => {
  const trimmed = toTrimmedString(value)
  if (!trimmed) return ""
  if (trimmed.startsWith(`${MEMORY_BUCKET}/`)) {
    return trimmed.slice(MEMORY_BUCKET.length + 1)
  }
  return trimmed
}

export const resolveEventMemoryMediaUrl = async (value, fallback = "") => {
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

  const storagePath = normalizeMemoryStoragePath(trimmed)
  const { data, error } = await supabase.storage
    .from(MEMORY_BUCKET)
    .createSignedUrl(storagePath, 60 * 60)

  if (error) {
    console.error("Unable to sign event memory media URL:", error)
    return fallback
  }

  return data?.signedUrl || fallback
}

const normalizeMemoryRecord = async ({ row, profile }) => ({
  id: toId(row.id),
  eventId: toId(row.event_id),
  authorId: toId(row.author_id),
  mediaUrl: await resolveEventMemoryMediaUrl(row.media_url),
  mediaType: row.media_type === "video" ? "video" : "image",
  caption: toTrimmedString(row.caption),
  metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : {},
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
    console.error("Unable to load event memory authors:", error)
    return new Map()
  }
  return new Map((data || []).map((row) => [String(row.id), row]))
}

const MEMORY_SELECT_COLUMNS =
  "id, event_id, author_id, media_url, media_type, caption, metadata, created_at"

export const loadEventMemoriesForEvent = async (eventId) => {
  if (!eventId) return []

  const { data, error } = await supabase
    .from("event_memories")
    .select(MEMORY_SELECT_COLUMNS)
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Unable to load event memories:", error)
    return []
  }

  const authorIds = [
    ...new Set(
      (data || []).map((row) => String(row.author_id || "")).filter(Boolean)
    ),
  ]
  const profileLookup = await loadAuthorProfiles(authorIds)

  return Promise.all(
    (data || []).map((row) =>
      normalizeMemoryRecord({
        row,
        profile: profileLookup.get(String(row.author_id || "")),
      })
    )
  )
}

export const loadEventMemoriesForUser = async (userId) => {
  if (!userId) return []

  const { data, error } = await supabase
    .from("event_memories")
    .select(MEMORY_SELECT_COLUMNS)
    .eq("author_id", userId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Unable to load user event memories:", error)
    return []
  }

  const profileLookup = await loadAuthorProfiles([userId])

  return Promise.all(
    (data || []).map((row) =>
      normalizeMemoryRecord({
        row,
        profile: profileLookup.get(String(userId)),
      })
    )
  )
}

export const userAttendedEvent = async ({ userId, eventId }) => {
  if (!userId || !eventId) return false

  const { data, error } = await supabase
    .rpc("user_attended_event", {
      target_user_id: userId,
      target_event_id: eventId,
    })

  if (error) {
    console.error("Unable to verify event attendance:", error)
    return false
  }

  return Boolean(data)
}

export const uploadEventMemory = async ({
  authorId,
  eventId,
  file,
  caption,
  metadata,
}) => {
  if (!authorId || !eventId || !file) {
    throw new Error("Choose media to post to this event.")
  }

  if (file.size && file.size > MAX_MEMORY_FILE_BYTES) {
    throw new Error("Choose media smaller than 120 MB for event memories.")
  }

  const isVideo = (file.type || "").startsWith("video/")
  const extension = getFileExtension(file.name, file.type || "")
  const filePath = `${eventId}/${authorId}/${Date.now()}.${extension}`

  const { error: uploadError } = await supabase.storage
    .from(MEMORY_BUCKET)
    .upload(filePath, file, {
      cacheControl: "3600",
      contentType: file.type || (isVideo ? "video/mp4" : "image/jpeg"),
      upsert: false,
    })

  if (uploadError) {
    console.error("Unable to upload event memory media:", uploadError)
    throw new Error("Could not upload your memory right now. Please try again.")
  }

  const { data, error } = await supabase
    .from("event_memories")
    .insert({
      event_id: eventId,
      author_id: authorId,
      media_url: filePath,
      media_type: isVideo ? "video" : "image",
      caption: toTrimmedString(caption) || null,
      metadata: metadata && typeof metadata === "object" ? metadata : {},
    })
    .select(MEMORY_SELECT_COLUMNS)
    .single()

  if (error) {
    await supabase.storage.from(MEMORY_BUCKET).remove([filePath])
    console.error("Unable to insert event memory row:", error)
    throw new Error(
      "Could not post this memory. Make sure you've RSVP'd to the event."
    )
  }

  return data
}

export const deleteEventMemory = async (memoryId) => {
  if (!memoryId) throw new Error("Missing memory id.")

  const { data: memoryRow, error: loadError } = await supabase
    .from("event_memories")
    .select("media_url")
    .eq("id", memoryId)
    .maybeSingle()

  if (loadError) {
    console.error("Unable to load event memory before delete:", loadError)
  }

  const { error } = await supabase
    .from("event_memories")
    .delete()
    .eq("id", memoryId)

  if (error) {
    console.error("Unable to delete event memory:", error)
    throw new Error("Could not delete this memory. Please try again.")
  }

  if (memoryRow?.media_url) {
    const storagePath = normalizeMemoryStoragePath(memoryRow.media_url)
    const { error: removeError } = await supabase.storage
      .from(MEMORY_BUCKET)
      .remove([storagePath])

    if (removeError) {
      console.error("Unable to remove event memory media:", removeError)
    }
  }
}
