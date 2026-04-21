import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  loadDiscoverPostsByIds,
  loadDiscoverPostsForAuthor,
  resolveDiscoverPostMediaUrl,
} from "../discoverPosts"
import { buildEventImageStyle } from "../eventImages"
import { loadRepostsForUser } from "../profileReposts"
import { loadPostsTaggingUser } from "../contentTags"
import { loadEventMemoriesForUser } from "../eventMemories"
import { useEvents } from "../context/EventContext"
import ExploreEventModal from "./ExploreEventModal"

const PROFILE_TABS = [
  { id: "grid", label: "Grid" },
  { id: "posts", label: "Posts / Videos" },
  { id: "reposts", label: "Reposts" },
  { id: "tags", label: "Tags" },
]

const TAG_FILTERS = [
  { id: "all", label: "All" },
  { id: "posts", label: "Posts" },
  { id: "event-tags", label: "Event Tags" },
]

const POST_VIEW_OPTIONS = [
  { id: "grid", label: "Grid" },
  { id: "list", label: "List" },
]

const CONTENT_TYPE_LABELS = {
  video: "Video",
  post: "Post",
  event: "Event",
}

const toTime = (value) => {
  const time = Date.parse(value || "")
  return Number.isFinite(time) ? time : 0
}

const getPostContentType = (post) => (post?.mediaType === "video" ? "video" : "post")

const ProfileTabIcon = ({ type }) => {
  if (type === "grid") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
      </svg>
    )
  }

  if (type === "posts") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3.25" y="6.25" width="17.5" height="12.5" rx="3.5" />
        <circle cx="12" cy="12.5" r="3.6" />
        <path d="M11.15 10.35v4.3l3.45-2.15-3.45-2.15Z" />
        <path d="M8 6.25 9.25 4h5.5L16 6.25" />
      </svg>
    )
  }

  if (type === "reposts") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7.25 6.5h8.1c2.1 0 3.8 1.7 3.8 3.8v.45" />
        <path d="M16.65 3.95 19.2 6.5l-2.55 2.55" />
        <path d="M16.75 17.5h-8.1c-2.1 0-3.8-1.7-3.8-3.8v-.45" />
        <path d="M7.35 20.05 4.8 17.5l2.55-2.55" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.8 21.2 12 12 21.2 2.8 12 12 2.8Z" />
      <circle cx="12" cy="9.4" r="2.15" />
      <path d="M7.75 16.05c.8-2.05 2.25-3.1 4.25-3.1s3.45 1.05 4.25 3.1" />
    </svg>
  )
}

const EmptyState = ({ title, copy }) => (
  <div className="profile-tab-empty-state">
    <h3>{title}</h3>
    <p>{copy}</p>
  </div>
)

const ContentTypeIcon = ({ type }) => {
  if (type === "video") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="5.5" width="16" height="13" rx="3" />
        <path d="M10.3 9.25v5.5l4.7-2.75-4.7-2.75Z" />
      </svg>
    )
  }

  if (type === "event") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 3.75v3" />
        <path d="M17 3.75v3" />
        <rect x="4.5" y="5.5" width="15" height="14" rx="3" />
        <path d="M4.5 9.5h15" />
        <path d="M9 13h.01" />
        <path d="M12 13h.01" />
        <path d="M15 13h.01" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="5" width="16" height="14" rx="3" />
      <path d="m7.5 15 3.1-3.1 2.2 2.2 1.4-1.4L17 15.5" />
      <circle cx="9" cy="9.3" r="1.2" />
    </svg>
  )
}

const ContentTypeBadge = ({ type }) => (
  <span
    className={`profile-content-type-badge ${type}`}
    aria-label={CONTENT_TYPE_LABELS[type] || "Content"}
    title={CONTENT_TYPE_LABELS[type] || "Content"}
  >
    <ContentTypeIcon type={type} />
  </span>
)

const PostMedia = ({ post, className = "profile-post-media" }) => {
  if (post.mediaType === "video") {
    return (
      <video
        className={className}
        src={post.mediaUrl}
        poster={post.thumbnailUrl || undefined}
        muted
        playsInline
        preload="metadata"
      />
    )
  }

  return <img className={className} src={post.mediaUrl} alt={post.caption || "Profile post"} />
}

const OverflowMenu = ({
  actions = [],
  menuId,
  openMenuId,
  setOpenMenuId,
  label = "Open content actions",
  emptyLabel = "",
}) => {
  if (!actions.length && !emptyLabel) return null

  const isOpen = openMenuId === menuId

  return (
    <div className="profile-overflow-menu-wrap" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        className="profile-overflow-trigger"
        onClick={() => setOpenMenuId(isOpen ? null : menuId)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <span />
        <span />
        <span />
      </button>

      {isOpen && (
        <div className="profile-overflow-menu" role="menu">
          {actions.length > 0 ? (
            actions.map((action) => (
              <button
                key={action.id}
                type="button"
                className={`profile-overflow-menu-item ${action.tone || ""}`}
                onClick={async () => {
                  setOpenMenuId(null)
                  await action.onSelect()
                }}
                role="menuitem"
              >
                {action.label}
              </button>
            ))
          ) : (
            <span className="profile-overflow-menu-empty">{emptyLabel}</span>
          )}
        </div>
      )}
    </div>
  )
}

const getGridActions = (post, onToggleGrid) => [
  {
    id: "toggle-grid",
    label: post.onGrid ? "Remove from Grid" : "Post to Grid",
    tone: post.onGrid ? "danger" : "",
    onSelect: () => onToggleGrid(post, !post.onGrid),
  },
]

const engagementIconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.85,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
}

const LikeIcon = () => (
  <svg {...engagementIconProps}>
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z" />
  </svg>
)

const CommentIcon = () => (
  <svg {...engagementIconProps}>
    <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 8.5-8.5h.5a8.5 8.5 0 0 1 8 8v.5Z" />
  </svg>
)

const ShareIcon = () => (
  <svg {...engagementIconProps}>
    <path d="M22 2 11 13" />
    <path d="m22 2-7 20-4-9-9-4 20-7Z" />
  </svg>
)

const toEngagementCount = (...values) => {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (Array.isArray(value)) return value.length
  }

  return null
}

const formatMetricLabel = (value, singular, plural) =>
  `${value.toLocaleString()} ${value === 1 ? singular : plural}`

const getPostEngagement = (post) => ({
  likes: toEngagementCount(post?.likeCount, post?.likesCount, post?.likes),
  comments: toEngagementCount(post?.commentCount, post?.commentsCount, post?.comments),
  shares: toEngagementCount(post?.shareCount, post?.sharesCount, post?.shares),
})

const PostEngagementRow = ({ post }) => {
  const engagement = getPostEngagement(post)
  const metrics = [
    engagement.likes == null ? null : formatMetricLabel(engagement.likes, "like", "likes"),
    engagement.comments == null ? null : formatMetricLabel(engagement.comments, "comment", "comments"),
    engagement.shares == null ? null : formatMetricLabel(engagement.shares, "share", "shares"),
  ].filter(Boolean)

  return (
    <div className="profile-post-engagement" aria-label="Post engagement">
      <div className="profile-post-action-row" aria-label="Post actions">
        <button type="button" className="profile-post-action-icon" aria-label="Like post">
          <LikeIcon />
        </button>
        <button type="button" className="profile-post-action-icon" aria-label="Comment on post">
          <CommentIcon />
        </button>
        <button type="button" className="profile-post-action-icon" aria-label="Share post">
          <ShareIcon />
        </button>
      </div>
      {metrics.length > 0 && (
        <div className="profile-post-engagement-summary">
          {metrics.map((metric) => (
            <span key={metric}>{metric}</span>
          ))}
        </div>
      )}
    </div>
  )
}

const PostTile = ({ post, onOpen }) => (
  <article className="profile-post-tile">
    <button type="button" className="profile-post-open" onClick={() => onOpen(post)}>
      <PostMedia post={post} />
      <ContentTypeBadge type={getPostContentType(post)} />
    </button>
  </article>
)

const PostListItem = ({ post, onOpen }) => (
  <article className="profile-post-list-item">
    <button type="button" className="profile-post-list-media" onClick={() => onOpen(post)}>
      <PostMedia post={post} className="profile-post-list-image" />
    </button>
    <div className="profile-post-list-body">
      <div className="profile-post-list-heading">
        <ContentTypeBadge type={getPostContentType(post)} />
      </div>
      <strong>{post.caption || "Untitled post"}</strong>
      <p>{new Date(post.createdAt).toLocaleDateString()}</p>
    </div>
  </article>
)

const EventTile = ({ event, onOpen }) => (
  <article className="profile-post-tile profile-event-tile">
    <button
      type="button"
      className="profile-post-open profile-event-tile-open"
      style={buildEventImageStyle(event?.image)}
      onClick={() => onOpen(event)}
    >
      <ContentTypeBadge type="event" />
      <span className="profile-event-tile-scrim" aria-hidden="true" />
      <span className="profile-event-tile-copy">
        <strong>{event?.title || "Untitled Event"}</strong>
        <span>{event?.date || event?.eventDate || "Campus event"}</span>
      </span>
    </button>
  </article>
)

const ProfileDropdown = ({ label, options, selectedId, onSelect }) => (
  <div className="profile-icon-dropdown-menu" role="menu" aria-label={label}>
    {options.map((option) => (
      <button
        key={option.id}
        type="button"
        className={`profile-icon-dropdown-item ${selectedId === option.id ? "active" : ""}`}
        onClick={(event) => {
          event.stopPropagation()
          onSelect(option.id)
        }}
        role="menuitemradio"
        aria-checked={selectedId === option.id}
      >
        <span>{option.label}</span>
        {selectedId === option.id && <span aria-hidden="true">✓</span>}
      </button>
    ))}
  </div>
)

const MemoryCard = ({ memory, event }) => (
  <article className="profile-post-tile profile-memory-tile">
    <div className="profile-post-open">
      {memory.mediaType === "video" ? (
        <video className="profile-post-media" src={memory.mediaUrl} muted playsInline preload="metadata" />
      ) : (
        <img className="profile-post-media" src={memory.mediaUrl} alt={memory.caption || "Event memory"} />
      )}
      <ContentTypeBadge type="event" />
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
  } = useEvents()

  const [activeTab, setActiveTab] = useState("grid")
  const [postViewMode, setPostViewMode] = useState("grid")
  const [tagFilter, setTagFilter] = useState("all")
  const [isLoading, setIsLoading] = useState(false)
  const [gridPosts, setGridPosts] = useState([])
  const [authorPosts, setAuthorPosts] = useState([])
  const [reposts, setReposts] = useState([])
  const [repostedPosts, setRepostedPosts] = useState([])
  const [taggedPostRows, setTaggedPostRows] = useState([])
  const [eventMemories, setEventMemories] = useState([])
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [selectedPost, setSelectedPost] = useState(null)
  const [openDropdown, setOpenDropdown] = useState(null)
  const [openActionMenu, setOpenActionMenu] = useState(null)
  const tabsRef = useRef(null)

  const eventLookup = useMemo(
    () => new Map((allEvents || []).map((event) => [String(event.id), event])),
    [allEvents]
  )

  const loadProfileData = useCallback(async () => {
    if (!profileId) return
    setIsLoading(true)
    try {
      const [nextGrid, nextAuthorPosts, nextReposts, nextTaggedPosts, nextMemories] =
        await Promise.all([
          loadGridPostsForAuthor(profileId),
          loadDiscoverPostsForAuthor(profileId),
          loadRepostsForUser(profileId),
          loadPostsTaggingUser(profileId),
          loadEventMemoriesForUser(profileId),
        ])

      const postRepostIds = nextReposts
        .filter((row) => row.targetType === "post" && row.postId)
        .map((row) => row.postId)
      const nextRepostedPosts = await loadDiscoverPostsByIds(postRepostIds)

      setGridPosts(nextGrid)
      setAuthorPosts(nextAuthorPosts)
      setReposts(nextReposts)
      setTaggedPostRows(nextTaggedPosts)
      setEventMemories(nextMemories)
      setRepostedPosts(nextRepostedPosts)
    } finally {
      setIsLoading(false)
    }
  }, [loadGridPostsForAuthor, profileId])

  useEffect(() => {
    loadProfileData()
  }, [loadProfileData])

  const handleToggleGrid = async (post, onGrid) => {
    setOpenActionMenu(null)
    await setPostGridVisibility(post.id, onGrid)
    setAuthorPosts((posts) =>
      posts.map((item) => (item.id === post.id ? { ...item, onGrid } : item))
    )
    setRepostedPosts((posts) =>
      posts.map((item) => (item.id === post.id ? { ...item, onGrid } : item))
    )
    setTaggedPostRows((rows) =>
      rows.map((row) =>
        row.post?.id === post.id ? { ...row, post: { ...row.post, onGrid } } : row
      )
    )
    setSelectedPost((current) =>
      current?.id === post.id ? { ...current, onGrid } : current
    )
    setGridPosts((posts) =>
      onGrid
        ? [{ ...post, onGrid: true }, ...posts.filter((item) => item.id !== post.id)]
        : posts.filter((item) => item.id !== post.id)
    )
  }

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (
        event.target.closest(".profile-tab-slot.has-dropdown") ||
        event.target.closest(".profile-overflow-menu-wrap")
      ) {
        return
      }

      setOpenDropdown(null)
      setOpenActionMenu(null)
    }

    document.addEventListener("pointerdown", handlePointerDown)
    return () => document.removeEventListener("pointerdown", handlePointerDown)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key !== "Escape") return

      if (openActionMenu) {
        setOpenActionMenu(null)
        return
      }

      if (openDropdown) {
        setOpenDropdown(null)
        return
      }

      if (selectedPost) {
        setSelectedPost(null)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [openActionMenu, openDropdown, selectedPost])

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

  const renderRepostsTab = () =>
    repostItems.length > 0 ? (
      <div className="profile-media-grid">
        {repostItems.map((item) =>
          item.type === "event" ? (
            <EventTile
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

  const handleTabClick = (tabId) => {
    const hasDropdown = tabId === "posts" || tabId === "tags"

    setOpenActionMenu(null)

    if (activeTab !== tabId) {
      setActiveTab(tabId)
      setOpenDropdown(null)
      return
    }

    setActiveTab(tabId)
    setOpenDropdown((current) => (hasDropdown && current !== tabId ? tabId : null))
  }

  return (
    <div className="profile-section profile-tabbed-section" ref={tabsRef}>
      <div className="profile-tab-bar" role="tablist" aria-label="Profile tabs">
        {PROFILE_TABS.map((tab) => (
          <div
            key={tab.id}
            className={`profile-tab-slot ${tab.id === "posts" || tab.id === "tags" ? "has-dropdown" : ""}`}
          >
            <button
              type="button"
              className={`profile-tab-btn ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => handleTabClick(tab.id)}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-label={tab.label}
              aria-haspopup={tab.id === "posts" || tab.id === "tags" ? "menu" : undefined}
              aria-expanded={openDropdown === tab.id}
              title={tab.label}
            >
              <ProfileTabIcon type={tab.id} />
            </button>

            {openDropdown === "posts" && tab.id === "posts" && (
              <ProfileDropdown
                label="Post layout"
                options={POST_VIEW_OPTIONS}
                selectedId={postViewMode}
                onSelect={(optionId) => {
                  setPostViewMode(optionId)
                  setActiveTab("posts")
                  setOpenDropdown(null)
                }}
              />
            )}

            {openDropdown === "tags" && tab.id === "tags" && (
              <ProfileDropdown
                label="Tagged content filter"
                options={TAG_FILTERS}
                selectedId={tagFilter}
                onSelect={(optionId) => {
                  setTagFilter(optionId)
                  setActiveTab("tags")
                  setOpenDropdown(null)
                }}
              />
            )}
          </div>
        ))}
      </div>

      <div className="profile-tab-panel">
        {isLoading && <div className="profile-tab-loading">Loading profile content...</div>}
        {!isLoading && activeTab === "grid" && renderGridTab()}
        {!isLoading && activeTab === "posts" && renderPostsTab()}
        {!isLoading && activeTab === "reposts" && renderRepostsTab()}
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
            onClick={() => setSelectedPost(null)}
          />
          <div className="profile-post-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="profile-post-modal-topbar">
              <ContentTypeBadge type={getPostContentType(selectedPost)} />
              <div className="profile-post-modal-actions">
                <OverflowMenu
                  actions={isOwner ? getGridActions(selectedPost, handleToggleGrid) : []}
                  menuId={`modal-${selectedPost.id}`}
                  openMenuId={openActionMenu}
                  setOpenMenuId={setOpenActionMenu}
                  emptyLabel="No actions available"
                />
                <button type="button" className="profile-post-modal-close" onClick={() => setSelectedPost(null)}>
                  ×
                </button>
              </div>
            </div>
            <div className="profile-post-modal-media-frame">
              <PostMedia post={selectedPost} className="profile-post-modal-media" />
            </div>
            <div className="profile-post-modal-details">
              <PostEngagementRow post={selectedPost} />
              {selectedPost.caption && <p>{selectedPost.caption}</p>}
              <time className="profile-post-modal-date" dateTime={selectedPost.createdAt}>
                {new Date(selectedPost.createdAt).toLocaleDateString()}
              </time>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
