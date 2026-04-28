import React, { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import CreateEvent from "../CreateEvent"
import ExploreEventModal from "../components/ExploreEventModal"
import { applyEventImageFallback, getEventImageSrc } from "../eventImages"
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

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const HOUR_LABELS = [
  "12 AM",
  "1 AM",
  "2 AM",
  "3 AM",
  "4 AM",
  "5 AM",
  "6 AM",
  "7 AM",
  "8 AM",
  "9 AM",
  "10 AM",
  "11 AM",
  "Noon",
  "1 PM",
  "2 PM",
  "3 PM",
  "4 PM",
  "5 PM",
  "6 PM",
  "7 PM",
  "8 PM",
  "9 PM",
  "10 PM",
  "11 PM",
]
const FILTER_OPTIONS = [
  { id: "all", label: "All" },
  { id: "going", label: "Going" },
  { id: "created", label: "Created" },
]
const VIEW_OPTIONS = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "year", label: "Year" },
]
const PERSONAL_STORAGE_KEY = "campus-personal-calendar-items"

const startOfDay = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate())

const addDays = (date, amount) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount)

const addMonths = (date, amount) =>
  new Date(date.getFullYear(), date.getMonth() + amount, 1)

const addYears = (date, amount) =>
  new Date(date.getFullYear() + amount, date.getMonth(), 1)

const startOfWeek = (date) => addDays(startOfDay(date), -date.getDay())

const getDateKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`

const isSameDay = (left, right) => getDateKey(left) === getDateKey(right)

const parseEventDateObject = (rawDate) => {
  if (!rawDate || typeof rawDate !== "string") return null

  const isoMatch = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) {
    return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]))
  }

  const monthDayMatch = rawDate.match(/^([A-Za-z]+)\s+(\d{1,2})$/)
  if (monthDayMatch) {
    const month = MONTH_NAMES.findIndex((name) => name === monthDayMatch[1])
    if (month === -1) return null
    return new Date(new Date().getFullYear(), month, Number(monthDayMatch[2]))
  }

  return null
}

const formatDayLabel = (date) =>
  date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })

const formatRangeLabel = (startDate, endDate) => {
  const sameMonth = startDate.getMonth() === endDate.getMonth()
  const sameYear = startDate.getFullYear() === endDate.getFullYear()

  if (sameMonth && sameYear) {
    return `${MONTH_NAMES[startDate.getMonth()]} ${startDate.getDate()}-${endDate.getDate()}, ${startDate.getFullYear()}`
  }

  return `${startDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })} - ${endDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  })}`
}

const getViewTitle = (viewMode, anchorDate) => {
  if (viewMode === "day") {
    return `${MONTH_NAMES[anchorDate.getMonth()]} ${anchorDate.getDate()}, ${anchorDate.getFullYear()}`
  }

  if (viewMode === "week") {
    const weekStart = startOfWeek(anchorDate)
    return formatRangeLabel(weekStart, addDays(weekStart, 6))
  }

  if (viewMode === "year") {
    return String(anchorDate.getFullYear())
  }

  return `${MONTH_NAMES[anchorDate.getMonth()]} ${anchorDate.getFullYear()}`
}

const getViewSubtitle = (viewMode, anchorDate) => {
  if (viewMode === "day") return formatDayLabel(anchorDate)
  if (viewMode === "week") return "Week"
  if (viewMode === "year") return "Year overview"
  return "Month"
}

const getEventSearchText = (item) =>
  [
    item.title,
    item.description,
    item.location,
    item.locationName,
    item.organizer,
    item.sourceLabel,
    item.time,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

const isCreatedByCurrentUser = (event, currentUser) => {
  const currentId = String(currentUser?.id || "")
  const currentUsername = String(currentUser?.username || "").toLowerCase()
  const eventCreatorId = String(event?.createdBy || event?.created_by || "")
  const eventCreatorUsername = String(event?.creatorUsername || event?.creator_username || "").toLowerCase()

  return Boolean(
    (currentId && eventCreatorId && currentId === eventCreatorId) ||
      (currentUsername && eventCreatorUsername && currentUsername === eventCreatorUsername)
  )
}

const buildCalendarEventItem = ({ event, source, currentUser }) => {
  const date = parseEventDateObject(event.eventDate || event.date)
  if (!date) return null

  return {
    id: `event-${event.id}`,
    itemType: "event",
    source,
    sourceLabel: source === "created" ? "Created" : "Attending",
    title: event.title || "Campus Event",
    date,
    dateKey: getDateKey(date),
    time: event.time || event.startTime || "",
    location: event.locationName || event.location || "",
    description: event.description || "",
    event,
    isCreated: isCreatedByCurrentUser(event, currentUser),
  }
}

const buildPersonalItem = (item) => {
  const date = parseEventDateObject(item.date)
  if (!date) return null

  return {
    id: `personal-${item.id}`,
    itemType: "personal",
    source: "personal",
    sourceLabel: "Personal",
    title: item.title || "Personal",
    date,
    dateKey: getDateKey(date),
    time: item.time || "",
    location: "",
    description: item.note || "",
    personalItem: item,
  }
}

function SegmentedControl({ label, options, value, onChange, className = "" }) {
  const activeIndex = Math.max(
    options.findIndex((option) => option.id === value),
    0
  )

  return (
    <div
      className={`calendar-segmented ${className}`}
      role="group"
      aria-label={label}
      style={{
        "--segment-count": options.length,
        "--segment-index": activeIndex,
      }}
    >
      <span className="calendar-segmented-thumb" aria-hidden="true" />
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={`calendar-segmented-btn ${value === option.id ? "active" : ""}`}
          onClick={() => onChange(option.id)}
          aria-pressed={value === option.id}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function CalendarItemPill({ item, compact = false, onOpen }) {
  return (
    <button
      type="button"
      className={`calendar-item-pill ${item.source} ${compact ? "compact" : ""}`}
      onClick={(event) => {
        event.stopPropagation()
        onOpen(item)
      }}
    >
      <span className="calendar-item-dot" aria-hidden="true" />
      <span className="calendar-item-title">{item.title}</span>
      {!compact && item.time ? <span className="calendar-item-time">{item.time}</span> : null}
    </button>
  )
}

function MonthCalendar({ anchorDate, itemsByDate, onOpenItem, onSelectDate }) {
  const month = anchorDate.getMonth()
  const year = anchorDate.getFullYear()
  const firstDay = new Date(year, month, 1)
  const gridStart = addDays(firstDay, -firstDay.getDay())
  const today = startOfDay(new Date())

  return (
    <div className="apple-calendar-month-grid">
      {WEEKDAY_LABELS.map((day) => (
        <div key={day} className="apple-calendar-weekday">
          {day}
        </div>
      ))}
      {Array.from({ length: 42 }, (_, index) => {
        const date = addDays(gridStart, index)
        const dateKey = getDateKey(date)
        const dayItems = itemsByDate.get(dateKey) || []
        const isMuted = date.getMonth() !== month
        const isToday = isSameDay(date, today)

        return (
          <button
            key={dateKey}
            type="button"
            className={`apple-calendar-day ${isMuted ? "muted" : ""} ${isToday ? "today" : ""}`}
            onClick={() => onSelectDate(date)}
          >
            <span className="apple-calendar-day-number">{date.getDate()}</span>
            <span className="apple-calendar-day-events">
              {dayItems.slice(0, 3).map((item) => (
                <CalendarItemPill
                  key={item.id}
                  item={item}
                  compact
                  onOpen={onOpenItem}
                />
              ))}
              {dayItems.length > 3 ? (
                <span className="calendar-more-count">+{dayItems.length - 3} more</span>
              ) : null}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function WeekCalendar({ anchorDate, itemsByDate, onOpenItem, onSelectDate }) {
  const weekStart = startOfWeek(anchorDate)
  const today = startOfDay(new Date())
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))

  return (
    <div className="apple-calendar-week">
      <div className="apple-calendar-week-head">
        <div className="apple-calendar-time-gutter" />
        {weekDays.map((date) => (
          <button
            key={getDateKey(date)}
            type="button"
            className={`week-day-heading ${isSameDay(date, today) ? "today" : ""}`}
            onClick={() => onSelectDate(date)}
          >
            <span>{WEEKDAY_LABELS[date.getDay()]}</span>
            <strong>{date.getDate()}</strong>
          </button>
        ))}
      </div>

      <div className="apple-calendar-all-day-row">
        <div className="apple-calendar-time-gutter">all-day</div>
        {weekDays.map((date) => {
          const dayItems = itemsByDate.get(getDateKey(date)) || []

          return (
            <div key={getDateKey(date)} className="week-all-day-cell">
              {dayItems.slice(0, 3).map((item) => (
                <CalendarItemPill key={item.id} item={item} compact onOpen={onOpenItem} />
              ))}
            </div>
          )
        })}
      </div>

      <div className="apple-calendar-time-grid">
        <div className="apple-calendar-hour-labels">
          {HOUR_LABELS.slice(3, 22).map((hour) => (
            <span key={hour}>{hour}</span>
          ))}
        </div>
        <div className="apple-calendar-hour-columns">
          {weekDays.map((date) => (
            <div key={getDateKey(date)} className="apple-calendar-hour-column">
              {HOUR_LABELS.slice(3, 22).map((hour) => (
                <span key={hour} className="apple-calendar-hour-line" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function DayCalendar({ anchorDate, itemsByDate, onOpenItem }) {
  const dayItems = itemsByDate.get(getDateKey(anchorDate)) || []

  return (
    <div className="apple-calendar-day-view">
      <div className="day-all-day-strip">
        <span>all-day</span>
        <div>
          {dayItems.length > 0 ? (
            dayItems.map((item) => (
              <CalendarItemPill key={item.id} item={item} onOpen={onOpenItem} />
            ))
          ) : (
            <p>No items scheduled.</p>
          )}
        </div>
      </div>

      <div className="apple-calendar-day-grid">
        <div className="apple-calendar-hour-labels">
          {HOUR_LABELS.slice(3, 22).map((hour) => (
            <span key={hour}>{hour}</span>
          ))}
        </div>
        <div className="day-hour-column">
          {HOUR_LABELS.slice(3, 22).map((hour) => (
            <span key={hour} className="apple-calendar-hour-line" />
          ))}
        </div>
      </div>
    </div>
  )
}

function MiniMonth({ monthDate, itemsByDate, onSelectDate }) {
  const month = monthDate.getMonth()
  const year = monthDate.getFullYear()
  const firstDay = new Date(year, month, 1)
  const gridStart = addDays(firstDay, -firstDay.getDay())
  const today = startOfDay(new Date())

  return (
    <div className="year-mini-month">
      <h3>{MONTH_NAMES[month]}</h3>
      <div className="year-mini-weekdays">
        {WEEKDAY_LABELS.map((day) => (
          <span key={day}>{day[0]}</span>
        ))}
      </div>
      <div className="year-mini-grid">
        {Array.from({ length: 42 }, (_, index) => {
          const date = addDays(gridStart, index)
          const dateKey = getDateKey(date)
          const hasItems = (itemsByDate.get(dateKey) || []).length > 0

          return (
            <button
              key={dateKey}
              type="button"
              className={`year-mini-day ${date.getMonth() !== month ? "muted" : ""} ${
                isSameDay(date, today) ? "today" : ""
              } ${hasItems ? "has-items" : ""}`}
              onClick={() => onSelectDate(date)}
            >
              {date.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function YearCalendar({ anchorDate, itemsByDate, onSelectDate }) {
  const year = anchorDate.getFullYear()

  return (
    <div className="apple-calendar-year-grid">
      {Array.from({ length: 12 }, (_, month) => (
        <MiniMonth
          key={month}
          monthDate={new Date(year, month, 1)}
          itemsByDate={itemsByDate}
          onSelectDate={onSelectDate}
        />
      ))}
    </div>
  )
}

function PersonalItemModal({ item, onClose }) {
  if (!item) return null

  return (
    <div className="calendar-modal-overlay" onClick={onClose}>
      <div className="personal-calendar-modal" onClick={(event) => event.stopPropagation()}>
        <span className="personal-modal-kicker">Personal</span>
        <h2>{item.title}</h2>
        <p>{item.date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
        {item.time ? <p>{item.time}</p> : null}
        {item.description ? <p>{item.description}</p> : null}
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}

function MyEventsLane({ items, onOpenItem, emptyMessage }) {
  if (!items.length) {
    return (
      <div className="my-events-lane-empty">
        <p>{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="my-events-lane" aria-label="My events">
      <div className="my-events-lane-track">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`my-events-lane-card ${item.source}`}
            onClick={() => onOpenItem(item)}
          >
            <span className="my-events-lane-thumb" aria-hidden="true">
              {item.image ? (
                <img
                  src={getEventImageSrc(item.image)}
                  alt=""
                  onError={applyEventImageFallback}
                />
              ) : (
                <span className="my-events-lane-thumb-fallback">
                  {item.title.slice(0, 1).toUpperCase()}
                </span>
              )}
            </span>
            <span className="my-events-lane-title">{item.title}</span>
            <span className="my-events-lane-meta">
              {item.source === "created"
                ? "Created"
                : item.source === "personal"
                  ? "Personal"
                  : "Going"}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function MyEvents() {
  const { savedEvents, allEvents, currentUser } = useEvents()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedCalendarEvent, setSelectedCalendarEvent] = useState(null)
  const [selectedPersonalItem, setSelectedPersonalItem] = useState(null)
  const [calendarFilter, setCalendarFilter] = useState("all")
  const [calendarView, setCalendarView] = useState("month")
  const [searchQuery, setSearchQuery] = useState("")
  const [personalItems, setPersonalItems] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(PERSONAL_STORAGE_KEY) || "[]")
    } catch {
      return []
    }
  })
  const [personalDraft, setPersonalDraft] = useState({
    title: "",
    date: getDateKey(new Date()),
    time: "",
    note: "",
  })
  const [isPersonalComposerOpen, setIsPersonalComposerOpen] = useState(false)
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false)
  const [isHeroHidden, setIsHeroHidden] = useState(false)
  const createMenuRef = useRef(null)

  const createMode = searchParams.get("create")
  const isCreateEventOpen = createMode === "event"
  const isPersonalCreateRouteOpen = createMode === "personal"

  const now = new Date()
  const [anchorDate, setAnchorDate] = useState(
    () => new Date(now.getFullYear(), now.getMonth(), now.getDate())
  )
  const touchStartXRef = useRef(null)
  const mouseStartXRef = useRef(null)

  useEffect(() => {
    localStorage.setItem(PERSONAL_STORAGE_KEY, JSON.stringify(personalItems))
  }, [personalItems])

  // Normalize legacy ?tab=... links from earlier iterations of this page.
  useEffect(() => {
    const legacyTab = searchParams.get("tab")
    if (!legacyTab) return
    const next = new URLSearchParams(searchParams)
    next.delete("tab")
    if (legacyTab === "create") next.set("create", "event")
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  // Hide the calendar hero when the user scrolls down past the top zone;
  // reveal it again as soon as they scroll back up.
  useEffect(() => {
    let lastY = window.scrollY
    let rafId = 0

    const handleScroll = () => {
      if (rafId) return
      rafId = window.requestAnimationFrame(() => {
        const currentY = window.scrollY
        const delta = currentY - lastY

        if (currentY < 80) {
          setIsHeroHidden(false)
        } else if (delta > 6) {
          setIsHeroHidden(true)
        } else if (delta < -6) {
          setIsHeroHidden(false)
        }

        lastY = currentY
        rafId = 0
      })
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", handleScroll)
      if (rafId) window.cancelAnimationFrame(rafId)
    }
  }, [])

  useEffect(() => {
    if (!isCreateMenuOpen) return undefined

    const handlePointerDown = (event) => {
      if (createMenuRef.current && !createMenuRef.current.contains(event.target)) {
        setIsCreateMenuOpen(false)
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsCreateMenuOpen(false)
      }
    }

    document.addEventListener("pointerdown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isCreateMenuOpen])

  const openCreateRoute = (target) => {
    setIsCreateMenuOpen(false)
    navigate(target)
  }

  const openCreateEventModal = () => {
    const next = new URLSearchParams(searchParams)
    next.set("create", "event")
    setSearchParams(next, { replace: true })
  }

  const closeCreateEventModal = () => {
    const next = new URLSearchParams(searchParams)
    next.delete("create")
    setSearchParams(next, { replace: true })
  }

  const goToPrevious = () => {
    setAnchorDate((previous) => {
      if (calendarView === "day") return addDays(previous, -1)
      if (calendarView === "week") return addDays(previous, -7)
      if (calendarView === "year") return addYears(previous, -1)
      return addMonths(previous, -1)
    })
  }

  const goToNext = () => {
    setAnchorDate((previous) => {
      if (calendarView === "day") return addDays(previous, 1)
      if (calendarView === "week") return addDays(previous, 7)
      if (calendarView === "year") return addYears(previous, 1)
      return addMonths(previous, 1)
    })
  }

  const handleTouchStart = (event) => {
    touchStartXRef.current = event.changedTouches[0].clientX
  }

  const handleTouchEnd = (event) => {
    if (touchStartXRef.current === null) return
    const deltaX = event.changedTouches[0].clientX - touchStartXRef.current
    touchStartXRef.current = null

    if (Math.abs(deltaX) < 44) return
    if (deltaX < 0) goToNext()
    else goToPrevious()
  }

  const handleMouseDown = (event) => {
    mouseStartXRef.current = event.clientX
  }

  const handleMouseUp = (event) => {
    if (mouseStartXRef.current === null) return
    const deltaX = event.clientX - mouseStartXRef.current
    mouseStartXRef.current = null

    if (Math.abs(deltaX) < 56) return
    if (deltaX < 0) goToNext()
    else goToPrevious()
  }

  const calendarItems = useMemo(() => {
    const createdItems = (allEvents || [])
      .filter((event) => isCreatedByCurrentUser(event, currentUser))
      .map((event) => buildCalendarEventItem({ event, source: "created", currentUser }))
      .filter(Boolean)

    const attendingItems = (savedEvents || [])
      .map((event) => buildCalendarEventItem({ event, source: "attending", currentUser }))
      .filter(Boolean)

    const personalCalendarItems = (personalItems || [])
      .map(buildPersonalItem)
      .filter(Boolean)

    const merged = new Map()

    const addItems = (items) => {
      items.forEach((item) => {
        const existing = merged.get(item.id)
        if (!existing) {
          merged.set(item.id, item)
          return
        }

        merged.set(item.id, {
          ...existing,
          source: existing.source === "created" ? "created" : item.source,
          sourceLabel:
            existing.source === "created" || item.source === "created"
              ? "Created"
              : item.sourceLabel,
        })
      })
    }

    if (calendarFilter === "created") {
      addItems(createdItems)
    } else if (calendarFilter === "going") {
      addItems(attendingItems)
    } else {
      addItems(createdItems)
      addItems(attendingItems)
      addItems(personalCalendarItems)
    }

    const normalizedQuery = searchQuery.trim().toLowerCase()
    return [...merged.values()]
      .filter((item) =>
        normalizedQuery ? getEventSearchText(item).includes(normalizedQuery) : true
      )
      .sort((left, right) => left.date.getTime() - right.date.getTime())
  }, [allEvents, calendarFilter, currentUser, personalItems, savedEvents, searchQuery])

  const laneItems = useMemo(() => {
    return calendarItems
      .filter((item) => item.itemType === "event")
      .map((item) => ({
        ...item,
        image: item.event?.image || "",
      }))
  }, [calendarItems])

  const laneEmptyMessage = useMemo(() => {
    if (calendarFilter === "created") return "You haven't created any events yet."
    if (calendarFilter === "going") return "No events you're going to yet."
    return "No events yet. Create one or RSVP from Discover."
  }, [calendarFilter])

  const itemsByDate = useMemo(() => {
    return calendarItems.reduce((collection, item) => {
      const list = collection.get(item.dateKey) || []
      list.push(item)
      collection.set(item.dateKey, list)
      return collection
    }, new Map())
  }, [calendarItems])

  const handleOpenCalendarItem = (item) => {
    if (item.itemType === "personal") {
      setSelectedPersonalItem(item)
      return
    }

    setSelectedCalendarEvent(item.event)
  }

  const handleSelectDate = (date) => {
    setAnchorDate(date)
    if (calendarView === "year") {
      setCalendarView("month")
    }
  }

  const handleCreatePersonal = () => {
    setPersonalDraft({
      title: "",
      date: getDateKey(anchorDate),
      time: "",
      note: "",
    })
    setIsPersonalComposerOpen(true)
  }

  const closePersonalComposer = () => {
    setIsPersonalComposerOpen(false)
    if (isPersonalCreateRouteOpen) {
      const next = new URLSearchParams(searchParams)
      next.delete("create")
      setSearchParams(next, { replace: true })
    }
  }

  const handleSubmitPersonal = (event) => {
    event.preventDefault()
    const title = personalDraft.title.trim()
    if (!title || !personalDraft.date) return

    setPersonalItems((currentItems) => [
      ...currentItems,
      {
        id: `personal-${Date.now()}`,
        title,
        date: personalDraft.date,
        time: personalDraft.time.trim(),
        note: personalDraft.note.trim(),
      },
    ])
    closePersonalComposer()
  }

  const renderCalendarView = () => {
    if (calendarView === "day") {
      return (
        <DayCalendar
          anchorDate={anchorDate}
          itemsByDate={itemsByDate}
          onOpenItem={handleOpenCalendarItem}
        />
      )
    }

    if (calendarView === "week") {
      return (
        <WeekCalendar
          anchorDate={anchorDate}
          itemsByDate={itemsByDate}
          onOpenItem={handleOpenCalendarItem}
          onSelectDate={handleSelectDate}
        />
      )
    }

    if (calendarView === "year") {
      return (
        <YearCalendar
          anchorDate={anchorDate}
          itemsByDate={itemsByDate}
          onSelectDate={handleSelectDate}
        />
      )
    }

    return (
      <MonthCalendar
        anchorDate={anchorDate}
        itemsByDate={itemsByDate}
        onOpenItem={handleOpenCalendarItem}
        onSelectDate={handleSelectDate}
      />
    )
  }

  return (
    <main className={`calendar-page-shell ${isHeroHidden ? "hero-hidden" : ""}`}>
      <section className="calendar-hero">
        <div className="calendar-hero-heading">
          <p className="calendar-hero-kicker">{getViewSubtitle(calendarView, anchorDate)}</p>
          <h1>{getViewTitle(calendarView, anchorDate)}</h1>
        </div>

        <SegmentedControl
          label="Calendar view"
          options={VIEW_OPTIONS}
          value={calendarView}
          onChange={setCalendarView}
          className="calendar-view-control"
        />

        <div className="calendar-hero-actions">
          <label className="calendar-search calendar-search--inline">
            <span aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                <path d="m20 20-3.8-3.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search calendar"
              aria-label="Search calendar"
            />
          </label>

          <div className="calendar-date-controls" aria-label="Calendar navigation">
            <button type="button" onClick={goToPrevious} aria-label="Previous">
              ‹
            </button>
            <button type="button" className="today-btn" onClick={() => setAnchorDate(startOfDay(new Date()))}>
              Today
            </button>
            <button type="button" onClick={goToNext} aria-label="Next">
              ›
            </button>
          </div>
        </div>
      </section>

      <div className="calendar-workspace">
        <aside className="calendar-command-panel" aria-label="Calendar controls">
          <div className="calendar-command-section">
            <span className="calendar-command-kicker">Scope</span>
            <SegmentedControl
              label="Calendar filter"
              options={FILTER_OPTIONS}
              value={calendarFilter}
              onChange={setCalendarFilter}
              className="calendar-filter-control"
            />
          </div>

          <div className="calendar-command-section" ref={createMenuRef}>
            <span className="calendar-command-kicker">Create</span>
            <button
              type="button"
              className="calendar-command-btn calendar-create-trigger"
              aria-haspopup="menu"
              aria-expanded={isCreateMenuOpen}
              onClick={() => setIsCreateMenuOpen((open) => !open)}
            >
              <span className="calendar-create-trigger-icon" aria-hidden="true">+</span>
              <span>Create</span>
            </button>

            {isCreateMenuOpen && (
              <div className="calendar-create-menu calendar-create-menu--panel" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => openCreateRoute("/home?create=post")}
                >
                  Post
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => openCreateRoute("/home?create=story")}
                >
                  Story
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsCreateMenuOpen(false)
                    handleCreatePersonal()
                  }}
                >
                  Personal
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsCreateMenuOpen(false)
                    openCreateEventModal()
                  }}
                >
                  Event
                </button>
              </div>
            )}
          </div>

          <div className="calendar-command-section">
            <span className="calendar-command-kicker">Hosting</span>
            <button
              type="button"
              className="calendar-command-btn calendar-manage-trigger"
              onClick={() => navigate("/events/manage")}
            >
              <span aria-hidden="true">⚙</span>
              <span>Manage Events</span>
            </button>
          </div>

          <div className="calendar-command-section">
            <span className="calendar-command-kicker">My Events</span>
            <MyEventsLane
              items={laneItems}
              onOpenItem={handleOpenCalendarItem}
              emptyMessage={laneEmptyMessage}
            />
          </div>
        </aside>

        <section
          className={`calendar-main-surface view-${calendarView}`}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
        >
          {renderCalendarView()}
        </section>
      </div>

      {selectedCalendarEvent && (
        <ExploreEventModal
          event={selectedCalendarEvent}
          isSaved={(savedEvents || []).some(
            (event) => String(event.id) === String(selectedCalendarEvent.id)
          )}
          actionLabel={
            (savedEvents || []).some(
              (event) => String(event.id) === String(selectedCalendarEvent.id)
            )
              ? "Going"
              : "RSVP"
          }
          onClose={() => setSelectedCalendarEvent(null)}
        />
      )}

      <PersonalItemModal
        item={selectedPersonalItem}
        onClose={() => setSelectedPersonalItem(null)}
      />

      {isPersonalComposerOpen || isPersonalCreateRouteOpen ? (
        <div className="calendar-modal-overlay" onClick={closePersonalComposer}>
          <form className="personal-calendar-form" onSubmit={handleSubmitPersonal} onClick={(event) => event.stopPropagation()}>
            <span className="personal-modal-kicker">Personal</span>
            <h2>Personal</h2>
            <label>
              Title
              <input
                value={personalDraft.title}
                onChange={(event) =>
                  setPersonalDraft((draft) => ({ ...draft, title: event.target.value }))
                }
                autoFocus
              />
            </label>
            <label>
              Date
              <input
                type="date"
                value={personalDraft.date}
                onChange={(event) =>
                  setPersonalDraft((draft) => ({ ...draft, date: event.target.value }))
                }
              />
            </label>
            <label>
              Time
              <input
                value={personalDraft.time}
                onChange={(event) =>
                  setPersonalDraft((draft) => ({ ...draft, time: event.target.value }))
                }
                placeholder="Optional"
              />
            </label>
            <label>
              Notes
              <textarea
                value={personalDraft.note}
                onChange={(event) =>
                  setPersonalDraft((draft) => ({ ...draft, note: event.target.value }))
                }
                placeholder="Optional"
              />
            </label>
            <div className="personal-form-actions">
              <button type="button" onClick={closePersonalComposer}>
                Cancel
              </button>
              <button type="submit">Add</button>
            </div>
          </form>
        </div>
      ) : null}

      {isCreateEventOpen ? (
        <div className="calendar-modal-overlay create-event-modal-overlay" onClick={closeCreateEventModal}>
          <div
            className="create-event-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Create event"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="create-event-modal-close"
              onClick={closeCreateEventModal}
              aria-label="Close"
            >
              ×
            </button>
            <CreateEvent embedded modal onPublished={closeCreateEventModal} />
          </div>
        </div>
      ) : null}
    </main>
  )
}

export default MyEvents
