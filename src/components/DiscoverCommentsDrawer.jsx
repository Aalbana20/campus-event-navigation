import React from "react"

import { DEFAULT_AVATAR_URL, sanitizeAvatarUrl } from "../profileMedia"

const formatCommentTime = (value) => {
  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) return "Now"

  return parsedDate.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })
}

function DiscoverCommentsDrawer({
  open,
  event,
  comments,
  draft,
  onDraftChange,
  onSubmit,
  onClose,
  onToggleLike,
}) {
  if (!open || !event) return null

  return (
    <div className="discover-comments-drawer-wrap" aria-hidden={!open}>
      <button
        type="button"
        className="discover-comments-drawer-backdrop"
        onClick={onClose}
        aria-label="Close comments"
      />

      <aside className="discover-comments-drawer" aria-label="Event comments">
        <div className="discover-comments-header">
          <div className="discover-comments-header-copy">
            <span className="discover-comments-kicker">Comments</span>
            <h3>{event.title || "Campus Event"}</h3>
            <p>{[event.date, event.time].filter(Boolean).join(" • ") || "Event thread"}</p>
          </div>

          <button
            type="button"
            className="discover-comments-close"
            onClick={onClose}
            aria-label="Close comments"
          >
            ×
          </button>
        </div>

        <div className="discover-comments-list">
          {comments.length > 0 ? (
            comments.map((comment) => {
              const avatarSrc = sanitizeAvatarUrl(
                comment.authorAvatar,
                DEFAULT_AVATAR_URL
              )
              const isLiked = Boolean(comment.likedByMe)
              const likeCount = Number(comment.likeCount) || 0

              return (
                <article className="discover-comment-card" key={comment.id}>
                  <img
                    className="discover-comment-avatar"
                    src={avatarSrc}
                    alt=""
                    onError={(imgEvent) => {
                      imgEvent.currentTarget.src = DEFAULT_AVATAR_URL
                    }}
                  />

                  <div className="discover-comment-bubble">
                    <header className="discover-comment-head">
                      <strong>
                        {comment.authorUsername
                          ? `@${comment.authorUsername}`
                          : comment.authorName || "Campus User"}
                      </strong>
                      <span>{formatCommentTime(comment.createdAt)}</span>
                    </header>
                    <p>{comment.body}</p>
                  </div>

                  <button
                    type="button"
                    className={
                      isLiked
                        ? "discover-comment-like liked"
                        : "discover-comment-like"
                    }
                    onClick={() => onToggleLike?.(comment.id)}
                    aria-label={isLiked ? "Unlike comment" : "Like comment"}
                    aria-pressed={isLiked}
                  >
                    <span className="discover-comment-like-icon" aria-hidden="true">
                      {isLiked ? "♥" : "♡"}
                    </span>
                    {likeCount > 0 ? (
                      <span className="discover-comment-like-count">
                        {likeCount}
                      </span>
                    ) : null}
                  </button>
                </article>
              )
            })
          ) : (
            <div className="discover-comments-empty">
              <h4>No comments yet.</h4>
              <p>Start the conversation for this event.</p>
            </div>
          )}
        </div>

        <div className="discover-comments-compose">
          <textarea
            value={draft}
            onChange={(eventChange) => onDraftChange(eventChange.target.value)}
            placeholder="Add a comment..."
            maxLength={280}
          />
          <button
            type="button"
            className="discover-comments-send"
            onClick={onSubmit}
            disabled={!draft.trim()}
          >
            Send
          </button>
        </div>
      </aside>
    </div>
  )
}

export default DiscoverCommentsDrawer
