import React, { useEffect, useMemo, useRef, useState } from "react"
import { useEvents } from "../context/EventContext"
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

const buildPreviewImageStyle = (post) => {
  const url = post?.mediaUrl
  if (!url) return { background: "linear-gradient(180deg, #1f2937, #111827)" }
  return {
    backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.0), rgba(0,0,0,0.45)), url("${url}")`,
    backgroundSize: "cover",
    backgroundPosition: "center",
  }
}

function PostShareSheet({
  post,
  isOpen,
  onClose,
  isOwner = false,
  onDelete,
  onRepost,
  isReposted = false,
}) {
  const { followingList, currentUser } = useEvents()
  const [shareSearch, setShareSearch] = useState("")
  const [shareFeedback, setShareFeedback] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
  const shareSearchInputRef = useRef(null)

  const postTitle = post?.caption || `${post?.authorName || "Campus"} post`
  const postLink = `${window.location.origin}/#/discover?post=${post?.id || ""}`
  const previewMeta = post?.authorUsername
    ? `@${post.authorUsername}`
    : post?.authorName || "Discover post"

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

  useEffect(() => {
    if (!shareFeedback) return undefined
    const timeoutId = window.setTimeout(() => setShareFeedback(""), 2400)
    return () => window.clearTimeout(timeoutId)
  }, [shareFeedback])

  const closeShareSheet = () => {
    onClose?.()
    setShareSearch("")
  }

  const handleCopyLink = async (eventClick) => {
    eventClick?.stopPropagation()
    try {
      await navigator.clipboard.writeText(postLink)
      setShareFeedback("Post link copied.")
    } catch {
      setShareFeedback("Could not copy link.")
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
        title: postTitle,
        text: post?.caption || "Check out this post.",
        url: postLink,
      })
      setShareFeedback("Post shared.")
      closeShareSheet()
    } catch (error) {
      if (error?.name === "AbortError") {
        closeShareSheet()
        return
      }
      await handleCopyLink()
    }
  }

  const handleMessageAction = (eventClick) => {
    eventClick?.stopPropagation()
    setShareSearch("")
    window.requestAnimationFrame(() => {
      shareSearchInputRef.current?.focus()
    })
  }

  const handleSendPostToPerson = async (person, eventClick) => {
    eventClick?.stopPropagation()
    const senderId = currentUser?.id && currentUser.id !== "current-user"
      ? currentUser.id
      : null

    if (senderId && person.id) {
      const messageText = `Check out this post — ${postLink}`
      await supabase
        .from("messages")
        .insert({ sender_id: senderId, recipient_id: person.id, content: messageText })
    }

    const personHandle = person.username ? `@${person.username}` : person.name
    setShareFeedback(`Sent to ${personHandle}.`)
    closeShareSheet()
  }

  const handleRepostClick = async (eventClick) => {
    eventClick?.stopPropagation()
    if (!onRepost) {
      setShareFeedback("Reposting will arrive soon.")
      closeShareSheet()
      return
    }
    try {
      await onRepost(post)
      setShareFeedback(isReposted ? "Repost removed." : "Post reposted.")
    } catch (error) {
      setShareFeedback(error?.message || "Could not repost.")
    }
    closeShareSheet()
  }

  const handleDeleteClick = async (eventClick) => {
    eventClick?.stopPropagation()
    if (!isOwner || !onDelete || isDeleting) return
    const confirmed = window.confirm("Delete this post?\nThis cannot be undone.")
    if (!confirmed) return

    setIsDeleting(true)
    try {
      await onDelete(post)
      closeShareSheet()
    } catch (error) {
      setShareFeedback(error?.message || "Could not delete this post.")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      {shareFeedback ? (
        <div className="event-share-feedback" role="status" aria-live="polite">
          {shareFeedback}
        </div>
      ) : null}

      {isOpen && (
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
                style={buildPreviewImageStyle(post)}
                aria-hidden="true"
              />
              <div className="event-share-sheet-preview-copy">
                <h4>{postTitle}</h4>
                <p>{previewMeta}</p>
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
                        onClick={(eventClick) => handleSendPostToPerson(person, eventClick)}
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
                        onClick={(eventClick) => handleSendPostToPerson(person, eventClick)}
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
                className={`event-share-action-btn ${isReposted ? "active" : ""}`}
                onClick={handleRepostClick}
              >
                {isReposted ? "Unrepost" : "Repost"}
              </button>

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

              {isOwner && onDelete ? (
                <button
                  type="button"
                  className="event-share-action-btn destructive"
                  onClick={handleDeleteClick}
                  disabled={isDeleting}
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
              ) : null}

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

export default PostShareSheet
