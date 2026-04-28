import React, { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import "./ManageEvents.css"
import { useEvents } from "../context/EventContext"
import { useToast } from "../context/ToastContext"
import { applyEventImageFallback, getEventImageSrc } from "../eventImages"
import { supabase } from "../supabaseClient"

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

const STATUS_OPTIONS = [
  { id: "all", label: "All" },
  { id: "upcoming", label: "Upcoming" },
  { id: "past", label: "Past" },
]

const isCreatedByCurrentUser = (event, currentUser) => {
  if (!currentUser) return false
  const currentId = String(currentUser.id || "")
  const currentUsername = String(currentUser.username || "").toLowerCase()
  const eventCreatorId = String(event?.createdBy || event?.created_by || "")
  const eventCreatorUsername = String(
    event?.creatorUsername || event?.creator_username || ""
  ).toLowerCase()

  return Boolean(
    (currentId && eventCreatorId && currentId === eventCreatorId) ||
      (currentUsername &&
        eventCreatorUsername &&
        currentUsername === eventCreatorUsername)
  )
}

const parseEventDate = (event) => {
  if (event?.eventDate) {
    const iso = new Date(`${event.eventDate}T12:00:00`)
    if (!Number.isNaN(iso.getTime())) return iso
  }

  if (typeof event?.date === "string") {
    const isoMatch = event.date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (isoMatch) {
      return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]))
    }

    const monthDayMatch = event.date.match(/^([A-Za-z]+)\s+(\d{1,2})$/)
    if (monthDayMatch) {
      const monthIndex = MONTH_NAMES.findIndex((name) => name === monthDayMatch[1])
      if (monthIndex >= 0) {
        return new Date(new Date().getFullYear(), monthIndex, Number(monthDayMatch[2]))
      }
    }
  }

  return null
}

const formatEventDateLabel = (event) => {
  const parsed = parseEventDate(event)
  if (!parsed) return event?.date || "Date TBD"
  return parsed.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

const getEventStatus = (event) => {
  const parsed = parseEventDate(event)
  if (!parsed) return "upcoming"
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return parsed.getTime() < now.getTime() ? "past" : "upcoming"
}

function StatTile({ label, value, helper, pending = false }) {
  return (
    <div className={`manage-stat-tile ${pending ? "pending" : ""}`}>
      <span className="manage-stat-value">{value}</span>
      <span className="manage-stat-label">{label}</span>
      {helper ? <span className="manage-stat-helper">{helper}</span> : null}
      {pending ? <span className="manage-stat-pending-pill">Pending</span> : null}
    </div>
  )
}

function ManageEventCard({
  event,
  rsvpCount,
  commentCount,
  onView,
  onEdit,
  onDelete,
  onManage,
}) {
  const status = getEventStatus(event)
  const goingCount =
    typeof rsvpCount === "number"
      ? rsvpCount
      : Number(event.goingCount || event.going_count || 0)
  const visibility =
    event.privacy === "private" || event.isPrivate ? "Private" : "Public"

  return (
    <article className={`manage-event-card status-${status}`}>
      <div className="manage-event-cover">
        <img
          src={getEventImageSrc(event.image)}
          alt={event.title || "Event flyer"}
          onError={applyEventImageFallback}
        />
        <div className="manage-event-cover-pills">
          <span className={`manage-status-pill status-${status}`}>
            {status === "past" ? "Past" : "Upcoming"}
          </span>
          <span className="manage-visibility-pill">{visibility}</span>
        </div>
      </div>

      <div className="manage-event-body">
        <h3 className="manage-event-title">{event.title || "Untitled event"}</h3>
        <p className="manage-event-meta">
          {formatEventDateLabel(event)}
          {event.time && event.time !== "TBA" ? ` · ${event.time}` : ""}
        </p>
        <p className="manage-event-location">
          {event.locationName || event.location || "Location TBD"}
        </p>

        <div className="manage-event-stats">
          <StatTile label="Going" value={goingCount} />
          <StatTile
            label="Saves"
            value={goingCount}
            helper="Same as RSVPs"
          />
          <StatTile
            label="Comments"
            value={commentCount ?? 0}
            pending={commentCount == null}
          />
          <StatTile label="Views" value="—" pending />
        </div>

        <div className="manage-event-actions">
          <button
            type="button"
            className="manage-action-btn primary"
            onClick={() => onManage(event)}
          >
            Manage
          </button>
          <button
            type="button"
            className="manage-action-btn"
            onClick={() => onView(event)}
          >
            View
          </button>
          <button
            type="button"
            className="manage-action-btn"
            onClick={() => onEdit(event)}
          >
            Edit
          </button>
          <button
            type="button"
            className="manage-action-btn danger"
            onClick={() => onDelete(event)}
          >
            Delete
          </button>
        </div>
      </div>
    </article>
  )
}

function ManageEvents() {
  const navigate = useNavigate()
  const { allEvents, currentUser, deleteEvent } = useEvents()
  const { showToast } = useToast()
  const [statusFilter, setStatusFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [rsvpCounts, setRsvpCounts] = useState({})
  const [commentCounts, setCommentCounts] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [activeManagedEvent, setActiveManagedEvent] = useState(null)

  const createdEvents = useMemo(
    () =>
      (allEvents || []).filter((event) => isCreatedByCurrentUser(event, currentUser)),
    [allEvents, currentUser]
  )

  useEffect(() => {
    if (!createdEvents.length) {
      return undefined
    }

    let isActive = true

    const loadRsvpCounts = async () => {
      try {
        const ids = createdEvents.map((event) => event.id)
        const { data, error } = await supabase
          .from("rsvps")
          .select("event_id")
          .in("event_id", ids)

        if (!isActive || error) return

        const counts = {}
        for (const row of data || []) {
          const key = String(row.event_id)
          counts[key] = (counts[key] || 0) + 1
        }
        setRsvpCounts(counts)
      } catch {
        if (isActive) setRsvpCounts({})
      }
    }

    loadRsvpCounts()

    return () => {
      isActive = false
    }
  }, [createdEvents])

  useEffect(() => {
    if (!createdEvents.length) {
      return undefined
    }

    let isActive = true

    const loadCommentCounts = async () => {
      try {
        const ids = createdEvents.map((event) => event.id)
        const { data, error } = await supabase
          .from("event_comments")
          .select("event_id")
          .in("event_id", ids)

        if (!isActive) return

        if (error) {
          // 42P01 = relation does not exist — table not yet present
          if (error.code === "42P01") {
            setCommentCounts(null)
          } else {
            setCommentCounts({})
          }
          return
        }

        const counts = {}
        for (const row of data || []) {
          const key = String(row.event_id)
          counts[key] = (counts[key] || 0) + 1
        }
        setCommentCounts(counts)
      } catch {
        if (isActive) setCommentCounts(null)
      }
    }

    loadCommentCounts()

    return () => {
      isActive = false
    }
  }, [createdEvents])

  const filteredEvents = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()
    return createdEvents.filter((event) => {
      if (statusFilter !== "all") {
        if (getEventStatus(event) !== statusFilter) return false
      }
      if (!normalizedQuery) return true
      const haystack = [
        event.title,
        event.location,
        event.locationName,
        event.description,
        ...(event.tags || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return haystack.includes(normalizedQuery)
    })
  }, [createdEvents, searchQuery, statusFilter])

  const upcomingCount = useMemo(
    () => createdEvents.filter((event) => getEventStatus(event) === "upcoming").length,
    [createdEvents]
  )

  const totalGoing = useMemo(() => {
    return createdEvents.reduce((sum, event) => {
      const liveCount = rsvpCounts[String(event.id)]
      const fallback = Number(event.goingCount || event.going_count || 0)
      return sum + (typeof liveCount === "number" ? liveCount : fallback)
    }, 0)
  }, [createdEvents, rsvpCounts])

  const handleViewEvent = (event) => {
    navigate(`/events/${event.id}`)
  }

  const handleEditEvent = () => {
    showToast("Inline editing is coming soon. Use Manage to update details.", "info")
  }

  const handleManageEvent = (event) => {
    setActiveManagedEvent(event)
  }

  const handleDeleteEvent = (event) => {
    setPendingDelete(event)
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    const target = pendingDelete
    setPendingDelete(null)
    try {
      await deleteEvent(target.id)
      showToast(`"${target.title || "Event"}" deleted.`, "success")
      if (activeManagedEvent && String(activeManagedEvent.id) === String(target.id)) {
        setActiveManagedEvent(null)
      }
    } catch (error) {
      showToast(error?.message || "Could not delete event.", "error")
    }
  }

  return (
    <main className="manage-events-page">
      <header className="manage-events-header">
        <div className="manage-events-heading">
          <p className="manage-events-kicker">Host tools</p>
          <h1>Manage Events</h1>
          <p className="manage-events-helper">
            Track everything you host on Campus — RSVPs, visibility, and quick edits.
          </p>
        </div>

        <div className="manage-events-summary">
          <div className="manage-summary-tile">
            <span className="manage-summary-value">{createdEvents.length}</span>
            <span className="manage-summary-label">Created</span>
          </div>
          <div className="manage-summary-tile">
            <span className="manage-summary-value">{upcomingCount}</span>
            <span className="manage-summary-label">Upcoming</span>
          </div>
          <div className="manage-summary-tile">
            <span className="manage-summary-value">{totalGoing}</span>
            <span className="manage-summary-label">Total going</span>
          </div>
        </div>

        <div className="manage-events-actions-row">
          <button
            type="button"
            className="manage-create-cta"
            onClick={() => navigate("/events?create=event")}
          >
            <span aria-hidden="true">+</span>
            <span>New Event</span>
          </button>
        </div>
      </header>

      <section className="manage-events-toolbar" aria-label="Filters">
        <div className="manage-status-filters" role="tablist" aria-label="Status">
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`manage-filter-chip ${statusFilter === option.id ? "active" : ""}`}
              onClick={() => setStatusFilter(option.id)}
              aria-pressed={statusFilter === option.id}
            >
              {option.label}
            </button>
          ))}
        </div>

        <label className="manage-search">
          <span aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="m20 20-3.8-3.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search your events"
            aria-label="Search created events"
          />
        </label>
      </section>

      {filteredEvents.length === 0 ? (
        <section className="manage-events-empty">
          <h2>No events to manage yet</h2>
          <p>
            {createdEvents.length === 0
              ? "Once you publish an event, it will show up here so you can track stats and make edits."
              : "Nothing matches the current filter. Try another status or clear your search."}
          </p>
          {createdEvents.length === 0 ? (
            <button
              type="button"
              className="manage-create-cta"
              onClick={() => navigate("/events?create=event")}
            >
              Create your first event
            </button>
          ) : null}
        </section>
      ) : (
        <section className="manage-events-grid">
          {filteredEvents.map((event) => (
            <ManageEventCard
              key={event.id}
              event={event}
              rsvpCount={rsvpCounts[String(event.id)]}
              commentCount={
                commentCounts == null ? null : commentCounts[String(event.id)] || 0
              }
              onView={handleViewEvent}
              onEdit={handleEditEvent}
              onDelete={handleDeleteEvent}
              onManage={handleManageEvent}
            />
          ))}
        </section>
      )}

      {pendingDelete ? (
        <div
          className="manage-modal-overlay"
          onClick={() => setPendingDelete(null)}
          role="presentation"
        >
          <div
            className="manage-confirm-card"
            role="dialog"
            aria-modal="true"
            aria-label="Confirm delete"
            onClick={(event) => event.stopPropagation()}
          >
            <h3>Delete this event?</h3>
            <p>
              "{pendingDelete.title || "Event"}" will be removed for everyone. This can&apos;t be undone.
            </p>
            <div className="manage-confirm-actions">
              <button type="button" onClick={() => setPendingDelete(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="manage-confirm-delete"
                onClick={confirmDelete}
              >
                Delete event
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {activeManagedEvent ? (
        <div
          className="manage-modal-overlay"
          onClick={() => setActiveManagedEvent(null)}
          role="presentation"
        >
          <div
            className="manage-detail-card"
            role="dialog"
            aria-modal="true"
            aria-label="Event management"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="manage-detail-close"
              onClick={() => setActiveManagedEvent(null)}
              aria-label="Close"
            >
              ×
            </button>

            <div className="manage-detail-header">
              <img
                src={getEventImageSrc(activeManagedEvent.image)}
                alt=""
                onError={applyEventImageFallback}
              />
              <div>
                <p className="manage-detail-kicker">Event Management</p>
                <h2>{activeManagedEvent.title || "Untitled event"}</h2>
                <p className="manage-detail-meta">
                  {formatEventDateLabel(activeManagedEvent)}
                  {activeManagedEvent.time && activeManagedEvent.time !== "TBA"
                    ? ` · ${activeManagedEvent.time}`
                    : ""}
                </p>
                <p className="manage-detail-meta">
                  {activeManagedEvent.locationName ||
                    activeManagedEvent.location ||
                    "Location TBD"}
                </p>
              </div>
            </div>

            <ul className="manage-detail-menu">
              <li>
                <button type="button" onClick={() => handleViewEvent(activeManagedEvent)}>
                  <span>View Event</span>
                  <span aria-hidden="true">›</span>
                </button>
              </li>
              <li>
                <button type="button" onClick={() => handleEditEvent(activeManagedEvent)}>
                  <span>Edit Details</span>
                  <span aria-hidden="true">›</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() =>
                    showToast("Registration view is coming to web soon.", "info")
                  }
                >
                  <span>View Registrations</span>
                  <span aria-hidden="true">›</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() =>
                    showToast("Analytics will land in an upcoming release.", "info")
                  }
                >
                  <span>Analytics</span>
                  <span aria-hidden="true">›</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    setActiveManagedEvent(null)
                    handleDeleteEvent(activeManagedEvent)
                  }}
                >
                  <span>Delete Event</span>
                  <span aria-hidden="true">›</span>
                </button>
              </li>
            </ul>
          </div>
        </div>
      ) : null}
    </main>
  )
}

export default ManageEvents
