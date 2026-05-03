import React, { useEffect, useState } from "react"
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
import "./Onboarding/Onboarding.css"

const RESET_SENT_MESSAGE =
  "If an account exists for that email, we sent password reset instructions."
const COOLDOWN_SECONDS = 60

function getResetRedirectUrl() {
  if (typeof window === "undefined") return "/reset-password"
  return `${window.location.origin}/reset-password`
}

function ForgotPassword() {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [infoMessage, setInfoMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = window.setInterval(() => {
      setCooldown((seconds) => Math.max(0, seconds - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [cooldown])

  const handleSubmit = async (event) => {
    event.preventDefault()
    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail || isSubmitting || cooldown > 0) return

    setIsSubmitting(true)
    setErrorMessage("")
    setInfoMessage("")

    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: getResetRedirectUrl(),
    })

    setIsSubmitting(false)
    setCooldown(COOLDOWN_SECONDS)

    if (error) {
      setErrorMessage(error.message || "Unable to send reset instructions right now.")
      return
    }

    setInfoMessage(RESET_SENT_MESSAGE)
  }

  const ready = email.trim().length > 0 && !isSubmitting && cooldown === 0

  return (
    <OnboardingShell showProgress={false} stepKey="forgot-password">
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <TopBar onBack={() => navigate("/auth/login")} />

        <div style={{ paddingTop: 8 }}>
          <h1 className="onb-title">Reset password</h1>
          <p className="onb-subtitle">Enter your email and we will send reset instructions.</p>
        </div>

        <Banner tone="success">{infoMessage}</Banner>
        <Banner tone="error">{errorMessage}</Banner>

        <FloatingInput
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
        />

        <div className="onb-spacer" />

        <div className="onb-actions">
          <PrimaryButton type="submit" disabled={!ready}>
            {isSubmitting
              ? "Sending..."
              : cooldown > 0
                ? `Try again in ${cooldown}s`
                : "Send Reset Link"}
          </PrimaryButton>
          <GhostButton type="button" onClick={() => navigate("/auth/login")}>
            Back to login
          </GhostButton>
        </div>
      </form>
    </OnboardingShell>
  )
}

export default ForgotPassword
