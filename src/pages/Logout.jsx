import { useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"

function Logout() {
  const navigate = useNavigate()

  useEffect(() => {
    localStorage.removeItem("user")
  }, [])

  return (
    <main className="login-page">
      <div className="login-card">
        <h1>Signed Out</h1>
        <p className="login-subtext">You have been logged out of your account.</p>
        <div className="logout-actions">
          <button className="login-btn" onClick={() => navigate("/auth/login")}>
            Go To Login
          </button>
          <p className="login-footer">
            Need a new account? <Link to="/auth/signup">Sign Up</Link>
          </p>
        </div>
      </div>
    </main>
  )
}

export default Logout
