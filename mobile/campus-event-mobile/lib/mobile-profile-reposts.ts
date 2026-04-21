import { supabase } from '@/lib/supabase';

export type RepostTargetType = 'event' | 'post';

export type RepostRecord = {
  id: string;
  userId: string;
  targetType: RepostTargetType;
  eventId: string | null;
  postId: string | null;
  createdAt: string;
};

type RepostRow = {
  id: string;
  user_id: string;
  target_type?: string | null;
  event_id?: string | null;
  post_id?: string | null;
  created_at?: string | null;
};

const REPOST_SELECT_COLUMNS =
  'id, user_id, target_type, event_id, post_id, created_at';

const normalizeRepostRow = (row: RepostRow): RepostRecord => ({
  id: String(row.id),
  userId: String(row.user_id),
  targetType: row.target_type === 'post' ? 'post' : 'event',
  eventId: row.event_id ? String(row.event_id) : null,
  postId: row.post_id ? String(row.post_id) : null,
  createdAt: row.created_at || new Date().toISOString(),
});

export const loadRepostsForUser = async (
  userId: string
): Promise<RepostRecord[]> => {
  if (!supabase || !userId) return [];

  const { data, error } = await supabase
    .from('reposts')
    .select(REPOST_SELECT_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Unable to load user reposts:', error);
    return [];
  }

  return ((data || []) as RepostRow[]).map(normalizeRepostRow);
};

export const loadRepostedPostsForUser = async (userId: string) => {
  const reposts = await loadRepostsForUser(userId);
  return reposts.filter((row) => row.targetType === 'post');
};

export const loadRepostedEventsForUser = async (userId: string) => {
  const reposts = await loadRepostsForUser(userId);
  return reposts.filter((row) => row.targetType === 'event');
};

export const repostPost = async ({
  userId,
  postId,
}: {
  userId: string;
  postId: string;
}): Promise<RepostRecord | null> => {
  if (!supabase || !userId || !postId) return null;

  const { data, error } = await supabase
    .from('reposts')
    .insert({
      user_id: userId,
      post_id: postId,
      target_type: 'post',
    })
    .select(REPOST_SELECT_COLUMNS)
    .single();

  if (error && error.code !== '23505') {
    console.error('Unable to repost post:', error);
    throw new Error('Could not repost right now. Please try again.');
  }

  return data ? normalizeRepostRow(data as RepostRow) : null;
};

export const unrepostPost = async ({
  userId,
  postId,
}: {
  userId: string;
  postId: string;
}): Promise<void> => {
  if (!supabase || !userId || !postId) return;

  const { error } = await supabase
    .from('reposts')
    .delete()
    .eq('user_id', userId)
    .eq('target_type', 'post')
    .eq('post_id', postId);

  if (error) {
    console.error('Unable to remove post repost:', error);
    throw new Error('Could not remove the repost. Please try again.');
  }
};

export const hasUserRepostedPost = async ({
  userId,
  postId,
}: {
  userId: string;
  postId: string;
}): Promise<boolean> => {
  if (!supabase || !userId || !postId) return false;

  const { data, error } = await supabase
    .from('reposts')
    .select('id')
    .eq('user_id', userId)
    .eq('target_type', 'post')
    .eq('post_id', postId)
    .limit(1);

  if (error) {
    console.error('Unable to check post repost state:', error);
    return false;
  }

  return (data || []).length > 0;
};
