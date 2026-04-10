import React, { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import ExploreEventModal from "../components/ExploreEventModal"
import ExploreEventTile from "../components/ExploreEventTile"
import { useEvents } from "../context/EventContext"
import { DEFAULT_AVATAR_URL, sanitizeAvatarUrl } from "../profileMedia"
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

const EXPLORE_SECTION_DEFINITIONS = [
  {
    id: "discover",
    eyebrow: "Featured",
    title: "Discover",
    note: "Curated event picks with strong momentum right now.",
    select: (events) => sortEventsByMomentum(events),
  },
  {
    id: "nearby",
    eyebrow: "Local",
    title: "Nearby",
    note: "Things happening around campus and your usual orbit.",
    select: (events) => {
      const nearbyMatches = events.filter((event) =>
        includesAny(getEventDiscoveryFields(event), [
          "princess anne",
          "campus",
          "student center",
          "quad",
          "arena",
          "library",
          "arts",
          "center",
        ])
      )

      return nearbyMatches.length > 0 ? sortEventsByMomentum(nearbyMatches) : sortEventsByMomentum(events)
    },
  },
  {
    id: "sports",
    eyebrow: "Energy",
    title: "Sports",
    note: "Games, runs, wellness drops, and campus competition.",
    select: (events) =>
      sortEventsByMomentum(
        events.filter((event) =>
          includesAny(getEventDiscoveryFields(event), [
            "sports",
            "game",
            "basketball",
            "football",
            "soccer",
            "run",
            "wellness",
            "athletic",
          ])
        )
      ),
  },
  {
    id: "movies",
    eyebrow: "Watch",
    title: "Movies & Film",
    note: "Screenings, film nights, and cozy watch plans.",
    select: (events) =>
      sortEventsByMomentum(
        events.filter((event) =>
          includesAny(getEventDiscoveryFields(event), [
            "movie",
            "film",
            "screening",
            "cinema",
            "watch",
          ])
        )
      ),
  },
  {
    id: "creative",
    eyebrow: "Creative",
    title: "Music & Arts",
    note: "Open mics, showcases, concerts, and art-forward hangs.",
    select: (events) =>
      sortEventsByMomentum(
        events.filter((event) =>
          includesAny(getEventDiscoveryFields(event), [
            "music",
            "concert",
            "dj",
            "creative",
            "arts",
            "art",
            "open mic",
            "poetry",
            "showcase",
          ])
        )
      ),
  },
  {
    id: "social",
    eyebrow: "Social",
    title: "Parties & Mixers",
    note: "Loose, social plans for meeting people outside your usual circle.",
    select: (events) =>
      sortEventsByMomentum(
        events.filter((event) =>
          includesAny(getEventDiscoveryFields(event), [
            "party",
            "social",
            "nightlife",
            "mixer",
            "brunch",
            "rooftop",
            "afterparty",
          ])
        )
      ),
  },
  {
    id: "networking",
    eyebrow: "Connect",
    title: "Networking",
    note: "Career-minded, founder, and community-building events.",
    select: (events) =>
      sortEventsByMomentum(
        events.filter((event) =>
          includesAny(getEventDiscoveryFields(event), [
            "networking",
            "career",
            "founder",
            "startup",
            "professional",
            "mixer",
            "community",
          ])
        )
      ),
  },
]

const eventSearchFields = (event) =>
  [
    event?.title,
    event?.description,
    event?.location,
    event?.locationName,
    event?.locationAddress,
    event?.organizer,
    ...(event?.tags || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

const getEventDiscoveryFields = (event) => eventSearchFields(event)

const personSearchFields = (person) =>
  [person?.username, person?.name, person?.bio, person?.location]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

const getPersonKey = (person) => String(person?.id || person?.username || "")

const includesAny = (value, keywords) => keywords.some((keyword) => value.includes(keyword))

const sortEventsByMomentum = (events) =>
  [...events].sort((left, right) => {
    const rightScore = Number(right?.goingCount || 0) + Number(right?.repostedByIds?.length || 0) * 3
    const leftScore = Number(left?.goingCount || 0) + Number(left?.repostedByIds?.length || 0) * 3
    return rightScore - leftScore
  })

const normalizePerson = (person, index, supportsFollowAction) => ({
  id: person.id || person.username || `person-${index}`,
  username: person.username || `guest-${index}`,
  name: person.name || person.username || "Campus User",
  bio:
    person.bio ||
    "Exploring concerts, parties, pop-ups, and new people outside the usual circle.",
  location: person.location || "New city nearby",
  image: sanitizeAvatarUrl(person.image || person.avatar || person.avatar_url, DEFAULT_AVATAR_URL),
  supportsFollowAction,
})

const buildCuratedSections = (events, limit = 6) => {
  const seen = new Set()

  return EXPLORE_SECTION_DEFINITIONS.map((section) => {
    const items = section
      .select(events)
      .filter((event) => {
        const key = String(event?.id || "")
        if (!key || seen.has(key)) return false
        seen.add(key)
        return true
      })
      .slice(0, limit)

    return {
      ...section,
      items,
    }
  }).filter((section) => section.items.length > 0)
}

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
  const [expandedEvent, setExpandedEvent] = useState(null)
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

  useEffect(() => {
    if (!trimmedQuery) {
      return undefined
    }

    let isActive = true

    supabase
      .from("profiles")
      .select("id, name, username, bio, avatar_url")
      .or(`username.ilike.%${trimmedQuery}%,name.ilike.%${trimmedQuery}%`)
      .neq("id", currentUser?.id || "")
      .limit(10)
      .then(({ data }) => {
        if (!isActive) return

        setRemoteProfileResults({
          query: trimmedQuery,
          items: (data || []).map((profile, index) => normalizePerson(profile, index, true)),
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

  const discoverableEvents = useMemo(
    () =>
      sortEventsByMomentum(
        (allEvents || []).filter(
          (event) =>
            !event?.isPrivate && String(event?.createdBy || "") !== String(currentUser?.id || "")
        )
      ),
    [allEvents, currentUser?.id]
  )

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
    return discoverableEvents.filter((event) => eventSearchFields(event).includes(trimmedQuery))
  }, [discoverableEvents, trimmedQuery])

  const filteredPeople = useMemo(() => {
    if (!trimmedQuery) return []

    const localMatches = people.filter((person) => personSearchFields(person).includes(trimmedQuery))
    const localIds = new Set(localMatches.map(getPersonKey))
    const remoteOnly = searchedProfiles.filter((person) => !localIds.has(getPersonKey(person)))

    return [...localMatches, ...remoteOnly]
  }, [people, searchedProfiles, trimmedQuery])

  const curatedSections = useMemo(
    () => buildCuratedSections(discoverableEvents),
    [discoverableEvents]
  )

  function isEventSaved(eventId) {
    return savedEventIds.has(String(eventId))
  }

  function isFollowingPerson(person) {
    const personKey = getPersonKey(person)

    if (Object.prototype.hasOwnProperty.call(followOverrides, personKey)) {
      return followOverrides[personKey]
    }

    if (person?.id && followingKeys.has(String(person.id))) return true
    if (person?.username && followingKeys.has(person.username)) return true
    return false
  }

  const suggestedPeople = [...people]
    .sort((left, right) => Number(isFollowingPerson(left)) - Number(isFollowingPerson(right)))

  function getEventActionLabel(event) {
    if (isEventSaved(event.id)) {
      return (event.goingCount || 0) > 0 ? "Going" : "Added"
    }

    return (event.goingCount || 0) > 0 ? "RSVP" : "Add Event"
  }

  function handleOpenPerson(person) {
    const target =
      person.username && !person.username.startsWith("guest-")
        ? person.username
        : person.id

    if (!target) return
    navigate(`/profile/${target}`)
  }

  function handleEventAction(selectedEvent) {
    if (isEventSaved(selectedEvent.id)) return

    addEvent(
      {
        ...selectedEvent,
        rsvpDate: new Date().toISOString(),
      },
      currentUser
    )
  }

  async function handleFollowToggle(event, person) {
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

  function renderEventTiles(events) {
    return (
      <div className="explore-tile-grid">
        {events.map((event) => (
          <ExploreEventTile key={event.id} event={event} onOpen={setExpandedEvent} />
        ))}
      </div>
    )
  }

  function renderPersonCard(person) {
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

  function renderSectionHeader({ eyebrow, title, note }) {
    return (
      <div className="explore-section-header">
        <div className="explore-section-copy">
          <p className="explore-section-eyebrow">{eyebrow}</p>
          <h2 className="explore-section-title">{title}</h2>
        </div>
        <p className="explore-section-note">{note}</p>
      </div>
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
            onChange={(event) => {
              setExpandedEvent(null)
              setSearchQuery(event.target.value)
            }}
            className="explore-search-input"
          />
        </div>

        <p className="explore-search-caption">
          Browse more at once in the grid, then open any tile to see the full event details.
        </p>

        <div className="explore-feed">
          {trimmedQuery ? (
            <>
              {renderSectionHeader({
                eyebrow: "Results",
                title: "Search Results",
                note: `Matching events and people for "${searchQuery.trim()}"`,
              })}

              <div className="explore-results-group">
                {renderSectionHeader({
                  eyebrow: "Events",
                  title: "Matching Events",
                  note: `${filteredEvents.length} found`,
                })}

                {filteredEvents.length > 0 ? (
                  renderEventTiles(filteredEvents)
                ) : (
                  <p className="explore-empty-state">No events matched that search yet.</p>
                )}
              </div>

              <div className="explore-results-group">
                {renderSectionHeader({
                  eyebrow: "People",
                  title: "Matching People",
                  note: `${filteredPeople.length} found`,
                })}

                {filteredPeople.length > 0 ? (
                  <div className="explore-people-grid">
                    {filteredPeople.map(renderPersonCard)}
                  </div>
                ) : (
                  <p className="explore-empty-state">No people matched that search yet.</p>
                )}
              </div>
            </>
          ) : (
            <>
              {curatedSections.map((section) => (
                <section className="explore-section" key={section.id}>
                  {renderSectionHeader(section)}
                  {renderEventTiles(section.items)}
                </section>
              ))}

              <section className="explore-section">
                {renderSectionHeader({
                  eyebrow: "People",
                  title: "People to Follow",
                  note: "Profiles that can lead you to your next favorite plan.",
                })}

                {suggestedPeople.length > 0 ? (
                  <div className="explore-people-grid">
                    {suggestedPeople.slice(0, 4).map(renderPersonCard)}
                  </div>
                ) : (
                  <p className="explore-empty-state">No people to explore yet.</p>
                )}
              </section>
            </>
          )}
        </div>
      </div>

      <ExploreEventModal
        event={expandedEvent}
        isSaved={expandedEvent ? isEventSaved(expandedEvent.id) : false}
        actionLabel={expandedEvent ? getEventActionLabel(expandedEvent) : "Add Event"}
        onAction={() => expandedEvent && handleEventAction(expandedEvent)}
        onClose={() => setExpandedEvent(null)}
      />
    </main>
  )
}

export default Explore
