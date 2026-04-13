import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../supabaseClient"
import DiscoverModeSwitch from "../components/DiscoverModeSwitch"
import DiscoverCommentsDrawer from "../components/DiscoverCommentsDrawer"
import DiscoverStoryComposer from "../components/DiscoverStoryComposer"
import DiscoverStoriesRow from "../components/DiscoverStoriesRow"
import DiscoverVideoFeed from "../components/DiscoverVideoFeed"
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

const SAVED_FOR_LATER_KEY = "discover-saved-for-later-event-ids"


const readSavedForLaterIds = () => {
  if (typeof window === "undefined") return new Set()

  try {
    const rawValue = window.localStorage.getItem(SAVED_FOR_LATER_KEY)
    const parsedValue = rawValue ? JSON.parse(rawValue) : []

    if (!Array.isArray(parsedValue)) {
      return new Set()
    }

    return new Set(parsedValue.map((value) => String(value)))
  } catch {
    return new Set()
  }
}

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
    repostedEventIds,
    repostEvent,
    unrepostEvent,
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
  const [savedForLaterIds, setSavedForLaterIds] = useState(() => readSavedForLaterIds())
  const [discoverActionFeedback, setDiscoverActionFeedback] = useState("")
  const [activeCommentEventId, setActiveCommentEventId] = useState(null)
  const [commentDraft, setCommentDraft] = useState("")
  const [eventCommentsById, setEventCommentsById] = useState({})
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
  const currentEventId = currentEvent ? String(currentEvent.id) : ""
  const isCurrentEventSavedForLater = currentEventId
    ? savedForLaterIds.has(currentEventId)
    : false
  const activeCommentEvent = useMemo(() => {
    if (!activeCommentEventId) return null

    const matchedEvent = (allEvents || []).find(
      (event) => String(event.id) === String(activeCommentEventId)
    )

    return matchedEvent || (currentEventId === String(activeCommentEventId) ? currentEvent : null)
  }, [activeCommentEventId, allEvents, currentEvent, currentEventId])
  const activeEventComments = activeCommentEventId
    ? eventCommentsById[String(activeCommentEventId)] || []
    : []
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

  const handleRsvpAction = useCallback(() => {
    if (!currentEvent || isActionLocked) return
    handleAccept()
  }, [currentEvent, handleAccept, isActionLocked])

  const handleToggleSaveForLater = useCallback(() => {
    if (!currentEvent) return

    const eventId = String(currentEvent.id)
    let nextSavedState = false

    setSavedForLaterIds((currentValue) => {
      const nextValue = new Set(currentValue)

      if (nextValue.has(eventId)) {
        nextValue.delete(eventId)
        nextSavedState = false
      } else {
        nextValue.add(eventId)
        nextSavedState = true
      }

      return nextValue
    })

    setDiscoverActionFeedback(nextSavedState ? "Saved for later." : "Removed from saved.")
  }, [currentEvent])

  const loadComments = useCallback(async (eventId) => {
    const { data, error } = await supabase
      .from("event_comments")
      .select("id, body, created_at, user_id, profiles(name, username, avatar_url)")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true })

    if (error) {
      console.error("Failed to load comments:", error)
      return
    }

    const normalized = (data || []).map((row) => ({
      id: String(row.id),
      authorName: row.profiles?.name || row.profiles?.username || "Campus User",
      authorUsername: row.profiles?.username || "",
      body: row.body,
      createdAt: row.created_at,
    }))

    setEventCommentsById((prev) => ({ ...prev, [String(eventId)]: normalized }))
  }, [])

  const handleOpenComments = useCallback(() => {
    if (!currentEvent) return

    setActiveCommentEventId(String(currentEvent.id))
    setCommentDraft("")
    loadComments(String(currentEvent.id))
  }, [currentEvent, loadComments])

  const handleCloseComments = useCallback(() => {
    setActiveCommentEventId(null)
    setCommentDraft("")
  }, [])

  const handleSubmitComment = useCallback(async () => {
    if (!activeCommentEvent || !commentDraft.trim()) return

    const eventId = String(activeCommentEvent.id)
    const userId = JSON.parse(localStorage.getItem("user") || "{}").id
    const body = commentDraft.trim()

    const optimisticComment = {
      id: `optimistic-${Date.now()}`,
      authorName: currentUser?.name || currentUser?.username || "Campus User",
      authorUsername: currentUser?.username || "",
      body,
      createdAt: new Date().toISOString(),
    }

    setEventCommentsById((prev) => ({
      ...prev,
      [eventId]: [...(prev[eventId] || []), optimisticComment],
    }))
    setCommentDraft("")

    if (!userId) return

    const { data, error } = await supabase
      .from("event_comments")
      .insert({ event_id: eventId, user_id: userId, body })
      .select("id")
      .single()

    if (error) {
      console.error("Failed to save comment:", error)
      setEventCommentsById((prev) => ({
        ...prev,
        [eventId]: (prev[eventId] || []).filter((c) => c.id !== optimisticComment.id),
      }))
      return
    }

    setEventCommentsById((prev) => ({
      ...prev,
      [eventId]: (prev[eventId] || []).map((c) =>
        c.id === optimisticComment.id ? { ...c, id: String(data.id) } : c
      ),
    }))
  }, [activeCommentEvent, commentDraft, currentUser?.name, currentUser?.username])

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
    if (typeof window === "undefined") return
    window.localStorage.setItem(
      SAVED_FOR_LATER_KEY,
      JSON.stringify(Array.from(savedForLaterIds))
    )
  }, [savedForLaterIds])

  useEffect(() => {
    if (!discoverActionFeedback) return undefined

    const timeoutId = window.setTimeout(() => {
      setDiscoverActionFeedback("")
    }, 2200)

    return () => window.clearTimeout(timeoutId)
  }, [discoverActionFeedback])

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

      if (activeCommentEventId && event.key === "Escape") {
        handleCloseComments()
        return
      }

      if (activeCommentEventId) {
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
    handleCloseComments,
    handleCloseStoryComposer,
    handleReject,
    activeCommentEventId,
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
    handleCloseComments()
    setActiveMode("friends")
  }, [handleCloseComments])

  const handleChangeDiscoverMode = useCallback(
    (nextMode) => {
      if (nextMode !== "events") {
        handleCloseComments()
      }

      setActiveMode(nextMode)
    },
    [handleCloseComments]
  )

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

  const repostedIdSet = useMemo(
    () => new Set(Array.from(repostedEventIds || []).map((value) => String(value))),
    [repostedEventIds]
  )

  const handleFeedHeart = useCallback((event) => {
    if (!event?.id) return

    const eventId = String(event.id)
    let nextSavedState = false

    setSavedForLaterIds((currentValue) => {
      const nextValue = new Set(currentValue)

      if (nextValue.has(eventId)) {
        nextValue.delete(eventId)
        nextSavedState = false
      } else {
        nextValue.add(eventId)
        nextSavedState = true
      }

      return nextValue
    })

    setDiscoverActionFeedback(nextSavedState ? "Saved for later." : "Removed from saved.")
  }, [])

  const handleFeedComment = useCallback(
    (event) => {
      if (!event?.id) return
      setActiveCommentEventId(String(event.id))
      setCommentDraft("")
      loadComments(String(event.id))
    },
    [loadComments]
  )

  const handleFeedRepost = useCallback(
    async (event) => {
      if (!event?.id) return

      const eventId = String(event.id)
      if (repostedIdSet.has(eventId)) {
        await unrepostEvent?.(eventId)
        setDiscoverActionFeedback("Removed repost.")
        return
      }

      await repostEvent?.(eventId)
      setDiscoverActionFeedback("Reposted to your feed.")
    },
    [repostEvent, repostedIdSet, unrepostEvent]
  )

  const handleFeedShare = useCallback((event) => {
    if (!event?.id) return

    const shareUrl = `${window.location.origin}/#/event/${event.id}`
    if (navigator.share) {
      navigator
        .share({ title: event.title || "Campus Event", url: shareUrl })
        .catch(() => {
          /* user cancelled */
        })
      return
    }

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(shareUrl)
      setDiscoverActionFeedback("Link copied to clipboard.")
    }
  }, [])

  const handleFeedCreator = useCallback(
    (event) => {
      const creatorHandle =
        event?.creatorUsername || event?.creatorHandle || event?.creatorId
      if (!creatorHandle) return
      navigate(`/profile/${creatorHandle}`)
    },
    [navigate]
  )

  const handleFeedFollow = useCallback(
    async (event) => {
      const creatorId = event?.creatorId || event?.creator_id
      if (!creatorId) return
      const creatorIdString = String(creatorId)
      if (followingIdSet.has(creatorIdString)) {
        await unfollow(creatorId)
        return
      }
      await follow(creatorId)
    },
    [follow, followingIdSet, unfollow]
  )

  const isImmersiveFeed = activeMode === "friends"

  return (
    <main className={`discover ${isImmersiveFeed ? "immersive-feed" : ""}`}>
      <div className="discover-shell">
        {!isImmersiveFeed ? (
          <>
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
          </>
        ) : null}

        <div className="discover-switch-wrap">
          <DiscoverModeSwitch activeMode={activeMode} onChange={handleChangeDiscoverMode} />
        </div>

        {activeMode === "events" ? (
          <div className={`swipe-area ${!currentEvent ? "stack-empty" : ""}`}>
            <button
              className={`swipe-btn reject ${!currentEvent ? "inactive" : ""} ${buttonFlash === "flash-reject" ? "active-flash-reject" : ""}`}
              onClick={handleReject}
              disabled={!currentEvent || isActionLocked}
              aria-label="Skip current event"
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M19 12H5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M11 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <div className="discover-card-group">
              <div className="discover-side-actions-balance" aria-hidden="true" />
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

            {currentEvent ? (
              <aside className="discover-side-actions" aria-label="Event actions">
                <button
                  type="button"
                  className={`discover-side-action rsvp ${buttonFlash === "flash-accept" ? "active-flash-accept" : ""} ${savedEventIds.has(currentEventId) ? "is-rsvped" : ""}`}
                  onClick={handleRsvpAction}
                  disabled={isActionLocked}
                  aria-label="RSVP to event"
                >
                  <span className="discover-side-action-icon rsvp-icon" aria-hidden="true">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="8.5" cy="7" r="4" stroke="currentColor" strokeWidth="1.8" />
                      <polyline points="14 11 16 13 21 8" stroke={buttonFlash === "flash-accept" || savedEventIds.has(currentEventId) ? "#34c759" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="discover-side-action-count">{currentEvent.attendees?.length || currentEvent.rsvpUsers?.length || currentEvent.goingCount || 0}</span>
                </button>

                <button
                  type="button"
                  className={`discover-side-action comment ${activeCommentEventId === currentEventId ? "active" : ""}`}
                  onClick={handleOpenComments}
                  aria-label="Open comments"
                >
                  <span className="discover-side-action-icon" aria-hidden="true">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="9" cy="11.5" r="0.8" fill="currentColor" />
                      <circle cx="12" cy="11.5" r="0.8" fill="currentColor" />
                      <circle cx="15" cy="11.5" r="0.8" fill="currentColor" />
                    </svg>
                  </span>
                  <span className="discover-side-action-count">{eventCommentsById[currentEventId]?.length || 0}</span>
                </button>

                <button
                  type="button"
                  className={`discover-side-action save ${isCurrentEventSavedForLater ? "active" : ""}`}
                  onClick={handleToggleSaveForLater}
                  aria-label="Save event for later"
                >
                  <span className="discover-side-action-icon" aria-hidden="true">
                    <svg width="30" height="30" viewBox="0 0 24 24" fill={isCurrentEventSavedForLater ? "currentColor" : "none"}>
                      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="discover-side-action-count">0</span>
                </button>
              </aside>
            ) : (
              <div className="discover-side-actions-placeholder" aria-hidden="true" />
            )}
            </div>

            <button
              type="button"
              className={`swipe-btn accept ${!currentEvent ? "inactive" : ""} ${buttonFlash === "flash-accept" ? "active-flash-accept" : ""}`}
              onClick={handleAccept}
              disabled={!currentEvent || isActionLocked}
              aria-label="Accept event"
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        ) : (
          <DiscoverVideoFeed
            events={discoverEvents}
            savedIds={savedForLaterIds}
            repostedIds={repostedIdSet}
            followingIdSet={followingIdSet}
            onPressHeart={handleFeedHeart}
            onPressComment={handleFeedComment}
            onPressRepost={handleFeedRepost}
            onPressShare={handleFeedShare}
            onPressCreator={handleFeedCreator}
            onPressFollow={handleFeedFollow}
          />
        )}

        {discoverActionFeedback ? (
          <p className="discover-action-feedback" role="status" aria-live="polite">
            {discoverActionFeedback}
          </p>
        ) : null}
      </div>

      <DiscoverCommentsDrawer
        open={Boolean(activeCommentEventId)}
        event={activeCommentEvent}
        comments={activeEventComments}
        draft={commentDraft}
        onDraftChange={setCommentDraft}
        onSubmit={handleSubmitComment}
        onClose={handleCloseComments}
      />

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
