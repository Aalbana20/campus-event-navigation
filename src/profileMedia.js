import { supabase } from "./supabaseClient"

export const DEFAULT_AVATAR_URL = "/default-avatar.png"
export const PROFILE_IMAGE_BUCKET = "profile-images"
export const PROFILE_IMAGE_FOLDER = "avatars"

const PROFILE_IMAGE_PUBLIC_SEGMENT = `/storage/v1/object/public/${PROFILE_IMAGE_BUCKET}/`
const SYNTHETIC_USERNAME_PATTERN = /^user-[a-z0-9]{4,}$/i
const INVALID_DISPLAY_USERNAMES = new Set(["guest", "campus-host"])

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

const sanitizeDisplayUsername = (value) => {
  const trimmed = toTrimmedString(value)

  if (!trimmed) return ""
  if (trimmed.startsWith("@")) return sanitizeDisplayUsername(trimmed.slice(1))
  if (trimmed.includes("@")) return ""
  if (INVALID_DISPLAY_USERNAMES.has(trimmed.toLowerCase())) return ""
  if (SYNTHETIC_USERNAME_PATTERN.test(trimmed)) return ""

  return trimmed
}

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

// Avatars are referenced everywhere — discover feed, story strips, profile
// rows, comment threads. Caching the public URL by storage path keeps render
// passes cheap and ensures the same URL string is returned each time so
// <img> doesn't perceive a src change and re-fetch.
const PROFILE_IMAGE_URL_CACHE = new Map()

const resolveProfileImageUrl = (value) => {
  if (!value) return ""

  if (isRemoteUrl(value)) {
    return value
  }

  const cached = PROFILE_IMAGE_URL_CACHE.get(value)
  if (cached) return cached

  const { data } = supabase.storage.from(PROFILE_IMAGE_BUCKET).getPublicUrl(value)
  const resolved = data?.publicUrl || ""
  if (resolved) PROFILE_IMAGE_URL_CACHE.set(value, resolved)
  return resolved
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
  const username = toTrimmedString(
    profile?.username ||
      authUser?.user_metadata?.username ||
      authUser?.user_metadata?.user_name
  )

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
      toTrimmedString(
        profile?.name ||
          authUser?.user_metadata?.name ||
          authUser?.user_metadata?.full_name
      ) ||
      username ||
      "Campus User",
    username,
    avatarStorageValue,
    avatarUrl: avatarStorageValue,
    avatar_url: avatarStorageValue,
    image,
    avatar: image,
  }
}

const compactProfileValue = (value) => {
  if (value === undefined || value === "") return null
  return value
}

export const buildProfilePayloadFromAuthUser = (authUser) => {
  const metadata = authUser?.user_metadata || {}
  const username = toTrimmedString(metadata.username || metadata.user_name)
  const accountType = toTrimmedString(metadata.account_type) || "regular"
  const firstName = toTrimmedString(metadata.first_name)
  const lastName = toTrimmedString(metadata.last_name)
  const organizationName = toTrimmedString(metadata.organization_name)
  const displayName =
    toTrimmedString(metadata.name || metadata.full_name) ||
    organizationName ||
    [firstName, lastName].filter(Boolean).join(" ") ||
    username ||
    "Campus User"

  return {
    id: authUser.id,
    name: displayName,
    username,
    bio: toTrimmedString(metadata.bio) || "Exploring campus events and new people.",
    avatar_url: sanitizeAvatarStorageValue(
      metadata.avatar_url || metadata.picture || metadata.image,
      null
    ),
    email: authUser.email || toTrimmedString(metadata.email),
    phone: toTrimmedString(metadata.phone_number || metadata.phone),
    phone_number: toTrimmedString(metadata.phone_number || metadata.phone),
    interests: Array.isArray(metadata.interests) ? metadata.interests : [],
    account_type: accountType,
    first_name: compactProfileValue(firstName),
    last_name: compactProfileValue(lastName),
    birth_month: metadata.birth_month ? Number(metadata.birth_month) : null,
    birth_year: metadata.birth_year ? Number(metadata.birth_year) : null,
    gender: compactProfileValue(toTrimmedString(metadata.gender)),
    school: compactProfileValue(toTrimmedString(metadata.school)),
    school_id: compactProfileValue(toTrimmedString(metadata.school_id)),
    student_verified: Boolean(metadata.student_verified),
    verification_status: toTrimmedString(metadata.verification_status) || "unverified",
    organization_name: compactProfileValue(organizationName),
    organization_type: compactProfileValue(toTrimmedString(metadata.organization_type)),
    organization_description: compactProfileValue(
      toTrimmedString(metadata.organization_description)
    ),
    organization_website: compactProfileValue(toTrimmedString(metadata.organization_website)),
    parent_organization_name: compactProfileValue(
      toTrimmedString(metadata.parent_organization_name)
    ),
    logo_url: sanitizeAvatarStorageValue(metadata.logo_url, null),
    updated_at: new Date().toISOString(),
  }
}

export const resolveCreatorIdentity = ({
  profileName,
  profileUsername,
  eventName,
  eventUsername,
  fallbackName,
  fallbackUsername,
} = {}) => {
  const creatorUsername =
    sanitizeDisplayUsername(profileUsername) ||
    sanitizeDisplayUsername(eventUsername) ||
    sanitizeDisplayUsername(fallbackUsername) ||
    ""
  const creatorName =
    toTrimmedString(profileName) ||
    sanitizeDisplayUsername(profileUsername) ||
    toTrimmedString(eventName) ||
    sanitizeDisplayUsername(eventUsername) ||
    toTrimmedString(fallbackName) ||
    sanitizeDisplayUsername(fallbackUsername) ||
    "Campus User"

  return {
    creatorName,
    creatorUsername,
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

  let profile = await fetchProfileForUser(session.user.id)

  if (!profile) {
    const payload = buildProfilePayloadFromAuthUser(session.user)
    const { data, error } = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "id" })
      .select("id, name, username, bio, avatar_url")
      .maybeSingle()

    if (error) {
      console.error("Unable to create profile from auth metadata:", error)
    } else {
      profile = data || null
    }
  }

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
  const { creatorName } = resolveCreatorIdentity({
    eventName: event?.creatorName,
    eventUsername: event?.creatorUsername,
  })
  const creatorAvatar = sanitizeAvatarUrl(event?.creatorAvatar, DEFAULT_AVATAR_URL)

  return {
    creatorName,
    creatorHandle: "",
    creatorAvatar,
  }
}
