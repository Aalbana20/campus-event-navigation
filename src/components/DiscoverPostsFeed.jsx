import React, { useState } from "react"
import { DEFAULT_AVATAR_URL } from "../profileMedia"

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

function MoreIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="5" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  )
}

function PostOverflowMenu({ post, onDeletePost }) {
  const [open, setOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleConfirmDelete = async () => {
    if (isDeleting) return
    const confirmed = window.confirm("Delete this post?\nThis cannot be undone.")
    if (!confirmed) {
      setOpen(false)
      return
    }

    setIsDeleting(true)
    try {
      await onDeletePost(post)
    } finally {
      setIsDeleting(false)
      setOpen(false)
    }
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        className="video-action-btn"
        aria-label="Post options"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <div className="video-action-icon">
          <MoreIcon />
        </div>
        <span className="video-action-count">More</span>
      </button>

      {open ? (
        <div
          role="menu"
          style={{
            position: "absolute",
            right: "100%",
            marginRight: "10px",
            top: 0,
            minWidth: "160px",
            padding: "6px",
            borderRadius: "12px",
            background: "rgba(15, 18, 28, 0.96)",
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow: "0 12px 28px rgba(0,0,0,0.32)",
            zIndex: 20,
          }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={handleConfirmDelete}
            disabled={isDeleting}
            style={{
              width: "100%",
              padding: "10px 12px",
              border: "none",
              background: "transparent",
              color: "#ff6b6b",
              fontSize: "0.92rem",
              fontWeight: 700,
              textAlign: "left",
              cursor: isDeleting ? "default" : "pointer",
              borderRadius: "8px",
            }}
          >
            {isDeleting ? "Deleting..." : "Delete Post"}
          </button>
        </div>
      ) : null}
    </div>
  )
}

function DiscoverPostsFeed({
  posts,
  onPressCreator,
  onPressCreate,
  currentUserId = "",
  onDeletePost,
}) {
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
        const isOwner =
          Boolean(currentUserId) &&
          String(currentUserId) === String(post.authorId)

        return (
          <article key={post.id} className="video-feed-item">
            {isVideo ? (
              <video
                className="video-feed-media"
                src={post.mediaUrl}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
              />
            ) : (
              <img
                src={post.mediaUrl}
                alt={post.caption || `${post.authorName} post`}
                className="video-feed-media"
                draggable={false}
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
              <button type="button" className="video-action-btn" aria-label="Share post">
                <div className="video-action-icon">
                  <ShareIcon />
                </div>
                <span className="video-action-count">Share</span>
              </button>
              {isOwner && onDeletePost ? (
                <PostOverflowMenu post={post} onDeletePost={onDeletePost} />
              ) : null}
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
    </div>
  )
}

export default DiscoverPostsFeed
