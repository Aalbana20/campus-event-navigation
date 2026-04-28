import React, { useEffect, useRef, useState } from "react"
import { applyEventImageFallback, buildEventImageStyle, getEventImageSrc } from "../eventImages"
import { useEvents } from "../context/EventContext"
import EventActionControl from "./EventActionControl"
import EventCreatorBadge from "./EventCreatorBadge"

const buildModalImageStyle = (event) =>
  buildEventImageStyle(
    event?.image,
    "linear-gradient(180deg, rgba(15, 23, 42, 0.12), rgba(15, 23, 42, 0.84))"
  )

function AttendeeGroupIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M16 20v-1.4a4.6 4.6 0 0 0-4.6-4.6H7.6A4.6 4.6 0 0 0 3 18.6V20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9.5" cy="7" r="3.4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M21 20v-1.4a4.6 4.6 0 0 0-3.2-4.38" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 3.2a3.4 3.4 0 0 1 0 6.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ExploreEventModal({
  event,
  isSaved = false,
  actionLabel,
  onAction,
  onClose,
  onOpenComments,
  commentCount = 0,
}) {
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
  const [isFlyerPreviewOpen, setIsFlyerPreviewOpen] = useState(false)

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

  const eventTitle = event?.title || event?.name || "Untitled Event"
  const eventHost = event?.organizer || event?.host || event?.organization || "Campus Organization"
  const eventDate = event?.date || event?.eventDate || "Date TBA"
  const eventTime =
    event?.time ||
    [event?.startTime, event?.endTime].filter(Boolean).join(" - ") ||
    "Time TBA"
  const eventLocation = event?.locationName || event?.location || "Location TBA"
  const eventAddress = event?.locationAddress || event?.address || eventLocation
  const eventDressCode = event?.dressCode || event?.dress_code || ""
  const eventTags = Array.isArray(event?.tags) ? event.tags.filter(Boolean) : []
  const actionButtonLabel = actionLabel || (isSaved ? "Cancel" : "RSVP")

  const handlePrimaryAction = (eventClick) => {
    eventClick.stopPropagation()
    onAction?.(event)
  }

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

        <button
          type="button"
          className="explore-modal-hero flyer-preview-trigger"
          style={buildModalImageStyle(event)}
          onClick={() => setIsFlyerPreviewOpen(true)}
          aria-label="Open full event flyer"
        >
          <div className="explore-modal-hero-copy">
            <span className="explore-modal-hero-tag">#{event?.tags?.[0] || "Explore"}</span>
            <EventCreatorBadge event={event} />
            <h2>{eventTitle}</h2>
            <p>
              {[
                eventDate,
                eventTime,
                eventLocation,
              ]
                .filter(Boolean)
                .join(" • ")}
            </p>
          </div>
        </button>

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
            <span>{eventHost}</span>
          </div>

          <p className="explore-modal-description">
            {event?.description || "A standout event worth discovering outside your usual circle."}
          </p>

          <div className="explore-modal-detail-grid">
            <div className="explore-modal-detail">
              <span>Host</span>
              <strong>{eventHost}</strong>
            </div>
            <div className="explore-modal-detail">
              <span>Date</span>
              <strong>{eventDate}</strong>
            </div>
            <div className="explore-modal-detail">
              <span>Time</span>
              <strong>{eventTime}</strong>
            </div>
            <div className="explore-modal-detail">
              <span>Location</span>
              <strong>{eventLocation}</strong>
            </div>
            <div className="explore-modal-detail full-width">
              <span>Address</span>
              <strong>{eventAddress}</strong>
            </div>
            {eventDressCode ? (
              <div className="explore-modal-detail full-width">
                <span>Dress Code</span>
                <strong>{eventDressCode}</strong>
              </div>
            ) : null}
          </div>

          {eventTags.length > 0 ? (
            <div className="explore-tag-row">
              {eventTags.slice(0, 5).map((tag) => (
              <span key={`${event.id}-${tag}`} className="explore-tag">
                {tag}
              </span>
              ))}
            </div>
          ) : null}

          <button
            type="button"
            className={`explore-action-btn ${isSaved ? "active" : ""}`}
            onClick={handlePrimaryAction}
            aria-pressed={isSaved}
          >
            <AttendeeGroupIcon />
            {actionButtonLabel}
          </button>

          {onOpenComments ? (
            <button
              type="button"
              className="explore-action-btn secondary"
              onClick={(eventClick) => {
                eventClick.stopPropagation()
                onOpenComments(event)
              }}
            >
              Comments {commentCount ? `(${commentCount})` : ""}
            </button>
          ) : null}

          <div className="explore-modal-placeholder-grid">
            <div>
              <strong>Tagged Photos</strong>
              <span>
                {eventMemories.length > 0
                  ? `${eventMemories.length} tagged photo${eventMemories.length === 1 ? "" : "s"}`
                  : "No tagged photos yet."}
              </span>
            </div>
            <div>
              <strong>Recap</strong>
              <span>Recap will appear here after the event.</span>
            </div>
          </div>

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

      {isFlyerPreviewOpen ? (
        <div
          className="flyer-lightbox-overlay"
          onClick={(eventClick) => {
            eventClick.stopPropagation()
            setIsFlyerPreviewOpen(false)
          }}
        >
          <button
            type="button"
            className="flyer-lightbox-close"
            onClick={(eventClick) => {
              eventClick.stopPropagation()
              setIsFlyerPreviewOpen(false)
            }}
            aria-label="Close flyer preview"
          >
            ×
          </button>
          <img
            src={getEventImageSrc(event?.image)}
            alt={`${eventTitle} flyer`}
            className="flyer-lightbox-image"
            onClick={(eventClick) => eventClick.stopPropagation()}
            onError={applyEventImageFallback}
          />
        </div>
      ) : null}
    </div>
  )
}

export default ExploreEventModal
