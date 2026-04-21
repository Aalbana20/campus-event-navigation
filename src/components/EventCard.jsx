import React, { useState } from "react"
import { useEvents } from "../context/EventContext"
import { applyEventImageFallback, getEventImageSrc } from "../eventImages"
import { DEFAULT_AVATAR_URL, sanitizeAvatarUrl } from "../profileMedia"
import EventCreatorBadge from "./EventCreatorBadge"

const usersMatch = (a, b) => {
  if (!a || !b) return false
  if (a.id && b.id) return a.id === b.id
  if (a.username && b.username) return a.username === b.username
  return false
}

function EventCard({
  event,
  isSaved = false,
  isActionLocked = false,
  onRsvp,
  onNotGoing,
  onOpenComments,
  onShare,
  commentCount = 0,
}) {
  const { addEvent, cancelRSVP, currentUser, mutualUsers, savedEvents } = useEvents()
  const [flipped, setFlipped] = useState(false)
  const [isMutualsOpen, setIsMutualsOpen] = useState(false)

  const eventTitle = event?.title || event?.name || "Untitled Event"
  const eventDescription = event?.description || event?.details || ""
  const eventOrganizer = event?.organizer || event?.host || event?.organization || ""
  const eventDressCode = event?.dressCode || event?.dress_code || ""
  const eventPrice = event?.price || event?.cost || ""
  const eventTags = Array.isArray(event?.tags) ? event.tags.filter(Boolean) : []
  const displayLocation =
    event.locationName || event.locationAddress || event.location || "No location"
  const displayDate = event?.date || event?.eventDate || "TBD"
  const displayTime =
    event?.time ||
    [event?.startTime, event?.endTime].filter(Boolean).join(" - ") ||
    "TBA"
  const mapsQuery = encodeURIComponent(
    event.locationAddress || event.location || event.locationName || ""
  )
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`
  const hasMapTarget = Boolean(event.locationAddress || event.location || event.locationName)

  const attendeeUsers = event?.attendees || event?.rsvpUsers || event?.goingUsers || []
  const savedEventIds = new Set((savedEvents || []).map((savedEvent) => String(savedEvent.id)))
  const isEventSaved = isSaved || savedEventIds.has(String(event?.id || ""))

  const mutualAttendees = (mutualUsers || []).filter((mutualUser) =>
    attendeeUsers.some((attendee) => usersMatch(attendee, mutualUser))
  )

  const orderedAttendees = (() => {
    const seen = []
    const ordered = []
    const isSeen = (person) => seen.some((known) => usersMatch(known, person))

    mutualAttendees.forEach((person) => {
      if (isSeen(person)) return
      seen.push(person)
      ordered.push(person)
    })
    attendeeUsers.forEach((person) => {
      if (isSeen(person)) return
      seen.push(person)
      ordered.push(person)
    })

    return ordered
  })()

  const visibleAttendees = orderedAttendees.slice(0, 2)
  const goingCount = event?.goingCount ?? attendeeUsers.length ?? 0

  const openMutuals = (eventClick) => {
    eventClick.stopPropagation()
    setIsMutualsOpen(true)
  }

  const closeMutuals = () => {
    setIsMutualsOpen(false)
  }

  const handleFlip = (e) => {
    if (e.target.closest("button") || e.target.closest("a")) return
    setFlipped((currentValue) => !currentValue)
  }

  const handleCardKeyDown = (eventKey) => {
    if (eventKey.key !== "Enter" && eventKey.key !== " ") return
    eventKey.preventDefault()
    setFlipped((currentValue) => !currentValue)
  }

  const handleRsvpClick = (eventClick) => {
    eventClick.stopPropagation()
    if (!event?.id || isActionLocked) return

    if (onRsvp) {
      onRsvp(event)
      return
    }

    if (isEventSaved) {
      cancelRSVP(event.id)
    } else {
      addEvent({ ...event, rsvpDate: new Date().toISOString() }, currentUser)
    }
  }

  const handleNotGoingClick = (eventClick) => {
    eventClick.stopPropagation()
    if (isActionLocked) return

    if (onNotGoing) {
      onNotGoing(event)
      return
    }

    if (event?.id && isEventSaved) {
      cancelRSVP(event.id)
    }
  }

  const handleOpenCommentsClick = (eventClick) => {
    eventClick.stopPropagation()
    onOpenComments?.(event)
  }

  const handleShareClick = (eventClick) => {
    eventClick.stopPropagation()
    onShare?.(event)
  }

  const handleMapClick = (eventClick) => {
    eventClick.stopPropagation()
    if (!hasMapTarget) return
    window.open(mapsUrl, "_blank")
  }

  const handleFlipBack = (eventClick) => {
    eventClick.stopPropagation()
    setFlipped(false)
  }

  return (
    <>
      <div
        className="flip-card event-card-shell"
        onClick={handleFlip}
        onKeyDown={handleCardKeyDown}
        role="button"
        tabIndex={0}
        aria-pressed={flipped}
        aria-label={`${eventTitle} event card`}
      >
        <div className={`flip-card-inner ${flipped ? "flipped" : ""}`}>
          <div className="flip-card-front">
            <img
              src={getEventImageSrc(event?.image)}
              alt={eventTitle}
              className="event-image"
              draggable={false}
              onError={applyEventImageFallback}
            />
            <div className="event-card-front-gradient" />

            <div className="event-card-top-meta">
              <div className="event-card-top-meta-cluster">
                <EventCreatorBadge event={event} className="event-card-creator" compact />

                <button
                  type="button"
                  className="event-card-mutual-inline"
                  onClick={openMutuals}
                  aria-label={`View ${goingCount} people going`}
                >
                  {visibleAttendees.length > 0 ? (
                    <div className="event-card-mutual-inline-avatars">
                      {visibleAttendees.map((person, index) => (
                        <img
                          key={person.id || person.username || index}
                          src={sanitizeAvatarUrl(person.image || person.avatar, DEFAULT_AVATAR_URL)}
                          alt={person.name || "Attendee"}
                          className="event-card-mutual-inline-avatar"
                          onError={(eventClick) => {
                            eventClick.currentTarget.src = DEFAULT_AVATAR_URL
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <span className="event-card-mutual-inline-empty" aria-hidden="true">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <circle
                          cx="9.5"
                          cy="7"
                          r="3"
                          stroke="currentColor"
                          strokeWidth="1.8"
                        />
                        <path
                          d="M23 20v-1a4 4 0 0 0-3-3.87"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M16 3.13a3 3 0 0 1 0 5.74"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  )}
                  <span className="event-card-mutual-inline-count">{goingCount}</span>
                </button>
              </div>
            </div>

            <div className="event-card-info-pills">
              <div className="event-card-info-pill event-card-info-pill-title">{eventTitle}</div>

              <div className="event-card-info-pill">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <rect
                    x="3.75"
                    y="4.75"
                    width="16.5"
                    height="15.5"
                    rx="3.2"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  />
                  <path d="M8 2.8v3.3M16 2.8v3.3M3.75 9.5h16.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
                <span>{displayDate}</span>
              </div>

              <div className="event-card-info-pill">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="8.6" stroke="currentColor" strokeWidth="1.7" />
                  <path d="M12 7.8v4.6l3.2 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>{displayTime}</span>
              </div>
            </div>
          </div>

          <div className="flip-card-back">
            <div className="discover-event-back-shell">
              <div className="discover-event-back-header">
                <div className="discover-event-back-heading-row">
                  <span className="discover-event-back-kicker">Event Details</span>
                  <button
                    type="button"
                    className="discover-event-back-close"
                    onClick={handleFlipBack}
                    aria-label="Show event flyer"
                  >
                    ×
                  </button>
                </div>
                <h2>{eventTitle}</h2>
              </div>

              {eventDescription ? (
                <p className="discover-event-back-description">{eventDescription}</p>
              ) : null}

              <div className="discover-event-back-details">
                <div className="discover-event-back-detail">
                  <span>Date</span>
                  <strong>{displayDate}</strong>
                </div>
                <div className="discover-event-back-detail">
                  <span>Time</span>
                  <strong>{displayTime}</strong>
                </div>
                <div className="discover-event-back-detail full-width">
                  <span>Location</span>
                  <strong>{displayLocation}</strong>
                </div>
                {eventOrganizer ? (
                  <div className="discover-event-back-detail">
                    <span>Organizer</span>
                    <strong>{eventOrganizer}</strong>
                  </div>
                ) : null}
                {eventPrice ? (
                  <div className="discover-event-back-detail">
                    <span>Price</span>
                    <strong>{eventPrice}</strong>
                  </div>
                ) : null}
                {eventDressCode ? (
                  <div className="discover-event-back-detail full-width">
                    <span>Dress Code</span>
                    <strong>{eventDressCode}</strong>
                  </div>
                ) : null}
              </div>

              <div className="discover-event-back-stats" aria-label="Event activity">
                <button
                  type="button"
                  className="discover-event-back-stat interactive"
                  onClick={openMutuals}
                >
                  <span>Going</span>
                  <strong>{goingCount}</strong>
                </button>

                {onOpenComments ? (
                  <button
                    type="button"
                    className="discover-event-back-stat interactive"
                    onClick={handleOpenCommentsClick}
                  >
                    <span>Comments</span>
                    <strong>{commentCount}</strong>
                  </button>
                ) : null}
              </div>

              {eventTags.length > 0 ? (
                <div className="discover-event-back-tags" aria-label="Event tags">
                  {eventTags.slice(0, 5).map((tag) => (
                    <span key={tag} className="discover-event-back-tag">
                      #{tag}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="discover-event-back-actions">
                <button
                  type="button"
                  className={`discover-event-back-action primary ${isEventSaved ? "active" : ""}`}
                  onClick={handleRsvpClick}
                  disabled={isActionLocked}
                >
                  {isEventSaved ? "Going" : "RSVP"}
                </button>

                {onNotGoing || isEventSaved ? (
                  <button
                    type="button"
                    className="discover-event-back-action secondary"
                    onClick={handleNotGoingClick}
                    disabled={isActionLocked}
                  >
                    Not Going
                  </button>
                ) : null}

                {hasMapTarget ? (
                  <button
                    type="button"
                    className="discover-event-back-action secondary"
                    onClick={handleMapClick}
                  >
                    Directions
                  </button>
                ) : null}

                {onShare ? (
                  <button
                    type="button"
                    className="discover-event-back-action secondary"
                    onClick={handleShareClick}
                  >
                    Share
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      {isMutualsOpen && (
        <div className="event-mutuals-overlay" onClick={closeMutuals}>
          <div
            className="event-mutuals-modal"
            onClick={(eventClick) => eventClick.stopPropagation()}
          >
            <div className="event-mutuals-header">
              <h3>People Going</h3>
              <button
                type="button"
                className="event-mutuals-close"
                onClick={closeMutuals}
                aria-label="Close people going modal"
              >
                ×
              </button>
            </div>

            <div className="event-mutuals-list">
              {orderedAttendees.length > 0 ? (
                orderedAttendees.map((person, index) => (
                  <div
                    className="event-mutuals-item"
                    key={person.id || person.username || index}
                  >
                    <img
                      src={sanitizeAvatarUrl(
                        person.image || person.avatar,
                        DEFAULT_AVATAR_URL
                      )}
                      alt={person.name || person.username || "Attendee"}
                      className="event-mutuals-item-avatar"
                      onError={(eventClick) => {
                        eventClick.currentTarget.src = DEFAULT_AVATAR_URL
                      }}
                    />
                    <span className="event-mutuals-item-name">
                      {person.name || person.username || "Unknown attendee"}
                    </span>
                  </div>
                ))
              ) : (
                <p className="event-mutuals-empty">
                  No one&apos;s RSVPed to this event yet.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default EventCard
