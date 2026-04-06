import React, { useState } from "react"
import { useEvents } from "../context/EventContext"

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

  const displayLocation = event.locationName || event.location || "No location"
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

  const openMutuals = (e) => {
    e.stopPropagation()
    setIsMutualsOpen(true)
  }

  const closeMutuals = () => {
    setIsMutualsOpen(false)
  }

  return (
    <>
      <div className="flip-card event-card-shell" onClick={() => setFlipped(!flipped)}>
        <div className={`flip-card-inner ${flipped ? "flipped" : ""}`}>
          <div className="flip-card-front">
            <img
              src={event.image}
              alt={event.title}
              className="event-image"
              draggable={false}
            />

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
                      src={person.image || person.avatar || "/default-avatar.png"}
                      alt={person.name || "Mutual attendee"}
                      className="event-card-mutual-avatar"
                      onError={(e) => {
                        e.currentTarget.src = "/default-avatar.png"
                      }}
                    />
                  ))}
                </div>

                <span className="event-card-mutual-text">{mutualCount} mutuals</span>
              </button>
            </div>
          </div>

          <div className="flip-card-back">
            <h2>{event.title}</h2>
            <p><strong>Location:</strong> {displayLocation}</p>
            <p><strong>Date:</strong> {event.date}</p>
            <p><strong>Time:</strong> {event.time || "TBA"}</p>
            <p><strong>Price:</strong> {event.price}</p>
            <p><strong>RSVP:</strong> {event.rsvp || `${goingCount} Going`}</p>
            <p><strong>Organizer:</strong> {event.organizer || "Campus Organization"}</p>
            <p><strong>Dress Code:</strong> {event.dressCode || "Open"}</p>
            <p><strong>About:</strong> {event.description || "No description available."}</p>

            <button
              className="map-btn"
              onClick={(e) => {
                e.stopPropagation()
                window.open(mapsUrl, "_blank")
              }}
            >
              📍 View Map
            </button>
          </div>
        </div>
      </div>

      {isMutualsOpen && (
        <div className="event-mutuals-overlay" onClick={closeMutuals}>
          <div
            className="event-mutuals-modal"
            onClick={(e) => e.stopPropagation()}
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
                      src={person.image || person.avatar || "/default-avatar.png"}
                      alt={person.name || person.username || "Attendee"}
                      className="event-mutuals-item-avatar"
                      onError={(e) => {
                        e.currentTarget.src = "/default-avatar.png"
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