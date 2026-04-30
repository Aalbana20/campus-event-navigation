import React, { useCallback, useEffect, useMemo, useState } from "react"
import {
  Activity,
  Ban,
  Bell,
  CalendarDays,
  ChevronLeft,
  EyeOff,
  Flag,
  Info,
  Link as LinkIcon,
  MessageCircle,
  MoreHorizontal,
  Share2,
  UserMinus,
  Video,
  Volume2,
  VolumeX,
  X,
} from "lucide-react"
import { Navigate, useNavigate, useParams } from "react-router-dom"
import { useEvents } from "../context/EventContext"
import { DEFAULT_AVATAR_URL, sanitizeAvatarUrl } from "../profileMedia"
import ProfileContentTabs from "../components/ProfileContentTabs"
import { supabase } from "../supabaseClient"
import "./Profile.css"

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
  const [profileContentCounts, setProfileContentCounts] = useState({ posts: 0 })
  const [mutualFollowers, setMutualFollowers] = useState([])
  const [mutualFollowerCount, setMutualFollowerCount] = useState(0)
  const [mutualFollowerIds, setMutualFollowerIds] = useState([])
  const [isMutualsListOpen, setIsMutualsListOpen] = useState(false)
  const [mutualsListUsers, setMutualsListUsers] = useState([])
  const [isMutualsListLoading, setIsMutualsListLoading] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isBlocked, setIsBlocked] = useState(false)
  const [notificationMenuOpen, setNotificationMenuOpen] = useState(false)
  const [activeProfileSheet, setActiveProfileSheet] = useState(null)
  const [reportStep, setReportStep] = useState("topic")

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
      .select("id, name, username, bio, avatar_url, student_verified, verification_status, account_type")

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

  const loadMutualFollowers = useCallback(async (profileId) => {
    const { data: authData } = await supabase.auth.getUser()
    const currentUserId = currentUser?.id || authData?.user?.id

    if (!profileId || !currentUserId || String(profileId) === String(currentUserId)) {
      setMutualFollowers([])
      setMutualFollowerCount(0)
      setMutualFollowerIds([])
      return
    }

    // Step 1: pull current user's following IDs directly. Don't rely on EventContext
    // ordering — query Supabase so this works even on a cold load.
    const { data: myFollowingRows, error: myFollowingError } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", currentUserId)

    if (myFollowingError) {
      console.error("[mutuals] my-following query failed:", myFollowingError)
      setMutualFollowers([])
      setMutualFollowerCount(0)
      setMutualFollowerIds([])
      return
    }

    const followingIds = (myFollowingRows || [])
      .map((row) => String(row.following_id || ""))
      .filter(Boolean)

    if (followingIds.length === 0) {
      if (typeof window !== "undefined" && import.meta.env?.DEV) {
        console.debug("[mutuals:web] PublicProfile", {
          currentUserId,
          viewedProfileId: profileId,
          followingIdsCount: 0,
          targetFollowerIdsCount: 0,
          mutualIdsCount: 0,
          mutualProfilesCount: 0,
        })
      }
      setMutualFollowers([])
      setMutualFollowerCount(0)
      setMutualFollowerIds([])
      return
    }

    // Step 2: pull the target's followers directly and intersect in JS.
    // This avoids relying on a cached context list and makes the debug counts honest.
    const { data: relationRows, error: relationError } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("following_id", profileId)

    if (relationError) {
      console.error("[mutuals] target-followers query failed:", relationError)
      setMutualFollowers([])
      setMutualFollowerCount(0)
      setMutualFollowerIds([])
      return
    }

    const followingIdSet = new Set(followingIds)
    const targetFollowerIds = (relationRows || [])
      .map((row) => String(row.follower_id || ""))
      .filter(Boolean)
    const mutualIds = (relationRows || [])
      .map((row) => String(row.follower_id || ""))
      .filter((id) => id && followingIdSet.has(id))

    setMutualFollowerCount(mutualIds.length)
    setMutualFollowerIds(mutualIds)

    if (mutualIds.length === 0) {
      setMutualFollowers([])
      if (typeof window !== "undefined" && import.meta.env?.DEV) {
        console.debug("[mutuals:web] PublicProfile", {
          currentUserId,
          viewedProfileId: profileId,
          followingIdsCount: followingIds.length,
          targetFollowerIdsCount: targetFollowerIds.length,
          mutualIdsCount: 0,
          mutualProfilesCount: 0,
        })
      }
      return
    }

    const { data: profilesData, error: profilesError } = await supabase
      .from("profiles")
      .select("id, name, username, avatar_url")
      .in("id", mutualIds.slice(0, 3))

    if (profilesError || !profilesData) {
      console.error("[mutuals] preview profiles query failed:", profilesError)
      setMutualFollowers([])
      if (typeof window !== "undefined" && import.meta.env?.DEV) {
        console.debug("[mutuals:web] PublicProfile", {
          currentUserId,
          viewedProfileId: profileId,
          followingIdsCount: followingIds.length,
          targetFollowerIdsCount: targetFollowerIds.length,
          mutualIdsCount: mutualIds.length,
          mutualProfilesCount: 0,
        })
      }
      return
    }

    const profileMap = new Map(
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

    setMutualFollowers(
      mutualIds
        .slice(0, 3)
        .map((id) => profileMap.get(String(id)))
        .filter(Boolean)
    )

    if (typeof window !== "undefined" && import.meta.env?.DEV) {
      console.debug("[mutuals:web] PublicProfile", {
        currentUserId,
        viewedProfileId: profileId,
        followingIdsCount: followingIds.length,
        targetFollowerIdsCount: targetFollowerIds.length,
        mutualIdsCount: mutualIds.length,
        mutualProfilesCount: profilesData.length,
        mutualIds: mutualIds.slice(0, 6),
      })
    }
  }, [currentUser?.id, defaultAvatar])

  const loadMutualsList = useCallback(async () => {
    if (mutualFollowerIds.length === 0) {
      setMutualsListUsers([])
      return
    }

    setIsMutualsListLoading(true)

    const { data: profilesData, error: profilesError } = await supabase
      .from("profiles")
      .select("id, name, username, avatar_url")
      .in("id", mutualFollowerIds)

    if (profilesError || !profilesData) {
      console.error("Unable to load mutual followers list:", profilesError)
      setMutualsListUsers([])
      setIsMutualsListLoading(false)
      return
    }

    const profileMap = new Map(
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

    setMutualsListUsers(
      mutualFollowerIds
        .map((id) => profileMap.get(String(id)))
        .filter(Boolean)
    )
    setIsMutualsListLoading(false)
  }, [defaultAvatar, mutualFollowerIds])

  useEffect(() => {
    setFollowOverride(null)
    setActivePanel(null)
    setFollowersUsers([])
    setFollowingUsers([])
    setMenuOpen(false)
    setMenuFeedback("")
    setProfileContentCounts({ posts: 0 })
    setMutualFollowers([])
    setMutualFollowerCount(0)
    setMutualFollowerIds([])
    setIsMutualsListOpen(false)
    setMutualsListUsers([])
    setIsMuted(false)
    setIsBlocked(false)
    setNotificationMenuOpen(false)
    setActiveProfileSheet(null)
    setReportStep("topic")
  }, [viewedUsername])

  useEffect(() => {
    loadPublicProfile()
  }, [loadPublicProfile])

  useEffect(() => {
    if (!profile?.id) return
    loadMutualFollowers(profile.id)
  }, [loadMutualFollowers, profile?.id])

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

  const profileDisplayName = profile?.name || profile?.username || "this profile"
  const profileUsernameLabel = profile?.username ? `@${profile.username}` : profileDisplayName
  const profileUrl = profile
    ? `${window.location.origin}/#/profile/${profile.username || profile.id}`
    : ""
  const profileAvatarUrl = profile
    ? sanitizeAvatarUrl(profile.avatar_url, defaultAvatar)
    : defaultAvatar
  const currentUserAvatarUrl = sanitizeAvatarUrl(
    currentUser?.avatar_url || currentUser?.avatar || "",
    defaultAvatar
  )
  const joinedDateLabel =
    profile?.created_at || profile?.createdAt
      ? new Date(profile.created_at || profile.createdAt).toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        })
      : "Not available"
  const locationLabel =
    profile?.location ||
    profile?.country ||
    profile?.campus ||
    profile?.hometown ||
    "Not available"

  const handleToggleFollow = async () => {
    if (isBlocked) {
      setIsBlocked(false)
      setMenuFeedback(`${profileUsernameLabel} unblocked.`)
      return
    }

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

  const closeProfileSheet = () => {
    setActiveProfileSheet(null)
    setReportStep("topic")
  }

  const copyProfileLink = async () => {
    if (!profile) return

    try {
      await navigator.clipboard.writeText(profileUrl)
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

    if (!navigator.share) {
      await copyProfileLink()
      return
    }

    try {
      await navigator.share({
        title: profile.name || profile.username || "Campus Event profile",
        text: `Check out ${profileDisplayName} on Campus Event Navigation.`,
        url: profileUrl,
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
    closeMenu()
    setReportStep("topic")
    setActiveProfileSheet("report")
  }

  const handleBlockProfile = () => {
    setIsBlocked((currentValue) => {
      const nextValue = !currentValue
      setMenuFeedback(
        nextValue
          ? `${profileUsernameLabel} blocked locally.`
          : `${profileUsernameLabel} unblocked.`
      )
      return nextValue
    })
    closeMenu()
  }

  const handleMuteProfile = () => {
    setIsMuted((currentValue) => {
      const nextValue = !currentValue
      setMenuFeedback(
        nextValue
          ? `${profileUsernameLabel} muted locally.`
          : `${profileUsernameLabel} unmuted.`
      )
      return nextValue
    })
    closeMenu()
  }

  const handleHideStory = () => {
    setMenuFeedback("Story hiding is a placeholder for now.")
    closeMenu()
  }

  const handleRemoveFollower = async () => {
    if (!profile?.id) return

    closeMenu()

    const { data: authData } = await supabase.auth.getUser()
    const currentUserId = currentUser?.id || authData?.user?.id

    if (!currentUserId) {
      setMenuFeedback("Sign in again to remove a follower.")
      return
    }

    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", profile.id)
      .eq("following_id", currentUserId)

    setMenuFeedback(
      error
        ? "Could not remove follower right now."
        : `${profileUsernameLabel} removed as your follower.`
    )
  }

  const handleNotificationPreference = (label) => {
    setMenuFeedback(`${label} notifications preference saved locally.`)
    setNotificationMenuOpen(false)
  }

  const handleReportReason = (label) => {
    setMenuFeedback(`Report selected: ${label}.`)
    closeProfileSheet()
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

  const handleProfileContentCountsChange = useCallback((counts) => {
    setProfileContentCounts((prev) => ({
      ...prev,
      ...counts,
    }))
  }, [])

  const activePanelUsers =
    activePanel === "followers" ? followersUsers : followingUsers

  const mutualLabel = useMemo(() => {
    if (mutualFollowerCount <= 0) return ""

    const displayNames = mutualFollowers
      .slice(0, 2)
      .map((person) => person.name || person.username)
      .filter(Boolean)

    if (displayNames.length === 0) {
      return `${mutualFollowerCount} mutual ${mutualFollowerCount === 1 ? "follower" : "followers"}`
    }

    const remainingCount = Math.max(mutualFollowerCount - displayNames.length, 0)

    if (remainingCount > 0) {
      return `Followed by ${displayNames.join(", ")} and ${remainingCount} more`
    }

    return `Followed by ${displayNames.join(" and ")}`
  }, [mutualFollowerCount, mutualFollowers])

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
                <h2 className="real-name">
                  <span>{profile.name || profile.username || "Unknown user"}</span>
                  {profile.verification_status === "verified" ||
                  profile.student_verified ||
                  profile.account_type === "organization" ? (
                    <span className="profile-verified-badge" aria-label="Verified">
                      <span className="profile-verified-burst" aria-hidden="true" />
                      <span className="profile-verified-check" aria-hidden="true">✓</span>
                    </span>
                  ) : null}
                </h2>
              </div>

              <div className="public-profile-top-actions">
                <button
                  type="button"
                  className="profile-icon-action-btn"
                  onClick={() => setNotificationMenuOpen(true)}
                  aria-label="Open profile notification preferences"
                >
                  <Bell size={20} strokeWidth={2.3} />
                </button>

                <button
                  type="button"
                  className="profile-menu-btn"
                  onClick={() => setMenuOpen(true)}
                  aria-label="Open profile actions"
                >
                  <MoreHorizontal size={23} strokeWidth={2.5} />
                </button>
              </div>
            </div>

            <div className="profile-stats">
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

              <div className="profile-stat-card public-profile-stat-card static">
                <span className="profile-stat-number">{createdEvents.length}</span>
                <span className="profile-stat-label">Host</span>
              </div>

              <div className="profile-stat-card public-profile-stat-card static">
                <span className="profile-stat-number">{profileContentCounts.posts}</span>
                <span className="profile-stat-label">Posts</span>
              </div>
            </div>

            <p className="bio">{profile.bio || "No bio yet."}</p>

            {mutualLabel ? (
              <button
                type="button"
                className="public-profile-mutual-row public-profile-mutual-row-btn"
                onClick={async () => {
                  setIsMutualsListOpen(true)
                  await loadMutualsList()
                }}
                aria-label={`${mutualLabel}. View all mutual followers.`}
              >
                <div className="public-profile-mutual-avatars" aria-hidden="true">
                  {mutualFollowers.slice(0, 3).map((person) => (
                    <img
                      key={person.id}
                      src={person.image}
                      alt=""
                      onError={(event) => {
                        event.currentTarget.src = defaultAvatar
                      }}
                    />
                  ))}
                </div>
                <p>{mutualLabel}</p>
              </button>
            ) : null}

            <div className="profile-action-row public-profile-action-row">
              <button
                type="button"
                className={`profile-action-btn public-profile-btn ${isFollowingProfile ? "secondary" : ""} ${isBlocked ? "blocked" : ""}`}
                onClick={handleToggleFollow}
                disabled={isFollowBusy}
              >
                {isFollowBusy
                  ? "Working..."
                  : isBlocked
                    ? "Blocked"
                    : isFollowingProfile
                      ? "Following"
                      : "Follow"}
              </button>

              <button
                type="button"
                className="profile-action-btn secondary public-profile-btn"
                onClick={handleMessage}
                disabled={!profile.id}
              >
                Message
              </button>

              <button
                type="button"
                className="profile-action-btn secondary public-profile-btn"
                onClick={() => {
                  console.log("Recap coming soon.")
                  if (typeof window !== "undefined" && window.alert) {
                    window.alert("Recap coming soon.")
                  }
                }}
              >
                Recap
              </button>
            </div>

            {menuFeedback ? (
              <p className="public-profile-feedback">{menuFeedback}</p>
            ) : null}
          </div>
        </div>

        <ProfileContentTabs
          profileId={profile.id}
          isOwner={false}
          allEvents={allEvents}
          onContentCountsChange={handleProfileContentCountsChange}
        />
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

      {isMutualsListOpen && (
        <div
          className="profile-overlay"
          onClick={() => setIsMutualsListOpen(false)}
        >
          <div className="profile-modal" onClick={(event) => event.stopPropagation()}>
            <div className="profile-modal-header">
              <h3>{mutualsListUsers.length === 1 ? "Mutual" : "Mutuals"}</h3>
              <button
                type="button"
                className="profile-modal-close"
                onClick={() => setIsMutualsListOpen(false)}
                aria-label="Close mutual followers list"
              >
                ×
              </button>
            </div>

            <div className="profile-modal-body">
              {isMutualsListLoading ? (
                <p className="profile-empty-state">Loading...</p>
              ) : mutualsListUsers.length > 0 ? (
                <div className="profile-list">
                  {mutualsListUsers.map((person) => (
                    <div
                      className="profile-list-item public-profile-list-item"
                      key={person.id}
                    >
                      <button
                        type="button"
                        className="profile-list-identity-btn"
                        onClick={() => {
                          setIsMutualsListOpen(false)
                          navigate(`/profile/${person.username || person.id}`)
                        }}
                      >
                        <img
                          className="profile-list-avatar"
                          src={person.image || defaultAvatar}
                          alt={person.name || person.username || "User"}
                          onError={(event) => {
                            event.currentTarget.src = defaultAvatar
                          }}
                        />
                        <span className="public-profile-mutual-copy">
                          <span className="profile-list-name">
                            {person.name || person.username || "Unknown user"}
                          </span>
                          {person.username ? (
                            <span className="public-profile-mutual-username">
                              @{person.username}
                            </span>
                          ) : null}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="profile-action-btn secondary public-profile-mutual-msg-btn"
                        onClick={() => {
                          setIsMutualsListOpen(false)
                          navigate(`/messages?thread=${person.id}`)
                        }}
                      >
                        Message
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="profile-empty-state">No mutual followers yet.</p>
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
                <Flag size={18} />
                Report
              </button>

              <button
                type="button"
                className="menu-action-btn"
                onClick={handleMuteProfile}
              >
                {isMuted ? <Volume2 size={18} /> : <VolumeX size={18} />}
                {isMuted ? `Unmute ${profileUsernameLabel}` : `Mute ${profileUsernameLabel}`}
              </button>

              <button
                type="button"
                className="menu-action-btn danger"
                onClick={handleBlockProfile}
              >
                <Ban size={18} />
                {isBlocked ? `Unblock ${profileUsernameLabel}` : `Block ${profileUsernameLabel}`}
              </button>

              <button
                type="button"
                className="menu-action-btn"
                onClick={() => {
                  closeMenu()
                  setActiveProfileSheet("about")
                }}
              >
                <Info size={18} />
                About this account
              </button>

              <button
                type="button"
                className="menu-action-btn"
                onClick={() => {
                  closeMenu()
                  setActiveProfileSheet("shared")
                }}
              >
                <Activity size={18} />
                See shared activity
              </button>

              <button
                type="button"
                className="menu-action-btn"
                onClick={handleHideStory}
              >
                <EyeOff size={18} />
                Hide your story
              </button>

              <button
                type="button"
                className="menu-action-btn danger"
                onClick={handleRemoveFollower}
              >
                <UserMinus size={18} />
                Remove follower
              </button>

              <button
                type="button"
                className="menu-action-btn"
                onClick={handleCopyProfile}
              >
                <LinkIcon size={18} />
                Copy profile URL
              </button>

              <button
                type="button"
                className="menu-action-btn"
                onClick={handleShareProfile}
              >
                <Share2 size={18} />
                Share this profile
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

      {notificationMenuOpen && (
        <div className="menu-overlay" onClick={() => setNotificationMenuOpen(false)}>
          <div className="menu-modal" onClick={(event) => event.stopPropagation()}>
            <div className="profile-sheet-heading">
              <h3>Notifications</h3>
              <p>Choose what you want to hear about from {profileUsernameLabel}.</p>
            </div>
            <div className="menu-actions">
              {[
                ["All accounts you follow", Bell],
                ["Events", CalendarDays],
                ["Stories", Activity],
                ["Posts", MessageCircle],
                ["Videos", Video],
                ["Live", Bell],
                [`Notifications from ${profileUsernameLabel}`, Bell],
              ].map(([label, IconComponent]) => {
                const icon = React.createElement(IconComponent, { size: 18 })

                return (
                  <button
                    type="button"
                    className="menu-action-btn"
                    key={label}
                    onClick={() => handleNotificationPreference(label)}
                  >
                    {icon}
                    {label}
                  </button>
                )
              })}

              <button
                type="button"
                className="menu-action-btn cancel"
                onClick={() => setNotificationMenuOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {activeProfileSheet && (
        <div className="profile-overlay" onClick={closeProfileSheet}>
          <div
            className="profile-modal public-profile-detail-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="profile-modal-header">
              {activeProfileSheet === "report" && reportStep === "reason" ? (
                <button
                  type="button"
                  className="profile-sheet-back"
                  onClick={() => setReportStep("topic")}
                  aria-label="Back to report topics"
                >
                  <ChevronLeft size={20} />
                </button>
              ) : (
                <span className="profile-sheet-header-spacer" />
              )}

              <h3>
                {activeProfileSheet === "about"
                  ? "About this account"
                  : activeProfileSheet === "shared"
                    ? "Shared activity"
                    : reportStep === "reason"
                      ? "Why are you reporting this profile?"
                      : "What do you want to report?"}
              </h3>

              <button
                type="button"
                className="profile-modal-close"
                onClick={closeProfileSheet}
                aria-label="Close profile detail"
              >
                <X size={18} />
              </button>
            </div>

            {activeProfileSheet === "about" ? (
              <div className="profile-detail-content">
                <div className="profile-about-card">
                  <img
                    src={profileAvatarUrl}
                    alt={profileDisplayName}
                    onError={(event) => {
                      event.currentTarget.src = defaultAvatar
                    }}
                  />
                  <div>
                    <strong>{profileDisplayName}</strong>
                    <span>{profileUsernameLabel}</span>
                  </div>
                </div>

                <div className="profile-info-list">
                  <div className="profile-info-row">
                    <CalendarDays size={20} />
                    <div>
                      <span>Date joined VeroVite</span>
                      <strong>{joinedDateLabel}</strong>
                    </div>
                  </div>
                  <div className="profile-info-row">
                    <Info size={20} />
                    <div>
                      <span>Based in</span>
                      <strong>{locationLabel}</strong>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {activeProfileSheet === "shared" ? (
              <div className="profile-detail-content">
                <div className="shared-activity-avatars">
                  <img
                    src={currentUserAvatarUrl}
                    alt={currentUser?.name || currentUser?.username || "You"}
                    onError={(event) => {
                      event.currentTarget.src = defaultAvatar
                    }}
                  />
                  <img
                    src={profileAvatarUrl}
                    alt={profileDisplayName}
                    onError={(event) => {
                      event.currentTarget.src = defaultAvatar
                    }}
                  />
                </div>

                <div className="shared-activity-section">
                  <h4>Follow relationship</h4>
                  <p>{isFollowingProfile ? `You follow ${profileUsernameLabel}.` : `You do not follow ${profileUsernameLabel}.`}</p>
                  <p>Follower relationship from {profileUsernameLabel} to you is checked when removing follower.</p>
                </div>

                <div className="shared-activity-section">
                  <h4>Likes</h4>
                  <p>Posts from {profileUsernameLabel} that I liked: 0</p>
                  <p>Posts from me that {profileUsernameLabel} liked: 0</p>
                </div>

                <div className="shared-activity-section">
                  <h4>Comments</h4>
                  <p>Comments I made on their posts: 0</p>
                  <p>Comments they made on my posts: 0</p>
                </div>

                <div className="shared-activity-section">
                  <h4>Tags</h4>
                  <p>Tags involving me and {profileUsernameLabel}: 0</p>
                </div>
              </div>
            ) : null}

            {activeProfileSheet === "report" ? (
              <div className="profile-detail-content">
                {reportStep === "topic" ? (
                  <>
                    <p className="report-helper">
                      Reports are kept private. If there is an immediate safety concern,
                      contact local emergency services right away.
                    </p>
                    {[
                      "A specific post",
                      "A recent message they sent you",
                      "Something about this account",
                    ].map((label) => (
                      <button
                        type="button"
                        className="profile-report-option"
                        key={label}
                        onClick={() => {
                          if (label === "Something about this account") {
                            setReportStep("reason")
                            return
                          }

                          handleReportReason(label)
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </>
                ) : (
                  [
                    "They are pretending to be someone else",
                    "They may be under the minimum age",
                    "This account may have been hacked",
                    "Something else",
                  ].map((label) => (
                    <button
                      type="button"
                      className="profile-report-option"
                      key={label}
                      onClick={() => handleReportReason(label)}
                    >
                      {label}
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </main>
  )
}

export default PublicProfile
