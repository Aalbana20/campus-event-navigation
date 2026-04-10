import React, { useState } from "react"
import { useEvents } from "../context/EventContext"
import { applyEventImageFallback, getEventImageSrc } from "../eventImages"
import { DEFAULT_AVATAR_URL, sanitizeAvatarUrl } from "../profileMedia"
import EventActionControl from "./EventActionControl"
import EventCreatorBadge from "./EventCreatorBadge"

const buildDescriptionPreview = (value) => {
  const trimmed = String(value || "").trim()

  if (!trimmed) {
    return "A standout campus event worth checking out."
  }

  if (trimmed.length <= 160) {
    return trimmed
  }

  return `${trimmed.slice(0, 157).trimEnd()}...`
}

const usersMatch = (a, b) => {
  if (!a || !b) return false
  if (a.id && b.id) return a.id === b.id
  if (a.username && b.username) return a.username === b.username
  return false
}

function EventCard({ event }) {
  const { mutualUsers } = useEvents()
  const [flipped, setFlipped] = useState(false)
  const [isMutualsOpen, setIsMutualsOpen] = useState(false)

  const eventTitle = event?.title || event?.name || "Untitled Event"
  const displayLocation = event.locationName || event.location || "No location"
  const displayDate = event?.date || "TBD"
  const displayTime = event?.time || "TBA"
  const descriptionPreview = buildDescriptionPreview(event?.description)
  const mapsQuery = encodeURIComponent(event.locationAddress || event.location || "")
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`

  const attendeeUsers = event?.attendees || event?.rsvpUsers || event?.goingUsers || []

  const parsedRsvpCount = Number.parseInt(String(event?.rsvp || "").replace(/\D/g, ""), 10)

  const goingCount =
    event?.rsvpCount ??
    event?.goingCount ??
    attendeeUsers.length ??
    (Number.isFinite(parsedRsvpCount) ? parsedRsvpCount : 24)

  const mutualAttendees = (mutualUsers || []).filter((mutualUser) =>
    attendeeUsers.some((attendee) => usersMatch(attendee, mutualUser))
  )

  const mutualCount = event?.mutualCount ?? mutualAttendees.length

  const openMutuals = (eventClick) => {
    eventClick.stopPropagation()
    setIsMutualsOpen(true)
  }

  const closeMutuals = () => {
    setIsMutualsOpen(false)
  }

  return (
    <>
      <div className="flip-card event-card-shell" onClick={() => setFlipped(!flipped)}>
        <EventActionControl event={event} />

        <div className={`flip-card-inner ${flipped ? "flipped" : ""}`}>
          <div className="flip-card-front">
            <img
              src={getEventImageSrc(event?.image)}
              alt={eventTitle}
              className="event-image"
              draggable={false}
              onError={applyEventImageFallback}
            />
            <EventCreatorBadge event={event} className="event-card-creator" compact />

            <div className="event-card-social-proof">
              <div className="event-card-going-pill">
                <span>{goingCount} going</span>
              </div>

              <button
                type="button"
                className="event-card-mutuals"
                onClick={openMutuals}
                aria-label={`View ${mutualCount} mutuals going`}
              >
                <div className="event-card-mutual-bubbles">
                  {mutualAttendees.slice(0, 3).map((person, index) => (
                    <img
                      key={person.id || index}
                      src={sanitizeAvatarUrl(
                        person.image || person.avatar,
                        DEFAULT_AVATAR_URL
                      )}
                      alt={person.name || "Mutual attendee"}
                      className="event-card-mutual-avatar"
                      onError={(eventClick) => {
                        eventClick.currentTarget.src = DEFAULT_AVATAR_URL
                      }}
                    />
                  ))}
                </div>

                <span className="event-card-mutual-text">{mutualCount} mutuals</span>
              </button>
            </div>
          </div>

          <div className="flip-card-back">
            <div className="discover-event-back-shell">
              <div className="discover-event-back-header">
                <span className="discover-event-back-kicker">Event Details</span>
                <h2>{eventTitle}</h2>
                <p className="discover-event-back-description">{descriptionPreview}</p>
              </div>

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
              </div>

              <div className="discover-event-back-stats">
                <div className="discover-event-back-stat">
                  <span>Going</span>
                  <strong>{goingCount}</strong>
                </div>

                {mutualCount > 0 ? (
                  <button
                    type="button"
                    className="discover-event-back-stat interactive"
                    onClick={openMutuals}
                    aria-label={`View ${mutualCount} mutuals going`}
                  >
                    <span>Mutuals</span>
                    <strong>{mutualCount}</strong>
                  </button>
                ) : null}
              </div>

              <div className="discover-event-back-actions">
                {mutualCount > 0 ? (
                  <button
                    type="button"
                    className="map-btn secondary"
                    onClick={openMutuals}
                  >
                    See Mutuals
                  </button>
                ) : null}

                <div className="discover-event-back-actions-spacer" />

                <button
                  type="button"
                  className="map-btn"
                  onClick={(eventClick) => {
                    eventClick.stopPropagation()
                    window.open(mapsUrl, "_blank")
                  }}
                >
                  View Map
                </button>
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
              {mutualAttendees.length > 0 ? (
                mutualAttendees.map((person, index) => (
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
                  None of your mutuals are going to this event yet.
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
