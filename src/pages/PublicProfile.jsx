import React, { useCallback, useEffect, useMemo, useState } from "react"
import { Navigate, useNavigate, useParams } from "react-router-dom"
import { useEvents } from "../context/EventContext"
import { supabase } from "../supabaseClient"
import "./Profile.css"

function PublicProfile() {
  const navigate = useNavigate()
  const { username: viewedUsername } = useParams()
  const { allEvents, followingList, follow, unfollow, currentUser } = useEvents()

  const storedUser = JSON.parse(localStorage.getItem("user") || "{}")
  const defaultAvatar = "/default-avatar.png"
  const ownProfileTokens = [
    storedUser.id,
    storedUser.username,
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
  }, [viewedUsername])

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
      window.prompt("Copy profile link:", profileLink)
      setMenuFeedback("Profile link ready to copy.")
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
          image: person.avatar_url || defaultAvatar,
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
              src={profile.avatar_url || defaultAvatar}
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

        <div className="profile-section public-profile-events-section">
          <div className="profile-section-header">
            <h3>Events by @{profile.username || "user"}</h3>
            <span className="public-profile-section-count">{createdEvents.length}</span>
          </div>

          {createdEvents.length > 0 ? (
            <div className="profile-list">
              {createdEvents.slice(0, 6).map((event) => (
                <div className="profile-list-item" key={event.id}>
                  <div className="profile-event-info">
                    <span className="profile-list-name">
                      {event.title || event.name || "Untitled Event"}
                    </span>
                    <span className="profile-list-meta">
                      {[
                        event.date,
                        event.time || "TBA",
                        event.locationName || event.location || "No location",
                      ].join(" · ")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="profile-empty-state">No public events yet.</p>
          )}
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
