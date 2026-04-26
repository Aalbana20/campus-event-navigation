import React, { useEffect, useMemo, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useEvents } from "../context/EventContext"
import { applyEventImageFallback, getEventImageSrc } from "../eventImages"
import {
  DAY_MS,
  TIMELINE_WINDOW_DAYS,
  dateFromKey,
  formatEventDateTime,
  formatTimelineDateLabel,
  getEventStartDate,
  isEventRecapEligible,
  startOfLocalDay,
  toDateKey,
} from "../recaps"
import "./Recaps.css"

function buildRecapTimeline(events) {
  const now = new Date()
  const today = startOfLocalDay(now)
  const todayKey = toDateKey(today)
  const eligibleEvents = (events || [])
    .map((event) => {
      const start = getEventStartDate(event)
      return start && isEventRecapEligible(event, now)
        ? { event, start, dateKey: toDateKey(startOfLocalDay(start)) }
        : null
    })
    .filter(Boolean)

  const dateKeys = new Set()
  for (let offset = -TIMELINE_WINDOW_DAYS; offset <= TIMELINE_WINDOW_DAYS; offset += 1) {
    dateKeys.add(toDateKey(new Date(today.getTime() + offset * DAY_MS)))
  }
  eligibleEvents.forEach(({ dateKey }) => dateKeys.add(dateKey))

  return [...dateKeys]
    .sort((left, right) => dateFromKey(right).getTime() - dateFromKey(left).getTime())
    .map((dateKey) => {
      const date = dateFromKey(dateKey)
      const dayEvents = eligibleEvents
        .filter((item) => item.dateKey === dateKey)
        .sort((left, right) => left.start.getTime() - right.start.getTime())

      return {
        dateKey,
        label: formatTimelineDateLabel(date, todayKey),
        isToday: dateKey === todayKey,
        events: dayEvents,
      }
    })
}

export default function Recaps() {
  const navigate = useNavigate()
  const { allEvents } = useEvents()
  const todayRef = useRef(null)
  const timeline = useMemo(() => buildRecapTimeline(allEvents), [allEvents])

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      todayRef.current?.scrollIntoView({ block: "center" })
    })
    return () => window.cancelAnimationFrame(id)
  }, [timeline.length])

  return (
    <main className="recaps-page">
      <section className="recaps-shell">
        <header className="recaps-header">
          <button type="button" className="recaps-back-btn" onClick={() => navigate(-1)}>
            ‹
          </button>
          <div>
            <p className="recaps-kicker">Event memories</p>
            <h1>Recaps</h1>
          </div>
        </header>

        <div className="recaps-timeline" aria-label="Recaps timeline">
          {timeline.map((row) => (
            <section
              key={row.dateKey}
              ref={row.isToday ? todayRef : null}
              className={`recaps-date-section ${row.events.length === 0 ? "compact" : ""}`}
            >
              <div className="recaps-date-header">
                <span />
                <h2 className={row.isToday ? "today" : ""}>{row.label}</h2>
                <span />
              </div>

              {row.events.length > 0 ? (
                <div className="recaps-event-grid">
                  {row.events.map(({ event, start }) => (
                    <button
                      type="button"
                      key={event.id}
                      className="recaps-event-card"
                      onClick={() => navigate(`/recaps/${event.id}`)}
                    >
                      <img
                        src={getEventImageSrc(event.image)}
                        alt=""
                        onError={applyEventImageFallback}
                      />
                      <div className="recaps-event-card-copy">
                        <strong>{event.title}</strong>
                        <span>{formatEventDateTime(event, start)}</span>
                        <em>{event.host || event.organizer || event.creatorName || "Campus Host"}</em>
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </section>
          ))}
        </div>
      </section>
    </main>
  )
}
