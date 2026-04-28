import React, { useState } from "react"
import { applyEventImageFallback, getEventImageSrc } from "../eventImages"
import EventActionControl from "./EventActionControl"
import EventCreatorBadge from "./EventCreatorBadge"
import ExploreEventModal from "./ExploreEventModal"

function MyEventCard({ event }) {
  const [flipped, setFlipped] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const eventTitle = event?.title || event?.name || "Untitled Event"
  const displayLocation = event.locationName || event.location || "No location"
  const mapsQuery = encodeURIComponent(event.locationAddress || event.location || "")
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`

  return (
    <>
      <div
        className="my-flip-card event-card-shell"
        onClick={(eventClick) => {
          if (eventClick.target.closest("button") || eventClick.target.closest("a")) return
          setIsDetailOpen(true)
        }}
        onDoubleClick={(eventClick) => {
          eventClick.preventDefault()
          eventClick.stopPropagation()
          setFlipped((currentValue) => !currentValue)
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(eventKey) => {
          if (eventKey.key !== "Enter" && eventKey.key !== " ") return
          eventKey.preventDefault()
          setIsDetailOpen(true)
        }}
      >
        <EventActionControl event={event} />

      <div className={`my-flip-card-inner ${flipped ? "flipped" : ""}`}>
        <div className="my-flip-card-front">
          <img
            src={getEventImageSrc(event?.image)}
            alt={eventTitle}
            className="my-event-image"
            onError={applyEventImageFallback}
          />
          <EventCreatorBadge event={event} className="my-event-creator" compact />
          <div className="my-event-info">
            <h3>{eventTitle}</h3>
            <p>{event.date}</p>
          </div>
        </div>

        <div className="my-flip-card-back">
          <h3>{eventTitle}</h3>
          <p><strong>Date:</strong> {event.date}</p>
          <p><strong>Location:</strong> {displayLocation}</p>
          <p><strong>Price:</strong> {event.price}</p>
          <p><strong>Status:</strong> Going</p>
          <button
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

      {isDetailOpen ? (
        <ExploreEventModal
          event={event}
          isSaved
          actionLabel="Going"
          onClose={() => setIsDetailOpen(false)}
        />
      ) : null}
    </>
  )
}

export default MyEventCard
