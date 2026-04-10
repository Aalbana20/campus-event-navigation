import React, { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { sanitizeAvatarUrl, uploadProfileImageToStorage } from "../profileMedia"
import { supabase } from "../supabaseClient"

const INTEREST_OPTIONS = [
  "sports",
  "music",
  "parties",
  "movies",
  "networking",
  "arts",
  "food",
  "wellness",
]

const AVATAR_OPTIONS = [
  {
    id: "sunset",
    label: "Sunset",
    value:
      "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'%3E%3Cdefs%3E%3ClinearGradient id='g1' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop stop-color='%23fb7185'/%3E%3Cstop offset='1' stop-color='%23f59e0b'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='96' height='96' rx='28' fill='url(%23g1)'/%3E%3Ccircle cx='48' cy='35' r='17' fill='rgba(255,255,255,0.92)'/%3E%3Cpath d='M24 78c4-16 18-24 24-24s20 8 24 24' fill='rgba(255,255,255,0.88)'/%3E%3C/svg%3E",
  },
  {
    id: "ocean",
    label: "Ocean",
    value:
      "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'%3E%3Cdefs%3E%3ClinearGradient id='g2' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop stop-color='%2322c55e'/%3E%3Cstop offset='1' stop-color='%230ea5e9'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='96' height='96' rx='28' fill='url(%23g2)'/%3E%3Ccircle cx='48' cy='35' r='17' fill='rgba(255,255,255,0.92)'/%3E%3Cpath d='M24 78c4-16 18-24 24-24s20 8 24 24' fill='rgba(255,255,255,0.88)'/%3E%3C/svg%3E",
  },
  {
    id: "midnight",
    label: "Midnight",
    value:
      "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'%3E%3Cdefs%3E%3ClinearGradient id='g3' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop stop-color='%233b82f6'/%3E%3Cstop offset='1' stop-color='%237c3aed'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='96' height='96' rx='28' fill='url(%23g3)'/%3E%3Ccircle cx='48' cy='35' r='17' fill='rgba(255,255,255,0.92)'/%3E%3Cpath d='M24 78c4-16 18-24 24-24s20 8 24 24' fill='rgba(255,255,255,0.88)'/%3E%3C/svg%3E",
  },
  {
    id: "blush",
    label: "Blush",
    value:
      "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'%3E%3Cdefs%3E%3ClinearGradient id='g4' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop stop-color='%23f472b6'/%3E%3Cstop offset='1' stop-color='%23ec4899'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='96' height='96' rx='28' fill='url(%23g4)'/%3E%3Ccircle cx='48' cy='35' r='17' fill='rgba(255,255,255,0.92)'/%3E%3Cpath d='M24 78c4-16 18-24 24-24s20 8 24 24' fill='rgba(255,255,255,0.88)'/%3E%3C/svg%3E",
  },
]

const normalizeUsername = (value) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, "")
    .replace(/^[._]+|[._]+$/g, "")

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error("Could not read the selected image."))
    reader.readAsDataURL(file)
  })

const buildProfileSummary = (interests) =>
  interests.length > 0
    ? `Into ${interests.slice(0, 3).join(", ")}`
    : "Exploring campus events and new people."

function SignUp() {
  const [fullName, setFullName] = useState("")
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [birthday, setBirthday] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [selectedInterests, setSelectedInterests] = useState(["music", "networking"])
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_OPTIONS[0].value)
  const [profileImageFile, setProfileImageFile] = useState(null)
  const [profileImagePreview, setProfileImagePreview] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const navigate = useNavigate()
  const avatarPreview = profileImagePreview || selectedAvatar

  const toggleInterest = (interest) => {
    setSelectedInterests((currentInterests) =>
      currentInterests.includes(interest)
        ? currentInterests.filter((item) => item !== interest)
        : [...currentInterests, interest]
    )
  }

  const handleProfileImageChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const preview = await readFileAsDataUrl(file)
      setProfileImageFile(file)
      setProfileImagePreview(preview)
    } catch (error) {
      setErrorMessage(error.message || "Could not load that image.")
    }
  }

  const handleSignUp = async (e) => {
    e.preventDefault()

    try {
      setIsLoading(true)
      setErrorMessage("")
      const cleanEmail = email.trim().toLowerCase()
      const cleanUsername = normalizeUsername(username)
      const cleanFullName = fullName.trim()
      const cleanPhoneNumber = phoneNumber.trim()
      const cleanBirthday = birthday.trim()

      if (!cleanUsername) {
        setErrorMessage("Username is required.")
        return
      }

      if (!cleanEmail) {
        setErrorMessage("Email is required.")
        return
      }

      if (!password) {
        setErrorMessage("Password is required.")
        return
      }

      if (!cleanBirthday) {
        setErrorMessage("Birthday is required.")
        return
      }

      if (new Date(cleanBirthday) > new Date()) {
        setErrorMessage("Birthday must be a valid date.")
        return
      }

      if (password !== confirmPassword) {
        setErrorMessage("Passwords do not match.")
        return
      }

      const { data: existingProfile, error: usernameLookupError } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", cleanUsername)
        .maybeSingle()

      if (usernameLookupError && usernameLookupError.code !== "PGRST116") {
        setErrorMessage("We could not validate that username. Please try again.")
        return
      }

      if (existingProfile) {
        setErrorMessage("That username is already taken.")
        return
      }

      const fallbackAvatar = sanitizeAvatarUrl(selectedAvatar)

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            username: cleanUsername,
            name: cleanFullName || cleanUsername,
            phone_number: cleanPhoneNumber,
            birthday: cleanBirthday,
            interests: selectedInterests,
            avatar_url: fallbackAvatar,
          },
        },
      })

      if (error) {
        setErrorMessage(error.message)
        return
      }

      if (!data.user) {
        setErrorMessage("Signup failed.")
        return
      }

      const avatarUrl =
        data.session && profileImageFile
          ? await uploadProfileImageToStorage({
              userId: data.user.id,
              file: profileImageFile,
              fileName: profileImageFile.name,
              contentType: profileImageFile.type,
              fallbackUrl: fallbackAvatar,
            })
          : fallbackAvatar

      if (data.session) {
        const { error: metadataError } = await supabase.auth.updateUser({
          data: {
            username: cleanUsername,
            name: cleanFullName || cleanUsername,
            phone_number: cleanPhoneNumber,
            birthday: cleanBirthday,
            interests: selectedInterests,
            avatar_url: avatarUrl,
          },
        })

        if (metadataError) {
          console.error("Auth metadata update failed:", metadataError)
        }
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({
          id: data.user.id,
          name: cleanFullName || cleanUsername,
          username: cleanUsername,
          bio: buildProfileSummary(selectedInterests),
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        })

      if (profileError) {
        console.error("Profile setup failed:", profileError)
      }

      if (data.session) {
        await supabase.auth.signOut()
      }

      localStorage.removeItem("user")
      sessionStorage.setItem(
        "authMessage",
        profileError
          ? "Account created. Log in to finish your profile setup."
          : "Account created. Log in with your new account."
      )
      navigate("/auth/login", { replace: true })
    } catch (error) {
      setErrorMessage(error.message || "Signup failed.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="login-page signup-page">
      <div className="signup-shell">
        <section className="signup-aside">
          <p className="signup-kicker">Join the social side of campus</p>
          <h1>Build your profile before the first invite hits.</h1>
          <p className="signup-aside-copy">
            Set up the basics people actually use to recognize you: your name, handle, vibe, and the
            kinds of events you want more of.
          </p>

          <div className="signup-aside-highlights">
            <div className="signup-highlight-pill">Find your people faster</div>
            <div className="signup-highlight-pill">Share the right events</div>
            <div className="signup-highlight-pill">Start with a profile that feels real</div>
          </div>
        </section>

        <section className="login-card signup-card">
          <p className="signup-card-kicker">Create account</p>
          <h1>Sign Up</h1>
          <p className="login-subtext">
            A few profile details now make Discover, DMs, and event sharing feel a lot more social later.
          </p>

          {errorMessage && <p className="auth-error">{errorMessage}</p>}

          <form className="login-form signup-form" onSubmit={handleSignUp}>
            <div className="signup-avatar-section">
              <div className="signup-avatar-preview-wrap">
                <img src={avatarPreview} alt="Profile preview" className="signup-avatar-preview" />
                <div>
                  <p className="signup-section-label">Profile look</p>
                  <p className="signup-field-helper">
                    Pick a placeholder avatar now, or upload a profile image if you want to personalize it.
                  </p>
                </div>
              </div>

              <div className="signup-avatar-options">
                {AVATAR_OPTIONS.map((avatar) => (
                  <button
                    key={avatar.id}
                    type="button"
                    className={`signup-avatar-option ${selectedAvatar === avatar.value && !profileImagePreview ? "active" : ""}`}
                    onClick={() => {
                      setSelectedAvatar(avatar.value)
                      setProfileImageFile(null)
                      setProfileImagePreview("")
                    }}
                    aria-pressed={selectedAvatar === avatar.value && !profileImagePreview}
                  >
                    <img src={avatar.value} alt={avatar.label} />
                  </button>
                ))}
              </div>

              <label className="signup-upload-btn">
                <input type="file" accept="image/*" onChange={handleProfileImageChange} />
                Upload image
              </label>
            </div>

            <div className="signup-grid">
              <label className="signup-field signup-field-full">
                <span>Full Name</span>
                <input
                  type="text"
                  placeholder="Avery Jordan"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                />
              </label>

              <label className="signup-field">
                <span>Username</span>
                <input
                  type="text"
                  placeholder="averyafterdark"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </label>

              <label className="signup-field">
                <span>Email</span>
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </label>

              <label className="signup-field">
                <span>Phone Number</span>
                <input
                  type="tel"
                  placeholder="(410) 555-0123"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  autoComplete="tel"
                />
              </label>

              <label className="signup-field">
                <span>Birthday</span>
                <input
                  type="date"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                  required
                />
              </label>

              <label className="signup-field">
                <span>Password</span>
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </label>

              <label className="signup-field">
                <span>Confirm Password</span>
                <input
                  type="password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </label>
            </div>

            <div className="signup-interests-section">
              <div>
                <p className="signup-section-label">Starter interests</p>
                <p className="signup-field-helper">
                  Optional now, but useful for shaping a more social Explore feed later.
                </p>
              </div>

              <div className="signup-interest-grid">
                {INTEREST_OPTIONS.map((interest) => (
                  <button
                    key={interest}
                    type="button"
                    className={`signup-interest-chip ${selectedInterests.includes(interest) ? "active" : ""}`}
                    onClick={() => toggleInterest(interest)}
                    aria-pressed={selectedInterests.includes(interest)}
                  >
                    {interest}
                  </button>
                ))}
              </div>
            </div>

            <button className="login-btn signup-submit-btn" type="submit" disabled={isLoading}>
              {isLoading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <p className="login-footer">
            Already have an account? <Link to="/auth/login">Log in</Link>
          </p>
        </section>
      </div>
    </main>
  )
}

export default SignUp
