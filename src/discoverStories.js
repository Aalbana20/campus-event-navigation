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

  const storagePath = normalizeStoryStoragePath(trimmed)
  const { data } = supabase.storage.from(STORY_MEDIA_BUCKET).getPublicUrl(storagePath)
  return data?.publicUrl || fallback
}

const normalizeStoryRecord = ({ row, profile, currentUser, baseItem }) => ({
  id: String(row.id),
  authorId: String(row.author_id),
  mediaUrl: resolveStoryMediaUrl(row.media_url),
  mediaType: row.media_type === "video" ? "video" : "image",
  caption: toTrimmedString(row.caption),
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
      currentUser?.image ||
      currentUser?.avatar,
    DEFAULT_AVATAR_URL
  ),
})

export const loadActiveDiscoverStories = async ({
  currentUser,
  baseItems = [],
}) => {
  if (!currentUser?.id) return []

  const { data: storyRows, error: storyError } = await supabase
    .from("stories")
    .select("id, author_id, media_url, media_type, caption, created_at, expires_at")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })

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

  const extension = getFileExtension(file.name, file.type || "")
  const filePath = `${STORY_MEDIA_FOLDER}/${authorId}/${Date.now()}.${extension}`

  const { error: uploadError } = await supabase.storage
    .from(STORY_MEDIA_BUCKET)
    .upload(filePath, file, {
      cacheControl: "3600",
      contentType: file.type || ((file.type || "").startsWith("video/") ? "video/mp4" : "image/jpeg"),
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
  if (!storyId || !viewerId) return

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

  const { data, error } = await supabase
    .from("story_reactions")
    .select("story_id")
    .eq("user_id", authenticatedUserId)
    .eq("reaction", "heart")
    .in("story_id", storyIds)

  if (error) {
    console.error("Unable to load story reactions:", error)
    return new Set()
  }

  return new Set((data || []).map((row) => String(row.story_id)))
}

export const toggleDiscoverStoryHeart = async ({
  storyId,
  nextActive,
}) => {
  const authenticatedUserId = await loadAuthenticatedDiscoverStoryUserId()

  if (!storyId || !authenticatedUserId) {
    throw new Error("You need to be signed in to react to stories.")
  }

  if (nextActive) {
    const { error } = await supabase.from("story_reactions").insert({
      story_id: storyId,
      user_id: authenticatedUserId,
      reaction: "heart",
    })

    if (error) {
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
    .eq("reaction", "heart")

  if (error) {
    console.error("Unable to remove story reaction:", error)
    throw new Error("Could not update your reaction right now.")
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
        .select("id, name, username, avatar_url, avatar")
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
      avatar: sanitizeAvatarUrl(profile?.avatar_url || profile?.avatar, DEFAULT_AVATAR_URL),
    }
  })
}
