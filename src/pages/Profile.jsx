import React, { useCallback, useEffect, useState } from "react"
import Cropper from "react-easy-crop"
import { useNavigate } from "react-router-dom"
import { useEvents } from "../context/EventContext"
import {
  DEFAULT_AVATAR_URL,
  sanitizeAvatarStorageValue,
  sanitizeAvatarUrl,
  syncStoredUserFromSession,
  uploadProfileImageToStorage,
} from "../profileMedia"
import { supabase } from "../supabaseClient"
import {
  ACCENT_COLOR_OPTIONS,
  applyAccentColor,
  applyThemeMode,
  getAccentOption,
  getStoredAccentColor,
  getStoredThemeMode,
  persistAccentColor,
  persistThemeMode,
  resolveThemeMode,
} from "../theme"
import { useToast } from "../context/ToastContext"
import { registerPushNotifications, unregisterPushNotifications } from "../pushNotifications"
import { navigateToProfile } from "../profileNavigation"
import ProfileContentTabs from "../components/ProfileContentTabs"
import { loadStoryHighlightsForUser } from "../storyHighlights"
import "./Profile.css"

const communityQuickAddItems = [
  { key: "group", label: "Add Group" },
  { key: "school", label: "Add School" },
  { key: "work", label: "Add Work" },
]

const profileHighlightItems = [
  { key: "new", label: "Add Highlight", tone: "new", symbol: "+" },
]

const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener("load", () => resolve(image))
    image.addEventListener("error", (error) => reject(error))
    image.setAttribute("crossOrigin", "anonymous")
    image.src = url
  })

const revokeObjectUrl = (value) => {
  if (typeof value === "string" && value.startsWith("blob:")) {
    URL.revokeObjectURL(value)
  }
}

async function getCroppedImageBlob(imageSrc, pixelCrop) {
  const image = await createImage(imageSrc)
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")

  if (!ctx) {
    throw new Error("Could not prepare the image crop.")
  }

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

  return new Promise((resolve, reject) => {
    canvas.toBlob((file) => {
      if (!file) {
        reject(new Error("Could not create the cropped image."))
        return
      }

      resolve(file)
    }, "image/jpeg")
  })
}

function Profile() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const {
    currentUser,
    allEvents,
    followingList,
    followersList,
    cancelRSVP,
    deleteEvent,
    updateEvent,
    follow,
    unfollow,
  } = useEvents()

  const [name, setName] = useState("")
  const [username, setUsername] = useState("")
  const [bio, setBio] = useState("")
  const [verificationStatus, setVerificationStatus] = useState("unverified")
  const [studentVerified, setStudentVerified] = useState(false)
  const [accountType, setAccountType] = useState("regular")

  const [activePanel, setActivePanel] = useState(null)
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false)
  const [isCropModalOpen, setIsCropModalOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [profileContentCounts, setProfileContentCounts] = useState({ posts: 0 })
  const [activeSettingsView, setActiveSettingsView] = useState("main")
  const [themeMode, setThemeMode] = useState(getStoredThemeMode)
  const [accentColor, setAccentColor] = useState(getStoredAccentColor)
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
  const [editingEventId, setEditingEventId] = useState(null)
  const [editEventForm, setEditEventForm] = useState({
    title: "",
    description: "",
    date: "",
    startTime: "",
    endTime: "",
    location: "",
    locationAddress: "",
    tags: "",
  })
  const [isSavingEditEvent, setIsSavingEditEvent] = useState(false)
  const [highlights, setHighlights] = useState([])

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
  const [draftProfileImagePreview, setDraftProfileImagePreview] = useState("")
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [rawSelectedImage, setRawSelectedImage] = useState(null)
  const ownerId = storedUser.id || currentUser?.id
  const ownerUsername = storedUser.username || username
  const currentProfileImage =
    sanitizeAvatarUrl(profileImage || storedUserAvatarValue, defaultAvatar)
  const isVerifiedProfile =
    verificationStatus === "verified" || studentVerified || accountType === "organization"

  useEffect(() => {
    return () => {
      revokeObjectUrl(rawSelectedImage)
      revokeObjectUrl(draftProfileImagePreview)
    }
  }, [draftProfileImagePreview, rawSelectedImage])

  const createdEvents = allEvents.filter(
    (event) =>
      String(event.createdBy) === String(ownerId) ||
      String(event.created_by) === String(ownerId) ||
      event.createdBy === ownerUsername ||
      event.creatorUsername === ownerUsername
  )
  const openPanel = (panelName) => {
    setActivePanel(panelName)
  }

  const closePanel = () => {
    setActivePanel(null)
  }

  const handleProfileContentCountsChange = useCallback((counts) => {
    setProfileContentCounts((prev) => ({
      ...prev,
      ...counts,
    }))
  }, [])

  const closeEditProfile = () => {
    setIsCropModalOpen(false)
    setIsEditProfileOpen(false)
    setRawSelectedImage(null)
    setDraftProfileImagePreview("")
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedAreaPixels(null)
  }

  const closeSettings = () => {
    setIsSettingsOpen(false)
    setActiveSettingsView("main")
  }

  const handleSettingToggle = (setter, key, currentValue) => {
    const next = !currentValue
    setter(next)
    const userId = JSON.parse(localStorage.getItem("user") || "{}").id
    if (!userId) return
    const updatedSettings = {
      pushNotifications,
      eventReminders,
      followerAlerts,
      dmAlerts,
      messageRequests,
      readReceipts,
      showOnlineStatus,
      privateProfile,
      showActivityStatus,
      followersOnlyDms,
      accentColor,
      [key]: next,
    }
    supabase
      .from("profiles")
      .update({ settings: updatedSettings })
      .eq("id", userId)
      .then(({ error }) => {
        if (error) console.error("Failed to save settings:", error)
      })

    if (key === "pushNotifications") {
      if (next) {
        registerPushNotifications(userId).then((ok) => {
          if (!ok) showToast("Could not enable push notifications in this browser.", "warning")
        })
      } else {
        unregisterPushNotifications(userId)
      }
    }
  }

  const resolvedTheme = resolveThemeMode(themeMode)

  useEffect(() => {
    persistThemeMode(themeMode)
    applyThemeMode(themeMode)
  }, [themeMode])

  useEffect(() => {
    const option = getAccentOption(accentColor)
    persistAccentColor(option.key)
    applyAccentColor(option.key)
  }, [accentColor])

  useEffect(() => {
    const userId = JSON.parse(localStorage.getItem("user") || "{}").id
    if (!userId) return

    supabase
      .from("profiles")
      .select("name, username, bio, avatar_url, settings, accent_color, student_verified, verification_status, account_type")
      .eq("id", userId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) return
        if (data.name) setName(data.name)
        if (data.username) setUsername(data.username)
        if (data.bio) setBio(data.bio)
        setStudentVerified(Boolean(data.student_verified))
        setVerificationStatus(data.verification_status || "unverified")
        setAccountType(data.account_type || "regular")
        if (data.accent_color) setAccentColor(getAccentOption(data.accent_color).key)
        const nextAvatarValue = sanitizeAvatarStorageValue(data.avatar_url, null) || ""
        setProfileImage(nextAvatarValue)
        localStorage.setItem("profileImage", nextAvatarValue)

        if (data.settings && typeof data.settings === "object") {
          const s = data.settings
          if (typeof s.pushNotifications === "boolean") setPushNotifications(s.pushNotifications)
          if (typeof s.eventReminders === "boolean") setEventReminders(s.eventReminders)
          if (typeof s.followerAlerts === "boolean") setFollowerAlerts(s.followerAlerts)
          if (typeof s.dmAlerts === "boolean") setDmAlerts(s.dmAlerts)
          if (typeof s.messageRequests === "boolean") setMessageRequests(s.messageRequests)
          if (typeof s.readReceipts === "boolean") setReadReceipts(s.readReceipts)
          if (typeof s.showOnlineStatus === "boolean") setShowOnlineStatus(s.showOnlineStatus)
          if (typeof s.privateProfile === "boolean") setPrivateProfile(s.privateProfile)
          if (typeof s.showActivityStatus === "boolean") setShowActivityStatus(s.showActivityStatus)
          if (typeof s.followersOnlyDms === "boolean") setFollowersOnlyDms(s.followersOnlyDms)
          if (!data.accent_color && typeof s.accentColor === "string") {
            setAccentColor(getAccentOption(s.accentColor).key)
          }
        }
      })
  }, [defaultAvatar])

  const handleAccentColorChange = (nextAccentColor) => {
    const option = getAccentOption(nextAccentColor)
    setAccentColor(option.key)

    const userId = JSON.parse(localStorage.getItem("user") || "{}").id
    if (!userId) return

    const updatedSettings = {
      pushNotifications,
      eventReminders,
      followerAlerts,
      dmAlerts,
      messageRequests,
      readReceipts,
      showOnlineStatus,
      privateProfile,
      showActivityStatus,
      followersOnlyDms,
      accentColor: option.key,
    }

    supabase
      .from("profiles")
      .update({ settings: updatedSettings, accent_color: option.key })
      .eq("id", userId)
      .then(({ error }) => {
        if (error) console.error("Failed to save accent color:", error)
      })
  }

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

    const userId = currentUser?.id && currentUser.id !== "current-user"
      ? currentUser.id
      : null
    if (userId) {
      const { error: authUpdateError } = await supabase.auth.updateUser({
        data: {
          name: draftName,
          username: draftUsername,
          avatar_url: nextProfileImageValue || null,
        },
      })
      if (authUpdateError) {
        showToast(authUpdateError.message || "Failed to update account.", "error")
        return
      }

      const { error: profileUpsertError } = await supabase
        .from("profiles")
        .upsert({
          id: userId,
          name: draftName,
          username: draftUsername,
          bio: draftBio,
          avatar_url: nextProfileImageValue || null,
          updated_at: new Date().toISOString(),
        })
      if (profileUpsertError) {
        showToast(profileUpsertError.message || "Failed to save profile.", "error")
        return
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()
      await syncStoredUserFromSession(session)
    }

    showToast("Profile saved.", "success")
    closeEditProfile()
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
    setCroppedAreaPixels(null)
    setIsCropModalOpen(true)
    e.target.value = ""
  }

  const handleCommunityQuickAdd = (item) => {
    showToast(`${item.label.replace("Add ", "")} affiliations are coming soon.`, "info")
  }

  const handleProfileHighlight = (item) => {
    if (item.key === "new") {
      showToast("Highlight creation is coming soon.", "info")
      return
    }

    showToast(`${item.label} highlights are coming soon.`, "info")
  }

  const handleOpenStoryShortcut = () => {
    navigate("/home?create=story")
  }

  useEffect(() => {
    let isActive = true

    loadStoryHighlightsForUser(ownerId).then(({ highlights: nextHighlights }) => {
      if (isActive) setHighlights(nextHighlights)
    })

    return () => {
      isActive = false
    }
  }, [ownerId])

  const handleApplyCrop = async () => {
    if (!rawSelectedImage || !croppedAreaPixels) return

    let previewUrl = ""

    try {
      const croppedImageBlob = await getCroppedImageBlob(
        rawSelectedImage,
        croppedAreaPixels
      )
      previewUrl = URL.createObjectURL(croppedImageBlob)
      setDraftProfileImagePreview(previewUrl)
      setIsCropModalOpen(false)
      setRawSelectedImage(null)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setCroppedAreaPixels(null)

      const userId = currentUser?.id && currentUser.id !== "current-user"
        ? currentUser.id
        : null
      if (!userId) {
        setDraftProfileImagePreview("")
        showToast("You must be logged in to upload a profile picture.", "error")
        return
      }

      const nextAvatar = await uploadProfileImageToStorage({
        userId,
        file: croppedImageBlob,
        fileName: `${userId}.jpg`,
        contentType: "image/jpeg",
        fallbackUrl: draftProfileImage || profileImage || storedUserAvatarValue || null,
        throwOnError: true,
      })

      if (!nextAvatar) {
        throw new Error("Could not upload your photo. Please try again.")
      }

      setDraftProfileImage(nextAvatar)
    } catch (error) {
      setDraftProfileImagePreview("")
      console.error("Error cropping image:", error)
      showToast(error?.message || "Could not upload your photo. Please try again.", "error")
    }
  }

  const handleCancelCrop = () => {
    setIsCropModalOpen(false)
    setRawSelectedImage(null)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedAreaPixels(null)
  }

  const handleLogout = () => {
    closeSettings()
    navigate("/auth/logout")
  }

  const openDeleteModal = (event) => {
    setConfirmModal({ open: true, type: "delete", event })
  }

  const openEditEventModal = (event) => {
    if (!event) return

    const rawTags = Array.isArray(event.tags)
      ? event.tags
      : typeof event.tags === "string"
        ? event.tags.split(",")
        : []

    setEditEventForm({
      title: event.title || "",
      description: event.description || "",
      date: event.date || event.eventDate || "",
      startTime: event.startTime || "",
      endTime: event.endTime || "",
      location: event.location || event.locationName || "",
      locationAddress: event.locationAddress || "",
      tags: rawTags
        .map((tag) => String(tag).replace(/^#/, "").trim())
        .filter(Boolean)
        .join(", "),
    })
    setEditingEventId(event.id)
  }

  const closeEditEventModal = () => {
    setEditingEventId(null)
    setIsSavingEditEvent(false)
  }

  const handleEditEventFieldChange = (field) => (fieldEvent) => {
    const nextValue = fieldEvent.target.value
    setEditEventForm((prev) => ({ ...prev, [field]: nextValue }))
  }

  const handleSaveEditEvent = async () => {
    if (!editingEventId || isSavingEditEvent) return

    const title = editEventForm.title.trim()
    if (!title) {
      showToast("Title is required.", "warning")
      return
    }

    const parsedTags = editEventForm.tags
      .split(",")
      .map((tag) => tag.replace(/^#/, "").trim().toLowerCase())
      .filter(Boolean)

    const payload = {
      title,
      description: editEventForm.description.trim() || null,
      location: editEventForm.location.trim() || null,
      location_address: editEventForm.locationAddress.trim() || null,
      date: editEventForm.date.trim() || null,
      start_time: editEventForm.startTime.trim() || null,
      end_time: editEventForm.endTime.trim() || null,
      tags: parsedTags,
    }

    try {
      setIsSavingEditEvent(true)

      const { error } = await supabase
        .from("events")
        .update(payload)
        .eq("id", editingEventId)

      if (error) {
        showToast(error.message, "error")
        return
      }

      updateEvent(editingEventId, {
        title: payload.title,
        description: payload.description || "",
        location: payload.location || "",
        locationAddress: payload.location_address || "",
        date: payload.date || "",
        startTime: payload.start_time || "",
        endTime: payload.end_time || "",
        tags: parsedTags,
      })

      showToast("Event saved.", "success")
      closeEditEventModal()
    } catch (error) {
      showToast(error?.message || "Could not save the event.", "error")
    } finally {
      setIsSavingEditEvent(false)
    }
  }

  const closeConfirmModal = () => {
    setConfirmModal({ open: false, type: "", event: null })
  }

  const handleConfirmAction = async () => {
    const event = confirmModal.event
    if (!event || isConfirmingAction) return
    if (!currentUser?.id || currentUser.id === "current-user") {
      showToast("You must be signed in to do that.", "error")
      return
    }

    try {
      setIsConfirmingAction(true)

      if (confirmModal.type === "cancel-rsvp") {
        const { error: rsvpError } = await supabase
          .from("rsvps")
          .delete()
          .eq("event_id", event.id)
          .eq("user_id", currentUser.id)

        if (rsvpError) {
          showToast(rsvpError.message, "error")
          return
        }

        const nextGoingCount = Math.max((event.goingCount || 1) - 1, 0)

        const { error: eventUpdateError } = await supabase
          .from("events")
          .update({ going_count: nextGoingCount })
          .eq("id", event.id)

        if (eventUpdateError) {
          showToast(eventUpdateError.message, "error")
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
          showToast(rsvpsDeleteError.message, "error")
          return
        }

        const { error: eventDeleteError } = await supabase
          .from("events")
          .delete()
          .eq("id", event.id)
          .eq("created_by", currentUser.id)

        if (eventDeleteError) {
          showToast(eventDeleteError.message, "error")
          return
        }

        deleteEvent(event.id)
        showToast("Event deleted.", "success")
      }

      closeConfirmModal()
    } catch (error) {
      showToast(error.message || "Something went wrong.", "error")
    } finally {
      setIsConfirmingAction(false)
    }
  }

  return (
    <main className="profile-page">
      <div className="profile-card">
        <button
          type="button"
          className="profile-settings-trigger"
          onClick={() => navigate("/settings")}
          aria-label="Open profile settings"
          title="Settings"
        >
          <span aria-hidden="true">...</span>
        </button>

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
            <button
              type="button"
              className="profile-avatar-story-add"
              onClick={handleOpenStoryShortcut}
              aria-label="Create a story"
            >
              +
            </button>
          </div>

          <div className="profile-info">
            <h1 className="username">{username}</h1>
            <h2 className="real-name">
              <span>{name}</span>
              {isVerifiedProfile ? (
                <span className="profile-verified-badge" aria-label="Verified">
                  <span className="profile-verified-burst" aria-hidden="true" />
                  <span className="profile-verified-check" aria-hidden="true">✓</span>
                </span>
              ) : null}
            </h2>

            <div className="profile-stats">
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
                onClick={() => openPanel("following")}
              >
                <span className="profile-stat-number">{followingList.length}</span>
                <span className="profile-stat-label">Following</span>
              </button>

              <button
                type="button"
                className="profile-stat-card"
                onClick={() => openPanel("events")}
              >
                <span className="profile-stat-number">{createdEvents.length}</span>
                <span className="profile-stat-label">Host</span>
              </button>

              <div className="profile-stat-card static">
                <span className="profile-stat-number">{profileContentCounts.posts}</span>
                <span className="profile-stat-label">Posts</span>
              </div>
            </div>

            <p className="bio">{bio}</p>

            <div className="community-quick-add-row" aria-label="Community affiliations">
              {communityQuickAddItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className="community-quick-add-pill"
                  onClick={() => handleCommunityQuickAdd(item)}
                >
                  <span className="community-quick-add-plus" aria-hidden="true">+</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>

            <div className="profile-highlights-row" aria-label="Profile highlights">
              {profileHighlightItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`profile-highlight-item profile-highlight-item--${item.tone}`}
                  onClick={() => handleProfileHighlight(item)}
                >
                  <span className="profile-highlight-thumb" aria-hidden="true">
                    <span>{item.symbol}</span>
                  </span>
                  <span className="profile-highlight-label">{item.label}</span>
                </button>
              ))}
              {highlights.map((highlight) => (
                <button
                  key={highlight.id}
                  type="button"
                  className="profile-highlight-item"
                  onClick={() => handleProfileHighlight(highlight)}
                >
                  <span className="profile-highlight-thumb" aria-hidden="true">
                    {highlight.coverUrl ? (
                      <img src={highlight.coverUrl} alt="" />
                    ) : (
                      <span>□</span>
                    )}
                  </span>
                  <span className="profile-highlight-label">{highlight.title}</span>
                </button>
              ))}
            </div>

            <div className="profile-action-row">
              <button
                type="button"
                className="profile-action-btn"
                onClick={() => navigate("/edit-profile")}
              >
                Edit Profile
              </button>
              <button
                type="button"
                className="profile-action-btn secondary"
                onClick={() => navigate("/recaps")}
              >
                Recaps
              </button>
              <button
                type="button"
                className="profile-action-btn secondary"
                onClick={() => navigate("/settings")}
              >
                Settings
              </button>
            </div>
          </div>
        </div>

        <div className="profile-content-stack">
          <ProfileContentTabs
            profileId={ownerId}
            isOwner
            allEvents={allEvents}
            onContentCountsChange={handleProfileContentCountsChange}
          />
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
                          onClick={() => { closePanel(); navigateToProfile(navigate, person, currentUser) }}
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
                          onClick={() => { closePanel(); navigateToProfile(navigate, person, currentUser) }}
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
                              className="profile-edit-btn"
                              onClick={() => openEditEventModal(event)}
                            >
                              Edit
                            </button>
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
                      src={
                        draftProfileImagePreview ||
                        sanitizeAvatarUrl(
                          draftProfileImage || currentProfileImage || defaultAvatar,
                          defaultAvatar
                        )
                      }
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
                        onClick={() => handleSettingToggle(setPushNotifications, "pushNotifications", pushNotifications)}
                      >
                        <span />
                      </button>
                    </div>

                    <div className="settings-toggle-row">
                      <span>Event reminders</span>
                      <button
                        type="button"
                        className={`settings-toggle ${eventReminders ? "on" : ""}`}
                        onClick={() => handleSettingToggle(setEventReminders, "eventReminders", eventReminders)}
                      >
                        <span />
                      </button>
                    </div>

                    <div className="settings-toggle-row">
                      <span>New follower alerts</span>
                      <button
                        type="button"
                        className={`settings-toggle ${followerAlerts ? "on" : ""}`}
                        onClick={() => handleSettingToggle(setFollowerAlerts, "followerAlerts", followerAlerts)}
                      >
                        <span />
                      </button>
                    </div>

                    <div className="settings-toggle-row">
                      <span>DM alerts</span>
                      <button
                        type="button"
                        className={`settings-toggle ${dmAlerts ? "on" : ""}`}
                        onClick={() => handleSettingToggle(setDmAlerts, "dmAlerts", dmAlerts)}
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
                        onClick={() => handleSettingToggle(setMessageRequests, "messageRequests", messageRequests)}
                      >
                        <span />
                      </button>
                    </div>

                    <div className="settings-toggle-row">
                      <span>Read receipts</span>
                      <button
                        type="button"
                        className={`settings-toggle ${readReceipts ? "on" : ""}`}
                        onClick={() => handleSettingToggle(setReadReceipts, "readReceipts", readReceipts)}
                      >
                        <span />
                      </button>
                    </div>

                    <div className="settings-toggle-row">
                      <span>Show online status</span>
                      <button
                        type="button"
                        className={`settings-toggle ${showOnlineStatus ? "on" : ""}`}
                        onClick={() => handleSettingToggle(setShowOnlineStatus, "showOnlineStatus", showOnlineStatus)}
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
                        onClick={() => handleSettingToggle(setPrivateProfile, "privateProfile", privateProfile)}
                      >
                        <span />
                      </button>
                    </div>

                    <div className="settings-toggle-row">
                      <span>Show activity status</span>
                      <button
                        type="button"
                        className={`settings-toggle ${showActivityStatus ? "on" : ""}`}
                        onClick={() => handleSettingToggle(setShowActivityStatus, "showActivityStatus", showActivityStatus)}
                      >
                        <span />
                      </button>
                    </div>

                    <div className="settings-toggle-row">
                      <span>Allow DMs from followers only</span>
                      <button
                        type="button"
                        className={`settings-toggle ${followersOnlyDms ? "on" : ""}`}
                        onClick={() => handleSettingToggle(setFollowersOnlyDms, "followersOnlyDms", followersOnlyDms)}
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

                  <div className="settings-accent-section">
                    <h5>Accent Color</h5>
                    <div className="settings-accent-grid">
                      {ACCENT_COLOR_OPTIONS.map((option) => (
                        <button
                          key={option.key}
                          type="button"
                          className={`settings-accent-swatch ${accentColor === option.key ? "active" : ""}`}
                          style={{ "--swatch-color": option.color }}
                          onClick={() => handleAccentColorChange(option.key)}
                          aria-label={`Use ${option.label} accent`}
                        >
                          <span />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {editingEventId && (
        <div className="profile-overlay" onClick={closeEditEventModal}>
          <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
            <div className="profile-modal-header">
              <h3>Edit Event</h3>
              <button
                type="button"
                className="profile-modal-close"
                onClick={closeEditEventModal}
                aria-label="Close edit event"
              >
                ×
              </button>
            </div>

            <div className="profile-modal-body">
              <form className="edit-profile-form" onSubmit={(e) => e.preventDefault()}>
                <label className="edit-event-field">
                  <span>Title</span>
                  <input
                    type="text"
                    value={editEventForm.title}
                    onChange={handleEditEventFieldChange("title")}
                    placeholder="Event title"
                    maxLength={120}
                  />
                </label>

                <label className="edit-event-field">
                  <span>Description</span>
                  <textarea
                    value={editEventForm.description}
                    onChange={handleEditEventFieldChange("description")}
                    placeholder="Describe this event"
                    rows={3}
                    maxLength={600}
                  />
                </label>

                <div className="edit-event-row">
                  <label className="edit-event-field">
                    <span>Date</span>
                    <input
                      type="text"
                      value={editEventForm.date}
                      onChange={handleEditEventFieldChange("date")}
                      placeholder="e.g. Fri, Apr 19"
                    />
                  </label>
                  <label className="edit-event-field">
                    <span>Start</span>
                    <input
                      type="text"
                      value={editEventForm.startTime}
                      onChange={handleEditEventFieldChange("startTime")}
                      placeholder="6:00 PM"
                    />
                  </label>
                  <label className="edit-event-field">
                    <span>End</span>
                    <input
                      type="text"
                      value={editEventForm.endTime}
                      onChange={handleEditEventFieldChange("endTime")}
                      placeholder="9:00 PM"
                    />
                  </label>
                </div>

                <label className="edit-event-field">
                  <span>Location</span>
                  <input
                    type="text"
                    value={editEventForm.location}
                    onChange={handleEditEventFieldChange("location")}
                    placeholder="Venue name"
                  />
                </label>

                <label className="edit-event-field">
                  <span>Address</span>
                  <input
                    type="text"
                    value={editEventForm.locationAddress}
                    onChange={handleEditEventFieldChange("locationAddress")}
                    placeholder="Street address"
                  />
                </label>

                <label className="edit-event-field">
                  <span>Tags</span>
                  <input
                    type="text"
                    value={editEventForm.tags}
                    onChange={handleEditEventFieldChange("tags")}
                    placeholder="comma separated"
                  />
                </label>

                <div className="edit-event-actions">
                  <button
                    type="button"
                    className="edit-event-cancel"
                    onClick={closeEditEventModal}
                    disabled={isSavingEditEvent}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="edit-event-save"
                    onClick={handleSaveEditEvent}
                    disabled={isSavingEditEvent || !editEventForm.title.trim()}
                  >
                    {isSavingEditEvent ? "Saving..." : "Save"}
                  </button>
                </div>
              </form>
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
