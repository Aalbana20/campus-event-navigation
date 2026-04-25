import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  loadDiscoverPostsByIds,
  loadDiscoverPostsForAuthor,
  invalidateDiscoverFeedCache,
  resolveDiscoverPostMediaUrl,
} from "../discoverPosts"
import {
  loadRepostsForUser,
  repostPost,
  unrepostPost,
} from "../profileReposts"
import {
  addPostComment,
  deletePostComment,
  loadLikedPostIds,
  loadPostComments,
  loadSavedPostIds,
  recordPostShare,
  setPostCommentLike,
  setPostLike,
} from "../postEngagement"
import { loadPostsTaggingUser } from "../contentTags"
import { loadEventMemoriesForUser } from "../eventMemories"
import { useEvents } from "../context/EventContext"
import { useToast } from "../context/ToastContext"
import ExploreEventModal from "./ExploreEventModal"
import DiscoverCommentsDrawer from "./DiscoverCommentsDrawer"
import PostShareSheet from "./PostShareSheet"

const PROFILE_TABS = [
  { id: "grid", label: "Grid" },
  { id: "posts", label: "Posts / Videos" },
  { id: "collection", label: "Reposts / Likes / Saved" },
  { id: "tags", label: "Tags" },
]

const TAG_FILTERS = [
  { id: "all", label: "All" },
  { id: "posts", label: "Posts" },
  { id: "event-tags", label: "Event Tags" },
]

const COLLECTION_OPTIONS = [
  { id: "reposts", label: "Reposts", iconType: "reposts" },
  { id: "likes", label: "Likes", iconType: "likes" },
  { id: "saves", label: "Saved", iconType: "saves" },
]

const toTime = (value) => {
  const time = Date.parse(value || "")
  return Number.isFinite(time) ? time : 0
}

const ProfileTabIcon = ({ type }) => {
  if (type === "grid") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="4" width="6.25" height="6.25" rx="1.1" />
        <rect x="13.75" y="4" width="6.25" height="6.25" rx="1.1" />
        <rect x="4" y="13.75" width="6.25" height="6.25" rx="1.1" />
        <rect x="13.75" y="13.75" width="6.25" height="6.25" rx="1.1" />
      </svg>
    )
  }

  if (type === "posts") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6.6 7.25 8.2 4.9h7.6l1.6 2.35" />
        <rect x="4" y="7.25" width="16" height="11.75" rx="2.4" />
        <circle cx="12" cy="13.1" r="3.15" />
      </svg>
    )
  }

  if (type === "reposts") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M17.8 5.2 20.4 7.8l-2.6 2.6" />
        <path d="M4.1 11.1v-.65A2.65 2.65 0 0 1 6.75 7.8H20.4" />
        <path d="M6.2 18.8 3.6 16.2l2.6-2.6" />
        <path d="M19.9 12.9v.65a2.65 2.65 0 0 1-2.65 2.65H3.6" />
      </svg>
    )
  }

  if (type === "likes") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 20.3s-7.5-4.1-7.5-10A4.4 4.4 0 0 1 12 7.2 4.4 4.4 0 0 1 19.5 10.3c0 5.9-7.5 10-7.5 10Z" />
      </svg>
    )
  }

  if (type === "saves") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6.5 4.5h11v15.5l-5.5-3.5-5.5 3.5V4.5Z" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.05 20.95 12 12 20.95 3.05 12 12 3.05Z" />
      <circle cx="12" cy="9.7" r="1.55" />
      <path d="M8.55 15.75c.7-1.65 1.86-2.48 3.45-2.48s2.75.83 3.45 2.48" />
    </svg>
  )
}

const EmptyState = ({ title, copy }) => (
  <div className="profile-tab-empty-state">
    <h3>{title}</h3>
    <p>{copy}</p>
  </div>
)

const getPostThreadTitle = (post) =>
  post?.caption?.trim()
    ? post.caption.trim()
    : post?.authorUsername
      ? `@${post.authorUsername}'s post`
      : `${post?.authorName || "Campus"} post`

// `variant="grid"` is used for high-fanout tile grids — we deliberately skip
// preloading metadata for videos and prefer the smaller thumbnail when we
// have one. `variant="detail"` is for the post viewer modal where the user
// is actively looking at a single piece of media and full quality matters.
const PostMedia = ({ post, className = "profile-post-media", style, variant = "grid" }) => {
  const isGrid = variant === "grid"
  const thumb = post.thumbnailUrl || post.mediaUrl

  if (post.mediaType === "video") {
    if (isGrid) {
      // Show the still poster for grid tiles — a video element with
      // preload="none" + no autoplay would keep showing as a blank black
      // box, and the user is about to click anyway. Egress drops to one
      // small thumbnail per tile.
      return (
        <img
          className={className}
          style={style}
          src={thumb}
          alt={post.caption || "Profile video"}
          loading="lazy"
          decoding="async"
        />
      )
    }
    return (
      <video
        className={className}
        style={style}
        src={post.mediaUrl}
        poster={post.thumbnailUrl || undefined}
        muted
        playsInline
        preload="metadata"
      />
    )
  }

  return (
    <img
      className={className}
      style={style}
      src={isGrid ? thumb : post.mediaUrl}
      alt={post.caption || "Profile post"}
      loading={isGrid ? "lazy" : undefined}
      decoding="async"
    />
  )
}

const modalMediaStyle = {
  width: "100%",
  height: "100%",
  maxWidth: "100%",
  maxHeight: "100%",
  objectFit: "contain",
  objectPosition: "center center",
}

const DropdownChevron = ({ open }) => (
  <svg
    className={`profile-tab-chevron ${open ? "open" : ""}`}
    viewBox="0 0 12 12"
    aria-hidden="true"
  >
    <path d="M4.2 2.8 7.4 6 4.2 9.2" />
  </svg>
)

const PostTile = ({ post, onOpen }) => (
  <article className="profile-post-tile">
    <button type="button" className="profile-post-open" onClick={() => onOpen(post)}>
      <PostMedia post={post} />
      <span className="profile-tab-event-pill">{post.mediaType === "video" ? "Video" : "Post"}</span>
    </button>
  </article>
)

const PostListItem = ({ post, onOpen }) => (
  <article className="profile-post-list-item">
    <button type="button" className="profile-post-list-media" onClick={() => onOpen(post)}>
      <PostMedia post={post} className="profile-post-list-image" />
    </button>
    <div className="profile-post-list-body">
      <span>{post.mediaType === "video" ? "Video" : "Post"}</span>
      <strong>{post.caption || "Untitled post"}</strong>
      <p>{new Date(post.createdAt).toLocaleDateString()}</p>
    </div>
  </article>
)

const ProfileEventTile = ({ event, onOpen }) => (
  <article className="profile-post-tile">
    <button type="button" className="profile-post-open" onClick={() => onOpen(event)}>
      {event.image ? (
        <img
          className="profile-post-media"
          src={event.image}
          alt={event.title || "Event"}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className="profile-post-media" style={{ backgroundImage: "var(--explore-event-fallback)", backgroundSize: "cover", backgroundPosition: "center" }} />
      )}
      <span className="profile-content-type-badge event">
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      </span>
    </button>
  </article>
)

const MemoryCard = ({ memory, event }) => (
  <article className="profile-post-tile profile-memory-tile">
    <div className="profile-post-open">
      {memory.mediaType === "video" ? (
        // Don't preload metadata for grid videos — show poster only.
        <img
          className="profile-post-media"
          src={memory.thumbnailUrl || memory.mediaUrl}
          alt={memory.caption || "Event memory"}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <img
          className="profile-post-media"
          src={memory.thumbnailUrl || memory.mediaUrl}
          alt={memory.caption || "Event memory"}
          loading="lazy"
          decoding="async"
        />
      )}
      <span className="profile-tab-event-pill">Event Tag</span>
    </div>
    <div className="profile-post-list-body compact">
      <strong>{event?.title || "Event memory"}</strong>
      <p>{memory.caption || new Date(memory.createdAt).toLocaleDateString()}</p>
    </div>
  </article>
)

export default function ProfileContentTabs({ profileId, isOwner = false, allEvents = [] }) {
  const {
    savedEvents,
    addEvent,
    setPostGridVisibility,
    loadGridPostsForAuthor,
    currentUser,
  } = useEvents()
  const { showToast } = useToast()

  const [activeTab, setActiveTab] = useState("grid")
  const [postViewMode, setPostViewMode] = useState("grid")
  const [tagFilter, setTagFilter] = useState("all")
  const [collectionMode, setCollectionMode] = useState("reposts")
  const [activeDropdown, setActiveDropdown] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [gridPosts, setGridPosts] = useState([])
  const [authorPosts, setAuthorPosts] = useState([])
  const [reposts, setReposts] = useState([])
  const [repostedPosts, setRepostedPosts] = useState([])
  const [likedPosts, setLikedPosts] = useState([])
  const [savedPosts, setSavedPosts] = useState([])
  const [taggedPostRows, setTaggedPostRows] = useState([])
  const [eventMemories, setEventMemories] = useState([])
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [selectedPost, setSelectedPost] = useState(null)
  const [selectedPostMenuOpen, setSelectedPostMenuOpen] = useState(false)
  const [sharePost, setSharePost] = useState(null)
  const [activeCommentPostId, setActiveCommentPostId] = useState(null)
  const [commentsByPostId, setCommentsByPostId] = useState({})
  const [commentDraft, setCommentDraft] = useState("")
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const dropdownRef = useRef(null)

  const currentUserId =
    currentUser?.id && currentUser.id !== "current-user" ? String(currentUser.id) : ""

  const eventLookup = useMemo(
    () => new Map((allEvents || []).map((event) => [String(event.id), event])),
    [allEvents]
  )

  const loadProfileData = useCallback(async () => {
    if (!profileId) return
    setIsLoading(true)
    try {
      const [
        nextGrid,
        nextAuthorPosts,
        nextReposts,
        nextTaggedPosts,
        nextMemories,
        nextLikedIdSet,
        nextSavedIdSet,
      ] = await Promise.all([
        loadGridPostsForAuthor(profileId),
        loadDiscoverPostsForAuthor(profileId),
        loadRepostsForUser(profileId),
        loadPostsTaggingUser(profileId),
        loadEventMemoriesForUser(profileId),
        loadLikedPostIds({ userId: profileId }),
        loadSavedPostIds({ userId: profileId }),
      ])

      const postRepostIds = nextReposts
        .filter((row) => row.targetType === "post" && row.postId)
        .map((row) => row.postId)

      const [nextRepostedPosts, nextLikedPosts, nextSavedPosts] = await Promise.all([
        loadDiscoverPostsByIds(postRepostIds),
        loadDiscoverPostsByIds(Array.from(nextLikedIdSet)),
        loadDiscoverPostsByIds(Array.from(nextSavedIdSet)),
      ])

      setGridPosts(nextGrid)
      setAuthorPosts(nextAuthorPosts)
      setReposts(nextReposts)
      setTaggedPostRows(nextTaggedPosts)
      setEventMemories(nextMemories)
      setRepostedPosts(nextRepostedPosts)
      setLikedPosts(nextLikedPosts)
      setSavedPosts(nextSavedPosts)
    } finally {
      setIsLoading(false)
    }
  }, [loadGridPostsForAuthor, profileId])

  useEffect(() => {
    loadProfileData()
  }, [loadProfileData])

  const handleToggleGrid = async (post, onGrid) => {
    await setPostGridVisibility(post.id, onGrid)
    setAuthorPosts((posts) =>
      posts.map((item) => (item.id === post.id ? { ...item, onGrid } : item))
    )
    setGridPosts((posts) =>
      onGrid
        ? [{ ...post, onGrid: true }, ...posts.filter((item) => item.id !== post.id)]
        : posts.filter((item) => item.id !== post.id)
    )
  }

  const updateProfilePost = (postId, updater) => {
    const targetId = String(postId)
    const updateItem = (post) =>
      String(post.id) === targetId ? { ...post, ...updater(post) } : post

    setGridPosts((posts) => posts.map(updateItem))
    setAuthorPosts((posts) => posts.map(updateItem))
    setRepostedPosts((posts) => posts.map(updateItem))
    setSelectedPost((post) => (post && String(post.id) === targetId ? updateItem(post) : post))
    setSharePost((post) => (post && String(post.id) === targetId ? updateItem(post) : post))
  }

  const requireCurrentUser = (message) => {
    if (currentUserId) return true
    showToast(message, "error")
    return false
  }

  const closeSelectedPost = () => {
    setSelectedPost(null)
    setSelectedPostMenuOpen(false)
    setSharePost(null)
    setActiveCommentPostId(null)
    setCommentDraft("")
  }

  const handleSelectedPostGridToggle = async () => {
    if (!selectedPost) return
    const nextOnGrid = !selectedPost.onGrid
    await handleToggleGrid(selectedPost, nextOnGrid)
    setSelectedPost((post) => (post ? { ...post, onGrid: nextOnGrid } : post))
    setSelectedPostMenuOpen(false)
  }

  const handleToggleLike = async (post) => {
    if (!requireCurrentUser("Sign in to like posts.")) return
    const postId = String(post.id)
    const wasLiked = Boolean(post.isLikedByCurrentUser)
    const nextLiked = !wasLiked
    const previousCount = Number(post.likeCount) || 0

    updateProfilePost(postId, (item) => ({
      isLikedByCurrentUser: nextLiked,
      likeCount: Math.max(0, (Number(item.likeCount) || 0) + (nextLiked ? 1 : -1)),
    }))

    try {
      await setPostLike({ postId, userId: currentUserId, liked: nextLiked })
      invalidateDiscoverFeedCache()
    } catch (error) {
      updateProfilePost(postId, () => ({
        isLikedByCurrentUser: wasLiked,
        likeCount: previousCount,
      }))
      showToast(error?.message || "Could not update like.", "error")
    }
  }

  const handleToggleRepost = async (post) => {
    if (!requireCurrentUser("Sign in to repost posts.")) return
    const postId = String(post.id)
    const wasReposted = Boolean(post.isRepostedByCurrentUser)
    const nextReposted = !wasReposted
    const previousCount = Number(post.repostCount) || 0

    updateProfilePost(postId, (item) => ({
      isRepostedByCurrentUser: nextReposted,
      repostCount: Math.max(0, (Number(item.repostCount) || 0) + (nextReposted ? 1 : -1)),
    }))

    try {
      if (nextReposted) {
        await repostPost({ userId: currentUserId, postId })
      } else {
        await unrepostPost({ userId: currentUserId, postId })
      }
      invalidateDiscoverFeedCache()
      showToast(nextReposted ? "Post reposted." : "Repost removed.", "success")
    } catch (error) {
      updateProfilePost(postId, () => ({
        isRepostedByCurrentUser: wasReposted,
        repostCount: previousCount,
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
      updateProfilePost(post.id, () => ({ commentCount: comments.length }))
    } catch (error) {
      showToast(error?.message || "Could not load comments.", "error")
    }
  }

  const handleCloseComments = () => {
    setActiveCommentPostId(null)
    setCommentDraft("")
  }

  const handleSubmitComment = async (parentId = null) => {
    if (!activeCommentPostId || !commentDraft.trim() || isSubmittingComment) return
    if (!requireCurrentUser("Sign in to comment.")) return

    const postId = String(activeCommentPostId)
    const body = commentDraft.trim()
    const optimisticId = `optimistic-${Date.now()}`
    const optimisticComment = {
      id: optimisticId,
      authorName: currentUser?.name || currentUser?.username || "Campus User",
      authorUsername: currentUser?.username || "",
      authorAvatar: currentUser?.image || currentUser?.avatar || currentUser?.avatarUrl || "",
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
    updateProfilePost(postId, (post) => ({
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
      updateProfilePost(postId, (post) => ({
        commentCount: Math.max(0, (Number(post.commentCount) || 0) - 1),
      }))
      showToast(error?.message || "Could not post comment.", "error")
    } finally {
      setIsSubmittingComment(false)
    }
  }

  const handleToggleCommentLike = async (commentId) => {
    if (!activeCommentPostId) return
    if (!requireCurrentUser("Sign in to like comments.")) return
    const postId = String(activeCommentPostId)
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
    if (!activeCommentPostId) return
    if (!requireCurrentUser("Sign in to delete comments.")) return
    const postId = String(activeCommentPostId)
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
    updateProfilePost(postId, (post) => ({
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
      updateProfilePost(postId, () => ({ commentCount: comments.length }))
    }
  }

  const handleRecordShare = async (post, method) => {
    const shareCount = await recordPostShare({
      postId: post?.id,
      userId: currentUserId,
      method,
    })
    if (shareCount != null) {
      updateProfilePost(post.id, () => ({ shareCount }))
      invalidateDiscoverFeedCache()
    }
  }

  const handleTabTrigger = (tabId) => {
    const hasDropdown = tabId === "posts" || tabId === "tags" || tabId === "collection"

    if (!hasDropdown) {
      setActiveTab(tabId)
      setActiveDropdown(null)
      return
    }

    if (activeTab !== tabId) {
      setActiveTab(tabId)
      setActiveDropdown(null)
      return
    }

    setActiveDropdown((current) => (current === tabId ? null : tabId))
  }

  const repostItems = useMemo(() => {
    const postLookup = new Map(repostedPosts.map((post) => [post.id, post]))
    return reposts
      .map((row) => {
        if (row.targetType === "event") {
          const event = eventLookup.get(String(row.eventId))
          return event ? { id: row.id, type: "event", createdAt: row.createdAt, event } : null
        }

        const post = postLookup.get(String(row.postId))
        return post ? { id: row.id, type: "post", createdAt: row.createdAt, post } : null
      })
      .filter(Boolean)
      .sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt))
  }, [eventLookup, repostedPosts, reposts])

  const taggedPosts = useMemo(
    () =>
      taggedPostRows
        .map((row) =>
          row.post
            ? {
                ...row.post,
                mediaUrl: resolveDiscoverPostMediaUrl(row.post.mediaUrl),
              }
            : null
        )
        .filter(Boolean),
    [taggedPostRows]
  )

  const filteredTagItems = useMemo(() => {
    const postItems = taggedPosts.map((post) => ({
      id: `post-${post.id}`,
      type: "post",
      createdAt: post.createdAt,
      post,
    }))
    const memoryItems = eventMemories.map((memory) => ({
      id: `memory-${memory.id}`,
      type: "memory",
      createdAt: memory.createdAt,
      memory,
      event: eventLookup.get(String(memory.eventId)),
    }))

    if (tagFilter === "posts") return postItems
    if (tagFilter === "event-tags") return memoryItems
    return [...postItems, ...memoryItems].sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt))
  }, [eventLookup, eventMemories, tagFilter, taggedPosts])

  const activeCommentPost = useMemo(() => {
    if (!activeCommentPostId) return null
    const postId = String(activeCommentPostId)
    return (
      (selectedPost && String(selectedPost.id) === postId ? selectedPost : null) ||
      authorPosts.find((post) => String(post.id) === postId) ||
      gridPosts.find((post) => String(post.id) === postId) ||
      repostedPosts.find((post) => String(post.id) === postId) ||
      taggedPosts.find((post) => String(post.id) === postId) ||
      null
    )
  }, [activeCommentPostId, authorPosts, gridPosts, repostedPosts, selectedPost, taggedPosts])

  const activePostComments = activeCommentPostId
    ? commentsByPostId[String(activeCommentPostId)] || []
    : []

  const renderPostGrid = (posts) =>
    posts.length > 0 ? (
      <div className="profile-media-grid">
        {posts.map((post) => (
          <PostTile
            key={post.id}
            post={post}
            onOpen={setSelectedPost}
          />
        ))}
      </div>
    ) : null

  const renderGridTab = () => {
    if (gridPosts.length > 0) return renderPostGrid(gridPosts)
    return (
      <EmptyState
        title="No grid posts yet"
        copy={isOwner ? "Post to your Grid from Posts / Videos." : "This profile has not curated a grid yet."}
      />
    )
  }

  const renderPostsTab = () => (
    <>
      {authorPosts.length > 0 ? (
        postViewMode === "grid" ? (
          renderPostGrid(authorPosts)
        ) : (
          <div className="profile-post-list">
            {authorPosts.map((post) => (
              <PostListItem
                key={post.id}
                post={post}
                onOpen={setSelectedPost}
              />
            ))}
          </div>
        )
      ) : (
        <EmptyState title="No posts yet" copy="Posts and videos will appear here." />
      )}
    </>
  )

  const renderRepostsCollection = () =>
    repostItems.length > 0 ? (
      <div className="profile-media-grid">
        {repostItems.map((item) =>
          item.type === "event" ? (
            <ProfileEventTile
              key={item.id}
              event={item.event}
              onOpen={setSelectedEvent}
            />
          ) : (
            <PostTile
              key={item.id}
              post={item.post}
              onOpen={setSelectedPost}
            />
          )
        )}
      </div>
    ) : (
      <EmptyState title="No reposts yet" copy="Reposted events and posts will live here." />
    )

  const renderLikedCollection = () =>
    likedPosts.length > 0 ? (
      <div className="profile-media-grid">
        {likedPosts.map((post) => (
          <PostTile key={post.id} post={post} onOpen={setSelectedPost} />
        ))}
      </div>
    ) : (
      <EmptyState title="No liked posts yet" copy="Posts you like will appear here." />
    )

  const renderSavedCollection = () =>
    savedPosts.length > 0 ? (
      <div className="profile-media-grid">
        {savedPosts.map((post) => (
          <PostTile key={post.id} post={post} onOpen={setSelectedPost} />
        ))}
      </div>
    ) : (
      <EmptyState title="No saved posts yet" copy="Posts you save will appear here." />
    )

  const renderCollectionTab = () => {
    if (collectionMode === "likes") return renderLikedCollection()
    if (collectionMode === "saves") return renderSavedCollection()
    return renderRepostsCollection()
  }

  const renderTagsTab = () => (
    <>
      {filteredTagItems.length > 0 ? (
        <div className="profile-media-grid">
          {filteredTagItems.map((item) =>
            item.type === "post" ? (
              <PostTile
                key={item.id}
                post={item.post}
                onOpen={setSelectedPost}
              />
            ) : (
              <MemoryCard key={item.id} memory={item.memory} event={item.event} />
            )
          )}
        </div>
      ) : (
        <EmptyState title="No tagged content yet" copy="Tagged posts and event memories will appear here." />
      )}
    </>
  )

  return (
    <div className="profile-section profile-tabbed-section">
      <div className="profile-tab-bar" role="tablist" aria-label="Profile tabs" ref={dropdownRef}>
        {PROFILE_TABS.map((tab) => {
          const hasDropdown =
            tab.id === "posts" || tab.id === "tags" || tab.id === "collection"
          const isDropdownOpen = activeDropdown === tab.id
          const activeCollection =
            COLLECTION_OPTIONS.find((option) => option.id === collectionMode) ||
            COLLECTION_OPTIONS[0]
          const iconType =
            tab.id === "collection" ? activeCollection.iconType : tab.id
          const accessibleLabel =
            tab.id === "collection" ? activeCollection.label : tab.label

          return (
            <div key={tab.id} className="profile-tab-slot">
              <button
                type="button"
                className={`profile-tab-btn ${activeTab === tab.id ? "active" : ""} ${hasDropdown ? "has-dropdown" : ""}`}
                onClick={() => handleTabTrigger(tab.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    handleTabTrigger(tab.id)
                  }
                }}
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-label={accessibleLabel}
                aria-haspopup={hasDropdown ? "menu" : undefined}
                aria-expanded={hasDropdown ? isDropdownOpen : undefined}
                title={accessibleLabel}
                tabIndex={0}
              >
                <ProfileTabIcon type={iconType} />
                {hasDropdown ? <DropdownChevron open={isDropdownOpen} /> : null}
              </button>

            {/* Dropdown for Posts / Camera Icon (Grid/List) */}
            {activeDropdown === tab.id && tab.id === "posts" && (
              <div
                className="profile-icon-dropdown-menu"
                role="menu"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => { setPostViewMode('grid'); setActiveDropdown(null); }}
                  className={`profile-icon-dropdown-item ${postViewMode === "grid" ? "active" : ""}`}
                  role="menuitem"
                >
                  Grid
                </button>
                <div className="profile-icon-dropdown-separator" />
                <button
                  type="button"
                  onClick={() => { setPostViewMode('list'); setActiveDropdown(null); }}
                  className={`profile-icon-dropdown-item ${postViewMode === "list" ? "active" : ""}`}
                  role="menuitem"
                >
                  List
                </button>
              </div>
            )}

            {/* Dropdown for Collection icon (Reposts/Likes/Saved) */}
            {activeDropdown === tab.id && tab.id === "collection" && (
              <div
                className="profile-icon-dropdown-menu"
                role="menu"
                onClick={(e) => e.stopPropagation()}
              >
                {COLLECTION_OPTIONS.map((option, index) => (
                  <div key={option.id} className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => {
                        setCollectionMode(option.id)
                        setActiveDropdown(null)
                      }}
                      className={`profile-icon-dropdown-item ${collectionMode === option.id ? "active" : ""}`}
                      role="menuitem"
                      aria-label={option.label}
                      title={option.label}
                    >
                      <span className="profile-icon-dropdown-icon" aria-hidden="true">
                        <ProfileTabIcon type={option.iconType} />
                      </span>
                    </button>
                    {index < COLLECTION_OPTIONS.length - 1 && (
                      <div className="profile-icon-dropdown-separator" />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Dropdown for Tags Icon (All/Posts/Event Tags) */}
            {activeDropdown === tab.id && tab.id === "tags" && (
              <div
                className="profile-icon-dropdown-menu tag-menu"
                role="menu"
                onClick={(e) => e.stopPropagation()}
              >
                {TAG_FILTERS.map((filter, index) => (
                  <div key={filter.id} className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => { setTagFilter(filter.id); setActiveDropdown(null); }}
                      className={`profile-icon-dropdown-item ${tagFilter === filter.id ? "active" : ""}`}
                      role="menuitem"
                    >
                      {filter.label}
                    </button>
                    {index < TAG_FILTERS.length - 1 && <div className="profile-icon-dropdown-separator" />}
                  </div>
                ))}
              </div>
            )}
          </div>
          )
        })}
      </div>

      <div className="profile-tab-panel">
        {isLoading && <div className="profile-tab-loading">Loading profile content...</div>}
        {!isLoading && activeTab === "grid" && renderGridTab()}
        {!isLoading && activeTab === "posts" && renderPostsTab()}
        {!isLoading && activeTab === "collection" && renderCollectionTab()}
        {!isLoading && activeTab === "tags" && renderTagsTab()}
      </div>

      {selectedEvent && (
        <ExploreEventModal
          event={selectedEvent}
          isSaved={(savedEvents || []).some((event) => event.id === selectedEvent.id)}
          actionLabel="I'm Going"
          onAction={() => addEvent(selectedEvent)}
          onClose={() => setSelectedEvent(null)}
        />
      )}

      {selectedPost && (
        <div className="profile-post-modal" role="dialog" aria-modal="true">
          <button
            type="button"
            className="profile-post-modal-backdrop"
            aria-label="Close post preview"
            onClick={closeSelectedPost}
          />
          <div className="profile-post-modal-card">
            <div className="profile-post-modal-media-frame">
              <PostMedia
                post={selectedPost}
                className="profile-post-modal-media"
                style={modalMediaStyle}
                variant="detail"
              />
            </div>

            <aside className="profile-post-modal-side">
              <div className="profile-post-modal-topbar">
                <div className="profile-post-modal-author">
                  <img
                    src={selectedPost.authorAvatar || "/default-avatar.png"}
                    alt=""
                    onError={(event) => {
                      event.currentTarget.src = "/default-avatar.png"
                    }}
                  />
                  <div>
                    <strong>{selectedPost.authorUsername ? `@${selectedPost.authorUsername}` : selectedPost.authorName || "Campus User"}</strong>
                    <span>{selectedPost.mediaType === "video" ? "Video post" : "Photo post"}</span>
                  </div>
                </div>

                <div className="profile-post-modal-actions">
                  <div className="profile-overflow-menu-wrap">
                    <button
                      type="button"
                      className="profile-overflow-trigger"
                      aria-label="Post actions"
                      aria-expanded={selectedPostMenuOpen}
                      onClick={() => setSelectedPostMenuOpen((open) => !open)}
                    >
                      <span />
                      <span />
                      <span />
                    </button>
                    {selectedPostMenuOpen ? (
                      <div className="profile-overflow-menu">
                        {isOwner ? (
                          <button
                            type="button"
                            className="profile-overflow-menu-item"
                            onClick={handleSelectedPostGridToggle}
                          >
                            {selectedPost.onGrid ? "Remove from Grid" : "Post to Grid"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="profile-overflow-menu-item danger"
                            onClick={() => setSelectedPostMenuOpen(false)}
                          >
                            Report post
                          </button>
                        )}
                      </div>
                    ) : null}
                  </div>

                  <button type="button" className="profile-post-modal-close" onClick={closeSelectedPost} aria-label="Close post preview">
                    ×
                  </button>
                </div>
              </div>

              <div className="profile-post-modal-details">
                <div className="profile-post-caption-row">
                  <img
                    src={selectedPost.authorAvatar || "/default-avatar.png"}
                    alt=""
                    onError={(event) => {
                      event.currentTarget.src = "/default-avatar.png"
                    }}
                  />
                  <p>
                    <strong>{selectedPost.authorUsername ? `@${selectedPost.authorUsername}` : selectedPost.authorName || "Campus User"}</strong>
                    {selectedPost.caption || "No caption."}
                  </p>
                </div>

                <div className="profile-post-comment-preview">
                  {selectedPost.commentCount > 0
                    ? `View ${selectedPost.commentCount} ${selectedPost.commentCount === 1 ? "comment" : "comments"}`
                    : "No comments yet."}
                </div>
              </div>

              <div className="profile-post-engagement">
                <div className="profile-post-action-row" aria-label="Post engagement">
                  <button
                    type="button"
                    className={`profile-post-action-icon ${selectedPost.isLikedByCurrentUser ? "active" : ""}`}
                    onClick={() => handleToggleLike(selectedPost)}
                    aria-label={selectedPost.isLikedByCurrentUser ? "Unlike post" : "Like post"}
                    aria-pressed={Boolean(selectedPost.isLikedByCurrentUser)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="profile-post-action-icon"
                    onClick={() => handleOpenComments(selectedPost)}
                    aria-label="Open comments"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5Z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="profile-post-action-icon"
                    onClick={() => setSharePost(selectedPost)}
                    aria-label="Share post"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m22 2-7 20-4-9-9-4 20-7Z" />
                      <path d="M22 2 11 13" />
                    </svg>
                  </button>
                </div>
                <div className="profile-post-engagement-summary">
                  <span>{selectedPost.likeCount || 0} likes</span>
                  <span>{selectedPost.commentCount || 0} comments</span>
                </div>
                <span className="profile-post-modal-date">
                  {new Date(selectedPost.createdAt).toLocaleDateString()}
                </span>
              </div>
            </aside>
          </div>
        </div>
      )}

      <PostShareSheet
        post={sharePost}
        isOpen={Boolean(sharePost)}
        onClose={() => setSharePost(null)}
        isOwner={Boolean(sharePost && currentUserId && String(currentUserId) === String(sharePost.authorId))}
        onRepost={handleToggleRepost}
        onShareComplete={handleRecordShare}
        isReposted={Boolean(sharePost?.isRepostedByCurrentUser)}
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
            : activeCommentPost?.authorName || "Profile post"
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
