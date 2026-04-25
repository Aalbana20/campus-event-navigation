import { DEFAULT_AVATAR } from '@/lib/mobile-backend';
import { resolveStoryMediaUrl } from '@/lib/mobile-story-composer';
import { normalizeStoryStickers, normalizeStoryType } from '@/lib/mobile-story-stickers';
import { supabase } from '@/lib/supabase';
import type { ProfileRecord, StoryMediaType, StoryRecord } from '@/types/models';

export type StoryHighlightRecord = {
  id: string;
  userId: string;
  title: string;
  coverUrl: string | null;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
};

export type StoryHighlightItemRecord = {
  id: string;
  highlightId: string;
  storyId: string | null;
  position: number;
  mediaUrl: string;
  mediaType: StoryMediaType;
  caption: string;
  storyCreatedAt: string;
};

export type ArchivedStoryRecord = {
  id: string;
  authorId: string;
  mediaUrl: string;
  mediaType: StoryMediaType;
  caption: string;
  createdAt: string;
  expiresAt: string;
};

type HighlightRow = {
  id: string;
  user_id: string;
  title: string | null;
  cover_url: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type HighlightItemRow = {
  id: string;
  highlight_id: string;
  story_id: string | null;
  position: number | null;
  media_url: string;
  media_type: 'image' | 'video';
  caption: string | null;
  story_created_at: string | null;
  created_at: string | null;
};

type StoryRow = {
  id: string;
  author_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  caption: string | null;
  created_at: string | null;
  expires_at: string | null;
  event_id?: string | null;
  story_type?: string | null;
  stickers?: unknown;
};

const toTrimmed = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

// PostgREST returns PGRST205 when a referenced table is missing from the
// schema cache. That happens transiently right after a migration, or when a
// client is run against a DB where this migration hasn't landed yet. In both
// cases we'd rather render an empty highlights row than spam the console.
const isMissingTableError = (error: { code?: string | null; message?: string | null }) =>
  error?.code === 'PGRST205' ||
  (typeof error?.message === 'string' &&
    /story_highlights|story_highlight_items/.test(error.message) &&
    /(could not find the table|schema cache)/i.test(error.message));

const normalizeHighlight = (
  row: HighlightRow,
  itemCount: number
): StoryHighlightRecord => ({
  id: String(row.id),
  userId: String(row.user_id),
  title: toTrimmed(row.title) || 'Highlight',
  coverUrl: row.cover_url ? resolveStoryMediaUrl(row.cover_url) : null,
  createdAt: row.created_at || new Date().toISOString(),
  updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
  itemCount,
});

const normalizeHighlightItem = (row: HighlightItemRow): StoryHighlightItemRecord => ({
  id: String(row.id),
  highlightId: String(row.highlight_id),
  storyId: row.story_id ? String(row.story_id) : null,
  position: Number(row.position ?? 0),
  mediaUrl: resolveStoryMediaUrl(toTrimmed(row.media_url)),
  mediaType: (row.media_type === 'video' ? 'video' : 'image') as StoryMediaType,
  caption: toTrimmed(row.caption),
  storyCreatedAt:
    row.story_created_at || row.created_at || new Date().toISOString(),
});

export const loadStoryHighlightsForUser = async (
  userId: string
): Promise<{ highlights: StoryHighlightRecord[]; itemsByHighlightId: Map<string, StoryHighlightItemRecord[]> }> => {
  const empty = {
    highlights: [] as StoryHighlightRecord[],
    itemsByHighlightId: new Map<string, StoryHighlightItemRecord[]>(),
  };
  if (!supabase || !userId) return empty;

  const { data: highlightRows, error: highlightsError } = await supabase
    .from('story_highlights')
    .select('id, user_id, title, cover_url, created_at, updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (highlightsError) {
    if (isMissingTableError(highlightsError)) return empty;
    console.error('Unable to load story highlights:', highlightsError);
    return empty;
  }

  const highlightIds = ((highlightRows || []) as HighlightRow[]).map((row) => String(row.id));
  if (highlightIds.length === 0) return empty;

  const { data: itemRows, error: itemsError } = await supabase
    .from('story_highlight_items')
    .select(
      'id, highlight_id, story_id, position, media_url, media_type, caption, story_created_at, created_at'
    )
    .in('highlight_id', highlightIds)
    .order('position', { ascending: true });

  if (itemsError && !isMissingTableError(itemsError)) {
    console.error('Unable to load story highlight items:', itemsError);
  }

  const itemsByHighlightId = new Map<string, StoryHighlightItemRecord[]>();
  for (const row of (itemRows || []) as HighlightItemRow[]) {
    const normalized = normalizeHighlightItem(row);
    const existing = itemsByHighlightId.get(normalized.highlightId) || [];
    existing.push(normalized);
    itemsByHighlightId.set(normalized.highlightId, existing);
  }

  const highlights = ((highlightRows || []) as HighlightRow[]).map((row) =>
    normalizeHighlight(row, itemsByHighlightId.get(String(row.id))?.length || 0)
  );

  return { highlights, itemsByHighlightId };
};

// Past stories for the archive picker. Unlike the feed, this ignores
// `expires_at` so users can pin stories from any time, including expired ones.
export const loadArchivedStoriesForUser = async (
  userId: string
): Promise<ArchivedStoryRecord[]> => {
  if (!supabase || !userId) return [];

  const { data, error } = await supabase
    .from('stories')
    .select('id, author_id, media_url, media_type, caption, created_at, expires_at')
    .eq('author_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Unable to load archived stories:', error);
    return [];
  }

  return ((data || []) as StoryRow[]).map((row) => ({
    id: String(row.id),
    authorId: String(row.author_id),
    mediaUrl: resolveStoryMediaUrl(toTrimmed(row.media_url)),
    mediaType: (row.media_type === 'video' ? 'video' : 'image') as StoryMediaType,
    caption: toTrimmed(row.caption),
    createdAt: row.created_at || new Date().toISOString(),
    expiresAt: row.expires_at || new Date().toISOString(),
  }));
};

export const createStoryHighlight = async ({
  userId,
  title,
  stories,
}: {
  userId: string;
  title: string;
  stories: ArchivedStoryRecord[];
}): Promise<StoryHighlightRecord | null> => {
  if (!supabase || !userId || stories.length === 0) return null;
  const cleanTitle = title.trim() || 'Highlight';
  const coverUrl = stories[0]?.mediaUrl || null;

  const { data: highlight, error: createError } = await supabase
    .from('story_highlights')
    .insert({
      user_id: userId,
      title: cleanTitle,
      cover_url: coverUrl,
    })
    .select('id, user_id, title, cover_url, created_at, updated_at')
    .single();

  if (createError || !highlight) {
    console.error('Unable to create story highlight:', createError);
    return null;
  }

  const itemRows = stories.map((story, index) => ({
    highlight_id: highlight.id,
    story_id: story.id,
    position: index,
    media_url: story.mediaUrl,
    media_type: story.mediaType,
    caption: story.caption || null,
    story_created_at: story.createdAt,
  }));

  const { error: itemsError } = await supabase
    .from('story_highlight_items')
    .insert(itemRows);

  if (itemsError) {
    console.error('Unable to attach items to story highlight:', itemsError);
    // Rollback: the highlight without items is useless and would render as an
    // empty square forever — drop it so the user can retry cleanly.
    await supabase.from('story_highlights').delete().eq('id', highlight.id);
    return null;
  }

  return normalizeHighlight(highlight as HighlightRow, stories.length);
};

export const deleteStoryHighlight = async (highlightId: string): Promise<boolean> => {
  if (!supabase || !highlightId) return false;
  const { error } = await supabase
    .from('story_highlights')
    .delete()
    .eq('id', highlightId);
  if (error) {
    console.error('Unable to delete story highlight:', error);
    return false;
  }
  return true;
};

// Materialize a highlight's items into StoryRecord[] so the existing
// StoryViewerModal can render them without any API changes.
export const buildStoryRecordsFromHighlightItems = (
  items: StoryHighlightItemRecord[],
  author: ProfileRecord
): StoryRecord[] =>
  [...items]
    .sort((a, b) => a.position - b.position)
    .map((item) => ({
      id: item.storyId || item.id,
      authorId: String(author.id),
      mediaUrl: item.mediaUrl,
      mediaType: item.mediaType,
      caption: item.caption,
      eventId: null,
      storyType: normalizeStoryType(null),
      stickers: normalizeStoryStickers(null),
      createdAt: item.storyCreatedAt,
      // Highlights don't expire; use a far-future date so viewers that
      // filter on expires_at still treat them as live.
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      authorName: author.name || author.username || 'Campus User',
      authorUsername: author.username || '',
      authorAvatar: author.avatar || DEFAULT_AVATAR,
    }));
