import React from "react"

const buildTileImageStyle = (event) => ({
  backgroundImage: event?.image
    ? `linear-gradient(180deg, rgba(15, 23, 42, 0.08), rgba(15, 23, 42, 0.82)), url(${event.image})`
    : "var(--explore-event-fallback)",
})

function ExploreEventTile({ event, onOpen }) {
  const eventTitle = event?.title || "Untitled Event"
  const eventMeta = [event?.date, event?.locationName || event?.location]
    .filter(Boolean)
    .join(" • ")

  return (
    <button
      type="button"
      className="explore-event-tile"
      onClick={() => onOpen(event)}
    >
      <div className="explore-event-tile-media" style={buildTileImageStyle(event)}>
        <div className="explore-event-tile-copy">
          <span className="explore-event-tile-tag">
            #{event?.tags?.[0] || "Explore"}
          </span>
          <h3 className="explore-event-tile-title">{eventTitle}</h3>
          <p className="explore-event-tile-meta">{eventMeta || "Campus Event"}</p>
        </div>
      </div>
    </button>
  )
}

export default ExploreEventTile
