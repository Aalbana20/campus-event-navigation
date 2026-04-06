import React, { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { supabase } from "../supabaseClient"

const createUsernameFromEmail = (email) => {
  const [username = "campus-user"] = email.split("@")
  return username || "campus-user"
}

function SignUp() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const navigate = useNavigate()

  const handleSignUp = async (e) => {
    e.preventDefault()

    try {
      setIsLoading(true)
      setErrorMessage("")
      const cleanEmail = email.trim().toLowerCase()
      const username = createUsernameFromEmail(cleanEmail)

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            username,
            name: username,
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

      if (data.session) {
        await supabase.auth.signOut()
      }

      localStorage.removeItem("user")
      sessionStorage.setItem("authMessage", "Account created. Log in with your new account.")
      navigate("/auth/login", { replace: true })
    } catch (error) {
      setErrorMessage(error.message || "Signup failed.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Sign Up</h1>
        <p className="login-subtext">
          Create your account with Supabase and then sign in to continue.
        </p>

        {errorMessage && <p className="auth-error">{errorMessage}</p>}

        <form className="login-form" onSubmit={handleSignUp}>
          <input
            type="email"
            placeholder="Email"
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
            autoComplete="new-password"
            required
          />

          <button className="login-btn" type="submit" disabled={isLoading}>
            {isLoading ? "Creating..." : "Sign Up"}
          </button>
        </form>

        <p className="login-footer">
          <Link to="/auth/login">Already have an account?</Link>
        </p>
      </div>
    </div>
  )
}

export default SignUp
