import React from "react"
import EventActionControl from "./EventActionControl"

const buildModalImageStyle = (event) => ({
  backgroundImage: event?.image
    ? `linear-gradient(180deg, rgba(15, 23, 42, 0.12), rgba(15, 23, 42, 0.84)), url(${event.image})`
    : "var(--explore-event-fallback)",
})

function ExploreEventModal({ event, isSaved, actionLabel, onAction, onClose }) {
  if (!event) return null

  return (
    <div className="explore-modal-overlay" onClick={onClose}>
      <div
        className="explore-modal-card event-card-shell"
        onClick={(eventClick) => eventClick.stopPropagation()}
      >
        <button
          type="button"
          className="explore-modal-close"
          onClick={onClose}
          aria-label="Close event detail"
        >
          ×
        </button>

        <EventActionControl event={event} />

        <div className="explore-modal-hero" style={buildModalImageStyle(event)}>
          <div className="explore-modal-hero-copy">
            <span className="explore-modal-hero-tag">#{event?.tags?.[0] || "Explore"}</span>
            <h2>{event?.title || "Untitled Event"}</h2>
            <p>
              {[
                event?.date,
                event?.time,
                event?.locationName || event?.location || event?.locationAddress,
              ]
                .filter(Boolean)
                .join(" • ")}
            </p>
          </div>
        </div>

        <div className="explore-modal-body">
          <div className="explore-modal-stats">
            <span>{event?.goingCount || 0} going</span>
            <span>{event?.repostedByIds?.length || 0} reposts</span>
            <span>{event?.organizer || "Campus Organization"}</span>
          </div>

          <p className="explore-modal-description">
            {event?.description || "A standout event worth discovering outside your usual circle."}
          </p>

          <div className="explore-tag-row">
            {(event?.tags?.length ? event.tags.slice(0, 4) : ["Explore"]).map((tag) => (
              <span key={`${event.id}-${tag}`} className="explore-tag">
                {tag}
              </span>
            ))}
          </div>

          <button
            type="button"
            className={`explore-action-btn ${isSaved ? "active" : ""}`}
            onClick={onAction}
            aria-pressed={isSaved}
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ExploreEventModal
