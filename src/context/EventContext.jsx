import React, { createContext, useContext, useState } from "react"

const EventContext = createContext()

const starterEvents = [
  {
    id: 1,
    title: "Campus Party",
    location: "Student Center Ballroom",
    date: "April 10",
    price: "Free",
    rsvp: "42 Going",
    image:
      "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: 2,
    title: "Hackathon Night",
    location: "Engineering Building",
    date: "April 15",
    price: "Free",
    rsvp: "85 Going",
    image:
      "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: 3,
    title: "Basketball Game",
    location: "UMES Arena",
    date: "April 20",
    price: "$10",
    rsvp: "120 Going",
    image:
      "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: 4,
    title: "Spring Mixer",
    location: "Student Union",
    date: "April 25",
    price: "Free",
    rsvp: "60 Going",
    image:
      "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=900&q=80",
  },
]

export function EventProvider({ children }) {
  const [savedEvents, setSavedEvents] = useState([])
  const [allEvents, setAllEvents] = useState(starterEvents)

  const addEvent = (event) => {
    setSavedEvents((prev) => {
      const exists = prev.find((e) => e.id === event.id)
      if (exists) return prev
      return [...prev, event]
    })
  }

  const createEvent = (event) => {
    setAllEvents((prev) => [event, ...prev])
  }

  return (
    <EventContext.Provider
      value={{
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