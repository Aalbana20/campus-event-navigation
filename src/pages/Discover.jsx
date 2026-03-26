import { useEffect, useState } from "react"
import EventCard from "../components/EventCard"
import { useEvents } from "../context/EventContext"

function Discover() {
  const { addEvent, allEvents } = useEvents()

  const [currentIndex, setCurrentIndex] = useState(0)
  const [swipeDirection, setSwipeDirection] = useState("")
  const [buttonFlash, setButtonFlash] = useState("")
  const [cardEntering, setCardEntering] = useState(false)

  useEffect(() => {
    if (currentIndex >= allEvents.length) {
      setCurrentIndex(0)
    }
  }, [allEvents, currentIndex])

  if (allEvents.length === 0) {
    return (
      <main className="discover">
        <p className="eyebrow">Find your next event</p>
        <h1>Discover</h1>
        <p>No events available yet.</p>
      </main>
    )
  }

  const nextIndex = (currentIndex + 1) % allEvents.length

  const showNextEvent = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % allEvents.length)
    setSwipeDirection("")
    setCardEntering(true)

    setTimeout(() => {
      setCardEntering(false)
    }, 260)
  }

  const handleAccept = () => {
    addEvent(allEvents[currentIndex])
    setButtonFlash("flash-accept")
    setSwipeDirection("swipe-right")

    setTimeout(() => {
      showNextEvent()
      setButtonFlash("")
    }, 300)
  }

  const handleReject = () => {
    setButtonFlash("flash-reject")
    setSwipeDirection("swipe-left")

    setTimeout(() => {
      showNextEvent()
      setButtonFlash("")
    }, 300)
  }

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "ArrowRight") handleAccept()
      if (event.key === "ArrowLeft") handleReject()
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  })

  return (
    <main className="discover">
      <p className="eyebrow">Find your next event</p>
      <h1>Discover</h1>

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
            <EventCard event={allEvents[currentIndex]} />
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