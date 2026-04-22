import React, { useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useEvents } from "../context/EventContext"
import { useToast } from "../context/ToastContext"
import {
  DEFAULT_AVATAR_URL,
  sanitizeAvatarStorageValue,
  sanitizeAvatarUrl,
  syncStoredUserFromSession,
  uploadProfileImageToStorage,
} from "../profileMedia"
import { supabase } from "../supabaseClient"
import "./Settings.css"

const trimHandle = (value) => String(value || "").trim().replace(/^@+/, "")

function EditProfile() {
  const navigate = useNavigate()
  const { currentUser } = useEvents()
  const { showToast } = useToast()
  const userId =
    currentUser?.id && currentUser.id !== "current-user" ? currentUser.id : ""

  const [form, setForm] = useState({
    name: currentUser?.name || "",
    username: trimHandle(currentUser?.username),
    bio: "",
    website: "",
    school: currentUser?.school || "",
    avatarValue: currentUser?.avatarStorageValue || currentUser?.avatar_url || "",
  })
  const [selectedPhoto, setSelectedPhoto] = useState(null)
  const [selectedPhotoPreview, setSelectedPhotoPreview] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const avatarPreview = useMemo(
    () =>
      selectedPhotoPreview ||
      sanitizeAvatarUrl(form.avatarValue, currentUser?.image || DEFAULT_AVATAR_URL),
    [currentUser?.image, form.avatarValue, selectedPhotoPreview]
  )

  useEffect(() => {
    let isMounted = true

    const loadProfile = async () => {
      if (!userId) {
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      const { data, error } = await supabase
        .from("profiles")
        .select("name, username, bio, avatar_url, school, organization_website")
        .eq("id", userId)
        .maybeSingle()

      if (!isMounted) return

      if (error) {
        console.error("Unable to load edit profile data:", error)
        showToast("Could not load your profile details.", "error")
      } else if (data) {
        setForm({
          name: data.name || currentUser?.name || "",
          username: trimHandle(data.username || currentUser?.username),
          bio: data.bio || "",
          website: data.organization_website || "",
          school: data.school || currentUser?.school || "",
          avatarValue: sanitizeAvatarStorageValue(data.avatar_url, null) || "",
        })
      }

      setIsLoading(false)
    }

    loadProfile()

    return () => {
      isMounted = false
    }
  }, [currentUser?.name, currentUser?.school, currentUser?.username, showToast, userId])

  useEffect(
    () => () => {
      if (selectedPhotoPreview) URL.revokeObjectURL(selectedPhotoPreview)
    },
    [selectedPhotoPreview]
  )

  const updateField = (key, value) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }))
  }

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (selectedPhotoPreview) URL.revokeObjectURL(selectedPhotoPreview)
    setSelectedPhoto(file)
    setSelectedPhotoPreview(URL.createObjectURL(file))
    event.target.value = ""
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!userId) {
      showToast("Please sign in again to edit your profile.", "error")
      return
    }

    const nextName = form.name.trim()
    const nextUsername = trimHandle(form.username)
    const nextBio = form.bio.trim()
    const nextWebsite = form.website.trim()
    const nextSchool = form.school.trim()

    if (!nextName || !nextUsername) {
      showToast("Name and username are required.", "warning")
      return
    }

    setIsSaving(true)
    try {
      let nextAvatarValue =
        sanitizeAvatarStorageValue(form.avatarValue, currentUser?.avatarStorageValue || null) ||
        ""

      if (selectedPhoto) {
        nextAvatarValue = await uploadProfileImageToStorage({
          userId,
          file: selectedPhoto,
          fileName: selectedPhoto.name,
          contentType: selectedPhoto.type,
          fallbackUrl: nextAvatarValue || null,
          throwOnError: true,
        })
      }

      const authPayload = {
        name: nextName,
        username: nextUsername,
        bio: nextBio,
        avatar_url: nextAvatarValue || null,
        school: nextSchool || null,
        organization_website: nextWebsite || null,
      }
      const { error: authError } = await supabase.auth.updateUser({
        data: authPayload,
      })

      if (authError) {
        throw authError
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(
          {
            id: userId,
            name: nextName,
            username: nextUsername,
            bio: nextBio,
            avatar_url: nextAvatarValue || null,
            organization_website: nextWebsite || null,
            school: nextSchool || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        )

      if (profileError) {
        throw profileError
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()
      await syncStoredUserFromSession(session)

      setForm((current) => ({
        ...current,
        name: nextName,
        username: nextUsername,
        bio: nextBio,
        website: nextWebsite,
        school: nextSchool,
        avatarValue: nextAvatarValue || "",
      }))
      setSelectedPhoto(null)
      setSelectedPhotoPreview("")
      showToast("Profile saved.", "success")
      navigate("/profile")
    } catch (error) {
      console.error("Unable to save edit profile changes:", error)
      showToast(error?.message || "Could not save your profile.", "error")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="settings-page edit-profile-page">
      <aside className="settings-sidebar edit-profile-sidebar" aria-label="Edit profile navigation">
        <div className="settings-sidebar-header">
          <h1>Settings</h1>
        </div>
        <div className="settings-nav-list">
          <section className="settings-nav-group">
            <h2>Your account</h2>
            <Link className="settings-nav-row active" to="/edit-profile">
              <span className="settings-nav-icon settings-nav-dot" aria-hidden="true" />
              <span>
                <strong>Edit profile</strong>
                <em>Name, photo, bio, and campus details.</em>
              </span>
            </Link>
            <Link className="settings-nav-row" to="/settings?section=notifications">
              <span className="settings-nav-icon settings-nav-dot" aria-hidden="true" />
              <span>
                <strong>Notifications</strong>
              </span>
            </Link>
            <Link className="settings-nav-row" to="/settings?section=privacy">
              <span className="settings-nav-icon settings-nav-dot" aria-hidden="true" />
              <span>
                <strong>Privacy</strong>
              </span>
            </Link>
          </section>
        </div>
      </aside>

      <section className="settings-main-panel">
        <form className="edit-profile-form" onSubmit={handleSubmit}>
          <div className="settings-panel-heading">
            <p>Profile</p>
            <h2>Edit profile</h2>
            <span>Update the public details people see around campus.</span>
          </div>

          <div className="settings-profile-card edit-profile-identity">
            <img src={avatarPreview} alt="" />
            <div>
              <strong>{form.username ? `@${form.username}` : "Set a username"}</strong>
              <span>{form.name || "Add your display name"}</span>
            </div>
            <label className="settings-primary-link edit-photo-trigger">
              Change photo
              <input type="file" accept="image/*" onChange={handlePhotoChange} />
            </label>
          </div>

          <label className="edit-profile-field">
            <span>Display name</span>
            <input
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
              placeholder="Display name"
              disabled={isLoading || isSaving}
            />
          </label>

          <label className="edit-profile-field">
            <span>Username</span>
            <input
              value={form.username}
              onChange={(event) => updateField("username", event.target.value)}
              placeholder="username"
              disabled={isLoading || isSaving}
            />
          </label>

          <label className="edit-profile-field">
            <span>Bio</span>
            <textarea
              value={form.bio}
              onChange={(event) => updateField("bio", event.target.value.slice(0, 150))}
              placeholder="Tell people what you are about."
              disabled={isLoading || isSaving}
              rows={4}
            />
            <em>{form.bio.length} / 150</em>
          </label>

          <label className="edit-profile-field">
            <span>Website or link</span>
            <input
              value={form.website}
              onChange={(event) => updateField("website", event.target.value)}
              placeholder="https://"
              disabled={isLoading || isSaving}
            />
          </label>

          <label className="edit-profile-field">
            <span>School or campus</span>
            <input
              value={form.school}
              onChange={(event) => updateField("school", event.target.value)}
              placeholder="Campus"
              disabled={isLoading || isSaving}
            />
          </label>

          <div className="edit-profile-submit-row">
            <Link className="settings-secondary-link" to="/profile">
              Cancel
            </Link>
            <button type="submit" disabled={isLoading || isSaving}>
              {isSaving ? "Saving..." : "Submit"}
            </button>
          </div>
        </form>
      </section>
    </main>
  )
}

export default EditProfile
