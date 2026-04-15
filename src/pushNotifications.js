import { supabase } from "./supabaseClient"

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || ""

// Convert a base64 URL string to a Uint8Array (required by pushManager.subscribe)
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}

// Check if the browser supports push notifications
export function isPushSupported() {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  )
}

// Request permission and subscribe to push notifications.
// Returns true on success, false otherwise.
export async function registerPushNotifications(userId) {
  if (!isPushSupported()) return false
  if (!VAPID_PUBLIC_KEY) {
    console.warn("VITE_VAPID_PUBLIC_KEY is not set — push notifications disabled.")
    return false
  }

  try {
    const permission = await Notification.requestPermission()
    if (permission !== "granted") return false

    const registration = await navigator.serviceWorker.register("/sw.js")
    await navigator.serviceWorker.ready

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })

    const serialized = subscription.toJSON()
    const token = JSON.stringify(serialized)

    await supabase.from("push_tokens").upsert(
      { user_id: userId, token, platform: "web" },
      { onConflict: "user_id,token" }
    )

    return true
  } catch (error) {
    console.error("Push registration failed:", error)
    return false
  }
}

// Unsubscribe and remove the token from Supabase
export async function unregisterPushNotifications(userId) {
  if (!isPushSupported()) return

  try {
    const registration = await navigator.serviceWorker.getRegistration("/sw.js")
    if (!registration) return

    const subscription = await registration.pushManager.getSubscription()
    if (!subscription) return

    const token = JSON.stringify(subscription.toJSON())
    await subscription.unsubscribe()
    await supabase.from("push_tokens").delete().eq("user_id", userId).eq("token", token)
  } catch (error) {
    console.error("Push unregister failed:", error)
  }
}
