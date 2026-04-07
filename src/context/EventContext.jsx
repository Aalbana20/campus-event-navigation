import React, { createContext, useContext, useEffect, useMemo, useState } from "react"
import { supabase } from "../supabaseClient"

const EventContext = createContext()

const defaultFollowing = [
  { id: "u-jordan", username: "jordan", name: "Jordan", image: "/default-avatar.png" },
  { id: "u-taylor", username: "taylor", name: "Taylor", image: "/default-avatar.png" },
  { id: "u-morgan", username: "morgan", name: "Morgan", image: "/default-avatar.png" },
  { id: "u-alex", username: "alex", name: "Alex", image: "/default-avatar.png" },
]

const defaultFollowers = [
  { id: "u-taylor", username: "taylor", name: "Taylor", image: "/default-avatar.png" },
  { id: "u-morgan", username: "morgan", name: "Morgan", image: "/default-avatar.png" },
  { id: "u-riley", username: "riley", name: "Riley", image: "/default-avatar.png" },
  { id: "u-quinn", username: "quinn", name: "Quinn", image: "/default-avatar.png" },
]

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

export function EventProvider({ children }) {
  const [currentUser] = useState(() => {
    const stored = JSON.parse(localStorage.getItem("user") || "{}")

    return {
      id: stored.id || "current-user",
      username: stored.username || "itzmesuccess1",
      name: stored.name || "Success Myers",
      image: stored.image || stored.avatar || "/default-avatar.png",
    }
  })

  const [savedEvents, setSavedEvents] = useState([])
  const [allEvents, setAllEvents] = useState([])
  const [followingList] = useState(defaultFollowing)
  const [followersList] = useState(defaultFollowers)

  useEffect(() => {
    const userId = JSON.parse(localStorage.getItem("user") || "{}").id

    const loadData = async () => {
      try {
        const [eventsResult, rsvpsResult] = await Promise.all([
          supabase.from("events").select("*").order("created_at", { ascending: false }),
          userId
            ? supabase.from("rsvps").select("event_id").eq("user_id", userId)
            : Promise.resolve({ data: [], error: null }),
        ])

        if (eventsResult.error) {
          console.error("Failed to load events:", eventsResult.error)
          setAllEvents([])
          setSavedEvents([])
          return
        }

        const eventsData = eventsResult.data || []

        if (eventsData.length === 0) {
          setAllEvents([])
          setSavedEvents([])
          return
        }

        const normalized = eventsData.map((e) =>
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
          })
        )

        setAllEvents(normalized)

        if (rsvpsResult.error) {
          console.error("Failed to load RSVPs:", rsvpsResult.error)
          setSavedEvents([])
          return
        }

        const rsvpedIds = new Set((rsvpsResult.data || []).map((r) => r.event_id))
        const matched = normalized.filter((e) => rsvpedIds.has(e.id))

        setSavedEvents(matched)
      } catch (error) {
        console.error("Failed to load event context:", error)
        setAllEvents([])
        setSavedEvents([])
      }
    }

    loadData()
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

      return [
        ...prev,
        {
          ...normalizedEvent,
          attendees: [...(normalizedEvent.attendees || []), attendee],
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
    const normalizedEvent = normalizeEventTimes(event)

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
      }}
    >
      {children}
    </EventContext.Provider>
  )
}

export function useEvents() {
  return useContext(EventContext)
}
