import React, { useEffect, useMemo, useRef, useState } from "react"
import { useEvents } from "../context/EventContext"
import { buildEventImageStyle } from "../eventImages"
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

function EventActionControl({ event }) {
  const { followingList, currentUser, repostedEventIds, repostEvent, unrepostEvent } = useEvents()
  const [isShareSheetOpen, setIsShareSheetOpen] = useState(false)
  const [shareSearch, setShareSearch] = useState("")
  const [shareFeedback, setShareFeedback] = useState("")
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

  // Until DM threads are lifted into shared context, seed the "recent" rail from follows.
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

  useEffect(() => {
    if (!shareFeedback) return undefined

    const timeoutId = window.setTimeout(() => {
      setShareFeedback("")
    }, 2400)

    return () => window.clearTimeout(timeoutId)
  }, [shareFeedback])

  const openShareSheet = (eventClick) => {
    eventClick.stopPropagation()
    setIsShareSheetOpen(true)
  }

  const closeShareSheet = () => {
    setIsShareSheetOpen(false)
    setShareSearch("")
  }

  const handleCopyLink = async (eventClick) => {
    eventClick?.stopPropagation()

    try {
      await navigator.clipboard.writeText(eventLink)
      setShareFeedback("Event link copied.")
    } catch {
      window.prompt("Copy event link:", eventLink)
      setShareFeedback("Event link ready to copy.")
    }

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

  const handleMessageAction = (eventClick) => {
    eventClick?.stopPropagation()

    if (normalizedFollowingPeople.length === 0) {
      setShareFeedback("DM event sharing is ready for backend wiring.")
      closeShareSheet()
      return
    }

    setShareSearch("")
    window.requestAnimationFrame(() => {
      shareSearchInputRef.current?.focus()
    })
  }

  const handleSendEventToPerson = (person, eventClick) => {
    eventClick?.stopPropagation()

    const personHandle = person.username ? `@${person.username}` : person.name
    setShareFeedback(`Event sent to ${personHandle}.`)
    closeShareSheet()
  }

  return (
    <>
      <div className="event-card-top-actions">
        <button
          type="button"
          className="event-card-menu-btn"
          onClick={openShareSheet}
          aria-label="Open event share options"
        >
          <span />
          <span />
          <span />
        </button>
      </div>

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
              <input
                ref={shareSearchInputRef}
                type="text"
                className="event-share-search-input"
                placeholder="Search people"
                value={shareSearch}
                onChange={(eventClick) => setShareSearch(eventClick.target.value)}
              />
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
              {filteredRecentDmPeople.length > 0 ? (
                <div className="event-share-section">
                  <p className="event-share-section-label">Recent</p>
                  <div className="event-share-people-grid">
                    {filteredRecentDmPeople.map((person) => (
                      <button
                        key={`recent-${getPersonKey(person)}`}
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
                </div>
              ) : null}

              {filteredFollowingPeople.length > 0 ? (
                <div className="event-share-section">
                  <p className="event-share-section-label">Following</p>
                  <div className="event-share-people-grid">
                    {filteredFollowingPeople.map((person) => (
                      <button
                        key={`following-${getPersonKey(person)}`}
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
                </div>
              ) : null}

              {filteredRecentDmPeople.length === 0 && filteredFollowingPeople.length === 0 ? (
                <div className="event-share-empty-state">
                  {normalizedFollowingPeople.length === 0
                    ? "People you follow will appear here for quick sharing."
                    : "No people matched that search."}
                </div>
              ) : null}
            </div>

            <div className="event-share-actions-row">
              <button
                type="button"
                className="event-share-action-btn"
                onClick={handleCopyLink}
              >
                Copy Link
              </button>

              <button
                type="button"
                className="event-share-action-btn"
                onClick={handleShareTo}
              >
                Share to
              </button>

              <button
                type="button"
                className="event-share-action-btn"
                onClick={handleMessageAction}
              >
                Message
              </button>

              <button
                type="button"
                className={`event-share-action-btn ${isReposted ? "active" : ""}`}
                onClick={handleRepostEvent}
              >
                {isReposted ? "Unrepost" : "Repost"}
              </button>

              <button
                type="button"
                className="event-share-action-btn cancel"
                onClick={closeShareSheet}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default EventActionControl
