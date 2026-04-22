import { useCallback, useEffect, useMemo, useState } from "react"
import {
  loadDiscoverPostsByIds,
  loadDiscoverPostsForAuthor,
  resolveDiscoverPostMediaUrl,
} from "../discoverPosts"
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

const toTime = (value) => {
  const time = Date.parse(value || "")
  return Number.isFinite(time) ? time : 0
}

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

const PostMedia = ({ post, className = "profile-post-media" }) => {
  if (post.mediaType === "video") {
    return (
      <video className={className} src={post.mediaUrl} muted playsInline preload="metadata" />
    )
  }

  return <img className={className} src={post.mediaUrl} alt={post.caption || "Profile post"} />
}

const PostTile = ({ post, isOwner, onToggleGrid, onOpen }) => (
  <article className="profile-post-tile">
    <button type="button" className="profile-post-open" onClick={() => onOpen(post)}>
      <PostMedia post={post} />
      <span className="profile-tab-event-pill">{post.mediaType === "video" ? "Video" : "Post"}</span>
    </button>
    {isOwner && (
      <button
        type="button"
        className="profile-grid-manage-btn"
        onClick={() => onToggleGrid(post, !post.onGrid)}
      >
        {post.onGrid ? "Remove from Grid" : "Post to Grid"}
      </button>
    )}
  </article>
)

const PostListItem = ({ post, isOwner, onToggleGrid, onOpen }) => (
  <article className="profile-post-list-item">
    <button type="button" className="profile-post-list-media" onClick={() => onOpen(post)}>
      <PostMedia post={post} className="profile-post-list-image" />
    </button>
    <div className="profile-post-list-body">
      <span>{post.mediaType === "video" ? "Video" : "Post"}</span>
      <strong>{post.caption || "Untitled post"}</strong>
      <p>{new Date(post.createdAt).toLocaleDateString()}</p>
      {isOwner && (
        <button type="button" onClick={() => onToggleGrid(post, !post.onGrid)}>
          {post.onGrid ? "Remove from Grid" : "Post to Grid"}
        </button>
      )}
    </div>
  </article>
)

const EventCard = ({ event, label, onOpen }) => (
  <button type="button" className="profile-tab-event-card" onClick={() => onOpen(event)}>
    <div
      className="profile-tab-event-image"
      style={event.image ? { backgroundImage: `url(${event.image})` } : undefined}
    >
      <span className="profile-tab-event-pill">{label}</span>
    </div>
    <div className="profile-tab-event-body">
      <strong>{event.title || "Untitled Event"}</strong>
      <span>{event.date || event.eventDate || "Campus event"}</span>
    </div>
  </button>
)

const MemoryCard = ({ memory, event }) => (
  <article className="profile-post-tile profile-memory-tile">
    <div className="profile-post-open">
      {memory.mediaType === "video" ? (
        <video className="profile-post-media" src={memory.mediaUrl} muted playsInline preload="metadata" />
      ) : (
        <img className="profile-post-media" src={memory.mediaUrl} alt={memory.caption || "Event memory"} />
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
            isOwner={isOwner}
            onToggleGrid={handleToggleGrid}
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
      <div className="profile-tab-toolbar">
        <div className="profile-mode-switch" role="tablist" aria-label="Post view mode">
          {["grid", "list"].map((mode) => (
            <button
              key={mode}
              type="button"
              className={postViewMode === mode ? "active" : ""}
              onClick={() => setPostViewMode(mode)}
            >
              {mode === "grid" ? "Grid" : "List"}
            </button>
          ))}
        </div>
      </div>
      {authorPosts.length > 0 ? (
        postViewMode === "grid" ? (
          renderPostGrid(authorPosts)
        ) : (
          <div className="profile-post-list">
            {authorPosts.map((post) => (
              <PostListItem
                key={post.id}
                post={post}
                isOwner={isOwner}
                onToggleGrid={handleToggleGrid}
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
      <div className="profile-mixed-list">
        {repostItems.map((item) =>
          item.type === "event" ? (
            <EventCard
              key={item.id}
              event={item.event}
              label="Reposted Event"
              onOpen={setSelectedEvent}
            />
          ) : (
            <PostListItem
              key={item.id}
              post={item.post}
              isOwner={false}
              onToggleGrid={handleToggleGrid}
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
      <div className="profile-tab-toolbar">
        <div className="profile-mode-switch" role="tablist" aria-label="Tagged content filter">
          {TAG_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className={tagFilter === filter.id ? "active" : ""}
              onClick={() => setTagFilter(filter.id)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>
      {filteredTagItems.length > 0 ? (
        <div className="profile-media-grid">
          {filteredTagItems.map((item) =>
            item.type === "post" ? (
              <PostTile
                key={item.id}
                post={item.post}
                isOwner={false}
                onToggleGrid={handleToggleGrid}
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
      <div className="profile-tab-bar" role="tablist" aria-label="Profile tabs">
      <div className="profile-tab-bar" role="tablist" aria-label="Profile tabs" ref={dropdownRef}>
        {PROFILE_TABS.map((tab) => (
          <button
          <div
            key={tab.id}
            type="button"
            className={`profile-tab-btn ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
            onClick={() => {
              setActiveTab(tab.id)
              if (tab.id === "posts" || tab.id === "tags") {
                setActiveDropdown(activeDropdown === tab.id ? null : tab.id)
              } else {
                setActiveDropdown(null)
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setActiveTab(tab.id)
                if (tab.id === "posts" || tab.id === "tags") {
                  setActiveDropdown(activeDropdown === tab.id ? null : tab.id)
                } else {
                  setActiveDropdown(null)
                }
              }
            }}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-label={tab.label}
            title={tab.label}
            tabIndex={0}
            style={{ position: "relative", cursor: "pointer" }}
          >
            <ProfileTabIcon type={tab.id} />
          </button>

            {/* Dropdown for Posts / Camera Icon (Grid/List) */}
            {activeDropdown === tab.id && tab.id === "posts" && (
              <div
                className="absolute top-full mt-2 w-32 bg-[#1c1c1e] border border-[#2c2c2e] rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.5)] overflow-hidden z-50 flex flex-col"
                style={{ left: '50%', transform: 'translateX(-50%)' }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => { setPostViewMode('grid'); setActiveDropdown(null); }}
                  className={`w-full text-left px-4 py-3 text-sm transition-colors ${postViewMode === 'grid' ? 'text-white bg-[#2c2c2e]' : 'text-gray-400 hover:text-white hover:bg-[#2c2c2e]'}`}
                >
                  Grid
                </button>
                <div className="h-[1px] w-full bg-[#2c2c2e]" />
                <button
                  type="button"
                  onClick={() => { setPostViewMode('list'); setActiveDropdown(null); }}
                  className={`w-full text-left px-4 py-3 text-sm transition-colors ${postViewMode === 'list' ? 'text-white bg-[#2c2c2e]' : 'text-gray-400 hover:text-white hover:bg-[#2c2c2e]'}`}
                >
                  List
                </button>
              </div>
            )}

            {/* Dropdown for Tags Icon (All/Posts/Event Tags) */}
            {activeDropdown === tab.id && tab.id === "tags" && (
              <div
                className="absolute top-full right-0 mt-2 w-40 bg-[#1c1c1e] border border-[#2c2c2e] rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.5)] overflow-hidden z-50 flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                {TAG_FILTERS.map((filter, index) => (
                  <div key={filter.id} className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => { setTagFilter(filter.id); setActiveDropdown(null); }}
                      className={`w-full text-left px-4 py-3 text-sm transition-colors ${tagFilter === filter.id ? 'text-white bg-[#2c2c2e]' : 'text-gray-400 hover:text-white hover:bg-[#2c2c2e]'}`}
                    >
                      {filter.label}
                    </button>
                    {index < TAG_FILTERS.length - 1 && <div className="h-[1px] w-full bg-[#2c2c2e]" />}
                  </div>
                ))}
              </div>
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
          <div className="profile-post-modal-card">
            <button type="button" className="profile-post-modal-close" onClick={() => setSelectedPost(null)}>
              ×
            </button>
            <PostMedia post={selectedPost} className="profile-post-modal-media" />
            {selectedPost.caption && <p>{selectedPost.caption}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
