import React, { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../supabaseClient"
import OnboardingShell from "./Onboarding/OnboardingShell"
import {
  Banner,
  FloatingInput,
  GhostButton,
  PrimaryButton,
  TopBar,
} from "./Onboarding/OnboardingPrimitives"
import { Eye, EyeOff } from "./Onboarding/icons"
import "./Onboarding/Onboarding.css"

const PASSWORD_RULES_MESSAGE =
  "Use 8+ characters with uppercase, lowercase, number, and symbol."

function validatePassword(password) {
  if (password.length < 8) return PASSWORD_RULES_MESSAGE
  if (!/[A-Z]/.test(password)) return PASSWORD_RULES_MESSAGE
  if (!/[a-z]/.test(password)) return PASSWORD_RULES_MESSAGE
  if (!/[0-9]/.test(password)) return PASSWORD_RULES_MESSAGE
  if (!/[^A-Za-z0-9]/.test(password)) return PASSWORD_RULES_MESSAGE
  return ""
}

function readAuthParams(url) {
  if (!url) return { accessToken: null, refreshToken: null, code: null, type: null }

  const parsedUrl = new URL(url)
  const params = new URLSearchParams(parsedUrl.search)

  if (parsedUrl.hash) {
    new URLSearchParams(parsedUrl.hash.slice(1)).forEach((value, key) => {
      params.set(key, value)
    })
  }

  return {
    accessToken: params.get("access_token"),
    refreshToken: params.get("refresh_token"),
    code: params.get("code"),
    type: params.get("type"),
  }
}

function redactResetUrl(url) {
  if (!url) return url

  const parsedUrl = new URL(url)
  const redactParams = (params) => {
    const sensitiveKeys = ["access_token", "refresh_token", "code"]
    sensitiveKeys.forEach((key) => {
      if (params.has(key)) params.set(key, "[redacted]")
    })
    return params.toString()
  }

  parsedUrl.search = redactParams(parsedUrl.searchParams)

  if (parsedUrl.hash) {
    const hashParams = new URLSearchParams(parsedUrl.hash.slice(1))
    parsedUrl.hash = redactParams(hashParams)
  }

  return parsedUrl.toString()
}

function ResetPassword() {
  const navigate = useNavigate()
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [infoMessage, setInfoMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasRecoverySession, setHasRecoverySession] = useState(false)

  useEffect(() => {
    let isMounted = true

    const establishRecoverySession = async () => {
      const currentUrl = window.location.href
      const { accessToken, refreshToken, code, type } = readAuthParams(currentUrl)

      console.info("[password-reset] current reset URL", {
        url: redactResetUrl(currentUrl),
      })
      console.info("[password-reset] recovery params found", {
        hasAccessToken: Boolean(accessToken),
        hasRefreshToken: Boolean(refreshToken),
        hasCode: Boolean(code),
        type,
      })

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })

        console.info("[password-reset] setSession result", {
          ok: !error,
          error: error?.message || null,
        })

        if (error) {
          setErrorMessage(error.message || "The reset link could not be opened.")
          return
        }
      } else if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)

        console.info("[password-reset] exchangeCodeForSession result", {
          ok: !error,
          error: error?.message || null,
        })

        if (error) {
          setErrorMessage(error.message || "The reset link could not be opened.")
          return
        }
      }

      const { data } = await supabase.auth.getSession()
      console.info("[password-reset] recovery session ready", {
        hasSession: Boolean(data?.session),
      })
      if (isMounted) setHasRecoverySession(Boolean(data?.session))
    }

    void establishRecoverySession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return
      if (event === "PASSWORD_RECOVERY" || session) {
        setHasRecoverySession(true)
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const passwordError = useMemo(() => {
    if (!newPassword) return ""
    return validatePassword(newPassword)
  }, [newPassword])

  const confirmError = useMemo(() => {
    if (!confirmPassword) return ""
    return newPassword === confirmPassword ? "" : "Passwords must match."
  }, [confirmPassword, newPassword])

  const handleSubmit = async (event) => {
    event.preventDefault()
    const validationError = validatePassword(newPassword)
    if (validationError) {
      setErrorMessage(validationError)
      return
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords must match.")
      return
    }
    if (!hasRecoverySession) {
      setErrorMessage("Open the reset link from your email before setting a new password.")
      return
    }

    setIsSubmitting(true)
    setErrorMessage("")
    setInfoMessage("")

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })

    setIsSubmitting(false)
    console.info("[password-reset] update password result", {
      ok: !error,
      error: error?.message || null,
    })

    if (error) {
      setErrorMessage(error.message || "Unable to update password right now.")
      return
    }

    await supabase.auth.signOut()
    setInfoMessage("Password updated. Redirecting to login...")
    sessionStorage.setItem("authMessage", "Password updated. Log in with your new password.")
    window.setTimeout(() => {
      navigate("/auth/login", { replace: true })
    }, 1200)
  }

  const ready =
    newPassword.length > 0 &&
    confirmPassword.length > 0 &&
    !passwordError &&
    !confirmError &&
    !isSubmitting

  return (
    <OnboardingShell showProgress={false} stepKey="reset-password">
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <TopBar onBack={() => navigate("/auth/login")} />

        <div style={{ paddingTop: 8 }}>
          <h1 className="onb-title">Create new password</h1>
          <p className="onb-subtitle">Choose a strong password for your account.</p>
        </div>

        <Banner tone="success">{infoMessage}</Banner>
        <Banner tone="error">{errorMessage}</Banner>

        <FloatingInput
          label="New password"
          type={showNewPassword ? "text" : "password"}
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          state={passwordError ? "error" : newPassword ? "success" : undefined}
          helper={passwordError || PASSWORD_RULES_MESSAGE}
          helperState={passwordError ? "error" : undefined}
          autoFocus
          rightSlot={
            <button
              type="button"
              className="onb-iconbtn"
              style={{ width: 32, height: 32 }}
              onClick={() => setShowNewPassword((value) => !value)}
              aria-label={showNewPassword ? "Hide password" : "Show password"}
            >
              {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          }
        />

        <FloatingInput
          label="Confirm password"
          type={showConfirmPassword ? "text" : "password"}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          state={confirmError ? "error" : confirmPassword ? "success" : undefined}
          helper={confirmError}
          helperState={confirmError ? "error" : undefined}
          rightSlot={
            <button
              type="button"
              className="onb-iconbtn"
              style={{ width: 32, height: 32 }}
              onClick={() => setShowConfirmPassword((value) => !value)}
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
            >
              {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          }
        />

        <div className="onb-spacer" />

        <div className="onb-actions">
          <PrimaryButton type="submit" disabled={!ready}>
            {isSubmitting ? "Updating..." : "Update Password"}
          </PrimaryButton>
          <GhostButton type="button" onClick={() => navigate("/auth/login")}>
            Back to login
          </GhostButton>
        </div>
      </form>
    </OnboardingShell>
  )
}

export default ResetPassword
