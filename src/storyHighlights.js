import { resolveStoryMediaUrl } from "./discoverStories"
import { supabase } from "./supabaseClient"

const toTrimmedString = (value) =>
  typeof value === "string" ? value.trim() : ""

const isMissingHighlightTableError = (error) =>
  error?.code === "PGRST205" ||
  (typeof error?.message === "string" &&
    /story_highlights|story_highlight_items/.test(error.message) &&
    /(could not find the table|schema cache)/i.test(error.message))

const normalizeHighlight = (row, itemCount = 0) => ({
  id: String(row.id),
  userId: String(row.user_id),
  title: toTrimmedString(row.title) || "Highlight",
  coverUrl: row.cover_url ? resolveStoryMediaUrl(row.cover_url) : "",
  createdAt: row.created_at || new Date().toISOString(),
  updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
  itemCount,
})

export async function loadStoryHighlightsForUser(userId) {
  const empty = { highlights: [], itemsByHighlightId: new Map() }
  if (!supabase || !userId) return empty

  const { data: highlightRows, error: highlightsError } = await supabase
    .from("story_highlights")
    .select("id, user_id, title, cover_url, created_at, updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (highlightsError) {
    if (isMissingHighlightTableError(highlightsError)) return empty
    console.error("Unable to load story highlights:", highlightsError)
    return empty
  }

  const highlightIds = (highlightRows || []).map((row) => String(row.id))
  if (highlightIds.length === 0) return empty

  const { data: itemRows, error: itemsError } = await supabase
    .from("story_highlight_items")
    .select("id, highlight_id, story_id, position, media_url, media_type, caption, story_created_at, created_at")
    .in("highlight_id", highlightIds)
    .order("position", { ascending: true })

  if (itemsError && !isMissingHighlightTableError(itemsError)) {
    console.error("Unable to load story highlight items:", itemsError)
  }

  const itemsByHighlightId = new Map()
  ;(itemRows || []).forEach((row) => {
    const highlightId = String(row.highlight_id)
    const currentItems = itemsByHighlightId.get(highlightId) || []
    currentItems.push({
      id: String(row.id),
      highlightId,
      storyId: row.story_id ? String(row.story_id) : "",
      position: Number(row.position ?? 0),
      mediaUrl: resolveStoryMediaUrl(toTrimmedString(row.media_url)),
      mediaType: row.media_type === "video" ? "video" : "image",
      caption: toTrimmedString(row.caption),
      storyCreatedAt: row.story_created_at || row.created_at || new Date().toISOString(),
    })
    itemsByHighlightId.set(highlightId, currentItems)
  })

  return {
    highlights: (highlightRows || []).map((row) =>
      normalizeHighlight(row, itemsByHighlightId.get(String(row.id))?.length || 0)
    ),
    itemsByHighlightId,
  }
}
