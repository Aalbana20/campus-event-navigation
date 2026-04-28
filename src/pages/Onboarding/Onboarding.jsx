import React, { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../../supabaseClient"
import {
  sanitizeAvatarStorageValue,
  syncStoredUserFromSession,
  uploadProfileImageToStorage,
} from "../../profileMedia"
import {
  US_SCHOOLS,
  buildProfileSummary,
  isValidEmail,
  sanitizePhoneNumber,
} from "../../signupData"
import OnboardingShell from "./OnboardingShell"
import {
  StepAccountType,
  StepAvatar,
  StepDone,
  StepEntry,
  StepInterests,
  StepNameBirth,
  StepOrgCategories,
  StepOrgInfo,
  StepOrgName,
  StepOtp,
  StepPassword,
  StepPhone,
  StepSchool,
  StepSubmitting,
  StepTerms,
  StepUsername,
} from "./OnboardingSteps"
import "./Onboarding.css"

// Personal flow per spec: account-type → username → phone → otp → password →
// name+birth → avatar → interests → terms → school (optional, with required
// .edu verify if a school is selected). signUp fires at flow end.
const INDIVIDUAL_FLOW = [
  "account-type",
  "username",
  "phone",
  "otp",
  "password",
  "name-birth",
  "avatar",
  "interests",
  "terms",
  "school",
]

// Business flow: account-type → org-name → username → phone → otp → password →
// org-info (type + recovery email) → logo → categories → terms. signUp at end.
const ORG_FLOW = [
  "account-type",
  "org-name",
  "username",
  "phone",
  "otp",
  "password",
  "org-info",
  "org-logo",
  "org-categories",
  "terms",
]

const initialData = {
  accountType: null, // "individual" | "organization"
  schoolId: "",
  schoolLabel: "",
  schoolVerified: false,
  eduEmail: "",
  username: "",
  birthMonth: "",
  birthDay: "",
  birthYear: "",
  phone: "",
  phoneVerified: false,
  email: "",
  password: "",
  confirmPassword: "",
  avatarFile: null,
  avatarPreview: "",
  interests: [],
  interestDescription: "",
  firstName: "",
  lastName: "",
  // Org
  orgName: "",
  orgType: "",
  orgEmail: "",
  orgCategories: [],
}

export default function Onboarding() {
  const navigate = useNavigate()
  const [stage, setStage] = useState("entry") // "entry" | "flow" | "submitting" | "done"
  const [stepKey, setStepKey] = useState("account-type")
  const [data, setData] = useState(initialData)
  const [error, setError] = useState("")

  const update = (patch) => setData((curr) => ({ ...curr, ...patch }))

  const flow = useMemo(() => {
    if (data.accountType === "organization") return ORG_FLOW
    return INDIVIDUAL_FLOW
  }, [data.accountType])

  const stepIndex = flow.indexOf(stepKey)
  const progress = stage === "flow" ? (stepIndex + 1) / flow.length : 0

  const goNext = () => {
    const idx = flow.indexOf(stepKey)
    if (idx < 0) return
    if (idx >= flow.length - 1) {
      submit("home")
      return
    }
    setStepKey(flow[idx + 1])
  }

  const goBack = () => {
    const idx = flow.indexOf(stepKey)
    if (idx <= 0) {
      setStage("entry")
      return
    }
    setStepKey(flow[idx - 1])
  }

  const onClose = () => navigate("/auth/login")

  const submit = async (destination = "home") => {
    setStage("submitting")
    setError("")
    try {
      const isOrg = data.accountType === "organization"
      const cleanUsername = (data.username || "").trim().toLowerCase()
      const cleanPhone = sanitizePhoneNumber(data.phone || "")
      const cleanOrgName = (data.orgName || "").trim()
      const cleanFirstName = (data.firstName || "").trim()
      const cleanLastName = (data.lastName || "").trim()
      const selectedSchool = US_SCHOOLS.find((s) => s.id === data.schoolId)

      // Account type derives from school selection (personal-with-school =
      // student) or organization. No more upfront "are you in college?" step.
      const accountType = isOrg
        ? "organization"
        : selectedSchool && data.schoolVerified
        ? "student"
        : "regular"

      // Resolve auth email: verified .edu > org email > synthesized fallback
      // tied to the user's phone (no email step in the new flow).
      const eduEmail = (data.eduEmail || "").trim().toLowerCase()
      const orgEmail = (data.orgEmail || "").trim().toLowerCase()
      const phoneDigits = cleanPhone.replace(/\D/g, "")
      const fallbackHandle = cleanUsername || phoneDigits || `user${Date.now()}`
      const cleanEmail = isOrg
        ? orgEmail || `${fallbackHandle}@signup.campusevent.app`
        : accountType === "student"
        ? eduEmail
        : `${fallbackHandle}@signup.campusevent.app`

      if (!isValidEmail(cleanEmail)) {
        throw new Error("We couldn't determine a valid email for this account.")
      }
      if (!data.password || data.password.length < 8) {
        throw new Error("Password is too short.")
      }

      const personalDisplayName = [cleanFirstName, cleanLastName].filter(Boolean).join(" ")
      const fullName = isOrg
        ? cleanOrgName
        : personalDisplayName || cleanUsername
      const fallbackAvatar = sanitizeAvatarStorageValue(null, null)
      const interests = isOrg ? data.orgCategories || [] : data.interests || []
      const bio =
        !isOrg && data.interestDescription
          ? data.interestDescription.trim().slice(0, 200)
          : buildProfileSummary({
              accountType,
              firstName: cleanFirstName,
              organizationName: cleanOrgName,
              interests,
            })

      // Metadata keys map to profiles columns via handle_new_auth_user.
      // Anything unmapped (phone, school_email, birth_day) still lives in
      // auth.users.raw_user_meta_data.
      const metadata = {
        username: cleanUsername || cleanOrgName.toLowerCase().replace(/\s+/g, ""),
        name: fullName || cleanUsername,
        email: cleanEmail,
        phone: cleanPhone,
        phone_number: cleanPhone,
        interests,
        categories: isOrg ? data.orgCategories || [] : [],
        avatar_url: fallbackAvatar,
        bio,
        account_type: accountType,
        first_name: isOrg ? null : cleanFirstName || null,
        last_name: isOrg ? null : cleanLastName || null,
        birth_month: !isOrg && data.birthMonth ? Number(data.birthMonth) : null,
        birth_day: !isOrg && data.birthDay ? Number(data.birthDay) : null,
        birth_year: !isOrg && data.birthYear ? Number(data.birthYear) : null,
        gender: null,
        school: accountType === "student" ? selectedSchool?.label || "" : null,
        school_name: accountType === "student" ? selectedSchool?.label || "" : null,
        school_id: accountType === "student" ? selectedSchool?.id || "" : null,
        school_email: accountType === "student" ? eduEmail : null,
        student_verified: accountType === "student" ? !!data.schoolVerified : false,
        verification_status: accountType === "student" && data.schoolVerified
          ? "verified"
          : "unverified",
        organization_name: isOrg ? cleanOrgName : null,
        organization_type: isOrg ? data.orgType : null,
        organization_description: isOrg ? bio : null,
        organization_website: null,
        parent_organization_name: null,
        logo_url: isOrg ? fallbackAvatar : null,
      }

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: data.password,
        options: { data: metadata },
      })
      if (signUpError) throw signUpError
      if (!signUpData.user) throw new Error("Signup failed.")

      // Upload avatar/logo if we have a session (i.e. email confirmation off).
      if (signUpData.session && data.avatarFile) {
        const url = await uploadProfileImageToStorage({
          userId: signUpData.user.id,
          file: data.avatarFile,
          fileName: data.avatarFile.name,
          contentType: data.avatarFile.type,
          fallbackUrl: fallbackAvatar,
        })
        if (url && url !== fallbackAvatar) {
          await supabase
            .from("profiles")
            .update({
              avatar_url: url,
              logo_url: isOrg ? url : null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", signUpData.user.id)
        }
      }

      if (signUpData.session) {
        await syncStoredUserFromSession(signUpData.session)
        navigate(destination === "edit" ? "/edit-profile" : "/home", { replace: true })
        return
      }
      // Email confirmation required — no session yet.
      localStorage.removeItem("user")
      sessionStorage.setItem(
        "authMessage",
        destination === "edit"
          ? "Account created. Confirm your email, then we'll take you to edit your profile."
          : "Account created. Check your email to verify, then log in."
      )
      setStage("done")
    } catch (e) {
      setError(e.message || "Signup failed.")
      setStage("submitting")
    }
  }

  // ---- Render dispatch ----
  if (stage === "entry") {
    return (
      <OnboardingShell topVariant="close" onClose={onClose} showProgress={false} stepKey="entry">
        <StepEntry
          onCreate={() => {
            setStage("flow")
            setStepKey("account-type")
          }}
          onLogin={onClose}
        />
      </OnboardingShell>
    )
  }

  if (stage === "submitting") {
    return (
      <OnboardingShell showProgress={false} topVariant="back" onBack={() => setStage("flow")} stepKey="submitting">
        <StepSubmitting error={error} onRetry={submit} />
      </OnboardingShell>
    )
  }

  if (stage === "done") {
    return (
      <OnboardingShell showProgress={false} stepKey="done">
        <StepDone onDone={() => navigate("/auth/login", { replace: true })} />
      </OnboardingShell>
    )
  }

  // stage === "flow"
  const finishSignup = () => submit("home")

  let body = null
  switch (stepKey) {
    case "account-type":
      body = <StepAccountType data={data} update={update} goNext={goNext} />
      break
    case "username":
      body = <StepUsername data={data} update={update} goNext={goNext} />
      break
    case "phone":
      body = <StepPhone data={data} update={update} goNext={goNext} />
      break
    case "otp":
      body = <StepOtp data={data} update={update} goNext={goNext} goBack={goBack} />
      break
    case "password":
      body = <StepPassword data={data} update={update} goNext={goNext} />
      break
    case "name-birth":
      body = <StepNameBirth data={data} update={update} goNext={goNext} />
      break
    case "avatar":
      body = <StepAvatar data={data} update={update} goNext={goNext} />
      break
    case "interests":
      body = <StepInterests data={data} update={update} goNext={goNext} />
      break
    case "terms":
      body = <StepTerms goNext={goNext} goBack={goBack} />
      break
    case "school":
      body = (
        <StepSchool
          data={data}
          update={update}
          onFinish={finishSignup}
          onSkip={finishSignup}
        />
      )
      break
    case "org-name":
      body = <StepOrgName data={data} update={update} goNext={goNext} />
      break
    case "org-info":
      body = <StepOrgInfo data={data} update={update} goNext={goNext} />
      break
    case "org-logo":
      body = <StepAvatar data={data} update={update} goNext={goNext} isOrg />
      break
    case "org-categories":
      body = <StepOrgCategories data={data} update={update} goNext={goNext} />
      break
    default:
      body = null
  }

  return (
    <OnboardingShell
      onBack={goBack}
      progress={progress}
      stepKey={stepKey}
    >
      {body}
    </OnboardingShell>
  )
}
