import React, { useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import SegmentedToggle from "../components/SegmentedToggle"
import DiscoverPostsFeed from "../components/DiscoverPostsFeed"
import DiscoverCreateComposer from "../components/DiscoverCreateComposer"
import {
  deleteDiscoverPost,
  loadDiscoverPosts,
  uploadDiscoverPost,
} from "../discoverPosts"
import { useEvents } from "../context/EventContext"
import { useToast } from "../context/ToastContext"
import { navigateToProfile } from "../profileNavigation"

// Unified table: videos and image posts stay in discover_posts and split by
// mediaType/metadata in the UI.
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

    loadDiscoverPosts({
      currentUserId: currentUser?.id || "",
      onData: (nextPosts) => {
        if (!cancelled) setPosts(nextPosts)
      },
    }).then((nextPosts) => {
      if (!cancelled) setPosts(nextPosts)
    })

    return () => {
      cancelled = true
    }
  }, [currentUser?.id])

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
    navigateToProfile(
      navigate,
      { id: post?.authorId, username: post?.authorUsername },
      currentUser
    )
  }

  const handleOpenComposer = (mode = "post") => {
    setComposerMode(mode)
    setIsComposerOpen(true)
  }

  const handleCloseComposer = () => {
    setIsComposerOpen(false)
  }

  const handleSubmitPost = async ({ file, caption, onGrid = true }) => {
    if (!file || !currentUser?.id) {
      showToast("You need to be logged in to post.", "error")
      return
    }

    try {
      await uploadDiscoverPost({
        authorId: currentUser.id,
        file,
        caption,
        onGrid,
      })

      const refreshed = await loadDiscoverPosts({
        forceRefresh: true,
        currentUserId: currentUser?.id || "",
      })
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

  const handleDeletePost = async (post) => {
    if (!post?.id) return
    try {
      await deleteDiscoverPost(post.id)
      setPosts((prev) => prev.filter((p) => String(p.id) !== String(post.id)))
      showToast("Post deleted.", "success")
    } catch (error) {
      showToast(
        error?.message || "Could not delete this post right now. Please try again.",
        "error"
      )
    }
  }

  const handleOpenEventFlow = () => {
    setIsComposerOpen(false)
    navigate("/events?create=event")
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
        currentUserId={currentUser?.id || ""}
        onDeletePost={handleDeletePost}
        onPressCreator={handleOpenCreator}
        onPressCreate={() => handleOpenComposer("post")}
        onPostLikeToggled={(postId, liked, likeCount) => {
          setPosts((prev) =>
            prev.map((p) =>
              String(p.id) === postId
                ? { ...p, isLikedByCurrentUser: liked, likeCount }
                : p
            )
          )
        }}
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
