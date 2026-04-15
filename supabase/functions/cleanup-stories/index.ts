import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Supabase Edge Function: cleanup-stories
// Deletes expired stories (expires_at < now()) and their associated storage objects.
//
// Deploy:  supabase functions deploy cleanup-stories
// Schedule via Supabase Dashboard → Edge Functions → Schedule,
// or via pg_cron (see supabase/migrations.sql cleanup section).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const now = new Date().toISOString()

  // Fetch expired story rows so we can delete their storage objects too
  const { data: expiredStories, error: fetchError } = await supabase
    .from("stories")
    .select("id, media_url")
    .lt("expires_at", now)

  if (fetchError) {
    return new Response(JSON.stringify({ error: fetchError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  if (!expiredStories || expiredStories.length === 0) {
    return new Response(JSON.stringify({ deleted: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  // Extract storage paths from media_url values
  const storagePaths = expiredStories
    .map((story) => {
      if (!story.media_url) return null
      // media_url is either a full storage URL or a relative path like "stories/media/..."
      const match = story.media_url.match(/\/storage\/v1\/object\/public\/stories\/(.+)/)
      if (match) return match[1]
      if (story.media_url.startsWith("stories/")) return story.media_url.slice("stories/".length)
      return null
    })
    .filter(Boolean) as string[]

  // Delete storage objects
  if (storagePaths.length > 0) {
    await supabase.storage.from("stories").remove(storagePaths)
  }

  // Delete related records first (foreign key constraints)
  const expiredIds = expiredStories.map((s) => s.id)

  await supabase.from("story_views").delete().in("story_id", expiredIds)
  await supabase.from("story_reactions").delete().in("story_id", expiredIds)
  await supabase.from("story_shares").delete().in("story_id", expiredIds)

  // Delete the stories themselves
  const { error: deleteError } = await supabase
    .from("stories")
    .delete()
    .lt("expires_at", now)

  if (deleteError) {
    return new Response(JSON.stringify({ error: deleteError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  return new Response(
    JSON.stringify({ deleted: expiredStories.length, paths_removed: storagePaths.length }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  )
})
