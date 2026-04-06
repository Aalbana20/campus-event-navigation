import React, { useEffect } from "react"
import { supabase } from "../supabaseClient"

function Logout() {
  useEffect(() => {
    ;(async () => {
      try {
        await supabase.auth.signOut()
      } catch (error) {
        console.error("Logout error:", error)
      }

      localStorage.removeItem("user")
      sessionStorage.removeItem("authMessage")
      window.location.hash = "#/auth/login"
      window.location.reload()
    })()
  }, [])

  return <div>Logging out...</div>
}

export default Logout