import { supabase } from '@/lib/supabase';

export type ContentTagRecord = {
  id: string;
  postId: string;
  taggedUserId: string;
  taggerId: string;
  createdAt: string;
};

type ContentTagRow = {
  id: string;
  post_id: string;
  tagged_user_id: string;
  tagger_id: string;
  created_at?: string | null;
};

type EmbeddedDiscoverPost = {
  id: string;
  author_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  caption?: string | null;
  created_at?: string | null;
  on_grid?: boolean | null;
  event_id?: string | null;
};

type TaggedPostRow = ContentTagRow & {
  discover_posts?: EmbeddedDiscoverPost | EmbeddedDiscoverPost[] | null;
};

const pickEmbeddedPost = (
  value: EmbeddedDiscoverPost | EmbeddedDiscoverPost[] | null | undefined
): EmbeddedDiscoverPost | null => {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
};

const CONTENT_TAG_SELECT =
  'id, post_id, tagged_user_id, tagger_id, created_at';

const normalizeContentTagRow = (row: ContentTagRow): ContentTagRecord => ({
  id: String(row.id),
  postId: String(row.post_id),
  taggedUserId: String(row.tagged_user_id),
  taggerId: String(row.tagger_id),
  createdAt: row.created_at || new Date().toISOString(),
});

export const addContentTag = async ({
  postId,
  taggedUserId,
  taggerId,
}: {
  postId: string;
  taggedUserId: string;
  taggerId: string;
}): Promise<ContentTagRecord | null> => {
  if (!supabase || !postId || !taggedUserId || !taggerId) return null;

  const { data, error } = await supabase
    .from('content_tags')
    .insert({
      post_id: postId,
      tagged_user_id: taggedUserId,
      tagger_id: taggerId,
    })
    .select(CONTENT_TAG_SELECT)
    .single();

  if (error && error.code !== '23505') {
    console.error('Unable to add content tag:', error);
    throw new Error('Could not tag this user. Please try again.');
  }

  return data ? normalizeContentTagRow(data as ContentTagRow) : null;
};

export const removeContentTag = async ({
  postId,
  taggedUserId,
}: {
  postId: string;
  taggedUserId: string;
}): Promise<void> => {
  if (!supabase || !postId || !taggedUserId) return;

  const { error } = await supabase
    .from('content_tags')
    .delete()
    .eq('post_id', postId)
    .eq('tagged_user_id', taggedUserId);

  if (error) {
    console.error('Unable to remove content tag:', error);
    throw new Error('Could not remove the tag. Please try again.');
  }
};

export const loadTagsForPost = async (
  postId: string
): Promise<ContentTagRecord[]> => {
  if (!supabase || !postId) return [];

  const { data, error } = await supabase
    .from('content_tags')
    .select(CONTENT_TAG_SELECT)
    .eq('post_id', postId);

  if (error) {
    console.error('Unable to load content tags for post:', error);
    return [];
  }

  return ((data || []) as ContentTagRow[]).map(normalizeContentTagRow);
};

export type TaggedPostSummary = {
  tag: ContentTagRecord;
  post: {
    id: string;
    authorId: string;
    mediaUrl: string;
    mediaType: 'image' | 'video';
    caption: string;
    createdAt: string;
    onGrid: boolean;
    eventId: string | null;
  } | null;
};

export const loadPostsTaggingUser = async (
  userId: string
): Promise<TaggedPostSummary[]> => {
  if (!supabase || !userId) return [];

  const { data, error } = await supabase
    .from('content_tags')
    .select(
      `${CONTENT_TAG_SELECT}, discover_posts:post_id ( id, author_id, media_url, media_type, caption, created_at, on_grid, event_id )`
    )
    .eq('tagged_user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Unable to load tagged posts for user:', error);
    return [];
  }

  return ((data as unknown) as TaggedPostRow[] || []).map((row) => {
    const embedded = pickEmbeddedPost(row.discover_posts);

    return {
      tag: normalizeContentTagRow(row),
      post: embedded
        ? {
            id: String(embedded.id),
            authorId: String(embedded.author_id),
            mediaUrl: embedded.media_url,
            mediaType: embedded.media_type === 'video' ? 'video' : 'image',
            caption:
              typeof embedded.caption === 'string' ? embedded.caption : '',
            createdAt: embedded.created_at || new Date().toISOString(),
            onGrid: embedded.on_grid !== false,
            eventId: embedded.event_id ? String(embedded.event_id) : null,
          }
        : null,
    };
  });
};
