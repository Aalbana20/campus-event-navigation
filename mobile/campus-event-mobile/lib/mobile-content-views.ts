import { supabase } from '@/lib/supabase';

// Deterministic pseudo-random view count keyed by the content id. Keeps the
// number stable across re-renders so tiles don't jitter while the real
// `content_views` aggregate rolls in.
const hashString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

export const getPlaceholderViewCount = (contentId: string) => {
  const hash = hashString(String(contentId || ''));
  const tier = hash % 100;
  if (tier < 55) return 1200 + (hash % 48000);
  if (tier < 85) return 50000 + (hash % 450000);
  return 500000 + (hash % 4000000);
};

export const formatViewCount = (value: number | null | undefined) => {
  const n = Number(value) || 0;
  if (n < 1000) return String(n);
  if (n < 1_000_000) {
    const k = n / 1000;
    return `${k >= 100 ? Math.round(k) : Number(k.toFixed(1))}K`;
  }
  const m = n / 1_000_000;
  return `${m >= 100 ? Math.round(m) : Number(m.toFixed(1))}M`;
};

export type ContentViewType = 'post' | 'video' | 'event';

export const recordContentView = async ({
  contentType,
  contentId,
  userId,
}: {
  contentType: ContentViewType;
  contentId: string;
  userId?: string | null;
}) => {
  if (!supabase || !contentId) return;

  const { error } = await supabase.from('content_views').insert({
    content_type: contentType,
    content_id: contentId,
    user_id: userId || null,
  });

  if (error && error.code !== '23505') {
    // Best-effort analytics; don't spam if the columns haven't rolled out yet.
    if (!/content_views|schema cache/i.test(error.message || '')) {
      console.warn('[content_views] insert failed:', error);
    }
  }
};
