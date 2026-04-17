import React, { useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import SegmentedToggle from "../components/SegmentedToggle"
import DiscoverPostsFeed from "../components/DiscoverPostsFeed"
import DiscoverCreateComposer from "../components/DiscoverCreateComposer"
import { loadDiscoverPosts, uploadDiscoverPost } from "../discoverPosts"
import { useEvents } from "../context/EventContext"
import { useToast } from "../context/ToastContext"

// TODO(db follow-up): when the backend separates videos from image posts
// into distinct tables (e.g. `discover_videos` vs `discover_posts`), replace
// the frontend `mediaType` filter below with targeted queries per view.
const VIDEO_POSTS_VIEWS = [
  { id: "video", label: "Video" },
  { id: "posts", label: "Posts" },
]
const VIEW_IDS = VIDEO_POSTS_VIEWS.map((view) => view.id)

function VideoPosts() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { currentUser } = useEvents()
  const { showToast } = useToast()

  const rawView = searchParams.get("view")
  const activeView = VIEW_IDS.includes(rawView) ? rawView : "video"

  const [posts, setPosts] = useState([])
  const [isComposerOpen, setIsComposerOpen] = useState(false)
  const [composerMode, setComposerMode] = useState("post")

  useEffect(() => {
    let cancelled = false

    loadDiscoverPosts().then((nextPosts) => {
      if (!cancelled) setPosts(nextPosts)
    })

    return () => {
      cancelled = true
    }
  }, [])

  const videoPosts = useMemo(
    () => posts.filter((post) => post.mediaType === "video"),
    [posts]
  )
  const imagePosts = useMemo(
    () => posts.filter((post) => post.mediaType !== "video"),
    [posts]
  )

  const handleChangeView = (nextView) => {
    if (!VIEW_IDS.includes(nextView) || nextView === activeView) return

    const nextParams = new URLSearchParams(searchParams)
    if (nextView === "video") {
      nextParams.delete("view")
    } else {
      nextParams.set("view", nextView)
    }
    setSearchParams(nextParams, { replace: false })
  }

  const handleOpenCreator = (post) => {
    const handle = post?.authorUsername || post?.authorId
    if (!handle) return
    navigate(`/profile/${handle}`)
  }

  const handleOpenComposer = (mode = "post") => {
    setComposerMode(mode)
    setIsComposerOpen(true)
  }

  const handleCloseComposer = () => {
    setIsComposerOpen(false)
  }

  const handleSubmitPost = async ({ file, caption }) => {
    if (!file || !currentUser?.id) {
      showToast("You need to be logged in to post.", "error")
      return
    }

    try {
      await uploadDiscoverPost({
        authorId: currentUser.id,
        file,
        caption,
      })

      const refreshed = await loadDiscoverPosts()
      setPosts(refreshed)
      setIsComposerOpen(false)
      showToast("Posted!", "success")
    } catch (error) {
      showToast(
        error?.message || "Could not publish your post right now. Please try again.",
        "error"
      )
    }
  }

  const handleOpenEventFlow = () => {
    setIsComposerOpen(false)
    navigate("/events?tab=create")
  }

  const visiblePosts = activeView === "video" ? videoPosts : imagePosts

  return (
    <div className="video-posts-page">
      <div className="segmented-toggle-wrap">
        <SegmentedToggle
          options={VIDEO_POSTS_VIEWS}
          value={activeView}
          onChange={handleChangeView}
          ariaLabel="Video or Posts view"
        />
      </div>

      <DiscoverPostsFeed
        posts={visiblePosts}
        onPressCreator={handleOpenCreator}
        onPressCreate={() => handleOpenComposer("post")}
      />

      <DiscoverCreateComposer
        isOpen={isComposerOpen}
        initialMode={composerMode}
        onClose={handleCloseComposer}
        onSubmitPost={handleSubmitPost}
        onSubmitStory={handleSubmitPost}
        onOpenEventFlow={handleOpenEventFlow}
      />
    </div>
  )
}

export default VideoPosts
