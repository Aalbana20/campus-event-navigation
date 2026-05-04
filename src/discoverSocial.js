import { DEFAULT_AVATAR_URL, sanitizeAvatarUrl } from "./profileMedia"

const FRIEND_CARD_MIN_ITEMS = 6
const PLACEHOLDER_PEOPLE = [
  {
    id: "suggested-maya-lane",
    name: "Maya Lane",
    username: "mayalate",
    bio: "Curates movie nights and post-event brunch plans.",
    location: "Student Center",
  },
  {
    id: "suggested-jordan-reed",
    name: "Jordan Reed",
    username: "jordangoes",
    bio: "Always knows the next creative showcase on campus.",
    location: "Arts Hall",
  },
  {
    id: "suggested-ava-cole",
    name: "Ava Cole",
    username: "avaafterclass",
    bio: "Finds rooftop hangs, open mics, and late-night mixers.",
    location: "North Quad",
  },
  {
    id: "suggested-noah-cross",
    name: "Noah Cross",
    username: "noahmoves",
    bio: "Tracks intramurals, wellness plans, and campus pop-ups.",
    location: "Rec Center",
  },
  {
    id: "suggested-riley-park",
    name: "Riley Park",
    username: "rileyknows",
    bio: "Good for new friends, club events, and social plans.",
    location: "Campus Green",
  },
  {
    id: "suggested-sienna-cruz",
    name: "Sienna Cruz",
    username: "siennastudies",
    bio: "Good eye for launch parties, art happenings, and after-class linkups.",
    location: "Library Lawn",
  },
  {
    id: "suggested-eli-porter",
    name: "Eli Porter",
    username: "eliinvites",
    bio: "Usually near sports energy, club pop-ups, and who is actually showing up.",
    location: "South Quad",
  },
  {
    id: "suggested-nia-frost",
    name: "Nia Frost",
    username: "niaafterdark",
    bio: "Tracks social calendars, creator events, and the best night-of-campus plans.",
    location: "Residence Row",
  },
]

const STORY_RING_COLORS = [
  ["#2563eb", "#7c3aed"],
  ["#0f766e", "#22c55e"],
  ["#ea580c", "#f59e0b"],
  ["#db2777", "#8b5cf6"],
  ["#0f766e", "#38bdf8"],
]

const toTrimmedString = (value) =>
  typeof value === "string" ? value.trim() : ""

const normalizeUsername = (value) =>
  toTrimmedString(value)
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9._]/g, "")
    .replace(/^[._]+|[._]+$/g, "")

const getStoryKey = (person) =>
  String(person?.profileId || person?.id || person?.username || person?.name || "")

const pickDisplayName = (person) =>
  toTrimmedString(person?.name) ||
  toTrimmedString(person?.creatorName) ||
  normalizeUsername(person?.username || person?.creatorUsername) ||
  "Campus User"

const encodeSvg = (value) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(value)}`

const buildGeneratedAvatar = (label, seedIndex = 0) => {
  const safeLabel = pickDisplayName({ name: label })
  const initials = safeLabel
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "CU"
  const [startColor, endColor] =
    STORY_RING_COLORS[seedIndex % STORY_RING_COLORS.length]

  return encodeSvg(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${startColor}" />
          <stop offset="100%" stop-color="${endColor}" />
        </linearGradient>
      </defs>
      <rect width="128" height="128" rx="36" fill="url(#bg)" />
      <text
        x="50%"
        y="54%"
        text-anchor="middle"
        dominant-baseline="middle"
        fill="white"
        font-family="SF Pro Display, Inter, Arial, sans-serif"
        font-size="42"
        font-weight="700"
      >${initials}</text>
    </svg>
  `)
}

const resolveAvatar = (rawAvatar, label, seedIndex = 0) => {
  const trimmed = toTrimmedString(rawAvatar)

  if (!trimmed) {
    return buildGeneratedAvatar(label, seedIndex)
  }

  if (trimmed.startsWith("data:image/")) {
    return trimmed
  }

  if (trimmed.startsWith("blob:") || trimmed.startsWith("file:")) {
    return DEFAULT_AVATAR_URL
  }

  return sanitizeAvatarUrl(trimmed, DEFAULT_AVATAR_URL)
}

const createBasePerson = (person, index = 0) => {
  const username = normalizeUsername(person?.username || person?.creatorUsername)
  const name = pickDisplayName(person)

  return {
    id: String(person?.id || person?.profileId || username || `person-${index}`),
    profileId: person?.profileId || person?.id || "",
    routeKey: username || person?.profileId || person?.id || "",
    name,
    username,
    avatar: resolveAvatar(
      person?.image || person?.avatar || person?.avatar_url || person?.creatorAvatar,
      name,
      index
    ),
    bio: toTrimmedString(person?.bio),
    location: toTrimmedString(person?.location),
  }
}

const buildCreatorStatMap = (events) => {
  const statsByKey = new Map()

  ;(events || []).forEach((event) => {
    const keys = [
      event?.createdBy ? `id:${event.createdBy}` : "",
      event?.creatorUsername ? `username:${normalizeUsername(event.creatorUsername)}` : "",
    ].filter(Boolean)

    if (keys.length === 0) return

    const nextStat = {
      createdCount: 1,
      totalGoing: Number(event?.goingCount || 0),
      featuredTitle: toTrimmedString(event?.title || event?.name),
      featuredMeta: [event?.date, event?.locationName || event?.location]
        .filter(Boolean)
        .join(" • "),
      event: event,
      eventId: String(event?.id || ""),
    }

    keys.forEach((key) => {
      const current = statsByKey.get(key)

      if (!current) {
        statsByKey.set(key, nextStat)
        return
      }

      statsByKey.set(key, {
        createdCount: current.createdCount + 1,
        totalGoing: current.totalGoing + nextStat.totalGoing,
        featuredTitle: current.featuredTitle || nextStat.featuredTitle,
        featuredMeta: current.featuredMeta || nextStat.featuredMeta,
        event: current.event || nextStat.event,
        eventId: current.eventId || nextStat.eventId,
      })
    })
  })

  return statsByKey
}

const getStatsForPerson = (person, statMap) =>
  statMap.get(`id:${person.profileId}`) ||
  statMap.get(`username:${person.username}`) || {
    createdCount: 0,
    totalGoing: 0,
    featuredTitle: "",
    featuredMeta: "",
  }

const buildRelation = (current, next) => {
  if (!current) return next
  if (current === next) return current

  const pair = new Set([current, next])
  if (pair.has("following") && pair.has("follower")) return "mutual"
  if (pair.has("mutual")) return "mutual"
  if (pair.has("following")) return "following"
  if (pair.has("follower")) return "follower"
  if (pair.has("creator")) return "creator"
  return next
}

const upsertPerson = (collection, person, relation, statMap) => {
  const key = getStoryKey(person)
  if (!key) return

  const base = createBasePerson(person, collection.size)
  const current = collection.get(key)
  const stats = getStatsForPerson(base, statMap)

  collection.set(key, {
    ...current,
    ...base,
    // Safely preserve rich profile data instead of overwriting with empty event fields
    bio: base.bio || current?.bio || "",
    location: base.location || current?.location || "",
    name: base.name !== "Campus User" ? base.name : current?.name || base.name,
    username: base.username || current?.username || "",
    avatar: base.avatar && base.avatar !== DEFAULT_AVATAR_URL && !String(base.avatar).startsWith("data:image/svg+xml") ? base.avatar : current?.avatar || base.avatar,
    ...stats,
    relation: buildRelation(current?.relation, relation),
  })
}

const buildPlaceholderPeople = (count, startIndex = 0) =>
  PLACEHOLDER_PEOPLE.slice(0, count).map((person, index) => ({
    ...createBasePerson(
      {
        ...person,
        id: person.id,
        image: buildGeneratedAvatar(person.name, startIndex + index),
      },
      startIndex + index
    ),
    relation: "suggested",
    createdCount: 0,
    totalGoing: 0,
    featuredTitle: "",
    featuredMeta: person.location,
    bio: person.bio,
    location: person.location,
    canToggleFollow: false,
    isPlaceholder: true,
  }))

const dedupePeople = (items) => {
  const seen = new Set()
  return items.filter((item) => {
    const key = getStoryKey(item)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export const buildDiscoverStoryItems = ({
  currentUser,
}) => {
  const currentStory = {
    ...createBasePerson(
      {
        id: currentUser?.id,
        username: currentUser?.username,
        name: currentUser?.name,
        image: currentUser?.image || currentUser?.avatar,
      },
      0
    ),
    kind: "current",
    seen: false,
    meta: "Share",
  }

  return [currentStory]
}

export const buildDiscoverFriendCards = ({
  currentUser,
  followingList,
  followersList,
  allEvents,
}) => {
  const stats = buildCreatorStatMap(allEvents)
  const people = new Map()
  const currentKey = String(currentUser?.id || currentUser?.username || "")

  ;(followingList || []).forEach((person) => upsertPerson(people, person, "following", stats))
  ;(followersList || []).forEach((person) => upsertPerson(people, person, "follower", stats))
  ;(allEvents || []).forEach((event) =>
    upsertPerson(
      people,
      {
        id: event?.createdBy,
        username: event?.creatorUsername,
        name: event?.creatorName,
        image: event?.creatorAvatar,
      },
      "creator",
      stats
    )
  )

  const realCards = dedupePeople([...people.values()])
    .filter((person) => getStoryKey(person) !== currentKey)
    .map((person, index) => {
      const badge =
        person.relation === "mutual"
          ? "In Your Circle"
          : person.relation === "following"
            ? "Following"
            : person.relation === "follower"
              ? "Follows You"
              : person.createdCount > 0
                ? "Campus Host"
                : "Suggested"
      const highlightTitle =
        person.featuredTitle ||
        (person.createdCount > 0
          ? `${person.createdCount} campus event${person.createdCount > 1 ? "s" : ""}`
          : "Worth keeping on your radar")
      const highlightMeta =
        person.featuredMeta ||
        (person.totalGoing > 0 ? `${person.totalGoing} people showing interest` : "Student energy nearby")

      return {
        ...person,
        badge,
        headline: highlightTitle,
        context:
          person.bio ||
          (person.createdCount > 0
            ? `Created ${person.createdCount} event${person.createdCount > 1 ? "s" : ""} with ${person.totalGoing} total people showing interest.`
            : "A good follow for campus plans, social momentum, and who is moving around the scene."),
        metaItems: [
          person.username ? `@${person.username}` : "",
          highlightMeta,
          person.relation === "mutual" ? "Mutual energy" : "",
        ].filter(Boolean),
        canToggleFollow: Boolean(person.profileId),
        isPlaceholder: false,
        featured: index === 0,
      }
    })

  const placeholderCards = buildPlaceholderPeople(
    Math.max(FRIEND_CARD_MIN_ITEMS - realCards.length, 0),
    realCards.length + 2
  ).map((person, index) => ({
    ...person,
    badge: "Suggested",
    headline: person.location || "Campus pick",
    context: person.bio,
    metaItems: [person.username ? `@${person.username}` : "", "Suggested account"].filter(Boolean),
    canToggleFollow: false,
    featured: realCards.length === 0 && index === 0,
  }))

  return [...realCards, ...placeholderCards]
}
