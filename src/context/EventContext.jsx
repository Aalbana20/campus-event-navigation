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

const defaultAttendeesByEventId = {
  1: [
    { id: "u-taylor", username: "taylor", name: "Taylor", image: "/default-avatar.png" },
    { id: "u-riley", username: "riley", name: "Riley", image: "/default-avatar.png" },
  ],
  2: [
    { id: "u-morgan", username: "morgan", name: "Morgan", image: "/default-avatar.png" },
    { id: "u-cameron", username: "cameron", name: "Cameron", image: "/default-avatar.png" },
  ],
  3: [
    { id: "u-alex", username: "alex", name: "Alex", image: "/default-avatar.png" },
  ],
  4: [],
}

const starterEvents = [
  {
    id: 1,
    title: "Campus Party",
    location: "Student Center Ballroom",
    locationAddress: "Student Center Ballroom, UMES, Princess Anne, MD",
    date: "April 10",
    startTime: "8:00 PM",
    endTime: "11:00 PM",
    time: "8:00 PM - 11:00 PM",
    price: "Free",
    rsvp: "42 Going",
    description:
      "A fun campus party with music, food, and student activities. Come meet new people and enjoy the night.",
    organizer: "Student Activities Board",
    dressCode: "Casual",
    image:
      "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: 2,
    title: "Hackathon Night",
    location: "Engineering Building",
    locationAddress: "Engineering Building, UMES, Princess Anne, MD",
    date: "April 15",
    startTime: "6:00 PM",
    endTime: "12:00 AM",
    time: "6:00 PM - 12:00 AM",
    price: "Free",
    rsvp: "85 Going",
    description:
      "Join other students for a late-night coding event with team challenges, problem solving, and prizes.",
    organizer: "Computer Science Club",
    dressCode: "Comfortable",
    image:
      "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: 3,
    title: "Basketball Game",
    location: "UMES Arena",
    locationAddress: "UMES Arena, Princess Anne, MD",
    date: "April 20",
    startTime: "7:00 PM",
    endTime: "",
    time: "7:00 PM",
    price: "$10",
    rsvp: "120 Going",
    description:
      "Come support the team and enjoy a high-energy basketball game with the campus community.",
    organizer: "UMES Athletics",
    dressCode: "School Spirit Wear",
    image:
      "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: 4,
    title: "Spring Mixer",
    location: "Student Union",
    locationAddress: "Student Union, UMES, Princess Anne, MD",
    date: "April 25",
    startTime: "5:30 PM",
    endTime: "8:30 PM",
    time: "5:30 PM - 8:30 PM",
    price: "Free",
    rsvp: "60 Going",
    description:
      "Relax, connect, and enjoy music and refreshments at this spring social mixer.",
    organizer: "Campus Life Office",
    dressCode: "Smart Casual",
    image:
      "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=900&q=80",
  },
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

const createStarterEvents = () =>
  starterEvents.map((event) => {
    const attendees = defaultAttendeesByEventId[event.id] || []
    const normalizedEvent = normalizeEventTimes(event)

    return {
      ...normalizedEvent,
      attendees,
      goingCount:
        attendees.length ||
        Number.parseInt(String(normalizedEvent.rsvp).replace(/\D/g, ""), 10) ||
        0,
    }
  })

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
  const [allEvents, setAllEvents] = useState(createStarterEvents)
  const [followingList] = useState(defaultFollowing)
  const [followersList] = useState(defaultFollowers)

  useEffect(() => {
    supabase
      .from("events")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) { console.error("Failed to load events:", error); return }
        if (!data || data.length === 0) return
        const normalized = data.map((e) =>
          normalizeEventTimes({
            id: e.id,
            title: e.title,
            description: e.description,
            location: e.location,
            locationAddress: e.location_address,
            date: e.date,
            eventDate: e.event_date,
            startTime: e.start_time,
            price: e.price,
            organizer: e.organizer,
            dressCode: e.dress_code,
            image: e.image,
            tags: e.tags || [],
            creatorUsername: e.creator_username,
            goingCount: e.going_count || 0,
            rsvp: `${e.going_count || 0} Going`,
            attendees: [],
          })
        )
        setAllEvents(normalized)
      })
  }, [])

  const addEvent = (event, attendeeUser) => {
    const attendee = attendeeUser || currentUser

    setSavedEvents((prev) => {
      const exists = prev.find((e) => e.id === event.id)
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
        if (existingEvent.id !== event.id) return existingEvent

        const attendees = existingEvent.attendees || []
        const alreadyGoing = attendees.some((person) => usersMatch(person, attendee))
        if (alreadyGoing) return existingEvent

        const nextAttendees = [...attendees, attendee]

        return {
          ...existingEvent,
          attendees: nextAttendees,
          goingCount: nextAttendees.length,
          rsvp: `${nextAttendees.length} Going`,
        }
      })
    )
  }

  const createEvent = (event) => {
    const normalizedEvent = normalizeEventTimes(event)

    setAllEvents((prev) => [
      {
        ...normalizedEvent,
        attendees: normalizedEvent.attendees || [],
        goingCount: normalizedEvent.goingCount || 0,
      },
      ...prev,
    ])
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
      }}
    >
      {children}
    </EventContext.Provider>
  )
}

export function useEvents() {
  return useContext(EventContext)
}