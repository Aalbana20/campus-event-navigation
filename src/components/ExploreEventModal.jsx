import React, { useEffect, useRef, useState } from "react"
import { buildEventImageStyle } from "../eventImages"
import { useEvents } from "../context/EventContext"
import EventActionControl from "./EventActionControl"
import EventCreatorBadge from "./EventCreatorBadge"

const buildModalImageStyle = (event) =>
  buildEventImageStyle(
    event?.image,
    "linear-gradient(180deg, rgba(15, 23, 42, 0.12), rgba(15, 23, 42, 0.84))"
  )

function ExploreEventModal({ event, isSaved, actionLabel, onAction, onClose }) {
  const fileInputRef = useRef(null)
  const {
    currentUser,
    currentUserAttendedEvent,
    loadEventMemoriesForEvent,
    postEventMemory,
  } = useEvents()
  const [canAddMemory, setCanAddMemory] = useState(false)
  const [eventMemories, setEventMemories] = useState([])
  const [isMemoryBusy, setIsMemoryBusy] = useState(false)
  const [memoryFeedback, setMemoryFeedback] = useState("")

  useEffect(() => {
    if (!event?.id) return undefined
    let cancelled = false

    const loadMemoryState = async () => {
      const [eligible, memories] = await Promise.all([
        currentUser?.id ? currentUserAttendedEvent(event.id) : Promise.resolve(false),
        loadEventMemoriesForEvent(event.id),
      ])

      if (cancelled) return
      setCanAddMemory(Boolean(eligible))
      setEventMemories(memories || [])
    }

    loadMemoryState()

    return () => {
      cancelled = true
    }
  }, [currentUser?.id, currentUserAttendedEvent, event?.id, loadEventMemoriesForEvent])

  if (!event) return null

  const handleMemoryFileChange = async (changeEvent) => {
    const file = changeEvent.target.files?.[0]
    changeEvent.target.value = ""
    if (!file || !event?.id || isMemoryBusy) return

    try {
      setIsMemoryBusy(true)
      setMemoryFeedback("")
      await postEventMemory({ eventId: event.id, file })
      const refreshed = await loadEventMemoriesForEvent(event.id)
      setEventMemories(refreshed || [])
      setMemoryFeedback("Memory added.")
    } catch (error) {
      setMemoryFeedback(error?.message || "Could not add this memory.")
    } finally {
      setIsMemoryBusy(false)
    }
  }

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
            <EventCreatorBadge event={event} />
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
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            style={{ display: "none" }}
            onChange={handleMemoryFileChange}
          />

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

          <div
            style={{
              marginTop: "16px",
              paddingTop: "16px",
              borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
              }}
            >
              <div>
                <strong style={{ display: "block", color: "var(--text-main, #f5f7fb)" }}>
                  Event Memories
                </strong>
                <span style={{ color: "var(--text-muted, #9ca3af)", fontSize: "0.84rem" }}>
                  RSVP-based memories from this event.
                </span>
              </div>

              {canAddMemory ? (
                <button
                  type="button"
                  className="explore-action-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isMemoryBusy}
                  style={{ width: "auto", marginTop: 0, paddingInline: "16px" }}
                >
                  {isMemoryBusy ? "Adding..." : "Add Memory"}
                </button>
              ) : null}
            </div>

            {memoryFeedback ? (
              <p style={{ margin: "10px 0 0", color: "var(--text-muted, #9ca3af)" }}>
                {memoryFeedback}
              </p>
            ) : null}

            {eventMemories.length > 0 ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))",
                  gap: "10px",
                  marginTop: "12px",
                }}
              >
                {eventMemories.slice(0, 8).map((memory) => (
                  <div
                    key={memory.id}
                    style={{
                      overflow: "hidden",
                      borderRadius: "16px",
                      aspectRatio: "1",
                      background: "rgba(255, 255, 255, 0.06)",
                    }}
                  >
                    {memory.mediaType === "video" ? (
                      <video
                        src={memory.mediaUrl}
                        muted
                        playsInline
                        preload="metadata"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <img
                        src={memory.mediaUrl}
                        alt={memory.caption || "Event memory"}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    )}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ExploreEventModal
