import React, { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { syncStoredUserFromSession } from "../profileMedia"
import { supabase } from "../supabaseClient"
import OnboardingShell from "./Onboarding/OnboardingShell"
import {
  Banner,
  FloatingInput,
  GhostButton,
  PrimaryButton,
} from "./Onboarding/OnboardingPrimitives"
import { Eye, EyeOff } from "./Onboarding/icons"
import "./Onboarding/Onboarding.css"

function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [infoMessage, setInfoMessage] = useState("")
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  useEffect(() => {
    const pending = sessionStorage.getItem("authMessage")
    if (!pending) return
    setInfoMessage(pending)
    sessionStorage.removeItem("authMessage")
  }, [])

  const handleLogin = async (e) => {
    if (e?.preventDefault) e.preventDefault()
    if (!email.trim() || !password) return
    try {
      setIsLoggingIn(true)
      setErrorMessage("")
      setInfoMessage("")
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })
      if (error) {
        setErrorMessage(error.message)
        return
      }
      const user = data?.user || data?.session?.user
      if (!user) {
        setErrorMessage("Login failed.")
        return
      }
      await syncStoredUserFromSession(data?.session || { user })
      navigate("/home", { replace: true })
    } catch (err) {
      setErrorMessage(err.message || "Login failed.")
    } finally {
      setIsLoggingIn(false)
    }
  }

  const ready = email.trim().length > 0 && password.length > 0 && !isLoggingIn

  return (
    <OnboardingShell showProgress={false} stepKey="login">
      <form
        onSubmit={handleLogin}
        style={{ display: "flex", flexDirection: "column", flex: 1 }}
      >
        <div style={{ paddingTop: 24 }}>
          <h1 className="onb-title">Welcome back</h1>
          <p className="onb-subtitle">Log in to discover and manage campus events.</p>
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

        <FloatingInput
          label="Password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          rightSlot={
            <button
              type="button"
              className="onb-iconbtn"
              style={{ width: 32, height: 32 }}
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          }
        />

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: -4 }}>
          <button
            type="button"
            onClick={() => setInfoMessage("Password reset is coming soon.")}
            style={{
              background: "transparent",
              border: 0,
              padding: 0,
              color: "var(--onb-link)",
              fontSize: 13,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Forgot password?
          </button>
        </div>

        <div className="onb-spacer" />

        <div className="onb-actions">
          <PrimaryButton type="submit" disabled={!ready}>
            {isLoggingIn ? "Logging in..." : "Log in"}
          </PrimaryButton>
          <GhostButton type="button" onClick={() => navigate("/auth/signup")}>
            Create account
          </GhostButton>
        </div>
      </form>
    </OnboardingShell>
  )
}

export default Login
