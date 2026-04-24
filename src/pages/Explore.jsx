import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"

import ExploreEventModal from "../components/ExploreEventModal"
import ExploreEventTile from "../components/ExploreEventTile"
import { useEvents } from "../context/EventContext"
import { loadDiscoverPosts } from "../discoverPosts"
import {
  formatViewCount,
  getPlaceholderViewCount,
  loadContentViewCounts,
  recordContentView,
} from "../contentViews"
import { supabase } from "../supabaseClient"

const MEDIA_OPTIONS = [
  { id: "all", label: "All" },
  { id: "videos", label: "Videos" },
  { id: "pictures", label: "Pictures" },
]

const EVENT_SCOPE_OPTIONS = [
  { id: "nearby", label: "Nearby" },
  { id: "state", label: "State" },
  { id: "country", label: "Country" },
]

const toId = (value) => (value ? String(value) : "")

// Pattern of tall/short tiles to produce the IG-Explore staggered look without
// a masonry lib. Every 6th tile is "tall"; everything else is "short".
const isTallTile = (index) => index % 6 === 0

const timeRank = (value) => {
  const parsed = Date.parse(value || "")
  return Number.isFinite(parsed) ? parsed : 0
}

const interleaveForYou = ({ videos, pictures, events }) => {
  // Round-robin three buckets so the grid always has mixed content.
  const queue = []
  const maxLen = Math.max(videos.length, pictures.length, events.length)
  for (let i = 0; i < maxLen; i += 1) {
    if (videos[i]) queue.push(videos[i])
    if (pictures[i]) queue.push(pictures[i])
    if (events[i]) queue.push(events[i])
  }
  return queue
}

const filterEventsByScope = (events, scope) => {
  // Location logic is a mock for now — `nearby` keeps the Princess Anne /
  // campus-keyword bias the old Explore had, `state` broadens, `country` is
  // unfiltered.
  if (scope === "country") return events
  if (scope === "state") return events

  const nearby = events.filter((event) => {
    const haystack = [
      event?.location,
      event?.locationName,
      event?.locationAddress,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
    return /princess anne|campus|umes|maryland|eastern shore/.test(haystack)
  })
  return nearby.length > 0 ? nearby : events
}

function FilterChevron({ open }) {
  return (
    <svg
      className={`explore-filter-chevron ${open ? "open" : ""}`}
      viewBox="0 0 12 12"
      aria-hidden="true"
    >
      <path d="M4.2 2.8 7.4 6 4.2 9.2" />
    </svg>
  )
}

function GlobeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="explore-globe-icon"
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17" />
      <path d="M12 3.5c2.5 2.5 3.7 5.6 3.7 8.5s-1.2 6-3.7 8.5c-2.5-2.5-3.7-5.6-3.7-8.5s1.2-6 3.7-8.5Z" />
    </svg>
  )
}

function VideoTileOverlay({ viewCount }) {
  return (
    <div className="explore-tile-video-overlay" aria-hidden="true">
      <svg viewBox="0 0 24 24" className="explore-tile-view-eye">
        <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
        <circle cx="12" cy="12" r="2.8" />
      </svg>
      <span>{formatViewCount(viewCount)}</span>
    </div>
  )
}

function PictureTile({ item, onOpen }) {
  return (
    <button
      type="button"
      className={`explore-grid-tile explore-grid-tile-${isTallTile(item.gridIndex) ? "tall" : "short"}`}
      onClick={() => onOpen(item)}
    >
      <img src={item.mediaUrl} alt="" className="explore-tile-media" />
    </button>
  )
}

function VideoTile({ item, onOpen }) {
  const posterRef = useRef(null)
  const videoRef = useRef(null)

  // Prefer thumbnail if supplied, else let the video element render frame one.
  const posterSrc = item.thumbnailUrl || null

  return (
    <button
      type="button"
      className={`explore-grid-tile explore-grid-tile-${isTallTile(item.gridIndex) ? "tall" : "short"}`}
      onClick={() => onOpen(item)}
    >
      {posterSrc ? (
        <img ref={posterRef} src={posterSrc} alt="" className="explore-tile-media" />
      ) : (
        <video
          ref={videoRef}
          className="explore-tile-media"
          src={item.mediaUrl}
          muted
          playsInline
          preload="metadata"
        />
      )}
      <VideoTileOverlay viewCount={item.viewCount} />
    </button>
  )
}

function EventTile({ event, onOpen, gridIndex }) {
  return (
    <div
      className={`explore-grid-tile explore-grid-tile-event explore-grid-tile-${isTallTile(gridIndex) ? "tall" : "short"}`}
    >
      <ExploreEventTile event={event} onOpen={onOpen} />
    </div>
  )
}

function MapModal({ open, onClose }) {
  if (!open) return null
  return (
    <div
      className="explore-map-modal-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="explore-map-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="explore-map-modal-header">
          <strong>Campus events map</strong>
          <button
            type="button"
            className="explore-map-modal-close"
            onClick={onClose}
            aria-label="Close map"
          >
            ×
          </button>
        </div>
        <div className="explore-map-modal-body">
          <div className="explore-map-placeholder">
            <GlobeIcon />
            <p>Map view coming soon</p>
            <small>
              Pins for every event with hover preview cards land here next. Hook up
              Mapbox or Google Maps to replace this placeholder.
            </small>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Explore() {
  const navigate = useNavigate()
  const { events: allEvents = [] } = useEvents() || {}

  const [primaryTab, setPrimaryTab] = useState("forYou") // forYou | media | events
  const [openDropdown, setOpenDropdown] = useState(null) // 'media' | 'events' | null
  const [mediaFilter, setMediaFilter] = useState("all") // all | videos | pictures
  const [eventScope, setEventScope] = useState("nearby") // nearby | state | country

  const [posts, setPosts] = useState([])
  const [viewCountsByPostId, setViewCountsByPostId] = useState(new Map())
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [isMapOpen, setIsMapOpen] = useState(false)

  const barRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    loadDiscoverPosts({
      onData: (next) => {
        if (!cancelled) setPosts(next || [])
      },
    })
      .then((next) => {
        if (!cancelled) setPosts(next || [])
      })
      .catch(() => {
        /* swallow — we just won't have posts */
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!posts.length) return
    let cancelled = false
    const ids = posts.map((post) => toId(post.id)).filter(Boolean)
    loadContentViewCounts({ contentIds: ids })
      .then((counts) => {
        if (cancelled) return
        // Fall back to a placeholder count for posts that have no real rows yet,
        // so the UI still shows activity on a fresh DB.
        const next = new Map()
        for (const id of ids) {
          next.set(id, counts.get(id) || getPlaceholderViewCount(id))
        }
        setViewCountsByPostId(next)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [posts])

  useEffect(() => {
    if (!openDropdown) return
    const handleDocumentPointer = (event) => {
      if (barRef.current && barRef.current.contains(event.target)) return
      setOpenDropdown(null)
    }
    document.addEventListener("mousedown", handleDocumentPointer)
    return () => document.removeEventListener("mousedown", handleDocumentPointer)
  }, [openDropdown])

  const videos = useMemo(
    () =>
      posts
        .filter((post) => post.mediaType === "video")
        .sort((a, b) => timeRank(b.createdAt) - timeRank(a.createdAt))
        .map((post) => ({
          kind: "video",
          id: toId(post.id),
          mediaUrl: post.mediaUrl,
          thumbnailUrl: post.thumbnailUrl || "",
          raw: post,
        })),
    [posts]
  )

  const pictures = useMemo(
    () =>
      posts
        .filter((post) => post.mediaType !== "video")
        .sort((a, b) => timeRank(b.createdAt) - timeRank(a.createdAt))
        .map((post) => ({
          kind: "picture",
          id: toId(post.id),
          mediaUrl: post.mediaUrl,
          raw: post,
        })),
    [posts]
  )

  const eventItems = useMemo(() => {
    const scoped = filterEventsByScope(allEvents, eventScope)
    return scoped
      .slice()
      .sort((a, b) => timeRank(b.createdAt || b.date) - timeRank(a.createdAt || a.date))
      .map((event) => ({
        kind: "event",
        id: toId(event.id),
        raw: event,
      }))
  }, [allEvents, eventScope])

  const gridItems = useMemo(() => {
    if (primaryTab === "media") {
      if (mediaFilter === "videos") return videos
      if (mediaFilter === "pictures") return pictures
      return [...videos, ...pictures].sort(
        (a, b) => timeRank(b.raw?.createdAt) - timeRank(a.raw?.createdAt)
      )
    }
    if (primaryTab === "events") {
      return eventItems
    }
    return interleaveForYou({ videos, pictures, events: eventItems })
  }, [eventItems, mediaFilter, pictures, primaryTab, videos])

  const handlePrimaryTabClick = (tabId) => {
    const hasDropdown = tabId === "media" || tabId === "events"
    if (!hasDropdown) {
      setPrimaryTab(tabId)
      setOpenDropdown(null)
      return
    }
    if (primaryTab !== tabId) {
      setPrimaryTab(tabId)
      setOpenDropdown(null)
      return
    }
    setOpenDropdown((current) => (current === tabId ? null : tabId))
  }

  const handleOpenItem = useCallback(
    (item) => {
      if (item.kind === "event") {
        setSelectedEvent(item.raw)
        void recordContentView({ contentType: "event", contentId: item.id })
        return
      }
      if (item.kind === "video" || item.kind === "picture") {
        const type = item.kind === "video" ? "video" : "post"
        void recordContentView({ contentType: type, contentId: item.id })
        // Posts don't have a dedicated detail route yet — navigate to the
        // author profile as the closest existing surface.
        const username = item.raw?.authorUsername
        if (username) {
          navigate(`/profile/${username}`)
        }
      }
    },
    [navigate]
  )

  const activeMediaLabel =
    MEDIA_OPTIONS.find((opt) => opt.id === mediaFilter)?.label || "Media"
  const activeEventLabel =
    EVENT_SCOPE_OPTIONS.find((opt) => opt.id === eventScope)?.label || "Events"

  return (
    <main className="explore-page explore-page-grid">
      <div className="explore-filter-bar" ref={barRef} role="tablist" aria-label="Explore filters">
        <button
          type="button"
          className={`explore-filter-tab ${primaryTab === "forYou" ? "active" : ""}`}
          role="tab"
          aria-selected={primaryTab === "forYou"}
          onClick={() => handlePrimaryTabClick("forYou")}
        >
          For You
        </button>

        <div className="explore-filter-tab-slot">
          <button
            type="button"
            className={`explore-filter-tab ${primaryTab === "media" ? "active" : ""}`}
            role="tab"
            aria-selected={primaryTab === "media"}
            aria-haspopup="menu"
            aria-expanded={openDropdown === "media"}
            onClick={() => handlePrimaryTabClick("media")}
          >
            {primaryTab === "media" ? activeMediaLabel : "Media"}
            <FilterChevron open={openDropdown === "media"} />
          </button>
          {openDropdown === "media" && (
            <div className="explore-filter-dropdown" role="menu">
              {MEDIA_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="menuitem"
                  className={`explore-filter-dropdown-item ${mediaFilter === option.id ? "active" : ""}`}
                  onClick={() => {
                    setMediaFilter(option.id)
                    setPrimaryTab("media")
                    setOpenDropdown(null)
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="explore-filter-tab-slot">
          <button
            type="button"
            className={`explore-filter-tab ${primaryTab === "events" ? "active" : ""}`}
            role="tab"
            aria-selected={primaryTab === "events"}
            aria-haspopup="menu"
            aria-expanded={openDropdown === "events"}
            onClick={() => handlePrimaryTabClick("events")}
          >
            {primaryTab === "events" ? activeEventLabel : "Events"}
            <FilterChevron open={openDropdown === "events"} />
          </button>
          {openDropdown === "events" && (
            <div className="explore-filter-dropdown" role="menu">
              {EVENT_SCOPE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="menuitem"
                  className={`explore-filter-dropdown-item ${eventScope === option.id ? "active" : ""}`}
                  onClick={() => {
                    setEventScope(option.id)
                    setPrimaryTab("events")
                    setOpenDropdown(null)
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <section className="explore-grid" aria-label="Explore grid">
        {gridItems.length === 0 ? (
          <div className="explore-grid-empty">
            <p>Nothing here yet.</p>
            <small>Check back soon — events, posts, and videos will land here.</small>
          </div>
        ) : (
          gridItems.map((item, index) => {
            const gridIndex = index
            if (item.kind === "event") {
              return (
                <EventTile
                  key={`event-${item.id}-${index}`}
                  event={item.raw}
                  onOpen={setSelectedEvent}
                  gridIndex={gridIndex}
                />
              )
            }
            if (item.kind === "video") {
              return (
                <VideoTile
                  key={`video-${item.id}-${index}`}
                  item={{
                    ...item,
                    gridIndex,
                    viewCount:
                      viewCountsByPostId.get(item.id) ||
                      getPlaceholderViewCount(item.id),
                  }}
                  onOpen={handleOpenItem}
                />
              )
            }
            return (
              <PictureTile
                key={`pic-${item.id}-${index}`}
                item={{ ...item, gridIndex }}
                onOpen={handleOpenItem}
              />
            )
          })
        )}
      </section>

      <button
        type="button"
        className="explore-globe-button"
        onClick={() => setIsMapOpen(true)}
        aria-label="Open map"
      >
        <GlobeIcon />
      </button>

      <MapModal open={isMapOpen} onClose={() => setIsMapOpen(false)} />

      {selectedEvent && (
        <ExploreEventModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </main>
  )
}

// -----------------------------------------------------------------------------
// Legacy helpers preserved from the previous Explore page implementation so any
// utility that happened to be imported elsewhere still resolves.
// -----------------------------------------------------------------------------
/* eslint-disable no-unused-vars */
function includesAny(value, keywords) {
  return keywords.some((keyword) => value.includes(keyword))
}
function getEventDiscoveryFields(event) {
  return [
    event?.title,
    event?.location,
    event?.locationName,
    event?.description,
    (event?.tags || []).join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}
function sortEventsByMomentum(events) {
  return events
    .slice()
    .sort((a, b) => timeRank(b.createdAt || b.date) - timeRank(a.createdAt || a.date))
}
export {
  includesAny as exploreIncludesAny,
  getEventDiscoveryFields as exploreGetEventDiscoveryFields,
  sortEventsByMomentum as exploreSortEventsByMomentum,
}

// Retained so any code that referenced the old pagination constant keeps
// compiling while we refactor call sites.
export const EXPLORE_PAGE_SIZE = 20
export const EXPLORE_SUPABASE_CLIENT = supabase
/* eslint-enable no-unused-vars */
