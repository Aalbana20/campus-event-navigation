import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useEvents } from "../context/EventContext"
import { DEFAULT_AVATAR_URL, sanitizeAvatarUrl } from "../profileMedia"
import { supabase } from "../supabaseClient"
import {
  createRecapPost,
  loadRecapPostsForEvent,
} from "../recaps"
import "./Recaps.css"

const MAX_RECAP_IMAGES = 4

function RecapMediaItem({ item }) {
  if (item.mediaType === "video") {
    return (
      <video
        className="recap-carousel-media"
        src={item.url}
        controls
        playsInline
        preload="metadata"
      />
    )
  }

  return <img className="recap-carousel-media" src={item.url} alt="" loading="lazy" decoding="async" />
}

function RecapMediaCarousel({ media }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const visibleMedia = media.slice(0, MAX_RECAP_IMAGES)
  if (visibleMedia.length === 0) return null

  const goToIndex = (index) => {
    setActiveIndex(Math.max(0, Math.min(index, visibleMedia.length - 1)))
  }

  return (
    <div className="recap-carousel" aria-label="Recap media carousel">
      <div
        className="recap-carousel-track"
        style={{ transform: `translateX(-${activeIndex * 100}%)` }}
      >
        {visibleMedia.map((item) => (
          <div className="recap-carousel-slide" key={item.id}>
            <RecapMediaItem item={item} />
          </div>
        ))}
      </div>

      {visibleMedia.length > 1 ? (
        <>
          <div className="recap-media-count">{activeIndex + 1}/{visibleMedia.length}</div>
          <button
            type="button"
            className="recap-carousel-nav prev"
            aria-label="Previous media"
            onClick={() => goToIndex(activeIndex - 1)}
            disabled={activeIndex === 0}
          >
            ‹
          </button>
          <button
            type="button"
            className="recap-carousel-nav next"
            aria-label="Next media"
            onClick={() => goToIndex(activeIndex + 1)}
            disabled={activeIndex === visibleMedia.length - 1}
          >
            ›
          </button>
          <div className="recap-carousel-dots" aria-hidden="true">
            {visibleMedia.map((item, index) => (
              <button
                key={`${item.id}-dot`}
                type="button"
                className={index === activeIndex ? "active" : ""}
                onClick={() => goToIndex(index)}
                aria-label={`Show media ${index + 1}`}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}

function RecapComposer({
  draftText,
  files,
  isPosting,
  onClose,
  onDraftText,
  onFiles,
  onRemoveFile,
  onSubmit,
}) {
  const previews = useMemo(
    () => files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [files]
  )

  useEffect(
    () => () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview.url))
    },
    [previews]
  )

  return (
    <div className="recap-composer-overlay" onMouseDown={onClose}>
      <form
        className="recap-composer-panel"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        <div className="recap-composer-header">
          <button type="button" onClick={onClose}>Cancel</button>
          <h2>Add Recap</h2>
          <button type="submit" disabled={isPosting}>
            {isPosting ? "Posting" : "Post"}
          </button>
        </div>

        <textarea
          value={draftText}
          onChange={(event) => onDraftText(event.target.value)}
          placeholder="What happened at the event?"
          rows={5}
        />

        {files.length > 0 ? (
          <div className="recap-selected-images">
            {previews.map((preview, index) => (
              <div key={`${preview.file.name}-${index}`} className="recap-selected-image">
                <img src={preview.url} alt="" />
                <button type="button" onClick={() => onRemoveFile(index)} aria-label="Remove image">
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <label className="recap-add-images-btn">
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => {
              const nextFiles = Array.from(event.target.files || []).slice(0, MAX_RECAP_IMAGES)
              onFiles(nextFiles)
              event.target.value = ""
            }}
          />
          <span>Add images</span>
          <em>{files.length}/{MAX_RECAP_IMAGES}</em>
        </label>
      </form>
    </div>
  )
}

export default function RecapDetail() {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const {
    allEvents,
    currentUser,
    followingList,
    currentUserAttendedEvent,
  } = useEvents()
  const [activeTab, setActiveTab] = useState("all")
  const [recapPosts, setRecapPosts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [canPostRecap, setCanPostRecap] = useState(false)
  const [composerOpen, setComposerOpen] = useState(false)
  const [draftText, setDraftText] = useState("")
  const [selectedFiles, setSelectedFiles] = useState([])
  const [isPosting, setIsPosting] = useState(false)
  const [likedMemoryIds, setLikedMemoryIds] = useState(new Set())
  const [repostedIds, setRepostedIds] = useState(new Set())
  const [savedIds, setSavedIds] = useState(new Set())

  const event = useMemo(
    () => (allEvents || []).find((item) => String(item.id) === String(eventId)),
    [allEvents, eventId]
  )

  const followingIds = useMemo(
    () => new Set((followingList || []).map((profile) => String(profile.id))),
    [followingList]
  )

  const posts = useMemo(
    () =>
      [...recapPosts].sort(
        (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      ),
    [recapPosts]
  )

  const visiblePosts = useMemo(
    () => activeTab === "following"
      ? posts.filter((post) => followingIds.has(String(post.authorId)))
      : posts,
    [activeTab, followingIds, posts]
  )

  const refreshRecaps = useCallback(async () => {
    if (!eventId) return
    setIsLoading(true)

    const [nextPosts, eligible] = await Promise.all([
      loadRecapPostsForEvent(eventId),
      currentUserAttendedEvent(eventId),
    ])

    setRecapPosts(nextPosts)
    setCanPostRecap(Boolean(eligible || event?.createdBy === currentUser?.id))
    setIsLoading(false)
  }, [currentUser?.id, currentUserAttendedEvent, event?.createdBy, eventId])

  useEffect(() => {
    refreshRecaps()

    if (!eventId) return undefined
    const postsChannel = supabase
      .channel(`web-recaps-posts-${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "recap_posts", filter: `event_id=eq.${eventId}` },
        () => refreshRecaps()
      )
      .subscribe()

    const mediaChannel = supabase
      .channel(`web-recaps-media-${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "recap_media" },
        () => refreshRecaps()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(postsChannel)
      supabase.removeChannel(mediaChannel)
    }
  }, [eventId, refreshRecaps])

  const resetComposer = () => {
    setDraftText("")
    setSelectedFiles([])
    setComposerOpen(false)
  }

  const handleOpenComposer = () => {
    if (!canPostRecap) {
      window.alert("Recaps are limited to people who attended or RSVP'd to this event.")
      return
    }
    setComposerOpen(true)
  }

  const handlePostRecap = async () => {
    const body = draftText.trim()
    const userId = currentUser?.id && currentUser.id !== "current-user" ? currentUser.id : null
    if (!event?.id || !userId || isPosting) return
    if (!body && selectedFiles.length === 0) {
      window.alert("Write something or add at least one image.")
      return
    }

    setIsPosting(true)
    try {
      await createRecapPost({
        eventId: event.id,
        userId,
        body,
        files: selectedFiles,
      })
      await refreshRecaps()
      resetComposer()
    } catch (error) {
      window.alert(error?.message || "Could not post this recap right now.")
    } finally {
      setIsPosting(false)
    }
  }

  const handleToggleLike = async (post) => {
    setLikedMemoryIds((current) => {
      const next = new Set(current)
      if (next.has(post.id)) next.delete(post.id)
      else next.add(post.id)
      return next
    })
  }

  const toggleLocalSet = (setter, id) => {
    setter((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (!event && !isLoading) {
    return (
      <main className="recaps-page">
        <section className="recaps-shell">
          <div className="recaps-empty-detail">
            <h1>Event not found.</h1>
            <button type="button" onClick={() => navigate("/recaps")}>Back to Recaps</button>
          </div>
        </section>
      </main>
    )
  }

  const hostAvatar = sanitizeAvatarUrl(event?.creatorAvatar, DEFAULT_AVATAR_URL)
  const hostName = event?.host || event?.organizer || event?.creatorName || "Campus Host"

  return (
    <main className="recaps-page">
      <section className="recap-feed-shell">
        <header className="recap-feed-header">
          <button type="button" className="recaps-back-btn" onClick={() => navigate("/recaps")}>
            ‹
          </button>
          <h1>{event?.title || "Recap"}</h1>
          <div className="recaps-back-spacer" />
        </header>

        <button
          type="button"
          className="recap-host-card"
          onClick={() => window.alert("Host and event rating will live here in the next Recaps pass.")}
        >
          <img src={hostAvatar} alt="" />
          <span>
            <em>Host</em>
            <strong>{hostName}</strong>
          </span>
          <b>☆</b>
        </button>

        <div className="recap-feed-tabs" role="tablist" aria-label="Recap feed filters">
          {[
            { id: "all", label: "All" },
            { id: "following", label: "Following" },
          ].map((tab) => (
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

        <div className="recap-post-list">
          {isLoading ? (
            <div className="recaps-loading">Loading recaps...</div>
          ) : visiblePosts.length > 0 ? (
            visiblePosts.map((post) => {
              const isLiked = likedMemoryIds.has(post.id)
              return (
                <article key={post.id} className="recap-post">
                  <div className="recap-post-header">
                    <button type="button" className="recap-author-button" onClick={() => navigate(`/profile/${post.authorUsername || post.authorId}`)}>
                      <img
                        className="recap-post-avatar"
                        src={sanitizeAvatarUrl(post.authorAvatar, DEFAULT_AVATAR_URL)}
                        alt=""
                      />
                    </button>
                    <div className="recap-post-title-stack">
                      <strong>{post.authorName || post.authorUsername || "Campus User"}</strong>
                      <button type="button" onClick={() => navigate(`/recaps/${event?.id || post.eventId}`)}>
                        {event?.title || "Event recap"}
                      </button>
                    </div>
                    <button
                      type="button"
                      className="recap-event-thumb"
                      aria-label={`Open ${event?.title || "event"} recap`}
                      onClick={() => navigate(`/recaps/${event?.id || post.eventId}`)}
                    >
                      <img src={event?.image || ""} alt="" />
                    </button>
                  </div>

                  <div className="recap-post-body">
                    <RecapMediaCarousel media={post.media} />
                    {post.caption ? (
                      <p className="recap-post-caption">
                        <strong>{post.authorName || post.authorUsername || "Campus"}: </strong>
                        {post.caption}
                      </p>
                    ) : null}
                    <div className="recap-action-row">
                      <button
                        type="button"
                        className={isLiked ? "active" : ""}
                        onClick={() => handleToggleLike(post)}
                      >
                        {isLiked ? "♥" : "♡"}
                      </button>
                      <button type="button" onClick={() => window.alert("Recap comments are next.")}>
                        ◌
                      </button>
                      <button
                        type="button"
                        className={repostedIds.has(post.id) ? "active" : ""}
                        onClick={() => toggleLocalSet(setRepostedIds, post.id)}
                      >
                        ↻
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          navigator.share
                            ? navigator.share({ text: `${post.authorName} posted a recap from ${event?.title}.` })
                            : navigator.clipboard?.writeText(window.location.href)
                        }
                      >
                        ⇧
                      </button>
                      <button
                        type="button"
                        className={savedIds.has(post.id) ? "active" : ""}
                        onClick={() => toggleLocalSet(setSavedIds, post.id)}
                      >
                        {savedIds.has(post.id) ? "▰" : "▱"}
                      </button>
                    </div>
                  </div>
                </article>
              )
            })
          ) : (
            <div className="recaps-empty-detail">
              <h2>No recaps yet</h2>
              <p>Be the first to add a recap from this event.</p>
            </div>
          )}
        </div>

        <button type="button" className="web-add-recap-btn" onClick={handleOpenComposer}>
          + Add Recap
        </button>
      </section>

      {composerOpen ? (
        <RecapComposer
          draftText={draftText}
          files={selectedFiles}
          isPosting={isPosting}
          onClose={resetComposer}
          onDraftText={setDraftText}
          onFiles={(files) => setSelectedFiles(files.slice(0, MAX_RECAP_IMAGES))}
          onRemoveFile={(index) =>
            setSelectedFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))
          }
          onSubmit={handlePostRecap}
        />
      ) : null}
    </main>
  )
}
