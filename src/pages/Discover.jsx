import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import DiscoverFriendsPanel from "../components/DiscoverFriendsPanel"
import DiscoverModeSwitch from "../components/DiscoverModeSwitch"
import DiscoverStoriesRow from "../components/DiscoverStoriesRow"
import EventCard from "../components/EventCard"
import { useEvents } from "../context/EventContext"
import {
  buildDiscoverFriendCards,
  buildDiscoverStoryItems,
} from "../discoverSocial"

function Discover() {
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
  const enterTimeoutRef = useRef(null)
  const swipeTimeoutRef = useRef(null)

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
  const storyItems = useMemo(
    () =>
      buildDiscoverStoryItems({
        currentUser,
        followingList,
        followersList,
        allEvents,
      }),
    [allEvents, currentUser, followersList, followingList]
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

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "ArrowRight") handleAccept()
      if (event.key === "ArrowLeft") handleReject()
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleAccept, handleReject])

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
          onOpenSuggestion={handleOpenSuggestion}
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

                  <div className={`discover-card-wrap ${swipeDirection} ${cardEntering ? "card-enter" : ""}`}>
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
    </main>
  )
}

export default Discover
