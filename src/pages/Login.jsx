import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"

function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  const handleLogin = async (e) => {
    e.preventDefault()
    setErrorMessage("")

    if (!email.trim() || !password) {
      setErrorMessage("Please enter both email and password.")
      return
    }

    try {
      setIsLoggingIn(true)
      const res = await fetch("http://localhost:5000/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: email.trim(), password }),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        setErrorMessage(data.error || "Login failed.")
        return
      }

      localStorage.setItem("user", JSON.stringify(data))
      navigate("/")
    } catch {
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
