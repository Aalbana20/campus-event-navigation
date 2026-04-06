import React, { useState } from "react"

function EventCard({ event }) {
  const [flipped, setFlipped] = useState(false)

  return (
    <div className="flip-card" onClick={() => setFlipped(!flipped)}>
      <div className={`flip-card-inner ${flipped ? "flipped" : ""}`}>
        <div className="flip-card-front">
          <img
            src={event.image}
            alt={event.title}
            className="event-image"
          />
        </div>

        <div className="flip-card-back">
          <h2>{event.title}</h2>
          <p><strong>Location:</strong> {event.location}</p>
          <p><strong>Date:</strong> {event.date}</p>
          <p><strong>Price:</strong> {event.price}</p>
          <p><strong>RSVP:</strong> {event.rsvp}</p>
          <button
            className="map-btn"
            onClick={(e) => {
              e.stopPropagation()
              window.open(`https://www.google.com/maps/search/?api=1&query=${event.location}`)
            }}
          >
            📍 View Map
          </button>
        </div>
      </div>
    </div>
  )
}

export default EventCard