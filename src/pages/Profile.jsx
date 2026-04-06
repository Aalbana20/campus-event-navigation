import React, { useCallback, useEffect, useState } from "react"
import Cropper from "react-easy-crop"
import { useNavigate } from "react-router-dom"
import { useEvents } from "../context/EventContext"

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

function Profile() {
  const navigate = useNavigate()
  const { savedEvents, allEvents, followingList, followersList } = useEvents()
  const [name, setName] = useState("Success Myers")
  const [username, setUsername] = useState("itzmesuccess1")
  const [bio, setBio] = useState("UMES student • Event lover • Front-end builder")

  const [activePanel, setActivePanel] = useState(null)
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false)
  const [isCropModalOpen, setIsCropModalOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [shareMessage, setShareMessage] = useState("")
  const [activeSettingsView, setActiveSettingsView] = useState("main")
  const [themeMode, setThemeMode] = useState(
    localStorage.getItem("themeMode") || "device"
  )
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

  const defaultAvatar = "/default-avatar.png"
  const storedUser = JSON.parse(localStorage.getItem("user") || "{}")
  const savedImage = localStorage.getItem("profileImage")
  const [profileImage, setProfileImage] = useState(
    savedImage || storedUser.image || storedUser.avatar || ""
  )
  const [draftName, setDraftName] = useState(name)
  const [draftUsername, setDraftUsername] = useState(username)
  const [draftBio, setDraftBio] = useState(bio)
  const [draftProfileImage, setDraftProfileImage] = useState(profileImage)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [rawSelectedImage, setRawSelectedImage] = useState(null)
  const ownerUsername = storedUser.username || username
  const currentProfileImage =
    profileImage ||
    storedUser.image ||
    storedUser.avatar ||
    defaultAvatar

  const createdEvents = allEvents.filter(
    (event) =>
      event.createdBy === ownerUsername ||
      event.creatorUsername === ownerUsername
  )
  const recentRsvpEvents = (savedEvents || []).slice(0, 5)

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
    setDraftProfileImage(profileImage)
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

  const getSystemTheme = () =>
    window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"

  const resolvedTheme = themeMode === "device" ? getSystemTheme() : themeMode

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")

    const applyTheme = () => {
      const activeTheme = themeMode === "device" ? getSystemTheme() : themeMode
      document.body.classList.remove("theme-light", "theme-dark")
      document.body.classList.add(`theme-${activeTheme}`)
      localStorage.setItem("themeMode", themeMode)
    }

    applyTheme()

    const handleChange = () => {
      if (themeMode === "device") {
        applyTheme()
      }
    }

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange)
      return () => mediaQuery.removeEventListener("change", handleChange)
    }

    mediaQuery.addListener(handleChange)
    return () => mediaQuery.removeListener(handleChange)
  }, [themeMode])

  const handleSaveProfile = () => {
    setName(draftName)
    setUsername(draftUsername)
    setBio(draftBio)
    setProfileImage(draftProfileImage)
    localStorage.setItem("profileImage", draftProfileImage)
    localStorage.setItem(
      "user",
      JSON.stringify({
        ...storedUser,
        username: draftUsername,
        image: draftProfileImage,
      })
    )
    setIsEditProfileOpen(false)
  }

  const onCropComplete = useCallback((_, croppedAreaPixelsValue) => {
    setCroppedAreaPixels(croppedAreaPixelsValue)
  }, [])

  const handleProfileImageChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const imageUrl = URL.createObjectURL(file)
    setRawSelectedImage(imageUrl)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setIsCropModalOpen(true)
  }

  const handleApplyCrop = async () => {
    if (!rawSelectedImage || !croppedAreaPixels) return

    try {
      const croppedImageUrl = await getCroppedImg(rawSelectedImage, croppedAreaPixels)
      setDraftProfileImage(croppedImageUrl)
      setIsCropModalOpen(false)
      setRawSelectedImage(null)
    } catch (error) {
      console.error("Error cropping image:", error)
    }
  }

  const handleCancelCrop = () => {
    setIsCropModalOpen(false)
    setRawSelectedImage(null)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
  }

  const handleShareProfile = async () => {
    const baseUrl = window.location.origin
    const profileLink = `${baseUrl}/profile/${draftUsername || username || "profile"}`

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

        <div className="profile-bottom-grid">
          <div className="profile-section">
            <div className="profile-created-section">
              <div className="profile-section-header">
                <h3>Created Events</h3>
              </div>

              {createdEvents.length > 0 ? (
                <div className="profile-created-list">
                  {createdEvents.slice(0, 5).map((event, index) => (
                    <div className="profile-created-card compact" key={event.id || index}>
                      <div className="profile-created-card-content">
                        <div className="profile-created-main">
                          <span className="profile-created-title">
                            {event.title || event.name || "Untitled Event"}
                          </span>

                          {(event.date || event.time || event.locationName || event.location) && (
                            <span className="profile-created-meta">
                              {[event.date, event.time, event.locationName || event.location]
                                .filter(Boolean)
                                .join(" • ")}
                            </span>
                          )}
                        </div>

                        <span className="profile-created-badge">Created</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="profile-created-empty">No events created yet.</p>
              )}
            </div>
          </div>

          <div className="profile-section">
            <h3>RSVP Activity</h3>
            <div className="profile-rsvp-section">
              <div className="profile-section-header">
                <h3>Recent</h3>
              </div>

              {recentRsvpEvents.length > 0 ? (
                <div className="profile-rsvp-list">
                  {recentRsvpEvents.map((event, index) => (
                    <div className="profile-rsvp-card compact" key={event.id || index}>
                      <div className="profile-rsvp-card-content">
                        <div className="profile-rsvp-main">
                          <span className="profile-rsvp-title">
                            {event.title || event.name || "Untitled Event"}
                          </span>

                          {(event.date || event.time || event.locationName || event.location) && (
                            <span className="profile-rsvp-meta">
                              {[event.date, event.time, event.locationName || event.location]
                                .filter(Boolean)
                                .join(" • ")}
                            </span>
                          )}
                        </div>

                        <span className="rsvp-dot" aria-label="RSVP confirmed" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="profile-rsvp-empty">No RSVP activity yet.</p>
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
                        <span className="profile-list-name">
                          {person.name || person.username || "Unknown user"}
                        </span>
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
                        <span className="profile-list-name">
                          {person.name || person.username || "Unknown user"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="profile-empty-state">No followers yet.</p>
                )
              )}

              {activePanel === "events" && (
                createdEvents.length > 0 ? (
                  <div className="profile-list">
                    {createdEvents.map((event, index) => (
                      <div className="profile-list-item" key={event.id || index}>
                        <div className="profile-event-info">
                          <span className="profile-list-name">
                            {event.title || event.name || "Untitled Event"}
                          </span>
                          {(event.date || event.time) && (
                            <span className="profile-event-meta">
                              {[event.date, event.time].filter(Boolean).join(" • ")}
                            </span>
                          )}
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
                      src={draftProfileImage || currentProfileImage || defaultAvatar}
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
    </main>
  )
}

export default Profile
