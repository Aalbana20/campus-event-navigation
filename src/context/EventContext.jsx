import React, { createContext, useContext, useEffect, useMemo, useState } from "react"
import {
  DEFAULT_AVATAR_URL,
  resolveCreatorIdentity,
  sanitizeAvatarUrl,
} from "../profileMedia"
import { supabase } from "../supabaseClient"

const EventContext = createContext()

const normalizeUsername = (value = "") =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, "")
    .replace(/^[._]+|[._]+$/g, "")

const readStoredUser = () => {
  const stored = JSON.parse(localStorage.getItem("user") || "{}")
  const image = sanitizeAvatarUrl(
    stored.avatarStorageValue ||
      stored.avatarUrl ||
      stored.avatar_url ||
      stored.image ||
      stored.avatar,
    DEFAULT_AVATAR_URL
  )

  return {
    id: stored.id || "current-user",
    username: stored.username || "",
    name: stored.name || "Campus User",
    image,
    avatar: image,
  }
}

const usersMatch = (a, b) => {
  if (!a || !b) return false
  if (a.id && b.id) return a.id === b.id
  if (a.username && b.username) return a.username === b.username
  return false
}

const formatTimeToAmPm = (rawTime) => {
  if (!rawTime) return ""

  const trimmed = String(rawTime).trim()

  if (!trimmed) return ""

  if (/[AaPp][Mm]/.test(trimmed)) {
    return trimmed.toUpperCase().replace(/\s+/g, " ")
  }

  const parts = trimmed.split(":")
  if (parts.length < 2) return trimmed

  let hours = Number(parts[0])
  const minutes = parts[1]

  if (Number.isNaN(hours)) return trimmed

  const suffix = hours >= 12 ? "PM" : "AM"
  hours = hours % 12 || 12

  return `${hours}:${minutes} ${suffix}`
}

const buildTimeLabel = (startTime, endTime) => {
  const formattedStart = formatTimeToAmPm(startTime)
  const formattedEnd = formatTimeToAmPm(endTime)

  if (formattedStart && formattedEnd) return `${formattedStart} - ${formattedEnd}`
  if (formattedStart) return formattedStart
  if (formattedEnd) return formattedEnd
  return ""
}

const normalizeEventTimes = (event) => {
  const startTime = formatTimeToAmPm(event.startTime || event.timeStart || "")
  const endTime = formatTimeToAmPm(event.endTime || event.timeEnd || "")
  const fallbackTime = event.time && !startTime && !endTime ? event.time : ""
  const time = buildTimeLabel(startTime, endTime) || fallbackTime

  return {
    ...event,
    startTime,
    endTime,
    time,
  }
}

const buildProfileLookup = (profiles) =>
  (profiles || []).reduce(
    (lookup, profile) => {
      if (profile?.id) {
        lookup.byId.set(String(profile.id), profile)
      }

      if (profile?.username) {
        lookup.byUsername.set(normalizeUsername(profile.username), profile)
      }

      return lookup
    },
    { byId: new Map(), byUsername: new Map() }
  )

const enrichEventWithCreator = (event, creatorProfile = null, fallbackCreator = null) => {
  const { creatorName, creatorUsername } = resolveCreatorIdentity({
    profileName: creatorProfile?.name,
    profileUsername: creatorProfile?.username,
    eventName: event?.creatorName,
    eventUsername: event?.creatorUsername,
    fallbackName: fallbackCreator?.name,
    fallbackUsername: fallbackCreator?.username,
  })

  return {
    ...event,
    creatorName,
    creatorUsername,
    creatorAvatar: sanitizeAvatarUrl(
      event?.creatorAvatar ||
        creatorProfile?.avatar_url ||
        creatorProfile?.image ||
        creatorProfile?.avatar ||
        fallbackCreator?.image ||
        fallbackCreator?.avatar,
      DEFAULT_AVATAR_URL
    ),
  }
}

export function EventProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(readStoredUser)
  const [refreshToken, setRefreshToken] = useState(0)

  const [savedEvents, setSavedEvents] = useState([])
  const [allEvents, setAllEvents] = useState([])
  const [followingList, setFollowingList] = useState([])
  const [followersList, setFollowersList] = useState([])
  const [repostedEventIds, setRepostedEventIds] = useState(new Set())

  useEffect(() => {
    if (typeof window === "undefined") return undefined

    const syncCurrentUser = () => {
      setCurrentUser(readStoredUser())
      setRefreshToken((currentValue) => currentValue + 1)
    }

    window.addEventListener("storage", syncCurrentUser)
    window.addEventListener("campus-user-storage-updated", syncCurrentUser)

    return () => {
      window.removeEventListener("storage", syncCurrentUser)
      window.removeEventListener("campus-user-storage-updated", syncCurrentUser)
    }
  }, [])

  useEffect(() => {
    const userId =
      currentUser?.id && currentUser.id !== "current-user"
        ? currentUser.id
        : JSON.parse(localStorage.getItem("user") || "{}").id

    const loadData = async () => {
      try {
        const [eventsResult, rsvpsResult, followingResult, followersResult, repostsResult] = await Promise.all([
          supabase.from("events").select("*").order("created_at", { ascending: false }),
          userId
            ? supabase.from("rsvps").select("event_id").eq("user_id", userId)
            : Promise.resolve({ data: [], error: null }),
          userId
            ? supabase.from("follows").select("following_id").eq("follower_id", userId)
            : Promise.resolve({ data: [], error: null }),
          userId
            ? supabase.from("follows").select("follower_id").eq("following_id", userId)
            : Promise.resolve({ data: [], error: null }),
          userId
            ? supabase.from("reposts").select("event_id").eq("user_id", userId)
            : Promise.resolve({ data: [], error: null }),
        ])

        if (eventsResult.error) {
          console.error("Failed to load events:", eventsResult.error)
          setAllEvents([])
          setSavedEvents([])
          return
        }

        const eventsData = eventsResult.data || []

        const creatorIds = [...new Set(eventsData.map((event) => event.created_by).filter(Boolean))]
        const creatorUsernames = [
          ...new Set(
            eventsData
              .map((event) => normalizeUsername(event.creator_username))
              .filter(Boolean)
          ),
        ]

        const [creatorIdResult, creatorUsernameResult] = await Promise.all([
          creatorIds.length > 0
            ? supabase
                .from("profiles")
                .select("id, name, username, avatar_url")
                .in("id", creatorIds)
            : Promise.resolve({ data: [], error: null }),
          creatorUsernames.length > 0
            ? supabase
                .from("profiles")
                .select("id, name, username, avatar_url")
                .in("username", creatorUsernames)
            : Promise.resolve({ data: [], error: null }),
        ])

        const creatorProfiles = [
          ...(creatorIdResult.data || []),
          ...(creatorUsernameResult.data || []),
        ].reduce((collection, profile) => {
          const key = String(profile?.id || profile?.username || "")
          if (!key || collection.some((existingProfile) => String(existingProfile.id || existingProfile.username) === key)) {
            return collection
          }

          collection.push(profile)
          return collection
        }, [])

        const profileLookup = buildProfileLookup(creatorProfiles)

        if (eventsData.length === 0) {
          setAllEvents([])
          setSavedEvents([])
          return
        }

        const normalized = eventsData.map((e) => {
          const creatorProfile =
            profileLookup.byId.get(String(e.created_by || "")) ||
            profileLookup.byUsername.get(normalizeUsername(e.creator_username || ""))

          return enrichEventWithCreator(
            normalizeEventTimes({
              id: e.id,
              title: e.title,
              description: e.description,
              location: e.location,
              locationAddress: e.location_address,
              date: e.date,
              eventDate: e.event_date,
              startTime: e.start_time,
              endTime: e.end_time,
              price: e.price,
              organizer: e.organizer,
              dressCode: e.dress_code,
              image: e.image,
              tags: e.tags || [],
              createdBy: e.created_by,
              created_by: e.created_by,
              creatorUsername: e.creator_username,
              goingCount: e.going_count || 0,
              rsvp: `${e.going_count || 0} Going`,
              attendees: [],
            }),
            creatorProfile
          )
        })

        setAllEvents(normalized)

        if (rsvpsResult.error) {
          console.error("Failed to load RSVPs:", rsvpsResult.error)
          setSavedEvents([])
          return
        }

        const rsvpedIds = new Set((rsvpsResult.data || []).map((r) => r.event_id))
        const matched = normalized.filter((e) => rsvpedIds.has(e.id))

        setSavedEvents(matched)

        setRepostedEventIds(new Set((repostsResult.data || []).map((r) => String(r.event_id))))

        const toUserList = (profiles) =>
          (profiles || []).map((p) => ({
            id: p.id,
            name: p.name || p.username || "User",
            username: p.username || "",
            image: sanitizeAvatarUrl(p.avatar_url, DEFAULT_AVATAR_URL),
          }))

        const followingIds = (followingResult.data || []).map((f) => f.following_id)
        const followerIds = (followersResult.data || []).map((f) => f.follower_id)

        if (followingIds.length > 0) {
          const { data: followingProfiles } = await supabase
            .from("profiles")
            .select("id, name, username, avatar_url")
            .in("id", followingIds)
          setFollowingList(toUserList(followingProfiles))
        }

        if (followerIds.length > 0) {
          const { data: followerProfiles } = await supabase
            .from("profiles")
            .select("id, name, username, avatar_url")
            .in("id", followerIds)
          setFollowersList(toUserList(followerProfiles))
        }
      } catch (error) {
        console.error("Failed to load event context:", error)
        setAllEvents([])
        setSavedEvents([])
      }
    }

    loadData()
  }, [currentUser?.id, refreshToken])

  // Realtime — re-fetch on any remote event change.
  // Requires the events table to have Realtime enabled in Supabase Dashboard → Database → Replication.
  useEffect(() => {
    if (!supabase) return

    const channel = supabase
      .channel('web-events-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events' }, () => {
        setRefreshToken((t) => t + 1)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events' }, () => {
        setRefreshToken((t) => t + 1)
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'events' }, (payload) => {
        const deletedId = payload.old?.id
        if (deletedId) {
          setAllEvents((prev) => prev.filter((e) => String(e.id) !== String(deletedId)))
          setSavedEvents((prev) => prev.filter((e) => String(e.id) !== String(deletedId)))
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const addEvent = (event, attendeeUser) => {
    const attendee = attendeeUser || currentUser

    const userId = JSON.parse(localStorage.getItem("user") || "{}").id
    if (userId && event.id) {
      supabase
        .from("rsvps")
        .insert({ user_id: userId, event_id: event.id })
        .then(({ error }) => {
          if (error && error.code !== "23505") {
            console.error("Failed to save RSVP:", error)
          }
        })
    }

    setSavedEvents((prev) => {
      const exists = prev.find((e) => String(e.id) === String(event.id))
      if (exists) return prev

      const normalizedEvent = normalizeEventTimes(event)
      const enrichedEvent = enrichEventWithCreator(normalizedEvent)

      return [
        ...prev,
        {
          ...enrichedEvent,
          attendees: [...(enrichedEvent.attendees || []), attendee],
        },
      ]
    })

    setAllEvents((prev) =>
      prev.map((existingEvent) => {
        if (String(existingEvent.id) !== String(event.id)) return existingEvent

        const attendees = existingEvent.attendees || []
        const alreadyGoing = attendees.some((person) => usersMatch(person, attendee))
        if (alreadyGoing) return existingEvent

        const nextAttendees = [...attendees, attendee]
        const nextCount = (existingEvent.goingCount || 0) + 1

        return {
          ...existingEvent,
          attendees: nextAttendees,
          goingCount: nextCount,
          rsvp: `${nextCount} Going`,
        }
      })
    )
  }

  const createEvent = (event) => {
    const normalizedEvent = enrichEventWithCreator(
      normalizeEventTimes(event),
      null,
      currentUser
    )

    setAllEvents((prev) => {
      const exists = prev.some(
        (existingEvent) => String(existingEvent.id) === String(normalizedEvent.id)
      )

      if (exists) return prev

      return [
        {
          ...normalizedEvent,
          attendees: normalizedEvent.attendees || [],
          goingCount: normalizedEvent.goingCount || 0,
        },
        ...prev,
      ]
    })
  }

  const cancelRSVP = (eventId) => {
    setSavedEvents((prev) => prev.filter((event) => String(event.id) !== String(eventId)))

    setAllEvents((prev) =>
      prev.map((event) => {
        if (String(event.id) !== String(eventId)) return event

        const nextGoingCount = Math.max((event.goingCount || 1) - 1, 0)

        return {
          ...event,
          goingCount: nextGoingCount,
          rsvp: `${nextGoingCount} Going`,
        }
      })
    )
  }

  const deleteEvent = (eventId) => {
    setAllEvents((prev) => prev.filter((event) => String(event.id) !== String(eventId)))
    setSavedEvents((prev) => prev.filter((event) => String(event.id) !== String(eventId)))
  }

  const updateEvent = (eventId, patch) => {
    const mergeAndNormalize = (existingEvent) => {
      if (String(existingEvent.id) !== String(eventId)) return existingEvent

      const merged = { ...existingEvent, ...patch }
      return enrichEventWithCreator(normalizeEventTimes(merged), null, currentUser)
    }

    setAllEvents((prev) => prev.map(mergeAndNormalize))
    setSavedEvents((prev) => prev.map(mergeAndNormalize))
  }

  const follow = async (targetUserId) => {
    const userId = JSON.parse(localStorage.getItem("user") || "{}").id
    if (!userId) return

    const { error } = await supabase
      .from("follows")
      .insert({ follower_id: userId, following_id: targetUserId })

    if (!error) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, name, username, avatar_url")
        .eq("id", targetUserId)
        .single()

      if (profile) {
        setFollowingList((prev) => [
          ...prev,
          {
            id: profile.id,
            name: profile.name || profile.username || "User",
            username: profile.username || "",
            image: sanitizeAvatarUrl(profile.avatar_url, DEFAULT_AVATAR_URL),
          },
        ])
      }
    }
  }

  const unfollow = async (targetUserId) => {
    const userId = JSON.parse(localStorage.getItem("user") || "{}").id
    if (!userId) return

    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", userId)
      .eq("following_id", targetUserId)

    if (!error) {
      setFollowingList((prev) => prev.filter((p) => p.id !== targetUserId))
    }
  }

  const repostEvent = async (eventId) => {
    const userId = JSON.parse(localStorage.getItem("user") || "{}").id
    if (!userId) return

    const { error } = await supabase
      .from("reposts")
      .insert({ user_id: userId, event_id: eventId })

    if (!error) {
      setRepostedEventIds((prev) => new Set([...prev, String(eventId)]))
    }
  }

  const unrepostEvent = async (eventId) => {
    const userId = JSON.parse(localStorage.getItem("user") || "{}").id
    if (!userId) return

    const { error } = await supabase
      .from("reposts")
      .delete()
      .eq("user_id", userId)
      .eq("event_id", eventId)

    if (!error) {
      setRepostedEventIds((prev) => {
        const next = new Set(prev)
        next.delete(String(eventId))
        return next
      })
    }
  }

  const mutualUsers = useMemo(
    () =>
      followingList.filter((followingPerson) =>
        followersList.some((followerPerson) => usersMatch(followerPerson, followingPerson))
      ),
    [followersList, followingList]
  )

  return (
    <EventContext.Provider
      value={{
        currentUser,
        followingList,
        followersList,
        mutualUsers,
        savedEvents,
        addEvent,
        allEvents,
        createEvent,
        cancelRSVP,
        deleteEvent,
        updateEvent,
        follow,
        unfollow,
        repostedEventIds,
        repostEvent,
        unrepostEvent,
      }}
    >
      {children}
    </EventContext.Provider>
  )
}

export function useEvents() {
  return useContext(EventContext)
}
