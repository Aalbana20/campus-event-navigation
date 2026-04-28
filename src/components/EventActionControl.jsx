import React, { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useEvents } from "../context/EventContext"
import { useToast } from "../context/ToastContext"
import { buildEventImageStyle } from "../eventImages"
import { supabase } from "../supabaseClient"
import "../pages/Profile.css"

const DEFAULT_AVATAR = "/default-avatar.png"

const getPersonKey = (person) => String(person?.id || person?.username || "")

const normalizeSharePerson = (person, index = 0) => ({
  id: person?.id || person?.username || `share-person-${index}`,
  username: person?.username || "",
  name: person?.name || person?.username || "Campus User",
  image: person?.image || person?.avatar || DEFAULT_AVATAR,
})

const matchesShareSearch = (person, query) =>
  [person?.name, person?.username].filter(Boolean).join(" ").toLowerCase().includes(query)

const buildPreviewImageStyle = (event) =>
  buildEventImageStyle(
    event?.image,
    "linear-gradient(180deg, rgba(15, 23, 42, 0.08), rgba(15, 23, 42, 0.62))"
  )

function ShareTriggerIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

function AddToStoryIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  )
}

function RepostIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m17 2 4 4-4 4" />
      <path d="M3 11V9a3 3 0 0 1 3-3h15" />
      <path d="m7 22-4-4 4-4" />
      <path d="M21 13v2a3 3 0 0 1-3 3H3" />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" />
      <path d="M14 11a5 5 0 0 0-7.1 0l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1" />
    </svg>
  )
}

function EventActionControl({
  event,
  isOpen: controlledOpen,
  onClose: controlledOnClose,
  onAfterDelete,
  showTrigger,
}) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const {
    followingList,
    currentUser,
    repostedEventIds,
    repostEvent,
    unrepostEvent,
    deleteEvent,
  } = useEvents()
  const isControlled = typeof controlledOpen === "boolean"
  const shouldShowTrigger = showTrigger ?? !isControlled
  const [internalOpen, setInternalOpen] = useState(false)
  const isShareSheetOpen = isControlled ? controlledOpen : internalOpen
  const [shareSearch, setShareSearch] = useState("")
  const [shareFeedback, setShareFeedback] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
  const shareSearchInputRef = useRef(null)

  const eventTitle = event?.title || event?.name || "Campus Event"
  const eventLink = `${window.location.origin}/#/events/${event?.id || ""}`
  const sharePreviewMeta = [
    event?.date,
    event?.locationName || event?.location,
    event?.organizer,
  ]
    .filter(Boolean)
    .join(" • ")

  const ownerId = event?.creatorId || event?.organizerId || event?.userId
  const isOwner =
    Boolean(currentUser?.id) &&
    currentUser.id !== "current-user" &&
    Boolean(ownerId) &&
    String(ownerId) === String(currentUser.id)

  const normalizedFollowingPeople = useMemo(
    () =>
      (followingList || [])
        .map((person, index) => normalizeSharePerson(person, index))
        .filter(
          (person) =>
            getPersonKey(person) &&
            getPersonKey(person) !== String(currentUser?.id || currentUser?.username || "")
        ),
    [currentUser?.id, currentUser?.username, followingList]
  )

  const recentDmPeople = useMemo(
    () => normalizedFollowingPeople.slice(0, 6),
    [normalizedFollowingPeople]
  )

  const recentDmKeys = useMemo(
    () => new Set(recentDmPeople.map((person) => getPersonKey(person))),
    [recentDmPeople]
  )

  const followingPeople = useMemo(
    () =>
      normalizedFollowingPeople.filter(
        (person) => !recentDmKeys.has(getPersonKey(person))
      ),
    [normalizedFollowingPeople, recentDmKeys]
  )

  const normalizedSearch = shareSearch.trim().toLowerCase()

  const filteredRecentDmPeople = useMemo(
    () =>
      normalizedSearch
        ? recentDmPeople.filter((person) =>
            matchesShareSearch(person, normalizedSearch)
          )
        : recentDmPeople,
    [normalizedSearch, recentDmPeople]
  )

  const filteredFollowingPeople = useMemo(
    () =>
      normalizedSearch
        ? followingPeople.filter((person) =>
            matchesShareSearch(person, normalizedSearch)
          )
        : followingPeople,
    [followingPeople, normalizedSearch]
  )

  const visibleSharePeople = useMemo(() => {
    const seen = new Set()
    return [...filteredRecentDmPeople, ...filteredFollowingPeople].filter((person) => {
      const key = getPersonKey(person)
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [filteredFollowingPeople, filteredRecentDmPeople])

  useEffect(() => {
    if (!shareFeedback) return undefined

    const timeoutId = window.setTimeout(() => {
      setShareFeedback("")
    }, 2400)

    return () => window.clearTimeout(timeoutId)
  }, [shareFeedback])

  const openShareSheet = (eventClick) => {
    eventClick?.stopPropagation()
    if (!isControlled) setInternalOpen(true)
  }

  const closeShareSheet = () => {
    if (isControlled) {
      controlledOnClose?.()
    } else {
      setInternalOpen(false)
    }
    setShareSearch("")
  }

  const handleCopyLink = async (eventClick) => {
    eventClick?.stopPropagation()

    try {
      await navigator.clipboard.writeText(eventLink)
      setShareFeedback("Event link copied.")
    } catch {
      setShareFeedback("Could not copy link.")
    }

    closeShareSheet()
  }

  const handleAddToStory = (eventClick) => {
    eventClick?.stopPropagation()
    showToast?.("Add to story coming soon", "info")
    setShareFeedback("Add to story coming soon")
    closeShareSheet()
  }

  const handleShareTo = async (eventClick) => {
    eventClick?.stopPropagation()

    if (!navigator.share) {
      await handleCopyLink()
      return
    }

    try {
      await navigator.share({
        title: eventTitle,
        text: event?.description || "Check out this event.",
        url: eventLink,
      })
      setShareFeedback("Event shared.")
      closeShareSheet()
    } catch (error) {
      if (error?.name === "AbortError") {
        closeShareSheet()
        return
      }

      await handleCopyLink()
    }
  }

  const isReposted = repostedEventIds?.has(String(event?.id || ""))

  const handleRepostEvent = async (eventClick) => {
    eventClick?.stopPropagation()
    if (!event?.id) return

    if (isReposted) {
      await unrepostEvent(event.id)
      setShareFeedback("Repost removed.")
    } else {
      await repostEvent(event.id)
      setShareFeedback("Event reposted.")
    }

    closeShareSheet()
  }

  const handleSendEventToPerson = async (person, eventClick) => {
    eventClick?.stopPropagation()

    const senderId = currentUser?.id && currentUser.id !== "current-user"
      ? currentUser.id
      : null

    if (senderId && person.id) {
      const messageText = `Check out ${eventTitle} — ${eventLink}`
      await supabase
        .from("messages")
        .insert({ sender_id: senderId, recipient_id: person.id, content: messageText })
    }

    const personHandle = person.username ? `@${person.username}` : person.name
    setShareFeedback(`Event sent to ${personHandle}.`)
    closeShareSheet()
  }

  const handleDeleteEvent = async (eventClick) => {
    eventClick?.stopPropagation()
    if (!isOwner || !event?.id || isDeleting) return

    const confirmed = window.confirm("Delete this event?\nThis cannot be undone.")
    if (!confirmed) return

    setIsDeleting(true)
    try {
      await deleteEvent(event.id)
      showToast?.("Event deleted.", "success")
      closeShareSheet()
      onAfterDelete?.(event)
      if (window.location.hash.includes(`/events/${event.id}`)) {
        navigate("/events")
      }
    } catch (error) {
      showToast?.(error?.message || "Could not delete this event.", "error")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      {shouldShowTrigger ? (
        <button
          type="button"
          className="event-card-share-btn event-action-control-trigger"
          onClick={openShareSheet}
          aria-label="Share event"
        >
          <ShareTriggerIcon />
        </button>
      ) : null}

      {shareFeedback ? (
        <div className="event-share-feedback" role="status" aria-live="polite">
          {shareFeedback}
        </div>
      ) : null}

      {isShareSheetOpen && (
        <div className="event-share-sheet-overlay" onClick={closeShareSheet}>
          <div className="event-share-sheet" onClick={(eventClick) => eventClick.stopPropagation()}>
            <div className="event-share-sheet-handle" />

            <div className="event-share-search-row">
              <label className="event-share-search-shell">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                  <path d="m16.5 16.5 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <input
                  ref={shareSearchInputRef}
                  type="text"
                  className="event-share-search-input"
                  placeholder="Search"
                  value={shareSearch}
                  onChange={(eventClick) => setShareSearch(eventClick.target.value)}
                />
              </label>
              <button type="button" className="event-share-group-btn" onClick={(eventClick) => eventClick.stopPropagation()} aria-label="Create group">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M16 20v-1.4a4.6 4.6 0 0 0-4.6-4.6H7.6A4.6 4.6 0 0 0 3 18.6V20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="9.5" cy="7" r="3.4" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M21 20v-1.4a4.6 4.6 0 0 0-3.2-4.38" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M16 3.2a3.4 3.4 0 0 1 0 6.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            <div className="event-share-sheet-preview">
              <div
                className="event-share-sheet-preview-image"
                style={buildPreviewImageStyle(event)}
                aria-hidden="true"
              />
              <div className="event-share-sheet-preview-copy">
                <h4>{eventTitle}</h4>
                <p>{sharePreviewMeta || "Share this event with your people."}</p>
              </div>
            </div>

            <div className="event-share-sheet-body">
              {visibleSharePeople.length > 0 ? (
                <div className="event-share-people-grid">
                  {visibleSharePeople.map((person) => (
                    <button
                      key={`share-${getPersonKey(person)}`}
                      type="button"
                      className="event-share-person-btn"
                      onClick={(eventClick) => handleSendEventToPerson(person, eventClick)}
                    >
                      <img
                        src={person.image}
                        alt={person.name}
                        className="event-share-person-avatar"
                        onError={(eventClick) => {
                          eventClick.currentTarget.src = DEFAULT_AVATAR
                        }}
                      />
                      <span className="event-share-person-name">
                        {person.username ? `@${person.username}` : person.name}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="event-share-empty-state">
                  {normalizedFollowingPeople.length === 0
                    ? "People you follow will appear here for quick sharing."
                    : "No people matched that search."}
                </div>
              )}
            </div>

            <div className="event-share-actions-row">
              <button
                type="button"
                className="event-share-action-btn"
                onClick={handleAddToStory}
              >
                <AddToStoryIcon />
                Add to story
              </button>

              <button
                type="button"
                className={`event-share-action-btn ${isReposted ? "active" : ""}`}
                onClick={handleRepostEvent}
              >
                <RepostIcon />
                {isReposted ? "Unrepost" : "Repost"}
              </button>

              <button
                type="button"
                className="event-share-action-btn"
                onClick={handleCopyLink}
              >
                <LinkIcon />
                Copy link
              </button>

              <button
                type="button"
                className="event-share-action-btn"
                onClick={handleShareTo}
              >
                <ShareTriggerIcon />
                Share to...
              </button>

            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default EventActionControl
