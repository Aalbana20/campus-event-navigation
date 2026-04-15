import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
// @ts-ignore — web-push has a Deno-compatible build
import webpush from "https://esm.sh/web-push@3.6.7"

// Supabase Edge Function: send-push
// Sends a Web Push notification to one or more users.
//
// Deploy:  supabase functions deploy send-push
//
// Required secrets (set via supabase secrets set):
//   VAPID_PUBLIC_KEY   — from: npx web-push generate-vapid-keys
//   VAPID_PRIVATE_KEY  — from: npx web-push generate-vapid-keys
//   VAPID_SUBJECT      — mailto:you@example.com
//   SUPABASE_SERVICE_ROLE_KEY
//
// POST body JSON:
// {
//   "user_ids": ["uuid", ...],
//   "title": "New message",
//   "body": "Ali sent you a message",
//   "url": "/#/messages",
//   "tag": "dm"           // optional — groups notifications
// }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY")!
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY")!
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@campus.edu"
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  let body: {
    user_ids: string[]
    title: string
    body: string
    url?: string
    tag?: string
  }

  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const { user_ids, title, body: notifBody, url = "/", tag } = body

  if (!user_ids?.length || !title || !notifBody) {
    return new Response(JSON.stringify({ error: "user_ids, title, and body are required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  // Fetch push tokens for the target users
  const { data: tokens, error: tokenError } = await supabase
    .from("push_tokens")
    .select("user_id, token")
    .in("user_id", user_ids)

  if (tokenError) {
    return new Response(JSON.stringify({ error: tokenError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  if (!tokens || tokens.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const payload = JSON.stringify({ title, body: notifBody, data: { url }, tag })
  const staleTokenIds: { user_id: string; token: string }[] = []
  let sent = 0

  await Promise.allSettled(
    tokens.map(async ({ user_id, token }) => {
      try {
        const subscription = JSON.parse(token)
        await webpush.sendNotification(subscription, payload)
        sent++
      } catch (err: unknown) {
        // 410 = subscription expired/unsubscribed — clean it up
        if (err && typeof err === "object" && "statusCode" in err && (err as { statusCode: number }).statusCode === 410) {
          staleTokenIds.push({ user_id, token })
        }
      }
    })
  )

  // Remove stale tokens
  if (staleTokenIds.length > 0) {
    for (const { user_id, token } of staleTokenIds) {
      await supabase.from("push_tokens").delete().eq("user_id", user_id).eq("token", token)
    }
  }

  return new Response(
    JSON.stringify({ sent, stale_removed: staleTokenIds.length }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  )
})
