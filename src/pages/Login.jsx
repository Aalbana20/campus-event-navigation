import React, { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { supabase } from "../supabaseClient"

const createStoredUser = (user) => {
  const email = user?.email || ""
  const fallbackUsername = email.includes("@") ? email.split("@")[0] : "campus-user"

  const username =
    user?.user_metadata?.username ||
    user?.user_metadata?.user_name ||
    user?.user_metadata?.name ||
    fallbackUsername

  return {
    id: user?.id || "",
    email,
    name:
      user?.user_metadata?.name ||
      user?.user_metadata?.full_name ||
      user?.user_metadata?.username ||
      username,
    username,
    image:
      user?.user_metadata?.avatar_url ||
      user?.user_metadata?.picture ||
      user?.user_metadata?.image ||
      "",
  }
}

function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [infoMessage, setInfoMessage] = useState("")
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  const navigate = useNavigate()

  useEffect(() => {
    const pendingMessage = sessionStorage.getItem("authMessage")

    if (!pendingMessage) return

    setInfoMessage(pendingMessage)
    sessionStorage.removeItem("authMessage")
  }, [])

  const handleLogin = async (e) => {
    e.preventDefault()

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

      const authenticatedUser = data?.user || data?.session?.user

      if (!authenticatedUser) {
        setErrorMessage("Login failed.")
        return
      }

      localStorage.setItem("user", JSON.stringify(createStoredUser(authenticatedUser)))

      navigate("/discover", { replace: true })
    } catch (error) {
      setErrorMessage(error.message || "Login failed.")
    } finally {
      setIsLoggingIn(false)
    }
  }

  return (
    <main className="login-page">
      <div className="login-card">
        <h1>Welcome Back</h1>
        <p className="login-subtext">
          {infoMessage || "Log in to discover and manage campus events."}
        </p>

        {errorMessage ? <p className="auth-error">{errorMessage}</p> : null}

        <form className="login-form" onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />

          <button className="login-btn" type="submit" disabled={isLoggingIn}>
            {isLoggingIn ? "Logging in..." : "Login"}
          </button>
        </form>

        <p className="login-footer">
          Do not have an account? <Link to="/auth/signup">Create one</Link>
        </p>
      </div>
    </main>
  )
}

export default Login