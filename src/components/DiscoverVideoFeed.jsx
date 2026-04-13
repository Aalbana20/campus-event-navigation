import React from "react"
import { applyEventImageFallback, getEventImageSrc } from "../eventImages"
import {
  DEFAULT_AVATAR_URL,
  getEventCreatorDisplay,
} from "../profileMedia"

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
}

function HeartIcon({ filled = false }) {
  return (
    <svg
      {...iconProps}
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

function CommentIcon() {
  return (
    <svg {...iconProps}>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      <circle cx="8.2" cy="12" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15.8" cy="12" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
}

function RepostIcon() {
  return (
    <svg {...iconProps}>
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg {...iconProps}>
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

function MusicIcon() {
  return (
    <svg {...iconProps} strokeWidth={2.2}>
      <path d="M9 17V5l10-2v12" />
      <circle cx="6" cy="17" r="3" fill="currentColor" stroke="none" />
      <circle cx="16" cy="15" r="3" fill="currentColor" stroke="none" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function DiscoverVideoFeed({
  events,
  savedIds,
  repostedIds,
  followingIdSet,
  onPressHeart,
  onPressComment,
  onPressRepost,
  onPressShare,
  onPressCreator,
  onPressFollow,
}) {
  if (!events || events.length === 0) {
    return (
      <div className="discover-video-feed-container">
        <div className="video-feed-empty">
          <p>No videos right now.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="discover-video-feed-container">
      {events.map((event) => {
        const eventId = String(event.id)
        const { creatorAvatar, creatorName } = getEventCreatorDisplay(event)
        const isSaved = savedIds ? savedIds.has(eventId) : false
        const isReposted = repostedIds ? repostedIds.has(eventId) : false
        const creatorId = String(event?.creatorId || event?.creator_id || "")
        const isFollowing = followingIdSet && creatorId
          ? followingIdSet.has(creatorId)
          : false

        return (
          <article key={eventId} className="video-feed-item">
            <img
              src={getEventImageSrc(event?.image)}
              alt={event?.title || "Event"}
              className="video-feed-media"
              draggable={false}
              onError={applyEventImageFallback}
            />
            <div className="video-feed-overlay" />

            <div className="video-feed-actions">
              <button
                type="button"
                className={`video-action-btn ${isSaved ? "active heart" : ""}`}
                onClick={() => onPressHeart?.(event)}
                aria-label={isSaved ? "Unsave event" : "Save event"}
              >
                <div className="video-action-icon">
                  <HeartIcon filled={isSaved} />
                </div>
                <span className="video-action-count">
                  {isSaved ? "1" : "0"}
                </span>
              </button>

              <button
                type="button"
                className="video-action-btn"
                onClick={() => onPressComment?.(event)}
                aria-label="Open comments"
              >
                <div className="video-action-icon">
                  <CommentIcon />
                </div>
                <span className="video-action-count">0</span>
              </button>

              <button
                type="button"
                className={`video-action-btn ${isReposted ? "active repost" : ""}`}
                onClick={() => onPressRepost?.(event)}
                aria-label="Repost event"
              >
                <div className="video-action-icon">
                  <RepostIcon />
                </div>
                <span className="video-action-count">
                  {isReposted ? "1" : "0"}
                </span>
              </button>

              <button
                type="button"
                className="video-action-btn"
                onClick={() => onPressShare?.(event)}
                aria-label="Share event"
              >
                <div className="video-action-icon">
                  <ShareIcon />
                </div>
                <span className="video-action-count">Share</span>
              </button>
            </div>

            <div className="video-feed-info">
              <div className="video-creator-row">
                <button
                  type="button"
                  className="video-creator-avatar-btn"
                  onClick={() => onPressCreator?.(event)}
                  aria-label={`Open ${creatorName} profile`}
                >
                  <img
                    src={creatorAvatar}
                    alt={creatorName}
                    className="video-creator-avatar"
                    onError={(e) => {
                      e.currentTarget.src = DEFAULT_AVATAR_URL
                    }}
                  />
                  {!isFollowing ? (
                    <span className="video-creator-badge" aria-hidden="true">
                      <PlusIcon />
                    </span>
                  ) : null}
                </button>
                <span className="video-creator-name">{creatorName}</span>
                {!isFollowing ? (
                  <button
                    type="button"
                    className="video-follow-btn"
                    onClick={() => onPressFollow?.(event)}
                  >
                    Follow
                  </button>
                ) : null}
              </div>

              {event?.title ? (
                <p className="video-description">
                  <strong>{event.title}</strong>
                  {event.description ? ` — ${event.description}` : ""}
                </p>
              ) : null}

              <div className="video-audio-row">
                <MusicIcon />
                <span className="video-audio-text">
                  Original Audio — {creatorName}
                </span>
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}

export default DiscoverVideoFeed
