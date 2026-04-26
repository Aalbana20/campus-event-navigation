import { supabase } from '@/lib/supabase';

export type ProfileNoteRecord = {
  id: string;
  userId: string;
  body: string;
  visibility: 'public' | 'followers' | 'mutuals';
  createdAt: string;
  expiresAt: string;
};

type ProfileNoteRow = {
  id: string;
  user_id: string;
  body: string;
  visibility?: string | null;
  created_at?: string | null;
  expires_at?: string | null;
};

const normalizeProfileNote = (row: ProfileNoteRow): ProfileNoteRecord => ({
  id: String(row.id),
  userId: String(row.user_id),
  body: String(row.body || ''),
  visibility:
    row.visibility === 'public' || row.visibility === 'mutuals'
      ? row.visibility
      : 'followers',
  createdAt: row.created_at || new Date().toISOString(),
  expiresAt: row.expires_at || new Date().toISOString(),
});

export const loadActiveProfileNotes = async (userIds?: string[]) => {
  if (!supabase) return [];

  let query = supabase
    .from('profile_notes')
    .select('id, user_id, body, visibility, created_at, expires_at')
    .is('deleted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  const normalizedUserIds = [...new Set((userIds || []).map(String).filter(Boolean))];
  if (normalizedUserIds.length > 0) {
    query = query.in('user_id', normalizedUserIds);
  }

  const { data, error } = await query;

  if (error) {
    console.warn('Unable to load profile notes:', error);
    return [];
  }

  return ((data || []) as ProfileNoteRow[]).map(normalizeProfileNote);
};

export const upsertProfileNote = async ({
  userId,
  body,
  visibility = 'followers',
}: {
  userId: string;
  body: string;
  visibility?: ProfileNoteRecord['visibility'];
}) => {
  if (!supabase) return null;

  const trimmedBody = body.trim().slice(0, 120);
  if (!trimmedBody) return null;

  const { data, error } = await supabase
    .from('profile_notes')
    .insert({
      user_id: userId,
      body: trimmedBody,
      visibility,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
    .select('id, user_id, body, visibility, created_at, expires_at')
    .single();

  if (error) {
    console.warn('Unable to save profile note:', error);
    return null;
  }

  return normalizeProfileNote(data as ProfileNoteRow);
};

export const deleteProfileNote = async (noteId: string) => {
  if (!supabase || !noteId) return false;

  const { error } = await supabase
    .from('profile_notes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', noteId);

  if (error) {
    console.warn('Unable to delete profile note:', error);
    return false;
  }

  return true;
};
