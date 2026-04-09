import React, { useState } from "react"
import { applyEventImageFallback, getEventImageSrc } from "../eventImages"
import EventActionControl from "./EventActionControl"

function MyEventCard({ event }) {
  const [flipped, setFlipped] = useState(false)
  const eventTitle = event?.title || event?.name || "Untitled Event"
  const displayLocation = event.locationName || event.location || "No location"
  const mapsQuery = encodeURIComponent(event.locationAddress || event.location || "")
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`

  return (
    <div className="my-flip-card event-card-shell" onClick={() => setFlipped(!flipped)}>
      <EventActionControl event={event} />

      <div className={`my-flip-card-inner ${flipped ? "flipped" : ""}`}>
        <div className="my-flip-card-front">
          <img
            src={getEventImageSrc(event?.image)}
            alt={eventTitle}
            className="my-event-image"
            onError={applyEventImageFallback}
          />
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
  )
}

export default MyEventCard
