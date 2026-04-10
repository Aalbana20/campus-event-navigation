import { supabase } from "./supabaseClient"

export const DEFAULT_AVATAR_URL = "/default-avatar.png"

const getFallbackUsername = (email = "") =>
  email.includes("@") ? email.split("@")[0] : "campus-user"

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

export const sanitizeAvatarUrl = (value, fallback = DEFAULT_AVATAR_URL) => {
  if (typeof value !== "string") return fallback

  const trimmed = value.trim()

  if (!trimmed) return fallback
  if (trimmed.startsWith("blob:")) return fallback

  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:image/") ||
    trimmed.startsWith("/")
  ) {
    return trimmed
  }

  return fallback
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

  const image = sanitizeAvatarUrl(
    profile?.avatar_url ||
      authUser?.user_metadata?.avatar_url ||
      authUser?.user_metadata?.picture ||
      authUser?.user_metadata?.image,
    DEFAULT_AVATAR_URL
  )

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
    return null
  }

  const profile = await fetchProfileForUser(session.user.id)
  const storedUser = buildStoredUserFromSources({
    authUser: session.user,
    profile,
  })

  localStorage.setItem("user", JSON.stringify(storedUser))
  return storedUser
}

export const uploadProfileImageToStorage = async ({
  userId,
  file,
  fileName,
  contentType,
  fallbackUrl,
}) => {
  if (!userId || !file) {
    return sanitizeAvatarUrl(fallbackUrl, DEFAULT_AVATAR_URL)
  }

  try {
    const extension = getFileExtension(fileName, contentType)
    const filePath = `avatars/${userId}-${Date.now()}.${extension}`

    const { error: uploadError } = await supabase.storage
      .from("profile-images")
      .upload(filePath, file, {
        contentType: contentType || "image/jpeg",
        upsert: true,
      })

    if (uploadError) {
      console.error("Profile image upload failed:", uploadError)
      return sanitizeAvatarUrl(fallbackUrl, DEFAULT_AVATAR_URL)
    }

    const { data } = supabase.storage.from("profile-images").getPublicUrl(filePath)
    return sanitizeAvatarUrl(data?.publicUrl, sanitizeAvatarUrl(fallbackUrl, DEFAULT_AVATAR_URL))
  } catch (error) {
    console.error("Profile image upload failed:", error)
    return sanitizeAvatarUrl(fallbackUrl, DEFAULT_AVATAR_URL)
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
