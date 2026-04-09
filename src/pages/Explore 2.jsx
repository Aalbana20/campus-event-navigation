import React, { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import EventActionControl from "../components/EventActionControl"
import { useEvents } from "../context/EventContext"
import { supabase } from "../supabaseClient"

const suggestedPeopleSeed = [
  {
    id: "explore-nyc-nia",
    username: "niaafterdark",
    name: "Nia Coleman",
    bio: "Concert scout chasing rooftop sets, warehouse parties, and late-night art pop-ups.",
    location: "New York, NY",
    image: "/default-avatar.png",
  },
  {
    id: "explore-philly-mateo",
    username: "mateomoves",
    name: "Mateo Rivera",
    bio: "Finds dance nights, food festivals, and weekend link-ups across new cities.",
    location: "Philadelphia, PA",
    image: "/default-avatar.png",
  },
  {
    id: "explore-atl-jules",
    username: "julesintransit",
    name: "Jules Bennett",
    bio: "Always searching for creative mixers, live music, and people worth following.",
    location: "Atlanta, GA",
    image: "/default-avatar.png",
  },
  {
    id: "explore-la-sage",
    username: "sagefromsunset",
    name: "Sage Carter",
    bio: "Tracks concerts, launch parties, and curated events outside the usual circle.",
    location: "Los Angeles, CA",
    image: "/default-avatar.png",
  },
]

const filters = [
  { id: "all", label: "All" },
  { id: "events", label: "Events" },
  { id: "people", label: "People" },
]

const eventSearchFields = (event) =>
  [event?.title, event?.description, event?.location, event?.organizer]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

const personSearchFields = (person) =>
  [person?.username, person?.name, person?.bio]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

const getPersonKey = (person) => String(person?.id || person?.username || "")

const normalizePerson = (person, index, supportsFollowAction) => ({
  id: person.id || person.username || `person-${index}`,
  username: person.username || `guest-${index}`,
  name: person.name || person.username || "Campus User",
  bio:
    person.bio ||
    "Exploring concerts, parties, pop-ups, and new people outside the usual circle.",
  location: person.location || "New city nearby",
  image: person.image || person.avatar || "/default-avatar.png",
  supportsFollowAction,
})

const buildEventImageStyle = (event) => ({
  backgroundImage: event?.image
    ? `linear-gradient(180deg, rgba(15, 23, 42, 0.14), rgba(15, 23, 42, 0.82)), url(${event.image})`
    : "var(--explore-event-fallback)",
})

function Explore() {
  const navigate = useNavigate()
  const {
    allEvents,
    followingList,
    followersList,
    currentUser,
    savedEvents,
    addEvent,
    follow,
    unfollow,
  } = useEvents()
  const [searchQuery, setSearchQuery] = useState("")
  const [activeFilter, setActiveFilter] = useState("all")
  const [followOverrides, setFollowOverrides] = useState({})
  const [remoteProfileResults, setRemoteProfileResults] = useState({ query: "", items: [] })

  const people = useMemo(() => {
    const fromContext = [...followingList, ...followersList].map((person, index) =>
      normalizePerson(
        {
          ...person,
          bio:
            person.bio ||
            `Always looking for live music, social nights, and standout events around ${person.location || "their city"}.`,
          location:
            person.location || (index % 2 === 0 ? "Baltimore, MD" : "Washington, DC"),
        },
        index,
        true
      )
    )

    const extraPeople = suggestedPeopleSeed.map((person, index) =>
      normalizePerson(person, fromContext.length + index, false)
    )

    const mergedPeople = [...fromContext, ...extraPeople]
    const seen = new Set()

    return mergedPeople.filter((person) => {
      const key = getPersonKey(person)
      const isCurrentUser =
        (currentUser?.id && String(currentUser.id) === key) ||
        (currentUser?.username && currentUser.username === person.username)

      if (isCurrentUser || seen.has(key)) return false

      seen.add(key)
      return true
    })
  }, [currentUser, followersList, followingList])

  const trimmedQuery = searchQuery.trim().toLowerCase()
  const showEvents = activeFilter === "all" || activeFilter === "events"
  const showPeople = activeFilter === "all" || activeFilter === "people"

  useEffect(() => {
    if (!trimmedQuery) {
      return undefined
    }

    let isActive = true

    supabase
      .from("profiles")
      .select("id, name, username, bio")
      .or(`username.ilike.%${trimmedQuery}%,name.ilike.%${trimmedQuery}%`)
      .neq("id", currentUser?.id || "")
      .limit(10)
      .then(({ data }) => {
        if (!isActive) return

        setRemoteProfileResults({
          query: trimmedQuery,
          items: (data || []).map((p) =>
            normalizePerson({ ...p, image: "/default-avatar.png" }, 0, true)
          ),
        })
      })

    return () => {
      isActive = false
    }
  }, [trimmedQuery, currentUser?.id])

  const searchedProfiles = useMemo(() => {
    if (!trimmedQuery) return []
    return remoteProfileResults.query === trimmedQuery ? remoteProfileResults.items : []
  }, [remoteProfileResults, trimmedQuery])

  const savedEventIds = useMemo(
    () => new Set((savedEvents || []).map((event) => String(event.id))),
    [savedEvents]
  )

  const followingKeys = useMemo(() => {
    const keys = new Set()

    followingList.forEach((person) => {
      if (person?.id) keys.add(String(person.id))
      if (person?.username) keys.add(person.username)
    })

    return keys
  }, [followingList])

  const filteredEvents = useMemo(() => {
    if (!trimmedQuery) return []
    return allEvents.filter((event) => eventSearchFields(event).includes(trimmedQuery))
  }, [allEvents, trimmedQuery])

  const filteredPeople = useMemo(() => {
    if (!trimmedQuery) return []
    const localMatches = people.filter((person) => personSearchFields(person).includes(trimmedQuery))
    const localIds = new Set(localMatches.map(getPersonKey))
    const remoteOnly = searchedProfiles.filter((p) => !localIds.has(getPersonKey(p)))
    return [...localMatches, ...remoteOnly]
  }, [people, searchedProfiles, trimmedQuery])

  const suggestedEvents = useMemo(() => allEvents.slice(0, 6), [allEvents])
  const suggestedPeople = useMemo(() => people.slice(0, 6), [people])

  const isEventSaved = (eventId) => savedEventIds.has(String(eventId))

  const isFollowingPerson = (person) => {
    const personKey = getPersonKey(person)

    if (Object.prototype.hasOwnProperty.call(followOverrides, personKey)) {
      return followOverrides[personKey]
    }

    if (person?.id && followingKeys.has(String(person.id))) return true
    if (person?.username && followingKeys.has(person.username)) return true
    return false
  }

  const getEventActionLabel = (event) => {
    if (isEventSaved(event.id)) {
      return (event.goingCount || 0) > 0 ? "Going" : "Added"
    }

    return (event.goingCount || 0) > 0 ? "RSVP" : "Add Event"
  }

  const handleOpenEvent = (eventId) => {
    if (!eventId) return
    navigate(`/events/${eventId}`)
  }

  const handleOpenPerson = (person) => {
    const target =
      person.username && !person.username.startsWith("guest-")
        ? person.username
        : person.id
    if (!target) return
    navigate(`/profile/${target}`)
  }

  const handleEventAction = (event, selectedEvent) => {
    event.stopPropagation()

    if (isEventSaved(selectedEvent.id)) return

    addEvent(
      {
        ...selectedEvent,
        rsvpDate: new Date().toISOString(),
      },
      currentUser
    )
  }

  const handleFollowToggle = async (event, person) => {
    event.stopPropagation()

    const personKey = getPersonKey(person)
    if (!personKey) return

    const nextIsFollowing = !isFollowingPerson(person)

    setFollowOverrides((prev) => ({
      ...prev,
      [personKey]: nextIsFollowing,
    }))

    if (!person.supportsFollowAction || !person.id) return

    if (nextIsFollowing) {
      await follow(person.id)
      return
    }

    await unfollow(person.id)
  }

  const renderEventCard = (event) => {
    const isSaved = isEventSaved(event.id)
    const eventTitle = event?.title || "Untitled Event"

    return (
      <article key={event.id} className="explore-card explore-event-card event-card-shell">
        <EventActionControl event={event} />

        <button
          type="button"
          className="explore-card-main explore-event-main"
          onClick={() => handleOpenEvent(event.id)}
        >
          <div className="explore-event-image" style={buildEventImageStyle(event)}>
            <span className="explore-event-image-label">{eventTitle}</span>
          </div>

          <div className="explore-event-body">
            <div className="explore-event-meta">
              {[event.date, event.location || event.locationAddress, event.organizer]
                .filter(Boolean)
                .join(" · ")}
            </div>

            <p className="explore-event-description">
              {event.description || "A standout event worth discovering outside your usual circle."}
            </p>

            <div className="explore-tag-row">
              {(event.tags?.length ? event.tags.slice(0, 3) : ["Explore"]).map((tag) => (
                <span key={`${event.id}-${tag}`} className="explore-tag">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </button>

        <div className="explore-card-footer">
          <button
            type="button"
            className={`explore-action-btn ${isSaved ? "active" : ""}`}
            onClick={(clickEvent) => handleEventAction(clickEvent, event)}
            aria-pressed={isSaved}
          >
            {getEventActionLabel(event)}
          </button>
        </div>
      </article>
    )
  }

  const renderPersonCard = (person) => {
    const isFollowing = isFollowingPerson(person)

    return (
      <article key={person.id} className="explore-card explore-person-card">
        <button
          type="button"
          className="explore-card-main explore-person-main"
          onClick={() => handleOpenPerson(person)}
        >
          <div className="explore-person-top">
            <div className="explore-person-identity">
              <img
                src={person.image}
                alt={person.name}
                className="explore-avatar"
                onError={(event) => {
                  event.currentTarget.src = "/default-avatar.png"
                }}
              />

              <div className="explore-person-name-wrap">
                <h3 className="explore-person-name">{person.name}</h3>
                <p className="explore-person-username">@{person.username}</p>
              </div>
            </div>

            <span className="explore-person-badge">Suggested</span>
          </div>

          <p className="explore-person-bio">{person.bio}</p>
          <span className="explore-person-location">{person.location}</span>
        </button>

        <div className="explore-card-footer">
          <button
            type="button"
            className={`explore-action-btn ${isFollowing ? "active" : ""}`}
            onClick={(clickEvent) => handleFollowToggle(clickEvent, person)}
            aria-pressed={isFollowing}
          >
            {isFollowing ? "Unfollow" : "Follow"}
          </button>
        </div>
      </article>
    )
  }

  return (
    <main className="explore-page">
      <div className="explore-shell">
        <div className="explore-search-wrap">
          <span aria-hidden="true" className="explore-search-icon">⌕</span>
          <input
            type="text"
            placeholder="Search events or people"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="explore-search-input"
          />
        </div>

        <div className="explore-chip-row">
          {filters.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setActiveFilter(chip.id)}
              className={`explore-chip ${activeFilter === chip.id ? "active" : ""}`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {trimmedQuery ? (
          <section className="explore-section">
            <div className="explore-section-header">
              <h2 className="explore-section-title">Search Results</h2>
              <p className="explore-section-note">
                {activeFilter === "all"
                  ? "Matching events and people"
                  : activeFilter === "events"
                    ? "Matching events"
                    : "Matching people"}
              </p>
            </div>

            {showEvents && (
              <div className="explore-results-group">
                <div className="explore-section-header">
                  <h3 className="explore-section-title">Events</h3>
                  <p className="explore-section-note">{filteredEvents.length} found</p>
                </div>

                {filteredEvents.length > 0 ? (
                  <div className="explore-grid">
                    {filteredEvents.map(renderEventCard)}
                  </div>
                ) : (
                  <p className="explore-empty-state">No events matched that search yet.</p>
                )}
              </div>
            )}

            {showPeople && (
              <div className="explore-results-group">
                <div className="explore-section-header">
                  <h3 className="explore-section-title">People</h3>
                  <p className="explore-section-note">{filteredPeople.length} found</p>
                </div>

                {filteredPeople.length > 0 ? (
                  <div className="explore-people-grid">
                    {filteredPeople.map(renderPersonCard)}
                  </div>
                ) : (
                  <p className="explore-empty-state">No people matched that search yet.</p>
                )}
              </div>
            )}
          </section>
        ) : (
          <>
            {showEvents && (
              <section className="explore-section">
                <div className="explore-section-header">
                  <h2 className="explore-section-title">Suggested Events</h2>
                  <p className="explore-section-note">
                    Fresh ideas outside your usual community feed
                  </p>
                </div>

                {suggestedEvents.length > 0 ? (
                  <div className="explore-grid">
                    {suggestedEvents.map(renderEventCard)}
                  </div>
                ) : (
                  <p className="explore-empty-state">No events to explore yet.</p>
                )}
              </section>
            )}

            {showPeople && (
              <section className="explore-section">
                <div className="explore-section-header">
                  <h2 className="explore-section-title">Suggested People</h2>
                  <p className="explore-section-note">
                    New people who might lead you to your next event
                  </p>
                </div>

                {suggestedPeople.length > 0 ? (
                  <div className="explore-people-grid">
                    {suggestedPeople.map(renderPersonCard)}
                  </div>
                ) : (
                  <p className="explore-empty-state">No people to explore yet.</p>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  )
}

export default Explore
