import React, { useEffect, useRef, useState } from "react"
import {
  addPostComment,
  deletePostComment,
  loadPostComments,
  recordPostShare,
  setPostCommentLike,
  setPostLike,
} from "../postEngagement"
import { invalidateDiscoverFeedCache } from "../discoverPosts"
import { DEFAULT_AVATAR_URL } from "../profileMedia"
import { repostPost, unrepostPost } from "../profileReposts"
import { useEvents } from "../context/EventContext"
import { useToast } from "../context/ToastContext"
import DiscoverCommentsDrawer from "./DiscoverCommentsDrawer"
import PostShareSheet from "./PostShareSheet"

function FeedVideo({ post }) {
  const videoRef = useRef(null)
  const [isActive, setIsActive] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const [isManuallyPaused, setIsManuallyPaused] = useState(false)

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
    if (isActive && !isManuallyPaused) {
      const playPromise = element.play()
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
          // Autoplay rejection is expected when the tab is backgrounded.
        })
      }
    } else {
      element.pause()
    }
  }, [isActive, isManuallyPaused])

  const handleTogglePlayback = () => {
    if (!isActive) return
    setHasStarted(true)
    setIsManuallyPaused((paused) => !paused)
  }

  // Keep bandwidth minimal until the user first scrolls the video into view.
  const src = hasStarted ? post.mediaUrl : undefined

  return (
    <>
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
      <button
        type="button"
        className={`video-playback-hitarea ${isManuallyPaused ? "paused" : ""}`}
        onClick={handleTogglePlayback}
        aria-label={isManuallyPaused ? "Play video" : "Pause video"}
        disabled={!isActive}
      >
        <span className="video-playback-center" aria-hidden="true">
          {isManuallyPaused ? <PlayIcon /> : <PauseIcon />}
        </span>
      </button>
    </>
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

function PlayIcon() {
  return (
    <svg className="video-playback-play-icon" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M11 8.6v14.8c0 1.2 1.3 2 2.4 1.4l12.2-7.4c1-.6 1-2.1 0-2.8L13.4 7.2C12.3 6.6 11 7.4 11 8.6z" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <rect x="10" y="8" width="4.2" height="16" rx="1.4" />
      <rect x="17.8" y="8" width="4.2" height="16" rx="1.4" />
    </svg>
  )
}

const formatActionCount = (value, fallback = "0") => {
  const count = Number(value) || 0
  if (count <= 0) return fallback
  if (count < 1000) return String(count)
  if (count < 1_000_000) return `${(count / 1000).toFixed(count < 10_000 ? 1 : 0)}K`
  return `${(count / 1_000_000).toFixed(count < 10_000_000 ? 1 : 0)}M`
}

const getPostThreadTitle = (post) =>
  post?.caption?.trim()
    ? post.caption.trim()
    : post?.authorUsername
      ? `@${post.authorUsername}'s post`
      : `${post?.authorName || "Campus"} post`

function DiscoverPostsFeed({
  posts,
  onPressCreator,
  onPressCreate,
  currentUserId = "",
  onDeletePost,
  onRepostPost,
  repostedPostIds = new Set(),
}) {
  const { showToast } = useToast()
  const { currentUser } = useEvents()
  const [localPosts, setLocalPosts] = useState(posts || [])
  const [sharePost, setSharePost] = useState(null)
  const [activeCommentPostId, setActiveCommentPostId] = useState(null)
  const [commentsByPostId, setCommentsByPostId] = useState({})
  const [commentDraft, setCommentDraft] = useState("")
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)

  useEffect(() => {
    setLocalPosts(posts || [])
  }, [posts])

  const updateLocalPost = (postId, updater) => {
    setLocalPosts((prev) =>
      prev.map((post) =>
        String(post.id) === String(postId)
          ? { ...post, ...updater(post) }
          : post
      )
    )
    setSharePost((prev) =>
      prev && String(prev.id) === String(postId)
        ? { ...prev, ...updater(prev) }
        : prev
    )
  }

  const requireCurrentUser = (message) => {
    if (currentUserId && currentUserId !== "current-user") return true
    showToast(message, "error")
    return false
  }

  const handleToggleLike = async (post) => {
    if (!requireCurrentUser("Sign in to like posts.")) return
    const postId = String(post.id)
    const wasLiked = Boolean(post.isLikedByCurrentUser)
    const nextLiked = !wasLiked

    updateLocalPost(postId, () => ({
      isLikedByCurrentUser: nextLiked,
      likeCount: Math.max(0, (Number(post.likeCount) || 0) + (nextLiked ? 1 : -1)),
    }))

    try {
      await setPostLike({ postId, userId: currentUserId, liked: nextLiked })
      invalidateDiscoverFeedCache()
    } catch (error) {
      updateLocalPost(postId, () => ({
        isLikedByCurrentUser: wasLiked,
        likeCount: Number(post.likeCount) || 0,
      }))
      showToast(error?.message || "Could not update like.", "error")
    }
  }

  const handleToggleRepost = async (post) => {
    if (!requireCurrentUser("Sign in to repost posts.")) return
    const postId = String(post.id)
    const wasReposted =
      Boolean(post.isRepostedByCurrentUser) || repostedPostIds?.has(postId)
    const nextReposted = !wasReposted

    updateLocalPost(postId, () => ({
      isRepostedByCurrentUser: nextReposted,
      repostCount: Math.max(0, (Number(post.repostCount) || 0) + (nextReposted ? 1 : -1)),
    }))

    try {
      if (onRepostPost) {
        await onRepostPost({ ...post, isRepostedByCurrentUser: wasReposted })
      } else if (nextReposted) {
        await repostPost({ userId: currentUserId, postId })
      } else {
        await unrepostPost({ userId: currentUserId, postId })
      }
      invalidateDiscoverFeedCache()
      showToast(nextReposted ? "Post reposted." : "Repost removed.", "success")
    } catch (error) {
      updateLocalPost(postId, () => ({
        isRepostedByCurrentUser: wasReposted,
        repostCount: Number(post.repostCount) || 0,
      }))
      showToast(error?.message || "Could not update repost.", "error")
    }
  }

  const handleOpenComments = async (post) => {
    setActiveCommentPostId(String(post.id))
    setCommentDraft("")
    try {
      const comments = await loadPostComments({
        postId: post.id,
        currentUserId,
      })
      setCommentsByPostId((prev) => ({ ...prev, [String(post.id)]: comments }))
      updateLocalPost(post.id, () => ({ commentCount: comments.length }))
    } catch (error) {
      showToast(error?.message || "Could not load comments.", "error")
    }
  }

  const handleCloseComments = () => {
    setActiveCommentPostId(null)
    setCommentDraft("")
  }

  const activeCommentPost =
    localPosts.find((post) => String(post.id) === String(activeCommentPostId)) ||
    null
  const activePostComments = activeCommentPostId
    ? commentsByPostId[String(activeCommentPostId)] || []
    : []

  const handleSubmitComment = async (parentId = null) => {
    if (!activeCommentPost || !commentDraft.trim() || isSubmittingComment) return
    if (!requireCurrentUser("Sign in to comment.")) return

    const postId = String(activeCommentPost.id)
    const body = commentDraft.trim()
    const optimisticId = `optimistic-${Date.now()}`
    const optimisticComment = {
      id: optimisticId,
      authorName: currentUser?.name || currentUser?.username || "Campus User",
      authorUsername: currentUser?.username || "",
      authorAvatar: currentUser?.image || currentUser?.avatar || "",
      authorId: currentUserId,
      body,
      createdAt: new Date().toISOString(),
      likeCount: 0,
      likedByMe: false,
      parentId: parentId || null,
    }

    setIsSubmittingComment(true)
    setCommentDraft("")
    setCommentsByPostId((prev) => ({
      ...prev,
      [postId]: [...(prev[postId] || []), optimisticComment],
    }))
    updateLocalPost(postId, (post) => ({
      commentCount: (Number(post.commentCount) || 0) + 1,
    }))

    try {
      const savedComment = await addPostComment({
        postId,
        userId: currentUserId,
        body,
        parentId,
      })
      invalidateDiscoverFeedCache()
      setCommentsByPostId((prev) => ({
        ...prev,
        [postId]: (prev[postId] || []).map((comment) =>
          comment.id === optimisticId
            ? { ...comment, id: savedComment.id, authorId: savedComment.userId }
            : comment
        ),
      }))
    } catch (error) {
      setCommentsByPostId((prev) => ({
        ...prev,
        [postId]: (prev[postId] || []).filter((comment) => comment.id !== optimisticId),
      }))
      updateLocalPost(postId, (post) => ({
        commentCount: Math.max(0, (Number(post.commentCount) || 0) - 1),
      }))
      showToast(error?.message || "Could not post comment.", "error")
    } finally {
      setIsSubmittingComment(false)
    }
  }

  const handleToggleCommentLike = async (commentId) => {
    if (!activeCommentPost) return
    if (!requireCurrentUser("Sign in to like comments.")) return
    const postId = String(activeCommentPost.id)
    let nextLiked = false

    setCommentsByPostId((prev) => ({
      ...prev,
      [postId]: (prev[postId] || []).map((comment) => {
        if (comment.id !== commentId) return comment
        nextLiked = !comment.likedByMe
        return {
          ...comment,
          likedByMe: nextLiked,
          likeCount: Math.max(0, (comment.likeCount || 0) + (nextLiked ? 1 : -1)),
        }
      }),
    }))

    if (String(commentId).startsWith("optimistic-")) return

    try {
      await setPostCommentLike({
        commentId,
        userId: currentUserId,
        liked: nextLiked,
      })
    } catch (error) {
      showToast(error?.message || "Could not update comment like.", "error")
      const comments = await loadPostComments({ postId, currentUserId })
      setCommentsByPostId((prev) => ({ ...prev, [postId]: comments }))
    }
  }

  const handleDeleteComment = async (commentId) => {
    if (!activeCommentPost) return
    if (!requireCurrentUser("Sign in to delete comments.")) return
    const postId = String(activeCommentPost.id)
    const currentComments = commentsByPostId[postId] || []
    const removedCount = currentComments.filter(
      (comment) => comment.id === commentId || comment.parentId === commentId
    ).length

    setCommentsByPostId((prev) => ({
      ...prev,
      [postId]: (prev[postId] || []).filter(
        (comment) => comment.id !== commentId && comment.parentId !== commentId
      ),
    }))
    updateLocalPost(postId, (post) => ({
      commentCount: Math.max(0, (Number(post.commentCount) || 0) - removedCount),
    }))

    if (String(commentId).startsWith("optimistic-")) return

    try {
      await deletePostComment({ commentId, userId: currentUserId })
      invalidateDiscoverFeedCache()
    } catch (error) {
      showToast(error?.message || "Could not delete comment.", "error")
      const comments = await loadPostComments({ postId, currentUserId })
      setCommentsByPostId((prev) => ({ ...prev, [postId]: comments }))
      updateLocalPost(postId, () => ({ commentCount: comments.length }))
    }
  }

  const handleRecordShare = async (post, method) => {
    const shareCount = await recordPostShare({
      postId: post?.id,
      userId: currentUserId,
      method,
    })
    if (shareCount != null) {
      updateLocalPost(post.id, () => ({ shareCount }))
      invalidateDiscoverFeedCache()
    }
  }

  if (!localPosts || localPosts.length === 0) {
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
      {localPosts.map((post) => {
        const isVideo = post.mediaType === "video"
        const isLiked = Boolean(post.isLikedByCurrentUser)
        const isReposted =
          Boolean(post.isRepostedByCurrentUser) ||
          repostedPostIds?.has(String(post.id))

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
              <button
                type="button"
                className={`video-action-btn ${isLiked ? "active heart" : ""}`}
                onClick={() => handleToggleLike(post)}
                aria-label={isLiked ? "Unlike post" : "Like post"}
                aria-pressed={isLiked}
              >
                <div className="video-action-icon">
                  <HeartIcon filled={isLiked} />
                </div>
                <span className="video-action-count">
                  {formatActionCount(post.likeCount)}
                </span>
              </button>
              <button
                type="button"
                className="video-action-btn"
                onClick={() => handleOpenComments(post)}
                aria-label="Open comments"
              >
                <div className="video-action-icon">
                  <CommentIcon />
                </div>
                <span className="video-action-count">
                  {formatActionCount(post.commentCount)}
                </span>
              </button>
              <button
                type="button"
                className={`video-action-btn ${isReposted ? "active repost" : ""}`}
                onClick={() => handleToggleRepost(post)}
                aria-label={isReposted ? "Remove repost" : "Repost post"}
                aria-pressed={isReposted}
              >
                <div className="video-action-icon">
                  <RepostIcon />
                </div>
                <span className="video-action-count">
                  {formatActionCount(post.repostCount)}
                </span>
              </button>
              <button type="button" className="video-action-btn" aria-label="Share post" onClick={() => setSharePost(post)}>
                <div className="video-action-icon">
                  <ShareIcon />
                </div>
                <span className="video-action-count">
                  {formatActionCount(post.shareCount, "Share")}
                </span>
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
        onRepost={handleToggleRepost}
        onShareComplete={handleRecordShare}
        isReposted={Boolean(
          sharePost &&
            (sharePost.isRepostedByCurrentUser || repostedPostIds?.has(String(sharePost.id)))
        )}
      />

      <DiscoverCommentsDrawer
        open={Boolean(activeCommentPost)}
        event={activeCommentPost}
        comments={activePostComments}
        draft={commentDraft}
        currentUserId={currentUserId}
        threadTitle={activeCommentPost ? getPostThreadTitle(activeCommentPost) : ""}
        threadMeta={
          activeCommentPost?.authorUsername
            ? `@${activeCommentPost.authorUsername}`
            : activeCommentPost?.authorName || "Discover post"
        }
        emptyCopy="Start the conversation for this post."
        ariaLabel="Post comments"
        onDraftChange={setCommentDraft}
        onSubmit={handleSubmitComment}
        onClose={handleCloseComments}
        onToggleLike={handleToggleCommentLike}
        onDeleteComment={handleDeleteComment}
      />
    </div>
  )
}

export default DiscoverPostsFeed
