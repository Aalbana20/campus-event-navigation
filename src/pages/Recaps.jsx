import React, { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Bookmark, Flame, Heart, Image as ImageIcon, MessageCircle, Users } from "lucide-react"
import { useEvents } from "../context/EventContext"
import { applyEventImageFallback, getEventImageSrc } from "../eventImages"
import {
  formatEventDateTime,
  getEventStartDate,
  isEventRecapEligible,
} from "../recaps"
import "./Recaps.css"

const RECAP_TABS = [
  { id: "trending", label: "Trending" },
  { id: "for-you", label: "For You" },
  { id: "entertainment", label: "Entertainment" },
  { id: "sports", label: "Sports" },
  { id: "news", label: "News" },
]

const CATEGORY_KEYWORDS = {
  entertainment: [
    "music",
    "party",
    "parties",
    "movie",
    "film",
    "concert",
    "social",
    "festival",
    "dance",
    "karaoke",
    "comedy",
    "art",
  ],
  sports: [
    "basketball",
    "football",
    "soccer",
    "volleyball",
    "baseball",
    "gym",
    "game",
    "games",
    "tournament",
    "fitness",
    "intramural",
    "sports",
  ],
  news: [
    "update",
    "updates",
    "news",
    "town hall",
    "forum",
    "meeting",
    "announcement",
    "community",
    "safety",
    "service",
    "volunteer",
  ],
}

const toSearchText = (event) =>
  [
    event?.title,
    event?.description,
    event?.host,
    event?.organizer,
    event?.location,
    event?.locationName,
    ...(Array.isArray(event?.tags) ? event.tags : []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

const getEventCategory = (event) => {
  const text = toSearchText(event)
  const matchedCategory = Object.entries(CATEGORY_KEYWORDS).find(([, keywords]) =>
    keywords.some((keyword) => text.includes(keyword))
  )

  return matchedCategory?.[0] || "trending"
}

const getContextLabel = ({ event, activeTab, savedEventIds, followingIds, currentUser }) => {
  if (activeTab === "for-you") {
    if (savedEventIds.has(String(event.id))) return "Your school"
    if (String(event.createdBy || event.created_by || "") === String(currentUser?.id || "")) return "Your event"
    if (followingIds.has(String(event.createdBy || event.created_by || ""))) return "Your groups"
    return "Your communities"
  }

  if (activeTab === "entertainment") return "Entertainment"
  if (activeTab === "sports") return "Sports community"
  if (activeTab === "news") return "Community update"
  return event?.locationName || event?.location || "Global recap"
}

const buildRecapItems = ({ events, savedEvents, followingList, currentUser, activeTab }) => {
  const now = new Date()
  const savedEventIds = new Set((savedEvents || []).map((event) => String(event.id)))
  const followingIds = new Set((followingList || []).map((profile) => String(profile.id)))

  return (events || [])
    .map((event) => {
      const start = getEventStartDate(event)
      return start && isEventRecapEligible(event, now)
        ? {
            event,
            start,
            category: getEventCategory(event),
            contextLabel: getContextLabel({
              event,
              activeTab,
              savedEventIds,
              followingIds,
              currentUser,
            }),
          }
        : null
    })
    .filter(Boolean)
    .filter((item) => {
      if (activeTab === "trending") return true
      if (activeTab === "for-you") {
        const creatorId = String(item.event.createdBy || item.event.created_by || "")
        return (
          savedEventIds.has(String(item.event.id)) ||
          followingIds.has(creatorId) ||
          creatorId === String(currentUser?.id || "")
        )
      }
      return item.category === activeTab
    })
    .sort((left, right) => {
      const rightScore = Number(right.event.goingCount || 0) + (right.event.imageUrls?.length || 0) * 4
      const leftScore = Number(left.event.goingCount || 0) + (left.event.imageUrls?.length || 0) * 4
      return rightScore - leftScore || right.start.getTime() - left.start.getTime()
    })
}

export default function Recaps() {
  const navigate = useNavigate()
  const { allEvents, savedEvents, followingList, currentUser } = useEvents()
  const [activeTab, setActiveTab] = useState("trending")
  const [likedIds, setLikedIds] = useState(new Set())
  const [savedIds, setSavedIds] = useState(new Set())

  const recapItems = useMemo(
    () =>
      buildRecapItems({
        events: allEvents,
        savedEvents,
        followingList,
        currentUser,
        activeTab,
      }),
    [activeTab, allEvents, currentUser, followingList, savedEvents]
  )

  const featuredItems = recapItems.slice(0, 3)
  const topicItems = useMemo(() => {
    const tagCounts = new Map()
    recapItems.forEach(({ event }) => {
      const tags = Array.isArray(event.tags) && event.tags.length > 0
        ? event.tags
        : [getEventCategory(event), event.locationName || event.location || "campus"]

      tags.filter(Boolean).forEach((tag) => {
        const label = String(tag).replace(/^#/, "").trim()
        if (!label) return
        tagCounts.set(label, (tagCounts.get(label) || 0) + 1)
      })
    })

    return [...tagCounts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 6)
      .map(([label, count]) => ({ label, count }))
  }, [recapItems])

  const toggleSet = (setter, id) => {
    setter((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <main className="recaps-page">
      <section className="recaps-shell">
        <header className="recaps-header">
          <button type="button" className="recaps-back-btn" onClick={() => navigate(-1)}>
            ‹
          </button>
          <div>
            <p className="recaps-kicker">Memories + community moments</p>
            <h1>Recaps</h1>
          </div>
        </header>

        <div className="recap-feed-tabs recaps-top-tabs" role="tablist" aria-label="Recap categories">
          {RECAP_TABS.map((tab) => (
            <button
              type="button"
              key={tab.id}
              className={activeTab === tab.id ? "active" : ""}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {featuredItems.length > 0 ? (
          <section className="recap-gallery-hero" aria-label="Featured recap moments">
            {featuredItems.map(({ event, start, contextLabel }, index) => (
              <button
                type="button"
                key={event.id}
                className={`recap-gallery-feature ${index === 0 ? "large" : ""}`}
                onClick={() => navigate(`/recaps/${event.id}`)}
              >
                <img src={getEventImageSrc(event.image)} alt="" onError={applyEventImageFallback} />
                <span>{contextLabel}</span>
                <strong>{event.title}</strong>
                <em>{formatEventDateTime(event, start)}</em>
              </button>
            ))}
          </section>
        ) : null}

        {topicItems.length > 0 ? (
          <section className="recap-topic-strip" aria-label="Trending recap topics">
            {topicItems.map((topic) => (
              <button type="button" key={topic.label} onClick={() => setActiveTab("trending")}>
                <Flame size={15} aria-hidden="true" />
                <span>#{topic.label}</span>
                <em>{topic.count}</em>
              </button>
            ))}
          </section>
        ) : null}

        <div className="recap-community-feed" aria-label="Recap posts and event memories">
          {recapItems.length > 0 ? (
            recapItems.map(({ event, start, contextLabel }) => {
              const galleryImages = [event.image, ...(event.imageUrls || [])].filter(Boolean).slice(0, 4)
              if (galleryImages.length === 0) galleryImages.push("")
              const likeCount = Number(event.goingCount || 0) + galleryImages.length * 3
              const commentCount = Math.max(1, galleryImages.length + Math.floor(Number(event.goingCount || 0) / 8))
              const groupedLabel = `${Math.max(1, galleryImages.length)} photo${galleryImages.length === 1 ? "" : "s"} from this moment`
              const isLiked = likedIds.has(String(event.id))
              const isSaved = savedIds.has(String(event.id))

              return (
                <article key={event.id} className="recap-moment-card">
                  <div className="recap-moment-header">
                    <button
                      type="button"
                      className="recap-context-avatar"
                      onClick={() => navigate(`/recaps/${event.id}`)}
                      aria-label={`Open ${event.title} recap`}
                    >
                      <img src={getEventImageSrc(event.image)} alt="" onError={applyEventImageFallback} />
                    </button>
                    <div>
                      <strong>{event.title}</strong>
                      <span>{contextLabel} • {event.host || event.organizer || event.creatorName || "Campus Host"}</span>
                    </div>
                    <button
                      type="button"
                      className="recap-open-btn"
                      onClick={() => navigate(`/recaps/${event.id}`)}
                    >
                      Open
                    </button>
                  </div>

                  <button
                    type="button"
                    className={`recap-photo-grid recap-photo-count-${galleryImages.length}`}
                    onClick={() => navigate(`/recaps/${event.id}`)}
                    aria-label={`Open photos from ${event.title}`}
                  >
                    {galleryImages.map((image, index) => (
                      <img
                        key={`${event.id}-${image}-${index}`}
                        src={getEventImageSrc(image)}
                        alt=""
                        onError={applyEventImageFallback}
                      />
                    ))}
                  </button>

                  <div className="recap-moment-copy">
                    <p>
                      <strong>{event.host || event.organizer || event.creatorName || "Campus"}: </strong>
                      {event.description || `${event.title} recap is filling up with photos and posts from the community.`}
                    </p>
                    <div className="recap-moment-meta">
                      <span><ImageIcon size={15} aria-hidden="true" /> {groupedLabel}</span>
                      <span><Users size={15} aria-hidden="true" /> {event.locationName || event.location || "Community"}</span>
                      <span>{formatEventDateTime(event, start)}</span>
                    </div>
                  </div>

                  <div className="recap-action-row recap-moment-actions">
                    <button
                      type="button"
                      className={isLiked ? "active" : ""}
                      onClick={() => toggleSet(setLikedIds, String(event.id))}
                      aria-label="Like recap"
                    >
                      <Heart size={18} fill={isLiked ? "currentColor" : "none"} aria-hidden="true" />
                      <span>{likeCount + (isLiked ? 1 : 0)}</span>
                    </button>
                    <button type="button" onClick={() => navigate(`/recaps/${event.id}`)} aria-label="Open comments">
                      <MessageCircle size={18} aria-hidden="true" />
                      <span>{commentCount}</span>
                    </button>
                    <button
                      type="button"
                      className={isSaved ? "active" : ""}
                      onClick={() => toggleSet(setSavedIds, String(event.id))}
                      aria-label="Save recap"
                    >
                      <Bookmark size={18} fill={isSaved ? "currentColor" : "none"} aria-hidden="true" />
                    </button>
                  </div>
                </article>
              )
            })
          ) : (
            <div className="recaps-empty-detail">
              <h2>No recap moments yet</h2>
              <p>Post-event photos and community memories will appear here.</p>
            </div>
          )}
        </div>

        {recapItems.length > 0 ? (
          <section className="recap-event-rail" aria-label="Event recap cards">
            <div className="recap-section-heading">
              <h2>Event recap cards</h2>
              <span>Grouped by event and community</span>
            </div>
            <div className="recaps-event-grid">
              {recapItems.slice(0, 8).map(({ event, start, contextLabel }) => (
                <button
                  type="button"
                  key={`card-${event.id}`}
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
                    <em>{contextLabel}</em>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  )
}
