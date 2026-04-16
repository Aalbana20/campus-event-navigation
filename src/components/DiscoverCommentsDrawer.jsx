import React, { useMemo, useRef, useState } from "react"

import { DEFAULT_AVATAR_URL, sanitizeAvatarUrl } from "../profileMedia"
import { useToast } from "../context/ToastContext"

const formatCommentTime = (value) => {
  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) return "now"

  const nowMs = Date.now()
  const diffSeconds = Math.max(0, Math.floor((nowMs - parsedDate.getTime()) / 1000))

  if (diffSeconds < 60) return "now"
  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) return `${diffMinutes}m`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d`
  const diffWeeks = Math.floor(diffDays / 7)
  return `${diffWeeks}w`
}

const displayName = (comment) =>
  comment.authorUsername
    ? `@${comment.authorUsername}`
    : comment.authorName || "Campus User"

function DiscoverCommentsDrawer({
  open,
  event,
  comments,
  draft,
  currentUserId,
  onDraftChange,
  onSubmit,
  onClose,
  onToggleLike,
  onDeleteComment,
}) {
  const { showToast } = useToast()
  const [replyingTo, setReplyingTo] = useState(null)
  const [expandedThreads, setExpandedThreads] = useState(() => new Set())
  const [contextMenu, setContextMenu] = useState(null)
  const longPressTimerRef = useRef(null)

  const handleClose = () => {
    setReplyingTo(null)
    setContextMenu(null)
    onClose?.()
  }

  const { topLevel, repliesByParent } = useMemo(() => {
    const topLevelList = []
    const replies = new Map()
    ;(comments || []).forEach((comment) => {
      if (comment.parentId) {
        const list = replies.get(comment.parentId) || []
        list.push(comment)
        replies.set(comment.parentId, list)
      } else {
        topLevelList.push(comment)
      }
    })
    return { topLevel: topLevelList, repliesByParent: replies }
  }, [comments])

  const toggleThread = (commentId) => {
    setExpandedThreads((prev) => {
      const next = new Set(prev)
      if (next.has(commentId)) {
        next.delete(commentId)
      } else {
        next.add(commentId)
      }
      return next
    })
  }

  const handleStartReply = (comment) => {
    const parent = comment.parentId
      ? (comments || []).find((c) => c.id === comment.parentId) || comment
      : comment
    setReplyingTo({
      parentId: parent.id,
      targetUsername: comment.authorUsername || comment.authorName || "",
    })
  }

  const handleCancelReply = () => setReplyingTo(null)

  const handleSubmit = () => {
    const parentId = replyingTo?.parentId || null
    if (parentId) {
      setExpandedThreads((prev) => {
        if (prev.has(parentId)) return prev
        const next = new Set(prev)
        next.add(parentId)
        return next
      })
    }
    onSubmit(parentId)
    setReplyingTo(null)
  }

  const openContextMenu = (comment) => {
    setContextMenu({ comment })
  }

  const closeContextMenu = () => setContextMenu(null)

  const handleLongPressStart = (comment) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
    }
    longPressTimerRef.current = setTimeout(() => {
      openContextMenu(comment)
      longPressTimerRef.current = null
    }, 450)
  }

  const handleLongPressCancel = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  const handleContextMenu = (pointerEvent, comment) => {
    pointerEvent.preventDefault()
    openContextMenu(comment)
  }

  const handleCopy = async (comment) => {
    try {
      await navigator.clipboard.writeText(comment.body)
      showToast("Comment copied.", "success")
    } catch {
      showToast("Could not copy comment.", "error")
    }
    closeContextMenu()
  }

  const handleShare = async (comment) => {
    const shareText = `${displayName(comment)}: ${comment.body}`
    if (navigator.share) {
      try {
        await navigator.share({ text: shareText })
      } catch {
        /* user dismissed */
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareText)
        showToast("Comment copied to clipboard.", "success")
      } catch {
        showToast("Could not share comment.", "error")
      }
    }
    closeContextMenu()
  }

  const handleDelete = (comment) => {
    onDeleteComment?.(comment.id)
    showToast("Comment deleted.", "info")
    closeContextMenu()
  }

  const handleReport = (comment) => {
    showToast(`Thanks for reporting @${comment.authorUsername || comment.authorName}'s comment.`, "info")
    closeContextMenu()
  }

  const handleSave = (comment) => {
    showToast(`Saved "${comment.body.slice(0, 40)}".`, "success")
    closeContextMenu()
  }

  if (!open || !event) return null

  const renderComment = (comment, isReply = false) => {
    const avatarSrc = sanitizeAvatarUrl(comment.authorAvatar, DEFAULT_AVATAR_URL)
    const isLiked = Boolean(comment.likedByMe)
    const likeCount = Number(comment.likeCount) || 0

    const touchHandlers = {
      onPointerDown: () => handleLongPressStart(comment),
      onPointerUp: handleLongPressCancel,
      onPointerLeave: handleLongPressCancel,
      onPointerCancel: handleLongPressCancel,
      onContextMenu: (pointerEvent) => handleContextMenu(pointerEvent, comment),
    }

    return (
      <article
        className={`discover-comment-card${isReply ? " discover-comment-reply" : ""}`}
        key={comment.id}
        {...touchHandlers}
      >
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
            <strong>{displayName(comment)}</strong>
          </header>
          <p>{comment.body}</p>
          <div className="discover-comment-meta">
            <span className="discover-comment-time">
              {formatCommentTime(comment.createdAt)}
            </span>
            <button
              type="button"
              className="discover-comment-reply-btn"
              onClick={() => handleStartReply(comment)}
            >
              Reply
            </button>
            <button
              type="button"
              className="discover-comment-more-btn"
              onClick={() => openContextMenu(comment)}
              aria-label="More comment actions"
            >
              •••
            </button>
          </div>
        </div>

        <button
          type="button"
          className={
            isLiked ? "discover-comment-like liked" : "discover-comment-like"
          }
          onClick={() => onToggleLike?.(comment.id)}
          aria-label={isLiked ? "Unlike comment" : "Like comment"}
          aria-pressed={isLiked}
        >
          <span className="discover-comment-like-icon" aria-hidden="true">
            {isLiked ? "♥" : "♡"}
          </span>
          {likeCount > 0 ? (
            <span className="discover-comment-like-count">{likeCount}</span>
          ) : null}
        </button>
      </article>
    )
  }

  return (
    <div className="discover-comments-drawer-wrap" aria-hidden={!open}>
      <button
        type="button"
        className="discover-comments-drawer-backdrop"
        onClick={handleClose}
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
            onClick={handleClose}
            aria-label="Close comments"
          >
            ×
          </button>
        </div>

        <div className="discover-comments-list">
          {topLevel.length > 0 ? (
            topLevel.map((comment) => {
              const replies = repliesByParent.get(comment.id) || []
              const hasReplies = replies.length > 0
              const isExpanded = expandedThreads.has(comment.id)

              return (
                <div className="discover-comment-thread" key={comment.id}>
                  {renderComment(comment)}
                  {hasReplies && !isExpanded && (
                    <button
                      type="button"
                      className="discover-comment-thread-toggle"
                      onClick={() => toggleThread(comment.id)}
                    >
                      — View {replies.length} {replies.length === 1 ? "reply" : "replies"}
                    </button>
                  )}
                  {isExpanded && (
                    <div className="discover-comment-thread-replies">
                      {replies.map((reply) => renderComment(reply, true))}
                      <button
                        type="button"
                        className="discover-comment-thread-toggle"
                        onClick={() => toggleThread(comment.id)}
                      >
                        — Hide replies
                      </button>
                    </div>
                  )}
                </div>
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
          {replyingTo ? (
            <div className="discover-comments-reply-banner">
              <span>
                Replying to <strong>@{replyingTo.targetUsername}</strong>
              </span>
              <button
                type="button"
                className="discover-comments-reply-cancel"
                onClick={handleCancelReply}
                aria-label="Cancel reply"
              >
                ×
              </button>
            </div>
          ) : null}
          <div className="discover-comments-compose-row">
            <textarea
              value={draft}
              onChange={(eventChange) => onDraftChange(eventChange.target.value)}
              placeholder={replyingTo ? "Add a reply..." : "Add a comment..."}
              maxLength={280}
            />
            <button
              type="button"
              className="discover-comments-send"
              onClick={handleSubmit}
              disabled={!draft.trim()}
            >
              Send
            </button>
          </div>
        </div>
      </aside>

      {contextMenu ? (
        <div
          className="discover-comments-context-overlay"
          role="dialog"
          aria-label="Comment actions"
          onClick={closeContextMenu}
        >
          <div
            className="discover-comments-context-menu"
            onClick={(pointerEvent) => pointerEvent.stopPropagation()}
          >
            {(() => {
              const comment = contextMenu.comment
              const isOwn =
                currentUserId && comment.authorId && String(comment.authorId) === String(currentUserId)

              const items = isOwn
                ? [
                    { key: "delete", label: "Delete", tone: "danger", onClick: () => handleDelete(comment) },
                    { key: "copy", label: "Copy", tone: "default", onClick: () => handleCopy(comment) },
                    { key: "save", label: "Save comment", tone: "default", onClick: () => handleSave(comment) },
                  ]
                : [
                    { key: "share", label: "Share", tone: "default", onClick: () => handleShare(comment) },
                    { key: "copy", label: "Copy", tone: "default", onClick: () => handleCopy(comment) },
                    { key: "report", label: "Report", tone: "danger", onClick: () => handleReport(comment) },
                  ]

              return items.map((item) => (
                <button
                  type="button"
                  key={item.key}
                  className={`discover-comments-context-item${item.tone === "danger" ? " danger" : ""}`}
                  onClick={item.onClick}
                >
                  {item.label}
                </button>
              ))
            })()}
            <button
              type="button"
              className="discover-comments-context-cancel"
              onClick={closeContextMenu}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default DiscoverCommentsDrawer
