import React, { useEffect } from "react"
import { useNavigate } from "react-router-dom"

function Logout() {
  const navigate = useNavigate()

  useEffect(() => {
    // Clear user session
    localStorage.removeItem("user")

    // Redirect to login
    navigate("/auth/login")
  }, [navigate])

  return (
    <div style={{ textAlign: "center", marginTop: "100px" }}>
      <h2>Logging you out...</h2>
    </div>
  )
}

export default Logout