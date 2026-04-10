import React, { useCallback, useEffect, useState } from "react"
import Cropper from "react-easy-crop"
import { useNavigate } from "react-router-dom"
import { useEvents } from "../context/EventContext"
import { buildEventImageStyle } from "../eventImages"
import {
  DEFAULT_AVATAR_URL,
  sanitizeAvatarStorageValue,
  sanitizeAvatarUrl,
  syncStoredUserFromSession,
  uploadProfileImageToStorage,
} from "../profileMedia"
import { supabase } from "../supabaseClient"
import {
  applyThemeMode,
  getStoredThemeMode,
  persistThemeMode,
  resolveThemeMode,
} from "../theme"
import "./Profile.css"

const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener("load", () => resolve(image))
    image.addEventListener("error", (error) => reject(error))
    image.setAttribute("crossOrigin", "anonymous")
    image.src = url
  })

async function getCroppedImg(imageSrc, pixelCrop) {
  const image = await createImage(imageSrc)
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")

  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  )

  return new Promise((resolve) => {
    canvas.toBlob((file) => {
      resolve(URL.createObjectURL(file))
    }, "image/jpeg")
  })
}

function ProfileTabIcon({ type }) {
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
      <path d="M8 6.5A2.5 2.5 0 1 1 8 11.5A2.5 2.5 0 0 1 8 6.5Z" />
      <path d="M16 4.5A2.5 2.5 0 1 1 16 9.5A2.5 2.5 0 0 1 16 4.5Z" />
      <path d="M14.5 18.5A3.5 3.5 0 1 1 14.5 11.5A3.5 3.5 0 0 1 14.5 18.5Z" />
      <path d="M10 9.5L13 11.5" />
      <path d="M9 14L11.5 15" />
    </svg>
  )
}

const buildProfileEventImageStyle = (event) =>
  buildEventImageStyle(
    event?.image,
    "linear-gradient(180deg, rgba(15, 23, 42, 0.08), rgba(15, 23, 42, 0.72))"
  )

function Profile() {
  const navigate = useNavigate()
  const {
    currentUser,
    savedEvents,
    allEvents,
    followingList,
    followersList,
    cancelRSVP,
    deleteEvent,
    follow,
    unfollow,
  } = useEvents()

  const [name, setName] = useState("Success Myers")
  const [username, setUsername] = useState("itzmesuccess1")
  const [bio, setBio] = useState("UMES student • Event lover • Front-end builder")

  const [activePanel, setActivePanel] = useState(null)
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false)
  const [isCropModalOpen, setIsCropModalOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [shareMessage, setShareMessage] = useState("")
  const [activeSettingsView, setActiveSettingsView] = useState("main")
  const [themeMode, setThemeMode] = useState(getStoredThemeMode)
  const [pushNotifications, setPushNotifications] = useState(true)
  const [eventReminders, setEventReminders] = useState(true)
  const [followerAlerts, setFollowerAlerts] = useState(true)
  const [dmAlerts, setDmAlerts] = useState(true)
  const [messageRequests, setMessageRequests] = useState(true)
  const [readReceipts, setReadReceipts] = useState(false)
  const [showOnlineStatus, setShowOnlineStatus] = useState(true)
  const [privateProfile, setPrivateProfile] = useState(false)
  const [showActivityStatus, setShowActivityStatus] = useState(true)
  const [followersOnlyDms, setFollowersOnlyDms] = useState(false)
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    type: "",
    event: null,
  })
  const [isConfirmingAction, setIsConfirmingAction] = useState(false)
  const [activeProfileTab, setActiveProfileTab] = useState("grid")

  const defaultAvatar = DEFAULT_AVATAR_URL
  const storedUser = JSON.parse(localStorage.getItem("user") || "{}")
  const storedUserAvatarValue =
    sanitizeAvatarStorageValue(
      storedUser.avatarStorageValue ||
        storedUser.avatarUrl ||
        storedUser.avatar_url ||
        storedUser.image ||
        storedUser.avatar,
      null
    ) || ""
  const [profileImage, setProfileImage] = useState("")
  const [draftName, setDraftName] = useState(name)
  const [draftUsername, setDraftUsername] = useState(username)
  const [draftBio, setDraftBio] = useState(bio)
  const [draftProfileImage, setDraftProfileImage] = useState(profileImage)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [rawSelectedImage, setRawSelectedImage] = useState(null)
  const ownerId = storedUser.id || currentUser?.id
  const ownerUsername = storedUser.username || username
  const currentProfileImage =
    sanitizeAvatarUrl(profileImage || storedUserAvatarValue, defaultAvatar)

  const createdEvents = allEvents.filter(
    (event) =>
      String(event.createdBy) === String(ownerId) ||
      String(event.created_by) === String(ownerId) ||
      event.createdBy === ownerUsername ||
      event.creatorUsername === ownerUsername
  )
  const rsvpGridEvents = savedEvents || []
  const repostedEvents = allEvents.filter((event) => {
    const repostedByIds = Array.isArray(event.repostedByIds) ? event.repostedByIds : []
    const repostedByUsernames = Array.isArray(event.repostedByUsernames)
      ? event.repostedByUsernames
      : []

    return (
      repostedByIds.some((id) => String(id) === String(ownerId)) ||
      repostedByUsernames.some((handle) => handle === ownerUsername)
    )
  })
  const taggedMoments = []

  const openPanel = (panelName) => {
    setActivePanel(panelName)
  }

  const closePanel = () => {
    setActivePanel(null)
  }

  const openEditProfile = () => {
    setDraftName(name)
    setDraftUsername(username)
    setDraftBio(bio)
    setDraftProfileImage(profileImage || storedUserAvatarValue || "")
    setIsEditProfileOpen(true)
  }

  const closeEditProfile = () => {
    setIsEditProfileOpen(false)
  }

  const openSettings = () => {
    setActiveSettingsView("main")
    setIsSettingsOpen(true)
  }

  const closeSettings = () => {
    setIsSettingsOpen(false)
    setActiveSettingsView("main")
  }

  const resolvedTheme = resolveThemeMode(themeMode)

  useEffect(() => {
    persistThemeMode(themeMode)
    applyThemeMode(themeMode)
  }, [themeMode])

  useEffect(() => {
    const userId = JSON.parse(localStorage.getItem("user") || "{}").id
    if (!userId) return

    supabase
      .from("profiles")
      .select("name, username, bio, avatar_url")
      .eq("id", userId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) return
        if (data.name) setName(data.name)
        if (data.username) setUsername(data.username)
        if (data.bio) setBio(data.bio)
        const nextAvatarValue = sanitizeAvatarStorageValue(data.avatar_url, null) || ""
        setProfileImage(nextAvatarValue)
        localStorage.setItem("profileImage", nextAvatarValue)
      })
  }, [defaultAvatar])

  const handleSaveProfile = async () => {
    const nextProfileImageValue =
      sanitizeAvatarStorageValue(
        draftProfileImage,
        profileImage || storedUserAvatarValue || null
      ) || ""

    setName(draftName)
    setUsername(draftUsername)
    setBio(draftBio)
    setProfileImage(nextProfileImageValue)
    localStorage.setItem("profileImage", nextProfileImageValue)

    const userId = JSON.parse(localStorage.getItem("user") || "{}").id
    if (userId) {
      await supabase.auth.updateUser({
        data: {
          name: draftName,
          username: draftUsername,
          avatar_url: nextProfileImageValue || null,
        },
      })

      await supabase
        .from("profiles")
        .upsert({
          id: userId,
          name: draftName,
          username: draftUsername,
          bio: draftBio,
          avatar_url: nextProfileImageValue || null,
          updated_at: new Date().toISOString(),
        })

      const {
        data: { session },
      } = await supabase.auth.getSession()
      await syncStoredUserFromSession(session)
    }

    setIsEditProfileOpen(false)
  }

  const onCropComplete = useCallback((_, croppedAreaPixelsValue) => {
    setCroppedAreaPixels(croppedAreaPixelsValue)
  }, [])

  const handleProfileImageChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (rawSelectedImage?.startsWith("blob:")) {
      URL.revokeObjectURL(rawSelectedImage)
    }

    const imageUrl = URL.createObjectURL(file)
    setRawSelectedImage(imageUrl)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setIsCropModalOpen(true)
  }

  const handleApplyCrop = async () => {
    if (!rawSelectedImage || !croppedAreaPixels) return

    let croppedImageUrl = ""
    let shouldClearRawImage = false

    try {
      croppedImageUrl = await getCroppedImg(rawSelectedImage, croppedAreaPixels)

      const userId = JSON.parse(localStorage.getItem("user") || "{}").id
      if (userId) {
        const response = await fetch(croppedImageUrl)
        const blob = await response.blob()
        const nextAvatar = await uploadProfileImageToStorage({
          userId,
          file: blob,
          fileName: `${userId}.jpg`,
          contentType: "image/jpeg",
          fallbackUrl: draftProfileImage || profileImage || storedUserAvatarValue || null,
        })

        setDraftProfileImage(nextAvatar)
        setIsCropModalOpen(false)
        setRawSelectedImage(null)
        shouldClearRawImage = true
        return
      }
      
      alert("You must be logged in to upload a profile picture.")
      setIsCropModalOpen(false)
      setRawSelectedImage(null)
      shouldClearRawImage = true
    } catch (error) {
      console.error("Error cropping image:", error)
    } finally {
      if (croppedImageUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(croppedImageUrl)
      }

      if (shouldClearRawImage && rawSelectedImage?.startsWith("blob:")) {
        URL.revokeObjectURL(rawSelectedImage)
      }
    }
  }

  const handleCancelCrop = () => {
    if (rawSelectedImage?.startsWith("blob:")) {
      URL.revokeObjectURL(rawSelectedImage)
    }
    setIsCropModalOpen(false)
    setRawSelectedImage(null)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
  }

  const handleShareProfile = async () => {
    const baseUrl = window.location.origin
    const profileLink = `${baseUrl}/#/profile/${draftUsername || username || "profile"}`

    try {
      await navigator.clipboard.writeText(profileLink)
      setShareMessage("Profile link copied!")
      setTimeout(() => setShareMessage(""), 2500)
    } catch {
      window.prompt("Copy your profile link:", profileLink)
    }
  }

  const handleLogout = () => {
    closeSettings()
    navigate("/auth/logout")
  }

  const openDeleteModal = (event) => {
    setConfirmModal({ open: true, type: "delete", event })
  }

  const openCancelRsvpModal = (event) => {
    setConfirmModal({ open: true, type: "cancel-rsvp", event })
  }

  const closeConfirmModal = () => {
    setConfirmModal({ open: false, type: "", event: null })
  }

  const handleConfirmAction = async () => {
    const event = confirmModal.event
    if (!event || isConfirmingAction) return

    try {
      setIsConfirmingAction(true)

      if (confirmModal.type === "cancel-rsvp") {
        const { error: rsvpError } = await supabase
          .from("rsvps")
          .delete()
          .eq("event_id", event.id)
          .eq("user_id", currentUser.id)

        if (rsvpError) {
          alert(rsvpError.message)
          return
        }

        const nextGoingCount = Math.max((event.goingCount || 1) - 1, 0)

        const { error: eventUpdateError } = await supabase
          .from("events")
          .update({ going_count: nextGoingCount })
          .eq("id", event.id)

        if (eventUpdateError) {
          alert(eventUpdateError.message)
          return
        }

        cancelRSVP(event.id)
      }

      if (confirmModal.type === "delete") {
        const { error: rsvpsDeleteError } = await supabase
          .from("rsvps")
          .delete()
          .eq("event_id", event.id)

        if (rsvpsDeleteError) {
          alert(rsvpsDeleteError.message)
          return
        }

        const { error: eventDeleteError } = await supabase
          .from("events")
          .delete()
          .eq("id", event.id)

        if (eventDeleteError) {
          alert(eventDeleteError.message)
          return
        }

        deleteEvent(event.id)
      }

      closeConfirmModal()
    } catch (error) {
      alert(error.message || "Something went wrong.")
    } finally {
      setIsConfirmingAction(false)
    }
  }

  return (
    <main className="profile-page">
      <div className="profile-card">
        <div className="profile-header">
          <div className="profile-avatar-wrap">
            <img
              className="profile-avatar"
              src={currentProfileImage}
              alt={name || "Profile"}
              onError={(e) => {
                e.currentTarget.src = defaultAvatar
              }}
            />
          </div>

          <div className="profile-info">
            <h1 className="username">{username}</h1>
            <h2 className="real-name">{name}</h2>

            <p className="bio">{bio}</p>

            <div className="profile-stats">
              <button
                type="button"
                className="profile-stat-card"
                onClick={() => openPanel("following")}
              >
                <span className="profile-stat-number">{followingList.length}</span>
                <span className="profile-stat-label">Following</span>
              </button>

              <button
                type="button"
                className="profile-stat-card"
                onClick={() => openPanel("followers")}
              >
                <span className="profile-stat-number">{followersList.length}</span>
                <span className="profile-stat-label">Followers</span>
              </button>

              <button
                type="button"
                className="profile-stat-card"
                onClick={() => openPanel("events")}
              >
                <span className="profile-stat-number">{createdEvents.length}</span>
                <span className="profile-stat-label">Events Created</span>
              </button>
            </div>

            <div className="profile-action-row">
              <button
                type="button"
                className="profile-action-btn"
                onClick={openEditProfile}
              >
                Edit Profile
              </button>
              <button
                type="button"
                className="profile-action-btn secondary"
                onClick={handleShareProfile}
              >
                Share Profile
              </button>
              <button
                type="button"
                className="profile-action-btn secondary"
                onClick={openSettings}
              >
                Settings
              </button>
            </div>
            {shareMessage && <p className="profile-share-message">{shareMessage}</p>}
          </div>
        </div>

        <div className="profile-content-stack">
          <div className="profile-section profile-tabbed-section">
            <div className="profile-tab-bar" role="tablist" aria-label="Profile tabs">
              <button
                type="button"
                className={`profile-tab-btn ${activeProfileTab === "grid" ? "active" : ""}`}
                onClick={() => setActiveProfileTab("grid")}
                aria-label="Going events"
                aria-selected={activeProfileTab === "grid"}
                role="tab"
              >
                <ProfileTabIcon type="grid" />
              </button>

              <button
                type="button"
                className={`profile-tab-btn ${activeProfileTab === "reposts" ? "active" : ""}`}
                onClick={() => setActiveProfileTab("reposts")}
                aria-label="Reposted events"
                aria-selected={activeProfileTab === "reposts"}
                role="tab"
              >
                <ProfileTabIcon type="reposts" />
              </button>

              <button
                type="button"
                className={`profile-tab-btn ${activeProfileTab === "tagged" ? "active" : ""}`}
                onClick={() => setActiveProfileTab("tagged")}
                aria-label="Tagged moments"
                aria-selected={activeProfileTab === "tagged"}
                role="tab"
              >
                <ProfileTabIcon type="tagged" />
              </button>
            </div>

            <div className="profile-tab-panel">
              {activeProfileTab === "grid" && (
                rsvpGridEvents.length > 0 ? (
                  <div className="profile-tab-event-grid">
                    {rsvpGridEvents.map((event) => (
                      <button
                        key={event.id}
                        type="button"
                        className="profile-tab-event-card"
                        onClick={() => openCancelRsvpModal(event)}
                      >
                        <div
                          className="profile-tab-event-image"
                          style={buildProfileEventImageStyle(event)}
                        >
                          <span className="profile-tab-event-pill">Going</span>
                        </div>

                        <div className="profile-tab-event-body">
                          <strong>{event.title || event.name || "Untitled Event"}</strong>
                          <span>
                            {[
                              event.date,
                              event.time || "TBA",
                            ].filter(Boolean).join(" · ")}
                          </span>
                          <span>{event.locationName || event.location || "No location"}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="profile-tab-empty-state">
                    <h3>Your grid is open.</h3>
                    <p>Events you RSVP to will show up here first.</p>
                  </div>
                )
              )}

              {activeProfileTab === "reposts" && (
                repostedEvents.length > 0 ? (
                  <div className="profile-tab-event-grid">
                    {repostedEvents.map((event) => (
                      <div className="profile-tab-event-card static" key={event.id}>
                        <div
                          className="profile-tab-event-image"
                          style={buildProfileEventImageStyle(event)}
                        >
                          <span className="profile-tab-event-pill">Reposted</span>
                        </div>

                        <div className="profile-tab-event-body">
                          <strong>{event.title || event.name || "Untitled Event"}</strong>
                          <span>
                            {[
                              event.date,
                              event.time || "TBA",
                            ].filter(Boolean).join(" · ")}
                          </span>
                          <span>{event.locationName || event.location || "No location"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="profile-tab-empty-state">
                    <h3>Nothing reposted yet.</h3>
                    <p>Events you repost will show up here.</p>
                  </div>
                )
              )}

              {activeProfileTab === "tagged" && (
                taggedMoments.length > 0 ? (
                  <div className="profile-tagged-grid" />
                ) : (
                  <div className="profile-tab-empty-state">
                    <h3>Tagged moments will land here.</h3>
                    <p>Photos and videos from events you attend will appear here.</p>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {activePanel && (
        <div className="profile-overlay" onClick={closePanel}>
          <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
            <div className="profile-modal-header">
              <h3>
                {activePanel === "following" && "Following"}
                {activePanel === "followers" && "Followers"}
                {activePanel === "events" && "Events Created"}
              </h3>
              <button
                type="button"
                className="profile-modal-close"
                onClick={closePanel}
                aria-label="Close panel"
              >
                ×
              </button>
            </div>

            <div className="profile-modal-body">
              {activePanel === "following" && (
                followingList.length > 0 ? (
                  <div className="profile-list">
                    {followingList.map((person) => (
                      <div className="profile-list-item" key={person.id}>
                        <button
                          type="button"
                          className="profile-list-identity-btn"
                          onClick={() => { closePanel(); navigate(`/profile/${person.username || person.id}`) }}
                        >
                          <img
                            className="profile-list-avatar"
                            src={person.image || defaultAvatar}
                            alt={person.name}
                            onError={(e) => { e.currentTarget.src = defaultAvatar }}
                          />
                          <span className="profile-list-name">{person.name || person.username || "Unknown user"}</span>
                        </button>
                        <button
                          type="button"
                          className="profile-list-action-btn unfollow"
                          onClick={() => unfollow(person.id)}
                        >
                          Unfollow
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="profile-empty-state">Not following anyone yet.</p>
                )
              )}

              {activePanel === "followers" && (
                followersList.length > 0 ? (
                  <div className="profile-list">
                    {followersList.map((person) => (
                      <div className="profile-list-item" key={person.id}>
                        <button
                          type="button"
                          className="profile-list-identity-btn"
                          onClick={() => { closePanel(); navigate(`/profile/${person.username || person.id}`) }}
                        >
                          <img
                            className="profile-list-avatar"
                            src={person.image || defaultAvatar}
                            alt={person.name}
                            onError={(e) => { e.currentTarget.src = defaultAvatar }}
                          />
                          <span className="profile-list-name">{person.name || person.username || "Unknown user"}</span>
                        </button>
                        {!followingList.some((f) => f.id === person.id) && (
                          <button
                            type="button"
                            className="profile-list-action-btn follow-back"
                            onClick={() => follow(person.id)}
                          >
                            Follow back
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="profile-empty-state">No followers yet.</p>
                )
              )}

              {activePanel === "events" && (
                createdEvents.length > 0 ? (
                  <div className="profile-created-list">
                    {createdEvents.map((event, index) => (
                      <div className="profile-created-event-card" key={event.id || index}>
                        <div className="profile-created-event-content">
                          <div className="profile-created-event-main">
                            <h4>{event.title || event.name || "Untitled Event"}</h4>
                            <p>
                              {[
                                event.date,
                                event.time || "TBA",
                                event.locationName || event.location || "No location",
                              ].join(" · ")}
                            </p>
                          </div>

                          <div className="profile-created-event-actions">
                            <button
                              type="button"
                              className="profile-delete-btn"
                              onClick={() => openDeleteModal(event)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="profile-empty-state">No created events yet.</p>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {isEditProfileOpen && (
        <div className="profile-overlay" onClick={closeEditProfile}>
          <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
            <div className="profile-modal-header">
              <h3>Edit Profile</h3>
              <button
                type="button"
                className="profile-modal-close"
                onClick={closeEditProfile}
                aria-label="Close edit profile"
              >
                ×
              </button>
            </div>

            <div className="profile-modal-body">
              <form className="edit-profile-form">
                <div className="edit-profile-avatar-section">
                  <div className="edit-profile-avatar-wrap">
                    <img
                      className="edit-profile-avatar"
                      src={sanitizeAvatarUrl(
                        draftProfileImage || currentProfileImage || defaultAvatar,
                        defaultAvatar
                      )}
                      alt="Profile preview"
                      onError={(e) => {
                        e.currentTarget.src = defaultAvatar
                      }}
                    />
                  </div>

                  <label className="edit-profile-upload-btn">
                    Upload Photo
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProfileImageChange}
                      hidden
                    />
                  </label>
                </div>

                <label className="edit-profile-field">
                  <span>Name</span>
                  <input
                    type="text"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    placeholder="Your name"
                  />
                </label>

                <label className="edit-profile-field">
                  <span>Username</span>
                  <input
                    type="text"
                    value={draftUsername}
                    onChange={(e) => setDraftUsername(e.target.value)}
                    placeholder="Your username"
                  />
                </label>

                <label className="edit-profile-field">
                  <span>Bio</span>
                  <textarea
                    rows="4"
                    value={draftBio}
                    onChange={(e) => setDraftBio(e.target.value)}
                    placeholder="Write a short bio"
                  />
                </label>

                <div className="edit-profile-actions">
                  <button
                    type="button"
                    className="profile-action-btn secondary"
                    onClick={closeEditProfile}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="profile-action-btn"
                    onClick={handleSaveProfile}
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {isCropModalOpen && (
        <div className="profile-overlay" onClick={handleCancelCrop}>
          <div
            className="profile-modal crop-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="profile-modal-header">
              <h3>Crop Profile Photo</h3>
              <button
                type="button"
                className="profile-modal-close"
                onClick={handleCancelCrop}
                aria-label="Close crop modal"
              >
                ×
              </button>
            </div>

            <div className="cropper-wrapper">
              <Cropper
                image={rawSelectedImage}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>

            <div className="crop-controls">
              <label className="crop-zoom-label">
                <span>Zoom</span>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.1}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                />
              </label>

              <div className="crop-actions">
                <button
                  type="button"
                  className="profile-action-btn secondary"
                  onClick={handleCancelCrop}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="profile-action-btn"
                  onClick={handleApplyCrop}
                >
                  Apply Crop
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isSettingsOpen && (
        <div className="profile-overlay" onClick={closeSettings}>
          <div
            className="profile-modal settings-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="profile-modal-header">
              <h3>Settings and activity</h3>
              <button
                type="button"
                className="profile-modal-close"
                onClick={closeSettings}
                aria-label="Close settings"
              >
                ×
              </button>
            </div>

            <div className="settings-section">
              {activeSettingsView === "main" && (
                <>
                  <h4>App</h4>

                  <button
                    type="button"
                    className="settings-row-btn"
                    onClick={() => setActiveSettingsView("notifications")}
                  >
                    Notifications
                  </button>

                  <button
                    type="button"
                    className="settings-row-btn"
                    onClick={() => setActiveSettingsView("messages")}
                  >
                    Messages
                  </button>

                  <button
                    type="button"
                    className="settings-row-btn"
                    onClick={() => setActiveSettingsView("privacy")}
                  >
                    Privacy
                  </button>

                  <button
                    type="button"
                    className="settings-row-btn"
                    onClick={() => setActiveSettingsView("appearance")}
                  >
                    Appearance
                  </button>

                  <div className="settings-section settings-danger-zone">
                    <h4>Account</h4>

                    <button
                      type="button"
                      className="settings-row-btn danger"
                      onClick={handleLogout}
                    >
                      Log out
                    </button>
                  </div>
                </>
              )}

              {activeSettingsView === "notifications" && (
                <div className="settings-detail-view">
                  <div className="settings-subheader">
                    <button
                      type="button"
                      className="settings-back-btn"
                      onClick={() => setActiveSettingsView("main")}
                      aria-label="Back to settings"
                    >
                      ←
                    </button>
                    <h4>Notifications</h4>
                  </div>

                  <div className="settings-toggle-list">
                    <div className="settings-toggle-row">
                      <span>Push notifications</span>
                      <button
                        type="button"
                        className={`settings-toggle ${pushNotifications ? "on" : ""}`}
                        onClick={() => setPushNotifications((prev) => !prev)}
                      >
                        <span />
                      </button>
                    </div>

                    <div className="settings-toggle-row">
                      <span>Event reminders</span>
                      <button
                        type="button"
                        className={`settings-toggle ${eventReminders ? "on" : ""}`}
                        onClick={() => setEventReminders((prev) => !prev)}
                      >
                        <span />
                      </button>
                    </div>

                    <div className="settings-toggle-row">
                      <span>New follower alerts</span>
                      <button
                        type="button"
                        className={`settings-toggle ${followerAlerts ? "on" : ""}`}
                        onClick={() => setFollowerAlerts((prev) => !prev)}
                      >
                        <span />
                      </button>
                    </div>

                    <div className="settings-toggle-row">
                      <span>DM alerts</span>
                      <button
                        type="button"
                        className={`settings-toggle ${dmAlerts ? "on" : ""}`}
                        onClick={() => setDmAlerts((prev) => !prev)}
                      >
                        <span />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeSettingsView === "messages" && (
                <div className="settings-detail-view">
                  <div className="settings-subheader">
                    <button
                      type="button"
                      className="settings-back-btn"
                      onClick={() => setActiveSettingsView("main")}
                      aria-label="Back to settings"
                    >
                      ←
                    </button>
                    <h4>Messages</h4>
                  </div>

                  <div className="settings-toggle-list">
                    <div className="settings-toggle-row">
                      <span>Message requests</span>
                      <button
                        type="button"
                        className={`settings-toggle ${messageRequests ? "on" : ""}`}
                        onClick={() => setMessageRequests((prev) => !prev)}
                      >
                        <span />
                      </button>
                    </div>

                    <div className="settings-toggle-row">
                      <span>Read receipts</span>
                      <button
                        type="button"
                        className={`settings-toggle ${readReceipts ? "on" : ""}`}
                        onClick={() => setReadReceipts((prev) => !prev)}
                      >
                        <span />
                      </button>
                    </div>

                    <div className="settings-toggle-row">
                      <span>Show online status</span>
                      <button
                        type="button"
                        className={`settings-toggle ${showOnlineStatus ? "on" : ""}`}
                        onClick={() => setShowOnlineStatus((prev) => !prev)}
                      >
                        <span />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeSettingsView === "privacy" && (
                <div className="settings-detail-view">
                  <div className="settings-subheader">
                    <button
                      type="button"
                      className="settings-back-btn"
                      onClick={() => setActiveSettingsView("main")}
                      aria-label="Back to settings"
                    >
                      ←
                    </button>
                    <h4>Privacy</h4>
                  </div>

                  <div className="settings-toggle-list">
                    <div className="settings-toggle-row">
                      <span>Private profile</span>
                      <button
                        type="button"
                        className={`settings-toggle ${privateProfile ? "on" : ""}`}
                        onClick={() => setPrivateProfile((prev) => !prev)}
                      >
                        <span />
                      </button>
                    </div>

                    <div className="settings-toggle-row">
                      <span>Show activity status</span>
                      <button
                        type="button"
                        className={`settings-toggle ${showActivityStatus ? "on" : ""}`}
                        onClick={() => setShowActivityStatus((prev) => !prev)}
                      >
                        <span />
                      </button>
                    </div>

                    <div className="settings-toggle-row">
                      <span>Allow DMs from followers only</span>
                      <button
                        type="button"
                        className={`settings-toggle ${followersOnlyDms ? "on" : ""}`}
                        onClick={() => setFollowersOnlyDms((prev) => !prev)}
                      >
                        <span />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeSettingsView === "appearance" && (
                <div className="settings-detail-view">
                  <div className="settings-subheader">
                    <button
                      type="button"
                      className="settings-back-btn"
                      onClick={() => setActiveSettingsView("main")}
                      aria-label="Back to settings"
                    >
                      ←
                    </button>
                    <h4>Appearance</h4>
                  </div>

                  <div className="settings-option-list">
                    <button
                      type="button"
                      className={`settings-option-row ${themeMode === "light" ? "active" : ""}`}
                      onClick={() => setThemeMode("light")}
                    >
                      Light
                    </button>

                    <button
                      type="button"
                      className={`settings-option-row ${themeMode === "dark" ? "active" : ""}`}
                      onClick={() => setThemeMode("dark")}
                    >
                      Dark
                    </button>

                    <button
                      type="button"
                      className={`settings-option-row ${themeMode === "device" ? "active" : ""}`}
                      onClick={() => setThemeMode("device")}
                    >
                      Device
                    </button>
                  </div>

                  <p className="settings-helper-text">
                    Device follows your system appearance automatically. Current:{" "}
                    {resolvedTheme === "dark" ? "Dark" : "Light"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {confirmModal.open && (
        <div className="profile-confirm-overlay" onClick={closeConfirmModal}>
          <div className="profile-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3>
              {confirmModal.type === "delete" ? "Delete event?" : "Cancel RSVP?"}
            </h3>
            <p>
              {confirmModal.type === "delete"
                ? `Delete "${confirmModal.event?.title}" everywhere? This cannot be undone.`
                : `Cancel RSVP for "${confirmModal.event?.title}"?`}
            </p>
            <div className="profile-confirm-actions">
              <button
                type="button"
                className="profile-confirm-cancel-btn"
                onClick={closeConfirmModal}
                disabled={isConfirmingAction}
              >
                Keep
              </button>
              <button
                type="button"
                className="profile-confirm-delete-btn"
                onClick={handleConfirmAction}
                disabled={isConfirmingAction}
              >
                {isConfirmingAction
                  ? "Working..."
                  : confirmModal.type === "delete"
                    ? "Delete"
                    : "Cancel RSVP"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default Profile
