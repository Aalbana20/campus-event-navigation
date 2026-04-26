import { DEFAULT_AVATAR_URL, sanitizeAvatarUrl } from "./profileMedia"
import { supabase } from "./supabaseClient"

export const DAY_MS = 24 * 60 * 60 * 1000
export const TIMELINE_WINDOW_DAYS = 14

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

export const toTrimmedString = (value) =>
  typeof value === "string" ? value.trim() : ""

export const parseClockTime = (value) => {
  const trimmed = toTrimmedString(value)
  if (!trimmed) return { hours: 0, minutes: 0 }

  const twelveHour = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i)
  if (twelveHour) {
    let hours = Number(twelveHour[1])
    const minutes = Number(twelveHour[2] || 0)
    const marker = twelveHour[3].toLowerCase()
    if (marker === "pm" && hours < 12) hours += 12
    if (marker === "am" && hours === 12) hours = 0
    return { hours, minutes }
  }

  const twentyFourHour = trimmed.match(/^(\d{1,2})(?::(\d{2}))?/)
  if (twentyFourHour) {
    return {
      hours: Math.min(23, Number(twentyFourHour[1] || 0)),
      minutes: Math.min(59, Number(twentyFourHour[2] || 0)),
    }
  }

  return { hours: 0, minutes: 0 }
}

const parseEventDateOnly = (event) => {
  const rawDate = event?.eventDate || event?.date
  if (!rawDate || typeof rawDate !== "string") return null

  const isoMatch = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]))
  }

  const monthDayMatch = rawDate.match(/^([A-Za-z]+)\s+(\d{1,2})$/)
  if (monthDayMatch) {
    const month = MONTH_NAMES.findIndex((name) => name === monthDayMatch[1])
    if (month < 0) return null
    return new Date(new Date().getFullYear(), month, Number(monthDayMatch[2]))
  }

  const parsed = new Date(rawDate)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

export const getEventStartDate = (event) => {
  const start = parseEventDateOnly(event)
  if (!start) return null

  const time = parseClockTime(event?.startTime || event?.time)
  start.setHours(time.hours, time.minutes, 0, 0)
  return start
}

export const getEventEndDate = (event, start) => {
  const end = new Date(start)
  const endClock = parseClockTime(event?.endTime)

  if (event?.endTime) {
    end.setHours(endClock.hours, endClock.minutes, 0, 0)
    if (end <= start) end.setDate(end.getDate() + 1)
    return end
  }

  end.setHours(start.getHours() + 6)
  return end
}

export const isEventRecapEligible = (event, now = new Date()) => {
  const start = getEventStartDate(event)
  return Boolean(start && start <= now)
}

export const startOfLocalDay = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate())

export const toDateKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`

export const dateFromKey = (key) => {
  const [year, month, day] = key.split("-").map(Number)
  return new Date(year, month - 1, day)
}

export const formatTimelineDateLabel = (date, todayKey) => {
  const dateLabel = date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  })
  if (toDateKey(date) === todayKey) return `Today — ${dateLabel}`
  return `${date.toLocaleDateString("en-US", { weekday: "long" })} — ${dateLabel}`
}

export const formatEventDateTime = (event, startDate) => {
  const dateLabel = startDate
    ? startDate.toLocaleDateString("en-US", { month: "long", day: "numeric" })
    : event?.date || ""
  const timeLabel = [event?.startTime || event?.time, event?.endTime]
    .filter(Boolean)
    .join(" - ")
  return [dateLabel, timeLabel].filter(Boolean).join(" • ")
}

export const formatRelativeTime = (dateInput) => {
  const date = new Date(dateInput)
  if (Number.isNaN(date.getTime())) return "now"

  const diffMs = Date.now() - date.getTime()
  const minutes = Math.floor(diffMs / 60000)
  const hours = Math.floor(diffMs / 3600000)
  const days = Math.floor(diffMs / 86400000)

  if (minutes < 60) return `${Math.max(1, minutes)}m`
  if (hours < 24) return `${hours}h`
  if (days < 30) return `${days}d`
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export const groupEventMemoriesIntoRecapPosts = (memories = []) => {
  const postsById = new Map()

  memories.forEach((memory) => {
    const metadata = memory.metadata && typeof memory.metadata === "object" ? memory.metadata : {}
    const recapPostId = toTrimmedString(metadata.recapPostId) || memory.id
    const mediaItem = { id: memory.id, url: memory.mediaUrl }
    const existing = postsById.get(recapPostId)

    if (existing) {
      existing.media.push(mediaItem)
      if (new Date(memory.createdAt).getTime() > new Date(existing.createdAt).getTime()) {
        existing.createdAt = memory.createdAt
      }
      if (!existing.caption && memory.caption) existing.caption = memory.caption
      return
    }

    postsById.set(recapPostId, {
      id: recapPostId,
      source: "memory",
      authorId: memory.authorId,
      authorName: memory.authorName,
      authorUsername: memory.authorUsername,
      authorAvatar: memory.authorAvatar,
      caption: memory.caption || "",
      createdAt: memory.createdAt,
      media: [mediaItem],
    })
  })

  return [...postsById.values()].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  )
}

export const loadRecapCommentPosts = async ({ eventId, viewerId }) => {
  if (!eventId) return []

  const { data: authData } = await supabase.auth.getUser()
  const resolvedViewerId = authData?.user?.id ? String(authData.user.id) : viewerId

  const { data, error } = await supabase
    .from("event_comments")
    .select("id, user_id, body, parent_id, created_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })

  if (error) {
    console.warn("Unable to load recap comments:", error)
    return []
  }

  const rows = data || []
  const commentIds = rows.map((row) => String(row.id)).filter(Boolean)
  const authorIds = [...new Set(rows.map((row) => toTrimmedString(row.user_id)).filter(Boolean))]

  const profileById = new Map()
  if (authorIds.length > 0) {
    const { data: profileRows, error: profileError } = await supabase
      .from("profiles")
      .select("id, name, username, avatar_url")
      .in("id", authorIds)

    if (profileError) {
      console.warn("Unable to load recap comment authors:", profileError)
    } else {
      ;(profileRows || []).forEach((profile) => {
        profileById.set(String(profile.id), profile)
      })
    }
  }

  const likeCountByComment = new Map()
  const likedByMe = new Set()
  if (commentIds.length > 0) {
    const { data: likeRows, error: likeError } = await supabase
      .from("event_comment_likes")
      .select("comment_id, user_id")
      .in("comment_id", commentIds)

    if (likeError) {
      console.warn("Unable to load recap comment likes:", likeError)
    } else {
      ;(likeRows || []).forEach((row) => {
        const commentId = String(row.comment_id)
        likeCountByComment.set(commentId, (likeCountByComment.get(commentId) || 0) + 1)
        if (resolvedViewerId && String(row.user_id) === String(resolvedViewerId)) {
          likedByMe.add(commentId)
        }
      })
    }
  }

  return rows.map((row) => {
    const commentId = String(row.id)
    const authorId = toTrimmedString(row.user_id)
    const profile = authorId ? profileById.get(authorId) : null
    return {
      id: `comment-${commentId}`,
      source: "comment",
      commentId,
      authorId,
      authorName: toTrimmedString(profile?.name) || toTrimmedString(profile?.username) || "Campus User",
      authorUsername: toTrimmedString(profile?.username),
      authorAvatar: sanitizeAvatarUrl(profile?.avatar_url, DEFAULT_AVATAR_URL),
      caption: toTrimmedString(row.body),
      createdAt: row.created_at || new Date().toISOString(),
      media: [],
      likeCount: likeCountByComment.get(commentId) || 0,
      likedByMe: likedByMe.has(commentId),
    }
  })
}

export const postTextRecap = async ({ eventId, userId, body }) => {
  if (!eventId || !userId || !toTrimmedString(body)) {
    throw new Error("Write something before posting.")
  }

  const { error } = await supabase.from("event_comments").insert({
    event_id: eventId,
    user_id: userId,
    body: toTrimmedString(body),
    parent_id: null,
  })

  if (error) throw error
}

export const toggleCommentRecapLike = async ({ commentId, liked }) => {
  if (!commentId) return
  const { data: authData } = await supabase.auth.getUser()
  const userId = authData?.user?.id ? String(authData.user.id) : ""
  if (!userId) return

  const { error } = liked
    ? await supabase.from("event_comment_likes").insert({ comment_id: commentId, user_id: userId })
    : await supabase
        .from("event_comment_likes")
        .delete()
        .eq("comment_id", commentId)
        .eq("user_id", userId)

  if (error && error.code !== "23505") throw error
}
