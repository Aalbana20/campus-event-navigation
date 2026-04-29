import { DEFAULT_AVATAR_URL, sanitizeAvatarUrl } from "./profileMedia"

const personDisplayName = (person) =>
  person?.name ||
  (person?.username ? person.username : "") ||
  ""

export const getMutualInitials = (person) =>
  (person?.name || person?.username || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()

export const buildMutualGoingLabel = (mutuals = [], totalGoing = 0) => {
  const known = (mutuals || []).filter(Boolean)
  if (known.length === 0) return ""

  const names = known
    .slice(0, 2)
    .map(personDisplayName)
    .filter(Boolean)

  if (names.length === 0) {
    return `${known.length} mutual${known.length === 1 ? "" : "s"} going`
  }

  const remainingGoing = Math.max(totalGoing - names.length, 0)

  if (remainingGoing > 0) {
    return `Going with ${names.join(", ")} and ${remainingGoing} other${
      remainingGoing === 1 ? "" : "s"
    }`
  }

  return `Going with ${names.join(" and ")}`
}

export const buildMutualFollowedByLabel = (mutuals = [], totalMutuals = 0) => {
  const known = (mutuals || []).filter(Boolean)
  if (totalMutuals <= 0 && known.length === 0) return ""

  const total = totalMutuals || known.length
  const names = known.slice(0, 2).map(personDisplayName).filter(Boolean)

  if (names.length === 0) {
    return `${total} mutual ${total === 1 ? "follower" : "followers"}`
  }

  const remaining = Math.max(total - names.length, 0)

  if (remaining > 0) {
    return `Followed by ${names.join(", ")} and ${remaining} other${
      remaining === 1 ? "" : "s"
    }`
  }

  return `Followed by ${names.join(" and ")}`
}

export const normalizeMutualProfile = (row) => {
  if (!row) return null
  return {
    id: row.id,
    name: row.name || row.username || "User",
    username: row.username || "",
    image: sanitizeAvatarUrl(row.avatar_url || row.image || row.avatar, DEFAULT_AVATAR_URL),
  }
}
