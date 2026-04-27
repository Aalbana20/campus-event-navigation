import React, { useEffect, useMemo, useState } from "react"
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
  FloatingInput,
  GhostButton,
  PrimaryButton,
} from "./OnboardingPrimitives"
import {
  StepAccountType,
  StepAvatar,
  StepBirth,
  StepCollege,
  StepDone,
  StepEntry,
  StepInterests,
  StepName,
  StepOrgCategories,
  StepOrgName,
  StepOrgType,
  StepOrgVerify,
  StepOtp,
  StepPassword,
  StepPhone,
  StepSchool,
  StepSubmitting,
  StepTerms,
  StepUsername,
} from "./OnboardingSteps"
import "./Onboarding.css"

const INDIVIDUAL_COLLEGE = [
  "account-type",
  "college",
  "school",
  "username",
  "birth",
  "phone",
  "otp",
  "password",
  "terms",
  "avatar",
  "interests",
  "name",
]
const INDIVIDUAL_NO_COLLEGE = [
  "account-type",
  "college",
  "username",
  "birth",
  "phone",
  "otp",
  "email",
  "password",
  "terms",
  "avatar",
  "interests",
  "name",
]
const ORG_FLOW = [
  "account-type",
  "org-name",
  "org-type",
  "org-verify",
  "phone",
  "otp",
  "password",
  "terms",
  "org-logo",
  "org-categories",
]

function StepEmail({ data, update, goNext }) {
  const value = data.email || ""
  const valid = isValidEmail(value)
  return (
    <>
      <h1 className="onb-title">Your email</h1>
      <p className="onb-subtitle">For account recovery and important updates only. We don't post anything.</p>
      <FloatingInput
        label="Email"
        type="email"
        autoComplete="email"
        value={value}
        onChange={(e) => update({ email: e.target.value })}
        autoFocus
        helper={value && !valid ? "That doesn't look like a valid email." : null}
        helperState={value && !valid ? "error" : null}
      />
      <div className="onb-spacer" />
      <div className="onb-actions">
        <PrimaryButton onClick={goNext} disabled={!valid}>Next</PrimaryButton>
      </div>
    </>
  )
}

const initialData = {
  accountType: null, // "individual" | "organization"
  inCollege: null,
  schoolId: "",
  schoolLabel: "",
  eduEmail: "",
  username: "",
  birthMonth: "",
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
    if (data.accountType === "individual" && data.inCollege === false) return INDIVIDUAL_NO_COLLEGE
    return INDIVIDUAL_COLLEGE
  }, [data.accountType, data.inCollege])

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

  const onFinish = (destination) => submit(destination)

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

      const cleanEmail = isOrg
        ? (data.orgEmail || "").trim().toLowerCase()
        : data.inCollege
        ? (data.eduEmail || "").trim().toLowerCase()
        : (data.email || "").trim().toLowerCase()

      if (!isValidEmail(cleanEmail)) {
        throw new Error("We couldn't find a valid email to register your account.")
      }
      if (!data.password || data.password.length < 8) {
        throw new Error("Password is too short.")
      }

      const cleanUsername = (data.username || "").trim().toLowerCase()
      const cleanPhone = sanitizePhoneNumber(data.phone || "")
      const cleanOrgName = (data.orgName || "").trim()
      const cleanFirstName = (data.firstName || "").trim()
      const cleanLastName = (data.lastName || "").trim()
      const selectedSchool = US_SCHOOLS.find((s) => s.id === data.schoolId)

      const accountType = isOrg
        ? "organization"
        : data.inCollege
        ? "student"
        : "regular"

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
              firstName: "",
              organizationName: cleanOrgName,
              interests,
            })

      // Metadata keys map to profiles columns via the handle_new_auth_user trigger.
      // Extra keys (college_status, school_email, phone, categories) are kept in
      // auth.users.raw_user_meta_data even if not mapped to a column yet.
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
        college_status: !isOrg ? (data.inCollege ? "in_college" : "not_in_college") : null,
        first_name: isOrg ? null : cleanFirstName || null,
        last_name: isOrg ? null : cleanLastName || null,
        birth_month: !isOrg && data.birthMonth ? Number(data.birthMonth) : null,
        birth_year: !isOrg && data.birthYear ? Number(data.birthYear) : null,
        gender: null,
        school: accountType === "student" ? selectedSchool?.label || "" : null,
        school_name: accountType === "student" ? selectedSchool?.label || "" : null,
        school_id: accountType === "student" ? selectedSchool?.id || "" : null,
        school_email: accountType === "student" ? cleanEmail : null,
        student_verified: false,
        verification_status: "unverified",
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
        // Stay signed in and route directly to destination.
        await syncStoredUserFromSession(signUpData.session)
        navigate(destination === "edit" ? "/edit-profile" : "/home", { replace: true })
        return
      }
      // Email confirmation required — no session yet. Send to login with a message
      // tailored to the user's chosen destination.
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
  let body = null
  switch (stepKey) {
    case "account-type":
      body = <StepAccountType data={data} update={update} goNext={goNext} />
      break
    case "college":
      body = <StepCollege data={data} update={update} goNext={goNext} />
      break
    case "school":
      body = <StepSchool data={data} update={update} goNext={goNext} />
      break
    case "username":
      body = <StepUsername data={data} update={update} goNext={goNext} />
      break
    case "birth":
      body = <StepBirth data={data} update={update} goNext={goNext} />
      break
    case "phone":
      body = <StepPhone data={data} update={update} goNext={goNext} />
      break
    case "otp":
      body = <StepOtp data={data} update={update} goNext={goNext} goBack={goBack} />
      break
    case "email":
      body = <StepEmail data={data} update={update} goNext={goNext} />
      break
    case "password":
      body = <StepPassword data={data} update={update} goNext={goNext} />
      break
    case "terms":
      body = <StepTerms goNext={goNext} goBack={goBack} />
      break
    case "avatar":
      body = <StepAvatar data={data} update={update} goNext={goNext} />
      break
    case "interests":
      body = <StepInterests data={data} update={update} goNext={goNext} />
      break
    case "name":
      body = <StepName data={data} update={update} onFinish={onFinish} />
      break
    case "org-name":
      body = <StepOrgName data={data} update={update} goNext={goNext} />
      break
    case "org-type":
      body = <StepOrgType data={data} update={update} goNext={goNext} />
      break
    case "org-verify":
      body = <StepOrgVerify data={data} update={update} goNext={goNext} />
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
