import React, { createContext, useContext, useState } from "react"

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

const createStarterEvents = () =>
  starterEvents.map((event) => {
    const attendees = defaultAttendeesByEventId[event.id] || []
    return {
      ...event,
      attendees,
      goingCount:
        attendees.length ||
        Number.parseInt(String(event.rsvp).replace(/\D/g, ""), 10) ||
        0,
    }
  })

const usersMatch = (a, b) => {
  if (!a || !b) return false
  if (a.id && b.id) return a.id === b.id
  if (a.username && b.username) return a.username === b.username
  return false
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
  const [allEvents, setAllEvents] = useState(createStarterEvents)
  const [followingList] = useState(defaultFollowing)
  const [followersList] = useState(defaultFollowers)

  const addEvent = (event, attendeeUser) => {
    const attendee = attendeeUser || currentUser

    setSavedEvents((prev) => {
      const exists = prev.find((e) => e.id === event.id)
      if (exists) return prev

      return [
        ...prev,
        {
          ...event,
          attendees: [...(event.attendees || []), attendee],
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
    setAllEvents((prev) => [
      {
        ...event,
        attendees: event.attendees || [],
        goingCount: event.goingCount || 0,
      },
      ...prev,
    ])
  }

  const mutualUsers = followingList.filter((followingPerson) =>
    followersList.some((followerPerson) => usersMatch(followerPerson, followingPerson))
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