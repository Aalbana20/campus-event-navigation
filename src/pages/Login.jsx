import React, { useState } from "react"
import { Link, useNavigate } from "react-router-dom"

function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    setErrorMessage("")

    if (!email.trim() || !password) {
      setErrorMessage("Please enter both email and password.")
      return
    }

    try {
      setIsLoggingIn(true)

      const res = await fetch("http://localhost:5050/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setErrorMessage(data.message || data.error || "Login failed.")
        return
      }

      // Support common API token response shapes from the backend.
      const authHeader = res.headers.get("authorization") || res.headers.get("Authorization")
      const token =
        data.token ||
        data.accessToken ||
        data?.user?.token ||
        data?.data?.token ||
        data?.data?.accessToken ||
        (authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : "") ||
        ""

      if (token) {
        localStorage.setItem("token", token)
      } else {
        setErrorMessage("Login succeeded but no token was provided.")
        return
      }

      if (data.user) {
        localStorage.setItem("user", JSON.stringify(data.user))
      } else if (data?.data?.user) {
        localStorage.setItem("user", JSON.stringify(data.data.user))
      }

      navigate("/discover", { replace: true })

    } catch (error) {
      console.error("LOGIN ERROR:", error)
      setErrorMessage("Unable to reach the server. Please try again.")
    } finally {
      setIsLoggingIn(false)
    }
  }

  return (
    <main className="login-page">
      <div className="login-card">
        <h1>Welcome Back</h1>
        <p className="login-subtext">Log in to discover and manage campus events.</p>

        <form className="login-form" onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {errorMessage ? <p className="auth-error">{errorMessage}</p> : null}

          <button type="submit" className="login-btn" disabled={isLoggingIn}>
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
