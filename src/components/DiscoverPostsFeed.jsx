import React, { useEffect, useRef, useState } from "react"
import { DEFAULT_AVATAR_URL } from "../profileMedia"
import PostShareSheet from "./PostShareSheet"

function FeedVideo({ post }) {
  const videoRef = useRef(null)
  const [isActive, setIsActive] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)

  useEffect(() => {
    const element = videoRef.current
    if (!element || typeof IntersectionObserver === "undefined") return undefined

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const visible = entry.isIntersecting && entry.intersectionRatio >= 0.6
          setIsActive(visible)
          if (visible) setHasStarted(true)
        })
      },
      { threshold: [0, 0.6, 1] }
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const element = videoRef.current
    if (!element) return
    if (isActive) {
      const playPromise = element.play()
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
          // Autoplay rejection is expected when the tab is backgrounded.
        })
      }
    } else {
      element.pause()
    }
  }, [isActive])

  // Keep bandwidth minimal until the user first scrolls the video into view.
  const src = hasStarted ? post.mediaUrl : undefined

  return (
    <video
      ref={videoRef}
      className="video-feed-media"
      src={src}
      poster={post.thumbnailUrl || undefined}
      muted
      loop
      playsInline
      preload="none"
    />
  )
}

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
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
      <circle cx="9" cy="11.5" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="12" cy="11.5" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="15" cy="11.5" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  )
}

function SaveIcon({ filled = false }) {
  return (
    <svg {...iconProps} fill={filled ? "currentColor" : "none"} stroke={filled ? "currentColor" : "currentColor"}>
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
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

function DiscoverPostsFeed({
  posts,
  onPressCreator,
  onPressCreate,
  currentUserId = "",
  onDeletePost,
  onRepostPost,
  repostedPostIds = new Set(),
}) {
  const [sharePost, setSharePost] = useState(null)

  if (!posts || posts.length === 0) {
    return (
      <div className="discover-video-feed-container">
        <div className="video-feed-empty">
          <p>No posts in Discover yet.</p>
          {onPressCreate ? (
            <button
              type="button"
              className="discover-end-action primary"
              onClick={onPressCreate}
              style={{ marginTop: "12px" }}
            >
              Create the first post
            </button>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="discover-video-feed-container">
      {posts.map((post) => {
        const isVideo = post.mediaType === "video"

        return (
          <article key={post.id} className="video-feed-item">
            {isVideo ? (
              <FeedVideo post={post} />
            ) : (
              <img
                src={post.mediaUrl}
                alt={post.caption || `${post.authorName} post`}
                className="video-feed-media"
                draggable={false}
                loading="lazy"
              />
            )}
            <div className="video-feed-overlay" />

            <div className="video-feed-actions">
              <button type="button" className="video-action-btn" aria-label="Like post">
                <div className="video-action-icon">
                  <HeartIcon />
                </div>
                <span className="video-action-count">0</span>
              </button>
              <button type="button" className="video-action-btn" aria-label="Open comments">
                <div className="video-action-icon">
                  <CommentIcon />
                </div>
                <span className="video-action-count">0</span>
              </button>
              <button type="button" className="video-action-btn" aria-label="Save post">
                <div className="video-action-icon">
                  <SaveIcon />
                </div>
                <span className="video-action-count">0</span>
              </button>
              <button type="button" className="video-action-btn" aria-label="Share post" onClick={() => setSharePost(post)}>
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
                  onClick={() => onPressCreator?.(post)}
                  aria-label={`Open ${post.authorName} profile`}
                >
                  <img
                    src={post.authorAvatar || DEFAULT_AVATAR_URL}
                    alt={post.authorName}
                    className="video-creator-avatar"
                    onError={(e) => {
                      e.currentTarget.src = DEFAULT_AVATAR_URL
                    }}
                  />
                </button>
                <span className="video-creator-name">
                  {post.authorUsername ? `@${post.authorUsername}` : post.authorName}
                </span>
              </div>

              {post.caption ? (
                <p className="video-description">{post.caption}</p>
              ) : null}
            </div>
          </article>
        )
      })}

      <PostShareSheet
        post={sharePost}
        isOpen={Boolean(sharePost)}
        onClose={() => setSharePost(null)}
        isOwner={Boolean(sharePost && currentUserId && String(currentUserId) === String(sharePost.authorId))}
        onDelete={onDeletePost}
        onRepost={onRepostPost}
        isReposted={Boolean(sharePost && repostedPostIds?.has(String(sharePost.id)))}
      />
    </div>
  )
}

export default DiscoverPostsFeed
