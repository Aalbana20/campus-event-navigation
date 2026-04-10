import { supabase } from "./supabaseClient"

export const DEFAULT_AVATAR_URL = "/default-avatar.png"
export const PROFILE_IMAGE_BUCKET = "profile-images"
export const PROFILE_IMAGE_FOLDER = "avatars"

const PROFILE_IMAGE_PUBLIC_SEGMENT = `/storage/v1/object/public/${PROFILE_IMAGE_BUCKET}/`

const getFallbackUsername = (email = "") =>
  email.includes("@") ? email.split("@")[0] : "campus-user"

const isBrowser = () => typeof window !== "undefined"

const dispatchStoredUserUpdate = (storedUser) => {
  if (!isBrowser()) return

  window.dispatchEvent(
    new CustomEvent("campus-user-storage-updated", {
      detail: storedUser,
    })
  )
}

const getFileExtension = (fileName = "", contentType = "") => {
  const normalizedName = String(fileName || "").trim().toLowerCase()
  const nameMatch = normalizedName.match(/\.([a-z0-9]+)$/)

  if (nameMatch?.[1]) return nameMatch[1]

  if (contentType === "image/png") return "png"
  if (contentType === "image/webp") return "webp"
  if (contentType === "image/heic") return "heic"
  if (contentType === "image/heif") return "heif"

  return "jpg"
}

const toTrimmedString = (value) =>
  typeof value === "string" ? value.trim() : ""

const isRemoteUrl = (value) =>
  value.startsWith("http://") || value.startsWith("https://")

const normalizeProfileImagePath = (value) => {
  const trimmed = toTrimmedString(value)

  if (!trimmed) return ""

  if (trimmed.includes(PROFILE_IMAGE_PUBLIC_SEGMENT)) {
    const [, rawPath = ""] = trimmed.split(PROFILE_IMAGE_PUBLIC_SEGMENT)
    return decodeURIComponent(rawPath.split("?")[0] || "")
  }

  if (trimmed.startsWith(`${PROFILE_IMAGE_BUCKET}/`)) {
    return trimmed.slice(PROFILE_IMAGE_BUCKET.length + 1)
  }

  if (trimmed.startsWith(`${PROFILE_IMAGE_FOLDER}/`)) {
    return trimmed
  }

  return ""
}

export const sanitizeAvatarStorageValue = (value, fallback = null) => {
  const fallbackValue =
    fallback === null || fallback === undefined
      ? null
      : sanitizeAvatarStorageValue(fallback, null)
  const trimmed = toTrimmedString(value)

  if (!trimmed) return fallbackValue

  if (
    trimmed === DEFAULT_AVATAR_URL ||
    trimmed === "/default-avatar.png" ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("file:") ||
    trimmed.startsWith("data:image/") ||
    trimmed.startsWith("/")
  ) {
    return fallbackValue
  }

  const storagePath = normalizeProfileImagePath(trimmed)
  if (storagePath) return storagePath

  if (isRemoteUrl(trimmed)) {
    return trimmed
  }

  return fallbackValue
}

const resolveProfileImageUrl = (value) => {
  if (!value) return ""

  if (isRemoteUrl(value)) {
    return value
  }

  const { data } = supabase.storage.from(PROFILE_IMAGE_BUCKET).getPublicUrl(value)
  return data?.publicUrl || ""
}

export const sanitizeAvatarUrl = (value, fallback = DEFAULT_AVATAR_URL) => {
  const normalizedValue = sanitizeAvatarStorageValue(value, fallback)

  if (!normalizedValue) {
    return DEFAULT_AVATAR_URL
  }

  const resolvedUrl = resolveProfileImageUrl(normalizedValue)
  return resolvedUrl || DEFAULT_AVATAR_URL
}

export const buildStoredUserFromSources = ({ authUser, profile }) => {
  const email = authUser?.email || ""
  const fallbackUsername = getFallbackUsername(email)
  const username =
    profile?.username ||
    authUser?.user_metadata?.username ||
    authUser?.user_metadata?.user_name ||
    authUser?.user_metadata?.name ||
    fallbackUsername

  const avatarStorageValue = sanitizeAvatarStorageValue(
    profile?.avatar_url ||
      authUser?.user_metadata?.avatar_url ||
      authUser?.user_metadata?.picture ||
      authUser?.user_metadata?.image,
    null
  )
  const image = sanitizeAvatarUrl(avatarStorageValue, DEFAULT_AVATAR_URL)

  return {
    id: authUser?.id || profile?.id || "",
    email,
    name:
      profile?.name ||
      authUser?.user_metadata?.name ||
      authUser?.user_metadata?.full_name ||
      authUser?.user_metadata?.username ||
      username,
    username,
    avatarStorageValue,
    avatarUrl: avatarStorageValue,
    avatar_url: avatarStorageValue,
    image,
    avatar: image,
  }
}

export const fetchProfileForUser = async (userId) => {
  if (!userId) return null

  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, username, bio, avatar_url")
    .eq("id", userId)
    .maybeSingle()

  if (error && error.code !== "PGRST116") {
    console.error("Unable to load profile for stored session sync:", error)
  }

  return data || null
}

export const syncStoredUserFromSession = async (session) => {
  if (!session?.user) {
    localStorage.removeItem("user")
    dispatchStoredUserUpdate(null)
    return null
  }

  const profile = await fetchProfileForUser(session.user.id)
  const storedUser = buildStoredUserFromSources({
    authUser: session.user,
    profile,
  })

  localStorage.setItem("user", JSON.stringify(storedUser))
  dispatchStoredUserUpdate(storedUser)
  return storedUser
}

export const uploadProfileImageToStorage = async ({
  userId,
  file,
  fileName,
  contentType,
  fallbackUrl,
  throwOnError = false,
}) => {
  const fallbackValue = sanitizeAvatarStorageValue(fallbackUrl, null)

  if (!userId || !file) {
    return fallbackValue
  }

  try {
    const extension = getFileExtension(fileName, contentType)
    const filePath = `${PROFILE_IMAGE_FOLDER}/${userId}-${Date.now()}.${extension}`

    const { error: uploadError } = await supabase.storage
      .from(PROFILE_IMAGE_BUCKET)
      .upload(filePath, file, {
        cacheControl: "3600",
        contentType: contentType || "image/jpeg",
      })

    if (uploadError) {
      console.error("Profile image upload failed:", uploadError)
      if (throwOnError) {
        throw uploadError
      }
      return fallbackValue
    }

    return sanitizeAvatarStorageValue(filePath, fallbackValue)
  } catch (error) {
    console.error("Profile image upload failed:", error)
    if (throwOnError) {
      throw error
    }
    return fallbackValue
  }
}

export const getEventCreatorDisplay = (event) => {
  const creatorName =
    event?.creatorName ||
    event?.organizer ||
    event?.creatorUsername ||
    "Campus User"
  const creatorHandle = event?.creatorUsername ? `@${event.creatorUsername}` : ""
  const creatorAvatar = sanitizeAvatarUrl(event?.creatorAvatar, DEFAULT_AVATAR_URL)

  return {
    creatorName,
    creatorHandle,
    creatorAvatar,
  }
}
