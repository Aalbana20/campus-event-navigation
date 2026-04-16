import React, { useCallback, useEffect, useMemo, useState } from "react"
import { Navigate, useNavigate, useParams } from "react-router-dom"
import { useEvents } from "../context/EventContext"
import { DEFAULT_AVATAR_URL, sanitizeAvatarUrl } from "../profileMedia"
import { loadDiscoverPostsForAuthor } from "../discoverPosts"
import { supabase } from "../supabaseClient"
import "./Profile.css"

function PublicProfileTabIcon({ type }) {
  if (type === "posts") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="2.2" />
        <circle cx="12" cy="12" r="3.2" />
        <path d="M8 5l1.5-2h5L16 5" />
      </svg>
    )
  }

  if (type === "reposts") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4.75 8H14.5" />
        <path d="M12.25 5.5L15.75 8L12.25 10.5" />
        <path d="M18 8V9.25C18 11.873 15.873 14 13.25 14H5.75" />
        <path d="M19.25 16H9.5" />
        <path d="M11.75 13.5L8.25 16L11.75 18.5" />
        <path d="M6 16V14.75C6 12.127 8.127 10 10.75 10H18.25" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15" rx="2.2" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
      <path d="M3.5 10h17" />
    </svg>
  )
}

function PublicProfile() {
  const navigate = useNavigate()
  const { username: viewedUsername } = useParams()
  const { allEvents, followingList, follow, unfollow, currentUser } = useEvents()

  const defaultAvatar = DEFAULT_AVATAR_URL
  const ownProfileTokens = [
    currentUser?.id,
    currentUser?.username,
  ]
    .filter(Boolean)
    .map((value) => String(value))
  const isOwnProfileRoute = ownProfileTokens.includes(String(viewedUsername || ""))

  const [profile, setProfile] = useState(null)
  const [profileCounts, setProfileCounts] = useState({
    followers: 0,
    following: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isFollowBusy, setIsFollowBusy] = useState(false)
  const [followOverride, setFollowOverride] = useState(null)
  const [activePanel, setActivePanel] = useState(null)
  const [followersUsers, setFollowersUsers] = useState([])
  const [followingUsers, setFollowingUsers] = useState([])
  const [isPanelLoading, setIsPanelLoading] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuFeedback, setMenuFeedback] = useState("")
  const [activeTab, setActiveTab] = useState("posts")
  const [profilePosts, setProfilePosts] = useState([])
  const [profileReposts, setProfileReposts] = useState([])
  const [isLoadingTabContent, setIsLoadingTabContent] = useState(false)

  const loadCounts = useCallback(async (profileId) => {
    if (!profileId) {
      const emptyCounts = { followers: 0, following: 0 }
      setProfileCounts(emptyCounts)
      return emptyCounts
    }

    const [followersResult, followingResult] = await Promise.all([
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", profileId),
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", profileId),
    ])

    const nextCounts = {
      followers: followersResult.count || 0,
      following: followingResult.count || 0,
    }

    setProfileCounts(nextCounts)
    return nextCounts
  }, [])

  const loadPublicProfile = useCallback(async () => {
    if (!viewedUsername || isOwnProfileRoute) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)

    const isUUID = /^[0-9a-f-]{36}$/i.test(String(viewedUsername))
    const baseQuery = supabase
      .from("profiles")
      .select("id, name, username, bio, avatar_url")

    const { data, error } = await (isUUID
      ? baseQuery.eq("id", viewedUsername)
      : baseQuery.eq("username", viewedUsername)).single()

    if (error || !data) {
      setProfile(null)
      setProfileCounts({ followers: 0, following: 0 })
      setIsLoading(false)
      return
    }

    setProfile(data)
    await loadCounts(data.id)
    setIsLoading(false)
  }, [isOwnProfileRoute, loadCounts, viewedUsername])

  useEffect(() => {
    setFollowOverride(null)
    setActivePanel(null)
    setFollowersUsers([])
    setFollowingUsers([])
    setMenuOpen(false)
    setMenuFeedback("")
    setActiveTab("posts")
    setProfilePosts([])
    setProfileReposts([])
  }, [viewedUsername])

  useEffect(() => {
    if (!profile?.id) return

    let cancelled = false

    const loadTabContent = async () => {
      setIsLoadingTabContent(true)

      const [posts, { data: repostRows }] = await Promise.all([
        loadDiscoverPostsForAuthor(profile.id),
        supabase
          .from("reposts")
          .select("event_id, created_at")
          .eq("user_id", profile.id)
          .order("created_at", { ascending: false }),
      ])

      if (cancelled) return

      setProfilePosts(posts || [])

      const repostedIds = new Set(
        (repostRows || []).map((row) => String(row.event_id))
      )
      const repostedEvents = (allEvents || []).filter((event) =>
        repostedIds.has(String(event.id))
      )
      setProfileReposts(repostedEvents)
      setIsLoadingTabContent(false)
    }

    loadTabContent()

    return () => {
      cancelled = true
    }
  }, [allEvents, profile?.id])

  useEffect(() => {
    loadPublicProfile()
  }, [loadPublicProfile])

  useEffect(() => {
    if (!menuFeedback) return undefined

    const timeoutId = window.setTimeout(() => {
      setMenuFeedback("")
    }, 2600)

    return () => window.clearTimeout(timeoutId)
  }, [menuFeedback])

  const createdEvents = useMemo(() => {
    if (!profile) return []

    return (allEvents || []).filter(
      (event) =>
        String(event.createdBy) === String(profile.id) ||
        String(event.created_by) === String(profile.id) ||
        event.createdBy === profile.username ||
        event.creatorUsername === profile.username
    )
  }, [allEvents, profile])

  const derivedIsFollowing = useMemo(() => {
    if (!profile) return false

    return followingList.some(
      (person) =>
        String(person.id) === String(profile.id) ||
        (person.username && person.username === profile.username)
    )
  }, [followingList, profile])

  const isFollowingProfile =
    followOverride === null ? derivedIsFollowing : followOverride

  const handleToggleFollow = async () => {
    if (!profile?.id || isFollowBusy) return

    const nextIsFollowing = !isFollowingProfile

    setIsFollowBusy(true)
    setFollowOverride(nextIsFollowing)
    setProfileCounts((prev) => ({
      ...prev,
      followers: Math.max(prev.followers + (nextIsFollowing ? 1 : -1), 0),
    }))

    try {
      if (nextIsFollowing) {
        await follow(profile.id)
      } else {
        await unfollow(profile.id)
      }

      await loadCounts(profile.id)
    } finally {
      setIsFollowBusy(false)
      setFollowOverride(null)
    }
  }

  const handleMessage = () => {
    if (!profile?.id) return
    navigate(`/messages?thread=${profile.id}`)
  }

  const closeMenu = () => {
    setMenuOpen(false)
  }

  const copyProfileLink = async () => {
    if (!profile) return

    const profileLink = `${window.location.origin}/#/profile/${profile.username || profile.id}`

    try {
      await navigator.clipboard.writeText(profileLink)
      setMenuFeedback("Profile link copied.")
    } catch {
      setMenuFeedback("Could not copy link.")
    }

    closeMenu()
  }

  const handleCopyProfile = async () => {
    await copyProfileLink()
  }

  const handleShareProfile = async () => {
    if (!profile) return

    const profileLink = `${window.location.origin}/#/profile/${profile.username || profile.id}`
    const profileDisplayName =
      profile.name || (profile.username ? `@${profile.username}` : "this profile")

    if (!navigator.share) {
      await copyProfileLink()
      return
    }

    try {
      await navigator.share({
        title: profile.name || profile.username || "Campus Event profile",
        text: `Check out ${profileDisplayName} on Campus Event Navigation.`,
        url: profileLink,
      })
      setMenuFeedback("Profile shared.")
      closeMenu()
    } catch (error) {
      if (error?.name === "AbortError") {
        closeMenu()
        return
      }

      await copyProfileLink()
    }
  }

  const handleReportProfile = () => {
    setMenuFeedback("Report received. We'll take a look.")
    closeMenu()
  }

  const handleBlockProfile = () => {
    setMenuFeedback("Block tools are not connected yet.")
    closeMenu()
  }

  const loadPanelUsers = useCallback(async (panelType) => {
    if (!profile?.id) return

    setIsPanelLoading(true)

    const isFollowersPanel = panelType === "followers"
    const columnName = isFollowersPanel ? "follower_id" : "following_id"

    const { data: relationRows, error: relationError } = await supabase
      .from("follows")
      .select(columnName)
      .eq(isFollowersPanel ? "following_id" : "follower_id", profile.id)

    if (relationError) {
      if (isFollowersPanel) {
        setFollowersUsers([])
      } else {
        setFollowingUsers([])
      }
      setIsPanelLoading(false)
      return
    }

    const userIds = (relationRows || []).map((row) => row[columnName]).filter(Boolean)

    if (userIds.length === 0) {
      if (isFollowersPanel) {
        setFollowersUsers([])
      } else {
        setFollowingUsers([])
      }
      setIsPanelLoading(false)
      return
    }

    const { data: profilesData, error: profilesError } = await supabase
      .from("profiles")
      .select("id, name, username, avatar_url")
      .in("id", userIds)

    if (profilesError || !profilesData) {
      if (isFollowersPanel) {
        setFollowersUsers([])
      } else {
        setFollowingUsers([])
      }
      setIsPanelLoading(false)
      return
    }

    const userMap = new Map(
      profilesData.map((person) => [
        String(person.id),
        {
          id: person.id,
          name: person.name || person.username || "User",
          username: person.username || "",
          image: sanitizeAvatarUrl(person.avatar_url, defaultAvatar),
        },
      ])
    )

    const orderedUsers = userIds
      .map((id) => userMap.get(String(id)))
      .filter(Boolean)

    if (isFollowersPanel) {
      setFollowersUsers(orderedUsers)
    } else {
      setFollowingUsers(orderedUsers)
    }

    setIsPanelLoading(false)
  }, [defaultAvatar, profile?.id])

  const openPanel = async (panelType) => {
    closeMenu()
    setActivePanel(panelType)
    await loadPanelUsers(panelType)
  }

  const closePanel = () => {
    setActivePanel(null)
  }

  const handleNavigateToUser = (person) => {
    closePanel()
    navigate(`/profile/${person.username || person.id}`)
  }

  const activePanelUsers =
    activePanel === "followers" ? followersUsers : followingUsers

  if (isOwnProfileRoute) {
    return <Navigate to="/profile" replace />
  }

  if (isLoading) {
    return (
      <main className="profile-page">
        <div className="profile-card">
          <p className="profile-empty-state">Loading profile...</p>
        </div>
      </main>
    )
  }

  if (!profile) {
    return (
      <main className="profile-page">
        <div className="profile-card">
          <p className="profile-empty-state">User not found.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="profile-page">
      <div className="profile-card public-profile-card">
        <div className="profile-header">
          <div className="profile-avatar-wrap">
            <img
              className="profile-avatar"
              src={sanitizeAvatarUrl(profile.avatar_url, defaultAvatar)}
              alt={profile.name || profile.username || "Profile"}
              onError={(event) => {
                event.currentTarget.src = defaultAvatar
              }}
            />
          </div>

          <div className="profile-info">
            <div className="public-profile-heading-row">
              <div className="public-profile-name-stack">
                <h1 className="username">@{profile.username || "user"}</h1>
                <h2 className="real-name">{profile.name || profile.username || "Unknown user"}</h2>
              </div>

              <button
                type="button"
                className="profile-menu-btn"
                onClick={() => setMenuOpen(true)}
                aria-label="Open profile actions"
              >
                <span />
                <span />
                <span />
              </button>
            </div>

            <p className="bio">{profile.bio || "No bio yet."}</p>

            <div className="profile-stats">
              <div className="profile-stat-card public-profile-stat-card static">
                <span className="profile-stat-number">{createdEvents.length}</span>
                <span className="profile-stat-label">Events Created</span>
              </div>

              <button
                type="button"
                className="profile-stat-card public-profile-stat-card is-clickable"
                onClick={() => openPanel("followers")}
              >
                <span className="profile-stat-number">{profileCounts.followers}</span>
                <span className="profile-stat-label">Followers</span>
              </button>

              <button
                type="button"
                className="profile-stat-card public-profile-stat-card is-clickable"
                onClick={() => openPanel("following")}
              >
                <span className="profile-stat-number">{profileCounts.following}</span>
                <span className="profile-stat-label">Following</span>
              </button>
            </div>

            <div className="profile-action-row public-profile-action-row">
              <button
                type="button"
                className={`profile-action-btn public-profile-btn ${isFollowingProfile ? "secondary" : ""}`}
                onClick={handleToggleFollow}
                disabled={isFollowBusy}
              >
                {isFollowBusy ? "Working..." : isFollowingProfile ? "Unfollow" : "Follow"}
              </button>

              <button
                type="button"
                className="profile-action-btn secondary public-profile-btn"
                onClick={handleMessage}
                disabled={!profile.id}
              >
                Message
              </button>
            </div>

            {menuFeedback ? (
              <p className="public-profile-feedback">{menuFeedback}</p>
            ) : null}
          </div>
        </div>

        <div className="profile-section profile-tabbed-section public-profile-tabbed-section">
          <div className="profile-tab-bar" role="tablist" aria-label="Profile tabs">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "posts"}
              aria-label="Posts"
              className={`profile-tab-btn ${activeTab === "posts" ? "active" : ""}`}
              onClick={() => setActiveTab("posts")}
            >
              <PublicProfileTabIcon type="posts" />
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "reposts"}
              aria-label="Reposts"
              className={`profile-tab-btn ${activeTab === "reposts" ? "active" : ""}`}
              onClick={() => setActiveTab("reposts")}
            >
              <PublicProfileTabIcon type="reposts" />
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "events"}
              aria-label="Events"
              className={`profile-tab-btn ${activeTab === "events" ? "active" : ""}`}
              onClick={() => setActiveTab("events")}
            >
              <PublicProfileTabIcon type="events" />
            </button>
          </div>

          <div className="profile-tab-panel">
            {activeTab === "posts" && (
              isLoadingTabContent ? (
                <p className="profile-empty-state">Loading posts...</p>
              ) : profilePosts.length > 0 ? (
                <div className="profile-tab-event-grid">
                  {profilePosts.map((post) => (
                    <div className="profile-tab-event-card static" key={post.id}>
                      <div
                        className="profile-tab-event-image"
                        style={{
                          backgroundImage:
                            post.mediaType === "image" && post.mediaUrl
                              ? `linear-gradient(180deg, rgba(15,23,42,0.05), rgba(15,23,42,0.55)), url(${post.mediaUrl})`
                              : "linear-gradient(180deg, rgba(15,23,42,0.08), rgba(15,23,42,0.72))",
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                          position: "relative",
                        }}
                      >
                        {post.mediaType === "video" && post.mediaUrl ? (
                          <video
                            src={post.mediaUrl}
                            muted
                            playsInline
                            preload="metadata"
                            style={{
                              position: "absolute",
                              inset: 0,
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                          />
                        ) : null}
                        <span className="profile-tab-event-pill">
                          {post.mediaType === "video" ? "Video" : "Photo"}
                        </span>
                      </div>

                      <div className="profile-tab-event-body">
                        <strong>
                          {post.caption || (post.mediaType === "video" ? "New video" : "New photo")}
                        </strong>
                        <span>
                          {new Date(post.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="profile-tab-empty-state">
                  <h3>No posts yet.</h3>
                  <p>@{profile.username || "user"} hasn't shared any posts.</p>
                </div>
              )
            )}

            {activeTab === "reposts" && (
              isLoadingTabContent ? (
                <p className="profile-empty-state">Loading reposts...</p>
              ) : profileReposts.length > 0 ? (
                <div className="profile-tab-event-grid">
                  {profileReposts.map((event) => (
                    <div className="profile-tab-event-card static" key={event.id}>
                      <div
                        className="profile-tab-event-image"
                        style={{
                          backgroundImage: event.image
                            ? `linear-gradient(180deg, rgba(15,23,42,0.05), rgba(15,23,42,0.55)), url(${event.image})`
                            : "linear-gradient(180deg, rgba(15,23,42,0.08), rgba(15,23,42,0.72))",
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }}
                      >
                        <span className="profile-tab-event-pill">Reposted</span>
                      </div>

                      <div className="profile-tab-event-body">
                        <strong>{event.title || event.name || "Untitled Event"}</strong>
                        <span>
                          {[event.date, event.time || "TBA"].filter(Boolean).join(" · ")}
                        </span>
                        <span>{event.locationName || event.location || "No location"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="profile-tab-empty-state">
                  <h3>No reposts yet.</h3>
                  <p>Events @{profile.username || "user"} reposts will show up here.</p>
                </div>
              )
            )}

            {activeTab === "events" && (
              createdEvents.length > 0 ? (
                <div className="profile-tab-event-grid">
                  {createdEvents.map((event) => (
                    <div className="profile-tab-event-card static" key={event.id}>
                      <div
                        className="profile-tab-event-image"
                        style={{
                          backgroundImage: event.image
                            ? `linear-gradient(180deg, rgba(15,23,42,0.05), rgba(15,23,42,0.55)), url(${event.image})`
                            : "linear-gradient(180deg, rgba(15,23,42,0.08), rgba(15,23,42,0.72))",
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }}
                      >
                        <span className="profile-tab-event-pill">Created</span>
                      </div>

                      <div className="profile-tab-event-body">
                        <strong>{event.title || event.name || "Untitled Event"}</strong>
                        <span>
                          {[event.date, event.time || "TBA"].filter(Boolean).join(" · ")}
                        </span>
                        <span>{event.locationName || event.location || "No location"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="profile-tab-empty-state">
                  <h3>No public events yet.</h3>
                  <p>Events @{profile.username || "user"} creates will appear here.</p>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {activePanel && (
        <div className="profile-overlay" onClick={closePanel}>
          <div className="profile-modal" onClick={(event) => event.stopPropagation()}>
            <div className="profile-modal-header">
              <h3>{activePanel === "followers" ? "Followers" : "Following"}</h3>
              <button
                type="button"
                className="profile-modal-close"
                onClick={closePanel}
                aria-label="Close profile list"
              >
                ×
              </button>
            </div>

            <div className="profile-modal-body">
              {isPanelLoading ? (
                <p className="profile-empty-state">Loading...</p>
              ) : activePanelUsers.length > 0 ? (
                <div className="profile-list">
                  {activePanelUsers.map((person) => (
                    <div className="profile-list-item public-profile-list-item" key={person.id}>
                      <button
                        type="button"
                        className="profile-list-identity-btn"
                        onClick={() => handleNavigateToUser(person)}
                      >
                        <img
                          className="profile-list-avatar"
                          src={person.image || defaultAvatar}
                          alt={person.name || person.username || "User"}
                          onError={(event) => {
                            event.currentTarget.src = defaultAvatar
                          }}
                        />
                        <span className="profile-list-name">
                          {person.name || person.username || "Unknown user"}
                        </span>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="profile-empty-state">
                  {activePanel === "followers"
                    ? "No followers yet."
                    : "Not following anyone yet."}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {menuOpen && (
        <div className="menu-overlay" onClick={closeMenu}>
          <div className="menu-modal" onClick={(event) => event.stopPropagation()}>
            <div className="menu-actions">
              <button
                type="button"
                className="menu-action-btn danger"
                onClick={handleReportProfile}
              >
                Report
              </button>

              <button
                type="button"
                className="menu-action-btn danger"
                onClick={handleBlockProfile}
              >
                Block
              </button>

              <button
                type="button"
                className="menu-action-btn"
                onClick={handleCopyProfile}
              >
                Copy Profile Link
              </button>

              <button
                type="button"
                className="menu-action-btn"
                onClick={handleShareProfile}
              >
                Share Profile
              </button>

              <button
                type="button"
                className="menu-action-btn cancel"
                onClick={closeMenu}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default PublicProfile
