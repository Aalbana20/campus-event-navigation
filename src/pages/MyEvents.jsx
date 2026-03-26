import React, { useState } from "react"
import MyEventCard from "../components/MyEventCard"
import { useEvents } from "../context/EventContext"

function MyEvents() {
  const [viewMode, setViewMode] = useState("cards")
  const [selectedCalendarEvent, setSelectedCalendarEvent] = useState(null)
  const { savedEvents } = useEvents()

  const getEventForDay = (day) => {
    return savedEvents.find((event) => {
      const parts = event.date.split(" ")
      const dayNumber = parseInt(parts[1], 10)
      return dayNumber === day
    })
  }

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
          <div className="calendar-box">
            <h3>April 2026</h3>

            <div className="calendar-grid">
              <div className="calendar-day header">Sun</div>
              <div className="calendar-day header">Mon</div>
              <div className="calendar-day header">Tue</div>
              <div className="calendar-day header">Wed</div>
              <div className="calendar-day header">Thu</div>
              <div className="calendar-day header">Fri</div>
              <div className="calendar-day header">Sat</div>

              <div className="calendar-day empty"></div>
              <div className="calendar-day empty"></div>

              {Array.from({ length: 30 }, (_, index) => {
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