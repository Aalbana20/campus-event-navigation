import React, { useCallback, useEffect, useRef, useState } from "react"
import EventCard from "../components/EventCard"
import { useEvents } from "../context/EventContext"

function Discover() {
  const { addEvent, allEvents, currentUser } = useEvents()

  const [currentIndex, setCurrentIndex] = useState(0)
  const [swipeDirection, setSwipeDirection] = useState("")
  const [buttonFlash, setButtonFlash] = useState("")
  const [cardEntering, setCardEntering] = useState(false)
  const enterTimeoutRef = useRef(null)
  const swipeTimeoutRef = useRef(null)

  const safeCurrentIndex = allEvents.length > 0 ? Math.min(currentIndex, allEvents.length - 1) : 0
  const nextIndex = allEvents.length > 0 ? (safeCurrentIndex + 1) % allEvents.length : 0

  const showNextEvent = useCallback(() => {
    if (allEvents.length === 0) return

    setCurrentIndex((prevIndex) => (prevIndex + 1) % allEvents.length)
    setSwipeDirection("")
    setCardEntering(true)

    if (enterTimeoutRef.current) {
      clearTimeout(enterTimeoutRef.current)
    }

    enterTimeoutRef.current = setTimeout(() => {
      setCardEntering(false)
    }, 260)
  }, [allEvents.length])

  const handleAccept = useCallback(() => {
    const currentEvent = allEvents[safeCurrentIndex]
    addEvent({
      ...currentEvent,
      rsvpDate: new Date().toISOString(),
    }, currentUser)
    setButtonFlash("flash-accept")
    setSwipeDirection("swipe-right")

    if (swipeTimeoutRef.current) {
      clearTimeout(swipeTimeoutRef.current)
    }

    swipeTimeoutRef.current = setTimeout(() => {
      showNextEvent()
      setButtonFlash("")
    }, 300)
  }, [addEvent, allEvents, safeCurrentIndex, currentUser, showNextEvent])

  const handleReject = useCallback(() => {
    setButtonFlash("flash-reject")
    setSwipeDirection("swipe-left")

    if (swipeTimeoutRef.current) {
      clearTimeout(swipeTimeoutRef.current)
    }

    swipeTimeoutRef.current = setTimeout(() => {
      showNextEvent()
      setButtonFlash("")
    }, 300)
  }, [showNextEvent])

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

  if (allEvents.length === 0) {
    return (
      <main className="discover">
        <p className="eyebrow">Find your next event</p>
        <h1>Discover</h1>
        <p>No events available yet.</p>
      </main>
    )
  }

  return (
    <main className="discover">
      <p className="eyebrow">Find your next event</p>
      <h1 className="discover-title">Discover</h1>

      <div className="discover-tip">Use ← and → on your keyboard too</div>

      <div className="swipe-area">
        <button
          className={`swipe-btn reject ${buttonFlash === "flash-reject" ? "active-flash-reject" : ""}`}
          onClick={handleReject}
        >
          ↺
        </button>

        <div className="discover-stack">
          <div className="next-card-preview">
            <EventCard event={allEvents[nextIndex]} />
          </div>

          <div className={`discover-card-wrap ${swipeDirection} ${cardEntering ? "card-enter" : ""}`}>
            <EventCard event={allEvents[safeCurrentIndex]} />
          </div>
        </div>

        <button
          className={`swipe-btn accept ${buttonFlash === "flash-accept" ? "active-flash-accept" : ""}`}
          onClick={handleAccept}
        >
          ↻
        </button>
      </div>
    </main>
  )
}

export default Discover
