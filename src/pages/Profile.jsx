import React from "react"
import defaultAvatar from "../assets/default-avatar.png"


function Profile() {
  const [name, setName] = useState("Success Myers")
  const [username, setUsername] = useState("itzmesuccess1")
  const [bio, setBio] = useState("UMES student • Event lover • Front-end builder")
  const [followers] = useState(117)
  const [following] = useState(88)

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isShareOpen, setIsShareOpen] = useState(false)

  const [draftName, setDraftName] = useState(name)
  const [draftUsername, setDraftUsername] = useState(username)
  const [draftBio, setDraftBio] = useState(bio)

  const profileLink = `https://campus-event-nav.app/${username}`

  const handleSaveProfile = () => {
    setName(draftName)
    setUsername(draftUsername)
    setBio(draftBio)
    setIsEditOpen(false)
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(profileLink)
      alert("Profile link copied!")
    } catch {
      alert("Could not copy link.")
    }
  }

  return (
    <main className="profile-page">
      <div className="profile-card">
        <div className="profile-top">
          <div className="profile-avatar-wrap">
            <img
              src={defaultAvatar}
              alt="Profile"
              className="profile-avatar"
            />
          </div>

          <div className="profile-main-info">
            <div className="profile-name-row">
              <h1>{username}</h1>
            </div>

            <div className="profile-stats">
              <div className="profile-stat">
                <strong>{followers}</strong>
                <span>Followers</span>
              </div>

              <div className="profile-stat">
                <strong>{following}</strong>
                <span>Following</span>
              </div>
            </div>

            <div className="profile-text-info">
              <h2>{name}</h2>
              <p>{bio}</p>
            </div>

            <div className="profile-actions">
              <button className="profile-btn" onClick={() => setIsEditOpen(true)}>
                Edit Profile
              </button>

              <button className="profile-btn secondary" onClick={() => setIsShareOpen(true)}>
                Share Profile
              </button>
            </div>
          </div>
        </div>

        <div className="profile-divider"></div>

        <div className="profile-bottom">
          <h3>Account Preview</h3>
          <p className="profile-preview-text">
            Later this section can show created events, attended events, shared events,
            and social activity.
          </p>
        </div>
      </div>

      {isEditOpen && (
        <div className="profile-modal-overlay" onClick={() => setIsEditOpen(false)}>
          <div className="profile-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Profile</h3>

            <label>Name</label>
            <input
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
            />

            <label>Username</label>
            <input
              type="text"
              value={draftUsername}
              onChange={(e) => setDraftUsername(e.target.value)}
            />

            <label>Bio</label>
            <textarea
              rows="4"
              value={draftBio}
              onChange={(e) => setDraftBio(e.target.value)}
            ></textarea>

            <div className="profile-modal-actions">
              <button className="profile-btn secondary" onClick={() => setIsEditOpen(false)}>
                Cancel
              </button>
              <button className="profile-btn" onClick={handleSaveProfile}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {isShareOpen && (
        <div className="profile-modal-overlay" onClick={() => setIsShareOpen(false)}>
          <div className="profile-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Share Profile</h3>

            <p className="share-text">Share your account with friends</p>

            <div className="share-link-box">{profileLink}</div>

            <div className="profile-modal-actions">
              <button className="profile-btn secondary" onClick={() => setIsShareOpen(false)}>
                Close
              </button>
              <button className="profile-btn" onClick={handleCopyLink}>
                Copy Link
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default Profile