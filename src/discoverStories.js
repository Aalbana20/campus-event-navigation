import { compressImageFile } from "./lib/mediaCompression"
import { DEFAULT_AVATAR_URL, sanitizeAvatarUrl } from "./profileMedia"
import { supabase } from "./supabaseClient"

const STORY_MEDIA_BUCKET = "stories"
const STORY_MEDIA_FOLDER = "media"
const MAX_STORY_FILE_BYTES = 80 * 1024 * 1024

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

const normalizeUsername = (value = "") =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9._]/g, "")
    .replace(/^[._]+|[._]+$/g, "")

const getFileExtension = (fileName = "", contentType = "") => {
  const normalizedName = String(fileName || "").trim().toLowerCase()
  const nameMatch = normalizedName.match(/\.([a-z0-9]+)$/)

  if (nameMatch?.[1]) return nameMatch[1]
  if (contentType && MIME_EXTENSION_MAP[contentType]) return MIME_EXTENSION_MAP[contentType]

  return (contentType || "").startsWith("video/") ? "mp4" : "jpg"
}

const normalizeStoryStoragePath = (value) => {
  const trimmed = toTrimmedString(value)

  if (!trimmed) return ""

  if (trimmed.startsWith(`${STORY_MEDIA_BUCKET}/`)) {
    return trimmed.slice(STORY_MEDIA_BUCKET.length + 1)
  }

  return trimmed
}

const formatRelativeStoryTime = (dateInput) => {
  if (!dateInput) return "Now"

  const dateValue = new Date(dateInput)
  if (Number.isNaN(dateValue.getTime())) return "Now"

  const diffMs = Date.now() - dateValue.getTime()
  const mins = Math.floor(diffMs / (1000 * 60))
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (mins < 1) return "Now"
  if (mins < 60) return `${mins}m`
  if (hours < 24) return `${hours}h`
  return `${Math.max(1, days)}d`
}

const createLookupKeys = ({ id, profileId, username }) =>
  [profileId, id, normalizeUsername(username)].filter(Boolean).map(String)

const buildBaseItemLookup = (items = []) => {
  const lookup = new Map()

  ;(items || [])
    .filter((item) => item?.kind !== "suggested")
    .forEach((item) => {
      createLookupKeys(item).forEach((key) => {
        if (!lookup.has(key)) {
          lookup.set(key, item)
        }
      })
    })

  return lookup
}

// Stable cache for resolved story public URLs — avoids repeating
// getPublicUrl() work on every story strip render and keeps the URL string
// reference identical so <img> tags don't appear to change src.
const STORY_MEDIA_URL_CACHE = new Map()

export const resolveStoryMediaUrl = (value, fallback = "") => {
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

  const cached = STORY_MEDIA_URL_CACHE.get(trimmed)
  if (cached) return cached

  const storagePath = normalizeStoryStoragePath(trimmed)
  const { data } = supabase.storage.from(STORY_MEDIA_BUCKET).getPublicUrl(storagePath)
  const resolved = data?.publicUrl || fallback
  if (resolved) STORY_MEDIA_URL_CACHE.set(trimmed, resolved)
  return resolved
}

const normalizeStoryRecord = ({ row, profile, currentUser, baseItem }) => ({
  id: String(row.id),
  authorId: String(row.author_id),
  mediaUrl: resolveStoryMediaUrl(row.media_url),
  mediaType: row.media_type === "video" ? "video" : "image",
  caption: toTrimmedString(row.caption),
  eventId: row.event_id ? String(row.event_id) : null,
  storyType:
    row.story_type === "event_share" ||
    row.story_type === "post_share" ||
    row.story_type === "video_share"
      ? row.story_type
      : "standard",
  stickers: Array.isArray(row.stickers) ? row.stickers : [],
  createdAt: row.created_at || new Date().toISOString(),
  expiresAt: row.expires_at || "",
  authorName:
    toTrimmedString(profile?.name) ||
    toTrimmedString(baseItem?.name) ||
    toTrimmedString(currentUser?.name) ||
    toTrimmedString(profile?.username) ||
    "Campus User",
  authorUsername:
    toTrimmedString(profile?.username) ||
    toTrimmedString(baseItem?.username) ||
    toTrimmedString(currentUser?.username) ||
    "",
  authorAvatar: sanitizeAvatarUrl(
    profile?.avatar_url ||
      baseItem?.avatar ||
      (String(currentUser?.id || "") === String(row.author_id || "")
        ? currentUser?.image || currentUser?.avatar
        : ""),
    DEFAULT_AVATAR_URL
  ),
})

export const loadActiveDiscoverStories = async ({
  currentUser,
  baseItems = [],
}) => {
  if (!currentUser?.id) return []

  let { data: storyRows, error: storyError } = await supabase
    .from("stories")
    .select("id, author_id, media_url, media_type, caption, event_id, story_type, stickers, created_at, expires_at")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })

  if (storyError) {
    const message = String(storyError.message || "")
    const isMissingOptionalStoryColumn =
      storyError.code === "PGRST204" ||
      /column.*(event_id|stickers|story_type).*schema cache/i.test(message) ||
      /Could not find the .*(event_id|stickers|story_type). column/i.test(message)

    if (isMissingOptionalStoryColumn) {
      const legacyResult = await supabase
        .from("stories")
        .select("id, author_id, media_url, media_type, caption, created_at, expires_at")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })

      storyRows = legacyResult.data
      storyError = legacyResult.error
    }
  }

  if (storyError) {
    console.error("Unable to load discover stories:", storyError)
    return []
  }

  const authorIds = [
    ...new Set((storyRows || []).map((row) => String(row.author_id || "")).filter(Boolean)),
  ]

  const { data: profiles, error: profileError } = authorIds.length
    ? await supabase
        .from("profiles")
        .select("id, name, username, avatar_url")
        .in("id", authorIds)
    : { data: [], error: null }

  if (profileError) {
    console.error("Unable to load story authors:", profileError)
  }

  const profileLookup = new Map(
    (profiles || []).map((profile) => [String(profile.id), profile])
  )
  const baseLookup = buildBaseItemLookup(baseItems)

  return (storyRows || []).map((row) => {
    const authorId = String(row.author_id || "")
    const profile = profileLookup.get(authorId)
    const baseItem =
      baseLookup.get(authorId) ||
      baseLookup.get(normalizeUsername(profile?.username || ""))

    return normalizeStoryRecord({
      row,
      profile,
      currentUser: String(currentUser.id) === authorId ? currentUser : null,
      baseItem,
    })
  })
}

export const buildDiscoverStoryStripItems = ({
  currentUser,
  baseItems,
  storyRecords,
}) => {
  const currentBaseItem =
    (baseItems || []).find((item) => item?.kind === "current") || {
      id: String(currentUser?.id || "current-user"),
      profileId: currentUser?.id || "",
      routeKey: currentUser?.username || currentUser?.id || "",
      name: currentUser?.name || currentUser?.username || "Campus User",
      username: currentUser?.username || "",
      avatar: currentUser?.image || currentUser?.avatar || DEFAULT_AVATAR_URL,
      kind: "current",
      seen: false,
    }

  const suggestedItems = (baseItems || []).filter((item) => item?.kind === "suggested")

  const groupedStories = (storyRecords || []).reduce((collection, story) => {
    const authorId = String(story.authorId || "")
    if (!authorId) return collection

    const currentStories = collection.get(authorId) || []
    currentStories.push(story)
    collection.set(authorId, currentStories)
    return collection
  }, new Map())

  const sortStoriesByNewest = (stories = []) =>
    [...stories].sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    )

  const currentStories = sortStoriesByNewest(
    groupedStories.get(String(currentUser?.id || "")) || []
  )

  const currentItem = {
    ...currentBaseItem,
    id: currentBaseItem.id || `story-${currentUser?.id || "current-user"}`,
    profileId: currentBaseItem.profileId || currentUser?.id || "",
    routeKey: currentBaseItem.routeKey || currentUser?.username || currentUser?.id || "",
    name: currentBaseItem.name || currentUser?.name || currentUser?.username || "Campus User",
    username: currentBaseItem.username || currentUser?.username || "",
    avatar:
      currentBaseItem.avatar ||
      sanitizeAvatarUrl(currentUser?.image || currentUser?.avatar, DEFAULT_AVATAR_URL),
    kind: "current",
    seen: false,
    meta: currentStories.length > 0 ? "Your story" : "Add",
    stories: currentStories,
    latestStoryAt: currentStories[0]?.createdAt || "",
  }

  const otherItems = [...groupedStories.entries()]
    .filter(([authorId]) => String(authorId) !== String(currentUser?.id || ""))
    .map(([authorId, stories]) => {
      const sortedStories = sortStoriesByNewest(stories)
      const latestStory = sortedStories[0]

      return {
        id: `story-${authorId}`,
        profileId: authorId,
        routeKey: latestStory.authorUsername || authorId,
        name: latestStory.authorName || "Campus User",
        username: latestStory.authorUsername || "",
        avatar: latestStory.authorAvatar || DEFAULT_AVATAR_URL,
        kind: "story",
        seen: false,
        meta: formatRelativeStoryTime(latestStory.createdAt),
        stories: sortedStories,
        latestStoryAt: latestStory.createdAt,
      }
    })
    .sort(
      (left, right) =>
        new Date(right.latestStoryAt).getTime() - new Date(left.latestStoryAt).getTime()
    )

  return [currentItem, ...otherItems, ...suggestedItems]
}

export const uploadDiscoverStory = async ({
  authorId,
  file,
  caption,
}) => {
  if (!authorId || !file) {
    throw new Error("Choose media before you share your story.")
  }

  if (file.size && file.size > MAX_STORY_FILE_BYTES) {
    throw new Error("Choose media smaller than 80 MB for stories.")
  }

  const isVideo = (file.type || "").startsWith("video/")
  const uploadFile = isVideo ? file : await compressImageFile(file)

  const extension = getFileExtension(uploadFile.name, uploadFile.type || "")
  const filePath = `${STORY_MEDIA_FOLDER}/${authorId}/${Date.now()}.${extension}`

  const { error: uploadError } = await supabase.storage
    .from(STORY_MEDIA_BUCKET)
    .upload(filePath, uploadFile, {
      cacheControl: "3600",
      contentType: uploadFile.type || (isVideo ? "video/mp4" : "image/jpeg"),
      upsert: false,
    })

  if (uploadError) {
    console.error("Unable to upload story media:", uploadError)
    throw new Error("Could not upload your story right now. Please try again.")
  }

  const { data, error } = await supabase
    .from("stories")
    .insert({
      author_id: authorId,
      media_url: filePath,
      media_type: (file.type || "").startsWith("video/") ? "video" : "image",
      caption: toTrimmedString(caption) || null,
    })
    .select("id, author_id, media_url, media_type, caption, created_at, expires_at")
    .single()

  if (error) {
    console.error("Unable to insert story row:", error)
    throw new Error("Could not publish your story right now. Please try again.")
  }

  return data
}

export const recordDiscoverStoryView = async ({
  storyId,
  viewerId,
}) => {
  if (!storyId || !viewerId || viewerId === "current-user") return

  const { error } = await supabase
    .from("story_views")
    .upsert(
      {
        story_id: storyId,
        viewer_id: viewerId,
      },
      {
        onConflict: "story_id,viewer_id",
        ignoreDuplicates: true,
      }
    )

  if (error) {
    console.error("Unable to record story view:", error)
  }
}

export const loadAuthenticatedDiscoverStoryUserId = async () => {
  if (!supabase) return ""

  const { data, error } = await supabase.auth.getUser()

  if (error) {
    console.error("Unable to resolve authenticated discover story user:", error)
    return ""
  }

  return data?.user?.id ? String(data.user.id) : ""
}

export const loadDiscoverReactedStoryIds = async ({
  storyIds,
}) => {
  const authenticatedUserId = await loadAuthenticatedDiscoverStoryUserId()

  if (!authenticatedUserId || !Array.isArray(storyIds) || storyIds.length === 0) {
    return new Set()
  }

  // DB column is `reaction_type` (CHECK constraint pins it to 'heart').
  // Earlier code used `reaction`, which silently returned no rows on both
  // web and mobile.
  const { data, error } = await supabase
    .from("story_reactions")
    .select("story_id")
    .eq("user_id", authenticatedUserId)
    .eq("reaction_type", "heart")
    .in("story_id", storyIds)

  if (error) {
    console.error("Unable to load story reactions:", error)
    return new Set()
  }

  return new Set((data || []).map((row) => String(row.story_id)))
}

const pendingStoryReactions = new Set()

export const toggleDiscoverStoryHeart = async ({
  storyId,
  nextActive,
}) => {
  if (pendingStoryReactions.has(storyId)) return

  const authenticatedUserId = await loadAuthenticatedDiscoverStoryUserId()

  if (!storyId || !authenticatedUserId) {
    throw new Error("You need to be signed in to react to stories.")
  }

  pendingStoryReactions.add(storyId)

  try {
    if (nextActive) {
      // Plain INSERT + treat 23505 (unique violation) as success — safer than
      // upsert here because story_reactions has no UPDATE policy in RLS, so
      // upsert would silently fail on the UPDATE branch.
      const { error } = await supabase
        .from("story_reactions")
        .insert({
          story_id: storyId,
          user_id: authenticatedUserId,
          reaction_type: "heart",
        })

      if (error && error.code !== '23505') {
        console.error("Unable to react to story:", error)
        throw new Error("Could not save your reaction right now.")
      }

      return
    }

    const { error } = await supabase
      .from("story_reactions")
      .delete()
      .eq("story_id", storyId)
      .eq("user_id", authenticatedUserId)
      .eq("reaction_type", "heart")

    if (error) {
      console.error("Unable to remove story reaction:", error)
      throw new Error("Could not update your reaction right now.")
    }
  } finally {
    pendingStoryReactions.delete(storyId)
  }
}

export const fetchDiscoverStoryViewers = async ({
  storyId,
}) => {
  if (!storyId) return []

  const { data: viewRows, error: viewError } = await supabase
    .from("story_views")
    .select("id, story_id, viewer_id, viewed_at")
    .eq("story_id", storyId)
    .order("viewed_at", { ascending: false })

  if (viewError) {
    console.error("Unable to load story viewers:", viewError)
    return []
  }

  const viewerIds = [
    ...new Set((viewRows || []).map((row) => String(row.viewer_id || "")).filter(Boolean)),
  ]

  const { data: profiles, error: profileError } = viewerIds.length
    ? await supabase
        .from("profiles")
        .select("id, name, username, avatar_url")
        .in("id", viewerIds)
    : { data: [], error: null }

  if (profileError) {
    console.error("Unable to load viewer profiles:", profileError)
  }

  const profileLookup = new Map(
    (profiles || []).map((profile) => [String(profile.id), profile])
  )

  return (viewRows || []).map((row) => {
    const profile = profileLookup.get(String(row.viewer_id || ""))

    return {
      id: String(row.id),
      viewerId: String(row.viewer_id || ""),
      viewedAt: row.viewed_at || "",
      name: toTrimmedString(profile?.name),
      username: toTrimmedString(profile?.username),
      avatar: sanitizeAvatarUrl(profile?.avatar_url, DEFAULT_AVATAR_URL),
    }
  })
}
