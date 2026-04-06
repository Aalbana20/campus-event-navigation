import React, { useEffect } from "react"
import { useNavigate } from "react-router-dom"

const Logout = () => {
  const navigate = useNavigate()

  useEffect(() => {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    navigate("/auth/login", { replace: true })
  }, [navigate])

  return <div>Logging out...</div>
}

export default Logout
