import React, { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../supabaseClient"

function Logout() {
  const navigate = useNavigate()

  useEffect(() => {
    let isActive = true

    ;(async () => {
      try {
        await supabase.auth.signOut()
      } catch (error) {
        console.error("Logout error:", error)
      }

      sessionStorage.removeItem("authMessage")

      // onAuthStateChange in App handles clearing localStorage.user via
      // syncStoredUserFromSession(null); ProtectedRoute will redirect, but
      // navigate directly so the user doesn't see a flash of the old shell.
      if (isActive) {
        navigate("/auth/login", { replace: true })
      }
    })()

    return () => {
      isActive = false
    }
  }, [navigate])

  return <div>Logging out...</div>
}

export default Logout
