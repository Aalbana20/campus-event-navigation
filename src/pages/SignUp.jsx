import React, { useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  sanitizeAvatarStorageValue,
  uploadProfileImageToStorage,
} from "../profileMedia"
import {
  ACCOUNT_TYPES,
  BIRTH_MONTHS,
  GENDER_OPTIONS,
  INTEREST_OPTIONS,
  ORGANIZATION_TYPES,
  US_SCHOOLS,
  buildProfileSummary,
  formatPhoneNumber,
  getBirthYearOptions,
  getPasswordChecks,
  isEduEmail,
  isStrongPassword,
  isValidEmail,
  isValidUsername,
  normalizeUsername,
  sanitizePhoneNumber,
} from "../signupData"
import { supabase } from "../supabaseClient"

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
]

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error("Could not read the selected image."))
    reader.readAsDataURL(file)
  })

const initialForm = {
  firstName: "",
  lastName: "",
  organizationName: "",
  username: "",
  email: "",
  password: "",
  confirmPassword: "",
  phoneNumber: "",
  birthMonth: "",
  birthYear: "",
  gender: "",
  schoolId: "",
  schoolSearch: "",
  organizationType: "",
  organizationDescription: "",
  organizationWebsite: "",
  parentOrganizationName: "",
}

function SignUp() {
  const navigate = useNavigate()
  const birthYears = useMemo(() => getBirthYearOptions(), [])
  const [accountType, setAccountType] = useState("student")
  const [step, setStep] = useState("account")
  const [form, setForm] = useState(initialForm)
  const [selectedInterests, setSelectedInterests] = useState(["Sports", "Campus Life"])
  const [interestQuery, setInterestQuery] = useState("")
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_OPTIONS[0].value)
  const [profileImageFile, setProfileImageFile] = useState(null)
  const [profileImagePreview, setProfileImagePreview] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [usernameStatus, setUsernameStatus] = useState("idle")

  const isOrganization = accountType === "organization"
  const isPersonalAccount = !isOrganization
  const normalizedUsername = normalizeUsername(form.username)
  const selectedSchool = US_SCHOOLS.find((school) => school.id === form.schoolId)
  const avatarPreview = profileImagePreview || selectedAvatar
  const steps = isPersonalAccount
    ? ["Account", "Details", "Interests"]
    : ["Account", "Organization"]
  const activeStepIndex = step === "account" ? 0 : step === "details" ? 1 : 2

  const filteredSchools = useMemo(() => {
    const query = form.schoolSearch.trim().toLowerCase()
    if (!query) return US_SCHOOLS.slice(0, 7)

    return US_SCHOOLS.filter((school) => {
      const haystack = `${school.label} ${school.id} ${(school.domains || []).join(" ")}`
        .toLowerCase()
      return haystack.includes(query)
    }).slice(0, 8)
  }, [form.schoolSearch])

  const filteredInterests = useMemo(() => {
    const query = interestQuery.trim().toLowerCase()
    if (!query) return INTEREST_OPTIONS
    return INTEREST_OPTIONS.filter((interest) => interest.toLowerCase().includes(query))
  }, [interestQuery])

  const passwordChecks = useMemo(() => getPasswordChecks(form.password), [form.password])

  const validation = useMemo(() => {
    const errors = {}
    const cleanEmail = form.email.trim().toLowerCase()
    const cleanPhone = sanitizePhoneNumber(form.phoneNumber)

    if (!normalizedUsername) errors.username = "Username is required."
    else if (!isValidUsername(normalizedUsername)) {
      errors.username = "Use 3-30 letters, numbers, dots, or underscores."
    } else if (usernameStatus === "taken") {
      errors.username = "That username is already taken."
    }

    if (!cleanEmail) errors.email = "Email is required."
    else if (!isValidEmail(cleanEmail)) errors.email = "Enter a valid email address."
    else if (accountType === "student" && !isEduEmail(cleanEmail)) {
      errors.email = "Student accounts require a .edu email."
    }

    if (!isStrongPassword(form.password)) errors.password = "Password does not meet every rule."
    if (form.password !== form.confirmPassword) errors.confirmPassword = "Passwords must match."
    if (!cleanPhone || cleanPhone.replace(/\D/g, "").length < 10) {
      errors.phoneNumber = "Phone number is required."
    }

    if (isPersonalAccount) {
      if (!form.firstName.trim()) errors.firstName = "First name is required."
      if (!form.lastName.trim()) errors.lastName = "Last name is required."
      if (!form.birthMonth) errors.birthMonth = "Birth month is required."
      if (!form.birthYear) errors.birthYear = "Birth year is required."
      if (!form.gender) errors.gender = "Gender is required."
      if (accountType === "student" && !selectedSchool) {
        errors.school = "Choose your school."
      }
    } else {
      if (!form.organizationName.trim()) errors.organizationName = "Organization name is required."
      if (!form.organizationType) errors.organizationType = "Organization type is required."
      if (!form.organizationDescription.trim()) {
        errors.organizationDescription = "Tell people what this organization is."
      }
      if (
        form.organizationWebsite.trim() &&
        !/^https?:\/\/[^\s]+\.[^\s]+$/i.test(form.organizationWebsite.trim())
      ) {
        errors.organizationWebsite = "Use a full URL starting with http:// or https://."
      }
    }

    return {
      errors,
      detailsValid:
        Object.keys(errors).length === 0 &&
        usernameStatus !== "checking" &&
        usernameStatus !== "error",
      interestsValid: selectedInterests.length > 0,
    }
  }, [accountType, form, isPersonalAccount, normalizedUsername, selectedInterests.length, selectedSchool, usernameStatus])

  useEffect(() => {
    if (!normalizedUsername || !isValidUsername(normalizedUsername)) {
      setUsernameStatus("idle")
      return
    }

    let isActive = true
    const timeoutId = window.setTimeout(async () => {
      setUsernameStatus("checking")
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", normalizedUsername)
        .maybeSingle()

      if (!isActive) return
      if (error && error.code !== "PGRST116") {
        setUsernameStatus("error")
        return
      }
      setUsernameStatus(data ? "taken" : "available")
    }, 450)

    return () => {
      isActive = false
      window.clearTimeout(timeoutId)
    }
  }, [normalizedUsername])

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
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

  const toggleInterest = (interest) => {
    setSelectedInterests((currentInterests) =>
      currentInterests.includes(interest)
        ? currentInterests.filter((item) => item !== interest)
        : [...currentInterests, interest]
    )
  }

  const checkUsernameAvailability = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", normalizedUsername)
      .maybeSingle()

    if (error && error.code !== "PGRST116") {
      throw new Error("We could not validate that username. Please try again.")
    }

    if (data) {
      throw new Error("That username is already taken.")
    }
  }

  const createAccount = async () => {
    try {
      setIsLoading(true)
      setErrorMessage("")
      await checkUsernameAvailability()

      const cleanEmail = form.email.trim().toLowerCase()
      const cleanPhoneNumber = sanitizePhoneNumber(form.phoneNumber)
      const cleanFirstName = form.firstName.trim()
      const cleanLastName = form.lastName.trim()
      const cleanOrganizationName = form.organizationName.trim()
      const fullName = isOrganization
        ? cleanOrganizationName
        : [cleanFirstName, cleanLastName].filter(Boolean).join(" ")
      const fallbackAvatarValue = sanitizeAvatarStorageValue(selectedAvatar, null)
      const profileBio = buildProfileSummary({
        accountType,
        firstName: cleanFirstName,
        organizationName: cleanOrganizationName,
        interests: isPersonalAccount ? selectedInterests : [],
      })
      // NOTE: this metadata is read by the handle_new_auth_user trigger on
      // auth.users INSERT. Every key here maps to a profiles column. Keep the
      // snake_case keys aligned with the DB or the trigger will drop the field.
      const metadata = {
        username: normalizedUsername,
        name: fullName || normalizedUsername,
        email: cleanEmail,
        phone_number: cleanPhoneNumber,
        interests: isPersonalAccount ? selectedInterests : [],
        avatar_url: fallbackAvatarValue,
        bio: profileBio,
        account_type: accountType,
        first_name: isOrganization ? null : cleanFirstName,
        last_name: isOrganization ? null : cleanLastName,
        birth_month: isOrganization ? null : Number(form.birthMonth),
        birth_year: isOrganization ? null : Number(form.birthYear),
        gender: isOrganization ? null : form.gender,
        school: accountType === "student" ? selectedSchool?.label || "" : null,
        school_id: accountType === "student" ? selectedSchool?.id || "" : null,
        student_verified: false,
        verification_status: "unverified",
        organization_name: isOrganization ? cleanOrganizationName : null,
        organization_type: isOrganization ? form.organizationType : null,
        organization_description: isOrganization ? form.organizationDescription.trim() : null,
        organization_website: isOrganization ? form.organizationWebsite.trim() || null : null,
        parent_organization_name: isOrganization
          ? form.parentOrganizationName.trim() || null
          : null,
        logo_url: isOrganization ? fallbackAvatarValue : null,
      }

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: form.password,
        options: { data: metadata },
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
              fallbackUrl: fallbackAvatarValue,
            })
          : fallbackAvatarValue

      // With the handle_new_auth_user trigger (SECURITY DEFINER) now populating
      // every column on auth.users insert, the profile row already exists and
      // is fully populated by the time we get here. We only need a client-side
      // upsert when the user is already signed in (i.e. email confirmation is
      // off) and we uploaded a profile image after auth.signUp — in which case
      // we patch the avatar/logo URL. RLS will allow it because auth.uid() === id.
      if (data.session && avatarUrl && avatarUrl !== fallbackAvatarValue) {
        const { error: metadataError } = await supabase.auth.updateUser({
          data: {
            ...metadata,
            avatar_url: avatarUrl,
            logo_url: isOrganization ? avatarUrl : null,
          },
        })

        if (metadataError) {
          console.error("Auth metadata update failed:", metadataError)
        }

        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            avatar_url: avatarUrl,
            logo_url: isOrganization ? avatarUrl : null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", data.user.id)

        if (profileError) {
          console.error("Profile avatar sync failed:", profileError)
          throw new Error(profileError.message || "Profile setup failed.")
        }
      }

      if (data.session) {
        await supabase.auth.signOut()
      }

      localStorage.removeItem("user")
      sessionStorage.setItem(
        "authMessage",
        data.session
          ? "Account created. Log in with your new account."
          : "Account created. Check your email to verify it, then log in."
      )
      navigate("/auth/login", { replace: true })
    } catch (error) {
      setErrorMessage(error.message || "Signup failed.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleContinue = async (event) => {
    event.preventDefault()
    setErrorMessage("")

    if (step === "account") {
      setStep("details")
      return
    }

    if (step === "details") {
      if (!validation.detailsValid) {
        setErrorMessage("Finish the required fields before continuing.")
        return
      }

      if (isPersonalAccount) {
        setStep("interests")
        return
      }

      await createAccount()
      return
    }

    if (!validation.interestsValid) {
      setErrorMessage("Choose at least one interest to personalize your feed.")
      return
    }

    await createAccount()
  }

  const renderError = (field) =>
    validation.errors[field] ? <small className="signup-field-error">{validation.errors[field]}</small> : null

  return (
    <main className="login-page signup-page">
      <div className="signup-shell">
        <section className="signup-aside">
          <p className="signup-kicker">Campus Event Navigation</p>
          <h1>Create the right identity from day one.</h1>
          <p className="signup-aside-copy">
            Choose how you show up, add the details that matter, then tune your first recommendations.
          </p>
          <div className="signup-progress-list">
            {steps.map((label, index) => (
              <div
                key={label}
                className={`signup-progress-step ${index <= activeStepIndex ? "active" : ""}`}
              >
                <span>{index + 1}</span>
                <p>{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="login-card signup-card">
          <p className="signup-card-kicker">Step {activeStepIndex + 1} of {steps.length}</p>
          <h1>{step === "account" ? "Sign up" : step === "interests" ? "Choose interests" : isOrganization ? "Organization details" : "Your details"}</h1>
          <p className="login-subtext">
            {step === "account"
              ? "Select the account type that matches how you will use the platform."
              : step === "interests"
                ? "Pick a few signals so Discover has a smart starting point."
                : isOrganization
                  ? "Capture identity fields that can support verification and parent organizations later."
                  : accountType === "student"
                    ? "Use your .edu email and campus so your account can connect to the right school."
                    : "Create a standalone profile for events, follows, and community discovery."}
          </p>

          {errorMessage && <p className="auth-error">{errorMessage}</p>}

          <form className="login-form signup-form" onSubmit={handleContinue}>
            {step === "account" ? (
              <div className="signup-account-grid">
                {ACCOUNT_TYPES.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    className={`signup-account-card ${accountType === type.id ? "active" : ""}`}
                    onClick={() => setAccountType(type.id)}
                  >
                    <span>{type.label}</span>
                    <strong>{type.title}</strong>
                    <p>{type.description}</p>
                  </button>
                ))}
              </div>
            ) : null}

            {step === "details" ? (
              <>
                <div className="signup-avatar-section">
                  <div className="signup-avatar-preview-wrap">
                    <img src={avatarPreview} alt="Profile preview" className="signup-avatar-preview" />
                    <div>
                      <p className="signup-section-label">
                        {isOrganization ? "Logo or profile image" : "Profile look"}
                      </p>
                      <p className="signup-field-helper">
                        Optional for now. This stores cleanly as the profile image foundation.
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
                    <label className="signup-upload-btn">
                      <input type="file" accept="image/*" onChange={handleProfileImageChange} />
                      Upload
                    </label>
                  </div>
                </div>

                <div className="signup-grid">
                  {isOrganization ? (
                    <>
                      <label className="signup-field signup-field-full">
                        <span>Organization name</span>
                        <input
                          type="text"
                          placeholder="UMES Basketball"
                          value={form.organizationName}
                          onChange={(e) => updateField("organizationName", e.target.value)}
                          autoComplete="organization"
                        />
                        {renderError("organizationName")}
                      </label>

                      <label className="signup-field">
                        <span>Organization type</span>
                        <select
                          value={form.organizationType}
                          onChange={(e) => updateField("organizationType", e.target.value)}
                        >
                          <option value="">Select type</option>
                          {ORGANIZATION_TYPES.map((type) => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                        {renderError("organizationType")}
                      </label>
                    </>
                  ) : (
                    <>
                      <label className="signup-field">
                        <span>First name</span>
                        <input
                          type="text"
                          placeholder="Avery"
                          value={form.firstName}
                          onChange={(e) => updateField("firstName", e.target.value)}
                          autoComplete="given-name"
                        />
                        {renderError("firstName")}
                      </label>
                      <label className="signup-field">
                        <span>Last name</span>
                        <input
                          type="text"
                          placeholder="Jordan"
                          value={form.lastName}
                          onChange={(e) => updateField("lastName", e.target.value)}
                          autoComplete="family-name"
                        />
                        {renderError("lastName")}
                      </label>
                    </>
                  )}

                  <label className="signup-field">
                    <span>Username</span>
                    <input
                      type="text"
                      placeholder={isOrganization ? "umesbasketball" : "averyafterdark"}
                      value={form.username}
                      onChange={(e) => updateField("username", normalizeUsername(e.target.value))}
                      autoComplete="username"
                    />
                    <small className={`signup-inline-status ${usernameStatus}`}>
                      {usernameStatus === "checking"
                        ? "Checking username..."
                        : usernameStatus === "available"
                          ? "Username is available."
                          : usernameStatus === "taken"
                            ? "That username is already taken."
                            : "Letters, numbers, dots, and underscores."}
                    </small>
                    {renderError("username")}
                  </label>

                  <label className="signup-field">
                    <span>{isOrganization ? "Organization email" : accountType === "student" ? ".edu email" : "Email"}</span>
                    <input
                      type="email"
                      placeholder={accountType === "student" ? "name@school.edu" : "name@example.com"}
                      value={form.email}
                      onChange={(e) => updateField("email", e.target.value)}
                      autoComplete="email"
                    />
                    {accountType === "student" ? (
                      <small className="signup-field-helper">A .edu email is required for student accounts.</small>
                    ) : null}
                    {renderError("email")}
                  </label>

                  <label className="signup-field">
                    <span>Password</span>
                    <input
                      type="password"
                      placeholder="Password"
                      value={form.password}
                      onChange={(e) => updateField("password", e.target.value)}
                      autoComplete="new-password"
                    />
                    <div className="signup-password-rules">
                      <span className={passwordChecks.length ? "met" : ""}>8+ characters</span>
                      <span className={passwordChecks.uppercase ? "met" : ""}>uppercase</span>
                      <span className={passwordChecks.lowercase ? "met" : ""}>lowercase</span>
                      <span className={passwordChecks.number ? "met" : ""}>number</span>
                    </div>
                    {renderError("password")}
                  </label>

                  <label className="signup-field">
                    <span>Confirm password</span>
                    <input
                      type="password"
                      placeholder="Confirm password"
                      value={form.confirmPassword}
                      onChange={(e) => updateField("confirmPassword", e.target.value)}
                      autoComplete="new-password"
                    />
                    {renderError("confirmPassword")}
                  </label>

                  <label className="signup-field">
                    <span>Phone number</span>
                    <input
                      type="tel"
                      placeholder="(410) 555-0123"
                      value={form.phoneNumber}
                      onChange={(e) => updateField("phoneNumber", formatPhoneNumber(e.target.value))}
                      autoComplete="tel"
                    />
                    {renderError("phoneNumber")}
                  </label>

                  {isPersonalAccount ? (
                    <>
                      <label className="signup-field">
                        <span>Birth month</span>
                        <select
                          value={form.birthMonth}
                          onChange={(e) => updateField("birthMonth", e.target.value)}
                        >
                          <option value="">Select month</option>
                          {BIRTH_MONTHS.map((month) => (
                            <option key={month.value} value={month.value}>{month.label}</option>
                          ))}
                        </select>
                        {renderError("birthMonth")}
                      </label>

                      <label className="signup-field">
                        <span>Birth year</span>
                        <select
                          value={form.birthYear}
                          onChange={(e) => updateField("birthYear", e.target.value)}
                        >
                          <option value="">Select year</option>
                          {birthYears.map((year) => (
                            <option key={year} value={year}>{year}</option>
                          ))}
                        </select>
                        {renderError("birthYear")}
                      </label>

                      <div className="signup-field signup-field-full">
                        <span>Gender</span>
                        <div className="signup-segmented-row">
                          {GENDER_OPTIONS.map((option) => (
                            <button
                              key={option}
                              type="button"
                              className={form.gender === option ? "active" : ""}
                              onClick={() => updateField("gender", option)}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                        {renderError("gender")}
                      </div>
                    </>
                  ) : (
                    <>
                      <label className="signup-field signup-field-full">
                        <span>Description</span>
                        <textarea
                          placeholder="Official page for events, updates, and community moments."
                          value={form.organizationDescription}
                          onChange={(e) => updateField("organizationDescription", e.target.value)}
                        />
                        {renderError("organizationDescription")}
                      </label>

                      <label className="signup-field">
                        <span>Website</span>
                        <input
                          type="url"
                          placeholder="https://example.edu"
                          value={form.organizationWebsite}
                          onChange={(e) => updateField("organizationWebsite", e.target.value)}
                        />
                        {renderError("organizationWebsite")}
                      </label>

                      <label className="signup-field">
                        <span>Parent organization</span>
                        <input
                          type="text"
                          placeholder="UMES"
                          value={form.parentOrganizationName}
                          onChange={(e) => updateField("parentOrganizationName", e.target.value)}
                        />
                        <small className="signup-field-helper">Optional. Useful for future branch or team hierarchy.</small>
                      </label>
                    </>
                  )}

                  {accountType === "student" ? (
                    <div className="signup-field signup-field-full">
                      <span>School</span>
                      <input
                        type="search"
                        placeholder="Search U.S. colleges"
                        value={selectedSchool ? selectedSchool.label : form.schoolSearch}
                        onChange={(e) => {
                          updateField("schoolId", "")
                          updateField("schoolSearch", e.target.value)
                        }}
                      />
                      <div className="signup-school-results">
                        {filteredSchools.map((school) => (
                          <button
                            key={school.id}
                            type="button"
                            className={form.schoolId === school.id ? "active" : ""}
                            onClick={() => {
                              updateField("schoolId", school.id)
                              updateField("schoolSearch", school.label)
                            }}
                          >
                            <strong>{school.label}</strong>
                            <span>{school.domains?.[0]}</span>
                          </button>
                        ))}
                      </div>
                      {renderError("school")}
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}

            {step === "interests" ? (
              <div className="signup-interests-section">
                <input
                  type="search"
                  placeholder="Search interests"
                  value={interestQuery}
                  onChange={(e) => setInterestQuery(e.target.value)}
                />
                <div className="signup-interest-grid">
                  {filteredInterests.map((interest) => (
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
                <p className="signup-field-helper">
                  Selected: {selectedInterests.length}. These are stored on your profile to warm up recommendations.
                </p>
              </div>
            ) : null}

            <div className="signup-action-row">
              {step !== "account" ? (
                <button
                  type="button"
                  className="signup-secondary-btn"
                  onClick={() => setStep(step === "interests" ? "details" : "account")}
                  disabled={isLoading}
                >
                  Back
                </button>
              ) : null}
              <button
                className="login-btn signup-submit-btn"
                type="submit"
                disabled={
                  isLoading ||
                  (step === "details" && !validation.detailsValid) ||
                  (step === "interests" && !validation.interestsValid)
                }
              >
                {isLoading
                  ? "Creating account..."
                  : step === "account"
                    ? "Continue"
                    : step === "details" && isPersonalAccount
                      ? "Continue to interests"
                      : "Create Account"}
              </button>
            </div>
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
