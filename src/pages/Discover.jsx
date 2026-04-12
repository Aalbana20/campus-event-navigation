import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import DiscoverFriendsPanel from "../components/DiscoverFriendsPanel"
import DiscoverModeSwitch from "../components/DiscoverModeSwitch"
import DiscoverStoryComposer from "../components/DiscoverStoryComposer"
import DiscoverStoriesRow from "../components/DiscoverStoriesRow"
import EventCard from "../components/EventCard"
import { useEvents } from "../context/EventContext"
import {
  buildDiscoverStoryStripItems,
  fetchDiscoverStoryViewers,
  loadActiveDiscoverStories,
  loadAuthenticatedDiscoverStoryUserId,
  loadDiscoverReactedStoryIds,
  recordDiscoverStoryView,
  toggleDiscoverStoryHeart,
  uploadDiscoverStory,
} from "../discoverStories"
import {
  buildDiscoverFriendCards,
  buildDiscoverStoryItems,
} from "../discoverSocial"

function Discover() {
  const SWIPE_TRIGGER_PX = 110
  const DRAG_INTENT_PX = 10
  const navigate = useNavigate()
  const {
    addEvent,
    allEvents,
    currentUser,
    follow,
    followingList,
    followersList,
    savedEvents,
    unfollow,
  } = useEvents()

  const [activeMode, setActiveMode] = useState("events")
  const [currentIndex, setCurrentIndex] = useState(0)
  const [swipeDirection, setSwipeDirection] = useState("")
  const [buttonFlash, setButtonFlash] = useState("")
  const [cardEntering, setCardEntering] = useState(false)
  const [dismissedEventIds, setDismissedEventIds] = useState([])
  const [isActionLocked, setIsActionLocked] = useState(false)
  const [activeStoryItem, setActiveStoryItem] = useState(null)
  const [isStoryComposerOpen, setIsStoryComposerOpen] = useState(false)
  const [storyRecords, setStoryRecords] = useState([])
  const [likedStoryIds, setLikedStoryIds] = useState(new Set())
  const [storyViewerRows, setStoryViewerRows] = useState([])
  const [isStoryViewerRowsLoading, setIsStoryViewerRowsLoading] = useState(false)
  const [isStoryActivityOpen, setIsStoryActivityOpen] = useState(false)
  const [storyActionFeedback, setStoryActionFeedback] = useState("")
  const [authenticatedStoryUserId, setAuthenticatedStoryUserId] = useState("")
  const [cardDragOffsetX, setCardDragOffsetX] = useState(0)
  const enterTimeoutRef = useRef(null)
  const swipeTimeoutRef = useRef(null)
  const cardDragRef = useRef({
    activePointerId: null,
    startX: 0,
    startY: 0,
    isDragging: false,
    ignoreGesture: false,
  })
  const suppressCardClickRef = useRef(false)

  const savedEventIds = useMemo(
    () => new Set((savedEvents || []).map((event) => String(event.id))),
    [savedEvents]
  )

  const dismissedEventIdSet = useMemo(
    () => new Set(dismissedEventIds.map((eventId) => String(eventId))),
    [dismissedEventIds]
  )
  const followingIdSet = useMemo(
    () => new Set((followingList || []).map((person) => String(person.id))),
    [followingList]
  )
  const baseStoryItems = useMemo(
    () =>
      buildDiscoverStoryItems({
        currentUser,
        followingList,
        followersList,
        allEvents,
      }),
    [allEvents, currentUser, followersList, followingList]
  )
  const storyItems = useMemo(
    () =>
      buildDiscoverStoryStripItems({
        currentUser,
        baseItems: baseStoryItems,
        storyRecords,
      }),
    [baseStoryItems, currentUser, storyRecords]
  )
  const friendCards = useMemo(
    () =>
      buildDiscoverFriendCards({
        currentUser,
        followingList,
        followersList,
        allEvents,
      }),
    [allEvents, currentUser, followersList, followingList]
  )

  const discoverEvents = useMemo(
    () =>
      (allEvents || []).filter((event) => {
        const eventId = String(event.id)
        return !savedEventIds.has(eventId) && !dismissedEventIdSet.has(eventId)
      }),
    [allEvents, dismissedEventIdSet, savedEventIds]
  )

  const safeCurrentIndex =
    discoverEvents.length > 0 ? Math.min(currentIndex, discoverEvents.length - 1) : 0
  const currentEvent = discoverEvents[safeCurrentIndex] || null
  const nextIndex =
    discoverEvents.length > safeCurrentIndex + 1 ? safeCurrentIndex + 1 : null
  const nextEvent = nextIndex !== null ? discoverEvents[nextIndex] : null
  const activeStoryMedia =
    Array.isArray(activeStoryItem?.stories) && activeStoryItem.stories.length > 0
      ? activeStoryItem.stories[0]
      : null
  const effectiveStoryUserId = authenticatedStoryUserId || currentUser?.id || ""
  const activeStoryAuthorId = activeStoryMedia?.authorId || ""
  const isViewingOwnStory =
    activeStoryMedia && String(activeStoryMedia.authorId || "") === String(effectiveStoryUserId)
  const ownerPreviewViewers = storyViewerRows.slice(0, 3)
  const isActiveStoryLiked = activeStoryMedia
    ? likedStoryIds.has(String(activeStoryMedia.id))
    : false
  const liveCardTilt = Math.max(Math.min(cardDragOffsetX / 16, 12), -12)
  const liveCardOpacity = Math.max(0.88, 1 - Math.abs(cardDragOffsetX) / 420)
  const cardDragStyle =
    Math.abs(cardDragOffsetX) > 0 && !swipeDirection
      ? {
          transform: `translateX(${cardDragOffsetX}px) rotate(${liveCardTilt}deg)`,
          opacity: liveCardOpacity,
          transition: "none",
        }
      : undefined

  const prepareNextCard = useCallback((removedIndex, previousLength) => {
    const remainingLength = Math.max(previousLength - 1, 0)

    if (enterTimeoutRef.current) {
      clearTimeout(enterTimeoutRef.current)
    }

    setCurrentIndex(remainingLength === 0 ? 0 : Math.min(removedIndex, remainingLength - 1))
    setSwipeDirection("")
    setCardEntering(remainingLength > 0)

    if (remainingLength > 0) {
      enterTimeoutRef.current = setTimeout(() => {
        setCardEntering(false)
      }, 260)
      return
    }

    setCardEntering(false)
  }, [])

  const handleAccept = useCallback(() => {
    if (!currentEvent || isActionLocked) return

    const removedIndex = safeCurrentIndex
    const previousLength = discoverEvents.length

    setIsActionLocked(true)
    setButtonFlash("flash-accept")
    setSwipeDirection("swipe-right")

    if (swipeTimeoutRef.current) {
      clearTimeout(swipeTimeoutRef.current)
    }

    swipeTimeoutRef.current = setTimeout(() => {
      addEvent(
        {
          ...currentEvent,
          rsvpDate: new Date().toISOString(),
        },
        currentUser
      )

      prepareNextCard(removedIndex, previousLength)
      setButtonFlash("")
      setIsActionLocked(false)
    }, 300)
  }, [
    addEvent,
    currentEvent,
    currentUser,
    discoverEvents.length,
    isActionLocked,
    prepareNextCard,
    safeCurrentIndex,
  ])

  const handleReject = useCallback(() => {
    if (!currentEvent || isActionLocked) return

    const removedIndex = safeCurrentIndex
    const previousLength = discoverEvents.length
    const rejectedEventId = String(currentEvent.id)

    setIsActionLocked(true)
    setButtonFlash("flash-reject")
    setSwipeDirection("swipe-left")

    if (swipeTimeoutRef.current) {
      clearTimeout(swipeTimeoutRef.current)
    }

    swipeTimeoutRef.current = setTimeout(() => {
      setDismissedEventIds((prev) =>
        prev.includes(rejectedEventId) ? prev : [...prev, rejectedEventId]
      )

      prepareNextCard(removedIndex, previousLength)
      setButtonFlash("")
      setIsActionLocked(false)
    }, 300)
  }, [currentEvent, discoverEvents.length, isActionLocked, prepareNextCard, safeCurrentIndex])

  const handleCardPointerDown = useCallback(
    (event) => {
      if (!currentEvent || isActionLocked || event.button !== 0) return

      const target = event.target instanceof Element ? event.target : null
      const isInteractiveTarget = Boolean(
        target?.closest("button, a, input, textarea, select, [role='button']")
      )

      if (isInteractiveTarget) {
        cardDragRef.current = {
          activePointerId: null,
          startX: 0,
          startY: 0,
          isDragging: false,
          ignoreGesture: true,
        }
        return
      }

      suppressCardClickRef.current = false
      cardDragRef.current = {
        activePointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        isDragging: false,
        ignoreGesture: false,
      }

      event.currentTarget.setPointerCapture?.(event.pointerId)
    },
    [currentEvent, isActionLocked]
  )

  const handleCardPointerMove = useCallback(
    (event) => {
      const dragState = cardDragRef.current

      if (
        !currentEvent ||
        isActionLocked ||
        dragState.ignoreGesture ||
        dragState.activePointerId !== event.pointerId
      ) {
        return
      }

      const deltaX = event.clientX - dragState.startX
      const deltaY = event.clientY - dragState.startY

      if (!dragState.isDragging) {
        if (Math.abs(deltaX) < DRAG_INTENT_PX) return
        if (Math.abs(deltaY) > Math.abs(deltaX)) return

        dragState.isDragging = true
      }

      event.preventDefault()
      setCardDragOffsetX(Math.max(Math.min(deltaX, 180), -180))
    },
    [currentEvent, isActionLocked, DRAG_INTENT_PX]
  )

  const finishCardDrag = useCallback(
    (event) => {
      const dragState = cardDragRef.current

      if (dragState.activePointerId !== event.pointerId) return

      event.currentTarget.releasePointerCapture?.(event.pointerId)

      const finalOffsetX = dragState.isDragging ? cardDragOffsetX : 0

      cardDragRef.current = {
        activePointerId: null,
        startX: 0,
        startY: 0,
        isDragging: false,
        ignoreGesture: false,
      }
      setCardDragOffsetX(0)

      if (!dragState.isDragging) return

      if (finalOffsetX >= SWIPE_TRIGGER_PX) {
        suppressCardClickRef.current = true
        handleAccept()
        return
      }

      if (finalOffsetX <= -SWIPE_TRIGGER_PX) {
        suppressCardClickRef.current = true
        handleReject()
        return
      }
      suppressCardClickRef.current = false
    },
    [cardDragOffsetX, handleAccept, handleReject, SWIPE_TRIGGER_PX]
  )

  const handleCardClickCapture = useCallback((event) => {
    if (!suppressCardClickRef.current) return

    event.preventDefault()
    event.stopPropagation()

    window.setTimeout(() => {
      suppressCardClickRef.current = false
    }, 0)
  }, [])

  const handleOpenStory = useCallback((item) => {
    if (!item) return
    setIsStoryComposerOpen(false)
    setIsStoryActivityOpen(false)
    setStoryActionFeedback("")
    setStoryViewerRows([])
    setIsStoryViewerRowsLoading(false)
    setActiveStoryItem(item)
  }, [])

  const handleCloseStory = useCallback(() => {
    setActiveStoryItem(null)
    setIsStoryActivityOpen(false)
    setStoryActionFeedback("")
    setStoryViewerRows([])
    setIsStoryViewerRowsLoading(false)
  }, [])

  const handleOpenStoryComposer = useCallback(() => {
    setActiveStoryItem(null)
    setIsStoryActivityOpen(false)
    setStoryActionFeedback("")
    setIsStoryComposerOpen(true)
  }, [])

  const handleCloseStoryComposer = useCallback(() => {
    setIsStoryComposerOpen(false)
  }, [])

  const loadStories = useCallback(async () => {
    const storyUserId =
      (await loadAuthenticatedDiscoverStoryUserId()) || currentUser?.id || ""
    const nextStories = await loadActiveDiscoverStories({
      currentUser,
      baseItems: baseStoryItems,
    })
    const nextLikedStoryIds = await loadDiscoverReactedStoryIds({
      storyIds: nextStories.map((story) => String(story.id)),
    })

    setAuthenticatedStoryUserId(storyUserId)
    setStoryRecords(nextStories)
    setLikedStoryIds(nextLikedStoryIds)
  }, [baseStoryItems, currentUser])

  const handleSubmitStoryComposer = useCallback(
    async ({ file, caption }) => {
      if (!file || !currentUser?.id) {
        window.alert("You need to be logged in to share a story.")
        return
      }

      try {
        await uploadDiscoverStory({
          authorId: currentUser.id,
          file,
          caption,
        })

        await loadStories()
        setIsStoryComposerOpen(false)
      } catch (error) {
        window.alert(
          error?.message || "Could not share your story right now. Please try again."
        )
      }
    },
    [currentUser, loadStories]
  )

  const handleToggleStoryActivity = useCallback(() => {
    setIsStoryActivityOpen((prev) => !prev)
  }, [])

  const handleOpenStoryMessage = useCallback(() => {
    if (!activeStoryAuthorId) return

    handleCloseStory()
    navigate(`/messages?thread=${activeStoryAuthorId}`)
  }, [activeStoryAuthorId, handleCloseStory, navigate])

  const handleToggleStoryHeart = useCallback(async () => {
    if (!activeStoryMedia?.id || isViewingOwnStory) return

    const storyId = String(activeStoryMedia.id)
    const nextActive = !likedStoryIds.has(storyId)

    setLikedStoryIds((prev) => {
      const next = new Set(prev)
      if (nextActive) {
        next.add(storyId)
      } else {
        next.delete(storyId)
      }
      return next
    })

    try {
      await toggleDiscoverStoryHeart({
        storyId,
        nextActive,
      })
    } catch (error) {
      setLikedStoryIds((prev) => {
        const next = new Set(prev)
        if (nextActive) {
          next.delete(storyId)
        } else {
          next.add(storyId)
        }
        return next
      })

      setStoryActionFeedback(
        error?.message || "Could not update your story reaction right now."
      )
    }
  }, [activeStoryMedia, isViewingOwnStory, likedStoryIds])

  const handleShareStory = useCallback(async () => {
    if (!activeStoryMedia) return

    const shareUrl = activeStoryMedia.mediaUrl || window.location.href
    const shareText =
      activeStoryMedia.caption ||
      `Story from ${activeStoryItem?.name || activeStoryMedia.authorName || "Campus User"}`

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Campus Story",
          text: shareText,
          url: shareUrl,
        })
        setStoryActionFeedback("Story shared.")
        return
      } catch (error) {
        if (error?.name === "AbortError") {
          return
        }
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl)
      setStoryActionFeedback("Story link copied.")
    } catch {
      window.prompt("Copy story link:", shareUrl)
      setStoryActionFeedback("Story link ready to copy.")
    }
  }, [activeStoryItem?.name, activeStoryMedia])

  useEffect(() => {
    const syncStories = async () => {
      await loadStories()
    }

    syncStories()
  }, [loadStories])

  useEffect(() => {
    if (!storyActionFeedback) return undefined

    const timeoutId = window.setTimeout(() => {
      setStoryActionFeedback("")
    }, 2400)

    return () => window.clearTimeout(timeoutId)
  }, [storyActionFeedback])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (activeStoryItem) {
        if (event.key === "Escape") {
          handleCloseStory()
        }
        return
      }

      if (isStoryComposerOpen && event.key === "Escape") {
        handleCloseStoryComposer()
        return
      }

      if (event.key === "ArrowRight") handleAccept()
      if (event.key === "ArrowLeft") handleReject()
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [
    activeStoryItem,
    handleAccept,
    handleCloseStory,
    handleCloseStoryComposer,
    handleReject,
    isStoryComposerOpen,
  ])

  useEffect(() => {
    return () => {
      if (enterTimeoutRef.current) {
        clearTimeout(enterTimeoutRef.current)
      }
      if (swipeTimeoutRef.current) {
        clearTimeout(swipeTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    let isActive = true

    const syncStoryViewerState = async () => {
      if (!activeStoryMedia?.id || !effectiveStoryUserId) {
        if (!isActive) return
        setStoryViewerRows([])
        setIsStoryViewerRowsLoading(false)
        return
      }

      if (isViewingOwnStory) {
        setIsStoryViewerRowsLoading(true)

        const nextViewerRows = await fetchDiscoverStoryViewers({
          storyId: activeStoryMedia.id,
        })

        if (!isActive) return

        setStoryViewerRows(nextViewerRows)
        setIsStoryViewerRowsLoading(false)
        return
      }

      setStoryViewerRows([])
      setIsStoryViewerRowsLoading(false)
      await recordDiscoverStoryView({
        storyId: activeStoryMedia.id,
        viewerId: effectiveStoryUserId,
      })
    }

    syncStoryViewerState()

    return () => {
      isActive = false
    }
  }, [activeStoryMedia, effectiveStoryUserId, isViewingOwnStory])

  const handleOpenSuggestion = useCallback(() => {
    setActiveMode("friends")
  }, [])

  const handleResetStack = useCallback(() => {
    setDismissedEventIds([])
    setCurrentIndex(0)
    setSwipeDirection("")
    setCardEntering(false)
  }, [])

  const handleCreateEvent = useCallback(() => {
    navigate("/create")
  }, [navigate])

  const handleOpenPerson = useCallback(
    (person) => {
      if (!person?.routeKey) return
      navigate(`/profile/${person.routeKey}`)
    },
    [navigate]
  )

  const handleToggleFollow = useCallback(
    async (person, isFollowing) => {
      if (!person?.profileId) return

      if (isFollowing) {
        await unfollow(person.profileId)
        return
      }

      await follow(person.profileId)
    },
    [follow, unfollow]
  )

  return (
    <main className="discover">
      <div className="discover-shell">
        <div className="discover-topbar">
          <button className="header-icon-btn" onClick={handleCreateEvent} aria-label="Create Event">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        </div>

        <DiscoverStoriesRow
          items={storyItems}
          onOpenStory={handleOpenStory}
          onOpenSuggestion={handleOpenSuggestion}
          onOpenCreateStory={handleOpenStoryComposer}
        />

        <div className="discover-switch-wrap">
          <DiscoverModeSwitch activeMode={activeMode} onChange={setActiveMode} />
        </div>

        {activeMode === "events" ? (
          <div className={`swipe-area ${!currentEvent ? "stack-empty" : ""}`}>
            <button
              className={`swipe-btn reject ${!currentEvent ? "inactive" : ""} ${buttonFlash === "flash-reject" ? "active-flash-reject" : ""}`}
              onClick={handleReject}
              disabled={!currentEvent || isActionLocked}
              aria-label="Skip current event"
            >
              ↺
            </button>

            <div className="discover-stack">
              {currentEvent ? (
                <>
                  {nextEvent && (
                    <div className="next-card-preview">
                      <EventCard event={nextEvent} />
                    </div>
                  )}

                  <div
                    className={`discover-card-wrap ${swipeDirection} ${cardEntering ? "card-enter" : ""}`}
                    onPointerDown={handleCardPointerDown}
                    onPointerMove={handleCardPointerMove}
                    onPointerUp={finishCardDrag}
                    onPointerCancel={finishCardDrag}
                    onClickCapture={handleCardClickCapture}
                    style={{
                      ...cardDragStyle,
                      touchAction: "pan-y",
                      cursor:
                        Math.abs(cardDragOffsetX) > 0
                          ? "grabbing"
                          : currentEvent && !isActionLocked
                            ? "grab"
                            : "default",
                    }}
                  >
                    <EventCard event={currentEvent} />
                  </div>
                </>
              ) : (
                <div className="discover-end-card">
                  <div className="discover-end-kicker">You're caught up</div>
                  <h2>The stack is clear for now.</h2>
                  <p>
                    You made it through the current Discover lineup. Reload the
                    stack, switch to Friends, or create something people should
                    see next.
                  </p>

                  <div className="discover-end-actions">
                    <button
                      type="button"
                      className="discover-end-action primary"
                      onClick={handleResetStack}
                    >
                      Reload Stack
                    </button>
                    <button
                      type="button"
                      className="discover-end-action secondary"
                      onClick={handleOpenSuggestion}
                    >
                      See Friends
                    </button>
                  </div>

                  <button
                    type="button"
                    className="discover-end-link"
                    onClick={handleCreateEvent}
                  >
                    Create an Event
                  </button>
                </div>
              )}
            </div>

            <button
              className={`swipe-btn accept ${!currentEvent ? "inactive" : ""} ${buttonFlash === "flash-accept" ? "active-flash-accept" : ""}`}
              onClick={handleAccept}
              disabled={!currentEvent || isActionLocked}
              aria-label="Accept current event"
            >
              ↻
            </button>
          </div>
        ) : (
          <DiscoverFriendsPanel
            items={friendCards}
            followingIds={followingIdSet}
            onOpenPerson={handleOpenPerson}
            onToggleFollow={handleToggleFollow}
          />
        )}
      </div>

      {activeStoryItem ? (
        <div
          aria-hidden="true"
          onClick={handleCloseStory}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1600,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            background: "rgba(3, 5, 10, 0.82)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
          }}
        >
          <div
            aria-modal="true"
            role="dialog"
            aria-label={`${activeStoryItem.username || activeStoryItem.name} story`}
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "min(420px, 100%)",
              borderRadius: "28px",
              padding: "20px",
              color: "var(--text-main, #f5f7fb)",
              background:
                "linear-gradient(180deg, rgba(12, 16, 26, 0.98), rgba(7, 10, 18, 0.98))",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              boxShadow: "0 28px 70px rgba(0, 0, 0, 0.34)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                marginBottom: "18px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                <img
                  src={activeStoryItem.avatar}
                  alt={activeStoryItem.username || activeStoryItem.name}
                  onError={(event) => {
                    event.currentTarget.src = "/default-avatar.png"
                  }}
                  style={{
                    width: "52px",
                    height: "52px",
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: "2px solid rgba(255,255,255,0.9)",
                    boxShadow: "0 10px 24px rgba(37, 99, 235, 0.16)",
                    flexShrink: 0,
                  }}
                />
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "1rem",
                      fontWeight: 800,
                      lineHeight: 1.2,
                      color: "var(--text-main, #f5f7fb)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {activeStoryItem.name || activeStoryItem.username || "Campus User"}
                  </div>
                  <div
                    style={{
                      marginTop: "4px",
                      color: "rgba(226, 232, 240, 0.72)",
                      fontSize: "0.82rem",
                      fontWeight: 600,
                    }}
                  >
                    {activeStoryMedia?.createdAt
                      ? new Date(activeStoryMedia.createdAt).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : activeStoryItem.meta || "Story"}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseStory}
                aria-label="Close story viewer"
                style={{
                  width: "38px",
                  height: "38px",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: "999px",
                  cursor: "pointer",
                  color: "var(--text-main, #f5f7fb)",
                  background: "rgba(255, 255, 255, 0.06)",
                  fontSize: "1rem",
                  fontWeight: 700,
                }}
              >
                ×
              </button>
            </div>

            <div
              style={{
                position: "relative",
                overflow: "hidden",
                borderRadius: "24px",
                aspectRatio: "9 / 16",
                background:
                  "radial-gradient(circle at top, rgba(37,99,235,0.22), transparent 34%), linear-gradient(180deg, rgba(19,27,41,0.98), rgba(8,12,20,0.98))",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                padding: "22px",
                border: "1px solid rgba(255, 255, 255, 0.08)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: "18px 18px auto auto",
                  padding: "7px 10px",
                  borderRadius: "999px",
                  background: "rgba(15, 23, 42, 0.42)",
                  color: "rgba(248, 250, 252, 0.84)",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  letterSpacing: "0.02em",
                }}
              >
                {activeStoryMedia ? "Story Preview" : "Web Story Preview"}
              </div>

              {activeStoryMedia ? (
                activeStoryMedia.mediaType === "video" ? (
                  <video
                    src={activeStoryMedia.mediaUrl}
                    controls
                    autoPlay
                    muted
                    loop
                    playsInline
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <img
                    src={activeStoryMedia.mediaUrl}
                    alt="Story preview"
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                )
              ) : null}

              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    activeStoryMedia
                      ? "linear-gradient(180deg, rgba(6,8,14,0.18), rgba(6,8,14,0.58) 60%, rgba(6,8,14,0.82))"
                      : "linear-gradient(180deg, rgba(6,8,14,0.06), rgba(6,8,14,0.46) 52%, rgba(6,8,14,0.82))",
                }}
              />

              <div
                style={{
                  position: "relative",
                  zIndex: 1,
                  color: "#f8fafc",
                  maxWidth: "280px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <div style={{ fontSize: "1.45rem", fontWeight: 800, lineHeight: 1.05 }}>
                  {activeStoryMedia?.caption ||
                    activeStoryItem.featuredTitle ||
                    activeStoryItem.name ||
                    "Campus story"}
                </div>
                <div
                  style={{
                    color: "rgba(241,245,249,0.82)",
                    fontSize: "0.95rem",
                    lineHeight: 1.5,
                  }}
                >
                  {activeStoryMedia
                    ? activeStoryMedia.caption ||
                      "Shared from Discover stories and synced through the live campus feed."
                    : activeStoryItem.bio ||
                      activeStoryItem.featuredMeta ||
                      "Story playback is not wired on web yet, so this lightweight preview keeps the story interaction connected here."}
                </div>
              </div>
            </div>

            {storyActionFeedback ? (
              <div
                style={{
                  marginTop: "14px",
                  color: "rgba(226, 232, 240, 0.78)",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  lineHeight: 1.45,
                }}
                role="status"
                aria-live="polite"
              >
                {storyActionFeedback}
              </div>
            ) : null}

            {isViewingOwnStory && isStoryActivityOpen ? (
              <div
                style={{
                  marginTop: "16px",
                  padding: "16px",
                  borderRadius: "20px",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  background: "rgba(255, 255, 255, 0.04)",
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
                  <div
                    style={{
                      color: "rgba(248, 250, 252, 0.92)",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                    }}
                  >
                    Viewer activity
                  </div>

                  <button
                    type="button"
                    onClick={handleToggleStoryActivity}
                    style={{
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      background: "transparent",
                      color: "rgba(226, 232, 240, 0.76)",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                    }}
                  >
                    Hide
                  </button>
                </div>

                {isStoryViewerRowsLoading ? (
                  <div
                    style={{
                      marginTop: "12px",
                      color: "rgba(226, 232, 240, 0.72)",
                      fontSize: "0.88rem",
                      lineHeight: 1.5,
                    }}
                  >
                    Loading viewer activity...
                  </div>
                ) : storyViewerRows.length > 0 ? (
                  <div
                    style={{
                      display: "grid",
                      gap: "10px",
                      marginTop: "12px",
                      maxHeight: "220px",
                      overflowY: "auto",
                      paddingRight: "4px",
                    }}
                  >
                    {storyViewerRows.map((viewer) => (
                      <div
                        key={viewer.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "12px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            minWidth: 0,
                          }}
                        >
                          <img
                            src={viewer.avatar || "/default-avatar.png"}
                            alt={viewer.username || viewer.name}
                            onError={(event) => {
                              event.currentTarget.src = "/default-avatar.png"
                            }}
                            style={{
                              width: "36px",
                              height: "36px",
                              borderRadius: "50%",
                              objectFit: "cover",
                              flexShrink: 0,
                            }}
                          />
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                color: "var(--text-main, #f5f7fb)",
                                fontSize: "0.88rem",
                                fontWeight: 700,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {viewer.name}
                            </div>
                            <div
                              style={{
                                marginTop: "2px",
                                color: "rgba(226, 232, 240, 0.7)",
                                fontSize: "0.78rem",
                                fontWeight: 600,
                              }}
                            >
                              {viewer.username ? `@${viewer.username}` : "Campus User"}
                            </div>
                          </div>
                        </div>

                        <div
                          style={{
                            color: "rgba(226, 232, 240, 0.68)",
                            fontSize: "0.76rem",
                            fontWeight: 600,
                            flexShrink: 0,
                          }}
                        >
                          {viewer.viewedAt
                            ? new Date(viewer.viewedAt).toLocaleTimeString([], {
                                hour: "numeric",
                                minute: "2-digit",
                              })
                            : "Recently"}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      marginTop: "12px",
                      color: "rgba(226, 232, 240, 0.72)",
                      fontSize: "0.88rem",
                      lineHeight: 1.5,
                    }}
                  >
                    No viewers yet. When people open this story, they will appear here.
                  </div>
                )}
              </div>
            ) : null}

            {isViewingOwnStory ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  marginTop: "16px",
                }}
              >
                <button
                  type="button"
                  onClick={handleToggleStoryActivity}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    padding: "12px 14px",
                    borderRadius: "999px",
                    cursor: "pointer",
                    background: "rgba(255, 255, 255, 0.06)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    color: "var(--text-main, #f5f7fb)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      minWidth: "44px",
                    }}
                  >
                    {ownerPreviewViewers.length > 0 ? (
                      ownerPreviewViewers.map((viewer, index) => (
                        <img
                          key={viewer.id}
                          src={viewer.avatar || "/default-avatar.png"}
                          alt={viewer.username || viewer.name}
                          onError={(event) => {
                            event.currentTarget.src = "/default-avatar.png"
                          }}
                          style={{
                            width: "30px",
                            height: "30px",
                            borderRadius: "50%",
                            objectFit: "cover",
                            marginLeft: index === 0 ? 0 : "-10px",
                            border: "2px solid rgba(12, 16, 26, 0.96)",
                            boxShadow: "0 4px 14px rgba(0, 0, 0, 0.18)",
                          }}
                        />
                      ))
                    ) : (
                      <div
                        aria-hidden="true"
                        style={{
                          width: "30px",
                          height: "30px",
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "rgba(255, 255, 255, 0.08)",
                          color: "rgba(248, 250, 252, 0.8)",
                          fontSize: "0.76rem",
                          fontWeight: 700,
                        }}
                      >
                        0
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      gap: "2px",
                      minWidth: 0,
                    }}
                  >
                    <span
                      style={{
                        color: "var(--text-main, #f5f7fb)",
                        fontSize: "0.9rem",
                        fontWeight: 700,
                      }}
                    >
                      {isStoryViewerRowsLoading
                        ? "Activity"
                        : storyViewerRows.length > 0
                          ? `${storyViewerRows.length} Views`
                          : "Views"}
                    </span>
                    <span
                      style={{
                        color: "rgba(226, 232, 240, 0.68)",
                        fontSize: "0.78rem",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {isStoryActivityOpen
                        ? "Hide viewer list"
                        : "Open viewer activity"}
                    </span>
                  </div>

                  <span
                    style={{
                      marginLeft: "auto",
                      color: "rgba(226, 232, 240, 0.76)",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {isStoryActivityOpen ? "Hide" : "Open"}
                  </span>
                </button>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  marginTop: "16px",
                }}
              >
                <button
                  type="button"
                  onClick={handleOpenStoryMessage}
                  style={{
                    flex: 1,
                    minHeight: "52px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-start",
                    padding: "0 18px",
                    borderRadius: "999px",
                    cursor: "pointer",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    background: "rgba(255, 255, 255, 0.08)",
                    color: "rgba(248, 250, 252, 0.92)",
                    fontSize: "0.94rem",
                    fontWeight: 700,
                  }}
                >
                  Send message...
                </button>

                <button
                  type="button"
                  onClick={handleToggleStoryHeart}
                  aria-label={isActiveStoryLiked ? "Remove heart reaction" : "Heart this story"}
                  aria-pressed={isActiveStoryLiked}
                  style={{
                    width: "52px",
                    height: "52px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "999px",
                    cursor: "pointer",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    background: "rgba(255, 255, 255, 0.06)",
                    color: isActiveStoryLiked ? "#ff6b8b" : "var(--text-main, #f5f7fb)",
                    boxShadow: isActiveStoryLiked
                      ? "0 12px 24px rgba(255, 107, 139, 0.18)"
                      : "none",
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill={isActiveStoryLiked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.9">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 20.25s-6.716-4.308-9.093-8.216C.974 8.907 2.01 4.5 6.09 4.5c2.07 0 3.308 1.154 3.91 2.125.602-.97 1.84-2.125 3.91-2.125 4.08 0 5.116 4.407 3.183 7.534C18.716 15.942 12 20.25 12 20.25Z"
                    />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={handleShareStory}
                  aria-label="Share story"
                  style={{
                    width: "52px",
                    height: "52px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "999px",
                    cursor: "pointer",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    background: "rgba(255, 255, 255, 0.06)",
                    color: "var(--text-main, #f5f7fb)",
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21 3 10 14"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m21 3-7 18-4-7-7-4 18-7Z"
                    />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}

      <DiscoverStoryComposer
        isOpen={isStoryComposerOpen}
        onClose={handleCloseStoryComposer}
        onSubmit={handleSubmitStoryComposer}
      />
    </main>
  )
}

export default Discover
