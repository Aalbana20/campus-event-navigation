import React, { useState } from "react"
function MyEventCard({ event }) {
  const [flipped, setFlipped] = useState(false)

  return (
    <div className="my-flip-card" onClick={() => setFlipped(!flipped)}>
      <div className={`my-flip-card-inner ${flipped ? "flipped" : ""}`}>
        <div className="my-flip-card-front">
          <img src={event.image} alt={event.title} className="my-event-image" />
          <div className="my-event-info">
            <h3>{event.title}</h3>
            <p>{event.date}</p>
          </div>
        </div>

        <div className="my-flip-card-back">
          <h3>{event.title}</h3>
          <p><strong>Date:</strong> {event.date}</p>
          <p><strong>Location:</strong> {event.location}</p>
          <p><strong>Price:</strong> {event.price}</p>
          <p><strong>Status:</strong> Going</p>
        </div>
      </div>
    </div>
  )
}

export default MyEventCard