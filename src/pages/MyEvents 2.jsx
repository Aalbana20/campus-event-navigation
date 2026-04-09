import React, { useRef, useState } from "react"
import MyEventCard from "../components/MyEventCard"
import { useEvents } from "../context/EventContext"

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

const parseEventDate = (rawDate) => {
  if (!rawDate || typeof rawDate !== "string") return null

  const isoMatch = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) {
    return {
      year: Number(isoMatch[1]),
      month: Number(isoMatch[2]) - 1,
      day: Number(isoMatch[3]),
    }
  }

  const monthDayMatch = rawDate.match(/^([A-Za-z]+)\s+(\d{1,2})$/)
  if (monthDayMatch) {
    const month = MONTH_NAMES.findIndex((name) => name === monthDayMatch[1])
    if (month === -1) return null
    return {
      year: new Date().getFullYear(),
      month,
      day: Number(monthDayMatch[2]),
    }
  }

  return null
}

function MyEvents() {
  const [viewMode, setViewMode] = useState("cards")
  const [selectedCalendarEvent, setSelectedCalendarEvent] = useState(null)
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false)
  const { savedEvents } = useEvents()

  const now = new Date()
  const [currentMonth, setCurrentMonth] = useState(
    () => new Date(now.getFullYear(), now.getMonth(), 1)
  )
  const touchStartXRef = useRef(null)
  const mouseStartXRef = useRef(null)

  const calendarMonth = currentMonth.getMonth()
  const calendarYear = currentMonth.getFullYear()

  const goToPrevMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
    setSelectedCalendarEvent(null)
  }

  const goToNextMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
    setSelectedCalendarEvent(null)
  }

  const handleMonthChange = (value) => {
    if (!value) return
    const [year, month] = value.split("-").map(Number)
    if (!year || !month) return
    setCurrentMonth(new Date(year, month - 1, 1))
    setIsMonthPickerOpen(false)
    setSelectedCalendarEvent(null)
  }

  const handleTouchStart = (event) => {
    touchStartXRef.current = event.changedTouches[0].clientX
  }

  const handleTouchEnd = (event) => {
    if (touchStartXRef.current === null) return
    const endX = event.changedTouches[0].clientX
    const deltaX = endX - touchStartXRef.current
    touchStartXRef.current = null

    if (Math.abs(deltaX) < 44) return
    if (deltaX < 0) goToNextMonth()
    else goToPrevMonth()
  }

  const handleMouseDown = (event) => {
    mouseStartXRef.current = event.clientX
  }

  const handleMouseUp = (event) => {
    if (mouseStartXRef.current === null) return
    const deltaX = event.clientX - mouseStartXRef.current
    mouseStartXRef.current = null

    if (Math.abs(deltaX) < 56) return
    if (deltaX < 0) goToNextMonth()
    else goToPrevMonth()
  }

  const getEventForDay = (day) => {
    return savedEvents.find((event) => {
      const parsedDate = parseEventDate(event.eventDate || event.date)
      if (!parsedDate) return false

      return (
        parsedDate.year === calendarYear &&
        parsedDate.month === calendarMonth &&
        parsedDate.day === day
      )
    })
  }

  const firstDayOffset = new Date(calendarYear, calendarMonth, 1).getDay()
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate()
  const monthInputValue = `${calendarYear}-${String(calendarMonth + 1).padStart(2, "0")}`

  return (
    <main className="my-events-page">
      <p className="eyebrow">Events you’ve RSVP’d to</p>
      <h1>My Events</h1>

      <div className="view-toggle">
        <button
          className={viewMode === "cards" ? "toggle-btn active" : "toggle-btn"}
          onClick={() => setViewMode("cards")}
        >
          Cards
        </button>

        <button
          className={viewMode === "calendar" ? "toggle-btn active" : "toggle-btn"}
          onClick={() => setViewMode("calendar")}
        >
          Calendar
        </button>
      </div>

      {savedEvents.length === 0 ? (
        <p style={{ marginTop: "20px", color: "#6e6e73", fontSize: "18px" }}>
          No events saved yet. Swipe right on Discover to RSVP.
        </p>
      ) : viewMode === "cards" ? (
        <div className="cards-scroll">
          {savedEvents.map((event) => (
            <MyEventCard key={event.id} event={event} />
          ))}
        </div>
      ) : (
        <div className="calendar-view">
          <div
            className="calendar-swipe-zone"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
          >
            <div className="calendar-box">
              <div className="calendar-header">
                <div className="calendar-month-nav">
                  <button
                    className="calendar-arrow-btn"
                    onClick={goToPrevMonth}
                    aria-label="Previous month"
                  >
                    ←
                  </button>
                  <button
                    className="calendar-month-btn"
                    onClick={() => setIsMonthPickerOpen((prev) => !prev)}
                  >
                    {MONTH_NAMES[calendarMonth]} {calendarYear}
                  </button>
                  <button
                    className="calendar-arrow-btn"
                    onClick={goToNextMonth}
                    aria-label="Next month"
                  >
                    →
                  </button>
                </div>

                {isMonthPickerOpen && (
                  <input
                    type="month"
                    className="calendar-month-picker"
                    value={monthInputValue}
                    onChange={(e) => handleMonthChange(e.target.value)}
                  />
                )}
              </div>

              <div className="calendar-grid">
                <div className="calendar-day header">Sun</div>
                <div className="calendar-day header">Mon</div>
                <div className="calendar-day header">Tue</div>
                <div className="calendar-day header">Wed</div>
                <div className="calendar-day header">Thu</div>
                <div className="calendar-day header">Fri</div>
                <div className="calendar-day header">Sat</div>

                {Array.from({ length: firstDayOffset }, (_, index) => (
                  <div key={`empty-${index}`} className="calendar-day empty"></div>
                ))}

                {Array.from({ length: daysInMonth }, (_, index) => {
                  const day = index + 1
                  const event = getEventForDay(day)

                  return (
                    <div
                      key={day}
                      className={`calendar-day ${event ? "has-event clickable" : ""}`}
                      onClick={() => event && setSelectedCalendarEvent(event)}
                    >
                      <span>{day}</span>
                      {event && (
                        <span className="calendar-event">{event.title}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {selectedCalendarEvent && (
            <div
              className="calendar-modal-overlay"
              onClick={() => setSelectedCalendarEvent(null)}
            >
              <div
                className="calendar-modal-card"
                onClick={(e) => e.stopPropagation()}
              >
                <MyEventCard event={selectedCalendarEvent} />
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  )
}

export default MyEvents
